'use client'

// Drehbarer 3D-Globus für die Startseite (three.js).
// Zwei Ebenen:
//  1) Grundbild (4096 px): Meer, Gitter, Küstenschimmer, Länder pastellgelb/grau – wird nur neu gezeichnet,
//     wenn sich die freigeschalteten Kontinente ändern.
//  2) Hover-Ebene (2048 px, durchsichtig, eigene Kugel knapp darüber): nur der Kontinent unter der Maus
//     in seiner Farbe + das Land darunter kräftiger. Nur diese kleine Ebene wird beim Überfahren neu gezeichnet.
// Mausbewegungen werden höchstens einmal pro Bild ausgewertet.

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import * as THREE from 'three'
import { geoBounds, geoContains, geoEquirectangular, geoGraticule10, geoPath } from 'd3-geo'
import { loadLayer, type Layer } from '../_lib/scene'
import { BEREICH_BY_KEY, COUNTRY_BY_ID, continentAt } from '../_content/welt'
import type { Bereich } from '../_lib/types'
import Icon from './Icon'

const TEX_W = 4096
const TEX_H = 2048
const HOV_W = 2048
const HOV_H = 1024

type Cont = Exclude<Bereich, 'welt' | 'sprachen'>

export default function Globe({ open, onFail }: { open: Set<Bereich>; onFail: () => void }) {
  const router = useRouter()
  const wrapRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [tip, setTip] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)
  const openRef = useRef(open)
  const redrawRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    openRef.current = open
    redrawRef.current?.()
  }, [open])

  useEffect(() => {
    const wrap = wrapRef.current
    const canvas = canvasRef.current
    if (!wrap || !canvas) return
    let disposed = false
    let renderer: THREE.WebGLRenderer
    try {
      renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' })
    } catch {
      onFail()
      return
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75))
    renderer.outputColorSpace = THREE.SRGBColorSpace

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 100)
    camera.position.set(0, 0, 5.1)

    // ---------- Ebene 1: Grundbild ----------
    const baseCv = document.createElement('canvas')
    baseCv.width = TEX_W
    baseCv.height = TEX_H
    const bctx = baseCv.getContext('2d')!
    const baseTex = new THREE.CanvasTexture(baseCv)
    baseTex.colorSpace = THREE.SRGBColorSpace
    baseTex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy())

    // ---------- Ebene 2: Hover ----------
    const hovCv = document.createElement('canvas')
    hovCv.width = HOV_W
    hovCv.height = HOV_H
    const hctx = hovCv.getContext('2d')!
    const hovTex = new THREE.CanvasTexture(hovCv)
    hovTex.colorSpace = THREE.SRGBColorSpace
    hovTex.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy())

    // Erde als Gruppe: beide Kugeln drehen sich gemeinsam
    const earth = new THREE.Group()
    // Europa nach vorne drehen (Längengrad 15° Ost)
    earth.rotation.y = Math.PI / 2 - ((15 + 180) * Math.PI) / 180
    earth.rotation.x = 0.42
    scene.add(earth)

    const sphereGeo = new THREE.SphereGeometry(1, 128, 96)
    const globe = new THREE.Mesh(
      sphereGeo,
      new THREE.MeshPhongMaterial({ map: baseTex, shininess: 18, specular: new THREE.Color(0x335555) }),
    )
    earth.add(globe)

    const hover = new THREE.Mesh(
      sphereGeo,
      new THREE.MeshPhongMaterial({ map: hovTex, transparent: true, depthWrite: false, shininess: 18, specular: new THREE.Color(0x335555) }),
    )
    hover.scale.setScalar(1.0015)
    hover.visible = false
    earth.add(hover)

    // Atmosphäre: weicher Lichtsaum am Rand (Fresnel)
    const atmo = new THREE.Mesh(
      new THREE.SphereGeometry(1.16, 64, 48),
      new THREE.ShaderMaterial({
        uniforms: { c: { value: new THREE.Color(0x7fd6e0) } },
        vertexShader: 'varying vec3 vN; void main(){ vN = normalize(normalMatrix * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
        fragmentShader: 'uniform vec3 c; varying vec3 vN; void main(){ float d = dot(vN, vec3(0.0, 0.0, 1.0)); float f = pow(max(0.0, 0.62 - d), 3.0) * (1.0 - smoothstep(0.44, 0.56, -d)); gl_FragColor = vec4(c, 1.0) * f * 0.75; }',
        side: THREE.BackSide, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      }),
    )
    scene.add(atmo)

    scene.add(new THREE.AmbientLight(0xffffff, 1.55))
    const sun = new THREE.DirectionalLight(0xfff4e0, 1.35)
    sun.position.set(-3, 2.4, 4)
    scene.add(sun)

    // ---------- Daten ----------
    let world: Layer | null = null
    let boxes: { id: string; b: [[number, number], [number, number]] }[] = []
    // Kontinent je Land (Russland etc. werden je nach Längengrad geteilt → Teilflächen einzeln prüfen)
    let featCont: { f: Layer['f'][number]; cont: Cont | null }[] = []
    let hoverCont: Cont | null = null
    let hoverId: string | null = null

    const baseProj = geoEquirectangular().scale(TEX_W / (2 * Math.PI)).translate([TEX_W / 2, TEX_H / 2])
    const basePath = geoPath(baseProj, bctx)
    const hovProj = geoEquirectangular().scale(HOV_W / (2 * Math.PI)).translate([HOV_W / 2, HOV_H / 2])
    const hovPath = geoPath(hovProj, hctx)

    // Meer + Gitter + Küstenschimmer ändern sich nie → einmal vorzeichnen (der Weichzeichner ist teuer)
    let sea: HTMLCanvasElement | null = null
    function drawSea() {
      const c = document.createElement('canvas')
      c.width = TEX_W; c.height = TEX_H
      const b = c.getContext('2d')!
      const bp = geoPath(baseProj, b)
      const g = b.createLinearGradient(0, 0, 0, TEX_H)
      g.addColorStop(0, '#16455e'); g.addColorStop(0.3, '#23788f'); g.addColorStop(0.5, '#2b8a9e'); g.addColorStop(0.7, '#23788f'); g.addColorStop(1, '#16455e')
      b.fillStyle = g
      b.fillRect(0, 0, TEX_W, TEX_H)
      b.beginPath(); bp(geoGraticule10()); b.strokeStyle = 'rgba(255,255,255,0.09)'; b.lineWidth = 1.4; b.stroke()
      if (world) {
        b.filter = 'blur(10px)'
        b.beginPath()
        for (const f of world.f) bp(f.g as never)
        b.fillStyle = 'rgba(200, 250, 255, 0.28)'
        b.fill()
        b.filter = 'none'
      }
      sea = c
    }

    // Grundbild: nur beim Laden und wenn sich die freigeschalteten Kontinente ändern
    function drawBase() {
      if (!sea) drawSea()
      bctx.drawImage(sea!, 0, 0)
      if (world) {
        // Erst alle Flächen, dann alle Grenzen (so überdecken Flächen keine Nachbargrenzen)
        for (const { f, cont } of featCont) {
          const on = !!cont && openRef.current.has(cont)
          bctx.beginPath(); basePath(f.g as never)
          bctx.globalAlpha = on ? 1 : 0.7
          bctx.fillStyle = on ? '#f3e6bd' : '#9fb0a6'
          bctx.fill()
        }
        bctx.globalAlpha = 1
        bctx.lineWidth = 1.3
        for (const { f, cont } of featCont) {
          const on = !!cont && openRef.current.has(cont)
          bctx.beginPath(); basePath(f.g as never)
          bctx.strokeStyle = on ? 'rgba(130,95,35,0.5)' : 'rgba(255,255,255,0.35)'
          bctx.stroke()
        }
      }
      baseTex.needsUpdate = true
      drawHover()
    }

    // Hover-Ebene: nur Kontinent + Land unter der Maus
    function drawHover() {
      hctx.clearRect(0, 0, HOV_W, HOV_H)
      if (!world || !hoverCont) {
        hover.visible = false
        return
      }
      const on = openRef.current.has(hoverCont)
      const col = BEREICH_BY_KEY[hoverCont].color
      hctx.fillStyle = col
      hctx.lineJoin = 'round'
      for (const { f, cont } of featCont) {
        if (cont !== hoverCont) continue
        const isCountry = f.i === hoverId
        hctx.beginPath(); hovPath(f.g as never)
        hctx.globalAlpha = isCountry ? (on ? 1 : 0.85) : (on ? 0.72 : 0.45)
        hctx.fill()
        hctx.globalAlpha = 1
        hctx.strokeStyle = 'rgba(255,255,255,0.55)'
        hctx.lineWidth = 0.8
        hctx.stroke()
      }
      // Umriss des Landes unter der Maus zuletzt, damit Nachbargrenzen ihn nicht überdecken
      if (hoverId && world.byId[hoverId]) {
        hctx.beginPath(); hovPath(world.byId[hoverId].g as never)
        hctx.strokeStyle = 'rgba(255,255,255,0.95)'; hctx.lineWidth = 1.5; hctx.stroke()
      }
      hovTex.needsUpdate = true
      hover.visible = true
    }

    redrawRef.current = drawBase
    drawBase()

    loadLayer('world').then(l => {
      if (disposed) return
      world = l
      sea = null
      boxes = l.f.filter(f => f.i !== 'ATA').map(f => ({ id: f.i, b: geoBounds(f.g as never) as [[number, number], [number, number]] }))
      featCont = l.f.map(f => ({ f, cont: f.i === 'ATA' ? null : (continentAt(f.i, f.c?.[0] ?? 0) as Cont | null) }))
      drawBase()
    }).catch(() => {})

    function countryAt(lon: number, lat: number): string | null {
      if (!world) return null
      for (const { id, b } of boxes) {
        const [[w, s], [e, n]] = b
        if (lat < s || lat > n) continue
        if (w <= e ? lon < w || lon > e : lon < w && lon > e) continue
        if (geoContains(world.byId[id].g as never, [lon, lat])) return id
      }
      return null
    }

    // ---------- Größe ----------
    const resize = () => {
      const r = wrap.getBoundingClientRect()
      const size = Math.max(10, Math.min(r.width, r.height))
      renderer.setSize(size, size, false)
      camera.aspect = 1
      camera.updateProjectionMatrix()
    }
    const ro = new ResizeObserver(resize)
    ro.observe(wrap)
    resize()

    // ---------- Steuerung ----------
    const raycaster = new THREE.Raycaster()
    const ndc = new THREE.Vector2()
    let down: { x: number; y: number; moved: boolean } | null = null
    let last = { x: 0, y: 0 }
    let velocity = 0
    let idleAt = 0
    let pendingHover: { x: number; y: number } | null = null
    let lastTip: string | null = null
    let lastCursor = ''

    const lonLatAt = (cx: number, cy: number): [number, number] | null => {
      const r = canvas.getBoundingClientRect()
      ndc.set(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1)
      raycaster.setFromCamera(ndc, camera)
      const hit = raycaster.intersectObject(globe, false)[0]
      if (!hit?.uv) return null
      return [hit.uv.x * 360 - 180, hit.uv.y * 180 - 90]
    }

    const setHover = (cont: Cont | null, id: string | null) => {
      if (cont === hoverCont && id === hoverId) return
      hoverCont = cont; hoverId = id
      drawHover()
    }
    const showTip = (t: string | null) => {
      if (t === lastTip) return
      lastTip = t
      setTip(t)
    }
    const setCursor = (c: string) => {
      if (c === lastCursor) return
      lastCursor = c
      canvas.style.cursor = c
    }

    // Wird höchstens einmal pro Bild aufgerufen
    function processHover() {
      if (!pendingHover) return
      const { x, y } = pendingHover
      pendingHover = null
      const ll = lonLatAt(x, y)
      const id = ll ? countryAt(ll[0], ll[1]) : null
      const cont = id ? (continentAt(id, ll![0]) as Cont | null) : null
      setHover(cont, cont ? id : null)
      setCursor(cont ? 'pointer' : 'grab')
      showTip(id && cont ? `${COUNTRY_BY_ID[id]?.name ?? ''}${COUNTRY_BY_ID[id] ? ' · ' : ''}${BEREICH_BY_KEY[cont].name}${openRef.current.has(cont) ? '' : ' (bald)'}` : null)
      if (id) idleAt = performance.now()
    }

    const onDown = (e: PointerEvent) => {
      down = { x: e.clientX, y: e.clientY, moved: false }
      last = { x: e.clientX, y: e.clientY }
      velocity = 0
    }
    const onMove = (e: PointerEvent) => {
      if (down) {
        const dx = e.clientX - last.x, dy = e.clientY - last.y
        if (!down.moved && Math.hypot(e.clientX - down.x, e.clientY - down.y) > 5) {
          down.moved = true
          setDragging(true)
          canvas.setPointerCapture(e.pointerId)
          setHover(null, null)
          showTip(null)
        }
        if (down.moved) {
          earth.rotation.y += dx * 0.006
          earth.rotation.x = Math.max(-1.1, Math.min(1.1, earth.rotation.x + dy * 0.004))
          velocity = dx * 0.006
          idleAt = performance.now()
        }
        last = { x: e.clientX, y: e.clientY }
        return
      }
      pendingHover = { x: e.clientX, y: e.clientY }
    }
    const onUp = (e: PointerEvent) => {
      const wasDrag = down?.moved
      down = null
      setDragging(false)
      if (wasDrag) return
      const ll = lonLatAt(e.clientX, e.clientY)
      const id = ll ? countryAt(ll[0], ll[1]) : null
      const cont = id ? continentAt(id, ll![0]) : null
      if (cont) router.push(`/geo/${cont}`)
    }
    const onLeave = () => {
      pendingHover = null
      setHover(null, null)
      showTip(null)
    }
    canvas.addEventListener('pointerdown', onDown)
    canvas.addEventListener('pointermove', onMove, { passive: true })
    canvas.addEventListener('pointerup', onUp)
    canvas.addEventListener('pointerleave', onLeave)

    // ---------- Schleife (pausiert, wenn der Globus nicht sichtbar ist) ----------
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let raf = 0
    let inView = true
    const tick = () => {
      raf = 0
      if (disposed || !inView || document.hidden) return
      const idle = performance.now() - idleAt > 2500
      if (!down) {
        processHover()
        if (Math.abs(velocity) > 0.0002) { earth.rotation.y += velocity; velocity *= 0.94 }
        else if (idle && !reduce) earth.rotation.y += 0.0012
        // Dreht sich der Globus unter einer ruhenden Maus weiter, Treffer gelegentlich neu prüfen
        if (hoverCont && lastPointer && idle) pendingHover = lastPointer
      }
      renderer.render(scene, camera)
      raf = requestAnimationFrame(tick)
    }
    let lastPointer: { x: number; y: number } | null = null
    const trackPointer = (e: PointerEvent) => { lastPointer = { x: e.clientX, y: e.clientY } }
    const clearPointer = () => { lastPointer = null }
    canvas.addEventListener('pointermove', trackPointer, { passive: true })
    canvas.addEventListener('pointerleave', clearPointer)
    const start = () => { if (!raf && !disposed) raf = requestAnimationFrame(tick) }

    const io = new IntersectionObserver(entries => {
      inView = entries.some(en => en.isIntersecting)
      if (inView) start()
    })
    io.observe(wrap)
    const onVis = () => { if (!document.hidden) start() }
    document.addEventListener('visibilitychange', onVis)
    start()

    return () => {
      disposed = true
      if (raf) cancelAnimationFrame(raf)
      ro.disconnect()
      io.disconnect()
      document.removeEventListener('visibilitychange', onVis)
      canvas.removeEventListener('pointerdown', onDown)
      canvas.removeEventListener('pointermove', onMove)
      canvas.removeEventListener('pointermove', trackPointer)
      canvas.removeEventListener('pointerup', onUp)
      canvas.removeEventListener('pointerleave', onLeave)
      canvas.removeEventListener('pointerleave', clearPointer)
      baseTex.dispose()
      hovTex.dispose()
      sphereGeo.dispose()
      atmo.geometry.dispose()
      ;(atmo.material as THREE.Material).dispose()
      ;(globe.material as THREE.Material).dispose()
      ;(hover.material as THREE.Material).dispose()
      renderer.dispose()
      redrawRef.current = null
    }
  }, [router, onFail])

  return (
    <div ref={wrapRef} className="ga-hero-globe">
      <canvas ref={canvasRef} className={`ga-globe-canvas ${dragging ? 'dragging' : ''}`} aria-label="3D-Globus – Kontinent anklicken" role="img" />
      <div className="ga-globe-hint"><Icon name="pointer" size={13} /> Drehen &amp; Kontinent antippen</div>
      {tip && <div className="ga-globe-tip">{tip}</div>}
    </div>
  )
}