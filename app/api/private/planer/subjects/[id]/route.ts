import { resource } from '@/app/lib/private-crud'
import { subjectsDef } from '@/app/lib/planner-defs'

// PATCH  /api/private/planer/subjects/[id] — Eintrag ändern (nur übergebene Felder)
// DELETE /api/private/planer/subjects/[id] — Eintrag löschen
const r = resource(subjectsDef)
export const PATCH = r.update
export const DELETE = r.remove