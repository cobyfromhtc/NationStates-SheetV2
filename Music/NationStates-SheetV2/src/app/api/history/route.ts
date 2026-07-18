import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Parse the JSON-encoded options array (tolerant of older rows without it).
function parseOptions(raw: string | null): { label: string; summary: string }[] {
  if (!raw) return []
  try {
    const v = JSON.parse(raw)
    if (!Array.isArray(v)) return []
    return v
      .filter((o) => o && typeof o === 'object')
      .map((o) => ({
        label: String(o.label ?? '').slice(0, 200),
        summary: String(o.summary ?? '').slice(0, 400),
      }))
  } catch {
    return []
  }
}

export async function GET() {
  const rows = await db.decision.findMany({
    orderBy: { createdAt: 'desc' },
    take: 100,
  })
  const decisions = rows.map((d) => ({
    id: d.id,
    issueTitle: d.issueTitle,
    issueText: d.issueText,
    chosenOption: d.chosenOption,
    reasoning: d.reasoning,
    patrioticQuote: d.patrioticQuote,
    americannessScore: d.americannessScore,
    freedomDelta: d.freedomDelta,
    economyDelta: d.economyDelta,
    democracyDelta: d.democracyDelta,
    options: parseOptions(d.options),
    createdAt: d.createdAt,
  }))
  return NextResponse.json({ decisions })
}

export async function DELETE() {
  await db.decision.deleteMany({})
  return NextResponse.json({ ok: true })
}
