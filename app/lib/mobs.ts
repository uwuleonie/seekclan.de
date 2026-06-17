export type MobCategory = 'Passiv' | 'Neutral' | 'Feindlich' | 'Boss'

export type MobEntry = {
  id: string       // entity id, z.B. 'zombie'
  name: string      // Deutscher Anzeigename
  category: MobCategory
  icon: string       // Emoji als einfacher Platzhalter
}

export const ALL_MOBS: MobEntry[] = [
  // Passiv
  { id: 'allay', name: 'Allay', category: 'Passiv', icon: '✨' },
  { id: 'armadillo', name: 'Gürteltier', category: 'Passiv', icon: '🦔' },
  { id: 'axolotl', name: 'Axolotl', category: 'Passiv', icon: '🦎' },
  { id: 'bat', name: 'Fledermaus', category: 'Passiv', icon: '🦇' },
  { id: 'camel', name: 'Kamel', category: 'Passiv', icon: '🐪' },
  { id: 'cat', name: 'Katze', category: 'Passiv', icon: '🐱' },
  { id: 'chicken', name: 'Hühner', category: 'Passiv', icon: '🐔' },
  { id: 'cod', name: 'Kabeljau', category: 'Passiv', icon: '🐟' },
  { id: 'cow', name: 'Kuh', category: 'Passiv', icon: '🐮' },
  { id: 'donkey', name: 'Esel', category: 'Passiv', icon: '🐴' },
  { id: 'fox', name: 'Fuchs', category: 'Passiv', icon: '🦊' },
  { id: 'frog', name: 'Frosch', category: 'Passiv', icon: '🐸' },
  { id: 'glow_squid', name: 'Glubschtinte', category: 'Passiv', icon: '🦑' },
  { id: 'horse', name: 'Pferd', category: 'Passiv', icon: '🐴' },
  { id: 'mooshroom', name: 'Mooshroom', category: 'Passiv', icon: '🍄' },
  { id: 'mule', name: 'Maultier', category: 'Passiv', icon: '🐴' },
  { id: 'ocelot', name: 'Ozelot', category: 'Passiv', icon: '🐆' },
  { id: 'parrot', name: 'Papagei', category: 'Passiv', icon: '🦜' },
  { id: 'pig', name: 'Schwein', category: 'Passiv', icon: '🐷' },
  { id: 'rabbit', name: 'Kaninchen', category: 'Passiv', icon: '🐰' },
  { id: 'salmon', name: 'Lachs', category: 'Passiv', icon: '🐟' },
  { id: 'sheep', name: 'Schaf', category: 'Passiv', icon: '🐑' },
  { id: 'sniffer', name: 'Schnüffler', category: 'Passiv', icon: '🐾' },
  { id: 'skeleton_horse', name: 'Skelettpferd', category: 'Passiv', icon: '🐴' },
  { id: 'snow_golem', name: 'Schneegolem', category: 'Passiv', icon: '⛄' },
  { id: 'squid', name: 'Tintenfisch', category: 'Passiv', icon: '🦑' },
  { id: 'strider', name: 'Strider', category: 'Passiv', icon: '🦵' },
  { id: 'tadpole', name: 'Kaulquappe', category: 'Passiv', icon: '🐸' },
  { id: 'tropical_fish', name: 'Tropenfisch', category: 'Passiv', icon: '🐠' },
  { id: 'turtle', name: 'Schildkröte', category: 'Passiv', icon: '🐢' },
  { id: 'villager', name: 'Dorfbewohner', category: 'Passiv', icon: '🧑' },
  { id: 'wandering_trader', name: 'Wandernder Händler', category: 'Passiv', icon: '🧑‍🌾' },

  // Neutral
  { id: 'bee', name: 'Biene', category: 'Neutral', icon: '🐝' },
  { id: 'dolphin', name: 'Delfin', category: 'Neutral', icon: '🐬' },
  { id: 'goat', name: 'Ziege', category: 'Neutral', icon: '🐐' },
  { id: 'iron_golem', name: 'Eisengolem', category: 'Neutral', icon: '🗿' },
  { id: 'llama', name: 'Lama', category: 'Neutral', icon: '🦙' },
  { id: 'panda', name: 'Panda', category: 'Neutral', icon: '🐼' },
  { id: 'piglin', name: 'Piglin', category: 'Neutral', icon: '🐷' },
  { id: 'polar_bear', name: 'Eisbär', category: 'Neutral', icon: '🐻‍❄️' },
  { id: 'trader_llama', name: 'Händler-Lama', category: 'Neutral', icon: '🦙' },
  { id: 'wolf', name: 'Wolf', category: 'Neutral', icon: '🐺' },
  { id: 'zombified_piglin', name: 'Zombifizierter Piglin', category: 'Neutral', icon: '🧟' },

  // Feindlich
  { id: 'blaze', name: 'Lohe', category: 'Feindlich', icon: '🔥' },
  { id: 'bogged', name: 'Bogged', category: 'Feindlich', icon: '🏹' },
  { id: 'breeze', name: 'Breeze', category: 'Feindlich', icon: '🌪️' },
  { id: 'cave_spider', name: 'Höhlenspinne', category: 'Feindlich', icon: '🕷️' },
  { id: 'creeper', name: 'Creeper', category: 'Feindlich', icon: '💚' },
  { id: 'drowned', name: 'Ertrunkener', category: 'Feindlich', icon: '🧟' },
  { id: 'elder_guardian', name: 'Älterer Wächter', category: 'Feindlich', icon: '🐡' },
  { id: 'endermite', name: 'Endermilbe', category: 'Feindlich', icon: '🐛' },
  { id: 'evoker', name: 'Beschwörer', category: 'Feindlich', icon: '🧙' },
  { id: 'ghast', name: 'Ghast', category: 'Feindlich', icon: '👻' },
  { id: 'guardian', name: 'Wächter', category: 'Feindlich', icon: '🐡' },
  { id: 'hoglin', name: 'Hoglin', category: 'Feindlich', icon: '🐗' },
  { id: 'husk', name: 'Husk', category: 'Feindlich', icon: '🧟' },
  { id: 'magma_cube', name: 'Magmawürfel', category: 'Feindlich', icon: '🟧' },
  { id: 'phantom', name: 'Phantom', category: 'Feindlich', icon: '👤' },
  { id: 'pillager', name: 'Plünderer', category: 'Feindlich', icon: '🏹' },
  { id: 'ravager', name: 'Verwüster', category: 'Feindlich', icon: '🐗' },
  { id: 'shulker', name: 'Shulker', category: 'Feindlich', icon: '📦' },
  { id: 'silverfish', name: 'Silberfischchen', category: 'Feindlich', icon: '🐛' },
  { id: 'skeleton', name: 'Skelett', category: 'Feindlich', icon: '💀' },
  { id: 'slime', name: 'Schleim', category: 'Feindlich', icon: '🟢' },
  { id: 'spider', name: 'Spinne', category: 'Feindlich', icon: '🕷️' },
  { id: 'stray', name: 'Eisskelett', category: 'Feindlich', icon: '💀' },
  { id: 'vex', name: 'Plagegeist', category: 'Feindlich', icon: '👹' },
  { id: 'vindicator', name: 'Gesetzeshüter', category: 'Feindlich', icon: '🪓' },
  { id: 'witch', name: 'Hexe', category: 'Feindlich', icon: '🧙‍♀️' },
  { id: 'wither_skeleton', name: 'Witherskelett', category: 'Feindlich', icon: '💀' },
  { id: 'zoglin', name: 'Zoglin', category: 'Feindlich', icon: '🐗' },
  { id: 'zombie', name: 'Zombie', category: 'Feindlich', icon: '🧟' },
  { id: 'zombie_villager', name: 'Zombiedorfbewohner', category: 'Feindlich', icon: '🧟' },

  // Boss
  { id: 'ender_dragon', name: 'Enderdrache', category: 'Boss', icon: '🐉' },
  { id: 'wither', name: 'Wither', category: 'Boss', icon: '💀' },
  { id: 'warden', name: 'Warden', category: 'Boss', icon: '👁️' },
]

export const MOB_CATEGORIES: MobCategory[] = ['Passiv', 'Neutral', 'Feindlich', 'Boss']

export function getMobById(id: string): MobEntry | undefined {
  return ALL_MOBS.find(m => m.id === id)
}