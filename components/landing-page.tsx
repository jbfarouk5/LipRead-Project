"use client"

import { useRef, useEffect, useState } from "react"
import { Ear, Brain, Mic } from "lucide-react"
import { motion, useInView } from "framer-motion"

// ─── Reusable motion wrappers ───────────────────────────────────────────────

function MotionSection({
  children,
  className,
  style,
  delay = 0,
}: {
  children: React.ReactNode
  className?: string
  style?: React.CSSProperties
  delay?: number
}) {
  const ref = useRef<HTMLDivElement>(null)
  const isInView = useInView(ref, { once: true, margin: "-80px" })

  return (
    <motion.div
      ref={ref}
      className={className}
      style={style}
      initial={{ opacity: 0, y: 24 }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.6, ease: "easeOut", delay }}
    >
      {children}
    </motion.div>
  )
}

function MotionCard({
  children,
  className,
  style,
  onMouseEnter,
  onMouseLeave,
}: {
  children: React.ReactNode
  className?: string
  style?: React.CSSProperties
  onMouseEnter?: (e: React.MouseEvent<HTMLDivElement>) => void
  onMouseLeave?: (e: React.MouseEvent<HTMLDivElement>) => void
}) {
  return (
    <motion.div
      className={className}
      style={style}
      whileHover={{
        scale: 1.02,
        boxShadow: "0 12px 32px rgba(79,70,229,0.14)",
      }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      {children}
    </motion.div>
  )
}

// ─── Icons ──────────────────────────────────────────────────────────────────

function IconChevronRight() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M9 18l6-6-6-6" />
    </svg>
  )
}
function IconArrowDown() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 5v14M5 12l7 7 7-7" />
    </svg>
  )
}

function IconChevronDown() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

interface LandingPageProps {
  onStartAnalysis?: () => void
}

const BG_BASE = "#FAFAF9"
const BG_LOW = "#F4F3F1"
const BG_MID = "#ECEAE7"
const BG_HIGH = "#E4E1DC"
const TEXT_PRIMARY = "#1A1918"
const TEXT_SECONDARY = "#6B6966"
const TEXT_TERTIARY = "#8A8682"
const ACCENT = "#4F46E5"
const ACCENT_HOVER = "#4338CA"
const ACCENT_SOFT = "rgba(79,70,229,0.08)"
const ACCENT_BORDER = "rgba(79,70,229,0.18)"
const CYAN = "#00D5E6"
const CYAN_DIM = "#00B8C7"

function Counter({ target, suffix = "" }: { target: number; suffix?: string }) {
  const [count, setCount] = useState(0)
  const ref = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          let start = 0
          const step = target / 60
          const timer = setInterval(() => {
            start += step
            if (start >= target) {
              setCount(target)
              clearInterval(timer)
            } else {
              setCount(Math.floor(start))
            }
          }, 16)
          observer.disconnect()
        }
      },
      { threshold: 0.5 }
    )
    if (ref.current) observer.observe(ref.current)
    return () => observer.disconnect()
  }, [target])

  return (
    <span ref={ref}>
      {count}
      {suffix}
    </span>
  )
}

// ─── Dot grid background ─────────────────────────────────────────────────────
function GridBackground() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      <svg className="absolute inset-0 h-full w-full opacity-[0.035]" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id="dots" x="0" y="0" width="24" height="24" patternUnits="userSpaceOnUse">
            <circle cx="1" cy="1" r="1" fill="#00D5E6" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#dots)" />
      </svg>
      <div
        className="absolute left-1/2 top-[40%] h-[500px] w-[700px] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-10"
        style={{ background: "radial-gradient(ellipse, #00f2ff 0%, transparent 70%)" }}
      />
    </div>
  )
}

// ─── Pipeline Card ─────────────────────────────────────────────────────────
interface PipelineCardProps {
  step: number
  title: string
  description: string
  icon: React.ReactNode
  delay: number
}

function PipelineCard({ step, title, description, icon, delay }: PipelineCardProps) {
  return (
    <MotionSection delay={delay / 1000}>
      <motion.div
        className="group relative overflow-hidden rounded-xl p-6"
        style={{
          background: "rgba(26,25,24,0.04)",
          border: "1px solid rgba(26,25,24,0.08)",
          borderLeft: "4px solid rgba(79,70,229,0.35)",
        }}
        whileHover={{
          scale: 1.02,
          boxShadow: "0 12px 32px rgba(79,70,229,0.14)",
        }}
        transition={{ duration: 0.2, ease: "easeOut" }}
      >
        <span
          className="absolute right-4 top-3 text-6xl font-black select-none"
          style={{ color: "rgba(26,25,24,0.04)", lineHeight: 1 }}
        >
          {String(step).padStart(2, "0")}
        </span>

        <div className="mb-4" style={{ color: ACCENT }}>{icon}</div>

        <div className="mb-4 flex h-12 items-center justify-start overflow-hidden">
          <PipelineAnimation step={step} />
        </div>

        <h3 className="mb-1.5 text-base font-semibold text-[#1A1918]">{title}</h3>
        <p className="text-sm leading-relaxed" style={{ color: TEXT_SECONDARY }}>{description}</p>
      </motion.div>
    </MotionSection>
  )
}

