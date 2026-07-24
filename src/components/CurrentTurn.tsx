import React, { useState, useEffect, useCallback } from 'react';
import { useCombatStore } from '../storage/store';
import { Combatant, DndCondition, Condition, Effect, createId, Duration } from '../types';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Select } from './ui/select';
import { Badge, CONDITION_COLORS } from './ui/badge';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from './ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from './ui/dialog';

interface CurrentTurnProps {
  selectedCombatant: Combatant | null;
}

const CONDITION_OPTIONS: { value: string; label: string }[] = [
  { value: 'Blinded', label: 'Blinded' },
  { value: 'Charmed', label: 'Charmed' },
  { value: 'Deafened', label: 'Deafened' },
  { value: 'Fatigued', label: 'Fatigued' },
  { value: 'Frightened', label: 'Frightened' },
  { value: 'Grappled', label: 'Grappled' },
  { value: 'Incapacitated', label: 'Incapacitated' },
  { value: 'Invisible', label: 'Invisible' },
  { value: 'Paralyzed', label: 'Paralyzed' },
  { value: 'Petrified', label: 'Petrified' },
  { value: 'Poisoned', label: 'Poisoned' },
  { value: 'Prone', label: 'Prone' },
  { value: 'Restrained', label: 'Restrained' },
  { value: 'Stunned', label: 'Stunned' },
  { value: 'Unconscious', label: 'Unconscious' },
  { value: 'Exhaustion', label: 'Exhaustion' },
  { value: 'Dazed', label: 'Dazed' },
  { value: 'Bloodied', label: 'Bloodied' },
];

const DAMAGE_TYPE_OPTIONS = [
  { value: '', label: 'None' },
  { value: 'acid', label: 'Acid' },
  { value: 'bludgeoning', label: 'Bludgeoning' },
  { value: 'cold', label: 'Cold' },
  { value: 'fire', label: 'Fire' },
  { value: 'force', label: 'Force' },
  { value: 'lightning', label: 'Lightning' },
  { value: 'necrotic', label: 'Necrotic' },
  { value: 'piercing', label: 'Piercing' },
  { value: 'poison', label: 'Poison' },
  { value: 'psychic', label: 'Psychic' },
  { value: 'radiant', label: 'Radiant' },
  { value: 'slashing', label: 'Slashing' },
  { value: 'thunder', label: 'Thunder' },
];

