from __future__ import annotations

import cv2
import hashlib
import json
import logging
import subprocess
import sys
import time
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Dict, List, Literal, Optional, Tuple

import mediapipe as mp
import numpy as np


# ─────────────────────────────────────────────────────────────────────────────
# Logging
# ─────────────────────────────────────────────────────────────────────────────

def _build_logger(name: str = "MouthPipeline") -> logging.Logger:
    logger = logging.getLogger(name)
    if logger.handlers:
        return logger
    logger.setLevel(logging.DEBUG)
    handler = logging.StreamHandler(sys.stderr)
    handler.setFormatter(logging.Formatter(
        "%(asctime)s [%(levelname)-8s] %(message)s", datefmt="%H:%M:%S",
    ))
    logger.addHandler(handler)
    return logger


log = _build_logger()


# ─────────────────────────────────────────────────────────────────────────────
# Constants
# ─────────────────────────────────────────────────────────────────────────────

# MediaPipe Face Mesh landmark indices
_LEFT_IRIS: int = 468          # requires refine_landmarks=True
_RIGHT_IRIS: int = 473
_LEFT_EYE_OUTER: int = 33      # fallback when iris not available
_RIGHT_EYE_OUTER: int = 263
_NOSE_TIP: int = 1

MOUTH_LANDMARK_IDS: Tuple[int, ...] = (
    61, 185, 40, 39, 37, 0, 267, 269, 270, 409,
    291, 375, 321, 405, 314, 17, 84, 181, 91, 146,
)

# Canonical face space: all frames are similarity-transformed into this square.
# Choosing 256 gives comfortable resolution for subsequent 96×96 cropping.
ALIGN_SIZE: int = 256
_CANONICAL_LEFT_EYE = np.array([80.0, 100.0], dtype=np.float32)
_CANONICAL_RIGHT_EYE = np.array([176.0, 100.0], dtype=np.float32)

# Safety floor: faces smaller than this are too far away to be useful.
_MIN_EYE_DIST_PX: float = 15.0

_VALID_SUFFIXES: frozenset = frozenset({".mp4", ".avi", ".mov", ".mkv", ".webm", ".flv"})


# ─────────────────────────────────────────────────────────────────────────────
# Config
# ─────────────────────────────────────────────────────────────────────────────

OutputMode = Literal["video", "frames", "hdf5"]


@dataclass
class Config:
    # ── output ──────────────────────────────────────────────────
    output_mode: OutputMode = "video"
    output_width: int = 96
    output_height: int = 96

    # ── crop geometry ────────────────────────────────────────────
    # Both paddings are relative to the lip span (not fixed pixels).
    # Vertical is intentionally larger because lips travel more vertically
    # during articulation than horizontally.
    padding_x: float = 0.40
    padding_y: float = 0.60
    preserve_aspect_ratio: bool = True

    # ── pixel format ─────────────────────────────────────────────
    grayscale: bool = True
    normalize: bool = False   # True → float32 in [0, 1]; False → uint8

    # ── temporal ─────────────────────────────────────────────────
    fps: Optional[float] = None     # None → preserve source FPS
    bbox_ema_alpha: float = 0.35    # lower = smoother bbox trajectory
    rotation_ema_alpha: float = 0.30

    # ── detection priming ────────────────────────────────────────
    max_init_scan_frames: int = 30

    # ── MediaPipe ────────────────────────────────────────────────
    face_mesh_confidence: float = 0.5

    # ── QC thresholds ────────────────────────────────────────────
    min_blur_score: float = 20.0        # Laplacian variance; drop sharper
    min_exposure: float = 15.0          # mean pixel value (0–255)
    max_exposure: float = 240.0
    max_yaw_deg: float = 45.0           # tolerated head yaw
    min_mouth_containment: float = 0.85 # fraction of mouth pts inside crop box
    max_gap_interpolate: int = 3        # max consecutive frames to interpolate
    min_valid_frame_ratio: float = 0.30 # clip-level gate

    # ── augmentation (training only) ─────────────────────────────
    augment: bool = False
    augment_brightness_delta: float = 0.15

    # ── hdf5 (future use) ────────────────────────────────────────
    hdf5_compression: str = "gzip"
    hdf5_compression_opts: int = 1

    @property
    def output_size(self) -> Tuple[int, int]:
        return (self.output_width, self.output_height)

    def config_hash(self) -> str:
        """
        Deterministic 12-char SHA-256 prefix of all config values.
        Embed this in output paths so old and new outputs are distinguishable
        after parameter changes.
        """
        payload = json.dumps(asdict(self), sort_keys=True).encode()
        return hashlib.sha256(payload).hexdigest()[:12]


# ─────────────────────────────────────────────────────────────────────────────
# Result / stats containers
# ─────────────────────────────────────────────────────────────────────────────

@dataclass
class LandmarkResult:
    points: np.ndarray   # (N, 2) float32, pixel coordinates
    confidence: float    # proxy confidence in [0, 1]


@dataclass
class FrameQC:
    is_valid: bool
    blur_score: float
    exposure_mean: float
    mouth_containment: float
    reasons: List[str] = field(default_factory=list)