function PipelineAnimation({ step }: { step: number }) {
  const [tick, setTick] = useState(0)
  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 80)
    return () => clearInterval(interval)
  }, [])

  if (step === 1) {
    const h = 8 + (Math.sin(tick * 0.15) * 4 + 4)
    return (
      <svg viewBox="0 0 60 40" className="h-10 w-16" fill="none">
        <rect x="20" y={40 - h * 2} width="20" height={h * 2} rx="2" fill="#00D5E6" opacity="0.6" />
        <path d="M30 10 L24 16 M30 10 L36 16 M30 10 L30 26" stroke="#00D5E6" strokeWidth="2" strokeLinecap="round" />
      </svg>
    )
  }
  if (step === 2) {
    const y = 5 + ((tick % 30) / 30) * 30
    return (
      <svg viewBox="0 0 60 40" className="h-10 w-16" fill="none">
        <rect x="12" y="5" width="36" height="30" rx="3" stroke="#00D5E6" strokeWidth="1.5" opacity="0.4" />
        <rect x="22" y="15" width="16" height="10" rx="2" stroke="#00D5E6" strokeWidth="1.5" opacity="0.8" />
        <line x1="12" y1={y} x2="48" y2={y} stroke="#00D5E6" strokeWidth="1" opacity="0.7" />
      </svg>
    )
  }
  if (step === 3) {
    const colors = ["#00D5E6", "#6EA8FE", "#6EE7D8"]
    return (
      <svg viewBox="0 0 60 40" className="h-10 w-16" fill="none">
        {colors.map((c, i) => (
          <rect key={i} x={10 + i * 14} y={8 + Math.sin((tick * 0.1) + i) * 4} width="12" height="24" rx="2" fill={c} opacity="0.5" />
        ))}
      </svg>
    )
  }
  if (step === 4) {
    const pulse = (Math.sin(tick * 0.12) + 1) / 2
    return (
      <svg viewBox="0 0 60 40" className="h-10 w-16" fill="none">
        {[8, 20, 32].map((x, i) => (
          <circle key={i} cx={x} cy="20" r="4" fill="#00D5E6" opacity={0.3 + pulse * 0.5} />
        ))}
        <circle cx="50" cy="14" r="3" fill="#00D5E6" opacity={0.5 + pulse * 0.4} />
        <circle cx="50" cy="26" r="3" fill="#00D5E6" opacity={0.3 + pulse * 0.4} />
        <line x1="12" y1="20" x2="16" y2="20" stroke="#00D5E6" strokeWidth="1" opacity="0.6" />
        <line x1="24" y1="20" x2="28" y2="20" stroke="#00D5E6" strokeWidth="1" opacity="0.6" />
        <line x1="36" y1="20" x2="47" y2="14" stroke="#00D5E6" strokeWidth="1" opacity="0.5" />
        <line x1="36" y1="20" x2="47" y2="26" stroke="#00D5E6" strokeWidth="1" opacity="0.5" />
      </svg>
    )
  }
  if (step === 5) {
    const bars = [6, 10, 14, 18, 22, 26, 30, 34, 38, 42]
    return (
      <svg viewBox="0 0 60 40" className="h-10 w-16" fill="none">
        {bars.map((x, i) => {
          const h = 6 + Math.abs(Math.sin(tick * 0.1 + i * 0.8)) * 18
          return <rect key={x} x={x} y={(40 - h) / 2} width="3" height={h} rx="1.5" fill="#00D5E6" opacity="0.6" />
        })}
      </svg>
    )
  }
  const acc = 72 + ((tick % 50) / 50) * 20
  return (
    <svg viewBox="0 0 60 40" className="h-10 w-16" fill="none">
      <rect x="6" y="28" width="48" height="4" rx="2" fill="#D6D1CB" opacity="0.85" />
      <rect x="6" y="28" width={acc * 0.48} height="4" rx="2" fill="#00D5E6" opacity="0.7" />
      <text x="30" y="20" textAnchor="middle" fontSize="10" fill="#00D5E6" fontWeight="bold">{Math.round(acc)}%</text>
    </svg>
  )
}

function SectionHeading({ label, title, subtitle }: { label: string; title: string; subtitle?: string }) {
  return (
    <div className="mb-14 text-center">
      <span
        className="mb-4 inline-block rounded-full px-4 py-1 text-[11px] font-semibold uppercase tracking-[0.2em]"
        style={{ border: ACCENT_BORDER, background: ACCENT_SOFT, color: ACCENT }}
      >
        {label}
      </span>
      <h2 className="text-2xl md:text-3xl font-semibold tracking-tight text-[#1A1918]">{title}</h2>
      {subtitle && (
        <p className="mt-4 text-sm md:text-base max-w-2xl mx-auto leading-relaxed" style={{ color: TEXT_SECONDARY }}>
          {subtitle}
        </p>
      )}
    </div>
  )
}

// ─── P1: Hero Live Preview Card ──────────────────────────────────────────────
function HeroPreviewCard() {
  const [activeLine, setActiveLine] = useState(0)
  const lines = [
    { time: "00:02.14", text: "hello world", confidence: 97 },
    { time: "00:04.58", text: "neural engine active", confidence: 94 },
    { time: "00:07.82", text: "decoding complete", confidence: 98 },
  ]

  useEffect(() => {
    const t = setInterval(() => setActiveLine((l) => (l + 1) % lines.length), 1800)
    return () => clearInterval(t)
  }, [])

  return (
    <motion.div
      className="relative mx-auto mt-14 max-w-2xl rounded-2xl overflow-hidden"
      style={{
        background: "rgba(255,255,255,0.72)",
        border: "1px solid rgba(79,70,229,0.16)",
        boxShadow: "0 24px 60px rgba(79,70,229,0.10), 0 1px 0 rgba(255,255,255,0.8) inset",
        backdropFilter: "blur(12px)",
      }}
      initial={{ opacity: 0, y: 32 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.7, ease: "easeOut", delay: 0.9 }}
    >
      {/* Card header bar */}
      <div
        className="flex items-center justify-between px-5 py-3"
        style={{ borderBottom: "1px solid rgba(26,25,24,0.07)", background: "rgba(250,250,249,0.9)" }}
      >
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full animate-pulse" style={{ background: ACCENT }} />
          <span className="text-xs font-semibold" style={{ color: TEXT_SECONDARY }}>Live inference stream</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: TEXT_TERTIARY }}>30fps</span>
          <span
            className="rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em]"
            style={{ background: "rgba(0,213,230,0.12)", color: CYAN_DIM }}
          >
            Processing
          </span>
        </div>
      </div>

      {/* Two-column body */}
      <div className="grid grid-cols-2 gap-0">
        {/* Left: fake waveform / frame viewer */}
        <div
          className="flex flex-col items-center justify-center p-6 gap-3"
          style={{ borderRight: "1px solid rgba(26,25,24,0.06)" }}
        >
          <FrameWaveform />
          <span className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: TEXT_TERTIARY }}>
            Frame analysis
          </span>
        </div>

        {/* Right: detected strings */}
        <div className="flex flex-col justify-center gap-2 p-5">
          {lines.map((line, i) => (
            <motion.div
              key={line.time}
              className="rounded-lg px-3 py-2.5"
              animate={{
                background: i === activeLine
                  ? "rgba(79,70,229,0.08)"
                  : "rgba(26,25,24,0.03)",
                borderColor: i === activeLine
                  ? "rgba(79,70,229,0.22)"
                  : "rgba(26,25,24,0.06)",
              }}
              transition={{ duration: 0.3 }}
              style={{ border: "1px solid rgba(26,25,24,0.06)" }}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-mono text-[10px]" style={{ color: TEXT_TERTIARY }}>{line.time}</span>
                <span
                  className="text-[10px] font-semibold"
                  style={{ color: i === activeLine ? ACCENT : TEXT_TERTIARY }}
                >
                  {line.confidence}%
                </span>
              </div>
              <p className="text-xs font-medium" style={{ color: i === activeLine ? TEXT_PRIMARY : TEXT_SECONDARY }}>
                &ldquo;{line.text}&rdquo;
              </p>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Bottom status bar */}
      <div
        className="flex items-center gap-3 px-5 py-2.5"
        style={{ borderTop: "1px solid rgba(26,25,24,0.07)", background: "rgba(250,250,249,0.9)" }}
      >
        <div className="flex-1 h-1 rounded-full overflow-hidden" style={{ background: "rgba(26,25,24,0.08)" }}>
          <motion.div
            className="h-full rounded-full"
            style={{ background: `linear-gradient(90deg, ${ACCENT}, ${CYAN})` }}
            animate={{ width: ["12%", "68%", "12%"] }}
            transition={{ duration: 3.6, ease: "easeInOut", repeat: Infinity }}
          />
        </div>
        <span className="text-[10px] font-semibold uppercase tracking-widest shrink-0" style={{ color: TEXT_TERTIARY }}>
          Neural decode active
        </span>
      </div>
    </motion.div>
  )
}

