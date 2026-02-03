"use client";
import MindMap from '../../../components/MindMap';
import LeftSidebar from '../../../components/LeftSidebar';
import StarterField from '../../../components/StarterField';
import { useSessionsStore } from '../../../store/sessionsStore';
import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

/**
 * ChatPage
 *
 * Per-session mind map view at `/chat/[id]`.
 * Syncs the selected session id from the route and renders the mind map
 * with actions to add pre/post/info nodes.
 */
export default function ChatPage() {
  const params = useParams();
  const id = Array.isArray(params.id) ? params.id[0] : (params.id ?? '');
  const selectSession = useSessionsStore((s) => s.selectSession);
  const selectedId = useSessionsStore((s) => s.selectedId);
  const addDemoNode = useSessionsStore((s) => s.addDemoNode);
  const addPreNode = useSessionsStore((s) => s.addPreNode);
  const addInfoNode = useSessionsStore((s) => s.addInfoNode);
  const maps = useSessionsStore((s) => s.maps);
  const selectedNodeId = useSessionsStore((s) => s.selectedNodeId);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  useEffect(() => {
    if (id && id !== selectedId) {
      selectSession(id);
    }
  }, [id, selectedId, selectSession]);

  const selectedLabel = (() => {
    if (!selectedId || !selectedNodeId) return null;
    const node = maps[selectedId]?.nodes?.find((n) => n.id === selectedNodeId);
    return node?.data?.label ?? selectedNodeId;
  })();

  return (
    <main className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Chat: {id}</h1>
        <div className="flex items-center gap-4">
          <StarterField />
          <button
            className="px-3 py-1.5 text-sm rounded bg-gray-700 text-white hover:bg-gray-800"
            onClick={() => addPreNode('Pre Node')}
            disabled={!selectedNodeId}
          >
            Add Pre
          </button>
          <button
            className="px-3 py-1.5 text-sm rounded bg-blue-600 text-white hover:bg-blue-700"
            onClick={() => addDemoNode('Post Node')}
            disabled={!selectedNodeId}
          >
            Add Post
          </button>
          <button
            className="px-3 py-1.5 text-sm rounded bg-amber-500 text-white hover:bg-amber-600"
            onClick={() => addInfoNode('Info Node')}
            disabled={!selectedNodeId}
          >
            Add Info
          </button>
          <span className="text-xs text-gray-600">
            {selectedLabel ? `Selected: ${selectedLabel}` : 'Select a node to add links'}
          </span>
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
