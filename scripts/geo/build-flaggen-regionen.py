# Ordnet Regionsflaggen aus Wikidata den Flächen der Karten-Ebenen zu.
#
# Nur für Entwicklung – wird NICHT beim normalen `npm run build` ausgeführt.
#
# Ablauf:
#  1. Im Browser (query.wikidata.org ist vom Server aus oft gesperrt) diese Abfrage ausführen und als wd.json speichern
#     – Liste aus {code, flag, coord, de, en}:
#       SELECT ?code ?flag ?coord ?lde ?len WHERE {
#         ?it wdt:P300 ?code; wdt:P41 ?flag.
#         FILTER(REGEX(?code, "^(DE|AT|CH|PL|CZ|SK|HU|NL|BE|IT|ES|FR|GB|NO|SE|FI|DK|PT|HR|EE|LT|LV|RO|BG|GR|SI|RS|UA|BY|AL|IE|IS)-[A-Z0-9]{1,3}$"))
#         FILTER NOT EXISTS { ?it wdt:P576 ?end }
#         OPTIONAL { ?it wdt:P625 ?coord }
#         OPTIONAL { ?it rdfs:label ?lde FILTER(LANG(?lde)="de") }
#         OPTIONAL { ?it rdfs:label ?len FILTER(LANG(?len)="en") }
#       }
#  2. python3 scripts/geo/build-flaggen-regionen.py wd.json
#     → scripts/geo/flaggen-regionen.json  (Fläche "ebene:id" → ISO-3166-2-Code)
#     Zuordnung: Die Koordinate des Wikidata-Eintrags liegt in der Fläche (sonst die nächste Fläche bis 0,6°).
#  3. Für jeden Code das Vorschaubild (200 px) von Wikimedia Commons laden (API: action=query&prop=imageinfo&iiurlwidth=200),
#     im Browser als WebP (Qualität 0,8) speichern → public/geo/flags-regions.json  {"r:<code>": "data:image/webp;base64,…"}
#  4. node scripts/geo/build-europa-extra.mjs
#
# Quelle der Flaggen: Wikimedia Commons (überwiegend gemeinfrei, Hoheitszeichen).
# Benötigt: pip install shapely

import json, re, sys, os
from shapely.geometry import shape, Point

here = os.path.dirname(os.path.abspath(__file__))
L = os.path.join(here, '../../public/geo/layers/')
HU = 'BK BA BE BZ CS FE GS HB HE JN KE NO PE SO SZ TO VA VE ZA BU'.split()
ES = 'AN AR AS CN CB CL CM CT EX GA IB RI MD MC NC PV VC CE ML'.split()
# Land → (Ebene, erlaubte Codes der passenden Ebene, ohne Unterebenen wie Provinzen oder Städte)
M = {
  'DE': ('adm1-DEU', r'[A-Z]{2}'), 'AT': ('adm1-AUT', r'\d'), 'CH': ('eu-ch-kantone', r'[A-Z]{2}'), 'PL': ('eu-pl-woiwodschaften', r'\d\d'),
  'CZ': ('eu-cz-regionen', r'\d\d'), 'SK': ('eu-sk-regionen', r'[A-Z]{2}'), 'HU': ('eu-hu-komitate', '|'.join(HU)),
  'NL': ('nl-provinzen', r'[A-Z]{2}'), 'BE': ('eu-be-provinzen', r'VAN|VBR|VLI|VOV|VWV|WBR|WHT|WLG|WLX|WNA|BRU'), 'IT': ('it-regionen', r'\d\d'),
  'ES': ('es-regionen', '|'.join(ES)), 'FR': ('fr-regionen', r'[A-Z]{3}'), 'GB': ('uk-laender', 'ENG|SCT|WLS|NIR'), 'NO': ('no-fylker', r'(?!2[12])\d\d'),
  'SE': ('eu-se-provinzen', r'[A-Z]{1,2}'), 'FI': ('eu-fi-landschaften', r'\d\d'), 'DK': ('eu-dk-regionen', r'\d\d'), 'HR': ('eu-hr-gespanschaften', r'\d\d'),
  'EE': ('eu-ee-kreise', r'\d\d'), 'LT': ('eu-lt-bezirke', r'[A-Z]{2}'), 'UA': ('eu-ua-oblaste', r'\d\d'), 'BY': ('eu-by-woblasze', r'[A-Z]{2}'), 'AL': ('eu-al-qarqe', r'\d\d'),
}
# Von Hand: Korsika hat in Wikidata keine Koordinate am ISO-Eintrag
EXTRA = {'fr-regionen:corse': 'FR-20R'}

wd = json.load(open(sys.argv[1] if len(sys.argv) > 1 else 'wd.json'))
byc = {}
for w in wd:
    if w.get('coord'):
        byc.setdefault(w['code'], w)
out = {}
for cc, (lay, rx) in M.items():
    feats = [(f['i'], shape(f['g'])) for f in json.load(open(L + lay + '.json'))['f']]
    pts = [(w, Point(*map(float, re.findall(r'[-\d.]+', w['coord'])[:2]))) for c, w in byc.items() if re.fullmatch(cc + '-(?:' + rx + ')', c)]
    used = set()
    res = {}
    for i, g in feats:
        hit = [w for w, p in pts if g.contains(p) and w['code'] not in used]
        if hit:
            res[i] = hit[0]['code']; used.add(hit[0]['code'])
    for i, g in feats:
        if i in res:
            continue
        best = sorted(((g.distance(p), w['code']) for w, p in pts if w['code'] not in used))
        if best and best[0][0] < 0.6:
            res[i] = best[0][1]; used.add(best[0][1])
    for i, c in res.items():
        out[f'{lay}:{i}'] = c
    print(lay, len(feats), 'Treffer', len(res), 'ohne Flagge', [i for i, _ in feats if i not in res])
out.update(EXTRA)
json.dump(out, open(os.path.join(here, 'flaggen-regionen.json'), 'w'), indent=0)
print(len(out), 'Flächen mit Flagge')