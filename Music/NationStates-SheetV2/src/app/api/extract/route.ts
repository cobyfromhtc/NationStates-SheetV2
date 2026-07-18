import { NextRequest, NextResponse } from 'next/server'
import ZAI from 'z-ai-web-dev-sdk'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// OCR a NationStates issue screenshot (or any image) into plain text.
export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file')
    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { error: 'No file provided.' },
        { status: 400 }
      )
    }
    // 8MB cap — generous enough for high-res screenshots
    if (file.size > 8 * 1024 * 1024) {
      return NextResponse.json(
        { error: 'File too large (max 8MB).' },
        { status: 400 }
      )
    }

    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    const base64 = buffer.toString('base64')
    const mimeType = file.type || 'image/png'

    const zai = await ZAI.create()
    const response = await zai.chat.completions.createVision({
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'You are an OCR assistant for the game NationStates. The uploaded image is a screenshot of a NationStates issue. Extract and return the FULL visible text VERBATIM — the issue title/header, the dilemma paragraph, and EVERY numbered option with its complete text. Preserve original wording, numbers, quotation marks, and @@RANDOMNAME@@-style placeholders exactly as shown. Return ONLY the extracted text. No commentary, no markdown, no code fences.',
            },
            {
              type: 'image_url',
              image_url: { url: `data:${mimeType};base64,${base64}` },
            },
          ],
        },
      ],
      thinking: { type: 'disabled' },
    })

    const text = (response.choices[0]?.message?.content ?? '').trim()
    if (!text) {
      return NextResponse.json(
        { error: 'No text could be read from that image.' },
        { status: 422 }
      )
    }
    return NextResponse.json({ text })
  } catch (err) {
    console.error('[/api/extract] error', err)
    return NextResponse.json(
      { error: 'Could not read that image.' },
      { status: 500 }
    )
  }
}
