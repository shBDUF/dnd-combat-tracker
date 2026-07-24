// ============================================================================
// MonsterBrowser — Monster search, stat blocks, and Add to Combat
// ============================================================================

import React, { useState, useMemo, useCallback } from 'react';
import { useCombatStore, useCampaignStore } from '../storage/store.js';
import { SAMPLE_MONSTERS } from '../data/sample-monsters.js';
import type { MonsterBlock, Combatant, DndStat } from '../types/index.js';
import { createId } from '../types/index.js';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from './ui/card';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from './ui/dialog';
import { cn } from '../lib/utils';

// ─── Constants ─────────────────────────────────────────────────────────────

const MONSTER_TYPES = [
  'aberration', 'beast', 'celestial', 'construct', 'dragon', 'elemental',
  'fey', 'fiend', 'giant', 'humanoid', 'monstrosity', 'ooze', 'plant', 'undead',
] as const;

const CR_VALUES = [
  '0', '1/8', '1/4', '1/2', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10',
  '11', '12', '13', '14', '15', '16', '17', '18', '19', '20', '21', '22', '23', '24', '25', '30',
] as const;

const STAT_LABELS: Record<DndStat, string> = {
  str: 'STR', dex: 'DEX', con: 'CON', int: 'INT', wis: 'WIS', cha: 'CHA',
};

const SKILL_NAMES: Record<string, string> = {
  acrobatics: 'Acrobatics',
  'animal handling': 'Animal Handling',
  arcana: 'Arcana',
  athletics: 'Athletics',
  deception: 'Deception',
  history: 'History',
  insight: 'Insight',
  intimidation: 'Intimidation',
  investigation: 'Investigation',
  medicine: 'Medicine',
  nature: 'Nature',
  perception: 'Perception',
  performance: 'Performance',
  persuasion: 'Persuasion',
  religion: 'Religion',
  'sleight of hand': 'Sleight of Hand',
  stealth: 'Stealth',
  survival: 'Survival',
};

function statModifier(score: number): number {
  return Math.floor((score - 10) / 2);
}

function formatModifier(mod: number): string {
  return mod >= 0 ? `+${mod}` : `${mod}`;
}

function crToNumber(cr: string): number {
  if (cr === '0') return 0;
  if (cr === '1/8') return 0.125;
  if (cr === '1/4') return 0.25;
  if (cr === '1/2') return 0.5;
  return parseInt(cr, 10);
}

function xpForCr(cr: string): number {
  const xpMap: Record<string, number> = {
    '0': 10, '1/8': 25, '1/4': 50, '1/2': 100, '1': 200, '2': 450, '3': 700,
    '4': 1100, '5': 1800, '6': 2300, '7': 2900, '8': 3900, '9': 5000, '10': 5900,
    '11': 7200, '12': 8400, '13': 10000, '14': 11500, '15': 13000, '16': 15000,
    '17': 18000, '18': 20000, '19': 22000, '20': 25000, '21': 33000, '22': 41000,
    '23': 50000, '24': 62000, '25': 75000, '30': 155000,
  };
  return xpMap[cr] || 0;
}

// ─── Add To Combat Dialog ──────────────────────────────────────────────────

