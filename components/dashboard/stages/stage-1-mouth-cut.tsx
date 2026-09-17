"use client"

import { useState, useCallback } from "react"
import { useDashboard, type VideoInfo } from "@/lib/dashboard-context"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Upload,
  Play,
  FileVideo,
  Clock,
  MonitorPlay,
  Gauge,
  ZoomIn,
  Maximize2,
  Target,
  Cpu,
  Timer,
  CheckCircle2,
} from "lucide-react"
import { cn } from "@/lib/utils"

// ─────────────────────────────────────────────────────────────────────────────
// Upload card — unchanged
// ─────────────────────────────────────────────────────────────────────────────

function UploadCard({
  onFileSelect,
  hasFile,
  fileInfo,
}: {
  onFileSelect: (file: File) => void
  hasFile: boolean
  fileInfo: { name: string; duration: string; resolution: string; fps: string } | null
}) {
  const [isDragging, setIsDragging] = useState(false)

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragging(false)
      const file = e.dataTransfer.files[0]
      if (file) onFileSelect(file)
    },
    [onFileSelect]
  )

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (file) onFileSelect(file)
      e.currentTarget.value = ""
    },
    [onFileSelect]
  )

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm font-medium">
          <FileVideo className="h-4 w-4 text-primary" />
          Source Media
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!hasFile ? (
          <div
            className={cn(
              "relative rounded-lg border-2 border-dashed p-6 text-center transition-all",
              isDragging
                ? "border-primary bg-primary/5"
                : "border-border hover:border-muted-foreground/50"
            )}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <input
              type="file"
              accept="video/mp4,video/quicktime,video/x-msvideo"
              className="absolute inset-0 cursor-pointer opacity-0"
              onChange={handleFileInput}
            />
            <Upload className="mx-auto h-8 w-8 text-muted-foreground" />
            <p className="mt-2 text-sm text-muted-foreground">
              Drop video or click to upload
            </p>
            <p className="mt-1 text-xs text-muted-foreground/70">
              MP4, MOV, AVI • Max 500MB
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center gap-2 rounded-lg border border-border bg-background p-3">
              <FileVideo className="h-5 w-5 text-primary" />
              <span className="flex-1 truncate text-sm font-medium">
                {fileInfo?.name}
              </span>
              <Badge variant="secondary" className="text-xs">
                Loaded
              </Badge>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-md border border-border bg-muted/30 p-2 text-center">
                <Clock className="mx-auto h-3.5 w-3.5 text-muted-foreground" />
                <p className="mt-1 text-xs font-medium">{fileInfo?.duration}</p>
                <p className="text-xs text-muted-foreground">Duration</p>
              </div>
              <div className="rounded-md border border-border bg-muted/30 p-2 text-center">
                <MonitorPlay className="mx-auto h-3.5 w-3.5 text-muted-foreground" />
                <p className="mt-1 text-xs font-medium">{fileInfo?.resolution}</p>
                <p className="text-xs text-muted-foreground">Resolution</p>
              </div>
              <div className="rounded-md border border-border bg-muted/30 p-2 text-center">
                <Gauge className="mx-auto h-3.5 w-3.5 text-muted-foreground" />
                <p className="mt-1 text-xs font-medium">{fileInfo?.fps}</p>
                <p className="text-xs text-muted-foreground">FPS</p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Cropping parameters card
// Changes vs original:
//   - "Crop Margin" single slider replaced by two sliders:
//       Horizontal Padding (padding_percent_x)  range 0.20–0.60, step 0.05
//       Vertical Padding   (padding_percent_y)  range 0.40–1.00, step 0.05
//   - Crop Percentile selector added (90 / 95 / 100)
//   - Props updated accordingly
// ─────────────────────────────────────────────────────────────────────────────

function CroppingParametersCard({
  resolution,
  setResolution,
  paddingX,
  setPaddingX,
  paddingY,
  setPaddingY,
  cropPercentile,
  setCropPercentile,
  faceTracking,
  setFaceTracking,
  onRunCropping,
  isProcessing,
}: {
  resolution: string
  setResolution: (value: string) => void
  paddingX: number
  setPaddingX: (value: number) => void
  paddingY: number
  setPaddingY: (value: number) => void
  cropPercentile: number
  setCropPercentile: (value: number) => void
  faceTracking: boolean
  setFaceTracking: (value: boolean) => void
  onRunCropping: () => void
  isProcessing: boolean
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm font-medium">
          <Target className="h-4 w-4 text-primary" />
          Cropping Parameters
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">

        {/* Output resolution */}
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">
            Output Resolution
          </Label>
          <Select value={resolution} onValueChange={setResolution}>
            <SelectTrigger className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="64x64">64 × 64</SelectItem>
              <SelectItem value="96x96">96 × 96 (Recommended)</SelectItem>
              <SelectItem value="128x128">128 × 128</SelectItem>
              <SelectItem value="256x256">256 × 256</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Horizontal padding */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-xs text-muted-foreground">
              Horizontal Padding
            </Label>
            <span className="text-xs font-medium">
              {Math.round(paddingX * 100)}% per side
            </span>
          </div>
          <Slider
            value={[paddingX]}
            onValueChange={([v]) => setPaddingX(v)}
            min={0.20}
            max={0.60}
            step={0.05}
            className="w-full"
          />
          <p className="text-xs text-muted-foreground/70">
            Added on each side of the detected lip width
          </p>
        </div>

        {/* Vertical padding */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-xs text-muted-foreground">
              Vertical Padding
            </Label>
            <span className="text-xs font-medium">
              {Math.round(paddingY * 100)}% per side
            </span>
          </div>
          <Slider
            value={[paddingY]}
            onValueChange={([v]) => setPaddingY(v)}
            min={0.40}
            max={1.00}
            step={0.05}
            className="w-full"
          />
          <p className="text-xs text-muted-foreground/70">
            Added above and below — lips travel more vertically during speech
          </p>
        </div>

        {/* Crop percentile */}
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">
            Crop Size Percentile
          </Label>
          <Select
            value={String(cropPercentile)}
            onValueChange={(v) => setCropPercentile(Number(v))}
          >
            <SelectTrigger className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="90">90th percentile</SelectItem>
              <SelectItem value="95">95th percentile (Recommended)</SelectItem>
              <SelectItem value="100">100th percentile (max)</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground/70">
            Which percentile of lip span sets the stable crop box size
          </p>
        </div>

        {/* Face tracking toggle */}
        <div className="flex items-center justify-between rounded-lg border border-border bg-background p-3">
          <div className="space-y-0.5">
            <Label className="text-sm font-medium">Auto Face Tracking</Label>
            <p className="text-xs text-muted-foreground">
              Neural ROI detection enabled
            </p>
          </div>
          <Switch checked={faceTracking} onCheckedChange={setFaceTracking} />
        </div>

        <Button
          className="w-full glow-primary gap-2"
          onClick={onRunCropping}
          disabled={isProcessing}
        >
          {isProcessing ? (
            <>
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
              Processing...
            </>
          ) : (
            <>
              <Play className="h-4 w-4" />
              Run Cropping
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// ROI preview panel
// Changes vs original:
//   - Resolution label reads from `resolution` prop instead of hardcoded "96 x 96"
//   - Accepts `stableCrop` for displaying Pass 1 statistics
//   - roi_coords overlay now always renders when present (never nullable from API)
// ─────────────────────────────────────────────────────────────────────────────

interface StableCrop {
  center_x: number
  center_y: number
  crop_width: number
  crop_height: number
  bbox_x1: number
  bbox_y1: number
  bbox_x2: number
  bbox_y2: number
  n_valid_frames_pass1: number
  border_pad_used: boolean
}

function ROIPreviewPanel({
  hasProcessed,
  isProcessing,
  progress,
  progressMessage,
  resolution,
  roiCoords,
  stableCrop,
  inferenceTime,
  previewImageUrl,
}: {
  hasProcessed: boolean
  isProcessing: boolean
  progress: number
  progressMessage: string
  resolution: string
  roiCoords: { x: number; y: number; w: number; h: number } | null
  stableCrop: StableCrop | null
  inferenceTime: string | null
  previewImageUrl: string | null
}) {
  return (
    <Card className="flex h-full flex-col">
      <CardHeader className="flex-shrink-0 pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-sm font-medium">
            <Target className="h-4 w-4 text-primary" />
            ROI Preview
          </CardTitle>
          {hasProcessed && (
            <div className="flex gap-1">
              <Button variant="ghost" size="icon" className="h-7 w-7">
                <ZoomIn className="h-3.5 w-3.5" />
              </Button>
              <Button variant="ghost" size="icon" className="h-7 w-7">
                <Maximize2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent className="flex flex-1 flex-col">
        <div className="relative flex flex-1 items-center justify-center rounded-lg border border-border bg-background">

          {/* Idle state */}
          {!hasProcessed && !isProcessing && (
            <div className="p-8 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border-2 border-dashed border-muted-foreground/30">
                <Target className="h-8 w-8 text-muted-foreground/50" />
              </div>
              <p className="mt-4 text-sm text-muted-foreground">
                ROI preview will appear here
              </p>
              <p className="mt-1 text-xs text-muted-foreground/70">
                Upload a video and run cropping to see the extracted mouth region
              </p>
            </div>
          )}

          {/* Processing state */}
          {isProcessing && (
            <div className="p-8 text-center">
              <div className="relative mx-auto flex h-20 w-20 items-center justify-center">
                <svg className="absolute inset-0 h-20 w-20 -rotate-90" viewBox="0 0 80 80">
                  <circle
                    cx="40" cy="40" r="34"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="4"
                    className="text-muted"
                  />
                  <circle
                    cx="40" cy="40" r="34"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="4"
                    strokeDasharray={`${2 * Math.PI * 34}`}
                    strokeDashoffset={`${2 * Math.PI * 34 * (1 - progress / 100)}`}
                    strokeLinecap="round"
                    className="text-primary transition-all duration-300"
                  />
                </svg>
              </div>
              <p className="mt-4 text-sm font-medium text-foreground">
                Extracting mouth region...
              </p>
              <p className="mt-2 text-lg font-semibold text-primary">{progress}%</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {progressMessage || "Running neural face detection"}
              </p>
            </div>
          )}

          {/* Result state */}
          {hasProcessed && !isProcessing && (
            <div className="relative h-full w-full p-4">
              <div className="flex h-full items-center justify-center">
                <div className="relative aspect-square w-56 overflow-hidden rounded-lg border border-border bg-muted">
                  {previewImageUrl ? (
                    <img
                      src={previewImageUrl}
                      alt="Mouth ROI Preview"
                      className="h-full w-full object-contain"
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-muted to-muted/50">
                      <p className="text-sm text-muted-foreground">
                        Preview unavailable
                      </p>
                    </div>
                  )}

                  {/* Resolution label — now dynamic */}
                  <div className="absolute bottom-2 left-2 rounded bg-background/80 px-2 py-1 text-xs font-mono">
                    {resolution.replace("x", " × ")}
                  </div>
                </div>
              </div>

              {/* ROI coords overlay */}
              {roiCoords && (
                <div className="absolute right-4 top-4 rounded-md border border-border bg-card/90 px-2 py-1 backdrop-blur-sm">
                  <p className="font-mono text-xs text-muted-foreground">
                    ROI: ({roiCoords.x}, {roiCoords.y}) {roiCoords.w}×{roiCoords.h}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Status + inference time */}
        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="rounded-lg border border-border bg-background p-3">
            <div className="flex items-center gap-2">
              <Cpu className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Status</span>
            </div>
            <div className="mt-1 flex items-center gap-1.5">
              {hasProcessed ? (
                <>
                  <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                  <span className="text-sm font-medium text-success">Complete</span>
                </>
              ) : isProcessing ? (
                <>
                  <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                  <span className="text-sm font-medium text-primary">Processing</span>
                </>
              ) : (
                <span className="text-sm font-medium text-muted-foreground">Idle</span>
              )}
            </div>
          </div>

          <div className="rounded-lg border border-border bg-background p-3">
            <div className="flex items-center gap-2">
              <Timer className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Inference Time</span>
            </div>
            <p className="mt-1 text-sm font-medium">{inferenceTime ?? "—"}</p>
          </div>
        </div>

        {/* Stable crop statistics — shown after processing */}
        {hasProcessed && stableCrop && (
          <div className="mt-3 rounded-lg border border-border bg-muted/30 p-3 space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground">
              Stable Crop Info (Pass 1)
            </p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1">
              <p className="text-xs text-muted-foreground">
                Box size:{" "}
                <span className="font-mono font-medium text-foreground">
                  {Math.round(stableCrop.crop_width)} × {Math.round(stableCrop.crop_height)} px
                </span>
              </p>
              <p className="text-xs text-muted-foreground">
                Center:{" "}
                <span className="font-mono font-medium text-foreground">
                  ({Math.round(stableCrop.center_x)}, {Math.round(stableCrop.center_y)})
                </span>
              </p>
              <p className="text-xs text-muted-foreground">
                Frames used:{" "}
                <span className="font-mono font-medium text-foreground">
                  {stableCrop.n_valid_frames_pass1}
                </span>
              </p>
              <p className="text-xs text-muted-foreground">
                Border pad:{" "}
                <span className={cn(
                  "font-mono font-medium",
                  stableCrop.border_pad_used ? "text-warning" : "text-success"
                )}>
                  {stableCrop.border_pad_used ? "Yes" : "No"}
                </span>
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Stage 1 component
// Changes vs original:
//   - cropMargin state replaced by paddingX, paddingY, cropPercentile
//   - handleRunCropping sends padding_percent_x, padding_percent_y, crop_percentile
//     to the API instead of crop_margin_x / crop_margin_y
//   - stableCrop state added; populated from data.stable_crop in the stream result
//   - resolution passed down to ROIPreviewPanel for the dynamic size label
// ─────────────────────────────────────────────────────────────────────────────

export function Stage1MouthCut() {
  const {
    videoInfo,
    setVideoInfo,
    addLog,
    setStageStatus,
    setCurrentStage,
    setIsProcessing,
  } = useDashboard()

  const [resolution, setResolution] = useState("96x96")
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null)

  // Replaced single cropMargin with the two stable-crop padding values
  const [paddingX, setPaddingX] = useState(0.15)
  const [paddingY, setPaddingY] = useState(0.20)
  const [cropPercentile, setCropPercentile] = useState(95)

  const [faceTracking, setFaceTracking] = useState(true)
  const [isLocalProcessing, setIsLocalProcessing] = useState(false)
  const [hasProcessed, setHasProcessed] = useState(false)
  const [roiCoords, setRoiCoords] = useState<{
    x: number; y: number; w: number; h: number
  } | null>(null)
  const [stableCrop, setStableCrop] = useState<StableCrop | null>(null)
  const [inferenceTime, setInferenceTime] = useState<string | null>(null)
  const [cropProgress, setCropProgress] = useState(0)
  const [cropProgressMessage, setCropProgressMessage] = useState(
    "Running neural face detection"
  )

  const hasFile = !!videoInfo

  const fileInfo = videoInfo
    ? {
        name: videoInfo.name,
        duration: videoInfo.duration,
        resolution: videoInfo.resolution,
        fps: videoInfo.frameRate,
      }
    : null

  // ── file upload ────────────────────────────────────────────────────────────
  const handleFileSelect = async (file: File) => {
    const formData = new FormData()
    formData.append("file", file)

    try {
      const res = await fetch("http://127.0.0.1:8000/api/uploads/video", {
        method: "POST",
        body: formData,
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.detail || "Upload failed")
      }

      const data = await res.json()
      console.log("UPLOAD RESPONSE:", data)

      const info: VideoInfo = {
        videoId: data.videoId,
        mediaFileId: data.mediaFileId,
        name: data.fileName,
        size: data.size,
        duration: data.duration,
        resolution: data.resolution,
        frameRate: data.frameRate,
        format: data.format,
        filePath: data.filePath,
        storedFileName: data.storedFileName,
      }

      setVideoInfo(info)
      console.log("VIDEO INFO TO STORE:", info)

      // Reset all result state when a new file is loaded
      setHasProcessed(false)
      setRoiCoords(null)
      setStableCrop(null)
      setInferenceTime(null)
      setPreviewImageUrl(null)
      setCropProgress(0)
      setCropProgressMessage("Running neural face detection")

      addLog(
        "info",
        `Source video loaded: ${data.fileName} (videoId: ${data.videoId})`,
        "Mouth Cut"
      )
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Upload failed unexpectedly"
      addLog("error", message, "Mouth Cut")
    }
  }

  // ── run cropping ───────────────────────────────────────────────────────────
  const handleRunCropping = async () => {
    console.log("RUN CROPPING CLICKED")
    console.log("CURRENT videoInfo:", videoInfo)

    if (!videoInfo?.videoId) {
      addLog("warning", "No uploaded backend video found", "Mouth Cut")
      return
    }

    try {
      setIsLocalProcessing(true)
      setIsProcessing(true)
      setHasProcessed(false)
      setRoiCoords(null)
      setStableCrop(null)
      setInferenceTime(null)
      setPreviewImageUrl(null)
      setCropProgress(0)
      setCropProgressMessage("Starting mouth cut...")

      addLog("info", `Starting ROI extraction at ${resolution}...`, "Mouth Cut")

      const res = await fetch("http://127.0.0.1:8000/api/mouth-cut/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          videoId: videoInfo.videoId,
          outputResolution: resolution,
          // Stable-crop geometry — replaces the old cropMarginX / cropMarginY
          paddingPercentX: paddingX,
          paddingPercentY: paddingY,
          cropPercentile: cropPercentile,
          faceTracking: faceTracking,
          grayscale: true,
          normalize: false,
          augment: false,
          minValidFrameRatio: 0.3,
        }),
      })

      if (!res.ok) {
        const errorText = await res.text()
        console.error("Mouth cut API error:", res.status, errorText)
        throw new Error(errorText)
      }

      const reader = res.body.getReader()
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
            setCropProgress(typeof event.progress === "number" ? event.progress : 0)
            setCropProgressMessage(event.message || "Running neural face detection")
            continue
          }

          if (event.type === "error") {
            streamError = event.detail || "Mouth cut failed"
            break
          }

          if (event.type === "result") {
            data = event.data
            setCropProgress(100)
            setCropProgressMessage(event.message || "Mouth cut complete")
          }
        }

        if (streamError) break
      }

      if (streamError) throw new Error(streamError)
      if (!data) throw new Error("Mouth cut finished without result data")

      // Attach the run ID to videoInfo for downstream stages
      setVideoInfo((prev) =>
        prev ? { ...prev, mouthCutRunId: data.runId } : prev
      )

      // roi_coords is always present in the new service (never null)
      setRoiCoords(data.roi_coords ?? null)

      // NEW: store Pass 1 stable crop statistics
      setStableCrop(data.stable_crop ?? null)

      setInferenceTime(data.inference_time ?? null)
      setHasProcessed(true)

      const previewUrl = data.preview_image_url
        ? `http://127.0.0.1:8000${data.preview_image_url}`
        : null
      setPreviewImageUrl(previewUrl)

      setStageStatus(1, "completed")
      setStageStatus(2, "available")

      addLog("success", "ROI extraction complete", "Mouth Cut")
      addLog("info", "Preprocessing stage now available", "Mouth Cut")
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Mouth cut failed unexpectedly"
      addLog("error", message, "Mouth Cut")
    } finally {
      setIsLocalProcessing(false)
      setIsProcessing(false)
    }
  }

  // ── render ─────────────────────────────────────────────────────────────────
  return (
    <ScrollArea className="h-full">
      <div className="p-6">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-foreground">Mouth Cut</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Extract mouth region (ROI) from video using neural face detection
            </p>
          </div>
          {hasProcessed && (
            <Button onClick={() => setCurrentStage(2)} className="gap-2">
              Continue to Preprocessing
              <Play className="h-4 w-4" />
            </Button>
          )}
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-6">
            <UploadCard
              onFileSelect={handleFileSelect}
              hasFile={hasFile}
              fileInfo={fileInfo}
            />
            <CroppingParametersCard
              resolution={resolution}
              setResolution={setResolution}
              paddingX={paddingX}
              setPaddingX={setPaddingX}
              paddingY={paddingY}
              setPaddingY={setPaddingY}
              cropPercentile={cropPercentile}
              setCropPercentile={setCropPercentile}
              faceTracking={faceTracking}
              setFaceTracking={setFaceTracking}
              onRunCropping={handleRunCropping}
              isProcessing={isLocalProcessing}
            />
          </div>

          <ROIPreviewPanel
            hasProcessed={hasProcessed}
            isProcessing={isLocalProcessing}
            progress={cropProgress}
            progressMessage={cropProgressMessage}
            resolution={resolution}
            roiCoords={roiCoords}
            stableCrop={stableCrop}
            inferenceTime={inferenceTime}
            previewImageUrl={previewImageUrl}
          />
        </div>
      </div>
    </ScrollArea>
  )
}