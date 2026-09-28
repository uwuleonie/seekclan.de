// Einheitliche Linien-Icons für den privaten Bereich (statt Emojis/Sonderzeichen).
// Alle Icons nutzen currentColor und denselben Strich, damit sie überall gleich wirken.

import type { CSSProperties } from 'react'

const PATHS: Record<string, React.ReactNode> = {
  home: <><path d="M3 10.5 12 3l9 7.5" /><path d="M5 9.5V20a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V9.5" /></>,
  share: <><path d="M12 3v12" /><path d="m7 8 5-5 5 5" /><path d="M5 14v5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5" /></>,
  upload: <><path d="M12 16V4" /><path d="m7 9 5-5 5 5" /><path d="M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" /></>,
  download: <><path d="M12 4v12" /><path d="m7 11 5 5 5-5" /><path d="M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" /></>,
  notes: <><path d="M6 3h9l4 4v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" /><path d="M14 3v5h5" /><path d="M8.5 13h7M8.5 17h5" /></>,
  globe: <><circle cx="12" cy="12" r="9" /><path d="M3 12h18" /><path d="M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3Z" /></>,
  image: <><rect x="3" y="4" width="18" height="16" rx="2.5" /><circle cx="9" cy="9.5" r="1.8" /><path d="m21 16-5-5-9 9" /></>,
  video: <><rect x="3" y="5" width="13" height="14" rx="2.5" /><path d="m16 10 5-3v10l-5-3" /></>,
  audio: <><path d="M9 18V6l11-2v12" /><circle cx="6.5" cy="18" r="2.5" /><circle cx="17.5" cy="16" r="2.5" /></>,
  file: <><path d="M6 3h8l5 5v12a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" /><path d="M14 3v5h5" /></>,
  pdf: <><path d="M6 3h8l5 5v12a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" /><path d="M14 3v5h5" /><path d="M8.5 16.5h7M8.5 12.5h4" /></>,
  archive: <><rect x="3" y="4" width="18" height="5" rx="1.5" /><path d="M5 9v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9" /><path d="M10 13h4" /></>,
  folder: <><path d="M3 7a2 2 0 0 1 2-2h4l2 2.5h8a2 2 0 0 1 2 2V18a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" /></>,
  folderPlus: <><path d="M3 7a2 2 0 0 1 2-2h4l2 2.5h8a2 2 0 0 1 2 2V18a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" /><path d="M12 11v5M9.5 13.5h5" /></>,
  camera: <><path d="M4 8a2 2 0 0 1 2-2h2l1.5-2h5L16 6h2a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2Z" /><circle cx="12" cy="13" r="3.5" /></>,
  phone: <><rect x="7" y="2.5" width="10" height="19" rx="2.5" /><path d="M11 18.5h2" /></>,
  monitor: <><rect x="3" y="4" width="18" height="12" rx="2" /><path d="M9 20h6M12 16v4" /></>,
  search: <><circle cx="11" cy="11" r="6.5" /><path d="m20 20-4.2-4.2" /></>,
  plus: <><path d="M12 5v14M5 12h14" /></>,
  x: <><path d="M6 6l12 12M18 6 6 18" /></>,
  check: <><path d="m5 12.5 4.5 4.5L19 7.5" /></>,
  trash: <><path d="M4 7h16" /><path d="M9 7V4.5h6V7" /><path d="M6 7l1 13h10l1-13" /></>,
  pencil: <><path d="M4 20h4L19 9l-4-4L4 16Z" /><path d="m13.5 6.5 4 4" /></>,
  move: <><path d="M3 7a2 2 0 0 1 2-2h4l2 2.5h8a2 2 0 0 1 2 2V18a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" /><path d="M9 14h6M13 11.5l2.5 2.5-2.5 2.5" /></>,
  more: <><circle cx="5.5" cy="12" r="1.3" /><circle cx="12" cy="12" r="1.3" /><circle cx="18.5" cy="12" r="1.3" /></>,
  menu: <><path d="M4 7h16M4 12h16M4 17h16" /></>,
  back: <><path d="M15 5 8 12l7 7" /></>,
  next: <><path d="m9 5 7 7-7 7" /></>,
  grid: <><rect x="4" y="4" width="7" height="7" rx="1.5" /><rect x="13" y="4" width="7" height="7" rx="1.5" /><rect x="4" y="13" width="7" height="7" rx="1.5" /><rect x="13" y="13" width="7" height="7" rx="1.5" /></>,
  list: <><path d="M9 6h11M9 12h11M9 18h11" /><circle cx="4.5" cy="6" r="1" /><circle cx="4.5" cy="12" r="1" /><circle cx="4.5" cy="18" r="1" /></>,
  select: <><rect x="4" y="4" width="16" height="16" rx="4" /><path d="m8.5 12 2.5 2.5 4.5-5" /></>,
  link: <><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7L11.5 6.8" /><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1.5-1.5" /></>,
  eye: <><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" /><circle cx="12" cy="12" r="3" /></>,
  info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v5.5M12 7.8v.2" /></>,
  refresh: <><path d="M20 12a8 8 0 1 1-2.4-5.7L20 8.5" /><path d="M20 4v4.5h-4.5" /></>,
  zoomIn: <><circle cx="11" cy="11" r="6.5" /><path d="m20 20-4.2-4.2M11 8.5v5M8.5 11h5" /></>,
  zoomOut: <><circle cx="11" cy="11" r="6.5" /><path d="m20 20-4.2-4.2M8.5 11h5" /></>,
  target: <><circle cx="12" cy="12" r="8.5" /><circle cx="12" cy="12" r="4.5" /><circle cx="12" cy="12" r="1" /></>,
  pointer: <><path d="M6 3.5 18.5 12 13 13.2 10.5 19Z" /></>,
  book: <><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5Z" /><path d="M4 20.5A2.5 2.5 0 0 1 6.5 18H20v3H6.5" /></>,
  shuffle: <><path d="M3 7h3.5c4 0 5 10 9 10H21" /><path d="M3 17h3.5c1.6 0 2.7-1.6 3.6-3.5M14 9c.9-1.2 1.9-2 3.5-2H21" /><path d="m18 4 3 3-3 3M18 14l3 3-3 3" /></>,
  user: <><circle cx="12" cy="8" r="4" /><path d="M4.5 20.5c1.2-3.8 4-5.5 7.5-5.5s6.3 1.7 7.5 5.5" /></>,
  logout: <><path d="M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4" /><path d="M10 16l-4-4 4-4M6 12h10" /></>,
  sparkle: <><path d="M12 3.5 13.8 10 20.5 12l-6.7 2L12 20.5 10.2 14 3.5 12l6.7-2Z" /></>,
  wifi: <><path d="M3 9a13 13 0 0 1 18 0M6.5 12.5a8 8 0 0 1 11 0M10 16a3 3 0 0 1 4 0" /><circle cx="12" cy="19" r=".8" /></>,
  play: <><path d="M8 5.5v13l10.5-6.5Z" /></>,
  save: <><path d="M5 4h11l3 3v12a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1Z" /><path d="M8 4v5h7V4M8 20v-6h8v6" /></>,
  flag: <><path d="M5 21V4M5 4h11l-2 4 2 4H5" /></>,
  clip: <><path d="M20 11.5 12.3 19.2a5 5 0 0 1-7.1-7.1L13 4.3a3.3 3.3 0 0 1 4.7 4.7l-7.8 7.8a1.7 1.7 0 0 1-2.4-2.4L14.8 7" /></>,
  bell: <><path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15Z" /><path d="M10 20.5a2 2 0 0 0 4 0" /></>,
  calendar: <><rect x="3.5" y="5" width="17" height="15.5" rx="2.5" /><path d="M3.5 10h17M8 3v4M16 3v4" /></>,
  sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2.5v2M12 19.5v2M4.5 4.5l1.4 1.4M18.1 18.1l1.4 1.4M2.5 12h2M19.5 12h2M4.5 19.5l1.4-1.4M18.1 5.9l1.4-1.4" /></>,
  moon: <><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z" /></>,
  cloud: <><path d="M7 18.5h10a4 4 0 0 0 .6-7.96A5.5 5.5 0 0 0 7 9.5a4.5 4.5 0 0 0 0 9Z" /></>,
  rain: <><path d="M7 15h10a4 4 0 0 0 .6-7.96A5.5 5.5 0 0 0 7 6a4.5 4.5 0 0 0 0 9Z" /><path d="M8 18l-1 2.5M12 18l-1 2.5M16 18l-1 2.5" /></>,
  snow: <><path d="M7 14h10a4 4 0 0 0 .6-7.96A5.5 5.5 0 0 0 7 5a4.5 4.5 0 0 0 0 9Z" /><path d="M8 18h.01M12 19h.01M16 18h.01M10 21h.01M14 21h.01" /></>,
  storm: <><path d="M7 14h10a4 4 0 0 0 .6-7.96A5.5 5.5 0 0 0 7 5a4.5 4.5 0 0 0 0 9Z" /><path d="m12 14-2 4h4l-2 4" /></>,
  fog: <><path d="M4 9h16M3 13h18M5 17h14" /></>,
  wind: <><path d="M3 8h11a3 3 0 1 0-3-3M3 12h15a3 3 0 1 1-3 3M3 16h8" /></>,
  drop: <><path d="M12 3.5s6 6.3 6 10.5a6 6 0 0 1-12 0c0-4.2 6-10.5 6-10.5Z" /></>,
  timer: <><circle cx="12" cy="13.5" r="7.5" /><path d="M12 13.5V9.5M9.5 2.5h5M18.5 6.5l1.5-1.5" /></>,
  school: <><path d="M2.5 9 12 4.5 21.5 9 12 13.5Z" /><path d="M6.5 11v5c1.5 1.5 3.5 2.3 5.5 2.3s4-.8 5.5-2.3v-5" /></>,
  repeat: <><path d="M4 11V9a3 3 0 0 1 3-3h12M16 3l3 3-3 3M20 13v2a3 3 0 0 1-3 3H5M8 21l-3-3 3-3" /></>,
  clock: <><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></>,
  // Texteditor
  bold: <><path d="M7 5h6a3.5 3.5 0 0 1 0 7H7Z" /><path d="M7 12h7a3.5 3.5 0 0 1 0 7H7Z" /></>,
  italic: <><path d="M10 5h8M6 19h8M14 5l-4 14" /></>,
  underline: <><path d="M7 4v7a5 5 0 0 0 10 0V4" /><path d="M5 20h14" /></>,
  strike: <><path d="M4 12h16" /><path d="M16.5 7.5C16 5.8 14.3 4.8 12 4.8c-2.8 0-4.5 1.4-4.5 3.4 0 1.4.8 2.4 2.6 3.1" /><path d="M8 16.5c.6 1.8 2.3 2.8 4.3 2.8 2.8 0 4.6-1.4 4.6-3.5 0-.8-.2-1.4-.7-1.9" /></>,
  heading: <><path d="M6 4v16M18 4v16M6 12h12" /></>,
  listBullet: <><path d="M10 6h10M10 12h10M10 18h10" /><circle cx="5" cy="6" r="1.2" /><circle cx="5" cy="12" r="1.2" /><circle cx="5" cy="18" r="1.2" /></>,
  listOrdered: <><path d="M10 6h10M10 12h10M10 18h10" /><path d="M4 5l1.5-1v5" /><path d="M3.8 14.2c.3-.8 1-1.2 1.7-1.2.9 0 1.5.6 1.5 1.3 0 1.2-2.9 2.1-3.2 3.7H7" /></>,
  checklist: <><rect x="3.5" y="4" width="5" height="5" rx="1.2" /><path d="m4.8 15.5 1.4 1.4 2.6-2.8" /><path d="M12 6.5h8.5M12 15.5h8.5" /></>,
  alignLeft: <><path d="M4 6h16M4 10h10M4 14h16M4 18h10" /></>,
  alignCenter: <><path d="M4 6h16M7 10h10M4 14h16M7 18h10" /></>,
  alignRight: <><path d="M4 6h16M10 10h10M4 14h16M10 18h10" /></>,
  alignJustify: <><path d="M4 6h16M4 10h16M4 14h16M4 18h16" /></>,
  undo: <><path d="M9 14 4 9l5-5" /><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" /></>,
  redo: <><path d="m15 14 5-5-5-5" /><path d="M20 9H9.5a5.5 5.5 0 0 0 0 11H13" /></>,
  quote: <><path d="M5 18c2-1 3-2.8 3-5.5V7H4v5h4" /><path d="M15 18c2-1 3-2.8 3-5.5V7h-4v5h4" /></>,
  divider: <><path d="M4 12h16" /><path d="M8 7h8M8 17h8" opacity=".35" /></>,
  textColor: <><path d="m6 16 6-12 6 12" /><path d="M8.2 11.5h7.6" /><path d="M4 20h16" strokeWidth="3" /></>,
  highlight: <><path d="m9 15-3 3h5l1.5-1.5" /><path d="m14.5 4.5 5 5-7 7-5-5Z" /><path d="M4 21h16" /></>,
  signature: <><path d="M3 17c2.5 0 3.5-9 6-9 2 0 .5 8 3 8 1.6 0 2-3 3.5-3 1.2 0 1.2 2 2.5 2H21" /><path d="M3 21h18" /></>,
  eraser: <><path d="m8 20-4.3-4.3a1.5 1.5 0 0 1 0-2.1L13.6 3.7a1.5 1.5 0 0 1 2.1 0l4.6 4.6a1.5 1.5 0 0 1 0 2.1L11 20Z" /><path d="M8 20h12M9 10.5l5.5 5.5" /></>,
  pin: <><path d="M9 3h6l-1 6 3.5 3.5v1.5h-11v-1.5L10 9Z" /><path d="M12 14v7" /></>,
  paper: <><rect x="4" y="3" width="16" height="18" rx="2" /><path d="M4 8.5h16M4 13h16M4 17.5h16" opacity=".55" /></>,
  chevronDown: <><path d="m6 9 6 6 6-6" /></>,
  chevronRight: <><path d="m9 6 6 6-6 6" /></>,
  filter: <><path d="M4 5h16l-6 7.5V19l-4 2v-8.5Z" /></>,
  sort: <><path d="M7 4v16M3.5 16.5 7 20l3.5-3.5" /><path d="M14 7h7M14 12h5M14 17h3" /></>,
  gift: <><rect x="3.5" y="8" width="17" height="4" rx="1" /><path d="M5 12v8a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-8M12 8v13" /><path d="M12 8C10.5 4 6.5 4.5 7 7c.2 1 2 1 5 1ZM12 8c1.5-4 5.5-3.5 5-1-.2 1-2 1-5 1Z" /></>,
  external: <><path d="M14 4h6v6" /><path d="m20 4-9 9" /><path d="M18 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4" /></>,
  tag: <><path d="M3 12V4a1 1 0 0 1 1-1h8l9 9-9 9Z" /><circle cx="8" cy="8" r="1.5" /></>,
  star: <><path d="m12 3.5 2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9Z" /></>,
  // Werkzeuge
  tools: <><path d="M14.5 6.5a4 4 0 0 0 5 5L12 19a2.1 2.1 0 0 1-3-3Z" /><path d="M14.5 6.5 17 4l3 3-2.5 2.5" /><path d="M4 20l3.5-3.5" /></>,
  palette: <><path d="M12 3a9 9 0 1 0 0 18c1.1 0 1.7-.8 1.7-1.7 0-.5-.2-.9-.5-1.2-.3-.3-.5-.7-.5-1.2 0-.9.8-1.7 1.7-1.7H16a5 5 0 0 0 5-5c0-4-4-7.2-9-7.2Z" /><circle cx="7.5" cy="11" r="1.2" /><circle cx="10" cy="7" r="1.2" /><circle cx="15" cy="7.5" r="1.2" /></>,
  calculator: <><rect x="5" y="3" width="14" height="18" rx="2.5" /><path d="M8 7h8" /><path d="M8.5 11.5h.01M12 11.5h.01M15.5 11.5h.01M8.5 15h.01M12 15h.01M15.5 15v3M8.5 18h.01M12 18h.01" strokeWidth="2.4" /></>,
  ruler: <><path d="m3 17 14-14 4 4L7 21Z" /><path d="m7 13 2 2M10 10l2 2M13 7l2 2" /></>,
  currency: <><circle cx="12" cy="12" r="9" /><path d="M15.5 8.5A4.5 4.5 0 1 0 15.5 15.5" /><path d="M6.5 10.5h7M6.5 13.5h7" /></>,
  key: <><circle cx="8" cy="15" r="4" /><path d="m11 12 9-9M17 6l3 3M14.5 8.5l2 2" /></>,
  bookmark: <><path d="M6 3h12a1 1 0 0 1 1 1v17l-7-4.5L5 21V4a1 1 0 0 1 1-1Z" /></>,
  crop: <><path d="M6 2v14a2 2 0 0 0 2 2h14" /><path d="M2 6h14a2 2 0 0 1 2 2v14" /></>,
  rotate: <><path d="M20 12a8 8 0 1 1-2.3-5.7" /><path d="M20 4v5h-5" /></>,
  flip: <><path d="M12 3v18" strokeDasharray="2 2.5" /><path d="M9 7 4 17h5ZM15 7l5 10h-5Z" /></>,
  wand: <><path d="m4 20 11-11" /><path d="m15 9 2-2" /><path d="M18 3v3M16.5 4.5h3M20 9v2M19 10h2M11 3v2M10 4h2" /></>,
  copy: <><rect x="8" y="8" width="12" height="12" rx="2" /><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" /></>,
  eyedropper: <><path d="m14 7 3 3" /><path d="M19.5 4.5a2.1 2.1 0 0 0-3 0L14 7l-8 8-1 4 4-1 8-8 2.5-2.5a2.1 2.1 0 0 0 0-3Z" /></>,
  swap: <><path d="M7 4 3 8l4 4" /><path d="M3 8h13" /><path d="m17 20 4-4-4-4" /><path d="M21 16H8" /></>,
  sliders: <><path d="M4 7h10M18 7h2M4 17h4M12 17h8" /><circle cx="16" cy="7" r="2" /><circle cx="10" cy="17" r="2" /></>,
  cart: <><path d="M3 4h2.5l2.2 11h10.6L20.5 7H7" /><circle cx="9" cy="19.5" r="1.3" /><circle cx="17" cy="19.5" r="1.3" /></>,
}

export type IconName = keyof typeof PATHS

export default function Icon({
  name,
  size = 20,
  stroke = 1.8,
  style,
  className,
}: {
  name: IconName | string
  size?: number
  stroke?: number
  style?: CSSProperties
  className?: string
}) {
  const content = PATHS[name] ?? PATHS.file
  const filled = name === 'play'
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth={stroke}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={style}
      className={className}
    >
      {content}
    </svg>
  )
}