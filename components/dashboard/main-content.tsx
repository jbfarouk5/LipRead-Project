"use client"

import { useDashboard } from "@/lib/dashboard-context"
import { Stage0Home } from "./stages/stage-0-home"
import { Stage1MouthCut } from "./stages/stage-1-mouth-cut"
import { Stage2Preprocessing } from "./stages/stage-2-preprocessing"
import { Stage3ImageClassification } from "./stages/stage-3-image-classification"
import { Stage4VideoClassification } from "./stages/stage-4-video-classification"


export function MainContent() {
  const { currentStage } = useDashboard()

  switch (currentStage) {
    case 0:
      return <Stage0Home />
    case 1:
      return <Stage1MouthCut />
    case 2:
      return <Stage2Preprocessing />
    case 3:
        return <Stage3ImageClassification />
    case 4:
      return <Stage4VideoClassification/>
    case 5:
      return (
        <div className="flex h-full items-center justify-center">
          <div className="text-center">
            <h2 className="text-xl font-semibold text-foreground">
              Comparison & Final Results
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              This stage is under development
            </p>
          </div>
        </div>
      )
    default:
      return <Stage0Home />
  }
}