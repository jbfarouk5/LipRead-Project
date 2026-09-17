from datetime import datetime, timezone
import traceback
import uuid
import subprocess
import json
from pathlib import Path
import os
print("HF TOKEN:", os.getenv("HF_TOKEN"))

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
from typing import Literal

from uploads import router as upload_router
from mouth_cut_service import run_mouth_cut_for_video
from database import SessionLocal
from models import Video, MouthCutRun

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(upload_router, prefix="/api")
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")


class MouthCutRequest(BaseModel):
    video_id: str = Field(alias="videoId")
    output_resolution: Literal["64x64", "96x96", "128x128", "256x256"] = Field(alias="outputResolution")
    padding_percent_x: float = Field(default=0.15, alias="paddingPercentX")
    padding_percent_y: float = Field(default=0.20, alias="paddingPercentY")
    crop_percentile: float = Field(default=95.0, alias="cropPercentile")
    face_tracking: bool = Field(alias="faceTracking")
    grayscale: bool = Field(default=True, alias="grayscale")
    normalize: bool = Field(default=False, alias="normalize")
    augment: bool = Field(default=False, alias="augment")
    min_valid_frame_ratio: float = Field(default=0.60, alias="minValidFrameRatio")

    model_config = {
        "populate_by_name": True
    }


class PreprocessingRunRequest(BaseModel):
    mouth_cut_run_id: str = Field(alias="mouthCutRunId")

    model_config = {
        "populate_by_name": True
    }


def parse_inference_time_ms(value: str | None) -> int | None:
    if not value:
        return None

    cleaned = value.strip().lower()
    if cleaned.endswith("ms"):
        return int(float(cleaned[:-2]))
    if cleaned.endswith("s"):
        return int(float(cleaned[:-1]) * 1000)

    return int(float(cleaned) * 1000)


@app.post("/api/mouth-cut/run")
def mouth_cut_run(payload: MouthCutRequest):
    db = SessionLocal()

    try:
        try:
            video_uuid = uuid.UUID(payload.video_id)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid video_id format")

        video = db.get(Video, video_uuid)
        if not video:
            raise HTTPException(status_code=404, detail="Video not found")

        input_video_path = video.media_file.storage_path

        run = MouthCutRun(
            video_id=video.id,
            status="running",
            output_resolution=payload.output_resolution,
            padding_percent_x=payload.padding_percent_x,
            padding_percent_y=payload.padding_percent_y,
            crop_percentile=payload.crop_percentile,
            face_tracking=payload.face_tracking,
            grayscale=payload.grayscale,
            normalize=payload.normalize,
            augment=payload.augment,
            min_valid_frame_ratio=payload.min_valid_frame_ratio,
            started_at=datetime.now(timezone.utc),
        )
        db.add(run)

        video.status = "mouth_cut_running"
        db.commit()
        db.refresh(run)

        result = run_mouth_cut_for_video(
            input_video_path=input_video_path,
            output_dir="uploads/mouth_cut_outputs",
            output_basename=str(run.id),
            output_resolution=payload.output_resolution,
            padding_percent_x=payload.padding_percent_x,
            padding_percent_y=payload.padding_percent_y,
            crop_percentile=payload.crop_percentile,
            face_tracking=payload.face_tracking,
            grayscale=payload.grayscale,
            normalize=payload.normalize,
            augment=payload.augment,
            min_valid_frame_ratio=payload.min_valid_frame_ratio,
        )

        roi_coords = result.get("roi_coords") or {}

        run.status = "completed"
        run.roi_video_path = result.get("roi_video_path")
        run.roi_video_url = result.get("roi_video_url")
        run.preview_image_path = result.get("preview_image_path")
        run.preview_image_url = result.get("preview_image_url")
        run.metadata_path = result.get("metadata_path")
        run.metadata_url = result.get("metadata_url")
        run.config_hash = result.get("config_hash")
        run.stats_json = json.dumps(result.get("stats")) if result.get("stats") is not None else None
        run.stable_crop_json = json.dumps(result.get("stable_crop")) if result.get("stable_crop") is not None else None
        run.roi_x = roi_coords.get("x")
        run.roi_y = roi_coords.get("y")
        run.roi_w = roi_coords.get("w")
        run.roi_h = roi_coords.get("h")
        run.output_fps = result.get("fps")
        run.frame_count = result.get("frame_count")
        run.inference_time_ms = result.get("inference_time_ms") or parse_inference_time_ms(result.get("inference_time"))
        run.completed_at = datetime.now(timezone.utc)

        video.status = "mouth_cut_completed"

        db.commit()
        db.refresh(run)

        return {
            "runId": str(run.id),
            "videoId": str(video.id),
            "mediaFileId": str(video.media_file.id),
            **result,
        }

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()

        try:
            if "run" in locals() and run is not None:
                run.status = "failed"
                run.error_message = str(e)
                run.completed_at = datetime.now(timezone.utc)
                db.add(run)

            if "video" in locals() and video is not None:
                video.status = "mouth_cut_failed"
                db.add(video)

            db.commit()
        except Exception:
            db.rollback()

        print("MOUTH CUT ERROR:", repr(e))
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        db.close()


