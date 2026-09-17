from pathlib import Path
import subprocess
import json
import os


def format_duration(seconds: float) -> str:
    minutes = int(seconds // 60)
    secs = int(seconds % 60)
    return f"{minutes}:{secs:02d}"

FFMPEG_EXE = os.getenv("FFMPEG_PATH", "ffmpeg")
FFPROBE_EXE = str(Path(FFMPEG_EXE).with_name("ffprobe.exe")) if FFMPEG_EXE.endswith(".exe") else "ffprobe"

def extract_video_metadata(file_path: str) -> dict:
    cmd = [
        FFPROBE_EXE,
        "-v", "error",
        "-select_streams", "v:0",
        "-show_entries", "stream=width,height,r_frame_rate,duration:format=duration,format_name",
        "-of", "json",
        file_path,
    ]

    result = subprocess.run(
        cmd,
        capture_output=True,
        text=True,
        check=True
    )

    data = json.loads(result.stdout)

    streams = data.get("streams", [])
    if not streams:
        raise RuntimeError("No video stream found in file")

    stream = streams[0]
    format_info = data.get("format", {})

    width = stream.get("width", 0)
    height = stream.get("height", 0)

    fps_raw = stream.get("r_frame_rate", "0/1")
    num, den = fps_raw.split("/")
    fps = round(float(num) / float(den), 2) if float(den) != 0 else 0

    duration_value = stream.get("duration") or format_info.get("duration") or 0
    duration_seconds = float(duration_value)
    duration = format_duration(duration_seconds)

    size_mb = Path(file_path).stat().st_size / (1024 * 1024)

    format_name = format_info.get("format_name", "")
    if format_name:
        format_name = format_name.split(",")[0].upper()
    else:
        format_name = Path(file_path).suffix.replace(".", "").upper()

    return {
        "size": f"{size_mb:.2f} MB",
        "duration": duration,
        "resolution": f"{width} × {height}",
        "frameRate": f"{fps} fps",
        "format": format_name,
    }