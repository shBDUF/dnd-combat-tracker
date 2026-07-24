// ============================================================================
// Effects Engine — B2 from engine-api-spec.md
// ============================================================================
// Manages active effects on combatants: apply, remove, tick, concentration
// checks, and stat modifier aggregation.
// All functions are pure — they return new Combatant objects (immutable).
// ============================================================================

import type {
  Combatant,
  Effect,
  UUID,
  DndStat,
  SaveReminder,
  ConcentrationCheckResult,
  TickResult,
} from '../types/index.js';

// ─── applyEffect ─────────────────────────────────────────────────────────────
// Applies an effect to a combatant. Checks for concentration conflicts:
// if the new effect has a concentrationGroup and the combatant is already
// concentrating, the old concentration group is removed first.
export function applyEffect(
  combatant: Combatant,
  effect: Effect
): Combatant {
  // Check concentration conflict
  if (effect.concentrationGroup && combatant.isConcentrating) {
    // Remove existing concentration effects
    const { combatant: updatedCombatant } = removeConcentrationGroup(
      combatant,
      effect.concentrationGroup
    );
    return {
      ...updatedCombatant,
      effects: [...updatedCombatant.effects, effect],
      isConcentrating: true,
      concentrationOn: effect,
    };
  }

  // If the effect has a concentration group, mark combatant as concentrating
  const isConcentrating = effect.concentrationGroup !== null;
  const concentrationOn = isConcentrating ? effect : combatant.concentrationOn;

  return {
    ...combatant,
    effects: [...combatant.effects, effect],
    isConcentrating: isConcentrating || combatant.isConcentrating,
    concentrationOn: concentrationOn,
  };
}

// ─── removeEffect ────────────────────────────────────────────────────────────
// Removes a specific effect by ID from a combatant.
export function removeEffect(
  combatant: Combatant,
  effectId: UUID
): Combatant {
  const removedEffect = combatant.effects.find((e) => e.id === effectId);
  const newEffects = combatant.effects.filter((e) => e.id !== effectId);

  // If the removed effect was the concentration effect, update concentration state
  let isConcentrating = combatant.isConcentrating;
  let concentrationOn = combatant.concentrationOn;

  if (removedEffect && removedEffect.concentrationGroup) {
    const remainingConcentration = newEffects.some(
      (e) => e.concentrationGroup !== null && e.isActive
    );
    isConcentrating = remainingConcentration;
    concentrationOn = remainingConcentration
      ? (newEffects.find((e) => e.concentrationGroup !== null && e.isActive) ?? null)
      : null;
  }

  return {
    ...combatant,
    effects: newEffects,
    isConcentrating,
    concentrationOn,
  };
}

// ─── removeConcentrationGroup ────────────────────────────────────────────────
// Removes all effects sharing a given concentrationGroup ID.
export function removeConcentrationGroup(
  combatant: Combatant,
  groupId: string
): { combatant: Combatant; removed: Effect[] } {
  const removed = combatant.effects.filter(
    (e) => e.concentrationGroup === groupId
  );
  const newEffects = combatant.effects.filter(
    (e) => e.concentrationGroup !== groupId
  );

  // Check if any concentration effects remain
  const remainingConcentration = newEffects.some(
    (e) => e.concentrationGroup !== null && e.isActive
  );
  const concentrationOn = remainingConcentration
    ? (newEffects.find((e) => e.concentrationGroup !== null && e.isActive) ?? null)
    : null;

  return {
    combatant: {
      ...combatant,
      effects: newEffects,
      isConcentrating: remainingConcentration,
      concentrationOn,
    },
    removed,
  };
}

