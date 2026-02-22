import React from 'react';

interface TabHeaderProps {
  title: string;
  onRestoreDefaults: () => void;
}

/**
 * Reusable header for each settings tab, with a "restore defaults" button.
 */
export const TabHeader: React.FC<TabHeaderProps> = ({ title, onRestoreDefaults }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
    <h2 style={{ color: '#61dafb', margin: 0 }}>{title}</h2>
    <button
      onClick={onRestoreDefaults}
      style={{
        padding: '6px 12px',
        background: 'transparent',
        color: '#ccc',
        border: '1px solid #555',
        borderRadius: '4px',
        cursor: 'pointer',
        fontSize: '12px',
        transition: 'background 0.2s',
      }}
      onMouseOver={(e) => (e.currentTarget.style.background = '#333')}
      onMouseOut={(e) => (e.currentTarget.style.background = 'transparent')}
    >
      このタブを初期値に戻す
    </button>
  </div>
);
