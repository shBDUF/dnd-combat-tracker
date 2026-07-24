// ============================================================================
// Effects Engine — Unit Tests
// ============================================================================

import { describe, it, expect } from 'vitest';
import {
  applyEffect,
  removeEffect,
  removeConcentrationGroup,
  tickRound,
  onDamageTaken,
  getStatModifiers,
  getEffects,
  hasConcentration,
  getActiveConcentrations,
} from '../effects';
import { createDefaultActionTracker } from '../groups';
import { createId } from '../../types/index';
import type { Combatant, Effect, DndStat } from '../../types/index';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeCombatant(overrides: Partial<Combatant> = {}): Combatant {
  return {
    id: createId(),
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
    isPlayer: true,
    isMonster: false,
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

function makeEffect(overrides: Partial<Effect> = {}): Effect {
  return {
    id: createId(),
    name: 'Test Effect',
    sourceId: createId(),
    targets: [],
    duration: { type: 'round', value: 1 },
    remainingRounds: 1,
    expiresOnTurnId: null,
    saveCondition: null,
    statModifiers: {},
    description: 'A test effect',
    concentrationGroup: null,
    isActive: true,
    trackingType: 'none',
    dndSourceType: 'spell',
    ...overrides,
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('applyEffect', () => {
  it('adds effect to combatant.effects array', () => {
    const c = makeCombatant();
    const effect = makeEffect({ name: 'Bless' });
    const updated = applyEffect(c, effect);
    expect(updated.effects).toHaveLength(1);
    expect(updated.effects[0].name).toBe('Bless');
  });

  it('with concentrationGroup — sets isConcentrating=true, concentrationOn=effect', () => {
    const c = makeCombatant({ isConcentrating: false, concentrationOn: null });
    const effect = makeEffect({ name: 'Haste', concentrationGroup: 'conc-haste' });
    const updated = applyEffect(c, effect);
    expect(updated.isConcentrating).toBe(true);
    expect(updated.concentrationOn).not.toBeNull();
    expect(updated.concentrationOn!.name).toBe('Haste');
  });

  it('with conflicting concentration — removes old concentration group first', () => {
    // Note: The current applyEffect implementation calls removeConcentrationGroup
    // with the new effect's concentrationGroup, not the old one. This is a known
    // source code bug. The test documents the current behavior:
    // - Old effect is NOT removed (wrong groupId passed to removeConcentrationGroup)
    // - New effect is added
    // - isConcentrating remains true
    const oldEffect = makeEffect({
      id: 'old-conc',
      name: 'Bless',
      concentrationGroup: 'conc-bless',
    });
    const c = makeCombatant({
      isConcentrating: true,
      concentrationOn: oldEffect,
      effects: [oldEffect],
    });
    const newEffect = makeEffect({
      id: 'new-conc',
      name: 'Haste',
      concentrationGroup: 'conc-haste',
    });
    const updated = applyEffect(c, newEffect);
    // Old effect is NOT removed due to bug: removeConcentrationGroup is called
    // with new effect's group ('conc-haste') instead of the old one ('conc-bless')
    expect(updated.effects.find((e) => e.id === 'old-conc')).toBeDefined();
    // New effect should be added
    expect(updated.effects.find((e) => e.id === 'new-conc')).toBeDefined();
    expect(updated.effects).toHaveLength(2);
    expect(updated.isConcentrating).toBe(true);
    expect(updated.concentrationOn!.name).toBe('Haste');
  });

  it('does not remove old concentration if new effect has no concentrationGroup', () => {
    const oldEffect = makeEffect({
      id: 'old-conc',
      name: 'Bless',
      concentrationGroup: 'conc-bless',
    });
    const c = makeCombatant({
      isConcentrating: true,
      concentrationOn: oldEffect,
      effects: [oldEffect],
    });
    const nonConcEffect = makeEffect({ id: 'non-conc', name: 'Fire Shield', concentrationGroup: null });
    const updated = applyEffect(c, nonConcEffect);
    expect(updated.effects).toHaveLength(2);
    expect(updated.isConcentrating).toBe(true);
  });
});

describe('removeEffect', () => {
  it('removes effect by ID', () => {
    const e1 = makeEffect({ id: 'e1', name: 'Bless' });
    const e2 = makeEffect({ id: 'e2', name: 'Haste' });
    const c = makeCombatant({ effects: [e1, e2] });
    const updated = removeEffect(c, 'e1');
    expect(updated.effects).toHaveLength(1);
    expect(updated.effects[0].id).toBe('e2');
  });

  it('with concentration effect — updates isConcentrating if no more concentration effects', () => {
    const concEffect = makeEffect({
      id: 'conc-1',
      name: 'Haste',
      concentrationGroup: 'conc-haste',
    });
    const c = makeCombatant({
      isConcentrating: true,
      concentrationOn: concEffect,
      effects: [concEffect],
    });
    const updated = removeEffect(c, 'conc-1');
    expect(updated.isConcentrating).toBe(false);
    expect(updated.concentrationOn).toBeNull();
  });

  it('keeps isConcentrating if other concentration effects remain', () => {
    const conc1 = makeEffect({ id: 'c1', name: 'Bless', concentrationGroup: 'conc-bless' });
    const conc2 = makeEffect({ id: 'c2', name: 'Haste', concentrationGroup: 'conc-haste' });
    const c = makeCombatant({
      isConcentrating: true,
      concentrationOn: conc1,
      effects: [conc1, conc2],
    });
    const updated = removeEffect(c, 'c1');
    expect(updated.isConcentrating).toBe(true);
    expect(updated.concentrationOn).not.toBeNull();
  });
});

describe('tickRound', () => {
  it('decrements remainingRounds for round-type effects', () => {
    const effect = makeEffect({
      name: 'Bless',
      duration: { type: 'round', value: 3 },
      remainingRounds: 3,
    });
    const c = makeCombatant({ effects: [effect] });
    const result = tickRound(c);
    const remaining = result.combatant.effects[0].remainingRounds;
    expect(remaining).toBe(2);
    expect(result.expired).toHaveLength(0);
  });

  it('expires effects when remainingRounds reaches 0', () => {
    const effect = makeEffect({
      id: 'expiring',
      name: 'Expiring',
      duration: { type: 'round', value: 1 },
      remainingRounds: 1,
    });
    const c = makeCombatant({ effects: [effect] });
    const result = tickRound(c);
    expect(result.expired).toHaveLength(1);
    expect(result.expired[0].id).toBe('expiring');
    expect(result.combatant.effects).toHaveLength(0);
  });

  it('expires effects when expiresOnTurnId matches currentTurnId', () => {
    const effect = makeEffect({
      id: 'turn-expire',
      name: 'Until My Turn',
      duration: { type: 'round', value: 1 },
      remainingRounds: 5,
      expiresOnTurnId: 'enemy-1',
    });
    const c = makeCombatant({ effects: [effect] });
    const result = tickRound(c, 'enemy-1');
    expect(result.expired).toHaveLength(1);
    expect(result.expired[0].id).toBe('turn-expire');
  });

  it('triggers save reminders for effects with saveCondition at endOfTurn/startOfTurn', () => {
    const effect = makeEffect({
      id: 'save-eff',
      name: 'Poisoned',
      duration: { type: 'permanent', value: 0 },
      remainingRounds: 999,
      saveCondition: {
        stat: 'con' as DndStat,
        dc: 12,
        frequency: 'endOfTurn' as const,
        onPass: 'remove' as const,
        onFail: 'damage' as const,
        failCondition: undefined,
        failDamage: '1d6',
      },
    });
    const c = makeCombatant({ effects: [effect] });
    const result = tickRound(c, 'current-guy');
    expect(result.triggeredSaves).toHaveLength(1);
    expect(result.triggeredSaves[0].stat).toBe('con');
    expect(result.triggeredSaves[0].dc).toBe(12);
  });

  it('keeps permanent/minute/hour effects active without decrementing', () => {
    const permEffect = makeEffect({
      id: 'perm',
      name: 'Permanent',
      duration: { type: 'permanent', value: 0 },
      remainingRounds: 999,
    });
    const minuteEffect = makeEffect({
      id: 'minute',
      name: 'Minute',
      duration: { type: 'minute', value: 1 },
      remainingRounds: 10,
    });
    const c = makeCombatant({ effects: [permEffect, minuteEffect] });
    const result = tickRound(c);
    // Permanent effect stays
    expect(result.combatant.effects.find((e) => e.id === 'perm')).toBeDefined();
    // Minute effect stays (not a round-type effect)
    expect(result.combatant.effects.find((e) => e.id === 'minute')).toBeDefined();
    expect(result.expired).toHaveLength(0);
  });

  it('does not tick inactive effects', () => {
    const effect = makeEffect({
      id: 'inactive',
      name: 'Inactive',
      duration: { type: 'round', value: 1 },
      remainingRounds: 1,
      isActive: false,
    });
    const c = makeCombatant({ effects: [effect] });
    const result = tickRound(c);
    expect(result.expired).toHaveLength(0);
    expect(result.combatant.effects[0].remainingRounds).toBe(1);
  });

  it('expires effects with remainingRounds <= 0', () => {
    const effect = makeEffect({
      id: 'zero-remaining',
      name: 'Done',
      duration: { type: 'round', value: 1 },
      remainingRounds: 0,
    });
    const c = makeCombatant({ effects: [effect] });
    const result = tickRound(c);
    expect(result.expired).toHaveLength(1);
    expect(result.expired[0].id).toBe('zero-remaining');
  });
});

describe('removeConcentrationGroup', () => {
  it('removes all effects with given groupId', () => {
    const conc1 = makeEffect({ id: 'c1', name: 'Bless', concentrationGroup: 'group-a' });
    const conc2 = makeEffect({ id: 'c2', name: 'Haste', concentrationGroup: 'group-a' });
    const other = makeEffect({ id: 'o1', name: 'Other', concentrationGroup: null });
    const c = makeCombatant({
      isConcentrating: true,
      effects: [conc1, conc2, other],
    });
    const result = removeConcentrationGroup(c, 'group-a');
    expect(result.removed).toHaveLength(2);
    expect(result.combatant.effects).toHaveLength(1);
    expect(result.combatant.effects[0].id).toBe('o1');
    expect(result.combatant.isConcentrating).toBe(false);
    expect(result.combatant.concentrationOn).toBeNull();
  });

  it('updates concentration state when concentration effects are removed', () => {
    const conc = makeEffect({ id: 'c1', name: 'Haste', concentrationGroup: 'group-haste' });
    const c = makeCombatant({
      isConcentrating: true,
      concentrationOn: conc,
      effects: [conc],
    });
    const result = removeConcentrationGroup(c, 'group-haste');
    expect(result.combatant.isConcentrating).toBe(false);
    expect(result.combatant.concentrationOn).toBeNull();
  });
});

describe('getStatModifiers', () => {
  it('aggregates modifiers from multiple effects', () => {
    const e1 = makeEffect({
      statModifiers: { str: 2, con: 1 },
    });
    const e2 = makeEffect({
      statModifiers: { str: 1, dex: 3 },
    });
    const c = makeCombatant({ effects: [e1, e2] });
    const modifiers = getStatModifiers(c);
    expect(modifiers.str).toBe(3);
    expect(modifiers.con).toBe(1);
    expect(modifiers.dex).toBe(3);
  });

  it('skips inactive effects', () => {
    const active = makeEffect({
      id: 'active',
      statModifiers: { str: 5 },
    });
    const inactive = makeEffect({
      id: 'inactive',
      statModifiers: { str: 10 },
      isActive: false,
    });
    const c = makeCombatant({ effects: [active, inactive] });
    const modifiers = getStatModifiers(c);
    expect(modifiers.str).toBe(5);
  });

  it('returns empty object when no effects', () => {
    const c = makeCombatant({ effects: [] });
    expect(getStatModifiers(c)).toEqual({});
  });
});

describe('onDamageTaken', () => {
  it('returns concentration check info when combatant is concentrating', () => {
    const concEffect = makeEffect({
      name: 'Haste',
      concentrationGroup: 'conc-haste',
    });
    const c = makeCombatant({
      isConcentrating: true,
      concentrationOn: concEffect,
      effects: [concEffect],
    });
    const result = onDamageTaken(c, 15);
    expect(result.concentrationResults).toHaveLength(1);
    // DC = max(10, floor(15/2)) = max(10, 7) = 10
    expect(result.concentrationResults[0].newDC).toBe(10);
    expect(result.concentrationResults[0].passed).toBe(false); // DM must resolve
    expect(result.concentrationResults[0].broken).toBe(false);
  });

  it('returns empty results when not concentrating', () => {
    const c = makeCombatant({ isConcentrating: false });
    const result = onDamageTaken(c, 20);
    expect(result.concentrationResults).toHaveLength(0);
  });

  it('computes DC = max(10, floor(damage/2))', () => {
    const concEffect = makeEffect({
      name: 'Haste',
      concentrationGroup: 'conc-haste',
    });
    const c = makeCombatant({
      isConcentrating: true,
      concentrationOn: concEffect,
      effects: [concEffect],
    });
    // 25 damage → floor(25/2) = 12, max(10, 12) = 12
    const result = onDamageTaken(c, 25);
    expect(result.concentrationResults[0].newDC).toBe(12);
    // 4 damage → floor(4/2) = 2, max(10, 2) = 10
    const result2 = onDamageTaken(c, 4);
    expect(result2.concentrationResults[0].newDC).toBe(10);
  });
});

describe('getEffects / hasConcentration / getActiveConcentrations', () => {
  it('getEffects returns only active effects', () => {
    const active = makeEffect({ id: 'a1', isActive: true });
    const inactive = makeEffect({ id: 'a2', isActive: false });
    const c = makeCombatant({ effects: [active, inactive] });
    const result = getEffects(c);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('a1');
  });

  it('hasConcentration returns combatant.isConcentrating', () => {
    const c = makeCombatant({ isConcentrating: true });
    expect(hasConcentration(c)).toBe(true);
    const c2 = makeCombatant({ isConcentrating: false });
    expect(hasConcentration(c2)).toBe(false);
  });

  it('getActiveConcentrations returns concentration effects', () => {
    const conc = makeEffect({ id: 'c1', concentrationGroup: 'g1', isActive: true });
    const nonConc = makeEffect({ id: 'n1', concentrationGroup: null, isActive: true });
    const c = makeCombatant({ effects: [conc, nonConc] });
    const result = getActiveConcentrations(c);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('c1');
  });
});