@dataclass
class ClipStats:
    total_frames: int = 0
    landmark_success: int = 0
    qc_pass: int = 0
    qc_fail: int = 0
    interpolated: int = 0
    dropped: int = 0
    border_touch: int = 0
    mean_blur: float = 0.0
    mean_confidence: float = 0.0
    bbox_center_jitter_px: float = 0.0

    @property
    def landmark_success_rate(self) -> float:
        return self.landmark_success / max(1, self.total_frames)

    @property
    def valid_frame_ratio(self) -> float:
        # Both QC-passed and interpolated frames count as "valid" for the gate.
        return (self.qc_pass + self.interpolated) / max(1, self.total_frames)

    def to_dict(self) -> Dict:
        return {
            "total_frames": self.total_frames,
            "landmark_success_rate": round(self.landmark_success_rate, 4),
            "valid_frame_ratio": round(self.valid_frame_ratio, 4),
            "qc_pass": self.qc_pass,
            "qc_fail": self.qc_fail,
            "interpolated_frames": self.interpolated,
            "dropped_frames": self.dropped,
            "border_touch_frames": self.border_touch,
            "mean_blur_score": round(self.mean_blur, 2),
            "mean_confidence": round(self.mean_confidence, 4),
            "bbox_center_jitter_px": round(self.bbox_center_jitter_px, 3),
        }


@dataclass
class FrameRecord:
    source_frame_idx: int
    status: Literal[
        "valid",
        "interpolated",
        "dropped_no_landmarks",
        "dropped_gap_too_long",
        "dropped_alignment_failed",
        "dropped_bbox_failed",
        "dropped_pose",
        "dropped_qc",
    ]
    output_frame_idx: Optional[int] = None
    is_sequence_frame: bool = False
    is_interpolated: bool = False
    bbox_xywh: Optional[Dict[str, int]] = None
    blur_score: Optional[float] = None
    exposure_mean: Optional[float] = None
    mouth_containment: Optional[float] = None
    yaw_deg: Optional[float] = None
    confidence: Optional[float] = None
    reasons: List[str] = field(default_factory=list)

    def to_dict(self) -> Dict:
        payload = asdict(self)
        if payload["bbox_xywh"] is None:
            payload.pop("bbox_xywh")
        if payload["blur_score"] is None:
            payload.pop("blur_score")
        if payload["exposure_mean"] is None:
            payload.pop("exposure_mean")
        if payload["mouth_containment"] is None:
            payload.pop("mouth_containment")
        if payload["yaw_deg"] is None:
            payload.pop("yaw_deg")
        if payload["confidence"] is None:
            payload.pop("confidence")
        if not payload["reasons"]:
            payload.pop("reasons")
        return payload


# ─────────────────────────────────────────────────────────────────────────────
# EMA smoothers
# ─────────────────────────────────────────────────────────────────────────────

class ScalarSmoother:
    """Exponential moving average for a single float."""

    def __init__(self, alpha: float = 0.35) -> None:
        if not 0.0 < alpha <= 1.0:
            raise ValueError(f"alpha={alpha!r} must be in (0, 1]")
        self.alpha = alpha
        self._state: Optional[float] = None

    def reset(self) -> None:
        self._state = None

    def update(self, value: float) -> float:
        self._state = (
            value
            if self._state is None
            else self.alpha * value + (1.0 - self.alpha) * self._state
        )
        return self._state

    @property
    def value(self) -> Optional[float]:
        return self._state

    @property
    def has_state(self) -> bool:
        return self._state is not None


class BboxSmoother:
    """Exponential moving average for (x1, y1, x2, y2) bounding boxes."""

    def __init__(self, alpha: float = 0.35) -> None:
        if not 0.0 < alpha <= 1.0:
            raise ValueError(f"alpha={alpha!r} must be in (0, 1]")
        self.alpha = alpha
        self._state: Optional[np.ndarray] = None

    def reset(self) -> None:
        self._state = None

    def update(self, bbox: Tuple[int, int, int, int]) -> Tuple[int, int, int, int]:
        b = np.array(bbox, dtype=np.float64)
        self._state = (
            b
            if self._state is None
            else self.alpha * b + (1.0 - self.alpha) * self._state
        )
        return tuple(self._state.round().astype(int))  # type: ignore[return-value]

    @property
    def has_state(self) -> bool:
        return self._state is not None


# ─────────────────────────────────────────────────────────────────────────────
# Landmark extraction
# ─────────────────────────────────────────────────────────────────────────────

def extract_landmarks(
    frame_bgr: np.ndarray,
    face_mesh: mp.solutions.face_mesh.FaceMesh,
) -> Optional[LandmarkResult]:
    """
    Run FaceMesh on a single BGR frame.

    Returns pixel-space landmark coordinates for the first detected face,
    or None if no face was found.

    Note: With static_image_mode=False the FaceMesh maintains internal
    tracking state — do NOT share a single instance across multiple videos
    or after rewinding a stream. Recreate it per video.
    """
    h, w = frame_bgr.shape[:2]
    rgb = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2RGB)
    rgb.flags.writeable = False
    results = face_mesh.process(rgb)

    if not results.multi_face_landmarks:
        return None

    face = results.multi_face_landmarks[0]
    pts = np.array(
        [(lm.x * w, lm.y * h) for lm in face.landmark],
        dtype=np.float32,
    )  # shape: (478, 2) with refine_landmarks=True

    # MediaPipe FaceMesh does not expose a scalar per-face detection confidence.
    # Use the mean visibility of both iris landmarks as a proxy.
    confidence = 0.5
    if len(face.landmark) > _RIGHT_IRIS:
        vis_l = getattr(face.landmark[_LEFT_IRIS], "visibility", 0.5)
        vis_r = getattr(face.landmark[_RIGHT_IRIS], "visibility", 0.5)
        confidence = float((vis_l + vis_r) / 2.0)

    return LandmarkResult(points=pts, confidence=confidence)


# ─────────────────────────────────────────────────────────────────────────────
# Face alignment — similarity transform
# ─────────────────────────────────────────────────────────────────────────────

