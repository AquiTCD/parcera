import React from 'react';
import { Settings } from './components/Settings';
import type { ParceraSettings } from '../shared/types';
import { Avatar } from './components/Avatar';
import { ChromaKeyFilter } from './components/ChromaKeyFilter';
import './style.css';

const params = new URLSearchParams(window.location.search);
const view = params.get('type') === 'settings' ? 'settings' : 'avatar';
const avatarType = params.get('type') || 'user';

// Set window title dynamically for OBS window capture
if (view === 'settings') {
  document.title = 'Parcera - Settings';
} else if (avatarType === 'ai') {
  document.title = 'Parcera - AI';
} else if (avatarType === 'user') {
  document.title = 'Parcera - User';
}

export const App: React.FC = () => {
  const [settings, setSettings] = React.useState<ParceraSettings | null>(null);

  React.useEffect(() => {
    window.electronAPI.getSettings().then(setSettings);
    return window.electronAPI.onSettingsChanged(setSettings);
  }, []);

  const chroma = React.useMemo(() => {
    const avatarSettings = settings?.avatars?.[avatarType as 'user' | 'ai'];
    return {
      enabled: avatarSettings?.chroma_key_enabled ?? false,
      color: (avatarSettings?.chroma_key_color ?? 'green') as 'green' | 'blue',
    };
  }, [settings]);

  return (
    <>
      <ChromaKeyFilter
        enabled={chroma.enabled}
        color={chroma.color}
      />
      {view === 'settings' ? <Settings /> : <Avatar />}
      <div className="obs-heartbeat" />
    </>
  );
};
