// ============================================================================
// Dexie.js IndexedDB Database Schema
// ============================================================================
// Defines the DndDatabase class with all tables for persistent storage.
// Tables: campaigns, encounters, combatants, characters, monsters, effects
// Schema versions: v1 (legacy), v2 (initiativeGroupId), v3 (combatantGroupId)
// ============================================================================

import Dexie, { type Table } from 'dexie';
import type {
  Campaign,
  Encounter,
  Combatant,
  CharacterSheet,
  MonsterBlock,
  Effect,
  InitiativeGroup,
} from '../types/index.js';
import { createId } from '../types/index.js';

export class DndDatabase extends Dexie {
  campaigns!: Table<Campaign, string>;
  encounters!: Table<Encounter, string>;
  combatants!: Table<Combatant, string>;
  characters!: Table<CharacterSheet, string>;
  monsters!: Table<MonsterBlock, string>;
  effects!: Table<Effect, string>;

  constructor() {
    super('DndCombatTracker');

    // v1 — current schema (legacy, kept for migration chain)
    this.version(1).stores({
      campaigns: 'id, name, updatedAt',
      encounters: 'id, name, campaignId, isActive',
      combatants: 'id, name, initiative, isPlayer, isMonster, groupId',
      characters: 'id, name, class, level',
      monsters: 'id, name, type, challengeRating',
      effects: 'id, name, sourceId, concentrationGroup, remainingRounds',
    });

    // v2 — add initiativeGroupId index
    this.version(2).stores({
      campaigns: 'id, name, updatedAt',
      encounters: 'id, name, campaignId, isActive',
      combatants: 'id, name, initiative, isPlayer, isMonster, groupId, initiativeGroupId',
      characters: 'id, name, class, level',
      monsters: 'id, name, type, challengeRating',
      effects: 'id, name, sourceId, concentrationGroup, remainingRounds',
    });

    // v3 — add combatantGroupId, migrate turnOrder → initiativeGroups
    this.version(3).stores({
      campaigns: 'id, name, updatedAt',
      encounters: 'id, name, campaignId, isActive',
      combatants: 'id, name, initiative, isPlayer, isMonster, groupId, initiativeGroupId, combatantGroupId',
      characters: 'id, name, class, level',
      monsters: 'id, name, type, challengeRating',
      effects: 'id, name, sourceId, concentrationGroup, remainingRounds',
    }).upgrade(async (tx) => {
      // Migrate all encounters from v1/v2 flat format to v3 group format
      await tx.table('encounters').toCollection().modify((encounter: any) => {
        // Only migrate if still using old format (has turnOrder, no initiativeGroups)
        if (encounter.turnOrder && !encounter.initiativeGroups) {
          const groups: InitiativeGroup[] = [];

          // Separate players and monsters
          const players = (encounter.combatants || []).filter((c: any) => c.isPlayer);
          const monsters = (encounter.combatants || []).filter((c: any) => !c.isPlayer);

          if (players.length > 0) {
            groups.push({
              id: createId(),
              name: 'Players',
              type: 'players',
              initiative: players[0]?.initiative ?? 0,
              initModifier: 0,
              initMode: 'group',
              combatantIds: players.map((c: any) => c.id),
              currentOrder: encounter.turnOrder.filter((id: string) =>
                players.some((p: any) => p.id === id)
              ),
              currentIndex: 0,
              isActive: true,
            });
          }

          if (monsters.length > 0) {
            // Group monsters by groupId
            const monsterGroups = new Map<string, any[]>();
            for (const m of monsters) {
              const key = m.groupId || m.id;
              if (!monsterGroups.has(key)) monsterGroups.set(key, []);
              monsterGroups.get(key)!.push(m);
            }

            for (const [, mGroup] of monsterGroups) {
              groups.push({
                id: createId(),
                name: mGroup[0].isGroup
                  ? `${mGroup[0].groupSize}x ${mGroup[0].name}`
                  : mGroup[0].name,
                type: 'monsters',
                initiative: mGroup[0]?.initiative ?? 0,
                initModifier: mGroup[0]?.initModifier ?? 0,
                initMode: 'group',
                combatantIds: mGroup.map((c: any) => c.id),
                currentOrder: encounter.turnOrder.filter((id: string) =>
                  mGroup.some((m: any) => m.id === id)
                ),
                currentIndex: 0,
                isActive: true,
              });
            }
          }

          // Compute currentGroupId and groupTurnIndex from turnIndex
          const currentCombatantId = encounter.turnOrder?.[encounter.turnIndex ?? 0];
          let currentGroupId: string | null = null;
          let groupTurnIndex = 0;

          if (currentCombatantId) {
            const currentGroup = groups.find(g =>
              g.combatantIds.includes(currentCombatantId)
            );
            if (currentGroup) {
              const posInGroup = currentGroup.currentOrder.indexOf(currentCombatantId);
              currentGroup.currentIndex = posInGroup !== -1 ? posInGroup : 0;
              currentGroupId = currentGroup.id;
              groupTurnIndex = groups.indexOf(currentGroup);
            }
          }

          if (!currentGroupId && groups.length > 0) {
            currentGroupId = groups[0].id;
          }

          // Remove old fields, add new ones
          delete encounter.turnOrder;
          delete encounter.turnIndex;

          encounter.initiativeGroups = groups;
          encounter.currentGroupId = currentGroupId;
          encounter.groupTurnIndex = groupTurnIndex;
          encounter.round = encounter.round || 1;
          encounter.actionTrackerHistory = [];
        }
      });
    });
  }
}

export const db = new DndDatabase();