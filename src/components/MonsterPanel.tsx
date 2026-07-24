import React, { useState, useMemo } from 'react';
import { useCombatStore } from '../storage/store';
import { Combatant, MonsterBlock, Action } from '../types';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import { Card, CardHeader, CardTitle, CardContent } from './ui/card';
import { Progress } from './ui/progress';

interface MonsterPanelProps {
  combatant: Combatant | null;
}

// In-memory monster block registry — would be loaded from Dexie in real app
const MONSTER_BLOCKS: Record<string, MonsterBlock> = {};

export function MonsterPanel({ combatant }: MonsterPanelProps) {
  const activeEncounter = useCombatStore((s) => s.activeEncounter);
  const damageCombatant = useCombatStore((s) => s.damageCombatant);
  const updateCombatant = useCombatStore((s) => s.updateCombatant);
  const [groupDamage, setGroupDamage] = useState('');

  const monsterBlock = combatant?.monsterId
    ? MONSTER_BLOCKS[combatant.monsterId]
    : null;

  if (!combatant || !combatant.isMonster) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-muted-foreground text-sm">
          Select a monster to view its stat block
        </CardContent>
      </Card>
    );
  }

  const isGroup = combatant.isGroup;

  // Roll damage for an action
  const rollDamage = (action: Action) => {
    if (action.damageDice) {
      // Simple dice parser: "2d6+3" -> total
      const match = action.damageDice.match(/(\d+)d(\d+)(?:\+(\d+))?/);
      if (match) {
        const count = parseInt(match[1]);
        const sides = parseInt(match[2]);
        const bonus = parseInt(match[3] || '0');
        let total = 0;
        for (let i = 0; i < count; i++) {
          total += Math.floor(Math.random() * sides) + 1;
        }
        total += bonus;
        alert(`${action.name} deals ${total} ${action.damageType} damage`);
      }
    }
    if (action.attackBonus) {
      const roll = Math.floor(Math.random() * 20) + 1;
      const total = roll + action.attackBonus;
      const isCrit = roll === 20;
      alert(
        `${action.name}: ${roll > 1 ? `d20=${roll}` : 'Nat 1!'} + ${action.attackBonus} = ${total} to hit${isCrit ? ' (CRIT!)' : ''}`
      );
    }
  };

  const handleGroupDamage = () => {
    if (!combatant || !isGroup) return;
    const dmg = parseInt(groupDamage);
    if (isNaN(dmg) || dmg <= 0) return;

    // For group monsters, damage applies to individualHp
    // If damage >= individualHp, one dies
    const hp = combatant.individualHp;
    if (dmg >= hp) {
      // One dies
      const newSize = (combatant.groupSize || 1) - 1;
      if (newSize <= 0) {
        // All dead
        updateCombatant(combatant.id, {
          groupSize: 0,
          isDead: true,
          currentHp: 0,
        });
      } else {
        updateCombatant(combatant.id, {
          groupSize: newSize,
          currentHp: Math.max(0, combatant.currentHp - dmg),
        });
      }
    } else {
      // Damage the individual
      updateCombatant(combatant.id, {
        individualHp: hp - dmg,
        currentHp: Math.max(0, combatant.currentHp - dmg),
      });
    }
    setGroupDamage('');
  };

  const statsEntries = monsterBlock
    ? Object.entries(monsterBlock.stats).map(([key, val]) => {
        const mod = Math.floor(((val as number) - 10) / 2);
        const sign = mod >= 0 ? '+' : '';
        return { key, value: val as number, mod, sign };
      })
    : [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {combatant.name}
          {combatant.isGroup && (
            <Badge variant="secondary" className="ml-2">
              {combatant.groupSize}x remaining
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Basic stats */}
        <div className="grid grid-cols-3 gap-2 text-sm bg-muted/50 rounded-lg p-3">
          <div>
            <span className="text-muted-foreground">AC</span>{' '}
            <span className="font-mono font-bold">{combatant.ac}</span>
          </div>
          <div>
            <span className="text-muted-foreground">HP</span>{' '}
            <span className="font-mono">
              {combatant.currentHp}/{combatant.maxHp}
            </span>
          </div>
          <div>
            <span className="text-muted-foreground">Init</span>{' '}
            <span className="font-mono">{combatant.initiative}</span>
          </div>
          {isGroup && (
            <>
              <div>
                <span className="text-muted-foreground">Individual HP</span>{' '}
                <span className="font-mono">{combatant.individualHp}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Alive</span>{' '}
                <span className="font-mono">{combatant.groupSize}</span>
              </div>
            </>
          )}
        </div>

        {/* HP Bar */}
        <Progress
          value={combatant.currentHp}
          max={combatant.maxHp}
          variant="health"
          size="md"
        />

        {/* Ability Scores */}
        {monsterBlock && (
          <div>
            <h4 className="text-sm font-medium text-muted-foreground mb-1">
              Stats
            </h4>
            <div className="flex gap-3 text-xs">
              {statsEntries.map(({ key, value, mod, sign }) => (
                <div key={key} className="text-center">
                  <div className="uppercase text-muted-foreground">{key}</div>
                  <div className="font-mono font-bold">{value}</div>
                  <div className="text-muted-foreground">
                    ({sign}{mod})
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Speed & Senses */}
        {monsterBlock && (
          <div className="text-xs text-muted-foreground space-y-1">
            <p>
              <span className="font-medium">Speed:</span> {monsterBlock.speed}
            </p>
            <p>
              <span className="font-medium">Senses:</span> {monsterBlock.senses}
            </p>
            <p>
              <span className="font-medium">CR:</span>{' '}
              {monsterBlock.challengeRating} ({monsterBlock.xp} XP)
            </p>
          </div>
        )}

        {/* Saving Throws */}
        {monsterBlock && monsterBlock.savingThrows && Object.keys(monsterBlock.savingThrows).length > 0 && (
          <div className="text-xs">
            <span className="font-medium text-muted-foreground">Saves: </span>
            {Object.entries(monsterBlock.savingThrows).map(([stat, val]) => (
              <span key={stat} className="font-mono">
                {stat.toUpperCase()} {val >= 0 ? '+' : ''}
                {val}{' '}
              </span>
            ))}
          </div>
        )}

        {/* Skills */}
        {monsterBlock && monsterBlock.skills && Object.keys(monsterBlock.skills).length > 0 && (
          <div className="text-xs">
            <span className="font-medium text-muted-foreground">Skills: </span>
            {Object.entries(monsterBlock.skills).map(([skill, val]) => (
              <span key={skill} className="font-mono">
                {skill} {val >= 0 ? '+' : ''}
                {val}{' '}
              </span>
            ))}
          </div>
        )}

        {/* Damage Resistances/Immunities */}
        {monsterBlock && monsterBlock.damageImmunities.length > 0 && (
          <div className="text-xs">
            <span className="font-medium text-muted-foreground">DMG Imm: </span>
            {monsterBlock.damageImmunities.join(', ')}
          </div>
        )}
        {monsterBlock && monsterBlock.damageResistances.length > 0 && (
          <div className="text-xs">
            <span className="font-medium text-muted-foreground">DMG Res: </span>
            {monsterBlock.damageResistances.join(', ')}
          </div>
        )}

        {/* Group damage input */}
        {isGroup && (
          <div className="space-y-2 p-3 bg-muted/30 rounded-lg border">
            <label className="text-sm font-medium">Group Damage</label>
            <div className="flex gap-2">
              <Input
                type="number"
                placeholder="Damage amount"
                value={groupDamage}
                onChange={(e) => setGroupDamage(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleGroupDamage()}
              />
              <Button variant="destructive" size="sm" onClick={handleGroupDamage}>
                Apply
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Damage &ge; individual HP kills one. Excess damage does not overflow.
            </p>
          </div>
        )}

        {/* Actions */}
        {monsterBlock && monsterBlock.actions.length > 0 && (
          <div>
            <h4 className="text-sm font-medium text-muted-foreground mb-2">
              Actions
            </h4>
            <div className="space-y-2">
              {monsterBlock.actions.map((action) => (
                <div
                  key={action.id}
                  className="rounded-md border p-2 text-sm"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{action.name}</span>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => rollDamage(action)}
                    >
                      Roll
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {action.description}
                  </p>
                  {action.attackBonus && (
                    <p className="text-xs text-muted-foreground mt-1">
                      +{action.attackBonus} to hit
                      {action.damageDice && ` • ${action.damageDice} ${action.damageType}`}
                    </p>
                  )}
                  {action.saveDC && (
                    <p className="text-xs text-muted-foreground mt-1">
                      DC {action.saveDC} {action.saveStat?.toUpperCase()} save
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Legendary Actions */}
        {monsterBlock && monsterBlock.legendaryActions.length > 0 && (
          <div>
            <h4 className="text-sm font-medium text-muted-foreground mb-2">
              Legendary Actions
            </h4>
            {monsterBlock.legendaryActions.map((action) => (
              <div
                key={action.id}
                className="rounded-md border border-purple-200 p-2 text-sm mb-1"
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium">{action.name}</span>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => rollDamage(action)}
                  >
                    Roll
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {action.description}
                </p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}