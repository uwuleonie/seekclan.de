import { resource } from '@/app/lib/private-crud'
import { bookmarksDef } from '@/app/lib/bookmarks-def'

// GET  /api/private/bookmarks — alle Lesezeichen des eingeloggten Accounts
// POST /api/private/bookmarks — neues Lesezeichen { title, url, color?, sort_order? }
const r = resource(bookmarksDef)
export const GET = r.list
export const POST = r.create