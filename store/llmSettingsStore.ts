import { create } from 'zustand';

const defaultUseMock =
  typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_USE_MOCK_LLM === 'true';

interface LlmSettingsState {
  useMockLlm: boolean;
  setUseMockLlm: (value: boolean) => void;
}

export const useLlmSettingsStore = create<LlmSettingsState>((set) => ({
  useMockLlm: defaultUseMock,
  setUseMockLlm: (value) => set({ useMockLlm: value }),
}));
