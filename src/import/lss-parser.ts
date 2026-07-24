// ============================================================================
// Long Story Short (LSS) JSON Parser
// ============================================================================
// Parses LSS export JSON format into CharacterSheet.
// Reference: Section 2.3 of dnd-combat-tracker-plan.md
//
// LSS field mappings:
// - LSS `data` is a JSON string field inside each array element
// - Russian stat keys: сила/ловкость/выносливость/интеллект/мудрость/харизма
//   → str/dex/con/int/wis/cha
// ============================================================================

import { createId } from '../types/index.js';
import type {
  CharacterSheet,
  DndStat,
  SpellList,
  SpellRef,
  Resource,
  Item,
  DeathSaves,
  LssParseResult,
} from '../types/index.js';

// ─── Russian stat key mapping ────────────────────────────────────────────────
const STAT_MAP: Record<string, DndStat> = {
  str: 'str',
  сила: 'str',
  dex: 'dex',
  ловкость: 'dex',
  con: 'con',
  выносливость: 'con',
  int: 'int',
  интеллект: 'int',
  wis: 'wis',
  мудрость: 'wis',
  cha: 'cha',
  харизма: 'cha',
};

// ─── LSS Data Shape (after JSON.parse of the `data` field) ───────────────────

interface LssData {
  jsonType?: string;
  template?: string;
  name?: { value?: string };
  info?: {
    charClass?: { value?: string };
    charSubclass?: { value?: string };
    level?: { value?: number };
    background?: { value?: string };
    playerName?: { value?: string };
    race?: { value?: string };
    alignment?: { value?: string };
    experience?: { value?: number };
  };
  stats?: Record<
    string,
    {
      score?: number;
      modifier?: number;
      race?: number;
      check?: number;
    }
  >;
  vitality?: {
    'hp-max'?: { value?: number };
    'hp-current'?: { value?: number };
    'hp-temp'?: { value?: number };
    ac?: { value?: number };
    speed?: { value?: number };
    'hit-die'?: { value?: string };
    'hp-dice-current'?: { value?: number };
    isDying?: boolean;
    deathFails?: number;
    deathSuccesses?: number;
    darkvision?: { value?: number };
    shield?: { value?: boolean };
    initiative?: { value?: number | null };
  };
  saves?: Record<
    string,
    {
      isProf?: boolean;
    }
  >;
  proficiency?: number;
  skills?: Record<
    string,
    {
      isProf?: number;
      baseStat?: string;
      name?: string;
    }
  >;
  spells?: Record<string, { value?: number; filled?: number }>;
  spellsPact?: Record<string, { value?: number }>;
  spellsInfo?: {
    base?: { value?: string; code?: string };
    save?: { value?: string; customModifier?: number };
    mod?: { value?: string; customModifier?: number };
    available?: { classes?: string[] };
  };
  resources?: Record<
    string,
    {
      value?: number;
      max?: number;
      label?: string;
    }
  >;
  weaponsList?: Array<{
    id?: string;
    name?: { value?: string };
    mod?: { value?: string };
    dmg?: { value?: string };
  }>;
  attunementsList?: Array<{
    id?: string;
    checked?: boolean;
    value?: string;
  }>;
  coins?: Record<
    string,
    {
      value?: number;
    }
  >;
  features?: Array<{ name?: string; description?: string }>;
  traits?: Array<{ name?: string; description?: string }>;
  proficiencies?: string[];
  inventory?: Array<{
    name?: string;
    quantity?: number;
    description?: string;
  }>;
}

// ─── Top-level LSS export item ───────────────────────────────────────────────

interface LssExportItem {
  id?: string;
  edition?: string;
  data?: string;
  tags?: string[];
  spells?: {
    mode?: string;
    prepared?: string[];
    book?: string[];
  };
}

