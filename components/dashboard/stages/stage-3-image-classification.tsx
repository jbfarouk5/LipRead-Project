"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Slider } from "@/components/ui/slider"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useDashboard } from "@/lib/dashboard-context"
import {
  Play,
  Brain,
  Layers,
  BarChart3,
  Grid3X3,
  Zap,
  Target,
  TrendingUp,
  Activity,
  CheckCircle2,
  Clock,
  Cpu,
  Network,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  Download,
  Settings2,
  Eye,
  Sparkles,
  Box,
  PieChart,
} from "lucide-react"

// Mock data for frame classifications
const mockFrameResults = Array.from({ length: 24 }, (_, i) => ({
  frameIndex: i,
  timestamp: `0:${String(Math.floor(i / 8)).padStart(2, "0")}:${String((i % 8) * 125).padStart(3, "0")}`,
  predictedLabel: ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"][Math.floor(Math.random() * 10)],
  confidence: 0.75 + Math.random() * 0.24,
  topPredictions: [
    { label: "A", probability: 0.85 + Math.random() * 0.14 },
    { label: "B", probability: 0.05 + Math.random() * 0.1 },
    { label: "C", probability: 0.01 + Math.random() * 0.05 },
  ],
  featureActivation: Math.random() * 100,
  attentionScore: Math.random(),
}))

// Mock class distribution data
const classDistribution = [
  { label: "A", count: 45, percentage: 18.7 },
  { label: "B", count: 38, percentage: 15.8 },
  { label: "C", count: 32, percentage: 13.3 },
  { label: "D", count: 28, percentage: 11.7 },
  { label: "E", count: 25, percentage: 10.4 },
  { label: "F", count: 22, percentage: 9.2 },
  { label: "G", count: 18, percentage: 7.5 },
  { label: "H", count: 15, percentage: 6.3 },
  { label: "I", count: 10, percentage: 4.2 },
  { label: "J", count: 7, percentage: 2.9 },
]

// Confusion matrix mock data
const confusionMatrixData = Array.from({ length: 10 }, () =>
  Array.from({ length: 10 }, () => Math.floor(Math.random() * 50))
)

