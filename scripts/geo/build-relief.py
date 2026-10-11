# Baut die Reliefkarte für die physischen Karten von seekclan.de/geo.
#
# Nur für Entwicklung – wird NICHT beim normalen `npm run build` ausgeführt.
# Ergebnis liegt fertig im Repo: public/geo/relief/*.webp
#
# Quellen (beide gemeinfrei):
#   Natural Earth "Cross Blended Hypsometric Tints with Shaded Relief, Ocean Bottom and Drainages" 1:10m (HYP_HR_SR_OB_DR.tif, 21600 × 10800)
#     https://www.naturalearthdata.com/downloads/10m-raster-data/10m-cross-blend-hypso/
#   Natural Earth Land 1:10m (ne_10m_land.geojson) – damit das Meer im Relief mit Landfarbe aufgefüllt wird.
#     Sonst entstehen helle Säume, wo die (gröberen) Länderflächen der Karte etwas weiter ins Meer reichen als das Relief.
# Benötigt: Python 3 mit Pillow, numpy und scipy  (pip install pillow numpy scipy)
#
# Aufruf:  python scripts/geo/build-relief.py <HYP_HR_SR_OB_DR.tif> <ne_10m_land.geojson>
#
# Ausgabe (Plattkarte, Länge -180…180, Breite 90…-90):
#   z0.webp                     2048 × 1024  – ganze Welt (für Weltkarten)
#   z1-<zeile>-<spalte>.webp    8 × 4 Kacheln à 1350 × 1350 – halbe Auflösung (Kontinente, Länder)
#   z2-<zeile>-<spalte>.webp    16 × 8 Kacheln à 1350 × 1350 – volle Auflösung (Zoom, kleine Länder)

import json
import os
import sys

import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage

Image.MAX_IMAGE_PIXELS = None

src = sys.argv[1] if len(sys.argv) > 1 else 'HYP_HR_SR_OB_DR.tif'
land_file = sys.argv[2] if len(sys.argv) > 2 else 'ne_10m_land.geojson'
here = os.path.dirname(os.path.abspath(__file__))
out = os.path.join(here, '..', '..', 'public', 'geo', 'relief')
os.makedirs(out, exist_ok=True)

im = Image.open(src).convert('RGB')
W, H = im.size
T = 1350
assert (W, H) == (16 * T, 8 * T), f'Erwartet 21600 × 10800, bekommen {W} × {H}'
print(f'Quelle {W} × {H}')

# Farben wärmer machen: das kühle Grün-Türkis der Vorlage Richtung Oliv/Sand schieben,
# damit sich das Land klar vom türkisen Meer abhebt. Schattierung und Höhenstufen bleiben erhalten.
BEIGE = np.array([0xF3, 0xE6, 0xBD], dtype=np.float32) / 255
FACTOR = BEIGE / BEIGE.mean() * 1.02

# Landmaske in voller Auflösung
mask = Image.new('L', (W, H), 0)
draw = ImageDraw.Draw(mask)
to_px = lambda ring: [((x + 180) / 360 * W, (90 - y) / 180 * H) for x, y in ring]
for f in json.load(open(land_file))['features']:
    g = f['geometry']
    for poly in (g['coordinates'] if g['type'] == 'MultiPolygon' else [g['coordinates']]):
        draw.polygon(to_px(poly[0]), fill=255)
        for hole in poly[1:]:
            draw.polygon(to_px(hole), fill=0)
LAND = np.asarray(mask) > 127
print('  Landmaske fertig')

MG = 200  # Rand aus den Nachbarkacheln, damit an Kachelgrenzen keine Kanten entstehen


def region(r, c):
    """Kachel samt Rand: Bild (warm gefärbt) und Landmaske"""
    y0, x0 = r * T - MG, c * T - MG
    ys = slice(max(0, y0), min(H, y0 + T + 2 * MG))
    img = np.zeros((T + 2 * MG, T + 2 * MG, 3), np.float32)
    lm = np.zeros((T + 2 * MG, T + 2 * MG), bool)
    xs = [(x0 + i) % W for i in range(T + 2 * MG)]  # über die Datumsgrenze weiterlaufen
    part = np.asarray(im.crop((0, ys.start, W, ys.stop)), dtype=np.float32)[:, xs]
    lmp = LAND[ys, :][:, xs]
    oy = ys.start - y0
    img[oy:oy + part.shape[0]] = part
    lm[oy:oy + lmp.shape[0]] = lmp
    return np.clip(img / 255 * FACTOR, 0, 1) * 255, lm


for r in range(8):
    for c in range(16):
        img, lm = region(r, c)
        if lm.any():
            # Meer mit der Farbe des nächsten Landpunkts füllen und leicht weichzeichnen
            ocean = ~lm
            _, (iy, ix) = ndimage.distance_transform_edt(ocean, return_indices=True)
            filled = img[iy, ix]
            blur = np.stack([ndimage.gaussian_filter(filled[..., k], 3) for k in range(3)], -1)
            img[ocean] = blur[ocean]
        Image.fromarray((img[MG:MG + T, MG:MG + T] + 0.5).astype(np.uint8)).save(os.path.join(out, f'z2-{r}-{c}.webp'), quality=78, method=6)
    print(f'  z2 Zeile {r + 1}/8')

# z1 und z0 aus den fertigen z2-Kacheln
z1 = Image.new('RGB', (8 * T, 4 * T))
for r in range(4):
    for c in range(8):
        m = Image.new('RGB', (2 * T, 2 * T))
        for a in range(2):
            for b in range(2):
                m.paste(Image.open(os.path.join(out, f'z2-{2 * r + a}-{2 * c + b}.webp')).convert('RGB'), (b * T, a * T))
        t = m.resize((T, T), Image.LANCZOS)
        t.save(os.path.join(out, f'z1-{r}-{c}.webp'), quality=80, method=6)
        z1.paste(t, (c * T, r * T))
    print(f'  z1 Zeile {r + 1}/4')
z1.resize((2048, 1024), Image.LANCZOS).save(os.path.join(out, 'z0.webp'), quality=80, method=6)

total = sum(os.path.getsize(os.path.join(out, f)) for f in os.listdir(out))
print(f'fertig – {len(os.listdir(out))} Dateien, {total // 1024} KB')