"use client"

import { useState } from "react"
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
  Film,
  Layers,
  BarChart3,
  Activity,
  CheckCircle2,
  Clock,
  Cpu,
  Network,
  RotateCcw,
  Download,
  Settings2,
  Sparkles,
  Timer,
  GitBranch,
  TrendingUp,
  Target,
  Waves,
  ArrowRight,
  Zap,
  Brain,
  LineChart,
} from "lucide-react"

// Mock word predictions data
const mockWordPredictions = [
  { word: "hello", confidence: 0.94, startTime: 0.0, endTime: 0.45, frames: 12 },
  { word: "my", confidence: 0.89, startTime: 0.48, endTime: 0.72, frames: 8 },
  { word: "name", confidence: 0.92, startTime: 0.75, endTime: 1.15, frames: 12 },
  { word: "is", confidence: 0.97, startTime: 1.18, endTime: 1.38, frames: 6 },
  { word: "artificial", confidence: 0.78, startTime: 1.42, endTime: 2.25, frames: 24 },
  { word: "intelligence", confidence: 0.82, startTime: 2.28, endTime: 3.12, frames: 26 },
  { word: "and", confidence: 0.95, startTime: 3.15, endTime: 3.35, frames: 6 },
  { word: "I", confidence: 0.98, startTime: 3.38, endTime: 3.52, frames: 4 },
  { word: "am", confidence: 0.96, startTime: 3.55, endTime: 3.75, frames: 6 },
  { word: "here", confidence: 0.91, startTime: 3.78, endTime: 4.12, frames: 10 },
  { word: "to", confidence: 0.93, startTime: 4.15, endTime: 4.32, frames: 5 },
  { word: "help", confidence: 0.88, startTime: 4.35, endTime: 4.75, frames: 12 },
]

// Mock temporal attention data for visualization
const temporalAttention = Array.from({ length: 50 }, (_, i) => ({
  time: i * 0.1,
  attention: 0.3 + Math.random() * 0.6 + (Math.sin(i / 5) * 0.2),
  hiddenState: Math.random(),
}))

// Mock LSTM cell states
const lstmCellStates = [
  { name: "Forget Gate", value: 0.72, description: "Controls information to discard" },
  { name: "Input Gate", value: 0.85, description: "Controls new information to store" },
  { name: "Output Gate", value: 0.91, description: "Controls output activation" },
  { name: "Cell State", value: 0.68, description: "Long-term memory component" },
]

