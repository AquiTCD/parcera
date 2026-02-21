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

  return (
    <>
      <ChromaKeyFilter
        enabled={settings?.chroma_key_enabled ?? true}
        color={settings?.chroma_key_color ?? 'green'}
      />
      {view === 'settings' ? <Settings /> : <Avatar />}
    </>
  );
};
