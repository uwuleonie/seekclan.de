import { resource } from '@/app/lib/private-crud'
import { subjectsDef } from '@/app/lib/planner-defs'

// GET  /api/private/planer/subjects — alle Einträge des eingeloggten Accounts
// POST /api/private/planer/subjects — neuen Eintrag anlegen
const r = resource(subjectsDef)
export const GET = r.list
export const POST = r.create