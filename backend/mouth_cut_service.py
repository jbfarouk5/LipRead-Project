from __future__ import annotations

import cv2
import hashlib
import json
import logging
import subprocess
import sys
import time
from dataclasses import asdict, dataclass, field, replace
from pathlib import Path
from typing import Callable, Dict, List, Literal, Optional, Tuple

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
ALIGN_SIZE: int = 256
_CANONICAL_LEFT_EYE  = np.array([80.0,  100.0], dtype=np.float32)
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

    # ── stable crop geometry ─────────────────────────────────────
    # After Pass 1 collects per-frame mouth widths/heights, the stable box is:
    #   width  = pN_mouth_width  * (1 + 2 * padding_percent_x)
    #   height = pN_mouth_height * (1 + 2 * padding_percent_y)
    # centered at the median mouth center across valid frames.
    #
    # Tuning guide:
    #   padding_percent_x ∈ [0.30, 0.50]  — fraction of lip width added on EACH side
    #   padding_percent_y ∈ [0.70, 0.95]  — fraction of lip height added on EACH side
    #   crop_percentile   ∈ [90, 95]       — which percentile of lip span drives box size
    padding_percent_x: float = 0.15
    padding_percent_y: float = 0.20
    crop_percentile: float = 95.0

    preserve_aspect_ratio: bool = False   # kept for adaptive-QC pre-scan compat

    # ── pixel format ─────────────────────────────────────────────
    grayscale: bool = True
    normalize: bool = False   # True → float32 in [0, 1]; False → uint8

    # ── temporal ─────────────────────────────────────────────────
    fps: Optional[float] = None     # None → preserve source FPS
    bbox_ema_alpha: float = 0.35    # used during Pass 1 scan only
    rotation_ema_alpha: float = 0.30

    # ── detection priming ────────────────────────────────────────
    max_init_scan_frames: int = 30

    # ── MediaPipe ────────────────────────────────────────────────
    face_mesh_confidence: float = 0.5

    # ── QC thresholds ────────────────────────────────────────────
    min_blur_score: float = 15.0
    min_exposure: float = 15.0
    max_exposure: float = 240.0
    max_yaw_deg: float = 45.0
    min_mouth_containment: float = 0.75   # slightly relaxed vs. per-frame version

    # Very light pre-sharpening applied ONLY for blur scoring.
    mild_sharpen_before_blur_check: bool = True
    sharpen_sigma: float = 1.0
    sharpen_amount: float = 0.20

    # Very light CLAHE applied ONLY for blur scoring.
    use_clahe_before_blur_check: bool = True
    clahe_clip_limit: float = 1.5
    clahe_tile_grid_size: int = 8

    # Per-video adaptive QC tuning from a short pre-scan.
    adaptive_qc_by_video: bool = True
    adaptive_scan_frames: int = 30

    # ── blur reuse fallback ───────────────────────────────────────
    reuse_last_good_crop_on_blur_qc: bool = True
    max_consecutive_reused_blur: int = 2

    # ── yaw reuse fallback ────────────────────────────────────────
    reuse_last_good_crop_on_yaw_qc: bool = True
    max_consecutive_reused_yaw: int = 2

    # ── generic QC reuse fallback ─────────────────────────────────
    reuse_last_good_crop_on_other_qc: bool = True
    max_consecutive_reused_qc: int = 2

    # ── gap interpolation ─────────────────────────────────────────
    max_gap_interpolate: int = 3

    # ── clip-level gate ───────────────────────────────────────────
    min_valid_frame_ratio: float = 0.30

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
        """Deterministic 12-char SHA-256 prefix of all config values."""
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
class StableCropInfo:
    """
    Computed once per video during Pass 1 and applied to every frame in Pass 2.
    Stored in metadata for diagnostics.
    """
    center_x: float
    center_y: float
    crop_percentile: float
    crop_width: float
    crop_height: float
    x1: int
    y1: int
    x2: int
    y2: int
    n_valid_frames: int
    mouth_width_p50: float
    mouth_width_pN: float
    mouth_height_p50: float
    mouth_height_pN: float
    center_x_std: float
    center_y_std: float
    border_pad_used: bool

    def to_dict(self) -> Dict:
        return {
            "center_x": round(self.center_x, 2),
            "center_y": round(self.center_y, 2),
            "crop_width": round(self.crop_width, 2),
            "crop_height": round(self.crop_height, 2),
            "bbox_x1": self.x1,
            "bbox_y1": self.y1,
            "bbox_x2": self.x2,
            "bbox_y2": self.y2,
            "n_valid_frames_pass1": self.n_valid_frames,
            "mouth_width_p50": round(self.mouth_width_p50, 2),
            f"mouth_width_p{int(self.crop_percentile)}": round(self.mouth_width_pN, 2),
            "mouth_height_p50": round(self.mouth_height_p50, 2),
            f"mouth_height_p{int(self.crop_percentile)}": round(self.mouth_height_pN, 2),
            "center_x_std_px": round(self.center_x_std, 2),
            "center_y_std_px": round(self.center_y_std, 2),
            "border_pad_used": self.border_pad_used,
        }


@dataclass
class ClipStats:
    total_frames: int = 0
    landmark_success: int = 0
    qc_pass: int = 0
    qc_fail: int = 0
    interpolated: int = 0
    reused_blur: int = 0
    kept_current_blur: int = 0
    max_reused_blur_streak: int = 0
    reused_yaw: int = 0
    kept_current_yaw: int = 0
    max_reused_yaw_streak: int = 0
    reused_qc: int = 0
    kept_current_qc: int = 0
    max_reused_qc_streak: int = 0
    dropped: int = 0
    border_touch: int = 0
    mean_blur: float = 0.0
    mean_confidence: float = 0.0

    @property
    def landmark_success_rate(self) -> float:
        return self.landmark_success / max(1, self.total_frames)

    @property
    def valid_frame_ratio(self) -> float:
        return (
            self.qc_pass + self.interpolated
            + self.reused_blur + self.kept_current_blur
            + self.reused_yaw + self.kept_current_yaw
            + self.reused_qc + self.kept_current_qc
        ) / max(1, self.total_frames)

    def to_dict(self) -> Dict:
        return {
            "total_frames": self.total_frames,
            "landmark_success_rate": round(self.landmark_success_rate, 4),
            "valid_frame_ratio": round(self.valid_frame_ratio, 4),
            "qc_pass": self.qc_pass,
            "qc_fail": self.qc_fail,
            "interpolated_frames": self.interpolated,
            "reused_blur_frames": self.reused_blur,
            "kept_current_blur_frames": self.kept_current_blur,
            "max_reused_blur_streak": self.max_reused_blur_streak,
            "reused_yaw_frames": self.reused_yaw,
            "kept_current_yaw_frames": self.kept_current_yaw,
            "max_reused_yaw_streak": self.max_reused_yaw_streak,
            "reused_qc_frames": self.reused_qc,
            "kept_current_qc_frames": self.kept_current_qc,
            "max_reused_qc_streak": self.max_reused_qc_streak,
            "dropped_frames": self.dropped,
            "border_touch_frames": self.border_touch,
            "mean_blur_score": round(self.mean_blur, 2),
            "mean_confidence": round(self.mean_confidence, 4),
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
        "reused_last_good_blur",
        "kept_current_blur_after_reuse_cap",
        "reused_last_good_yaw",
        "kept_current_yaw_after_reuse_cap",
        "reused_last_good_qc",
        "kept_current_qc_after_reuse_cap",
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
        for key in ("bbox_xywh", "blur_score", "exposure_mean",
                    "mouth_containment", "yaw_deg", "confidence"):
            if payload[key] is None:
                payload.pop(key)
        if not payload["reasons"]:
            payload.pop("reasons")
        return payload


# ─────────────────────────────────────────────────────────────────────────────
# EMA smoothers  (used during Pass 1 scan and yaw smoothing in Pass 2)
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
            value if self._state is None
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
            b if self._state is None
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
    )
    confidence = 1.0 if len(face.landmark) > _RIGHT_IRIS else 0.5
    return LandmarkResult(points=pts, confidence=confidence)


