import React, { useState } from 'react';
import { useCombatStore } from '../storage/store';
import { Combatant } from '../types';
import { InitiativeOrder } from './InitiativeOrder';
import { CurrentTurn } from './CurrentTurn';
import { EffectsPanel } from './EffectsPanel';
import { MonsterPanel } from './MonsterPanel';
import { Button } from './ui/button';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from './ui/card';
import { Badge } from './ui/badge';

export function CombatTracker() {
  const activeEncounter = useCombatStore((s) => s.activeEncounter);
  const nextTurn = useCombatStore((s) => s.nextTurn);
  const prevTurn = useCombatStore((s) => s.prevTurn);
  const endCombat = useCombatStore((s) => s.endCombat);

  const [selectedCombatantId, setSelectedCombatantId] = useState<string | null>(null);
  const [view, setView] = useState<'main' | 'monster'>('main');

  if (!activeEncounter) {
    return (
      <div className="flex items-center justify-center h-64">
        <Card className="w-96">
          <CardHeader>
            <CardTitle>No Active Combat</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              Start a new encounter or load an existing one to begin tracking combat.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const currentCombatantId = activeEncounter.turnOrder[activeEncounter.turnIndex];
  const currentCombatant = activeEncounter.combatants.find(
    (c) => c.id === currentCombatantId
  );
  const selectedCombatant = selectedCombatantId
    ? activeEncounter.combatants.find((c) => c.id === selectedCombatantId) || null
    : null;

  const displayCombatant = selectedCombatant || currentCombatant || null;

  const handleNextTurn = () => {
    nextTurn();
    setSelectedCombatantId(null);
  };

  const handlePrevTurn = () => {
    prevTurn();
    setSelectedCombatantId(null);
  };

  const handleEndCombat = async () => {
    await endCombat();
  };

  return (
    <div className="flex flex-col gap-4 p-4 max-w-7xl mx-auto">
      {/* Round Counter & Controls */}
      <Card>
        <CardContent className="flex items-center justify-between p-4">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Round</span>
              <span className="text-2xl font-bold font-mono">
                {activeEncounter.round}
              </span>
            </div>
            <div className="h-6 w-px bg-border" />
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Turn</span>
              <span className="font-medium">
                {currentCombatant?.name || '—'}
              </span>
              {currentCombatant?.isConcentrating && (
                <Badge variant="outline" color="yellow" className="text-[10px]">
                  Conc
                </Badge>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handlePrevTurn}>
              ◄ Prev
            </Button>
            <Button size="sm" onClick={handleNextTurn}>
              Next ►
            </Button>
            <Button variant="destructive" size="sm" onClick={handleEndCombat}>
              End Combat
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left: Initiative Order */}
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Initiative Order</CardTitle>
            </CardHeader>
            <CardContent>
              <InitiativeOrder />
            </CardContent>
          </Card>
        </div>

        {/* Center/Right: Current Turn or Monster Panel */}
        <div className="lg:col-span-2 space-y-4">
          {/* View Toggle */}
          {displayCombatant?.isMonster && (
            <div className="flex gap-2">
              <Button
                variant={view === 'main' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setView('main')}
              >
                Actions
              </Button>
              <Button
                variant={view === 'monster' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setView('monster')}
              >
                Stat Block
              </Button>
            </div>
          )}

          {view === 'monster' && displayCombatant?.isMonster ? (
            <MonsterPanel combatant={displayCombatant} />
          ) : (
            <CurrentTurn selectedCombatant={displayCombatant} />
          )}

          {/* Effects Panel */}
          <EffectsPanel combatant={displayCombatant} />
        </div>
      </div>
    </div>
  );
}