from typing import Optional, List
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from ...models.database import get_db
from ...models.models import User
from ...schemas.schemas import GoalCreateRequest, GoalUpdateRequest, GoalResponse, TaskResponse
from ...services.auth_service import get_current_user
from ...repositories.task_goal_repo import GoalRepository

router = APIRouter(prefix="/goals", tags=["goals"])


def _goal_to_response(goal) -> GoalResponse:
    return GoalResponse(
        id=goal.id,
        user_id=goal.user_id,
        title=goal.title,
        description=goal.description,
        deadline=goal.deadline,
        priority=goal.priority,
        category=goal.category,
        status=goal.status,
        progress=goal.progress,
        created_at=goal.created_at,
        updated_at=goal.updated_at,
        tasks=[
            TaskResponse(
                id=t.id,
                user_id=t.user_id,
                goal_id=t.goal_id,
                title=t.title,
                description=t.description,
                priority=t.priority,
                status=t.status,
                due_date=t.due_date,
                estimated_minutes=t.estimated_minutes,
                category=t.category,
                created_at=t.created_at,
                updated_at=t.updated_at,
                completed_at=t.completed_at,
            )
            for t in goal.tasks
        ],
    )


@router.get("", response_model=List[GoalResponse])
async def get_goals(
    status: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    repo = GoalRepository(db)
    goals = await repo.get_all(current_user.id, status=status)
    return [_goal_to_response(g) for g in goals]


@router.post("", response_model=GoalResponse, status_code=201)
async def create_goal(
    data: GoalCreateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    repo = GoalRepository(db)
    goal = await repo.create(current_user.id, data.model_dump(exclude_none=True))
    goal = await repo.get_by_id(goal.id, current_user.id)
    return _goal_to_response(goal)


@router.get("/{goal_id}", response_model=GoalResponse)
async def get_goal(
    goal_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    repo = GoalRepository(db)
    goal = await repo.get_by_id(goal_id, current_user.id)
    if not goal:
        raise HTTPException(status_code=404, detail="Goal not found")
    return _goal_to_response(goal)


@router.patch("/{goal_id}", response_model=GoalResponse)
async def update_goal(
    goal_id: UUID,
    data: GoalUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    repo = GoalRepository(db)
    goal = await repo.update(goal_id, current_user.id, data.model_dump(exclude_none=True))
    if not goal:
        raise HTTPException(status_code=404, detail="Goal not found")
    goal = await repo.get_by_id(goal_id, current_user.id)
    return _goal_to_response(goal)


@router.delete("/{goal_id}", status_code=204)
async def delete_goal(
    goal_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    repo = GoalRepository(db)
    deleted = await repo.delete(goal_id, current_user.id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Goal not found")
