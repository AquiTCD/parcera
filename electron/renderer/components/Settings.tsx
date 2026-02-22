import React, { useState, useEffect } from 'react';
import type { ParceraSettings } from '../../shared/types';
import { STTTab } from './settings/STTTab';
import { LLMTab } from './settings/LLMTab';
import { TTSTab } from './settings/TTSTab';
import { VisualTab } from './settings/VisualTab';
import { SystemTab } from './settings/SystemTab';
import { AIProfileTab } from './settings/AIProfileTab';

const TABS = [
  { id: 'profile', label: 'キャラクター設定' },
  { id: 'stt', label: '音声認識（耳）' },
  { id: 'llm', label: '思考・返答（頭脳）' },
  { id: 'tts', label: '音声出力（口）' },
  { id: 'visual', label: 'アバター設定' },
  { id: 'system', label: 'システム' },
];

export const Settings: React.FC = () => {
  const [settings, setSettings] = useState<ParceraSettings | null>(null);
  const [defaultSettings, setDefaultSettings] = useState<ParceraSettings | null>(null);
  const [status, setStatus] = useState<{ message: string; type: 'success' | 'error' | '' }>({ message: '', type: '' });
  const [activeTab, setActiveTab] = useState('profile');

  useEffect(() => {
    window.electronAPI.getSettings().then(setSettings);
    window.electronAPI.getDefaultSettings().then(setDefaultSettings);
  }, []);

  const handleSave = async () => {
    if (!settings) return;
    setStatus({ message: '保存中...', type: '' });
    const result = await window.electronAPI.saveSettings(settings);
    if (result.success) {
      // Notify Python server to reload config immediately
      let restartHelp = false;
      try {
        const port = settings.electron?.port || 8676;
        const res = await fetch(`http://127.0.0.1:${port}/config/reload`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(settings)
        });
        const data = await res.json();
        if (data.restart_required) {
          restartHelp = true;
        }
      } catch (e) {
        console.warn('Failed to notify Python server for config reload:', e);
      }

      if (restartHelp) {
        setStatus({ message: '⚠️ 保存完了：エンジンの変更を反映するにはアプリの再起動が必要です。', type: 'success' });
        setTimeout(() => setStatus({ message: '', type: '' }), 6000);
      } else {
        setStatus({ message: '設定を保存しました！', type: 'success' });
        setTimeout(() => setStatus({ message: '', type: '' }), 3000);
      }
    } else {
      setStatus({ message: '保存エラー: ' + result.error, type: 'error' });
    }
  };

  const handleRestoreDefaults = async () => {
    const tabLabel = TABS.find(t => t.id === activeTab)?.label;
    if (!window.confirm(`「${tabLabel}」のタブ設定を初期値に戻しますか？\n(「保存する」を押すまで確定しません)`)) return;

    if (!defaultSettings) {
      setStatus({ message: 'エラー: 初期値を取得できませんでした', type: 'error' });
      return;
    }

    setSettings((prev: ParceraSettings | null) => {
      if (!prev) return prev;
      let newSettings = { ...prev };

      if (activeTab === 'llm') {
        newSettings.llm = defaultSettings.llm;
      } else if (activeTab === 'stt') {
        newSettings.stt = defaultSettings.stt;
        newSettings.vad = defaultSettings.vad;
        newSettings.force_keywords = defaultSettings.force_keywords;
        newSettings.response_sensitivity = defaultSettings.response_sensitivity;
        newSettings.merge_request_threshold = defaultSettings.merge_request_threshold;
      } else if (activeTab === 'tts') {
        newSettings.tts = defaultSettings.tts;
      } else if (activeTab === 'visual') {
        newSettings.avatars = defaultSettings.avatars;
        if (defaultSettings.electron?.windows) {
          const prevWindows = newSettings.electron?.windows || {};
          newSettings.electron = { ...newSettings.electron, windows: { ...prevWindows, ai: defaultSettings.electron.windows.ai, user: defaultSettings.electron.windows.user } };
        }
      } else if (activeTab === 'system') {
        newSettings.verbose = defaultSettings.verbose;
        newSettings.profile_mode = defaultSettings.profile_mode;
        newSettings.log_level = defaultSettings.log_level;
        const prevWindows = newSettings.electron?.windows;
        newSettings.electron = { ...defaultSettings.electron, windows: prevWindows };
      } else if (activeTab === 'profile') {
        newSettings.ai_profile = defaultSettings.ai_profile;
        newSettings.user_profile = defaultSettings.user_profile;
        newSettings.knowledge = defaultSettings.knowledge;
      }
      return newSettings;
    });
    setStatus({ message: '初期値をロードしました。(保存を押すと確定します)', type: 'success' });
    setTimeout(() => setStatus({ message: '', type: '' }), 5000);
  };

  const handleSelectDir = async (key: 'user' | 'ai') => {
    if (!settings) return;
    const current = (settings.avatars?.[key] as any)?.assets_dir;
    const result = await window.electronAPI.selectDirectory(current);
    if (result) {
      updateNested('avatars', key, { ...(settings.avatars?.[key] as any), assets_dir: result });
    }
  };

  const renderTabHeader = (title: string) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
      <h2 style={{ color: '#61dafb', margin: 0 }}>{title}</h2>
      <button
        onClick={handleRestoreDefaults}
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
        onMouseOver={(e) => e.currentTarget.style.background = '#333'}
        onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
      >
        このタブを初期値に戻す
      </button>
    </div>
  );

  const updateRoot = (key: keyof ParceraSettings, value: any) => {
    setSettings((prev: ParceraSettings | null) => prev ? ({ ...prev, [key]: value }) : null);
  };

  const updateNested = (section: keyof ParceraSettings, key: string, value: any) => {
    setSettings((prev: ParceraSettings | null) => {
      if (!prev) return null;
      if (key === '') {
        return { ...prev, [section]: value };
      }
      return { ...prev, [section]: { ...(prev[section] as any), [key]: value } };
    });
  };

  const updateProvider = (section: 'llm' | 'stt' | 'tts', providerName: string, key: string, value: any) => {
    setSettings((prev: ParceraSettings | null) => {
      if (!prev) return null;
      const currentSection = prev[section] as any || {};
      const providers = currentSection.providers || {};
      const targetProvider = providers[providerName] || {};
      return {
        ...prev,
        [section]: {
          ...currentSection,
          providers: {
            ...providers,
            [providerName]: {
              ...targetProvider,
              [key]: value
            }
          }
        }
      };
    });
  };

  const updateTTSSettings = (key: string, value: any) => {
    setSettings((prev: ParceraSettings | null) => {
      if (!prev) return null;
      const currentSection = prev.tts || {};
      const ttsSettings = currentSection.settings || {};
      return {
        ...prev,
        tts: {
          ...currentSection,
          settings: {
            ...ttsSettings,
            [key]: value
          }
        }
      };
    });
  }

  if (!settings) return <div style={{ color: 'white', padding: 20 }}>ローディング中...</div>;

  const currentSTTProvider = settings.stt?.provider || 'faster_whisper';

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

          {/* ========== 1. Profile ========== */}
          {activeTab === 'profile' && (
            <AIProfileTab
              settings={settings}
              defaultSettings={defaultSettings || undefined}
              updateNested={updateNested}
              updateRoot={updateRoot}
              updateProvider={updateProvider}
              setStatus={setStatus}
              renderTabHeader={renderTabHeader}
            />
          )}

          {/* ========== 2. LLM ========== */}
          {activeTab === 'llm' && (
            <LLMTab
              settings={settings}
              defaultSettings={defaultSettings || undefined}
              updateProvider={updateProvider}
              updateNested={updateNested}
              updateRoot={updateRoot}
              setStatus={setStatus}
              renderTabHeader={renderTabHeader}
            />
          )}

          {/* ========== 3. STT ========== */}
          {activeTab === 'stt' && (
            <STTTab
              settings={settings}
              defaultSettings={defaultSettings || undefined}
              updateRoot={updateRoot}
              updateNested={updateNested}
              updateProvider={updateProvider}
              setStatus={setStatus}
              renderTabHeader={renderTabHeader}
            />
          )}

          {/* ========== 4. TTS ========== */}
          {activeTab === 'tts' && (
            <TTSTab
              settings={settings}
              defaultSettings={defaultSettings || undefined}
              updateRoot={updateRoot}
              updateNested={updateNested}
              updateProvider={updateProvider}
              updateTTSSettings={updateTTSSettings}
              setStatus={setStatus}
              renderTabHeader={renderTabHeader}
            />
          )}

          {activeTab === 'visual' && (
            <VisualTab
              settings={settings}
              defaultSettings={defaultSettings || undefined}
              updateRoot={updateRoot}
              updateNested={updateNested}
              updateProvider={updateProvider}
              setStatus={setStatus}
              renderTabHeader={renderTabHeader}
              handleSelectDir={handleSelectDir}
            />
          )}

          {/* ========== 6. System ========== */}
          {activeTab === 'system' && (
            <SystemTab
              settings={settings}
              defaultSettings={defaultSettings || undefined}
              updateRoot={updateRoot}
              updateNested={updateNested}
              updateProvider={updateProvider}
              setStatus={setStatus}
              renderTabHeader={renderTabHeader}
            />
          )}
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
    </div >
  );
};

// UI style constant
const inputStyle = {
  padding: '10px',
  borderRadius: '4px',
  border: '1px solid #444',
  background: '#3c3c3c',
  color: 'white',
  width: '100%',
  boxSizing: 'border-box' as const,
  fontSize: '14px'
};
