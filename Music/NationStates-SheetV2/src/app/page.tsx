'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Landmark,
  Sparkles,
  Loader2,
  Trash2,
  Star,
  ChevronRight,
  Quote,
  RotateCcw,
  ClipboardPaste,
  Paperclip,
  Plus,
  X,
  FileText,
  Image as ImageIcon,
  Eye,
  EyeOff,
  BookOpen,
  Save,
  Check,
  ScrollText,
  Clock,
  Gavel,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { toast } from 'sonner'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog'

/* ----------------------------- Types ----------------------------- */

type Nation = {
  id: string
  name: string
  motto: string
  overview: string | null
  americanness: number
  freedom: number
  economy: number
  democracy: number
  decisionsCount: number
}

type Option = { label: string; summary: string }

type Verdict = {
  id: string
  issueTitle: string
  chosenOption: string
  reasoning: string
  patrioticQuote: string | null
  americannessScore: number
  freedomDelta: number
  economyDelta: number
  democracyDelta: number
  options: Option[]
  createdAt: string
}

// A persisted decision, as returned by /api/history — includes the full issue
// text and the options array so the modal can show the complete response.
type HistoryItem = {
  id: string
  issueTitle: string
  issueText: string
  chosenOption: string
  reasoning: string
  patrioticQuote: string | null
  americannessScore: number
  freedomDelta: number
  economyDelta: number
  democracyDelta: number
  options: Option[]
  createdAt: string
}

type FileSlotStatus = 'idle' | 'reading' | 'extracting' | 'done' | 'error'

type FileSlot = {
  id: string
  file: File | null
  status: FileSlotStatus
  text: string
  error: string | null
  previewUrl: string | null
  expanded: boolean
}

/* --------------------------- Theme colors -------------------------- */
// Old Glory Red & Blue — explicitly USA-themed per user request.
const RED = '#B22234'
const BLUE = '#3C3B6E'

/* ------------------------ Stars & stripes bar ---------------------- */

function FlagBar() {
  // A compact stars-and-stripes accent bar.
  const stripes = Array.from({ length: 7 })
  const stars = '★ ★ ★ ★ ★ ★ ★ ★ ★ ★ ★ ★ ★'
  return (
    <div className="h-2 w-full overflow-hidden rounded-full flex shadow-inner">
      <div
        className="h-full flex items-center justify-center px-3"
        style={{ width: '40%', backgroundColor: BLUE }}
        aria-hidden
      >
        <span className="text-white text-[8px] leading-none tracking-widest whitespace-nowrap opacity-90">
          {stars}
        </span>
      </div>
      <div className="h-full flex-1 flex">
        {stripes.map((_, i) => (
          <div
            key={i}
            className="h-full flex-1"
            style={{ backgroundColor: i % 2 === 0 ? RED : '#ffffff' }}
          />
        ))}
      </div>
    </div>
  )
}

/* -------------------------- Delta chip ----------------------------- */

function DeltaChip({ value, label }: { value: number; label: string }) {
  if (!value) return null
  const positive = value > 0
  return (
    <span
      className={
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ' +
        (positive
          ? 'bg-emerald-100 text-emerald-700'
          : 'bg-red-100 text-red-700')
      }
    >
      {positive ? '▲' : '▼'} {label} {positive ? '+' : ''}
      {value}
    </span>
  )
}

/* ---------------------- American-ness label ------------------------ */

function americannessLabel(score: number): { text: string; tone: string } {
  if (score >= 90) return { text: 'All-American', tone: 'bg-[#3C3B6E] text-white' }
  if (score >= 75) return { text: 'Stars & Stripes', tone: 'bg-[#B22234] text-white' }
  if (score >= 60) return { text: 'Patriotic', tone: 'bg-blue-100 text-blue-800' }
  if (score >= 40) return { text: 'On the Fence', tone: 'bg-amber-100 text-amber-800' }
  if (score >= 20) return { text: 'Un-American', tone: 'bg-orange-100 text-orange-800' }
  return { text: 'Treasonous', tone: 'bg-red-200 text-red-900' }
}

/* ----------------------- Time-ago formatter ------------------------ */

function timeAgo(iso: string): string {
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return ''
  const diff = Date.now() - then
  const min = Math.round(diff / 60000)
  if (min < 1) return 'just now'
  if (min < 60) return `${min}m ago`
  const hr = Math.round(min / 60)
  if (hr < 24) return `${hr}h ago`
  const day = Math.round(hr / 24)
  if (day < 7) return `${day}d ago`
  return new Date(iso).toLocaleDateString()
}

