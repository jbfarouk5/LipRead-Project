"use client"

import { useDashboard } from "@/lib/dashboard-context"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  ChevronUp,
  ChevronDown,
  Activity,
  Clock,
  HardDrive,
  Trash2,
} from "lucide-react"
import { cn } from "@/lib/utils"

function formatTime(date: Date): string {
  return date.toLocaleTimeString("en-US", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  })
}

export function BottomPanel() {
  const {
    logs,
    clearLogs,
    isLogPanelOpen,
    setIsLogPanelOpen,
    isProcessing,
    processingStatus,
  } = useDashboard()

  return (
    <div className="flex-shrink-0 border-t border-border bg-card">
      {/* Summary Strip */}
      <div className="flex h-10 items-center justify-between px-4">
        <div className="flex items-center gap-6">
          {/* Processing Status */}
          <div className="flex items-center gap-2">
            <div
              className={cn(
                "h-2 w-2 rounded-full",
                isProcessing ? "animate-pulse bg-primary" : "bg-muted-foreground/30"
              )}
            />
            <span className="text-xs font-medium text-foreground">
              {processingStatus}
            </span>
          </div>

          {/* Metrics */}
          <div className="hidden items-center gap-4 sm:flex">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Activity className="h-3.5 w-3.5" />
              <span>Stage Output:</span>
              <span className="font-medium text-foreground">—</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Clock className="h-3.5 w-3.5" />
              <span>Runtime:</span>
              <span className="font-medium text-foreground">00:00:00</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <HardDrive className="h-3.5 w-3.5" />
              <span>Memory:</span>
              <span className="font-medium text-foreground">—</span>
            </div>
          </div>
        </div>

        {/* Toggle Log Panel */}
        <Collapsible open={isLogPanelOpen} onOpenChange={setIsLogPanelOpen}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="h-7 gap-1.5 text-xs">
              {isLogPanelOpen ? (
                <ChevronDown className="h-3.5 w-3.5" />
              ) : (
                <ChevronUp className="h-3.5 w-3.5" />
              )}
              <span>Logs ({logs.length})</span>
            </Button>
          </CollapsibleTrigger>
        </Collapsible>
      </div>

      {/* Collapsible Log Panel */}
      <Collapsible open={isLogPanelOpen} onOpenChange={setIsLogPanelOpen}>
        <CollapsibleContent>
          <div className="border-t border-border">
            <div className="flex h-8 items-center justify-between border-b border-border bg-muted/30 px-4">
              <span className="text-xs font-medium text-muted-foreground">
                System Console
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 gap-1.5 text-xs"
                onClick={clearLogs}
              >
                <Trash2 className="h-3 w-3" />
                Clear
              </Button>
            </div>
            <ScrollArea className="h-40 bg-background">
              <div className="log-console p-3">
                {logs.length === 0 ? (
                  <p className="text-muted-foreground">No logs yet</p>
                ) : (
                  logs.map((log) => (
                    <div
                      key={log.id}
                      className="flex gap-2 py-0.5 font-mono text-xs"
                    >
                      <span className="text-muted-foreground">
                        [{formatTime(log.timestamp)}]
                      </span>
                      {log.stage && (
                        <span className="text-muted-foreground">
                          [{log.stage}]
                        </span>
                      )}
                      <span
                        className={cn(
                          log.level === "info" && "log-info",
                          log.level === "success" && "log-success",
                          log.level === "warning" && "log-warning",
                          log.level === "error" && "log-error"
                        )}
                      >
                        {log.message}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  )
}
