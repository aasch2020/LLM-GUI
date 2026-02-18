"use client";
import MindMap from '../components/MindMap';
import LeftSidebar from '../components/LeftSidebar';
import StarterField from '../components/StarterField';
import { useSessionsStore } from '../store/sessionsStore';
import React, { useState } from 'react';

/**
 * HomePage
 *
 * Main entry view showing the mind map canvas, sidebar, and quick actions
 * to add pre/post/info nodes to the currently selected node.
 */
export default function HomePage() {
  const addDemoNode = useSessionsStore((s) => s.addDemoNode);
  const addPreNode = useSessionsStore((s) => s.addPreNode);
  const addInfoNode = useSessionsStore((s) => s.addInfoNode);
  const selectedId = useSessionsStore((s) => s.selectedId);
  const maps = useSessionsStore((s) => s.maps);
  const selectedNodeId = useSessionsStore((s) => s.selectedNodeId);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const selectedLabel = (() => {
    if (!selectedId || !selectedNodeId) return null;
    const node = maps[selectedId]?.nodes?.find((n) => n.id === selectedNodeId);
    return node?.data?.label ?? selectedNodeId;
  })();

  return (
    <main className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Mind Map</h1>
        <div className="flex items-center gap-4">
          <StarterField />  
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button
          className="px-2 py-1 text-xs rounded border border-gray-300 hover:bg-gray-100"
          onClick={() => setSidebarOpen((v) => !v)}
          aria-pressed={sidebarOpen}
        >
          {sidebarOpen ? 'Hide Sidebar' : 'Show Sidebar'}
        </button>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {sidebarOpen && (
          <div className="lg:col-span-1 h-[70vh]">
            <LeftSidebar />
          </div>
        )}
        <div className={sidebarOpen ? 'lg:col-span-3' : 'lg:col-span-4'}>
          <MindMap />
        </div>
      </div>
    </main>
  );
}
