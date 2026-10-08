"""
Core AI Agent using Google Gemini with tool calling.
Follows a single-agent architecture with explicit tool execution.
"""
import json
import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple
from uuid import UUID

import google.generativeai as genai
from google.generativeai.types import FunctionDeclaration, Tool

from sqlalchemy.ext.asyncio import AsyncSession

from ..config import settings
from ..models.models import User
from .prompts import SYSTEM_PROMPT, PLANNING_PROMPT
from .tools import AgentTools, TOOL_DEFINITIONS

logger = logging.getLogger(__name__)

# Configure Gemini
genai.configure(api_key=settings.GOOGLE_API_KEY)

# Safe tools that don't need confirmation
SAFE_TOOLS = {
    "search_knowledge_base",
    "list_tasks",
    "list_goals",
    "get_calendar_events",
}

# Tools that always require confirmation for bulk use
CONFIRMATION_REQUIRED_TOOLS = {
    "create_calendar_event",  # Only for bulk (3+)
}

MAX_TOOL_ITERATIONS = 8

# Priority ordered list of fallback models
MODEL_CANDIDATES = [
    settings.GEMINI_MODEL,
    "gemini-3.5-flash",
    "gemini-3.6-flash",
    "gemini-3.7-flash",
    "gemini-3.5-flash-lite",
]


def _build_gemini_tools() -> List[Tool]:
    """Convert our tool definitions to Gemini Tool format."""
    declarations = []
    for tool_def in TOOL_DEFINITIONS:
        params = tool_def.get("parameters", {})
        # Build Gemini-compatible schema
        declaration = FunctionDeclaration(
            name=tool_def["name"],
            description=tool_def["description"],
            parameters={
                "type": "object",
                "properties": params.get("properties", {}),
                "required": params.get("required", []),
            },
        )
        declarations.append(declaration)
    return [Tool(function_declarations=declarations)]


