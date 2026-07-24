// ============================================================================
// Roll Engine — B4 from engine-api-spec.md + Track C Group Initiative
// ============================================================================
// Dice rolling, initiative management, turn order building, and damage
// expression parsing. DM-only philosophy: monsters are rolled by the engine,
// player values are set manually.
// All functions are pure where possible.
// ============================================================================

import type {
  Combatant,
  UUID,
  Encounter,
  InitiativeGroup,
  GroupInitiativeRoll,
} from '../types/index.js';

// ─── Utility: random number ──────────────────────────────────────────────────
function d(sides: number): number {
  return Math.floor(Math.random() * sides) + 1;
}

// ─── rollInitiative ──────────────────────────────────────────────────────────
// Rolls initiative for a combatant: d20 + initModifier.
export function rollInitiative(combatant: Combatant): number {
  return d(20) + combatant.initModifier;
}

// ─── setPlayerInitiative ─────────────────────────────────────────────────────
// Sets initiative manually for a player (DM inputs the value from the player).
export function setPlayerInitiative(
  combatant: Combatant,
  value: number
): Combatant {
  return {
    ...combatant,
    initiative: value,
  };
}

// ─── parseSpeed ──────────────────────────────────────────────────────────────
// Parses speed from MonsterBlock.speed string like "30 ft.", "40 ft., climb 30 ft."
export function parseSpeed(speedString: string): number {
  if (!speedString) return 30;
  const match = speedString.match(/(\d+)\s*ft\.?/);
  if (match) {
    return parseInt(match[1], 10);
  }
  return 30;
}

// ─── getCombatantSpeed ───────────────────────────────────────────────────────
// Gets speed for a combatant from CharacterSheet or MonsterBlock
export function getCombatantSpeed(
  combatant: Combatant,
  characterSheet?: { speed: number },
  monsterBlock?: { speed: string }
): number {
  if (combatant.isPlayer && characterSheet) {
    return characterSheet.speed;
  }
  if (combatant.isMonster && monsterBlock) {
    return parseSpeed(monsterBlock.speed);
  }
  return combatant.speed ?? 30;
}

// ─── computeGroupInitModifier ────────────────────────────────────────────────
// Computes the average init modifier for a group of combatants.
// Rounds up (Math.ceil).
export function computeGroupInitModifier(combatants: Combatant[]): number {
  if (combatants.length === 0) return 0;
  const sum = combatants.reduce((acc, c) => acc + c.initModifier, 0);
  return Math.ceil(sum / combatants.length);
}

// ─── rollGroupInitiative ─────────────────────────────────────────────────────
// Rolls initiative for a group. Respects initMode:
// - 'group': single d20 + group initModifier for all
// - 'individual': each combatant rolls separately, order set by roll
export function rollGroupInitiative(
  encounter: Encounter,
  group: InitiativeGroup
): { updatedEncounter: Encounter; roll: GroupInitiativeRoll } {
  const combatants = encounter.combatants.filter((c) =>
    group.combatantIds.includes(c.id)
  );

  if (group.initMode === 'individual') {
    // Each combatant rolls separately
    const updatedCombatants = combatants.map((c) => ({
      ...c,
      initiative: d(20) + c.initModifier,
    }));

    // Sort by initiative descending
    const newOrder = [...updatedCombatants]
      .sort((a, b) => b.initiative - a.initiative)
      .map((c) => c.id);

    const updatedEncounter = {
      ...encounter,
      combatants: encounter.combatants.map(
        (c) => updatedCombatants.find((uc) => uc.id === c.id) ?? c
      ),
      initiativeGroups: encounter.initiativeGroups.map((g) =>
        g.id === group.id
          ? {
              ...g,
              initiative: updatedCombatants[0]?.initiative ?? g.initiative,
              currentOrder: newOrder,
              currentIndex: 0,
            }
          : g
      ),
    };

    const avgInit = updatedCombatants.reduce(
      (sum, c) => sum + c.initiative,
      0
    );
    const roll = updatedCombatants.length > 0
      ? Math.round(avgInit / updatedCombatants.length)
      : 0;

    return {
      updatedEncounter,
      roll: {
        groupId: group.id,
        groupName: group.name,
        roll,
        modifier: group.initModifier,
        total: roll,
        manual: false,
      },
    };
  }

  // Group mode: single roll for all
  const total = d(20) + group.initModifier;
  const roll = total - group.initModifier;

  const updatedEncounter = {
    ...encounter,
    combatants: encounter.combatants.map((c) =>
      group.combatantIds.includes(c.id)
        ? { ...c, initiative: total }
        : c
    ),
    initiativeGroups: encounter.initiativeGroups.map((g) =>
      g.id === group.id
        ? {
            ...g,
            initiative: total,
            currentOrder: [...g.combatantIds],
            currentIndex: 0,
          }
        : g
    ),
  };

  return {
    updatedEncounter,
    roll: {
      groupId: group.id,
      groupName: group.name,
      roll,
      modifier: group.initModifier,
      total,
      manual: false,
    },
  };
}

