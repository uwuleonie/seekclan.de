import { resource } from '@/app/lib/private-crud'
import { wishlistDef } from '@/app/lib/wishlist-def'

// PATCH  /api/private/wishlist/[id] — Wunsch ändern (nur übergebene Felder)
// DELETE /api/private/wishlist/[id] — Wunsch löschen
const r = resource(wishlistDef)
export const PATCH = r.update
export const DELETE = r.remove