def compute_alignment_transform(
    landmarks: LandmarkResult,
) -> Optional[np.ndarray]:
    """
    Compute the 2×3 similarity transform (translation + rotation + uniform scale)
    that maps the detected eye positions to canonical positions in a fixed
    ALIGN_SIZE × ALIGN_SIZE space.

    Iris landmarks (468/473) are preferred over eye-corner landmarks because
    they are more geometrically stable. Falls back to eye-corner landmarks if
    the iris indices are not present (refine_landmarks=False).

    Returns None when:
      - landmarks array is too short
      - eye distance is below the minimum threshold (face too small / occluded)
      - cv2.estimateAffinePartial2D fails
    """
    pts = landmarks.points
    n = len(pts)

    if n > _RIGHT_IRIS:
        left_eye = pts[_LEFT_IRIS]
        right_eye = pts[_RIGHT_IRIS]
    elif n > _RIGHT_EYE_OUTER:
        left_eye = pts[_LEFT_EYE_OUTER]
        right_eye = pts[_RIGHT_EYE_OUTER]
    else:
        log.debug("Landmark array too short for alignment")
        return None

    eye_dist = float(np.linalg.norm(right_eye - left_eye))
    if eye_dist < _MIN_EYE_DIST_PX:
        log.debug(f"Eye distance {eye_dist:.1f}px < {_MIN_EYE_DIST_PX} — face too small")
        return None

    src = np.array([left_eye, right_eye], dtype=np.float32).reshape(-1, 1, 2)
    dst = np.array(
        [_CANONICAL_LEFT_EYE, _CANONICAL_RIGHT_EYE], dtype=np.float32
    ).reshape(-1, 1, 2)

    # estimateAffinePartial2D → 4-DOF similarity: tx, ty, rotation, scale
    M, _ = cv2.estimateAffinePartial2D(src, dst, method=cv2.LMEDS)
    return M  # (2, 3) ndarray or None if estimation failed


def apply_alignment(frame_bgr: np.ndarray, M: np.ndarray) -> np.ndarray:
    """
    Warp a BGR frame into the canonical ALIGN_SIZE × ALIGN_SIZE space.
    BORDER_REPLICATE avoids black borders when the face is near the edge.
    """
    return cv2.warpAffine(
        frame_bgr, M, (ALIGN_SIZE, ALIGN_SIZE),
        flags=cv2.INTER_LINEAR,
        borderMode=cv2.BORDER_REPLICATE,
    )


def transform_landmarks(pts: np.ndarray, M: np.ndarray) -> np.ndarray:
    """
    Apply a 2×3 affine matrix to an (N, 2) array of landmark points.

    Converts to homogeneous coordinates, multiplies by M, returns (N, 2).
    This keeps landmark coordinates consistent with the warped frame so
    the mouth bbox is computed in aligned space.
    """
    ones = np.ones((len(pts), 1), dtype=np.float32)
    pts_h = np.hstack([pts, ones])               # (N, 3)
    return (M @ pts_h.T).T.astype(np.float32)    # (N, 2)


def estimate_yaw_degrees(landmarks: LandmarkResult) -> float:
    """
    Heuristic yaw estimate from nose-to-eye distance asymmetry.

    When the face turns right, the left eye appears further from the nose
    and the right eye closer — this asymmetry maps to a yaw angle.
    Range is approximately ±90°. Not a calibrated measurement; used only
    as a pose quality gate.
    """
    pts = landmarks.points
    required = max(_LEFT_EYE_OUTER, _RIGHT_EYE_OUTER, _NOSE_TIP)
    if len(pts) <= required:
        return 0.0
    d_left = float(np.linalg.norm(pts[_LEFT_EYE_OUTER] - pts[_NOSE_TIP]))
    d_right = float(np.linalg.norm(pts[_RIGHT_EYE_OUTER] - pts[_NOSE_TIP]))
    total = d_left + d_right
    if total < 1e-6:
        return 0.0
    asymmetry = (d_right - d_left) / total
    return float(np.degrees(np.arcsin(np.clip(asymmetry, -1.0, 1.0))))


# ─────────────────────────────────────────────────────────────────────────────
# Mouth bounding box
# ─────────────────────────────────────────────────────────────────────────────

def compute_mouth_bbox(
    aligned_pts: np.ndarray,
    padding_x: float,
    padding_y: float,
    frame_size: int = ALIGN_SIZE,
) -> Optional[Tuple[int, int, int, int]]:
    """
    Derive the mouth ROI from lip landmarks in aligned coordinate space.

    Padding is a fraction of the lip span, not a fixed pixel count, so
    the crop margin scales consistently across different face sizes.
    Vertical padding is intentionally independent from horizontal so the
    caller can set asymmetric margins.

    Returns (x1, y1, x2, y2) clamped to [0, frame_size), or None.
    """
    if len(aligned_pts) <= max(MOUTH_LANDMARK_IDS):
        return None

    pts = aligned_pts[list(MOUTH_LANDMARK_IDS)]
    mx1, my1 = pts.min(axis=0)
    mx2, my2 = pts.max(axis=0)
    mw, mh = mx2 - mx1, my2 - my1

    if mw < 2 or mh < 2:
        return None

    x1 = int(max(0, mx1 - mw * padding_x))
    y1 = int(max(0, my1 - mh * padding_y))
    x2 = int(min(frame_size, mx2 + mw * padding_x))
    y2 = int(min(frame_size, my2 + mh * padding_y))

    if x2 <= x1 or y2 <= y1:
        return None

    return (x1, y1, x2, y2)


