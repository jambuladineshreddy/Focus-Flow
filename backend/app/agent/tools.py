"""
Tool definitions for the FocusFlow AI agent.
Each tool is a typed function that the agent can call.
"""
import json
import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from ..repositories.task_goal_repo import TaskRepository, GoalRepository
from ..repositories.calendar_doc_repo import CalendarRepository
from ..rag.vector_store import search_knowledge_base as search_kb
from ..models.models import TaskStatus, TaskPriority, GoalStatus

logger = logging.getLogger(__name__)


class AgentTools:
    """
    Concrete implementations of all agent tools.
    These are called by the agent after the LLM decides which tool to use.
    """

    def __init__(self, db: AsyncSession, user_id: UUID):
        self.db = db
        self.user_id = user_id
        self.task_repo = TaskRepository(db)
        self.goal_repo = GoalRepository(db)
        self.calendar_repo = CalendarRepository(db)

    async def search_knowledge_base(self, query: str, n_results: int = 5) -> Dict[str, Any]:
        """Search the user's uploaded documents for relevant information."""
        results = search_kb(str(self.user_id), query, n_results)
        if not results:
            return {
                "found": False,
                "message": "No relevant information found in your knowledge base.",
                "results": []
            }
        return {
            "found": True,
            "results": results,
            "sources": list({r["document_name"] for r in results}),
        }

    async def create_task(
        self,
        title: str,
        description: Optional[str] = None,
        priority: str = "medium",
        due_date: Optional[str] = None,
        estimated_minutes: Optional[int] = None,
        goal_id: Optional[str] = None,
        category: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Create a new task for the user."""
        try:
            data = {
                "title": title,
                "description": description,
                "priority": priority.lower(),
                "status": "todo",
                "category": category,
                "estimated_minutes": estimated_minutes,
            }
            if due_date:
                try:
                    data["due_date"] = datetime.fromisoformat(due_date.replace("Z", "+00:00"))
                except ValueError:
                    pass
            if goal_id:
                try:
                    data["goal_id"] = UUID(goal_id)
                except ValueError:
                    pass

            task = await self.task_repo.create(self.user_id, data)
            return {
                "success": True,
                "task_id": str(task.id),
                "title": task.title,
                "priority": task.priority,
                "due_date": task.due_date.isoformat() if task.due_date else None,
            }
        except Exception as e:
            logger.error(f"create_task error: {e}")
            return {"success": False, "error": str(e)}

    async def list_tasks(
        self,
        status: Optional[str] = None,
        priority: Optional[str] = None,
        filter_type: Optional[str] = None,
        goal_id: Optional[str] = None,
        limit: int = 20,
    ) -> Dict[str, Any]:
        """List the user's tasks with optional filters."""
        try:
            gid = UUID(goal_id) if goal_id else None
            tasks = await self.task_repo.get_all(
                self.user_id,
                status=status,
                priority=priority,
                goal_id=gid,
                filter_type=filter_type,
                limit=limit,
            )
            return {
                "count": len(tasks),
                "tasks": [
                    {
                        "id": str(t.id),
                        "title": t.title,
                        "priority": t.priority,
                        "status": t.status,
                        "due_date": t.due_date.isoformat() if t.due_date else None,
                        "estimated_minutes": t.estimated_minutes,
                        "description": t.description,
                    }
                    for t in tasks
                ],
            }
        except Exception as e:
            logger.error(f"list_tasks error: {e}")
            return {"count": 0, "tasks": [], "error": str(e)}

    async def update_task(
        self,
        task_id: str,
        status: Optional[str] = None,
        priority: Optional[str] = None,
        due_date: Optional[str] = None,
        estimated_minutes: Optional[int] = None,
        description: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Update an existing task."""
        try:
            data = {}
            if status:
                data["status"] = status.lower()
            if priority:
                data["priority"] = priority.lower()
            if estimated_minutes:
                data["estimated_minutes"] = estimated_minutes
            if description:
                data["description"] = description
            if due_date:
                try:
                    data["due_date"] = datetime.fromisoformat(due_date.replace("Z", "+00:00"))
                except ValueError:
                    pass

            task = await self.task_repo.update(UUID(task_id), self.user_id, data)
            if not task:
                return {"success": False, "error": "Task not found"}
            return {
                "success": True,
                "task_id": str(task.id),
                "title": task.title,
                "status": task.status,
                "priority": task.priority,
            }
        except Exception as e:
            logger.error(f"update_task error: {e}")
            return {"success": False, "error": str(e)}

    async def create_goal(
        self,
        title: str,
        description: Optional[str] = None,
        deadline: Optional[str] = None,
        priority: str = "medium",
        category: str = "other",
    ) -> Dict[str, Any]:
        """Create a new goal."""
        try:
            data = {
                "title": title,
                "description": description,
                "priority": priority.lower(),
                "category": category.lower(),
                "status": "active",
            }
            if deadline:
                try:
                    data["deadline"] = datetime.fromisoformat(deadline.replace("Z", "+00:00"))
                except ValueError:
                    pass

            goal = await self.goal_repo.create(self.user_id, data)
            return {
                "success": True,
                "goal_id": str(goal.id),
                "title": goal.title,
                "deadline": goal.deadline.isoformat() if goal.deadline else None,
            }
        except Exception as e:
            logger.error(f"create_goal error: {e}")
            return {"success": False, "error": str(e)}

    async def list_goals(
        self, status: Optional[str] = None
    ) -> Dict[str, Any]:
        """List the user's goals."""
        try:
            goals = await self.goal_repo.get_all(self.user_id, status=status)
            return {
                "count": len(goals),
                "goals": [
                    {
                        "id": str(g.id),
                        "title": g.title,
                        "status": g.status,
                        "priority": g.priority,
                        "category": g.category,
                        "deadline": g.deadline.isoformat() if g.deadline else None,
                        "progress": g.progress,
                        "task_count": len(g.tasks),
                    }
                    for g in goals
                ],
            }
        except Exception as e:
            logger.error(f"list_goals error: {e}")
            return {"count": 0, "goals": [], "error": str(e)}

    async def create_calendar_event(
        self,
        title: str,
        start_time: str,
        end_time: str,
        description: Optional[str] = None,
        color: str = "#6366f1",
    ) -> Dict[str, Any]:
        """Create a calendar event after checking for conflicts."""
        try:
            start_dt = datetime.fromisoformat(start_time.replace("Z", "+00:00"))
            end_dt = datetime.fromisoformat(end_time.replace("Z", "+00:00"))

            # Check for conflicts
            conflicts = await self.calendar_repo.check_conflicts(
                self.user_id, start_dt, end_dt
            )
            if conflicts:
                conflict_info = [
                    f"'{c.title}' ({c.start_time.strftime('%H:%M')} - {c.end_time.strftime('%H:%M')})"
                    for c in conflicts
                ]
                return {
                    "success": False,
                    "conflict": True,
                    "conflicting_events": conflict_info,
                    "message": f"Time slot conflicts with: {', '.join(conflict_info)}",
                }

            event = await self.calendar_repo.create(
                self.user_id,
                {
                    "title": title,
                    "description": description,
                    "start_time": start_dt,
                    "end_time": end_dt,
                    "color": color,
                    "is_ai_generated": True,
                },
            )
            return {
                "success": True,
                "event_id": str(event.id),
                "title": event.title,
                "start_time": event.start_time.isoformat(),
                "end_time": event.end_time.isoformat(),
            }
        except Exception as e:
            logger.error(f"create_calendar_event error: {e}")
            return {"success": False, "error": str(e)}

    async def get_calendar_events(
        self,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Get existing calendar events in a date range."""
        try:
            start = None
            end = None
            if start_date:
                start = datetime.fromisoformat(start_date.replace("Z", "+00:00"))
            if end_date:
                end = datetime.fromisoformat(end_date.replace("Z", "+00:00"))

            events = await self.calendar_repo.get_events(self.user_id, start, end)
            return {
                "count": len(events),
                "events": [
                    {
                        "id": str(e.id),
                        "title": e.title,
                        "start_time": e.start_time.isoformat(),
                        "end_time": e.end_time.isoformat(),
                        "description": e.description,
                    }
                    for e in events
                ],
            }
        except Exception as e:
            logger.error(f"get_calendar_events error: {e}")
            return {"count": 0, "events": [], "error": str(e)}


# ─── Tool Schemas for Gemini ──────────────────────────────────────────────────

TOOL_DEFINITIONS = [
    {
        "name": "search_knowledge_base",
        "description": "Search the user's uploaded documents and knowledge base for relevant information. Use this when the user references their notes, syllabus, documentation, or asks about content from their uploaded files.",
        "parameters": {
            "type": "object",
            "properties": {
                "query": {"type": "string", "description": "The search query to find relevant information"},
                "n_results": {"type": "integer", "description": "Number of results to return (default 5)"},
            },
            "required": ["query"],
        },
    },
    {
        "name": "create_task",
        "description": "Create a new task for the user. Use this when the user wants to add a task, to-do item, or action item.",
        "parameters": {
            "type": "object",
            "properties": {
                "title": {"type": "string", "description": "Short, clear task title"},
                "description": {"type": "string", "description": "Optional detailed description"},
                "priority": {"type": "string", "enum": ["low", "medium", "high"], "description": "Task priority level"},
                "due_date": {"type": "string", "description": "Due date in ISO format (YYYY-MM-DDTHH:MM:SS)"},
                "estimated_minutes": {"type": "integer", "description": "Estimated time to complete in minutes"},
                "goal_id": {"type": "string", "description": "Optional ID of the parent goal"},
                "category": {"type": "string", "description": "Optional category (e.g., study, work, personal)"},
            },
            "required": ["title"],
        },
    },
    {
        "name": "list_tasks",
        "description": "List the user's tasks with optional filters. Call this to check what tasks exist before making recommendations.",
        "parameters": {
            "type": "object",
            "properties": {
                "status": {"type": "string", "enum": ["todo", "in_progress", "completed"]},
                "priority": {"type": "string", "enum": ["low", "medium", "high"]},
                "filter_type": {"type": "string", "enum": ["today", "tomorrow", "upcoming", "overdue"], "description": "Time-based filter"},
                "goal_id": {"type": "string", "description": "Filter tasks by goal ID"},
                "limit": {"type": "integer", "description": "Maximum tasks to return"},
            },
        },
    },
    {
        "name": "update_task",
        "description": "Update an existing task's fields (status, priority, due date, etc.)",
        "parameters": {
            "type": "object",
            "properties": {
                "task_id": {"type": "string", "description": "The task UUID to update"},
                "status": {"type": "string", "enum": ["todo", "in_progress", "completed"]},
                "priority": {"type": "string", "enum": ["low", "medium", "high"]},
                "due_date": {"type": "string", "description": "New due date in ISO format"},
                "estimated_minutes": {"type": "integer"},
                "description": {"type": "string"},
            },
            "required": ["task_id"],
        },
    },
    {
        "name": "create_goal",
        "description": "Create a new goal for the user. Goals contain multiple tasks.",
        "parameters": {
            "type": "object",
            "properties": {
                "title": {"type": "string", "description": "Goal title"},
                "description": {"type": "string", "description": "Goal description"},
                "deadline": {"type": "string", "description": "Deadline in ISO format"},
                "priority": {"type": "string", "enum": ["low", "medium", "high"]},
                "category": {"type": "string", "enum": ["study", "work", "career", "personal", "health", "other"]},
            },
            "required": ["title"],
        },
    },
    {
        "name": "list_goals",
        "description": "List the user's goals.",
        "parameters": {
            "type": "object",
            "properties": {
                "status": {"type": "string", "enum": ["active", "completed", "paused", "cancelled"]},
            },
        },
    },
    {
        "name": "create_calendar_event",
        "description": "Create a calendar event. Always check for conflicts with get_calendar_events first when scheduling. For bulk scheduling (3+ events), summarize the plan and ask for confirmation before calling this.",
        "parameters": {
            "type": "object",
            "properties": {
                "title": {"type": "string"},
                "start_time": {"type": "string", "description": "Start datetime in ISO format"},
                "end_time": {"type": "string", "description": "End datetime in ISO format"},
                "description": {"type": "string"},
                "color": {"type": "string", "description": "Hex color code"},
            },
            "required": ["title", "start_time", "end_time"],
        },
    },
    {
        "name": "get_calendar_events",
        "description": "Get existing calendar events in a date range. Always call this before scheduling to check availability.",
        "parameters": {
            "type": "object",
            "properties": {
                "start_date": {"type": "string", "description": "Start of range in ISO format"},
                "end_date": {"type": "string", "description": "End of range in ISO format"},
            },
        },
    },
]
