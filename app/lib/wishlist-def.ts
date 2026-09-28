import type { ResourceDef } from '@/app/lib/private-crud'

// Wunschliste im Privatbereich – pro Account getrennt (user_id)
export const wishlistDef: ResourceDef = {
  table: 'private_wishlist',
  label: 'Wunsch',
  fields: {
    title: { type: 'text', max: 200, required: true },
    url: { type: 'url' },
    image_url: { type: 'url' },
    price_cents: { type: 'int', min: 0, max: 100_000_000 }, // Preis in Cent (19,99 € = 1999)
    currency: { type: 'enum', values: ['EUR', 'USD', 'GBP', 'CHF'] },
    priority: { type: 'int', min: 1, max: 3, default: 2 }, // 1 = irgendwann, 2 = normal, 3 = unbedingt
    category: { type: 'text', max: 60 },
    note: { type: 'text', max: 2000 },
    bought: { type: 'bool' },
    sort_order: { type: 'int', min: 0, max: 1_000_000, default: 0 },
  },
  orderBy: 'bought ASC, priority DESC, sort_order ASC, created_at DESC',
  prepare(data, { existing }) {
    // Zeitpunkt merken, wann etwas als gekauft markiert wurde
    if ('bought' in data) {
      if (!data.bought) data.bought_at = null
      else if (!existing?.bought) data.bought_at = new Date().toISOString()
    }
    return data
  },
}