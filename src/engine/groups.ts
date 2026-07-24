// ============================================================================
// Groups Engine — Track C: Initiative Groups + Action Economy
// ============================================================================
// Pure functions for managing InitiativeGroup lifecycle:
// - initEncounter: builds Encounter from StartBattleParams
// - nextTurn: hierarchical combatant → group → next group → new round
// - prevTurn: reverse turn with ActionTracker snapshot restore
// - removeCombatantFromGroup: remove one creature from a group
// - getCurrentCombatant: helper to get the current combatant from groups
// ============================================================================

import type {
  Encounter,
  Combatant,
  InitiativeGroup,
  GroupTickResult,
  RemoveFromGroupResult,
  ActionTracker,
  ActionTrackerSnapshot,
  StartBattleParams,
  UUID,
  TickResult,
} from '../types/index.js';
import { createId } from '../types/index.js';
import { tickRound } from './effects.js';

// ─── Default ActionTracker factory ───────────────────────────────────────────
export function createDefaultActionTracker(speed: number = 30): ActionTracker {
  return {
    action: false,
    bonusAction: false,
    reaction: false,
    movement: 0,
    movementSpeed: speed,
    legendaryActionsAvailable: 0,
    legendaryActionsMax: 0,
    isActed: false,
  };
}

// ─── Reset ActionTracker for a new turn ──────────────────────────────────────
export function resetActionTracker(combatant: Combatant): Combatant {
  return {
    ...combatant,
    actionTracker: {
      ...combatant.actionTracker,
      action: false,
      bonusAction: false,
      reaction: false,
      movement: 0,
      // Legendary actions are restored at start of monster's turn
      legendaryActionsAvailable: combatant.actionTracker.legendaryActionsMax,
      isActed: false,
    },
  };
}

// ─── Use an action (toggle) ──────────────────────────────────────────────────
export function useAction(
  combatant: Combatant,
  type: 'action' | 'bonusAction' | 'reaction' | 'legendary' | 'movement',
  amount?: number
): Combatant {
  const at = { ...combatant.actionTracker };
  switch (type) {
    case 'action':
      at.action = true;
      break;
    case 'bonusAction':
      at.bonusAction = true;
      break;
    case 'reaction':
      at.reaction = true;
      break;
    case 'legendary':
      if (at.legendaryActionsAvailable > 0) {
        at.legendaryActionsAvailable--;
      }
      break;
    case 'movement':
      if (amount !== undefined) {
        at.movement = Math.min(at.movement + amount, at.movementSpeed);
      }
      break;
  }
  return { ...combatant, actionTracker: at };
}

// ─── Set movement amount ─────────────────────────────────────────────────────
export function setMovement(combatant: Combatant, amount: number): Combatant {
  return {
    ...combatant,
    actionTracker: {
      ...combatant.actionTracker,
      movement: Math.max(0, Math.min(amount, combatant.actionTracker.movementSpeed)),
    },
  };
}

// ─── initEncounter from StartBattleParams ───────────────────────────────────
export function initEncounter(params: StartBattleParams): Encounter {
  const encounterId = createId();
  const groups: InitiativeGroup[] = params.groups.map((g) => {
    const initMode = g.initMode || 'group';
    return {
      id: createId(),
      name: g.name,
      type: g.type,
      initiative: g.initiative ?? 0,
      initModifier: g.initModifier ?? 0,
      initMode,
      combatantIds: [...g.combatantIds],
      currentOrder: [...g.combatantIds],
      currentIndex: 0,
      isActive: true,
    };
  });

  return {
    id: encounterId,
    name: params.name,
    campaignId: null,
    combatants: [],
    round: 1,
    isActive: true,
    startTime: Date.now(),
    environment: params.environment ?? '',
    notes: params.notes ?? '',
    initiativeGroups: groups,
    currentGroupId: groups.length > 0 ? groups[0].id : null,
    groupTurnIndex: 0,
    actionTrackerHistory: [],
  };
}

// ─── getCurrentCombatant ─────────────────────────────────────────────────────
// Returns the current combatant from the current group, auto-skipping dead ones.
export function getCurrentCombatant(encounter: Encounter): Combatant | null {
  const group = encounter.initiativeGroups.find(
    (g) => g.id === encounter.currentGroupId
  );
  if (!group) return null;

  let safety = 0;
  while (safety < group.currentOrder.length) {
    const combatantId = group.currentOrder[group.currentIndex];
    const combatant = encounter.combatants.find((c) => c.id === combatantId);
    if (combatant && !combatant.isDead && combatant.currentHp > 0) {
      return combatant;
    }
    // Skip dead
    group.currentIndex = (group.currentIndex + 1) % group.currentOrder.length;
    safety++;
  }
  return null; // all dead in group
}

