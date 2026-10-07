"""
Gmail Notification API Routes.
Handles notification preferences, test emails, daily digests, and task reminders.
"""
from datetime import datetime, date, timedelta
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from pydantic import BaseModel, EmailStr

from ...models.database import get_db
from ...models.models import User, Task, Goal, TaskStatus, GoalStatus
from ...services.auth_service import get_current_user
from ...services.email_service import (
    send_test_email,
    send_daily_digest,
    send_task_reminder,
    send_goal_alert,
)
from ...config import settings

router = APIRouter(prefix="/notifications", tags=["notifications"])


# ─── Schemas ──────────────────────────────────────────────────────────────────

class NotificationSettings(BaseModel):
    email: Optional[str] = None
    daily_digest: bool = False
    task_reminders: bool = False
    goal_alerts: bool = False


class TestEmailRequest(BaseModel):
    email: str


class DigestRequest(BaseModel):
    email: str


class ReminderRequest(BaseModel):
    email: str
    task_id: str


# ─── Config check ─────────────────────────────────────────────────────────────

@router.get("/status")
async def get_notification_status(current_user: User = Depends(get_current_user)):
    """Check if Gmail is configured on the server."""
    configured = bool(settings.GMAIL_USER and settings.GMAIL_APP_PASSWORD)
    return {
        "gmail_configured": configured,
        "gmail_user": settings.GMAIL_USER if configured else None,
    }


# ─── Test email ───────────────────────────────────────────────────────────────

@router.post("/test")
async def send_test(
    body: TestEmailRequest,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
):
    """Send a test email to verify Gmail configuration."""
    if not settings.GMAIL_USER or not settings.GMAIL_APP_PASSWORD:
        raise HTTPException(
            status_code=400,
            detail="Gmail not configured. Add GMAIL_USER and GMAIL_APP_PASSWORD to your .env file."
        )
    background_tasks.add_task(send_test_email, body.email, current_user.full_name)
    return {"message": f"Test email sent to {body.email}"}


# ─── Daily digest ─────────────────────────────────────────────────────────────

@router.post("/daily-digest")
async def send_digest(
    body: DigestRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Send a daily digest email with task and goal summary."""
    now = datetime.utcnow()
    today_start = datetime(now.year, now.month, now.day)
    today_end = today_start + timedelta(days=1)

    # Fetch tasks
    tasks_result = await db.execute(
        select(Task).where(
            and_(Task.user_id == current_user.id, Task.status != TaskStatus.COMPLETED)
        )
    )
    tasks = tasks_result.scalars().all()

    task_list = []
    for t in tasks:
        is_overdue = t.due_date and t.due_date < now
        due_today = t.due_date and today_start <= t.due_date < today_end
        task_list.append({
            "title": t.title,
            "priority": str(t.priority.value if hasattr(t.priority, 'value') else t.priority),
            "status": str(t.status.value if hasattr(t.status, 'value') else t.status),
            "is_overdue": is_overdue,
            "due_today": due_today,
            "due_label": t.due_date.strftime("%b %d") if t.due_date else None,
        })

    # Fetch goals
    goals_result = await db.execute(
        select(Goal).where(
            and_(Goal.user_id == current_user.id, Goal.status == GoalStatus.ACTIVE)
        )
    )
    goals = goals_result.scalars().all()
    goal_list = [
        {"title": g.title, "progress": g.progress, "description": g.description}
        for g in goals
    ]

    background_tasks.add_task(
        send_daily_digest, body.email, current_user.full_name, task_list, goal_list
    )
    return {"message": f"Daily digest sent to {body.email}"}


# ─── Task reminder ────────────────────────────────────────────────────────────

@router.post("/remind-task")
async def remind_task(
    body: ReminderRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Send a reminder email for a specific task."""
    result = await db.execute(
        select(Task).where(
            and_(Task.id == UUID(body.task_id), Task.user_id == current_user.id)
        )
    )
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    now = datetime.utcnow()
    if task.due_date:
        diff = task.due_date - now
        if diff.days < 0:
            due_label = f"{abs(diff.days)} day(s) ago (OVERDUE)"
        elif diff.days == 0:
            due_label = "today"
        else:
            due_label = f"in {diff.days} day(s)"
    else:
        due_label = "no due date"

    task_dict = {
        "title": task.title,
        "description": task.description,
        "priority": str(task.priority.value if hasattr(task.priority, 'value') else task.priority),
        "due_label": due_label,
    }
    background_tasks.add_task(send_task_reminder, body.email, current_user.full_name, task_dict)
    return {"message": f"Reminder sent to {body.email}"}


# ─── Goal alert ───────────────────────────────────────────────────────────────

@router.post("/goal-alert")
async def goal_alert(
    goal_id: str,
    alert_type: str,
    email: str,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Goal).where(
            and_(Goal.id == UUID(goal_id), Goal.user_id == current_user.id)
        )
    )
    goal = result.scalar_one_or_none()
    if not goal:
        raise HTTPException(status_code=404, detail="Goal not found")

    goal_dict = {
        "title": goal.title,
        "description": goal.description,
        "progress": goal.progress,
    }
    background_tasks.add_task(send_goal_alert, email, current_user.full_name, goal_dict, alert_type)
    return {"message": f"Goal alert sent to {email}"}
