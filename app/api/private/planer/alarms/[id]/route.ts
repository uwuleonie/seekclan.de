import { resource } from '@/app/lib/private-crud'
import { alarmsDef } from '@/app/lib/planner-defs'

// PATCH  /api/private/planer/alarms/[id] — Eintrag ändern (nur übergebene Felder)
// DELETE /api/private/planer/alarms/[id] — Eintrag löschen
const r = resource(alarmsDef)
export const PATCH = r.update
export const DELETE = r.remove