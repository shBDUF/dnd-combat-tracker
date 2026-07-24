// ============================================================================
// D&D Combat Tracker — Core Type Definitions
// ============================================================================
// This file defines ALL shared types for the application.
// Types are organized by domain: Combatant, Conditions, Effects, Characters,
// Monsters, Encounters, Campaigns, and Engine-specific types.
// ============================================================================

import { nanoid } from 'nanoid';

// ─── UUID Type ───────────────────────────────────────────────────────────────
export type UUID = string;

// ─── Utility: createId ───────────────────────────────────────────────────────
export function createId(): UUID {
  return nanoid();
}

// ─── D&D Condition Names ─────────────────────────────────────────────────────
export type DndCondition =
  | 'Blinded'
  | 'Charmed'
  | 'Deafened'
  | 'Fatigued'
  | 'Frightened'
  | 'Grappled'
  | 'Incapacitated'
  | 'Invisible'
  | 'Paralyzed'
  | 'Petrified'
  | 'Poisoned'
  | 'Prone'
  | 'Restrained'
  | 'Stunned'
  | 'Unconscious'
  | 'Exhaustion'
  | 'Concentrating'
  | 'Dazed'
  | 'Bloodied';

// ─── Ability Scores ──────────────────────────────────────────────────────────
export type DndStat = 'str' | 'dex' | 'con' | 'int' | 'wis' | 'cha';

// ─── Duration ────────────────────────────────────────────────────────────────
export interface Duration {
  type:
    | 'round'
    | 'minute'
    | 'hour'
    | 'day'
    | 'permanent'
    | 'untilSave'
    | 'untilTurnEnd'
    | 'untilTurnStart';
  value: number;
}

// ─── Tracking Type — what the effect tracks ──────────────────────────────────
export type TrackingType = 'none' | 'damage' | 'healing' | 'tempHp' | 'resource';

// ─── D&D Source Type — what created the effect ───────────────────────────────
export type DndSourceType =
  | 'spell'
  | 'item'
  | 'feature'
  | 'trait'
  | 'environment'
  | 'homebrew';

// ─── Save Reminder ───────────────────────────────────────────────────────────
export interface SaveReminder {
  stat: DndStat;
  dc: number;
  frequency: 'instant' | 'endOfTurn' | 'startOfTurn';
  onPass: 'remove' | 'reduceDuration' | 'nothing';
  onFail: 'damage' | 'extendDuration' | 'applyCondition';
  failCondition?: DndCondition;
  failDamage?: string; // dice expression e.g. "2d6"
}

// ─── Death Saves ─────────────────────────────────────────────────────────────
export interface DeathSaves {
  successes: number;
  failures: number;
  isStable: boolean;
}

// ─── Condition (D&D 5e condition applied to a combatant) ────────────────────
export interface Condition {
  id: UUID;
  name: DndCondition;
  sourceId: UUID; // combatant who applied it
  duration: Duration;
  description: string;
}

// ─── Effect (active effect from a spell/feature/item) ────────────────────────
export interface Effect {
  id: UUID;
  name: string;
  sourceId: UUID;
  targets: UUID[];
  duration: Duration;
  remainingRounds: number;
  expiresOnTurnId: UUID | null; // specific combatant's turn
  saveCondition: SaveReminder | null;
  statModifiers: Partial<Record<DndStat, number>>;
  description: string;
  concentrationGroup: string | null; // group identifier for concentration effects
  isActive: boolean;
  trackingType: TrackingType;
  dndSourceType: DndSourceType;
}

// ─── Combatant (core participant in combat) ──────────────────────────────────
export interface Combatant {
  id: UUID;
  name: string;
  initiative: number;
  initModifier: number;
  ac: number;
  maxHp: number;
  currentHp: number;
  tempHp: number;
  conditions: Condition[];
  effects: Effect[];
  isConcentrating: boolean;
  concentrationOn: Effect | null;
  isPlayer: boolean;
  isMonster: boolean;
  monsterId?: string; // reference to monster template
  groupId?: UUID; // for group monsters (legacy, kept for migration)
  deathsaves: DeathSaves;
  sortIndex: number; // tiebreaker for initiative
  isDead: boolean;
  notes: string;
  // ── Track C: Initiative Groups + Action Economy ──
  initiativeGroupId: UUID | null;  // ссылка на InitiativeGroup.id
  actionTracker: ActionTracker;    // трекинг действий в этом раунде
  speed: number;                   // скорость в ft (для movement tracking)
  combatantGroupId: UUID | null;   // для групповых монстров (5x Goblin), общий ID
  combatantGroupSize: number;      // сколько всего в группе монстров
  combatantGroupIndex: number;     // индекс этого конкретного монстра (0..groupSize-1)
}

