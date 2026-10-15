// Erzeugt von scripts/geo/build-suedamerika.mjs – nicht von Hand bearbeiten.

export const SA_COUNTS: Record<string, number> = {
  "ar-provinzen": 24,
  "bo-departamentos": 9,
  "cl-regionen": 16,
  "co-departamentos": 33,
  "ec-provinzen": 24,
  "py-departamentos": 18,
  "pe-regionen": 26,
  "uy-departamentos": 19,
  "ve-staaten": 25,
  "gy-sr-regionen": 20,
  "arg-staedte-leicht": 10,
  "arg-staedte-mittel": 25,
  "arg-staedte-schwer": 60,
  "arg-staedte-sehr-schwer": 157,
  "bra-staedte-leicht": 15,
  "bra-staedte-mittel": 40,
  "bra-staedte-schwer": 100,
  "bra-staedte-sehr-schwer": 388,
  "chl-staedte-leicht": 10,
  "chl-staedte-mittel": 25,
  "chl-staedte-schwer": 50,
  "chl-staedte-sehr-schwer": 84,
  "col-staedte-leicht": 10,
  "col-staedte-mittel": 25,
  "col-staedte-schwer": 45,
  "col-staedte-sehr-schwer": 72,
  "per-staedte-leicht": 10,
  "per-staedte-mittel": 25,
  "per-staedte-schwer": 50,
  "per-staedte-sehr-schwer": 89,
  "bol-staedte-leicht": 8,
  "bol-staedte-mittel": 20,
  "bol-staedte-schwer": 40,
  "bol-staedte-sehr-schwer": 69,
  "ven-staedte-leicht": 10,
  "ven-staedte-mittel": 25,
  "ven-staedte-schwer": 50,
  "ecu-staedte-leicht": 10,
  "ecu-staedte-sehr-schwer": 37,
  "pry-staedte-leicht": 10,
  "pry-staedte-sehr-schwer": 37,
  "ury-staedte-leicht": 10,
  "ury-staedte-sehr-schwer": 32,
  "sa-fluesse-leicht": 27,
  "sa-fluesse-mittel": 48,
  "sa-fluesse-schwer": 125,
  "sa-seen": 45,
  "sa-gebirge": 32,
  "sa-landschaften": 16,
  "sa-inseln": 10,
  "sa-gipfel-leicht": 22,
  "sa-gipfel": 65,
  "sa-flughaefen-gross": 87,
  "sa-flughaefen": 276,
  "sa-haefen": 83,
  "sa-sprachen": 13,
  "cl-klima": 16,
  "cl-vorwahlen": 16
}

