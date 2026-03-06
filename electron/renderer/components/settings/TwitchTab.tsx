import React from 'react';
import { TabProps } from './types';
import { CheckboxSetting } from './controls/CheckboxSetting';
import { useTwitchAuth } from '../../hooks/useTwitchAuth';
import { InputSetting } from './controls/InputSetting';
import { PasswordSetting } from './controls/PasswordSetting';
import { SelectSetting } from './controls/SelectSetting';
import { SettingGroup } from './controls/SettingGroup';

export const TwitchTab: React.FC<TabProps> = ({
  settings,
  defaultSettings,
  updateNested,
  renderTabHeader,
  setStatus,
}) => {
  const { isAuthorized, handleStartAuth, handleClearAuth } = useTwitchAuth(setStatus);

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
            OAuthリダイレクトURIには <code>http://localhost:8677/auth/callback</code> を登録する必要があります。<br />
            <span style={{ color: '#ffcc00', fontSize: '12px' }}>※ EventSubを使用する場合、初回連携時または再連携時に追加の権限が要求されます。</span>
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

        <div style={{ marginTop: '20px', display: 'flex', alignItems: 'center', gap: '15px' }}>
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
        <h3 className="setting-card-title">配信イベント反応</h3>
        <p className="setting-group-description" style={{ marginBottom: '15px' }}>
          フォローやサブスクライブなどのイベントを検知してパルセラが反応するようにします。
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '10px' }}>
          <CheckboxSetting
            label="レイドに反応する"
            checked={twitchSettings.react_to_raid !== false}
            onChange={(checked) => updateNested('twitch', 'react_to_raid', checked)}
          />
          <CheckboxSetting
            label="フォローに反応する"
            checked={twitchSettings.react_to_follow !== false}
            onChange={(checked) => updateNested('twitch', 'react_to_follow', checked)}
          />
          <CheckboxSetting
            label="サブスクに反応する"
            checked={twitchSettings.react_to_subscribe !== false}
            onChange={(checked) => updateNested('twitch', 'react_to_subscribe', checked)}
          />
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
      </div>
    </section>
  );
};
