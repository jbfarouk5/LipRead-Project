import os
import json
import logging
import tempfile

from preprocessing.config import INPUT_FOLDER, OUTPUT_DIR, EXPECTED_WORDS, setup_logging
from preprocessing.utils import (
    create_output_structure,
    list_videos,
    safe_stem,
    ensure_mp4,
    extract_audio,
    get_video_info,
)
from preprocessing.vad import get_speech_segments_pyannote, process_segments, snap_to_frames
from preprocessing.export import cut_video_to_word_folders
from preprocessing.refinement import refine_segments

log = logging.getLogger(__name__)


# ==============================
# PER-VIDEO PIPELINE
# ==============================

def process_single_video(video_path: str, progress_callback=None) -> dict:
    source_name = safe_stem(video_path)

    log.info("=" * 60)
    log.info("PROCESSING: %s", source_name)
    log.info("=" * 60)

    def report(progress: int, message: str) -> None:
        if progress_callback is not None:
            progress_callback(progress, message)

    with tempfile.TemporaryDirectory(prefix=f"vidseg_{source_name}_") as tmp_dir:
        try:
            report(5, "Preparing video...")
            normalized_video, _ = ensure_mp4(video_path, tmp_dir)
            report(15, "Extracting audio...")
            temp_audio          = os.path.join(tmp_dir, f"{source_name}_audio.wav")
            extract_audio(normalized_video, temp_audio)

            report(35, "Running VAD...")
            raw_segments = get_speech_segments_pyannote(temp_audio)

            report(55, "Analyzing video timing...")
            fps, video_duration = get_video_info(normalized_video)

            report(65, "Processing detected segments...")
            processed = process_segments(raw_segments, video_duration)
            snapped   = snap_to_frames(processed, fps)

            log.info("Segment count after VAD + processing: %d", len(snapped))

            if len(snapped) != EXPECTED_WORDS:
                log.info(
                    "Count is %d, not %d. Refining in memory before writing…",
                    len(snapped), EXPECTED_WORDS,
                )
                report(78, "Refining segment boundaries...")
                snapped = snap_to_frames(
                    refine_segments(temp_audio, snapped), fps
                )
            else:
                log.info("Count is already %d. Writing clips directly.", EXPECTED_WORDS)

            report(85, "Exporting clips...")
            metadata = cut_video_to_word_folders(
                normalized_video, snapped, source_name,
                already_processed=True,
                progress_callback=progress_callback,
            )

            clips_written = len(metadata)
            log.info("Clips on disk for '%s': %d", source_name, clips_written)

            report(100, "Segmentation complete")

            return {
                "video":          source_name,
                "status":         "success",
                "segments_saved": clips_written,
                "clips":          metadata,
            }

        except Exception as e:
            log.error("ERROR processing %s: %s", source_name, e, exc_info=True)
            return {
                "video":          source_name,
                "status":         "error",
                "error":          str(e),
                "segments_saved": 0,
                "clips":          [],
            }


# ==============================
# MAIN
# ==============================

def main() -> None:
    setup_logging()

    create_output_structure()
    video_files = list_videos(INPUT_FOLDER)
    log.info("Found %d video(s) in: %s", len(video_files), INPUT_FOLDER)

    all_results:        list[dict] = []
    all_clips_metadata: list[dict] = []

    for video_path in video_files:
        result = process_single_video(video_path)
        all_results.append(result)
        all_clips_metadata.extend(result.get("clips", []))

    metadata_path = os.path.join(OUTPUT_DIR, "metadata.json")
    summary_path  = os.path.join(OUTPUT_DIR, "summary.json")

    with open(metadata_path, "w", encoding="utf-8") as f:
        json.dump(all_clips_metadata, f, indent=4, ensure_ascii=False)

    with open(summary_path, "w", encoding="utf-8") as f:
        json.dump(all_results, f, indent=4, ensure_ascii=False)

    log.info("All done.")
    log.info("Metadata → %s", metadata_path)
    log.info("Summary  → %s", summary_path)


if __name__ == "__main__":
    main()