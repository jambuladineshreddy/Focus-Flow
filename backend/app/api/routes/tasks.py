from typing import Optional, List
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from ...models.database import get_db
from ...models.models import User
from ...schemas.schemas import TaskCreateRequest, TaskUpdateRequest, TaskResponse
from ...services.auth_service import get_current_user
from ...repositories.task_goal_repo import TaskRepository, GoalRepository

router = APIRouter(prefix="/tasks", tags=["tasks"])


def _task_to_response(task) -> TaskResponse:
    return TaskResponse(
        id=task.id,
        user_id=task.user_id,
        goal_id=task.goal_id,
        title=task.title,
        description=task.description,
        priority=task.priority,
        status=task.status,
        due_date=task.due_date,
        estimated_minutes=task.estimated_minutes,
        category=task.category,
        created_at=task.created_at,
        updated_at=task.updated_at,
        completed_at=task.completed_at,
    )


@router.get("", response_model=List[TaskResponse])
async def get_tasks(
    status: Optional[str] = Query(None),
    priority: Optional[str] = Query(None),
    goal_id: Optional[UUID] = Query(None),
    filter_type: Optional[str] = Query(None),
    limit: int = Query(100, le=500),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    repo = TaskRepository(db)
    tasks = await repo.get_all(
        current_user.id,
        status=status,
        priority=priority,
        goal_id=goal_id,
        filter_type=filter_type,
        limit=limit,
    )
    return [_task_to_response(t) for t in tasks]


@router.post("", response_model=TaskResponse, status_code=201)
async def create_task(
    data: TaskCreateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    repo = TaskRepository(db)
    task = await repo.create(current_user.id, data.model_dump(exclude_none=True))
    return _task_to_response(task)


@router.get("/{task_id}", response_model=TaskResponse)
async def get_task(
    task_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    repo = TaskRepository(db)
    task = await repo.get_by_id(task_id, current_user.id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return _task_to_response(task)


@router.patch("/{task_id}", response_model=TaskResponse)
async def update_task(
    task_id: UUID,
    data: TaskUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    repo = TaskRepository(db)
    task = await repo.update(task_id, current_user.id, data.model_dump(exclude_none=True))
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    # Recalculate goal progress if task has a goal
    if task.goal_id:
        goal_repo = GoalRepository(db)
        progress = await goal_repo.recalculate_progress(task.goal_id)
        await goal_repo.update(task.goal_id, current_user.id, {"progress": progress})

    return _task_to_response(task)


@router.delete("/{task_id}", status_code=204)
async def delete_task(
    task_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    repo = TaskRepository(db)
    deleted = await repo.delete(task_id, current_user.id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Task not found")
