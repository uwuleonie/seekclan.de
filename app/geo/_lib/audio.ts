'use client'

// Töne für seekclan.de/geo
//  1. Laute (Buchstaben): echte Aufnahmen der Lautschrift-Laute in public/geo/audio/laute/<laut>.mp3
//     (IPA-Tondateien von Wikimedia Commons, freie Lizenzen – Liste siehe scripts/geo/build-sprachen.mjs)
//  2. Orts- und Ländernamen: echte Aussprache-Aufnahmen von Wikimedia Commons (über Wikidata P443), wenn es eine in der Landessprache gibt
//  3. Sonst: Sprachausgabe des Geräts (Web Speech API) – welche Sprachen gehen, hängt vom Gerät ab

import { useEffect, useState } from 'react'

/** Was vorgelesen wird: Text, Sprache (BCP 47) und – falls vorhanden – Adressen einer echten Aufnahme (zuerst MP3) */
export interface Say { t: string; l: string; a?: string[]; src?: string }

let current: HTMLAudioElement | null = null
let token = 0

export function stopAudio() {
  token++
  try { current?.pause() } catch { /* egal */ }
  current = null
  try { if (typeof speechSynthesis !== 'undefined') speechSynthesis.cancel() } catch { /* egal */ }
}

/** Eine Datei abspielen – true, wenn sie bis zum Ende lief */
function playUrl(url: string, my: number): Promise<boolean> {
  return new Promise(resolve => {
    if (my !== token) return resolve(false)
    const a = new Audio(url)
    current = a
    let done = false
    const end = (ok: boolean) => { if (!done) { done = true; resolve(ok) } }
    a.addEventListener('ended', () => end(true))
    a.addEventListener('error', () => end(false))
    a.play().catch(() => end(false))
    // Notbremse, falls ein Browser weder „ended“ noch „error“ meldet
    setTimeout(() => end(true), 8000)
  })
}

/** Laute nacheinander abspielen (z.B. „je“ = j + e) */
export async function playSounds(keys: string[]) {
  stopAudio()
  const my = token
  for (const k of keys) {
    if (my !== token) return
    await playUrl(`/geo/audio/laute/${k}.mp3`, my)
    await new Promise(r => setTimeout(r, 90))
  }
}

/** Gibt es auf diesem Gerät eine Stimme für die Sprache? */
export function hasVoice(lang?: string): boolean {
  try {
    if (!lang || typeof speechSynthesis === 'undefined') return false
    const want = lang.toLowerCase(), short = want.slice(0, 2)
    return speechSynthesis.getVoices().some(v => { const l = v.lang.toLowerCase().replace('_', '-'); return l === want || l.startsWith(short) })
  } catch { return false }
}

/** Mit der Stimme des Geräts vorlesen – false, wenn es keine passende Stimme gibt */
export function speak(text: string, lang?: string, rate = 0.85): boolean {
  if (!hasVoice(lang)) return false
  try {
    stopAudio()
    const u = new SpeechSynthesisUtterance(text)
    u.lang = lang!
    u.rate = rate
    const want = lang!.toLowerCase()
    const v = speechSynthesis.getVoices().find(v => v.lang.toLowerCase().replace('_', '-') === want) ?? speechSynthesis.getVoices().find(v => v.lang.toLowerCase().startsWith(want.slice(0, 2)))
    if (v) u.voice = v
    speechSynthesis.speak(u)
    return true
  } catch { return false }
}

/** Ortsname/Wort: erst die echte Aufnahme, sonst die Stimme des Geräts */
export async function playSay(say: Say): Promise<boolean> {
  stopAudio()
  const my = token
  for (const url of say.a ?? []) if (await playUrl(url, my)) return true
  if (my !== token) return false
  return speak(say.t, say.l)
}

export const canSay = (say?: Say | null) => !!say && (!!say.a?.length || hasVoice(say.l))

/** Stimmen werden im Browser erst nach und nach geladen – Hook, damit die Knöpfe danach erscheinen */
export function useVoices(): number {
  const [n, setN] = useState(0)
  useEffect(() => {
    if (typeof speechSynthesis === 'undefined') return
    const upd = () => setN(x => x + 1)
    upd()
    speechSynthesis.addEventListener?.('voiceschanged', upd)
    return () => speechSynthesis.removeEventListener?.('voiceschanged', upd)
  }, [])
  return n
}