// ============================================================================
// CampaignPanel — Campaign management, character roster, export/import
// ============================================================================

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useCampaignStore } from '../storage/store.js';
import type { Campaign, CharacterSheet } from '../types/index.js';
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

// ─── Props ─────────────────────────────────────────────────────────────────

interface CampaignPanelProps {
  // Can be used standalone or via route
}

// ─── Campaign Selector ─────────────────────────────────────────────────────

function CampaignSelector({
  campaigns,
  activeCampaignId,
  onSelect,
  onCreate,
}: {
  campaigns: Campaign[];
  activeCampaignId: string | null;
  onSelect: (id: string) => void;
  onCreate: (name: string, description: string) => void;
}) {
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');

  const handleCreate = () => {
    if (newName.trim()) {
      onCreate(newName.trim(), newDesc.trim());
      setNewName('');
      setNewDesc('');
      setShowCreate(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Campaigns</h3>
        <Button size="sm" onClick={() => setShowCreate(true)}>
          New Campaign
        </Button>
      </div>

      {campaigns.length === 0 && !showCreate ? (
        <p className="text-sm text-muted-foreground text-center py-4">
          No campaigns yet. Create one to get started.
        </p>
      ) : (
        <div className="space-y-1">
          {campaigns.map((camp) => (
            <button
              key={camp.id}
              onClick={() => onSelect(camp.id)}
              className={cn(
                'w-full text-left px-3 py-2 rounded-md text-sm transition-colors',
                camp.id === activeCampaignId
                  ? 'bg-primary/10 text-primary font-medium'
                  : 'hover:bg-muted/50'
              )}
            >
              <div className="font-medium">{camp.name}</div>
              {camp.description && (
                <div className="text-xs text-muted-foreground truncate">
                  {camp.description}
                </div>
              )}
              <div className="text-xs text-muted-foreground mt-0.5">
                {camp.characters.length} characters · {camp.encounters.length} encounters
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Create dialog */}
      {showCreate && (
        <div className="border rounded-md p-3 space-y-2">
          <Input
            placeholder="Campaign name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            autoFocus
          />
          <Input
            placeholder="Description (optional)"
            value={newDesc}
            onChange={(e) => setNewDesc(e.target.value)}
          />
          <div className="flex gap-2">
            <Button size="sm" onClick={handleCreate} disabled={!newName.trim()}>
              Create
            </Button>
            <Button size="sm" variant="outline" onClick={() => setShowCreate(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Encounter History ─────────────────────────────────────────────────────

function EncounterHistory({
  encounters,
}: {
  encounters: { id: string; name: string; startTime: number; isActive: boolean; round: number }[];
}) {
  if (encounters.length === 0) {
    return <p className="text-sm text-muted-foreground italic">No encounters yet</p>;
  }

  return (
    <div className="space-y-1 max-h-48 overflow-y-auto">
      {[...encounters]
        .sort((a, b) => b.startTime - a.startTime)
        .map((enc) => (
          <div
            key={enc.id}
            className="flex items-center justify-between px-2 py-1.5 text-sm rounded hover:bg-muted/50"
          >
            <div className="flex items-center gap-2">
              <span>{enc.name}</span>
              {enc.isActive && (
                <Badge variant="default" className="text-xs">Active</Badge>
              )}
            </div>
            <div className="text-xs text-muted-foreground">
              {new Date(enc.startTime).toLocaleDateString()} · R{enc.round}
            </div>
          </div>
        ))}
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────

export function CampaignPanel(_props: CampaignPanelProps) {
  const { id: routeId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const {
    campaigns,
    activeCampaign,
    loadCampaigns,
    loadCampaign,
    createCampaign,
    deleteCampaign,
    addCharacter,
    removeCharacter,
    exportCampaign,
    importCampaign,
  } = useCampaignStore();

  const [importOpen, setImportOpen] = useState(false);
  const [exportData, setExportData] = useState<string | null>(null);
  const [importJson, setImportJson] = useState('');
  const [showImportJson, setShowImportJson] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  // Load campaigns on mount
  useEffect(() => {
    loadCampaigns();
  }, [loadCampaigns]);

  // Load campaign if route has an ID
  useEffect(() => {
    if (routeId) {
      loadCampaign(routeId);
    }
  }, [routeId, loadCampaign]);

  const handleSelectCampaign = (id: string) => {
    navigate(`/campaign/${id}`);
  };

  const handleCreateCampaign = (name: string, description: string) => {
    const campaign = createCampaign(name, description);
    navigate(`/campaign/${campaign.id}`);
  };

  const handleExport = useCallback(async () => {
    if (!activeCampaign) return;
    try {
      const json = await exportCampaign(activeCampaign.id);
      setExportData(json);
      // Also trigger download
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${activeCampaign.name.replace(/\s+/g, '_')}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export failed:', err);
    }
  }, [activeCampaign, exportCampaign]);

  const handleImportJson = useCallback(async () => {
    if (!importJson.trim()) return;
    try {
      await importCampaign(importJson);
      setImportJson('');
      setShowImportJson(false);
    } catch (err) {
      console.error('Import failed:', err);
    }
  }, [importJson, importCampaign]);

  const handleDeleteCampaign = useCallback(async () => {
    if (!confirmDelete) return;
    await deleteCampaign(confirmDelete);
    setConfirmDelete(null);
    navigate('/campaign');
  }, [confirmDelete, deleteCampaign, navigate]);

  const handleCharacterImport = useCallback(
    (character: CharacterSheet, _mode: 'campaign' | 'global') => {
      addCharacter(character);
    },
    [addCharacter]
  );

  // ── Render ──
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Campaign</h2>
          <p className="text-sm text-muted-foreground">
            {activeCampaign
              ? activeCampaign.name
              : 'Select or create a campaign'}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar */}
        <div className="lg:col-span-1 space-y-4">
          <Card>
            <CardContent className="p-4">
              <CampaignSelector
                campaigns={campaigns}
                activeCampaignId={activeCampaign?.id ?? null}
                onSelect={handleSelectCampaign}
                onCreate={handleCreateCampaign}
              />
            </CardContent>
          </Card>

          {/* Export/Import */}
          {activeCampaign && (
            <Card>
              <CardContent className="p-4 space-y-2">
                <h3 className="text-sm font-semibold">Campaign Data</h3>
                <Button variant="outline" size="sm" className="w-full" onClick={handleExport}>
                  Export as JSON
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => setShowImportJson(true)}
                >
                  Import from JSON
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  className="w-full"
                  onClick={() => setConfirmDelete(activeCampaign.id)}
                >
                  Delete Campaign
                </Button>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Main content */}
        <div className="lg:col-span-3 space-y-4">
          {!activeCampaign ? (
            <Card>
              <CardContent className="p-12 text-center">
                <div className="text-4xl mb-3">🗺️</div>
                <p className="text-muted-foreground">
                  Select a campaign from the sidebar or create a new one
                </p>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Campaign info */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle>{activeCampaign.name}</CardTitle>
                  {activeCampaign.description && (
                    <CardDescription>{activeCampaign.description}</CardDescription>
                  )}
                </CardHeader>
                <CardContent className="flex gap-4 text-sm text-muted-foreground">
                  <span>{activeCampaign.characters.length} characters</span>
                  <span>{activeCampaign.encounters.length} encounters</span>
                  <span>Created {new Date(activeCampaign.createdAt).toLocaleDateString()}</span>
                </CardContent>
              </Card>

              {/* Character Roster */}
              <Card>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-base">Character Roster</CardTitle>
                      <CardDescription>
                        {activeCampaign.characters.length} character
                        {activeCampaign.characters.length !== 1 ? 's' : ''}
                      </CardDescription>
                    </div>
                    <Button size="sm" onClick={() => setImportOpen(true)}>
                      Add Character
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  {activeCampaign.characters.length === 0 ? (
                    <div className="p-6 text-center">
                      <p className="text-sm text-muted-foreground">
                        No characters in this campaign yet
                      </p>
                    </div>
                  ) : (
                    <div className="divide-y">
                      {activeCampaign.characters.map((char) => {
                        const hpPercent = (char.currentHp / char.maxHp) * 100;
                        return (
                          <div
                            key={char.id}
                            className="flex items-center gap-3 px-4 py-2.5"
                          >
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium">{char.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {char.race} · {char.class.join(', ')} · Lv {char.level}
                              </p>
                            </div>
                            <div className="w-24">
                              <div className="flex justify-between text-xs text-muted-foreground mb-0.5">
                                <span>HP</span>
                                <span>{char.currentHp}/{char.maxHp}</span>
                              </div>
                              <div className="h-1.5 w-full bg-secondary rounded-full overflow-hidden">
                                <div
                                  className={cn(
                                    'h-full rounded-full',
                                    hpPercent > 50 ? 'bg-green-500' : hpPercent > 25 ? 'bg-yellow-500' : 'bg-red-500'
                                  )}
                                  style={{ width: `${Math.min(100, hpPercent)}%` }}
                                />
                              </div>
                            </div>
                            <Badge variant="outline" className="text-xs">
                              AC {char.ac}
                            </Badge>
                            <button
                              className="w-6 h-6 flex items-center justify-center text-muted-foreground hover:text-destructive rounded"
                              onClick={() => removeCharacter(char.id)}
                              title="Remove character"
                            >
                              ✕
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Encounter History */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Encounter History</CardTitle>
                  <CardDescription>
                    Past encounters in this campaign
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <EncounterHistory encounters={activeCampaign.encounters} />
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </div>

      {/* Import Character Dialog */}
      <CharacterImport
        open={importOpen}
        onOpenChange={setImportOpen}
        onImport={handleCharacterImport}
      />

      {/* Import JSON Dialog */}
      <Dialog open={showImportJson} onOpenChange={setShowImportJson}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Import Campaign</DialogTitle>
            <DialogDescription>
              Paste campaign JSON data below
            </DialogDescription>
          </DialogHeader>
          <textarea
            className="w-full h-40 rounded-md border border-input bg-background p-3 text-sm font-mono"
            placeholder="Paste JSON here..."
            value={importJson}
            onChange={(e) => setImportJson(e.target.value)}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowImportJson(false)}>
              Cancel
            </Button>
            <Button onClick={handleImportJson} disabled={!importJson.trim()}>
              Import
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={confirmDelete !== null} onOpenChange={(open) => { if (!open) setConfirmDelete(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Campaign</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this campaign? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDelete(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteCampaign}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Export Data Display */}
      {exportData && (
        <Dialog open={true} onOpenChange={(open) => { if (!open) setExportData(null); }}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Exported Campaign</DialogTitle>
              <DialogDescription>
                JSON data has been downloaded. Preview below:
              </DialogDescription>
            </DialogHeader>
            <pre className="max-h-60 overflow-y-auto text-xs font-mono bg-muted p-3 rounded-md">
              {exportData.slice(0, 2000)}
              {exportData.length > 2000 ? '\n... (truncated)' : ''}
            </pre>
            <DialogFooter>
              <Button onClick={() => setExportData(null)}>Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}