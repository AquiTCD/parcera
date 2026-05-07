import React, { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../lib/api';
import { listen } from '@tauri-apps/api/event';
import type { ParceraSettings } from '../../shared/types';
import { useSettingsState } from '../lib/hooks/useSettingsState';
import { SidebarLayout } from './layout/SidebarLayout';
import { SidebarNav, type NavItem } from './layout/SidebarNav';
import { CharacterSection } from './sections/CharacterSection';
import { MicInputSection } from './sections/MicInputSection';
import { IntegrationSection } from './sections/IntegrationSection';
import { AdvancedSection } from './sections/AdvancedSection';
import { DeveloperSection } from './sections/DeveloperSection';
import { Button } from './ui/button';
import { getDefaultsForTab } from './settings/restoreDefaults';

const NAV_ITEMS: NavItem[] = [
  { id: 'character', label: 'キャラクター' },
  { id: 'mic', label: 'マイク・入力' },
  { id: 'integration', label: '連携' },
  { id: 'advanced', label: '詳細設定', advanced: true },
  { id: 'developer', label: '開発者', advanced: true },
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
  const [status, setStatus] = useState<{ message: string; type: 'success' | 'error' | '' }>({
    message: '',
    type: '',
  });
  const [activeSection, setActiveSection] = useState('character');
  const statusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    api.getSettings().then(setSettings);
    api.getDefaultSettings().then(setDefaultSettings);
  }, [setSettings]);

  useEffect(() => {
    const unlisten = listen<boolean>('python-reload-done', (event) => {
      if (event.payload) {
        setStatus({ message: '設定を保存しました。一部の変更は再起動後に反映されます。', type: 'success' });
        if (statusTimerRef.current) clearTimeout(statusTimerRef.current);
        statusTimerRef.current = setTimeout(() => setStatus({ message: '', type: '' }), 8000);
      }
    });
    return () => {
      unlisten.then((fn) => fn());
      if (statusTimerRef.current) clearTimeout(statusTimerRef.current);
    };
  }, []);

  const handleRestoreDefaults = useCallback(() => {
    const label = NAV_ITEMS.find((n) => n.id === activeSection)?.label ?? activeSection;
    if (!window.confirm(`「${label}」セクションの設定を初期値に戻しますか？\n（「保存する」を押すまで確定しません）`)) return;
    if (!defaultSettings) {
      setStatus({ message: 'エラー: 初期値を取得できませんでした', type: 'error' });
      return;
    }
    setSettings((prev: ParceraSettings | null) => {
      if (!prev) return prev;
      const patch = getDefaultsForTab(activeSection, defaultSettings, prev);
      return patch ? { ...prev, ...patch } : prev;
    });
    setStatus({ message: '初期値をロードしました（保存で確定）', type: 'success' });
    setTimeout(() => setStatus({ message: '', type: '' }), 5000);
  }, [activeSection, defaultSettings, setSettings]);

  const handleSave = useCallback(async () => {
    if (!settings) return;
    setStatus({ message: '保存中...', type: '' });
    try {
      const result = await api.saveSettings(settings);
      if (!result.success) {
        setStatus({ message: '保存エラー: ' + result.error, type: 'error' });
        return;
      }
      // Apply avatar window visibility and always-on-top on save (fire-and-forget)
      const windows = settings.app?.windows;
      if (windows) {
        for (const type of ['user', 'ai'] as const) {
          const win = windows[type];
          if (win?.visible !== undefined) {
            api.setWindowVisible(type, win.visible).catch((e) => console.error('setWindowVisible failed:', e));
          }
          if (win?.alwaysOnTop !== undefined) {
            api.setWindowAlwaysOnTop(type, win.alwaysOnTop).catch((e) => console.error('setWindowAlwaysOnTop failed:', e));
          }
        }
      }
      if (statusTimerRef.current) clearTimeout(statusTimerRef.current);
      setStatus({ message: '設定を保存しました！', type: 'success' });
      // python-reload-done event (via useEffect) will update this if restart is needed
      statusTimerRef.current = setTimeout(() => setStatus({ message: '', type: '' }), 3000);
    } catch (e) {
      setStatus({ message: '保存エラー: ' + String(e), type: 'error' });
    }
  }, [settings]);

  const handleSelectDir = useCallback(
    async (key: 'user' | 'ai') => {
      if (!settings) return;
      const current = settings.avatars?.[key]?.assets_dir;
      const result = await api.selectDirectory(current);
      if (result) {
        updateNested('avatars', key, { ...(settings.avatars?.[key] || {}), assets_dir: result });
      }
    },
    [settings, updateNested]
  );

  if (!settings) return <div className="text-foreground p-5">ローディング中...</div>;

  const sectionProps = {
    settings,
    defaultSettings: defaultSettings || undefined,
    updateRoot,
    updateNested,
    updateProvider,
    updateTTSSettings,
    setStatus,
    handleSelectDir,
  };

  const renderSection = () => {
    switch (activeSection) {
      case 'character':
        return <CharacterSection {...sectionProps} />;
      case 'mic':
        return <MicInputSection {...sectionProps} />;
      case 'integration':
        return <IntegrationSection {...sectionProps} />;
      case 'advanced':
        return <AdvancedSection {...sectionProps} />;
      case 'developer':
        return <DeveloperSection {...sectionProps} />;
      default:
        return <CharacterSection {...sectionProps} />;
    }
  };

  return (
    <div className="flex flex-col h-screen w-full bg-background text-foreground overflow-hidden">
      {/* Main content with sidebar */}
      <div className="flex-1 overflow-hidden">
        <SidebarLayout
          sidebar={
            <SidebarNav
              items={NAV_ITEMS}
              activeId={activeSection}
              onSelect={setActiveSection}
            />
          }
        >
          {renderSection()}
        </SidebarLayout>
      </div>

      {/* Footer action bar */}
      <div className="flex items-center gap-3 px-6 py-3 border-t border-border bg-card shrink-0">
        <Button
          variant="ghost"
          size="sm"
          className="text-xs text-muted-foreground hover:text-foreground"
          onClick={handleRestoreDefaults}
        >
          このセクションをリセット
        </Button>
        <div className="flex-1" />
        {status.message && (
          <span
            className={
              status.type === 'success'
                ? 'text-sm text-green-400'
                : status.type === 'error'
                ? 'text-sm text-red-400'
                : 'text-sm text-muted-foreground'
            }
          >
            {status.message}
          </span>
        )}
        <Button variant="outline" onClick={() => api.closeWindow()}>
          閉じる
        </Button>
        <Button onClick={handleSave}>保存する</Button>
      </div>
    </div>
  );
};
