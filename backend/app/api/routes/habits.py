"""
Habit Tracker API routes.
"""
from datetime import date, datetime, timedelta
from typing import Optional, List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, delete
from pydantic import BaseModel, Field

from ...models.database import get_db
from ...models.habits import Habit, HabitLog
from ...services.auth_service import get_current_user
from ...models.models import User

router = APIRouter(prefix="/habits", tags=["habits"])


# ─── Schemas ──────────────────────────────────────────────────────────────────

class HabitCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=500)
    description: Optional[str] = None
    icon: str = "✅"
    color: str = "#6366f1"
    frequency: str = "daily"
    target_days: int = 7

class HabitUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    icon: Optional[str] = None
    color: Optional[str] = None
    frequency: Optional[str] = None
    target_days: Optional[int] = None
    is_active: Optional[bool] = None

class HabitLogCreate(BaseModel):
    date: date
    completed: bool = True
    note: Optional[str] = None

class HabitLogResponse(BaseModel):
    id: UUID
    habit_id: UUID
    date: date
    completed: bool
    note: Optional[str]
    created_at: datetime
    class Config:
        from_attributes = True

class HabitResponse(BaseModel):
    id: UUID
    user_id: UUID
    title: str
    description: Optional[str]
    icon: str
    color: str
    frequency: str
    target_days: int
    is_active: bool
    created_at: datetime
    streak: int = 0
    total_completions: int = 0
    logs: List[HabitLogResponse] = []
    class Config:
        from_attributes = True


# ─── Helpers ──────────────────────────────────────────────────────────────────

def compute_streak(logs: list) -> int:
    """Compute current streak from sorted log dates."""
    if not logs:
        return 0
    completed_dates = sorted(
        {log.date for log in logs if log.completed}, reverse=True
    )
    if not completed_dates:
        return 0

    today = date.today()
    streak = 0
    check = today

    # Allow today or yesterday as starting point
    if completed_dates[0] < today - timedelta(days=1):
        return 0

    for d in completed_dates:
        if d == check or d == check - timedelta(days=1):
            check = d
            streak += 1
        else:
            break
    return streak


# ─── Routes ───────────────────────────────────────────────────────────────────

@router.get("", response_model=List[HabitResponse])
async def get_habits(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Habit).where(
            and_(Habit.user_id == current_user.id, Habit.is_active == True)
        ).order_by(Habit.created_at.desc())
    )
    habits = result.scalars().all()

    # For each habit, fetch logs from the last 90 days
    since = date.today() - timedelta(days=90)
    resp = []
    for habit in habits:
        logs_result = await db.execute(
            select(HabitLog).where(
                and_(
                    HabitLog.habit_id == habit.id,
                    HabitLog.date >= since,
                )
            ).order_by(HabitLog.date.desc())
        )
        logs = logs_result.scalars().all()
        streak = compute_streak(logs)
        total = sum(1 for l in logs if l.completed)

        hr = HabitResponse(
            id=habit.id,
            user_id=habit.user_id,
            title=habit.title,
            description=habit.description,
            icon=habit.icon,
            color=habit.color,
            frequency=habit.frequency,
            target_days=habit.target_days,
            is_active=habit.is_active,
            created_at=habit.created_at,
            streak=streak,
            total_completions=total,
            logs=[HabitLogResponse.model_validate(l) for l in logs],
        )
        resp.append(hr)
    return resp


@router.post("", response_model=HabitResponse)
async def create_habit(
    data: HabitCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    habit = Habit(
        user_id=current_user.id,
        title=data.title,
        description=data.description,
        icon=data.icon,
        color=data.color,
        frequency=data.frequency,
        target_days=data.target_days,
    )
    db.add(habit)
    await db.commit()
    await db.refresh(habit)
    return HabitResponse(
        id=habit.id, user_id=habit.user_id, title=habit.title,
        description=habit.description, icon=habit.icon, color=habit.color,
        frequency=habit.frequency, target_days=habit.target_days,
        is_active=habit.is_active, created_at=habit.created_at,
        streak=0, total_completions=0, logs=[],
    )


@router.patch("/{habit_id}", response_model=HabitResponse)
async def update_habit(
    habit_id: UUID,
    data: HabitUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Habit).where(and_(Habit.id == habit_id, Habit.user_id == current_user.id))
    )
    habit = result.scalar_one_or_none()
    if not habit:
        raise HTTPException(status_code=404, detail="Habit not found")

    for field, value in data.model_dump(exclude_none=True).items():
        setattr(habit, field, value)
    await db.commit()
    await db.refresh(habit)

    return HabitResponse(
        id=habit.id, user_id=habit.user_id, title=habit.title,
        description=habit.description, icon=habit.icon, color=habit.color,
        frequency=habit.frequency, target_days=habit.target_days,
        is_active=habit.is_active, created_at=habit.created_at,
        streak=0, total_completions=0, logs=[],
    )


@router.delete("/{habit_id}")
async def delete_habit(
    habit_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Habit).where(and_(Habit.id == habit_id, Habit.user_id == current_user.id))
    )
    habit = result.scalar_one_or_none()
    if not habit:
        raise HTTPException(status_code=404, detail="Habit not found")
    await db.delete(habit)
    await db.commit()
    return {"success": True}


@router.post("/{habit_id}/log", response_model=HabitLogResponse)
async def log_habit(
    habit_id: UUID,
    data: HabitLogCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Upsert: remove existing log for this date, then create
    await db.execute(
        delete(HabitLog).where(
            and_(HabitLog.habit_id == habit_id, HabitLog.date == data.date)
        )
    )
    log = HabitLog(
        habit_id=habit_id,
        user_id=current_user.id,
        date=data.date,
        completed=data.completed,
        note=data.note,
    )
    db.add(log)
    await db.commit()
    await db.refresh(log)
    return HabitLogResponse.model_validate(log)


@router.get("/heatmap/data")
async def get_heatmap_data(
    days: int = Query(default=365, le=365),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return daily task completion counts for the productivity heatmap."""
    from ...models.models import Task, TaskStatus
    since = date.today() - timedelta(days=days)
    result = await db.execute(
        select(Task).where(
            and_(
                Task.user_id == current_user.id,
                Task.status == TaskStatus.COMPLETED,
                Task.completed_at >= datetime.combine(since, datetime.min.time()),
            )
        )
    )
    tasks = result.scalars().all()

    counts: dict = {}
    for task in tasks:
        if task.completed_at:
            d = task.completed_at.date().isoformat()
            counts[d] = counts.get(d, 0) + 1

    return {"heatmap": counts}
