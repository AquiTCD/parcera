import type { ParceraSettings } from '../../../shared/types';
import React from 'react';

export interface TabProps {
  settings: ParceraSettings;
  defaultSettings?: ParceraSettings;
  updateRoot: (key: keyof ParceraSettings, value: any) => void;
  updateNested: (category: keyof ParceraSettings, key: string, value: any) => void;
  updateProvider: (category: 'llm' | 'stt' | 'tts', providerName: string, key: string, value: any) => void;
  setStatus: React.Dispatch<React.SetStateAction<{ message: string; type: 'success' | 'error' | '' }>>;
  renderTabHeader?: (title: string) => React.ReactNode;
  updateTTSSettings?: (key: string, value: any) => void;
  handleSelectDir?: (target: 'user' | 'ai') => Promise<void>;
}