/* -------------------------- Sample issue --------------------------- */

const SAMPLE_ISSUE = `Issue: A group of concerned citizens has gathered outside the Capitol, demanding action after a recent scandal revealed that several members of the El Sovaraldo legislature accepted lavish gifts from defense contractors.

Option 1: "We must drain the swamp!" shouts activist @@RANDOMNAME@@. "Ban ALL gifts to politicians, impose strict term limits, and create an independent ethics commission with real teeth. The people deserve honest government!"

Option 2: "This is a tempest in a teapot," snorts a well-dressed defense lobbyist. "These are just goodwill gestures between industry and government. Regulating them would strangle legitimate dialogue. Let the voters sort it out at the ballot box."

Option 3: "The real problem is that we have a legislature at all," muses a self-styled anarchist. "Abolish the assembly and let the people govern themselves directly through daily online referenda. Power to the people!"

Option 4: "Perhaps a middle path," suggests a constitutional scholar. "Require full public disclosure of every gift above fifty dollars, backed by serious penalties for secrecy — but otherwise trust the voters to judge."`

/* ----------------------- Default nation overview ----------------------- */

const DEFAULT_OVERVIEW = `The Republic of El Sovaraldo is a tiny, safe nation, notable for its sprawling nuclear power plants. The hard-nosed, hard-working, democratic, devout population of 7 million El Sovaraldoans enjoy a sensible mix of personal and economic freedoms, while the political process is open and the people's right to vote held sacrosanct.

The medium-sized, outspoken government prioritizes Spirituality, although Law & Order, Defense, and Education are also considered important. The average income tax rate is 30.4%.

The strong El Sovaraldoan economy, worth 383 billion The Sovaraldan Dollars a year, is broadly diversified and led by the Gambling industry, with major contributions from Information Technology, Trout Farming, and Automobile Manufacturing. Average income is 54,829 The Sovaraldan Dollars, and evenly distributed, with the richest citizens earning only 4.7 times as much as the poorest.

A few people seem to spend their whole time complaining, statues of famous citizens are erected or demolished on a purely partisan basis, the weather report is the prisoners' favourite programme, and Brancalandian Brie isn't available anywhere in El Sovaraldo. Crime is well under control, thanks to a capable police force and progressive social policies in education and welfare. El Sovaraldo's national animal is the Bald Eagle, which soars majestically through the nation's famously clear skies.

Civil Rights : Excellent
Economy : Strong
Political Freedom : Excessive`

/* -------------------------- File slot row ------------------------- */

function FileSlotRow({
  slot,
  loading,
  onSelect,
  onRemove,
  onToggle,
}: {
  slot: FileSlot
  loading: boolean
  onSelect: (file: File) => void
  onRemove: () => void
  onToggle: () => void
}) {
  const statusMeta: Record<FileSlotStatus, { text: string; cls: string }> = {
    idle: { text: 'No file', cls: 'bg-slate-100 text-slate-500' },
    reading: { text: 'Reading…', cls: 'bg-blue-100 text-blue-700' },
    extracting: { text: 'Extracting…', cls: 'bg-blue-100 text-blue-700' },
    done: { text: 'Ready', cls: 'bg-emerald-100 text-emerald-700' },
    error: { text: 'Failed', cls: 'bg-red-100 text-red-700' },
  }
  const meta = statusMeta[slot.status]
  const isBusy = slot.status === 'reading' || slot.status === 'extracting'
  const isImage = slot.file?.type.startsWith('image/') ?? false

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
      <div className="flex items-center gap-2">
        <label
          className={
            'inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50 ' +
            (loading || isBusy ? 'pointer-events-none opacity-60' : '')
          }
        >
          <Paperclip className="h-3.5 w-3.5" />
          {slot.file ? 'Change' : 'Choose'}
          <input
            type="file"
            accept=".txt,.md,.text,image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) onSelect(f)
              e.target.value = ''
            }}
            disabled={loading || isBusy}
          />
        </label>
        <span className="flex min-w-0 flex-1 items-center gap-1.5 text-sm">
          {isImage ? (
            <ImageIcon className="h-4 w-4 shrink-0 text-slate-400" />
          ) : (
            <FileText className="h-4 w-4 shrink-0 text-slate-400" />
          )}
          <span className="truncate">
            {slot.file?.name || 'No file chosen'}
          </span>
        </span>
        {slot.file && (
          <Badge
            variant="secondary"
            className={'shrink-0 text-[10px] ' + meta.cls}
          >
            {isBusy && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
            {meta.text}
          </Badge>
        )}
        <Button
          size="icon"
          variant="ghost"
          className="h-7 w-7 shrink-0 text-muted-foreground hover:text-red-600"
          onClick={onRemove}
          disabled={loading}
          aria-label="Remove file"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {slot.previewUrl && (
        <div className="mt-2 overflow-hidden rounded-md border border-slate-200">
          <img
            src={slot.previewUrl}
            alt={slot.file?.name ?? 'preview'}
            className="max-h-44 w-full object-contain bg-slate-50"
          />
        </div>
      )}

      {slot.error && (
        <p className="mt-2 text-xs text-red-600">{slot.error}</p>
      )}

      {slot.text && (
        <div className="mt-2">
          <button
            type="button"
            onClick={onToggle}
            className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-700"
          >
            {slot.expanded ? (
              <EyeOff className="h-3.5 w-3.5" />
            ) : (
              <Eye className="h-3.5 w-3.5" />
            )}
            {slot.expanded ? 'Hide' : 'Show'} extracted text (
            {slot.text.length} chars)
          </button>
          {slot.expanded && (
            <pre className="mt-1.5 max-h-40 overflow-auto whitespace-pre-wrap rounded-md bg-slate-50 p-2 text-xs leading-relaxed text-slate-700">
              {slot.text}
            </pre>
          )}
        </div>
      )}
    </div>
  )
}

