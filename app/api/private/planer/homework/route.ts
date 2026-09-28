import { resource } from '@/app/lib/private-crud'
import { homeworkDef } from '@/app/lib/planner-defs'

// GET  /api/private/planer/homework — alle Einträge des eingeloggten Accounts
// POST /api/private/planer/homework — neuen Eintrag anlegen
const r = resource(homeworkDef)
export const GET = r.list
export const POST = r.create