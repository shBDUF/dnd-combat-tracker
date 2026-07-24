// ============================================================================
// Zustand Stores with Dexie Sync — Track C: Initiative Groups + Action Economy
// ============================================================================
// Two Zustand stores with Immer for immutable updates:
// - useCombatStore: manages active Encounter + Combatants + effects/conditions
// - useCampaignStore: manages Campaign + CharacterSheets + settings
//
// Sync protocol: Zustand → Dexie (last-write-wins, auto-save every 5s)
// ============================================================================

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type {
  Encounter,
  Combatant,
  Campaign,
  CharacterSheet,
  Effect,
  Condition,
  UUID,
  TickResult,
  DeathSaveResult,
  GroupTickResult,
  InitiativeGroup,
  StartBattleParams,
  RemoveFromGroupResult,
  GroupInitiativeRoll,
} from '../types/index.js';
import { createId } from '../types/index.js';
import { db } from './db.js';
import {
  tickRound,
  onDamageTaken,
  removeEffect as removeEffectPure,
  applyEffect as applyEffectPure,
  getEffects,
  hasConcentration,
} from '../engine/effects.js';
import {
  applyCondition as applyConditionPure,
  removeCondition as removeConditionPure,
  applyDeathSave as applyDeathSavePure,
} from '../engine/conditions.js';
import {
  nextTurn as groupsNextTurn,
  prevTurn as groupsPrevTurn,
  initEncounter as initEncounterFromEngine,
  getCurrentCombatant,
  getGroupForCombatant,
  removeCombatantFromGroup,
  createDefaultActionTracker,
} from '../engine/groups.js';
import {
  rollAllGroups as rollAllGroupsPure,
  rerollGroup as rerollGroupPure,
  setGroupInitiative as setGroupInitiativePure,
} from '../engine/roll.js';

// ─── Combat State ────────────────────────────────────────────────────────────

export interface CombatState {
  activeEncounter: Encounter | null;
  initiativeRolled: boolean;
  isLoading: boolean;
  error: string | null;
}

export interface CombatActions {
  // Encounter lifecycle
  initEncounter: (encounter: Encounter) => void;
  initEncounterFromParams: (params: StartBattleParams) => void;
  loadEncounter: (id: UUID) => Promise<void>;
  endCombat: () => Promise<void>;

  // Turn management (groups)
  nextTurn: () => GroupTickResult | null;
  prevTurn: () => GroupTickResult | null;

  // Initiative
  rollInitiative: () => GroupInitiativeRoll[];
  rollGroup: (groupId: UUID) => GroupInitiativeRoll;
  setGroupInitiative: (groupId: UUID, value: number) => void;

  // Group management
  createGroup: (name: string, type: InitiativeGroup['type']) => UUID;
  addCombatantToGroup: (combatantId: UUID, groupId: UUID) => void;
  removeCombatantFromGroupAction: (combatantId: UUID) => RemoveFromGroupResult | null;
  reorderGroup: (groupId: UUID, newOrder: UUID[]) => void;

  // Combatant management
  addCombatant: (combatant: Combatant, groupId?: UUID) => void;
  addCombatantGroup: (template: Partial<Combatant>, count: number) => UUID[];
  removeCombatant: (combatantId: UUID) => void;
  updateCombatant: (combatantId: UUID, updates: Partial<Combatant>) => void;

  // HP management
  damageCombatant: (combatantId: UUID, damage: number) => void;
  healCombatant: (combatantId: UUID, amount: number) => void;
  setTempHp: (combatantId: UUID, tempHp: number) => void;

  // Action Economy
  toggleAction: (combatantId: UUID, type: 'action' | 'bonusAction' | 'reaction' | 'legendary') => void;
  setMovement: (combatantId: UUID, amount: number) => void;
  resetActions: (combatantId: UUID) => void;

  // Effects & Conditions
  applyEffect: (combatantId: UUID, effect: Effect) => void;
  removeEffect: (combatantId: UUID, effectId: UUID) => void;
  applyCondition: (combatantId: UUID, condition: Condition) => void;
  removeCondition: (combatantId: UUID, conditionId: UUID) => void;