// ─── getGroupForCombatant ────────────────────────────────────────────────────
export function getGroupForCombatant(
  encounter: Encounter,
  combatantId: UUID
): InitiativeGroup | null {
  return (
    encounter.initiativeGroups.find((g) =>
      g.combatantIds.includes(combatantId)
    ) ?? null
  );
}

// ─── getCombatantsInGroup ────────────────────────────────────────────────────
export function getCombatantsInGroup(
  encounter: Encounter,
  groupId: UUID
): Combatant[] {
  const group = encounter.initiativeGroups.find((g) => g.id === groupId);
  if (!group) return [];
  return group.combatantIds
    .map((id) => encounter.combatants.find((c) => c.id === id))
    .filter(Boolean) as Combatant[];
}

// ─── getLegendaryActionMonsters ──────────────────────────────────────────────
export function getLegendaryActionMonsters(encounter: Encounter): UUID[] {
  return encounter.combatants
    .filter(
      (c) =>
        c.actionTracker.legendaryActionsMax > 0 &&
        c.actionTracker.legendaryActionsAvailable > 0 &&
        !c.isDead
    )
    .map((c) => c.id);
}

// ─── reorderGroup ────────────────────────────────────────────────────────────
// DM reorders currentOrder within a group (Drag & Drop).
export function reorderGroup(
  encounter: Encounter,
  groupId: UUID,
  newOrder: UUID[]
): Encounter {
  return {
    ...encounter,
    initiativeGroups: encounter.initiativeGroups.map((g) =>
      g.id === groupId
        ? { ...g, currentOrder: newOrder }
        : g
    ),
  };
}

