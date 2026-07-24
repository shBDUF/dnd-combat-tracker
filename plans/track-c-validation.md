# Валидация Track C: Initiative Groups + Action Economy

> **Дата:** 2026-07-24
> **Валидируемый документ:** [`track-c-initiative-groups.md`](track-c-initiative-groups.md)
> **Задача:** Полная переработка системы инициативы: замена плоского `turnOrder: UUID[]` на иерархическую `InitiativeGroup[]`

---

## 1. Найденные проблемы

### 🔴 1.1 — BLOCKER: `currentGroupId` — потеря консистентности при удалении группы

**Файл:** [`track-c-initiative-groups.md:63-75`](track-c-initiative-groups.md#L63-L75)

**Проблема:** В `Encounter` добавлено поле `currentGroupId: UUID | null`. Однако при удалении группы (в [`removeCombatant`](track-c-initiative-groups.md#L609)) или её деактивации, `currentGroupId` может указывать на несуществующую группу. В [`store.ts`](../src/storage/store.ts#L210) уже есть прецедент этой проблемы с `turnIndex`.

**Риск:** `getCurrentCombatant()` (секция 2.1) упадёт с `null` или вернет некорректные данные, если группа удалена, но `currentGroupId` не обновлён.

**Решение:** В `removeCombatant` и `removeCombatantFromGroup` всегда проверять и корректировать `currentGroupId`. После удаления группы:
- Если `currentGroupId` указывал на удалённую группу — перейти к следующей активной группе
- Или установить `null` (бой завершён)

---

### 🔴 1.2 — BLOCKER: Конфликт `InitiativeGroup` и существующей `isGroup` / `groupId` модели групповых монстров

**Файлы:** [`track-c-initiative-groups.md:17-27`](track-c-initiative-groups.md#L17-L27) → `InitiativeGroup` vs [`types/index.ts:132-135`](../src/types/index.ts#L132-L135)

**Проблема:** В current [`Combatant`](../src/types/index.ts#L116) уже есть:
- `groupId?: UUID` — идентификатор группы монстров (для `5x Goblin`)
- `isGroup: boolean` — true для группового монстра
- `groupSize: number`, `individualHp: number`

Track C вводит `InitiativeGroup` с `combatantIds: UUID[]` и `initiativeGroupId: UUID` на combatant'е. Это **два разных понятия «группы»**:
1. **Monster Group** (`isGroup`) — одна запись combatant'а, представляющая N монстров с общим пулом HP
2. **Initiative Group** (`InitiativeGroup`) — группа combatant'ов (разных), ходящих по общей инициативе

**Конфликт:** Если DM добавляет `5x Goblin` (isGroup=true), то:
- У него один `Combatant.id`
- `initiativeGroupId` указывает на `InitiativeGroup`
- Но `currentOrder` содержит один `UUID` на всю группу — как понять, что в мульти-группе несколько монстров?

**Риск:** Интерфейс запутает DM: групповой монстр отображается одной строкой в `InitiativeGroupCard`, но физически представляет 5 существ.

**Решение:** Добавить в `InitiativeGroup.currentOrder` развёрнутые ссылки для групповых монстров. Например, если combatant с `isGroup=true` и `groupSize=5`, то `currentOrder` содержит 5 записей с одним `combatantId`. Либо — отметить количество: `{ combatantId: UUID, instanceIndex: number }[]`. Требуется уточнение типа `currentOrder`.

---

### 🔴 1.3 — BLOCKER: `tickRound()` в `nextTurn()` при новом раунде — дублирование с существующей логикой

**Файлы:** [`track-c-initiative-groups.md:165-172`](track-c-initiative-groups.md#L165-L172) и [`store.ts:176-207`](../src/storage/store.ts#L176-L207)

**Проблема:** Существующий [`nextTurn()` в store](../src/storage/store.ts#L153) вызывает `tickRound()` при начале нового раунда. Track C дублирует эту логику в секции 2.2 (псевдокод). Но в секции 5.3 (новая реализация в store) `tickRound` не упомянут — только комментарий "сбросить всё, инкремент round".

**Риск:** Эффекты не будут тикать при смене раундов в новой системе, если реализация store не вызовет `tickRound()`.

**Решение:** Явно указать в секции 5.3, что `tickRound()` вызывается при `new_round` — так же, как сейчас в store.ts.

---

### 🟡 1.4 — CRITICAL: Legendary Actions — отсутствие интеграции

**Файл:** [`track-c-initiative-groups.md:890-893`](track-c-initiative-groups.md#L890-L893)

**Проблема:** Legendary Actions упомянуты в "Дискуссионных вопросах" как "не входит в этот Track, но архитектура должна позволять расширение". Однако Track C меняет всю архитектуру turn engine, так что без явной точки расширения (extension point) Legendary Actions будет сложно добавить позже.

**Конкретные требования D&D 5e:**
- Legendary Actions восстанавливаются **в начале хода монстра** (обычно 3/раунд)
- Тратятся **после хода любого другого существа** (вне обычной очереди)
- С группой инициативы: после каждого `next_combatant` другой группы, DM должен иметь возможность потратить Legendary Action

**Риск:** В текущей архитектуре Legendary Actions — это отдельный `ActionTracker` (legendaryActions: number, legendaryActionsMax: number), который сбрасывается при начале хода группы монстров. Но нет UI-механизма для их траты между ходами.

**Решение:** Добавить в `ActionTracker` поле `legendaryActionsAvailable: number` и `legendaryActionsMax: number`. В UI — кнопку "Use Legendary Action" в `ActionTrackerPanel`, активную только когда:
1. Текущий ход — не группа монстров (Legendary Actions тратятся после хода других)
2. У текущей группы монстров есть `legendaryActionsAvailable > 0`

Добавить в `GroupTickResult` новое событие `legendary_action_opportunity`.

---

### 🟡 1.5 — CRITICAL: `prevTurn()` не сбрасывает `ActionTracker`

**Файл:** [`track-c-initiative-groups.md:178-192`](track-c-initiative-groups.md#L178-L192)

**Проблема:** `prevTurn()` — откат на предыдущий combatant. Нужно восстановить `ActionTracker` предыдущего combatant'а до состояния до нажатия Next. Но Track C не описывает механизм сохранения предыдущего состояния.

**Риск:** При откате хода ActionTracker остаётся в "потраченном" состоянии, DM не может повторно отметить действия.

**Решение:** Добавить snapshot `ActionTracker` при каждом `nextTurn()` и восстанавливать при `prevTurn()`. Либо хранить историю `ActionTracker` за текущий раунд.

---

### 🟡 1.6 — CRITICAL: Миграция — потеря данных `turnIndex`

**Файл:** [`track-c-initiative-groups.md:696-774`](track-c-initiative-groups.md#L696-L774)

**Проблема:** Миграция конвертирует `turnOrder` в `initiativeGroups`, но не учитывает `turnIndex` — на каком ходу остановился незавершённый бой.

**Пример:** Encounter был сохранён на ходу 3 (Aragorn), round 2. После миграции все группы начинают с `currentIndex=0`, `groupTurnIndex=0`, `round` сохраняется.

**Риск:** DM загружает незавершённый бой и видит совершенно другой ход.

**Решение:** В миграции вычислять, какой combatant был текущим (`turnOrder[turnIndex]`), находить его группу и устанавливать `currentIndex` на позицию этого combatant'а в `currentOrder`. `round` сохранять.

---

### 🟡 1.7 — MEDIUM: `initModifier` для группы игроков — «наименьший Dex» не всегда корректен

**Файл:** [`track-c-initiative-groups.md:248`](track-c-initiative-groups.md#L248)

**Проблема:** "Для игроков используем наименьший initModifier среди участников группы". Это спорное правило:
- В D&D 5e групповая инициатива (DMG 270) — каждый участник группы кидает отдельно, используется наименьший результат
- Но initModifier — это модификатор, а не результат броска

**Риск:** Если в группе игроков есть Wizard с Dex 8 (-1) и Rogue с Dex 20 (+5), вся группа получает -1. Это наказывает игроков с высокой инициативой.

**Решение:** Сделать `initModifier` для группы игроков **настраиваемым** (DM вводит вручную). Опция "Use lowest modifier" — авторасчёт, который DM может переопределить. Либо использовать среднее арифметическое.

---

### 🟡 1.8 — MEDIUM: Action Economy для монстров — `Acted` чекбокс конфликтует с `ActionTracker` на combatant'е

**Файлы:** [`track-c-initiative-groups.md:82-88`](track-c-initiative-groups.md#L82-L88) и [`track-c-initiative-groups.md:398`](track-c-initiative-groups.md#L398)

**Проблема:** В секции 1.4 у каждого `Combatant` появляется `actionTracker: ActionTracker` с полями action/bonusAction/reaction/movement. Но в UI-секции 4.3 предлагается "для монстров можно упростить до одного чекбокса `Acted`". Это разные вещи:
- `ActionTracker` — поля на каждом combatant'е (данные)
- `Acted` — UI-упрощение (представление)

**Риск:** При реализации будет путаница: хранить ли `acted` как поле в `ActionTracker`? Как сбрасывать для группы монстров?

**Решение:** Добавить опциональное поле `isActed: boolean` в `ActionTracker`. Для монстров это единственное поле, которое отображается в UI. Для игроков — полный набор. При начале хода группы монстров — сбросить `isActed` для всех монстров в группе одновременно.

---

### 🔵 1.9 — MEDIUM: `StartBattleDialog` — UX с группами требует полной перестройки, упрощение может сломать LSS импорт

**Файл:** [`track-c-initiative-groups.md:431-435`](track-c-initiative-groups.md#L431-L435)

**Проблема:** Существующий [`CombatTracker.tsx`](../src/components/CombatTracker.tsx#L43-L109) создаёт `pendingCombatants` как плоский массив. Track C предполагает группировку прямо в диалоге. Это радикальное изменение UX.

**Риск:** Функциональность "Add Character from Campaign" (импорт из Long Story Short) работала с плоским списком. После перехода на группы нужно решить: 
- Characters импортируются в группу "Players" (по умолчанию)
- Но если кампания содержит NPC (не players) — они не должны автоматически попадать в "Players"

**Решение:** При импорте из Campaign нужно учитывать `CharacterSheet.source` и логику: игроки → "Players", NPC → группа "NPC/Allies".

---

### 🔵 1.10 — MEDIUM: Нет обработки смерти combatant'а внутри группы

**Файл:** [`track-c-initiative-groups.md:546-553`](track-c-initiative-groups.md#L546-L553)

**Проблема:** В `nextTurn` псевдокода есть проверка `hasAlive` для перехода к следующей группе. Но нет проверки, что *текущий* combatant в группе жив.

**Риск:** Если текущий combatant умер между ходами (например, от эффекта), `currentIndex` перейдёт к мёртвому combatant'у. Аналогичная проблема уже есть в текущем [`store.ts:157-173`](../src/storage/store.ts#L157-L173) — там есть skip dead.

**Решение:** Добавить в `getCurrentCombatant()` (секция 2.1) автоматический пропуск мёртвых combatant'ов внутри группы, аналогично существующей логике.

---

### 🔵 1.11 — MEDIUM: DB schema migration — `initiativeGroupId` не добавлен в индексы

**Файл:** [`track-c-initiative-groups.md:708`](track-c-initiative-groups.md#L708)

**Проблема:** В миграции (секция 8.2, Фаза 1) указано:
```
combatants: 'id, name, initiative, isPlayer, isMonster, groupId, initiativeGroupId'
```
Но это версия 2 (новая). В версии 1 (существующая) `groupId` есть, а `initiativeGroupId` отсутствует. При апгрейде с v1 на v2 нужно добавить `initiativeGroupId` в индекс.

**Риск:** Если просто заменить `stores()` на v2, Dexie пересоздаст таблицу. Но если только изменить версию без указания старой схемы — данные не мигрируются.

**Решение:** Чётко разделить схему v1 и v2:

```typescript
this.version(1).stores({ ... });
this.version(2).stores({
  combatants: 'id, name, initiative, isPlayer, isMonster, groupId, initiativeGroupId',
  // ... 
}).upgrade(tx => { ... });
```

В текущем [`db.ts`](../src/storage/db.ts#L29) уже есть v1. Просто добавить v2.

---

### 🔵 1.12 — SUGGESTION: `GroupTickResult` может быть типизирован точнее

**Файл:** [`track-c-initiative-groups.md:96-104`](track-c-initiative-groups.md#L96-L104)

**Проблема:** `GroupTickResult` содержит `tickResult: TickResult | null`, который включает `expiredEffects`, `triggeredSaves` и т.д. Но по логике `tickRound` вызывается только при `new_round`. Если сделать `tickResult` частью всех событий, может возникнуть путаница — при `next_combatant` tickResult должен быть null.

**Рекомендация:** Использовать discriminated union для строгой типизации:

```typescript
export type GroupTickResult = 
  | { type: 'next_combatant'; previousGroupId: UUID | null; currentGroupId: UUID | null; previousCombatantId: UUID | null; currentCombatantId: UUID | null; round: number; tickResult: null }
  | { type: 'next_group'; previousGroupId: UUID | null; currentGroupId: UUID | null; previousCombatantId: UUID | null; currentCombatantId: UUID | null; round: number; tickResult: null }
  | { type: 'new_round'; previousGroupId: UUID | null; currentGroupId: UUID | null; previousCombatantId: UUID | null; currentCombatantId: UUID | null; round: number; tickResult: TickResult }
  | { type: 'combat_end'; previousGroupId: UUID | null; currentGroupId: UUID | null; previousCombatantId: UUID | null; currentCombatantId: UUID | null; round: number; tickResult: null };
```

Это обеспечит type safety: `tickResult` доступен только когда `type === 'new_round'`.

---

### 🔵 1.13 — SUGGESTION: Пересортировка групп при `new_round` без учёта изменения initiative

**Файл:** [`track-c-initiative-groups.md:168-169`](track-c-initiative-groups.md#L168-L169)

**Проблема:** "Пересортировать группы по initiative (вдруг DM менял)". Это потенциально дестабилизирует порядок групп между раундами. Если DM не менял инициативу, пересортировка не нужна — это лишняя операция.

**Рекомендация:** Добавить `isDirty: boolean` на `Encounter` или проверять, менялась ли initiative группы с последнего раунда. Сортировать только если есть изменения.

---

## 2. Перекрёстные проверки

### 2.1. Model ↔ API

| Проверка | Статус | Комментарий |
|----------|--------|-------------|
| `InitiativeGroup` поля соответствуют API в turnEngine | ⚠️ Частично | `rollAllGroups()` использует `initiative`/`initModifier`, но `buildGroupTurnOrder()` не описана как чистая функция |
| `ActionTracker` используется в `useAction()` и `resetActionTracker()` | ✅ OK | Тип `ActionTracker` консистентен с API |
| `Encounter` без `turnOrder`/`turnIndex` ломает все существующие engine-функции | ❌ BLOCKER | [`store.ts:153-219`](../src/storage/store.ts#L153-L219) полностью завязан на `turnOrder`/`turnIndex`. Миграция должна переписать эти функции до изменения типов |
| `Combatant.initiativeGroupId` консистентен с `InitiativeGroup.combatantIds[]` | ✅ OK | Двунаправленная ссылка, корректно |
| `speed` в `Combatant` (новое поле) — откуда берётся? | ❌ BLOCKER | В текущем [`Combatant`](../src/types/index.ts#L116) нет `speed`. Для игроков можно взять из `CharacterSheet.speed`, для монстров — парсить `MonsterBlock.speed` (строка вида "30 ft."). Нужен парсер |

### 2.2. API ↔ UI

| Проверка | Статус | Комментарий |
|----------|--------|-------------|
| `nextTurn()` возвращает `GroupTickResult`, UI рендерит `RoundHeader` | ⚠️ Частично | `RoundHeader` использует `currentGroup.name`, `round`, `groupTurnIndex` — все есть в `GroupTickResult`. Но UI должен обновляться на основе result, а не дергать store |
| `reorderGroup()` UI (Drag & Drop) → API | ✅ OK | `reorderGroup()` принимает `newOrder: UUID[]` — консистентно с Drag & Drop |
| `toggleAction()` UI (ActionTrackerPanel) → API | ✅ OK | Чекбоксы соответствуют `action`, `bonusAction`, `reaction` |
| `useAction()` для movement (слайдер) | ⚠️ Частично | `amount` не описан — ft или % от speed? В UI показано "15/30 ft" — значит ft |
| `StartBattleDialog` → `StartBattleParams` | ❌ BLOCKER | `StartBattleParams` не включает `encounter.name`, `environment`, `notes` — базовые поля Encounter |

### 2.3. UI ↔ UX

| Проверка | Статус | Комментарий |
|----------|--------|-------------|
| Drag & Drop внутри группы (reorder) | ✅ OK | Используется @dnd-kit, существующий в [`InitiativeOrder.tsx`](../src/components/InitiativeOrder.tsx) |
| Drag & Drop между группами (move combatant) | ❌ MEDIUM | Не описан механизм. В Track C упомянуто "перетаскивать combatant'ов между группами" в StartBattleDialog, но нет ни API, ни UI-компонента для in-combat перемещения |
| ActionTrackerPanel для монстров — упрощение | ⚠️ Частично | "Acted" чекбокс упрощает UX, но: как сбрасывать для всей группы? Кнопка "Reset All Monsters"? Не описано |
| Legendary Action UI | ❌ Отсутствует | Не входит в Track C, нет extension point. DM не сможет потратить Legendary Action между ходами |

### 2.4. DB ↔ Миграция

| Проверка | Статус | Комментарий |
|----------|--------|-------------|
| Старый Encounter с turnOrder/turnIndex → InitiativeGroup | ⚠️ Частично | Миграция конвертирует, но теряет `turnIndex` (см. 1.6) |
| Старый Combatant без actionTracker/speed/initiativeGroupId | ✅ OK | Dexie `upgrade()` устанавливает дефолты: `actionTracker = { action: false, bonusAction: false, reaction: false, movement: 0, movementSpeed: 30 }` |
| Старый DB v1 → v2 upgrade | ⚠️ Частично | В текущем [`db.ts`](../src/storage/db.ts#L29) есть только v1. Нужно добавить v2 с `.upgrade()` |
| Combatant's groupId (monster group) → InitiativeGroup | ⚠️ Частично | Миграция группирует по `groupId`, но не проверяет, что монстры одной группы уже могут быть в разных InitiativeGroup |

---

## 3. Итоговый вердикт

### Принять? ❌ Доработать

**Track C — сильные стороны:**
✅ Чёткая архитектура InitiativeGroup + ActionTracker
✅ Правильный сброс ActionTracker (в начале хода каждого combatant'а — D&D 5e RAW)
✅ DM-философия соблюдена (DM вводит результаты, не кидает за игроков)
✅ План миграции продуман (upgrade скрипт, обратная совместимость)
✅ D&D 5e RAW для реакции и action economy

**Критические проблемы, требующие исправления до реализации:**

| # | Проблема | Серьёзность | Что сделать |
|---|----------|-------------|-------------|
| 1.1 | `currentGroupId` не синхронизируется при удалении группы | 🔴 BLOCKER | Добавить guard в `removeCombatant` |
| 1.2 | Конфликт `isGroup` (monster group) и `InitiativeGroup` | 🔴 BLOCKER | Уточнить тип `currentOrder` для групповых монстров |
| 1.3 | `tickRound()` не вызывается в новом `nextTurn()` | 🔴 BLOCKER | Явно указать вызов при `new_round` |
| 1.4 | Legendary Actions — нет extension point | 🟡 CRITICAL | Добавить `legendaryActions` в ActionTracker |
| 1.5 | `prevTurn()` не восстанавливает ActionTracker | 🟡 CRITICAL | Добавить snapshot/rollback механизм |
| 1.6 | Миграция теряет `turnIndex` | 🟡 CRITICAL | Вычислять currentIndex из turnOrder[turnIndex] |
| Model↔API | `speed` не откуда брать для Combatant | 🔴 BLOCKER | Добавить парсер скорости из MonsterBlock.speed |

**Рекомендация:** Исправить блокеры (1.1, 1.2, 1.3, speed), затем критические (1.4, 1.5, 1.6) — и можно утверждать. После утверждения — отдельный Track D для Legendary/Lair Actions с явной интеграцией в GroupTickResult и ActionTracker.

---

## 4. Архитектурная диаграмма конфликтов

```mermaid
flowchart TD
    subgraph "Существующее (конфликтует с Track C)"
        MC[Monster Combatant\nisGroup: boolean\ngroupId: UUID\ngroupSize: number]
        TO[Encounter.turnOrder: UUID[]\nEncounter.turnIndex: number]
        STORE[store.ts: nextTurn/prevTurn\nзавязаны на turnOrder]
    end

    subgraph "Новое (Track C)"
        IG[InitiativeGroup\ncombatantIds: UUID[]\ncurrentOrder: UUID[]]
        AT[ActionTracker\naction/ba/reaction/movement]
        CE[Combatant\ninitiativeGroupId\nactionTracker\nspeed]
    end

    MC -- "currentOrder хранит 1 UUID\nна 5 монстров → кто ходит?" --> IG
    TO -- "должна быть удалена\nно store на неё завязан" --> STORE
    CE -- "speed откуда?\nMonsterBlock.speed = '30 ft.'" --> PARSE[Нужен парсер скорости]
    IG -- "currentGroupId может\nуказывать в никуда" --> ORPHAN[Orphan Reference Risk]
```

---

## 5. Порядок исправлений (рекомендуемый)

| Приоритет | Что исправить | Где |
|-----------|--------------|-----|
| P0 | Уточнить `currentOrder` для `isGroup` монстров | `types/index.ts` |
| P0 | Добавить `speed` source — парсер из MonsterBlock.speed | `engine/roll.ts` или новый utility |
| P0 | Явно добавить `tickRound()` в new_round ветку `nextTurn` | `storage/store.ts` (секция 5.3) |
| P0 | Guard `currentGroupId` при удалении группы | `storage/store.ts` (removeCombatant) |
| P1 | Snapshot ActionTracker для prevTurn | `storage/store.ts` |
| P1 | Миграция: вычислить currentIndex из turnIndex | `storage/db.ts` upgrade |
| P1 | Добавить `legendaryActionsAvailable`/`legendaryActionsMax` в ActionTracker | `types/index.ts` |
| P2 | `initModifier` для игроков — сделать настраиваемым | `engine/roll.ts` |
| P2 | Discriminated union для GroupTickResult | `types/index.ts` |
| P3 | Механизм Drag & Drop между группами in-combat | `components/InitiativeGroupCard.tsx` |

---

*Вердикт сформирован на основе анализа консистентности типов, API, UI, UX, миграции и соответствия D&D 5e RAW.*