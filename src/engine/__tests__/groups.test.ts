// ============================================================================
// Groups Engine — Unit Tests
// ============================================================================

import { describe, it, expect, beforeEach } from 'vitest';
import {
  initEncounter,
  nextTurn,
  prevTurn,
  removeCombatantFromGroup,
  getCurrentCombatant,
  getGroupForCombatant,
  getCombatantsInGroup,
  getLegendaryActionMonsters,
  reorderGroup,
  createDefaultActionTracker,
  resetActionTracker,
  useAction,
  setMovement,
} from '../groups';
import { createId } from '../../types/index';
import type {
  Combatant,
  Encounter,
  StartBattleParams,
  InitiativeGroup,
  ActionTracker,
} from '../../types/index';

// ─── Factory helpers ──────────────────────────────────────────────────────────

function createCombatant(overrides: Partial<Combatant> = {}): Combatant {
  return {
    id: createId(),
    name: 'Test Creature',
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

function buildEncounterWithCombatants(
  groupConfigs: Array<{
    name: string;
    type: InitiativeGroup['type'];
    initiative?: number;
    initModifier?: number;
    initMode?: 'group' | 'individual';
    combatants: Array<Partial<Combatant>>;
  }>
): Encounter {
  let allCombatants: Combatant[] = [];
  const groups: StartBattleParams['groups'] = [];

  for (const gc of groupConfigs) {
    const ids: string[] = [];
    for (const cOverrides of gc.combatants) {
      const c = createCombatant(cOverrides);
      allCombatants.push(c);
      ids.push(c.id);
    }
    groups.push({
      name: gc.name,
      type: gc.type,
      combatantIds: ids,
      initiative: gc.initiative ?? 10,
      initModifier: gc.initModifier ?? 0,
      initMode: gc.initMode,
    });
  }

  const encounter = initEncounter({
    name: 'Test Encounter',
    groups,
  });
  encounter.combatants = allCombatants;

  // Link combatants to their groups
  for (const group of encounter.initiativeGroups) {
    for (const c of encounter.combatants) {
      if (group.combatantIds.includes(c.id)) {
        c.initiativeGroupId = group.id;
      }
    }
  }

  return encounter;
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('initEncounter', () => {
  it('creates correct Encounter structure with groups, sets currentGroupId to first group', () => {
    const encounter = initEncounter({
      name: 'Battle Test',
      groups: [
        { name: 'Heroes', type: 'players', combatantIds: ['a', 'b'] },
        { name: 'Goblins', type: 'monsters', combatantIds: ['c'] },
      ],
    });

    expect(encounter.id).toBeTruthy();
    expect(encounter.name).toBe('Battle Test');
    expect(encounter.combatants).toEqual([]);
    expect(encounter.round).toBe(1);
    expect(encounter.isActive).toBe(true);
    expect(encounter.initiativeGroups).toHaveLength(2);
    expect(encounter.currentGroupId).toBe(encounter.initiativeGroups[0].id);
    expect(encounter.groupTurnIndex).toBe(0);
    expect(encounter.actionTrackerHistory).toEqual([]);
  });

  it('sets default initMode to "group" when not specified', () => {
    const encounter = initEncounter({
      name: 'Default Mode',
      groups: [
        { name: 'Party', type: 'players', combatantIds: ['x'] },
      ],
    });
    expect(encounter.initiativeGroups[0].initMode).toBe('group');
  });

  it('preserves initMode when specified', () => {
    const encounter = initEncounter({
      name: 'Individual Mode',
      groups: [
        { name: 'Party', type: 'players', combatantIds: ['x'], initMode: 'individual' },
      ],
    });
    expect(encounter.initiativeGroups[0].initMode).toBe('individual');
  });

  it('creates groups with correct structure', () => {
    const encounter = initEncounter({
      name: 'Test',
      groups: [
        { name: 'G1', type: 'players', combatantIds: ['c1', 'c2'], initModifier: 2, initiative: 15 },
      ],
    });
    const g = encounter.initiativeGroups[0];
    expect(g.id).toBeTruthy();
    expect(g.name).toBe('G1');
    expect(g.type).toBe('players');
    expect(g.initiative).toBe(15);
    expect(g.initModifier).toBe(2);
    expect(g.combatantIds).toEqual(['c1', 'c2']);
    expect(g.currentOrder).toEqual(['c1', 'c2']);
    expect(g.currentIndex).toBe(0);
    expect(g.isActive).toBe(true);
  });
});

describe('getCurrentCombatant', () => {
  it('returns first combatant from current group', () => {
    const encounter = buildEncounterWithCombatants([
      {
        name: 'Party',
        type: 'players',
        combatants: [{ id: 'hero-1', name: 'Aragorn' }, { id: 'hero-2', name: 'Legolas' }],
      },
    ]);
    const current = getCurrentCombatant(encounter);
    expect(current).not.toBeNull();
    expect(current!.id).toBe('hero-1');
    expect(current!.name).toBe('Aragorn');
  });

  it('skips dead combatants (isDead: true)', () => {
    const encounter = buildEncounterWithCombatants([
      {
        name: 'Party',
        type: 'players',
        combatants: [
          { id: 'dead-1', isDead: true },
          { id: 'alive-1', name: 'Survivor' },
        ],
      },
    ]);
    const current = getCurrentCombatant(encounter);
    expect(current).not.toBeNull();
    expect(current!.id).toBe('alive-1');
  });

  it('skips dead combatants (currentHp <= 0)', () => {
    const encounter = buildEncounterWithCombatants([
      {
        name: 'Party',
        type: 'players',
        combatants: [
          { id: 'down-1', currentHp: 0 },
          { id: 'up-1', name: 'Standing' },
        ],
      },
    ]);
    const current = getCurrentCombatant(encounter);
    expect(current).not.toBeNull();
    expect(current!.id).toBe('up-1');
  });

  it('returns null if all combatants in group are dead', () => {
    const encounter = buildEncounterWithCombatants([
      {
        name: 'Party',
        type: 'players',
        combatants: [
          { id: 'dead-1', isDead: true },
          { id: 'dead-2', isDead: true },
        ],
      },
    ]);
    const current = getCurrentCombatant(encounter);
    expect(current).toBeNull();
  });

  it('returns null if no current group', () => {
    const encounter = initEncounter({ name: 'Empty', groups: [] });
    expect(getCurrentCombatant(encounter)).toBeNull();
  });
});

describe('nextTurn', () => {
  it('returns next_combatant when within group', () => {
    const encounter = buildEncounterWithCombatants([
      {
        name: 'Party',
        type: 'players',
        initiative: 15,
        combatants: [
          { id: 'c1', name: 'Fighter' },
          { id: 'c2', name: 'Wizard' },
        ],
      },
    ]);
    const { updatedEncounter, result } = nextTurn(encounter);
    expect(result.type).toBe('next_combatant');
    if (result.type === 'next_combatant') {
      expect(result.currentCombatantId).toBe('c2');
      expect(result.round).toBe(1);
    }
    // currentIndex should be incremented
    const group = updatedEncounter.initiativeGroups[0];
    expect(group.currentIndex).toBe(1);
  });

  it('returns next_group when current group ends', () => {
    const encounter = buildEncounterWithCombatants([
      {
        name: 'Heroes',
        type: 'players',
        initiative: 15,
        combatants: [{ id: 'h1', name: 'Hero' }],
      },
      {
        name: 'Monsters',
        type: 'monsters',
        initiative: 5,
        combatants: [{ id: 'm1', name: 'Goblin' }],
      },
    ]);
    // First nextTurn goes through the only combatant in group 0
    const { updatedEncounter, result } = nextTurn(encounter);
    expect(result.type).toBe('next_group');
    if (result.type === 'next_group') {
      expect(result.currentGroupId).toBe(updatedEncounter.initiativeGroups[1].id);
      expect(result.currentCombatantId).toBe('m1');
    }
  });

  it('returns new_round when all groups are done', () => {
    const encounter = buildEncounterWithCombatants([
      {
        name: 'Heroes',
        type: 'players',
        initiative: 15,
        combatants: [{ id: 'h1', name: 'Hero' }],
      },
      {
        name: 'Monsters',
        type: 'monsters',
        initiative: 5,
        combatants: [{ id: 'm1', name: 'Goblin' }],
      },
    ]);
    // Advance through group 0 (Heroes)
    const afterFirst = nextTurn(encounter);
    // Advance through group 1 (Monsters)
    const afterSecond = nextTurn(afterFirst.updatedEncounter);
    expect(afterSecond.result.type).toBe('new_round');
    if (afterSecond.result.type === 'new_round') {
      expect(afterSecond.result.round).toBe(2);
    }
  });

  it('snapshots ActionTracker before moving', () => {
    const encounter = buildEncounterWithCombatants([
      {
        name: 'Party',
        type: 'players',
        combatants: [
          { id: 'c1', name: 'Fighter', actionTracker: { ...createDefaultActionTracker(30), action: true } },
          { id: 'c2', name: 'Wizard' },
        ],
      },
    ]);
    const { updatedEncounter } = nextTurn(encounter);
    expect(updatedEncounter.actionTrackerHistory).toHaveLength(1);
    expect(updatedEncounter.actionTrackerHistory[0].combatantId).toBe('c1');
    expect(updatedEncounter.actionTrackerHistory[0].actionTracker.action).toBe(true);
  });

  it('auto-skips dead combatants within a group', () => {
    const encounter = buildEncounterWithCombatants([
      {
        name: 'Party',
        type: 'players',
        initiative: 10,
        combatants: [
          { id: 'c1', name: 'Dead', isDead: true },
          { id: 'c2', name: 'Alive', isDead: false },
        ],
      },
    ]);
    // The current combatant is c1 (dead). nextTurn should skip it.
    const { result } = nextTurn(encounter);
    // Since c1 is dead, getCurrentCombatant for the first call would skip to c2
    // Then currentIndex moves from 1 to 2 (group ends), next group...
    // Actually there's only one group, so it depends on the group structure
    // The group has 2 combatants, currentIndex starts at 0
    // getCurrentCombatant skips c1 (dead), advances index to 1, returns c2
    // Then nextTurn snapshots c2, advances index to 2 >= 2, group ends
    // No more groups, so new_round
    expect(result.type).toBe('new_round');
  });
});

describe('prevTurn', () => {
  it('restores ActionTracker from snapshot', () => {
    const encounter = buildEncounterWithCombatants([
      {
        name: 'Party',
        type: 'players',
        combatants: [
          { id: 'c1', name: 'Fighter', actionTracker: { ...createDefaultActionTracker(30), action: false } },
          { id: 'c2', name: 'Wizard' },
        ],
      },
    ]);
    // Set action to true for c1
    const modified = { ...encounter };
    modified.combatants = modified.combatants.map((c) =>
      c.id === 'c1' ? { ...c, actionTracker: { ...c.actionTracker, action: true } } : c
    );
    // Manually push a snapshot
    modified.actionTrackerHistory.push({
      combatantId: 'c1',
      actionTracker: { ...createDefaultActionTracker(30), action: false },
      timestamp: Date.now(),
    });
    const { updatedEncounter } = prevTurn(modified);
    const restored = updatedEncounter.combatants.find((c) => c.id === 'c1');
    expect(restored).toBeDefined();
    expect(restored!.actionTracker.action).toBe(false);
  });

  it('decrements currentIndex when possible', () => {
    const encounter = buildEncounterWithCombatants([
      {
        name: 'Party',
        type: 'players',
        combatants: [
          { id: 'c1', name: 'Fighter' },
          { id: 'c2', name: 'Wizard' },
        ],
      },
    ]);
    // Advance to c2
    const afterNext = nextTurn(encounter);
    // Now go back
    const { updatedEncounter, result } = prevTurn(afterNext.updatedEncounter);
    const group = updatedEncounter.initiativeGroups[0];
    expect(group.currentIndex).toBe(0);
    expect(result.type).toBe('next_combatant');
  });
});

describe('removeCombatantFromGroup', () => {
  it('removes combatant from combatantIds and currentOrder', () => {
    const encounter = buildEncounterWithCombatants([
      {
        name: 'Party',
        type: 'players',
        combatants: [
          { id: 'c1', name: 'Fighter' },
          { id: 'c2', name: 'Wizard' },
        ],
      },
    ]);
    const result = removeCombatantFromGroup(encounter, 'c1');
    expect(result.removedCombatant.id).toBe('c1');
    const group = result.updatedEncounter.initiativeGroups[0];
    expect(group.combatantIds).toEqual(['c2']);
    expect(group.currentOrder).toEqual(['c2']);
    expect(result.updatedEncounter.combatants).toHaveLength(1);
    expect(result.updatedEncounter.combatants[0].id).toBe('c2');
  });

  it('handles monster group (combatantGroupId) — updates survivors', () => {
    const groupId = createId();
    const encounter = buildEncounterWithCombatants([
      {
        name: 'Goblin Squad',
        type: 'monsters',
        combatants: [
          { id: 'g1', name: 'Goblin 1', combatantGroupId: groupId, combatantGroupSize: 2, combatantGroupIndex: 0 },
          { id: 'g2', name: 'Goblin 2', combatantGroupId: groupId, combatantGroupSize: 2, combatantGroupIndex: 1 },
        ],
      },
    ]);
    const result = removeCombatantFromGroup(encounter, 'g1');
    expect(result.groupSurvivors).toHaveLength(1);
    expect(result.groupSurvivors[0].id).toBe('g2');
    expect(result.groupSurvivors[0].combatantGroupSize).toBe(1);
    expect(result.groupSurvivors[0].combatantGroupIndex).toBe(0);
    expect(result.groupDeleted).toBe(false);
  });

  it('guards currentGroupId when deleted group was current', () => {
    const encounter = buildEncounterWithCombatants([
      {
        name: 'Party',
        type: 'players',
        combatants: [{ id: 'c1', name: 'Solo' }],
      },
    ]);
    const result = removeCombatantFromGroup(encounter, 'c1');
    // The group becomes empty and is removed
    expect(result.groupDeleted).toBe(true);
    expect(result.newCurrentGroupId).toBeNull();
    expect(result.updatedEncounter.currentGroupId).toBeNull();
  });
});

describe('reorderGroup', () => {
  it('updates currentOrder for a group', () => {
    const encounter = buildEncounterWithCombatants([
      {
        name: 'Party',
        type: 'players',
        combatants: [
          { id: 'c1', name: 'A' },
          { id: 'c2', name: 'B' },
          { id: 'c3', name: 'C' },
        ],
      },
    ]);
    const groupId = encounter.initiativeGroups[0].id;
    const newOrder = ['c3', 'c1', 'c2'];
    const updated = reorderGroup(encounter, groupId, newOrder);
    expect(updated.initiativeGroups[0].currentOrder).toEqual(newOrder);
  });
});

describe('getCombatantsInGroup / getGroupForCombatant', () => {
  it('getCombatantsInGroup returns combatants in a group', () => {
    const encounter = buildEncounterWithCombatants([
      {
        name: 'Party',
        type: 'players',
        combatants: [
          { id: 'c1', name: 'Fighter' },
          { id: 'c2', name: 'Wizard' },
        ],
      },
    ]);
    const gid = encounter.initiativeGroups[0].id;
    const members = getCombatantsInGroup(encounter, gid);
    expect(members).toHaveLength(2);
    expect(members.map((m) => m.id).sort()).toEqual(['c1', 'c2']);
  });

  it('getGroupForCombatant returns the correct group', () => {
    const encounter = buildEncounterWithCombatants([
      {
        name: 'Party',
        type: 'players',
        combatants: [{ id: 'c1', name: 'Hero' }],
      },
      {
        name: 'Monsters',
        type: 'monsters',
        combatants: [{ id: 'm1', name: 'Goblin' }],
      },
    ]);
    const group = getGroupForCombatant(encounter, 'm1');
    expect(group).not.toBeNull();
    expect(group!.name).toBe('Monsters');
  });

  it('getGroupForCombatant returns null for unknown combatant', () => {
    const encounter = buildEncounterWithCombatants([
      { name: 'Party', type: 'players', combatants: [{ id: 'c1' }] },
    ]);
    expect(getGroupForCombatant(encounter, 'unknown')).toBeNull();
  });
});

describe('getLegendaryActionMonsters', () => {
  it('returns monsters with legendaryActionsAvailable > 0', () => {
    const encounter = buildEncounterWithCombatants([
      {
        name: 'Monsters',
        type: 'monsters',
        combatants: [
          {
            id: 'dragon',
            name: 'Adult Red Dragon',
            actionTracker: { ...createDefaultActionTracker(30), legendaryActionsMax: 3, legendaryActionsAvailable: 3 },
          },
          {
            id: 'goblin',
            name: 'Goblin',
            actionTracker: { ...createDefaultActionTracker(30), legendaryActionsMax: 0, legendaryActionsAvailable: 0 },
          },
          {
            id: 'dead-lich',
            name: 'Dead Lich',
            isDead: true,
            actionTracker: { ...createDefaultActionTracker(30), legendaryActionsMax: 3, legendaryActionsAvailable: 3 },
          },
        ],
      },
    ]);
    const legendaries = getLegendaryActionMonsters(encounter);
    expect(legendaries).toEqual(['dragon']);
  });
});

describe('createDefaultActionTracker', () => {
  it('creates an ActionTracker with default values', () => {
    const at = createDefaultActionTracker(30);
    expect(at.action).toBe(false);
    expect(at.bonusAction).toBe(false);
    expect(at.reaction).toBe(false);
    expect(at.movement).toBe(0);
    expect(at.movementSpeed).toBe(30);
    expect(at.legendaryActionsAvailable).toBe(0);
    expect(at.legendaryActionsMax).toBe(0);
    expect(at.isActed).toBe(false);
  });
});

describe('resetActionTracker', () => {
  it('resets all action fields to false/0, restores legendary actions', () => {
    const combatant = createCombatant({
      actionTracker: {
        action: true,
        bonusAction: true,
        reaction: true,
        movement: 20,
        movementSpeed: 30,
        legendaryActionsAvailable: 0,
        legendaryActionsMax: 3,
        isActed: true,
      },
    });
    const reset = resetActionTracker(combatant);
    expect(reset.actionTracker.action).toBe(false);
    expect(reset.actionTracker.bonusAction).toBe(false);
    expect(reset.actionTracker.reaction).toBe(false);
    expect(reset.actionTracker.movement).toBe(0);
    expect(reset.actionTracker.legendaryActionsAvailable).toBe(3);
    expect(reset.actionTracker.isActed).toBe(false);
    // Preserved
    expect(reset.actionTracker.movementSpeed).toBe(30);
    expect(reset.actionTracker.legendaryActionsMax).toBe(3);
  });
});

describe('useAction', () => {
  it('toggles action to true', () => {
    const c = createCombatant();
    const updated = useAction(c, 'action');
    expect(updated.actionTracker.action).toBe(true);
  });

  it('toggles bonusAction to true', () => {
    const c = createCombatant();
    const updated = useAction(c, 'bonusAction');
    expect(updated.actionTracker.bonusAction).toBe(true);
  });

  it('toggles reaction to true', () => {
    const c = createCombatant();
    const updated = useAction(c, 'reaction');
    expect(updated.actionTracker.reaction).toBe(true);
  });

  it('decrements legendary actions when available', () => {
    const c = createCombatant({
      actionTracker: { ...createDefaultActionTracker(30), legendaryActionsAvailable: 3, legendaryActionsMax: 3 },
    });
    const updated = useAction(c, 'legendary');
    expect(updated.actionTracker.legendaryActionsAvailable).toBe(2);
  });

  it('does not decrement legendary actions below 0', () => {
    const c = createCombatant({
      actionTracker: { ...createDefaultActionTracker(30), legendaryActionsAvailable: 0, legendaryActionsMax: 3 },
    });
    const updated = useAction(c, 'legendary');
    expect(updated.actionTracker.legendaryActionsAvailable).toBe(0);
  });

  it('increments movement by amount, capped at movementSpeed', () => {
    const c = createCombatant({
      actionTracker: { ...createDefaultActionTracker(30), movement: 0, movementSpeed: 30 },
    });
    const updated = useAction(c, 'movement', 20);
    expect(updated.actionTracker.movement).toBe(20);

    const capped = useAction(c, 'movement', 40);
    expect(capped.actionTracker.movement).toBe(30);
  });
});

describe('setMovement', () => {
  it('sets movement amount clamped between 0 and movementSpeed', () => {
    const c = createCombatant({
      actionTracker: { ...createDefaultActionTracker(30), movement: 0, movementSpeed: 30 },
    });
    const updated = setMovement(c, 15);
    expect(updated.actionTracker.movement).toBe(15);

    const clampedHigh = setMovement(c, 50);
    expect(clampedHigh.actionTracker.movement).toBe(30);

    const clampedLow = setMovement(c, -5);
    expect(clampedLow.actionTracker.movement).toBe(0);
  });
});