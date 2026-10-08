"""
Gmail Notification API Routes.
Supports per-user notification preferences, custom user SMTP credentials,
real-time connection verification, test emails, daily digests, and task reminders.
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
    verify_smtp_credentials,
    get_smtp_sender,
    send_test_email,
    send_daily_digest,
    send_task_reminder,
    send_goal_alert,
)
from ...config import settings

router = APIRouter(prefix="/notifications", tags=["notifications"])


# ─── Schemas ──────────────────────────────────────────────────────────────────

class UpdateNotificationSettingsRequest(BaseModel):
    notification_email: Optional[str] = None
    smtp_email: Optional[str] = None
    smtp_password: Optional[str] = None
    daily_digest_enabled: Optional[bool] = None
    task_reminders_enabled: Optional[bool] = None
    goal_alerts_enabled: Optional[bool] = None


class VerifySmtpRequest(BaseModel):
    smtp_email: Optional[str] = None
    smtp_password: Optional[str] = None


class TestEmailRequest(BaseModel):
    email: Optional[str] = None


class DigestRequest(BaseModel):
    email: Optional[str] = None


class ReminderRequest(BaseModel):
    task_id: str
    email: Optional[str] = None


# ─── Status & Settings ────────────────────────────────────────────────────────

@router.get("/status")
async def get_notification_status(current_user: User = Depends(get_current_user)):
    """Check notification and Gmail configuration status for current user."""
    sender_email, _, mode = get_smtp_sender(current_user)
    is_ready = bool(sender_email)

    return {
        "gmail_configured": is_ready,
        "gmail_user": sender_email if is_ready else None,
        "sender_mode": mode,  # "user", "system", or "none"
        "notification_email": current_user.notification_email or current_user.email,
        "account_email": current_user.email,
    }


@router.get("/settings")
async def get_settings(current_user: User = Depends(get_current_user)):
    """Get full notification settings for current user."""
    sender_email, _, mode = get_smtp_sender(current_user)
    is_ready = bool(sender_email)
    system_configured = bool(settings.GMAIL_USER and settings.GMAIL_APP_PASSWORD)

    return {
        "account_email": current_user.email,
        "notification_email": current_user.notification_email or current_user.email,
        "smtp_email": current_user.smtp_email or "",
        "has_smtp_password": bool(current_user.smtp_password),
        "sender_mode": mode,
        "is_ready_to_send": is_ready,
        "system_configured": system_configured,
        "system_email": settings.GMAIL_USER if system_configured else None,
        "daily_digest_enabled": current_user.daily_digest_enabled if current_user.daily_digest_enabled is not None else True,
        "task_reminders_enabled": current_user.task_reminders_enabled if current_user.task_reminders_enabled is not None else True,
        "goal_alerts_enabled": current_user.goal_alerts_enabled if current_user.goal_alerts_enabled is not None else True,
    }


@router.put("/settings")
async def update_settings(
    body: UpdateNotificationSettingsRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update notification preferences and SMTP credentials for the logged-in user."""
    if body.notification_email is not None:
        current_user.notification_email = body.notification_email.strip() or None

    if body.smtp_email is not None:
        current_user.smtp_email = body.smtp_email.strip() or None

    if body.smtp_password is not None and body.smtp_password.strip():
        # Store clean App Password
        current_user.smtp_password = body.smtp_password.strip().replace(" ", "")

    if body.daily_digest_enabled is not None:
        current_user.daily_digest_enabled = body.daily_digest_enabled

    if body.task_reminders_enabled is not None:
        current_user.task_reminders_enabled = body.task_reminders_enabled

    if body.goal_alerts_enabled is not None:
        current_user.goal_alerts_enabled = body.goal_alerts_enabled

    await db.commit()
    await db.refresh(current_user)

    sender_email, _, mode = get_smtp_sender(current_user)
    return {
        "message": "Notification settings updated successfully",
        "notification_email": current_user.notification_email or current_user.email,
        "smtp_email": current_user.smtp_email,
        "has_smtp_password": bool(current_user.smtp_password),
        "sender_mode": mode,
        "is_ready_to_send": bool(sender_email),
    }


