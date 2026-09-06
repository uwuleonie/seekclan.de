import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic()

export async function POST(req: NextRequest) {
  const token = req.cookies.get('session_token')?.value
  if (!token) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 })

  const { base64, mediaType } = await req.json()
  if (!base64 || !mediaType) return NextResponse.json({ error: 'Fehlende Daten' }, { status: 400 })

  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 256,
    messages: [{
      role: 'user',
      content: [
        {
          type: 'image',
          source: { type: 'base64', media_type: mediaType, data: base64 },
        },
        {
          type: 'text',
          text: `Analyze this image. Return ONLY a JSON object, no markdown, no explanation:
{"bg_color":"dominant background color as hex e.g. #ffffff","is_simple_bg":true}`,
        },
      ],
    }],
  })

  const block = message.content.find((b) => b.type === 'text')
  const text = block && block.type === 'text' ? block.text : ''
  let parsed = { bg_color: '#ffffff', is_simple_bg: true }
  try { parsed = JSON.parse(text.replace(/```json|```/g, '').trim()) } catch {}

  return NextResponse.json(parsed)
}