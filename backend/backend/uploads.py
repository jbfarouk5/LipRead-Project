from fastapi import APIRouter, UploadFile, File, HTTPException
from pathlib import Path
import uuid
import shutil
import hashlib

from database import SessionLocal
from models import Video, MediaFile
from metadata import extract_video_metadata

router = APIRouter()

BASE_DIR = Path(__file__).resolve().parent
UPLOAD_DIR = BASE_DIR / "uploads"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

ALLOWED_EXTENSIONS = {".mp4", ".mov", ".avi", ".mkv"}


def compute_file_sha256(file_obj, chunk_size: int = 1024 * 1024) -> str:
    hasher = hashlib.sha256()
    file_obj.seek(0)
    while chunk := file_obj.read(chunk_size):
        hasher.update(chunk)
    file_obj.seek(0)
    return hasher.hexdigest()


@router.post("/uploads/video")
async def upload_video(file: UploadFile = File(...)):
    db = SessionLocal()

    try:
        if not file.filename:
            raise HTTPException(status_code=400, detail="Missing filename")

        ext = Path(file.filename).suffix.lower()
        if ext not in ALLOWED_EXTENSIONS:
            raise HTTPException(status_code=400, detail=f"Unsupported file type: {ext}")

        sha256 = compute_file_sha256(file.file)

        existing_media = db.query(MediaFile).filter(MediaFile.sha256 == sha256).first()

        if existing_media:
            existing_path = Path(existing_media.storage_path)

            if existing_path.is_file():
                media_file = existing_media
                file_path = existing_path
                stored_name = media_file.stored_filename
                deduplicated = True
            else:
                stored_name = f"{uuid.uuid4()}{ext}"
                file_path = UPLOAD_DIR / stored_name

                with open(file_path, "wb") as buffer:
                    shutil.copyfileobj(file.file, buffer)

                if not file_path.is_file():
                    raise RuntimeError(f"Uploaded file was not saved: {file_path}")

                size_bytes = file_path.stat().st_size

                # repair stale DB row instead of inserting a duplicate sha256 row
                existing_media.storage_path = str(file_path)
                existing_media.stored_filename = stored_name
                existing_media.original_filename = file.filename
                existing_media.size_bytes = size_bytes

                db.commit()
                db.refresh(existing_media)

                media_file = existing_media
                deduplicated = False
        else:
            stored_name = f"{uuid.uuid4()}{ext}"
            file_path = UPLOAD_DIR / stored_name

            with open(file_path, "wb") as buffer:
                shutil.copyfileobj(file.file, buffer)

            if not file_path.is_file():
                raise RuntimeError(f"Uploaded file was not saved: {file_path}")

            size_bytes = file_path.stat().st_size

            media_file = MediaFile(
                sha256=sha256,
                storage_path=str(file_path),
                stored_filename=stored_name,
                original_filename=file.filename,
                size_bytes=size_bytes,
            )
            db.add(media_file)
            db.commit()
            db.refresh(media_file)
            deduplicated = False

        metadata = extract_video_metadata(str(file_path))

        video = Video(
            media_file_id=media_file.id,
            status="uploaded",
        )
        db.add(video)
        db.commit()
        db.refresh(video)

        return {
            "videoId": str(video.id),
            "mediaFileId": str(media_file.id),
            "deduplicated": deduplicated,
            "fileName": file.filename,
            "storedFileName": stored_name,
            "filePath": str(file_path),
            "format": metadata["format"],
            "size": metadata["size"],
            "duration": metadata["duration"],
            "resolution": metadata["resolution"],
            "frameRate": metadata["frameRate"],
        }

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        print("UPLOAD ERROR:", repr(e))
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        db.close()