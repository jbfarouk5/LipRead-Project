import os
import logging

import preprocessing.config as _cfg
from preprocessing.config import FFMPEG_PATH, EXPECTED_WORDS
from preprocessing.utils import ensure_file_exists, run_ffmpeg, get_video_info
from preprocessing.vad import process_segments, snap_to_frames

log = logging.getLogger(__name__)


# ==============================
# CENTRALIZED ENCODE SETTINGS
# ==============================

def _ffmpeg_encode_segment(
    video: str,
    start: float,
    end: float,
    output: str,
) -> None:
    """
    Frame-accurate re-encode using FFmpeg directly.

    Two-pass seek strategy for frame accuracy:
      -ss before -i  → fast keyframe seek (coarse)
      -ss after  -i  → slow but frame-accurate seek from that keyframe

    The coarse pre-seek jumps to a keyframe just before the target,
    then the fine seek decodes forward to the exact frame. This gives
    full frame accuracy without decoding the entire file from the start.
    """
    coarse = max(0.0, start - 2.0)
    fine   = start - coarse

    run_ffmpeg(
        [
            FFMPEG_PATH, "-y",
            "-ss", f"{coarse:.6f}",
            "-i", video,
            "-ss", f"{fine:.6f}",
            "-t",  f"{end - start:.6f}",
            "-c:v", "libx264",
            "-preset", "fast",
            "-crf", "18",
            "-pix_fmt", "yuv420p",
            "-c:a", "aac",
            "-b:a", "192k",
            "-movflags", "+faststart",
            output,
        ],
        "Segment encode",
    )


# ==============================
# STEP 5 — CUT INTO WORD FOLDERS
# ==============================

def cut_video_to_word_folders(
    video_path: str,
    segments: list[tuple[float, float]],
    source_name: str,
    already_processed: bool = False,
    progress_callback=None,
) -> list[dict]:
    ensure_file_exists(video_path, "Video for cutting")
    log.info("Cutting video: %s", source_name)

    fps, duration = get_video_info(video_path)

    if already_processed:
        snapped = list(segments)
    else:
        processed = process_segments(segments, duration)
        snapped   = snap_to_frames(processed, fps)

    if not snapped:
        log.warning("No valid speech segments found for: %s", source_name)
        return []

    if len(snapped) > EXPECTED_WORDS:
        log.warning("Trimming %d → %d segments.", len(snapped), EXPECTED_WORDS)
        snapped = snapped[:EXPECTED_WORDS]

    metadata = []
    total_segments = len(snapped)
    for i, (start, end) in enumerate(snapped, start=1):
        log.debug("  word %03d: %.3fs → %.3fs", i, start, end)

        folder   = os.path.join(_cfg.OUTPUT_DIR, f"{i:03d}")
        filename = f"{source_name}_word_{i:03d}.mp4"
        filepath = os.path.join(folder, filename)

        os.makedirs(folder, exist_ok=True)   # self-contained: don't rely on main() having run first
        _ffmpeg_encode_segment(video_path, start, end, filepath)
        ensure_file_exists(filepath, f"Output segment {filename}")

        metadata.append({
            "source_video": source_name,
            "word_index":   i,
            "file":         os.path.join(f"{i:03d}", filename),
            "start_time":   round(start, 3),
            "end_time":     round(end,   3),
            "duration":     round(end - start, 3),
        })
        log.debug("  Saved: %s", filepath)

        if progress_callback is not None and total_segments > 0:
            progress = 85 + int((i / total_segments) * 14)
            progress_callback(progress, f"Exporting clip {i}/{total_segments}...")

    log.info("Wrote %d clips for: %s", len(metadata), source_name)
    return metadata


# ==============================
# SEGMENT EXPORT (used by refinement)
# ==============================

def export_segment(video: str, start: float, end: float, output: str) -> None:
    """Thin wrapper so refinement.py uses the same encode settings."""
    _ffmpeg_encode_segment(video, start, end, output)