import { pool } from '@/app/lib/db'

export async function canEditConcept(userId: string, userRole: string, conceptId: string): Promise<boolean> {
  if (userRole === 'owner') return true

  const conceptResult = await pool.query('SELECT owner_id FROM admin_concepts WHERE id = $1', [conceptId])
  const concept = conceptResult.rows[0]
  if (!concept) return false
  if (concept.owner_id === userId) return true

  const editorResult = await pool.query(
    `SELECT 1 FROM admin_concept_editors WHERE concept_id = $1 AND user_id = $2`,
    [conceptId, userId]
  )
  return editorResult.rows.length > 0
}