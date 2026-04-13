import type { ParceraSettings } from '../../../shared/types';
import React from 'react';

export interface SectionProps {
  settings: ParceraSettings;
  defaultSettings?: ParceraSettings;
  updateRoot: (key: keyof ParceraSettings, value: unknown) => void;
  updateNested: (category: keyof ParceraSettings, key: string, value: unknown) => void;
  updateProvider: (category: 'llm' | 'stt' | 'tts', providerName: string, key: string, value: unknown) => void;
  updateTTSSettings?: (key: string, value: unknown) => void;
  setStatus: React.Dispatch<React.SetStateAction<{ message: string; type: 'success' | 'error' | '' }>>;
  handleSelectDir?: (target: 'user' | 'ai') => Promise<void>;
}
