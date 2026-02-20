import React, { useState, useEffect } from 'react';
import type { ParceraSettings } from '../../shared/types';
import { GeneralTab } from './settings/GeneralTab';
import { STTTab } from './settings/STTTab';
import { LLMTab } from './settings/LLMTab';
import { TTSTab } from './settings/TTSTab';
import { VisualTab } from './settings/VisualTab';
import { SystemTab } from './settings/SystemTab';

const TABS = [
  { id: 'general', label: '一般 (General)' },
  { id: 'stt', label: '耳・音声認識 (STT)' },
  { id: 'llm', label: '頭脳・思考 (LLM)' },
  { id: 'tts', label: '口・音声合成 (TTS)' },
  { id: 'visual', label: '体・アバター (Visual)' },
  { id: 'system', label: 'システム (System)' },
];

export const Settings: React.FC = () => {
  const [settings, setSettings] = useState<ParceraSettings | null>(null);
  const [status, setStatus] = useState<{ message: string; type: 'success' | 'error' | '' }>({ message: '', type: '' });
  const [activeTab, setActiveTab] = useState('general');

  useEffect(() => {
    // @ts-ignore
    window.electronAPI.getSettings().then(setSettings);
  }, []);

  const handleSave = async () => {
    if (!settings) return;
    setStatus({ message: '保存中...', type: '' });
    // @ts-ignore
    const result = await window.electronAPI.saveSettings(settings);
    if (result.success) {
      setStatus({ message: '設定を保存しました！', type: 'success' });
      setTimeout(() => setStatus({ message: '', type: '' }), 3000);
    } else {
      setStatus({ message: '保存エラー: ' + result.error, type: 'error' });
    }
  };

  const handleRestoreDefaults = async () => {
    const tabLabel = TABS.find(t => t.id === activeTab)?.label;
    if (!window.confirm(`「${tabLabel}」のタブ設定を初期値に戻しますか？\n(「保存する」を押すまで確定しません)`)) return;

    setStatus({ message: '初期値を取得中...', type: '' });
    // @ts-ignore
    const defaultSettings: ParceraSettings = await window.electronAPI.getDefaultSettings();
    if (!defaultSettings) {
      setStatus({ message: 'エラー: 初期値を取得できませんでした', type: 'error' });
      return;
    }

    setSettings((prev: ParceraSettings | null) => {
      if (!prev) return prev;
      let newSettings = { ...prev };

      if (activeTab === 'general') {
        newSettings.verbose = defaultSettings.verbose;
        newSettings.profile_mode = defaultSettings.profile_mode;
        newSettings.log_level = defaultSettings.log_level;
      } else if (activeTab === 'llm') {
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
        const prevWindows = newSettings.electron?.windows;
        newSettings.electron = { ...defaultSettings.electron, windows: prevWindows };
      }
      return newSettings;
    });
    setStatus({ message: '初期値をロードしました。(保存を押すと確定します)', type: 'success' });
    setTimeout(() => setStatus({ message: '', type: '' }), 5000);
  };

  const handleSelectDir = async (key: 'user' | 'ai') => {
    if (!settings) return;
    const current = (settings.avatars?.[key] as any)?.assets_dir;
    // @ts-ignore
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
    setSettings((prev: ParceraSettings | null) => prev ? ({ ...prev, [section]: { ...(prev[section] as any), [key]: value } }) : null);
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

          {/* ========== 1. 一般 (General) ========== */}
          {activeTab === 'general' && (
            <GeneralTab settings={settings} updateRoot={updateRoot} updateNested={updateNested} updateProvider={updateProvider} setStatus={setStatus} renderTabHeader={renderTabHeader} />
          )}

          {/* ========== 2. LLM ========== */}
          {activeTab === 'llm' && (
            <LLMTab
              settings={settings}
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
          保存する (Save)
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
