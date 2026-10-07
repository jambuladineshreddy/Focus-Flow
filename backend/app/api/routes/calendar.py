from datetime import datetime
from typing import Optional, List
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from ...models.database import get_db
from ...models.models import User
from ...schemas.schemas import CalendarEventCreateRequest, CalendarEventUpdateRequest, CalendarEventResponse
from ...services.auth_service import get_current_user
from ...repositories.calendar_doc_repo import CalendarRepository

router = APIRouter(prefix="/calendar", tags=["calendar"])


def _event_to_response(event) -> CalendarEventResponse:
    return CalendarEventResponse(
        id=event.id,
        user_id=event.user_id,
        title=event.title,
        description=event.description,
        start_time=event.start_time,
        end_time=event.end_time,
        color=event.color,
        is_ai_generated=event.is_ai_generated,
        task_id=event.task_id,
        created_at=event.created_at,
    )


@router.get("/events", response_model=List[CalendarEventResponse])
async def get_events(
    start: Optional[datetime] = Query(None),
    end: Optional[datetime] = Query(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    repo = CalendarRepository(db)
    events = await repo.get_events(current_user.id, start, end)
    return [_event_to_response(e) for e in events]


@router.post("/events", response_model=CalendarEventResponse, status_code=201)
async def create_event(
    data: CalendarEventCreateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if data.start_time >= data.end_time:
        raise HTTPException(status_code=400, detail="end_time must be after start_time")

    repo = CalendarRepository(db)
    event = await repo.create(current_user.id, data.model_dump(exclude_none=True))
    return _event_to_response(event)


@router.get("/events/{event_id}", response_model=CalendarEventResponse)
async def get_event(
    event_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    repo = CalendarRepository(db)
    event = await repo.get_by_id(event_id, current_user.id)
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    return _event_to_response(event)


@router.patch("/events/{event_id}", response_model=CalendarEventResponse)
async def update_event(
    event_id: UUID,
    data: CalendarEventUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    repo = CalendarRepository(db)
    event = await repo.update(event_id, current_user.id, data.model_dump(exclude_none=True))
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    return _event_to_response(event)


@router.delete("/events/{event_id}", status_code=204)
async def delete_event(
    event_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    repo = CalendarRepository(db)
    deleted = await repo.delete(event_id, current_user.id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Event not found")
