from datetime import datetime, timezone
from typing import Optional, List
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, func

from ..models.models import CalendarEvent, Document, DocumentChunk, Conversation, Message


class CalendarRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create(self, user_id: UUID, data: dict) -> CalendarEvent:
        event = CalendarEvent(user_id=user_id, **data)
        self.db.add(event)
        await self.db.commit()
        await self.db.refresh(event)
        return event

    async def get_by_id(self, event_id: UUID, user_id: UUID) -> Optional[CalendarEvent]:
        result = await self.db.execute(
            select(CalendarEvent).where(CalendarEvent.id == event_id, CalendarEvent.user_id == user_id)
        )
        return result.scalar_one_or_none()

    async def get_events(
        self,
        user_id: UUID,
        start: Optional[datetime] = None,
        end: Optional[datetime] = None,
    ) -> List[CalendarEvent]:
        query = select(CalendarEvent).where(CalendarEvent.user_id == user_id)
        if start:
            query = query.where(CalendarEvent.end_time >= start)
        if end:
            query = query.where(CalendarEvent.start_time <= end)
        query = query.order_by(CalendarEvent.start_time.asc())
        result = await self.db.execute(query)
        return result.scalars().all()

    async def check_conflicts(
        self,
        user_id: UUID,
        start_time: datetime,
        end_time: datetime,
        exclude_id: Optional[UUID] = None,
    ) -> List[CalendarEvent]:
        query = select(CalendarEvent).where(
            CalendarEvent.user_id == user_id,
            CalendarEvent.start_time < end_time,
            CalendarEvent.end_time > start_time,
        )
        if exclude_id:
            query = query.where(CalendarEvent.id != exclude_id)
        result = await self.db.execute(query)
        return result.scalars().all()

    async def update(self, event_id: UUID, user_id: UUID, data: dict) -> Optional[CalendarEvent]:
        event = await self.get_by_id(event_id, user_id)
        if not event:
            return None
        for key, value in data.items():
            if value is not None:
                setattr(event, key, value)
        await self.db.commit()
        await self.db.refresh(event)
        return event

    async def delete(self, event_id: UUID, user_id: UUID) -> bool:
        event = await self.get_by_id(event_id, user_id)
        if not event:
            return False
        await self.db.delete(event)
        await self.db.commit()
        return True


class DocumentRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create(self, user_id: UUID, data: dict) -> Document:
        doc = Document(user_id=user_id, **data)
        self.db.add(doc)
        await self.db.commit()
        await self.db.refresh(doc)
        return doc

    async def get_all(self, user_id: UUID) -> List[Document]:
        result = await self.db.execute(
            select(Document)
            .where(Document.user_id == user_id)
            .order_by(Document.created_at.desc())
        )
        return result.scalars().all()

    async def get_by_id(self, doc_id: UUID, user_id: UUID) -> Optional[Document]:
        result = await self.db.execute(
            select(Document).where(Document.id == doc_id, Document.user_id == user_id)
        )
        return result.scalar_one_or_none()

    async def update_processing_status(
        self,
        doc_id: UUID,
        is_processed: bool,
        chunk_count: int = 0,
        page_count: Optional[int] = None,
        error: Optional[str] = None,
    ) -> None:
        doc = await self.db.execute(
            select(Document).where(Document.id == doc_id)
        )
        doc = doc.scalar_one_or_none()
        if doc:
            doc.is_processed = is_processed
            doc.chunk_count = chunk_count
            if page_count is not None:
                doc.page_count = page_count
            if error:
                doc.processing_error = error
            await self.db.commit()

    async def add_chunks(self, doc_id: UUID, user_id: UUID, chunks: List[dict]) -> None:
        for chunk in chunks:
            c = DocumentChunk(document_id=doc_id, user_id=user_id, **chunk)
            self.db.add(c)
        await self.db.commit()

    async def delete(self, doc_id: UUID, user_id: UUID) -> bool:
        doc = await self.get_by_id(doc_id, user_id)
        if not doc:
            return False
        await self.db.delete(doc)
        await self.db.commit()
        return True


class ConversationRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_or_create(self, user_id: UUID, conversation_id: Optional[UUID] = None) -> Conversation:
        if conversation_id:
            result = await self.db.execute(
                select(Conversation).where(
                    Conversation.id == conversation_id,
                    Conversation.user_id == user_id
                )
            )
            existing = result.scalar_one_or_none()
            if existing:
                return existing

        conv = Conversation(user_id=user_id)
        self.db.add(conv)
        await self.db.commit()
        await self.db.refresh(conv)
        return conv

    async def get_all(self, user_id: UUID) -> List[Conversation]:
        result = await self.db.execute(
            select(Conversation)
            .where(Conversation.user_id == user_id)
            .order_by(Conversation.updated_at.desc())
            .limit(50)
        )
        return result.scalars().all()

    async def get_with_messages(self, conv_id: UUID, user_id: UUID) -> Optional[Conversation]:
        from sqlalchemy.orm import selectinload
        result = await self.db.execute(
            select(Conversation)
            .options(selectinload(Conversation.messages))
            .where(Conversation.id == conv_id, Conversation.user_id == user_id)
        )
        return result.scalar_one_or_none()

    async def get_recent_messages(self, conv_id: UUID, limit: int = 10) -> List[Message]:
        result = await self.db.execute(
            select(Message)
            .where(Message.conversation_id == conv_id)
            .order_by(Message.created_at.desc())
            .limit(limit)
        )
        msgs = result.scalars().all()
        return list(reversed(msgs))

    async def add_message(self, conv_id: UUID, role: str, content: str,
                          tool_calls_summary: Optional[str] = None,
                          sources: Optional[str] = None) -> Message:
        msg = Message(
            conversation_id=conv_id,
            role=role,
            content=content,
            tool_calls_summary=tool_calls_summary,
            sources=sources
        )
        self.db.add(msg)

        # Update conversation timestamp
        conv = await self.db.execute(
            select(Conversation).where(Conversation.id == conv_id)
        )
        conv = conv.scalar_one_or_none()
        if conv:
            from datetime import datetime, timezone
            conv.updated_at = datetime.now(timezone.utc)
            if not conv.title and role == "user":
                conv.title = content[:60] + ("..." if len(content) > 60 else "")

        await self.db.commit()
        await self.db.refresh(msg)
        return msg
