// ============================================================================
// Dexie.js IndexedDB Database Schema
// ============================================================================
// Defines the DndDatabase class with all tables for persistent storage.
// Tables: campaigns, encounters, combatants, characters, monsters, effects
// ============================================================================

import Dexie, { type Table } from 'dexie';
import type {
  Campaign,
  Encounter,
  Combatant,
  CharacterSheet,
  MonsterBlock,
  Effect,
} from '../types/index.js';

export class DndDatabase extends Dexie {
  campaigns!: Table<Campaign, string>;
  encounters!: Table<Encounter, string>;
  combatants!: Table<Combatant, string>;
  characters!: Table<CharacterSheet, string>;
  monsters!: Table<MonsterBlock, string>;
  effects!: Table<Effect, string>;

  constructor() {
    super('DndCombatTracker');

    this.version(1).stores({
      campaigns: 'id, name, updatedAt',
      encounters: 'id, name, campaignId, isActive',
      combatants: 'id, name, initiative, isPlayer, isMonster, groupId',
      characters: 'id, name, class, level',
      monsters: 'id, name, type, challengeRating',
      effects: 'id, name, sourceId, concentrationGroup, remainingRounds',
    });
  }
}

export const db = new DndDatabase();