"use client"

import { useTheme } from "next-themes"
import { useDashboard, type StageStatus } from "@/lib/dashboard-context"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  Lock,
  Check,
  AlertTriangle,
  Sun,
  Moon,
  Download,
  Save,
  FolderOpen,
  ChevronRight,
} from "lucide-react"
import { cn } from "@/lib/utils"

function StageIcon({ status }: { status: StageStatus }) {
  switch (status) {
    case "blocked":
      return <Lock className="h-3.5 w-3.5" />
    case "completed":
      return <Check className="h-3.5 w-3.5" />
    case "error":
      return <AlertTriangle className="h-3.5 w-3.5" />
    default:
      return null
  }
}

function WorkflowStage({
  name,
  status,
  isLast,
  onClick,
}: {
  name: string
  status: StageStatus
  isLast: boolean
  onClick: () => void
}) {
  const isClickable = status === "available" || status === "active" || status === "completed"

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center">
            <button
              onClick={onClick}
              disabled={!isClickable}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all",
                status === "active" &&
                  "bg-primary text-primary-foreground shadow-sm",
                status === "completed" &&
                  "bg-success/10 text-success hover:bg-success/20",
                status === "available" &&
                  "bg-secondary text-secondary-foreground hover:bg-secondary/80",
                status === "blocked" &&
                  "cursor-not-allowed bg-muted/50 text-muted-foreground",
                status === "error" &&
                  "bg-destructive/10 text-destructive hover:bg-destructive/20"
              )}
            >
              <StageIcon status={status} />
              <span>{name}</span>
            </button>
            {!isLast && (
              <ChevronRight className="mx-1 h-4 w-4 text-muted-foreground/50" />
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p className="capitalize">{status}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

export function TopNavbar() {
  const { theme, setTheme } = useTheme()
  const { workflowStages, setCurrentStage, currentStage } = useDashboard()

  const handleStageClick = (stageId: number) => {
    const stage = workflowStages.find((s) => s.id === stageId)
    if (
      stage &&
      (stage.status === "available" ||
        stage.status === "active" ||
        stage.status === "completed")
    ) {
      setCurrentStage(stageId)
    }
  }

  return (
    <header className="sticky top-0 z-50 flex h-14 items-center justify-between border-b border-border bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      {/* Left - Logo */}
      <button
        onClick={() => setCurrentStage(0)}
        className="flex items-baseline gap-2 transition-opacity hover:opacity-80"
      >
        <span className="text-lg font-semibold tracking-tight text-foreground">
          LipRead AI
        </span>
        <span className="text-xs font-medium text-muted-foreground">
          Neural Engine
        </span>
      </button>

      {/* Center - Workflow Progress */}
      <nav className="hidden items-center gap-0.5 md:flex">
        {workflowStages.map((stage, index) => (
          <WorkflowStage
            key={stage.id}
            name={stage.name}
            status={currentStage === stage.id ? "active" : stage.status}
            isLast={index === workflowStages.length - 1}
            onClick={() => handleStageClick(stage.id)}
          />
        ))}
      </nav>

      {/* Right - Controls */}
      <div className="flex items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-xs">
              <Save className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Save Config</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem>Save to Profile</DropdownMenuItem>
            <DropdownMenuItem>Save as New...</DropdownMenuItem>
            <DropdownMenuItem>Export to File</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-xs">
              <FolderOpen className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Load Config</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem>Default</DropdownMenuItem>
            <DropdownMenuItem>High Accuracy</DropdownMenuItem>
            <DropdownMenuItem>Fast Processing</DropdownMenuItem>
            <DropdownMenuItem>Import from File...</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              >
                <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
                <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
                <span className="sr-only">Toggle theme</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Toggle theme</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
          <Download className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Download</span>
        </Button>
      </div>
    </header>
  )
}
