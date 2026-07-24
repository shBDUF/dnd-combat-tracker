// ============================================================================
// CharacterManager — Character list, sheet view, editing
// ============================================================================

import React, { useState, useMemo, useCallback } from 'react';
import { useCampaignStore } from '../storage/store.js';
import type { CharacterSheet, DndStat, Resource } from '../types/index.js';
import { createId } from '../types/index.js';
import { CharacterImport } from './CharacterImport.js';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from './ui/dialog';
import { cn } from '../lib/utils';

// ─── Stat helpers ──────────────────────────────────────────────────────────

const STAT_LABELS: Record<DndStat, string> = {
  str: 'STR',
  dex: 'DEX',
  con: 'CON',
  int: 'INT',
  wis: 'WIS',
  cha: 'CHA',
};

const STAT_NAMES: Record<DndStat, string> = {
  str: 'Strength',
  dex: 'Dexterity',
  con: 'Constitution',
  int: 'Intelligence',
  wis: 'Wisdom',
  cha: 'Charisma',
};

function statModifier(score: number): number {
  return Math.floor((score - 10) / 2);
}

function formatModifier(mod: number): string {
  return mod >= 0 ? `+${mod}` : `${mod}`;
}

// ─── Skill name mapping ────────────────────────────────────────────────────

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

// ─── Props ─────────────────────────────────────────────────────────────────

type SortKey = 'name' | 'level' | 'class' | 'hp';

// ─── Delete Confirm Dialog ─────────────────────────────────────────────────

