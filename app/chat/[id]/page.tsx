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
  const promptLoading = useSessionsStore((s) => s.promptLoading);
  const [sidebarOpen, setSidebarOpen] = useState(false);

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

  const rootNode = selectedId ? maps[selectedId]?.nodes?.find((n) => n.id === 'root') : null;
  const rootTitle = (rootNode?.data as any)?.title ?? (rootNode?.data as any)?.label ?? '';
  const headingTitle = rootTitle.trim() || 'New Chat:';

  return (
    <main className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{headingTitle}</h1>
        <div className="flex items-center gap-4">
          <StarterField />
        </div>
      </div>
      <div className="flex items-center gap-2">
        {/* <button
          className="px-2 py-1 text-xs rounded border border-gray-300 hover:bg-gray-100"
          onClick={() => setSidebarOpen((v) => false)}
          aria-pressed={sidebarOpen}
        >
          {sidebarOpen ? 'Hide Sidebar' : 'Show Sidebar'}
        </button> */}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {sidebarOpen && (
          <div className="lg:col-span-1 h-[70vh]">
            <LeftSidebar />
          </div>
        )}
        <div className={`relative ${sidebarOpen ? 'lg:col-span-3' : 'lg:col-span-4'}`}>
          {promptLoading && (
            <div
              className="absolute inset-0 z-10 flex items-center justify-center bg-white/90 dark:bg-gray-900/90 rounded-lg"
              aria-busy="true"
              aria-live="polite"
            >
              <div className="flex flex-col items-center gap-3">
                <div className="h-10 w-10 animate-spin rounded-full border-2 border-gray-300 border-t-blue-600" />
                <span className="text-sm text-gray-600 dark:text-gray-400">Updating map…</span>
              </div>
            </div>
          )}
          <MindMap />
        </div>
      </div>
    </main>
  );
}
