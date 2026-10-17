import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'
import { kontoVerknuepfen, VerknuepfungsFehler } from '@/app/lib/minecraft-konto'
import { linkCodeSaeubern } from '@/app/lib/link-code'
import { nutzerAusAnfrage } from '@/app/lib/rechte'
import { checkOrigin, csrfError } from '@/app/lib/csrf'

// /api/minecraft/link – Website-Konto mit dem Minecraft-Account aus /link verbinden.
//   GET  ?code=XXXX   Für welchen Minecraft-Spieler ist der Code? (für die Seite /link/<code>)
//   POST {code}       Angemeldetes Konto mit diesem Spieler verbinden

async function codeLaden(eingabe: unknown) {
  const code = linkCodeSaeubern(eingabe)
  if (code.length < 6) return { fehler: 'Code fehlt', status: 400 } as const
  const zeile = (await pool.query('SELECT * FROM minecraft_link_codes WHERE code = $1', [code])).rows[0]
  if (!zeile) return { fehler: 'Ungültiger Code – gib im Spiel nochmal /link ein', status: 404 } as const
  if (zeile.expires_at && new Date(zeile.expires_at).getTime() < Date.now()) {
    await pool.query('DELETE FROM minecraft_link_codes WHERE id = $1', [zeile.id])
    return { fehler: 'Code abgelaufen – gib im Spiel nochmal /link ein', status: 400 } as const
  }
  return { zeile } as const
}

export async function GET(req: NextRequest) {
  try {
    const r = await codeLaden(req.nextUrl.searchParams.get('code'))
    if ('fehler' in r) return NextResponse.json({ error: r.fehler }, { status: r.status })
    return NextResponse.json({ minecraft_username: r.zeile.minecraft_username, minecraft_uuid: r.zeile.minecraft_uuid })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Serverfehler' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    if (!checkOrigin(req)) return csrfError()
    const nutzer = await nutzerAusAnfrage(req)
    if (!nutzer) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 })

    const { code } = await req.json().catch(() => ({}))
    const r = await codeLaden(code)
    if ('fehler' in r) return NextResponse.json({ error: r.fehler }, { status: r.status })
    const linkCode = r.zeile

    // Verbinden, Rang aus der Zeit ohne Minecraft mitnehmen, Clan-Akte verknüpfen (app/lib/minecraft-konto.ts).
    // Prüft auch, dass der Minecraft-Account nicht schon an einem anderen Konto hängt.
    await kontoVerknuepfen(nutzer.id, linkCode.minecraft_uuid, linkCode.minecraft_username, 'verknuepfung')

    await pool.query('DELETE FROM minecraft_link_codes WHERE id = $1', [linkCode.id])
    // Offene Freischaltungs-Anfrage ist damit erledigt
    await pool.query(
      `UPDATE minecraft_link_anfragen SET status = 'erledigt', bearbeitet_am = now(), bearbeitet_von = 'link' WHERE user_id = $1 AND status = 'offen'`,
      [nutzer.id]
    ).catch(() => {})

    return NextResponse.json({ success: true, minecraft_username: linkCode.minecraft_username })
  } catch (err) {
    if (err instanceof VerknuepfungsFehler) return NextResponse.json({ error: err.message }, { status: 409 })
    console.error(err)
    return NextResponse.json({ error: 'Serverfehler' }, { status: 500 })
  }
}
