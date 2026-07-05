'use client'

import React from 'react'

interface LinkifiedTextProps {
  text: string
  className?: string
  style?: React.CSSProperties
}

/**
 * Rendert Text mit automatisch anklickbaren Links.
 *
 * Sonderfälle:
 * - /konzept/<token>-Links werden als kompakter "📐 Konzept öffnen"-Button
 *   dargestellt statt als roher URL — konsistent mit dem Teilen-System.
 * - Alle anderen https?://-Links werden als normaler unterstrichener Link
 *   geöffnet (target="_blank", rel="noreferrer").
 * - Whitespace (Zeilenumbrüche etc.) wird via `whitespace-pre-wrap` erhalten.
 *
 * Verwendung:
 *   <LinkifiedText text={msg.content} />
 *   <LinkifiedText text={idea.description} className="text-sm" style={{ color: 'var(--foreground)' }} />
 */
export default function LinkifiedText({ text, className, style }: LinkifiedTextProps) {
  if (!text) return null

  const parts = text.split(/(https?:\/\/[^\s]+)/g)

  return (
    <span className={`whitespace-pre-wrap ${className || ''}`} style={style}>
      {parts.map((part, i) => {
        if (!/^https?:\/\//.test(part)) return <React.Fragment key={i}>{part}</React.Fragment>

        if (/\/konzept\/[a-zA-Z0-9]+/.test(part)) {
          return (
            <a key={i} href={part} target="_blank" rel="noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium align-middle mx-1 no-underline"
              style={{ background: '#7C3AED22', color: '#7C3AED', border: '1px solid #7C3AED55' }}>
              📐 Konzept öffnen
            </a>
          )
        }

        return (
          <a key={i} href={part} target="_blank" rel="noreferrer"
            className="underline break-all"
            style={{ color: '#7C3AED' }}>
            {part}
          </a>
        )
      })}
    </span>
  )
}