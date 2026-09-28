import { resource } from '@/app/lib/private-crud'
import { periodsDef } from '@/app/lib/planner-defs'

// PATCH  /api/private/planer/periods/[id] — Eintrag ändern (nur übergebene Felder)
// DELETE /api/private/planer/periods/[id] — Eintrag löschen
const r = resource(periodsDef)
export const PATCH = r.update
export const DELETE = r.remove