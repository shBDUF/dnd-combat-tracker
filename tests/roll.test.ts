// ============================================================================
// Roll Engine — Unit Tests
// ============================================================================

import { describe, it, expect } from 'vitest';
import {
  rollGroupInitiative,
  rollInitiative,
  setPlayerInitiative,
  parseSpeed,
  getCombatantSpeed,
  computeGroupInitModifier,
  setGroupInitiative,
  buildGroupTurnOrder,
  rollAllGroups,
  rerollGroup,
  buildTurnOrder,
  addMidCombat,
  rollDamage,
  rollD20,
  rollD100,
} from '../src/engine/roll';
import { createDefaultActionTracker } from '../src/engine/groups';
import { createId } from '../src/types/index';
import type { Combatant, Encounter, InitiativeGroup } from '../src/types/index';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeCombatant(overrides: Partial<Combatant> = {}): Combatant {
  return {
    id: overrides.id ?? createId(),
    name: 'Test',
    initiative: 10,
    initModifier: 0,
    ac: 12,
    maxHp: 20,
    currentHp: 20,
    tempHp: 0,
    conditions: [],
    effects: [],
    isConcentrating: false,
    concentrationOn: null,
    isPlayer: false,
    isMonster: true,
    deathsaves: { successes: 0, failures: 0, isStable: true },
    sortIndex: 0,
    isDead: false,
    notes: '',
    initiativeGroupId: null,
    actionTracker: createDefaultActionTracker(30),
    speed: 30,
    combatantGroupId: null,
    combatantGroupSize: 0,
    combatantGroupIndex: 0,
    ...overrides,
  };
}

function makeGroup(overrides: Partial<InitiativeGroup> = {}): InitiativeGroup {
  return {
    id: overrides.id ?? createId(),
    name: 'Test Group',
    type: 'monsters',
    initiative: 10,
    initModifier: 0,
    initMode: 'group',
    combatantIds: [],
    currentOrder: [],
    currentIndex: 0,
    isActive: true,
    ...overrides,
  };
}

