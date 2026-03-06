import React from 'react';
import { TabProps } from './types';
import { CheckboxSetting } from './controls/CheckboxSetting';
import { useTwitchAuth } from '../../hooks/useTwitchAuth';
import { InputSetting } from './controls/InputSetting';
import { PasswordSetting } from './controls/PasswordSetting';
import { SelectSetting } from './controls/SelectSetting';
import { SettingGroup } from './controls/SettingGroup';
import { useState, useEffect } from 'react';

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
          const status = await (window.electronAPI as any).getTwitchStatus();
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

  const handleTestEvent = async (type: string) => {
    try {
      await fetch(`http://localhost:${settings.electron?.port || 8676}/twitch/test-event?event_type=${type}`, { method: 'POST' });
    } catch (e) {
      console.error('Failed to trigger test event:', e);
    }
  };

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

      <div className="setting-card">
        <h3 className="setting-card-title">認証設定</h3>
        <div style={{ marginBottom: '16px' }}>
          <p className="setting-group-description">
            <a href="https://dev.twitch.tv/console" target="_blank" rel="noreferrer" style={{ color: '#61dafb', textDecoration: 'underline' }}>
              Twitch Developer Console ↗
            </a> で作成したアプリケーションの情報を入力してください。<br />
            OAuthリダイレクトURIには <code>http://localhost:8677/auth/callback</code> を登録する必要があります。
          </p>
        </div>

        <InputSetting
          label="Client ID"
          value={twitchSettings.client_id || ''}
          onChange={(val: string | number) => updateNested('twitch', 'client_id', val)}
          placeholder="Twitch App Client ID"
        />

        <PasswordSetting
          label="Client Secret"
          value={twitchSettings.client_secret || ''}
          onChange={(val: string | number) => updateNested('twitch', 'client_secret', val)}
          placeholder="Twitch App Client Secret"
        />

        <div style={{ marginTop: '20px', display: 'flex', alignItems: 'center', gap: '15px', flexWrap: 'wrap' }}>
          {isAuthorized ? (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 12px', background: 'rgba(74, 222, 128, 0.1)', borderRadius: '6px', border: '1px solid rgba(74, 222, 128, 0.2)' }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#4ade80', boxShadow: '0 0 8px #40c070' }}></span>
                <span style={{ color: '#4ade80', fontWeight: 'bold', fontSize: '13px' }}>認証済み</span>
              </div>
              <button className="btn btn-outline" onClick={handleClearAuth}>連携を解除</button>
            </>
          ) : (
            <button
              className="btn btn-primary"
              onClick={handleStartAuth}
              disabled={!twitchSettings.client_id || !twitchSettings.client_secret}
            >
              Twitchと連携を開始
            </button>
          )}
        </div>
      </div>

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

      <div className="setting-card">
        <h3 className="setting-card-title">応答ロジック</h3>

        <SelectSetting
          label="反応までの待ち時間"
          description="チャットが届いてからパルセラが反応するまでの時間を調整します。棒読みちゃんの読み上げ待ちなどを考慮できます。"
          value={twitchSettings.response_speed || 'natural'}
          options={[
            { label: 'なし', value: 'instant' },
            { label: '短め', value: 'fast' },
            { label: '標準', value: 'natural' },
            { label: '長め', value: 'slow' },
          ]}
          onChange={(val: string | number) => updateNested('twitch', 'response_speed', val)}
        />

        <InputSetting
          label="Wake Word (正規表現)"
          description="チャットのどこかにこの正規表現にマッチする単語が含まれる場合のみ反応します。"
          value={twitchSettings.wake_word || ''}
          defaultValue={defaultSettings?.twitch?.wake_word}
          onChange={(val: string | number) => updateNested('twitch', 'wake_word', val)}
        />

        <InputSetting
          label="無視するユーザー"
          description="カンマ区切りで入力（例: Nightbot, Moobot）"
          value={(twitchSettings.ignored_users || []).join(', ')}
          defaultValue={defaultSettings?.twitch?.ignored_users?.join(', ')}
          onChange={(val: string | number) => updateNested('twitch', 'ignored_users', String(val).split(',').map((s: string) => s.trim()).filter((s: string) => s))}
        />

        <InputSetting
          label="NGワード (正規表現)"
          description="これらの単語が含まれるチャットを無視します。カンマ区切りで入力。"
          value={(twitchSettings.ng_words || []).join(', ')}
          defaultValue={defaultSettings?.twitch?.ng_words?.join(', ')}
          onChange={(val: string | number) => updateNested('twitch', 'ng_words', String(val).split(',').map((s: string) => s.trim()).filter((s: string) => s))}
        />

        <div style={{ marginTop: '20px', paddingTop: '15px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
          <h4 style={{ fontSize: '14px', marginBottom: '15px', color: '#94a3b8' }}>詳細な配信制御</h4>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
            <InputSetting
              label="同一ユーザーのクールダウン (秒)"
              description="連投への反応を抑制します。"
              value={twitchSettings.user_cooldown ?? 60}
              onChange={(val: string | number) => updateNested('twitch', 'user_cooldown', Number(val))}
            />
            <InputSetting
              label="全体のクールダウン (秒)"
              description="パルセラの反応間隔を制御します。"
              value={twitchSettings.global_cooldown ?? 10}
              onChange={(val: string | number) => updateNested('twitch', 'global_cooldown', Number(val))}
            />
            <InputSetting
              label="キューの最大数"
              description="溜め込むチャットの最大数です。"
              value={twitchSettings.max_queue_size ?? 3}
              onChange={(val: string | number) => updateNested('twitch', 'max_queue_size', Number(val))}
            />
            <InputSetting
              label="メッセージの有効期限 (秒)"
              description="これ以上古いチャットは無視します。"
              value={twitchSettings.queue_expiry_seconds ?? 120}
              onChange={(val: string | number) => updateNested('twitch', 'queue_expiry_seconds', Number(val))}
            />
          </div>
        </div>
      </div>
    </section>
  );
};
