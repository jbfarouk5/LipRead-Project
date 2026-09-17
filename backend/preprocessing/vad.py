import math
import logging
import os
from functools import lru_cache

from preprocessing.config import (
    PYANNOTE_ONSET,
    PYANNOTE_OFFSET,
    MIN_DURATION_ON,
    MIN_DURATION_OFF,
    GAP_THRESHOLD,
    PADDING_BEFORE,
    PADDING_AFTER,
    MIN_SEGMENT_LENGTH,
)
from preprocessing.utils import ensure_file_exists

log = logging.getLogger(__name__)


# ==============================
# STEP 2 — VAD (pyannote)
# ==============================

@lru_cache(maxsize=1)
def _get_vad_pipeline():
    """
    Load and instantiate the pyannote VAD pipeline exactly once.
    """
    try:
        from pyannote.audio import Pipeline
    except ImportError as e:
        raise RuntimeError("Run: pip install pyannote.audio") from e

    token = os.getenv("HF_TOKEN")
    if not token:
        raise RuntimeError("HF_TOKEN env var is empty.")

    log.info("Loading pyannote VAD pipeline (first call only)…")

    try:
        pipeline = Pipeline.from_pretrained(
            "pyannote/voice-activity-detection",
            use_auth_token=token,
        )
    except Exception as e:
        raise RuntimeError(
            f"Could not load pyannote VAD pipeline. "
            f"HF_TOKEN present={bool(token)}. Original error: {e}"
        ) from e

    pipeline.instantiate({
        "onset": PYANNOTE_ONSET,
        "offset": PYANNOTE_OFFSET,
        "min_duration_on": MIN_DURATION_ON,
        "min_duration_off": MIN_DURATION_OFF,
    })

    log.info("pyannote VAD pipeline ready.")
    return pipeline


def get_speech_segments_pyannote(audio_path: str):
    ensure_file_exists(audio_path, "audio file")

    pipeline = _get_vad_pipeline()
    output = pipeline(audio_path)

    segments = []
    for speech in output.get_timeline().support():
        segments.append((speech.start, speech.end))

    return segments


# ==============================
# STEP 3 — MERGE + PADDING
# ==============================

def process_segments(
    segments: list[tuple[float, float]],
    video_duration: float,
) -> list[tuple[float, float]]:
    if not segments:
        return []

    segments = sorted(segments, key=lambda x: x[0])

    if GAP_THRESHOLD > 0:
        merged = []
        prev_start, prev_end = segments[0]
        for start, end in segments[1:]:
            if (start - prev_end) <= GAP_THRESHOLD:
                prev_end = max(prev_end, end)
            else:
                merged.append((prev_start, prev_end))
                prev_start, prev_end = start, end
        merged.append((prev_start, prev_end))
    else:
        merged = segments

    final = []
    for start, end in merged:
        ps = max(0.0, start - PADDING_BEFORE)
        pe = min(video_duration, end + PADDING_AFTER)
        if pe - ps >= MIN_SEGMENT_LENGTH:
            final.append((ps, pe))

    log.info("Processed to %d segments.", len(final))
    return final


# ==============================
# STEP 4 — SNAP TO FRAME
# ==============================

def snap_to_frames(
    segments: list[tuple[float, float]],
    fps: float,
) -> list[tuple[float, float]]:
    if fps <= 0:
        raise ValueError(f"Invalid FPS: {fps}")

    snapped = []
    for start, end in segments:
        ss = math.floor(start * fps) / fps
        se = math.ceil(end * fps) / fps
        if se > ss:
            snapped.append((ss, se))

    log.debug("Snapped %d segments to frame boundaries at %.4f fps.", len(snapped), fps)
    return snapped