  // Death saves
  applyDeathSave: (combatantId: UUID, roll: number) => {
    result: DeathSaveResult;
    deathsaves: { successes: number; failures: number; isStable: boolean };
  };

  // Round tick
  tickRound: () => TickResult | null;

  // Helpers
  getCombatant: (combatantId: UUID) => Combatant | undefined;
  getActiveConcentrations: () => { combatantId: UUID; effects: Effect[] }[];

  // Persistence
  saveToDb: () => Promise<void>;
}

export type CombatStore = CombatState & CombatActions;

export const useCombatStore = create<CombatStore>()(
  immer((set, get) => ({
    // ─── State ──────────────────────────────────────────────────────
    activeEncounter: null,
    initiativeRolled: false,
    isLoading: false,
    error: null,

    // ─── Encounter lifecycle ────────────────────────────────────────
    initEncounter: (encounter) =>
      set((state) => {
        state.activeEncounter = encounter;
        state.initiativeRolled = false;
        state.isLoading = false;
        state.error = null;
      }),

    initEncounterFromParams: (params) => {
      const encounter = initEncounterFromEngine(params);
      set((state) => {
        state.activeEncounter = encounter;
        state.initiativeRolled = false;
        state.isLoading = false;
        state.error = null;
      });
    },

    loadEncounter: async (id) => {
      set((state) => {
        state.isLoading = true;
      });
      try {
        const encounter = await db.encounters.get(id);
        if (encounter) {
          set((state) => {
            state.activeEncounter = encounter;
            state.initiativeRolled = encounter.initiativeGroups?.some(g => g.initiative > 0) ?? false;
            state.isLoading = false;
          });
        } else {
          set((state) => {
            state.isLoading = false;
            state.error = `Encounter ${id} not found`;
          });
        }
      } catch (err) {
        set((state) => {
          state.isLoading = false;
          state.error = String(err);
        });
      }
    },

    endCombat: async () => {
      const { activeEncounter, saveToDb } = get();
      if (!activeEncounter) return;
      const ended = {
        ...activeEncounter,
        isActive: false,
      };
      set((state) => {
        state.activeEncounter = ended;
      });
      await saveToDb();
      set((state) => {
        state.activeEncounter = null;
        state.initiativeRolled = false;
      });
    },

    // ─── Turn management ────────────────────────────────────────────
    nextTurn: () => {
      const { activeEncounter } = get();
      if (!activeEncounter) return null;

      const { updatedEncounter, result } = groupsNextTurn(activeEncounter);
      set((state) => {
        state.activeEncounter = updatedEncounter;
      });
      return result;
    },

    prevTurn: () => {
      const { activeEncounter } = get();
      if (!activeEncounter) return null;

      const { updatedEncounter, result } = groupsPrevTurn(activeEncounter);
      set((state) => {
        state.activeEncounter = updatedEncounter;
      });
      return result;
    },

    // ─── Initiative ─────────────────────────────────────────────────
    rollInitiative: () => {
      const { activeEncounter } = get();
      if (!activeEncounter) return [];

      const { updatedEncounter, rolls } = rollAllGroupsPure(activeEncounter);
      set((state) => {
        state.activeEncounter = updatedEncounter;
        state.initiativeRolled = true;
      });
      return rolls;
    },

    rollGroup: (groupId) => {
      const { activeEncounter } = get();
      if (!activeEncounter) throw new Error('No active encounter');

      const { updatedEncounter, roll } = rerollGroupPure(activeEncounter, groupId);
      set((state) => {
        state.activeEncounter = updatedEncounter;
      });
      return roll;
    },

    setGroupInitiative: (groupId, value) => {
      const { activeEncounter } = get();
      if (!activeEncounter) return;

      const updated = setGroupInitiativePure(activeEncounter, groupId, value);
      set((state) => {
        state.activeEncounter = updated;
      });
    },

    // ─── Group management ───────────────────────────────────────────
    createGroup: (name, type) => {
      const id = createId();
      set((state) => {
        if (!state.activeEncounter) return;
        const newGroup: InitiativeGroup = {
          id,
          name,
          type,
          initiative: 0,
          initModifier: 0,
          initMode: 'group',
          combatantIds: [],
          currentOrder: [],
          currentIndex: 0,
          isActive: true,
        };
        state.activeEncounter.initiativeGroups.push(newGroup);
      });
      return id;
    },

    addCombatantToGroup: (combatantId, groupId) => {
      set((state) => {
        if (!state.activeEncounter) return;
        const group = state.activeEncounter.initiativeGroups.find(g => g.id === groupId);
        if (!group) return;
        const combatant = state.activeEncounter.combatants.find(c => c.id === combatantId);
        if (!combatant) return;

        // Remove from old group first
        for (const g of state.activeEncounter.initiativeGroups) {
          g.combatantIds = g.combatantIds.filter(id => id !== combatantId);
          g.currentOrder = g.currentOrder.filter(id => id !== combatantId);
        }

        // Add to new group
        group.combatantIds.push(combatantId);
        group.currentOrder.push(combatantId);
        combatant.initiativeGroupId = groupId;
      });
    },

    removeCombatantFromGroupAction: (combatantId) => {
      const { activeEncounter } = get();
      if (!activeEncounter) return null;

      const result = removeCombatantFromGroup(activeEncounter, combatantId);
      set((state) => {
        state.activeEncounter = result.updatedEncounter;
      });
      return result;
    },

    reorderGroup: (groupId, newOrder) => {
      set((state) => {
        if (!state.activeEncounter) return;
        const group = state.activeEncounter.initiativeGroups.find(g => g.id === groupId);
        if (!group) return;
        group.currentOrder = newOrder;
      });
    },

    // ─── Combatant management ───────────────────────────────────────
    addCombatant: (combatant, groupId?) => {
      set((state) => {
        if (!state.activeEncounter) return;

        // Add to combatants array
        state.activeEncounter.combatants.push(combatant);

        if (groupId) {
          // Add to existing group
          const group = state.activeEncounter.initiativeGroups.find(g => g.id === groupId);
          if (group) {
            group.combatantIds.push(combatant.id);
            group.currentOrder.push(combatant.id);
            combatant.initiativeGroupId = groupId;
          }
        } else {
          // Create new group for this combatant
          const newGroup: InitiativeGroup = {
            id: createId(),
            name: combatant.isPlayer ? 'Players' : combatant.name,
            type: combatant.isPlayer ? 'players' : 'monsters',
            initiative: combatant.initiative,
            initModifier: combatant.initModifier,
            initMode: 'group',
            combatantIds: [combatant.id],
            currentOrder: [combatant.id],
            currentIndex: 0,
            isActive: true,
          };
          state.activeEncounter.initiativeGroups.push(newGroup);
          combatant.initiativeGroupId = newGroup.id;
        }
      });
    },

    addCombatantGroup: (template, count) => {
      const ids: UUID[] = [];
      const groupId = createId();
      set((state) => {
        if (!state.activeEncounter) return;

        for (let i = 0; i < count; i++) {
          const id = createId();
          ids.push(id);
          const combatant: Combatant = {
            id,
            name: template.name || 'Unknown',
            initiative: template.initiative ?? 0,
            initModifier: template.initModifier ?? 0,
            ac: template.ac ?? 10,
            maxHp: template.maxHp ?? 10,
            currentHp: template.currentHp ?? template.maxHp ?? 10,
            tempHp: 0,
            conditions: [],
            effects: [],
            isConcentrating: false,
            concentrationOn: null,
            isPlayer: template.isPlayer ?? false,
            isMonster: template.isMonster ?? true,
            monsterId: template.monsterId,
            groupId: template.groupId,
            deathsaves: { successes: 0, failures: 0, isStable: false },
            sortIndex: state.activeEncounter.combatants.length + i,
            isDead: false,
            notes: template.notes ?? '',
            initiativeGroupId: null,
            actionTracker: createDefaultActionTracker(template.speed ?? 30),
            speed: template.speed ?? 30,
            combatantGroupId: groupId,
            combatantGroupSize: count,
            combatantGroupIndex: i,
          };
          state.activeEncounter.combatants.push(combatant);
        }

        // Create initiative group for the monster group
        const newGroup: InitiativeGroup = {
          id: createId(),
          name: `${count}x ${template.name || 'Unknown'}`,
          type: 'monsters',
          initiative: template.initiative ?? 0,
          initModifier: template.initModifier ?? 0,
          initMode: 'group',
          combatantIds: ids,
          currentOrder: ids,
          currentIndex: 0,
          isActive: true,
        };
        state.activeEncounter.initiativeGroups.push(newGroup);

        // Set initiativeGroupId on all combatants
        for (const id of ids) {
          const c = state.activeEncounter.combatants.find(c => c.id === id);
          if (c) c.initiativeGroupId = newGroup.id;
        }
      });
      return ids;
    },

    removeCombatant: (combatantId) => {
      set((state) => {
        if (!state.activeEncounter) return;

        // Remove from combatants array
        state.activeEncounter.combatants = state.activeEncounter.combatants.filter(
          c => c.id !== combatantId
        );

        // Remove from groups
        for (const group of state.activeEncounter.initiativeGroups) {
          group.combatantIds = group.combatantIds.filter(id => id !== combatantId);
          group.currentOrder = group.currentOrder.filter(id => id !== combatantId);
        }

        // Remove empty groups
        const beforeCount = state.activeEncounter.initiativeGroups.length;
        state.activeEncounter.initiativeGroups = state.activeEncounter.initiativeGroups.filter(
          g => g.combatantIds.length > 0
        );
        const groupDeleted = beforeCount !== state.activeEncounter.initiativeGroups.length;

        // Guard currentGroupId (Blocker 2 fix)
        const enc = state.activeEncounter;
        if (groupDeleted || !enc.initiativeGroups.find(
          g => g.id === enc.currentGroupId
        )) {
          if (state.activeEncounter.initiativeGroups.length > 0) {
            const nextPos = Math.min(
              state.activeEncounter.groupTurnIndex,
              state.activeEncounter.initiativeGroups.length - 1
            );
            state.activeEncounter.currentGroupId = state.activeEncounter.initiativeGroups[nextPos].id;
            state.activeEncounter.groupTurnIndex = nextPos;
          } else {
            state.activeEncounter.currentGroupId = null;
          }
        }
      });
    },

    updateCombatant: (combatantId, updates) =>
      set((state) => {
        if (!state.activeEncounter) return;
        const idx = state.activeEncounter.combatants.findIndex(
          (c) => c.id === combatantId
        );
        if (idx !== -1) {
          Object.assign(state.activeEncounter.combatants[idx], updates);
        }
      }),

    // ─── HP management ──────────────────────────────────────────────
    damageCombatant: (combatantId, damage) =>
      set((state) => {
        if (!state.activeEncounter) return;
        const combatant = state.activeEncounter.combatants.find(
          (c) => c.id === combatantId
        );
        if (!combatant) return;

        let remaining = damage;
        if (combatant.tempHp > 0) {
          const absorbed = Math.min(combatant.tempHp, remaining);
          combatant.tempHp -= absorbed;
          remaining -= absorbed;
        }

        combatant.currentHp = Math.max(0, combatant.currentHp - remaining);

        if (combatant.currentHp <= 0) {
          if (combatant.isPlayer) {
            combatant.isDead = false;
          } else {
            combatant.isDead = true;
          }
        }
      }),

    healCombatant: (combatantId, amount) =>
      set((state) => {
        if (!state.activeEncounter) return;
        const combatant = state.activeEncounter.combatants.find(
          (c) => c.id === combatantId
        );
        if (!combatant) return;
        combatant.currentHp = Math.min(
          combatant.maxHp,
          combatant.currentHp + amount
        );
        if (combatant.currentHp > 0) {
          combatant.isDead = false;
          if (combatant.isPlayer) {
            const unconsciousIdx = combatant.conditions.findIndex(
              (c) => c.name === 'Unconscious'
            );
            if (unconsciousIdx !== -1) {
              const unconsciousId = combatant.conditions[unconsciousIdx].id;
              const idsToRemove = [unconsciousId, unconsciousId + '_prone', unconsciousId + '_incapacitated'];
              combatant.conditions = combatant.conditions.filter(
                (c) => !idsToRemove.includes(c.id)
              );
            }
          }
        }
      }),

    setTempHp: (combatantId, tempHp) =>
      set((state) => {
        if (!state.activeEncounter) return;
        const combatant = state.activeEncounter.combatants.find(
          (c) => c.id === combatantId
        );
        if (!combatant) return;
        combatant.tempHp = Math.max(0, tempHp);
      }),

    // ─── Action Economy ─────────────────────────────────────────────
    toggleAction: (combatantId, type) => {
      set((state) => {
        if (!state.activeEncounter) return;
        const combatant = state.activeEncounter.combatants.find(c => c.id === combatantId);
        if (!combatant) return;

        const at = combatant.actionTracker;
        switch (type) {
          case 'action':
            at.action = !at.action;
            break;
          case 'bonusAction':
            at.bonusAction = !at.bonusAction;
            break;
          case 'reaction':
            at.reaction = !at.reaction;
            break;
          case 'legendary':
            if (at.legendaryActionsAvailable > 0) {
              at.legendaryActionsAvailable--;
            }
            break;
        }
      });
    },

    setMovement: (combatantId, amount) => {
      set((state) => {
        if (!state.activeEncounter) return;
        const combatant = state.activeEncounter.combatants.find(c => c.id === combatantId);
        if (!combatant) return;
        combatant.actionTracker.movement = Math.max(0, Math.min(amount, combatant.actionTracker.movementSpeed));
      });
    },

    resetActions: (combatantId) => {
      set((state) => {
        if (!state.activeEncounter) return;
        const combatant = state.activeEncounter.combatants.find(c => c.id === combatantId);
        if (!combatant) return;
        combatant.actionTracker = {
          ...combatant.actionTracker,
          action: false,
          bonusAction: false,
          reaction: false,
          movement: 0,
          legendaryActionsAvailable: combatant.actionTracker.legendaryActionsMax,
          isActed: false,
        };
      });
    },

    // ─── Effects & Conditions ───────────────────────────────────────
    applyEffect: (combatantId, effect) =>
      set((state) => {
        if (!state.activeEncounter) return;
        const idx = state.activeEncounter.combatants.findIndex(
          (c) => c.id === combatantId
        );
        if (idx === -1) return;
        state.activeEncounter.combatants[idx] = applyEffectPure(
          state.activeEncounter.combatants[idx],
          effect
        );
      }),

    removeEffect: (combatantId, effectId) =>
      set((state) => {
        if (!state.activeEncounter) return;
        const idx = state.activeEncounter.combatants.findIndex(
          (c) => c.id === combatantId
        );
        if (idx === -1) return;
        state.activeEncounter.combatants[idx] = removeEffectPure(
          state.activeEncounter.combatants[idx],
          effectId
        );
      }),

    applyCondition: (combatantId, condition) =>
      set((state) => {
        if (!state.activeEncounter) return;
        const idx = state.activeEncounter.combatants.findIndex(
          (c) => c.id === combatantId
        );
        if (idx === -1) return;
        state.activeEncounter.combatants[idx] = applyConditionPure(
          state.activeEncounter.combatants[idx],
          condition
        );
      }),

    removeCondition: (combatantId, conditionId) =>
      set((state) => {
        if (!state.activeEncounter) return;
        const idx = state.activeEncounter.combatants.findIndex(
          (c) => c.id === combatantId
        );
        if (idx === -1) return;
        state.activeEncounter.combatants[idx] = removeConditionPure(
          state.activeEncounter.combatants[idx],
          conditionId
        );
      }),

    // ─── Death saves ────────────────────────────────────────────────
    applyDeathSave: (combatantId, roll) => {
      const state = get();
      if (!state.activeEncounter) {
        return {
          result: 'ongoing' as DeathSaveResult,
          deathsaves: { successes: 0, failures: 0, isStable: false },
        };
      }
      const combatant = state.activeEncounter.combatants.find(
        (c) => c.id === combatantId
      );
      if (!combatant) {
        return {
          result: 'ongoing' as DeathSaveResult,
          deathsaves: { successes: 0, failures: 0, isStable: false },
        };
      }

      const result = applyDeathSavePure(combatant, roll);
      set((state) => {
        if (!state.activeEncounter) return;
        const idx = state.activeEncounter.combatants.findIndex(
          (c) => c.id === combatantId
        );
        if (idx !== -1) {
          state.activeEncounter.combatants[idx] = result.combatant;
        }
      });
      return {
        result: result.result,
        deathsaves: result.deathsaves,
      };
    },

    // ─── Round tick ─────────────────────────────────────────────────
    tickRound: () => {
      const { activeEncounter } = get();
      if (!activeEncounter) return null;

      const expiredEffects: Effect[] = [];
      const triggeredSaves: import('../types/index.js').SaveReminder[] = [];

      const updatedCombatants = activeEncounter.combatants.map((c) => {
        const currentTurnId = getCurrentCombatant(activeEncounter)?.id ?? null;
        const result = tickRound(c, currentTurnId ?? undefined);
        expiredEffects.push(...result.expired);
        triggeredSaves.push(...result.triggeredSaves);
        return result.combatant;
      });

      set((state) => {
        if (state.activeEncounter) {
          state.activeEncounter.combatants = updatedCombatants;
        }
      });

      return {
        expiredEffects,
        triggeredSaves,
        updatedCombatants: updatedCombatants.map((c) => c.id),
        concentrationBroken: [],
      };
    },

    // ─── Helpers ────────────────────────────────────────────────────
    getCombatant: (combatantId) => {
      const { activeEncounter } = get();
      return activeEncounter?.combatants.find((c) => c.id === combatantId);
    },

    getActiveConcentrations: () => {
      const { activeEncounter } = get();
      if (!activeEncounter) return [];
      return activeEncounter.combatants
        .filter((c) => hasConcentration(c))
        .map((c) => ({
          combatantId: c.id,
          effects: getEffects(c).filter(
            (e) => e.concentrationGroup !== null
          ),
        }));
    },

    // ─── Persistence ────────────────────────────────────────────────
    saveToDb: async () => {
      const { activeEncounter } = get();
      if (!activeEncounter) return;
      try {
        await db.encounters.put(activeEncounter);
        for (const combatant of activeEncounter.combatants) {
          await db.combatants.put(combatant);
        }
      } catch (err) {
        console.error('Failed to save to IndexedDB:', err);
      }
    },
  }))
);