def _bbox_center(bbox: Tuple[int, int, int, int]) -> Tuple[float, float]:
    x1, y1, x2, y2 = bbox
    return ((x1 + x2) * 0.5, (y1 + y2) * 0.5)


def _bbox_to_xywh(bbox: Tuple[int, int, int, int]) -> Dict[str, int]:
    x1, y1, x2, y2 = bbox
    return {
        "x": int(x1),
        "y": int(y1),
        "w": int(x2 - x1),
        "h": int(y2 - y1),
    }


def _interpolate_bbox(
    a: Tuple[int, int, int, int],
    b: Tuple[int, int, int, int],
    t: float,
) -> Tuple[int, int, int, int]:
    """Linearly interpolate between two bounding boxes. t ∈ [0, 1]."""
    arr = np.array(a, dtype=np.float64) * (1.0 - t) + np.array(b, dtype=np.float64) * t
    return tuple(arr.round().astype(int))  # type: ignore[return-value]


# ─────────────────────────────────────────────────────────────────────────────
# Frame quality assessment
# ─────────────────────────────────────────────────────────────────────────────

def _laplacian_blur_score(gray: np.ndarray) -> float:
    """Laplacian variance sharpness score. Higher = sharper."""
    return float(cv2.Laplacian(gray, cv2.CV_64F).var())


def assess_frame_quality(
    crop_bgr: np.ndarray,
    aligned_pts: np.ndarray,
    bbox: Tuple[int, int, int, int],
    cfg: Config,
) -> FrameQC:
    """
    Evaluate a single mouth-region crop for quality.

    Checks:
      1. Sharpness  — Laplacian variance of the grayscale crop
      2. Exposure   — mean brightness (rejects near-black and saturated frames)
      3. Containment — fraction of mouth landmarks inside the crop box
         (guards against misaligned or truncated crops)

    Border-touch detection (crop reaching the aligned-frame edge) is handled
    in the main loop because it depends on ALIGN_SIZE, not cfg.
    """
    reasons: List[str] = []

    if crop_bgr.size == 0:
        return FrameQC(False, 0.0, 0.0, 0.0, ["empty_crop"])

    gray = cv2.cvtColor(crop_bgr, cv2.COLOR_BGR2GRAY)
    blur = _laplacian_blur_score(gray)
    exp = float(gray.mean())

    x1, y1, x2, y2 = bbox
    mouth_pts = aligned_pts[list(MOUTH_LANDMARK_IDS)]
    inside = (
        (mouth_pts[:, 0] >= x1) & (mouth_pts[:, 0] <= x2) &
        (mouth_pts[:, 1] >= y1) & (mouth_pts[:, 1] <= y2)
    )
    containment = float(inside.mean())

    if blur < cfg.min_blur_score:
        reasons.append(f"blur={blur:.1f}<{cfg.min_blur_score}")
    if exp < cfg.min_exposure:
        reasons.append(f"dark={exp:.1f}<{cfg.min_exposure}")
    if exp > cfg.max_exposure:
        reasons.append(f"bright={exp:.1f}>{cfg.max_exposure}")
    if containment < cfg.min_mouth_containment:
        reasons.append(f"containment={containment:.2f}<{cfg.min_mouth_containment}")

    return FrameQC(
        is_valid=not reasons,
        blur_score=blur,
        exposure_mean=exp,
        mouth_containment=containment,
        reasons=reasons,
    )


# ─────────────────────────────────────────────────────────────────────────────
# Crop, resize, augment
# ─────────────────────────────────────────────────────────────────────────────

def _letterbox(img: np.ndarray, out_w: int, out_h: int) -> np.ndarray:
    """
    Resize img to fit inside (out_w, out_h) while preserving aspect ratio.
    Remaining space is zero-padded.
    Always returns a 3-D array (H, W, C).
    """
    h, w = img.shape[:2]
    scale = min(out_w / w, out_h / h)
    nw = max(1, int(round(w * scale)))
    nh = max(1, int(round(h * scale)))
    resized = cv2.resize(img, (nw, nh), interpolation=cv2.INTER_LANCZOS4)

    c = img.shape[2] if img.ndim == 3 else 1
    canvas = np.zeros((out_h, out_w, c), dtype=resized.dtype)
    if resized.ndim == 2:
        resized = resized[..., np.newaxis]
    y0 = (out_h - nh) // 2
    x0 = (out_w - nw) // 2
    canvas[y0: y0 + nh, x0: x0 + nw] = resized
    return canvas


def crop_and_resize(
    aligned_bgr: np.ndarray,
    bbox: Tuple[int, int, int, int],
    cfg: Config,
) -> np.ndarray:
    """
    Crop the aligned frame to bbox, optionally convert to grayscale,
    resize to cfg.output_size, and optionally normalize to [0, 1].

    Always returns a 3-D (H, W, C) array so downstream code never has
    to inspect ndim. dtype is uint8 unless cfg.normalize=True (float32).
    """
    x1, y1, x2, y2 = bbox
    fh, fw = aligned_bgr.shape[:2]
    x1, y1 = max(0, x1), max(0, y1)
    x2, y2 = min(fw, x2), min(fh, y2)
    ow, oh = cfg.output_size

    crop = aligned_bgr[y1:y2, x1:x2]
    if crop.size == 0:
        c = 1 if cfg.grayscale else 3
        blank = np.zeros((oh, ow, c), dtype=np.uint8)
        return blank.astype(np.float32) / 255.0 if cfg.normalize else blank

    if cfg.grayscale:
        crop = cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY)[..., np.newaxis]  # (H,W,1)

    if cfg.preserve_aspect_ratio:
        out = _letterbox(crop, ow, oh)
    else:
        out = cv2.resize(crop, (ow, oh), interpolation=cv2.INTER_LANCZOS4)
        if out.ndim == 2:
            out = out[..., np.newaxis]

    return out.astype(np.float32) / 255.0 if cfg.normalize else out