// ─── tickRound ───────────────────────────────────────────────────────────────
// Decrements remainingRounds for all effects, checks expiresOnTurnId,
// and collects triggered saves.
export function tickRound(
  combatant: Combatant,
  currentTurnId?: UUID
): { combatant: Combatant; expired: Effect[]; triggeredSaves: SaveReminder[] } {
  const expired: Effect[] = [];
  const triggeredSaves: SaveReminder[] = [];
  const newEffects: Effect[] = [];

  for (const effect of combatant.effects) {
    if (!effect.isActive) {
      newEffects.push(effect);
      continue;
    }

    // Check expiresOnTurnId
    if (currentTurnId && effect.expiresOnTurnId === currentTurnId) {
      expired.push(effect);
      continue;
    }

    // Check remainingRounds
    if (effect.duration.type === 'round' && effect.remainingRounds > 0) {
      const newRemaining = effect.remainingRounds - 1;
      if (newRemaining <= 0) {
        expired.push(effect);
        continue;
      }
      newEffects.push({ ...effect, remainingRounds: newRemaining });
      continue;
    }

    // If remainingRounds is already 0, expire
    if (effect.duration.type === 'round' && effect.remainingRounds <= 0) {
      expired.push(effect);
      continue;
    }

    // Check save conditions
    if (effect.saveCondition) {
      const timing = effect.saveCondition.frequency;
      if (
        (timing === 'endOfTurn' || timing === 'startOfTurn') &&
        currentTurnId
      ) {
        triggeredSaves.push({
          stat: effect.saveCondition.stat,
          dc: effect.saveCondition.dc,
          frequency: timing,
          onPass: effect.saveCondition.onPass,
          onFail: effect.saveCondition.onFail,
          failCondition: effect.saveCondition.failCondition,
          failDamage: effect.saveCondition.failDamage,
        });
      }
    }

    newEffects.push(effect);
  }

  // If concentration effect expired, update concentration state
  let isConcentrating = combatant.isConcentrating;
  let concentrationOn = combatant.concentrationOn;
  for (const expiredEffect of expired) {
    if (expiredEffect.concentrationGroup) {
      const remainingConcentration = newEffects.some(
        (e) => e.concentrationGroup !== null && e.isActive
      );
      isConcentrating = remainingConcentration;
      concentrationOn = remainingConcentration
        ? (newEffects.find((e) => e.concentrationGroup !== null && e.isActive) ?? null)
        : null;
    }
  }

  return {
    combatant: {
      ...combatant,
      effects: newEffects,
      isConcentrating,
      concentrationOn,
    },
    expired,
    triggeredSaves,
  };
}

// ─── onDamageTaken ───────────────────────────────────────────────────────────
// When a combatant takes damage, checks if they are concentrating and
// returns concentration check results.
export function onDamageTaken(
  combatant: Combatant,
  damage: number,
  _turnCombatants?: Combatant[]
): {
  combatant: Combatant;
  concentrationResults: ConcentrationCheckResult[];
} {
  if (!combatant.isConcentrating || !combatant.concentrationOn) {
    return {
      combatant,
      concentrationResults: [],
    };
  }

  const dc = Math.max(10, Math.floor(damage / 2));
  const concentrationEffects = combatant.effects.filter(
    (e) => e.concentrationGroup !== null && e.isActive
  );

  // Return the check info — the actual save is resolved by the UI/DM
  return {
    combatant,
    concentrationResults: [
      {
        passed: false, // DM must resolve this
        newDC: dc,
        broken: false,
        brokenEffects: concentrationEffects,
      },
    ],
  };
}

// ─── getStatModifiers ────────────────────────────────────────────────────────
// Aggregates all stat modifiers from active effects.
export function getStatModifiers(
  combatant: Combatant
): Partial<Record<DndStat, number>> {
  const modifiers: Partial<Record<DndStat, number>> = {};

  for (const effect of combatant.effects) {
    if (!effect.isActive) continue;
    for (const [stat, value] of Object.entries(effect.statModifiers)) {
      const key = stat as DndStat;
      modifiers[key] = (modifiers[key] ?? 0) + (value ?? 0);
    }
  }

  return modifiers;
}

// ─── getEffects ──────────────────────────────────────────────────────────────
// Returns all active effects on a combatant.
export function getEffects(combatant: Combatant): Effect[] {
  return combatant.effects.filter((e) => e.isActive);
}

// ─── hasConcentration ────────────────────────────────────────────────────────
// Checks if a combatant is currently concentrating.
export function hasConcentration(combatant: Combatant): boolean {
  return combatant.isConcentrating;
}

// ─── getActiveConcentrations ─────────────────────────────────────────────────
// Returns all concentration effects on a combatant.
export function getActiveConcentrations(combatant: Combatant): Effect[] {
  return combatant.effects.filter(
    (e) => e.concentrationGroup !== null && e.isActive
  );
}