import React, { useState } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { useCombatStore } from '../storage/store';
import { Combatant, DndCondition } from '../types';
import { SortableCombatantCard } from './SortableCombatantCard';
import { Input } from './ui/input';
import { cn } from '../lib/utils';

export function InitiativeOrder() {
  const activeEncounter = useCombatStore((s) => s.activeEncounter);
  const updateCombatant = useCombatStore((s) => s.updateCombatant);
  const removeCombatant = useCombatStore((s) => s.removeCombatant);
  const [search, setSearch] = useState('');

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  if (!activeEncounter) {
    return (
      <div className="text-muted-foreground text-sm p-4 text-center">
        No active encounter. Start or load a combat first.
      </div>
    );
  }

  const sortedCombatants = activeEncounter.turnOrder
    .map((id) => activeEncounter.combatants.find((c) => c.id === id))
    .filter(Boolean) as Combatant[];

  const filtered = search
    ? sortedCombatants.filter((c) =>
        c.name.toLowerCase().includes(search.toLowerCase())
      )
    : sortedCombatants;

  const currentCombatantId = activeEncounter.turnOrder[activeEncounter.turnIndex];

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = filtered.findIndex((c) => c.id === active.id);
    const newIndex = filtered.findIndex((c) => c.id === over.id);
    const reordered = arrayMove(filtered, oldIndex, newIndex);

    reordered.forEach((c, idx) => {
      updateCombatant(c.id, { sortIndex: idx });
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <Input
        placeholder="Search combatants..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={filtered.map((c) => c.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="flex flex-col gap-1">
            {filtered.map((combatant, index) => (
              <SortableCombatantCard
                key={combatant.id}
                combatant={combatant}
                isCurrent={combatant.id === currentCombatantId}
                position={index + 1}
                onRemove={() => removeCombatant(combatant.id)}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
      {filtered.length === 0 && (
        <p className="text-muted-foreground text-sm text-center py-4">
          {search ? 'No combatants match search' : 'No combatants in encounter'}
        </p>
      )}
    </div>
  );
}