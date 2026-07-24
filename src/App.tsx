import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, NavLink, Navigate } from 'react-router-dom';
import { CombatTracker } from './components/CombatTracker';
import { CharacterManager } from './components/CharacterManager';
import { MonsterBrowser } from './components/MonsterBrowser';
import { DMTools } from './components/DMTools';
import { CampaignPanel } from './components/CampaignPanel';
import { cn } from './lib/utils';

const NAV_ITEMS = [
  { path: '/combat', label: 'Combat', icon: '⚔️' },
  { path: '/characters', label: 'Characters', icon: '👤' },
  { path: '/monsters', label: 'Monsters', icon: '🐉' },
  { path: '/dmtools', label: 'DM Tools', icon: '🎲' },
  { path: '/campaign', label: 'Campaign', icon: '🗺️' },
];

export default function App() {
  const [dark, setDark] = useState(() => {
    const saved = localStorage.getItem('dnd-theme');
    if (saved) return saved === 'dark';
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    localStorage.setItem('dnd-theme', dark ? 'dark' : 'light');
  }, [dark]);

  return (
    <BrowserRouter>
      <div className="min-h-screen bg-background flex">
        {/* Sidebar Navigation */}
        <nav className="w-56 bg-card border-r border-border p-4 flex flex-col gap-2 shrink-0">
          <div className="mb-6">
            <h1 className="text-lg font-bold tracking-tight">D&D Combat</h1>
            <p className="text-xs text-muted-foreground">Tracker</p>
          </div>

          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/campaign'}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                )
              }
            >
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </NavLink>
          ))}

          <div className="mt-auto pt-4 border-t border-border flex flex-col gap-2">
            {/* Theme Toggle */}
            <button
              onClick={() => setDark((d: boolean) => !d)}
              className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
            >
              <span>{dark ? '☀️' : '🌙'}</span>
              <span>{dark ? 'Light Mode' : 'Dark Mode'}</span>
            </button>
            <p className="text-xs text-muted-foreground px-3">
              v1.0.0
            </p>
          </div>
        </nav>

        {/* Main Content */}
        <main className="flex-1 overflow-auto">
          <Routes>
            <Route path="/" element={<Navigate to="/combat" replace />} />
            <Route path="/combat" element={<CombatTracker />} />
            <Route path="/characters" element={<CharacterManager />} />
            <Route path="/monsters" element={<MonsterBrowser />} />
            <Route path="/dmtools" element={<DMTools />} />
            <Route path="/campaign" element={<CampaignPanel />} />
            <Route path="/campaign/:id" element={<CampaignPanel />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}