export function Stage3ImageClassification() {
  const { addLog, setStageStatus, setProcessingStatus } = useDashboard()
  const [isProcessing, setIsProcessing] = useState(false)
  const [progress, setProgress] = useState(0)
  const [hasResults, setHasResults] = useState(false)
  const [selectedFrame, setSelectedFrame] = useState(0)
  const [viewMode, setViewMode] = useState<"grid" | "detail">("grid")
  
  // Model configuration
  const [modelConfig, setModelConfig] = useState({
    architecture: "resnet50",
    batchSize: 32,
    confidenceThreshold: 0.7,
    enableAugmentation: true,
    enableAttentionMaps: true,
  })

  // Metrics state
  const [metrics, setMetrics] = useState({
    accuracy: 0,
    precision: 0,
    recall: 0,
    f1Score: 0,
    totalFrames: 0,
    processedFrames: 0,
    avgInferenceTime: 0,
    gpuUtilization: 0,
  })

  const runClassification = () => {
    setIsProcessing(true)
    setProgress(0)
    setProcessingStatus("Running image classification...")
    addLog("info", "Starting frame-by-frame image classification", "Image Classification")
    addLog("info", `Model: ${modelConfig.architecture}, Batch Size: ${modelConfig.batchSize}`, "Image Classification")

    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval)
          setIsProcessing(false)
          setHasResults(true)
          setProcessingStatus("Classification complete")
          setStageStatus(3, "completed")
          setStageStatus(4, "available")
          
          // Set final metrics
          setMetrics({
            accuracy: 92.4,
            precision: 91.8,
            recall: 93.1,
            f1Score: 92.4,
            totalFrames: 240,
            processedFrames: 240,
            avgInferenceTime: 12.3,
            gpuUtilization: 87,
          })
          
          addLog("success", "Image classification completed - Accuracy: 92.4%", "Image Classification")
          return 100
        }
        
        // Update intermediate metrics
        const processedCount = Math.floor((prev / 100) * 240)
        setMetrics((m) => ({
          ...m,
          processedFrames: processedCount,
          totalFrames: 240,
          avgInferenceTime: 10 + Math.random() * 5,
          gpuUtilization: 80 + Math.random() * 15,
        }))
        
        return prev + 2
      })
    }, 100)
  }

  return (
    <div className="flex h-full flex-col gap-4 p-6 overflow-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Image Classification</h1>
          <p className="text-sm text-muted-foreground">Frame-by-frame neural network classification</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="font-mono text-xs">
            <Cpu className="mr-1 h-3 w-3" />
            GPU: {metrics.gpuUtilization.toFixed(0)}%
          </Badge>
          <Badge variant={hasResults ? "default" : "secondary"} className="capitalize">
            {hasResults ? "Completed" : isProcessing ? "Processing" : "Ready"}
          </Badge>
        </div>
      </div>

      <div className="grid flex-1 gap-4 lg:grid-cols-3">
        {/* Left Column - Configuration & Controls */}
        <div className="space-y-4">
          {/* Model Configuration */}
          <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm font-medium">
                <Brain className="h-4 w-4 text-primary" />
                Model Configuration
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Architecture</Label>
                <Select
                  value={modelConfig.architecture}
                  onValueChange={(v) => setModelConfig((c) => ({ ...c, architecture: v }))}
                  disabled={isProcessing}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="resnet50">MobileNetV2</SelectItem>
                    <SelectItem value="resnet101">ResNet-101</SelectItem>
                    <SelectItem value="efficientnet">EfficientNet-B4</SelectItem>
                    <SelectItem value="vit">Vision Transformer (ViT)</SelectItem>
                    <SelectItem value="convnext">ConvNeXt-Base</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Batch Size</Label>
                <Select
                  value={String(modelConfig.batchSize)}
                  onValueChange={(v) => setModelConfig((c) => ({ ...c, batchSize: Number(v) }))}
                  disabled={isProcessing}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="8">8</SelectItem>
                    <SelectItem value="16">16</SelectItem>
                    <SelectItem value="32">32 (Recommended)</SelectItem>
                    <SelectItem value="64">64</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-xs text-muted-foreground">Confidence Threshold</Label>
                  <span className="font-mono text-xs text-foreground">
                    {(modelConfig.confidenceThreshold * 100).toFixed(0)}%
                  </span>
                </div>
                <Slider
                  value={[modelConfig.confidenceThreshold * 100]}
                  onValueChange={([v]) => setModelConfig((c) => ({ ...c, confidenceThreshold: v / 100 }))}
                  min={50}
                  max={99}
                  step={1}
                  disabled={isProcessing}
                />
              </div>

              <div className="space-y-3 border-t border-border/50 pt-3">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-xs">Data Augmentation</Label>
                    <p className="text-xs text-muted-foreground">Apply test-time augmentation</p>
                  </div>
                  <Switch
                    checked={modelConfig.enableAugmentation}
                    onCheckedChange={(v) => setModelConfig((c) => ({ ...c, enableAugmentation: v }))}
                    disabled={isProcessing}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-xs">Attention Maps</Label>
                    <p className="text-xs text-muted-foreground">Generate Grad-CAM visualizations</p>
                  </div>
                  <Switch
                    checked={modelConfig.enableAttentionMaps}
                    onCheckedChange={(v) => setModelConfig((c) => ({ ...c, enableAttentionMaps: v }))}
                    disabled={isProcessing}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Processing Controls */}
          <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm font-medium">
                <Settings2 className="h-4 w-4 text-primary" />
                Processing
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {isProcessing && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Processing frames...</span>
                    <span className="font-mono text-foreground">{progress.toFixed(0)}%</span>
                  </div>
                  <Progress value={progress} className="h-2" />
                  <p className="text-xs text-muted-foreground">
                    {metrics.processedFrames} / {metrics.totalFrames} frames
                  </p>
                </div>
              )}

              <Button
                className="w-full"
                onClick={runClassification}
                disabled={isProcessing}
              >
                {isProcessing ? (
                  <>
                    <Activity className="mr-2 h-4 w-4 animate-pulse" />
                    Classifying...
                  </>
                ) : (
                  <>
                    <Play className="mr-2 h-4 w-4" />
                    Run Classification
                  </>
                )}
              </Button>

              {hasResults && (
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="flex-1">
                    <RotateCcw className="mr-2 h-3 w-3" />
                    Reset
                  </Button>
                  <Button variant="outline" size="sm" className="flex-1">
                    <Download className="mr-2 h-3 w-3" />
                    Export
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Quick Stats */}
          {hasResults && (
            <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-sm font-medium">
                  <Zap className="h-4 w-4 text-primary" />
                  Performance
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Avg. Inference Time</span>
                  <span className="font-mono text-xs text-foreground">{metrics.avgInferenceTime.toFixed(1)}ms</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Throughput</span>
                  <span className="font-mono text-xs text-foreground">{(1000 / metrics.avgInferenceTime).toFixed(1)} fps</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Total Frames</span>
                  <span className="font-mono text-xs text-foreground">{metrics.totalFrames}</span>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Center & Right - Results Display */}
        <div className="lg:col-span-2 space-y-4">
          {!hasResults ? (
            <Card className="flex h-full min-h-[400px] items-center justify-center border-dashed border-border/50 bg-card/30">
              <div className="text-center">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted/50">
                  <Brain className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-medium text-foreground">Ready for Classification</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Configure the model and run classification to see results
                </p>
              </div>
            </Card>
          ) : (
            <>
              {/* Metrics Overview */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Card className="border-border/50 bg-gradient-to-br from-emerald-500/10 to-transparent">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <Target className="h-5 w-5 text-emerald-500" />
                      <Badge variant="outline" className="text-xs text-emerald-600 border-emerald-500/30">
                        Accuracy
                      </Badge>
                    </div>
                    <div className="mt-3">
                      <div className="text-2xl font-bold text-foreground">{metrics.accuracy}%</div>
                      <p className="text-xs text-muted-foreground">Overall accuracy</p>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-border/50 bg-gradient-to-br from-blue-500/10 to-transparent">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <TrendingUp className="h-5 w-5 text-blue-500" />
                      <Badge variant="outline" className="text-xs text-blue-600 border-blue-500/30">
                        Precision
                      </Badge>
                    </div>
                    <div className="mt-3">
                      <div className="text-2xl font-bold text-foreground">{metrics.precision}%</div>
                      <p className="text-xs text-muted-foreground">Weighted avg</p>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-border/50 bg-gradient-to-br from-purple-500/10 to-transparent">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <Activity className="h-5 w-5 text-purple-500" />
                      <Badge variant="outline" className="text-xs text-purple-600 border-purple-500/30">
                        Recall
                      </Badge>
                    </div>
                    <div className="mt-3">
                      <div className="text-2xl font-bold text-foreground">{metrics.recall}%</div>
                      <p className="text-xs text-muted-foreground">Weighted avg</p>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-border/50 bg-gradient-to-br from-amber-500/10 to-transparent">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <Sparkles className="h-5 w-5 text-amber-500" />
                      <Badge variant="outline" className="text-xs text-amber-600 border-amber-500/30">
                        F1 Score
                      </Badge>
                    </div>
                    <div className="mt-3">
                      <div className="text-2xl font-bold text-foreground">{metrics.f1Score}%</div>
                      <p className="text-xs text-muted-foreground">Harmonic mean</p>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Detailed Results Tabs */}
              <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
                <Tabs defaultValue="frames" className="w-full">
                  <CardHeader className="pb-0">
                    <div className="flex items-center justify-between">
                      <TabsList className="grid w-fit grid-cols-4">
                        <TabsTrigger value="frames" className="text-xs">
                          <Grid3X3 className="mr-1.5 h-3 w-3" />
                          Frames
                        </TabsTrigger>
                        <TabsTrigger value="distribution" className="text-xs">
                          <BarChart3 className="mr-1.5 h-3 w-3" />
                          Distribution
                        </TabsTrigger>
                        <TabsTrigger value="confusion" className="text-xs">
                          <Box className="mr-1.5 h-3 w-3" />
                          Confusion
                        </TabsTrigger>
                        <TabsTrigger value="attention" className="text-xs">
                          <Eye className="mr-1.5 h-3 w-3" />
                          Attention
                        </TabsTrigger>
                      </TabsList>
                      <div className="flex items-center gap-2">
                        <Button
                          variant={viewMode === "grid" ? "secondary" : "ghost"}
                          size="sm"
                          onClick={() => setViewMode("grid")}
                        >
                          <Grid3X3 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant={viewMode === "detail" ? "secondary" : "ghost"}
                          size="sm"
                          onClick={() => setViewMode("detail")}
                        >
                          <Layers className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="pt-4">
                    <TabsContent value="frames" className="mt-0">
                      {viewMode === "grid" ? (
                        <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 md:grid-cols-8">
                          {mockFrameResults.map((frame, idx) => (
                            <button
                              key={idx}
                              onClick={() => {
                                setSelectedFrame(idx)
                                setViewMode("detail")
                              }}
                              className={`group relative aspect-square overflow-hidden rounded-lg border transition-all hover:ring-2 hover:ring-primary ${
                                selectedFrame === idx ? "ring-2 ring-primary" : "border-border/50"
                              }`}
                            >
                              <div className="absolute inset-0 bg-gradient-to-br from-muted to-muted/50" />
                              <div className="absolute inset-0 flex flex-col items-center justify-center">
                                <span className="text-lg font-bold text-foreground">{frame.predictedLabel}</span>
                                <span className="text-xs text-muted-foreground">
                                  {(frame.confidence * 100).toFixed(0)}%
                                </span>
                              </div>
                              <div className="absolute bottom-0 left-0 right-0 h-1 bg-muted">
                                <div
                                  className="h-full bg-primary transition-all"
                                  style={{ width: `${frame.confidence * 100}%` }}
                                />
                              </div>
                              <div className="absolute left-1 top-1 rounded bg-background/80 px-1 py-0.5 text-xs font-mono">
                                {idx + 1}
                              </div>
                            </button>
                          ))}
                        </div>
                      ) : (
                        <div className="space-y-4">
                          <div className="flex items-center justify-between">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setSelectedFrame(Math.max(0, selectedFrame - 1))}
                              disabled={selectedFrame === 0}
                            >
                              <ChevronLeft className="h-4 w-4" />
                            </Button>
                            <span className="text-sm text-muted-foreground">
                              Frame {selectedFrame + 1} of {mockFrameResults.length}
                            </span>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setSelectedFrame(Math.min(mockFrameResults.length - 1, selectedFrame + 1))}
                              disabled={selectedFrame === mockFrameResults.length - 1}
                            >
                              <ChevronRight className="h-4 w-4" />
                            </Button>
                          </div>

                          <div className="grid gap-4 md:grid-cols-2">
                            {/* Frame Preview */}
                            <Card className="border-border/30">
                              <CardContent className="p-4">
                                <div className="aspect-square rounded-lg bg-gradient-to-br from-muted to-muted/50 flex items-center justify-center">
                                  <div className="text-center">
                                    <div className="text-6xl font-bold text-foreground">
                                      {mockFrameResults[selectedFrame].predictedLabel}
                                    </div>
                                    <div className="mt-2 text-sm text-muted-foreground">
                                      Predicted Label
                                    </div>
                                  </div>
                                </div>
                              </CardContent>
                            </Card>

                            {/* Frame Details */}
                            <div className="space-y-4">
                              <Card className="border-border/30">
                                <CardHeader className="pb-2">
                                  <CardTitle className="text-sm">Prediction Details</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-3">
                                  <div className="flex items-center justify-between">
                                    <span className="text-sm text-muted-foreground">Confidence</span>
                                    <span className="font-mono text-sm font-medium text-foreground">
                                      {(mockFrameResults[selectedFrame].confidence * 100).toFixed(1)}%
                                    </span>
                                  </div>
                                  <Progress
                                    value={mockFrameResults[selectedFrame].confidence * 100}
                                    className="h-2"
                                  />
                                  <div className="flex items-center justify-between">
                                    <span className="text-sm text-muted-foreground">Timestamp</span>
                                    <span className="font-mono text-sm text-foreground">
                                      {mockFrameResults[selectedFrame].timestamp}
                                    </span>
                                  </div>
                                  <div className="flex items-center justify-between">
                                    <span className="text-sm text-muted-foreground">Attention Score</span>
                                    <span className="font-mono text-sm text-foreground">
                                      {mockFrameResults[selectedFrame].attentionScore.toFixed(3)}
                                    </span>
                                  </div>
                                </CardContent>
                              </Card>

                              <Card className="border-border/30">
                                <CardHeader className="pb-2">
                                  <CardTitle className="text-sm">Top Predictions</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-2">
                                  {mockFrameResults[selectedFrame].topPredictions.map((pred, i) => (
                                    <div key={pred.label} className="flex items-center gap-3">
                                      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-xs font-medium">
                                        {i + 1}
                                      </div>
                                      <div className="flex-1">
                                        <div className="flex items-center justify-between">
                                          <span className="font-medium text-foreground">{pred.label}</span>
                                          <span className="font-mono text-xs text-muted-foreground">
                                            {(pred.probability * 100).toFixed(1)}%
                                          </span>
                                        </div>
                                        <Progress value={pred.probability * 100} className="mt-1 h-1" />
                                      </div>
                                    </div>
                                  ))}
                                </CardContent>
                              </Card>
                            </div>
                          </div>
                        </div>
                      )}
                    </TabsContent>

                    <TabsContent value="distribution" className="mt-0">
                      <div className="space-y-4">
                        <div className="grid gap-4 md:grid-cols-2">
                          {/* Bar Chart */}
                          <Card className="border-border/30">
                            <CardHeader className="pb-2">
                              <CardTitle className="text-sm">Class Distribution</CardTitle>
                              <CardDescription className="text-xs">
                                Number of frames per predicted class
                              </CardDescription>
                            </CardHeader>
                            <CardContent>
                              <div className="space-y-2">
                                {classDistribution.map((item) => (
                                  <div key={item.label} className="flex items-center gap-3">
                                    <span className="w-6 text-center font-mono text-sm font-medium text-foreground">
                                      {item.label}
                                    </span>
                                    <div className="flex-1">
                                      <div
                                        className="h-6 rounded bg-primary/80 transition-all flex items-center justify-end pr-2"
                                        style={{ width: `${item.percentage * 4}%` }}
                                      >
                                        <span className="text-xs font-medium text-primary-foreground">
                                          {item.count}
                                        </span>
                                      </div>
                                    </div>
                                    <span className="w-12 text-right font-mono text-xs text-muted-foreground">
                                      {item.percentage}%
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </CardContent>
                          </Card>

                          {/* Statistics */}
                          <Card className="border-border/30">
                            <CardHeader className="pb-2">
                              <CardTitle className="text-sm">Statistics</CardTitle>
                              <CardDescription className="text-xs">
                                Classification summary metrics
                              </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                              <div className="grid grid-cols-2 gap-4">
                                <div className="rounded-lg bg-muted/50 p-3">
                                  <div className="text-xs text-muted-foreground">Total Classes</div>
                                  <div className="text-2xl font-bold text-foreground">10</div>
                                </div>
                                <div className="rounded-lg bg-muted/50 p-3">
                                  <div className="text-xs text-muted-foreground">Total Frames</div>
                                  <div className="text-2xl font-bold text-foreground">240</div>
                                </div>
                                <div className="rounded-lg bg-muted/50 p-3">
                                  <div className="text-xs text-muted-foreground">Dominant Class</div>
                                  <div className="text-2xl font-bold text-foreground">A</div>
                                </div>
                                <div className="rounded-lg bg-muted/50 p-3">
                                  <div className="text-xs text-muted-foreground">Avg Confidence</div>
                                  <div className="text-2xl font-bold text-foreground">89.2%</div>
                                </div>
                              </div>

                              <div className="space-y-2 border-t border-border/50 pt-4">
                                <div className="flex items-center justify-between text-sm">
                                  <span className="text-muted-foreground">High Confidence (&gt;90%)</span>
                                  <span className="font-mono text-foreground">186 frames</span>
                                </div>
                                <div className="flex items-center justify-between text-sm">
                                  <span className="text-muted-foreground">Medium Confidence (70-90%)</span>
                                  <span className="font-mono text-foreground">48 frames</span>
                                </div>
                                <div className="flex items-center justify-between text-sm">
                                  <span className="text-muted-foreground">Low Confidence (&lt;70%)</span>
                                  <span className="font-mono text-foreground">6 frames</span>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        </div>
                      </div>
                    </TabsContent>

                    <TabsContent value="confusion" className="mt-0">
                      <Card className="border-border/30">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm">Confusion Matrix</CardTitle>
                          <CardDescription className="text-xs">
                            Predicted vs actual class distribution
                          </CardDescription>
                        </CardHeader>
                        <CardContent>
                          <div className="overflow-x-auto">
                            <div className="inline-block">
                              <div className="flex">
                                <div className="w-8" />
                                {["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"].map((label) => (
                                  <div key={label} className="w-10 text-center text-xs font-medium text-muted-foreground">
                                    {label}
                                  </div>
                                ))}
                              </div>
                              {confusionMatrixData.map((row, i) => (
                                <div key={i} className="flex items-center">
                                  <div className="w-8 text-center text-xs font-medium text-muted-foreground">
                                    {["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"][i]}
                                  </div>
                                  {row.map((value, j) => {
                                    const maxVal = Math.max(...confusionMatrixData.flat())
                                    const intensity = value / maxVal
                                    const isDiagonal = i === j
                                    return (
                                      <div
                                        key={j}
                                        className={`m-0.5 flex h-8 w-8 items-center justify-center rounded text-xs font-mono ${
                                          isDiagonal
                                            ? "bg-emerald-500/80 text-white"
                                            : intensity > 0.5
                                            ? "bg-primary/60 text-primary-foreground"
                                            : intensity > 0.2
                                            ? "bg-primary/30 text-foreground"
                                            : "bg-muted text-muted-foreground"
                                        }`}
                                      >
                                        {value}
                                      </div>
                                    )
                                  })}
                                </div>
                              ))}
                            </div>
                          </div>
                          <div className="mt-4 flex items-center justify-center gap-4 text-xs text-muted-foreground">
                            <div className="flex items-center gap-1">
                              <div className="h-3 w-3 rounded bg-emerald-500" />
                              <span>Correct</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <div className="h-3 w-3 rounded bg-primary/60" />
                              <span>High Error</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <div className="h-3 w-3 rounded bg-muted" />
                              <span>Low Error</span>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </TabsContent>

                    <TabsContent value="attention" className="mt-0">
                      <Card className="border-border/30">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm">Attention Visualization</CardTitle>
                          <CardDescription className="text-xs">
                            Grad-CAM heatmap showing model focus regions
                          </CardDescription>
                        </CardHeader>
                        <CardContent>
                          <div className="grid gap-4 md:grid-cols-2">
                            <div className="space-y-2">
                              <div className="aspect-square rounded-lg bg-gradient-to-br from-red-500/20 via-yellow-500/20 to-green-500/20 relative overflow-hidden">
                                {/* Simulated attention heatmap */}
                                <div className="absolute inset-0 flex items-center justify-center">
                                  <div className="h-32 w-32 rounded-full bg-gradient-to-br from-red-500/60 via-orange-500/40 to-transparent blur-xl" />
                                </div>
                                <div className="absolute inset-0 flex items-center justify-center">
                                  <div className="h-20 w-20 rounded-full bg-gradient-to-br from-yellow-500/60 via-green-500/40 to-transparent blur-lg" />
                                </div>
                                <div className="absolute bottom-2 left-2 rounded bg-background/80 px-2 py-1 text-xs font-mono">
                                  Frame {selectedFrame + 1}
                                </div>
                              </div>
                              <div className="flex items-center justify-between text-xs">
                                <div className="flex items-center gap-2">
                                  <div className="h-2 w-12 rounded-full bg-gradient-to-r from-blue-500 via-yellow-500 to-red-500" />
                                  <span className="text-muted-foreground">Low to High attention</span>
                                </div>
                              </div>
                            </div>

                            <div className="space-y-4">
                              <div className="rounded-lg bg-muted/50 p-4">
                                <h4 className="text-sm font-medium text-foreground">Attention Statistics</h4>
                                <div className="mt-3 space-y-2">
                                  <div className="flex items-center justify-between text-sm">
                                    <span className="text-muted-foreground">Peak Attention</span>
                                    <span className="font-mono text-foreground">0.94</span>
                                  </div>
                                  <div className="flex items-center justify-between text-sm">
                                    <span className="text-muted-foreground">Mean Attention</span>
                                    <span className="font-mono text-foreground">0.67</span>
                                  </div>
                                  <div className="flex items-center justify-between text-sm">
                                    <span className="text-muted-foreground">Focus Area</span>
                                    <span className="font-mono text-foreground">Center-Lower</span>
                                  </div>
                                  <div className="flex items-center justify-between text-sm">
                                    <span className="text-muted-foreground">Coverage</span>
                                    <span className="font-mono text-foreground">34.2%</span>
                                  </div>
                                </div>
                              </div>

                              <div className="rounded-lg border border-border/50 p-4">
                                <h4 className="text-sm font-medium text-foreground">Interpretation</h4>
                                <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
                                  The model focuses primarily on the lip contour and mouth opening regions,
                                  which are critical features for phoneme classification. High attention
                                  values in the center-lower region indicate proper feature extraction.
                                </p>
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </TabsContent>
                  </CardContent>
                </Tabs>
              </Card>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
