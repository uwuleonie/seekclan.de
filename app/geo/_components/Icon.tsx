// Schlichte Strich-Icons für den Atlas (24×24, currentColor)

const PATHS: Record<string, string> = {
  compass: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z M15.5 8.5l-2 5-5 2 2-5 5-2Z',
  globe: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z M3 12h18 M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3Z',
  pointer: 'M5 3l13 7-6 1.5L9.5 18 5 3Z',
  target: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z M12 12.5a.5.5 0 1 0 0-1 .5.5 0 0 0 0 1Z',
  keyboard: 'M3 7h18v10H3z M7 11h.01 M11 11h.01 M15 11h.01 M7 14h10',
  book: 'M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2V5Z M4 19a2 2 0 0 1 2-2h13',
  shuffle: 'M16 3h5v5 M4 20 21 3 M21 16v5h-5 M15 15l6 6 M4 4l5 5',
  sparkle: 'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3Z M19 16l.7 1.8 1.8.7-1.8.7L19 21l-.7-1.8-1.8-.7 1.8-.7L19 16Z',
  lock: 'M6 11h12v10H6z M8.5 11V7.5a3.5 3.5 0 0 1 7 0V11',
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z M12 7v5l3 2',
  heart: 'M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10Z',
  timer: 'M12 21a8 8 0 1 0 0-16 8 8 0 0 0 0 16Z M12 9v4 M10 2h4 M18.5 6.5 20 5',
  refresh: 'M20 11a8 8 0 1 0-2.3 5.7 M20 4v7h-7',
  zoomIn: 'M10.5 18a7.5 7.5 0 1 0 0-15 7.5 7.5 0 0 0 0 15Z M21 21l-5.2-5.2 M10.5 7.5v6 M7.5 10.5h6',
  zoomOut: 'M10.5 18a7.5 7.5 0 1 0 0-15 7.5 7.5 0 0 0 0 15Z M21 21l-5.2-5.2 M7.5 10.5h6',
  eye: 'M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z',
  back: 'M15 18l-6-6 6-6',
  next: 'M9 18l6-6-6-6',
  layers: 'M12 3 2 8.5 12 14l10-5.5L12 3Z M2 13.5 12 19l10-5.5',
  map: 'M9 4 3 6.5v13.5L9 17.5l6 2.5 6-2.5V4L15 6.5 9 4Z M9 4v13.5 M15 6.5V20',
  check: 'M4 12.5 9.5 18 20 6.5',
  x: 'M6 6l12 12 M18 6 6 18',
  sun: 'M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z M12 2v2 M12 20v2 M4.9 4.9l1.4 1.4 M17.7 17.7l1.4 1.4 M2 12h2 M20 12h2 M4.9 19.1l1.4-1.4 M17.7 6.3l1.4-1.4',
  moon: 'M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z',
  calendar: 'M4 6h16v15H4z M4 10h16 M8 3v4 M16 3v4',
  play: 'M7 4l13 8-13 8V4Z',
  flag: 'M5 21V4 M5 4h11l-2 4 2 4H5',
  trophy: 'M8 4h8v5a4 4 0 0 1-8 0V4Z M8 6H4v1a3 3 0 0 0 4 3 M16 6h4v1a3 3 0 0 1-4 3 M12 13v4 M8 21h8 M9 17h6v4H9z',
  plus: 'M12 5v14 M5 12h14',
  minus: 'M5 12h14',
  tag: 'M3 12V4h8l10 10-8 8L3 12Z M7.5 8.5h.01',
  maximize: 'M4 9V4h5 M20 9V4h-5 M4 15v5h5 M20 15v5h-5',
  minimize: 'M9 4v5H4 M15 4v5h5 M9 20v-5H4 M15 20v-5h5',
  info: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z M12 11v6 M12 7.5h.01',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z M4 21a8 8 0 0 1 16 0',
  bolt: 'M13 2 4 14h7l-1 8 9-12h-7l1-8Z',
  pin: 'M9 3h6l-1 6 4 3v2H6v-2l4-3-1-6Z M12 14v7',
  star: 'M12 3.5l2.6 5.3 5.9.9-4.2 4.1 1 5.8L12 16.9l-5.3 2.7 1-5.8-4.2-4.1 5.9-.9L12 3.5Z',
  ear: 'M7 9a5 5 0 0 1 10 0c0 3-3 4-3 7a3 3 0 0 1-5.5 1.6 M10 9a2 2 0 0 1 4 0',
  cards: 'M4 7h12v13H4z M8 4h12v13',
  volume: 'M4 9h4l5-4v14l-5-4H4V9Z M16.5 8.5a5 5 0 0 1 0 7 M19 6a8.5 8.5 0 0 1 0 12',
  type: 'M4 7V5h16v2 M12 5v14 M9 19h6',
  share: 'M18 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z M6 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z M18 22a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z M8.6 13.5l6.8 4 M15.4 6.5l-6.8 4',
  users: 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z M2 21a7 7 0 0 1 14 0 M16 3.5a4 4 0 0 1 0 7 M18 14a6 6 0 0 1 4 7',
  search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14Z M20 20l-4-4',
  copy: 'M9 9h11v11H9z M5 15H4V4h11v1',
  send: 'M22 2 11 13 M22 2l-7 20-4-9-9-4 20-7Z',
  fire: 'M12 22a7 7 0 0 0 7-7c0-4-3-6-4-10-2 2-3 4-3 6-1-1-2-2-2-4-2 2-5 5-5 8a7 7 0 0 0 7 7Z',
  link: 'M10 14a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1 M14 10a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1',
}

export default function Icon({ name, size = 18, strokeWidth = 1.8, className, style }: { name: keyof typeof PATHS | string; size?: number; strokeWidth?: number; className?: string; style?: React.CSSProperties }) {
  const d = PATHS[name] ?? PATHS.info
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth}
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className} style={style}>
      {d.split(' M').map((seg, i) => <path key={i} d={i === 0 ? seg : `M${seg}`} />)}
    </svg>
  )
}