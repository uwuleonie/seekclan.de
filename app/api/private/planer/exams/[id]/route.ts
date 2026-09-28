import { resource } from '@/app/lib/private-crud'
import { examsDef } from '@/app/lib/planner-defs'

// PATCH  /api/private/planer/exams/[id] — Eintrag ändern (nur übergebene Felder)
// DELETE /api/private/planer/exams/[id] — Eintrag löschen
const r = resource(examsDef)
export const PATCH = r.update
export const DELETE = r.remove