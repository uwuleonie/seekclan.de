import { resource } from '@/app/lib/private-crud'
import { listsDef } from '@/app/lib/planner-defs'

// PATCH  /api/private/planer/lists/[id] — Eintrag ändern (nur übergebene Felder)
// DELETE /api/private/planer/lists/[id] — Eintrag löschen
const r = resource(listsDef)
export const PATCH = r.update
export const DELETE = r.remove