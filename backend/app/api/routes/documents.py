import asyncio
import logging
from typing import List
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession

from ...models.database import get_db
from ...models.models import User
from ...schemas.schemas import DocumentResponse
from ...services.auth_service import get_current_user
from ...services.document_service import save_upload, extract_text_from_file, chunk_text, delete_file
from ...rag.vector_store import add_chunks_to_vector_store, delete_document_chunks
from ...repositories.calendar_doc_repo import DocumentRepository

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/documents", tags=["documents"])

ALLOWED_TYPES = {"pdf", "txt", "md", "docx"}


async def _process_document(doc_id: UUID, user_id: UUID, filename: str, file_type: str):
    """Background task to extract text, chunk, and index a document."""
    from ...models.database import AsyncSessionLocal
    async with AsyncSessionLocal() as db:
        repo = DocumentRepository(db)
        try:
            # Extract text
            text, page_count = extract_text_from_file(filename, file_type)
            if not text.strip():
                await repo.update_processing_status(
                    doc_id, False, error="Could not extract text from document"
                )
                return

            # Chunk text
            chunks = chunk_text(text)
            if not chunks:
                await repo.update_processing_status(
                    doc_id, False, error="Document produced no text chunks"
                )
                return

            # Add to ChromaDB
            doc_result = await repo.get_by_id(doc_id, user_id)
            chroma_ids = add_chunks_to_vector_store(
                str(user_id),
                str(doc_id),
                doc_result.original_name if doc_result else str(doc_id),
                chunks,
            )

            # Store chunk references in DB
            chunk_records = [
                {
                    "content": chunk,
                    "chunk_index": i,
                    "chroma_id": chroma_ids[i] if i < len(chroma_ids) else None,
                }
                for i, chunk in enumerate(chunks)
            ]
            await repo.add_chunks(doc_id, user_id, chunk_records)
            await repo.update_processing_status(
                doc_id, True, chunk_count=len(chunks), page_count=page_count
            )
            logger.info(f"Document {doc_id} processed: {len(chunks)} chunks")

        except Exception as e:
            logger.error(f"Document processing failed: {e}")
            await repo.update_processing_status(
                doc_id, False, error=str(e)[:500]
            )


def _doc_to_response(doc) -> DocumentResponse:
    return DocumentResponse(
        id=doc.id,
        user_id=doc.user_id,
        filename=doc.filename,
        original_name=doc.original_name,
        file_type=doc.file_type,
        file_size=doc.file_size,
        page_count=doc.page_count,
        chunk_count=doc.chunk_count,
        is_processed=doc.is_processed,
        processing_error=doc.processing_error,
        created_at=doc.created_at,
    )


@router.get("", response_model=List[DocumentResponse])
async def get_documents(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    repo = DocumentRepository(db)
    docs = await repo.get_all(current_user.id)
    return [_doc_to_response(d) for d in docs]


@router.post("/upload", response_model=DocumentResponse, status_code=201)
async def upload_document(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Validate file type
    import os
    ext = os.path.splitext(file.filename)[1].lower().lstrip(".")
    if ext not in ALLOWED_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type. Allowed: {', '.join(ALLOWED_TYPES)}"
        )

    try:
        stored_name, file_size, file_type = await save_upload(file, current_user.id)
    except ValueError as e:
        raise HTTPException(status_code=413, detail=str(e))

    repo = DocumentRepository(db)
    doc = await repo.create(
        current_user.id,
        {
            "filename": stored_name,
            "original_name": file.filename,
            "file_type": file_type,
            "file_size": file_size,
            "is_processed": False,
        }
    )

    # Process in background
    background_tasks.add_task(
        _process_document, doc.id, current_user.id, stored_name, file_type
    )

    return _doc_to_response(doc)


@router.delete("/{doc_id}", status_code=204)
async def delete_document(
    doc_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    repo = DocumentRepository(db)
    doc = await repo.get_by_id(doc_id, current_user.id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    # Delete from vector store and file system
    delete_document_chunks(str(current_user.id), str(doc_id))
    delete_file(doc.filename)

    deleted = await repo.delete(doc_id, current_user.id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Document not found")