// ─── CharacterSheet (player character profile) ───────────────────────────────
export interface CharacterSheet {
  id: UUID;
  name: string;
  race: string;
  class: string[];
  level: number;
  stats: Record<DndStat, number>;
  savingThrows: Partial<Record<DndStat, number>>;
  skills: Record<string, number>;
  ac: number;
  maxHp: number;
  currentHp: number;
  tempHp: number;
  speed: number;
  initiative: number;
  spellList: SpellList;
  resources: Resource[];
  inventory: Item[];
  proficiencies: string[];
  traits: string[];
  features: string[];
  deathsaves: DeathSaves;
  description: string;
  source: 'lss' | 'manual';
  lssRaw?: unknown; // original LSS JSON
}

// ─── SpellList ───────────────────────────────────────────────────────────────
export interface SpellList {
  spellcastingAbility: DndStat;
  spellSaveDC: number;
  spellAttackBonus: number;
  slots: Record<number, { total: number; used: number }>; // spell level -> slots
  preparedSpells: SpellRef[];
  knownSpells: SpellRef[];
}

// ─── SpellRef ────────────────────────────────────────────────────────────────
export interface SpellRef {
  id: UUID;
  name: string;
  level: number;
  school: string;
  isPrepared: boolean;
}

// ─── Resource (class resources: Rage, Ki, Bardic Inspiration, etc.) ──────────
export interface Resource {
  id: UUID;
  name: string;
  max: number;
  current: number;
  shortRestReset: boolean;
  longRestReset: boolean;
}

// ─── Item (inventory item) ───────────────────────────────────────────────────
export interface Item {
  id: UUID;
  name: string;
  quantity: number;
  description: string;
  weight: number;
  isMagical: boolean;
  isEquipped: boolean;
}

// ─── MonsterBlock ────────────────────────────────────────────────────────────
export interface MonsterBlock {
  id: UUID;
  name: string;
  size: string;
  type: string;
  alignment: string;
  ac: number;
  maxHp: number;
  speed: string;
  stats: Record<DndStat, number>;
  savingThrows: Partial<Record<DndStat, number>>;
  skills: Record<string, number>;
  damageVulnerabilities: string[];
  damageResistances: string[];
  damageImmunities: string[];
  conditionImmunities: string[];
  senses: string;
  languages: string;
  challengeRating: string;
  xp: number;
  traits: Trait[];
  actions: Action[];
  legendaryActions: Action[];
  reactions: Action[];
  source: string;
}

// ─── Action (monster action / attack) ────────────────────────────────────────
export interface Action {
  id: UUID;
  name: string;
  description: string;
  attackBonus: number;
  damageDice: string;
  damageType: string;
  damageBonus: number;
  saveDC: number | null;
  saveStat: DndStat | null;
  isLegendary: boolean;
  isReaction: boolean;
  usesPerDay: number | null;
  usesRemaining: number | null;
}

// ─── Trait (monster special trait) ───────────────────────────────────────────
export interface Trait {
  id: UUID;
  name: string;
  description: string;
}

// ─── Track C: Initiative Groups + Action Economy ─────────────────────────────

// ─── InitiativeGroup ──────────────────────────────────────────────────────────
export interface InitiativeGroup {
  id: UUID;
  name: string;                    // "Players", "Monsters", "Goblin Squad"
  type: 'players' | 'monsters' | 'allies' | 'npc';
  initiative: number;              // общий бросок d20 + модификатор группы
  initModifier: number;            // модификатор инициативы группы (среднее арифметическое бонусов участников, округлённое вверх)
  initMode: 'group' | 'individual'; // group = общая инициатива, individual = каждый сам за себя
  combatantIds: UUID[];            // участники группы (ссылки на Combatant.id)
  currentOrder: UUID[];            // порядок хода ВНУТРИ группы в ЭТОМ раунде
  currentIndex: number;            // индекс текущего ходящего внутри currentOrder
  isActive: boolean;               // false если группа побеждена/удалена
}

// ─── ActionTracker ────────────────────────────────────────────────────────────
export interface ActionTracker {
  action: boolean;       // true = потрачено
  bonusAction: boolean;  // true = потрачено
  reaction: boolean;     // true = потрачено
  movement: number;      // сколько ft уже потрачено из скорости
  movementSpeed: number; // базовая скорость в ft (берётся из Combatant.speed)

  // Legendary Actions (опционально, только для монстров с legendary)
  legendaryActionsAvailable: number;  // сколько осталось в этом раунде
  legendaryActionsMax: number;        // максимум в раунд (обычно 3)

  // Monster simplification (опционально)
  isActed: boolean;       // true = монстр уже действовал в этом раунде
}

// ─── ActionTrackerSnapshot ────────────────────────────────────────────────────
export interface ActionTrackerSnapshot {
  combatantId: UUID;
  actionTracker: ActionTracker;
  timestamp: number;  // для отладки
}

