import { resource } from '@/app/lib/private-crud'
import { wishlistDef } from '@/app/lib/wishlist-def'

// GET  /api/private/wishlist — alle Wünsche des eingeloggten Accounts
// POST /api/private/wishlist — neuen Wunsch anlegen
const r = resource(wishlistDef)
export const GET = r.list
export const POST = r.create