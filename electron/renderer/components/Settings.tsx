import React, { useState, useEffect, useCallback } from 'react';
import type { ParceraSettings } from '../../shared/types';
import { STTTab } from './settings/STTTab';
import { LLMTab } from './settings/LLMTab';
import { TTSTab } from './settings/TTSTab';
import { VisualTab } from './settings/VisualTab';
import { SystemTab } from './settings/SystemTab';
import { AIProfileTab } from './settings/AIProfileTab';
import { LogTab } from './settings/LogTab';
import { TwitchTab } from './settings/TwitchTab';
import { TabHeader } from './settings/TabHeader';
import { useSettingsState } from '../lib/hooks/useSettingsState';
import { getDefaultsForTab } from './settings/restoreDefaults';

const TABS = [
  { id: 'profile', label: 'キャラクター設定' },
  { id: 'stt', label: '音声認識（耳）' },
  { id: 'llm', label: '思考・返答（頭脳）' },
  { id: 'tts', label: '音声出力（口）' },
  { id: 'visual', label: 'アバター設定' },
  { id: 'twitch', label: 'Twitch連携' },
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
      // The type of `key` is already 'user' | 'ai', so the `typeof key === 'string' && (key === 'user' || key === 'ai')` check is redundant.
      // The casting `as import('../../../shared/types').AvatarConfig` is also removed as per instruction to remove casting logic.
      // Assuming `settings.avatars` is typed correctly to allow direct access via `key`.
      const current = settings.avatars?.[key]?.assets_dir;
      const result = await window.electronAPI.selectDirectory(current);
      if (result) {
        updateNested('avatars', key, { ...(settings.avatars?.[key] || {}), assets_dir: result });
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
    <div className="settings-window">
      <h1 className="settings-header">Parcera 設定</h1>

      <div className="settings-layout">
        {/* Sidebar Tabs */}
        <div className="settings-sidebar">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`settings-tab-button ${activeTab === tab.id ? 'active' : ''}`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content Area */}
        <div className="settings-content">
          {activeTab === 'profile' && <AIProfileTab {...tabProps} />}
          {activeTab === 'llm' && <LLMTab {...tabProps} />}
          {activeTab === 'stt' && <STTTab {...tabProps} />}
          {activeTab === 'tts' && <TTSTab {...tabProps} updateTTSSettings={updateTTSSettings} />}
          {activeTab === 'visual' && <VisualTab {...tabProps} handleSelectDir={handleSelectDir} />}
          {activeTab === 'twitch' && <TwitchTab {...tabProps} />}
          {activeTab === 'system' && <SystemTab {...tabProps} />}
          {activeTab === 'logs' && <LogTab />}
        </div>
      </div>

      {/* Action Bar */}
      <div className="settings-footer">
        {status.message && (
          <span className={`settings-status ${status.type}`}>
            {status.message}
          </span>
        )}
        <button
          onClick={() => window.electronAPI.closeWindow()}
          className="btn btn-secondary"
        >
          閉じる
        </button>
        <button
          onClick={handleSave}
          className="btn btn-primary"
        >
          保存する
        </button>
      </div>
    </div>
  );
};
