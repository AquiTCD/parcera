import React, { useState, useEffect, useCallback } from 'react';
import type { ParceraSettings } from '../../shared/types';
import { STTTab } from './settings/STTTab';
import { LLMTab } from './settings/LLMTab';
import { TTSTab } from './settings/TTSTab';
import { VisualTab } from './settings/VisualTab';
import { SystemTab } from './settings/SystemTab';
import { AIProfileTab } from './settings/AIProfileTab';
import { LogTab } from './settings/LogTab';
import { TabHeader } from './settings/TabHeader';
import { useSettingsState } from './settings/useSettingsState';
import { getDefaultsForTab } from './settings/restoreDefaults';

const TABS = [
  { id: 'profile', label: 'キャラクター設定' },
  { id: 'stt', label: '音声認識（耳）' },
  { id: 'llm', label: '思考・返答（頭脳）' },
  { id: 'tts', label: '音声出力（口）' },
  { id: 'visual', label: 'アバター設定' },
  { id: 'system', label: 'システム' },
  { id: 'logs', label: 'ログ' },
];

export const Settings: React.FC = () => {
  const {
    settings,
    setSettings,
    updateRoot,
    updateNested,
    updateProvider,
    updateTTSSettings,
  } = useSettingsState(null);

  const [defaultSettings, setDefaultSettings] = useState<ParceraSettings | null>(null);
  const [status, setStatus] = useState<{ message: string; type: 'success' | 'error' | '' }>({ message: '', type: '' });
  const [activeTab, setActiveTab] = useState('profile');

  useEffect(() => {
    window.electronAPI.getSettings().then(setSettings);
    window.electronAPI.getDefaultSettings().then(setDefaultSettings);
  }, [setSettings]);

  const handleSave = useCallback(async () => {
    if (!settings) return;
    setStatus({ message: '保存中...', type: '' });
    const result = await window.electronAPI.saveSettings(settings);
    if (result.success) {
      setStatus({ message: '設定を保存しました！', type: 'success' });
      setTimeout(() => setStatus({ message: '', type: '' }), 3000);
    } else {
      setStatus({ message: '保存エラー: ' + result.error, type: 'error' });
    }
  }, [settings]);

  const handleRestoreDefaults = useCallback(() => {
    const tabLabel = TABS.find((t) => t.id === activeTab)?.label;
    if (!window.confirm(`「${tabLabel}」のタブ設定を初期値に戻しますか？\n(「保存する」を押すまで確定しません)`)) return;

    if (!defaultSettings) {
      setStatus({ message: 'エラー: 初期値を取得できませんでした', type: 'error' });
      return;
    }

    setSettings((prev: ParceraSettings | null) => {
      if (!prev) return prev;
      const patch = getDefaultsForTab(activeTab, defaultSettings, prev);
      return patch ? { ...prev, ...patch } : prev;
    });

    setStatus({ message: '初期値をロードしました。(保存を押すと確定します)', type: 'success' });
    setTimeout(() => setStatus({ message: '', type: '' }), 5000);
  }, [activeTab, defaultSettings, setSettings]);

  const renderTabHeader = useCallback(
    (title: string) => <TabHeader title={title} onRestoreDefaults={handleRestoreDefaults} />,
    [handleRestoreDefaults]
  );

  const handleSelectDir = useCallback(
    async (key: 'user' | 'ai') => {
      if (!settings) return;
      const current = (settings.avatars?.[key] as any)?.assets_dir;
      const result = await window.electronAPI.selectDirectory(current);
      if (result) {
        updateNested('avatars', key, { ...(settings.avatars?.[key] as any), assets_dir: result });
      }
    },
    [settings, updateNested]
  );

  if (!settings) return <div style={{ color: 'white', padding: 20 }}>ローディング中...</div>;

  const tabProps = {
    settings,
    defaultSettings: defaultSettings || undefined,
    updateRoot,
    updateNested,
    updateProvider,
    setStatus,
    renderTabHeader,
  };

  return (
    <div className="settings-container" style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100vh', color: '#e0e0e0', fontFamily: 'system-ui, sans-serif', background: '#1e1e1e', boxSizing: 'border-box' }}>
      <h1 style={{ padding: '20px', margin: 0, borderBottom: '1px solid #333', background: '#252526' }}>Parcera 設定</h1>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Sidebar Tabs */}
        <div style={{ width: '180px', borderRight: '1px solid #333', background: '#2d2d30', overflowY: 'auto' }}>
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                display: 'block',
                width: '100%',
                padding: '15px 20px',
                textAlign: 'left',
                background: activeTab === tab.id ? '#37373d' : 'transparent',
                color: activeTab === tab.id ? '#fff' : '#ccc',
                border: 'none',
                borderLeft: activeTab === tab.id ? '4px solid #61dafb' : '4px solid transparent',
                cursor: 'pointer',
                fontSize: '15px',
                transition: 'all 0.2s'
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content Area */}
        <div style={{ flex: 1, padding: '30px', overflowY: 'auto', background: '#1e1e1e' }}>
          {activeTab === 'profile' && <AIProfileTab {...tabProps} />}
          {activeTab === 'llm' && <LLMTab {...tabProps} />}
          {activeTab === 'stt' && <STTTab {...tabProps} />}
          {activeTab === 'tts' && <TTSTab {...tabProps} updateTTSSettings={updateTTSSettings} />}
          {activeTab === 'visual' && <VisualTab {...tabProps} handleSelectDir={handleSelectDir} />}
          {activeTab === 'system' && <SystemTab {...tabProps} />}
          {activeTab === 'logs' && <LogTab />}
        </div>
      </div>

      {/* Action Bar */}
      <div style={{ background: '#252526', padding: '15px 30px', borderTop: '1px solid #333', display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '15px' }}>
        {status.message && (
          <span style={{ color: status.type === 'error' ? '#ff6b6b' : '#51cf66', marginRight: 'auto' }}>
            {status.message}
          </span>
        )}
        <button
          onClick={handleSave}
          style={{
            padding: '10px 25px',
            background: '#61dafb',
            color: '#000',
            border: 'none',
            borderRadius: '4px',
            fontWeight: 'bold',
            cursor: 'pointer',
            fontSize: '15px',
            transition: 'background 0.2s'
          }}
          onMouseOver={(e) => e.currentTarget.style.background = '#4fa8c7'}
          onMouseOut={(e) => e.currentTarget.style.background = '#61dafb'}
        >
          保存する
        </button>
      </div>
    </div>
  );
};
