"use client"

import { createContext, useContext, useState, ReactNode } from "react"

export type StageStatus = "blocked" | "available" | "active" | "completed" | "error"

export interface WorkflowStage {
  id: number
  name: string
  status: StageStatus
}

export interface LogEntry {
  id: string
  timestamp: Date
  level: "info" | "success" | "warning" | "error"
  message: string
  stage?: string
}

export type VideoInfo = {
  videoId: string
  mediaFileId?: string
  mouthCutRunId?: string
  name: string
  size: string
  duration: string
  resolution: string
  frameRate: string
  format: string
  filePath: string
  storedFileName: string
}

export interface Analysis {
  id: string
  videoName: string
  uploadDate: Date
  duration: string
  progress: number
  accuracy?: number
  status: "running" | "completed" | "failed"
}

export interface ConfigProfile {
  id: string
  name: string
  description: string
}

interface DashboardContextType {
  // Current stage (0 = Home, 1-5 = workflow stages)
  currentStage: number
  setCurrentStage: (stage: number) => void
  
  // Workflow stages
  workflowStages: WorkflowStage[]
  setStageStatus: (stageId: number, status: StageStatus) => void
  
  // Logs
  logs: LogEntry[]
  addLog: (level: LogEntry["level"], message: string, stage?: string) => void
  clearLogs: () => void
  
  // Log panel
  isLogPanelOpen: boolean
  setIsLogPanelOpen: (open: boolean) => void
  
  // Video info
  videoInfo: VideoInfo | null
  setVideoInfo: (info: VideoInfo | null) => void
  
  // Analyses
  analyses: Analysis[]
  addAnalysis: (analysis: Omit<Analysis, "id">) => void
  updateAnalysis: (id: string, updates: Partial<Analysis>) => void
  deleteAnalysis: (id: string) => void
  
  // Processing status
  isProcessing: boolean
  setIsProcessing: (processing: boolean) => void
  processingStatus: string
  setProcessingStatus: (status: string) => void
  
  // Config profiles
  configProfiles: ConfigProfile[]
  activeProfile: string | null
  setActiveProfile: (id: string | null) => void
}

const DashboardContext = createContext<DashboardContextType | undefined>(undefined)

const initialWorkflowStages: WorkflowStage[] = [
  { id: 1, name: "Mouth Cut", status: "available" },
  { id: 2, name: "Preprocessing", status: "blocked" },
  { id: 3, name: "Image Classification", status: "blocked" },
  { id: 4, name: "Video Classification", status: "blocked" },
  { id: 5, name: "Comparison & Results", status: "blocked" },
]

const initialAnalyses: Analysis[] = [
  {
    id: "1",
    videoName: "interview_sample_001.mp4",
    uploadDate: new Date(Date.now() - 86400000 * 2),
    duration: "2:34",
    progress: 100,
    accuracy: 94.2,
    status: "completed",
  },
  {
    id: "2",
    videoName: "lecture_recording.mov",
    uploadDate: new Date(Date.now() - 86400000),
    duration: "15:22",
    progress: 67,
    status: "running",
  },
  {
    id: "3",
    videoName: "presentation_demo.mp4",
    uploadDate: new Date(Date.now() - 86400000 * 5),
    duration: "8:45",
    progress: 100,
    accuracy: 89.7,
    status: "completed",
  },
]

const initialConfigProfiles: ConfigProfile[] = [
  { id: "1", name: "Default", description: "Standard processing configuration" },
  { id: "2", name: "High Accuracy", description: "Optimized for maximum accuracy" },
  { id: "3", name: "Fast Processing", description: "Optimized for speed" },
]

export function DashboardProvider({ children }: { children: ReactNode }) {
  const [currentStage, setCurrentStage] = useState(0)
  const [workflowStages, setWorkflowStages] = useState<WorkflowStage[]>(initialWorkflowStages)
  const [logs, setLogs] = useState<LogEntry[]>([
    {
      id: "init-1",
      timestamp: new Date(),
      level: "info",
      message: "LipRead AI Neural Engine initialized",
    },
    {
      id: "init-2",
      timestamp: new Date(),
      level: "success",
      message: "System ready for processing",
    },
  ])
  const [isLogPanelOpen, setIsLogPanelOpen] = useState(false)
  const [videoInfo, setVideoInfo] = useState<VideoInfo | null>(null)
  const [analyses, setAnalyses] = useState<Analysis[]>(initialAnalyses)
  const [isProcessing, setIsProcessing] = useState(false)
  const [processingStatus, setProcessingStatus] = useState("Idle")
  const [configProfiles] = useState<ConfigProfile[]>(initialConfigProfiles)
  const [activeProfile, setActiveProfile] = useState<string | null>("1")

  const setStageStatus = (stageId: number, status: StageStatus) => {
    setWorkflowStages((prev) =>
      prev.map((stage) =>
        stage.id === stageId ? { ...stage, status } : stage
      )
    )
  }

  const addLog = (level: LogEntry["level"], message: string, stage?: string) => {
    const newLog: LogEntry = {
      id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      level,
      message,
      stage,
    }
    setLogs((prev) => [...prev, newLog])
  }

  const clearLogs = () => {
    setLogs([])
  }

  const addAnalysis = (analysis: Omit<Analysis, "id">) => {
    const newAnalysis: Analysis = {
      ...analysis,
      id: `analysis-${Date.now()}`,
    }
    setAnalyses((prev) => [newAnalysis, ...prev])
  }

  const updateAnalysis = (id: string, updates: Partial<Analysis>) => {
    setAnalyses((prev) =>
      prev.map((analysis) =>
        analysis.id === id ? { ...analysis, ...updates } : analysis
      )
    )
  }

  const deleteAnalysis = (id: string) => {
    setAnalyses((prev) => prev.filter((analysis) => analysis.id !== id))
  }

  return (
    <DashboardContext.Provider
      value={{
        currentStage,
        setCurrentStage,
        workflowStages,
        setStageStatus,
        logs,
        addLog,
        clearLogs,
        isLogPanelOpen,
        setIsLogPanelOpen,
        videoInfo,
        setVideoInfo,
        analyses,
        addAnalysis,
        updateAnalysis,
        deleteAnalysis,
        isProcessing,
        setIsProcessing,
        processingStatus,
        setProcessingStatus,
        configProfiles,
        activeProfile,
        setActiveProfile,
      }}
    >
      {children}
    </DashboardContext.Provider>
  )
}

export function useDashboard() {
  const context = useContext(DashboardContext)
  if (context === undefined) {
    throw new Error("useDashboard must be used within a DashboardProvider")
  }
  return context
}
