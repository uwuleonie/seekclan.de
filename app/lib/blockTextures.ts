// Mapping von Block-ID (großgeschrieben, wie in smp_block_stats) zu Textur-Dateiname (ohne .png)
// Texturen liegen unter public/block-textures/<dateiname>.png
// Wenn kein Eintrag vorhanden: direkt id.toLowerCase() als Dateiname versuchen
export const BLOCK_TEXTURE_MAP: Record<string, string> = {
  // ===== Holz =====
  // Türen → obere Hälfte
  OAK_DOOR: 'oak_door_top',
  BIRCH_DOOR: 'birch_door_top',
  SPRUCE_DOOR: 'spruce_door_top',
  JUNGLE_DOOR: 'jungle_door_top',
  ACACIA_DOOR: 'acacia_door_top',
  DARK_OAK_DOOR: 'dark_oak_door_top',
  MANGROVE_DOOR: 'mangrove_door_top',
  CHERRY_DOOR: 'cherry_door_top',
  BAMBOO_DOOR: 'bamboo_door_top',
  CRIMSON_DOOR: 'crimson_door_top',
  WARPED_DOOR: 'warped_door_top',
  // Holz (Rinde-Block) → Seitentextur des Stamms
  OAK_WOOD: 'oak_log',
  BIRCH_WOOD: 'birch_log',
  SPRUCE_WOOD: 'spruce_log',
  JUNGLE_WOOD: 'jungle_log',
  ACACIA_WOOD: 'acacia_log',
  DARK_OAK_WOOD: 'dark_oak_log',
  MANGROVE_WOOD: 'mangrove_log',
  CHERRY_WOOD: 'cherry_log',
  // Stufen/Treppen/Zäune → Planken-Textur
  OAK_SLAB: 'oak_planks',
  OAK_STAIRS: 'oak_planks',
  OAK_FENCE: 'oak_planks',
  OAK_FENCE_GATE: 'oak_planks',
  BIRCH_SLAB: 'birch_planks',
  BIRCH_STAIRS: 'birch_planks',
  BIRCH_FENCE: 'birch_planks',
  SPRUCE_SLAB: 'spruce_planks',
  SPRUCE_STAIRS: 'spruce_planks',
  SPRUCE_FENCE: 'spruce_planks',
  JUNGLE_SLAB: 'jungle_planks',
  JUNGLE_STAIRS: 'jungle_planks',
  JUNGLE_FENCE: 'jungle_planks',
  ACACIA_SLAB: 'acacia_planks',
  ACACIA_STAIRS: 'acacia_planks',
  ACACIA_FENCE: 'acacia_planks',
  DARK_OAK_SLAB: 'dark_oak_planks',
  DARK_OAK_STAIRS: 'dark_oak_planks',
  DARK_OAK_FENCE: 'dark_oak_planks',
  MANGROVE_SLAB: 'mangrove_planks',
  MANGROVE_STAIRS: 'mangrove_planks',
  CHERRY_SLAB: 'cherry_planks',
  CHERRY_STAIRS: 'cherry_planks',
  BAMBOO: 'bamboo_stalk',
  BAMBOO_MOSAIC: 'bamboo_planks',

  // ===== Stein & Erden =====
  GRASS_BLOCK: 'grass_block_side',
  PODZOL: 'podzol_side',
  STONE_SLAB: 'stone',
  STONE_STAIRS: 'stone',
  SMOOTH_SANDSTONE: 'sandstone_top',
  SMOOTH_RED_SANDSTONE: 'red_sandstone_top',
  SMOOTH_QUARTZ: 'quartz_block_top',
  SNOW_BLOCK: 'snow',
  MOSS_CARPET: 'moss_block',
  GLAZED_TERRACOTTA: 'white_glazed_terracotta',
  BASALT: 'basalt_side',
  POLISHED_BASALT: 'polished_basalt_side',

  // ===== Erze & Edelsteine =====
  ANCIENT_DEBRIS: 'ancient_debris_side',

  // ===== Natur & Pflanzen =====
  CACTUS: 'cactus_side',
  LARGE_FERN: 'large_fern_top',
  TALL_GRASS: 'tall_grass_top',
  SUNFLOWER: 'sunflower_front',
  LILAC: 'lilac_top',
  ROSE_BUSH: 'rose_bush_top',
  PEONY: 'peony_top',
  PITCHER_PLANT: 'pitcher_crop_top',
  SWEET_BERRY_BUSH: 'sweet_berry_bush_stage3',
  WHEAT: 'wheat_stage7',
  CARROTS: 'carrots_stage3',
  POTATOES: 'potatoes_stage3',
  BEETROOTS: 'beetroots_stage3',
  MELON: 'melon_side',
  PUMPKIN: 'pumpkin_side',
  COCOA: 'cocoa_stage2',
  NETHER_WART: 'nether_wart_stage2',
  BIG_DRIPLEAF: 'big_dripleaf_top',
  SMALL_DRIPLEAF: 'small_dripleaf_top',
  MAGMA_BLOCK: 'magma',
  SCULK_CATALYST: 'sculk_catalyst_side',
  SCULK_SENSOR: 'sculk_sensor_side',
  SCULK_SHRIEKER: 'sculk_shrieker_top',
  MANGROVE_ROOTS: 'mangrove_roots_side',

  // ===== Nether =====
  QUARTZ_BLOCK: 'quartz_block_side',
  BASALT_SIDE: 'basalt_side',
  BONE_BLOCK: 'bone_block_side',
  NETHER_WART_BLOCK: 'nether_wart_block',

  // ===== Sonstiges =====
  CHEST: 'oak_planks',          // Truhe hat keine einfache Textur → Eichenplanken als Annäherung
  TRAPPED_CHEST: 'oak_planks',
  HAY_BLOCK: 'hay_block_side',
  HONEY_BLOCK: 'honey_block_side',
  BARREL: 'barrel_side',
  FURNACE: 'furnace_front',
  BLAST_FURNACE: 'blast_furnace_front',
  SMOKER: 'smoker_front',
  CRAFTING_TABLE: 'crafting_table_top',
  CARTOGRAPHY_TABLE: 'cartography_table_top',
  FLETCHING_TABLE: 'fletching_table_top',
  SMITHING_TABLE: 'smithing_table_top',
  STONECUTTER: 'stonecutter_top',
  LOOM: 'loom_front',
  COMPOSTER: 'composter_top',
  LECTERN: 'lectern_top',
  ENCHANTING_TABLE: 'enchanting_table_top',
  OBSERVER: 'observer_front',
  PISTON: 'piston_top',
  TARGET: 'target_top',
  TNT: 'tnt_side',
  SCAFFOLDING: 'scaffolding_top',
  LODESTONE: 'lodestone_top',
  CHISELED_BOOKSHELF: 'chiseled_bookshelf_top',
  SUSPICIOUS_SAND: 'suspicious_sand_0',
  SUSPICIOUS_GRAVEL: 'suspicious_gravel_0',
  // Wolle & Teppich → direkte Namens-Datei (white_wool, red_wool, etc. sind direkt vorhanden)
  WHITE_CARPET: 'white_wool',
  PURPUR_STAIRS: 'purpur_block',
  TULIP: 'orange_tulip',        // Generischer Tulpen-Fallback
}

// Gibt den Textur-Dateinamen für eine Block-ID zurück (ohne .png, ohne Pfad).
// Fallback: id.toLowerCase() (z.B. 'STONE' -> 'stone')
export function getBlockTexture(blockId: string): string {
  return BLOCK_TEXTURE_MAP[blockId] ?? blockId.toLowerCase()
}