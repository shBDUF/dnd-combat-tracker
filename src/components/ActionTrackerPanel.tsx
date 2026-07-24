import React from 'react';
import { useCombatStore } from '../storage/store';
import type { Combatant, UUID } from '../types';
import { Button } from './ui/button';
import { Progress } from './ui/progress';

interface ActionTrackerPanelProps {
  combatant: Combatant;
}

export function ActionTrackerPanel({ combatant }: ActionTrackerPanelProps) {
  const toggleAction = useCombatStore((s) => s.toggleAction);
  const setMovement = useCombatStore((s) => s.setMovement);
  const resetActions = useCombatStore((s) => s.resetActions);

  const at = combatant.actionTracker;
  const isPlayer = combatant.isPlayer;
  const isMonster = combatant.isMonster;
  const hasLegendary = at.legendaryActionsMax > 0;
  const movementPercent = at.movementSpeed > 0
    ? Math.round((at.movement / at.movementSpeed) * 100)
    : 0;

  // Monster simplified view
  if (isMonster && !isPlayer) {
    return (
      <div className="space-y-2 p-3 rounded-lg border bg-card">
        <h4 className="text-sm font-medium">Actions</h4>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={at.isActed}
            onChange={() => toggleAction(combatant.id, 'action')}
            className="rounded"
          />
          <span className="text-sm">Acted</span>
        </label>

        {hasLegendary && (
          <div className="flex items-center justify-between text-sm">
            <span>Legendary: {at.legendaryActionsAvailable}/{at.legendaryActionsMax}</span>
            <Button
              size="sm"
              variant="outline"
              disabled={at.legendaryActionsAvailable <= 0}
              onClick={() => toggleAction(combatant.id, 'legendary')}
            >
              Use
            </Button>
          </div>
        )}

        <Button size="sm" variant="ghost" onClick={() => resetActions(combatant.id)} className="w-full">
          Reset
        </Button>
      </div>
    );
  }

  // Player / full action economy view
  return (
    <div className="space-y-3 p-3 rounded-lg border bg-card">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium">Action Economy</h4>
        <Button size="sm" variant="ghost" onClick={() => resetActions(combatant.id)}>
          Reset
        </Button>
      </div>

      {/* Checkboxes */}
      <div className="grid grid-cols-2 gap-2">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={at.action}
            onChange={() => toggleAction(combatant.id, 'action')}
            className="rounded"
          />
          <span className={`text-sm ${at.action ? 'line-through text-muted-foreground' : ''}`}>
            Action
          </span>
        </label>

        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={at.bonusAction}
            onChange={() => toggleAction(combatant.id, 'bonusAction')}
            className="rounded"
          />
          <span className={`text-sm ${at.bonusAction ? 'line-through text-muted-foreground' : ''}`}>
            Bonus Action
          </span>
        </label>

        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={at.reaction}
            onChange={() => toggleAction(combatant.id, 'reaction')}
            className="rounded"
          />
          <span className={`text-sm ${at.reaction ? 'line-through text-muted-foreground' : ''}`}>
            Reaction
          </span>
        </label>
      </div>

      {/* Movement */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-sm">
          <span>Movement</span>
          <span className="text-muted-foreground">{at.movement}/{at.movementSpeed} ft</span>
        </div>
        <Progress
          value={at.movement}
          max={at.movementSpeed}
          variant="default"
          size="sm"
        />
        <div className="flex gap-1">
          {[0, Math.floor(at.movementSpeed / 2), at.movementSpeed].map((val) => (
            <button
              key={val}
              className="inline-flex items-center justify-center rounded-md text-xs font-medium h-7 px-2 border border-input bg-background hover:bg-accent cursor-pointer"
              onClick={() => setMovement(combatant.id, val)}
            >
              {val}ft
            </button>
          ))}
        </div>
      </div>

      {/* Legendary Actions (if applicable) */}
      {hasLegendary && (
        <div className="flex items-center justify-between text-sm pt-2 border-t">
          <span>Legendary: {at.legendaryActionsAvailable}/{at.legendaryActionsMax}</span>
          <Button
            size="sm"
            variant="outline"
            disabled={at.legendaryActionsAvailable <= 0}
            onClick={() => toggleAction(combatant.id, 'legendary')}
          >
            Use
          </Button>
        </div>
      )}
    </div>
  );
}