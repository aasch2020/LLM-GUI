"use client";
import React from 'react';
import { useSessionsStore } from '../store/sessionsStore';
import { useRouter } from 'next/navigation';

/**
 * LeftSidebar
 *
 * Lists chat sessions with create/select actions. Navigates to `/chat/[id]` on selection.
 */
const LeftSidebar: React.FC = () => {
  const sessions = useSessionsStore((s) => s.sessions);
  const selectedId = useSessionsStore((s) => s.selectedId);
  const createSession = useSessionsStore((s) => s.createSession);
  const selectSession = useSessionsStore((s) => s.selectSession);
  const router = useRouter();

  return (
    <aside className="h-full flex flex-col bg-white border border-gray-200 rounded p-3 w-full">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold">Chats</h2>
        <button
          className="text-xs px-2 py-1 rounded bg-gray-800 text-white hover:bg-black"
          onClick={() => {
            const id = createSession('New Chat');
            router.push(`/chat/${id}`);
          }}
        >
          New Chat
        </button>
      </div>
      <div className="flex-1 overflow-auto space-y-1">
        {sessions.map((s) => (
          <button
            key={s.id}
            onClick={() => { selectSession(s.id); router.push(`/chat/${s.id}`); }}
            className={
              `w-full text-left text-sm px-2 py-1 rounded border ${
                s.id === selectedId ? 'bg-blue-50 border-blue-300' : 'bg-white border-gray-200 hover:bg-gray-50'
              }`
            }
          >
            <div className="font-medium">{s.title}</div>
            <time suppressHydrationWarning className="text-[11px] text-gray-500">
              {new Date(s.createdAt).toLocaleString()}
            </time>
          </button>
        ))}
        {sessions.length === 0 && (
          <div className="text-xs text-gray-500">No chats yet.</div>
        )}
      </div>
    </aside>
  );
};

export default LeftSidebar;
