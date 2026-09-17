import logging

import librosa
import numpy as np

from preprocessing.config import (
    EXPECTED_WORDS,
    MIN_VALID_DURATION,
    MAX_ITERATIONS,
)

log = logging.getLogger(__name__)


# ==============================
# VALLEY DETECTION  (pure audio — no disk I/O)
# ==============================

def _valleys_in_window(
    y: np.ndarray,
    sr: int,
    t_start: float,
    t_end: float,
) -> list[float]:
    """Return absolute valley timestamps inside [t_start, t_end]."""
    s     = int(t_start * sr)
    e     = int(t_end   * sr)
    chunk = y[s:e]
    if len(chunk) < sr * MIN_VALID_DURATION:
        return []
    rms   = librosa.feature.rms(y=chunk)[0]
    rms   = librosa.util.normalize(rms)
    rms   = np.convolve(rms, np.ones(10) / 10, mode="same")
    thr   = np.percentile(rms, 30)
    idxs  = np.where(rms < thr)[0]
    if len(idxs) < 2:
        return []
    frame_dur = (len(chunk) / sr) / len(rms)
    return [t_start + idx * frame_dur for idx in idxs]


# ==============================
# CORE IN-MEMORY CORRECTION
# ==============================

def _correct_in_memory(
    y: np.ndarray,
    sr: int,
    segments: list[tuple[float, float]],
) -> list[tuple[float, float]]:
    """
    Adjust segment count to EXPECTED_WORDS entirely in memory.

    - Too few  → split the longest segment at its energy valley
    - Too many → merge the pair with the smallest gap between them
    - Repeats up to MAX_ITERATIONS passes
    """
    current = list(segments)

    for iteration in range(MAX_ITERATIONS):
        count = len(current)
        log.debug("[refine] iteration %d: %d segments", iteration + 1, count)

        if count == EXPECTED_WORDS:
            break

        if count < EXPECTED_WORDS:
            by_length = sorted(
                range(len(current)),
                key=lambda i: current[i][1] - current[i][0],
                reverse=True,
            )
            split_done = False
            for idx in by_length:
                seg_start, seg_end = current[idx]
                valleys = _valleys_in_window(y, sr, seg_start, seg_end)
                if not valleys:
                    continue
                mid         = (seg_start + seg_end) / 2
                best_valley = min(valleys, key=lambda v: abs(v - mid))
                left        = (seg_start, best_valley)
                right       = (best_valley, seg_end)
                if (left[1]  - left[0]  >= MIN_VALID_DURATION and
                        right[1] - right[0] >= MIN_VALID_DURATION):
                    current = current[:idx] + [left, right] + current[idx + 1:]
                    log.debug(
                        "[refine] Split seg %d at %.3fs → %d segments",
                        idx, best_valley, len(current),
                    )
                    split_done = True
                    break
            if not split_done:
                log.debug("[refine] Could not split further. Stopping early.")
                break

        else:  # count > EXPECTED_WORDS
            gaps = [
                (current[i + 1][0] - current[i][1], i)
                for i in range(len(current) - 1)
            ]
            _, merge_idx = min(gaps)
            merged_seg   = (current[merge_idx][0], current[merge_idx + 1][1])
            current      = (current[:merge_idx]
                            + [merged_seg]
                            + current[merge_idx + 2:])
            log.debug(
                "[refine] Merged segs %d&%d → %d segments",
                merge_idx, merge_idx + 1, len(current),
            )

    return current


# ==============================
# PUBLIC API
# ==============================

def refine_segments(
    wav_path: str,
    segments: list[tuple[float, float]],
) -> list[tuple[float, float]]:
    """
    Refine segments entirely in memory — no files written or deleted.

    Loads the WAV once, runs _correct_in_memory, and returns the final
    segment list. The caller writes clips exactly once from the result.

    If the target count cannot be reached, returns the best approximation
    and logs a warning — the caller decides how to handle it.
    """
    log.info(
        "[refine] Starting with %d segments (target %d)…",
        len(segments), EXPECTED_WORDS,
    )

    y, sr  = librosa.load(wav_path, sr=None)
    result = _correct_in_memory(y, sr, segments)

    if len(result) == EXPECTED_WORDS:
        log.info("[refine] SUCCESS — %d segments confirmed.", EXPECTED_WORDS)
    else:
        log.warning(
            "[refine] Could not reach %d segments, ended at %d. "
            "Writing best approximation.",
            EXPECTED_WORDS, len(result),
        )

    if len(result) > EXPECTED_WORDS:
        result = result[:EXPECTED_WORDS]

    return result