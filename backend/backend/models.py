import uuid
from sqlalchemy import Column, Text, DateTime, ForeignKey, BigInteger, Boolean, Float, Integer
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from sqlalchemy.orm import declarative_base, relationship

Base = declarative_base()


class MediaFile(Base):
    __tablename__ = "media_files"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    sha256 = Column(Text, nullable=False, unique=True)
    storage_path = Column(Text, nullable=False)
    stored_filename = Column(Text, nullable=False)
    original_filename = Column(Text, nullable=False)
    size_bytes = Column(BigInteger, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    videos = relationship("Video", back_populates="media_file")


class Video(Base):
    __tablename__ = "videos"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    media_file_id = Column(
        UUID(as_uuid=True),
        ForeignKey("media_files.id", ondelete="CASCADE"),
        nullable=False
    )
    status = Column(Text, nullable=False, default="uploaded")
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    media_file = relationship("MediaFile", back_populates="videos")
    mouth_cut_runs = relationship(
        "MouthCutRun",
        back_populates="video",
        cascade="all, delete-orphan"
    )


class MouthCutRun(Base):
    __tablename__ = "mouth_cut_runs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    video_id = Column(
        UUID(as_uuid=True),
        ForeignKey("videos.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    status = Column(Text, nullable=False, default="queued")
    output_resolution = Column(Text, nullable=False)
    crop_margin_x = Column(Integer, nullable=False)
    crop_margin_y = Column(Integer, nullable=False)
    face_tracking = Column(Boolean, nullable=False, default=True)
    grayscale = Column(Boolean, nullable=False, default=True)
    normalize = Column(Boolean, nullable=False, default=False)
    augment = Column(Boolean, nullable=False, default=False)
    min_valid_frame_ratio = Column(Float, nullable=False, default=0.60)

    roi_video_path = Column(Text, nullable=True)
    roi_video_url = Column(Text, nullable=True)
    preview_image_path = Column(Text, nullable=True)
    preview_image_url = Column(Text, nullable=True)
    metadata_path = Column(Text, nullable=True)
    metadata_url = Column(Text, nullable=True)
    config_hash = Column(Text, nullable=True)
    stats_json = Column(Text, nullable=True)

    roi_x = Column(Integer, nullable=True)
    roi_y = Column(Integer, nullable=True)
    roi_w = Column(Integer, nullable=True)
    roi_h = Column(Integer, nullable=True)

    output_fps = Column(Float, nullable=True)
    frame_count = Column(Integer, nullable=True)
    inference_time_ms = Column(Integer, nullable=True)

    error_message = Column(Text, nullable=True)

    started_at = Column(DateTime(timezone=True), nullable=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    video = relationship("Video", back_populates="mouth_cut_runs")