import React from 'react';
import type { ParceraSettings, TwitchSettings } from '../../../../shared/types';
import { InputSetting } from '../controls/InputSetting';
import { PasswordSetting } from '../controls/PasswordSetting';

interface Props {
  twitchSettings: TwitchSettings;
  updateNested: (category: keyof ParceraSettings, key: string, value: unknown) => void;
  isAuthorized: boolean;
  handleStartAuth: () => void;
  handleClearAuth: () => void;
}

export const TwitchAuthCard: React.FC<Props> = ({
  twitchSettings,
  updateNested,
  isAuthorized,
  handleStartAuth,
  handleClearAuth,
}) => {
  return (
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
  );
};
