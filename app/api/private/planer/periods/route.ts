import { resource } from '@/app/lib/private-crud'
import { periodsDef } from '@/app/lib/planner-defs'

// GET  /api/private/planer/periods — alle Einträge des eingeloggten Accounts
// POST /api/private/planer/periods — neuen Eintrag anlegen
const r = resource(periodsDef)
export const GET = r.list
export const POST = r.create