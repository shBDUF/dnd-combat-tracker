// ============================================================================
// Zustand Stores with Dexie Sync
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
import { buildTurnOrder } from '../engine/roll.js';

// ─── Combat State ────────────────────────────────────────────────────────────

export interface CombatState {
  activeEncounter: Encounter | null;
  isLoading: boolean;
  error: string | null;
}

export interface CombatActions {
  // Encounter lifecycle
  initEncounter: (encounter: Encounter) => void;
  loadEncounter: (id: UUID) => Promise<void>;
  endCombat: () => Promise<void>;

  // Turn management
  nextTurn: () => TickResult | null;
  prevTurn: () => void;

  // Combatant management
  addCombatant: (combatant: Combatant) => void;
  removeCombatant: (combatantId: UUID) => void;
  updateCombatant: (combatantId: UUID, updates: Partial<Combatant>) => void;

  // HP management
  damageCombatant: (combatantId: UUID, damage: number) => void;
  healCombatant: (combatantId: UUID, amount: number) => void;
  setTempHp: (combatantId: UUID, tempHp: number) => void;

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
    isLoading: false,
    error: null,

    // ─── Encounter lifecycle ────────────────────────────────────────
    initEncounter: (encounter) =>
      set((state) => {
        state.activeEncounter = encounter;
        state.isLoading = false;
        state.error = null;
      }),

    loadEncounter: async (id) => {
      set((state) => {
        state.isLoading = true;
      });
      try {
        const encounter = await db.encounters.get(id);
        if (encounter) {
          set((state) => {
            state.activeEncounter = encounter;
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
      // Save the ended encounter to DB first
      set((state) => {
        state.activeEncounter = ended;
      });
      await saveToDb();
      // Then clear activeEncounter so UI returns to empty state
      set((state) => {
        state.activeEncounter = null;
      });
    },

    // ─── Turn management ────────────────────────────────────────────
    nextTurn: () => {
      const { activeEncounter } = get();
      if (!activeEncounter) return null;

      // Find next non-dead combatant
      const totalAlive = activeEncounter.combatants.filter(
        (c) => !c.isDead && c.currentHp > 0
      ).length;
      if (totalAlive === 0) return null; // everyone dead

      let nextIndex = (activeEncounter.turnIndex + 1) % activeEncounter.turnOrder.length;
      let safety = 0;
      while (
        safety < activeEncounter.turnOrder.length &&
        activeEncounter.combatants.find(
          (c) => c.id === activeEncounter.turnOrder[nextIndex]
        )?.isDead
      ) {
        nextIndex = (nextIndex + 1) % activeEncounter.turnOrder.length;
        safety++;
      }

      // A new round starts when we wrap around to the first turn index
      const isNewRound = nextIndex <= activeEncounter.turnIndex || safety > 0;

      let tickResult: TickResult | null = null;

      if (isNewRound) {
        // Tick all combatants at the start of a new round
        const updatedCombatants = activeEncounter.combatants.map((c) => {
          const result = tickRound(c);
          return result.combatant;
        });
        tickResult = {
          expiredEffects: [],
          triggeredSaves: [],
          updatedCombatants: updatedCombatants.map((c) => c.id),
          concentrationBroken: [],
        };
        set((state) => {
          if (state.activeEncounter) {
            state.activeEncounter.combatants = updatedCombatants;
            state.activeEncounter.round += 1;
            state.activeEncounter.turnIndex = nextIndex;
          }
        });
      } else {
        set((state) => {
          if (state.activeEncounter) {
            state.activeEncounter.turnIndex = nextIndex;
          }
        });
      }

      return tickResult;
    },

    prevTurn: () => {
      set((state) => {
        if (!state.activeEncounter) return;
        const prevIndex =
          state.activeEncounter.turnIndex === 0
            ? state.activeEncounter.turnOrder.length - 1
            : state.activeEncounter.turnIndex - 1;
        state.activeEncounter.turnIndex = prevIndex;
      });
    },

    // ─── Combatant management ───────────────────────────────────────
    addCombatant: (combatant) =>
      set((state) => {
        if (!state.activeEncounter) return;
        const newTurnOrder = buildTurnOrder([
          ...state.activeEncounter.combatants,
          combatant,
        ]);
        state.activeEncounter.combatants.push(combatant);
        state.activeEncounter.turnOrder = newTurnOrder;
      }),

    removeCombatant: (combatantId) =>
      set((state) => {
        if (!state.activeEncounter) return;
        state.activeEncounter.combatants =
          state.activeEncounter.combatants.filter(
            (c) => c.id !== combatantId
          );
        state.activeEncounter.turnOrder =
          state.activeEncounter.turnOrder.filter(
            (id) => id !== combatantId
          );
        if (
          state.activeEncounter.turnIndex >=
          state.activeEncounter.turnOrder.length
        ) {
          state.activeEncounter.turnIndex = Math.max(
            0,
            state.activeEncounter.turnOrder.length - 1
          );
        }
      }),

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

    damageCombatant: (combatantId, damage) =>
      set((state) => {
        if (!state.activeEncounter) return;
        const combatant = state.activeEncounter.combatants.find(
          (c) => c.id === combatantId
        );
        if (!combatant) return;

        // Apply temp HP first
        let remaining = damage;
        if (combatant.tempHp > 0) {
          const absorbed = Math.min(combatant.tempHp, remaining);
          combatant.tempHp -= absorbed;
          remaining -= absorbed;
        }

        combatant.currentHp = Math.max(0, combatant.currentHp - remaining);

        if (combatant.currentHp <= 0) {
          if (combatant.isPlayer) {
            // Players fall unconscious, not dead
            combatant.isDead = false;
          } else {
            // Monsters die
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
          // Remove Unconscious condition when healed above 0
          if (combatant.isPlayer) {
            const unconsciousIdx = combatant.conditions.findIndex(
              (c) => c.name === 'Unconscious'
            );
            if (unconsciousIdx !== -1) {
              // Remove Unconscious and its auto-applied conditions
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

      const expiredEffects: import('../types/index.js').Effect[] = [];
      const triggeredSaves: import('../types/index.js').SaveReminder[] = [];

      const updatedCombatants = activeEncounter.combatants.map((c) => {
        const currentTurnId =
          activeEncounter.turnOrder[activeEncounter.turnIndex];
        const result = tickRound(c, currentTurnId);
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