# ─────────────────────────────────────────────────────────────────────────────
# Face alignment — similarity transform
# ─────────────────────────────────────────────────────────────────────────────

def compute_alignment_transform(landmarks: LandmarkResult) -> Optional[np.ndarray]:
    """
    Compute the 2×3 similarity transform that maps detected eye positions
    to canonical positions in a fixed ALIGN_SIZE × ALIGN_SIZE space.
    """
    pts = landmarks.points
    n = len(pts)

    if n > _RIGHT_IRIS:
        left_eye, right_eye = pts[_LEFT_IRIS], pts[_RIGHT_IRIS]
    elif n > _RIGHT_EYE_OUTER:
        left_eye, right_eye = pts[_LEFT_EYE_OUTER], pts[_RIGHT_EYE_OUTER]
    else:
        log.debug("Landmark array too short for alignment")
        return None

    eye_dist = float(np.linalg.norm(right_eye - left_eye))
    if eye_dist < _MIN_EYE_DIST_PX:
        log.debug(f"Eye distance {eye_dist:.1f}px < {_MIN_EYE_DIST_PX} — face too small")
        return None

    src = np.array([left_eye, right_eye],          dtype=np.float32).reshape(-1, 1, 2)
    dst = np.array([_CANONICAL_LEFT_EYE, _CANONICAL_RIGHT_EYE],
                   dtype=np.float32).reshape(-1, 1, 2)

    M, _ = cv2.estimateAffinePartial2D(src, dst, method=cv2.LMEDS)
    return M   # (2, 3) ndarray or None


def apply_alignment(frame_bgr: np.ndarray, M: np.ndarray) -> np.ndarray:
    """Warp a BGR frame into the canonical ALIGN_SIZE × ALIGN_SIZE space."""
    return cv2.warpAffine(
        frame_bgr, M, (ALIGN_SIZE, ALIGN_SIZE),
        flags=cv2.INTER_LINEAR,
        borderMode=cv2.BORDER_REPLICATE,
    )


def transform_landmarks(pts: np.ndarray, M: np.ndarray) -> np.ndarray:
    """Apply a 2×3 affine matrix to an (N, 2) array of landmark points."""
    ones = np.ones((len(pts), 1), dtype=np.float32)
    pts_h = np.hstack([pts, ones])
    return (M @ pts_h.T).T.astype(np.float32)


def _interpolate_transform(M_a: np.ndarray, M_b: np.ndarray, t: float) -> np.ndarray:
    """
    Linearly interpolate between two 2×3 similarity transforms.
    t ∈ [0, 1]: t=0 → M_a, t=1 → M_b.
    """
    return (1.0 - t) * M_a + t * M_b


def estimate_yaw_degrees(landmarks: LandmarkResult) -> float:
    """Heuristic yaw estimate from nose-to-eye distance asymmetry."""
    pts = landmarks.points
    required = max(_LEFT_EYE_OUTER, _RIGHT_EYE_OUTER, _NOSE_TIP)
    if len(pts) <= required:
        return 0.0
    d_left  = float(np.linalg.norm(pts[_LEFT_EYE_OUTER]  - pts[_NOSE_TIP]))
    d_right = float(np.linalg.norm(pts[_RIGHT_EYE_OUTER] - pts[_NOSE_TIP]))
    total = d_left + d_right
    if total < 1e-6:
        return 0.0
    asymmetry = (d_right - d_left) / total
    return float(np.degrees(np.arcsin(np.clip(asymmetry, -1.0, 1.0))))


# ─────────────────────────────────────────────────────────────────────────────
# Raw mouth geometry  (used during Pass 1 scan)
# ─────────────────────────────────────────────────────────────────────────────

def _raw_mouth_geometry(
    aligned_pts: np.ndarray,
) -> Optional[Tuple[float, float, float, float]]:
    """
    Return (center_x, center_y, width, height) of the raw lip span
    (no padding) in aligned coordinates. Used for Pass 1 statistics.
    """
    if len(aligned_pts) <= max(MOUTH_LANDMARK_IDS):
        return None
    pts = aligned_pts[list(MOUTH_LANDMARK_IDS)]
    mx1, my1 = pts.min(axis=0)
    mx2, my2 = pts.max(axis=0)
    mw, mh = mx2 - mx1, my2 - my1
    if mw < 2 or mh < 2:
        return None
    return float((mx1 + mx2) * 0.5), float((my1 + my2) * 0.5), float(mw), float(mh)


def _bbox_to_xywh(bbox: Tuple[int, int, int, int]) -> Dict[str, int]:
    x1, y1, x2, y2 = bbox
    return {"x": int(x1), "y": int(y1), "w": int(x2 - x1), "h": int(y2 - y1)}


def _interpolate_bbox(
    a: Tuple[int, int, int, int],
    b: Tuple[int, int, int, int],
    t: float,
) -> Tuple[int, int, int, int]:
    arr = np.array(a, dtype=np.float64) * (1.0 - t) + np.array(b, dtype=np.float64) * t
    return tuple(arr.round().astype(int))  # type: ignore[return-value]


# ─────────────────────────────────────────────────────────────────────────────
# Stable crop computation  (Pass 1 → one box for the whole video)
# ─────────────────────────────────────────────────────────────────────────────

def compute_stable_crop(
    centers_x: List[float],
    centers_y: List[float],
    widths: List[float],
    heights: List[float],
    cfg: Config,
) -> Optional[StableCropInfo]:
    """
    Given per-frame mouth geometry from Pass 1, compute ONE stable crop box.

    Strategy:
      center = median(centers)          — robust to outlier frames
      size   = pN_span * (1 + 2 * padding_percent)
    """
    n = len(centers_x)
    if n < 2:
        log.warning("Pass 1 collected fewer than 2 valid frames — cannot compute stable crop")
        return None

    cx = float(np.median(centers_x))
    cy = float(np.median(centers_y))
    p  = float(np.clip(cfg.crop_percentile, 50.0, 100.0))

    w_p50 = float(np.percentile(widths,  50))
    h_p50 = float(np.percentile(heights, 50))
    w_pN  = float(np.percentile(widths,  p))
    h_pN  = float(np.percentile(heights, p))

    crop_w = max(w_pN * (1.0 + 2.0 * cfg.padding_percent_x), 24.0)
    crop_h = max(h_pN * (1.0 + 2.0 * cfg.padding_percent_y), 24.0)

    x1 = int(round(cx - crop_w * 0.5))
    y1 = int(round(cy - crop_h * 0.5))
    x2 = int(round(cx + crop_w * 0.5))
    y2 = int(round(cy + crop_h * 0.5))

    border_pad_used = (x1 < 0 or y1 < 0 or x2 > ALIGN_SIZE or y2 > ALIGN_SIZE)
    cx_std = float(np.std(centers_x))
    cy_std = float(np.std(centers_y))

    log.info(
        f"Stable crop: center=({cx:.1f},{cy:.1f}), "
        f"box={crop_w:.1f}×{crop_h:.1f}px, "
        f"bbox=({x1},{y1},{x2},{y2}), "
        f"padding=({cfg.padding_percent_x:.0%}x, {cfg.padding_percent_y:.0%}y), "
        f"border_pad={border_pad_used}, n={n}, "
        f"center_std=({cx_std:.1f},{cy_std:.1f})px"
    )

    return StableCropInfo(
        center_x=cx, center_y=cy,
        crop_percentile=p,
        crop_width=crop_w, crop_height=crop_h,
        x1=x1, y1=y1, x2=x2, y2=y2,
        n_valid_frames=n,
        mouth_width_p50=w_p50, mouth_width_pN=w_pN,
        mouth_height_p50=h_p50, mouth_height_pN=h_pN,
        center_x_std=cx_std, center_y_std=cy_std,
        border_pad_used=border_pad_used,
    )


