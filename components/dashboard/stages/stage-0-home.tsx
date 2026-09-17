"use client"

import { useState, useCallback, useRef } from "react"
import { useDashboard, type VideoInfo, type Analysis } from "@/lib/dashboard-context"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Settings2,
  Activity,
  Cpu,
  HelpCircle,
  RotateCcw,
} from "lucide-react"
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
  Film,
  MonitorPlay,
  Gauge,
  FileType,
  MoreVertical,
  ExternalLink,
  BarChart3,
  Trash2,
  AlertCircle,
  CheckCircle2,
  Loader2,
  ChevronRight,
} from "lucide-react"
import { cn } from "@/lib/utils"

/* ─────────────────────────── Upload Zone ─────────────────────────── */

function UploadZone({
  onFileSelect,
  uploadedFileName,
  isUploading,
  uploadProgress,
}: {
  onFileSelect: (file: File) => void
  uploadedFileName?: string | null
  isUploading?: boolean
  uploadProgress?: number
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

  const isUploaded = !!uploadedFileName

  return (
    <div
      className={cn(
        "relative rounded-xl border-2 border-dashed transition-all duration-200 cursor-pointer group",
        isDragging
          ? "border-primary bg-primary/5 scale-[1.005]"
          : "border-border hover:border-primary/50 hover:bg-muted/30"
      )}
      onDragOver={!isUploaded && !isUploading ? handleDragOver : undefined}
      onDragLeave={!isUploaded && !isUploading ? handleDragLeave : undefined}
      onDrop={!isUploaded && !isUploading ? handleDrop : undefined}
    >
      {!isUploaded && !isUploading && (
        <input
          type="file"
          accept="video/mp4,video/quicktime,video/x-msvideo,video/x-matroska"
          className="absolute inset-0 cursor-pointer opacity-0 z-10"
          onChange={handleFileInput}
        />
      )}

      <div className="flex flex-col items-center gap-5 py-12 px-8 text-center">
        <div className="relative">
          {isUploading ? (
            <div className="relative flex h-16 w-16 items-center justify-center">
              <svg className="absolute inset-0 h-16 w-16 -rotate-90" viewBox="0 0 64 64">
                <circle
                  cx="32" cy="32" r="28"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="4"
                  className="text-muted"
                />
                <circle
                  cx="32" cy="32" r="28"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="4"
                  strokeDasharray={`${2 * Math.PI * 28}`}
                  strokeDashoffset={`${2 * Math.PI * 28 * (1 - (uploadProgress ?? 0) / 100)}`}
                  strokeLinecap="round"
                  className="text-primary transition-all duration-300"
                />
              </svg>
              <span className="text-xs font-bold tabular-nums text-primary">
                {Math.round(uploadProgress ?? 0)}%
              </span>
            </div>
          ) : (
            <div
              className={cn(
                "flex h-16 w-16 items-center justify-center rounded-2xl transition-all duration-200",
                isUploaded
                  ? "bg-primary/10 text-primary"
                  : isDragging
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary"
              )}
            >
              {isUploaded ? (
                <CheckCircle2 className="h-9 w-9 text-emerald-500" />
              ) : (
                <Upload className="h-7 w-7" />
              )}
            </div>
          )}

          <span className="absolute -top-1 -left-1 h-3 w-3 rounded-tl-md border-t-2 border-l-2 border-primary/40" />
          <span className="absolute -top-1 -right-1 h-3 w-3 rounded-tr-md border-t-2 border-r-2 border-primary/40" />
          <span className="absolute -bottom-1 -left-1 h-3 w-3 rounded-bl-md border-b-2 border-l-2 border-primary/40" />
          <span className="absolute -bottom-1 -right-1 h-3 w-3 rounded-br-md border-b-2 border-r-2 border-primary/40" />
        </div>

        <div className="space-y-1.5">
          <p className="text-sm font-semibold text-foreground flex items-center justify-center gap-1.5">
            {isUploading ? (
              "Uploading video..."
            ) : isUploaded ? (
              <>
                Your video was uploaded
              </>
            ) : isDragging ? (
              "Release to upload"
            ) : (
              "Drop your video here"
            )}
          </p>

          <p className="text-xs text-muted-foreground">
            {isUploading ? (
              <span className="text-primary font-medium">
                Please wait while your file is being uploaded
              </span>
            ) : isUploaded ? (
              <span className="font-medium text-primary">
                {uploadedFileName}
              </span>
            ) : (
              <>
                or{" "}
                <span className="text-primary font-medium underline underline-offset-2 decoration-dotted">
                  browse files
                </span>
              </>
            )}
          </p>
        </div>

        {!isUploaded && !isUploading && (
          <div className="flex items-center gap-1.5 flex-wrap justify-center">
            {["MP4", "MOV", "AVI", "MKV"].map((fmt) => (
              <span
                key={fmt}
                className="rounded-md bg-muted px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground"
              >
                {fmt}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

/* ─────────────────────────── Video Info Card ─────────────────────────── */

function VideoInfoCard({ info }: { info: VideoInfo }) {
  const infoItems = [
    { icon: FileVideo, label: "File Name", value: info.name },
    { icon: FileType, label: "Format", value: info.format },
    { icon: Clock, label: "Duration", value: info.duration },
    { icon: MonitorPlay, label: "Resolution", value: info.resolution },
    { icon: Gauge, label: "Frame Rate", value: info.frameRate },
    { icon: Film, label: "Size", value: info.size },
  ]

  return (
    <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3">
      {infoItems.map((item) => (
        <div
          key={item.label}
          className="flex flex-col gap-1.5 rounded-lg border border-border bg-muted/30 px-3 py-2.5 hover:bg-muted/50 transition-colors"
        >
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <item.icon className="h-3 w-3 shrink-0" />
            <span className="text-[10px] font-medium uppercase tracking-wide">
              {item.label}
            </span>
          </div>
          <p className="truncate text-sm font-semibold text-foreground leading-none">
            {item.value}
          </p>
        </div>
      ))}
    </div>
  )
}

/* ─────────────────────────── Analysis Card ─────────────────────────── */

function AnalysisCard({
  analysis,
  onOpen,
  onViewResults,
  onDelete,
}: {
  analysis: Analysis
  onOpen: () => void
  onViewResults: () => void
  onDelete: () => void
}) {
  const statusConfig = {
    running: {
      icon: Loader2,
      label: "Running",
      badgeClass: "bg-primary/10 text-primary border-primary/20",
      barClass: "bg-primary",
      iconClass: "animate-spin",
    },
    completed: {
      icon: CheckCircle2,
      label: "Completed",
      badgeClass: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:text-emerald-400",
      barClass: "bg-emerald-500",
      iconClass: "",
    },
    failed: {
      icon: AlertCircle,
      label: "Failed",
      badgeClass: "bg-destructive/10 text-destructive border-destructive/20",
      barClass: "bg-destructive",
      iconClass: "",
    },
  }

  const status = statusConfig[analysis.status]
  const StatusIcon = status.icon

  return (
    <Card className="group relative overflow-hidden transition-all duration-200 hover:shadow-md hover:border-border/80 hover:-translate-y-0.5">
      <div className={cn("absolute inset-x-0 top-0 h-0.5", status.barClass)} />

      <CardContent className="p-4 pt-5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1 space-y-0.5">
            <div className="flex items-center gap-1.5">
              <FileVideo className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <h4 className="truncate text-sm font-semibold text-foreground leading-snug">
                {analysis.videoName}
              </h4>
            </div>
            <p className="text-xs text-muted-foreground pl-5">
              {analysis.uploadDate.toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}{" "}
              &middot; {analysis.duration}
            </p>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 shrink-0 opacity-0 transition-opacity group-hover:opacity-100 data-[state=open]:opacity-100"
              >
                <MoreVertical className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem onClick={onOpen}>
                <ExternalLink className="mr-2 h-3.5 w-3.5" />
                Open Analysis
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onViewResults}>
                <BarChart3 className="mr-2 h-3.5 w-3.5" />
                View Results
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={onDelete}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="mr-2 h-3.5 w-3.5" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="mt-4 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              Progress
            </span>
            <span className="text-xs font-semibold tabular-nums text-foreground">
              {analysis.progress}%
            </span>
          </div>
          <Progress value={analysis.progress} className="h-1" />
        </div>

        <div className="mt-4 flex items-center justify-between">
          <Badge
            variant="outline"
            className={cn("gap-1 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide", status.badgeClass)}
          >
            <StatusIcon className={cn("h-2.5 w-2.5", status.iconClass)} />
            {status.label}
          </Badge>

          {analysis.accuracy != null ? (
            <div className="flex items-baseline gap-1">
              <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Acc.</span>
              <span className="text-sm font-bold text-foreground tabular-nums">
                {analysis.accuracy}%
              </span>
            </div>
          ) : analysis.status === "completed" ? (
            <button
              onClick={onViewResults}
              className="flex items-center gap-0.5 text-xs text-primary font-medium hover:underline"
            >
              Results <ChevronRight className="h-3 w-3" />
            </button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  )
}

/* ─────────────────────────── Sidebar ─────────────────────────── */

function SidebarSection({
  icon: Icon,
  label,
  children,
}: {
  icon: React.ElementType
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          {label}
        </span>
      </div>
      {children}
    </div>
  )
}

function HomeSidebar() {
  const {
    isProcessing,
    processingStatus,
    configProfiles,
    activeProfile,
    setActiveProfile,
  } = useDashboard()

  return (
    <div className="space-y-5">
      <SidebarSection icon={Settings2} label="Current Step">
        <div className="rounded-lg border border-border bg-primary/5 px-3 py-2.5">
          <p className="text-sm font-semibold text-foreground">Home</p>
          <p className="mt-0.5 text-xs text-muted-foreground leading-relaxed">
            Manage experiments and start new analyses
          </p>
        </div>
      </SidebarSection>

      <Separator />

      <SidebarSection icon={Activity} label="Status">
        <div className="rounded-lg border border-border bg-card divide-y divide-border">
          <div className="flex items-center justify-between px-3 py-2">
            <span className="text-xs text-muted-foreground">State</span>
            <Badge
              variant={isProcessing ? "default" : "secondary"}
              className="h-5 px-1.5 text-[10px] font-semibold"
            >
              {isProcessing ? "Processing" : "Idle"}
            </Badge>
          </div>
          <div className="flex items-center justify-between px-3 py-2">
            <span className="text-xs text-muted-foreground">Activity</span>
            <span className="text-xs font-medium text-foreground truncate max-w-[100px] text-right">
              {processingStatus}
            </span>
          </div>
        </div>
      </SidebarSection>

      <Separator />

      <SidebarSection icon={Cpu} label="Parameters">
        <div className="rounded-lg border border-border bg-card divide-y divide-border">
          <div className="flex items-center justify-between px-3 py-2">
            <span className="text-xs text-muted-foreground">Auto-save</span>
            <span className="text-xs font-medium text-foreground">Default</span>
          </div>
          <div className="flex items-center justify-between px-3 py-2">
            <span className="text-xs text-muted-foreground">Default profile</span>
            <span className="text-xs font-medium text-foreground">Default</span>
          </div>
        </div>
      </SidebarSection>

      <Separator />

      <div className="space-y-2">
        <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          Configuration Profile
        </span>
        <Select value={activeProfile || undefined} onValueChange={setActiveProfile}>
          <SelectTrigger className="h-9 rounded-lg bg-card text-xs">
            <SelectValue placeholder="Select profile" />
          </SelectTrigger>
          <SelectContent>
            {configProfiles.map((profile) => (
              <SelectItem key={profile.id} value={profile.id} className="text-xs">
                {profile.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {activeProfile && (
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            {configProfiles.find((p) => p.id === activeProfile)?.description}
          </p>
        )}
      </div>

      <Separator />

      <div className="space-y-1.5">
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start gap-2 h-8 text-xs text-muted-foreground hover:text-foreground"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Reset to Defaults
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start gap-2 h-8 text-xs text-muted-foreground hover:text-foreground"
        >
          <HelpCircle className="h-3.5 w-3.5" />
          Contextual Help
        </Button>
      </div>
    </div>
  )
}

/* ─────────────────────────── Brand / Navbar ─────────────────────────── */

function NavbarBrand() {
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#0f1b2d] text-white shadow-sm">
        <svg
          viewBox="0 0 24 24"
          className="h-5 w-5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
        >
          <circle cx="6" cy="12" r="2" />
          <circle cx="12" cy="6" r="2" />
          <circle cx="18" cy="12" r="2" />
          <circle cx="12" cy="18" r="2" />
          <path d="M8 12h8M12 8v8" />
        </svg>
      </div>

      <div className="leading-tight">
        <div className="text-sm font-semibold text-[#0f1b2d]">
          LipRead AI
        </div>
        <div className="text-[11px] tracking-wide text-[#6b7a90]">
          Neural Engine
        </div>
      </div>
    </div>
  )
}

/* ─────────────────────────── Main Page ─────────────────────────── */

export function Stage0Home() {
  const {
    videoInfo,
    setVideoInfo,
    analyses,
    deleteAnalysis,
    setCurrentStage,
    addLog,
    setStageStatus,
  } = useDashboard()

  const reuploadInputRef = useRef<HTMLInputElement | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)

  const handleFileSelect = async (file: File) => {
    const formData = new FormData()
    formData.append("file", file)
    setIsUploading(true)
    setUploadProgress(0)

    try {
      // Use XMLHttpRequest to track upload progress
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest()
        xhr.open("POST", "http://127.0.0.1:8000/api/uploads/video")

        xhr.upload.addEventListener("progress", (event) => {
          if (event.lengthComputable) {
            setUploadProgress(Math.round((event.loaded / event.total) * 100))
          }
        })

        xhr.addEventListener("load", () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            const data = JSON.parse(xhr.responseText)
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
            addLog("success", `Video uploaded: ${data.fileName}`)
            resolve()
          } else {
            try {
              const err = JSON.parse(xhr.responseText)
              reject(new Error(err.detail || "Upload failed"))
            } catch {
              reject(new Error("Upload failed"))
            }
          }
        })

        xhr.addEventListener("error", () => reject(new Error("Upload failed unexpectedly")))
        xhr.send(formData)
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : "Upload failed unexpectedly"
      addLog("error", message)
    } finally {
      setIsUploading(false)
      setUploadProgress(0)
    }
  }

  const handleReuploadClick = () => {
    reuploadInputRef.current?.click()
  }

  const handleResetVideo = () => {
    setVideoInfo(null)
    addLog("info", "Uploaded video cleared")
  }

  const handleStartProcessing = () => {
    if (!videoInfo) return
    addLog("info", "Starting processing pipeline...")
    addLog("success", "Video loaded successfully, proceeding to Mouth Cut stage")
    setStageStatus(1, "active")
    setCurrentStage(1)
  }

  const handleOpenAnalysis = (analysis: Analysis) => {
    addLog("info", `Opening analysis: ${analysis.videoName}`)
    setCurrentStage(analysis.status === "completed" ? 5 : 1)
  }

  return (
    <ScrollArea className="h-full">
      <div className="flex items-center justify-between border-b border-[#e4e9f1] bg-white px-6 py-3">
        <NavbarBrand />

        <div className="flex items-center gap-5 text-xs text-[#6b7a90]">
          <span className="cursor-pointer hover:text-[#00c8c8]">Save Config</span>
          <span className="cursor-pointer hover:text-[#00c8c8]">Load Config</span>
        </div>
      </div>

      <div className="w-full p-6 bg-[#f2f5f9] min-h-screen">
        <div className="grid gap-6 xl:grid-cols-[240px_minmax(0,1fr)]">
          <aside className="xl:sticky xl:top-6 xl:self-start">
            <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
              <HomeSidebar />
            </div>
          </aside>

          <main className="min-w-0 space-y-8">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground">
                Workspace
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Start a new analysis, manage experiments, and resume recent work.
              </p>
            </div>

            <Card className="shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2.5 text-base font-semibold">
                  <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10">
                    <Play className="h-3.5 w-3.5 text-primary" />
                  </div>
                  Start New Analysis
                </CardTitle>
              </CardHeader>

              <CardContent className="space-y-0">
                <UploadZone
                  onFileSelect={handleFileSelect}
                  uploadedFileName={videoInfo?.name ?? null}
                  isUploading={isUploading}
                  uploadProgress={uploadProgress}
                />

                <input
                  ref={reuploadInputRef}
                  type="file"
                  accept="video/mp4,video/quicktime,video/x-msvideo,video/x-matroska"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) handleFileSelect(file)
                    e.currentTarget.value = ""
                  }}
                />

                {videoInfo && (
                  <>
                    <VideoInfoCard info={videoInfo} />

                    <div className="mt-6 flex flex-wrap justify-end gap-3">
                      <Button
                        type="button"
                        size="default"
                        className="gap-2 rounded-lg px-6 bg-[#0f1b2d] text-white hover:bg-[#00c8c8] transition-colors"
                        onClick={handleReuploadClick}
                      >
                        <Upload className="h-4 w-4" />
                        Reupload
                      </Button>

                      <Button
                        type="button"
                        size="default"
                        className="gap-2 rounded-lg px-6 bg-[#0f1b2d] text-white hover:bg-red-500 transition-colors"
                        onClick={handleResetVideo}
                      >
                        <RotateCcw className="h-4 w-4" />
                        Reset
                      </Button>

                      <Button
                        type="button"
                        size="default"
                        className="gap-2 rounded-lg px-6 bg-[#0f1b2d] text-white hover:bg-[#00c8c8] transition-colors"
                        onClick={handleStartProcessing}
                      >
                        <Play className="h-4 w-4" />
                        Start Processing
                      </Button>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            <div>
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h2 className="text-base font-semibold text-foreground">
                    Recent Analyses
                  </h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {analyses.length} experiment{analyses.length !== 1 ? "s" : ""}
                  </p>
                </div>
              </div>

              {analyses.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-12 text-center">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted mb-3">
                    <FileVideo className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <p className="text-sm font-medium text-foreground">No analyses yet</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Upload a video above to get started.
                  </p>
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {analyses.map((analysis) => (
                    <AnalysisCard
                      key={analysis.id}
                      analysis={analysis}
                      onOpen={() => handleOpenAnalysis(analysis)}
                      onViewResults={() => {
                        addLog("info", `Viewing results for: ${analysis.videoName}`)
                      }}
                      onDelete={() => {
                        deleteAnalysis(analysis.id)
                        addLog("warning", `Deleted analysis: ${analysis.videoName}`)
                      }}
                    />
                  ))}
                </div>
              )}
            </div>
          </main>
        </div>
      </div>
    </ScrollArea>
  )
}