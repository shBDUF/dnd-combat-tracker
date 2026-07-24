// ============================================================================
// Condition Engine — B3 from engine-api-spec.md
// ============================================================================
// Manages D&D 5e conditions on combatants: apply, remove, query, compute
// modifiers, auto-effects, and death saves.
// All functions are pure — they return new Combatant objects (immutable).
// ============================================================================

import type {
  Combatant,
  Condition,
  UUID,
  DndCondition,
  DndStat,
  DeathSaves,
  ConditionModifiers,
  Effect,
  DeathSaveResult,
} from '../types/index.js';

// ─── applyCondition ──────────────────────────────────────────────────────────
// Applies a condition to a combatant. Special handling:
// - Unconscious auto-applies Prone and Incapacitated
// - Checks for duplicate conditions (doesn't stack)
export function applyCondition(
  combatant: Combatant,
  condition: Condition
): Combatant {
  // Don't apply if already has this condition
  if (hasCondition(combatant, condition.name)) {
    return combatant;
  }

  let updatedCombatant: Combatant = {
    ...combatant,
    conditions: [...combatant.conditions, condition],
  };

  // Unconscious auto-applies Prone and Incapacitated
  if (condition.name === 'Unconscious') {
    const proneCondition: Condition = {
      id: condition.id + '_prone',
      name: 'Prone',
      sourceId: condition.sourceId,
      duration: condition.duration,
      description: 'Auto-applied from Unconscious',
    };
    const incapacitatedCondition: Condition = {
      id: condition.id + '_incapacitated',
      name: 'Incapacitated',
      sourceId: condition.sourceId,
      duration: condition.duration,
      description: 'Auto-applied from Unconscious',
    };
    updatedCombatant = applyCondition(updatedCombatant, proneCondition);
    updatedCombatant = applyCondition(updatedCombatant, incapacitatedCondition);
  }

  // Paralyzed auto-applies Incapacitated
  if (condition.name === 'Paralyzed') {
    const incapacitatedCondition: Condition = {
      id: condition.id + '_incapacitated',
      name: 'Incapacitated',
      sourceId: condition.sourceId,
      duration: condition.duration,
      description: 'Auto-applied from Paralyzed',
    };
    updatedCombatant = applyCondition(updatedCombatant, incapacitatedCondition);
  }

  // Petrified auto-applies Incapacitated
  if (condition.name === 'Petrified') {
    const incapacitatedCondition: Condition = {
      id: condition.id + '_incapacitated',
      name: 'Incapacitated',
      sourceId: condition.sourceId,
      duration: condition.duration,
      description: 'Auto-applied from Petrified',
    };
    updatedCombatant = applyCondition(updatedCombatant, incapacitatedCondition);
  }

  // Stunned auto-applies Incapacitated
  if (condition.name === 'Stunned') {
    const incapacitatedCondition: Condition = {
      id: condition.id + '_incapacitated',
      name: 'Incapacitated',
      sourceId: condition.sourceId,
      duration: condition.duration,
      description: 'Auto-applied from Stunned',
    };
    updatedCombatant = applyCondition(updatedCombatant, incapacitatedCondition);
  }

  return updatedCombatant;
}

// ─── removeCondition ─────────────────────────────────────────────────────────
// Removes a specific condition by ID.
export function removeCondition(
  combatant: Combatant,
  conditionId: UUID
): Combatant {
  const removed = combatant.conditions.find((c) => c.id === conditionId);
  const newConditions = combatant.conditions.filter((c) => c.id !== conditionId);

  let updated: Combatant = { ...combatant, conditions: newConditions };

  // If the removed condition was Unconscious, also remove auto-applied Prone and Incapacitated
  if (removed?.name === 'Unconscious') {
    const autoIds = [
      conditionId + '_prone',
      conditionId + '_incapacitated',
    ];
    for (const autoId of autoIds) {
      updated = removeCondition(updated, autoId);
    }
  }

  // If the removed condition was Paralyzed, Petrified, or Stunned, also remove auto-applied Incapacitated
  if (
    removed?.name === 'Paralyzed' ||
    removed?.name === 'Petrified' ||
    removed?.name === 'Stunned'
  ) {
    updated = removeCondition(updated, conditionId + '_incapacitated');
  }

  return updated;
}

// ─── hasCondition ────────────────────────────────────────────────────────────
// Checks if a combatant has a specific condition by name.
export function hasCondition(
  combatant: Combatant,
  conditionName: DndCondition
): boolean {
  return combatant.conditions.some((c) => c.name === conditionName);
}

