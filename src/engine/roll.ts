// ============================================================================
// Roll Engine — B4 from engine-api-spec.md
// ============================================================================
// Dice rolling, initiative management, turn order building, and damage
// expression parsing. DM-only philosophy: monsters are rolled by the engine,
// player values are set manually.
// All functions are pure where possible.
// ============================================================================

import type { Combatant, UUID, Encounter } from '../types/index.js';

// ─── Utility: random number ──────────────────────────────────────────────────
function d(sides: number): number {
  return Math.floor(Math.random() * sides) + 1;
}

// ─── rollInitiative ──────────────────────────────────────────────────────────
// Rolls initiative for a combatant: d20 + initModifier.
export function rollInitiative(combatant: Combatant): number {
  return d(20) + combatant.initModifier;
}

// ─── rollGroupInitiative ─────────────────────────────────────────────────────
// Sets the same initiative for all members of a group.
// Rolls once, applies to all.
export function rollGroupInitiative(combatant: Combatant): Combatant {
  const initiative = rollInitiative(combatant);
  return {
    ...combatant,
    initiative,
  };
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

// ─── buildTurnOrder ──────────────────────────────────────────────────────────
// Builds turn order from a list of combatants.
// Sorted by initiative descending, then by sortIndex as tiebreaker.
export function buildTurnOrder(combatants: Combatant[]): UUID[] {
  const sorted = [...combatants].sort((a, b) => {
    // Primary: initiative descending
    if (b.initiative !== a.initiative) {
      return b.initiative - a.initiative;
    }
    // Secondary: sortIndex as tiebreaker
    return a.sortIndex - b.sortIndex;
  });

  return sorted.map((c) => c.id);
}

// ─── addMidCombat ────────────────────────────────────────────────────────────
// Adds a new combatant mid-combat.
// - If initiative is higher than current, insert after current turn
// - If initiative is lower, insert at end of round
// - If insertAfterCurrent is true, always insert after current turn
export function addMidCombat(
  encounter: Encounter,
  newCombatant: Combatant,
  insertAfterCurrent?: boolean
): Encounter {
  const newCombatants = [...encounter.combatants, newCombatant];
  const newTurnOrder = buildTurnOrder(newCombatants);

  let adjustedTurnIndex = encounter.turnIndex;

  if (insertAfterCurrent) {
    // Insert after current turn: find position of current combatant in new order
    const currentId = encounter.turnOrder[encounter.turnIndex];
    if (currentId) {
      const currentPos = newTurnOrder.indexOf(currentId);
      const newPos = newTurnOrder.indexOf(newCombatant.id);
      if (newPos > currentPos) {
        // New combatant is after current, adjust index if needed
        adjustedTurnIndex = encounter.turnIndex;
      } else {
        // New combatant inserted before current, move current index forward
        adjustedTurnIndex = encounter.turnIndex + 1;
      }
    }
  }

  // If initiative is lower than current, put at end of round
  const currentCombatant = encounter.combatants.find(
    (c) => c.id === encounter.turnOrder[encounter.turnIndex]
  );
  if (
    !insertAfterCurrent &&
    currentCombatant &&
    newCombatant.initiative < currentCombatant.initiative
  ) {
    // Do nothing — the new combatant will naturally be placed at end of round
  }

  return {
    ...encounter,
    combatants: newCombatants,
    turnOrder: newTurnOrder,
    turnIndex: adjustedTurnIndex,
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