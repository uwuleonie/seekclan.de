import { resource } from '@/app/lib/private-crud'
import { bookmarksDef } from '@/app/lib/bookmarks-def'

// PATCH  /api/private/bookmarks/[id] — Lesezeichen ändern (nur übergebene Felder)
// DELETE /api/private/bookmarks/[id] — Lesezeichen löschen
const r = resource(bookmarksDef)
export const PATCH = r.update
export const DELETE = r.remove