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
import type { Combatant, InitiativeGroup, UUID } from '../types';
import { SortableCombatantCard } from './SortableCombatantCard';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { cn } from '../lib/utils';

export function InitiativeOrder() {
  const activeEncounter = useCombatStore((s) => s.activeEncounter);
  const updateCombatant = useCombatStore((s) => s.updateCombatant);
  const removeCombatant = useCombatStore((s) => s.removeCombatant);
  const rollGroup = useCombatStore((s) => s.rollGroup);
  const reorderGroup = useCombatStore((s) => s.reorderGroup);
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

  const currentCombatantId =
    activeEncounter.initiativeGroups
      .find((g) => g.id === activeEncounter.currentGroupId)
      ?.currentOrder[
        activeEncounter.initiativeGroups.find(
          (g) => g.id === activeEncounter.currentGroupId
        )?.currentIndex ?? 0
      ] ?? null;

  function handleDragEnd(event: DragEndEvent, groupId: UUID) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    if (!activeEncounter) return;

    const group = activeEncounter.initiativeGroups.find(g => g.id === groupId);
    if (!group) return;

    const oldIndex = group.currentOrder.indexOf(active.id as string);
    const newIndex = group.currentOrder.indexOf(over.id as string);
    if (oldIndex === -1 || newIndex === -1) return;

    const newOrder = arrayMove([...group.currentOrder], oldIndex, newIndex);
    reorderGroup(groupId, newOrder);
  }

  // Group combatants by initiativeGroups
  const groups: { group: InitiativeGroup; combatants: Combatant[] }[] =
    activeEncounter.initiativeGroups
      .filter((g) => g.isActive && g.combatantIds.length > 0)
      .map((g) => ({
        group: g,
        combatants: g.currentOrder
          .map((id) => activeEncounter.combatants.find((c) => c.id === id))
          .filter(Boolean) as Combatant[],
      }));

  // Filter by search
  const filteredGroups = search
    ? groups
        .map((g) => ({
          ...g,
          combatants: g.combatants.filter((c) =>
            c.name.toLowerCase().includes(search.toLowerCase())
          ),
        }))
        .filter((g) => g.combatants.length > 0)
    : groups;

  return (
    <div className="flex flex-col gap-2">
      <Input
        placeholder="Search combatants..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      {filteredGroups.length === 0 && (
        <p className="text-muted-foreground text-sm text-center py-4">
          {search ? 'No combatants match search' : 'No combatants in encounter'}
        </p>
      )}

      <div className="flex flex-col gap-3">
        {filteredGroups.map(({ group, combatants }) => {
          const isCurrentGroup = group.id === activeEncounter.currentGroupId;
          const currentIndex = group.currentIndex;

          return (
            <div
              key={group.id}
              className={cn(
                'rounded-lg border p-2',
                isCurrentGroup && 'ring-2 ring-yellow-400 border-yellow-400'
              )}
            >
              {/* Group Header */}
              <div className="flex items-center justify-between px-1 pb-2 mb-2 border-b">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm">
                    {group.name}
                  </span>
                  <Badge variant="outline" className="text-xs font-mono">
                    Init: {group.initiative}
                  </Badge>
                  {group.initMode === 'individual' && (
                    <Badge variant="secondary" className="text-[10px]">
                      Indiv
                    </Badge>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-xs"
                  onClick={() => rollGroup(group.id)}
                  title="Reroll group initiative"
                >
                  ↻
                </Button>
              </div>

              {/* Combatants in group */}
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={(event) => handleDragEnd(event, group.id)}
              >
                <SortableContext
                  items={combatants.map((c) => c.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="flex flex-col gap-1">
                    {combatants.map((combatant, index) => (
                      <SortableCombatantCard
                        key={combatant.id}
                        combatant={combatant}
                        isCurrent={combatant.id === currentCombatantId}
                        position={index + 1}
                        onRemove={() => removeCombatant(combatant.id)}
                        showGroupInfo={combatant.combatantGroupId !== null}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>

              {combatants.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-2">
                  No combatants in this group
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}