def _augment_frame(frame: np.ndarray, cfg: Config) -> np.ndarray:
    """
    Apply mild training augmentations that do not distort articulation cues.

    Currently: random brightness shift.
    Intentionally avoids: flips, warps, blur, strong colour jitter.
    """
    if not cfg.augment:
        return frame
    delta = np.random.uniform(-cfg.augment_brightness_delta, cfg.augment_brightness_delta)
    if frame.dtype == np.uint8:
        shifted = frame.astype(np.int16) + int(delta * 255)
        return np.clip(shifted, 0, 255).astype(np.uint8)
    return np.clip(frame + delta, 0.0, 1.0).astype(np.float32)


# ─────────────────────────────────────────────────────────────────────────────
# Video I/O
# ─────────────────────────────────────────────────────────────────────────────

def _save_video(
    frames: List[np.ndarray],
    path: Path,
    fps: float,
    cfg: Config,
) -> bool:
    ow, oh = cfg.output_size
    is_color = not cfg.grayscale
    fourcc = cv2.VideoWriter_fourcc(*"mp4v")
    writer = cv2.VideoWriter(str(path), fourcc, fps, (ow, oh), isColor=is_color)
    if not writer.isOpened():
        log.error(f"VideoWriter failed to open: {path}")
        return False
    try:
        for f in frames:
            img = f
            if img.dtype != np.uint8:
                img = (img * 255.0).clip(0, 255).astype(np.uint8)
            if img.ndim == 3 and img.shape[2] == 1:
                img = img[..., 0]
                if is_color:
                    img = cv2.cvtColor(img, cv2.COLOR_GRAY2BGR)
            writer.write(img)
    finally:
        writer.release()
    return True


def _mux_audio(source: Path, roi: Path) -> Path:
    """
    Mux audio track from source into the silent roi video using ffmpeg.

    Returns the path to the muxed file on success, or roi unchanged if
    ffmpeg is unavailable or fails (silent video is still usable).
    The caller is responsible for deleting the intermediate file.
    """
    out = roi.with_name(f"{roi.stem}_a.mp4")
    cmd = [
        "ffmpeg", "-y",
        "-i", str(roi),
        "-i", str(source),
        "-map", "0:v:0",
        "-map", "1:a:0?",    # ? = silently skip if no audio track
        "-c:v", "copy",
        "-c:a", "aac",
        "-shortest",
        str(out),
    ]
    try:
        subprocess.run(
            cmd, check=True,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.PIPE,
            timeout=120,
        )
    except FileNotFoundError:
        log.warning("ffmpeg not found — saving silent video")
        return roi
    except subprocess.CalledProcessError as exc:
        log.warning(f"ffmpeg failed: {exc.stderr.decode()[:200]}")
        return roi
    except subprocess.TimeoutExpired:
        log.warning("ffmpeg timed out during audio mux")
        return roi
    return out


def _save_preview(frame: np.ndarray, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    img = frame
    if img.dtype != np.uint8:
        img = (img * 255.0).clip(0, 255).astype(np.uint8)
    if img.ndim == 3 and img.shape[2] == 1:
        img = img[..., 0]
    cv2.imwrite(str(path), img)


def _save_sequence_metadata(
    path: Path,
    cfg: Config,
    stats: ClipStats,
    frame_records: List[FrameRecord],
    out_fps: float,
    source_frame_count: int,
    output_frame_count: int,
) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)

    sequence_mask = [1 if record.is_sequence_frame else 0 for record in frame_records]
    observed_mask = [1 if record.status == "valid" else 0 for record in frame_records]
    interpolated_mask = [1 if record.status == "interpolated" else 0 for record in frame_records]

    payload = {
        "config_hash": cfg.config_hash(),
        "fps": out_fps,
        "source_frame_count": source_frame_count,
        "output_frame_count": output_frame_count,
        "stats": stats.to_dict(),
        "sequence_masks": {
            "sequence_mask": sequence_mask,
            "observed_mask": observed_mask,
            "interpolated_mask": interpolated_mask,
        },
        "frames": [record.to_dict() for record in frame_records],
    }

    with path.open("w", encoding="utf-8") as f:
        json.dump(payload, f, indent=2)


def _make_face_mesh(cfg: Config) -> mp.solutions.face_mesh.FaceMesh:
    """
    Construct a FaceMesh instance with tracking enabled.

    IMPORTANT: static_image_mode=False enables inter-frame tracking, which
    dramatically improves landmark stability and reduces detection overhead.
    Consequence: the instance MUST NOT be reused after seek/rewind — create
    a fresh one (see process_video for the priming-then-rewind pattern).
    """
    return mp.solutions.face_mesh.FaceMesh(
        static_image_mode=False,       # tracking mode — do not change
        max_num_faces=1,
        refine_landmarks=True,         # enables iris landmarks 468/473
        min_detection_confidence=cfg.face_mesh_confidence,
        min_tracking_confidence=cfg.face_mesh_confidence,
    )


# ─────────────────────────────────────────────────────────────────────────────
# Main pipeline
# ─────────────────────────────────────────────────────────────────────────────