// ─── parseCharacter ──────────────────────────────────────────────────────────
// Parses a single LSS export item into a CharacterSheet.
export function parseCharacter(input: string | LssExportItem): LssParseResult {
  try {
    let item: LssExportItem;

    if (typeof input === 'string') {
      const parsed = JSON.parse(input);
      // Handle array: take first element
      if (Array.isArray(parsed)) {
        if (parsed.length === 0) {
          return { success: false, errors: ['Empty LSS export array'] };
        }
        item = parsed[0] as LssExportItem;
      } else {
        item = parsed as LssExportItem;
      }
    } else {
      item = input;
    }

    if (!item.data) {
      return { success: false, errors: ['Missing "data" field in LSS export'] };
    }

    const data: LssData = JSON.parse(item.data);

    // ─── Required fields validation ──────────────────────────────────
    const errors: string[] = [];
    if (!data.name?.value) errors.push('Missing name.value');
    if (!data.info?.charClass?.value) errors.push('Missing info.charClass.value');
    if (!data.info?.level?.value) errors.push('Missing info.level.value');
    if (!data.stats) errors.push('Missing stats');
    if (!data.vitality?.['hp-max']?.value) errors.push('Missing vitality.hp-max.value');
    if (!data.vitality?.ac?.value) errors.push('Missing vitality.ac.value');

    if (errors.length > 0) {
      return { success: false, errors };
    }

    // ─── Parse stats ─────────────────────────────────────────────────
    const stats: Record<DndStat, number> = {
      str: 10,
      dex: 10,
      con: 10,
      int: 10,
      wis: 10,
      cha: 10,
    };

    if (data.stats) {
      for (const [key, val] of Object.entries(data.stats)) {
        const mapped = STAT_MAP[key.toLowerCase()];
        if (mapped && val?.score !== undefined) {
          stats[mapped] = val.score;
        }
      }
    }

    // ─── Parse saving throws ─────────────────────────────────────────
    const savingThrows: Partial<Record<DndStat, number>> = {};
    if (data.saves) {
      const pb = data.proficiency ?? 3;
      for (const [key, val] of Object.entries(data.saves)) {
        const mapped = STAT_MAP[key.toLowerCase()];
        if (mapped && val?.isProf) {
          savingThrows[mapped] = stats[mapped] + ((stats[mapped] - 10) >> 1) + pb;
        }
      }
    }

    // ─── Parse skills ─────────────────────────────────────────────────
    const skills: Record<string, number> = {};
    if (data.skills) {
      const pb = data.proficiency ?? 3;
      for (const [key, val] of Object.entries(data.skills)) {
        if (val?.isProf) {
          const baseStat = val.baseStat
            ? STAT_MAP[val.baseStat.toLowerCase()] ?? 'dex'
            : 'dex';
          const statMod = (stats[baseStat] - 10) >> 1;
          skills[key] = statMod + pb;
        }
      }
    }

    // ─── Parse spells ─────────────────────────────────────────────────
    const spellList: SpellList = {
      spellcastingAbility: 'cha',
      spellSaveDC: 8 + (data.proficiency ?? 3) + ((stats.cha - 10) >> 1),
      spellAttackBonus: (data.proficiency ?? 3) + ((stats.cha - 10) >> 1),
      slots: {},
      preparedSpells: [],
      knownSpells: [],
    };

    // Spell slots
    if (data.spells) {
      for (const [key, val] of Object.entries(data.spells)) {
        const match = key.match(/^slots-(\d+)$/);
        if (match) {
          const level = parseInt(match[1], 10);
          const total = val?.value ?? 0;
          const used = val?.filled ?? 0;
          if (level > 0) {
            spellList.slots[level] = { total, used };
          }
        }
      }
    }

    // Pact magic slots
    if (data.spellsPact) {
      for (const [key, val] of Object.entries(data.spellsPact)) {
        const match = key.match(/^slots-(\d+)$/);
        if (match) {
          const level = parseInt(match[1], 10);
          const total = val?.value ?? 0;
          if (level > 0) {
            spellList.slots[level] = { total, used: 0 };
          }
        }
      }
    }

    // Spellcasting ability
    if (data.spellsInfo?.base?.code) {
      const mapped = STAT_MAP[data.spellsInfo.base.code.toLowerCase()];
      if (mapped) {
        spellList.spellcastingAbility = mapped;
        const baseStat = stats[mapped];
        const profBonus = data.proficiency ?? 3;
        if (data.spellsInfo.save?.customModifier) {
          spellList.spellSaveDC = data.spellsInfo.save.customModifier;
        } else {
          spellList.spellSaveDC = 8 + profBonus + ((baseStat - 10) >> 1);
        }
        if (data.spellsInfo.mod?.customModifier) {
          spellList.spellAttackBonus = data.spellsInfo.mod.customModifier;
        } else {
          spellList.spellAttackBonus = profBonus + ((baseStat - 10) >> 1);
        }
      }
    }

    // Prepared spells from the parent item
    if (item.spells?.prepared) {
      spellList.preparedSpells = item.spells.prepared.map((id) => ({
        id,
        name: `spell_${id}`,
        level: 0,
        school: '',
        isPrepared: true,
      }));
    }

    // ─── Parse resources ─────────────────────────────────────────────
    const resources: Resource[] = [];
    if (data.resources) {
      for (const [key, val] of Object.entries(data.resources)) {
        if (val?.max && val.max > 0) {
          resources.push({
            id: createId(),
            name: val.label ?? key,
            max: val.max,
            current: val.value ?? val.max,
            shortRestReset: false,
            longRestReset: true,
          });
        }
      }
    }

    // ─── Parse inventory ─────────────────────────────────────────────
    const inventory: Item[] = [];
    if (data.weaponsList) {
      for (const weapon of data.weaponsList) {
        if (weapon.name?.value) {
          inventory.push({
            id: weapon.id ?? createId(),
            name: weapon.name.value,
            quantity: 1,
            description: `Mod: ${weapon.mod?.value ?? '+0'}, Dmg: ${weapon.dmg?.value ?? ''}`,
            weight: 0,
            isMagical: false,
            isEquipped: true,
          });
        }
      }
    }

    // Attunements
    if (data.attunementsList) {
      for (const att of data.attunementsList) {
        if (att.value) {
          inventory.push({
            id: att.id ?? createId(),
            name: att.value,
            quantity: 1,
            description: '',
            weight: 0,
            isMagical: true,
            isEquipped: att.checked ?? false,
          });
        }
      }
    }

    // ─── Parse death saves ──────────────────────────────────────────
    const deathsaves: DeathSaves = {
      successes: data.vitality?.deathSuccesses ?? 0,
      failures: data.vitality?.deathFails ?? 0,
      isStable: data.vitality?.isDying ? false : true,
    };

    // ─── Build CharacterSheet ───────────────────────────────────────
    const character: CharacterSheet = {
      id: item.id ?? createId(),
      name: data.name?.value ?? 'Unknown',
      race: data.info?.race?.value ?? '',
      class: [data.info?.charClass?.value ?? 'Unknown'],
      level: data.info?.level?.value ?? 1,
      stats,
      savingThrows,
      skills,
      ac: data.vitality?.ac?.value ?? 10,
      maxHp: data.vitality?.['hp-max']?.value ?? 10,
      currentHp: data.vitality?.['hp-current']?.value ?? 0,
      tempHp: data.vitality?.['hp-temp']?.value ?? 0,
      speed: data.vitality?.speed?.value ?? 30,
      initiative: data.vitality?.initiative?.value ?? 0,
      spellList,
      resources,
      inventory,
      proficiencies: data.proficiencies ?? [],
      traits: [],
      features: [],
      deathsaves,
      description: '',
      source: 'lss',
      lssRaw: data,
    };

    // ─── Parse features/traits if present ──────────────────────────
    if (data.features) {
      character.features = data.features
        .filter((f) => f.name)
        .map((f) => f.name!);
    }
    if (data.traits) {
      character.traits = data.traits
        .filter((t) => t.name)
        .map((t) => t.name!);
    }

    // Warn about missing fields
    if (!data.info?.race?.value) {
      console.warn('LSS Parser: Missing race field');
    }
    if (!data.vitality?.speed?.value) {
      console.warn('LSS Parser: Missing speed field, defaulting to 30');
    }

    return { success: true, character };
  } catch (err) {
    return {
      success: false,
      errors: [
        `Parse error: ${err instanceof Error ? err.message : String(err)}`,
      ],
    };
  }
}