function AddToCombatDialog({
  monster,
  open,
  onOpenChange,
}: {
  monster: MonsterBlock;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [quantity, setQuantity] = useState(1);
  const addCombatant = useCombatStore((s) => s.addCombatant);
  const addCombatantGroup = useCombatStore((s) => s.addCombatantGroup);
  const activeEncounter = useCombatStore((s) => s.activeEncounter);

  const handleAdd = useCallback(() => {
    if (!activeEncounter) return;

    if (quantity > 1) {
      addCombatantGroup({
        name: monster.name,
        initiative: 0,
        initModifier: statModifier(monster.stats.dex),
        ac: monster.ac,
        maxHp: monster.maxHp,
        currentHp: monster.maxHp,
        isMonster: true,
        monsterId: monster.id,
        speed: 30,
        notes: '',
      } as Combatant, quantity);
    } else {
      const combatant: Combatant = {
        id: createId(),
        name: monster.name,
        initiative: 0,
        initModifier: statModifier(monster.stats.dex),
        ac: monster.ac,
        maxHp: monster.maxHp,
        currentHp: monster.maxHp,
        tempHp: 0,
        conditions: [],
        effects: [],
        isConcentrating: false,
        concentrationOn: null,
        isPlayer: false,
        isMonster: true,
        monsterId: monster.id,
        groupId: undefined,
        deathsaves: { successes: 0, failures: 0, isStable: false },
        sortIndex: 0,
        isDead: false,
        notes: '',
        initiativeGroupId: null,
        actionTracker: { action: false, bonusAction: false, reaction: false, movement: 0, movementSpeed: 30, legendaryActionsAvailable: 0, legendaryActionsMax: 0, isActed: false },
        speed: 30,
        combatantGroupId: null,
        combatantGroupSize: 1,
        combatantGroupIndex: 0,
      };
      addCombatant(combatant);
    }
    onOpenChange(false);
    setQuantity(1);
  }, [monster, quantity, addCombatant, activeEncounter, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add to Combat</DialogTitle>
          <DialogDescription>
            Add {monster.name} to the active encounter
          </DialogDescription>
        </DialogHeader>
        {!activeEncounter ? (
          <p className="text-sm text-destructive">
            No active encounter. Start a combat first.
          </p>
        ) : (
          <div className="flex items-center gap-3 py-4">
            <span className="text-sm">Quantity:</span>
            <div className="flex items-center gap-1">
              <Button variant="outline" size="sm" onClick={() => setQuantity((q) => Math.max(1, q - 1))}>
                -
              </Button>
              <span className="font-mono w-8 text-center">{quantity}</span>
              <Button variant="outline" size="sm" onClick={() => setQuantity((q) => Math.min(20, q + 1))}>
                +
              </Button>
            </div>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleAdd} disabled={!activeEncounter}>
            Add {quantity > 1 ? `×${quantity}` : ''} to Combat
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Monster Stat Block Modal ──────────────────────────────────────────────

function MonsterStatBlock({
  monster,
  onClose,
  onAddToCombat,
}: {
  monster: MonsterBlock;
  onClose: () => void;
  onAddToCombat: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <Card className="relative z-50 w-full max-w-2xl mx-4 max-h-[85vh] overflow-y-auto">
        <CardHeader className="sticky top-0 bg-card z-10 border-b">
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="text-2xl">{monster.name}</CardTitle>
              <CardDescription>
                {monster.size} {monster.type}, {monster.alignment}
              </CardDescription>
            </div>
            <div className="text-right">
              <Badge variant="secondary" className="text-sm">
                CR {monster.challengeRating}
              </Badge>
              <p className="text-xs text-muted-foreground mt-1">
                {xpForCr(monster.challengeRating)} XP
              </p>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-4 space-y-4">
          {/* Core stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
            <div><span className="text-muted-foreground">AC</span> <strong>{monster.ac}</strong></div>
            <div><span className="text-muted-foreground">HP</span> <strong>{monster.maxHp}</strong></div>
            <div><span className="text-muted-foreground">Speed</span> <strong>{monster.speed}</strong></div>
          </div>

          {/* Ability Scores */}
          <div>
            <h4 className="text-sm font-semibold mb-1">Ability Scores</h4>
            <div className="grid grid-cols-6 gap-2">
              {(Object.keys(STAT_LABELS) as DndStat[]).map((stat) => (
                <div key={stat} className="flex flex-col items-center border rounded-md p-1.5">
                  <span className="text-xs font-medium text-muted-foreground">{STAT_LABELS[stat]}</span>
                  <span className="font-bold">{monster.stats[stat]}</span>
                  <span className={cn(
                    'text-xs font-mono',
                    statModifier(monster.stats[stat]) >= 0 ? 'text-green-600' : 'text-red-500'
                  )}>
                    {formatModifier(statModifier(monster.stats[stat]))}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Saving Throws */}
          {Object.keys(monster.savingThrows).length > 0 && (
            <div>
              <h4 className="text-sm font-semibold mb-1">Saving Throws</h4>
              <div className="flex flex-wrap gap-2">
                {(Object.keys(monster.savingThrows) as DndStat[]).map((stat) => (
                  <Badge key={stat} variant="outline" className="text-xs">
                    {STAT_LABELS[stat]} {formatModifier(monster.savingThrows[stat]!)}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Skills */}
          {Object.keys(monster.skills).length > 0 && (
            <div>
              <h4 className="text-sm font-semibold mb-1">Skills</h4>
              <div className="flex flex-wrap gap-2">
                {Object.entries(monster.skills).map(([skill, value]) => (
                  <Badge key={skill} variant="outline" className="text-xs">
                    {SKILL_NAMES[skill.toLowerCase()] || skill} {formatModifier(value)}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Damage / Condition stuff */}
          {monster.damageVulnerabilities.length > 0 && (
            <div className="text-sm">
              <span className="text-muted-foreground font-medium">Damage Vulnerabilities: </span>
              {monster.damageVulnerabilities.join(', ') || 'None'}
            </div>
          )}
          {monster.damageResistances.length > 0 && (
            <div className="text-sm">
              <span className="text-muted-foreground font-medium">Damage Resistances: </span>
              {monster.damageResistances.join(', ')}
            </div>
          )}
          {monster.damageImmunities.length > 0 && (
            <div className="text-sm">
              <span className="text-muted-foreground font-medium">Damage Immunities: </span>
              {monster.damageImmunities.join(', ')}
            </div>
          )}
          {monster.conditionImmunities.length > 0 && (
            <div className="text-sm">
              <span className="text-muted-foreground font-medium">Condition Immunities: </span>
              {monster.conditionImmunities.join(', ')}
            </div>
          )}

          {/* Senses & Languages */}
          <div className="text-sm">
            <div><span className="text-muted-foreground">Senses: </span>{monster.senses}</div>
            <div><span className="text-muted-foreground">Languages: </span>{monster.languages || 'None'}</div>
          </div>

          {/* Traits */}
          {monster.traits.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold mb-1">Traits</h4>
              {monster.traits.map((trait) => (
                <div key={trait.id} className="mb-2 text-sm">
                  <span className="font-medium italic">{trait.name}. </span>
                  {trait.description}
                </div>
              ))}
            </div>
          )}

          {/* Actions */}
          {monster.actions.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold mb-1">Actions</h4>
              {monster.actions.map((action) => (
                <div key={action.id} className="mb-2 text-sm">
                  <span className="font-medium italic">{action.name}. </span>
                  {action.description}
                  {action.damageDice && (
                    <span className="text-muted-foreground">
                      {' '}({action.damageDice}
                      {action.damageBonus ? `+${action.damageBonus}` : ''} {action.damageType})
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Reactions */}
          {monster.reactions.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold mb-1">Reactions</h4>
              {monster.reactions.map((r) => (
                <div key={r.id} className="mb-2 text-sm">
                  <span className="font-medium italic">{r.name}. </span>
                  {r.description}
                </div>
              ))}
            </div>
          )}

          {/* Legendary Actions */}
          {monster.legendaryActions.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold mb-1">Legendary Actions</h4>
              <p className="text-xs text-muted-foreground mb-1">
                The {monster.name} can take 3 legendary actions per round.
              </p>
              {monster.legendaryActions.map((la) => (
                <div key={la.id} className="mb-2 text-sm">
                  <span className="font-medium italic">{la.name}. </span>
                  {la.description}
                </div>
              ))}
            </div>
          )}
        </CardContent>

        <CardFooter className="sticky bottom-0 bg-card border-t flex justify-between">
          <Button variant="outline" onClick={onClose}>Close</Button>
          <Button onClick={onAddToCombat}>Add to Combat</Button>
        </CardFooter>
      </Card>
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────

export function MonsterBrowser() {
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [crMin, setCrMin] = useState('');
  const [crMax, setCrMax] = useState('');
  const [selectedMonster, setSelectedMonster] = useState<MonsterBlock | null>(null);
  const [addDialogMonster, setAddDialogMonster] = useState<MonsterBlock | null>(null);

  const filteredMonsters = useMemo(() => {
    let result = [...SAMPLE_MONSTERS];

    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (m) =>
          m.name.toLowerCase().includes(q) ||
          m.type.toLowerCase().includes(q)
      );
    }

    if (typeFilter) {
      result = result.filter((m) => m.type === typeFilter);
    }

    if (crMin) {
      const crNum = crToNumber(crMin);
      result = result.filter((m) => crToNumber(m.challengeRating) >= crNum);
    }
    if (crMax) {
      const crNum = crToNumber(crMax);
      result = result.filter((m) => crToNumber(m.challengeRating) <= crNum);
    }

    result.sort((a, b) => crToNumber(a.challengeRating) - crToNumber(b.challengeRating));
    return result;
  }, [search, typeFilter, crMin, crMax]);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold">Monster Browser</h2>
        <p className="text-sm text-muted-foreground">
          Browse {SAMPLE_MONSTERS.length} sample monsters
        </p>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-[200px]">
              <label className="text-xs font-medium text-muted-foreground mb-1 block">
                Search
              </label>
              <Input
                placeholder="Monster name..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="w-36">
              <label className="text-xs font-medium text-muted-foreground mb-1 block">
                Type
              </label>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
              >
                <option value="">All types</option>
                {MONSTER_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t.charAt(0).toUpperCase() + t.slice(1)}
                  </option>
                ))}
              </select>
            </div>
            <div className="w-20">
              <label className="text-xs font-medium text-muted-foreground mb-1 block">
                CR min
              </label>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                value={crMin}
                onChange={(e) => setCrMin(e.target.value)}
              >
                <option value="">Any</option>
                {CR_VALUES.map((cr) => (
                  <option key={cr} value={cr}>CR {cr}</option>
                ))}
              </select>
            </div>
            <div className="w-20">
              <label className="text-xs font-medium text-muted-foreground mb-1 block">
                CR max
              </label>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                value={crMax}
                onChange={(e) => setCrMax(e.target.value)}
              >
                <option value="">Any</option>
                {CR_VALUES.map((cr) => (
                  <option key={cr} value={cr}>CR {cr}</option>
                ))}
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {filteredMonsters.length === 0 ? (
          <div className="col-span-full text-center py-12">
            <p className="text-muted-foreground">No monsters match your filters.</p>
          </div>
        ) : (
          filteredMonsters.map((monster) => (
            <Card
              key={monster.id}
              className="cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => setSelectedMonster(monster)}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h4 className="font-semibold">{monster.name}</h4>
                    <p className="text-xs text-muted-foreground">
                      {monster.type.charAt(0).toUpperCase() + monster.type.slice(1)}
                    </p>
                  </div>
                  <div className="text-right">
                    <Badge variant="secondary" className="text-xs">
                      CR {monster.challengeRating}
                    </Badge>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {xpForCr(monster.challengeRating)} XP
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span>AC {monster.ac}</span>
                  <span>HP {monster.maxHp}</span>
                  <span>{monster.speed}</span>
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  className="w-full mt-3"
                  onClick={(e) => {
                    e.stopPropagation();
                    setAddDialogMonster(monster);
                  }}
                >
                  Add to Combat
                </Button>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Stat Block Modal */}
      {selectedMonster && (
        <MonsterStatBlock
          monster={selectedMonster}
          onClose={() => setSelectedMonster(null)}
          onAddToCombat={() => {
            setSelectedMonster(null);
            setAddDialogMonster(selectedMonster);
          }}
        />
      )}

      {/* Add to Combat Dialog */}
      {addDialogMonster && (
        <AddToCombatDialog
          monster={addDialogMonster}
          open={true}
          onOpenChange={(open) => {
            if (!open) setAddDialogMonster(null);
          }}
        />
      )}
    </div>
  );
}