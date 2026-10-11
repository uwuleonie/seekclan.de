// Geplante Quizzes – erscheinen als "Bald verfügbar", bis sie gebaut sind.
// Wenn ein Quiz fertig ist, wandert es aus dieser Liste in seine eigene Inhalts-Datei (gleicher slug!).

import type { PlannedDef } from '../_lib/types'

const p = (slug: string, title: string, meta: string, bereich: PlannedDef['bereich'], kind: PlannedDef['kind'], country?: string, text?: string): PlannedDef =>
  ({ slug, title, meta, bereich, kind, country, text, planned: true })

export const GEPLANT: PlannedDef[] = [
  // Welt
  p('welt-flaggen', 'Flaggen der Welt', 'Flaggen · Namen · Karte', 'welt', 'flaggen', undefined, 'Flagge erkennen, Flagge zum Namen finden, Flagge auf der Karte zuordnen.'),
  p('welt-millionenstaedte', 'Millionenstädte der Welt', 'Alle Städte ab 1 Mio. Einwohner', 'welt', 'staedte', undefined, 'Alle Millionenstädte der Erde auf der Karte finden.'),

  // Europa
  p('europa-flaggen', 'Flaggen Europas', 'Flaggen · Namen · Karte', 'europa', 'flaggen', undefined, 'Flaggen erkennen, eintippen oder die richtige Flagge anklicken.'),
  p('europa-1914', 'Europa 1914', 'Staaten vor dem Ersten Weltkrieg', 'europa', 'historisch', undefined, 'Deutsches Reich, Österreich-Ungarn, Russisches Reich – die Grenzen von 1914.'),
  p('europa-1815', 'Europa 1815', 'Nach dem Wiener Kongress', 'europa', 'historisch', undefined, 'Königreiche, Herzogtümer und der Deutsche Bund nach 1815.'),
  p('europa-fluesse', 'Flüsse Europas', 'Flüsse · Einzugsgebiete', 'europa', 'fluesse', undefined, 'Donau, Rhein, Wolga & Co. – Flüsse und ihre Einzugsgebiete.'),
  p('ex-sowjetstaaten', 'Ehemalige Sowjetrepubliken', '15 Staaten', 'europa', 'historisch', undefined, 'Die 15 Nachfolgestaaten der Sowjetunion.'),

  // Deutschland
  p('de-grossstaedte', 'Großstädte Deutschlands', 'Alle Großstädte ab 100.000', 'europa', 'staedte', 'DEU'),
  p('de-fluesse', 'Flüsse Deutschlands', 'Rhein, Elbe, Donau …', 'europa', 'fluesse', 'DEU'),
  p('de-gebirge', 'Gebirge Deutschlands', 'Mittelgebirge & Alpen', 'europa', 'berge', 'DEU', 'Mit Relief-Karte: Harz, Schwarzwald, Erzgebirge & Co.'),
  p('de-fernverkehr', 'ICE/IC-Netz Deutschland', 'Alle Linien · Züge · Halte', 'europa', 'bahn', 'DEU', 'Alle ICE- und IC-Linien mit Halten und Zügen.'),
  p('by-regionen', 'Bayern – Regionen', 'Tourismusregionen', 'europa', 'regionen', 'DEU'),

  // Westeuropa
  p('fr-regionen', 'Frankreich – Regionen', '13 Regionen + Übersee', 'europa', 'regionen', 'FRA'),
  p('uk-laender', 'Vereinigtes Königreich – Landesteile', 'England, Schottland, Wales, Nordirland', 'europa', 'regionen', 'GBR'),
  p('uk-regionen', 'Vereinigtes Königreich – Grafschaften', 'Counties & Council Areas', 'europa', 'regionen', 'GBR'),
  p('uk-grossstaedte', 'Vereinigtes Königreich – Großstädte', 'Städte', 'europa', 'staedte', 'GBR'),
  p('uk-fluesse', 'Vereinigtes Königreich – Flüsse & Kanäle', 'Wasserstraßen', 'europa', 'fluesse', 'GBR'),
  p('ie-staedte', 'Irland – Städte', 'Städte', 'europa', 'staedte', 'IRL'),
  p('nl-staedte', 'Niederlande – Städte & Provinzen', 'Städte · 12 Provinzen', 'europa', 'staedte', 'NLD'),
  p('benelux-staedte', 'Benelux – Städte', 'Belgien, Niederlande, Luxemburg', 'europa', 'staedte', 'BEL'),

  // Nordeuropa
  p('no-staedte', 'Norwegen – Städte', 'Städte', 'europa', 'staedte', 'NOR'),
  p('baltikum-staedte', 'Baltikum – Städte', 'Estland, Lettland, Litauen', 'europa', 'staedte', 'LVA'),
  p('ee-staedte', 'Estland – Städte', 'Städte', 'europa', 'staedte', 'EST'),
  p('lv-staedte', 'Lettland – Städte', 'Städte', 'europa', 'staedte', 'LVA'),
  p('lt-staedte', 'Litauen – Städte', 'Städte', 'europa', 'staedte', 'LTU'),

  // Südeuropa
  p('it-regionen', 'Italien – Regionen', '20 Regionen', 'europa', 'regionen', 'ITA'),
  p('it-staedte', 'Italien – Städte', 'Städte', 'europa', 'staedte', 'ITA'),
  p('es-regionen', 'Spanien – Autonome Gemeinschaften', '17 Regionen', 'europa', 'regionen', 'ESP'),
  p('es-provinzhauptstaedte', 'Spanien – Provinzhauptstädte', '50 Provinzen', 'europa', 'hauptstaedte', 'ESP'),
  p('es-staedte', 'Spanien – Städte', 'Städte', 'europa', 'staedte', 'ESP'),

  // Russland & Zentralasien
  p('ru-sibirien', 'Sibirien', 'Flüsse · Gebirge · Städte', 'asien', 'berge', 'RUS', 'Physische Karte: Lena, Jenissei, Baikalsee, Kamtschatka …'),
  p('kz-regionen', 'Kasachstan – Gebiete', '17 Gebiete + 3 Städte', 'asien', 'regionen', 'KAZ'),
  p('kz-bahn', 'Kasachstan – Eisenbahn', 'Strecken & Bahnhöfe', 'asien', 'bahn', 'KAZ'),

  // Wissen
  p('kyrillisch', 'Kyrillisch lesen', 'Buchstaben · Wörter · Sprachen', 'europa', 'wissen', undefined, 'Kyrillische Buchstaben lesen und Sprachen am Schriftbild erkennen.'),
]