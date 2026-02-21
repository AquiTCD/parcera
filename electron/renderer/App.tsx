import React from 'react';
import { Settings } from './components/Settings';
import type { ParceraSettings } from '../shared/types';
import { Avatar } from './components/Avatar';
import { ChromaKeyFilter } from './components/ChromaKeyFilter';
import './style.css';

export const App: React.FC = () => {
  const [settings, setSettings] = React.useState<ParceraSettings | null>(null);
  const params = new URLSearchParams(window.location.search);
  const view = params.get('type') === 'settings' ? 'settings' : 'avatar';

  React.useEffect(() => {
    window.electronAPI.getSettings().then(setSettings);
    return window.electronAPI.onSettingsChanged(setSettings);
  }, []);

  const getChromaSettings = () => {
    const type = params.get('type') || 'user';
    const avatarSettings = settings?.avatars?.[type as 'user' | 'ai'];
    return {
      enabled: avatarSettings?.chroma_key_enabled ?? false,
      color: (avatarSettings?.chroma_key_color ?? 'green') as 'green' | 'blue'
    };
  };

  const chroma = getChromaSettings();

  return (
    <>
      <ChromaKeyFilter
        enabled={chroma.enabled}
        color={chroma.color}
      />
      {view === 'settings' ? <Settings /> : <Avatar />}
    </>
  );
};