export function CurrentTurn({ selectedCombatant }: CurrentTurnProps) {
  const activeEncounter = useCombatStore((s) => s.activeEncounter);
  const damageCombatant = useCombatStore((s) => s.damageCombatant);
  const healCombatant = useCombatStore((s) => s.healCombatant);
  const setTempHp = useCombatStore((s) => s.setTempHp);
  const applyCondition = useCombatStore((s) => s.applyCondition);
  const applyEffect = useCombatStore((s) => s.applyEffect);
  const applyDeathSave = useCombatStore((s) => s.applyDeathSave);

  const [quickInput, setQuickInput] = useState('');
  const [damageAmount, setDamageAmount] = useState('');
  const [damageType, setDamageType] = useState('');
  const [healAmount, setHealAmount] = useState('');
  const [tempHpAmount, setTempHpAmount] = useState('');
  const [conditionName, setConditionName] = useState('');
  const [conditionDC, setConditionDC] = useState('');

  // Effect modal state
  const [showEffectModal, setShowEffectModal] = useState(false);
  const [effectName, setEffectName] = useState('');
  const [effectDuration, setEffectDuration] = useState('1');
  const [effectDurationType, setEffectDurationType] = useState<'round' | 'minute' | 'hour' | 'permanent'>('round');
  const [effectDescription, setEffectDescription] = useState('');

  // Concentration modal
  const [showConcentrationModal, setShowConcentrationModal] = useState(false);
  const [concentrationDC, setConcentrationDC] = useState(10);
  const [damageSource, setDamageSource] = useState('');

  // Death save modal
  const [showDeathSaveModal, setShowDeathSaveModal] = useState(false);
  const [deathSaveMessage, setDeathSaveMessage] = useState('');

  const currentGroup = activeEncounter?.initiativeGroups?.find(
    g => g.id === activeEncounter?.currentGroupId
  );
  const currentCombatantId = currentGroup?.currentOrder[currentGroup?.currentIndex ?? 0] ?? null;
  const currentCombatant = currentCombatantId
    ? activeEncounter?.combatants.find((c) => c.id === currentCombatantId)
    : null;

  const target = selectedCombatant || currentCombatant;

  // ── Concentration check helper ──
  const checkConcentration = useCallback((amount: number, type: string) => {
    if (target && target.isConcentrating && amount > 0) {
      const dc = Math.max(10, Math.floor(amount / 2));
      setConcentrationDC(dc);
      setDamageSource(type || 'damage');
      setShowConcentrationModal(true);
    }
  }, [target]);

  // ── Death save modal: show only when player is at 0 HP and unconscious ──
  // Track last known HP to detect the moment HP drops to 0
  const [lastKnownHp, setLastKnownHp] = useState<number | null>(null);
  const prevTargetIdRef = React.useRef<string | null>(null);

  useEffect(() => {
    if (!target) return;
    // Reset HP tracking when target changes
    if (target.id !== prevTargetIdRef.current) {
      prevTargetIdRef.current = target.id;
      setLastKnownHp(target.currentHp);
      return;
    }
    // Only show modal when HP just dropped to 0 (not on every render)
    if (lastKnownHp !== null && lastKnownHp > 0 && target.currentHp <= 0) {
      const isUnconscious = target.conditions.some((c) => c.name === 'Unconscious');
      if (!target.isMonster && isUnconscious) {
        setShowDeathSaveModal(true);
      }
    }
    setLastKnownHp(target.currentHp);
  }, [target?.currentHp, target?.conditions, target?.id]);

  // ── Handlers ──

  const handleQuickDamage = useCallback(() => {
    if (!target) return;
    const input = quickInput.trim().toLowerCase();

    // Parse "heal 8" or "heal8"
    const healMatch = input.match(/^heal\s*(\d+)$/i);
    if (healMatch) {
      const amount = parseInt(healMatch[1]);
      healCombatant(target.id, amount);
      setQuickInput('');
      return;
    }

    // Parse "temp 5" or "temp5"
    const tempMatch = input.match(/^temp\s*(\d+)$/i);
    if (tempMatch) {
      const amount = parseInt(tempMatch[1]);
      setTempHp(target.id, amount);
      setQuickInput('');
      return;
    }

    // Parse "12 fire" or "12"
    const damageMatch = input.match(/^(\d+)(?:\s+(\w+))?$/);
    if (damageMatch) {
      const amount = parseInt(damageMatch[1]);
      const type = damageMatch[2] || '';
      damageCombatant(target.id, amount);
      // Trigger concentration check AFTER damage is applied
      checkConcentration(amount, type);
      setQuickInput('');
      return;
    }
  }, [target, quickInput, damageCombatant, healCombatant, setTempHp, checkConcentration]);

  const handleDamage = useCallback(() => {
    if (!target) return;
    const amount = parseInt(damageAmount);
    if (isNaN(amount) || amount <= 0) return;
    damageCombatant(target.id, amount);
    // Trigger concentration check AFTER damage is applied
    checkConcentration(amount, damageType);
    setDamageAmount('');
  }, [target, damageAmount, damageType, damageCombatant, checkConcentration]);

  const handleHeal = useCallback(() => {
    if (!target) return;
    const amount = parseInt(healAmount);
    if (isNaN(amount) || amount <= 0) return;
    healCombatant(target.id, amount);
    setHealAmount('');
  }, [target, healAmount, healCombatant]);

  const handleTempHp = useCallback(() => {
    if (!target) return;
    const amount = parseInt(tempHpAmount);
    if (isNaN(amount) || amount < 0) return;
    setTempHp(target.id, amount);
    setTempHpAmount('');
  }, [target, tempHpAmount, setTempHp]);

  const handleAddCondition = useCallback(() => {
    if (!target || !conditionName) return;
    const condition: Condition = {
      id: createId(),
      name: conditionName as DndCondition,
      sourceId: currentCombatantId || target.id,
      duration: {
        type: conditionDC ? 'untilSave' : 'round',
        value: conditionDC ? parseInt(conditionDC) : 1,
      },
      description: `Applied by ${currentCombatant?.name || 'DM'}`,
    };
    applyCondition(target.id, condition);
    setConditionName('');
    setConditionDC('');
  }, [target, conditionName, conditionDC, currentCombatantId, currentCombatant, applyCondition]);

  const handleAddEffect = useCallback(() => {
    if (!target || !effectName) return;
    const duration: Duration = {
      type: effectDurationType,
      value: parseInt(effectDuration) || 1,
    };
    const effect: Effect = {
      id: createId(),
      name: effectName,
      sourceId: currentCombatantId || target.id,
      targets: [target.id],
      duration,
      remainingRounds: parseInt(effectDuration) || 1,
      expiresOnTurnId: null,
      saveCondition: null,
      statModifiers: {},
      description: effectDescription,
      concentrationGroup: null,
      isActive: true,
      trackingType: 'none',
      dndSourceType: 'spell',
    };
    applyEffect(target.id, effect);
    setShowEffectModal(false);
    setEffectName('');
    setEffectDuration('1');
    setEffectDescription('');
  }, [target, effectName, effectDuration, effectDurationType, effectDescription, currentCombatantId, currentCombatant, applyEffect]);

  const handleConcentrationSave = useCallback(
    (success: boolean) => {
      setShowConcentrationModal(false);
      if (!success && target) {
        // Remove concentration effects
        const concentrationEffects = target.effects.filter(
          (e) => e.concentrationGroup !== null && e.isActive
        );
        concentrationEffects.forEach((e) => {
          useCombatStore.getState().removeEffect(target.id, e.id);
        });
      }
    },
    [target]
  );

  const handleDeathSave = useCallback(
    (type: 'natural20' | 'natural1' | 'success' | 'failure') => {
      if (!target) return;
      let roll: number;
      switch (type) {
        case 'natural20':
          roll = 20;
          break;
        case 'natural1':
          roll = 1;
          break;
        case 'success':
          roll = 10;
          break;
        case 'failure':
          roll = 5;
          break;
      }
      const result = applyDeathSave(target.id, roll!);
      setDeathSaveMessage(
        result.result === 'alive'
          ? 'Character is alive and stable!'
          : result.result === 'dead'
          ? 'Character has died.'
          : result.result === 'stable'
          ? 'Character is stable.'
          : `Death save recorded (${result.deathsaves.successes}S / ${result.deathsaves.failures}F)`
      );
      // Auto-close modal if character is alive, dead, or stable
      if (result.result === 'alive' || result.result === 'dead' || result.result === 'stable') {
        setTimeout(() => setShowDeathSaveModal(false), 2000);
      }
    },
    [target, applyDeathSave]
  );

  if (!target) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-muted-foreground">
          Select a combatant to see actions
        </CardContent>
      </Card>
    );
  }

  const isUnconscious = target.conditions.some((c) => c.name === 'Unconscious');
  const needsDeathSaves = !target.isMonster && target.currentHp <= 0 && isUnconscious;

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {target.name}
            {target.isConcentrating && (
              <Badge variant="outline" color="yellow" className="ml-2">
                Concentrating
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Status summary */}
          <div className="grid grid-cols-3 gap-2 text-sm">
            <div>
              <span className="text-muted-foreground">HP:</span>{' '}
              <span className="font-mono">
                {target.currentHp}/{target.maxHp}
              </span>
              {target.tempHp > 0 && (
                <span className="text-blue-600 ml-1">(+{target.tempHp})</span>
              )}
            </div>
            <div>
              <span className="text-muted-foreground">AC:</span>{' '}
              <span className="font-mono">{target.ac}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Init:</span>{' '}
              <span className="font-mono">{target.initiative}</span>
            </div>
          </div>

          {/* Quick damage input */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Quick Damage/Heal/Temp</label>
            <div className="flex gap-2">
              <Input
                placeholder='12 | 12 fire | heal 8 | temp 5'
                value={quickInput}
                onChange={(e) => setQuickInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleQuickDamage()}
              />
              <Button onClick={handleQuickDamage} size="sm">
                Apply
              </Button>
            </div>
          </div>

          <hr className="border-t" />

          {/* Damage section */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Damage</label>
            <div className="flex gap-2">
              <Input
                type="number"
                placeholder="Amount"
                value={damageAmount}
                onChange={(e) => setDamageAmount(e.target.value)}
                className="w-24"
              />
              <Select
                options={DAMAGE_TYPE_OPTIONS}
                value={damageType}
                onChange={(e) => setDamageType(e.target.value)}
                className="flex-1"
              />
              <Button variant="destructive" size="sm" onClick={handleDamage}>
                Damage
              </Button>
            </div>
          </div>

          {/* Heal section */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Heal</label>
            <div className="flex gap-2">
              <Input
                type="number"
                placeholder="Amount"
                value={healAmount}
                onChange={(e) => setHealAmount(e.target.value)}
                className="w-24"
              />
              <Button variant="secondary" size="sm" onClick={handleHeal}>
                Heal
              </Button>
            </div>
          </div>

          {/* Temp HP section */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Temp HP</label>
            <div className="flex gap-2">
              <Input
                type="number"
                placeholder="Amount"
                value={tempHpAmount}
                onChange={(e) => setTempHpAmount(e.target.value)}
                className="w-24"
              />
              <Button variant="outline" size="sm" onClick={handleTempHp}>
                Set Temp
              </Button>
            </div>
          </div>

          <hr className="border-t" />

          {/* Add Condition */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Add Condition</label>
            <div className="flex gap-2">
              <Select
                options={CONDITION_OPTIONS}
                value={conditionName}
                onChange={(e) => setConditionName(e.target.value)}
                placeholder="Select condition..."
                className="flex-1"
              />
              <Input
                type="number"
                placeholder="DC"
                value={conditionDC}
                onChange={(e) => setConditionDC(e.target.value)}
                className="w-16"
              />
              <Button size="sm" onClick={handleAddCondition}>
                Add
              </Button>
            </div>
          </div>

          {/* Apply Effect button */}
          <Button
            variant="secondary"
            className="w-full"
            onClick={() => setShowEffectModal(true)}
          >
            Apply Effect
          </Button>

          {/* Death Save Button (for unconscious player characters) */}
          {needsDeathSaves && (
            <div className="space-y-2 p-3 bg-red-50 rounded-lg border border-red-200">
              <label className="text-sm font-medium text-red-800">
                Death Saves ({target.deathsaves.successes}S / {target.deathsaves.failures}F)
              </label>
              <div className="flex gap-2 flex-wrap">
                <Button size="sm" onClick={() => handleDeathSave('natural20')}>
                  Nat 20
                </Button>
                <Button size="sm" variant="destructive" onClick={() => handleDeathSave('natural1')}>
                  Nat 1
                </Button>
                <Button size="sm" variant="outline" onClick={() => handleDeathSave('success')}>
                  Success
                </Button>
                <Button size="sm" variant="secondary" onClick={() => handleDeathSave('failure')}>
                  Failure
                </Button>
              </div>
              {deathSaveMessage && (
                <p className="text-xs text-red-700 mt-1">{deathSaveMessage}</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Effect Modal */}
      <Dialog open={showEffectModal} onOpenChange={setShowEffectModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Apply Effect</DialogTitle>
            <DialogDescription>Add a new effect to {target.name}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              label="Effect Name"
              placeholder="e.g. Haste, Bless"
              value={effectName}
              onChange={(e) => setEffectName(e.target.value)}
            />
            <div className="flex gap-2">
              <Input
                label="Duration"
                type="number"
                placeholder="1"
                value={effectDuration}
                onChange={(e) => setEffectDuration(e.target.value)}
                className="w-24"
              />
              <Select
                label="Unit"
                options={[
                  { value: 'round', label: 'Rounds' },
                  { value: 'minute', label: 'Minutes' },
                  { value: 'hour', label: 'Hours' },
                  { value: 'permanent', label: 'Permanent' },
                ]}
                value={effectDurationType}
                onChange={(e) => setEffectDurationType(e.target.value as any)}
                className="flex-1"
              />
            </div>
            <Input
              label="Description"
              placeholder="Brief description..."
              value={effectDescription}
              onChange={(e) => setEffectDescription(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEffectModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddEffect}>
              Apply Effect
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Concentration Modal */}
      <Dialog open={showConcentrationModal} onOpenChange={setShowConcentrationModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Concentration Check</DialogTitle>
            <DialogDescription>
              {target.name} took damage and must maintain concentration.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 text-center">
            <p className="text-lg font-semibold">
              DC {concentrationDC} Constitution Save
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              Source: {damageSource}
            </p>
          </div>
          <DialogFooter>
            <Button
              variant="default"
              onClick={() => handleConcentrationSave(true)}
            >
              Success
            </Button>
            <Button
              variant="destructive"
              onClick={() => handleConcentrationSave(false)}
            >
              Fail
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