// ─── exportCharacter ──────────────────────────────────────────────────────────
// Converts a CharacterSheet back to LSS JSON format (symmetrical with import).
// Key principle: export format == import format.
// If the character was imported from LSS (source === 'lss'), we preserve the
// original lssRaw data. Otherwise, we build an LSS-compatible structure.
export function exportCharacter(character: CharacterSheet): string {
  // Prefer original LSS raw data if available (round-trip preservation)
  if (character.source === 'lss' && character.lssRaw) {
    const lssRaw = character.lssRaw as Record<string, unknown>;
    // Update mutable fields in the original data
    if (lssRaw.vitality) {
      const v = lssRaw.vitality as Record<string, unknown>;
      if (v['hp-current']) (v['hp-current'] as Record<string, unknown>).value = character.currentHp;
      if (v['hp-temp']) (v['hp-temp'] as Record<string, unknown>).value = character.tempHp;
      if (v['hp-max']) (v['hp-max'] as Record<string, unknown>).value = character.maxHp;
      // Death saves
      (v as Record<string, unknown>).isDying = character.currentHp <= 0;
      (v as Record<string, unknown>).deathFails = character.deathsaves.failures;
      (v as Record<string, unknown>).deathSuccesses = character.deathsaves.successes;
    }
    if (lssRaw.spells && character.spellList) {
      for (const [level, slot] of Object.entries(character.spellList.slots)) {
        const key = `slots-${level}`;
        if (!(lssRaw.spells as Record<string, unknown>)[key]) {
          (lssRaw.spells as Record<string, unknown>)[key] = { value: 0, filled: 0 };
        }
        const s = (lssRaw.spells as Record<string, unknown>)[key] as Record<string, unknown>;
        s.value = slot.total;
        s.filled = slot.used;
      }
    }
    // Rebuild the top-level item
    const exportItem: Record<string, unknown> = {
      tags: [],
      disabledBlocks: {},
      edition: '2024',
      spells: { mode: 'cards', prepared: [], book: [], edition: '2024' },
      data: JSON.stringify(lssRaw),
    };
    return JSON.stringify(exportItem, null, 2);
  }

  // Build from scratch (manual character or no lssRaw)
  const data: Record<string, unknown> = {
    jsonType: 'character',
    template: 'default',
    name: { value: character.name },
    info: {
      charClass: { name: 'charClass', value: character.class[0] || '' },
      charSubclass: { name: 'charSubclass', value: '' },
      level: { name: 'level', value: character.level },
      background: { name: 'background', value: '' },
      playerName: { name: 'playerName', value: '' },
      race: { name: 'race', value: character.race },
      alignment: { name: 'alignment', value: '' },
      experience: { name: 'experience', value: 0 },
    },
    subInfo: {},
    spellsInfo: {
      base: { name: 'base', value: '', code: character.spellList?.spellcastingAbility || 'cha' },
      save: { name: 'save', value: '', customModifier: character.spellList?.spellSaveDC || 10 },
      mod: { name: 'mod', value: '', customModifier: character.spellList?.spellAttackBonus || 5 },
      available: { classes: [character.class[0]?.toLowerCase() || ''] },
    },
    spells: {},
    spellsPact: {},
    bonuses: [],
    proficiency: 2,
    stats: {},
    saves: {},
    skills: {},
    vitality: {
      'hp-max': { value: character.maxHp },
      'hp-current': { value: character.currentHp },
      'hp-temp': { value: character.tempHp },
      ac: { value: character.ac },
      speed: { value: character.speed },
      'hit-die': { value: 'd8' },
      'hp-dice-current': { value: 0 },
      isDying: character.currentHp <= 0,
      deathFails: character.deathsaves.failures,
      deathSuccesses: character.deathsaves.successes,
    },
    weaponsList: [],
    attunementsList: [],
    coins: { gp: { value: 0 }, sp: { value: 0 }, cp: { value: 0 }, pp: { value: 0 }, ep: { value: 0 } },
    resources: {},
    proficiencies: character.proficiencies || [],
    features: character.features?.map((f: string) => ({ name: f, description: '' })) || [],
    traits: character.traits?.map((t: string) => ({ name: t, description: '' })) || [],
  };

  // Stats
  const statKeys: DndStat[] = ['str', 'dex', 'con', 'int', 'wis', 'cha'];
  for (const s of statKeys) {
    (data.stats as Record<string, unknown>)[s] = {
      name: s, score: character.stats[s], modifier: Math.floor((character.stats[s] - 10) / 2), race: 0,
    };
  }

  // Saving throws
  for (const s of statKeys) {
    (data.saves as Record<string, unknown>)[s] = { name: s, isProf: character.savingThrows[s] !== undefined };
  }

  // Spell slots
  if (character.spellList?.slots) {
    for (const [level, slot] of Object.entries(character.spellList.slots)) {
      (data.spells as Record<string, unknown>)[`slots-${level}`] = { value: slot.total, filled: slot.used };
    }
  }

  // Inventory
  if (character.inventory) {
    for (const item of character.inventory) {
      if (item.isMagical) {
        (data.attunementsList as Array<unknown>).push({
          id: `attunement-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          checked: item.isEquipped,
          value: item.name,
        });
      } else {
        (data.weaponsList as Array<unknown>).push({
          id: `weapon-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          name: { value: item.name },
          mod: { value: '+0' },
          dmg: { value: item.description || '' },
        });
      }
    }
  }

  const exportItem: Record<string, unknown> = {
    tags: [],
    disabledBlocks: {},
    edition: '2024',
    spells: { mode: 'cards', prepared: [], book: [], edition: '2024' },
    data: JSON.stringify(data),
  };

  return JSON.stringify(exportItem, null, 2);
}

// ─── parseMultiple ───────────────────────────────────────────────────────────
// Parses an array of LSS export items.
export function parseMultiple(
  input: string | LssExportItem[]
): LssParseResult[] {
  try {
    let items: LssExportItem[];

    if (typeof input === 'string') {
      const parsed = JSON.parse(input);
      if (Array.isArray(parsed)) {
        items = parsed as LssExportItem[];
      } else {
        items = [parsed as LssExportItem];
      }
    } else {
      items = input;
    }

    return items.map((item) => parseCharacter(item));
  } catch (err) {
    return [
      {
        success: false,
        errors: [
          `Parse error: ${err instanceof Error ? err.message : String(err)}`,
        ],
      },
    ];
  }
}