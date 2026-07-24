import React from 'react';
import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom';
import { CombatTracker } from './components/CombatTracker';
import { cn } from './lib/utils';

// Placeholder components for routes not yet implemented
function CharacterManager() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="text-center">
        <h2 className="text-xl font-semibold mb-2">Character Manager</h2>
        <p className="text-muted-foreground">Manage player characters — coming soon</p>
      </div>
    </div>
  );
}

function MonsterBrowser() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="text-center">
        <h2 className="text-xl font-semibold mb-2">Monster Browser</h2>
        <p className="text-muted-foreground">Browse and search monsters — coming soon</p>
      </div>
    </div>
  );
}

function DMTools() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="text-center">
        <h2 className="text-xl font-semibold mb-2">DM Tools</h2>
        <p className="text-muted-foreground">Name generator, dice roller, and more — coming soon</p>
      </div>
    </div>
  );
}

const NAV_ITEMS = [
  { path: '/combat', label: 'Combat', icon: '⚔️' },
  { path: '/characters', label: 'Characters', icon: '👤' },
  { path: '/monsters', label: 'Monsters', icon: '🐉' },
  { path: '/dmtools', label: 'DM Tools', icon: '🎲' },
];

export default function App() {
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

          <div className="mt-auto pt-4 border-t border-border">
            <p className="text-xs text-muted-foreground">
              v1.0.0
            </p>
          </div>
        </nav>

        {/* Main Content */}
        <main className="flex-1 overflow-auto">
          <Routes>
            <Route path="/" element={<CombatTracker />} />
            <Route path="/combat" element={<CombatTracker />} />
            <Route path="/characters" element={<CharacterManager />} />
            <Route path="/monsters" element={<MonsterBrowser />} />
            <Route path="/dmtools" element={<DMTools />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}