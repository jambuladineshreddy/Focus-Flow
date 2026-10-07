from datetime import datetime, timezone, timedelta
from typing import Optional, List
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_, func, update as sql_update
from sqlalchemy.orm import selectinload

from ..models.models import Task, Goal, TaskStatus, TaskPriority, GoalStatus


class TaskRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create(self, user_id: UUID, data: dict) -> Task:
        task = Task(user_id=user_id, **data)
        self.db.add(task)
        await self.db.commit()
        await self.db.refresh(task)
        return task

    async def get_by_id(self, task_id: UUID, user_id: UUID) -> Optional[Task]:
        result = await self.db.execute(
            select(Task).where(Task.id == task_id, Task.user_id == user_id)
        )
        return result.scalar_one_or_none()

    async def get_all(
        self,
        user_id: UUID,
        status: Optional[str] = None,
        priority: Optional[str] = None,
        goal_id: Optional[UUID] = None,
        filter_type: Optional[str] = None,  # today, tomorrow, upcoming, overdue
        limit: int = 100
    ) -> List[Task]:
        now = datetime.now(timezone.utc)
        today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        today_end = now.replace(hour=23, minute=59, second=59, microsecond=999999)
        tomorrow_start = (today_start + timedelta(days=1))

        query = select(Task).where(Task.user_id == user_id)

        if status:
            query = query.where(Task.status == status)
        if priority:
            query = query.where(Task.priority == priority)
        if goal_id:
            query = query.where(Task.goal_id == goal_id)

        if filter_type == "today":
            query = query.where(
                Task.due_date.between(today_start, today_end)
            )
        elif filter_type == "overdue":
            query = query.where(
                and_(Task.due_date < now, Task.status != TaskStatus.COMPLETED)
            )
        elif filter_type == "upcoming":
            query = query.where(Task.due_date > now)

        query = query.order_by(Task.due_date.asc().nullslast(), Task.priority.desc()).limit(limit)
        result = await self.db.execute(query)
        return result.scalars().all()

    async def update(self, task_id: UUID, user_id: UUID, data: dict) -> Optional[Task]:
        task = await self.get_by_id(task_id, user_id)
        if not task:
            return None
        
        if data.get("status") == TaskStatus.COMPLETED and task.status != TaskStatus.COMPLETED:
            data["completed_at"] = datetime.now(timezone.utc)
        
        for key, value in data.items():
            if value is not None:
                setattr(task, key, value)
        
        await self.db.commit()
        await self.db.refresh(task)
        return task

    async def delete(self, task_id: UUID, user_id: UUID) -> bool:
        task = await self.get_by_id(task_id, user_id)
        if not task:
            return False
        await self.db.delete(task)
        await self.db.commit()
        return True

    async def get_stats(self, user_id: UUID) -> dict:
        now = datetime.now(timezone.utc)
        today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        today_end = now.replace(hour=23, minute=59, second=59, microsecond=999999)

        total = await self.db.execute(
            select(func.count(Task.id)).where(Task.user_id == user_id)
        )
        completed = await self.db.execute(
            select(func.count(Task.id)).where(
                Task.user_id == user_id, Task.status == TaskStatus.COMPLETED
            )
        )
        overdue = await self.db.execute(
            select(func.count(Task.id)).where(
                Task.user_id == user_id,
                Task.due_date < now,
                Task.status != TaskStatus.COMPLETED
            )
        )
        focus = await self.db.execute(
            select(func.sum(Task.estimated_minutes)).where(
                Task.user_id == user_id,
                Task.due_date.between(today_start, today_end),
                Task.status != TaskStatus.COMPLETED
            )
        )

        return {
            "total": total.scalar() or 0,
            "completed": completed.scalar() or 0,
            "overdue": overdue.scalar() or 0,
            "focus_minutes": focus.scalar() or 0,
        }


class GoalRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create(self, user_id: UUID, data: dict) -> Goal:
        goal = Goal(user_id=user_id, **data)
        self.db.add(goal)
        await self.db.commit()
        await self.db.refresh(goal)
        return goal

    async def get_by_id(self, goal_id: UUID, user_id: UUID) -> Optional[Goal]:
        result = await self.db.execute(
            select(Goal)
            .options(selectinload(Goal.tasks))
            .where(Goal.id == goal_id, Goal.user_id == user_id)
        )
        return result.scalar_one_or_none()

    async def get_all(self, user_id: UUID, status: Optional[str] = None) -> List[Goal]:
        query = (
            select(Goal)
            .options(selectinload(Goal.tasks))
            .where(Goal.user_id == user_id)
        )
        if status:
            query = query.where(Goal.status == status)
        query = query.order_by(Goal.deadline.asc().nullslast())
        result = await self.db.execute(query)
        return result.scalars().all()

    async def update(self, goal_id: UUID, user_id: UUID, data: dict) -> Optional[Goal]:
        goal = await self.get_by_id(goal_id, user_id)
        if not goal:
            return None
        for key, value in data.items():
            if value is not None:
                setattr(goal, key, value)
        await self.db.commit()
        await self.db.refresh(goal)
        return goal

    async def recalculate_progress(self, goal_id: UUID) -> float:
        result = await self.db.execute(
            select(func.count(Task.id)).where(Task.goal_id == goal_id)
        )
        total = result.scalar() or 0
        if total == 0:
            return 0.0

        completed_result = await self.db.execute(
            select(func.count(Task.id)).where(
                Task.goal_id == goal_id,
                Task.status == TaskStatus.COMPLETED
            )
        )
        completed = completed_result.scalar() or 0
        return round((completed / total) * 100, 1)

    async def delete(self, goal_id: UUID, user_id: UUID) -> bool:
        goal = await self.get_by_id(goal_id, user_id)
        if not goal:
            return False
        await self.db.delete(goal)
        await self.db.commit()
        return True
