import os
import json
import logging
import subprocess
import tempfile
from fractions import Fraction
from pathlib import Path

import preprocessing.config as _cfg
from preprocessing.config import (
    FFMPEG_PATH,
    INPUT_FOLDER,
    VIDEO_EXTENSIONS,
    EXPECTED_WORDS,
)

log = logging.getLogger(__name__)


# ==============================
# GUARDS
# ==============================

def ensure_file_exists(path: str, label: str) -> None:
    if not os.path.isfile(path):
        raise FileNotFoundError(f"{label} not found: {path}")


def ensure_dir_exists(path: str, label: str) -> None:
    if not os.path.isdir(path):
        raise FileNotFoundError(f"{label} not found: {path}")


# ==============================
# FFMPEG / FFPROBE
# ==============================

def run_ffmpeg(command: list[str], step_name: str = "FFmpeg") -> None:
    """
    Run an FFmpeg command with live console output.

    - stdout  : inherited — streams directly to the terminal, never buffered
    - stderr  : written to a temp file so it is never held in RAM during the
                run; read once only on failure, then deleted immediately
    - On success : temp file is deleted right away
    - On failure : temp file is read once for the error message, then deleted
    """
    log.debug("Running %s: %s", step_name, " ".join(command))
    stderr_fd, stderr_path = tempfile.mkstemp(suffix=".txt")
    try:
        with os.fdopen(stderr_fd, "w", encoding="utf-8") as stderr_file:
            subprocess.run(
                command,
                stdout=None,          # inherited → live terminal output
                stderr=stderr_file,   # written to temp file, not RAM
                check=True,
            )
    except FileNotFoundError:
        raise RuntimeError(
            f"FFmpeg executable not found at: {FFMPEG_PATH}\n"
            "Check the ffmpeg.executable path in config.json."
        )
    except subprocess.CalledProcessError:
        try:
            with open(stderr_path, "r", encoding="utf-8") as f:
                stderr_text = f.read()
        except Exception:
            stderr_text = "(could not read stderr)"
        raise RuntimeError(
            f"{step_name} failed.\nCommand: {' '.join(command)}\n\nSTDERR:\n{stderr_text}"
        )
    finally:
        if os.path.exists(stderr_path):
            os.remove(stderr_path)


# ffprobe lives next to ffmpeg in the same bin folder
FFPROBE_PATH = str(Path(FFMPEG_PATH).parent / "ffprobe.exe") \
    if FFMPEG_PATH.endswith(".exe") \
    else str(Path(FFMPEG_PATH).parent / "ffprobe")


def probe_video(path: str) -> dict:
    """Return ffprobe JSON for the first video+audio streams."""
    ensure_file_exists(path, "Video for probing")
    try:
        result = subprocess.run(
            [
                FFPROBE_PATH, "-v", "quiet",
                "-print_format", "json",
                "-show_streams", "-show_format",
                path,
            ],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            check=True,
        )
    except FileNotFoundError:
        raise RuntimeError(
            f"ffprobe not found at: {FFPROBE_PATH}\n"
            "Check the ffmpeg.executable path in config.json."
        )
    except subprocess.CalledProcessError as e:
        raise RuntimeError(
            f"ffprobe failed on: {path}\n"
            f"Return code: {e.returncode}\n"
            f"STDERR: {e.stderr.strip()}"
        ) from e

    try:
        return json.loads(result.stdout)
    except json.JSONDecodeError as e:
        raise RuntimeError(
            f"ffprobe returned invalid JSON for: {path}\n"
            f"Raw output: {result.stdout[:200]!r}"
        ) from e


def get_video_info(path: str) -> tuple[float, float]:
    """Return (fps, duration) for a video file via ffprobe."""
    data = probe_video(path)

    duration = float(data.get("format", {}).get("duration", 0))
    if not duration:
        for s in data.get("streams", []):
            if s.get("codec_type") == "video" and s.get("duration"):
                duration = float(s["duration"])
                break

    fps = 0.0
    for s in data.get("streams", []):
        if s.get("codec_type") == "video":
            # Prefer avg_frame_rate (actual playback rate) over r_frame_rate
            # (timebase rate), which can be misleading for VFR content.
            for field in ("avg_frame_rate", "r_frame_rate"):
                raw = s.get(field, "0/1")
                try:
                    frac = Fraction(raw)
                    if frac > 0:
                        fps = float(frac)
                        break
                except (ValueError, ZeroDivisionError):
                    continue
            break

    if not fps:
        raise RuntimeError(f"Could not determine FPS for: {path}")
    if not duration:
        raise RuntimeError(f"Could not determine duration for: {path}")

    log.debug("Video info — fps=%.4f  duration=%.3fs  path=%s", fps, duration, path)
    return fps, duration


def get_duration(path: str) -> float:
    """Return duration in seconds via ffprobe."""
    _, duration = get_video_info(path)
    return duration


# ==============================
# VIDEO / AUDIO HELPERS
# ==============================

def list_videos(folder: str) -> list[str]:
    ensure_dir_exists(folder, "Input folder")
    files = [
        os.path.join(folder, name)
        for name in sorted(os.listdir(folder))
        if os.path.isfile(os.path.join(folder, name))
        and Path(name).suffix.lower() in VIDEO_EXTENSIONS
    ]
    if not files:
        raise RuntimeError(f"No video files found in: {folder}")
    return files


def safe_stem(path: str) -> str:
    return Path(path).stem


def extract_audio(video_path: str, output_wav: str) -> None:
    ensure_file_exists(video_path, "Video for audio extraction")
    log.info("Extracting audio…")
    run_ffmpeg(
        [
            FFMPEG_PATH, "-y", "-i", video_path,
            "-ac", "1", "-ar", "16000", "-vn", "-f", "wav", output_wav,
        ],
        "Audio extraction",
    )
    ensure_file_exists(output_wav, "Extracted WAV")
    if os.path.getsize(output_wav) == 0:
        raise RuntimeError(f"Extracted WAV is empty: {output_wav}")
    log.info("Audio extracted → %s", output_wav)


# ==============================
# DIRECTORY STRUCTURE
# ==============================

def create_output_structure() -> None:
    os.makedirs(_cfg.OUTPUT_DIR, exist_ok=True)
    for i in range(1, EXPECTED_WORDS + 1):
        os.makedirs(os.path.join(_cfg.OUTPUT_DIR, f"{i:03d}"), exist_ok=True)
    log.debug("Output structure created under: %s", _cfg.OUTPUT_DIR)


# ==============================
# STEP 0 — ENSURE MP4
# ==============================

def ensure_mp4(input_path: str, temp_dir: str) -> tuple[str, bool]:
    ensure_file_exists(input_path, "Input video")
    ext = os.path.splitext(input_path)[1].lower()
    if ext == ".mp4":
        log.info("Video already MP4. Skipping conversion.")
        return input_path, False

    log.info("Converting to MP4…")
    base   = safe_stem(input_path)
    output = os.path.join(temp_dir, f"{base}_converted.mp4")
    run_ffmpeg(
        [
            FFMPEG_PATH, "-y", "-i", input_path,
            "-c:v", "libx264", "-preset", "medium", "-crf", "18",
            "-pix_fmt", "yuv420p", "-vsync", "cfr",
            "-c:a", "aac", "-b:a", "192k", output,
        ],
        "Video conversion",
    )
    ensure_file_exists(output, "Converted MP4")
    log.info("Conversion complete → %s", output)
    return output, True