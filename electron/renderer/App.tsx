import React, { useEffect, useState } from 'react';
import { Settings } from './components/Settings';
import { Avatar } from './components/Avatar';
import './style.css';

export const App: React.FC = () => {
  const [view, setView] = useState<'avatar' | 'settings'>('avatar');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const type = params.get('type');
    if (type === 'settings') {
      setView('settings');
    } else {
      setView('avatar');
    }
  }, []);

  return (
    <>
      {view === 'settings' ? <Settings /> : <Avatar />}
    </>
  );
};
