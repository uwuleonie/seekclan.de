import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'
import { loadEditionData, requireAdmin, resolveEdition } from '@/app/lib/ballondor-server'
import { DEFAULT_SCORING, parseImport } from '@/app/lib/ballondor'

// GET /api/ballondor/admin?edition=2026 — alles inkl. unveröffentlichter Ergebnisse und aller Tipps
export async function GET(req: NextRequest) {
  try {
    if (!(await requireAdmin(req))) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })
    const editions = await pool.query('SELECT * FROM bdo_editions ORDER BY created_at DESC')
    const edition = await resolveEdition(req.nextUrl.searchParams.get('edition'))
    if (!edition) return NextResponse.json({ editions: editions.rows, edition: null, categories: [], nominees: [], results: [], tips: [] })

    const { categories, nominees, allResults } = await loadEditionData(edition.id)
    const tips = await pool.query(
      `SELECT t.category_id, t.pick_nominee_id, t.ranking, t.updated_at, u.username, t.gast_name
       FROM bdo_tips t JOIN bdo_categories c ON c.id = t.category_id
       LEFT JOIN users u ON u.id = t.user_id
       WHERE c.edition_id = $1 ORDER BY t.updated_at DESC`, [edition.id])

    return NextResponse.json({ editions: editions.rows, edition, categories, nominees, results: allResults, tips: tips.rows })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// POST /api/ballondor/admin  { action, ... }
