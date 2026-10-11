// Erzeugt von scripts/geo/build-gg.mjs – nicht von Hand ändern.
export const GG_COUNTS: Record<string, number> = {
  "gg-ortsschilder": 38,
  "gg-zebrastreifen": 34,
  "gg-strassennummern": 63,
  "gg-hinweise": 752,
  "gg-rate-das-land": 111,
  "gg-ru-kennzeichen": 83,
  "gg-pl-kennzeichen": 16,
  "gg-ua-kennzeichen": 26,
  "gg-ortsschild-karte": 40,
  "gg-wegweiser-karte": 38,
  "gg-kennzeichen-karte": 36
}

/** Länder mit Steckbrief: [slug, Name, Flagge, Gruppe] */
export const GG_LAENDER: [string, string, string, string][] = [["ireland","Irland","ie","britisch"],["united-kingdom","Vereinigtes Königreich","gb","britisch"],["isle-of-man","Isle of Man","im","britisch"],["jersey","Jersey","je","britisch"],["gibraltar","Gibraltar","gi","iberien"],["portugal","Portugal","pt","iberien"],["azores","Azoren","pt","iberien"],["madeira","Madeira","pt","iberien"],["spain","Spanien","es","iberien"],["andorra","Andorra","ad","iberien"],["france","Frankreich","fr","west"],["monaco","Monaco","mc","west"],["belgium","Belgien","be","west"],["netherlands","Niederlande","nl","west"],["luxembourg","Luxemburg","lu","west"],["germany","Deutschland","de","alpen"],["austria","Österreich","at","alpen"],["switzerland","Schweiz","ch","alpen"],["liechtenstein","Liechtenstein","li","alpen"],["italy","Italien","it","alpen"],["san-marino","San Marino","sm","alpen"],["malta","Malta","mt","alpen"],["slovenia","Slowenien","si","alpen"],["norway","Norwegen","no","nord"],["svalbard","Spitzbergen","no","nord"],["sweden","Schweden","se","nord"],["finland","Finnland","fi","nord"],["denmark","Dänemark","dk","nord"],["faroe-islands","Färöer","fo","nord"],["iceland","Island","is","nord"],["greenland","Grönland","gl","nord"],["poland","Polen","pl","ostmitte"],["czechia","Tschechien","cz","ostmitte"],["slovakia","Slowakei","sk","ostmitte"],["hungary","Ungarn","hu","ostmitte"],["lithuania","Litauen","lt","ostmitte"],["latvia","Lettland","lv","ostmitte"],["estonia","Estland","ee","ostmitte"],["croatia","Kroatien","hr","balkan"],["bosnia-and-herzegovina","Bosnien und Herzegowina","ba","balkan"],["serbia","Serbien","rs","balkan"],["montenegro","Montenegro","me","balkan"],["north-macedonia","Nordmazedonien","mk","balkan"],["albania","Albanien","al","balkan"],["romania","Rumänien","ro","balkan"],["bulgaria","Bulgarien","bg","balkan"],["greece","Griechenland","gr","balkan"],["cyprus","Zypern","cy","balkan"],["turkey","Türkei","tr","balkan"],["russia","Russland","ru","ost"],["ukraine","Ukraine","ua","ost"],["belarus","Belarus","by","ost"]]

export const GG_GRUPPEN: Record<string, string> = {
  "britisch": "Britische Inseln",
  "iberien": "Iberien & Atlantik",
  "west": "Frankreich & Benelux",
  "alpen": "Mitte & Alpen",
  "nord": "Skandinavien & Nordatlantik",
  "ostmitte": "Ostmitteleuropa & Baltikum",
  "balkan": "Balkan, Griechenland & Türkei",
  "ost": "Russland, Ukraine, Belarus"
}

/** Farben der Merkmals-Karten */
export const GG_MERKMAL_GROUPS: Record<string, Record<string, { name: string; color: string }>> = {
  "gg-ortsschild-karte": {
    "wei": {
      "name": "weiß",
      "color": "#e8e4da"
    },
    "gelb": {
      "name": "gelb",
      "color": "#f2c230"
    },
    "blau": {
      "name": "blau",
      "color": "#3d74d0"
    },
    "grn": {
      "name": "grün",
      "color": "#2f9b5f"
    },
    "gemischt": {
      "name": "gemischt",
      "color": "#9a8fb5"
    }
  },
  "gg-wegweiser-karte": {
    "wei": {
      "name": "weiß",
      "color": "#e8e4da"
    },
    "gelb": {
      "name": "gelb",
      "color": "#f2c230"
    },
    "blau": {
      "name": "blau",
      "color": "#3d74d0"
    },
    "grn": {
      "name": "grün",
      "color": "#2f9b5f"
    },
    "gemischt": {
      "name": "gemischt",
      "color": "#9a8fb5"
    }
  },
  "gg-kennzeichen-karte": {
    "wei": {
      "name": "weiß",
      "color": "#e8e4da"
    },
    "gelb": {
      "name": "gelb",
      "color": "#f2c230"
    },
    "gemischt": {
      "name": "gemischt",
      "color": "#9a8fb5"
    }
  }
}