import { ValidationError, type ResourceDef } from '@/app/lib/private-crud'

// Lesezeichenleiste im Privatbereich – pro Account getrennt (user_id)
export const bookmarksDef: ResourceDef = {
  table: 'private_bookmarks',
  label: 'Lesezeichen',
  fields: {
    title: { type: 'text', max: 80, required: true },
    url: { type: 'url' },
    color: { type: 'color' },
    sort_order: { type: 'int', min: 0, max: 1_000_000, default: 0 },
  },
  orderBy: 'sort_order ASC, created_at ASC',
  prepare(data, { existing }) {
    // Ein Lesezeichen ohne Link ergibt keinen Sinn
    if ((!existing || 'url' in data) && !data.url) throw new ValidationError('Link fehlt')
    return data
  },
}