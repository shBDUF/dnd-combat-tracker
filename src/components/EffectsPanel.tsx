import React from 'react';
import { useCombatStore } from '../storage/store';
import { Combatant } from '../types';
import { Badge, CONDITION_COLORS } from './ui/badge';
import { Button } from './ui/button';
import { Card, CardHeader, CardTitle, CardContent } from './ui/card';
import { cn } from '../lib/utils';

interface EffectsPanelProps {
  combatant: Combatant | null;
}

export function EffectsPanel({ combatant }: EffectsPanelProps) {
  const removeEffect = useCombatStore((s) => s.removeEffect);
  const removeCondition = useCombatStore((s) => s.removeCondition);

  if (!combatant) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-muted-foreground text-sm">
          Select a combatant to view effects
        </CardContent>
      </Card>
    );
  }

  const effects = combatant.effects.filter((e) => e.isActive);
  const conditions = combatant.conditions;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          Effects & Conditions — {combatant.name}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Conditions */}
        {conditions.length > 0 && (
          <div>
            <h4 className="text-sm font-medium text-muted-foreground mb-2">
              Conditions
            </h4>
            <div className="flex flex-wrap gap-2">
              {conditions.map((cond) => (
                <div
                  key={cond.id}
                  className="flex items-center gap-1 rounded-full border px-3 py-1"
                >
                  <Badge
                    variant="outline"
                    color={(CONDITION_COLORS[cond.name] as any) || 'slate'}
                    className="border-0 px-0"
                  >
                    {cond.name}
                  </Badge>
                  <button
                    onClick={() => removeCondition(combatant.id, cond.id)}
                    className="ml-1 text-muted-foreground hover:text-destructive text-xs cursor-pointer"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {conditions.length === 0 && (
          <p className="text-xs text-muted-foreground">No active conditions</p>
        )}

        <hr className="border-t" />

        {/* Effects */}
        {effects.length > 0 && (
          <div>
            <h4 className="text-sm font-medium text-muted-foreground mb-2">
              Active Effects
            </h4>
            <div className="space-y-2">
              {effects.map((effect) => {
                const isExpired = effect.remainingRounds <= 0;
                const isConcentration = effect.concentrationGroup !== null;

                return (
                  <div
                    key={effect.id}
                    className={cn(
                      'flex items-center justify-between rounded-md border p-2 text-sm',
                      isExpired && 'opacity-50 bg-muted/50',
                      isConcentration && 'border-yellow-300 bg-yellow-50/50'
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          'font-medium',
                          isExpired && 'text-muted-foreground line-through'
                        )}
                      >
                        {effect.name}
                      </span>
                      {isConcentration && (
                        <Badge variant="outline" color="yellow" className="text-[10px] px-1.5 py-0">
                          Conc
                        </Badge>
                      )}
                      {effect.duration.type !== 'permanent' && (
                        <span className="text-xs text-muted-foreground">
                          {effect.remainingRounds > 0
                            ? `${effect.remainingRounds} round${effect.remainingRounds !== 1 ? 's' : ''} remaining`
                            : 'Expired'}
                        </span>
                      )}
                      {effect.duration.type === 'permanent' && (
                        <span className="text-xs text-muted-foreground">Permanent</span>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-muted-foreground hover:text-destructive"
                      onClick={() => removeEffect(combatant.id, effect.id)}
                    >
                      ✕
                    </Button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {effects.length === 0 && (
          <p className="text-xs text-muted-foreground">No active effects</p>
        )}
      </CardContent>
    </Card>
  );
}