"use client"

import { useState, useRef, useEffect, useCallback } from "react"

import { useDashboard } from "@/lib/dashboard-context"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area"
import { Slider } from "@/components/ui/slider"
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Scissors,
  FileVideo,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Layers,
  Volume2,
  AudioLines,
} from "lucide-react"
import { cn } from "@/lib/utils"

interface Segment {
  id: string
  label: string
  wordIndex: number
  startTime: number
  endTime: number
  duration: number
  videoUrl: string
  sourceVideo: string
  relativePath: string
  isRejected?: boolean
  isModified?: boolean
}

const initialSegments: Segment[] = []

function ControlBar({
  isProcessing,
  progress,
  onRunSegmentation,
  segmentCount,
  sourceFile,
}: {
  isProcessing: boolean
  progress: number
  onRunSegmentation: () => void
  segmentCount: number
  sourceFile: string
}) {
  return (
    <div className="flex h-12 items-center justify-between border-b border-border bg-card px-4">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <FileVideo className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">{sourceFile}</span>
        </div>
        <Badge variant="secondary" className="gap-1">
          <Layers className="h-3 w-3" />
          {segmentCount} segments
        </Badge>
      </div>
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <div
            className={cn(
              "h-2 w-2 rounded-full",
              isProcessing ? "animate-pulse bg-primary" : "bg-success"
            )}
          />
          <span>{isProcessing ? `Segmenting... ${progress}%` : "Ready"}</span>
        </div>
        <Button
          onClick={onRunSegmentation}
          disabled={isProcessing}
          className="gap-2"
          size="sm"
        >
          {isProcessing ? (
            <>
              <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
              Processing
            </>
          ) : (
            <>
              <Scissors className="h-3.5 w-3.5" />
              Run Segmentation
            </>
          )}
        </Button>
      </div>
    </div>
  )
}

