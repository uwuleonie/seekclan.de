import { resource } from '@/app/lib/private-crud'
import { homeworkDef } from '@/app/lib/planner-defs'

// PATCH  /api/private/planer/homework/[id] — Eintrag ändern (nur übergebene Felder)
// DELETE /api/private/planer/homework/[id] — Eintrag löschen
const r = resource(homeworkDef)
export const PATCH = r.update
export const DELETE = r.remove