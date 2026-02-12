"use client";
import React from 'react';
import { useSessionsStore } from '../store/sessionsStore';
import { useLlmSettingsStore } from '../store/llmSettingsStore';
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
  const useMockLlm = useLlmSettingsStore((s) => s.useMockLlm);
  const setUseMockLlm = useLlmSettingsStore((s) => s.setUseMockLlm);

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
      <div className="mt-3 pt-3 border-t border-gray-200">
        <label className="flex items-center gap-2 cursor-pointer text-xs">
          <input
            type="checkbox"
            checked={useMockLlm}
            onChange={(e) => setUseMockLlm(e.target.checked)}
            className="rounded border-gray-300"
          />
          <span>Use mock LLM</span>
        </label>
        <p className="text-[11px] text-gray-500 mt-0.5">
          {useMockLlm ? 'Hardcoded responses' : 'Real API'}
        </p>
      </div>
    </aside>
  );
};

export default LeftSidebar;
