import { NextRequest, NextResponse } from 'next/server'
import ZAI from 'z-ai-web-dev-sdk'
import { db } from '@/lib/db'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const SYSTEM_PROMPT = `You are the collective spirit of the United States of America — a patriotic but principled policy advisor in the tradition of the Founders, the Constitution, and mainstream American governance.

The user manages a NationStates nation called "El Sovaraldo" and wants to govern it the way the United States would — keeping it American-themed.

You will receive the full text of a NationStates issue: a policy dilemma followed by several numbered options. Your job:

1. Identify a concise issue title (max 8 words).
2. Identify the distinct options presented (usually 2-5). Give each a short label and one-line summary.
3. Choose the ONE option the USA would most likely select, informed by American political culture: individual liberty, free enterprise & entrepreneurship, federalism, the rule of law, democratic accountability, strong national defense, civil society, and pragmatic reform. Pick the closest match even if imperfect.
4. Explain the American reasoning in 2-4 sentences, grounding it in American values/principles. Tone: confident, warm, a touch patriotic — like a fireside chat.
5. Rate how authentically "American" the chosen option is, 0-100.
6. Provide a short patriotic quote or American maxim (attributed or proverbial) that fits the moment.
7. Estimate how the choice shifts three 0-100 national meters — each a delta between -10 and +10:
   - freedomDelta (civil liberties / personal freedom)
   - economyDelta (free-market strength & prosperity)
   - democracyDelta (political openness & accountability)

Return ONLY valid JSON (no markdown, no code fences, no commentary) in EXACTLY this shape:
{"issueTitle": string, "options": [{"label": string, "summary": string}], "chosenOption": string, "reasoning": string, "americannessScore": number, "patrioticQuote": string, "freedomDelta": number, "economyDelta": number, "democracyDelta": number}`

function stripFences(text: string): string {
  let t = text.trim()
  if (t.startsWith('```')) {
    t = t.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim()
  }
  const first = t.indexOf('{')
  const last = t.lastIndexOf('}')
  if (first !== -1 && last !== -1 && last > first) {
    t = t.slice(first, last + 1)
  }
  return t
}

function clamp(n: number, min: number, max: number): number {
  if (Number.isNaN(n)) return min
  return Math.max(min, Math.min(max, n))
}

async function ensureNation() {
  let nation = await db.nation.findUnique({ where: { id: 'el-sovaraldo' } })
  if (!nation) {
    nation = await db.nation.create({ data: { id: 'el-sovaraldo' } })
  }
  return nation
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const issueText: string = (body?.issueText ?? '').toString().trim()

    if (!issueText) {
      return NextResponse.json(
        { error: 'Please paste your NationStates issue first.' },
        { status: 400 }
      )
    }
    if (issueText.length > 30000) {
      return NextResponse.json(
        { error: 'That issue is too long (max 30000 characters).' },
        { status: 400 }
      )
    }

    const zai = await ZAI.create()
    const completion = await zai.chat.completions.create({
      messages: [
        { role: 'assistant', content: SYSTEM_PROMPT },
        { role: 'user', content: issueText },
      ],
      thinking: { type: 'disabled' },
    })

    const raw = completion.choices[0]?.message?.content ?? ''
    const cleaned = stripFences(raw)

    let parsed: {
      issueTitle: string
      options: { label: string; summary: string }[]
      chosenOption: string
      reasoning: string
      americannessScore: number
      patrioticQuote: string
      freedomDelta: number
      economyDelta: number
      democracyDelta: number
    }

    try {
      parsed = JSON.parse(cleaned)
    } catch {
      return NextResponse.json(
        {
          error: 'America hesitated and could not format a ruling. Try pasting the issue again.',
          raw,
        },
        { status: 502 }
      )
    }

    const americannessScore = clamp(Number(parsed.americannessScore) || 50, 0, 100)
    const freedomDelta = clamp(Number(parsed.freedomDelta) || 0, -10, 10)
    const economyDelta = clamp(Number(parsed.economyDelta) || 0, -10, 10)
    const democracyDelta = clamp(Number(parsed.democracyDelta) || 0, -10, 10)

    const nation = await ensureNation()
    const decision = await db.decision.create({
      data: {
        issueTitle: String(parsed.issueTitle || 'Untitled Issue').slice(0, 200),
        issueText,
        chosenOption: String(parsed.chosenOption || '').slice(0, 500),
        reasoning: String(parsed.reasoning || ''),
        patrioticQuote: parsed.patrioticQuote
          ? String(parsed.patrioticQuote).slice(0, 300)
          : null,
        americannessScore,
        freedomDelta,
        economyDelta,
        democracyDelta,
        options: parsed.options ? JSON.stringify(parsed.options) : null,
      },
    })

    const newAmericanness = clamp(
      Math.round(nation.americanness * 0.8 + americannessScore * 0.2),
      0,
      100
    )
    const updatedNation = await db.nation.update({
      where: { id: 'el-sovaraldo' },
      data: {
        americanness: newAmericanness,
        freedom: clamp(nation.freedom + freedomDelta, 0, 100),
        economy: clamp(nation.economy + economyDelta, 0, 100),
        democracy: clamp(nation.democracy + democracyDelta, 0, 100),
        decisionsCount: nation.decisionsCount + 1,
      },
    })

    return NextResponse.json({
      decision: {
        id: decision.id,
        issueTitle: decision.issueTitle,
        chosenOption: decision.chosenOption,
        reasoning: decision.reasoning,
        patrioticQuote: decision.patrioticQuote,
        americannessScore: decision.americannessScore,
        freedomDelta: decision.freedomDelta,
        economyDelta: decision.economyDelta,
        democracyDelta: decision.democracyDelta,
        options: parsed.options ?? [],
        createdAt: decision.createdAt,
      },
      nation: updatedNation,
    })
  } catch (err) {
    console.error('[/api/decide] error', err)
    return NextResponse.json(
      { error: 'The machinery of government hit a snag. Please try again.' },
      { status: 500 }
    )
  }
}