function VideoPlayer({
  segment,
  isPlaying,
  onPlayPause,
  onSkipBack,
  onSkipForward,
  currentTime,
  duration,
  isProcessing,
  videoRef,
  onTimeUpdate,
  onEnded,
}: {
  segment: Segment | null
  isPlaying: boolean
  onPlayPause: () => void
  onSkipBack: () => void
  onSkipForward: () => void
  currentTime: number
  duration: number
  isProcessing?: boolean
  videoRef: React.RefObject<HTMLVideoElement>
  onTimeUpdate: (time: number) => void
  onEnded: () => void
}) {
  return (
    <Card className="flex h-full flex-col">
      <CardHeader className="flex-shrink-0 pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-medium">
          <Play className="h-4 w-4 text-primary" />
          Active Segment
          {isProcessing && (
            <div className="ml-1 flex items-center gap-1.5">
              <svg className="h-4 w-4 -rotate-90" viewBox="0 0 16 16">
                <circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" strokeWidth="2" className="text-muted" />
                <circle
                  cx="8" cy="8" r="6"
                  fill="none" stroke="currentColor" strokeWidth="2"
                  strokeDasharray={`${2 * Math.PI * 6}`}
                  strokeDashoffset={`${2 * Math.PI * 6 * 0.75}`}
                  strokeLinecap="round"
                  className="origin-center animate-spin text-primary"
                  style={{ animationDuration: "1s" }}
                />
              </svg>
            </div>
          )}
          {segment && !isProcessing && (
            <Badge variant="outline" className="ml-auto">
              #{segment.wordIndex}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>

      <CardContent className="flex min-h-0 flex-1 flex-col">
        {/* Square container — video fills it at 1:1, scaled up cleanly */}
        <div className="relative mx-auto w-48 overflow-hidden rounded-lg bg-black" style={{ aspectRatio: "1 / 1" }}>
          {isProcessing ? (
            <div className="flex h-full flex-col items-center justify-center gap-4">
              <div className="relative flex h-16 w-16 items-center justify-center">
                <svg className="absolute inset-0 h-16 w-16 -rotate-90" viewBox="0 0 64 64">
                  <circle cx="32" cy="32" r="26" fill="none" stroke="currentColor" strokeWidth="4" className="text-white/10" />
                  <circle
                    cx="32" cy="32" r="26"
                    fill="none" stroke="currentColor" strokeWidth="4"
                    strokeDasharray={`${2 * Math.PI * 26}`}
                    strokeDashoffset={`${2 * Math.PI * 26 * 0.3}`}
                    strokeLinecap="round"
                    className="origin-center animate-spin text-primary"
                    style={{ animationDuration: "1.2s" }}
                  />
                </svg>
                <Play className="h-5 w-5 text-primary/70" />
              </div>
              <p className="text-sm text-white/60">Running segmentation...</p>
            </div>
          ) : segment ? (
            <video
              ref={videoRef}
              key={segment.videoUrl}
              src={`http://127.0.0.1:8000${segment.videoUrl}`}
              muted
              playsInline
              loop={false}
              className="h-full w-full object-cover"
              style={{ imageRendering: "pixelated" }}
              onTimeUpdate={(e) => onTimeUpdate(e.currentTarget.currentTime)}
              onEnded={onEnded}
            />
          ) : (
            <div className="flex h-full items-center justify-center">
              <p className="text-sm text-muted-foreground">
                Select a segment to preview
              </p>
            </div>
          )}
        </div>

        <div className="mt-4 space-y-3">
          <div className="flex items-center justify-center gap-2">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onSkipBack} disabled={isProcessing || !segment}>
              <SkipBack className="h-4 w-4" />
            </Button>
            <Button
              variant="default"
              size="icon"
              className="h-10 w-10 rounded-full"
              onClick={onPlayPause}
              disabled={isProcessing || !segment}
            >
              {isPlaying ? (
                <Pause className="h-4 w-4" />
              ) : (
                <Play className="h-4 w-4 translate-x-0.5" />
              )}
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onSkipForward} disabled={isProcessing || !segment}>
              <SkipForward className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>{currentTime.toFixed(2)}</span>
            <div className="h-1 flex-1 rounded-full bg-muted">
              <div
                className="h-1 rounded-full bg-primary transition-all"
                style={{ width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }}
              />
            </div>
            <span>{duration.toFixed(2)}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function WaveformEditor({
  segment,
  trimStart,
  trimEnd,
  onTrimChange,
  isProcessing,
}: {
  segment: Segment | null
  trimStart: number
  trimEnd: number
  onTrimChange: (start: number, end: number) => void
  isProcessing?: boolean
}) {
  return (
    <Card className="flex h-full flex-col">
      <CardHeader className="flex-shrink-0 pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-sm font-medium">
            <AudioLines className="h-4 w-4 text-primary" />
            Timeline Editor
            {isProcessing && (
              <div className="ml-1 flex items-center gap-1.5">
                <svg className="h-4 w-4 -rotate-90" viewBox="0 0 16 16">
                  <circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" strokeWidth="2" className="text-muted" />
                  <circle
                    cx="8" cy="8" r="6"
                    fill="none" stroke="currentColor" strokeWidth="2"
                    strokeDasharray={`${2 * Math.PI * 6}`}
                    strokeDashoffset={`${2 * Math.PI * 6 * 0.75}`}
                    strokeLinecap="round"
                    className="origin-center animate-spin text-primary"
                    style={{ animationDuration: "1s" }}
                  />
                </svg>
              </div>
            )}
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="h-7 w-7" disabled={isProcessing}>
              <Volume2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex min-h-0 flex-1 flex-col">
        <div className="relative h-[260px] rounded-lg bg-muted p-3">
          {isProcessing ? (
            <div className="flex h-full flex-col items-center justify-center gap-4">
              <div className="relative flex h-16 w-16 items-center justify-center">
                <svg className="absolute inset-0 h-16 w-16 -rotate-90" viewBox="0 0 64 64">
                  <circle cx="32" cy="32" r="26" fill="none" stroke="currentColor" strokeWidth="4" className="text-muted-foreground/20" />
                  <circle
                    cx="32" cy="32" r="26"
                    fill="none" stroke="currentColor" strokeWidth="4"
                    strokeDasharray={`${2 * Math.PI * 26}`}
                    strokeDashoffset={`${2 * Math.PI * 26 * 0.3}`}
                    strokeLinecap="round"
                    className="origin-center animate-spin text-primary"
                    style={{ animationDuration: "1.4s" }}
                  />
                </svg>
                <AudioLines className="h-5 w-5 text-primary/60" />
              </div>
              <p className="text-sm text-muted-foreground">Preparing timeline...</p>
            </div>
          ) : segment ? (
            <div className="h-full">
              <div className="flex h-full items-center gap-0.5">
                {Array.from({ length: 60 }).map((_, i) => (
                  <div
                    key={i}
                    className="flex-1 rounded-full bg-primary/40"
                    style={{
                      height: `${20 + Math.random() * 60}%`,
                    }}
                  />
                ))}
              </div>

              <div
                className="absolute bottom-3 top-3 border-l-2 border-r-2 border-primary bg-primary/10"
                style={{
                  left: `${trimStart}%`,
                  right: `${100 - trimEnd}%`,
                }}
              >
                <div className="absolute -left-1 bottom-0 top-0 w-2 cursor-ew-resize bg-primary" />
                <div className="absolute -right-1 bottom-0 top-0 w-2 cursor-ew-resize bg-primary" />
              </div>
            </div>
          ) : (
            <div className="flex h-full items-center justify-center">
              <p className="text-sm text-muted-foreground">
                Select a segment to edit
              </p>
            </div>
          )}
        </div>

        {segment && !isProcessing && (
          <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
            <div className="flex items-center gap-2">
              <span className="font-mono">Start:</span>
              <Badge variant="outline" className="font-mono">
                {segment.startTime.toFixed(3)}s
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-mono">End:</span>
              <Badge variant="outline" className="font-mono">
                {segment.endTime.toFixed(3)}s
              </Badge>
            </div>
          </div>
        )}

        {segment && !isProcessing && (
          <div className="mt-3 space-y-2">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Trim Range</span>
              <span className="font-mono">
                {(((trimEnd - trimStart) / 100) * segment.duration).toFixed(2)}s
              </span>
            </div>
            <Slider
              value={[trimStart, trimEnd]}
              onValueChange={([start, end]) => onTrimChange(start, end)}
              min={0}
              max={100}
              step={1}
              className="w-full"
            />
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function SegmentCard({
  segment,
  isActive,
  onClick,
  onToggleReject,
}: {
  segment: Segment
  isActive: boolean
  onClick: () => void
  onToggleReject: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "group flex w-24 flex-shrink-0 flex-col items-center rounded-lg border p-2 text-left transition-all",
        isActive
          ? "border-primary bg-primary/5"
          : "border-border bg-card hover:border-muted-foreground/30",
        segment.isRejected && "opacity-50"
      )}
    >
      {/* Square 96×96 video thumbnail */}
      <div
        className={cn(
          "relative mb-2 w-full overflow-hidden rounded-md",
          segment.isRejected ? "ring-1 ring-destructive/40" : isActive ? "ring-1 ring-primary/60" : ""
        )}
        style={{ aspectRatio: "1 / 1" }}
      >
        <video
          src={`http://127.0.0.1:8000${segment.videoUrl}`}
          muted
          playsInline
          preload="metadata"
          className="h-full w-full object-cover"
          // Seek to first frame as thumbnail
          onLoadedMetadata={(e) => { e.currentTarget.currentTime = 0.01 }}
        />
        {segment.isRejected && (
          <div className="absolute inset-0 flex items-center justify-center bg-destructive/20">
            <XCircle className="h-5 w-5 text-destructive" />
          </div>
        )}
      </div>

      <div className="w-full space-y-0.5">
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">#{segment.wordIndex}</span>
          {segment.isModified && (
            <Badge variant="secondary" className="h-4 px-1 text-[10px]">
              Edited
            </Badge>
          )}
        </div>

        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            {segment.duration.toFixed(2)}s
          </span>
          <div
            onClick={(e) => {
              e.stopPropagation()
              onToggleReject()
            }}
            className="opacity-0 transition-opacity group-hover:opacity-100"
          >
            {segment.isRejected ? (
              <CheckCircle2 className="h-3.5 w-3.5 text-success" />
            ) : (
              <XCircle className="h-3.5 w-3.5 text-destructive" />
            )}
          </div>
        </div>
      </div>
    </button>
  )
}

export function Stage2Preprocessing() {
  const { videoInfo, addLog, setStageStatus, setIsProcessing } = useDashboard()

  const [segments, setSegments] = useState<Segment[]>(initialSegments)
  const [activeSegmentId, setActiveSegmentId] = useState<string | null>(null)
  const [isLocalProcessing, setIsLocalProcessing] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [trimStart, setTrimStart] = useState(0)
  const [trimEnd, setTrimEnd] = useState(100)
  const [segmentationProgress, setSegmentationProgress] = useState(0)

  const videoRef = useRef<HTMLVideoElement>(null)
  const activeSegment = segments.find((s) => s.id === activeSegmentId) || null

  // Sync play/pause state to the actual video element
  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    if (isPlaying) {
      video.play().catch(() => setIsPlaying(false))
    } else {
      video.pause()
    }
  }, [isPlaying])

  // When active segment changes, reset playback
  useEffect(() => {
    setIsPlaying(false)
    setCurrentTime(0)
    const video = videoRef.current
    if (video) {
      video.pause()
      video.currentTime = 0
    }
  }, [activeSegmentId])

  const handlePlayPause = useCallback(() => {
    setIsPlaying((prev) => !prev)
  }, [])

  const handleTimeUpdate = useCallback((time: number) => {
    setCurrentTime(time)
  }, [])

  const handleEnded = useCallback(() => {
    setIsPlaying(false)
  }, [])

  const handleSkipBack = useCallback(() => {
    const idx = segments.findIndex((s) => s.id === activeSegmentId)
    if (idx > 0) setActiveSegmentId(segments[idx - 1].id)
  }, [segments, activeSegmentId])

  const handleSkipForward = useCallback(() => {
    const idx = segments.findIndex((s) => s.id === activeSegmentId)
    if (idx < segments.length - 1) setActiveSegmentId(segments[idx + 1].id)
  }, [segments, activeSegmentId])

  const handleRunSegmentation = async () => {
    if (!videoInfo?.mouthCutRunId) {
      addLog("error", "Missing mouthCutRunId from mouth cut stage", "Preprocessing")
      return
    }

    try {
      setIsLocalProcessing(true)
      setIsProcessing(true)
      setSegmentationProgress(0)

      addLog("info", "Starting segmentation...", "Preprocessing")

      setSegmentationProgress(0)

      const response = await fetch("http://127.0.0.1:8000/api/preprocessing/run", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          mouthCutRunId: videoInfo.mouthCutRunId,
        }),
      })

      if (!response.body) {
        throw new Error("Segmentation stream unavailable")
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ""
      let data: any = null
      let streamError: string | null = null

      while (true) {
        const { value, done } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split("\n")
        buffer = lines.pop() ?? ""

        for (const line of lines) {
          if (!line.trim()) continue
          const event = JSON.parse(line)

          if (event.type === "progress") {
            setSegmentationProgress(typeof event.progress === "number" ? event.progress : 0)
            continue
          }

          if (event.type === "error") {
            streamError = event.detail || "Segmentation failed"
            break
          }

          if (event.type === "result") {
            data = event.data
            setSegmentationProgress(100)
          }
        }

        if (streamError) break
      }

      if (streamError) {
        addLog("error", streamError, "Preprocessing")
        throw new Error(streamError)
      }

      if (!data) {
        throw new Error("Segmentation finished without result data")
      }

      console.log("SEGMENTATION RESPONSE:", data)

      const normalizedSegments: Segment[] = (data.segments ?? []).map((segment: Segment) => ({
        ...segment,
        isRejected: false,
        isModified: false,
      }))

      setSegments(normalizedSegments)
      setActiveSegmentId(normalizedSegments.length > 0 ? normalizedSegments[0].id : null)
      setTrimStart(0)
      setTrimEnd(100)
      setCurrentTime(0)

      setStageStatus(2, "completed")
      setStageStatus(3, "available")

      addLog(
        "success",
        `Segmentation completed (${data.segments?.length ?? 0} segments)`,
        "Preprocessing"
      )
    } catch (error) {
      console.error("Segmentation error:", error)

      addLog(
        "error",
        error instanceof Error ? error.message : "Segmentation failed",
        "Preprocessing"
      )
    } finally {
      setIsLocalProcessing(false)
      setIsProcessing(false)
    }
  }

  const handleToggleReject = (segmentId: string) => {
    setSegments((prev) =>
      prev.map((s) =>
        s.id === segmentId ? { ...s, isRejected: !s.isRejected } : s
      )
    )

    const segment = segments.find((s) => s.id === segmentId)
    if (segment) {
      addLog(
        segment.isRejected ? "info" : "warning",
        `Segment #${segment.wordIndex} ${segment.isRejected ? "restored" : "rejected"}`,
        "Preprocessing"
      )
    }
  }

  const handleTrimChange = (start: number, end: number) => {
    setTrimStart(start)
    setTrimEnd(end)
    if (activeSegment) {
      setSegments((prev) =>
        prev.map((s) =>
          s.id === activeSegmentId ? { ...s, isModified: true } : s
        )
      )
    }
  }

  const rejectedCount = segments.filter((s) => s.isRejected).length

  return (
    <div className="flex h-full flex-col">
      <ControlBar
        isProcessing={isLocalProcessing}
        progress={segmentationProgress}
        onRunSegmentation={handleRunSegmentation}
        segmentCount={segments.length - rejectedCount}
        sourceFile="mouth_roi_output.mp4"
      />

      <div className="flex-1 overflow-y-auto px-4 pt-4 pb-4">
        <div className="grid gap-4 lg:grid-cols-2">
          <VideoPlayer
            segment={activeSegment}
            isPlaying={isPlaying}
            onPlayPause={handlePlayPause}
            onSkipBack={handleSkipBack}
            onSkipForward={handleSkipForward}
            currentTime={currentTime}
            duration={activeSegment ? activeSegment.duration : 1}
            isProcessing={isLocalProcessing}
            videoRef={videoRef}
            onTimeUpdate={handleTimeUpdate}
            onEnded={handleEnded}
          />

          <WaveformEditor
            segment={activeSegment}
            trimStart={trimStart}
            trimEnd={trimEnd}
            onTrimChange={handleTrimChange}
            isProcessing={isLocalProcessing}
          />
        </div>
      </div>

      <div className="flex-shrink-0 border-t border-border bg-card">
        <div className="flex h-10 items-center justify-between border-b border-border bg-muted/30 px-4">
          <span className="text-xs font-medium text-muted-foreground">
            Segment Browser
          </span>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            {rejectedCount > 0 && (
              <span className="flex items-center gap-1 text-destructive">
                <AlertTriangle className="h-3 w-3" />
                {rejectedCount} rejected
              </span>
            )}
            <span>
              {segments.filter((s) => s.isModified).length} modified
            </span>
          </div>
        </div>

        <ScrollArea className="w-full">
          <div className="flex gap-3 px-4 py-3">
            {segments.map((segment) => (
              <SegmentCard
                key={segment.id}
                segment={segment}
                isActive={segment.id === activeSegmentId}
                onClick={() => {
                  setActiveSegmentId(segment.id)
                  setTrimStart(0)
                  setTrimEnd(100)
                  setCurrentTime(0)
                }}
                onToggleReject={() => handleToggleReject(segment.id)}
              />
            ))}
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </div>
    </div>
  )
}