// ─── rollAllGroups ───────────────────────────────────────────────────────────
// Rolls initiative for all groups that haven't been set manually.
export function rollAllGroups(encounter: Encounter): {
  updatedEncounter: Encounter;
  rolls: GroupInitiativeRoll[];
} {
  let working = { ...encounter };
  const rolls: GroupInitiativeRoll[] = [];

  for (const group of working.initiativeGroups) {
    const result = rollGroupInitiative(working, group);
    working = result.updatedEncounter;
    rolls.push(result.roll);
  }

  // Sort groups by initiative descending
  const sortedGroups = [...working.initiativeGroups].sort(
    (a, b) => b.initiative - a.initiative
  );

  working = {
    ...working,
    initiativeGroups: sortedGroups,
    currentGroupId: sortedGroups[0]?.id ?? null,
    groupTurnIndex: 0,
  };

  return { updatedEncounter: working, rolls };
}

// ─── buildGroupTurnOrder ─────────────────────────────────────────────────────
// Sorts groups by initiative (descending). Tiebreaker: players > allies > npc > monsters.
export function buildGroupTurnOrder(
  groups: InitiativeGroup[]
): InitiativeGroup[] {
  const typeOrder: Record<string, number> = {
    players: 0,
    allies: 1,
    npc: 2,
    monsters: 3,
  };

  return [...groups].sort((a, b) => {
    if (b.initiative !== a.initiative) {
      return b.initiative - a.initiative;
    }
    return (typeOrder[a.type] ?? 99) - (typeOrder[b.type] ?? 99);
  });
}

// ─── setGroupInitiative ──────────────────────────────────────────────────────
// DM manually sets a group's initiative. Re-sorts groups.
export function setGroupInitiative(
  encounter: Encounter,
  groupId: UUID,
  value: number
): Encounter {
  const updatedGroups = encounter.initiativeGroups.map((g) =>
    g.id === groupId ? { ...g, initiative: value } : g
  );
  const sortedGroups = buildGroupTurnOrder(updatedGroups);

  return {
    ...encounter,
    initiativeGroups: sortedGroups,
  };
}

// ─── rerollGroup ─────────────────────────────────────────────────────────────
// Re-rolls initiative for a single group.
export function rerollGroup(
  encounter: Encounter,
  groupId: UUID
): { updatedEncounter: Encounter; roll: GroupInitiativeRoll } {
  const group = encounter.initiativeGroups.find((g) => g.id === groupId);
  if (!group) throw new Error(`Group ${groupId} not found`);

  const result = rollGroupInitiative(encounter, group);
  const sortedGroups = buildGroupTurnOrder(result.updatedEncounter.initiativeGroups);

  return {
    updatedEncounter: {
      ...result.updatedEncounter,
      initiativeGroups: sortedGroups,
    },
    roll: result.roll,
  };
}

