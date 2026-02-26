import React from 'react';

interface TabHeaderProps {
  title: string;
  onRestoreDefaults: () => void;
}

/**
 * Reusable header for each settings tab, with a "restore defaults" button.
 */
export const TabHeader: React.FC<TabHeaderProps> = ({ title, onRestoreDefaults }) => (
  <div className="tab-header-container">
    <h2 className="tab-header-title">{title}</h2>
    <button
      onClick={onRestoreDefaults}
      className="btn btn-outline"
    >
      このタブを初期値に戻す
    </button>
  </div>
);