// ─── nextTurn ────────────────────────────────────────────────────────────────
// Hierarchical: combatant → group → next group → new round.
// Returns GroupTickResult for the UI to consume.
export function nextTurn(encounter: Encounter): {
  updatedEncounter: Encounter;
  result: GroupTickResult;
} {
  let updated = { ...encounter, actionTrackerHistory: [...encounter.actionTrackerHistory] };

  // 1. Snapshot current combatant's ActionTracker for prevTurn
  const currentCombatant = getCurrentCombatant(updated);
  if (currentCombatant) {
    updated.actionTrackerHistory.push({
      combatantId: currentCombatant.id,
      actionTracker: { ...currentCombatant.actionTracker },
      timestamp: Date.now(),
    });
    // Limit history to last 50 entries
    if (updated.actionTrackerHistory.length > 100) {
      updated.actionTrackerHistory = updated.actionTrackerHistory.slice(-50);
    }
  }

  const currentGroup = updated.initiativeGroups.find(
    (g) => g.id === updated.currentGroupId
  );
  if (!currentGroup) {
    return {
      updatedEncounter: updated,
      result: {
        type: 'combat_end',
        previousGroupId: null,
        currentGroupId: null,
        previousCombatantId: currentCombatant?.id ?? null,
        currentCombatantId: null,
        round: updated.round,
        tickResult: null,
        legendaryActionCombatants: [],
      },
    };
  }

  const previousGroupId = currentGroup.id;
  const previousCombatantId = currentCombatant?.id ?? null;

  // 2. Increment within group
  let nextGroupIndex = currentGroup.currentIndex + 1;

  // 3. Check if group is done
  if (nextGroupIndex >= currentGroup.currentOrder.length) {
    // Group finished — find next active group
    const activeGroups = updated.initiativeGroups.filter((g) => g.isActive);
    let nextGroupPos = updated.groupTurnIndex + 1;

    // Skip dead groups
    while (nextGroupPos < activeGroups.length) {
      const g = activeGroups[nextGroupPos];
      const hasAlive = g.combatantIds.some((cid) => {
        const c = updated.combatants.find((comb) => comb.id === cid);
        return c && !c.isDead && c.currentHp > 0;
      });
      if (hasAlive) break;
      nextGroupPos++;
    }

    if (nextGroupPos >= activeGroups.length) {
      // NEW ROUND
      const newRound = updated.round + 1;

      // Tick all combatants for new round
      const updatedCombatants = updated.combatants.map((c) => {
        const result = tickRound(c);
        return result.combatant;
      });
      const tickResult: TickResult = {
        expiredEffects: [],
        triggeredSaves: [],
        updatedCombatants: updatedCombatants.map((c) => c.id),
        concentrationBroken: [],
      };

      // Reset all groups to index 0
      const resetGroups = updated.initiativeGroups.map((g) => ({
        ...g,
        currentIndex: 0,
        currentOrder: [...g.combatantIds], // reset order to default
      }));

      // Sort groups by initiative (descending)
      resetGroups.sort((a, b) => b.initiative - a.initiative);

      updated = {
        ...updated,
        combatants: updatedCombatants,
        initiativeGroups: resetGroups,
        currentGroupId: resetGroups[0]?.id ?? null,
        groupTurnIndex: 0,
        round: newRound,
      };

      return {
        updatedEncounter: updated,
        result: {
          type: 'new_round',
          previousGroupId,
          currentGroupId: updated.currentGroupId,
          previousCombatantId,
          currentCombatantId: null,
          round: newRound,
          tickResult,
          legendaryActionCombatants: getLegendaryActionMonsters(updated),
        },
      };
    }

    // NEXT GROUP
    const nextGroup = activeGroups[nextGroupPos];
    // Reset isActed for all monsters in the new group
    const updatedCombatants = updated.combatants.map((c) => {
      if (nextGroup.combatantIds.includes(c.id) && c.actionTracker.isActed) {
        return {
          ...c,
          actionTracker: { ...c.actionTracker, isActed: false },
        };
      }
      return c;
    });

    nextGroup.currentIndex = 0;
    updated = {
      ...updated,
      combatants: updatedCombatants,
      currentGroupId: nextGroup.id,
      groupTurnIndex: nextGroupPos,
    };

    return {
      updatedEncounter: updated,
      result: {
        type: 'next_group',
        previousGroupId,
        currentGroupId: nextGroup.id,
        previousCombatantId,
        currentCombatantId: nextGroup.currentOrder[0] ?? null,
        round: updated.round,
        tickResult: null,
        legendaryActionCombatants: getLegendaryActionMonsters(updated),
      },
    };
  }

  // NEXT COMBATANT IN GROUP
  currentGroup.currentIndex = nextGroupIndex;
  const nextCombatantId = currentGroup.currentOrder[nextGroupIndex];

  // Reset ActionTracker for the new combatant
  const combatantsWithReset = updated.combatants.map((c) => {
    if (c.id === nextCombatantId) {
      return resetActionTracker(c);
    }
    return c;
  });

  // Also check if combatant is dead — auto-skip
  const nextCombatant = combatantsWithReset.find(
    (c) => c.id === nextCombatantId
  );
  if (!nextCombatant || nextCombatant.isDead || nextCombatant.currentHp <= 0) {
    // Dead — skip to next recursively
    updated = { ...updated, combatants: combatantsWithReset };
    return nextTurn(updated);
  }

  updated = { ...updated, combatants: combatantsWithReset };

  return {
    updatedEncounter: updated,
    result: {
      type: 'next_combatant',
      previousGroupId,
      currentGroupId: currentGroup.id,
      previousCombatantId,
      currentCombatantId: nextCombatantId,
      round: updated.round,
      tickResult: null,
      legendaryActionCombatants: getLegendaryActionMonsters(updated),
    },
  };
}

// ─── prevTurn ────────────────────────────────────────────────────────────────
// Reverse turn with ActionTracker snapshot restore.
export function prevTurn(encounter: Encounter): {
  updatedEncounter: Encounter;
  result: GroupTickResult;
} {
  const history = [...encounter.actionTrackerHistory];
  const snapshot = history.pop();

  let updated: Encounter = {
    ...encounter,
    actionTrackerHistory: history,
  };

  // Restore snapshot
  if (snapshot) {
    updated = {
      ...updated,
      combatants: updated.combatants.map((c) =>
        c.id === snapshot.combatantId
          ? { ...c, actionTracker: { ...snapshot.actionTracker } }
          : c
      ),
    };
  }

  const currentGroup = updated.initiativeGroups.find(
    (g) => g.id === updated.currentGroupId
  );
  if (!currentGroup) {
    return {
      updatedEncounter: updated,
      result: {
        type: 'combat_end',
        previousGroupId: null,
        currentGroupId: null,
        previousCombatantId: null,
        currentCombatantId: null,
        round: updated.round,
        tickResult: null,
        legendaryActionCombatants: [],
      },
    };
  }

  // Decrement currentIndex
  let prevIndex = currentGroup.currentIndex - 1;

  if (prevIndex < 0) {
    // Move to previous group
    const activeGroups = updated.initiativeGroups.filter((g) => g.isActive);
    let prevGroupPos = updated.groupTurnIndex - 1;

    if (prevGroupPos < 0) {
      // Wrap to last group
      prevGroupPos = activeGroups.length - 1;
    }

    if (prevGroupPos >= 0 && activeGroups[prevGroupPos]) {
      const prevGroup = activeGroups[prevGroupPos];
      prevGroup.currentIndex = prevGroup.currentOrder.length - 1;
      updated = {
        ...updated,
        currentGroupId: prevGroup.id,
        groupTurnIndex: prevGroupPos,
      };
    }
  } else {
    currentGroup.currentIndex = prevIndex;
  }

  const restoredCombatant = getCurrentCombatant(updated);

  return {
    updatedEncounter: updated,
    result: {
      type: 'next_combatant',
      previousGroupId: currentGroup.id,
      currentGroupId: updated.currentGroupId,
      previousCombatantId: null,
      currentCombatantId: restoredCombatant?.id ?? null,
      round: updated.round,
      tickResult: null,
      legendaryActionCombatants: getLegendaryActionMonsters(updated),
    },
  };
}

