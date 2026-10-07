import os
import uuid
import logging
from pathlib import Path
from typing import List, Tuple, Optional

import aiofiles
from fastapi import UploadFile

from ..config import settings

logger = logging.getLogger(__name__)


async def save_upload(file: UploadFile, user_id: uuid.UUID) -> Tuple[str, int, str]:
    """Save uploaded file and return (stored_filename, file_size, file_type)."""
    ext = Path(file.filename).suffix.lower()
    stored_name = f"{user_id}_{uuid.uuid4()}{ext}"
    file_path = Path(settings.UPLOAD_DIR) / stored_name

    content = await file.read()
    file_size = len(content)

    if file_size > settings.MAX_FILE_SIZE_MB * 1024 * 1024:
        raise ValueError(f"File exceeds {settings.MAX_FILE_SIZE_MB}MB limit")

    async with aiofiles.open(file_path, "wb") as f:
        await f.write(content)

    file_type = ext.lstrip(".")
    return stored_name, file_size, file_type


def delete_file(filename: str) -> None:
    file_path = Path(settings.UPLOAD_DIR) / filename
    if file_path.exists():
        file_path.unlink()


def extract_text_from_file(filename: str, file_type: str) -> Tuple[str, Optional[int]]:
    """Extract text from a document. Returns (text, page_count)."""
    file_path = Path(settings.UPLOAD_DIR) / filename
    
    if not file_path.exists():
        raise FileNotFoundError(f"File not found: {filename}")

    if file_type == "pdf":
        return _extract_from_pdf(file_path)
    elif file_type in ("txt", "md"):
        return _extract_from_text(file_path)
    elif file_type == "docx":
        return _extract_from_docx(file_path)
    else:
        raise ValueError(f"Unsupported file type: {file_type}")


def _extract_from_pdf(file_path: Path) -> Tuple[str, int]:
    try:
        from pypdf import PdfReader
        reader = PdfReader(str(file_path))
        texts = []
        for page in reader.pages:
            t = page.extract_text()
            if t:
                texts.append(t.strip())
        return "\n\n".join(texts), len(reader.pages)
    except Exception as e:
        logger.error(f"PDF extraction error: {e}")
        raise


def _extract_from_text(file_path: Path) -> Tuple[str, None]:
    with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
        return f.read(), None


def _extract_from_docx(file_path: Path) -> Tuple[str, None]:
    try:
        from docx import Document
        doc = Document(str(file_path))
        texts = [p.text for p in doc.paragraphs if p.text.strip()]
        return "\n\n".join(texts), None
    except Exception as e:
        logger.error(f"DOCX extraction error: {e}")
        raise


def chunk_text(text: str, chunk_size: int = 800, overlap: int = 150) -> List[str]:
    """Split text into overlapping chunks."""
    words = text.split()
    chunks = []
    i = 0
    while i < len(words):
        chunk = " ".join(words[i : i + chunk_size])
        if chunk.strip():
            chunks.append(chunk.strip())
        i += chunk_size - overlap
        if i < 0:
            break
    return chunks