def process_video(
    input_path: Path,
    output_video_path: Path,
    preview_image_path: Path,
    metadata_path: Path,
    cfg: Config,
) -> dict:
    """
    Full mouth-crop pipeline for a single video.

    Pipeline steps per frame
    ────────────────────────
    1. MediaPipe FaceMesh → raw landmarks (static_image_mode=False → tracking)
    2. Similarity transform from eye positions → canonical 256×256 space
    3. Warp frame into canonical space
    4. Transform landmarks into aligned coordinates
    5. Compute mouth bbox from aligned lip landmarks (with asymmetric padding)
    6. EMA-smooth bbox to suppress landmark jitter
    7. Estimate yaw → gate frame if pose is too extreme
    8. Assess quality: blur score, exposure, mouth-landmark containment
    9. Collect tensor; on landmark failure buffer for interpolation

    Gap interpolation
    ─────────────────
    Short runs of failed landmark detection (≤ cfg.max_gap_interpolate) are
    filled by linearly interpolating the bbox between the last good frame and
    the next good frame, then cropping with the last good alignment transform.
    Longer gaps are dropped and the smoother state is reset.

    Clip-level metadata
    ───────────────────
    Writes a JSON sidecar containing per-frame status, sequence masks,
    per-frame QC values, and bbox metadata. This is useful for training-time
    sequence masking and for debugging preprocessing quality without changing
    the preview PNG or ROI video outputs.

    Returns
    ───────
    dict with roi_video_path, preview_image_path, metadata_path, fps,
    frame_count, config_hash, roi_coords, and per-clip stats.

    Raises
    ──────
    RuntimeError on unrecoverable failure.
    """
    cap = cv2.VideoCapture(str(input_path))
    if not cap.isOpened():
        raise RuntimeError(f"Cannot open video: {input_path.name}")

    src_fps: float = cap.get(cv2.CAP_PROP_FPS) or 25.0
    out_fps: float = cfg.fps if cfg.fps else src_fps
    total_raw: int = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    log.info(f"Input: {input_path.name} — {total_raw} frames @ {src_fps:.1f} fps")

    # ── Phase 1: Prime ───────────────────────────────────────────────────────
    face_mesh = _make_face_mesh(cfg)
    primed = False

    for _ in range(cfg.max_init_scan_frames):
        ret, frame = cap.read()
        if not ret:
            break
        lm = extract_landmarks(frame, face_mesh)
        if lm is None:
            continue
        M = compute_alignment_transform(lm)
        if M is None:
            continue
        aligned = apply_alignment(frame, M)
        pts_a = transform_landmarks(lm.points, M)
        if compute_mouth_bbox(pts_a, cfg.padding_x, cfg.padding_y) is not None:
            primed = True
            log.info(
                f"Face primed — yaw ≈ {estimate_yaw_degrees(lm):.1f}°, "
                f"eye_conf ≈ {lm.confidence:.2f}"
            )
            break

    face_mesh.close()

    if not primed:
        cap.release()
        raise RuntimeError(
            f"No detectable face found in the first {cfg.max_init_scan_frames} frames"
        )

    cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
    face_mesh = _make_face_mesh(cfg)

    stats = ClipStats()
    bbox_smoother = BboxSmoother(alpha=cfg.bbox_ema_alpha)
    yaw_smoother = ScalarSmoother(alpha=cfg.rotation_ema_alpha)

    processed_frames: List[np.ndarray] = []
    bbox_centers: List[Tuple[float, float]] = []
    frame_records: List[FrameRecord] = []

    gap_buffer: List[Tuple[int, np.ndarray]] = []   # (frame_idx, bgr_copy)
    last_committed_bbox: Optional[Tuple[int, int, int, int]] = None
    last_committed_M: Optional[np.ndarray] = None

    blur_history: List[float] = []
    conf_history: List[float] = []

    frame_idx = 0
    try:
        while True:
            ret, frame = cap.read()
            if not ret:
                break
            stats.total_frames += 1

            lm = extract_landmarks(frame, face_mesh)

            if lm is None:
                if last_committed_M is not None:
                    gap_buffer.append((frame_idx, frame.copy()))
                    if len(gap_buffer) > cfg.max_gap_interpolate:
                        log.debug(
                            f"Gap too long ({len(gap_buffer)} frames) — dropping"
                        )
                        for gap_idx, _ in gap_buffer:
                            frame_records.append(FrameRecord(
                                source_frame_idx=gap_idx,
                                status="dropped_gap_too_long",
                                reasons=["landmark_gap_exceeded_interpolation_budget"],
                            ))
                        stats.dropped += len(gap_buffer)
                        gap_buffer.clear()
                        last_committed_bbox = None
                        last_committed_M = None
                        bbox_smoother.reset()
                else:
                    frame_records.append(FrameRecord(
                        source_frame_idx=frame_idx,
                        status="dropped_no_landmarks",
                        reasons=["no_landmarks"],
                    ))
                    stats.dropped += 1
                frame_idx += 1
                continue

            stats.landmark_success += 1
            conf_history.append(lm.confidence)

            yaw = estimate_yaw_degrees(lm)
            smoothed_yaw = yaw_smoother.update(yaw)

            M = compute_alignment_transform(lm)
            if M is None:
                frame_records.append(FrameRecord(
                    source_frame_idx=frame_idx,
                    status="dropped_alignment_failed",
                    yaw_deg=round(smoothed_yaw, 3),
                    confidence=round(lm.confidence, 4),
                    reasons=["alignment_failed"],
                ))
                stats.dropped += 1
                frame_idx += 1
                continue

            aligned = apply_alignment(frame, M)
            pts_aligned = transform_landmarks(lm.points, M)

            bbox_raw = compute_mouth_bbox(pts_aligned, cfg.padding_x, cfg.padding_y)
            if bbox_raw is None:
                frame_records.append(FrameRecord(
                    source_frame_idx=frame_idx,
                    status="dropped_bbox_failed",
                    yaw_deg=round(smoothed_yaw, 3),
                    confidence=round(lm.confidence, 4),
                    reasons=["mouth_bbox_failed"],
                ))
                stats.dropped += 1
                frame_idx += 1
                continue

            current_bbox = bbox_smoother.update(bbox_raw)
            x1, y1, x2, y2 = current_bbox

            if gap_buffer:
                n = len(gap_buffer)
                if last_committed_bbox is not None and last_committed_M is not None and n <= cfg.max_gap_interpolate:
                    for gi, (gap_idx, gap_frame) in enumerate(gap_buffer):
                        t = (gi + 1) / (n + 1)
                        interp = _interpolate_bbox(last_committed_bbox, current_bbox, t)
                        gap_aligned = apply_alignment(gap_frame, last_committed_M)
                        tensor = crop_and_resize(gap_aligned, interp, cfg)
                        tensor = _augment_frame(tensor, cfg)
                        output_frame_idx = len(processed_frames)
                        processed_frames.append(tensor)
                        bbox_centers.append(_bbox_center(interp))
                        frame_records.append(FrameRecord(
                            source_frame_idx=gap_idx,
                            status="interpolated",
                            output_frame_idx=output_frame_idx,
                            is_sequence_frame=True,
                            is_interpolated=True,
                            bbox_xywh=_bbox_to_xywh(interp),
                            reasons=["landmark_gap_interpolated"],
                        ))
                        stats.interpolated += 1
                else:
                    for gap_idx, _ in gap_buffer:
                        frame_records.append(FrameRecord(
                            source_frame_idx=gap_idx,
                            status="dropped_gap_too_long",
                            reasons=["landmark_gap_exceeded_interpolation_budget"],
                        ))
                    stats.dropped += n
                gap_buffer.clear()

            if abs(smoothed_yaw) > cfg.max_yaw_deg:
                log.debug(f"Frame {frame_idx}: yaw={smoothed_yaw:.1f}° exceeds limit")
                frame_records.append(FrameRecord(
                    source_frame_idx=frame_idx,
                    status="dropped_pose",
                    yaw_deg=round(smoothed_yaw, 3),
                    confidence=round(lm.confidence, 4),
                    bbox_xywh=_bbox_to_xywh(current_bbox),
                    reasons=[f"yaw={smoothed_yaw:.1f}>{cfg.max_yaw_deg}"],
                ))
                stats.qc_fail += 1
                frame_idx += 1
                continue

            crop_bgr = aligned[
                max(0, y1): min(ALIGN_SIZE, y2),
                max(0, x1): min(ALIGN_SIZE, x2),
            ]
            qc = assess_frame_quality(crop_bgr, pts_aligned, current_bbox, cfg)
            if not qc.is_valid:
                log.debug(f"Frame {frame_idx}: QC fail — {qc.reasons}")
                frame_records.append(FrameRecord(
                    source_frame_idx=frame_idx,
                    status="dropped_qc",
                    yaw_deg=round(smoothed_yaw, 3),
                    confidence=round(lm.confidence, 4),
                    bbox_xywh=_bbox_to_xywh(current_bbox),
                    blur_score=round(qc.blur_score, 3),
                    exposure_mean=round(qc.exposure_mean, 3),
                    mouth_containment=round(qc.mouth_containment, 4),
                    reasons=qc.reasons,
                ))
                stats.qc_fail += 1
                frame_idx += 1
                continue

            if x1 <= 0 or y1 <= 0 or x2 >= ALIGN_SIZE or y2 >= ALIGN_SIZE:
                stats.border_touch += 1

            blur_history.append(qc.blur_score)
            stats.qc_pass += 1

            tensor = crop_and_resize(aligned, current_bbox, cfg)
            tensor = _augment_frame(tensor, cfg)
            output_frame_idx = len(processed_frames)
            processed_frames.append(tensor)
            bbox_centers.append(_bbox_center(current_bbox))
            frame_records.append(FrameRecord(
                source_frame_idx=frame_idx,
                status="valid",
                output_frame_idx=output_frame_idx,
                is_sequence_frame=True,
                is_interpolated=False,
                bbox_xywh=_bbox_to_xywh(current_bbox),
                blur_score=round(qc.blur_score, 3),
                exposure_mean=round(qc.exposure_mean, 3),
                mouth_containment=round(qc.mouth_containment, 4),
                yaw_deg=round(smoothed_yaw, 3),
                confidence=round(lm.confidence, 4),
            ))
            last_committed_bbox = current_bbox
            last_committed_M = M

            frame_idx += 1

    finally:
        cap.release()
        face_mesh.close()

    if gap_buffer:
        for gap_idx, _ in gap_buffer:
            frame_records.append(FrameRecord(
                source_frame_idx=gap_idx,
                status="dropped_gap_too_long",
                reasons=["trailing_landmark_gap_without_recovery"],
            ))
        stats.dropped += len(gap_buffer)
        gap_buffer.clear()

    frame_records.sort(key=lambda record: record.source_frame_idx)

    stats.mean_blur = float(np.mean(blur_history)) if blur_history else 0.0
    stats.mean_confidence = float(np.mean(conf_history)) if conf_history else 0.0

    if len(bbox_centers) > 1:
        centers = np.array(bbox_centers, dtype=np.float32)
        diffs = np.linalg.norm(np.diff(centers, axis=0), axis=1)
        stats.bbox_center_jitter_px = float(np.std(diffs))

    log.info(
        f"Pass complete — valid={stats.qc_pass}/{stats.total_frames} "
        f"({stats.valid_frame_ratio:.1%}), "
        f"interp={stats.interpolated}, dropped={stats.dropped}, "
        f"blur={stats.mean_blur:.1f}, jitter={stats.bbox_center_jitter_px:.2f}px"
    )

    if stats.valid_frame_ratio < cfg.min_valid_frame_ratio:
        raise RuntimeError(
            f"Clip rejected — only {stats.valid_frame_ratio:.1%} valid frames "
            f"(minimum {cfg.min_valid_frame_ratio:.1%}). "
            f"landmark_rate={stats.landmark_success_rate:.1%}, "
            f"mean_blur={stats.mean_blur:.1f}"
        )

    if not processed_frames:
        raise RuntimeError("No frames remain after quality control")

    output_video_path.parent.mkdir(parents=True, exist_ok=True)
    silent_path = output_video_path.with_suffix(".mp4")

    if not _save_video(processed_frames, silent_path, out_fps, cfg):
        raise RuntimeError("Failed to write ROI video")

    muxed_path = _mux_audio(input_path, silent_path)
    if muxed_path != silent_path:
        silent_path.unlink(missing_ok=True)
        muxed_path.rename(silent_path)

    preview_idx = min(len(processed_frames) - 1, 5)
    _save_preview(processed_frames[preview_idx], preview_image_path)
    _save_sequence_metadata(
        path=metadata_path,
        cfg=cfg,
        stats=stats,
        frame_records=frame_records,
        out_fps=out_fps,
        source_frame_count=stats.total_frames,
        output_frame_count=len(processed_frames),
    )

    return {
        "roi_video_path": str(silent_path),
        "preview_image_path": str(preview_image_path),
        "metadata_path": str(metadata_path),
        "roi_coords": (
            {
                "x": int(last_committed_bbox[0]),
                "y": int(last_committed_bbox[1]),
                "w": int(last_committed_bbox[2] - last_committed_bbox[0]),
                "h": int(last_committed_bbox[3] - last_committed_bbox[1]),
            }
            if last_committed_bbox else None
        ),
        "fps": out_fps,
        "frame_count": len(processed_frames),
        "config_hash": cfg.config_hash(),
        "stats": stats.to_dict(),
    }


