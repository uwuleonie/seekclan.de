export type MobCategory = 'Passiv' | 'Neutral' | 'Feindlich' | 'Boss'

export type MobVariant = {
  id: string        // z.B. 'warm', 'cold', 'big'
  label: string      // Anzeige-Text für den Button, z.B. 'Warm'
}

export type MobEntry = {
  id: string         // entity id, z.B. 'zombie' - entspricht dem Dateinamen <id>.glb
  name: string        // Deutscher Anzeigename
  category: MobCategory
  icon: string         // Emoji als einfacher Platzhalter
  biome: string        // Fundort / Biom-Beschreibung
  wikiSlug?: string    // Slug für minecraft.wiki, falls abweichend vom englischen Namen
  variants?: MobVariant[] // Optische Varianten mit eigenem Modell (z.B. warm/kalt)
  modelAvailable?: boolean // false = Modell noch nicht vorhanden, zeigt Platzhaltertext
}

export const ALL_MOBS: MobEntry[] = [
  // ===== Passiv =====
  { id: 'allay', name: 'Allay', category: 'Passiv', icon: '✨', biome: 'Käfige bei Plünderer-Außenposten und in Waldvillen' },
  { id: 'armadillo', name: 'Gürteltier', category: 'Passiv', icon: '🦔', biome: 'Savanne und Badlands' },
  { id: 'axolotl', name: 'Axolotl', category: 'Passiv', icon: '🦎', biome: 'Wasserbecken in Höhlen, unterhalb der Oberfläche' },
  { id: 'bat', name: 'Fledermaus', category: 'Passiv', icon: '🦇', biome: 'Höhlen und dunkle Bereiche, in fast jedem Biom' },
  { id: 'camel', name: 'Kamel', category: 'Passiv', icon: '🐪', biome: 'Wüstendörfer' },
  { id: 'cat', name: 'Katze', category: 'Passiv', icon: '🐱', biome: 'Dörfer, sowie Hexenhütten (als schwarze Katze)' },
  {
    id: 'chicken', name: 'Hühner', category: 'Passiv', icon: '🐔',
    biome: 'Gemäßigte Biome wie Wiesen, Wälder und Ebenen',
    variants: [
      { id: 'normal', label: 'Normal' },
      { id: 'warm', label: 'Warm' },
      { id: 'cold', label: 'Kalt' },
    ],
  },
  { id: 'cod', name: 'Kabeljau', category: 'Passiv', icon: '🐟', biome: 'Gemäßigte und kalte Ozeane' },
  {
    id: 'cow', name: 'Kuh', category: 'Passiv', icon: '🐮',
    biome: 'Gemäßigte Biome wie Wiesen, Wälder und Ebenen',
    variants: [
      { id: 'normal', label: 'Normal' },
      { id: 'warm', label: 'Warm' },
      { id: 'cold', label: 'Kalt' },
    ],
  },
  { id: 'donkey', name: 'Esel', category: 'Passiv', icon: '🐴', biome: 'Savanne und Ebenen' },
  { id: 'fox', name: 'Fuchs', category: 'Passiv', icon: '🦊', biome: 'Taiga und Schnee-Taiga' },
  { id: 'frog', name: 'Frosch', category: 'Passiv', icon: '🐸', biome: 'Sumpf, Mangroven-Sumpf und gemäßigte Biome in der Nähe von Wasser' },
  { id: 'glow_squid', name: 'Glubschtinte', category: 'Passiv', icon: '🦑', biome: 'Unterirdische Gewässer und dunkle Höhlen' },
  { id: 'horse', name: 'Pferd', category: 'Passiv', icon: '🐴', biome: 'Ebenen und Savanne' },
  { id: 'mooshroom', name: 'Mooshroom', category: 'Passiv', icon: '🍄', biome: 'Ausschließlich im Pilzfeld-Biom' },
  { id: 'mule', name: 'Maultier', category: 'Passiv', icon: '🐴', biome: 'Entsteht durch Zucht von Pferd und Esel, kein eigener Spawn' },
  { id: 'ocelot', name: 'Ozelot', category: 'Passiv', icon: '🐆', biome: 'Dschungel' },
  { id: 'parrot', name: 'Papagei', category: 'Passiv', icon: '🦜', biome: 'Dschungel' },
  { id: 'pig', name: 'Schwein', category: 'Passiv', icon: '🐷', biome: 'Gemäßigte Biome wie Wiesen, Wälder und Ebenen', variants: [ { id: 'normal', label: 'Normal' }, { id: 'warm', label: 'Warm' }, { id: 'cold', label: 'Kalt' } ] },
  { id: 'rabbit', name: 'Kaninchen', category: 'Passiv', icon: '🐰', biome: 'Ebenen, Wüste, Taiga und Schnee-Biome', modelAvailable: false },
  { id: 'salmon', name: 'Lachs', category: 'Passiv', icon: '🐟', biome: 'Flüsse und kalte Ozeane' },
  { id: 'sheep', name: 'Schaf', category: 'Passiv', icon: '🐑', biome: 'Alle grasbewachsenen Biome' },
  { id: 'sniffer', name: 'Schnüffler', category: 'Passiv', icon: '🐾', biome: 'Wird aus Schnüffler-Eiern ausgebrütet, die in warmen Ozean-Ruinen gefunden werden' },
  { id: 'skeleton_horse', name: 'Skelettpferd', category: 'Passiv', icon: '🐴', biome: 'Spawnt selten bei Blitzeinschlägen auf Pferden' },
  { id: 'snow_golem', name: 'Schneegolem', category: 'Passiv', icon: '⛄', biome: 'Wird ausschließlich vom Spieler aus Schneeblöcken erbaut' },
  { id: 'squid', name: 'Tintenfisch', category: 'Passiv', icon: '🦑', biome: 'Flüsse und Ozeane' },
  { id: 'strider', name: 'Strider', category: 'Passiv', icon: '🦵', biome: 'Lavaseen im Nether' },
  { id: 'tadpole', name: 'Kaulquappe', category: 'Passiv', icon: '🐸', biome: 'Sumpf und Mangroven-Sumpf, wächst zum Frosch heran' },
  { id: 'tropical_fish', name: 'Tropenfisch', category: 'Passiv', icon: '🐠', biome: 'Warme Ozeane und Korallenriffe' },
  { id: 'turtle', name: 'Schildkröte', category: 'Passiv', icon: '🐢', biome: 'Sandstrände in warmen Ozean-Biomen' },
  { id: 'villager', name: 'Dorfbewohner', category: 'Passiv', icon: '🧑', biome: 'Dörfer' },
  { id: 'wandering_trader', name: 'Wandernder Händler', category: 'Passiv', icon: '🧑‍🌾', biome: 'Spawnt zufällig in der Nähe des Spielers, oft an Dörfern' },

  // ===== Neutral =====
  { id: 'bee', name: 'Biene', category: 'Neutral', icon: '🐝', biome: 'Wiesen, Ebenen, Wälder und Mangroven-Sumpf, in der Nähe von Bienenstöcken' },
  { id: 'dolphin', name: 'Delfin', category: 'Neutral', icon: '🐬', biome: 'Lauwarme, normale und warme Ozeane' },
  { id: 'goat', name: 'Ziege', category: 'Neutral', icon: '🐐', biome: 'Zerklüftete Gipfel, Frostgipfel und verschneite Hänge' },
  { id: 'iron_golem', name: 'Eisengolem', category: 'Neutral', icon: '🗿', biome: 'Dörfer, oder vom Spieler gebaut' },
  { id: 'llama', name: 'Lama', category: 'Neutral', icon: '🦙', biome: 'Savanne und windgepeitschte Hügel' },
  { id: 'nautilus', name: 'Nautilus', category: 'Neutral', icon: '🐚', biome: 'Tiefe Ozeane, in der Nähe von Schiffswracks' },
  { id: 'panda', name: 'Panda', category: 'Neutral', icon: '🐼', biome: 'Bambusdschungel' },
  { id: 'piglin', name: 'Piglin', category: 'Neutral', icon: '🐷', biome: 'Nether-Ödland und Bastionsruinen' },
  { id: 'polar_bear', name: 'Eisbär', category: 'Neutral', icon: '🐻‍❄️', biome: 'Verschneite Ebenen und gefrorene Gipfel' },
  { id: 'trader_llama', name: 'Händler-Lama', category: 'Neutral', icon: '🦙', biome: 'Begleitet den Wandernden Händler', modelAvailable: false },
  { id: 'wolf', name: 'Wolf', category: 'Neutral', icon: '🐺', biome: 'Taiga, Schnee-Taiga und Wälder' },
  { id: 'zombified_piglin', name: 'Zombifizierter Piglin', category: 'Neutral', icon: '🧟', biome: 'Nether-Ödland und Bastionsruinen' },

  // ===== Feindlich =====
  { id: 'blaze', name: 'Lohe', category: 'Feindlich', icon: '🔥', biome: 'Nether-Festungen' },
  { id: 'bogged', name: 'Bogged', category: 'Feindlich', icon: '🏹', biome: 'Sumpf und Mangroven-Sumpf, sowie Testkammern', modelAvailable: false },
  { id: 'breeze', name: 'Breeze', category: 'Feindlich', icon: '🌪️', biome: 'Testkammern' },
  { id: 'cave_spider', name: 'Höhlenspinne', category: 'Feindlich', icon: '🕷️', biome: 'Spawnt nur über Spinnen-Spawner in Mineschächten' },
  { id: 'creaking', name: 'Creaking', category: 'Feindlich', icon: '🌳', biome: 'Knarrender Hain (Pale Garden)', wikiSlug: 'Creaking' },
  { id: 'creeper', name: 'Creeper', category: 'Feindlich', icon: '💚', biome: 'Alle dunklen Bereiche im Overworld' },
  { id: 'drowned', name: 'Ertrunkener', category: 'Feindlich', icon: '🧟', biome: 'Ozeane und Flüsse' },
  { id: 'elder_guardian', name: 'Älterer Wächter', category: 'Feindlich', icon: '🐡', biome: 'Ozean-Monumente (max. 3 pro Monument)' },
  { id: 'enderman', name: 'Enderman', category: 'Feindlich', icon: '🟪', biome: 'Überall im Overworld bei Dunkelheit, sowie häufig im End' },
  { id: 'endermite', name: 'Endermilbe', category: 'Feindlich', icon: '🐛', biome: 'Seltener Spawn beim Werfen von Enderperlen' },
  { id: 'evoker', name: 'Beschwörer', category: 'Feindlich', icon: '🧙', biome: 'Waldvillen und Überfälle' },
  { id: 'ghast', name: 'Ghast', category: 'Feindlich', icon: '👻', biome: 'Nether-Ödland, Seelensandtal und Basaltdelta' },
  { id: 'guardian', name: 'Wächter', category: 'Feindlich', icon: '🐡', biome: 'Ozean-Monumente und umliegende Gewässer' },
  { id: 'hoglin', name: 'Hoglin', category: 'Feindlich', icon: '🐗', biome: 'Verzerrte Wälder im Nether' },
  { id: 'husk', name: 'Husk', category: 'Feindlich', icon: '🧟', biome: 'Wüste' },
  { id: 'magma_cube', name: 'Magmawürfel', category: 'Feindlich', icon: '🟧', biome: 'Nether, besonders im Basaltdelta' },
  { id: 'parched', name: 'Parched', category: 'Feindlich', icon: '🏜️', biome: 'Wüste, oft als Reiter auf einem Kamel-Husk', wikiSlug: 'Parched' },
  { id: 'phantom', name: 'Phantom', category: 'Feindlich', icon: '👤', biome: 'Spawnt nachts über Spielern, die lange nicht geschlafen haben' },
  { id: 'pillager', name: 'Plünderer', category: 'Feindlich', icon: '🏹', biome: 'Plünderer-Außenposten und Überfälle' },
  { id: 'piglin_brute', name: 'Piglin-Brutalo', category: 'Feindlich', icon: '🐷', biome: 'Bastionsruinen, in besonderen Schatzkammern', wikiSlug: 'Piglin_Brute' },
  { id: 'ravager', name: 'Verwüster', category: 'Feindlich', icon: '🐗', biome: 'Waldvillen und Überfälle' },
  { id: 'shulker', name: 'Shulker', category: 'Feindlich', icon: '📦', biome: 'End-Städte' },
  { id: 'silverfish', name: 'Silberfischchen', category: 'Feindlich', icon: '🐛', biome: 'Festungen und befallene Steinblöcke' },
  { id: 'skeleton', name: 'Skelett', category: 'Feindlich', icon: '💀', biome: 'Alle dunklen Bereiche im Overworld' },
  { id: 'slime', name: 'Schleim', category: 'Feindlich', icon: '🟢', biome: 'Sumpf und tief unten in Schleim-Chunks' },
  { id: 'spider', name: 'Spinne', category: 'Feindlich', icon: '🕷️', biome: 'Alle dunklen Bereiche im Overworld' },
  { id: 'stray', name: 'Eisskelett', category: 'Feindlich', icon: '💀', biome: 'Verschneite Biome' },
  { id: 'vex', name: 'Plagegeist', category: 'Feindlich', icon: '👹', biome: 'Wird vom Beschwörer herbeigerufen' },
  { id: 'vindicator', name: 'Gesetzeshüter', category: 'Feindlich', icon: '🪓', biome: 'Waldvillen und Überfälle' },
  { id: 'witch', name: 'Hexe', category: 'Feindlich', icon: '🧙‍♀️', biome: 'Hexenhütten im Sumpf, sowie Überfälle' },
  { id: 'wither_skeleton', name: 'Witherskelett', category: 'Feindlich', icon: '💀', biome: 'Nether-Festungen' },
  { id: 'zoglin', name: 'Zoglin', category: 'Feindlich', icon: '🐗', biome: 'Entsteht, wenn ein Hoglin den Nether verlässt' },
  { id: 'zombie', name: 'Zombie', category: 'Feindlich', icon: '🧟', biome: 'Alle dunklen Bereiche im Overworld' },
  { id: 'zombie_horse', name: 'Zombiepferd', category: 'Feindlich', icon: '🐴', biome: 'Ebenen und Savanne, nachts mit Zombie-Reiter', wikiSlug: 'Zombie_Horse' },
  { id: 'zombie_villager', name: 'Zombiedorfbewohner', category: 'Feindlich', icon: '🧟', biome: 'Entsteht, wenn ein Zombie einen Dorfbewohner infiziert' },

  // ===== Boss =====
  { id: 'ender_dragon', name: 'Enderdrache', category: 'Boss', icon: '🐉', biome: 'End-Insel, über dem Hauptportal' },
  { id: 'wither', name: 'Wither', category: 'Boss', icon: '💀', biome: 'Wird vom Spieler aus Witherschädeln und Seelensand erbaut' },
  { id: 'warden', name: 'Warden', category: 'Boss', icon: '👁️', biome: 'Tiefenebene (Deep Dark), wird über Sculk-Schreier herbeigerufen' },
]

export const MOB_CATEGORIES: MobCategory[] = ['Passiv', 'Neutral', 'Feindlich', 'Boss']

export function getMobById(id: string): MobEntry | undefined {
  return ALL_MOBS.find(m => m.id === id)
}

// Liefert den .glb-Dateinamen (ohne Pfad/Endung) für einen Mob + optionale Variante.
// Beispiel: getModelFileName('cow', 'warm') -> 'warm_cow'
//           getModelFileName('cow', 'normal') -> 'cow'
//           getModelFileName('zombie') -> 'zombie'
export function getModelFileName(mobId: string, variantId?: string): string {
  if (!variantId || variantId === 'normal') return mobId
  return `${variantId}_${mobId}`
}

// Wiki-Link-Helper: nutzt wikiSlug falls vorhanden, sonst den deutschen Namen
// als Fallback (funktioniert für die meisten Mobs, da minecraft.wiki auch
// deutsche Begriffe weiterleitet; für Sonderfälle wikiSlug in mobs.ts setzen).
export function getWikiUrl(mob: MobEntry): string {
  const slug = mob.wikiSlug ?? mob.name.replace(/ /g, '_')
  return `https://minecraft.wiki/w/${slug}`
}