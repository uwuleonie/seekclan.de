import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'
import { saveFile, getPublicUrl } from '@/app/lib/local-storage'

const CHANNELS = ['admin-chat', 'team-lounge']

async function checkChannelAccess(req: NextRequest, channel: string) {
  const token = req.cookies.get('session_token')?.value
  if (!token) return null
  const sessionResult = await pool.query('SELECT user_id FROM sessions WHERE token = $1', [token])
  const session = sessionResult.rows[0]
  if (!session) return null
  const userResult = await pool.query('SELECT id, username, clan_role FROM users WHERE id = $1', [session.user_id])
  const user = userResult.rows[0]
  if (!user || !['administrator', 'owner', 'teammitglied'].includes(user.clan_role)) return null
  if (channel === 'admin-chat' && user.clan_role !== 'administrator' && user.clan_role !== 'owner') return null
  return user
}

// GET /api/admin2/team-chat/[channel]/messages
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ channel: string }> }
) {
  const { channel } = await context.params
  if (!CHANNELS.includes(channel)) return NextResponse.json({ error: 'Ungültiger Kanal' }, { status: 400 })

  const user = await checkChannelAccess(req, channel)
  if (!user) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })

  try {
    const messagesResult = await pool.query(
      `SELECT m.id, m.content, m.created_at, m.user_id, u.username, u.clan_role,
              m.attachment_filename, m.attachment_name, m.attachment_size
       FROM admin_team_messages m
       JOIN users u ON u.id = m.user_id
       WHERE m.channel = $1
       ORDER BY m.created_at ASC`,
      [channel]
    )
    const reactionsResult = await pool.query(
      `SELECT r.message_id, r.emoji, r.user_id
       FROM admin_team_message_reactions r
       JOIN admin_team_messages m ON m.id = r.message_id
       WHERE m.channel = $1`,
      [channel]
    )

    const messages = messagesResult.rows.map(m => {
      const rows = reactionsResult.rows.filter(r => r.message_id === m.id)
      const emojis = [...new Set(rows.map(r => r.emoji))]
      const reactions = emojis.map(emoji => ({
        emoji,
        count: rows.filter(r => r.emoji === emoji).length,
        mine: rows.some(r => r.emoji === emoji && r.user_id === user.id),
      }))
      const attachmentUrl = m.attachment_filename ? getPublicUrl('chat-media', `team-chat/${channel}/${m.attachment_filename}`) : null
      return { type: 'message' as const, ...m, reactions, attachmentUrl }
    })

    const pollsResult = await pool.query(
      `SELECT p.id, p.title, p.ends_at, p.created_at, p.created_by, u.username AS created_by_username
       FROM admin_board_posts p
       JOIN users u ON u.id = p.created_by
       WHERE p.channel = $1 AND p.type = 'poll'
       ORDER BY p.created_at ASC`,
      [channel]
    )
    const optionsResult = await pool.query(
      `SELECT o.id, o.post_id, o.label, o.sort_order
       FROM admin_board_poll_options o
       JOIN admin_board_posts p ON p.id = o.post_id
       WHERE p.channel = $1
       ORDER BY o.sort_order ASC`,
      [channel]
    )
    const votesResult = await pool.query(
      `SELECT v.post_id, v.option_id, v.user_id
       FROM admin_board_poll_votes v
       JOIN admin_board_posts p ON p.id = v.post_id
       WHERE p.channel = $1`,
      [channel]
    )

    const polls = pollsResult.rows.map(poll => {
      const options = optionsResult.rows.filter(o => o.post_id === poll.id)
      const votes = votesResult.rows.filter(v => v.post_id === poll.id)
      const totalVotes = votes.length
      const myVote = votes.find(v => v.user_id === user.id)
      return {
        type: 'poll' as const,
        id: poll.id,
        title: poll.title,
        ends_at: poll.ends_at,
        created_at: poll.created_at,
        username: poll.created_by_username,
        options: options.map(o => {
          const count = votes.filter(v => v.option_id === o.id).length
          return { id: o.id, label: o.label, count, percent: totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0 }
        }),
        totalVotes,
        myVoteOptionId: myVote?.option_id || null,
      }
    })

    const feed = [...messages, ...polls].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    )

    return NextResponse.json({ feed })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// POST /api/admin2/team-chat/[channel]/messages
// FormData: content?, file?
export async function POST(
  req: NextRequest,
  context: { params: Promise<{ channel: string }> }
) {
  const { channel } = await context.params
  if (!CHANNELS.includes(channel)) return NextResponse.json({ error: 'Ungültiger Kanal' }, { status: 400 })

  const user = await checkChannelAccess(req, channel)
  if (!user) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })

  const formData = await req.formData().catch(() => null)
  if (!formData) return NextResponse.json({ error: 'Ungültige Anfrage' }, { status: 400 })

  const content = (formData.get('content') as string | null)?.trim() || ''
  const file = formData.get('file') as File | null

  if (!content && !file) return NextResponse.json({ error: 'Nachricht darf nicht leer sein' }, { status: 400 })
  if (file && file.size > 15 * 1024 * 1024) {
    return NextResponse.json({ error: 'Datei zu groß (max. 15 MB)' }, { status: 400 })
  }

  let attachmentFilename: string | null = null
  let attachmentName: string | null = null
  let attachmentSize: number | null = null

  try {
    if (file) {
      const ext = file.name.split('.').pop()
      attachmentFilename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
      attachmentName = file.name
      attachmentSize = file.size
      const buffer = Buffer.from(await file.arrayBuffer())
      await saveFile('chat-media', `team-chat/${channel}/${attachmentFilename}`, buffer)
    }

    const result = await pool.query(
      `INSERT INTO admin_team_messages (channel, user_id, content, attachment_filename, attachment_name, attachment_size)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [channel, user.id, content, attachmentFilename, attachmentName, attachmentSize]
    )
    return NextResponse.json({ success: true, id: result.rows[0].id })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}