'use client'

// /admin2/personen → eine Person mit ALLEM an einer Stelle (rechte Seitenleiste):
//   Rang · Minecraft-Account · Clan-Akte (Beitritt, Stufe, Discord, aufnehmen/entfernen) · Abzeichen · Clan-Verlauf · Website-Konto
//   (Rechte, sperren, deaktivieren, Passwort, löschen, letzte Logins).
// Jeder Bereich prüft sein eigenes Recht: Ränge vergeben / Clan verwalten / Konten verwalten. Der Server prüft zusätzlich.

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useAuth } from '../../../lib/auth-context'
import { ALLE_RECHTE, RECHTE, darf, darfRangGeben, type Rang } from '@/app/lib/rechte-def'
import { STUFEN, stufeVon } from '@/app/lib/clan-stufen'
import { ARTEN, ART_FARBE, ART_NAME, RANG_VORSCHLAEGE, satz, zeitText, type Art, type Eintrag } from '@/app/lib/clan-historie-def'
import { fmtDatum, ghostBtn, gradBtn, inp, RangSchild, type Person, type RangVoll } from './typen'

export type Akte = {
  akteId: string | null; key: string; beitritt: string | null; stufe_override: number | null; discord_tag: string | null
  badges: { id: string }[]; aktiv: boolean
}
export type Abzeichen = { id: string; name: string; icon_url: string }
type Konto = {
  id: string; username: string; name: string; is_banned: boolean; banned_reason: string | null; is_deactivated: boolean
  created_at: string; last_login_at: string | null; rang: Rang; rechte: string[]
}

const abschnitt: React.CSSProperties = { background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 14, padding: 16 }
const titel = 'text-[11px] font-bold uppercase tracking-wider mb-2'
const lokal = (d: Date) => { const x = new Date(d); x.setMinutes(x.getMinutes() - x.getTimezoneOffset()); return x.toISOString().slice(0, 16) }