// ─── removeCombatantFromGroup ────────────────────────────────────────────────
// Removes one creature from its group. If it's a monster group member,
// only that one is removed; survivors keep the group.
export function removeCombatantFromGroup(
  encounter: Encounter,
  combatantId: UUID
): RemoveFromGroupResult {
  // 1. Find combatant
  const combatant = encounter.combatants.find((c) => c.id === combatantId);
  if (!combatant) throw new Error(`Combatant ${combatantId} not found`);

  // 2. Handle monster group members
  const groupId = combatant.combatantGroupId;
  let groupSurvivors: Combatant[] = [];
  let groupDeleted = false;

  if (groupId) {
    groupSurvivors = encounter.combatants.filter(
      (c) => c.combatantGroupId === groupId && c.id !== combatantId
    );
    // Update combatantGroupSize for survivors
    groupSurvivors = groupSurvivors.map((c, i) => ({
      ...c,
      combatantGroupSize: groupSurvivors.length,
      combatantGroupIndex: i,
    }));
    groupDeleted = groupSurvivors.length === 0;
  }

  // 3. Remove combatant from encounter
  const remainingCombatants = encounter.combatants.filter(
    (c) => c.id !== combatantId
  );
  const finalCombatants = groupId
    ? remainingCombatants.map(
        (c) => groupSurvivors.find((s) => s.id === c.id) ?? c
      )
    : remainingCombatants;

  // 4. Remove combatant from InitiativeGroup
  let updatedGroups = encounter.initiativeGroups.map((g) => ({
    ...g,
    combatantIds: g.combatantIds.filter((id) => id !== combatantId),
    currentOrder: g.currentOrder.filter((id) => id !== combatantId),
  }));

  // 5. Remove empty groups
  const nonEmptyGroups = updatedGroups.filter(
    (g) => g.combatantIds.length > 0
  );
  const wasGroupDeleted = updatedGroups.length !== nonEmptyGroups.length;
  groupDeleted = groupDeleted || wasGroupDeleted;

  // 6. Guard currentGroupId (Blocker fix)
  let newCurrentGroupId = encounter.currentGroupId;
  if (
    groupDeleted ||
    !nonEmptyGroups.find((g) => g.id === encounter.currentGroupId)
  ) {
    const currentGroupIndex = nonEmptyGroups.findIndex(
      (g) => g.id === encounter.currentGroupId
    );
    if (
      currentGroupIndex !== -1 &&
      currentGroupIndex < nonEmptyGroups.length - 1
    ) {
      newCurrentGroupId = nonEmptyGroups[currentGroupIndex + 1].id;
    } else if (nonEmptyGroups.length > 0) {
      newCurrentGroupId = nonEmptyGroups[0].id;
    } else {
      newCurrentGroupId = null;
    }
  }

  // 7. Fix currentIndex within group
  const affectedGroup = nonEmptyGroups.find(
    (g) => g.id === newCurrentGroupId
  );
  if (affectedGroup && affectedGroup.currentIndex >= affectedGroup.currentOrder.length) {
    affectedGroup.currentIndex = Math.max(
      0,
      affectedGroup.currentOrder.length - 1
    );
  }

  const updatedEncounter: Encounter = {
    ...encounter,
    combatants: finalCombatants,
    initiativeGroups: nonEmptyGroups,
    currentGroupId: newCurrentGroupId,
  };

  return {
    updatedEncounter,
    removedCombatant: combatant,
    groupSurvivors,
    groupDeleted,
    newCurrentGroupId,
  };
}