// ============================================================================
// LSS Parser — Unit Tests
// ============================================================================

import { describe, it, expect } from 'vitest';
import { parseCharacter, parseMultiple } from '../src/import/lss-parser';

// ─── Minimal valid LSS fixture ───────────────────────────────────────────────

const MINIMAL_LSS_JSON = JSON.stringify([
  {
    data: JSON.stringify({
      name: { value: 'Test Hero' },
      info: {
        charClass: { value: 'Fighter' },
        level: { value: 5 },
      },
      stats: {
        str: { score: 16 },
        dex: { score: 14 },
        con: { score: 15 },
        int: { score: 10 },
        wis: { score: 12 },
        cha: { score: 8 },
      },
      vitality: {
        'hp-max': { value: 50 },
        'hp-current': { value: 50 },
        ac: { value: 18 },
        speed: { value: 30 },
      },
      proficiency: 3,
    }),
  },
]);

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('parseCharacter', () => {
  it('with valid LSS JSON string returns { success: true, character }', () => {
    const result = parseCharacter(MINIMAL_LSS_JSON);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.character).toBeDefined();
      expect(result.character.name).toBe('Test Hero');
    }
  });

  it('with minimal valid data (name, class, level, stats, hp, ac)', () => {
    const result = parseCharacter(MINIMAL_LSS_JSON);
    expect(result.success).toBe(true);
    if (result.success) {
      const ch = result.character;
      expect(ch.name).toBe('Test Hero');
      expect(ch.class).toEqual(['Fighter']);
      expect(ch.level).toBe(5);
      expect(ch.stats.str).toBe(16);
      expect(ch.stats.dex).toBe(14);
      expect(ch.stats.con).toBe(15);
      expect(ch.stats.int).toBe(10);
      expect(ch.stats.wis).toBe(12);
      expect(ch.stats.cha).toBe(8);
      expect(ch.maxHp).toBe(50);
      expect(ch.ac).toBe(18);
    }
  });

  it('parses Russian stat keys (сила→str, ловкость→dex)', () => {
    const russianLss = JSON.stringify([
      {
        data: JSON.stringify({
          name: { value: 'Russian Hero' },
          info: {
            charClass: { value: 'Wizard' },
            level: { value: 3 },
          },
          stats: {
            сила: { score: 15 },
            ловкость: { score: 14 },
            выносливость: { score: 13 },
            интеллект: { score: 18 },
            мудрость: { score: 10 },
            харизма: { score: 8 },
          },
          vitality: {
            'hp-max': { value: 30 },
            'hp-current': { value: 30 },
            ac: { value: 14 },
            speed: { value: 30 },
          },
          proficiency: 2,
        }),
      },
    ]);
    const result = parseCharacter(russianLss);
    expect(result.success).toBe(true);
    if (result.success) {
      const ch = result.character;
      expect(ch.stats.str).toBe(15);
      expect(ch.stats.dex).toBe(14);
      expect(ch.stats.con).toBe(13);
      expect(ch.stats.int).toBe(18);
      expect(ch.stats.wis).toBe(10);
      expect(ch.stats.cha).toBe(8);
    }
  });

  it('returns errors for missing required fields (missing name)', () => {
    const noNameLss = JSON.stringify([
      {
        data: JSON.stringify({
          info: {
            charClass: { value: 'Fighter' },
            level: { value: 5 },
          },
          stats: { str: { score: 10 } },
          vitality: {
            'hp-max': { value: 50 },
            ac: { value: 18 },
          },
        }),
      },
    ]);
    const result = parseCharacter(noNameLss);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.some((e) => e.includes('name'))).toBe(true);
    }
  });

  it('returns errors for missing required fields (missing stats)', () => {
    const noStatsLss = JSON.stringify([
      {
        data: JSON.stringify({
          name: { value: 'Hero' },
          info: {
            charClass: { value: 'Fighter' },
            level: { value: 5 },
          },
          vitality: {
            'hp-max': { value: 50 },
            ac: { value: 18 },
          },
        }),
      },
    ]);
    const result = parseCharacter(noStatsLss);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.some((e) => e.includes('stats'))).toBe(true);
    }
  });

  it('handles LSS array format (takes first element)', () => {
    const multiLss = JSON.stringify([
      {
        data: JSON.stringify({
          name: { value: 'First Hero' },
          info: { charClass: { value: 'Rogue' }, level: { value: 1 } },
          stats: { str: { score: 10 } },
          vitality: { 'hp-max': { value: 10 }, ac: { value: 14 } },
          proficiency: 2,
        }),
      },
      {
        data: JSON.stringify({
          name: { value: 'Second Hero' },
          info: { charClass: { value: 'Wizard' }, level: { value: 1 } },
          stats: { str: { score: 10 } },
          vitality: { 'hp-max': { value: 10 }, ac: { value: 12 } },
          proficiency: 2,
        }),
      },
    ]);
    const result = parseCharacter(multiLss);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.character.name).toBe('First Hero');
    }
  });

  it('handles LssExportItem object directly', () => {
    const item = {
      data: JSON.stringify({
        name: { value: 'Direct Object' },
        info: { charClass: { value: 'Cleric' }, level: { value: 2 } },
        stats: { str: { score: 12 } },
        vitality: { 'hp-max': { value: 20 }, ac: { value: 16 } },
        proficiency: 2,
      }),
    };
    const result = parseCharacter(item);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.character.name).toBe('Direct Object');
    }
  });

  it('parsed character has correct structure: CharacterSheet with id, name, class[], level, stats, ac, maxHp, speed', () => {
    const result = parseCharacter(MINIMAL_LSS_JSON);
    expect(result.success).toBe(true);
    if (result.success) {
      const ch = result.character;
      expect(ch.id).toBeTruthy();
      expect(typeof ch.id).toBe('string');
      expect(ch.name).toBe('Test Hero');
      expect(Array.isArray(ch.class)).toBe(true);
      expect(ch.level).toBe(5);
      expect(ch.stats).toBeDefined();
      expect(typeof ch.ac).toBe('number');
      expect(typeof ch.maxHp).toBe('number');
      expect(typeof ch.speed).toBe('number');
      expect(ch.speed).toBe(30);
    }
  });

  it('parsed character has source: "lss"', () => {
    const result = parseCharacter(MINIMAL_LSS_JSON);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.character.source).toBe('lss');
    }
  });

  it('empty array returns { success: false, errors: ["Empty LSS export array"] }', () => {
    const emptyLss = JSON.stringify([]);
    const result = parseCharacter(emptyLss);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors).toContain('Empty LSS export array');
    }
  });

  it('parses additional fields: race, currentHp, tempHp, initiative, resources, inventory', () => {
    const richLss = JSON.stringify([
      {
        data: JSON.stringify({
          name: { value: 'Rich Hero' },
          info: {
            charClass: { value: 'Paladin' },
            level: { value: 6 },
            race: { value: 'Human' },
          },
          stats: {
            str: { score: 18 },
            dex: { score: 10 },
            con: { score: 16 },
            int: { score: 8 },
            wis: { score: 12 },
            cha: { score: 16 },
          },
          vitality: {
            'hp-max': { value: 60 },
            'hp-current': { value: 45 },
            'hp-temp': { value: 5 },
            ac: { value: 20 },
            speed: { value: 30 },
            initiative: { value: 2 },
          },
          proficiency: 3,
          resources: {
            'lay-on-hands': { value: 25, max: 25, label: 'Lay on Hands' },
          },
          weaponsList: [
            { name: { value: 'Longsword' }, mod: { value: '+7' }, dmg: { value: '1d8+4' } },
          ],
        }),
      },
    ]);
    const result = parseCharacter(richLss);
    expect(result.success).toBe(true);
    if (result.success) {
      const ch = result.character;
      expect(ch.race).toBe('Human');
      expect(ch.currentHp).toBe(45);
      expect(ch.tempHp).toBe(5);
      expect(ch.initiative).toBe(2);
      expect(ch.resources).toHaveLength(1);
      expect(ch.resources[0].name).toBe('Lay on Hands');
      expect(ch.inventory).toHaveLength(1);
      expect(ch.inventory[0].name).toBe('Longsword');
    }
  });
});

describe('parseMultiple', () => {
  it('parses an array of LSS items', () => {
    const multiLss = JSON.stringify([
      {
        data: JSON.stringify({
          name: { value: 'Hero 1' },
          info: { charClass: { value: 'Fighter' }, level: { value: 1 } },
          stats: { str: { score: 10 } },
          vitality: { 'hp-max': { value: 10 }, ac: { value: 10 } },
          proficiency: 2,
        }),
      },
      {
        data: JSON.stringify({
          name: { value: 'Hero 2' },
          info: { charClass: { value: 'Wizard' }, level: { value: 1 } },
          stats: { str: { score: 10 } },
          vitality: { 'hp-max': { value: 10 }, ac: { value: 10 } },
          proficiency: 2,
        }),
      },
    ]);
    const results = parseMultiple(multiLss);
    expect(results).toHaveLength(2);
    expect(results[0].success).toBe(true);
    expect(results[1].success).toBe(true);
    if (results[0].success && results[1].success) {
      expect(results[0].character.name).toBe('Hero 1');
      expect(results[1].character.name).toBe('Hero 2');
    }
  });
});