function DeleteConfirmDialog({
  open,
  onOpenChange,
  onConfirm,
  characterName,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  characterName: string;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete Character</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete <strong>{characterName}</strong>?
            This action cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={onConfirm}>
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Character Sheet Panel ─────────────────────────────────────────────────

function StatBlock({ stats }: { stats: Record<DndStat, number> }) {
  return (
    <div className="grid grid-cols-6 gap-2">
      {(Object.keys(STAT_LABELS) as DndStat[]).map((stat) => (
        <div key={stat} className="flex flex-col items-center border rounded-md p-2">
          <span className="text-xs font-medium text-muted-foreground uppercase">
            {STAT_LABELS[stat]}
          </span>
          <span className="text-lg font-bold">{stats[stat]}</span>
          <span
            className={cn(
              'text-sm font-mono',
              statModifier(stats[stat]) >= 0
                ? 'text-green-600'
                : 'text-red-500'
            )}
          >
            {formatModifier(statModifier(stats[stat]))}
          </span>
        </div>
      ))}
    </div>
  );
}

function SkillsList({
  skills,
}: {
  skills: Record<string, number>;
}) {
  const entries = Object.entries(skills).filter(
    ([name]) => SKILL_NAMES[name.toLowerCase()]
  );

  if (entries.length === 0) {
    return <p className="text-sm text-muted-foreground italic">No skills data</p>;
  }

  return (
    <div className="grid grid-cols-2 gap-1 text-sm">
      {entries.map(([name, value]) => {
        const label = SKILL_NAMES[name.toLowerCase()] || name;
        const isProf = value > 0;
        const isExpert = value >= 2;
        return (
          <div key={name} className="flex justify-between items-center px-2 py-0.5 rounded hover:bg-muted/50">
            <span className="flex items-center gap-1">
              {isExpert && <span className="text-xs text-amber-500">★</span>}
              {isProf && !isExpert && <span className="text-xs text-blue-500">●</span>}
              {label}
            </span>
            <span className="font-mono text-xs">
              {formatModifier(value)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function SavingThrowsDisplay({
  savingThrows,
  stats,
}: {
  savingThrows: Partial<Record<DndStat, number>>;
  stats: Record<DndStat, number>;
}) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {(Object.keys(STAT_LABELS) as DndStat[]).map((stat) => {
        const savedValue = savingThrows[stat];
        const baseMod = statModifier(stats[stat]);
        const isProficient = savedValue !== undefined && savedValue !== baseMod;
        const displayValue = savedValue ?? baseMod;
        return (
          <div
            key={stat}
            className={cn(
              'flex items-center gap-2 px-2 py-1 rounded text-sm',
              isProficient ? 'bg-primary/10' : ''
            )}
          >
            {isProficient && <span className="text-xs text-blue-500">●</span>}
            <span className="text-muted-foreground uppercase text-xs">
              {STAT_LABELS[stat]}
            </span>
            <span className="font-mono ml-auto">
              {formatModifier(displayValue)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function HPEditor({
  currentHp,
  maxHp,
  tempHp,
  onChange,
}: {
  currentHp: number;
  maxHp: number;
  tempHp: number;
  onChange: (current: number, temp: number) => void;
}) {
  const [editCurrent, setEditCurrent] = useState(currentHp);
  const [editTemp, setEditTemp] = useState(tempHp);

  const hpPercent = maxHp > 0 ? (currentHp / maxHp) * 100 : 0;

  const applyEdit = useCallback(() => {
    onChange(Math.max(0, editCurrent), Math.max(0, editTemp));
  }, [editCurrent, editTemp, onChange]);

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <div className="flex-1">
          <div className="flex justify-between text-sm mb-1">
            <span className="font-medium">HP</span>
            <span className="font-mono">
              {currentHp} / {maxHp}
            </span>
          </div>
          <div className="h-2.5 w-full bg-secondary rounded-full overflow-hidden">
            <div
              className={cn(
                'h-full rounded-full transition-all',
                hpPercent > 50
                  ? 'bg-green-500'
                  : hpPercent > 25
                  ? 'bg-yellow-500'
                  : 'bg-red-500'
              )}
              style={{ width: `${Math.min(100, hpPercent)}%` }}
            />
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setEditCurrent((p) => Math.max(0, p - 1))}
          >
            -1
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setEditCurrent((p) => Math.max(0, p - 5))}
          >
            -5
          </Button>
          <Input
            type="number"
            value={editCurrent}
            onChange={(e) => setEditCurrent(Number(e.target.value))}
            className="w-16 h-8 text-center text-sm"
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => setEditCurrent((p) => Math.min(maxHp, p + 1))}
          >
            +1
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setEditCurrent((p) => Math.min(maxHp, p + 5))}
          >
            +5
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Temp HP:</span>
        <Input
          type="number"
          value={editTemp}
          onChange={(e) => setEditTemp(Number(e.target.value))}
          className="w-16 h-8 text-center text-sm"
        />
        <Button size="sm" onClick={applyEdit}>
          Apply
        </Button>
      </div>
    </div>
  );
}

function SpellSlotsDisplay({
  spellSlots,
  spellSaveDC,
  spellAttackBonus,
}: {
  spellSlots: Record<number, { total: number; used: number }>;
  spellSaveDC: number;
  spellAttackBonus: number;
}) {
  const maxLevel = Math.max(...Object.keys(spellSlots).map(Number), 0);

  if (maxLevel === 0) {
    return <p className="text-sm text-muted-foreground italic">No spell slots</p>;
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-4 text-sm">
        <span>Spell Save DC: <strong>{spellSaveDC}</strong></span>
        <span>Spell Attack: <strong>{formatModifier(spellAttackBonus)}</strong></span>
      </div>
      <div className="flex flex-wrap gap-2">
        {Array.from({ length: maxLevel }, (_, i) => i + 1).map((level) => {
          const slots = spellSlots[level];
          if (!slots) return null;
          return (
            <div
              key={level}
              className="flex items-center gap-1 border rounded-md px-2 py-1 text-sm"
            >
              <span className="text-muted-foreground">L{level}:</span>
              <span className="font-mono">
                {slots.used}/{slots.total}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ResourcesDisplay({
  resources,
  onUpdate,
}: {
  resources: Resource[];
  onUpdate: (resourceId: string, updates: Partial<Resource>) => void;
}) {
  if (resources.length === 0) {
    return <p className="text-sm text-muted-foreground italic">No resources</p>;
  }

  return (
    <div className="space-y-2">
      {resources.map((r) => (
        <div key={r.id} className="flex items-center gap-2 text-sm">
          <span className="w-32">{r.name}</span>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                onUpdate(r.id, { current: Math.max(0, r.current - 1) })
              }
            >
              -
            </Button>
            <span className="font-mono w-12 text-center">
              {r.current}/{r.max}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                onUpdate(r.id, { current: Math.min(r.max, r.current + 1) })
              }
            >
              +
            </Button>
          </div>
          <div className="flex gap-1 ml-2">
            {r.shortRestReset && (
              <Badge variant="outline" className="text-xs">
                Short Rest
              </Badge>
            )}
            {r.longRestReset && (
              <Badge variant="outline" className="text-xs">
                Long Rest
              </Badge>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function InventoryList({
  items,
}: {
  items: { id: string; name: string; quantity: number; isEquipped: boolean }[];
}) {
  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground italic">No items</p>;
  }

  return (
    <div className="space-y-1 text-sm max-h-40 overflow-y-auto">
      {items.map((item) => (
        <div key={item.id} className="flex items-center gap-2 px-2 py-0.5 rounded hover:bg-muted/50">
          {item.isEquipped && <span className="text-xs text-blue-500">◆</span>}
          <span>{item.name}</span>
          <span className="text-muted-foreground ml-auto">×{item.quantity}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────

export function CharacterManager() {
  const { activeCampaign, addCharacter, removeCharacter, updateCharacter } =
    useCampaignStore();
  const [search, setSearch] = useState('');
  const [classFilter, setClassFilter] = useState('');
  const [levelMin, setLevelMin] = useState('');
  const [levelMax, setLevelMax] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [sortAsc, setSortAsc] = useState(true);
  const [selectedCharacter, setSelectedCharacter] = useState<CharacterSheet | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<CharacterSheet | null>(null);

  const characters = activeCampaign?.characters ?? [];

  // ── Filters & Sorting ──
  const filteredCharacters = useMemo(() => {
    let result = [...characters];

    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.class.some((cl) => cl.toLowerCase().includes(q)) ||
          c.race.toLowerCase().includes(q)
      );
    }

    if (classFilter) {
      const cf = classFilter.toLowerCase();
      result = result.filter((c) =>
        c.class.some((cl) => cl.toLowerCase().includes(cf))
      );
    }

    if (levelMin) {
      const lm = parseInt(levelMin, 10);
      if (!isNaN(lm)) result = result.filter((c) => c.level >= lm);
    }
    if (levelMax) {
      const lx = parseInt(levelMax, 10);
      if (!isNaN(lx)) result = result.filter((c) => c.level <= lx);
    }

    result.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case 'name':
          cmp = a.name.localeCompare(b.name);
          break;
        case 'level':
          cmp = a.level - b.level;
          break;
        case 'class':
          cmp = (a.class[0] ?? '').localeCompare(b.class[0] ?? '');
          break;
        case 'hp':
          cmp = a.currentHp - b.currentHp;
          break;
      }
      return sortAsc ? cmp : -cmp;
    });

    return result;
  }, [characters, search, classFilter, levelMin, levelMax, sortKey, sortAsc]);

  // ── Handlers ──
  const handleImport = useCallback(
    (character: CharacterSheet, _mode: 'campaign' | 'global') => {
      addCharacter(character);
    },
    [addCharacter]
  );

  const handleDeleteConfirm = useCallback(() => {
    if (deleteTarget) {
      removeCharacter(deleteTarget.id);
      setDeleteTarget(null);
      if (selectedCharacter?.id === deleteTarget.id) {
        setSelectedCharacter(null);
      }
    }
  }, [deleteTarget, removeCharacter, selectedCharacter]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortAsc((p) => !p);
    } else {
      setSortKey(key);
      setSortAsc(true);
    }
  };

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return <span className="text-muted-foreground ml-1">⇅</span>;
    return <span className="ml-1">{sortAsc ? '↑' : '↓'}</span>;
  };

  return (
    <div className="p-6 space-y-6">
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Characters</h2>
          <p className="text-sm text-muted-foreground">
            {activeCampaign
              ? `Campaign: ${activeCampaign.name}`
              : 'No active campaign'}
          </p>
        </div>
        <Button onClick={() => setImportOpen(true)}>Import Character</Button>
      </div>

      {/* ── Filters ── */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-[200px]">
              <label className="text-xs font-medium text-muted-foreground mb-1 block">
                Search
              </label>
              <Input
                placeholder="Name, class, race..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="w-32">
              <label className="text-xs font-medium text-muted-foreground mb-1 block">
                Class
              </label>
              <Input
                placeholder="e.g. Wizard"
                value={classFilter}
                onChange={(e) => setClassFilter(e.target.value)}
              />
            </div>
            <div className="w-20">
              <label className="text-xs font-medium text-muted-foreground mb-1 block">
                Lvl min
              </label>
              <Input
                type="number"
                min={1}
                max={20}
                value={levelMin}
                onChange={(e) => setLevelMin(e.target.value)}
              />
            </div>
            <div className="w-20">
              <label className="text-xs font-medium text-muted-foreground mb-1 block">
                Lvl max
              </label>
              <Input
                type="number"
                min={1}
                max={20}
                value={levelMax}
                onChange={(e) => setLevelMax(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Character List + Sheet ── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* List */}
        <div className="xl:col-span-1">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Character Roster</CardTitle>
              <CardDescription>
                {filteredCharacters.length} character
                {filteredCharacters.length !== 1 ? 's' : ''}
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {filteredCharacters.length === 0 ? (
                <div className="p-6 text-center">
                  <p className="text-sm text-muted-foreground">
                    {characters.length === 0
                      ? 'No characters yet. Import one to get started!'
                      : 'No characters match your filters.'}
                  </p>
                </div>
              ) : (
                <div className="divide-y">
                  {/* Sort headers */}
                  <div className="flex items-center gap-3 px-4 py-2 text-xs font-medium text-muted-foreground bg-muted/30">
                    <button
                      className="flex-1 text-left hover:text-foreground"
                      onClick={() => toggleSort('name')}
                    >
                      Name<SortIcon col="name" />
                    </button>
                    <button
                      className="w-20 text-left hover:text-foreground"
                      onClick={() => toggleSort('class')}
                    >
                      Class<SortIcon col="class" />
                    </button>
                    <button
                      className="w-12 text-center hover:text-foreground"
                      onClick={() => toggleSort('level')}
                    >
                      Lv<SortIcon col="level" />
                    </button>
                    <button
                      className="w-16 text-right hover:text-foreground"
                      onClick={() => toggleSort('hp')}
                    >
                      HP<SortIcon col="hp" />
                    </button>
                    <span className="w-8" />
                  </div>

                  {filteredCharacters.map((char) => (
                    <div
                      key={char.id}
                      className={cn(
                        'flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors hover:bg-muted/50',
                        selectedCharacter?.id === char.id
                          ? 'bg-primary/5'
                          : ''
                      )}
                      onClick={() => setSelectedCharacter(char)}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{char.name}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {char.race} · {char.class.join(', ')}
                        </p>
                      </div>
                      <Badge variant="outline" className="text-xs">
                        Lv {char.level}
                      </Badge>
                      <span className="text-xs font-mono w-16 text-right">
                        {char.currentHp}/{char.maxHp}
                      </span>
                      <button
                        className="w-8 h-8 flex items-center justify-center text-muted-foreground hover:text-destructive rounded-md hover:bg-destructive/10"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteTarget(char);
                        }}
                        title="Delete character"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sheet */}
        <div className="xl:col-span-2">
          {selectedCharacter ? (
            <CharacterSheetView
              character={selectedCharacter}
              onUpdate={(updates) =>
                updateCharacter(selectedCharacter.id, updates)
              }
            />
          ) : (
            <Card>
              <CardContent className="p-12 text-center">
                <div className="text-4xl mb-3">👤</div>
                <p className="text-muted-foreground">
                  Select a character to view their full sheet
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* ── Import Dialog ── */}
      <CharacterImport
        open={importOpen}
        onOpenChange={setImportOpen}
        onImport={handleImport}
      />

      {/* ── Delete Confirmation ── */}
      <DeleteConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        onConfirm={handleDeleteConfirm}
        characterName={deleteTarget?.name ?? ''}
      />
    </div>
  );
}

// ─── Character Sheet View ─────────────────────────────────────────────────

function CharacterSheetView({
  character,
  onUpdate,
}: {
  character: CharacterSheet;
  onUpdate: (updates: Partial<CharacterSheet>) => void;
}) {
  const sections = [
    {
      id: 'stats',
      label: 'Ability Scores',
      content: <StatBlock stats={character.stats} />,
    },
    {
      id: 'saves',
      label: 'Saving Throws',
      content: (
        <SavingThrowsDisplay
          savingThrows={character.savingThrows}
          stats={character.stats}
        />
      ),
    },
    {
      id: 'skills',
      label: 'Skills',
      content: <SkillsList skills={character.skills} />,
    },
    {
      id: 'combat',
      label: 'Combat Stats',
      content: (
        <div className="grid grid-cols-3 gap-4 text-sm">
          <div>
            <span className="text-muted-foreground">AC</span>
            <p className="text-lg font-bold">{character.ac}</p>
          </div>
          <div>
            <span className="text-muted-foreground">Speed</span>
            <p className="text-lg font-bold">{character.speed} ft.</p>
          </div>
          <div>
            <span className="text-muted-foreground">Initiative</span>
            <p className="text-lg font-bold">
              {formatModifier(character.initiative)}
            </p>
          </div>
        </div>
      ),
    },
    {
      id: 'hp',
      label: 'Hit Points',
      content: (
        <HPEditor
          currentHp={character.currentHp}
          maxHp={character.maxHp}
          tempHp={character.tempHp}
          onChange={(current, temp) =>
            onUpdate({ currentHp: current, tempHp: temp })
          }
        />
      ),
    },
    {
      id: 'spells',
      label: 'Spellcasting',
      content: (
        <SpellSlotsDisplay
          spellSlots={character.spellList.slots}
          spellSaveDC={character.spellList.spellSaveDC}
          spellAttackBonus={character.spellList.spellAttackBonus}
        />
      ),
    },
    {
      id: 'resources',
      label: 'Class Resources',
      content: (
        <ResourcesDisplay
          resources={character.resources}
          onUpdate={(id, updates) => {
            const updated = character.resources.map((r) =>
              r.id === id ? { ...r, ...updates } : r
            );
            onUpdate({ resources: updated });
          }}
        />
      ),
    },
    {
      id: 'inventory',
      label: 'Inventory',
      content: <InventoryList items={character.inventory} />,
    },
    {
      id: 'proficiencies',
      label: 'Proficiencies & Traits',
      content: (
        <div className="space-y-2 text-sm">
          {character.proficiencies.length > 0 && (
            <div>
              <span className="text-muted-foreground text-xs font-medium">
                Proficiencies:
              </span>
              <div className="flex flex-wrap gap-1 mt-1">
                {character.proficiencies.map((p, i) => (
                  <Badge key={i} variant="secondary" className="text-xs">
                    {p}
                  </Badge>
                ))}
              </div>
            </div>
          )}
          {character.traits.length > 0 && (
            <div>
              <span className="text-muted-foreground text-xs font-medium">
                Traits:
              </span>
              <ul className="list-disc list-inside mt-1 space-y-0.5">
                {character.traits.map((t, i) => (
                  <li key={i}>{t}</li>
                ))}
              </ul>
            </div>
          )}
          {character.features.length > 0 && (
            <div>
              <span className="text-muted-foreground text-xs font-medium">
                Features:
              </span>
              <ul className="list-disc list-inside mt-1 space-y-0.5">
                {character.features.map((f, i) => (
                  <li key={i}>{f}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      ),
    },
  ];

  const [activeSection, setActiveSection] = useState(sections[0].id);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-xl">{character.name}</CardTitle>
            <CardDescription>
              {character.race} · {character.class.join(', ')} · Level{' '}
              {character.level}
              {character.source === 'lss' && (
                <Badge variant="outline" className="ml-2 text-xs">
                  LSS Import
                </Badge>
              )}
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      {/* Section tabs */}
      <div className="px-6 pb-2 flex flex-wrap gap-1 border-b">
        {sections.map((s) => (
          <button
            key={s.id}
            onClick={() => setActiveSection(s.id)}
            className={cn(
              'text-xs font-medium px-2.5 py-1.5 rounded-md transition-colors',
              activeSection === s.id
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-muted'
            )}
          >
            {s.label}
          </button>
        ))}
      </div>

      <CardContent className="p-4">
        {sections.find((s) => s.id === activeSection)?.content}
      </CardContent>
    </Card>
  );
}