export async function POST(req: NextRequest) {
  try {
    if (!(await requireAdmin(req))) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })
    const b = await req.json()

    switch (b.action) {
      // ── Ausgaben ──────────────────────────────────────────────────────────
      case 'create_edition': {
        const slug = String(b.slug ?? '').trim()
        if (!slug) return NextResponse.json({ error: 'Slug fehlt' }, { status: 400 })
        const r = await pool.query(
          `INSERT INTO bdo_editions (slug, title, ceremony_at, tips_close_at, is_active)
           VALUES ($1, $2, $3, $4, false) RETURNING *`,
          [slug, b.title || `Ballon d'Or ${slug}`, b.ceremony_at || null, b.tips_close_at || null])
        return NextResponse.json({ success: true, edition: r.rows[0] })
      }
      case 'update_edition': {
        await pool.query(
          `UPDATE bdo_editions SET title = $2, ceremony_at = $3, tips_close_at = $4 WHERE id = $1`,
          [b.id, b.title, b.ceremony_at || null, b.tips_close_at || null])
        if (b.is_active === true) {
          await pool.query('UPDATE bdo_editions SET is_active = (id = $1)', [b.id])
        } else if (b.is_active === false) {
          await pool.query('UPDATE bdo_editions SET is_active = false WHERE id = $1', [b.id])
        }
        return NextResponse.json({ success: true })
      }

      // ── Import ────────────────────────────────────────────────────────────
      case 'import': {
        const editionId = Number(b.edition_id)
        const parsed = parseImport(String(b.text ?? ''))
        if (!editionId || !parsed.length) return NextResponse.json({ error: 'Nichts zum Importieren gefunden' }, { status: 400 })
        const client = await pool.connect()
        let catCount = 0, nomCount = 0, linkCount = 0
        try {
          await client.query('BEGIN')
          const maxSort = await client.query('SELECT COALESCE(MAX(sort), 0) AS m FROM bdo_categories WHERE edition_id = $1', [editionId])
          let sort = Number(maxSort.rows[0].m)
          for (const pc of parsed) {
            sort += 10
            const catRes = await client.query(
              `INSERT INTO bdo_categories (edition_id, name, gender, kind, nominee_type, sort, scoring)
               VALUES ($1, $2, $3, $4, $5, $6, $7)
               ON CONFLICT (edition_id, name) DO UPDATE SET gender = EXCLUDED.gender, kind = EXCLUDED.kind, nominee_type = EXCLUDED.nominee_type
               RETURNING id, (xmax = 0) AS inserted`,
              [editionId, pc.name, pc.gender, pc.kind, pc.nominee_type, sort, JSON.stringify(DEFAULT_SCORING[pc.kind])])
            const categoryId = catRes.rows[0].id
            if (catRes.rows[0].inserted) catCount++
            for (const n of pc.nominees) {
              // Gleiche Person in mehreren Kategorien → derselbe Nominierte
              const existing = await client.query(
                `SELECT id FROM bdo_nominees WHERE edition_id = $1 AND LOWER(name) = LOWER($2)
                 AND gender IS NOT DISTINCT FROM $3 AND nominee_type = $4`,
                [editionId, n.name, pc.gender, pc.nominee_type])
              let nomineeId: number
              if (existing.rows[0]) {
                nomineeId = existing.rows[0].id
                await client.query(
                  `UPDATE bdo_nominees SET country = COALESCE(country, $2), club = COALESCE(club, $3) WHERE id = $1`,
                  [nomineeId, n.country, n.club])
              } else {
                const ins = await client.query(
                  `INSERT INTO bdo_nominees (edition_id, name, gender, nominee_type, country, club)
                   VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
                  [editionId, n.name, pc.gender, pc.nominee_type, n.country, n.club])
                nomineeId = ins.rows[0].id
                nomCount++
              }
              const l = await client.query(
                `INSERT INTO bdo_category_nominees (category_id, nominee_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
                [categoryId, nomineeId])
              linkCount += l.rowCount ?? 0
            }
          }
          await client.query('COMMIT')
        } catch (e) {
          await client.query('ROLLBACK')
          throw e
        } finally {
          client.release()
        }
        return NextResponse.json({ success: true, categories: parsed.length, newCategories: catCount, newNominees: nomCount, newLinks: linkCount })
      }

      // ── Kategorien ────────────────────────────────────────────────────────
      case 'update_category': {
        await pool.query(
          `UPDATE bdo_categories SET name = $2, kind = $3, sort = $4, scoring = $5 WHERE id = $1`,
          [b.id, b.name, b.kind, Number(b.sort) || 0, JSON.stringify(b.scoring ?? {})])
        return NextResponse.json({ success: true })
      }
      case 'delete_category': {
        await pool.query('DELETE FROM bdo_categories WHERE id = $1', [b.id])
        return NextResponse.json({ success: true })
      }

      // ── Nominierte ────────────────────────────────────────────────────────
      case 'update_nominee': {
        const stats = Array.isArray(b.stats)
          ? b.stats.filter((s: any) => s && String(s.label ?? '').trim()).map((s: any) => ({ label: String(s.label).trim(), value: String(s.value ?? '').trim() }))
          : []
        await pool.query(
          `UPDATE bdo_nominees SET name = $2, country = $3, club = $4, photo_url = $5, position = $6,
             birthdate = $7, stats = $8, bio = $9 WHERE id = $1`,
          [b.id, b.name, b.country || null, b.club || null, b.photo_url || null, b.position || null,
           b.birthdate || null, JSON.stringify(stats), b.bio || null])
        return NextResponse.json({ success: true })
      }
      case 'unlink_nominee': {
        await pool.query('DELETE FROM bdo_category_nominees WHERE category_id = $1 AND nominee_id = $2', [b.category_id, b.nominee_id])
        return NextResponse.json({ success: true })
      }

      // ── Ergebnisse ────────────────────────────────────────────────────────
      case 'set_result': {
        const ranking: number[] | null = Array.isArray(b.ranking) && b.ranking.length ? b.ranking.map(Number) : null
        const winner = b.winner_nominee_id ? Number(b.winner_nominee_id) : (ranking ? ranking[0] : null)
        await pool.query(
          `INSERT INTO bdo_results (category_id, winner_nominee_id, ranking, published_at)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (category_id) DO UPDATE SET winner_nominee_id = EXCLUDED.winner_nominee_id,
             ranking = EXCLUDED.ranking, published_at = EXCLUDED.published_at`,
          [b.category_id, winner, ranking, b.publish ? new Date() : null])
        return NextResponse.json({ success: true })
      }
      case 'delete_result': {
        await pool.query('DELETE FROM bdo_results WHERE category_id = $1', [b.category_id])
        return NextResponse.json({ success: true })
      }

      default:
        return NextResponse.json({ error: 'Unbekannte Aktion' }, { status: 400 })
    }
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}