import React from 'react';
import type { ParceraSettings, TwitchSettings } from '../../../../shared/types';
import { CheckboxSetting } from '../controls/CheckboxSetting';

interface Props {
  twitchSettings: TwitchSettings;
  updateNested: (category: keyof ParceraSettings, key: string, value: unknown) => void;
  isAuthorized: boolean;
  sessionId: string | null;
  settings: ParceraSettings;
}

export const TwitchEventsCard: React.FC<Props> = ({
  twitchSettings,
  updateNested,
  isAuthorized,
  sessionId,
  settings,
}) => {
  const handleTestEvent = async (type: string) => {
    try {
      await fetch(`http://localhost:${settings.electron?.port || 8676}/twitch/test-event?event_type=${type}`, { method: 'POST' });
    } catch (e) {
      console.error('Failed to trigger test event:', e);
    }
  };

  return (
    <div className="setting-card">
      <div className="flex items-center justify-between mb-4">
        <h3 className="setting-card-title !mb-0">配信イベント反応</h3>
        {isAuthorized && (
          <div style={{ display: 'flex', gap: '8px' }}>
            {!sessionId ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 12px', background: 'rgba(250, 204, 21, 0.05)', borderRadius: '6px', border: '1px solid rgba(250, 204, 21, 0.1)' }}>
                <span className="animate-pulse" style={{ width: 8, height: 8, borderRadius: '50%', background: '#facc15' }}></span>
                <span style={{ color: '#facc15', fontWeight: 'bold', fontSize: '13px' }}>接続待ち</span>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 12px', background: 'rgba(52, 211, 153, 0.1)', borderRadius: '6px', border: '1px solid rgba(52, 211, 153, 0.2)' }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#34d399', boxShadow: '0 0 8px #10b981' }}></span>
                <span style={{ color: '#34d399', fontWeight: 'bold', fontSize: '13px' }}>EventSub 接続済み</span>
              </div>
            )}
          </div>
        )}
      </div>
      <p className="setting-group-description" style={{ marginBottom: '15px' }}>
        フォローやサブスクライブなどのイベントを検知してパルセラが反応するようにします。
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '20px' }}>
        <div className="space-y-2">
          <CheckboxSetting
            label="レイドに反応する"
            checked={twitchSettings.react_to_raid !== false}
            onChange={(checked) => updateNested('twitch', 'react_to_raid', checked)}
          />
          {sessionId && (
            <button
              onClick={() => handleTestEvent('raid')}
              className="btn btn-outline ml-8 !py-1 !px-2 !text-[10px] !min-h-0"
            >
              反応テスト
            </button>
          )}
        </div>

        <div className="space-y-2">
          <CheckboxSetting
            label="フォローに反応する"
            checked={twitchSettings.react_to_follow !== false}
            onChange={(checked) => updateNested('twitch', 'react_to_follow', checked)}
          />
          {sessionId && (
            <button
              onClick={() => handleTestEvent('follow')}
              className="btn btn-outline ml-8 !py-1 !px-2 !text-[10px] !min-h-0"
            >
              反応テスト
            </button>
          )}
        </div>

        <div className="space-y-2">
          <CheckboxSetting
            label="サブスクに反応する"
            checked={twitchSettings.react_to_subscribe !== false}
            onChange={(checked) => updateNested('twitch', 'react_to_subscribe', checked)}
          />
          {sessionId && (
            <button
              onClick={() => handleTestEvent('subscribe')}
              className="btn btn-outline ml-8 !py-1 !px-2 !text-[10px] !min-h-0"
            >
              反応テスト
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
