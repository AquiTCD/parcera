import React, { useState, useEffect } from 'react';
import { TabProps } from './types';
import { CheckboxSetting } from './controls/CheckboxSetting';
import { useTwitchAuth } from '../../hooks/useTwitchAuth';
import { TwitchAuthCard } from './twitch/TwitchAuthCard';
import { TwitchEventsCard } from './twitch/TwitchEventsCard';
import { TwitchResponseLogicCard } from './twitch/TwitchResponseLogicCard';

export const TwitchTab: React.FC<TabProps> = ({
  settings,
  defaultSettings,
  updateNested,
  renderTabHeader,
  setStatus,
}) => {
  const { isAuthorized, handleStartAuth, handleClearAuth } = useTwitchAuth(setStatus);
  const [sessionId, setSessionId] = useState<string | null>(null);

  useEffect(() => {
    if (isAuthorized && !sessionId) {
      const fetchStatus = async () => {
        try {
          const status = await window.electronAPI.getTwitchStatus();
          if (status.session_id) {
            setSessionId(status.session_id);
          }
        } catch (e) {
          console.error('Failed to fetch Twitch status:', e);
        }
      };

      fetchStatus();
      const interval = setInterval(() => {
        if (sessionId) {
          clearInterval(interval);
        } else {
          fetchStatus();
        }
      }, 10000);
      return () => clearInterval(interval);
    }
  }, [isAuthorized, !!sessionId]);

  const twitchSettings = settings.twitch || {};

  return (
    <section className="tab-content-section">
      {renderTabHeader?.('Twitch連携')}

      <div className="setting-card">
        <h3 className="setting-card-title">基本設定</h3>
        <CheckboxSetting
          label="Twitch連携を有効にする"
          description="Twitchチャットへの自動応答や配信イベントへの反応を有効にします。"
          checked={twitchSettings.enabled}
          onChange={(checked) => updateNested('twitch', 'enabled', checked)}
        />
      </div>

      <TwitchAuthCard
        twitchSettings={twitchSettings}
        updateNested={updateNested}
        isAuthorized={isAuthorized}
        handleStartAuth={handleStartAuth}
        handleClearAuth={handleClearAuth}
      />

      <TwitchEventsCard
        twitchSettings={twitchSettings}
        updateNested={updateNested}
        isAuthorized={isAuthorized}
        sessionId={sessionId}
        settings={settings}
      />

      <TwitchResponseLogicCard
        twitchSettings={twitchSettings}
        defaultSettings={defaultSettings}
        updateNested={updateNested}
      />
    </section>
  );
};