export default function PersonPanel({ person, raenge, akte, abzeichen, schliessen, geaendert, flash }: {
  person: Person; raenge: RangVoll[]; akte: Akte | null; abzeichen: Abzeichen[]
  schliessen: () => void; geaendert: () => void; flash: (t: string, f?: boolean) => void
}) {
  const { user } = useAuth()
  const p = person
  const rang = raenge.find(r => r.id === p.rangId)
  const std = raenge.find(r => r.is_default)
  const mcName = p.mcName || (p.userId ? null : p.name)
  const darfClan = darf(user, 'clan.verwalten')
  const darfKonten = darf(user, 'konten.verwalten')
  const [busy, setBusy] = useState(false)

  // Esc schließt
  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') schliessen() }
    window.addEventListener('keydown', esc)
    return () => window.removeEventListener('keydown', esc)
  }, [schliessen])

  const senden = async (url: string, method: string, body?: unknown, ok?: string) => {
    setBusy(true)
    const r = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined })
    const d = await r.json().catch(() => ({}))
    setBusy(false)
    if (!r.ok) { flash(d.error || 'Fehler', true); return null }
    if (ok) flash(ok)
    geaendert()
    return d
  }

  /* ── Rang ── */
  const optionen = raenge.filter(r => darfRangGeben(user, rang ?? null, r))
  const darfRang = darf(user, 'raenge.vergeben') && !!rang && optionen.some(o => o.id === rang.id)

  /* ── Minecraft ── */
  const mcZiel = p.key.startsWith('u:') ? (darfKonten ? p.key : null) : p.key.startsWith('cm:') && darfClan ? p.key : null
  const minecraft = async () => {
    if (!mcZiel) return
    const e = window.prompt(`Minecraft-Name oder UUID für ${p.name}${mcZiel.startsWith('u:') && p.uuid ? ' (leer lassen = Verbindung lösen)' : ''}:`, p.mcName ?? '')
    if (e === null || (!e.trim() && !(mcZiel.startsWith('u:') && p.uuid))) return
    await senden('/api/admin2/personen', 'PATCH', { key: mcZiel, minecraft: e.trim() }, e.trim() ? `${p.name} ist jetzt mit Minecraft verbunden` : 'Minecraft-Verbindung gelöst')
  }

  /* ── Clan-Akte ── */
  const [akteForm, setAkteForm] = useState({ beitritt: '', stufe: '', discord: '' })
  useEffect(() => {
    setAkteForm({ beitritt: akte?.beitritt ? String(akte.beitritt).slice(0, 10) : '', stufe: akte?.stufe_override == null ? '' : String(akte.stufe_override), discord: akte?.discord_tag ?? '' })
  }, [akte])
  const [entfernen, setEntfernen] = useState(false)
  const akteSpeichern = () => senden(`/api/admin2/clan-members/${akte!.akteId}`, 'PATCH', {
    ...(akteForm.beitritt ? { join_date: akteForm.beitritt } : {}), stufe_override: akteForm.stufe === '' ? null : Number(akteForm.stufe), discord_tag: akteForm.discord,
  }, 'Clan-Akte gespeichert')
  const aufnehmen = () => mcName && senden('/api/admin2/clan-members', 'POST', { mcName, join_date: new Date().toISOString().slice(0, 10) }, `${p.name} ist jetzt im Clan`)
  const rausnehmen = async (austritt: 'verlassen' | 'geworfen' | 'entfernt') => {
    setEntfernen(false)
    await senden(`/api/admin2/clan-members/${akte!.akteId}?austritt=${austritt}`, 'DELETE', undefined, `${p.name} ist nicht mehr im Clan`)
  }
  const abzeichenUmschalten = (id: string, hat: boolean) =>
    senden('/api/admin2/badges/assign', hat ? 'DELETE' : 'POST', { member_id: akte!.akteId, badge_id: id }, hat ? 'Abzeichen weggenommen' : 'Abzeichen vergeben')

  /* ── Clan-Verlauf ── */
  const [verlauf, setVerlauf] = useState<Eintrag[] | null>(null)
  const [neuEintrag, setNeuEintrag] = useState({ art: 'beigetreten' as Art, zeit: lokal(new Date()), rang: '', notiz: '' })
  const verlaufLaden = useCallback(() => {
    setVerlauf(null)
    fetch(`/api/clan/historie?person=${encodeURIComponent(p.mcName || p.name)}`, { cache: 'no-store' })
      .then(r => r.json()).then(d => setVerlauf(d.betrifft ?? [])).catch(() => setVerlauf([]))
  }, [p.mcName, p.name])
  useEffect(() => { verlaufLaden() }, [verlaufLaden])
  const eintragen = async () => {
    const d = await senden('/api/admin2/clan-historie', 'POST', {
      art: neuEintrag.art, spieler: p.mcName || p.name, von: user?.minecraft_username ?? user?.username, rang: neuEintrag.rang || null,
      notiz: neuEintrag.notiz || null, zeit: new Date(neuEintrag.zeit).toISOString(),
    }, 'Im Verlauf eingetragen')
    if (d) { setNeuEintrag({ art: 'beigetreten', zeit: lokal(new Date()), rang: '', notiz: '' }); verlaufLaden() }
  }

  /* ── Website-Konto ── */
  const [konto, setKonto] = useState<Konto | null>(null)
  const [kontoFehler, setKontoFehler] = useState('')
  const [logins, setLogins] = useState<{ logged_in_at: string; ip_address: string | null }[]>([])
  const [sperrGrund, setSperrGrund] = useState<string | null>(null)
  const [passwort, setPasswort] = useState<string | null>(null)
  const [loeschen, setLoeschen] = useState(false)
  const kontoLaden = useCallback(() => {
    if (!p.userId) { setKonto(null); return }
    setKontoFehler('')
    fetch(`/api/admin2/accounts/${p.userId}`, { cache: 'no-store' }).then(r => r.json())
      .then(d => { setKonto(d.account ?? null); setLogins(d.logins ?? []); if (!d.account) setKontoFehler(d.error || 'Konto konnte nicht geladen werden') })
      .catch(() => setKontoFehler('Konto konnte nicht geladen werden'))
  }, [p.userId])
  useEffect(() => { kontoLaden() }, [kontoLaden])
  const kontoAendern = async (body: Record<string, unknown>, ok: string) => {
    if (await senden(`/api/admin2/accounts/${p.userId}`, 'PATCH', body, ok)) kontoLaden()
  }
  const kontoGeschuetzt = !!konto?.rechte.includes(ALLE_RECHTE) && !user?.rechte.includes(ALLE_RECHTE)

  return (
    <aside className="fixed inset-y-0 right-0 z-[8600] w-full sm:w-[480px] overflow-y-auto shadow-2xl" style={{ background: 'var(--background)', borderLeft: '1px solid var(--card-border)' }}
      role="dialog" aria-label={`Person ${p.name}`}>
      <div className="p-5 space-y-4">
        {/* Kopf */}
        <div className="flex items-start gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`/api/player-heads/${encodeURIComponent(p.mcName || p.name)}/64?v=2`} alt="" className="w-14 h-14 rounded-xl flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <h2 className="text-xl font-bold truncate" style={{ color: 'var(--foreground)' }}>{p.name}</h2>
            <div className="flex flex-wrap gap-1.5 mt-1">
              <RangSchild rang={rang} klein />
              {p.username && <Link href={`/${p.username}`} target="_blank" className="text-[11px] px-1.5 py-0.5 rounded" style={{ background: 'var(--muted-bg)', color: 'var(--muted)' }}>Profil ↗</Link>}
              {akte?.aktiv && <span className="text-[11px] px-1.5 py-0.5 rounded" style={{ background: '#22c55e22', color: '#4ade80' }}>im Clan</span>}
              {akte && !akte.aktiv && <span className="text-[11px] px-1.5 py-0.5 rounded" style={{ background: 'var(--muted-bg)', color: 'var(--muted)' }}>ehemalig</span>}
            </div>
          </div>
          <button onClick={schliessen} className="w-9 h-9 rounded-lg flex-shrink-0 text-lg" style={ghostBtn} aria-label="Schließen">×</button>
        </div>

        {/* Rang */}
        <section style={abschnitt}>
          <p className={titel} style={{ color: 'var(--muted)' }}>Rang</p>
          {darfRang ? (
            <select style={{ ...inp, width: '100%' }} value={p.rangId} disabled={busy}
              onChange={e => senden('/api/admin2/personen', 'POST', { key: p.key, rangId: Number(e.target.value) }, 'Rang gespeichert')}>
              {optionen.map(r => <option key={r.id} value={r.id}>{r.anzeige}{r.nurIngame ? ' (nur im Spiel)' : ''}</option>)}
            </select>
          ) : <RangSchild rang={rang} />}
          <p className="text-[11px] mt-2" style={{ color: 'var(--muted)' }}>
            {p.vergebenVon ? `Vergeben von ${p.vergebenVon} am ${fmtDatum(p.vergebenAm)}. ` : ''}
            {rang?.clan ? 'Steht auf /clan. ' : ''}{rang?.team ? 'Steht auf /team. ' : ''}{rang?.nurIngame ? 'Gilt nur im Spiel. ' : ''}
          </p>
        </section>

        {/* Minecraft */}
        <section style={abschnitt}>
          <p className={titel} style={{ color: 'var(--muted)' }}>Minecraft</p>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm flex-1 min-w-0 truncate" style={{ color: 'var(--foreground)' }}>
              {p.uuid ? <>{p.mcName} <span className="text-[11px]" style={{ color: 'var(--muted)' }}>{p.uuid}</span></> : 'Kein Minecraft-Account verbunden'}
            </span>
            {mcZiel && <button onClick={minecraft} disabled={busy} className="px-3 py-1.5 rounded-lg text-xs" style={ghostBtn}>{p.uuid ? 'Ändern' : 'Zuweisen'}</button>}
          </div>
        </section>

        {/* Clan */}
        <section style={abschnitt}>
          <p className={titel} style={{ color: 'var(--muted)' }}>Clan</p>
          {akte?.akteId ? (
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <label className="text-[11px]" style={{ color: 'var(--muted)' }}>Beitritt
                  <input type="date" style={{ ...inp, width: '100%' }} value={akteForm.beitritt} disabled={!darfClan} onChange={e => setAkteForm(f => ({ ...f, beitritt: e.target.value }))} /></label>
                <label className="text-[11px]" style={{ color: 'var(--muted)' }}>Stufe
                  <select style={{ ...inp, width: '100%' }} value={akteForm.stufe} disabled={!darfClan} onChange={e => setAkteForm(f => ({ ...f, stufe: e.target.value }))}>
                    <option value="">automatisch ({STUFEN[stufeVon(akte.beitritt, null)]?.name})</option>
                    {STUFEN.map((s, i) => <option key={i} value={i}>{s.name}</option>)}
                  </select></label>
              </div>
              <label className="text-[11px] block" style={{ color: 'var(--muted)' }}>Discord
                <input style={{ ...inp, width: '100%' }} value={akteForm.discord} disabled={!darfClan} onChange={e => setAkteForm(f => ({ ...f, discord: e.target.value }))} /></label>
              {darfClan && (
                <div className="flex flex-wrap gap-2 pt-1">
                  <button onClick={akteSpeichern} disabled={busy} className="px-4 py-2 rounded-lg text-xs font-medium text-white" style={gradBtn}>Speichern</button>
                  {akte.aktiv && <button onClick={() => setEntfernen(x => !x)} className="px-3 py-2 rounded-lg text-xs" style={{ ...ghostBtn, color: '#f87171' }}>Aus dem Clan entfernen</button>}
                </div>
              )}
              {entfernen && (
                <div className="grid gap-1.5 pt-1">
                  <p className="text-[11px]" style={{ color: 'var(--muted)' }}>Rang geht zurück auf {std?.anzeige ?? 'den Standard-Rang'}. Was steht im Clan-Verlauf?</p>
                  {([['verlassen', 'Hat den Clan verlassen', '#94a3b8'], ['geworfen', 'Wurde geworfen', '#f87171'], ['entfernt', 'Wurde entfernt (ohne Angabe)', '#fb923c']] as const).map(([a, t, f]) => (
                    <button key={a} onClick={() => rausnehmen(a)} disabled={busy} className="px-3 py-1.5 rounded-lg text-xs text-left" style={{ background: `${f}1a`, color: f, border: `1px solid ${f}55` }}>{t}</button>
                  ))}
                </div>
              )}

              {/* Abzeichen */}
              <p className={`${titel} pt-3`} style={{ color: 'var(--muted)' }}>Abzeichen ({akte.badges.length})</p>
              <div className="flex flex-wrap gap-1.5">
                {abzeichen.filter(b => darfClan || akte.badges.some(x => x.id === b.id)).map(b => {
                  const hat = akte.badges.some(x => x.id === b.id)
                  return (
                    <button key={b.id} disabled={!darfClan || busy} onClick={() => abzeichenUmschalten(b.id, hat)} title={hat ? 'Antippen = wegnehmen' : 'Antippen = vergeben'}
                      className="flex items-center gap-1.5 pl-1 pr-2 py-1 rounded-lg text-[11px]"
                      style={hat ? { background: '#7C3AED22', border: '1px solid #7C3AED66', color: 'var(--foreground)' } : { ...ghostBtn, opacity: 0.55 }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={b.icon_url} alt="" className="w-5 h-5 object-contain" />{b.name}
                    </button>
                  )
                })}
                {!abzeichen.length && <span className="text-[11px]" style={{ color: 'var(--muted)' }}>Noch keine Abzeichen angelegt.</span>}
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm flex-1" style={{ color: 'var(--muted)' }}>{rang?.clan ? 'Hat einen Clan-Rang, aber noch keine Clan-Akte.' : 'Nicht im Clan.'}</span>
              {darfClan && mcName && <button onClick={aufnehmen} disabled={busy} className="px-3 py-1.5 rounded-lg text-xs font-medium text-white" style={gradBtn}>In den Clan aufnehmen</button>}
              {darfClan && !mcName && <span className="text-[11px]" style={{ color: 'var(--muted)' }}>Zum Aufnehmen erst Minecraft zuweisen.</span>}
            </div>
          )}
        </section>

        {/* Clan-Verlauf */}
        <section style={abschnitt}>
          <p className={titel} style={{ color: 'var(--muted)' }}>Clan-Verlauf {verlauf ? `(${verlauf.length})` : ''}</p>
          {!verlauf ? <p className="text-xs" style={{ color: 'var(--muted)' }}>Lädt …</p> : !verlauf.length ? <p className="text-xs" style={{ color: 'var(--muted)' }}>Keine Einträge.</p> : (
            <ul className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
              {verlauf.map(e => (
                <li key={e.id} className="flex gap-2 text-xs">
                  <span className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0" style={{ background: ART_FARBE[e.art] }} />
                  <span className="flex-1" style={{ color: 'var(--foreground)' }}>{satz(e)}{e.notiz && e.art !== 'sonstiges' ? <span style={{ color: 'var(--muted)' }}> · {e.notiz}</span> : null}</span>
                  <span className="flex-shrink-0" style={{ color: 'var(--muted)' }}>{zeitText(e)}</span>
                </li>
              ))}
            </ul>
          )}
          {darfClan && (
            <div className="mt-3 pt-3 grid grid-cols-2 gap-2" style={{ borderTop: '1px solid var(--card-border)' }}>
              <select style={inp} value={neuEintrag.art} onChange={e => setNeuEintrag(n => ({ ...n, art: e.target.value as Art }))}>
                {ARTEN.map(a => <option key={a} value={a}>{ART_NAME[a]}</option>)}
              </select>
              <input type="datetime-local" style={inp} value={neuEintrag.zeit} onChange={e => setNeuEintrag(n => ({ ...n, zeit: e.target.value }))} />
              {(neuEintrag.art === 'befoerdert' || neuEintrag.art === 'degradiert') && (
                <input list="ga-pp-raenge" style={inp} value={neuEintrag.rang} onChange={e => setNeuEintrag(n => ({ ...n, rang: e.target.value }))} placeholder="Rang, z. B. Clan-Moderator" />
              )}
              <datalist id="ga-pp-raenge">{RANG_VORSCHLAEGE.map(r => <option key={r} value={r} />)}</datalist>
              <input style={{ ...inp, gridColumn: neuEintrag.art === 'befoerdert' || neuEintrag.art === 'degradiert' ? undefined : 'span 2' }} value={neuEintrag.notiz} onChange={e => setNeuEintrag(n => ({ ...n, notiz: e.target.value }))} placeholder="Notiz (optional)" />
              <button onClick={eintragen} disabled={busy} className="col-span-2 px-3 py-2 rounded-lg text-xs font-medium" style={ghostBtn}>Im Verlauf eintragen</button>
            </div>
          )}
        </section>

        {/* Website-Konto */}
        <section style={abschnitt}>
          <p className={titel} style={{ color: 'var(--muted)' }}>Website-Konto</p>
          {!p.userId ? <p className="text-xs" style={{ color: 'var(--muted)' }}>Kein Website-Konto. Sobald sich die Person registriert und mit /link verbindet, wird es hier verknüpft.</p> : !konto ? <p className="text-xs" style={{ color: kontoFehler ? '#f87171' : 'var(--muted)' }}>{kontoFehler || 'Lädt …'}</p> : (
            <div className="space-y-3">
              <p className="text-xs" style={{ color: 'var(--muted)' }}>
                {konto.username} · dabei seit {fmtDatum(konto.created_at)}
                {konto.is_banned && <span style={{ color: '#f87171' }}> · gesperrt{konto.banned_reason ? ` („${konto.banned_reason}“)` : ''}</span>}
                {konto.is_deactivated && <span style={{ color: '#f87171' }}> · deaktiviert</span>}
              </p>
              <div>
                <p className="text-[11px] mb-1" style={{ color: 'var(--muted)' }}>Rechte auf der Website (kommen vom Rang)</p>
                {konto.rechte.includes(ALLE_RECHTE) ? <span className="text-xs" style={{ color: 'var(--foreground)' }}>Alle Rechte</span> : (
                  <div className="flex flex-wrap gap-1">
                    {RECHTE.filter(r => konto.rechte.includes(r.key)).map(r => <span key={r.key} title={r.text} className="text-[11px] px-1.5 py-0.5 rounded" style={{ background: '#22c55e1a', color: '#4ade80' }}>{r.name}</span>)}
                    {!RECHTE.some(r => konto.rechte.includes(r.key)) && <span className="text-xs" style={{ color: 'var(--muted)' }}>keine</span>}
                  </div>
                )}
              </div>

              {darfKonten && !kontoGeschuetzt && (
                <div className="space-y-2">
                  <div className="flex flex-wrap gap-2">
                    {konto.is_banned
                      ? <button onClick={() => kontoAendern({ is_banned: false }, 'Entsperrt')} className="px-3 py-1.5 rounded-lg text-xs" style={{ background: '#22c55e22', color: '#4ade80' }}>Entsperren</button>
                      : <button onClick={() => setSperrGrund(g => (g === null ? '' : null))} className="px-3 py-1.5 rounded-lg text-xs" style={{ background: '#ef444422', color: '#f87171' }}>Sperren</button>}
                    <button onClick={() => kontoAendern({ is_deactivated: !konto.is_deactivated }, konto.is_deactivated ? 'Reaktiviert' : 'Deaktiviert')} className="px-3 py-1.5 rounded-lg text-xs" style={ghostBtn}>{konto.is_deactivated ? 'Reaktivieren' : 'Deaktivieren'}</button>
                    <button onClick={() => setPasswort(x => (x === null ? '' : null))} className="px-3 py-1.5 rounded-lg text-xs" style={ghostBtn}>Passwort setzen</button>
                    <button onClick={() => setLoeschen(x => !x)} className="px-3 py-1.5 rounded-lg text-xs" style={{ color: '#f87171' }}>Konto löschen</button>
                  </div>
                  {sperrGrund !== null && (
                    <div className="flex gap-2">
                      <input style={{ ...inp, flex: 1 }} value={sperrGrund} onChange={e => setSperrGrund(e.target.value)} placeholder="Grund für die Sperre" />
                      <button onClick={async () => { await kontoAendern({ is_banned: true, banned_reason: sperrGrund }, 'Gesperrt'); setSperrGrund(null) }} className="px-3 py-1.5 rounded-lg text-xs" style={{ background: '#ef4444', color: '#fff' }}>Sperren</button>
                    </div>
                  )}
                  {passwort !== null && (
                    <div className="flex gap-2">
                      <input type="password" style={{ ...inp, flex: 1 }} value={passwort} onChange={e => setPasswort(e.target.value)} placeholder="Neues Passwort (mind. 8 Zeichen)" />
                      <button disabled={passwort.length < 8} onClick={async () => { await kontoAendern({ new_password: passwort }, 'Passwort gesetzt'); setPasswort(null) }} className="px-3 py-1.5 rounded-lg text-xs text-white disabled:opacity-40" style={gradBtn}>Setzen</button>
                    </div>
                  )}
                  {loeschen && (
                    <div className="p-3 rounded-lg text-xs space-y-2" style={{ background: '#ef444411', border: '1px solid #ef444455', color: 'var(--foreground)' }}>
                      <p>Konto „{konto.username}“ wirklich endgültig löschen? Das kann man nicht rückgängig machen.</p>
                      <button onClick={async () => { if (await senden(`/api/admin2/accounts/${p.userId}`, 'DELETE', undefined, 'Konto gelöscht')) schliessen() }} className="px-3 py-1.5 rounded-lg" style={{ background: '#ef4444', color: '#fff' }}>Endgültig löschen</button>
                    </div>
                  )}
                </div>
              )}
              {kontoGeschuetzt && <p className="text-[11px]" style={{ color: 'var(--muted)' }}>🔒 Konten mit allen Rechten kann nur die Orga ändern.</p>}

              <div>
                <p className="text-[11px] mb-1" style={{ color: 'var(--muted)' }}>Letzte Logins</p>
                {!logins.length ? <p className="text-xs" style={{ color: 'var(--muted)' }}>Noch keine erfasst.</p> : logins.map((l, i) => (
                  <div key={i} className="flex justify-between text-xs py-0.5">
                    <span style={darfKonten ? { color: 'var(--foreground)' } : { color: 'var(--muted)', filter: 'blur(3px)', userSelect: 'none' }}>{darfKonten ? (l.ip_address || 'unbekannte IP') : '•••.•••.•••.•••'}</span>
                    <span style={{ color: 'var(--muted)' }}>{new Date(l.logged_in_at).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' })}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      </div>
    </aside>
  )
}
