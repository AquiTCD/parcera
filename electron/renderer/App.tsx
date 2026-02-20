import React from 'react';
import { Settings } from './components/Settings';
import { Avatar } from './components/Avatar';
import './style.css';

export const App: React.FC = () => {
  const params = new URLSearchParams(window.location.search);
  const view = params.get('type') === 'settings' ? 'settings' : 'avatar';

  return (
    <>
      {view === 'settings' ? <Settings /> : <Avatar />}
    </>
  );
};