@router.post("/verify-smtp")
async def verify_smtp(
    body: VerifySmtpRequest,
    current_user: User = Depends(get_current_user),
):
    """
    Test Gmail SMTP credentials in real-time.
    Can verify either credentials passed in the body, or user's currently saved credentials.
    """
    test_user = (body.smtp_email or current_user.smtp_email or "").strip()
    test_pw = (body.smtp_password or current_user.smtp_password or "").strip()

    if not test_user or not test_pw:
        raise HTTPException(
            status_code=400,
            detail="Please provide both a Gmail address and an App Password to test connection."
        )

    success, message = verify_smtp_credentials(test_user, test_pw)
    if not success:
        raise HTTPException(status_code=400, detail=message)

    return {"success": True, "message": message}


# ─── Test email ───────────────────────────────────────────────────────────────

@router.post("/test")
async def send_test(
    body: TestEmailRequest,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
):
    """Send a test email to verify Gmail configuration."""
    sender_email, _, _ = get_smtp_sender(current_user)
    if not sender_email:
        raise HTTPException(
            status_code=400,
            detail="Gmail sender not configured. Please add your Gmail address and App Password in Notification Settings."
        )

    recipient = (body.email or current_user.notification_email or current_user.email).strip()
    background_tasks.add_task(send_test_email, recipient, current_user.full_name, current_user)
    return {"message": f"Test email queued for {recipient}"}


# ─── Daily digest ─────────────────────────────────────────────────────────────

@router.post("/daily-digest")
async def send_digest(
    body: DigestRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Send a daily digest email with task and goal summary."""
    sender_email, _, _ = get_smtp_sender(current_user)
    if not sender_email:
        raise HTTPException(
            status_code=400,
            detail="Gmail sender not configured. Please configure your Gmail in Notification Settings."
        )

    recipient = (body.email or current_user.notification_email or current_user.email).strip()

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
        send_daily_digest, recipient, current_user.full_name, task_list, goal_list, current_user
    )
    return {"message": f"Daily digest queued for {recipient}"}


# ─── Task reminder ────────────────────────────────────────────────────────────

@router.post("/remind-task")
async def remind_task(
    body: ReminderRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Send a reminder email for a specific task."""
    sender_email, _, _ = get_smtp_sender(current_user)
    if not sender_email:
        raise HTTPException(
            status_code=400,
            detail="Gmail sender not configured. Please configure your Gmail in Notification Settings."
        )

    result = await db.execute(
        select(Task).where(
            and_(Task.id == UUID(body.task_id), Task.user_id == current_user.id)
        )
    )
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    recipient = (body.email or current_user.notification_email or current_user.email).strip()

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
    background_tasks.add_task(send_task_reminder, recipient, current_user.full_name, task_dict, current_user)
    return {"message": f"Reminder queued for {recipient}"}


# ─── Goal alert ───────────────────────────────────────────────────────────────

@router.post("/goal-alert")
async def goal_alert(
    goal_id: str,
    alert_type: str,
    email: Optional[str] = None,
    background_tasks: BackgroundTasks = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    sender_email, _, _ = get_smtp_sender(current_user)
    if not sender_email:
        raise HTTPException(
            status_code=400,
            detail="Gmail sender not configured. Please configure your Gmail in Notification Settings."
        )

    result = await db.execute(
        select(Goal).where(
            and_(Goal.id == UUID(goal_id), Goal.user_id == current_user.id)
        )
    )
    goal = result.scalar_one_or_none()
    if not goal:
        raise HTTPException(status_code=404, detail="Goal not found")

    recipient = (email or current_user.notification_email or current_user.email).strip()

    goal_dict = {
        "title": goal.title,
        "description": goal.description,
        "progress": goal.progress,
    }
    if background_tasks:
        background_tasks.add_task(send_goal_alert, recipient, current_user.full_name, goal_dict, alert_type, current_user)
    else:
        send_goal_alert(recipient, current_user.full_name, goal_dict, alert_type, current_user)

    return {"message": f"Goal alert queued for {recipient}"}
