import json
import os
import sys
from pathlib import Path

from preprocessing.config import setup_logging
from preprocessing.service import process_single_video

print(f"Runner Python: {sys.executable}", file=sys.stderr)
print(f"HF_TOKEN present: {bool(os.getenv('HF_TOKEN'))}", file=sys.stderr)
print(f"HF_HOME: {os.getenv('HF_HOME')}", file=sys.stderr)
print(f"HUGGINGFACE_HUB_CACHE: {os.getenv('HUGGINGFACE_HUB_CACHE')}", file=sys.stderr)


def emit_progress(progress: int, message: str) -> None:
    print(json.dumps({
        "type": "progress",
        "progress": max(0, min(100, int(progress))),
        "message": message,
    }, ensure_ascii=False), flush=True)


def main() -> int:
    if len(sys.argv) < 3:
        print(json.dumps({
            "status": "error",
            "error": "Usage: python -m preprocessing.runner <input_video_path> <output_dir>"
        }, ensure_ascii=False))
        return 1

    input_video_path = sys.argv[1]
    output_dir = sys.argv[2]

    try:
        setup_logging()

        if not os.path.isfile(input_video_path):
            raise FileNotFoundError(f"Input video not found: {input_video_path}")

        # override OUTPUT_DIR used by the segmentation pipeline modules
        import preprocessing.config as config_module

        config_module.set_output_dir(output_dir)

        Path(output_dir).mkdir(parents=True, exist_ok=True)

        print(f"HF_TOKEN present: {bool(os.getenv('HF_TOKEN'))}", file=sys.stderr)

        emit_progress(1, "Starting segmentation...")
        result = process_single_video(input_video_path, progress_callback=emit_progress)

        print(json.dumps(result, ensure_ascii=False))
        return 0

    except Exception as e:
        print(json.dumps({
            "status": "error",
            "error": str(e),
        }, ensure_ascii=False))
        return 1


if __name__ == "__main__":
    raise SystemExit(main())