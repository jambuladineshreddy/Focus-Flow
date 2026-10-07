import json
import logging
from datetime import datetime, timezone
from typing import List, Optional
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from ...models.database import get_db
from ...models.models import User
from ...schemas.schemas import (
    AgentChatRequest, AgentChatResponse, MessageResponse,
    ConversationResponse, DashboardResponse, DashboardStats
)
from ...services.auth_service import get_current_user
from ...repositories.calendar_doc_repo import ConversationRepository, CalendarRepository
from ...repositories.task_goal_repo import TaskRepository, GoalRepository
from ...agent.agent import FocusFlowAgent

logger = logging.getLogger(__name__)
router = APIRouter(tags=["agent"])


# ─── AI Chat ──────────────────────────────────────────────────────────────────

@router.post("/agent/chat", response_model=AgentChatResponse)
async def chat(
    request: AgentChatRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    conv_repo = ConversationRepository(db)
    
    # Get or create conversation
    conversation = await conv_repo.get_or_create(current_user.id, request.conversation_id)
    
    # Store user message
    await conv_repo.add_message(conversation.id, "user", request.message)

    # Get recent history for context
    recent_msgs = await conv_repo.get_recent_messages(conversation.id, limit=10)
    history = [
        {"role": m.role, "content": m.content}
        for m in recent_msgs[:-1]  # exclude the message we just added
    ]

    # Run agent
    agent = FocusFlowAgent(db, current_user)
    response_text, sources, tools_summary = await agent.chat(request.message, history)

    # Store assistant response
    sources_json = json.dumps(sources) if sources else None
    msg = await conv_repo.add_message(
        conversation.id,
        "assistant",
        response_text,
        tool_calls_summary=tools_summary,
        sources=sources_json,
    )

    return AgentChatResponse(
        conversation_id=conversation.id,
        message=MessageResponse(
            id=msg.id,
            conversation_id=msg.conversation_id,
            role=msg.role,
            content=msg.content,
            tool_calls_summary=msg.tool_calls_summary,
            sources=msg.sources,
            created_at=msg.created_at,
        ),
    )


# ─── Conversations ────────────────────────────────────────────────────────────

@router.get("/conversations", response_model=List[ConversationResponse])
async def get_conversations(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    repo = ConversationRepository(db)
    convs = await repo.get_all(current_user.id)
    return [
        ConversationResponse(
            id=c.id,
            user_id=c.user_id,
            title=c.title,
            created_at=c.created_at,
            updated_at=c.updated_at,
        )
        for c in convs
    ]


@router.get("/conversations/{conv_id}", response_model=ConversationResponse)
async def get_conversation(
    conv_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    repo = ConversationRepository(db)
    conv = await repo.get_with_messages(conv_id, current_user.id)
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return ConversationResponse(
        id=conv.id,
        user_id=conv.user_id,
        title=conv.title,
        created_at=conv.created_at,
        updated_at=conv.updated_at,
        messages=[
            MessageResponse(
                id=m.id,
                conversation_id=m.conversation_id,
                role=m.role,
                content=m.content,
                tool_calls_summary=m.tool_calls_summary,
                sources=m.sources,
                created_at=m.created_at,
            )
            for m in conv.messages
        ],
    )


# ─── Dashboard ────────────────────────────────────────────────────────────────

@router.get("/dashboard", response_model=DashboardResponse)
async def get_dashboard(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    today_end = now.replace(hour=23, minute=59, second=59, microsecond=999999)

    task_repo = TaskRepository(db)
    goal_repo = GoalRepository(db)
    cal_repo = CalendarRepository(db)

    stats_raw = await task_repo.get_stats(current_user.id)

    # Priority tasks (high priority, not completed)
    from sqlalchemy import select
    from ...models.models import Task, TaskStatus, TaskPriority, Goal, GoalStatus
    priority_tasks = await task_repo.get_all(
        current_user.id,
        status="todo",
        priority="high",
        limit=5
    )

    # Upcoming deadlines
    upcoming = await task_repo.get_all(
        current_user.id,
        filter_type="upcoming",
        limit=5
    )

    # Today's events
    todays_events = await cal_repo.get_events(current_user.id, today_start, today_end)

    # Active goals
    active_goals = await goal_repo.get_all(current_user.id, status="active")

    # Insights
    insights = []
    if stats_raw["overdue"] > 0:
        insights.append(f"You have {stats_raw['overdue']} overdue task{'s' if stats_raw['overdue'] > 1 else ''}.")
    if priority_tasks:
        insights.append(f"Your top priority: \"{priority_tasks[0].title}\"")
    if stats_raw["completed"] > 0:
        total = stats_raw["total"]
        pct = round((stats_raw["completed"] / total) * 100) if total else 0
        insights.append(f"You've completed {stats_raw['completed']} of {total} tasks ({pct}%).")

    def task_to_resp(t):
        from ...schemas.schemas import TaskResponse
        return TaskResponse(
            id=t.id, user_id=t.user_id, goal_id=t.goal_id, title=t.title,
            description=t.description, priority=t.priority, status=t.status,
            due_date=t.due_date, estimated_minutes=t.estimated_minutes,
            category=t.category, created_at=t.created_at, updated_at=t.updated_at,
            completed_at=t.completed_at,
        )

    def event_to_resp(e):
        from ...schemas.schemas import CalendarEventResponse
        return CalendarEventResponse(
            id=e.id, user_id=e.user_id, title=e.title, description=e.description,
            start_time=e.start_time, end_time=e.end_time, color=e.color,
            is_ai_generated=e.is_ai_generated, task_id=e.task_id, created_at=e.created_at,
        )

    def goal_to_resp(g):
        from ...schemas.schemas import GoalResponse, TaskResponse
        return GoalResponse(
            id=g.id, user_id=g.user_id, title=g.title, description=g.description,
            deadline=g.deadline, priority=g.priority, category=g.category,
            status=g.status, progress=g.progress,
            created_at=g.created_at, updated_at=g.updated_at,
            tasks=[task_to_resp(t) for t in g.tasks],
        )

    remaining = stats_raw["total"] - stats_raw["completed"]

    return DashboardResponse(
        stats=DashboardStats(
            total_tasks=stats_raw["total"],
            completed_tasks=stats_raw["completed"],
            remaining_tasks=remaining,
            overdue_tasks=stats_raw["overdue"],
            focus_minutes=stats_raw["focus_minutes"] or 0,
            active_goals=len(active_goals),
        ),
        priority_tasks=[task_to_resp(t) for t in priority_tasks],
        upcoming_deadlines=[task_to_resp(t) for t in upcoming],
        todays_events=[event_to_resp(e) for e in todays_events],
        active_goals=[goal_to_resp(g) for g in active_goals[:4]],
        insights=insights,
    )