@app.post("/api/preprocessing/run")
def preprocessing_run(payload: PreprocessingRunRequest):
    db = SessionLocal()

    try:
        try:
            mouth_cut_run_uuid = uuid.UUID(payload.mouth_cut_run_id)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid mouthCutRunId format")

        mouth_run = db.get(MouthCutRun, mouth_cut_run_uuid)
        if not mouth_run:
            raise HTTPException(status_code=404, detail="Mouth cut run not found")

        if mouth_run.status != "completed":
            raise HTTPException(status_code=400, detail="Mouth cut run is not completed")

        if not mouth_run.roi_video_path:
            raise HTTPException(status_code=400, detail="Mouth cut run has no ROI video path")

        roi_video_path = Path(mouth_run.roi_video_path)
        if not roi_video_path.is_file():
            raise HTTPException(status_code=404, detail=f"ROI video not found: {roi_video_path}")

        base_dir = Path(__file__).resolve().parent
        segmentation_python = base_dir / "segmentation_venv" / "Scripts" / "python.exe"
        output_dir = base_dir / "uploads" / "segmentation_outputs" / str(mouth_run.id)

        cmd = [
            str(segmentation_python),
            "-m",
            "preprocessing.runner",
            str(roi_video_path),
            str(output_dir),
        ]

        env = os.environ.copy()
        env["HF_TOKEN"] = os.getenv("HF_TOKEN", "")

        result = subprocess.run(
            cmd,
            cwd=str(base_dir),
            capture_output=True,
            text=True,
            env=env,
        )

        if result.returncode != 0:
            raise HTTPException(
                status_code=500,
                detail=f"Segmentation runner failed.\nSTDOUT:\n{result.stdout}\nSTDERR:\n{result.stderr}"
            )

        stdout_lines = [line.strip() for line in result.stdout.splitlines() if line.strip()]
        json_line = None
        for line in reversed(stdout_lines):
            if line.startswith("{") and line.endswith("}"):
                json_line = line
                break

        if not json_line:
            raise HTTPException(
                status_code=500,
                detail=f"Segmentation runner returned no JSON.\nSTDOUT:\n{result.stdout}\nSTDERR:\n{result.stderr}"
            )

        runner_output = json.loads(json_line)

        if runner_output.get("status") != "success":
            raise HTTPException(
                status_code=500,
                detail=runner_output.get("error", "Segmentation failed")
            )

        clips = runner_output.get("clips", [])

        segments = []
        for clip in clips:
            relative_file = clip["file"].replace("\\", "/")
            segment_video_url = f"/uploads/segmentation_outputs/{mouth_run.id}/{relative_file}"

            segments.append({
                "id": f"segment_{clip['word_index']}",
                "label": f"Segment {clip['word_index']}",
                "wordIndex": clip["word_index"],
                "startTime": clip["start_time"],
                "endTime": clip["end_time"],
                "duration": clip["duration"],
                "videoUrl": segment_video_url,
                "sourceVideo": clip["source_video"],
                "relativePath": relative_file,
            })

        return {
            "mouthCutRunId": str(mouth_run.id),
            "segmentsSaved": runner_output.get("segments_saved", 0),
            "segments": segments,
        }

    except HTTPException:
        raise
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        db.close()


@app.get("/")
def root():
    return {"message": "LipRead backend running"}