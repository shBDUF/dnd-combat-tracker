import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Combatant } from '../types';
import { Badge, CONDITION_COLORS } from './ui/badge';
import { Progress } from './ui/progress';
import { Button } from './ui/button';
import { cn } from '../lib/utils';

interface SortableCombatantCardProps {
  combatant: Combatant;
  isCurrent: boolean;
  position: number;
  onRemove: () => void;
  onSelect?: () => void;
  showGroupInfo?: boolean;
}

export function SortableCombatantCard({
  combatant,
  isCurrent,
  position,
  onRemove,
  onSelect,
  showGroupInfo,
}: SortableCombatantCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: combatant.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const hpPercent = combatant.maxHp > 0 ? (combatant.currentHp / combatant.maxHp) * 100 : 0;
  const isDead = combatant.isDead || combatant.currentHp <= 0;
  const isGroupMonster = combatant.combatantGroupId !== null;
  const monsterLabel = isGroupMonster
    ? `${combatant.name} #${combatant.combatantGroupIndex + 1}`
    : combatant.name;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'rounded-lg border p-3 bg-card transition-all',
        isCurrent && 'ring-2 ring-yellow-400 border-yellow-400 bg-yellow-50/50',
        isDragging && 'opacity-50 shadow-lg',
        isDead && 'opacity-60'
      )}
      onClick={onSelect}
    >
      <div className="flex items-center gap-2 mb-1">
        <button
          className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground text-sm"
          {...attributes}
          {...listeners}
        >
          ⠿
        </button>
        <span className="text-xs text-muted-foreground w-5 text-right">
          {position}
        </span>
        <span
          className={cn(
            'font-medium flex-1 truncate',
            isDead && 'line-through text-muted-foreground'
          )}
        >
          {monsterLabel}
        </span>
        <span className="text-sm font-mono text-muted-foreground">
          {combatant.initiative}
        </span>
        {isDead && (
          <Badge variant="destructive" color="red">
            Dead
          </Badge>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 text-muted-foreground hover:text-destructive"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
        >
          ✕
        </Button>
      </div>

      {/* HP Bar */}
      <div className="flex items-center gap-2 mb-1">
        <span className="text-xs text-muted-foreground w-8">HP</span>
        <Progress
          value={combatant.currentHp}
          max={combatant.maxHp}
          variant="health"
          size="sm"
          className="flex-1"
        />
        <span className="text-xs font-mono min-w-[5rem] text-right">
          {combatant.currentHp}/{combatant.maxHp}
          {combatant.tempHp > 0 && (
            <span className="text-blue-600 ml-1">(+{combatant.tempHp})</span>
          )}
        </span>
      </div>

      {/* AC & Conditions */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">
          AC {combatant.ac}
        </span>
        {combatant.conditions.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {combatant.conditions.slice(0, 4).map((cond) => (
              <Badge
                key={cond.id}
                variant="outline"
                color={(CONDITION_COLORS[cond.name] as any) || 'slate'}
                className="text-[10px] px-1.5 py-0"
              >
                {cond.name}
              </Badge>
            ))}
            {combatant.conditions.length > 4 && (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                +{combatant.conditions.length - 4}
              </Badge>
            )}
          </div>
        )}
        {combatant.isConcentrating && (
          <Badge variant="outline" color="yellow" className="text-[10px] px-1.5 py-0">
            Conc
          </Badge>
        )}
      </div>

      {/* Group info */}
      {showGroupInfo && isGroupMonster && (
        <div className="text-xs text-muted-foreground mt-1">
          Group of {combatant.combatantGroupSize}
        </div>
      )}
    </div>
  );
}