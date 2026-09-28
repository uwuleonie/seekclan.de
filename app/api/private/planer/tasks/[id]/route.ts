import { resource } from '@/app/lib/private-crud'
import { tasksDef } from '@/app/lib/planner-defs'

// PATCH  /api/private/planer/tasks/[id] — Eintrag ändern (nur übergebene Felder)
// DELETE /api/private/planer/tasks/[id] — Eintrag löschen
const r = resource(tasksDef)
export const PATCH = r.update
export const DELETE = r.remove