/* ---------------------- Full-response dialog ----------------------- */

function FullResponseDialog({
  decision,
  onClose,
}: {
  decision: HistoryItem | null
  onClose: () => void
}) {
  return (
    <Dialog open={!!decision} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-2xl">
        {decision && (
          <>
            <DialogHeader>
              <div className="flex items-start gap-3 pr-8">
                <div
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-white"
                  style={{ backgroundColor: BLUE }}
                >
                  <Gavel className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                    Congressional Record · Full Response
                  </p>
                  <DialogTitle className="truncate text-lg font-bold leading-tight">
                    {decision.issueTitle}
                  </DialogTitle>
                  <DialogDescription className="flex items-center gap-1.5 pt-0.5 text-xs">
                    <Clock className="h-3 w-3" />
                    {new Date(decision.createdAt).toLocaleString()} ·{' '}
                    {timeAgo(decision.createdAt)}
                  </DialogDescription>
                </div>
                <Badge
                  className="shrink-0 text-white"
                  style={{ backgroundColor: RED }}
                  title="American-ness of this choice"
                >
                  <Star className="mr-1 h-3 w-3" />
                  {decision.americannessScore}/100
                </Badge>
              </div>
            </DialogHeader>

            <div className="space-y-4">
              {/* The original issue */}
              <div>
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                  The Issue
                </p>
                <pre className="max-h-48 overflow-auto whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-xs leading-relaxed text-slate-700">
                  {decision.issueText}
                </pre>
              </div>

              <Separator />

              {/* The chosen option */}
              <div>
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                  The American Choice
                </p>
                <div
                  className="rounded-lg border-l-4 bg-slate-50 p-3"
                  style={{ borderColor: RED }}
                >
                  <p className="font-semibold leading-snug text-foreground">
                    {decision.chosenOption}
                  </p>
                </div>
              </div>

              {/* Options considered */}
              {decision.options?.length > 0 && (
                <div>
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                    Options Considered
                  </p>
                  <ul className="space-y-1.5">
                    {decision.options.map((o, i) => {
                      const chosen =
                        o.label?.trim() === decision.chosenOption?.trim()
                      return (
                        <li
                          key={i}
                          className={
                            'flex items-start gap-2 rounded-md p-2 text-sm ' +
                            (chosen ? 'bg-red-50' : '')
                          }
                        >
                          <ChevronRight
                            className="mt-0.5 h-4 w-4 shrink-0"
                            style={{ color: chosen ? RED : '#94a3b8' }}
                          />
                          <span>
                            <span className="font-medium">{o.label}</span>
                            {chosen && (
                              <Badge
                                className="ml-2 bg-[#B22234] text-[9px] text-white"
                                title="America's choice"
                              >
                                CHOSEN
                              </Badge>
                            )}
                            {o.summary ? (
                              <span className="text-muted-foreground">
                                {' '}
                                — {o.summary}
                              </span>
                            ) : null}
                          </span>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              )}

              <Separator />

              {/* Reasoning */}
              <div>
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                  American Reasoning
                </p>
                <p className="text-sm leading-relaxed text-foreground/90">
                  {decision.reasoning}
                </p>
              </div>

              {/* Quote */}
              {decision.patrioticQuote && (
                <div className="flex gap-2 rounded-lg bg-[#3C3B6E]/5 p-3">
                  <Quote
                    className="h-4 w-4 shrink-0 translate-y-0.5"
                    style={{ color: BLUE }}
                  />
                  <p className="text-sm italic text-foreground/80">
                    “{decision.patrioticQuote}”
                  </p>
                </div>
              )}

              {/* Deltas */}
              <div className="flex flex-wrap gap-2 pt-1">
                <DeltaChip value={decision.freedomDelta} label="Freedom" />
                <DeltaChip value={decision.economyDelta} label="Economy" />
                <DeltaChip value={decision.democracyDelta} label="Democracy" />
              </div>
            </div>

            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline" className="gap-1.5">
                  Close Record
                </Button>
              </DialogClose>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

/* ------------------------------ Page ------------------------------- */

export default function Home() {
  const [issueText, setIssueText] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [verdict, setVerdict] = useState<Verdict | null>(null)
  const [nation, setNation] = useState<Nation | null>(null)
  const [fileSlots, setFileSlots] = useState<FileSlot[]>([])
  const idCounter = useRef(0)
  const [overviewText, setOverviewText] = useState('')
  const [savingOverview, setSavingOverview] = useState(false)
  const [overviewSaved, setOverviewSaved] = useState(false)
  const overviewInit = useRef(false)

  // Congressional Record
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [selectedDecision, setSelectedDecision] = useState<HistoryItem | null>(
    null
  )
  const [clearingHistory, setClearingHistory] = useState(false)

  // Initial load
  useEffect(() => {
    void fetchNation()
    void fetchHistory()
  }, [])

  const fetchNation = useCallback(async () => {
    try {
      const res = await fetch('/api/nation', { cache: 'no-store' })
      const data = await res.json()
      if (data?.nation) setNation(data.nation)
    } catch {
      /* non-fatal */
    }
  }, [])

  const fetchHistory = useCallback(async () => {
    try {
      const res = await fetch('/api/history', { cache: 'no-store' })
      const data = await res.json()
      if (Array.isArray(data?.decisions)) setHistory(data.decisions)
    } catch {
      /* non-fatal */
    }
  }, [])

  const addFileSlot = useCallback(() => {
    idCounter.current += 1
    setFileSlots((prev) => [
      ...prev,
      {
        id: `f${idCounter.current}`,
        file: null,
        status: 'idle',
        text: '',
        error: null,
        previewUrl: null,
        expanded: false,
      },
    ])
  }, [])

  const removeFileSlot = useCallback((id: string) => {
    setFileSlots((prev) => {
      const slot = prev.find((s) => s.id === id)
      if (slot?.previewUrl) URL.revokeObjectURL(slot.previewUrl)
      return prev.filter((s) => s.id !== id)
    })
  }, [])

  const toggleSlot = useCallback((id: string) => {
    setFileSlots((prev) =>
      prev.map((s) => (s.id === id ? { ...s, expanded: !s.expanded } : s))
    )
  }, [])

  const handleFileSelect = useCallback(
    async (id: string, file: File) => {
      // Reset the slot for the newly chosen file.
      setFileSlots((prev) =>
        prev.map((s) =>
          s.id === id
            ? {
                ...s,
                file,
                status: 'reading',
                text: '',
                error: null,
                previewUrl: null,
                expanded: false,
              }
            : s
        )
      )

      if (file.type.startsWith('image/')) {
        // OCR the screenshot via the VLM-powered extract endpoint.
        const url = URL.createObjectURL(file)
        setFileSlots((prev) =>
          prev.map((s) =>
            s.id === id ? { ...s, previewUrl: url, status: 'extracting' } : s
          )
        )
        try {
          const fd = new FormData()
          fd.append('file', file)
          const res = await fetch('/api/extract', { method: 'POST', body: fd })
          const data = await res.json()
          if (!res.ok) throw new Error(data?.error || 'Could not read image.')
          setFileSlots((prev) =>
            prev.map((s) =>
              s.id === id
                ? {
                    ...s,
                    status: 'done',
                    text: (data.text || '').trim(),
                    expanded: true,
                  }
                : s
            )
          )
          toast.success(`Read "${file.name}".`)
        } catch (e) {
          const msg = e instanceof Error ? e.message : 'Unknown error'
          setFileSlots((prev) =>
            prev.map((s) =>
              s.id === id ? { ...s, status: 'error', error: msg } : s
            )
          )
          toast.error(`Could not read "${file.name}".`)
        }
      } else {
        // Plain text file — read locally, no network call.
        try {
          const text = await file.text()
          setFileSlots((prev) =>
            prev.map((s) =>
              s.id === id
                ? { ...s, status: 'done', text: text.trim(), expanded: true }
                : s
            )
          )
          toast.success(`Loaded "${file.name}".`)
        } catch {
          setFileSlots((prev) =>
            prev.map((s) =>
              s.id === id
                ? { ...s, status: 'error', error: 'Could not read that file.' }
                : s
            )
          )
          toast.error(`Could not read "${file.name}".`)
        }
      }
    },
    []
  )

  const askAmerica = async () => {
    // Combine the manual issue text with every successfully extracted file.
    const combined = [
      issueText.trim(),
      ...fileSlots
        .filter((s) => s.status === 'done' && s.text.trim())
        .map((s) => s.text.trim()),
    ]
      .filter(Boolean)
      .join('\n\n')

    if (!combined) {
      toast.error(
        'Paste a NationStates issue or attach a file first, partner.'
      )
      return
    }
    setLoading(true)
    setError(null)
    setVerdict(null)
    try {
      const res = await fetch('/api/decide', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ issueText: combined }),
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data?.error || 'Something went wrong in Washington.')
      }
      setVerdict(data.decision)
      setNation(data.nation)
      toast.success('America has spoken.')
      // Refresh the Congressional Record with the new decree.
      void fetchHistory()
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Unknown error'
      setError(msg)
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  const resetNation = async () => {
    try {
      const res = await fetch('/api/nation', { method: 'DELETE' })
      const data = await res.json()
      if (data?.nation) setNation(data.nation)
      setVerdict(null)
      setIssueText('')
      setFileSlots((prev) => {
        prev.forEach((s) => {
          if (s.previewUrl) URL.revokeObjectURL(s.previewUrl)
        })
        return []
      })
      // The nation reset wipes all decisions — refresh the record.
      void fetchHistory()
      setSelectedDecision(null)
      toast.success('El Sovaraldo restored to its founding values.')
    } catch {
      toast.error('Could not reset the republic.')
    }
  }

  const clearHistory = async () => {
    setClearingHistory(true)
    try {
      const res = await fetch('/api/history', { method: 'DELETE' })
      if (!res.ok) throw new Error('Could not clear the record.')
      setHistory([])
      setSelectedDecision(null)
      toast.success('Congressional Record cleared.')
    } catch {
      toast.error('Could not clear the record.')
    } finally {
      setClearingHistory(false)
    }
  }

  // Initialise the overview textarea once, when the nation first loads.
  useEffect(() => {
    if (overviewInit.current || !nation) return
    setOverviewText(nation.overview || DEFAULT_OVERVIEW)
    overviewInit.current = true
  }, [nation])

  // Live-parse the Civil Rights / Economy / Political Freedom ratings.
  const ratings = useMemo(() => {
    const map: Record<string, string> = {}
    const re = /(Civil Rights|Economy|Political Freedom)\s*:\s*([^\n]+)/gi
    let m: RegExpExecArray | null
    while ((m = re.exec(overviewText))) {
      map[m[1].toLowerCase()] = m[2].trim()
    }
    return map
  }, [overviewText])

  const saveOverview = async () => {
    setSavingOverview(true)
    try {
      const res = await fetch('/api/nation', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ overview: overviewText }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Could not save.')
      if (data?.nation) setNation(data.nation)
      setOverviewSaved(true)
      toast.success('Nation overview saved.')
      setTimeout(() => setOverviewSaved(false), 2000)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Unknown error'
      toast.error(msg)
    } finally {
      setSavingOverview(false)
    }
  }

  const americanness = nation?.americanness ?? 50
  const aLabel = americannessLabel(americanness)

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-slate-50 to-slate-100 text-foreground">
      {/* ============================ HEADER ============================ */}
      <header className="border-b border-slate-200 bg-white/80 backdrop-blur sticky top-0 z-30">
        <div className="mx-auto max-w-6xl px-4 py-3 sm:px-6">
          <FlagBar />
          <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="h-12 w-[76px] overflow-hidden rounded-md shadow-md ring-1 ring-black/10">
                <img
                  src="/flag.png"
                  alt="Flag of El Sovaraldo"
                  className="h-full w-full object-cover"
                />
              </div>
              <div>
                <h1 className="text-xl font-black tracking-tight sm:text-2xl">
                  What Would{' '}
                  <span style={{ color: RED }}>America</span> Do?
                </h1>
                <p className="text-xs text-muted-foreground sm:text-sm">
                  A patriotic companion for your NationStates nation
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-sm">
              <div className="text-right">
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
                  Nation
                </p>
                <p className="text-sm font-bold leading-none">
                  {nation?.name ?? 'El Sovaraldo'}
                </p>
                <p className="text-[10px] italic text-muted-foreground">
                  “{nation?.motto ?? 'E Pluribus Unum'}”
                </p>
              </div>
              <Badge className={aLabel.tone + ' text-[11px]'}>
                <Star className="mr-1 h-3 w-3" />
                {aLabel.text}
              </Badge>
            </div>
          </div>
        </div>
      </header>

      {/* ============================ MAIN ============================ */}
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 sm:py-8">
        <div className="space-y-6">
          {/* Nation Overview — full width */}
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <BookOpen className="h-5 w-5" style={{ color: BLUE }} />
                    Nation Overview
                  </CardTitle>
                  <CardDescription>
                    Your nation&apos;s current snapshot from NationStates.
                    Edit it anytime to keep America informed.
                  </CardDescription>
                </div>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="shrink-0 gap-1 text-xs text-muted-foreground hover:text-red-600"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      Reset
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Reset the Republic?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This restores El Sovaraldo&apos;s national meters to
                        their founding values and clears the Congressional
                        Record. Your nation overview is kept. There is no undo.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={resetNation}
                        className="bg-red-600 text-white hover:bg-red-700"
                      >
                        <Trash2 className="mr-1 h-4 w-4" />
                        Reset Meters
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap gap-2">
                {(['Civil Rights', 'Economy', 'Political Freedom'] as const).map(
                  (k) => {
                    const v = ratings[k.toLowerCase()]
                    if (!v) return null
                    return (
                      <div
                        key={k}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs shadow-sm"
                      >
                        <span className="text-muted-foreground">{k}:</span>
                        <span className="font-semibold" style={{ color: BLUE }}>
                          {v}
                        </span>
                      </div>
                    )
                  }
                )}
              </div>
              <Textarea
                value={overviewText}
                onChange={(e) => setOverviewText(e.target.value)}
                placeholder="Paste your nation's description from NationStates here…"
                className="min-h-[260px] resize-y text-sm leading-relaxed"
              />
              <div className="flex items-center gap-2">
                <Button
                  onClick={saveOverview}
                  disabled={savingOverview}
                  size="sm"
                  className="gap-1.5 text-white"
                  style={{ backgroundColor: BLUE }}
                >
                  {savingOverview ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : overviewSaved ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  {savingOverview
                    ? 'Saving…'
                    : overviewSaved
                      ? 'Saved'
                      : 'Save Overview'}
                </Button>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {overviewText.length} chars
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Two-column grid: main workflow + Congressional Record sidebar */}
          <div className="grid gap-6 lg:grid-cols-3">
            {/* ---------------- Main column ---------------- */}
            <div className="space-y-6 lg:col-span-2">
              {/* Issue input */}
              <Card className="border-slate-200 shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Landmark className="h-5 w-5" style={{ color: BLUE }} />
                    Bring an Issue Before Congress
                  </CardTitle>
                  <CardDescription>
                    Paste any NationStates issue — dilemma and all its numbered
                    options. America will render a verdict.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Textarea
                    value={issueText}
                    onChange={(e) => setIssueText(e.target.value)}
                    placeholder="Paste your NationStates issue here… Include the dilemma and every option."
                    className="min-h-[180px] resize-y text-sm leading-relaxed"
                    disabled={loading}
                  />
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      onClick={askAmerica}
                      disabled={loading}
                      size="lg"
                      className="gap-2 text-white shadow-md"
                      style={{ backgroundColor: RED }}
                    >
                      {loading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Sparkles className="h-4 w-4" />
                      )}
                      {loading ? 'Deliberating…' : 'Ask America'}
                    </Button>
                    <Button
                      variant="outline"
                      size="lg"
                      className="gap-2"
                      onClick={() => setIssueText(SAMPLE_ISSUE)}
                      disabled={loading}
                    >
                      <ClipboardPaste className="h-4 w-4" />
                      Sample Issue
                    </Button>
                    <span className="ml-auto text-xs text-muted-foreground tabular-nums">
                      {issueText.length}/8000
                    </span>
                  </div>
                </CardContent>
              </Card>

              {/* File inputs — unlimited */}
              <Card className="border-slate-200 shadow-sm">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <CardTitle className="flex items-center gap-2 text-lg">
                        <Paperclip className="h-5 w-5" style={{ color: RED }} />
                        Attach Issue Files
                      </CardTitle>
                      <CardDescription>
                        Upload screenshots of NationStates issues or text files
                        — America can read them all. Add as many as you like, no
                        limit.
                      </CardDescription>
                    </div>
                    <Button
                      onClick={addFileSlot}
                      size="sm"
                      className="shrink-0 gap-1.5 text-white"
                      style={{ backgroundColor: BLUE }}
                      disabled={loading}
                    >
                      <Plus className="h-4 w-4" />
                      Add File
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {fileSlots.length === 0 ? (
                    <div className="flex flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-slate-300 py-6 text-center">
                      <Paperclip className="h-6 w-6 text-muted-foreground/50" />
                      <p className="text-sm text-muted-foreground">
                        No files attached yet.
                      </p>
                      <p className="text-xs text-muted-foreground/70">
                        Click{' '}
                        <span className="font-medium">Add File</span> to upload
                        issue screenshots or text files.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {fileSlots.map((slot) => (
                        <FileSlotRow
                          key={slot.id}
                          slot={slot}
                          loading={loading}
                          onSelect={(f) => handleFileSelect(slot.id, f)}
                          onRemove={() => removeFileSlot(slot.id)}
                          onToggle={() => toggleSlot(slot.id)}
                        />
                      ))}
                    </div>
                  )}
                  {fileSlots.length > 0 && (
                    <p className="text-xs text-muted-foreground">
                      {fileSlots.filter((s) => s.status === 'done').length} of{' '}
                      {fileSlots.length} file(s) ready · Extracted text is
                      combined with your issue when you Ask America.
                    </p>
                  )}
                </CardContent>
              </Card>

              {/* Verdict */}
              <AnimatePresence mode="wait">
                {error && (
                  <motion.div
                    key="error"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                  >
                    <Card className="border-red-200 bg-red-50">
                      <CardContent className="py-4 text-sm text-red-800">
                        {error}
                      </CardContent>
                    </Card>
                  </motion.div>
                )}

                {verdict && !error && (
                  <motion.div
                    key={verdict.id}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ type: 'spring', stiffness: 140, damping: 18 }}
                  >
                    <Card className="overflow-hidden border-slate-200 shadow-md">
                      {/* verdict header */}
                      <div
                        className="flex items-center gap-3 px-5 py-4 text-white"
                        style={{ backgroundColor: BLUE }}
                      >
                        <Sparkles className="h-5 w-5 shrink-0" />
                        <div className="min-w-0">
                          <p className="text-[10px] uppercase tracking-[0.2em] opacity-80">
                            America&apos;s Verdict
                          </p>
                          <p className="truncate text-base font-bold">
                            {verdict.issueTitle}
                          </p>
                        </div>
                        <Badge
                          className="ml-auto shrink-0 bg-white/20 text-white hover:bg-white/25"
                          title="American-ness of this choice"
                        >
                          <Star className="mr-1 h-3 w-3" />
                          {verdict.americannessScore}/100
                        </Badge>
                      </div>

                      <CardContent className="space-y-4 p-5">
                        {/* chosen option */}
                        <div>
                          <p className="mb-1 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                            The American Choice
                          </p>
                          <div className="rounded-lg border-l-4 bg-slate-50 p-3" style={{ borderColor: RED }}>
                            <p className="font-semibold leading-snug text-foreground">
                              {verdict.chosenOption}
                            </p>
                          </div>
                        </div>

                        {/* reasoning */}
                        <div>
                          <p className="mb-1 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                            American Reasoning
                          </p>
                          <p className="text-sm leading-relaxed text-foreground/90">
                            {verdict.reasoning}
                          </p>
                        </div>

                        {/* quote */}
                        {verdict.patrioticQuote && (
                          <div className="flex gap-2 rounded-lg bg-[#3C3B6E]/5 p-3">
                            <Quote
                              className="h-4 w-4 shrink-0 translate-y-0.5"
                              style={{ color: BLUE }}
                            />
                            <p className="text-sm italic text-foreground/80">
                              “{verdict.patrioticQuote}”
                            </p>
                          </div>
                        )}

                        {/* deltas */}
                        <div className="flex flex-wrap gap-2 pt-1">
                          <DeltaChip value={verdict.freedomDelta} label="Freedom" />
                          <DeltaChip value={verdict.economyDelta} label="Economy" />
                          <DeltaChip value={verdict.democracyDelta} label="Democracy" />
                        </div>

                        {/* options considered */}
                        {verdict.options?.length > 0 && (
                          <>
                            <Separator />
                            <div>
                              <p className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                                Options Considered
                              </p>
                              <ul className="space-y-1.5">
                                {verdict.options.map((o, i) => (
                                  <li
                                    key={i}
                                    className="flex items-start gap-2 text-sm"
                                  >
                                    <ChevronRight
                                      className="mt-0.5 h-4 w-4 shrink-0"
                                      style={{
                                        color:
                                          o.label?.trim() ===
                                          verdict.chosenOption?.trim()
                                            ? RED
                                            : '#94a3b8',
                                      }}
                                    />
                                    <span>
                                      <span className="font-medium">
                                        {o.label}
                                      </span>
                                      {o.summary ? (
                                        <span className="text-muted-foreground">
                                          {' '}
                                          — {o.summary}
                                        </span>
                                      ) : null}
                                    </span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          </>
                        )}
                      </CardContent>
                    </Card>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* ---------------- Congressional Record sidebar ---------------- */}
            <div className="lg:col-span-1">
              <div className="lg:sticky lg:top-24">
                <Card className="border-slate-200 shadow-sm">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <CardTitle className="flex items-center gap-2 text-lg">
                          <ScrollText
                            className="h-5 w-5"
                            style={{ color: RED }}
                          />
                          Congressional Record
                        </CardTitle>
                        <CardDescription>
                          Every decree America has handed down. Click any entry
                          to read the full response.
                        </CardDescription>
                      </div>
                      {history.length > 0 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="shrink-0 gap-1 text-xs text-muted-foreground hover:text-red-600"
                          onClick={clearHistory}
                          disabled={clearingHistory}
                        >
                          {clearingHistory ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="h-3.5 w-3.5" />
                          )}
                          Clear
                        </Button>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    {history.length === 0 ? (
                      <div className="flex flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-slate-300 py-10 text-center">
                        <ScrollText className="h-7 w-7 text-muted-foreground/40" />
                        <p className="text-sm font-medium text-muted-foreground">
                          No decrees yet.
                        </p>
                        <p className="text-xs text-muted-foreground/70">
                          Ask America about an issue and the ruling will be
                          recorded here.
                        </p>
                      </div>
                    ) : (
                      <ScrollArea className="h-[560px] pr-3">
                        <ol className="space-y-2">
                          {history.map((d) => {
                            const tone = americannessLabel(d.americannessScore)
                            return (
                              <li key={d.id}>
                                <button
                                  type="button"
                                  onClick={() => setSelectedDecision(d)}
                                  className="group w-full rounded-lg border border-slate-200 bg-white p-3 text-left shadow-sm transition hover:border-[#B22234]/40 hover:bg-red-50/40 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-[#B22234]/40"
                                >
                                  <div className="flex items-start gap-2">
                                    <ChevronRight
                                      className="mt-0.5 h-4 w-4 shrink-0 text-slate-300 transition group-hover:text-[#B22234]"
                                    />
                                    <div className="min-w-0 flex-1">
                                      <p className="truncate text-sm font-semibold text-foreground">
                                        {d.issueTitle}
                                      </p>
                                      <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                                        <span className="font-medium text-foreground/70">
                                          Decreed:
                                        </span>{' '}
                                        {d.chosenOption}
                                      </p>
                                      <div className="mt-1.5 flex items-center gap-2">
                                        <Badge
                                          className={
                                            'shrink-0 text-[9px] ' + tone.tone
                                          }
                                        >
                                          <Star className="mr-0.5 h-2.5 w-2.5" />
                                          {d.americannessScore}
                                        </Badge>
                                        <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                                          <Clock className="h-2.5 w-2.5" />
                                          {timeAgo(d.createdAt)}
                                        </span>
                                        <span className="ml-auto text-[10px] font-medium text-[#B22234] opacity-0 transition group-hover:opacity-100">
                                          View →
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                </button>
                              </li>
                            )
                          })}
                        </ol>
                      </ScrollArea>
                    )}
                    {history.length > 0 && (
                      <p className="mt-3 text-center text-[10px] text-muted-foreground">
                        {history.length} decree{history.length === 1 ? '' : 's'} on
                        record
                      </p>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Full-response modal */}
      <FullResponseDialog
        decision={selectedDecision}
        onClose={() => setSelectedDecision(null)}
      />

      {/* ============================ FOOTER ============================ */}
      <footer className="mt-auto border-t border-slate-200 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-4 sm:px-6">
          <FlagBar />
          <div className="mt-3 flex flex-col items-center justify-between gap-2 text-center sm:flex-row sm:text-left">
            <p className="text-xs text-muted-foreground">
              <span className="font-semibold text-foreground">
                What Would America Do?
              </span>{' '}
              — keeping El Sovaraldo red, white & blue since 1776.
            </p>
            <p className="text-xs italic text-muted-foreground">
              “E Pluribus Unum” · Not affiliated with NationStates.
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}