# ─────────────────────────────────────────────────────────────────────────────
# FastAPI entry point
# ─────────────────────────────────────────────────────────────────────────────

def run_mouth_cut_for_video(
    input_video_path: str,
    output_dir: str,
    output_basename: str,
    *,
    output_resolution: str = "96x96",
    crop_margin_x: int = 40,
    crop_margin_y: int = 60,
    face_tracking: bool = True,
    grayscale: bool = True,
    normalize: bool = False,
    augment: bool = False,
    min_valid_frame_ratio: float = 0.30,
) -> dict:
    """
    Validated entry point for the FastAPI layer.

    Validates all inputs, constructs Config, sets up output paths,
    runs process_video, and attaches URL fields to the result dict.

    Raises FileNotFoundError, ValueError, or RuntimeError on failure —
    the API layer maps these to appropriate HTTP status codes.
    """
    t0 = time.perf_counter()

    p = Path(input_video_path)
    if not p.exists():
        raise FileNotFoundError(f"Input video not found: {input_video_path!r}")
    if p.suffix.lower() not in _VALID_SUFFIXES:
        raise ValueError(
            f"Unsupported file extension {p.suffix!r}. "
            f"Accepted: {sorted(_VALID_SUFFIXES)}"
        )

    try:
        w_str, h_str = output_resolution.lower().split("x")
        out_w, out_h = int(w_str), int(h_str)
    except (ValueError, AttributeError):
        raise ValueError(
            f"Invalid output_resolution {output_resolution!r}. Expected 'WxH', e.g. '96x96'."
        )
    if not (32 <= out_w <= 512 and 32 <= out_h <= 512):
        raise ValueError("Output dimensions must each be between 32 and 512 px")
    if not (0 < crop_margin_x <= 100 and 0 < crop_margin_y <= 100):
        raise ValueError("crop_margin values must be in (0, 100]")
    if not (0.0 < min_valid_frame_ratio <= 1.0):
        raise ValueError("min_valid_frame_ratio must be in (0, 1]")

    cfg = Config(
        output_width=out_w,
        output_height=out_h,
        padding_x=crop_margin_x / 100.0,
        padding_y=crop_margin_y / 100.0,
        grayscale=grayscale,
        normalize=normalize,
        augment=augment,
        bbox_ema_alpha=0.35 if face_tracking else 1.0,
        min_valid_frame_ratio=min_valid_frame_ratio,
    )

    run_dir = Path(output_dir) / output_basename
    run_dir.mkdir(parents=True, exist_ok=True)

    result = process_video(
        input_path=p,
        output_video_path=run_dir / "roi.mp4",
        preview_image_path=run_dir / "preview.png",
        metadata_path=run_dir / "sequence_metadata.json",
        cfg=cfg,
    )

    elapsed = time.perf_counter() - t0
    result["inference_time_ms"] = int(elapsed * 1000)
    result["inference_time"] = f"{elapsed:.2f}s"

    result["roi_video_url"] = "/" + result["roi_video_path"].replace("\\", "/")
    result["preview_image_url"] = "/" + result["preview_image_path"].replace("\\", "/")
    result["metadata_url"] = "/" + result["metadata_path"].replace("\\", "/")
    return result
