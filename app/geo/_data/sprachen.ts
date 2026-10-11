// Erzeugt von scripts/geo/build-sprachen.mjs – nicht von Hand bearbeiten.

import type { GroupDef } from '../_lib/types'

export const SPRACHEN_COUNTS: Record<string, number> = {
  "kyrillisch-osteuropa": 140,
  "kyrillisch-balkan": 92,
  "kyrillisch-zentralasien": 45,
  "griechisch-orte": 88,
  "georgisch-orte": 19,
  "armenisch-orte": 25,
  "hebraeisch-orte": 33,
  "arabisch-orte": 154,
  "thai-lao-khmer-orte": 75,
  "vietnam-orte": 43,
  "korea-orte": 45,
  "japan-orte": 48,
  "chinesisch-orte": 51,
  "indien-schriften-orte": 115,
  "inuktitut-orte": 14,
  "kyrillisch": 33,
  "kyrillisch-laender": 15,
  "griechisch": 24,
  "georgisch": 33,
  "armenisch": 38,
  "hebraeisch": 27,
  "arabisch": 44,
  "thai": 54,
  "hangul": 36,
  "hiragana": 46,
  "katakana": 46,
  "inuktitut": 55,
  "hieroglyphen": 25,
  "lateinische-sonderzeichen": 26,
  "chinesisch-zeichen": 72,
  "zahlen": 80,
  "kyrillisch-welches-land": 144,
  "suedostasien-welches-land": 48,
  "ostasien-welches-land": 69,
  "indien-welche-schrift": 115,
  "welche-schrift": 130,
  "schilder-woerter": 35,
  "stoppschilder": 28
}

/** Gruppen der Karten-Quizzes (Länder bzw. Schriften) */
export const SPRACHEN_GROUPS: Record<string, Record<string, GroupDef>> = {
  "kyrillisch-osteuropa": {
    "ru": {
      "name": "Russland",
      "color": "#14b8a6"
    },
    "ua": {
      "name": "Ukraine",
      "color": "#f97316"
    },
    "by": {
      "name": "Belarus",
      "color": "#6366f1"
    }
  },
  "kyrillisch-balkan": {
    "bg": {
      "name": "Bulgarien",
      "color": "#14b8a6"
    },
    "rs": {
      "name": "Serbien",
      "color": "#f97316"
    },
    "mk": {
      "name": "Nordmazedonien",
      "color": "#6366f1"
    }
  },
  "kyrillisch-zentralasien": {
    "kz": {
      "name": "Kasachstan",
      "color": "#14b8a6"
    },
    "mn": {
      "name": "Mongolei",
      "color": "#f97316"
    }
  },
  "griechisch-orte": {
    "gr": {
      "name": "Griechenland",
      "color": "#14b8a6"
    },
    "cy": {
      "name": "Zypern",
      "color": "#f97316"
    }
  },
  "georgisch-orte": {
    "ge": {
      "name": "Georgien",
      "color": "#14b8a6"
    }
  },
  "armenisch-orte": {
    "am": {
      "name": "Armenien",
      "color": "#14b8a6"
    }
  },
  "hebraeisch-orte": {
    "il": {
      "name": "Israel",
      "color": "#14b8a6"
    }
  },
  "arabisch-orte": {
    "maghreb": {
      "name": "Maghreb (Arabisch)",
      "color": "#14b8a6"
    },
    "nahost": {
      "name": "Ägypten & Levante (Arabisch)",
      "color": "#f97316"
    },
    "golf": {
      "name": "Arabische Halbinsel & Irak (Arabisch)",
      "color": "#6366f1"
    },
    "fa": {
      "name": "Iran (Persisch)",
      "color": "#eab308"
    },
    "ur": {
      "name": "Pakistan (Urdu)",
      "color": "#f43f5e"
    }
  },
  "thai-lao-khmer-orte": {
    "th": {
      "name": "Thailand",
      "color": "#14b8a6"
    },
    "la": {
      "name": "Laos",
      "color": "#f97316"
    },
    "kh": {
      "name": "Kambodscha",
      "color": "#6366f1"
    }
  },
  "vietnam-orte": {
    "vn": {
      "name": "Vietnam",
      "color": "#14b8a6"
    }
  },
  "korea-orte": {
    "kr": {
      "name": "Südkorea",
      "color": "#14b8a6"
    }
  },
  "japan-orte": {
    "jp": {
      "name": "Japan",
      "color": "#14b8a6"
    }
  },
  "chinesisch-orte": {
    "tw": {
      "name": "Taiwan",
      "color": "#14b8a6"
    },
    "cn": {
      "name": "China",
      "color": "#f97316"
    }
  },
  "indien-schriften-orte": {
    "hi": {
      "name": "Devanagari",
      "color": "#14b8a6"
    },
    "kn": {
      "name": "Kannada",
      "color": "#f97316"
    },
    "te": {
      "name": "Telugu",
      "color": "#6366f1"
    },
    "gu": {
      "name": "Gujarati",
      "color": "#eab308"
    },
    "ta": {
      "name": "Tamil",
      "color": "#f43f5e"
    },
    "bn": {
      "name": "Bengalisch",
      "color": "#22c55e"
    },
    "pa": {
      "name": "Gurmukhi (Punjabi)",
      "color": "#a855f7"
    },
    "or": {
      "name": "Odia",
      "color": "#3b82f6"
    },
    "ml": {
      "name": "Malayalam",
      "color": "#fb7185"
    }
  },
  "inuktitut-orte": {
    "nu": {
      "name": "Kanada (Nunavut)",
      "color": "#14b8a6"
    }
  }
}