/** Städte-Stufen je Land: [slug, Anzahl, Schwierigkeit, Titel-Zusatz] */
export const SA_STAEDTE: Record<string, { slug: string; n: number; diff: string; title: string }[]> = {
  "ARG": [
    {
      "slug": "arg-staedte-leicht",
      "n": 10,
      "diff": "leicht",
      "title": "die größten"
    },
    {
      "slug": "arg-staedte-mittel",
      "n": 25,
      "diff": "mittel",
      "title": "große Städte"
    },
    {
      "slug": "arg-staedte-schwer",
      "n": 60,
      "diff": "schwer",
      "title": "viele Städte"
    },
    {
      "slug": "arg-staedte-sehr-schwer",
      "n": 157,
      "diff": "sehr-schwer",
      "title": "alle Städte"
    }
  ],
  "BRA": [
    {
      "slug": "bra-staedte-leicht",
      "n": 15,
      "diff": "leicht",
      "title": "die größten"
    },
    {
      "slug": "bra-staedte-mittel",
      "n": 40,
      "diff": "mittel",
      "title": "große Städte"
    },
    {
      "slug": "bra-staedte-schwer",
      "n": 100,
      "diff": "schwer",
      "title": "viele Städte"
    },
    {
      "slug": "bra-staedte-sehr-schwer",
      "n": 388,
      "diff": "sehr-schwer",
      "title": "alle Städte"
    }
  ],
  "CHL": [
    {
      "slug": "chl-staedte-leicht",
      "n": 10,
      "diff": "leicht",
      "title": "die größten"
    },
    {
      "slug": "chl-staedte-mittel",
      "n": 25,
      "diff": "mittel",
      "title": "große Städte"
    },
    {
      "slug": "chl-staedte-schwer",
      "n": 50,
      "diff": "schwer",
      "title": "viele Städte"
    },
    {
      "slug": "chl-staedte-sehr-schwer",
      "n": 84,
      "diff": "sehr-schwer",
      "title": "alle Städte"
    }
  ],
  "COL": [
    {
      "slug": "col-staedte-leicht",
      "n": 10,
      "diff": "leicht",
      "title": "die größten"
    },
    {
      "slug": "col-staedte-mittel",
      "n": 25,
      "diff": "mittel",
      "title": "große Städte"
    },
    {
      "slug": "col-staedte-schwer",
      "n": 45,
      "diff": "schwer",
      "title": "viele Städte"
    },
    {
      "slug": "col-staedte-sehr-schwer",
      "n": 72,
      "diff": "sehr-schwer",
      "title": "alle Städte"
    }
  ],
  "PER": [
    {
      "slug": "per-staedte-leicht",
      "n": 10,
      "diff": "leicht",
      "title": "die größten"
    },
    {
      "slug": "per-staedte-mittel",
      "n": 25,
      "diff": "mittel",
      "title": "große Städte"
    },
    {
      "slug": "per-staedte-schwer",
      "n": 50,
      "diff": "schwer",
      "title": "viele Städte"
    },
    {
      "slug": "per-staedte-sehr-schwer",
      "n": 89,
      "diff": "sehr-schwer",
      "title": "alle Städte"
    }
  ],
  "BOL": [
    {
      "slug": "bol-staedte-leicht",
      "n": 8,
      "diff": "leicht",
      "title": "die größten"
    },
    {
      "slug": "bol-staedte-mittel",
      "n": 20,
      "diff": "mittel",
      "title": "große Städte"
    },
    {
      "slug": "bol-staedte-schwer",
      "n": 40,
      "diff": "schwer",
      "title": "viele Städte"
    },
    {
      "slug": "bol-staedte-sehr-schwer",
      "n": 69,
      "diff": "sehr-schwer",
      "title": "alle Städte"
    }
  ],
  "VEN": [
    {
      "slug": "ven-staedte-leicht",
      "n": 10,
      "diff": "leicht",
      "title": "die größten"
    },
    {
      "slug": "ven-staedte-mittel",
      "n": 25,
      "diff": "mittel",
      "title": "große Städte"
    },
    {
      "slug": "ven-staedte-schwer",
      "n": 50,
      "diff": "schwer",
      "title": "viele Städte"
    }
  ],
  "ECU": [
    {
      "slug": "ecu-staedte-leicht",
      "n": 10,
      "diff": "leicht",
      "title": "die größten"
    },
    {
      "slug": "ecu-staedte-sehr-schwer",
      "n": 37,
      "diff": "sehr-schwer",
      "title": "alle Städte"
    }
  ],
  "PRY": [
    {
      "slug": "pry-staedte-leicht",
      "n": 10,
      "diff": "leicht",
      "title": "die größten"
    },
    {
      "slug": "pry-staedte-sehr-schwer",
      "n": 37,
      "diff": "sehr-schwer",
      "title": "alle Städte"
    }
  ],
  "URY": [
    {
      "slug": "ury-staedte-leicht",
      "n": 10,
      "diff": "leicht",
      "title": "die größten"
    },
    {
      "slug": "ury-staedte-sehr-schwer",
      "n": 32,
      "diff": "sehr-schwer",
      "title": "alle Städte"
    }
  ]
}

