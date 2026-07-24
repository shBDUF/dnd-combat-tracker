import React, { useState } from 'react';
import { useCombatStore, useCampaignStore } from '../storage/store';
import { Combatant, Encounter, createId } from '../types';
import { SAMPLE_MONSTERS } from '../data/sample-monsters';
import { InitiativeOrder } from './InitiativeOrder';
import { CurrentTurn } from './CurrentTurn';
import { EffectsPanel } from './EffectsPanel';
import { MonsterPanel } from './MonsterPanel';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Card, CardHeader, CardTitle, CardContent, CardFooter, CardDescription } from './ui/card';
import { Badge } from './ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from './ui/dialog';
import { Select } from './ui/select';

export function CombatTracker() {
  const activeEncounter = useCombatStore((s) => s.activeEncounter);
  const initEncounter = useCombatStore((s) => s.initEncounter);
  const addCombatant = useCombatStore((s) => s.addCombatant);
  const nextTurn = useCombatStore((s) => s.nextTurn);
  const prevTurn = useCombatStore((s) => s.prevTurn);
  const endCombat = useCombatStore((s) => s.endCombat);
  const campaign = useCampaignStore((s) => s.activeCampaign);

  const [selectedCombatantId, setSelectedCombatantId] = useState<string | null>(null);
  const [view, setView] = useState<'main' | 'monster'>('main');

  // New Battle modal
  const [showNewBattle, setShowNewBattle] = useState(false);
  const [battleName, setBattleName] = useState('New Encounter');

  // Add participant forms (shown inline in the modal)
  const [selectedMonster, setSelectedMonster] = useState('');
  const [monsterCount, setMonsterCount] = useState('1');
  const [monsterInitiative, setMonsterInitiative] = useState('');
  const [playerName, setPlayerName] = useState('');
  const [playerInitiative, setPlayerInitiative] = useState('');
  const [playerHp, setPlayerHp] = useState('');
  const [playerAc, setPlayerAc] = useState('');
  const [pendingCombatants, setPendingCombatants] = useState<Combatant[]>([]);

  // Add participant helpers
  const handleAddMonster = () => {
    if (!selectedMonster) return;
    const template = SAMPLE_MONSTERS.find((m) => m.name === selectedMonster);
    if (!template) return;
    const count = Math.max(1, parseInt(monsterCount) || 1);
    const init = parseInt(monsterInitiative) || 0;

    if (count > 1) {
      // Group monster
      const group: Combatant = {
        id: createId(),
        name: template.name,
        initiative: init,
        initModifier: Math.floor((template.stats.dex - 10) / 2),
        ac: template.ac,
        maxHp: template.maxHp * count,
        currentHp: template.maxHp * count,
        tempHp: 0,
        conditions: [],
        effects: [],
        isConcentrating: false,
        concentrationOn: null,
        isPlayer: false,
        isMonster: true,
        monsterId: template.id,
        groupId: createId(),
        isGroup: true,
        groupSize: count,
        individualHp: template.maxHp,
        deathsaves: { successes: 0, failures: 0, isStable: false },
        sortIndex: pendingCombatants.length,
        isDead: false,
        notes: '',
      };
      setPendingCombatants((prev) => [...prev, group]);
      setMonsterCount('1');
      setMonsterInitiative('');
    } else {
      // Single monster
      const monster: Combatant = {
        id: createId(),
        name: template.name,
        initiative: init,
        initModifier: Math.floor((template.stats.dex - 10) / 2),
        ac: template.ac,
        maxHp: template.maxHp,
        currentHp: template.maxHp,
        tempHp: 0,
        conditions: [],
        effects: [],
        isConcentrating: false,
        concentrationOn: null,
        isPlayer: false,
        isMonster: true,
        monsterId: template.id,
        groupId: undefined,
        isGroup: false,
        groupSize: 1,
        individualHp: template.maxHp,
        deathsaves: { successes: 0, failures: 0, isStable: false },
        sortIndex: pendingCombatants.length,
        isDead: false,
        notes: '',
      };
      setPendingCombatants((prev) => [...prev, monster]);
      setMonsterInitiative('');
    }
  };

  const handleAddPlayer = () => {
    if (!playerName) return;
    const init = parseInt(playerInitiative) || 0;
    const hp = parseInt(playerHp) || 10;
    const ac = parseInt(playerAc) || 10;

    const player: Combatant = {
      id: createId(),
      name: playerName,
      initiative: init,
      initModifier: 0,
      ac,
      maxHp: hp,
      currentHp: hp,
      tempHp: 0,
      conditions: [],
      effects: [],
      isConcentrating: false,
      concentrationOn: null,
      isPlayer: true,
      isMonster: false,
      groupId: undefined,
      isGroup: false,
      groupSize: 1,
      individualHp: hp,
      deathsaves: { successes: 0, failures: 0, isStable: false },
      sortIndex: pendingCombatants.length + 10,
      isDead: false,
      notes: '',
    };
    setPendingCombatants((prev) => [...prev, player]);
    setPlayerName('');
    setPlayerInitiative('');
    setPlayerHp('');
    setPlayerAc('');
  };

  const handleAddCharacterFromCampaign = (charId: string) => {
    if (!campaign) return;
    const sheet = campaign.characters.find((c) => c.id === charId);
    if (!sheet) return;
    const init = parseInt(playerInitiative) || 0;
    const combatantFromChar: Combatant = {
      id: createId(),
      name: sheet.name,
      initiative: init,
      initModifier: Math.floor((sheet.stats.str - 10) / 2),
      ac: sheet.ac,
      maxHp: sheet.maxHp,
      currentHp: sheet.maxHp,
      tempHp: 0,
      conditions: [],
      effects: [],
      isConcentrating: false,
      concentrationOn: null,
      isPlayer: true,
      isMonster: false,
      groupId: undefined,
      isGroup: false,
      groupSize: 1,
      individualHp: sheet.maxHp,
      deathsaves: { successes: 0, failures: 0, isStable: false },
      sortIndex: pendingCombatants.length + 10,
      isDead: false,
      notes: '',
    };
    setPendingCombatants((prev) => [...prev, combatantFromChar]);
    setPlayerInitiative('');
  };

  const handleStartBattle = () => {
    if (pendingCombatants.length === 0) return;

    // Sort by initiative descending, then by sortIndex as tiebreaker
    const sorted = [...pendingCombatants].sort((a, b) => {
      if (b.initiative !== a.initiative) return b.initiative - a.initiative;
      return a.sortIndex - b.sortIndex;
    });

    const encounter: Encounter = {
      id: createId(),
      name: battleName,
      campaignId: campaign?.id || null,
      combatants: sorted,
      round: 1,
      turnIndex: 0,
      turnOrder: sorted.map((c) => c.id),
      isActive: true,
      startTime: Date.now(),
      environment: '',
      notes: '',
    };

    initEncounter(encounter);
    setShowNewBattle(false);
    setPendingCombatants([]);
  };

  // ── Empty state (no active encounter) ──────────────────────────────
  if (!activeEncounter) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8">
        <Card className="w-full max-w-2xl">
          <CardHeader>
            <CardTitle className="text-2xl text-center">D&D Combat Tracker</CardTitle>
            <CardDescription className="text-center">
              Start a new encounter or load an existing one
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-6">
            <div className="flex flex-col items-center gap-2 text-muted-foreground text-sm">
              <span className="text-4xl">⚔️</span>
              <p>No active combat session</p>
            </div>

            <Button size="lg" onClick={() => setShowNewBattle(true)} className="w-64">
              Start New Battle
            </Button>
          </CardContent>
        </Card>

        {/* New Battle Modal */}
        <Dialog open={showNewBattle} onOpenChange={setShowNewBattle}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Start New Battle</DialogTitle>
              <DialogDescription>
                Add monsters and players, set initiative, then start
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-6">
              {/* Battle name */}
              <Input
                label="Encounter Name"
                value={battleName}
                onChange={(e) => setBattleName(e.target.value)}
                placeholder="e.g. Goblin Ambush"
              />

              {/* Monster section */}
              <div className="space-y-2 border rounded-lg p-4">
                <h3 className="font-medium text-sm">Add Monsters</h3>
                <div className="flex gap-2">
                  <Select
                    options={SAMPLE_MONSTERS.map((m) => ({ value: m.name, label: m.name }))}
                    value={selectedMonster}
                    onChange={(e) => setSelectedMonster(e.target.value)}
                    placeholder="Select monster..."
                    className="flex-1"
                  />
                  <Input
                    type="number"
                    placeholder="Count"
                    value={monsterCount}
                    onChange={(e) => setMonsterCount(e.target.value)}
                    className="w-20"
                    min="1"
                  />
                  <Input
                    type="number"
                    placeholder="Init"
                    value={monsterInitiative}
                    onChange={(e) => setMonsterInitiative(e.target.value)}
                    className="w-20"
                  />
                  <Button size="sm" onClick={handleAddMonster} disabled={!selectedMonster}>
                    Add
                  </Button>
                </div>
              </div>

              {/* Player section */}
              <div className="space-y-2 border rounded-lg p-4">
                <h3 className="font-medium text-sm">Add Players</h3>
                <div className="flex gap-2">
                  <Input
                    placeholder="Player name"
                    value={playerName}
                    onChange={(e) => setPlayerName(e.target.value)}
                    className="flex-1"
                  />
                  <Input
                    type="number"
                    placeholder="Init"
                    value={playerInitiative}
                    onChange={(e) => setPlayerInitiative(e.target.value)}
                    className="w-20"
                  />
                  <Input
                    type="number"
                    placeholder="HP"
                    value={playerHp}
                    onChange={(e) => setPlayerHp(e.target.value)}
                    className="w-20"
                  />
                  <Input
                    type="number"
                    placeholder="AC"
                    value={playerAc}
                    onChange={(e) => setPlayerAc(e.target.value)}
                    className="w-16"
                  />
                  <Button size="sm" onClick={handleAddPlayer} disabled={!playerName}>
                    Add
                  </Button>
                </div>
                {campaign && campaign.characters.length > 0 && (
                  <div className="mt-2">
                    <p className="text-xs text-muted-foreground mb-1">Or import from campaign:</p>
                    <div className="flex flex-wrap gap-2">
                      {campaign.characters.map((char) => (
                        <Button
                          key={char.id}
                          variant="outline"
                          size="sm"
                          onClick={() => handleAddCharacterFromCampaign(char.id)}
                        >
                          {char.name} (Lvl {char.level} {char.class?.join('/')})
                        </Button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Pending participants list */}
              {pendingCombatants.length > 0 && (
                <div className="space-y-2">
                  <h3 className="font-medium text-sm">
                    Participants ({pendingCombatants.length})
                  </h3>
                  <div className="max-h-48 overflow-y-auto space-y-1">
                    {pendingCombatants.map((c) => (
                      <div key={c.id} className="flex items-center justify-between bg-muted rounded px-3 py-1.5 text-sm">
                        <span>
                          {c.isGroup ? `${c.groupSize}x ` : ''}{c.name}
                        </span>
                        <div className="flex items-center gap-3">
                          <span className="text-muted-foreground">
                            Init: {c.initiative} | {' '}
                            {c.isPlayer ? `HP ${c.maxHp} AC ${c.ac}` : `HP ${c.individualHp}`}
                          </span>
                          <button
                            className="text-destructive hover:text-red-700 text-xs"
                            onClick={() => setPendingCombatants((prev) => prev.filter((x) => x.id !== c.id))}
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => { setShowNewBattle(false); setPendingCombatants([]); }}>
                Cancel
              </Button>
              <Button onClick={handleStartBattle} disabled={pendingCombatants.length === 0}>
                Start Battle ({pendingCombatants.length} participants)
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // ── Active encounter view ─────────────────────────────────────────
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