// ─── GroupTickResult — discriminated union ────────────────────────────────────
export type GroupTickResult =
  | {
      type: 'next_combatant';
      previousGroupId: UUID | null;
      currentGroupId: UUID | null;
      previousCombatantId: UUID | null;
      currentCombatantId: UUID | null;
      round: number;
      tickResult: null;
      legendaryActionCombatants: UUID[];
    }
  | {
      type: 'next_group';
      previousGroupId: UUID | null;
      currentGroupId: UUID | null;
      previousCombatantId: UUID | null;
      currentCombatantId: UUID | null;
      round: number;
      tickResult: null;
      legendaryActionCombatants: UUID[];
    }
  | {
      type: 'new_round';
      previousGroupId: UUID | null;
      currentGroupId: UUID | null;
      previousCombatantId: UUID | null;
      currentCombatantId: UUID | null;
      round: number;
      tickResult: TickResult;
      legendaryActionCombatants: UUID[];
    }
  | {
      type: 'combat_end';
      previousGroupId: UUID | null;
      currentGroupId: UUID | null;
      previousCombatantId: UUID | null;
      currentCombatantId: UUID | null;
      round: number;
      tickResult: null;
      legendaryActionCombatants: [];
    }
  | {
      type: 'legendary_action_opportunity';
      previousGroupId: UUID | null;
      currentGroupId: UUID | null;
      previousCombatantId: UUID | null;
      currentCombatantId: UUID | null;
      round: number;
      tickResult: null;
      legendaryActionCombatants: UUID[];
    };

// ─── GroupInitiativeRoll ──────────────────────────────────────────────────────
export interface GroupInitiativeRoll {
  groupId: UUID;
  groupName: string;
  roll: number;           // результат d20
  modifier: number;       // модификатор
  total: number;          // roll + modifier
  manual: boolean;        // true если DM выставил вручную
}

// ─── StartBattleParams ────────────────────────────────────────────────────────
export interface StartBattleParams {
  name: string;                         // Encounter name
  environment?: string;                 // Encounter environment
  notes?: string;                       // Encounter notes
  groups: {
    name: string;
    type: InitiativeGroup['type'];
    combatantIds: UUID[];
    initiative?: number;       // опционально — если DM уже выставил
    initModifier?: number;     // опционально — модификатор группы
    initMode?: 'group' | 'individual';
  }[];
}

// ─── RemoveFromGroupResult ────────────────────────────────────────────────────
export interface RemoveFromGroupResult {
  updatedEncounter: Encounter;
  removedCombatant: Combatant;
  groupSurvivors: Combatant[];   // оставшиеся члены группы
  groupDeleted: boolean;         // true если группа полностью удалена
  newCurrentGroupId: UUID | null;  // скорректированный currentGroupId
}

// ─── Encounter (active combat) v3 ────────────────────────────────────────────
export interface Encounter {
  id: UUID;
  name: string;
  campaignId: UUID | null;
  combatants: Combatant[];
  round: number;
  isActive: boolean;
  startTime: number;
  environment: string;
  notes: string;
  // ── Track C: Initiative Groups ──
  initiativeGroups: InitiativeGroup[];  // группы инициативы
  currentGroupId: UUID | null;          // какая группа ходит сейчас
  groupTurnIndex: number;               // индекс группы в initiativeGroups
  actionTrackerHistory: ActionTrackerSnapshot[];  // история для prevTurn()
  // @deprecated — удалены в v3:
  // turnIndex: number;
  // turnOrder: UUID[];
}

// ─── Campaign ────────────────────────────────────────────────────────────────
export interface Campaign {
  id: UUID;
  name: string;
  description: string;
  characters: CharacterSheet[];
  encounters: Encounter[];
  settings: Record<string, unknown>;
  createdAt: number;
  updatedAt: number;
}

// ─── Engine-specific types ───────────────────────────────────────────────────

// ConcentrationCheckResult
export interface ConcentrationCheckResult {
  passed: boolean;
  newDC: number;
  broken: boolean;
  brokenEffects: Effect[];
}

// TickResult — result of a round tick
export interface TickResult {
  expiredEffects: Effect[];
  triggeredSaves: SaveReminder[];
  updatedCombatants: UUID[];
  concentrationBroken: UUID[];
}

// ConditionModifiers — computed modifiers from conditions
export interface ConditionModifiers {
  ac: number;
  attack: number;
  speed: number;
  dexSaves: 'advantage' | 'disadvantage' | 'normal';
  strSaves: 'advantage' | 'disadvantage' | 'normal';
  abilityChecks: 'advantage' | 'disadvantage' | 'normal';
  autoFail: DndStat[];
  autoFailSaves: boolean;
}

// DeathSaveResult — outcome of a death save application
export type DeathSaveResult = 'stable' | 'alive' | 'dead' | 'ongoing';

// LSS Parse Result
export type LssParseResult =
  | { success: true; character: CharacterSheet }
  | { success: false; errors: string[] };

// Damage roll result
export interface DamageRollResult {
  total: number;
  individual: number[];
  expression: string;
}