# ─────────────────────────────────────────────────────────────────────────────
# Crop + resize using the stable box
# ─────────────────────────────────────────────────────────────────────────────

def crop_and_resize_stable(
    aligned_bgr: np.ndarray,
    stable: StableCropInfo,
    cfg: Config,
) -> np.ndarray:
    """
    Extract the stable mouth ROI and resize to cfg.output_size.
    Missing pixels at frame boundaries are filled with BORDER_REPLICATE.
    Always returns a 3-D (H, W, C) array.
    """
    ow, oh = cfg.output_size
    fh, fw = aligned_bgr.shape[:2]
    x1, y1, x2, y2 = stable.x1, stable.y1, stable.x2, stable.y2

    if x1 < 0 or y1 < 0 or x2 > fw or y2 > fh:
        pad_left   = max(0, -x1)
        pad_top    = max(0, -y1)
        pad_right  = max(0, x2 - fw)
        pad_bottom = max(0, y2 - fh)
        padded = cv2.copyMakeBorder(
            aligned_bgr,
            pad_top, pad_bottom, pad_left, pad_right,
            borderType=cv2.BORDER_REPLICATE,
        )
        sx1, sy1 = x1 + pad_left, y1 + pad_top
        sx2, sy2 = x2 + pad_left, y2 + pad_top
        crop = padded[sy1:sy2, sx1:sx2]
    else:
        crop = aligned_bgr[y1:y2, x1:x2]

    if crop.size == 0:
        c = 1 if cfg.grayscale else 3
        blank = np.zeros((oh, ow, c), dtype=np.uint8)
        return blank.astype(np.float32) / 255.0 if cfg.normalize else blank

    if cfg.grayscale:
        crop = cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY)[..., np.newaxis]

    out = cv2.resize(crop, (ow, oh), interpolation=cv2.INTER_LANCZOS4)
    if out.ndim == 2:
        out = out[..., np.newaxis]

    return out.astype(np.float32) / 255.0 if cfg.normalize else out


# Legacy per-frame crop — used only during the adaptive-QC pre-scan.
def _crop_for_qc_scan(
    aligned_bgr: np.ndarray,
    bbox: Tuple[int, int, int, int],
    cfg: Config,
) -> np.ndarray:
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
        crop = cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY)[..., np.newaxis]
    out = cv2.resize(crop, (ow, oh), interpolation=cv2.INTER_LANCZOS4)
    if out.ndim == 2:
        out = out[..., np.newaxis]
    return out.astype(np.float32) / 255.0 if cfg.normalize else out


# ─────────────────────────────────────────────────────────────────────────────
# Frame quality assessment
# ─────────────────────────────────────────────────────────────────────────────

def _laplacian_blur_score(gray: np.ndarray) -> float:
    return float(cv2.Laplacian(gray, cv2.CV_64F).var())


def _clahe_for_blur_score(crop_bgr: np.ndarray, cfg: Config) -> np.ndarray:
    if not cfg.use_clahe_before_blur_check or crop_bgr.size == 0:
        return crop_bgr
    clip_limit = max(0.1, float(cfg.clahe_clip_limit))
    tile = max(2, int(cfg.clahe_tile_grid_size))
    clahe = cv2.createCLAHE(clipLimit=clip_limit, tileGridSize=(tile, tile))
    lab = cv2.cvtColor(crop_bgr, cv2.COLOR_BGR2LAB)
    l, a, b = cv2.split(lab)
    lab_eq = cv2.merge((clahe.apply(l), a, b))
    return cv2.cvtColor(lab_eq, cv2.COLOR_LAB2BGR)


def _mild_sharpen_for_blur_score(crop_bgr: np.ndarray, cfg: Config) -> np.ndarray:
    if crop_bgr.size == 0:
        return crop_bgr
    proxy = _clahe_for_blur_score(crop_bgr, cfg)
    if not cfg.mild_sharpen_before_blur_check:
        return proxy
    sigma  = max(0.01, float(cfg.sharpen_sigma))
    amount = max(0.0,  float(cfg.sharpen_amount))
    blurred = cv2.GaussianBlur(proxy, (0, 0), sigmaX=sigma, sigmaY=sigma)
    return cv2.addWeighted(proxy, 1.0 + amount, blurred, -amount, 0)


def _is_blur_only_qc_failure(qc: FrameQC) -> bool:
    return (not qc.is_valid) and bool(qc.reasons) and all(r.startswith("blur=") for r in qc.reasons)


def assess_frame_quality(
    crop_bgr: np.ndarray,
    aligned_pts: np.ndarray,
    stable: StableCropInfo,
    cfg: Config,
) -> FrameQC:
    """
    Evaluate a mouth-region crop for quality.
    Containment is checked against the stable box so minor landmark
    drift does not trigger false failures.
    """
    if crop_bgr.size == 0:
        return FrameQC(False, 0.0, 0.0, 0.0, ["empty_crop"])

    blur_crop = _mild_sharpen_for_blur_score(crop_bgr, cfg)
    gray_blur = cv2.cvtColor(blur_crop, cv2.COLOR_BGR2GRAY)
    blur = _laplacian_blur_score(gray_blur)

    gray = cv2.cvtColor(crop_bgr, cv2.COLOR_BGR2GRAY)
    exp  = float(gray.mean())

    x1, y1, x2, y2 = stable.x1, stable.y1, stable.x2, stable.y2
    mouth_pts = aligned_pts[list(MOUTH_LANDMARK_IDS)]
    inside = (
        (mouth_pts[:, 0] >= x1) & (mouth_pts[:, 0] <= x2) &
        (mouth_pts[:, 1] >= y1) & (mouth_pts[:, 1] <= y2)
    )
    containment = float(inside.mean())

    reasons: List[str] = []
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
# Augmentation
# ─────────────────────────────────────────────────────────────────────────────

def _augment_frame(frame: np.ndarray, cfg: Config) -> np.ndarray:
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
    """
    Encode processed frames to H.264 MP4 via ffmpeg raw-pipe.
    Falls back to cv2.VideoWriter if ffmpeg is unavailable.
    """
    ow, oh = cfg.output_size

    cmd = [
        "ffmpeg", "-y",
        "-f", "rawvideo",
        "-vcodec", "rawvideo",
        "-s", f"{ow}x{oh}",
        "-pix_fmt", "bgr24",
        "-r", str(fps),
        "-i", "pipe:0",
        "-c:v", "libx264",
        "-crf", "18",
        "-preset", "slow",
        "-pix_fmt", "yuv420p",
        "-movflags", "+faststart",
        str(path),
    ]

    def _to_bgr24(f: np.ndarray) -> np.ndarray:
        img = f
        if img.dtype != np.uint8:
            img = (img * 255.0).clip(0, 255).astype(np.uint8)
        if img.ndim == 3 and img.shape[2] == 1:
            img = img[..., 0]
        if img.ndim == 2:
            img = cv2.cvtColor(img, cv2.COLOR_GRAY2BGR)
        return img

    try:
        process = subprocess.Popen(
            cmd,
            stdin=subprocess.PIPE,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.PIPE,
        )
        _, stderr_data = process.communicate(
            input=b"".join(_to_bgr24(f).tobytes() for f in frames)
        )
        if process.returncode != 0:
            log.error(f"ffmpeg failed: {stderr_data.decode()[:300]}")
            path.unlink(missing_ok=True)
            return False
        return True

    except FileNotFoundError:
        log.warning("ffmpeg not found — falling back to cv2.VideoWriter (lower quality)")
        is_color = not cfg.grayscale
        fourcc = cv2.VideoWriter_fourcc(*"mp4v")
        writer = cv2.VideoWriter(str(path), fourcc, fps, (ow, oh), isColor=is_color)
        if not writer.isOpened():
            log.error(f"cv2.VideoWriter failed to open: {path}")
            return False
        try:
            for f in frames:
                img = _to_bgr24(f)
                if not is_color:
                    img = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
                writer.write(img)
        finally:
            writer.release()
        return True

    except Exception as e:
        log.error(f"ffmpeg pipe error: {e}")
        return False


