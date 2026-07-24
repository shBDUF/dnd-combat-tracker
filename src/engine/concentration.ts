// ============================================================================
// Concentration API — B1 from engine-api-spec.md
// ============================================================================
// Handles concentration checks, concentration break logic, and edge cases
// (0 HP, unconscious, petrified, spell swap).
// All functions are pure — they return new Combatant objects (immutable).
// ============================================================================

import type {
  Combatant,
  Effect,
  ConcentrationCheckResult,
} from '../types/index.js';
import { removeConcentrationGroup } from './effects.js';

// ─── checkConcentration ──────────────────────────────────────────────────────
// Determines if a concentration check is needed and calculates the DC.
// DC = max(10, floor(damage / 2))
// Returns check result — the actual save is resolved by the UI/DM.
export function checkConcentration(
  combatant: Combatant,
  damage: number
): ConcentrationCheckResult {
  // No concentration active
  if (!combatant.isConcentrating) {
    return {
      passed: true,
      newDC: 0,
      broken: false,
      brokenEffects: [],
    };
  }

  const dc = Math.max(10, Math.floor(damage / 2));
  const concentrationEffects = combatant.effects.filter(
    (e) => e.concentrationGroup !== null && e.isActive
  );

  return {
    passed: false, // DM must resolve via UI
    newDC: dc,
    broken: false,
    brokenEffects: concentrationEffects,
  };
}

// ─── onConcentrationBroken ───────────────────────────────────────────────────
// Called when concentration is broken. Removes all effects sharing the
// concentrationGroup of the broken effect.
// Also handles edge cases:
// - 0 HP: concentration automatically lost
// - Unconscious: concentration impossible
// - Petrified: concentration impossible
export function onConcentrationBroken(
  combatant: Combatant,
  effect: Effect
): { combatant: Combatant; removedEffects: Effect[] } {
  // If combatant is at 0 HP, unconscious, or petrified, remove ALL concentration effects
  const isUnconsciousOrPetrified =
    combatant.conditions.some(
      (c) => c.name === 'Unconscious' || c.name === 'Petrified'
    );
  const isAtZeroHp = combatant.currentHp <= 0;

  if (isUnconsciousOrPetrified || isAtZeroHp) {
    // Remove all concentration groups
    const concentrationGroups = new Set(
      combatant.effects
        .filter((e) => e.concentrationGroup !== null && e.isActive)
        .map((e) => e.concentrationGroup!)
    );

    const allRemoved: Effect[] = [];
    let updatedCombatant = combatant;

    for (const groupId of concentrationGroups) {
      const result = removeConcentrationGroup(updatedCombatant, groupId);
      updatedCombatant = result.combatant;
      allRemoved.push(...result.removed);
    }

    return { combatant: updatedCombatant, removedEffects: allRemoved };
  }

  // Normal case: remove only the concentration group of the broken effect
  if (!effect.concentrationGroup) {
    return { combatant, removedEffects: [] };
  }

  const result = removeConcentrationGroup(combatant, effect.concentrationGroup);
  return {
    combatant: result.combatant,
    removedEffects: result.removed,
  };
}

// ─── onSpellSwap ─────────────────────────────────────────────────────────────
// When a new concentration spell is cast while already concentrating on another,
// the old concentration is automatically broken.
export function onSpellSwap(
  combatant: Combatant,
  newEffect: Effect
): { combatant: Combatant; removedEffects: Effect[] } {
  if (!combatant.isConcentrating || !combatant.concentrationOn) {
    return { combatant, removedEffects: [] };
  }

  // Break the old concentration
  const result = onConcentrationBroken(combatant, combatant.concentrationOn);
  return result;
}

// ─── resolveConcentrationCheck ───────────────────────────────────────────────
// Resolves a concentration check after the DM provides the save result.
// Returns the updated combatant with effects removed if concentration broken.
export function resolveConcentrationCheck(
  combatant: Combatant,
  checkResult: ConcentrationCheckResult,
  saveRoll: number,
  dc: number
): { combatant: Combatant; broken: boolean } {
  const isNatural1 = saveRoll === 1;
  const isNatural20 = saveRoll === 20;

  // Natural 1: auto-fail
  if (isNatural1) {
    let updatedCombatant = combatant;
    let allBroken = false;
    for (const effect of checkResult.brokenEffects) {
      const result = onConcentrationBroken(updatedCombatant, effect);
      updatedCombatant = result.combatant;
      allBroken = true;
    }
    return { combatant: updatedCombatant, broken: allBroken };
  }

  // Natural 20: auto-success
  if (isNatural20) {
    return { combatant, broken: false };
  }

  // Normal check
  if (saveRoll >= dc) {
    return { combatant, broken: false };
  }

  // Failed save
  let updatedCombatant = combatant;
  let allBroken = false;
  for (const effect of checkResult.brokenEffects) {
    const result = onConcentrationBroken(updatedCombatant, effect);
    updatedCombatant = result.combatant;
    allBroken = true;
  }
  return { combatant: updatedCombatant, broken: allBroken };
}