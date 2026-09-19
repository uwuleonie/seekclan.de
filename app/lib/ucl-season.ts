import { pool } from '@/app/lib/db'

export const UCL_SLUG  = '2627'
export const UWCL_SLUG = 'uwcl2627'
export const ALL_SLUGS = [UCL_SLUG, UWCL_SLUG]

export async function getSeasonId(slug: string): Promise<number | null> {
  const res = await pool.query('SELECT id FROM ucl_seasons WHERE slug = $1', [slug])
  return res.rows[0]?.id ?? null
}

export function getSlugFromParam(param: string | null): string {
  if (param === UWCL_SLUG) return UWCL_SLUG
  return UCL_SLUG
}

export async function getBothSeasonIds(): Promise<{ ucl: number | null; uwcl: number | null }> {
  const res = await pool.query(
    'SELECT id, slug FROM ucl_seasons WHERE slug = ANY($1)',
    [ALL_SLUGS]
  )
  const ucl  = res.rows.find((r: any) => r.slug === UCL_SLUG)?.id  ?? null
  const uwcl = res.rows.find((r: any) => r.slug === UWCL_SLUG)?.id ?? null
  return { ucl, uwcl }
}