def _mux_audio(source: Path, roi: Path) -> Path:
    """
    Mux audio track from source into the silent roi video using ffmpeg.
    Returns roi unchanged if ffmpeg is unavailable or fails.
    """
    out = roi.with_name(f"{roi.stem}_a.mp4")
    cmd = [
        "ffmpeg", "-y",
        "-i", str(roi),
        "-i", str(source),
        "-map", "0:v:0",
        "-map", "1:a:0?",
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
        log.warning(f"ffmpeg mux failed: {exc.stderr.decode()[:200]}")
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
    stable_crop: Optional[StableCropInfo] = None,
    adaptive_qc_details: Optional[Dict[str, float]] = None,
) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)

    def _mask(status: str) -> List[int]:
        return [1 if r.status == status else 0 for r in frame_records]

    payload = {
        "config_hash": cfg.config_hash(),
        "fps": out_fps,
        "source_frame_count": source_frame_count,
        "output_frame_count": output_frame_count,
        "stats": stats.to_dict(),
        "stable_crop": stable_crop.to_dict() if stable_crop else None,
        "adaptive_qc": adaptive_qc_details or {},
        "sequence_masks": {
            "sequence_mask":          [1 if r.is_sequence_frame else 0 for r in frame_records],
            "observed_mask":          _mask("valid"),
            "interpolated_mask":      _mask("interpolated"),
            "reused_blur_mask":       _mask("reused_last_good_blur"),
            "kept_current_blur_mask": _mask("kept_current_blur_after_reuse_cap"),
            "reused_yaw_mask":        _mask("reused_last_good_yaw"),
            "kept_current_yaw_mask":  _mask("kept_current_yaw_after_reuse_cap"),
            "reused_qc_mask":         _mask("reused_last_good_qc"),
            "kept_current_qc_mask":   _mask("kept_current_qc_after_reuse_cap"),
        },
        "frames": [r.to_dict() for r in frame_records],
    }

    with path.open("w", encoding="utf-8") as f:
        json.dump(payload, f, indent=2)


def _make_face_mesh(
    cfg: Config,
    *,
    static_image_mode: bool = False,
) -> mp.solutions.face_mesh.FaceMesh:
    """
    Construct a FaceMesh instance.
    Use static_image_mode=True for random-access pre-scans.
    Use static_image_mode=False (default) for sequential tracking.
    """
    return mp.solutions.face_mesh.FaceMesh(
        static_image_mode=static_image_mode,
        max_num_faces=1,
        refine_landmarks=True,
        min_detection_confidence=cfg.face_mesh_confidence,
        min_tracking_confidence=cfg.face_mesh_confidence,
    )


def _raw_crop_metrics(crop_bgr: np.ndarray) -> Tuple[float, float]:
    if crop_bgr.size == 0:
        return 0.0, 0.0
    gray = cv2.cvtColor(crop_bgr, cv2.COLOR_BGR2GRAY)
    return _laplacian_blur_score(gray), float(gray.mean())


def _clamp(value: float, lo: float, hi: float) -> float:
    return float(max(lo, min(hi, value)))


# ─────────────────────────────────────────────────────────────────────────────
# Adaptive QC pre-scan  (random-access, before Pass 1)
# ─────────────────────────────────────────────────────────────────────────────

def _resolve_video_adaptive_qc(
    input_path: Path,
    cfg: Config,
) -> Tuple[Config, Dict[str, float]]:
    """
    Derive per-video QC parameters from a short random-access pre-scan.
    Resolves stable values for min_blur_score, sharpen_amount, clahe_clip_limit
    so behaviour is consistent across the whole clip.
    """
    details: Dict[str, float] = {
        "adaptive_qc_enabled": float(bool(cfg.adaptive_qc_by_video)),
        "sampled_frames": 0.0,
        "raw_mean_blur": 0.0,
        "raw_mean_exposure": 0.0,
        "resolved_min_blur_score": float(cfg.min_blur_score),
        "resolved_sharpen_amount": float(cfg.sharpen_amount),
        "resolved_clahe_clip_limit": float(cfg.clahe_clip_limit),
    }

    if not cfg.adaptive_qc_by_video or cfg.adaptive_scan_frames <= 0:
        return cfg, details

    cap = cv2.VideoCapture(str(input_path))
    if not cap.isOpened():
        return cfg, details

    total_raw = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    if total_raw <= 0:
        cap.release()
        return cfg, details

    n_samples = min(int(cfg.adaptive_scan_frames), total_raw)
    sample_indices = np.linspace(0, max(total_raw - 1, 0), num=n_samples, dtype=int)

    blur_values: List[float] = []
    exposure_values: List[float] = []
    face_mesh = _make_face_mesh(cfg, static_image_mode=True)

    try:
        for idx in sample_indices.tolist():
            cap.set(cv2.CAP_PROP_POS_FRAMES, idx)
            ret, frame = cap.read()
            if not ret:
                continue
            lm = extract_landmarks(frame, face_mesh)
            if lm is None:
                continue
            M = compute_alignment_transform(lm)
            if M is None:
                continue
            aligned = apply_alignment(frame, M)
            pts_aligned = transform_landmarks(lm.points, M)
            geom = _raw_mouth_geometry(pts_aligned)
            if geom is None:
                continue
            cx, cy, mw, mh = geom
            # Build a quick padded bbox for metric extraction only
            x1 = int(max(0, cx - mw * (0.5 + cfg.padding_percent_x)))
            y1 = int(max(0, cy - mh * (0.5 + cfg.padding_percent_y)))
            x2 = int(min(ALIGN_SIZE, cx + mw * (0.5 + cfg.padding_percent_x)))
            y2 = int(min(ALIGN_SIZE, cy + mh * (0.5 + cfg.padding_percent_y)))
            crop_bgr = aligned[y1:y2, x1:x2]
            if crop_bgr.size == 0:
                continue
            blur, exposure = _raw_crop_metrics(crop_bgr)
            blur_values.append(float(blur))
            exposure_values.append(float(exposure))
    finally:
        cap.release()
        face_mesh.close()

    if not blur_values:
        return cfg, details

    mean_blur     = float(np.mean(blur_values))
    mean_exposure = float(np.mean(exposure_values))

    softness   = max(0.0, (25.0 - mean_blur)     / 15.0)
    sharpness  = max(0.0, (mean_blur - 45.0)      / 25.0)
    darkness   = max(0.0, (110.0 - mean_exposure) / 50.0)
    brightness = max(0.0, (mean_exposure - 170.0) / 60.0)

    resolved_sharpen_amount   = _clamp(cfg.sharpen_amount   + 0.10 * softness  - 0.08 * sharpness,  0.10, 0.30)
    resolved_min_blur_score   = _clamp(cfg.min_blur_score   - 3.0  * softness  + 2.0  * sharpness, 12.0, 18.0)
    resolved_clahe_clip_limit = _clamp(cfg.clahe_clip_limit + 0.40 * darkness  - 0.30 * brightness,  1.0,  1.8)

    effective_cfg = replace(
        cfg,
        sharpen_amount=resolved_sharpen_amount,
        min_blur_score=resolved_min_blur_score,
        clahe_clip_limit=resolved_clahe_clip_limit,
    )

    details.update({
        "sampled_frames":           float(len(blur_values)),
        "raw_mean_blur":            round(mean_blur, 3),
        "raw_mean_exposure":        round(mean_exposure, 3),
        "resolved_min_blur_score":  round(resolved_min_blur_score, 3),
        "resolved_sharpen_amount":  round(resolved_sharpen_amount, 3),
        "resolved_clahe_clip_limit": round(resolved_clahe_clip_limit, 3),
    })
    return effective_cfg, details


