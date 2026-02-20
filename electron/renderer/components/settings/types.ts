import type { ParceraSettings } from '../../../shared/types';
import React from 'react';

export interface TabProps {
  settings: ParceraSettings;
  updateRoot: (key: keyof ParceraSettings, value: any) => void;
  updateNested: (category: keyof ParceraSettings, key: string, value: any) => void;
  updateProvider: (category: 'llm' | 'stt' | 'tts', providerName: string, key: string, value: any) => void;
  setStatus: React.Dispatch<React.SetStateAction<{ message: string; type: 'success' | 'error' | '' }>>;
  renderTabHeader?: (title: string) => React.ReactNode;
  showApiKeysState?: [boolean, React.Dispatch<React.SetStateAction<boolean>>];
  isFetchingLLM?: boolean;
  llmModels?: string[] | null;
  handleFetchLLMModels?: () => void;
  isFetchingTTS?: boolean;
  speakersInfo?: { id: number; name: string; styleName: string }[] | null;
  handleFetchSpeakers?: () => void;
  isFetchingGoogleVoice?: boolean;
  googleVoices?: { id: string; gender: string }[] | null;
  handleFetchGoogleVoices?: () => void;
  updateTTSSettings?: (key: string, value: any) => void;
  handleSelectDir?: (target: 'user' | 'ai') => Promise<void>;
}

export const inputStyle = {
  width: '100%',
  padding: '8px 12px',
  borderRadius: '4px',
  border: '1px solid #555',
  background: '#1e1e1e',
  color: '#fff',
  fontSize: '14px',
  boxSizing: 'border-box' as const,
};
