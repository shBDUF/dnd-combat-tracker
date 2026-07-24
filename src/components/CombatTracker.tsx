import React, { useState } from 'react';
import { useCombatStore, useCampaignStore } from '../storage/store';
import { Combatant, Encounter, InitiativeGroup, createId, ActionTracker } from '../types';
import { SAMPLE_MONSTERS } from '../data/sample-monsters';
import { InitiativeOrder } from './InitiativeOrder';
import { CurrentTurn } from './CurrentTurn';
import { ActionTrackerPanel } from './ActionTrackerPanel';
import { EffectsPanel } from './EffectsPanel';
import { MonsterPanel } from './MonsterPanel';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from './ui/card';
import { Badge } from './ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from './ui/dialog';
import { Select } from './ui/select';

function createDefaultAT(speed = 30): ActionTracker {
  return {
    action: false,
    bonusAction: false,
    reaction: false,
    movement: 0,
    movementSpeed: speed,
    legendaryActionsAvailable: 0,
    legendaryActionsMax: 0,
    isActed: false,
  };
}

export function CombatTracker() {
  const activeEncounter = useCombatStore((s) => s.activeEncounter);
  const initEncounter = useCombatStore((s) => s.initEncounter);
  const addCombatant = useCombatStore((s) => s.addCombatant);
  const nextTurn = useCombatStore((s) => s.nextTurn);
  const prevTurn = useCombatStore((s) => s.prevTurn);
  const rollInitiative = useCombatStore((s) => s.rollInitiative);
  const endCombat = useCombatStore((s) => s.endCombat);
  const campaign = useCampaignStore((s) => s.activeCampaign);

  const [selectedCombatantId, setSelectedCombatantId] = useState<string | null>(null);
  const [view, setView] = useState<'main' | 'monster'>('main');

  // New Battle modal
  const [showNewBattle, setShowNewBattle] = useState(false);
  const [battleName, setBattleName] = useState('New Encounter');

  // Add participant forms
  const [selectedMonster, setSelectedMonster] = useState('');
  const [monsterCount, setMonsterCount] = useState('1');
  const [monsterInitiative, setMonsterInitiative] = useState('');
  const [playerName, setPlayerName] = useState('');
  const [playerInitiative, setPlayerInitiative] = useState('');
  const [playerHp, setPlayerHp] = useState('');
  const [playerAc, setPlayerAc] = useState('');
  const [pendingCombatants, setPendingCombatants] = useState<Combatant[]>([]);

  const handleAddMonster = () => {
    if (!selectedMonster) return;
    const template = SAMPLE_MONSTERS.find((m) => m.name === selectedMonster);
    if (!template) return;
    const count = Math.max(1, parseInt(monsterCount) || 1);
    const init = parseInt(monsterInitiative) || 0;
    const initMod = Math.floor((template.stats.dex - 10) / 2);
    const speed = 30; // default, could parse from template.speed

    if (count > 1) {
      const groupId = createId();
      for (let i = 0; i < count; i++) {
        const combatant: Combatant = {
          id: createId(),
          name: template.name,
          initiative: init,
          initModifier: initMod,
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
          groupId: groupId,
          deathsaves: { successes: 0, failures: 0, isStable: false },
          sortIndex: pendingCombatants.length + i,
          isDead: false,
          notes: '',
          initiativeGroupId: null,
          actionTracker: createDefaultAT(speed),
          speed,
          combatantGroupId: groupId,
          combatantGroupSize: count,
          combatantGroupIndex: i,
        };
        setPendingCombatants((prev) => [...prev, combatant]);
      }
      setMonsterCount('1');
      setMonsterInitiative('');
    } else {
      const combatant: Combatant = {
        id: createId(),
        name: template.name,
        initiative: init,
        initModifier: initMod,
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
        deathsaves: { successes: 0, failures: 0, isStable: false },
        sortIndex: pendingCombatants.length,
        isDead: false,
        notes: '',
        initiativeGroupId: null,
        actionTracker: createDefaultAT(speed),
        speed,
        combatantGroupId: null,
        combatantGroupSize: 1,
        combatantGroupIndex: 0,
      };
      setPendingCombatants((prev) => [...prev, combatant]);
      setMonsterInitiative('');
    }
  };

  const handleAddPlayer = () => {
    if (!playerName) return;
    const init = parseInt(playerInitiative) || 0;
    const hp = parseInt(playerHp) || 10;
    const ac = parseInt(playerAc) || 10;

    const combatant: Combatant = {
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
      deathsaves: { successes: 0, failures: 0, isStable: false },
      sortIndex: pendingCombatants.length + 10,
      isDead: false,
      notes: '',
      initiativeGroupId: null,
      actionTracker: createDefaultAT(30),
      speed: 30,
      combatantGroupId: null,
      combatantGroupSize: 1,
      combatantGroupIndex: 0,
    };
    setPendingCombatants((prev) => [...prev, combatant]);
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
    const combatant: Combatant = {
      id: createId(),
      name: sheet.name,
      initiative: init,
      initModifier: Math.floor((sheet.stats.dex - 10) / 2),
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
      deathsaves: { successes: 0, failures: 0, isStable: false },
      sortIndex: pendingCombatants.length + 10,
      isDead: false,
      notes: '',
      initiativeGroupId: null,
      actionTracker: createDefaultAT(sheet.speed || 30),
      speed: sheet.speed || 30,
      combatantGroupId: null,
      combatantGroupSize: 1,
      combatantGroupIndex: 0,
    };
    setPendingCombatants((prev) => [...prev, combatant]);
    setPlayerInitiative('');
  };

  const handleStartBattle = () => {
    if (pendingCombatants.length === 0) return;

    // Sort by initiative descending
    const sorted = [...pendingCombatants].sort((a, b) => {
      if (b.initiative !== a.initiative) return b.initiative - a.initiative;
      return a.sortIndex - b.sortIndex;
    });

    // Build groups
    const players = sorted.filter(c => c.isPlayer);
    const monsters = sorted.filter(c => c.isMonster);
    const groups: InitiativeGroup[] = [];

    if (players.length > 0) {
      groups.push({
        id: createId(),
        name: 'Players',
        type: 'players',
        initiative: players[0]?.initiative ?? 0,
        initModifier: Math.ceil(players.reduce((s, c) => s + c.initModifier, 0) / players.length),
        initMode: 'group',
        combatantIds: players.map(c => c.id),
        currentOrder: players.map(c => c.id),
        currentIndex: 0,
        isActive: true,
      });
    }

    // Group monsters by combatantGroupId
    const monsterGroups = new Map<string, Combatant[]>();
    for (const m of monsters) {
      const key = m.combatantGroupId || m.id;
      if (!monsterGroups.has(key)) monsterGroups.set(key, []);
      monsterGroups.get(key)!.push(m);
    }

    for (const [, mGroup] of monsterGroups) {
      const groupId = createId();
      for (const m of mGroup) {
        m.initiativeGroupId = groupId;
      }
      groups.push({
        id: groupId,
        name: mGroup.length > 1 ? `${mGroup.length}x ${mGroup[0].name}` : mGroup[0].name,
        type: 'monsters',
        initiative: mGroup[0]?.initiative ?? 0,
        initModifier: Math.ceil(mGroup.reduce((s, c) => s + c.initModifier, 0) / mGroup.length),
        initMode: 'group',
        combatantIds: mGroup.map(c => c.id),
        currentOrder: mGroup.map(c => c.id),
        currentIndex: 0,
        isActive: true,
      });
    }

    const encounter: Encounter = {
      id: createId(),
      name: battleName,
      campaignId: campaign?.id || null,
      combatants: sorted,
      round: 1,
      isActive: true,
      startTime: Date.now(),
      environment: '',
      notes: '',
      initiativeGroups: groups,
      currentGroupId: groups[0]?.id ?? null,
      groupTurnIndex: 0,
      actionTrackerHistory: [],
    };

    initEncounter(encounter);
    setShowNewBattle(false);
    setPendingCombatants([]);
  };

  // ── Empty state ─────────────────────────────────────────────────
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

              {/* Pending participants */}
              {pendingCombatants.length > 0 && (
                <div className="space-y-2">
                  <h3 className="font-medium text-sm">
                    Participants ({pendingCombatants.length})
                  </h3>
                  <div className="max-h-48 overflow-y-auto space-y-1">
                    {pendingCombatants.map((c) => (
                      <div key={c.id} className="flex items-center justify-between bg-muted rounded px-3 py-1.5 text-sm">
                        <span>
                          {c.combatantGroupId ? `${c.combatantGroupSize}x ` : ''}{c.name}
                        </span>
                        <div className="flex items-center gap-3">
                          <span className="text-muted-foreground">
                            Init: {c.initiative} | {c.isPlayer ? `HP ${c.maxHp} AC ${c.ac}` : `HP ${c.maxHp}`}
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

  // ── Active encounter view ───────────────────────────────────────
  const currentGroup = activeEncounter.initiativeGroups.find(
    g => g.id === activeEncounter.currentGroupId
  );
  const currentCombatantId = currentGroup?.currentOrder[currentGroup?.currentIndex ?? 0] ?? null;
  const currentCombatant = currentCombatantId
    ? activeEncounter.combatants.find((c) => c.id === currentCombatantId)
    : null;

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
            {currentGroup && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Group</span>
                <span className="font-medium text-sm">
                  {currentGroup.name}
                </span>
                <span className="text-xs text-muted-foreground">
                  (Init: {currentGroup.initiative})
                </span>
              </div>
            )}
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
            {!activeEncounter.initiativeGroups.some(g => g.initiative > 0) && (
              <Button variant="outline" size="sm" onClick={() => rollInitiative()}>
                Roll Initiative
              </Button>
            )}
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

        {/* Center/Right: Current Turn */}
        <div className="lg:col-span-2 space-y-4">
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

          {displayCombatant && (
            <ActionTrackerPanel combatant={displayCombatant} />
          )}

          {view === 'monster' && displayCombatant?.isMonster ? (
            <MonsterPanel combatant={displayCombatant} />
          ) : (
            <CurrentTurn selectedCombatant={displayCombatant} />
          )}

          <EffectsPanel combatant={displayCombatant} />
        </div>
      </div>
    </div>
  );
}