/** Regionen-Quizzes: Titel, Text, Landesteile (aus scripts/geo/sa-daten.mjs) */
export const SA_REGIONEN: Record<string, { iso: string | string[]; title: string; noun: string; one: string; capLabel: string; text: string; groups: Record<string, string> }> = {
  "ar-provinzen": {
    "iso": "ARG",
    "title": "Argentinien – Provinzen",
    "noun": "Provinzen",
    "one": "Provinz",
    "capLabel": "Hauptstadt",
    "text": "23 Provinzen und die Hauptstadt Buenos Aires – mit Hauptstädten und dem ISO-Buchstaben jeder Provinz.",
    "groups": {
      "noa": "Nordwesten (NOA)",
      "nea": "Nordosten (NEA)",
      "cuyo": "Cuyo",
      "pampa": "Pampa & Zentrum",
      "patagonien": "Patagonien"
    }
  },
  "bo-departamentos": {
    "iso": "BOL",
    "title": "Bolivien – Departamentos",
    "noun": "Departamentos",
    "one": "Departamento",
    "capLabel": "Hauptstadt",
    "text": "Neun Departamentos vom Altiplano bis ins Amazonas-Tiefland – mit Hauptstädten.",
    "groups": {
      "altiplano": "Altiplano",
      "valles": "Täler (Valles)",
      "llanos": "Tiefland (Llanos)"
    }
  },
  "cl-regionen": {
    "iso": "CHL",
    "title": "Chile – Regionen",
    "noun": "Regionen",
    "one": "Region",
    "capLabel": "Hauptstadt",
    "text": "16 Regionen von Arica bis Magallanes – mit Hauptstädten und den römischen Nummern, die man oft noch sieht.",
    "groups": {
      "grande": "Großer Norden (Norte Grande)",
      "chico": "Kleiner Norden (Norte Chico)",
      "zentral": "Zentralchile",
      "sur": "Süden (Zona Sur)",
      "austral": "Ganz im Süden (Zona Austral)"
    }
  },
  "co-departamentos": {
    "iso": "COL",
    "title": "Kolumbien – Departamentos",
    "noun": "Departamentos",
    "one": "Departamento",
    "capLabel": "Hauptstadt",
    "text": "32 Departamentos und der Hauptstadtbezirk Bogotá – nach den großen Landschaften Kolumbiens gefärbt.",
    "groups": {
      "karibik": "Karibik",
      "anden": "Anden (Región Andina)",
      "pazifik": "Pazifik",
      "orinoquia": "Orinoquía (Llanos)",
      "amazonia": "Amazonien",
      "insel": "Inseln"
    }
  },
  "ec-provinzen": {
    "iso": "ECU",
    "title": "Ecuador – Provinzen",
    "noun": "Provinzen",
    "one": "Provinz",
    "capLabel": "Hauptstadt",
    "text": "24 Provinzen zwischen Pazifik, Anden, Amazonas und den Galápagos-Inseln.",
    "groups": {
      "costa": "Küste (Costa)",
      "sierra": "Anden (Sierra)",
      "oriente": "Amazonien (Oriente)",
      "galapagos": "Galápagos"
    }
  },
  "py-departamentos": {
    "iso": "PRY",
    "title": "Paraguay – Departamentos",
    "noun": "Departamentos",
    "one": "Departamento",
    "capLabel": "Hauptstadt",
    "text": "17 Departamentos und die Hauptstadt Asunción – östlich des Río Paraguay dicht besiedelt, westlich der fast leere Chaco.",
    "groups": {
      "ost": "Östliches Paraguay (Región Oriental)",
      "chaco": "Chaco (Región Occidental)"
    }
  },
  "pe-regionen": {
    "iso": "PER",
    "title": "Peru – Regionen",
    "noun": "Regionen",
    "one": "Region",
    "capLabel": "Hauptstadt",
    "text": "24 Regionen, die Provinz Callao und die Hauptstadt Lima – Küste, Anden und Amazonas.",
    "groups": {
      "nord": "Norden",
      "zentrum": "Zentrum & Lima",
      "sued": "Süden",
      "amazonas": "Amazonien (Selva)"
    }
  },
  "uy-departamentos": {
    "iso": "URY",
    "title": "Uruguay – Departamentos",
    "noun": "Departamentos",
    "one": "Departamento",
    "capLabel": "Hauptstadt",
    "text": "19 Departamentos – das kleinste spanischsprachige Land Südamerikas komplett.",
    "groups": {
      "nord": "Norden",
      "litoral": "Westen (Litoral)",
      "mitte": "Mitte",
      "sued": "Süden",
      "ost": "Osten"
    }
  },
  "ve-staaten": {
    "iso": "VEN",
    "title": "Venezuela – Bundesstaaten",
    "noun": "Bundesstaaten",
    "one": "Bundesstaat",
    "capLabel": "Hauptstadt",
    "text": "23 Bundesstaaten, der Hauptstadtdistrikt und die Inseln – von den Anden bis zum Orinoco-Delta.",
    "groups": {
      "hauptstadt": "Hauptstadtregion",
      "zentral": "Zentrum",
      "westen": "Westen & Zulia",
      "anden": "Anden",
      "llanos": "Llanos",
      "osten": "Osten & Inseln",
      "guayana": "Guayana"
    }
  },
  "gy-sr-regionen": {
    "iso": [
      "GUY",
      "SUR"
    ],
    "title": "Guyana & Suriname – Regionen",
    "noun": "Regionen & Distrikte",
    "one": "Region",
    "capLabel": "Hauptort",
    "text": "Die zehn Regionen Guyanas und die zehn Distrikte Surinams – die einzigen englisch- und niederländischsprachigen Länder Südamerikas.",
    "groups": {
      "gy": "Guyana (Regionen)",
      "sr": "Suriname (Distrikte)"
    }
  }
}