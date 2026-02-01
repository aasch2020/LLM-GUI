"use client";
import React, { useMemo, useState } from 'react';
import { useSessionsStore } from '../store/sessionsStore';

const StarterField: React.FC = () => {
  const selectedId = useSessionsStore((s) => s.selectedId);
  const map = useSessionsStore((s) => (selectedId ? s.maps[selectedId] : undefined));
  const updateNodeData = useSessionsStore((s) => s.updateNodeData);
  const createRoot = useSessionsStore((s) => s.createRoot);
  const selectedNodeId = useSessionsStore((s) => s.selectedNodeId);

  const root = useMemo(() => map?.nodes?.find((n) => n.id === 'root'), [map]);
  const [value, setValue] = useState<string>(
    typeof root?.data?.label === 'string' ? (root?.data?.label as string) : ''
  );

  const submit = () => {
    const label = (value || '').trim();
    if (!label) return;
    if (root) {
      updateNodeData('root', { label, title: label });
    } else {
      createRoot(label);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <input
        className="w-64 rounded border border-gray-300 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        placeholder={root ? 'Rename root…' : 'Name your root…'}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') submit(); }}
      />
      <button
        className="px-2.5 py-1 text-xs rounded bg-blue-600 text-white hover:bg-blue-700"
        onClick={submit}
        disabled={!value.trim()}
      >
        {root ? 'Rename' : 'Create Root'}
      </button>
      {selectedNodeId === 'root' && (
        <span className="text-[11px] text-gray-500">Editing root</span>
      )}
    </div>
  );
};

export default StarterField;
