import { resource } from '@/app/lib/private-crud'
import { tasksDef } from '@/app/lib/planner-defs'

// GET  /api/private/planer/tasks — alle Einträge des eingeloggten Accounts
// POST /api/private/planer/tasks — neuen Eintrag anlegen
const r = resource(tasksDef)
export const GET = r.list
export const POST = r.create