# Engine API Specification

> **Назначение:** Полная спецификация API всех engine-компонентов D&D Combat Tracker.
> **Модели данных:** См. [`dnd-combat-tracker-plan.md`](dnd-combat-tracker-plan.md#22-Детальная-модель-данных) секция 2.2.
> **Статус:** Утверждено. Все API консистентны с моделью данных из Трека A.

---

## B1. Concentration API

### 1.1. `effectsEngine.checkConcentration()`

```typescript
checkConcentration(params: {
  casterId: UUID,
  damageTaken: number,
  damageSource: string,      // название эффекта/атаки
  isSingleSource: boolean    // true — урон от одного источника
}): ConcentrationCheckResult

type ConcentrationCheckResult = {
  required: boolean,                    // true если есть на что концентрироваться
  dc: number,                           // max(10, floor(damage/2))
  activeConcentrationIds: UUID[],       // какие concentrationGroupId под угрозой
  message: string                       // "DC 12 Constitution save for Haste"
}
```

**Логика:**
1. Проверить, есть ли у `casterId` активные эффекты с `concentration: true`
2. Если нет — `required: false`, возврат
3. Если есть — `dc = Math.max(10, Math.floor(damageTaken / 2))`
4. Собрать все `concentrationGroupId` под угрозой
5. Сформировать сообщение для UI

### 1.2. UI-протокол концентрации

| Событие | Действие UI |
|---------|-------------|
| DM наносит урон существу с концентрацией | Жёлтый индикатор на [`ConcentrationTracker`](dnd-combat-tracker-plan.md#637) + модалка "DC X Constitution save for [SpellName]" |
| DM вводит результат спасброска | Три варианта: `success` / `fail` / число (результат d20) |
| Natural 1 | Авто-провал (снять все эффекты группы) |
| Natural 20 | Авто-успех (эффекты остаются) |
| Множественные источники урона за ход | Несколько последовательных модалок (по одной на каждый источник) |
| Урон от AoE (Fireball) | Один спасбросок (одна цель получила урон от одного источника) |

### 1.3. Автоматика после провала

```typescript
// При провале спасброска:
onConcentrationBroken(casterId: UUID, concentrationGroupId: UUID): UUID[]
// Возвращает массив ID эффектов, которые были сняты

// Автоматически вызывается из effectsEngine.onDamageTaken()
// 1. Находит все эффекты с данным concentrationGroupId
// 2. Устанавливает isActive = false для каждого
// 3. Вызывает removeEffect() для каждого
// 4. Возвращает список снятых эффектов
```

### 1.4. Пограничные случаи

- **0 HP и концентрация:** При падении до 0 HP концентрация автоматически теряется (все эффекты снимаются)
- **Unconscious:** Концентрация невозможна — эффекты снимаются
- **Petrified:** Концентрация невозможна — эффекты снимаются
- **Смена заклинания:** При наложении нового заклинания с концентрацией — старое автоматически снимается

---

## B2. Effects Engine API

### 2.1. `effectsEngine.applyEffect()`

```typescript
applyEffect(effect: Omit<Effect, 'id' | 'isActive'>): Effect
```

**Логика:**
1. Генерирует `id: UUID`
2. Устанавливает `isActive: true`
3. Если `effect.concentration === true` — проверяет, нет ли уже активной концентрации у `casterId`
   - Если есть — снимает старую (вызов `onConcentrationBroken`)
4. Добавляет эффект в список активных эффектов (в Zustand store)
5. Вызывает пересчёт `getStatModifiers()` для `targetId`
6. Возвращает созданный `Effect`

### 2.2. `effectsEngine.removeEffect()`

```typescript
removeEffect(effectId: UUID): void
```

**Логика:**
1. Находит эффект по `effectId`
2. Устанавливает `isActive: false`
3. Удаляет из активных эффектов
4. Вызывает пересчёт `getStatModifiers()` для `targetId`

### 2.3. `effectsEngine.removeConcentrationGroup()`

```typescript
removeConcentrationGroup(concentrationGroupId: UUID): UUID[]
```

**Логика:**
1. Находит все эффекты с данным `concentrationGroupId`
2. Снимает их все (как в `removeEffect`)
3. Возвращает массив UUID снятых эффектов

### 2.4. `effectsEngine.tickRound()`

```typescript
tickRound(): TickResult

type TickResult = {
  expiredEffects: UUID[],           // эффекты с истекшим сроком
  expiredConditions: UUID[],        // состояния с истекшим сроком
  pendingSaves: SaveReminder[]      // напоминания о спасбросках
}
```

**Логика (вызывается при Next Turn / End Turn):**
1. Для каждого активного эффекта:
   - Если `duration.remainingRounds` > 0: декремент
   - Если `duration.remainingRounds` === 0: в `expiredEffects`
   - Если `duration.expiresOnTurnId === currentTurnId`: в `expiredEffects`
   - Если `duration.saveCondition` и `timing` совпадает с текущим моментом: в `pendingSaves`
2. Для каждого активного состояния:
   - Аналогичная логика по `duration`
3. Возвращает `TickResult`

### 2.5. `effectsEngine.onDamageTaken()`

```typescript
onDamageTaken(combatantId: UUID, damage: number, source: string): ConcentrationCheckResult | null
```

**Логика:**
1. Проверяет, есть ли у `combatantId` активная концентрация
2. Если нет — возвращает `null`
3. Если есть — вызывает `checkConcentration()` с параметрами
4. Возвращает результат

### 2.6. `effectsEngine.getStatModifiers()`

```typescript
getStatModifiers(combatantId: UUID): StatModifiers

type StatModifiers = {
  ac: number,
  speed: number,
  advantage: string[],
  disadvantage: string[],
  immunities: string[],
  vulnerabilities: string[]
}
```

**Логика:**
1. Собирает все активные эффекты для `combatantId`
2. Суммирует модификаторы `ac`, `speed`
3. Собирает `advantage`, `disadvantage`, `immunities`, `vulnerabilities` из всех эффектов
4. Вызывает `getConditionModifiers()` из Condition Engine для объединения
5. Возвращает объединённый результат

### 2.7. `effectsEngine.getEffects()`

```typescript
getEffects(combatantId: UUID): Effect[]
```

### 2.8. `effectsEngine.hasConcentration()`

```typescript
hasConcentration(combatantId: UUID): boolean
```

### 2.9. `effectsEngine.getActiveConcentrations()`

```typescript
getActiveConcentrations(): { casterId: UUID, effects: Effect[] }[]
```

---

## B3. Condition Engine API

### 3.1. `conditionEngine.applyCondition()`

```typescript
applyCondition(combatantId: UUID, condition: Omit<Condition, 'id'>): Condition
```

**Логика:**
1. Генерирует `id: UUID`
2. Добавляет состояние в `combatant.conditions`
3. Вызывает `getAutoEffects()` для применения автоматических эффектов
4. Вызывает пересчёт `getStatModifiers()`
5. Возвращает созданный `Condition`

### 3.2. `conditionEngine.removeCondition()`

```typescript
removeCondition(combatantId: UUID, conditionId: UUID): void
```

### 3.3. `conditionEngine.hasCondition()`

```typescript
hasCondition(combatantId: UUID, conditionName: string): boolean
```

### 3.4. `conditionEngine.getConditionModifiers()`

```typescript
getConditionModifiers(combatantId: UUID): StatModifiers
```

### 3.5. `conditionEngine.getAutoEffects()`

```typescript
getAutoEffects(combatantId: UUID): AutoEffect[]

type AutoEffect = {
  type: "advantage" | "disadvantage" | "immunity" | "cannotAct",
  context: string
}
```

**Авто-эффекты состояний (D&D 5e RAW):**

| Condition | AutoEffect |
|-----------|-----------|
| blinded | disadvantage on attack rolls, advantage on attack rolls against |
| charmed | disadvantage on ability checks to interact |
| frightened | disadvantage on ability checks and attack rolls while source visible |
| grappled | speed = 0 |
| incapacitated | cannotAct |
| invisible | advantage on attack rolls, disadvantage on attack rolls against |
| paralyzed | cannotAct, auto-crit on melee hits |
| petrified | cannotAct, immunity to damage |
| poisoned | disadvantage on attack rolls and ability checks |
| prone | disadvantage on attack rolls, advantage on melee attacks against |
| restrained | disadvantage on attack rolls, advantage on attacks against |
| stunned | cannotAct, auto-fail STR/DEX saves |
| unconscious | cannotAct, auto-fail STR/DEX saves, auto-crit on melee hits |

### 3.6. `conditionEngine.clearConditions()`

```typescript
clearConditions(combatantId: UUID): void
```

### 3.7. `conditionEngine.applyDeathSave()`

```typescript
applyDeathSave(combatantId: UUID, result: DeathSaveResult): DeathSaveOutcome

type DeathSaveResult = "success" | "fail" | "natural1" | "natural20"
type DeathSaveOutcome = {
  successes: number,
  failures: number,
  stabilized: boolean,
  isAlive: boolean,
  isDead: boolean
}
```

**Логика:**
1. Natural 20: немедленная стабилизация + 1 HP
2. Natural 1: 2 failures
3. success: +1 success (3 successes = stabilized)
4. fail: +1 failure (3 failures = dead)
5. Урон при 0 HP: 1 failure за каждый источник урона (или 2 если crit)

---

## B4. Roll Engine API

### 4.1. `rollEngine.rollInitiative()`

```typescript
rollInitiative(monster: MonsterBlock): number  // d20 + dex modifier
```

### 4.2. `rollEngine.rollGroupInitiative()`

```typescript
rollGroupInitiative(group: Combatant, monster: MonsterBlock): number
```

**Решение:** Один бросок на всю группу. Все монстры группы ходят одновременно.

### 4.3. `rollEngine.setPlayerInitiative()`

```typescript
setPlayerInitiative(combatantId: UUID, value: number): void
```

### 4.4. `rollEngine.buildTurnOrder()`

```typescript
buildTurnOrder(combatants: Combatant[]): UUID[]
```

**Правила сортировки:**
1. По инициативе (высокая → низкая)
2. Ничьи: по Dexterity (высокая → низкая)
3. Если всё равно ничья: DM выбирает (или порядок добавления)

### 4.5. `rollEngine.addMidCombat()`

```typescript
addMidCombat(combatant: Combatant, currentTurnIndex: number): {
  newTurnOrder: UUID[],
  adjustedTurnIndex: number,
  insertPosition: "afterCurrent" | "endOfRound" | "dmChoice"
}
```

**Логика:**
1. Если инициатива выше текущего — вставить после текущего хода
2. Если инициатива ниже — вставить в конец раунда
3. Если DM хочет сам выбрать — `dmChoice`
4. Возвращает новый `turnOrder` и скорректированный `turnIndex`

### 4.6. `rollEngine.rollDamage()`

```typescript
rollDamage(damageExpression: string): number  // "2d6+3"
```

### 4.7. `rollEngine.rollD20()`

```typescript
rollD20(advantage?: "none" | "advantage" | "disadvantage"): number
```

### 4.8. `rollEngine.rollD100()`

```typescript
rollD100(): number
```

---

## B5. Save Condition Auto-Reminder

### 5.1. SaveReminder тип

```typescript
type SaveReminder = {
  combatantId: UUID,
  effectId: UUID,
  effectName: string,           // "Flesh to Stone"
  timing: "startOfTurn" | "endOfTurn",
  saveDC: number,
  ability: string,              // "con"
  onSave: "remove" | "reduce" | "noEffect",
}
```

### 5.2. Механизм работы

1. **Генерация:** `tickRound()` проверяет все активные эффекты с `saveCondition`. Если `timing` совпадает — добавляет `SaveReminder` в `pendingSaves`.

2. **Отображение:** При наступлении хода существа с `pendingSaves` — модалка/баннер "Спасбросок [ability] DC [dc] для [effectName]".

3. **Ввод результата:**
   - DM вводит число (результат d20) или выбирает "success"/"fail"
   - При `success`:
     - `onSave === "remove"` → `removeEffect(effectId)`
     - `onSave === "reduce"` → уменьшить эффект (например, уровень паралича)
     - `onSave === "noEffect"` → ничего не менять (эффект остаётся)
   - При `fail`:
     - Эффект продолжается

4. **Автоматика:** Если DM не ввёл результат до конца хода — напоминание сохраняется до следующего хода.

---

## Приложение: Сводка всех engine-файлов

| Файл | API методов | Назначение |
|------|-------------|------------|
| `effectsEngine.ts` | 9 методов | Эффекты, концентрация, модификаторы |
| `conditionEngine.ts` | 7 методов | Состояния, авто-эффекты, death saves |
| `rollEngine.ts` | 8 методов | Инициатива, урон, d20, d100 |
| `spellEngine.ts` | (см. основной план) | Ячейки, уровни, мультикласс |
| `restEngine.ts` | (см. основной план) | Короткий/длинный отдых |

---

## История изменений

| Версия | Дата | Изменения |
|--------|------|-----------|
| 1.0 | 2026-07-24 | Создан. B1-B5 из Трека B. |