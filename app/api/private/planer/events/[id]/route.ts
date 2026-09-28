import { resource } from '@/app/lib/private-crud'
import { eventsDef } from '@/app/lib/planner-defs'

// PATCH  /api/private/planer/events/[id] — Eintrag ändern (nur übergebene Felder)
// DELETE /api/private/planer/events/[id] — Eintrag löschen
const r = resource(eventsDef)
export const PATCH = r.update
export const DELETE = r.remove