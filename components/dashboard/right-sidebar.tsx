"use client"

import { useDashboard } from "@/lib/dashboard-context"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  HelpCircle,
  RotateCcw,
  Settings2,
  Cpu,
  Activity,
} from "lucide-react"
import { cn } from "@/lib/utils"

const stageInfo: Record<
  number,
  { title: string; description: string; parameters: string[] }
> = {
  0: {
    title: "Home",
    description: "Manage experiments and start new analyses",
    parameters: ["Auto-save", "Default profile"],
  },
  1: {
    title: "Mouth Cut",
    description: "Extract mouth region from video using neural ROI detection",
    parameters: ["Output Resolution", "Crop Margin", "Face Tracking"],
  },
  2: {
    title: "Preprocessing",
    description: "Segment video into word-level clips for classification",
    parameters: ["Segment Duration", "Overlap", "Audio Sync"],
  },
  3: {
    title: "Image Classification",
    description: "Classify individual frames using CNN model",
    parameters: ["Model", "Batch Size", "Confidence Threshold"],
  },
  4: {
    title: "Video Classification",
    description: "Temporal sequence analysis using LSTM/Transformer",
    parameters: ["Sequence Length", "Attention Heads", "Hidden Size"],
  },
  5: {
    title: "Comparison & Results",
    description: "Compare models and generate final transcription",
    parameters: ["Ensemble Method", "Output Format", "Export Options"],
  },
}

export function RightSidebar() {
  const {
    currentStage,
    isProcessing,
    processingStatus,
    configProfiles,
    activeProfile,
    setActiveProfile,
  } = useDashboard()

  const info = stageInfo[currentStage] || stageInfo[0]

    if (currentStage === 0) {
    return null
  }

  return (
    <aside className="hidden w-64 flex-shrink-0 border-l border-border bg-card lg:block">
      <ScrollArea className="h-full">
        <div className="flex flex-col gap-6 p-4">
          {/* Current Step */}
          <div>
            <div className="mb-2 flex items-center gap-2">
              <Settings2 className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-sm font-medium text-foreground">
                Current Step
              </h3>
            </div>
            <div className="rounded-lg border border-border bg-background p-3">
              <h4 className="font-medium text-foreground">{info.title}</h4>
              <p className="mt-1 text-xs text-muted-foreground">
                {info.description}
              </p>
            </div>
          </div>

          {/* Processing Status */}
          <div>
            <div className="mb-2 flex items-center gap-2">
              <Activity className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-sm font-medium text-foreground">Status</h3>
            </div>
            <div className="rounded-lg border border-border bg-background p-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">State</span>
                <Badge
                  variant={isProcessing ? "default" : "secondary"}
                  className={cn(
                    "text-xs",
                    isProcessing && "bg-primary text-primary-foreground"
                  )}
                >
                  {isProcessing ? "Processing" : "Idle"}
                </Badge>
              </div>
              <div className="mt-2 flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Activity</span>
                <span className="text-xs font-medium text-foreground">
                  {processingStatus}
                </span>
              </div>
            </div>
          </div>

          {/* Parameters Summary */}
          <div>
            <div className="mb-2 flex items-center gap-2">
              <Cpu className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-sm font-medium text-foreground">
                Parameters
              </h3>
            </div>
            <div className="space-y-2">
              {info.parameters.map((param) => (
                <div
                  key={param}
                  className="flex items-center justify-between rounded-md border border-border bg-background px-3 py-2"
                >
                  <span className="text-xs text-muted-foreground">{param}</span>
                  <span className="text-xs font-medium text-foreground">
                    Default
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Saved Profiles */}
          <div>
            <h3 className="mb-2 text-sm font-medium text-foreground">
              Configuration Profile
            </h3>
            <Select
              value={activeProfile || undefined}
              onValueChange={setActiveProfile}
            >
              <SelectTrigger className="h-9 text-xs">
                <SelectValue placeholder="Select profile" />
              </SelectTrigger>
              <SelectContent>
                {configProfiles.map((profile) => (
                  <SelectItem key={profile.id} value={profile.id}>
                    {profile.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {activeProfile && (
              <p className="mt-1.5 text-xs text-muted-foreground">
                {configProfiles.find((p) => p.id === activeProfile)?.description}
              </p>
            )}
          </div>

          {/* Actions */}
          <div className="space-y-2">
            <Button
              variant="outline"
              size="sm"
              className="w-full justify-start gap-2 text-xs"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Reset to Defaults
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="w-full justify-start gap-2 text-xs"
            >
              <HelpCircle className="h-3.5 w-3.5" />
              Contextual Help
            </Button>
          </div>
        </div>
      </ScrollArea>
    </aside>
  )
}
