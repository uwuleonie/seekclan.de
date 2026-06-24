import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'

async function getMinecraftUuid(token: string | undefined) {
  if (!token) return null
  const sessionResult = await pool.query(
    'SELECT user_id, expires_at FROM sessions WHERE token = $1',
    [token]
  )
  const session = sessionResult.rows[0]
  if (!session || new Date(session.expires_at) < new Date()) return null

  const userResult = await pool.query(
    'SELECT minecraft_uuid FROM users WHERE id = $1',
    [session.user_id]
  )
  return userResult.rows[0]?.minecraft_uuid || null
}

// Trust hinzufügen/aktualisieren
export async function POST(req: NextRequest) {
  const ownerUuid = await getMinecraftUuid(req.cookies.get('session_token')?.value)
  if (!ownerUuid) return NextResponse.json({ error: 'Nicht eingeloggt oder kein Minecraft-Account verknüpft' }, { status: 401 })

  const body = await req.json()
  const { trusted_uuid, trusted_name, claim_id, permissions } = body

  if (!trusted_uuid || !trusted_name) {
    return NextResponse.json({ error: 'Spieler fehlt' }, { status: 400 })
  }

  if (claim_id !== null && claim_id !== undefined) {
    const claimResult = await pool.query(
      'SELECT id, owner_uuid FROM claims WHERE id = $1',
      [claim_id]
    )
    const claim = claimResult.rows[0]
    if (!claim || claim.owner_uuid !== ownerUuid) {
      return NextResponse.json({ error: 'Claim gehört dir nicht' }, { status: 403 })
    }
  }

  const perms = permissions || {}
  const finalClaimId = claim_id ?? null
  const permBuild = !!perms.build
  const permBreak = !!perms.break
  const permContainers = !!perms.containers
  const permDoors = !!perms.doors
  const permMobs = !!perms.mobs
  const permRedstone = !!perms.redstone

  try {
    if (finalClaimId === null) {
      await pool.query(
        `DELETE FROM claim_trusts WHERE owner_uuid = $1 AND trusted_uuid = $2 AND claim_id IS NULL`,
        [ownerUuid, trusted_uuid]
      )
    } else {
      await pool.query(
        `DELETE FROM claim_trusts WHERE owner_uuid = $1 AND trusted_uuid = $2 AND claim_id = $3`,
        [ownerUuid, trusted_uuid, finalClaimId]
      )
    }

    await pool.query(
      `INSERT INTO claim_trusts
         (owner_uuid, trusted_uuid, trusted_name, claim_id, perm_build, perm_break, perm_containers, perm_doors, perm_mobs, perm_redstone)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [ownerUuid, trusted_uuid, trusted_name, finalClaimId, permBuild, permBreak, permContainers, permDoors, permMobs, permRedstone]
    )
  } catch (err) {
    return NextResponse.json({ error: 'Speichern fehlgeschlagen' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}

// Trust entfernen
export async function DELETE(req: NextRequest) {
  const ownerUuid = await getMinecraftUuid(req.cookies.get('session_token')?.value)
  if (!ownerUuid) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 })

  const body = await req.json()
  const { trusted_uuid, claim_id } = body
  if (!trusted_uuid) return NextResponse.json({ error: 'Spieler fehlt' }, { status: 400 })

  try {
    if (claim_id === null || claim_id === undefined) {
      await pool.query(
        `DELETE FROM claim_trusts WHERE owner_uuid = $1 AND trusted_uuid = $2 AND claim_id IS NULL`,
        [ownerUuid, trusted_uuid]
      )
    } else {
      await pool.query(
        `DELETE FROM claim_trusts WHERE owner_uuid = $1 AND trusted_uuid = $2 AND claim_id = $3`,
        [ownerUuid, trusted_uuid, claim_id]
      )
    }
  } catch (err) {
    return NextResponse.json({ error: 'Löschen fehlgeschlagen' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}