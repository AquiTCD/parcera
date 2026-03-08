import React from 'react';
import { Settings } from './components/Settings';
import type { ParceraSettings } from '../shared/types';
import { Avatar } from './components/Avatar';
import { ChromaKeyFilter } from './components/ChromaKeyFilter';
import { TrainingTab } from './components/settings/TrainingTab';
import './style.css';

const params = new URLSearchParams(window.location.search);
const typeParam = params.get('type');
const view = typeParam === 'settings' ? 'settings' : typeParam === 'training' ? 'training' : 'avatar';
const avatarType = typeParam || 'user';
const profileParam = params.get('profile') || 'default';

// Set window title dynamically for OBS window capture
if (view === 'settings') {
  document.title = 'Parcera - Settings';
} else if (view === 'training') {
  document.title = `Parcera - 追加学習 (${profileParam})`;
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

  if (!settings) return null;

  return (
    <>
      <ChromaKeyFilter
        enabled={chroma.enabled}
        color={chroma.color}
      />
      {view === 'settings' ? (
        <Settings />
      ) : view === 'training' ? (
        <TrainingTab settings={settings} profile={profileParam} />
      ) : (
        <Avatar />
      )}
      <div className="obs-heartbeat" />
    </>
  );
};
