"use client"

import { ReactNode } from "react"
import { DashboardProvider, useDashboard } from "@/lib/dashboard-context"
import { TopNavbar } from "./top-navbar"
import { RightSidebar } from "./right-sidebar"
import { BottomPanel } from "./bottom-panel"

interface DashboardLayoutProps {
  children: ReactNode
}

function LayoutContent({ children }: { children: ReactNode }) {
  const { currentStage } = useDashboard()

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background">
      {currentStage !== 0 && <TopNavbar />}

      <div className="flex flex-1 overflow-hidden">
        <main className="flex-1 overflow-auto">{children}</main>

        {currentStage !== 0 && <RightSidebar />}
      </div>

      <BottomPanel />
    </div>
  )
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  return (
    <DashboardProvider>
      <LayoutContent>{children}</LayoutContent>
    </DashboardProvider>
  )
}
