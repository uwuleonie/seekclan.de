// Erzeugt von scripts/geo/build-gg-sa.mjs – nicht von Hand ändern.
export const GG_SA_COUNTS: Record<string, number> = {
  "gg-sa-kennzeichen": 17,
  "gg-sa-poller": 16,
  "gg-sa-masten": 15,
  "gg-sa-schilder": 14,
  "gg-sa-linien": 11,
  "gg-sa-zaeune": 6,
  "gg-sa-taxis-argentinien": 16,
  "gg-sa-taxis": 9,
  "gg-sa-pflanzen": 29,
  "gg-sa-vorwahlen": 14,
  "gg-sa-domains": 14,
  "gg-sa-hinweise": 233,
  "gg-sa-rate-das-land": 25,
  "gg-sa-regionen-argentinien": 38,
  "gg-sa-regionen-brasilien": 74,
  "gg-sa-regionen-chile": 52,
  "gg-sa-regionen-peru": 29,
  "gg-sa-regionen-bolivien": 40,
  "gg-sa-ar-taxis": 15,
  "gg-sa-cl-strassen": 16,
  "gg-sa-kennzeichen-karte": 8,
  "gg-sa-chevron-karte": 8,
  "gg-sa-mittellinie-karte": 7,
  "gg-sa-auto-karte": 8
}

/** Länder mit Steckbrief: [slug, Name, Flagge, Gruppe] */
export const GG_SA_LAENDER: [string, string, string, string][] = [["argentina","Argentinien","ar","cono"],["chile","Chile","cl","cono"],["uruguay","Uruguay","uy","cono"],["falkland-islands","Falklandinseln","fk","cono"],["brazil","Brasilien","br","brasilien"],["colombia","Kolumbien","co","anden"],["ecuador","Ecuador","ec","anden"],["peru","Peru","pe","anden"],["bolivia","Bolivien","bo","anden"]]

/** Farben der Merkmals-Karten */
export const GG_SA_MERKMAL_GROUPS: Record<string, Record<string, { name: string; color: string }>> = {
  "gg-sa-kennzeichen-karte": {
    "mercosur": {
      "name": "Mercosur (weiß, blauer Balken oben)",
      "color": "#3d74d0"
    },
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
  },
  "gg-sa-chevron-karte": {
    "gelbschwarz": {
      "name": "gelb mit schwarzem Pfeil",
      "color": "#f2c230"
    },
    "schwarzgelb": {
      "name": "schwarz mit gelbem Pfeil",
      "color": "#3a3a3a"
    },
    "weirot": {
      "name": "weiß mit rotem Pfeil",
      "color": "#d14b4b"
    }
  },
  "gg-sa-mittellinie-karte": {
    "gelb": {
      "name": "gelb",
      "color": "#f2c230"
    },
    "wei": {
      "name": "weiß",
      "color": "#e8e4da"
    },
    "gemischt": {
      "name": "gemischt",
      "color": "#9a8fb5"
    }
  },
  "gg-sa-auto-karte": {
    "schwarz": {
      "name": "schwarz",
      "color": "#555555"
    },
    "wei": {
      "name": "weiß",
      "color": "#e8e4da"
    },
    "gemischt": {
      "name": "gemischt",
      "color": "#9a8fb5"
    }
  }
}