class FocusFlowAgent:
    """
    Single AI agent that orchestrates task, goal, calendar, and RAG operations.
    Uses Gemini with function calling to decide which tools to invoke.
    Includes multi-model fallback to ensure high availability.
    """

    def __init__(self, db: AsyncSession, user: User):
        self.db = db
        self.user = user
        self.tools = AgentTools(db, user.id)
        self.gemini_tools = _build_gemini_tools()
        self.system_instruction = self._build_system_prompt()

        # Build unique ordered candidate models
        seen = set()
        self.available_models = []
        for m in MODEL_CANDIDATES:
            if m and m not in seen:
                seen.add(m)
                self.available_models.append(m)

    def _get_generative_model(self, model_name: str) -> genai.GenerativeModel:
        return genai.GenerativeModel(
            model_name=model_name,
            tools=self.gemini_tools,
            system_instruction=self.system_instruction,
        )

    def _build_system_prompt(self) -> str:
        now = datetime.now(timezone.utc)
        return SYSTEM_PROMPT.format(
            context=f"User has working hours {self.user.working_hours_start}:00 - {self.user.working_hours_end}:00.",
            current_datetime=now.strftime("%A, %B %d, %Y at %I:%M %p UTC"),
            user_name=self.user.full_name,
            working_hours_start=self.user.working_hours_start,
            working_hours_end=self.user.working_hours_end,
        )

    def _build_history(self, previous_messages: List[Dict]) -> List[Dict]:
        """Convert stored messages to Gemini history format."""
        history = []
        for msg in previous_messages:
            role = "user" if msg["role"] == "user" else "model"
            history.append({
                "role": role,
                "parts": [{"text": msg["content"]}],
            })
        return history

    async def _execute_tool(self, tool_name: str, tool_args: Dict) -> str:
        """Execute a tool and return the result as a JSON string."""
        logger.info(f"Executing tool: {tool_name} with args: {list(tool_args.keys())}")

        try:
            if tool_name == "search_knowledge_base":
                result = await self.tools.search_knowledge_base(**tool_args)
            elif tool_name == "create_task":
                result = await self.tools.create_task(**tool_args)
            elif tool_name == "list_tasks":
                result = await self.tools.list_tasks(**tool_args)
            elif tool_name == "update_task":
                result = await self.tools.update_task(**tool_args)
            elif tool_name == "create_goal":
                result = await self.tools.create_goal(**tool_args)
            elif tool_name == "list_goals":
                result = await self.tools.list_goals(**tool_args)
            elif tool_name == "create_calendar_event":
                result = await self.tools.create_calendar_event(**tool_args)
            elif tool_name == "get_calendar_events":
                result = await self.tools.get_calendar_events(**tool_args)
            else:
                result = {"error": f"Unknown tool: {tool_name}"}

            return json.dumps(result, default=str)

        except Exception as e:
            logger.error(f"Tool execution error ({tool_name}): {e}")
            return json.dumps({"error": f"Tool failed: {str(e)}"})

    async def chat(
        self,
        user_message: str,
        conversation_history: List[Dict],
    ) -> Tuple[str, List[str], str]:
        """
        Process a user message and return:
        - (response_text, sources_used, tools_summary)
        Tries configured model first, automatically falling back if rate limits or quota exceeded.
        """
        history = self._build_history(conversation_history)
        last_error = None

        for model_name in self.available_models:
            try:
                logger.info(f"Attempting agent chat with model: {model_name}")
                gen_model = self._get_generative_model(model_name)
                chat = gen_model.start_chat(history=history)

                # Initial message to the model
                response = await chat.send_message_async(user_message)

                tools_used = []
                sources_used = []
                iterations = 0

                # Agentic loop: execute tools until model gives a final response
                while iterations < MAX_TOOL_ITERATIONS:
                    iterations += 1

                    # Check if model wants to call tools
                    function_calls = []
                    if response.candidates and response.candidates[0].content:
                        for part in response.candidates[0].content.parts:
                            try:
                                if hasattr(part, "function_call") and part.function_call and part.function_call.name:
                                    function_calls.append(part.function_call)
                            except Exception:
                                pass

                    if not function_calls:
                        # No more tool calls — we have the final response
                        break

                    # Execute all requested tools
                    tool_parts = []
                    for fc in function_calls:
                        tool_name = fc.name
                        tool_args = dict(fc.args) if fc.args else {}
                        tools_used.append(tool_name)

                        result_json = await self._execute_tool(tool_name, tool_args)
                        result_data = json.loads(result_json)

                        # Collect sources from RAG
                        if tool_name == "search_knowledge_base" and result_data.get("sources"):
                            sources_used.extend(result_data["sources"])

                        # Pass valid protobuf FunctionResponse part back to Gemini
                        tool_parts.append(
                            genai.protos.Part(
                                function_response=genai.protos.FunctionResponse(
                                    name=tool_name,
                                    response={"result": result_data},
                                )
                            )
                        )

                    # Send tool results back to model
                    response = await chat.send_message_async(tool_parts)

                # Extract final text response
                final_text = ""
                if response.candidates and response.candidates[0].content:
                    for part in response.candidates[0].content.parts:
                        try:
                            if hasattr(part, "text") and part.text:
                                final_text += part.text
                        except Exception:
                            pass

                if not final_text:
                    final_text = "I've completed the requested actions. Is there anything else you need?"

                tools_summary = json.dumps(list(set(tools_used))) if tools_used else None
                unique_sources = list(set(sources_used))

                return final_text, unique_sources, tools_summary

            except Exception as e:
                err_msg = str(e)
                logger.warning(f"Agent model {model_name} failed: {err_msg}")
                last_error = e
                # If error is quota or model not found, continue to next fallback model
                if "429" in err_msg or "ResourceExhausted" in err_msg or "404" in err_msg or "not found" in err_msg:
                    continue
                # For other errors, also try next model once
                continue

        logger.error(f"All agent models failed. Last error: {last_error}", exc_info=True)
        return (
            "I encountered an issue processing your request. Please try again. "
            "If the problem persists, check that your API key is configured correctly.",
            [],
            None,
        )
