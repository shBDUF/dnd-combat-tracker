// ============================================================================
// CharacterImport — LSS JSON drag & drop import dialog
// ============================================================================

import React, { useState, useCallback, useRef } from 'react';
import { parseCharacter } from '../import/lss-parser.js';
import type { CharacterSheet, LssParseResult } from '../types/index.js';
import { Button } from './ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from './ui/card';
import { cn } from '../lib/utils';

// ─── Props ─────────────────────────────────────────────────────────────────

interface CharacterImportProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImport: (character: CharacterSheet, mode: 'campaign' | 'global') => void;
}

type ImportState =
  | { status: 'idle' }
  | { status: 'dragging' }
  | { status: 'loading' }
  | { status: 'success'; result: LssParseResult; rawJson: string }
  | { status: 'error'; message: string };

// ─── Component ─────────────────────────────────────────────────────────────

export function CharacterImport({
  open,
  onOpenChange,
  onImport,
}: CharacterImportProps) {
  const [importState, setImportState] = useState<ImportState>({ status: 'idle' });
  const [importMode, setImportMode] = useState<'campaign' | 'global'>('campaign');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragCounter = useRef(0);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current += 1;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setImportState({ status: 'dragging' });
    }
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current -= 1;
    if (dragCounter.current === 0) {
      setImportState({ status: 'idle' });
    }
  }, []);

  const processFile = useCallback((file: File) => {
    if (!file.name.endsWith('.json')) {
      setImportState({ status: 'error', message: 'Please select a .json file' });
      return;
    }

    setImportState({ status: 'loading' });

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const result = parseCharacter(text);
        if (result.success) {
          setImportState({ status: 'success', result, rawJson: text });
        } else {
          setImportState({
            status: 'error',
            message: result.errors.join('; '),
          });
        }
      } catch {
        setImportState({ status: 'error', message: 'Failed to parse JSON file' });
      }
    };
    reader.onerror = () => {
      setImportState({ status: 'error', message: 'Failed to read file' });
    };
    reader.readAsText(file);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      dragCounter.current = 0;
      setImportState({ status: 'idle' });

      const files = e.dataTransfer.files;
      if (files.length > 0) {
        processFile(files[0]);
      }
    },
    [processFile]
  );

  const handleFilePick = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (files && files.length > 0) {
        processFile(files[0]);
      }
    },
    [processFile]
  );

  const handleConfirm = useCallback(() => {
    if (importState.status === 'success' && importState.result.success) {
      onImport(importState.result.character, importMode);
      setImportState({ status: 'idle' });
      onOpenChange(false);
    }
  }, [importState, importMode, onImport, onOpenChange]);

  const handleCancel = useCallback(() => {
    setImportState({ status: 'idle' });
  }, []);

  const handleRetry = useCallback(() => {
    setImportState({ status: 'idle' });
  }, []);

  // ─── Render ─────────────────────────────────────────────────────────────

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/50" onClick={() => onOpenChange(false)} />
      <Card className="relative z-50 w-full max-w-lg mx-4">
        <CardHeader>
          <CardTitle>Import Character</CardTitle>
          <CardDescription>
            Import a character from a Long Story Short (LSS) JSON export
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* ── Drag & Drop Zone ── */}
          {importState.status === 'idle' || importState.status === 'dragging' ? (
            <div
              onDragOver={handleDragOver}
              onDragEnter={handleDragEnter}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={cn(
                'border-2 border-dashed rounded-lg p-12 text-center transition-colors cursor-pointer',
                importState.status === 'dragging'
                  ? 'border-primary bg-primary/5'
                  : 'border-muted-foreground/30 hover:border-muted-foreground/50'
              )}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                onChange={handleFilePick}
                className="hidden"
              />
              {importState.status === 'dragging' ? (
                <div className="space-y-2">
                  <div className="text-3xl">📂</div>
                  <p className="font-medium text-lg">Drop file here</p>
                  <p className="text-sm text-muted-foreground">Release to import</p>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="text-3xl">📄</div>
                  <p className="font-medium text-lg">Drag & drop JSON file here</p>
                  <p className="text-sm text-muted-foreground">or click to browse</p>
                  <Button variant="outline" size="sm" className="mt-2" onClick={(e: React.MouseEvent) => { e.stopPropagation(); fileInputRef.current?.click(); }}>
                    Browse Files
                  </Button>
                </div>
              )}
            </div>
          ) : null}

          {/* ── Loading ── */}
          {importState.status === 'loading' ? (
            <div className="flex items-center justify-center py-12">
              <div className="flex flex-col items-center gap-3">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                <p className="text-sm text-muted-foreground">Parsing character file...</p>
              </div>
            </div>
          ) : null}

          {/* ── Success Preview ── */}
          {importState.status === 'success' && importState.result.success ? (
            <div className="space-y-4">
              <Card className="bg-muted/50">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="text-2xl">✅</div>
                    <div>
                      <p className="font-semibold text-lg">{importState.result.character.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {importState.result.character.class.join(', ')} · Level {importState.result.character.level}
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div><span className="text-muted-foreground">Race:</span> {importState.result.character.race}</div>
                    <div><span className="text-muted-foreground">AC:</span> {importState.result.character.ac}</div>
                    <div><span className="text-muted-foreground">HP:</span> {importState.result.character.currentHp}/{importState.result.character.maxHp}</div>
                    <div><span className="text-muted-foreground">Speed:</span> {importState.result.character.speed} ft.</div>
                  </div>
                </CardContent>
              </Card>

              {/* Import mode */}
              <div className="space-y-2">
                <p className="text-sm font-medium">Import to:</p>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="importMode"
                      value="campaign"
                      checked={importMode === 'campaign'}
                      onChange={() => setImportMode('campaign')}
                      className="cursor-pointer"
                    />
                    <span className="text-sm">Add to current campaign</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="importMode"
                      value="global"
                      checked={importMode === 'global'}
                      onChange={() => setImportMode('global')}
                      className="cursor-pointer"
                    />
                    <span className="text-sm">Add to global character list</span>
                  </label>
                </div>
              </div>
            </div>
          ) : null}

          {/* ── Error ── */}
          {importState.status === 'error' ? (
            <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <div className="text-xl">❌</div>
                <div className="flex-1">
                  <p className="font-medium text-destructive">Import Error</p>
                  <p className="text-sm text-destructive/80 mt-1">{importState.message}</p>
                </div>
              </div>
            </div>
          ) : null}
        </CardContent>
        <CardFooter className="flex justify-between">
          {importState.status === 'success' ? (
            <>
              <Button variant="outline" onClick={handleCancel}>
                Cancel
              </Button>
              <Button onClick={handleConfirm}>Confirm Import</Button>
            </>
          ) : importState.status === 'error' ? (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Close
              </Button>
              <Button onClick={handleRetry}>Try Again</Button>
            </>
          ) : (
            <Button variant="outline" className="ml-auto" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
          )}
        </CardFooter>
      </Card>
    </div>
  );
}