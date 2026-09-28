import { resource } from '@/app/lib/private-crud'
import { examsDef } from '@/app/lib/planner-defs'

// GET  /api/private/planer/exams — alle Einträge des eingeloggten Accounts
// POST /api/private/planer/exams — neuen Eintrag anlegen
const r = resource(examsDef)
export const GET = r.list
export const POST = r.create