# ─────────────────────────────────────────────────────────────────────────────
# Pass 1: scan valid frames and collect mouth geometry statistics
# ─────────────────────────────────────────────────────────────────────────────

def _pass1_scan(
    input_path: Path,
    cfg: Config,
    face_mesh: mp.solutions.face_mesh.FaceMesh,
) -> Optional[StableCropInfo]:
    """
    Sequential Pass 1: read every frame, run alignment, collect raw mouth
    center and span measurements from aligned landmark coordinates.

    Returns a StableCropInfo (the fixed crop box for Pass 2) or None if
    insufficient valid frames were found.
    """
    cap = cv2.VideoCapture(str(input_path))
    if not cap.isOpened():
        return None

    centers_x: List[float] = []
    centers_y: List[float] = []
    widths:    List[float] = []
    heights:   List[float] = []

    try:
        while True:
            ret, frame = cap.read()
            if not ret:
                break
            lm = extract_landmarks(frame, face_mesh)
            if lm is None:
                continue
            # Exclude extreme yaw — don't let profile frames bias the crop centre.
            if abs(estimate_yaw_degrees(lm)) > cfg.max_yaw_deg:
                continue
            M = compute_alignment_transform(lm)
            if M is None:
                continue
            pts_aligned = transform_landmarks(lm.points, M)
            geom = _raw_mouth_geometry(pts_aligned)
            if geom is None:
                continue
            cx, cy, mw, mh = geom
            centers_x.append(cx)
            centers_y.append(cy)
            widths.append(mw)
            heights.append(mh)
    finally:
        cap.release()

    log.info(f"Pass 1 collected {len(centers_x)} valid mouth measurements")
    if not centers_x:
        return None

    return compute_stable_crop(centers_x, centers_y, widths, heights, cfg)


# ─────────────────────────────────────────────────────────────────────────────
# Main pipeline
# ─────────────────────────────────────────────────────────────────────────────