// ─── getConditionModifiers ───────────────────────────────────────────────────
// Computes combat modifiers from all active conditions.
export function getConditionModifiers(
  combatant: Combatant
): ConditionModifiers {
  const result: ConditionModifiers = {
    ac: 0,
    attack: 0,
    speed: 0,
    dexSaves: 'normal',
    strSaves: 'normal',
    abilityChecks: 'normal',
    autoFail: [],
    autoFailSaves: false,
  };

  for (const condition of combatant.conditions) {
    switch (condition.name) {
      case 'Blinded': {
        result.attack += -999; // disadvantage on attack rolls (represented as heavy penalty)
        result.abilityChecks = 'disadvantage';
        break;
      }
      case 'Charmed': {
        result.abilityChecks = 'disadvantage';
        break;
      }
      case 'Frightened': {
        result.attack += -999; // disadvantage on attack rolls while source visible
        result.abilityChecks = 'disadvantage';
        break;
      }
      case 'Grappled': {
        result.speed = 0;
        break;
      }
      case 'Incapacitated': {
        // cannot act — handled via getAutoEffects
        break;
      }
      case 'Invisible': {
        result.attack += 999; // advantage on attack rolls
        break;
      }
      case 'Paralyzed': {
        result.autoFail.push('str', 'dex');
        result.autoFailSaves = true;
        break;
      }
      case 'Petrified': {
        // immunity to damage handled elsewhere
        break;
      }
      case 'Poisoned': {
        result.attack += -999; // disadvantage on attack rolls
        result.abilityChecks = 'disadvantage';
        break;
      }
      case 'Prone': {
        result.attack += -999; // disadvantage on attack rolls
        break;
      }
      case 'Restrained': {
        result.attack += -999; // disadvantage on attack rolls
        result.dexSaves = 'disadvantage';
        result.speed = 0;
        break;
      }
      case 'Stunned': {
        result.autoFail.push('str', 'dex');
        result.autoFailSaves = true;
        break;
      }
      case 'Unconscious': {
        result.autoFail.push('str', 'dex');
        result.autoFailSaves = true;
        result.ac += -5; // unconscious: attacks have advantage and auto-crit
        break;
      }
      case 'Exhaustion': {
        // Exhaustion levels handled separately
        break;
      }
      case 'Fatigued': {
        result.attack += -999; // disadvantage
        result.abilityChecks = 'disadvantage';
        break;
      }
      case 'Dazed': {
        // cannot act and auto-fail
        result.autoFailSaves = true;
        break;
      }
      case 'Bloodied': {
        // no RAW mechanical effect, informational only
        break;
      }
      default:
        break;
    }
  }

  return result;
}

// ─── getAutoEffects ──────────────────────────────────────────────────────────
// Returns effects that auto-apply from conditions (e.g., Unconscious -> prone).
export function getAutoEffects(combatant: Combatant): Effect[] {
  const autoEffects: Effect[] = [];

  // Check for conditions that prevent acting
  const cannotActConditions: DndCondition[] = [
    'Incapacitated',
    'Paralyzed',
    'Petrified',
    'Stunned',
    'Unconscious',
  ];

  for (const condition of combatant.conditions) {
    if (cannotActConditions.includes(condition.name)) {
      autoEffects.push({
        id: `${condition.id}_auto_cannotAct`,
        name: `Cannot Act (${condition.name})`,
        sourceId: condition.sourceId,
        targets: [combatant.id],
        duration: condition.duration,
        remainingRounds: -1,
        expiresOnTurnId: null,
        saveCondition: null,
        statModifiers: {},
        description: `Cannot take actions or reactions due to ${condition.name}`,
        concentrationGroup: null,
        isActive: true,
        trackingType: 'none',
        dndSourceType: 'feature',
      });
    }
  }

  return autoEffects;
}

// ─── clearConditions ─────────────────────────────────────────────────────────
// Removes all conditions from a combatant.
export function clearConditions(combatant: Combatant): Combatant {
  return {
    ...combatant,
    conditions: [],
  };
}

// ─── applyDeathSave ──────────────────────────────────────────────────────────
// Applies a death save result to a combatant.
// Natural 20: alive with 1 HP
// Natural 1: 2 failures
// 3 successes: stable
// 3 failures: dead
export function applyDeathSave(
  combatant: Combatant,
  roll: number
): { combatant: Combatant; result: DeathSaveResult; deathsaves: DeathSaves } {
  let ds = { ...combatant.deathsaves };

  // Natural 20: stabilize + 1 HP and remove Unconscious
  if (roll === 20) {
    ds = { successes: 0, failures: 0, isStable: true };
    return {
      combatant: {
        ...combatant,
        deathsaves: ds,
        currentHp: 1,
        isDead: false,
        conditions: combatant.conditions.filter(
          (c) => c.name !== 'Unconscious'
        ),
      },
      result: 'alive',
      deathsaves: ds,
    };
  }

  // Natural 1: 2 failures
  if (roll === 1) {
    ds = { ...ds, failures: ds.failures + 2 };
    if (ds.failures >= 3) {
      return {
        combatant: { ...combatant, deathsaves: ds, isDead: true },
        result: 'dead',
        deathsaves: ds,
      };
    }
    return {
      combatant: { ...combatant, deathsaves: ds },
      result: 'ongoing',
      deathsaves: ds,
    };
  }

  // Success: 10-19
  if (roll >= 10) {
    ds = { ...ds, successes: ds.successes + 1 };
    if (ds.successes >= 3) {
      ds = { ...ds, isStable: true };
      return {
        combatant: { ...combatant, deathsaves: ds },
        result: 'stable',
        deathsaves: ds,
      };
    }
    return {
      combatant: { ...combatant, deathsaves: ds },
      result: 'ongoing',
      deathsaves: ds,
    };
  }

  // Failure: 2-9
  ds = { ...ds, failures: ds.failures + 1 };
  if (ds.failures >= 3) {
    return {
      combatant: { ...combatant, deathsaves: ds, isDead: true },
      result: 'dead',
      deathsaves: ds,
    };
  }
  return {
    combatant: { ...combatant, deathsaves: ds },
    result: 'ongoing',
    deathsaves: ds,
  };
}