export function Stage4VideoClassification() {
  const { addLog, setStageStatus, setProcessingStatus } = useDashboard()
  const [isProcessing, setIsProcessing] = useState(false)
  const [progress, setProgress] = useState(0)
  const [hasResults, setHasResults] = useState(false)
  const [selectedWord, setSelectedWord] = useState(0)

  // Model configuration
  const [modelConfig, setModelConfig] = useState({
    architecture: "lstm",
    hiddenSize: 512,
    numLayers: 3,
    bidirectional: true,
    dropout: 0.3,
    attentionMechanism: true,
    beamWidth: 5,
  })

  // Metrics state
  const [metrics, setMetrics] = useState({
    wordAccuracy: 0,
    characterErrorRate: 0,
    wordErrorRate: 0,
    bleuScore: 0,
    totalWords: 0,
    avgConfidence: 0,
    sequenceLength: 0,
    processingTime: 0,
  })

  const runClassification = () => {
    setIsProcessing(true)
    setProgress(0)
    setProcessingStatus("Running temporal sequence analysis...")
    addLog("info", "Starting video sequence classification", "Video Classification")
    addLog("info", `Model: ${modelConfig.architecture.toUpperCase()}, Hidden: ${modelConfig.hiddenSize}, Layers: ${modelConfig.numLayers}`, "Video Classification")

    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval)
          setIsProcessing(false)
          setHasResults(true)
          setProcessingStatus("Video classification complete")
          setStageStatus(4, "completed")
          setStageStatus(5, "available")

          // Set final metrics
          setMetrics({
            wordAccuracy: 91.7,
            characterErrorRate: 4.2,
            wordErrorRate: 8.3,
            bleuScore: 0.876,
            totalWords: 12,
            avgConfidence: 90.8,
            sequenceLength: 4.75,
            processingTime: 2.34,
          })

          addLog("success", "Video classification completed - WER: 8.3%", "Video Classification")
          return 100
        }
        return prev + 2.5
      })
    }, 80)
  }

  return (
    <div className="flex h-full flex-col gap-4 p-6 overflow-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Video Classification</h1>
          <p className="text-sm text-muted-foreground">Temporal sequence modeling for word recognition</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="font-mono text-xs">
            <Timer className="mr-1 h-3 w-3" />
            {metrics.sequenceLength.toFixed(2)}s
          </Badge>
          <Badge variant={hasResults ? "default" : "secondary"} className="capitalize">
            {hasResults ? "Completed" : isProcessing ? "Processing" : "Ready"}
          </Badge>
        </div>
      </div>

      <div className="grid flex-1 gap-4 lg:grid-cols-3">
        {/* Left Column - Configuration */}
        <div className="space-y-4">
          {/* Model Configuration */}
          <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm font-medium">
                <Network className="h-4 w-4 text-primary" />
                Sequence Model
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
                    <SelectItem value="lstm">LSTM</SelectItem>
                    <SelectItem value="gru">GRU</SelectItem>
                    <SelectItem value="transformer">Transformer</SelectItem>
                    <SelectItem value="conformer">Conformer</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Hidden Size</Label>
                  <Select
                    value={String(modelConfig.hiddenSize)}
                    onValueChange={(v) => setModelConfig((c) => ({ ...c, hiddenSize: Number(v) }))}
                    disabled={isProcessing}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="256">256</SelectItem>
                      <SelectItem value="512">512</SelectItem>
                      <SelectItem value="1024">1024</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Layers</Label>
                  <Select
                    value={String(modelConfig.numLayers)}
                    onValueChange={(v) => setModelConfig((c) => ({ ...c, numLayers: Number(v) }))}
                    disabled={isProcessing}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="2">2</SelectItem>
                      <SelectItem value="3">3</SelectItem>
                      <SelectItem value="4">4</SelectItem>
                      <SelectItem value="6">6</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-xs text-muted-foreground">Dropout</Label>
                  <span className="font-mono text-xs text-foreground">
                    {(modelConfig.dropout * 100).toFixed(0)}%
                  </span>
                </div>
                <Slider
                  value={[modelConfig.dropout * 100]}
                  onValueChange={([v]) => setModelConfig((c) => ({ ...c, dropout: v / 100 }))}
                  min={0}
                  max={50}
                  step={5}
                  disabled={isProcessing}
                />
              </div>

              <div className="space-y-3 border-t border-border/50 pt-3">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-xs">Bidirectional</Label>
                    <p className="text-xs text-muted-foreground">Process sequence both ways</p>
                  </div>
                  <Switch
                    checked={modelConfig.bidirectional}
                    onCheckedChange={(v) => setModelConfig((c) => ({ ...c, bidirectional: v }))}
                    disabled={isProcessing}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-xs">Attention</Label>
                    <p className="text-xs text-muted-foreground">Enable self-attention layer</p>
                  </div>
                  <Switch
                    checked={modelConfig.attentionMechanism}
                    onCheckedChange={(v) => setModelConfig((c) => ({ ...c, attentionMechanism: v }))}
                    disabled={isProcessing}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Beam Width (Decoding)</Label>
                <Select
                  value={String(modelConfig.beamWidth)}
                  onValueChange={(v) => setModelConfig((c) => ({ ...c, beamWidth: Number(v) }))}
                  disabled={isProcessing}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">Greedy (1)</SelectItem>
                    <SelectItem value="3">Narrow (3)</SelectItem>
                    <SelectItem value="5">Standard (5)</SelectItem>
                    <SelectItem value="10">Wide (10)</SelectItem>
                  </SelectContent>
                </Select>
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
                    <span className="text-muted-foreground">Analyzing sequences...</span>
                    <span className="font-mono text-foreground">{progress.toFixed(0)}%</span>
                  </div>
                  <Progress value={progress} className="h-2" />
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
                    Processing...
                  </>
                ) : (
                  <>
                    <Play className="mr-2 h-4 w-4" />
                    Run Sequence Analysis
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

          {/* LSTM Cell States */}
          {hasResults && (
            <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-sm font-medium">
                  <GitBranch className="h-4 w-4 text-primary" />
                  LSTM Cell States
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {lstmCellStates.map((state) => (
                  <div key={state.name} className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-foreground">{state.name}</span>
                      <span className="font-mono text-xs text-muted-foreground">
                        {state.value.toFixed(2)}
                      </span>
                    </div>
                    <Progress value={state.value * 100} className="h-1.5" />
                  </div>
                ))}
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
                  <Film className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-medium text-foreground">Ready for Sequence Analysis</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Configure the model and run analysis to see temporal predictions
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
                        Word Acc
                      </Badge>
                    </div>
                    <div className="mt-3">
                      <div className="text-2xl font-bold text-foreground">{metrics.wordAccuracy}%</div>
                      <p className="text-xs text-muted-foreground">Word accuracy</p>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-border/50 bg-gradient-to-br from-blue-500/10 to-transparent">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <TrendingUp className="h-5 w-5 text-blue-500" />
                      <Badge variant="outline" className="text-xs text-blue-600 border-blue-500/30">
                        WER
                      </Badge>
                    </div>
                    <div className="mt-3">
                      <div className="text-2xl font-bold text-foreground">{metrics.wordErrorRate}%</div>
                      <p className="text-xs text-muted-foreground">Word error rate</p>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-border/50 bg-gradient-to-br from-purple-500/10 to-transparent">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <Sparkles className="h-5 w-5 text-purple-500" />
                      <Badge variant="outline" className="text-xs text-purple-600 border-purple-500/30">
                        BLEU
                      </Badge>
                    </div>
                    <div className="mt-3">
                      <div className="text-2xl font-bold text-foreground">{metrics.bleuScore.toFixed(3)}</div>
                      <p className="text-xs text-muted-foreground">BLEU score</p>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-border/50 bg-gradient-to-br from-amber-500/10 to-transparent">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <Zap className="h-5 w-5 text-amber-500" />
                      <Badge variant="outline" className="text-xs text-amber-600 border-amber-500/30">
                        Speed
                      </Badge>
                    </div>
                    <div className="mt-3">
                      <div className="text-2xl font-bold text-foreground">{metrics.processingTime}s</div>
                      <p className="text-xs text-muted-foreground">Processing time</p>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Transcription Output */}
              <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-sm font-medium">
                    <Brain className="h-4 w-4 text-primary" />
                    Predicted Transcription
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Click on words to see detailed predictions
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {mockWordPredictions.map((word, idx) => (
                      <button
                        key={idx}
                        onClick={() => setSelectedWord(idx)}
                        className={`group relative rounded-lg border px-3 py-2 transition-all ${
                          selectedWord === idx
                            ? "border-primary bg-primary/10 ring-2 ring-primary/20"
                            : "border-border/50 bg-muted/30 hover:border-primary/50 hover:bg-muted/50"
                        }`}
                      >
                        <span className="font-medium text-foreground">{word.word}</span>
                        <div className="absolute -bottom-1 left-0 right-0 h-1 rounded-full bg-muted overflow-hidden">
                          <div
                            className={`h-full transition-all ${
                              word.confidence > 0.9
                                ? "bg-emerald-500"
                                : word.confidence > 0.8
                                ? "bg-blue-500"
                                : word.confidence > 0.7
                                ? "bg-amber-500"
                                : "bg-red-500"
                            }`}
                            style={{ width: `${word.confidence * 100}%` }}
                          />
                        </div>
                      </button>
                    ))}
                  </div>

                  {/* Selected Word Details */}
                  <div className="mt-6 rounded-lg border border-border/50 bg-muted/20 p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-lg font-semibold text-foreground">
                          &ldquo;{mockWordPredictions[selectedWord].word}&rdquo;
                        </h4>
                        <p className="text-xs text-muted-foreground">Word {selectedWord + 1} of {mockWordPredictions.length}</p>
                      </div>
                      <Badge
                        variant={
                          mockWordPredictions[selectedWord].confidence > 0.9
                            ? "default"
                            : mockWordPredictions[selectedWord].confidence > 0.8
                            ? "secondary"
                            : "outline"
                        }
                        className="text-sm"
                      >
                        {(mockWordPredictions[selectedWord].confidence * 100).toFixed(1)}%
                      </Badge>
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
                      <div className="rounded-lg bg-background/50 p-3">
                        <div className="text-xs text-muted-foreground">Start Time</div>
                        <div className="font-mono text-sm font-medium text-foreground">
                          {mockWordPredictions[selectedWord].startTime.toFixed(2)}s
                        </div>
                      </div>
                      <div className="rounded-lg bg-background/50 p-3">
                        <div className="text-xs text-muted-foreground">End Time</div>
                        <div className="font-mono text-sm font-medium text-foreground">
                          {mockWordPredictions[selectedWord].endTime.toFixed(2)}s
                        </div>
                      </div>
                      <div className="rounded-lg bg-background/50 p-3">
                        <div className="text-xs text-muted-foreground">Duration</div>
                        <div className="font-mono text-sm font-medium text-foreground">
                          {(mockWordPredictions[selectedWord].endTime - mockWordPredictions[selectedWord].startTime).toFixed(2)}s
                        </div>
                      </div>
                      <div className="rounded-lg bg-background/50 p-3">
                        <div className="text-xs text-muted-foreground">Frames</div>
                        <div className="font-mono text-sm font-medium text-foreground">
                          {mockWordPredictions[selectedWord].frames}
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Detailed Results Tabs */}
              <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
                <Tabs defaultValue="timeline" className="w-full">
                  <CardHeader className="pb-0">
                    <TabsList className="grid w-fit grid-cols-3">
                      <TabsTrigger value="timeline" className="text-xs">
                        <Waves className="mr-1.5 h-3 w-3" />
                        Timeline
                      </TabsTrigger>
                      <TabsTrigger value="attention" className="text-xs">
                        <LineChart className="mr-1.5 h-3 w-3" />
                        Attention
                      </TabsTrigger>
                      <TabsTrigger value="metrics" className="text-xs">
                        <BarChart3 className="mr-1.5 h-3 w-3" />
                        Metrics
                      </TabsTrigger>
                    </TabsList>
                  </CardHeader>

                  <CardContent className="pt-4">
                    <TabsContent value="timeline" className="mt-0">
                      <div className="space-y-4">
                        {/* Timeline Visualization */}
                        <div className="relative h-24 rounded-lg bg-muted/30 overflow-hidden">
                          <div className="absolute inset-0 flex items-end">
                            {mockWordPredictions.map((word, idx) => {
                              const startPercent = (word.startTime / 5) * 100
                              const widthPercent = ((word.endTime - word.startTime) / 5) * 100
                              return (
                                <div
                                  key={idx}
                                  className={`absolute bottom-0 rounded-t transition-all cursor-pointer ${
                                    selectedWord === idx
                                      ? "bg-primary z-10"
                                      : "bg-primary/40 hover:bg-primary/60"
                                  }`}
                                  style={{
                                    left: `${startPercent}%`,
                                    width: `${widthPercent}%`,
                                    height: `${word.confidence * 80 + 20}%`,
                                  }}
                                  onClick={() => setSelectedWord(idx)}
                                >
                                  <div className="absolute -top-5 left-1/2 -translate-x-1/2 whitespace-nowrap text-xs font-medium text-foreground">
                                    {word.word}
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                          {/* Time markers */}
                          <div className="absolute bottom-0 left-0 right-0 flex justify-between px-2 pb-1 text-xs text-muted-foreground">
                            <span>0s</span>
                            <span>1s</span>
                            <span>2s</span>
                            <span>3s</span>
                            <span>4s</span>
                            <span>5s</span>
                          </div>
                        </div>

                        {/* Word Sequence Flow */}
                        <div className="flex items-center justify-center gap-1 flex-wrap">
                          {mockWordPredictions.map((word, idx) => (
                            <div key={idx} className="flex items-center">
                              <div
                                className={`rounded px-2 py-1 text-xs font-medium ${
                                  selectedWord === idx
                                    ? "bg-primary text-primary-foreground"
                                    : "bg-muted text-muted-foreground"
                                }`}
                              >
                                {word.word}
                              </div>
                              {idx < mockWordPredictions.length - 1 && (
                                <ArrowRight className="h-3 w-3 text-muted-foreground mx-1" />
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    </TabsContent>

                    <TabsContent value="attention" className="mt-0">
                      <div className="space-y-4">
                        <div className="h-48 rounded-lg bg-muted/20 p-4">
                          {/* Simple attention visualization */}
                          <div className="flex h-full items-end gap-0.5">
                            {temporalAttention.map((point, idx) => (
                              <div
                                key={idx}
                                className="flex-1 rounded-t bg-primary/60 transition-all hover:bg-primary"
                                style={{ height: `${point.attention * 100}%` }}
                              />
                            ))}
                          </div>
                        </div>

                        <div className="grid gap-4 md:grid-cols-2">
                          <Card className="border-border/30">
                            <CardHeader className="pb-2">
                              <CardTitle className="text-sm">Attention Statistics</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-2">
                              <div className="flex items-center justify-between text-sm">
                                <span className="text-muted-foreground">Peak Attention</span>
                                <span className="font-mono text-foreground">0.94</span>
                              </div>
                              <div className="flex items-center justify-between text-sm">
                                <span className="text-muted-foreground">Mean Attention</span>
                                <span className="font-mono text-foreground">0.72</span>
                              </div>
                              <div className="flex items-center justify-between text-sm">
                                <span className="text-muted-foreground">Attention Entropy</span>
                                <span className="font-mono text-foreground">2.34</span>
                              </div>
                              <div className="flex items-center justify-between text-sm">
                                <span className="text-muted-foreground">Focus Ratio</span>
                                <span className="font-mono text-foreground">0.68</span>
                              </div>
                            </CardContent>
                          </Card>

                          <Card className="border-border/30">
                            <CardHeader className="pb-2">
                              <CardTitle className="text-sm">Hidden State Analysis</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-2">
                              <div className="flex items-center justify-between text-sm">
                                <span className="text-muted-foreground">State Dimension</span>
                                <span className="font-mono text-foreground">512</span>
                              </div>
                              <div className="flex items-center justify-between text-sm">
                                <span className="text-muted-foreground">Activation Mean</span>
                                <span className="font-mono text-foreground">0.42</span>
                              </div>
                              <div className="flex items-center justify-between text-sm">
                                <span className="text-muted-foreground">Activation Std</span>
                                <span className="font-mono text-foreground">0.18</span>
                              </div>
                              <div className="flex items-center justify-between text-sm">
                                <span className="text-muted-foreground">Sparsity</span>
                                <span className="font-mono text-foreground">23.4%</span>
                              </div>
                            </CardContent>
                          </Card>
                        </div>
                      </div>
                    </TabsContent>

                    <TabsContent value="metrics" className="mt-0">
                      <div className="grid gap-4 md:grid-cols-2">
                        <Card className="border-border/30">
                          <CardHeader className="pb-2">
                            <CardTitle className="text-sm">Recognition Metrics</CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-4">
                            <div className="space-y-2">
                              <div className="flex items-center justify-between">
                                <span className="text-sm text-muted-foreground">Word Accuracy</span>
                                <span className="font-mono text-sm font-medium text-emerald-500">
                                  {metrics.wordAccuracy}%
                                </span>
                              </div>
                              <Progress value={metrics.wordAccuracy} className="h-2" />
                            </div>

                            <div className="space-y-2">
                              <div className="flex items-center justify-between">
                                <span className="text-sm text-muted-foreground">Character Error Rate</span>
                                <span className="font-mono text-sm font-medium text-blue-500">
                                  {metrics.characterErrorRate}%
                                </span>
                              </div>
                              <Progress value={100 - metrics.characterErrorRate} className="h-2" />
                            </div>

                            <div className="space-y-2">
                              <div className="flex items-center justify-between">
                                <span className="text-sm text-muted-foreground">Word Error Rate</span>
                                <span className="font-mono text-sm font-medium text-amber-500">
                                  {metrics.wordErrorRate}%
                                </span>
                              </div>
                              <Progress value={100 - metrics.wordErrorRate} className="h-2" />
                            </div>
                          </CardContent>
                        </Card>

                        <Card className="border-border/30">
                          <CardHeader className="pb-2">
                            <CardTitle className="text-sm">Sequence Statistics</CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-3">
                            <div className="grid grid-cols-2 gap-3">
                              <div className="rounded-lg bg-muted/50 p-3">
                                <div className="text-xs text-muted-foreground">Total Words</div>
                                <div className="text-xl font-bold text-foreground">{metrics.totalWords}</div>
                              </div>
                              <div className="rounded-lg bg-muted/50 p-3">
                                <div className="text-xs text-muted-foreground">Avg Confidence</div>
                                <div className="text-xl font-bold text-foreground">{metrics.avgConfidence}%</div>
                              </div>
                              <div className="rounded-lg bg-muted/50 p-3">
                                <div className="text-xs text-muted-foreground">Sequence Length</div>
                                <div className="text-xl font-bold text-foreground">{metrics.sequenceLength}s</div>
                              </div>
                              <div className="rounded-lg bg-muted/50 p-3">
                                <div className="text-xs text-muted-foreground">BLEU Score</div>
                                <div className="text-xl font-bold text-foreground">{metrics.bleuScore.toFixed(2)}</div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      </div>
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
