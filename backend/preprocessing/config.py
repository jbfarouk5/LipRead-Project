import os
import json
import logging
from pathlib import Path

# ==============================
# CONFIG LOADING
# ==============================

def load_config(config_path: str | None = None) -> dict:
    if config_path is None:
        config_path = Path(__file__).parent / "config.json"

    if not Path(config_path).is_file():
        raise FileNotFoundError(
            f"Config file not found: {config_path}"
        )

    with open(config_path, "r", encoding="utf-8") as f:
        return json.load(f)


CFG = load_config()

# ── Paths ──────────────────────────────────────────────────────────────
INPUT_FOLDER = CFG["paths"]["input_folder"]
OUTPUT_DIR   = CFG["paths"]["output_dir"]

def set_output_dir(path: str) -> None:
    global OUTPUT_DIR
    OUTPUT_DIR = path

# ── FFmpeg ─────────────────────────────────────────────────────────────
FFMPEG_PATH = CFG["ffmpeg"]["executable"]
os.environ["IMAGEIO_FFMPEG_EXE"] = FFMPEG_PATH

# ── HuggingFace env vars ───────────────────────────────────────────────
_hf = CFG.get("huggingface", {})
if _hf.get("hub_disable_xet", False):
    os.environ.setdefault("HF_HUB_DISABLE_XET", "1")
os.environ.setdefault("HF_HUB_DOWNLOAD_TIMEOUT", str(_hf.get("hub_download_timeout", 600)))
os.environ.setdefault("HF_HUB_ETAG_TIMEOUT",     str(_hf.get("hub_etag_timeout", 60)))

HF_TOKEN = os.getenv("HF_TOKEN", "").strip()

# ── Pipeline ───────────────────────────────────────────────────────────
EXPECTED_WORDS   = CFG["pipeline"]["expected_words"]
VIDEO_EXTENSIONS = set(CFG["pipeline"]["video_extensions"])

# ── VAD ────────────────────────────────────────────────────────────────
PYANNOTE_ONSET   = CFG["vad"]["onset"]
PYANNOTE_OFFSET  = CFG["vad"]["offset"]
MIN_DURATION_ON  = CFG["vad"]["min_duration_on"]
MIN_DURATION_OFF = CFG["vad"]["min_duration_off"]

# ── Segmentation ───────────────────────────────────────────────────────
MIN_SEGMENT_LENGTH = CFG["segmentation"]["min_segment_length"]
PADDING_BEFORE     = CFG["segmentation"]["padding_before"]
PADDING_AFTER      = CFG["segmentation"]["padding_after"]
GAP_THRESHOLD      = CFG["segmentation"]["gap_threshold"]

# ── Refinement ─────────────────────────────────────────────────────────
LONG_SEGMENT_FACTOR = CFG["refinement"]["long_segment_factor"]
MIN_VALID_DURATION  = CFG["refinement"]["min_valid_duration"]
MAX_ITERATIONS      = CFG["refinement"]["max_iterations"]

# ── Logging ────────────────────────────────────────────────────────────
_log_cfg        = CFG.get("logging", {})
LOG_LEVEL       = _log_cfg.get("level",      "INFO")
LOG_FILE        = _log_cfg.get("file",       None)
LOG_FILE_LEVEL  = _log_cfg.get("file_level", "DEBUG")


# ==============================
# LOGGING SETUP
# ==============================

def setup_logging() -> None:
    """
    Configure the root logger once at startup.

    Console handler : level from config (default INFO)
    File handler    : level from config (default DEBUG), optional
                      set "file": null in config.json to disable

    All modules use logging.getLogger(__name__) — no setup needed in them.
    """
    fmt = "%(asctime)s | %(levelname)-8s | %(name)s | %(message)s"
    datefmt = "%Y-%m-%d %H:%M:%S"
    formatter = logging.Formatter(fmt, datefmt=datefmt)

    root = logging.getLogger()
    root.setLevel(logging.DEBUG)          # root captures everything
    root.handlers.clear()                 # avoid duplicate handlers on re-import

    # Console handler — INFO by default, clean output
    console = logging.StreamHandler()
    console.setLevel(getattr(logging, LOG_LEVEL.upper(), logging.INFO))
    console.setFormatter(formatter)
    root.addHandler(console)

    # File handler — DEBUG by default, full detail; disabled if file is null
    if LOG_FILE:
        file_handler = logging.FileHandler(LOG_FILE, encoding="utf-8")
        file_handler.setLevel(getattr(logging, LOG_FILE_LEVEL.upper(), logging.DEBUG))
        file_handler.setFormatter(formatter)
        root.addHandler(file_handler)