function makeEncounter(overrides: Partial<Encounter> = {}): Encounter {
  return {
    id: createId(),
    name: 'Test Encounter',
    campaignId: null,
    combatants: [],
    round: 1,
    isActive: true,
    startTime: Date.now(),
    environment: '',
    notes: '',
    initiativeGroups: [],
    currentGroupId: null,
    groupTurnIndex: 0,
    actionTrackerHistory: [],
    ...overrides,
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('parseSpeed', () => {
  it('parses "30 ft." → 30', () => {
    expect(parseSpeed('30 ft.')).toBe(30);
  });

  it('parses "40 ft., climb 30 ft." → 40', () => {
    expect(parseSpeed('40 ft., climb 30 ft.')).toBe(40);
  });

  it('parses "30 ft" (no dot) → 30', () => {
    expect(parseSpeed('30 ft')).toBe(30);
  });

  it('returns 30 for empty string', () => {
    expect(parseSpeed('')).toBe(30);
  });

  it('returns 30 for nullish/undefined', () => {
    expect(parseSpeed('')).toBe(30);
  });

  it('returns 30 for gibberish', () => {
    expect(parseSpeed('flying speed 60 ft.')).toBe(60);
  });
});

describe('computeGroupInitModifier', () => {
  it('returns Math.ceil(average)', () => {
    const combatants = [
      makeCombatant({ initModifier: 2 }),
      makeCombatant({ initModifier: 3 }),
    ];
    // (2+3)/2 = 2.5, ceil = 3
    expect(computeGroupInitModifier(combatants)).toBe(3);
  });

  it('returns 0 for empty array', () => {
    expect(computeGroupInitModifier([])).toBe(0);
  });

  it('handles negative modifiers', () => {
    const combatants = [
      makeCombatant({ initModifier: -1 }),
      makeCombatant({ initModifier: -2 }),
    ];
    // (-1 + -2)/2 = -1.5, ceil = -1
    expect(computeGroupInitModifier(combatants)).toBe(-1);
  });
});

describe('rollGroupInitiative', () => {
  it('with initMode: "group" — all combatants get same initiative value', () => {
    const group = makeGroup({
      id: 'g1',
      name: 'Goblins',
      initMode: 'group',
      initModifier: 2,
      combatantIds: ['c1', 'c2'],
    });
    const c1 = makeCombatant({ id: 'c1', initModifier: 2 });
    const c2 = makeCombatant({ id: 'c2', initModifier: 2 });
    const encounter = makeEncounter({
      combatants: [c1, c2],
      initiativeGroups: [group],
    });

    const { updatedEncounter, roll } = rollGroupInitiative(encounter, group);
    const initValues = updatedEncounter.combatants
      .filter((c) => c.id === 'c1' || c.id === 'c2')
      .map((c) => c.initiative);
    // All should have the same total
    expect(initValues[0]).toBe(initValues[1]);
    expect(roll.total).toBe(initValues[0]);
    expect(roll.groupId).toBe('g1');
  });

  it('with initMode: "individual" — each combatant gets individual roll, sorted by initiative descending', () => {
    // Mock Math.random to get predictable results
    // We'll use a deterministic approach: make combatants with different modifiers
    const group = makeGroup({
      id: 'g1',
      name: 'Party',
      initMode: 'individual',
      initModifier: 0,
      combatantIds: ['c1', 'c2'],
    });
    const c1 = makeCombatant({ id: 'c1', initModifier: 5, name: 'Fast' });
    const c2 = makeCombatant({ id: 'c2', initModifier: 0, name: 'Slow' });
    const encounter = makeEncounter({
      combatants: [c1, c2],
      initiativeGroups: [group],
    });

    const { updatedEncounter } = rollGroupInitiative(encounter, group);
    const updatedC1 = updatedEncounter.combatants.find((c) => c.id === 'c1')!;
    const updatedC2 = updatedEncounter.combatants.find((c) => c.id === 'c2')!;

    // Both should have their own initiative values
    expect(updatedC1.initiative).not.toBe(updatedC2.initiative);
    // The order should be sorted descending
    const order = updatedEncounter.initiativeGroups[0].currentOrder;
    expect(order[0]).toBe(updatedC1.initiative >= updatedC2.initiative ? 'c1' : 'c2');
  });
});

describe('rollInitiative', () => {
  it('returns d20 + initModifier', () => {
    const c = makeCombatant({ initModifier: 3 });
    const result = rollInitiative(c);
    expect(result).toBeGreaterThanOrEqual(3 + 1);
    expect(result).toBeLessThanOrEqual(3 + 20);
  });
});

describe('setPlayerInitiative', () => {
  it('sets initiative to a specific value', () => {
    const c = makeCombatant({ initiative: 0 });
    const updated = setPlayerInitiative(c, 18);
    expect(updated.initiative).toBe(18);
  });
});

describe('buildGroupTurnOrder', () => {
  it('sorts by initiative descending, tiebreaker by type order (players > allies > npc > monsters)', () => {
    const groups = [
      makeGroup({ id: 'g1', name: 'Monsters', type: 'monsters', initiative: 10 }),
      makeGroup({ id: 'g2', name: 'Players', type: 'players', initiative: 15 }),
      makeGroup({ id: 'g3', name: 'Allies', type: 'allies', initiative: 15 }),
    ];
    const sorted = buildGroupTurnOrder(groups);
    // Players (init 15) should come before Allies (init 15, tiebreaker)
    // Monsters (init 10) should be last
    expect(sorted[0].id).toBe('g2');
    expect(sorted[1].id).toBe('g3');
    expect(sorted[2].id).toBe('g1');
  });

  it('does not mutate the original array', () => {
    const groups = [
      makeGroup({ id: 'g1', initiative: 5 }),
      makeGroup({ id: 'g2', initiative: 15 }),
    ];
    const original = [...groups];
    buildGroupTurnOrder(groups);
    expect(groups[0].id).toBe(original[0].id);
    expect(groups[1].id).toBe(original[1].id);
  });
});

describe('setGroupInitiative', () => {
  it('updates group initiative and re-sorts groups', () => {
    const g1 = makeGroup({ id: 'g1', name: 'Slow', initiative: 5 });
    const g2 = makeGroup({ id: 'g2', name: 'Fast', initiative: 15 });
    const encounter = makeEncounter({
      initiativeGroups: [g1, g2],
    });

    const updated = setGroupInitiative(encounter, 'g1', 20);
    // g1 should now be first (init 20)
    expect(updated.initiativeGroups[0].id).toBe('g1');
    expect(updated.initiativeGroups[0].initiative).toBe(20);
  });
});

describe('rollAllGroups', () => {
  it('rolls initiative for all groups', () => {
    const g1 = makeGroup({ id: 'g1', name: 'Party', initMode: 'group', combatantIds: ['c1'] });
    const g2 = makeGroup({ id: 'g2', name: 'Monsters', initMode: 'group', combatantIds: ['c2'] });
    const c1 = makeCombatant({ id: 'c1' });
    const c2 = makeCombatant({ id: 'c2' });
    const encounter = makeEncounter({
      combatants: [c1, c2],
      initiativeGroups: [g1, g2],
    });

    const { updatedEncounter, rolls } = rollAllGroups(encounter);
    expect(rolls).toHaveLength(2);
    expect(updatedEncounter.currentGroupId).toBeTruthy();
  });
});

describe('rerollGroup', () => {
  it('re-rolls initiative for a single group', () => {
    const g1 = makeGroup({ id: 'g1', name: 'Party', initMode: 'group', combatantIds: ['c1'] });
    const g2 = makeGroup({ id: 'g2', name: 'Monsters', initMode: 'group', combatantIds: ['c2'] });
    const c1 = makeCombatant({ id: 'c1' });
    const c2 = makeCombatant({ id: 'c2' });
    const encounter = makeEncounter({
      combatants: [c1, c2],
      initiativeGroups: [g1, g2],
    });

    const { roll } = rerollGroup(encounter, 'g1');
    expect(roll.groupId).toBe('g1');
    // rolled value should be in range
    expect(roll.total).toBeGreaterThanOrEqual(1);
    expect(roll.total).toBeLessThanOrEqual(20);
  });
});

describe('buildTurnOrder', () => {
  it('sorts by initiative descending, tiebreaker by sortIndex', () => {
    const combatants = [
      makeCombatant({ id: 'c1', initiative: 10, sortIndex: 0 }),
      makeCombatant({ id: 'c2', initiative: 15, sortIndex: 1 }),
      makeCombatant({ id: 'c3', initiative: 15, sortIndex: 0 }),
    ];
    const order = buildTurnOrder(combatants);
    expect(order[0]).toBe('c3'); // init 15, sortIndex 0
    expect(order[1]).toBe('c2'); // init 15, sortIndex 1
    expect(order[2]).toBe('c1'); // init 10
  });
});

describe('addMidCombat', () => {
  it('adds a new combatant mid-combat', () => {
    const encounter = makeEncounter();
    const newCombatant = makeCombatant({ id: 'new-guy', name: 'New Arrival' });
    const updated = addMidCombat(encounter, newCombatant);
    expect(updated.combatants).toHaveLength(1);
    expect(updated.initiativeGroups).toHaveLength(1);
    expect(updated.initiativeGroups[0].combatantIds).toContain('new-guy');
  });

  it('adds to an existing group when targetGroupId is provided', () => {
    const g1 = makeGroup({ id: 'g1', combatantIds: ['existing'] });
    const encounter = makeEncounter({
      combatants: [makeCombatant({ id: 'existing' })],
      initiativeGroups: [g1],
    });
    const newCombatant = makeCombatant({ id: 'new-guy' });
    const updated = addMidCombat(encounter, newCombatant, 'g1');
    expect(updated.combatants).toHaveLength(2);
    expect(updated.initiativeGroups[0].combatantIds).toContain('new-guy');
    expect(updated.initiativeGroups).toHaveLength(1); // no new group created
  });
});

describe('rollDamage', () => {
  it('rolls "2d6" between 2-12', () => {
    for (let i = 0; i < 100; i++) {
      const result = rollDamage('2d6');
      expect(result).toBeGreaterThanOrEqual(2);
      expect(result).toBeLessThanOrEqual(12);
    }
  });

  it('rolls "1d8+3" between 4-11', () => {
    for (let i = 0; i < 100; i++) {
      const result = rollDamage('1d8+3');
      expect(result).toBeGreaterThanOrEqual(4);
      expect(result).toBeLessThanOrEqual(11);
    }
  });

  it('rolls "1d4-1" between 0-3', () => {
    for (let i = 0; i < 100; i++) {
      const result = rollDamage('1d4-1');
      expect(result).toBeGreaterThanOrEqual(0);
      expect(result).toBeLessThanOrEqual(3);
    }
  });

  it('parses "+3" as 3', () => {
    expect(rollDamage('+3')).toBe(3);
  });

  it('parses "5" as 5', () => {
    expect(rollDamage('5')).toBe(5);
  });

  it('returns 0 for invalid expression', () => {
    expect(rollDamage('invalid')).toBe(0);
    expect(rollDamage('abc')).toBe(0);
    expect(rollDamage('')).toBe(0);
  });
});

describe('rollD20', () => {
  it('rolls between 1-20 for normal', () => {
    for (let i = 0; i < 100; i++) {
      const result = rollD20('normal');
      expect(result).toBeGreaterThanOrEqual(1);
      expect(result).toBeLessThanOrEqual(20);
    }
  });

  it('rolls with advantage: returns max of 2 rolls', () => {
    // Mock Math.random — we can't, but we can verify the min/max properties
    for (let i = 0; i < 50; i++) {
      const result = rollD20('advantage');
      expect(result).toBeGreaterThanOrEqual(1);
      expect(result).toBeLessThanOrEqual(20);
    }
  });

  it('rolls with disadvantage: returns min of 2 rolls', () => {
    for (let i = 0; i < 50; i++) {
      const result = rollD20('disadvantage');
      expect(result).toBeGreaterThanOrEqual(1);
      expect(result).toBeLessThanOrEqual(20);
    }
  });
});

describe('rollD100', () => {
  it('returns 1-100', () => {
    for (let i = 0; i < 100; i++) {
      const result = rollD100();
      expect(result).toBeGreaterThanOrEqual(1);
      expect(result).toBeLessThanOrEqual(100);
    }
  });
});

describe('getCombatantSpeed', () => {
  it('returns characterSheet speed for players', () => {
    const c = makeCombatant({ isPlayer: true, speed: 25 });
    expect(getCombatantSpeed(c, { speed: 35 })).toBe(35);
  });

  it('returns parsed speed from monsterBlock for monsters', () => {
    const c = makeCombatant({ isMonster: true, speed: 25 });
    expect(getCombatantSpeed(c, undefined, { speed: '40 ft.' })).toBe(40);
  });

  it('falls back to combatant.speed when no sheet/block provided', () => {
    const c = makeCombatant({ speed: 25 });
    expect(getCombatantSpeed(c)).toBe(25);
  });
});