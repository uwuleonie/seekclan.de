// Erzeugt von scripts/geo/build-gg-af.mjs – nicht von Hand ändern.
export const GG_AF_COUNTS: Record<string, number> = {
  "gg-af-hinweise": 476,
  "gg-af-google-auto": 64,
  "gg-af-strasse": 97,
  "gg-af-landschaft": 233,
  "gg-af-rate-das-land": 79,
  "gg-af-vorwahlen": 14,
  "gg-af-domains": 14,
  "gg-af-regionen-south-africa": 30,
  "gg-af-regionen-namibia": 44,
  "gg-af-regionen-botswana": 16,
  "gg-af-regionen-lesotho": 10,
  "gg-af-regionen-eswatini": 10,
  "gg-af-regionen-kenya": 24,
  "gg-af-regionen-uganda": 23,
  "gg-af-regionen-rwanda": 12,
  "gg-af-regionen-nigeria": 14,
  "gg-af-regionen-ghana": 19,
  "gg-af-regionen-senegal": 19,
  "gg-af-regionen-madagascar": 28,
  "gg-af-regionen-reunion": 8,
  "gg-af-regionen-tunisia": 15,
  "gg-af-fahrseite-karte": 14,
  "gg-af-randlinie-karte": 11,
  "gg-af-mittellinie-karte": 10,
  "gg-af-kennzeichen-karte": 13,
  "gg-af-sprache-karte": 14
}

/** Länder mit Steckbrief: [slug, Name, Flagge, Gruppe] */
export const GG_AF_LAENDER: [string, string, string, string][] = [["south-africa","Südafrika","za","sued"],["namibia","Namibia","na","sued"],["botswana","Botswana","bw","sued"],["lesotho","Lesotho","ls","sued"],["eswatini","Eswatini","sz","sued"],["kenya","Kenia","ke","ost"],["uganda","Uganda","ug","ost"],["rwanda","Ruanda","rw","ost"],["nigeria","Nigeria","ng","west"],["ghana","Ghana","gh","west"],["senegal","Senegal","sn","west"],["madagascar","Madagaskar","mg","inseln"],["reunion","Réunion","fr","inseln"],["tunisia","Tunesien","tn","nord"]]

/** Regionen-Decks: [slug, Land-slug, Name] */
export const GG_AF_REGIONEN: [string, string, string, string][] = [["gg-af-regionen-south-africa","south-africa","Südafrika","ZAF"],["gg-af-regionen-namibia","namibia","Namibia","NAM"],["gg-af-regionen-botswana","botswana","Botswana","BWA"],["gg-af-regionen-lesotho","lesotho","Lesotho","LSO"],["gg-af-regionen-eswatini","eswatini","Eswatini","SWZ"],["gg-af-regionen-kenya","kenya","Kenia","KEN"],["gg-af-regionen-uganda","uganda","Uganda","UGA"],["gg-af-regionen-rwanda","rwanda","Ruanda","RWA"],["gg-af-regionen-nigeria","nigeria","Nigeria","NGA"],["gg-af-regionen-ghana","ghana","Ghana","GHA"],["gg-af-regionen-senegal","senegal","Senegal","SEN"],["gg-af-regionen-madagascar","madagascar","Madagaskar","MDG"],["gg-af-regionen-reunion","reunion","Réunion","REU"],["gg-af-regionen-tunisia","tunisia","Tunesien","TUN"]]

/** Farben der Merkmals-Karten */
export const GG_AF_MERKMAL_GROUPS: Record<string, Record<string, { name: string; color: string }>> = {
  "gg-af-fahrseite-karte": {
    "links": {
      "name": "links",
      "color": "#e07a5f"
    },
    "rechts": {
      "name": "rechts",
      "color": "#5b9bd5"
    }
  },
  "gg-af-randlinie-karte": {
    "gelb": {
      "name": "gelb",
      "color": "#f2c230"
    },
    "wei": {
      "name": "weiß",
      "color": "#e8e4da"
    }
  },
  "gg-af-mittellinie-karte": {
    "wei": {
      "name": "weiß",
      "color": "#e8e4da"
    },
    "gelb": {
      "name": "gelb",
      "color": "#f2c230"
    }
  },
  "gg-af-kennzeichen-karte": {
    "wei": {
      "name": "weiß",
      "color": "#e8e4da"
    },
    "gelb": {
      "name": "gelb",
      "color": "#f2c230"
    },
    "gelb-hinten": {
      "name": "vorne weiß, hinten gelb",
      "color": "#c9c37a"
    },
    "blau": {
      "name": "blau",
      "color": "#3d74d0"
    },
    "schwarz": {
      "name": "schwarz",
      "color": "#555555"
    },
    "gemischt": {
      "name": "gemischt",
      "color": "#9a8fb5"
    }
  },
  "gg-af-sprache-karte": {
    "englisch": {
      "name": "Englisch",
      "color": "#c9637a"
    },
    "franzosisch": {
      "name": "Französisch",
      "color": "#3d74d0"
    },
    "arabisch": {
      "name": "Arabisch (+ Französisch)",
      "color": "#5fb07a"
    }
  }
}