function FrameWaveform() {
  const [tick, setTick] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setTick((v) => v + 1), 60)
    return () => clearInterval(t)
  }, [])

  const bars = Array.from({ length: 18 }, (_, i) => ({
    h: 8 + Math.abs(Math.sin(tick * 0.09 + i * 0.55)) * 28,
    active: i > 5 && i < 13,
  }))

  return (
    <div className="flex items-center gap-[3px] h-12">
      {bars.map((bar, i) => (
        <div
          key={i}
          className="rounded-full transition-all duration-75"
          style={{
            width: 3,
            height: bar.h,
            background: bar.active ? ACCENT : "rgba(26,25,24,0.12)",
            opacity: bar.active ? 0.85 : 0.4,
          }}
        />
      ))}
    </div>
  )
}

// ─── P5: Pipeline flow overview ───────────────────────────────────────────────
function PipelineFlowOverview() {
  const steps = ["Upload", "Detect", "Segment", "Classify", "Temporal", "Compare"]
  const [activeStep, setActiveStep] = useState(0)

  useEffect(() => {
    const t = setInterval(() => setActiveStep((s) => (s + 1) % steps.length), 900)
    return () => clearInterval(t)
  }, [])

  return (
    <MotionSection>
      <div
        className="mb-14 rounded-2xl p-6 overflow-x-auto"
        style={{
          background: "rgba(255,255,255,0.6)",
          border: "1px solid rgba(26,25,24,0.08)",
        }}
      >
        <div className="flex items-center justify-between min-w-[520px]">
          {steps.map((step, i) => (
            <div key={step} className="flex items-center">
              {/* Node */}
              <div className="flex flex-col items-center gap-1.5">
                <motion.div
                  className="flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold"
                  animate={{
                    background: i === activeStep
                      ? ACCENT
                      : i < activeStep
                        ? "rgba(79,70,229,0.18)"
                        : "rgba(26,25,24,0.06)",
                    color: i === activeStep
                      ? "#fff"
                      : i < activeStep
                        ? ACCENT
                        : TEXT_TERTIARY,
                    scale: i === activeStep ? 1.12 : 1,
                  }}
                  transition={{ duration: 0.3 }}
                >
                  {i + 1}
                </motion.div>
                <span
                  className="text-[10px] font-semibold whitespace-nowrap"
                  style={{ color: i === activeStep ? ACCENT : TEXT_TERTIARY }}
                >
                  {step}
                </span>
              </div>

              {/* Connector arrow */}
              {i < steps.length - 1 && (
                <div className="relative mx-2 flex-1 h-px" style={{ width: 28 }}>
                  <motion.div
                    className="absolute inset-0 rounded-full"
                    animate={{
                      background: i < activeStep
                        ? ACCENT
                        : "rgba(26,25,24,0.10)",
                    }}
                    transition={{ duration: 0.3 }}
                    style={{ height: 1, top: "50%", transform: "translateY(-50%)" }}
                  />
                  {/* Arrowhead */}
                  <svg
                    className="absolute right-0 top-1/2 -translate-y-1/2"
                    width="6" height="8" viewBox="0 0 6 8" fill="none"
                  >
                    <path
                      d="M1 1l4 3-4 3"
                      stroke={i < activeStep ? ACCENT : "rgba(26,25,24,0.18)"}
                      strokeWidth="1.2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Active step description */}
        <div className="mt-4 pt-4" style={{ borderTop: "1px solid rgba(26,25,24,0.06)" }}>
          <p className="text-[11px] text-center font-medium" style={{ color: TEXT_SECONDARY }}>
            {[
              "Ingest MP4, MOV, AVI or MKV — raw video enters the pipeline",
              "MTCNN locates and extracts the mouth region per frame",
              "pyannote segments lip-motion regions for temporal analysis",
              "CNN (Inception-v3) classifies individual frames → phoneme patterns",
              "LSTM models analyze motion sequences across frame windows",
              "Aggregate stage outputs, compute accuracy scores, surface results",
            ][activeStep]}
          </p>
        </div>
      </div>
    </MotionSection>
  )
}

// ─── P6: Specs callout ────────────────────────────────────────────────────────
function SpecsCallout() {
  const specs = [
    {
      icon: (
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M15 10l4.553-2.274A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M3 8a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ),
      label: "Formats",
      value: "MP4, MOV, AVI, MKV",
    },
    {
      icon: (
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3 3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ),
      label: "Max duration",
      value: "Up to 5 minutes",
    },
    {
      icon: (
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ),
      label: "Processing time",
      value: "~20–45 seconds",
    },
    {
      icon: (
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2z" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ),
      label: "Audio required",
      value: "No — visual only",
    },
    {
      icon: (
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
          <rect x="2" y="3" width="20" height="14" rx="2" />
          <path d="M8 21h8M12 17v4" strokeLinecap="round" />
        </svg>
      ),
      label: "Min resolution",
      value: "480p (720p recommended)",
    },
    {
      icon: (
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 7a4 4 0 100 8 4 4 0 000-8z" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ),
      label: "Face requirement",
      value: "Single speaker, front-facing",
    },
  ]

  return (
    <section style={{ background: BG_BASE }} className="w-full px-6 md:px-10 lg:px-14 py-20">
      <div className="max-w-6xl mx-auto">
        <MotionSection>
          <div className="mb-10 flex items-center gap-4">
            <div className="h-px flex-1" style={{ background: "rgba(26,25,24,0.08)" }} />
            <div className="flex items-center gap-2 shrink-0">
              <span
                className="rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em]"
                style={{ background: ACCENT_SOFT, color: ACCENT, border: `1px solid ${ACCENT_BORDER}` }}
              >
                Supported inputs
              </span>
            </div>
            <div className="h-px flex-1" style={{ background: "rgba(26,25,24,0.08)" }} />
          </div>
        </MotionSection>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {specs.map(({ icon, label, value }, i) => (
            <MotionSection key={label} delay={i * 0.06}>
              <div
                className="rounded-xl p-4 flex flex-col gap-3 h-full"
                style={{
                  background: BG_LOW,
                  border: "1px solid rgba(26,25,24,0.07)",
                }}
              >
                <div style={{ color: ACCENT }}>{icon}</div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-widest mb-1" style={{ color: TEXT_TERTIARY }}>
                    {label}
                  </p>
                  <p className="text-xs font-medium leading-snug" style={{ color: TEXT_PRIMARY }}>
                    {value}
                  </p>
                </div>
              </div>
            </MotionSection>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── P4: Team section ─────────────────────────────────────────────────────────
function TeamSection() {
  const team = [
    {
      initials: "AK",
      name: "Adem Karray",
      role: "ML Pipeline & Model Architecture",
      focus: "Temporal classification, LSTM design",
    },
    {
      initials: "SB",
      name: "Sarra Belhaj",
      role: "Computer Vision & Detection",
      focus: "MTCNN integration, frame segmentation",
    },
    {
      initials: "YM",
      name: "Yassine Mansouri",
      role: "Data Engineering & Evaluation",
      focus: "Dataset curation, accuracy benchmarking",
    },
  ]

  return (
    <section style={{ background: BG_LOW }} className="w-full px-6 md:px-10 lg:px-14 py-20">
      <div className="max-w-6xl mx-auto">
        <MotionSection>
          <SectionHeading
            label="The team"
            title="Built by"
            subtitle="A graduation research project at the Institute of Technology — 2026, supervised by the Department of Computer Science & AI."
          />
        </MotionSection>

        <div className="grid gap-5 md:grid-cols-3">
          {team.map(({ initials, name, role, focus }, i) => (
            <MotionSection key={name} delay={i * 0.1}>
              <MotionCard
                className="rounded-xl p-6 flex flex-col gap-4"
                style={{
                  background: "rgba(255,255,255,0.72)",
                  border: "1px solid rgba(26,25,24,0.08)",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.borderColor = "rgba(79,70,229,0.2)")}
                onMouseLeave={(e) => (e.currentTarget.style.borderColor = "rgba(26,25,24,0.08)")}
              >
                {/* Avatar */}
                <div className="flex items-center gap-3">
                  <div
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
                    style={{ background: `linear-gradient(135deg, ${ACCENT}, #6366F1)` }}
                  >
                    {initials}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-[#1A1918]">{name}</p>
                    <p className="text-xs" style={{ color: ACCENT }}>{role}</p>
                  </div>
                </div>

                {/* Divider */}
                <div style={{ borderTop: "1px solid rgba(26,25,24,0.07)" }} />

                {/* Focus */}
                <div className="flex items-start gap-2">
                  <svg viewBox="0 0 24 24" className="h-4 w-4 mt-0.5 shrink-0" fill="none" stroke={TEXT_TERTIARY} strokeWidth="1.8">
                    <path d="M9 12l2 2 4-4M12 3a9 9 0 100 18 9 9 0 000-18z" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <p className="text-xs leading-relaxed" style={{ color: TEXT_SECONDARY }}>{focus}</p>
                </div>
              </MotionCard>
            </MotionSection>
          ))}
        </div>

        {/* Institution badge */}
        <MotionSection delay={0.35}>
          <div
            className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3 rounded-xl px-6 py-4"
            style={{ background: ACCENT_SOFT, border: `1px solid ${ACCENT_BORDER}` }}
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0" fill="none" stroke={ACCENT} strokeWidth="1.8">
              <path d="M12 3L2 9l10 6 10-6-10-6zM2 17l10 5 10-5M2 13l10 5 10-5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <p className="text-xs font-medium text-center" style={{ color: ACCENT }}>
              Institute of Technology · Department of Computer Science & Artificial Intelligence · Graduation Project 2026
            </p>
          </div>
        </MotionSection>
      </div>
    </section>
  )
}

// ─── Main ──────────────────────────────────────────────────────────────────
export function LandingPage({ onStartAnalysis }: LandingPageProps) {
  const pipelineRef = useRef<HTMLDivElement>(null)
  const scrollTo = (ref: React.RefObject<HTMLDivElement>) => ref.current?.scrollIntoView({ behavior: "smooth" })

  const pipelineStages = [
    {
      step: 1, title: "Upload Video",
      description: "Ingest any MP4, MOV, AVI or MKV file into the analysis pipeline.",
      icon: <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" strokeLinecap="round" strokeLinejoin="round" /></svg>,
    },
    {
      step: 2, title: "Mouth Detection",
      description: "Locate and extract the mouth region from each video frame with MTCNN precision.",
      icon: <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" strokeLinecap="round" /></svg>,
    },
    {
      step: 3, title: "Segmentation",
      description: "Segment lip motion regions using pyannote on Hugging Face for temporal analysis.",
      icon: <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></svg>,
    },
    {
      step: 4, title: "Image Classification",
      description: "CNN-based model classifies individual frames to identify phoneme patterns.",
      icon: <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" strokeLinecap="round" strokeLinejoin="round" /></svg>,
    },
    {
      step: 5, title: "Video Classification",
      description: "Temporal deep learning models analyze motion sequences across frames.",
      icon: <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M15 10l4.553-2.274A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M3 8a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" strokeLinecap="round" strokeLinejoin="round" /></svg>,
    },
    {
      step: 6, title: "Result Comparison",
      description: "Aggregate stage outputs, compute accuracy scores, and surface actionable insights.",
      icon: <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M18 20V10M12 20V4M6 20v-6" strokeLinecap="round" strokeLinejoin="round" /></svg>,
    },
  ]

  const studies = [
    {
      title: "End-to-End Audiovisual Speech Recognition",
      author: "Afouras et al., 2018",
      summary:
        "Introduced transformer-based architectures for joint audio-visual speech processing at scale.",
    },
    {
      title: "LipNet: End-to-End Sentence-Level Lipreading",
      author: "Assael et al., 2016",
      summary:
        "Pioneered sentence-level lipreading with spatiotemporal convolutions and CTC loss.",
    },
  ]

  const techStack = [
    { key: "pyannote", name: "pyannote", icon: <span style={{ color: ACCENT, fontWeight: 700, fontSize: 20 }}>Py</span>, description: "Handles segmentation and temporal partitioning of visual speech sequences." },
    { key: "cnn", name: "Inception-v3", icon: <span style={{ color: ACCENT, fontWeight: 700, fontSize: 20 }}>CNN</span>, description: "Handles image-based classification of extracted lip frames and viseme patterns." },
    { key: "lstm", name: "LSTM Temporal", icon: <svg viewBox="0 0 24 24" className="h-8 w-8" fill="none" stroke={ACCENT} strokeWidth="2"><path d="M4 16l4-4 4 4 8-8" strokeLinecap="round" strokeLinejoin="round" /><circle cx="4" cy="16" r="1.5" fill={ACCENT} stroke="none" /><circle cx="8" cy="12" r="1.5" fill={ACCENT} stroke="none" /><circle cx="12" cy="16" r="1.5" fill={ACCENT} stroke="none" /><circle cx="20" cy="8" r="1.5" fill={ACCENT} stroke="none" /></svg>, description: "Models temporal dependencies across frames for sequence-aware classification." },
    { key: "pipeline", name: "Data Pipeline", icon: <svg viewBox="0 0 24 24" className="h-8 w-8" fill="none" stroke={ACCENT} strokeWidth="2"><rect x="4" y="4" width="5" height="5" /><rect x="15" y="4" width="5" height="5" /><rect x="15" y="15" width="5" height="5" /><path d="M9 6.5h6M17.5 9v6M9 17.5h6" strokeLinecap="round" /></svg>, description: "Connects all stages from upload to final comparison in one structured workflow." },
  ]

  const heroContainer = {
    hidden: {},
    visible: { transition: { staggerChildren: 0.15, delayChildren: 0.1 } },
  }
  const heroItem = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" } },
  }

  return (
    <div
      className="relative min-h-screen overflow-x-hidden font-sans"
      style={{ background: BG_BASE, fontFamily: "'Space Grotesk', 'Inter', system-ui, sans-serif" }}
    >
      {/* ── TOP NAV ────────────────────────────────────────────── */}
      <header
        className="sticky top-0 z-50"
        style={{ background: "rgba(250,250,249,0.86)", borderBottom: "1px solid rgba(26,25,24,0.08)", backdropFilter: "blur(16px)" }}
      >
        <div className="flex h-16 items-center px-6 max-w-[1440px] mx-auto">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-3">
              <div
                className="flex h-8 w-8 items-center justify-center rounded-lg text-white"
                style={{ background: `linear-gradient(135deg, ${ACCENT}, #6366F1)` }}
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="6" cy="12" r="2" />
                  <circle cx="12" cy="6" r="2" />
                  <circle cx="18" cy="12" r="2" />
                  <circle cx="12" cy="18" r="2" />
                  <path d="M8 12h8M12 8v8" />
                </svg>
              </div>
              <div className="leading-tight">
                <div className="text-sm font-bold tracking-tight text-[#1A1918]">LipRead AI</div>
                <div className="text-[10px] font-semibold tracking-widest" style={{ color: ACCENT }}>
                  NEURAL ENGINE
                </div>
              </div>
            </div>

            <button
              onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
              className="hidden md:block text-xs font-semibold uppercase tracking-widest transition-colors"
              style={{ color: TEXT_SECONDARY }}
              onMouseEnter={(e) => (e.currentTarget.style.color = TEXT_PRIMARY)}
              onMouseLeave={(e) => (e.currentTarget.style.color = TEXT_SECONDARY)}
            >
              Home
            </button>

            <div className="relative hidden md:block group">
              <button
                className="flex items-center gap-1 text-xs font-semibold uppercase tracking-widest transition-colors"
                style={{ color: TEXT_SECONDARY }}
                onMouseEnter={(e) => (e.currentTarget.style.color = TEXT_PRIMARY)}
                onMouseLeave={(e) => (e.currentTarget.style.color = TEXT_SECONDARY)}
              >
                <span>Research</span>
                <IconChevronDown />
              </button>

              <div
                className="pointer-events-none absolute left-0 top-full z-50 mt-4 w-[420px] rounded-2xl p-4 opacity-0 translate-y-2 transition-all duration-200 group-hover:pointer-events-auto group-hover:opacity-100 group-hover:translate-y-0"
                style={{
                  background: "rgba(255,255,255,0.9)",
                  border: "1px solid rgba(26,25,24,0.08)",
                  boxShadow: "0 18px 40px rgba(26,25,24,0.10)",
                }}
              >
                <div className="space-y-3">
                  {studies.map((study) => (
                    <div
                      key={study.title}
                      className="rounded-xl p-4 transition-colors"
                      style={{ background: "rgba(255,255,255,0.72)", border: "1px solid rgba(26,25,24,0.06)" }}
                    >
                      <p className="text-[10px] font-semibold uppercase tracking-[0.18em]" style={{ color: ACCENT }}>
                        {study.author}
                      </p>
                      <h4 className="mt-2 text-sm font-semibold text-[#1A1918]">
                        {study.title}
                      </h4>
                      <p className="mt-2 text-sm leading-relaxed" style={{ color: TEXT_SECONDARY }}>
                        {study.summary}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="ml-auto">
            <button
              onClick={onStartAnalysis}
              className="group relative flex items-center gap-2 overflow-hidden rounded-full px-5 py-2 text-sm font-semibold text-white shadow-lg transition-all duration-200 hover:scale-[1.04]"
              style={{ background: ACCENT, color: "white", boxShadow: "0 10px 30px rgba(79,70,229,0.18)" }}
            >
              <span>Start Analysis</span>
              <IconChevronRight />
            </button>
          </div>
        </div>
      </header>

      {/* ══════════════════════════════════════════════════════════
          SECTION 1 — HERO
      ══════════════════════════════════════════════════════════ */}
      <section style={{ background: BG_BASE }} className="relative flex flex-col items-center px-6 pb-24 pt-20 text-center">
        <GridBackground />
        <motion.div
          className="relative z-10 max-w-3xl w-full"
          variants={heroContainer}
          initial="hidden"
          animate="visible"
        >
          {/* Badge */}
          <motion.div variants={heroItem}>
            <div
              className="mb-6 inline-flex items-center gap-2 rounded-full px-4 py-1.5"
              style={{ border: ACCENT_BORDER, background: ACCENT_SOFT }}
            >
              <span className="h-1.5 w-1.5 animate-pulse rounded-full" style={{ background: ACCENT }} />
              <span className="text-[11px] font-semibold uppercase tracking-[0.18em]" style={{ color: ACCENT }}>
                Neural Speech Analysis
              </span>
            </div>
          </motion.div>

          {/* Title */}
          <motion.h1
            variants={heroItem}
            className="mb-6 text-4xl font-bold leading-tight tracking-tight text-[#1A1918] md:text-5xl lg:text-6xl"
          >
            AI-Powered Lip Reading
            <br />
            <span className="bg-clip-text text-transparent" style={{ backgroundImage: `linear-gradient(90deg, ${CYAN}, #aac7ff)` }}>
              from Video Stream
            </span>
          </motion.h1>

          {/* Subtitle */}
          <motion.p
            variants={heroItem}
            className="mb-10 text-base leading-relaxed md:text-lg"
            style={{ color: TEXT_SECONDARY }}
          >
            Transforming visual movement into semantic insights through a multi-stage deep learning pipeline
            to extract meaningful predictions and actionable results.
          </motion.p>

          {/* CTA */}
          <motion.div variants={heroItem} className="flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <button
              onClick={() => scrollTo(pipelineRef)}
              className="flex items-center gap-2 rounded-lg px-6 py-3 text-sm font-medium transition-all"
              style={{ border: "1px solid rgba(26,25,24,0.12)", color: "rgba(79,70,229,0.8)" }}
            >
              Explore Pipeline
              <IconArrowDown />
            </button>
          </motion.div>
        </motion.div>

        {/* Stats row */}
        <motion.div
          className="relative z-10 mt-16 grid grid-cols-3 gap-px overflow-hidden rounded-2xl w-full max-w-2xl"
          style={{ border: "1px solid rgba(26,25,24,0.08)", background: BG_LOW }}
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut", delay: 0.7 }}
        >
          {[
            { value: 6, suffix: "", label: "Pipeline Stages" },
            { value: 94, suffix: "%", label: "Avg. Accuracy" },
            { value: 3, suffix: "", label: "AI Models" },
          ].map(({ value, suffix, label }) => (
            <div key={label} className="flex flex-col items-center px-8 py-5" style={{ background: "rgba(255,255,255,0.56)" }}>
              <span className="text-3xl font-bold" style={{ color: ACCENT }}>
                <Counter target={value} suffix={suffix} />
              </span>
              <span className="mt-1 text-[11px] font-semibold uppercase tracking-widest" style={{ color: TEXT_TERTIARY }}>
                {label}
              </span>
            </div>
          ))}
        </motion.div>

        {/* ── P1: Hero preview card ── */}
        <div className="relative z-10 w-full max-w-2xl">
          <HeroPreviewCard />
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════
          SECTION 2 — WHY IT MATTERS  (P3: richer cards with stats)
      ══════════════════════════════════════════════════════════ */}
      <section style={{ background: BG_LOW }} className="w-full px-6 md:px-10 lg:px-14 py-24">
        <div className="max-w-6xl mx-auto">
          <MotionSection>
            <SectionHeading
              label="Purpose"
              title="Why This Matters"
              subtitle="Lip reading technology bridges critical gaps across multiple domains."
            />
          </MotionSection>
          <div className="grid gap-5 md:grid-cols-3 items-stretch">
            {[
              {
                icon: <Ear className="h-8 w-8" />,
                title: "Assistive Tech",
                desc: "Enables communication for individuals with hearing impairments through silent speech analysis.",
                stat: "430M+",
                statLabel: "people live with disabling hearing loss globally (WHO)",
              },
              {
                icon: <Brain className="h-8 w-8" />,
                title: "AI Research",
                desc: "Advances the frontier of multimodal AI by fusing temporal and spatial visual understanding.",
                stat: "~70%",
                statLabel: "of human communication is non-verbal or visual in nature",
              },
              {
                icon: <Mic className="h-8 w-8" />,
                title: "Silent Speech",
                desc: "Unlocks speech recognition in noise-free, audio-less environments and surveillance applications.",
                stat: "No audio",
                statLabel: "required — works in any environment, regardless of noise",
              },
            ].map(({ icon, title, desc, stat, statLabel }, i) => (
              <MotionSection key={title} delay={i * 0.1}>
                <MotionCard
                  className="h-full rounded-xl p-8 flex flex-col"
                  style={{ background: BG_MID, border: "1px solid rgba(26,25,24,0.08)" }}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = "rgba(79,70,229,0.24)")}
                  onMouseLeave={e => (e.currentTarget.style.borderColor = "rgba(26,25,24,0.08)")}
                >
                  <div className="mb-4" style={{ color: ACCENT }}>{icon}</div>
                  <h3 className="mb-1.5 text-lg font-semibold text-[#1A1918]">{title}</h3>
                  <p className="text-sm leading-relaxed mb-5 flex-1" style={{ color: TEXT_SECONDARY }}>{desc}</p>
                  {/* Stat callout */}
                  <div
                    className="rounded-lg px-4 py-3 mt-auto"
                    style={{ background: ACCENT_SOFT, border: `1px solid ${ACCENT_BORDER}` }}
                  >
                    <p className="text-base font-bold" style={{ color: ACCENT }}>{stat}</p>
                    <p className="text-[11px] leading-snug mt-0.5" style={{ color: TEXT_SECONDARY }}>{statLabel}</p>
                  </div>
                </MotionCard>
              </MotionSection>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════
          SECTION 3 — PIPELINE  (P5: flow overview added)
      ══════════════════════════════════════════════════════════ */}
      <section ref={pipelineRef} style={{ background: BG_BASE }} className="w-full px-6 md:px-10 lg:px-14 py-24">
        <div className="max-w-6xl mx-auto">
          <MotionSection>
            <div className="mb-10 text-center max-w-2xl mx-auto">
              <span
                className="mb-4 inline-block rounded-full border px-4 py-1 text-[11px] font-semibold uppercase tracking-[0.2em]"
                style={{ borderColor: ACCENT_BORDER, background: ACCENT_SOFT, color: ACCENT }}
              >
                How It Works
              </span>
              <h2 className="text-2xl md:text-3xl font-semibold text-[#1A1918] mb-4">
                The Analysis Pipeline
              </h2>
              <p className="mt-2 text-sm md:text-base leading-relaxed" style={{ color: TEXT_SECONDARY }}>
                Six tightly-integrated stages take your video from raw footage to meaningful predictions.
              </p>
            </div>
          </MotionSection>

          {/* P5: Animated flow overview */}
          <PipelineFlowOverview />

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {pipelineStages.map((stage, i) => (
              <PipelineCard key={stage.step} step={stage.step} title={stage.title} description={stage.description} icon={stage.icon} delay={i * 80} />
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════
          SECTION 4 — CORE TECHNOLOGIES
      ══════════════════════════════════════════════════════════ */}
      <section style={{ background: BG_LOW }} className="w-full px-6 md:px-10 lg:px-14 py-24">
        <div className="max-w-6xl mx-auto">
          <MotionSection>
            <div className="mb-14 flex items-center gap-6">
              <div className="h-px flex-1" style={{ background: "rgba(26,25,24,0.08)" }} />
              <h2 className="shrink-0 text-2xl md:text-3xl font-semibold tracking-tight text-[#1A1918]">Core Technologies</h2>
              <div className="h-px flex-1" style={{ background: "rgba(26,25,24,0.08)" }} />
            </div>
          </MotionSection>

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {techStack.map(({ key, name, icon, description }, i) => (
              <MotionSection key={key} delay={i * 0.08}>
                <MotionCard
                  className="rounded-xl p-8 text-center"
                  style={{ background: BG_MID, border: "1px solid rgba(26,25,24,0.08)" }}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = "rgba(79,70,229,0.22)")}
                  onMouseLeave={e => (e.currentTarget.style.borderColor = "rgba(26,25,24,0.08)")}
                >
                  <div
                    className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full"
                    style={{ background: ACCENT_SOFT }}
                  >
                    {icon}
                  </div>
                  <h3 className="text-base font-semibold text-[#1A1918]">{name}</h3>
                  <p className="mt-3 text-sm leading-relaxed" style={{ color: TEXT_SECONDARY }}>{description}</p>
                </MotionCard>
              </MotionSection>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════
          SECTION 5 — P6: SPECS CALLOUT
      ══════════════════════════════════════════════════════════ */}
      <SpecsCallout />

      {/* ══════════════════════════════════════════════════════════
          SECTION 6 — INFERENCE ACCURACY
      ══════════════════════════════════════════════════════════ */}
      <section style={{ background: BG_LOW }} className="w-full px-6 py-24">
        <div className="max-w-[1440px] mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <MotionSection>
              <h2 className="text-2xl md:text-3xl font-semibold text-[#1A1918] mb-5">
                Inference Accuracy
              </h2>

              <p
                className="mb-8 text-base leading-relaxed max-w-xl"
                style={{ color: TEXT_SECONDARY }}
              >
                The engine provides real-time confidence scores and word-error-rate (WER)
                minimization. Our model consistently achieves 94%+ accuracy on benchmark
                datasets.
              </p>

              <div className="space-y-6">
                {[
                  { label: "Phoneme Alignment", value: "98.2%", width: "98%" },
                  { label: "Temporal Consistency", value: "91.5%", width: "91%" },
                ].map(({ label, value, width }) => (
                  <div key={label}>
                    <div className="mb-3 flex items-center justify-between">
                      <span className="text-xs font-medium text-[#1A1918]">{label}</span>
                      <span className="text-sm font-semibold text-[#1A1918]">{value}</span>
                    </div>
                    <div
                      className="h-1 w-full overflow-hidden rounded-full"
                      style={{ background: "rgba(26,25,24,0.08)" }}
                    >
                      <div
                        className="h-full rounded-full"
                        style={{
                          width,
                          background: ACCENT,
                          boxShadow: "0 6px 18px rgba(79,70,229,0.16)",
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </MotionSection>

            <MotionSection delay={0.15}>
              <MotionCard
                className="rounded-2xl p-6"
                style={{
                  background: BG_MID,
                  border: "1px solid rgba(79,70,229,0.16)",
                  boxShadow: "0 18px 40px rgba(79,70,229,0.08)",
                }}
              >
                <div className="mb-6 flex items-center justify-between">
                  <h4 className="text-xl font-semibold text-[#1A1918]">Analysis Summary</h4>
                  <span
                    className="rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.12em]"
                    style={{ background: "rgba(79,70,229,0.10)", color: ACCENT }}
                  >
                    Processed
                  </span>
                </div>

                <div className="space-y-3 font-mono text-sm">
                  {[
                    '[00:02.14] detected_string: "hello world"',
                    '[00:04.58] detected_string: "neural engine active"',
                    '[00:07.82] detected_string: "decoding complete"',
                  ].map((line) => (
                    <div
                      key={line}
                      className="rounded-md px-3 py-3"
                      style={{
                        background: "rgba(255,255,255,0.62)",
                        border: "1px solid rgba(26,25,24,0.04)",
                        color: ACCENT,
                      }}
                    >
                      {line}
                    </div>
                  ))}
                </div>

                <div className="mt-6 pt-6" style={{ borderTop: "1px solid rgba(26,25,24,0.08)" }}>
                  <div className="flex items-center gap-4">
                    <div
                      className="flex-1 h-12 rounded-xl flex items-center px-5"
                      style={{ background: "rgba(26,25,24,0.06)" }}
                    >
                      <div
                        className="h-2 w-24 rounded-full overflow-hidden"
                        style={{ background: "rgba(79,70,229,0.14)" }}
                      >
                        <div className="h-full rounded-full" style={{ width: "50%", background: ACCENT }} />
                      </div>
                    </div>
                    <button
                      className="flex h-12 w-12 items-center justify-center rounded-xl transition-transform hover:scale-105"
                      style={{ background: ACCENT, color: "white" }}
                    >
                      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M12 3v12" strokeLinecap="round" />
                        <path d="M7 10l5 5 5-5" strokeLinecap="round" strokeLinejoin="round" />
                        <path d="M5 21h14" strokeLinecap="round" />
                      </svg>
                    </button>
                  </div>
                </div>
              </MotionCard>
            </MotionSection>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════
          SECTION 7 — P4: TEAM
      ══════════════════════════════════════════════════════════ */}
      <TeamSection />

      {/* ══════════════════════════════════════════════════════════
          SECTION 8 — CTA
      ══════════════════════════════════════════════════════════ */}
      <section style={{ background: BG_BASE }} className="w-full px-6 py-20">
        <div className="max-w-2xl mx-auto text-center">
          <MotionSection>
            <div
              className="rounded-3xl p-10"
              style={{ border: "1px solid rgba(79,70,229,0.18)", background: "rgba(255,255,255,0.72)" }}
            >
              <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em]" style={{ color: ACCENT }}>Ready?</p>
              <h2 className="mb-3 text-xl font-bold text-[#1A1918]">Connect your video source</h2>
              <p className="mb-2 text-sm" style={{ color: TEXT_SECONDARY }}>
                Start the neural transcription pipeline instantly — one click away.
              </p>
              {/* What happens next */}
              <div className="mb-8 flex items-center justify-center gap-6 mt-4">
                {["Upload video", "~30s processing", "View results"].map((step, i) => (
                  <div key={step} className="flex items-center gap-2">
                    {i > 0 && (
                      <svg viewBox="0 0 16 16" className="h-3 w-3 shrink-0" fill="none" stroke={TEXT_TERTIARY} strokeWidth="1.5">
                        <path d="M4 8h8M9 5l3 3-3 3" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                    <span className="text-[11px] font-medium" style={{ color: TEXT_SECONDARY }}>{step}</span>
                  </div>
                ))}
              </div>

              <motion.button
                onClick={onStartAnalysis}
                className="rounded-full px-10 py-4 text-sm font-bold text-white"
                style={{ background: ACCENT, color: "white" }}
                animate={{
                  boxShadow: [
                    "0 14px 36px rgba(79,70,229,0.18)",
                    "0 14px 48px rgba(79,70,229,0.38)",
                    "0 14px 36px rgba(79,70,229,0.18)",
                  ],
                }}
                transition={{ duration: 2.4, ease: "easeInOut", repeat: Infinity }}
                whileHover={{ scale: 1.05 }}
              >
                Start Neural Analysis
              </motion.button>
            </div>
          </MotionSection>
        </div>
      </section>

      {/* ── FOOTER ─────────────────────────────────────────────── */}
      <footer style={{ background: BG_BASE, borderTop: "1px solid rgba(26,25,24,0.08)" }}>
        <div className="mx-auto max-w-6xl px-6 py-10">
          <div className="grid gap-8 sm:grid-cols-3">
            <div>
              <div className="mb-3 flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-md text-white" style={{ background: `linear-gradient(135deg, ${ACCENT}, #6366F1)` }}>
                  <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="6" cy="12" r="2" /><circle cx="12" cy="6" r="2" /><circle cx="18" cy="12" r="2" /><circle cx="12" cy="18" r="2" />
                    <path d="M8 12h8M12 8v8" />
                  </svg>
                </div>
                <span className="text-sm font-bold text-[#1A1918]">LipRead AI</span>
              </div>
              <p className="text-xs leading-snug" style={{ color: TEXT_TERTIARY }}>
                Neural lip-reading analysis powered by multi-stage deep learning models.
              </p>
            </div>

            <div className="text-center">
              <p className="text-xs font-semibold" style={{ color: TEXT_SECONDARY }}>Project Owner</p>
              <p className="mt-1 text-xs" style={{ color: TEXT_TERTIARY }}>AI & Computer Vision Graduation Project</p>
              <p className="mt-0.5 text-xs" style={{ color: TEXT_TERTIARY }}>Institute of Technology — 2026</p>
            </div>

            <div className="text-right">
              <p className="text-xs font-semibold" style={{ color: TEXT_SECONDARY }}>Contact</p>
              <p className="mt-1 text-xs" style={{ color: TEXT_TERTIARY }}>contact@lipread-ai.dev</p>
              <div className="mt-2 flex justify-end gap-3">
                {["Docs", "Pipeline"].map((link) => (
                  <button key={link} className="text-[11px] transition-colors" style={{ color: TEXT_SECONDARY }}
                    onMouseEnter={e => (e.currentTarget.style.color = TEXT_PRIMARY)}
                    onMouseLeave={e => (e.currentTarget.style.color = TEXT_SECONDARY)}
                  >
                    {link}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-8 pt-6 text-center text-[11px]" style={{ borderTop: "1px solid rgba(26,25,24,0.08)", color: "rgba(26,25,24,0.18)" }}>
            © 2026 LipRead AI. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  )
}