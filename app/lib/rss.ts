// Kleiner RSS-2.0-Leser (für die Nachrichten). Liest nur Titel, Link, Teaser, Datum und Bild.

export interface FeedItem { title: string; link: string; teaser: string; date: string | null; image: string | null }

function decode(s: string): string {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/\s+/g, ' ')
    .trim()
}

function tag(block: string, name: string): string | null {
  const m = block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, 'i'))
  return m ? m[1] : null
}

export function parseRss(xml: string, max = 30): FeedItem[] {
  const items = xml.match(/<item[\s>][\s\S]*?<\/item>/gi) ?? []
  return items.slice(0, max).map(block => {
    const raw = tag(block, 'content:encoded') ?? ''
    const img = block.match(/<(?:media:content|enclosure)[^>]+url="([^"]+)"[^>]*(?:type="image|medium="image)/i)?.[1]
      ?? raw.match(/<img[^>]+src="(https:[^"]+)"/i)?.[1] ?? null
    const link = decode(tag(block, 'link') ?? '')
    const pub = tag(block, 'pubDate')
    const d = pub ? new Date(decode(pub)) : null
    return {
      title: decode(tag(block, 'title') ?? ''),
      link: /^https?:\/\//i.test(link) ? link : '',
      teaser: decode(tag(block, 'description') ?? '').slice(0, 400),
      date: d && !Number.isNaN(d.getTime()) ? d.toISOString() : null,
      image: img && /^https:\/\//i.test(img) ? img : null,
    }
  }).filter(i => i.title && i.link)
}