// ─── buildTurnOrder ──────────────────────────────────────────────────────────
// Builds turn order from a list of combatants (legacy — kept for migration).
export function buildTurnOrder(combatants: Combatant[]): UUID[] {
  const sorted = [...combatants].sort((a, b) => {
    if (b.initiative !== a.initiative) {
      return b.initiative - a.initiative;
    }
    return a.sortIndex - b.sortIndex;
  });

  return sorted.map((c) => c.id);
}

// ─── addMidCombat ────────────────────────────────────────────────────────────
// Adds a new combatant mid-combat. Supports targetGroupId for group assignment.
export function addMidCombat(
  encounter: Encounter,
  newCombatant: Combatant,
  targetGroupId?: UUID
): Encounter {
  const newCombatants = [...encounter.combatants, newCombatant];

  if (targetGroupId) {
    // Add to existing group
    return {
      ...encounter,
      combatants: newCombatants,
      initiativeGroups: encounter.initiativeGroups.map((g) =>
        g.id === targetGroupId
          ? {
              ...g,
              combatantIds: [...g.combatantIds, newCombatant.id],
              currentOrder: [...g.currentOrder, newCombatant.id],
            }
          : g
      ),
    };
  }

  // Create new group for this combatant
  const newGroup: InitiativeGroup = {
    id: crypto.randomUUID?.() ?? `${Date.now()}-${Math.random()}`,
    name: newCombatant.name,
    type: newCombatant.isPlayer ? 'players' : 'monsters',
    initiative: newCombatant.initiative,
    initModifier: newCombatant.initModifier,
    initMode: 'group',
    combatantIds: [newCombatant.id],
    currentOrder: [newCombatant.id],
    currentIndex: 0,
    isActive: true,
  };

  return {
    ...encounter,
    combatants: newCombatants,
    initiativeGroups: [...encounter.initiativeGroups, newGroup],
  };
}

// ─── rollDamage ──────────────────────────────────────────────────────────────
// Parses and rolls a dice expression like "2d6+3", "1d8", "2d6", etc.
export function rollDamage(diceExpression: string): number {
  const trimmed = diceExpression.trim().toLowerCase();

  // Handle simple modifier only: "+3" or "3"
  const simpleModMatch = trimmed.match(/^[+-]?\d+$/);
  if (simpleModMatch) {
    return parseInt(simpleModMatch[0], 10);
  }

  // Parse dice expression: XdY[+Z] or XdY[-Z]
  const diceMatch = trimmed.match(/^(\d+)d(\d+)(?:([+-])(\d+))?$/);
  if (!diceMatch) {
    return 0; // Invalid expression
  }

  const numDice = parseInt(diceMatch[1], 10);
  const sides = parseInt(diceMatch[2], 10);
  const sign = diceMatch[3] === '-' ? -1 : 1;
  const modifier = diceMatch[4] ? parseInt(diceMatch[4], 10) * sign : 0;

  let total = 0;
  for (let i = 0; i < numDice; i++) {
    total += d(sides);
  }
  total += modifier;

  return Math.max(0, total);
}

// ─── rollD20 ─────────────────────────────────────────────────────────────────
// Rolls a d20 with optional advantage or disadvantage.
export function rollD20(
  advantage?: 'advantage' | 'disadvantage' | 'normal'
): number {
  switch (advantage) {
    case 'advantage': {
      const roll1 = d(20);
      const roll2 = d(20);
      return Math.max(roll1, roll2);
    }
    case 'disadvantage': {
      const roll1 = d(20);
      const roll2 = d(20);
      return Math.min(roll1, roll2);
    }
    default:
      return d(20);
  }
}

// ─── rollD100 ────────────────────────────────────────────────────────────────
// Rolls a d100 (percentile dice).
export function rollD100(): number {
  return d(100);
}