// ─── Campaign State ───────────────────────────────────────────────────────────

export interface CampaignState {
  activeCampaign: Campaign | null;
  campaigns: Campaign[];
  isLoading: boolean;
  error: string | null;
}

export interface CampaignActions {
  loadCampaigns: () => Promise<void>;
  loadCampaign: (id: UUID) => Promise<void>;
  createCampaign: (name: string, description?: string) => Campaign;
  deleteCampaign: (id: UUID) => Promise<void>;

  addCharacter: (character: CharacterSheet) => void;
  removeCharacter: (characterId: UUID) => void;
  updateCharacter: (characterId: UUID, updates: Partial<CharacterSheet>) => void;

  exportCampaign: (id: UUID) => Promise<string>;
  importCampaign: (json: string) => Promise<Campaign>;

  saveToDb: () => Promise<void>;
}

export type CampaignStore = CampaignState & CampaignActions;

export const useCampaignStore = create<CampaignStore>()(
  immer((set, get) => ({
    // ─── State ──────────────────────────────────────────────────────
    activeCampaign: null,
    campaigns: [],
    isLoading: false,
    error: null,

    // ─── Campaign lifecycle ─────────────────────────────────────────
    loadCampaigns: async () => {
      set((state) => {
        state.isLoading = true;
      });
      try {
        const campaigns = await db.campaigns.toArray();
        set((state) => {
          state.campaigns = campaigns;
          state.isLoading = false;
        });
      } catch (err) {
        set((state) => {
          state.isLoading = false;
          state.error = String(err);
        });
      }
    },

    loadCampaign: async (id) => {
      set((state) => {
        state.isLoading = true;
      });
      try {
        const campaign = await db.campaigns.get(id);
        if (campaign) {
          set((state) => {
            state.activeCampaign = campaign;
            state.isLoading = false;
          });
        } else {
          set((state) => {
            state.isLoading = false;
            state.error = `Campaign ${id} not found`;
          });
        }
      } catch (err) {
        set((state) => {
          state.isLoading = false;
          state.error = String(err);
        });
      }
    },

    createCampaign: (name, description = '') => {
      const id = createId();
      const campaign: Campaign = {
        id,
        name,
        description,
        characters: [],
        encounters: [],
        settings: {},
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      set((state) => {
        state.campaigns.push(campaign);
        state.activeCampaign = campaign;
      });
      db.campaigns.put(campaign).catch(console.error);
      return campaign;
    },

    deleteCampaign: async (id) => {
      try {
        await db.campaigns.delete(id);
        set((state) => {
          state.campaigns = state.campaigns.filter((c) => c.id !== id);
          if (state.activeCampaign?.id === id) {
            state.activeCampaign = null;
          }
        });
      } catch (err) {
        set((state) => {
          state.error = String(err);
        });
      }
    },

    // ─── Character management ───────────────────────────────────────
    addCharacter: (character) =>
      set((state) => {
        if (!state.activeCampaign) return;
        state.activeCampaign.characters.push(character);
        state.activeCampaign.updatedAt = Date.now();
      }),

    removeCharacter: (characterId) =>
      set((state) => {
        if (!state.activeCampaign) return;
        state.activeCampaign.characters =
          state.activeCampaign.characters.filter(
            (c) => c.id !== characterId
          );
        state.activeCampaign.updatedAt = Date.now();
      }),

    updateCharacter: (characterId, updates) =>
      set((state) => {
        if (!state.activeCampaign) return;
        const idx = state.activeCampaign.characters.findIndex(
          (c) => c.id === characterId
        );
        if (idx !== -1) {
          Object.assign(state.activeCampaign.characters[idx], updates);
          state.activeCampaign.updatedAt = Date.now();
        }
      }),

    // ─── Export / Import ────────────────────────────────────────────
    exportCampaign: async (id) => {
      const campaign = await db.campaigns.get(id);
      if (!campaign) throw new Error(`Campaign ${id} not found`);
      return JSON.stringify(campaign, null, 2);
    },

    importCampaign: async (json) => {
      const campaign = JSON.parse(json) as Campaign;
      campaign.updatedAt = Date.now();
      await db.campaigns.put(campaign);
      set((state) => {
        state.campaigns.push(campaign);
        state.activeCampaign = campaign;
      });
      return campaign;
    },

    // ─── Persistence ────────────────────────────────────────────────
    saveToDb: async () => {
      const { activeCampaign } = get();
      if (!activeCampaign) return;
      try {
        await db.campaigns.put(activeCampaign);
        for (const character of activeCampaign.characters) {
          await db.characters.put(character);
        }
      } catch (err) {
        console.error('Failed to save campaign to IndexedDB:', err);
      }
    },
  }))
);

// ─── Auto-save interval (to be called from a React effect) ───────────────────

export function startAutoSave(intervalMs = 5000): () => void {
  const interval = setInterval(() => {
    const combatState = useCombatStore.getState();
    const campaignState = useCampaignStore.getState();

    if (combatState.activeEncounter) {
      combatState.saveToDb().catch(console.error);
    }
    if (campaignState.activeCampaign) {
      campaignState.saveToDb().catch(console.error);
    }
  }, intervalMs);

  return () => clearInterval(interval);
}