/* Service Worker für den privaten Bereich (seekclan.de/private).
   Einzige Aufgabe: Push-Benachrichtigungen anzeigen (Wecker, Timer, Reminder,
   Termine, neue Quick-Share-Dateien) – auch wenn die Seite geschlossen ist.
   Er fängt KEINE Seitenaufrufe ab, verändert also nichts am Rest der Website. */

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()))

self.addEventListener('push', event => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch (e) {
    data = { title: 'Privat', body: event.data ? event.data.text() : '' }
  }

  const urgent = !!data.urgent
  const options = {
    body: data.body || '',
    icon: '/private-icon-192.png',
    badge: '/private-icon-192.png',
    tag: data.tag || undefined,
    renotify: !!data.tag,
    data: { url: data.url || '/private', kind: data.kind || 'system' },
    // Wecker/Timer bleiben stehen, bis man sie wegtippt, und vibrieren kräftiger
    requireInteraction: urgent,
    vibrate: urgent ? [400, 200, 400, 200, 400, 200, 400] : [120, 60, 120],
    actions: urgent ? [{ action: 'open', title: 'Öffnen' }] : [],
  }

  event.waitUntil((async () => {
    await self.registration.showNotification(data.title || 'Privat', options)
    // Offene Seiten informieren (Glocke sofort aktualisieren, Wecker in der Seite klingeln lassen)
    const clientsList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    for (const c of clientsList) c.postMessage({ type: 'pv-push', payload: data })
  })())
})

self.addEventListener('notificationclick', event => {
  event.notification.close()
  const url = (event.notification.data && event.notification.data.url) || '/private'
  event.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    for (const c of all) {
      if (c.url.includes('/private') && 'focus' in c) {
        await c.focus()
        if ('navigate' in c) {
          try { await c.navigate(url) } catch (e) { /* egal */ }
        }
        return
      }
    }
    await self.clients.openWindow(url)
  })())
})