def process_video(
    input_path: Path,
    output_video_path: Path,
    preview_image_path: Path,
    metadata_path: Path,
    cfg: Config,
    progress_callback: Optional[Callable[[int, str], None]] = None,
) -> dict:
    """
    Full mouth-crop pipeline for a single video.

    Two-pass approach
    ─────────────────
    Pass 1 — sequential scan with a static FaceMesh to collect per-frame
      mouth center, width, and height in aligned coordinates.  One stable
      crop box is computed from those statistics:
        crop_w = p95_lip_width  * (1 + 2 * padding_percent_x)
        crop_h = p95_lip_height * (1 + 2 * padding_percent_y)

    Pass 2 — sequential processing with a tracking FaceMesh.
      Every frame is aligned and then cropped with the SAME fixed box.
      BORDER_REPLICATE padding handles corners outside the aligned frame,
      eliminating black borders.

    All other logic (yaw gating, blur QC, yaw/blur/generic reuse fallbacks,
    gap interpolation with M-interpolation, metadata) is preserved.

    Returns
    ───────
    dict with roi_video_path, preview_image_path, metadata_path, fps,
    frame_count, config_hash, roi_coords, stable_crop, and per-clip stats.

    Raises
    ──────
    RuntimeError on unrecoverable failure.
    """
    effective_cfg, adaptive_qc_details = _resolve_video_adaptive_qc(input_path, cfg)

    def report(progress: int, message: str) -> None:
        if progress_callback is not None:
            progress_callback(progress, message)

    # ── Pass 1 ───────────────────────────────────────────────────────────────
    report(2, "Pass 1: scanning mouth geometry...")
    pass1_mesh = _make_face_mesh(effective_cfg, static_image_mode=True)
    stable_crop = _pass1_scan(input_path, effective_cfg, pass1_mesh)
    pass1_mesh.close()

    if stable_crop is None:
        raise RuntimeError(
            "Pass 1 failed to collect enough valid frames to compute a stable crop box. "
            "Check that the face is visible and not too far away."
        )

    report(15, "Stable crop computed. Starting Pass 2...")

    # ── Pass 2 setup ─────────────────────────────────────────────────────────
    cap = cv2.VideoCapture(str(input_path))
    if not cap.isOpened():
        raise RuntimeError(f"Cannot open video: {input_path.name}")

    src_fps: float   = cap.get(cv2.CAP_PROP_FPS) or 25.0
    out_fps: float   = effective_cfg.fps if effective_cfg.fps else src_fps
    total_raw: int   = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))

    log.info(
        f"Adaptive QC — samples={int(adaptive_qc_details.get('sampled_frames', 0))}, "
        f"raw_blur={adaptive_qc_details.get('raw_mean_blur', 0.0):.1f}, "
        f"raw_exp={adaptive_qc_details.get('raw_mean_exposure', 0.0):.1f}, "
        f"blur_thresh={adaptive_qc_details.get('resolved_min_blur_score', effective_cfg.min_blur_score):.1f}, "
        f"sharpen={adaptive_qc_details.get('resolved_sharpen_amount', effective_cfg.sharpen_amount):.2f}, "
        f"clahe={adaptive_qc_details.get('resolved_clahe_clip_limit', effective_cfg.clahe_clip_limit):.2f}"
    )
    log.info(f"Input: {input_path.name} — {total_raw} frames @ {src_fps:.1f} fps")

    # Prime tracking FaceMesh
    face_mesh = _make_face_mesh(effective_cfg)
    primed = False

    for _ in range(effective_cfg.max_init_scan_frames):
        ret, frame = cap.read()
        if not ret:
            break
        lm = extract_landmarks(frame, face_mesh)
        if lm is None:
            continue
        M = compute_alignment_transform(lm)
        if M is None:
            continue
        pts_a = transform_landmarks(lm.points, M)
        if _raw_mouth_geometry(pts_a) is not None:
            primed = True
            report(20, "Face detected. Starting crop extraction...")
            log.info(
                f"Face primed — yaw ≈ {estimate_yaw_degrees(lm):.1f}°, "
                f"eye_conf ≈ {lm.confidence:.2f}"
            )
            break

    face_mesh.close()

    if not primed:
        cap.release()
        raise RuntimeError(
            f"No detectable face found in the first {effective_cfg.max_init_scan_frames} frames"
        )

    cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
    face_mesh = _make_face_mesh(effective_cfg)

    stats = ClipStats()
    yaw_smoother = ScalarSmoother(alpha=effective_cfg.rotation_ema_alpha)

    stable_bbox: Tuple[int, int, int, int] = (
        stable_crop.x1, stable_crop.y1,
        stable_crop.x2, stable_crop.y2,
    )
    stable_center: Tuple[float, float] = (stable_crop.center_x, stable_crop.center_y)

    processed_frames: List[np.ndarray]               = []
    bbox_centers:     List[Tuple[float, float]]       = []
    frame_records:    List[FrameRecord]               = []

    last_good_tensor:       Optional[np.ndarray]           = None
    last_good_bbox_center:  Optional[Tuple[float, float]]  = None
    consecutive_reused_blur = 0
    consecutive_reused_yaw  = 0
    consecutive_reused_qc   = 0

    gap_buffer:        List[Tuple[int, np.ndarray]] = []
    last_committed_M:  Optional[np.ndarray]          = None

    blur_history: List[float] = []
    conf_history: List[float] = []

    frame_idx            = 0
    last_reported_progress = 20

    try:
        while True:
            ret, frame = cap.read()
            if not ret:
                break
            stats.total_frames += 1

            if total_raw > 0:
                progress = 20 + int((stats.total_frames / total_raw) * 75)
                if progress > last_reported_progress:
                    last_reported_progress = progress
                    report(progress, f"Processing frame {stats.total_frames}/{total_raw}...")

            lm = extract_landmarks(frame, face_mesh)

            # ── no landmarks ──────────────────────────────────────────────
            if lm is None:
                if last_committed_M is not None:
                    gap_buffer.append((frame_idx, frame.copy()))
                    if len(gap_buffer) > effective_cfg.max_gap_interpolate:
                        log.debug(f"Gap too long ({len(gap_buffer)} frames) — dropping")
                        for gap_idx, _ in gap_buffer:
                            frame_records.append(FrameRecord(
                                source_frame_idx=gap_idx,
                                status="dropped_gap_too_long",
                                reasons=["landmark_gap_exceeded_interpolation_budget"],
                            ))
                        stats.dropped += len(gap_buffer)
                        gap_buffer.clear()
                        last_committed_M = None
                        consecutive_reused_blur = consecutive_reused_yaw = consecutive_reused_qc = 0
                else:
                    frame_records.append(FrameRecord(
                        source_frame_idx=frame_idx,
                        status="dropped_no_landmarks",
                        reasons=["no_landmarks"],
                    ))
                    stats.dropped += 1
                consecutive_reused_blur = consecutive_reused_yaw = consecutive_reused_qc = 0
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
                consecutive_reused_blur = consecutive_reused_yaw = consecutive_reused_qc = 0
                frame_idx += 1
                continue

            aligned     = apply_alignment(frame, M)
            pts_aligned = transform_landmarks(lm.points, M)

            if _raw_mouth_geometry(pts_aligned) is None:
                frame_records.append(FrameRecord(
                    source_frame_idx=frame_idx,
                    status="dropped_bbox_failed",
                    yaw_deg=round(smoothed_yaw, 3),
                    confidence=round(lm.confidence, 4),
                    reasons=["mouth_geometry_failed"],
                ))
                stats.dropped += 1
                consecutive_reused_blur = consecutive_reused_yaw = consecutive_reused_qc = 0
                frame_idx += 1
                continue

            # ── gap interpolation (with M interpolation) ──────────────────
            if gap_buffer:
                n = len(gap_buffer)
                if last_committed_M is not None and n <= effective_cfg.max_gap_interpolate:
                    for gi, (gap_idx, gap_frame) in enumerate(gap_buffer):
                        t = (gi + 1) / (n + 1)
                        interp_M      = _interpolate_transform(last_committed_M, M, t)
                        gap_aligned   = apply_alignment(gap_frame, interp_M)
                        tensor        = crop_and_resize_stable(gap_aligned, stable_crop, effective_cfg)
                        tensor        = _augment_frame(tensor, effective_cfg)
                        out_fi        = len(processed_frames)
                        processed_frames.append(tensor)
                        bbox_centers.append(stable_center)
                        last_good_tensor      = tensor.copy()
                        last_good_bbox_center = stable_center
                        consecutive_reused_blur = consecutive_reused_yaw = consecutive_reused_qc = 0
                        frame_records.append(FrameRecord(
                            source_frame_idx=gap_idx,
                            status="interpolated",
                            output_frame_idx=out_fi,
                            is_sequence_frame=True,
                            is_interpolated=True,
                            bbox_xywh=_bbox_to_xywh(stable_bbox),
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

            # ── yaw gate ──────────────────────────────────────────────────
            if abs(smoothed_yaw) > effective_cfg.max_yaw_deg:
                log.debug(f"Frame {frame_idx}: yaw={smoothed_yaw:.1f}° exceeds limit")

                if (
                    effective_cfg.reuse_last_good_crop_on_yaw_qc
                    and last_good_tensor is not None
                ):
                    if consecutive_reused_yaw < effective_cfg.max_consecutive_reused_yaw:
                        out_fi = len(processed_frames)
                        processed_frames.append(last_good_tensor.copy())
                        bbox_centers.append(stable_center)
                        frame_records.append(FrameRecord(
                            source_frame_idx=frame_idx,
                            status="reused_last_good_yaw",
                            output_frame_idx=out_fi,
                            is_sequence_frame=True,
                            bbox_xywh=_bbox_to_xywh(stable_bbox),
                            yaw_deg=round(smoothed_yaw, 3),
                            confidence=round(lm.confidence, 4),
                            reasons=[f"yaw={smoothed_yaw:.1f}>{effective_cfg.max_yaw_deg}",
                                     "reused_last_good_crop"],
                        ))
                        stats.reused_yaw += 1
                        consecutive_reused_yaw += 1
                        stats.max_reused_yaw_streak = max(
                            stats.max_reused_yaw_streak, consecutive_reused_yaw)
                        consecutive_reused_blur = consecutive_reused_qc = 0
                        frame_idx += 1
                        continue

                    # Reuse cap reached — keep current real crop
                    tensor = crop_and_resize_stable(aligned, stable_crop, effective_cfg)
                    tensor = _augment_frame(tensor, effective_cfg)
                    out_fi = len(processed_frames)
                    processed_frames.append(tensor)
                    bbox_centers.append(stable_center)
                    last_good_tensor = tensor.copy()
                    last_good_bbox_center = stable_center
                    consecutive_reused_yaw = consecutive_reused_blur = consecutive_reused_qc = 0
                    frame_records.append(FrameRecord(
                        source_frame_idx=frame_idx,
                        status="kept_current_yaw_after_reuse_cap",
                        output_frame_idx=out_fi,
                        is_sequence_frame=True,
                        bbox_xywh=_bbox_to_xywh(stable_bbox),
                        yaw_deg=round(smoothed_yaw, 3),
                        confidence=round(lm.confidence, 4),
                        reasons=[f"yaw={smoothed_yaw:.1f}>{effective_cfg.max_yaw_deg}",
                                 "reuse_cap_reached_kept_current_crop"],
                    ))
                    stats.kept_current_yaw += 1
                    last_committed_M = M
                    frame_idx += 1
                    continue

                # No reuse configured
                frame_records.append(FrameRecord(
                    source_frame_idx=frame_idx,
                    status="dropped_pose",
                    yaw_deg=round(smoothed_yaw, 3),
                    confidence=round(lm.confidence, 4),
                    bbox_xywh=_bbox_to_xywh(stable_bbox),
                    reasons=[f"yaw={smoothed_yaw:.1f}>{effective_cfg.max_yaw_deg}"],
                ))
                stats.qc_fail += 1
                consecutive_reused_blur = consecutive_reused_yaw = consecutive_reused_qc = 0
                frame_idx += 1
                continue

            # ── extract crop from stable box ──────────────────────────────
            needs_pad = (
                stable_crop.x1 < 0 or stable_crop.y1 < 0 or
                stable_crop.x2 > aligned.shape[1] or stable_crop.y2 > aligned.shape[0]
            )
            if needs_pad:
                stats.border_touch += 1

            cx1 = max(0, stable_crop.x1)
            cy1 = max(0, stable_crop.y1)
            cx2 = min(ALIGN_SIZE, stable_crop.x2)
            cy2 = min(ALIGN_SIZE, stable_crop.y2)
            crop_bgr = aligned[cy1:cy2, cx1:cx2]

            qc = assess_frame_quality(crop_bgr, pts_aligned, stable_crop, effective_cfg)

            if not qc.is_valid:
                blur_only = _is_blur_only_qc_failure(qc)

                # ── blur-only reuse ───────────────────────────────────────
                if (
                    effective_cfg.reuse_last_good_crop_on_blur_qc
                    and blur_only
                    and last_good_tensor is not None
                ):
                    if consecutive_reused_blur < effective_cfg.max_consecutive_reused_blur:
                        out_fi = len(processed_frames)
                        processed_frames.append(last_good_tensor.copy())
                        bbox_centers.append(stable_center)
                        frame_records.append(FrameRecord(
                            source_frame_idx=frame_idx,
                            status="reused_last_good_blur",
                            output_frame_idx=out_fi,
                            is_sequence_frame=True,
                            bbox_xywh=_bbox_to_xywh(stable_bbox),
                            blur_score=round(qc.blur_score, 3),
                            exposure_mean=round(qc.exposure_mean, 3),
                            mouth_containment=round(qc.mouth_containment, 4),
                            yaw_deg=round(smoothed_yaw, 3),
                            confidence=round(lm.confidence, 4),
                            reasons=qc.reasons + ["reused_last_good_crop"],
                        ))
                        stats.reused_blur += 1
                        consecutive_reused_blur += 1
                        stats.max_reused_blur_streak = max(
                            stats.max_reused_blur_streak, consecutive_reused_blur)
                        frame_idx += 1
                        continue

                    # Cap reached — keep current blurry crop
                    tensor = crop_and_resize_stable(aligned, stable_crop, effective_cfg)
                    tensor = _augment_frame(tensor, effective_cfg)
                    out_fi = len(processed_frames)
                    processed_frames.append(tensor)
                    bbox_centers.append(stable_center)
                    last_good_tensor      = tensor.copy()
                    last_good_bbox_center = stable_center
                    consecutive_reused_blur = 0
                    frame_records.append(FrameRecord(
                        source_frame_idx=frame_idx,
                        status="kept_current_blur_after_reuse_cap",
                        output_frame_idx=out_fi,
                        is_sequence_frame=True,
                        bbox_xywh=_bbox_to_xywh(stable_bbox),
                        blur_score=round(qc.blur_score, 3),
                        exposure_mean=round(qc.exposure_mean, 3),
                        mouth_containment=round(qc.mouth_containment, 4),
                        yaw_deg=round(smoothed_yaw, 3),
                        confidence=round(lm.confidence, 4),
                        reasons=qc.reasons + ["reuse_cap_reached_kept_current_blurry_crop"],
                    ))
                    stats.kept_current_blur += 1
                    last_committed_M = M
                    frame_idx += 1
                    continue

                # ── generic (non-blur) QC reuse ───────────────────────────
                if (
                    effective_cfg.reuse_last_good_crop_on_other_qc
                    and not blur_only
                    and last_good_tensor is not None
                ):
                    if consecutive_reused_qc < effective_cfg.max_consecutive_reused_qc:
                        out_fi = len(processed_frames)
                        processed_frames.append(last_good_tensor.copy())
                        bbox_centers.append(stable_center)
                        frame_records.append(FrameRecord(
                            source_frame_idx=frame_idx,
                            status="reused_last_good_qc",
                            output_frame_idx=out_fi,
                            is_sequence_frame=True,
                            bbox_xywh=_bbox_to_xywh(stable_bbox),
                            blur_score=round(qc.blur_score, 3),
                            exposure_mean=round(qc.exposure_mean, 3),
                            mouth_containment=round(qc.mouth_containment, 4),
                            yaw_deg=round(smoothed_yaw, 3),
                            confidence=round(lm.confidence, 4),
                            reasons=qc.reasons + ["reused_last_good_crop"],
                        ))
                        stats.reused_qc += 1
                        consecutive_reused_qc += 1
                        stats.max_reused_qc_streak = max(
                            stats.max_reused_qc_streak, consecutive_reused_qc)
                        consecutive_reused_blur = 0
                        frame_idx += 1
                        continue

                    # Cap reached — keep current crop
                    tensor = crop_and_resize_stable(aligned, stable_crop, effective_cfg)
                    tensor = _augment_frame(tensor, effective_cfg)
                    out_fi = len(processed_frames)
                    processed_frames.append(tensor)
                    bbox_centers.append(stable_center)
                    last_good_tensor      = tensor.copy()
                    last_good_bbox_center = stable_center
                    consecutive_reused_qc  = consecutive_reused_blur = 0
                    frame_records.append(FrameRecord(
                        source_frame_idx=frame_idx,
                        status="kept_current_qc_after_reuse_cap",
                        output_frame_idx=out_fi,
                        is_sequence_frame=True,
                        bbox_xywh=_bbox_to_xywh(stable_bbox),
                        blur_score=round(qc.blur_score, 3),
                        exposure_mean=round(qc.exposure_mean, 3),
                        mouth_containment=round(qc.mouth_containment, 4),
                        yaw_deg=round(smoothed_yaw, 3),
                        confidence=round(lm.confidence, 4),
                        reasons=qc.reasons + ["reuse_cap_reached_kept_current_crop"],
                    ))
                    stats.kept_current_qc += 1
                    last_committed_M = M
                    frame_idx += 1
                    continue

                # Hard drop
                log.debug(f"Frame {frame_idx}: QC fail — {qc.reasons}")
                frame_records.append(FrameRecord(
                    source_frame_idx=frame_idx,
                    status="dropped_qc",
                    yaw_deg=round(smoothed_yaw, 3),
                    confidence=round(lm.confidence, 4),
                    bbox_xywh=_bbox_to_xywh(stable_bbox),
                    blur_score=round(qc.blur_score, 3),
                    exposure_mean=round(qc.exposure_mean, 3),
                    mouth_containment=round(qc.mouth_containment, 4),
                    reasons=qc.reasons,
                ))
                stats.qc_fail += 1
                consecutive_reused_blur = consecutive_reused_yaw = consecutive_reused_qc = 0
                frame_idx += 1
                continue

            # ── QC pass ───────────────────────────────────────────────────
            blur_history.append(qc.blur_score)
            stats.qc_pass += 1

            tensor = crop_and_resize_stable(aligned, stable_crop, effective_cfg)
            tensor = _augment_frame(tensor, effective_cfg)
            out_fi = len(processed_frames)
            processed_frames.append(tensor)
            bbox_centers.append(stable_center)
            last_good_tensor      = tensor.copy()
            last_good_bbox_center = stable_center
            consecutive_reused_blur = consecutive_reused_yaw = consecutive_reused_qc = 0

            frame_records.append(FrameRecord(
                source_frame_idx=frame_idx,
                status="valid",
                output_frame_idx=out_fi,
                is_sequence_frame=True,
                bbox_xywh=_bbox_to_xywh(stable_bbox),
                blur_score=round(qc.blur_score, 3),
                exposure_mean=round(qc.exposure_mean, 3),
                mouth_containment=round(qc.mouth_containment, 4),
                yaw_deg=round(smoothed_yaw, 3),
                confidence=round(lm.confidence, 4),
            ))
            last_committed_M = M
            frame_idx += 1

    finally:
        cap.release()
        face_mesh.close()

    # Flush any trailing gap that never recovered
    if gap_buffer:
        for gap_idx, _ in gap_buffer:
            frame_records.append(FrameRecord(
                source_frame_idx=gap_idx,
                status="dropped_gap_too_long",
                reasons=["trailing_landmark_gap_without_recovery"],
            ))
        stats.dropped += len(gap_buffer)
        gap_buffer.clear()

    frame_records.sort(key=lambda r: r.source_frame_idx)

    report(96, "Finalizing outputs...")

    stats.mean_blur       = float(np.mean(blur_history)) if blur_history else 0.0
    stats.mean_confidence = float(np.mean(conf_history)) if conf_history else 0.0

    log.info(
        f"Pass 2 complete — valid={stats.qc_pass}/{stats.total_frames} "
        f"({stats.valid_frame_ratio:.1%}), "
        f"interp={stats.interpolated}, dropped={stats.dropped}, "
        f"blur={stats.mean_blur:.1f}"
    )

    if stats.valid_frame_ratio < effective_cfg.min_valid_frame_ratio:
        raise RuntimeError(
            f"Clip rejected — only {stats.valid_frame_ratio:.1%} valid frames "
            f"(minimum {effective_cfg.min_valid_frame_ratio:.1%}). "
            f"landmark_rate={stats.landmark_success_rate:.1%}, "
            f"mean_blur={stats.mean_blur:.1f}"
        )

    if not processed_frames:
        raise RuntimeError("No frames remain after quality control")

    output_video_path.parent.mkdir(parents=True, exist_ok=True)
    silent_path = output_video_path.with_suffix(".mp4")

    if not _save_video(processed_frames, silent_path, out_fps, effective_cfg):
        raise RuntimeError("Failed to write ROI video")

    muxed_path = _mux_audio(input_path, silent_path)
    if muxed_path != silent_path:
        silent_path.unlink(missing_ok=True)
        muxed_path.rename(silent_path)

    preview_idx = min(len(processed_frames) - 1, 5)
    _save_preview(processed_frames[preview_idx], preview_image_path)
    _save_sequence_metadata(
        path=metadata_path,
        cfg=effective_cfg,
        stats=stats,
        frame_records=frame_records,
        out_fps=out_fps,
        source_frame_count=stats.total_frames,
        output_frame_count=len(processed_frames),
        stable_crop=stable_crop,
        adaptive_qc_details=adaptive_qc_details,
    )

    report(100, "Mouth cut complete")

    return {
        "roi_video_path":     str(silent_path),
        "preview_image_path": str(preview_image_path),
        "metadata_path":      str(metadata_path),
        "roi_coords":         _bbox_to_xywh(stable_bbox),
        "stable_crop":        stable_crop.to_dict(),
        "fps":                out_fps,
        "frame_count":        len(processed_frames),
        "config_hash":        effective_cfg.config_hash(),
        "stats":              stats.to_dict(),
        "adaptive_qc":        adaptive_qc_details,
    }


# ─────────────────────────────────────────────────────────────────────────────
# FastAPI entry point  (backwards-compatible with the original signature)
# ─────────────────────────────────────────────────────────────────────────────

def run_mouth_cut_for_video(
    input_video_path: str,
    output_dir: str,
    output_basename: str,
    *,
    # ── output ──────────────────────────────────────────────────
    output_resolution: str = "96x96",
    grayscale: bool = True,
    normalize: bool = False,
    augment: bool = False,
    # ── stable crop geometry (new, replaces old padding_x/padding_y) ─
    padding_percent_x: float = 0.15,   # fraction of p-N lip width added on each side
    padding_percent_y: float = 0.20,   # fraction of p-N lip height added on each side
    crop_percentile: float = 95.0,     # which percentile of lip span drives box size
    # ── face tracking ────────────────────────────────────────────
    face_tracking: bool = True,        # False → EMA alpha = 1.0 (no smoothing)
    # ── QC ───────────────────────────────────────────────────────
    min_valid_frame_ratio: float = 0.30,
    mild_sharpen_before_blur_check: bool = True,
    sharpen_sigma: float = 1.0,
    sharpen_amount: float = 0.20,
    use_clahe_before_blur_check: bool = True,
    clahe_clip_limit: float = 1.5,
    clahe_tile_grid_size: int = 8,
    # ── blur reuse fallback ───────────────────────────────────────
    reuse_last_good_crop_on_blur_qc: bool = True,
    max_consecutive_reused_blur: int = 2,
    # ── yaw/generic reuse fallbacks (new) ────────────────────────
    reuse_last_good_crop_on_yaw_qc: bool = True,
    max_consecutive_reused_yaw: int = 2,
    reuse_last_good_crop_on_other_qc: bool = True,
    max_consecutive_reused_qc: int = 2,
    # ── adaptive QC ──────────────────────────────────────────────
    adaptive_qc_by_video: bool = True,
    adaptive_scan_frames: int = 30,
    # ── progress ─────────────────────────────────────────────────
    progress_callback: Optional[Callable[[int, str], None]] = None,
) -> dict:
    """
    Validated entry point for the FastAPI layer.

    Validates all inputs, constructs Config, sets up output paths,
    runs process_video, and attaches URL fields to the result dict.

    Raises FileNotFoundError, ValueError, or RuntimeError on failure —
    the API layer maps these to appropriate HTTP status codes.

    Stable crop sizing (new vs. original):
      The old per-frame dynamic bbox (padding_x/padding_y as raw fractions of
      lip span passed directly to compute_mouth_bbox) has been replaced by a
      two-pass stable crop computed from p{crop_percentile} lip dimensions.
      padding_percent_x/y express the same concept but are used only once per
      video rather than per frame, giving jitter-free crops.
    """
    t0 = time.perf_counter()

    # ── input validation ─────────────────────────────────────────────────────
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
    if not (0.0 < min_valid_frame_ratio <= 1.0):
        raise ValueError("min_valid_frame_ratio must be in (0, 1]")
    if sharpen_sigma <= 0:
        raise ValueError("sharpen_sigma must be > 0")
    if sharpen_amount < 0:
        raise ValueError("sharpen_amount must be >= 0")
    if clahe_clip_limit <= 0:
        raise ValueError("clahe_clip_limit must be > 0")
    if clahe_tile_grid_size < 2:
        raise ValueError("clahe_tile_grid_size must be >= 2")
    if max_consecutive_reused_blur < 0:
        raise ValueError("max_consecutive_reused_blur must be >= 0")
    if max_consecutive_reused_yaw < 0:
        raise ValueError("max_consecutive_reused_yaw must be >= 0")
    if max_consecutive_reused_qc < 0:
        raise ValueError("max_consecutive_reused_qc must be >= 0")
    if adaptive_scan_frames < 0:
        raise ValueError("adaptive_scan_frames must be >= 0")
    if padding_percent_x <= 0 or padding_percent_y <= 0:
        raise ValueError("padding_percent values must be > 0")
    if not (50.0 <= crop_percentile <= 100.0):
        raise ValueError("crop_percentile must be in [50, 100]")

    # ── build Config ─────────────────────────────────────────────────────────
    cfg = Config(
        output_width=out_w,
        output_height=out_h,
        grayscale=grayscale,
        normalize=normalize,
        augment=augment,
        bbox_ema_alpha=0.35 if face_tracking else 1.0,
        min_valid_frame_ratio=min_valid_frame_ratio,
        mild_sharpen_before_blur_check=mild_sharpen_before_blur_check,
        sharpen_sigma=sharpen_sigma,
        sharpen_amount=sharpen_amount,
        use_clahe_before_blur_check=use_clahe_before_blur_check,
        clahe_clip_limit=clahe_clip_limit,
        clahe_tile_grid_size=clahe_tile_grid_size,
        reuse_last_good_crop_on_blur_qc=reuse_last_good_crop_on_blur_qc,
        max_consecutive_reused_blur=max_consecutive_reused_blur,
        reuse_last_good_crop_on_yaw_qc=reuse_last_good_crop_on_yaw_qc,
        max_consecutive_reused_yaw=max_consecutive_reused_yaw,
        reuse_last_good_crop_on_other_qc=reuse_last_good_crop_on_other_qc,
        max_consecutive_reused_qc=max_consecutive_reused_qc,
        adaptive_qc_by_video=adaptive_qc_by_video,
        adaptive_scan_frames=adaptive_scan_frames,
        padding_percent_x=padding_percent_x,
        padding_percent_y=padding_percent_y,
        crop_percentile=crop_percentile,
    )

    run_dir = Path(output_dir) / output_basename
    run_dir.mkdir(parents=True, exist_ok=True)

    result = process_video(
        input_path=p,
        output_video_path=run_dir / "roi.mp4",
        preview_image_path=run_dir / "preview.png",
        metadata_path=run_dir / "sequence_metadata.json",
        cfg=cfg,
        progress_callback=progress_callback,
    )

    elapsed = time.perf_counter() - t0
    result["inference_time_ms"] = int(elapsed * 1000)
    result["inference_time"]    = f"{elapsed:.2f}s"

    result["roi_video_url"]     = "/" + result["roi_video_path"].replace("\\", "/")
    result["preview_image_url"] = "/" + result["preview_image_path"].replace("\\", "/")
    result["metadata_url"]      = "/" + result["metadata_path"].replace("\\", "/")
    return result