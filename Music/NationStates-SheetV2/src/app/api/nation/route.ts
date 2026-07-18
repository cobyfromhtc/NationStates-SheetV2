import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const DEFAULT_OVERVIEW = `The Republic of El Sovaraldo is a tiny, safe nation, notable for its sprawling nuclear power plants. The hard-nosed, hard-working, democratic, devout population of 7 million El Sovaraldoans enjoy a sensible mix of personal and economic freedoms, while the political process is open and the people's right to vote held sacrosanct.

The medium-sized, outspoken government prioritizes Spirituality, although Law & Order, Defense, and Education are also considered important. The average income tax rate is 30.4%.

The strong El Sovaraldoan economy, worth 383 billion The Sovaraldan Dollars a year, is broadly diversified and led by the Gambling industry, with major contributions from Information Technology, Trout Farming, and Automobile Manufacturing. Average income is 54,829 The Sovaraldan Dollars, and evenly distributed, with the richest citizens earning only 4.7 times as much as the poorest.

A few people seem to spend their whole time complaining, statues of famous citizens are erected or demolished on a purely partisan basis, the weather report is the prisoners' favourite programme, and Brancalandian Brie isn't available anywhere in El Sovaraldo. Crime is well under control, thanks to a capable police force and progressive social policies in education and welfare. El Sovaraldo's national animal is the Bald Eagle, which soars majestically through the nation's famously clear skies.

Civil Rights : Excellent
Economy : Strong
Political Freedom : Excessive`

async function ensureNation() {
  let nation = await db.nation.findUnique({ where: { id: 'el-sovaraldo' } })
  if (!nation) {
    nation = await db.nation.create({
      data: { id: 'el-sovaraldo', overview: DEFAULT_OVERVIEW },
    })
  } else if (nation.overview == null) {
    // Backfill existing rows created before the overview field existed.
    nation = await db.nation.update({
      where: { id: 'el-sovaraldo' },
      data: { overview: DEFAULT_OVERVIEW },
    })
  }
  return nation
}

export async function GET() {
  const nation = await ensureNation()
  return NextResponse.json({ nation })
}

// Save the nation overview (editable on the dashboard).
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const overview = (body?.overview ?? '').toString()
    if (overview.length > 20000) {
      return NextResponse.json(
        { error: 'Overview is too long (max 20000 characters).' },
        { status: 400 }
      )
    }
    await ensureNation()
    const nation = await db.nation.update({
      where: { id: 'el-sovaraldo' },
      data: { overview },
    })
    return NextResponse.json({ nation })
  } catch (err) {
    console.error('[/api/nation PUT] error', err)
    return NextResponse.json(
      { error: 'Could not save the nation overview.' },
      { status: 500 }
    )
  }
}

// Reset the nation's meters back to their founding values (keeps the overview).
export async function DELETE() {
  await db.decision.deleteMany({})
  const nation = await db.nation.upsert({
    where: { id: 'el-sovaraldo' },
    update: {
      americanness: 50,
      freedom: 50,
      economy: 50,
      democracy: 50,
      decisionsCount: 0,
    },
    create: { id: 'el-sovaraldo', overview: DEFAULT_OVERVIEW },
  })
  return NextResponse.json({ nation })
}
