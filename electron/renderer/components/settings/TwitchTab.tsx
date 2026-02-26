import React, { useState, useEffect, useCallback } from 'react';
import { TabProps } from './types';

export const TwitchTab: React.FC<TabProps> = ({
  settings,
  updateNested,
  renderTabHeader,
  setStatus,
}) => {
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [isChecking, setIsChecking] = useState(true);

  const checkAuthStatus = useCallback(async () => {
    try {
      const status = await window.electronAPI.twitchGetAuthStatus();
      setIsAuthorized(status);
    } catch (e) {
      console.error('Failed to check Twitch auth status:', e);
    } finally {
      setIsChecking(false);
    }
  }, []);

  useEffect(() => {
    checkAuthStatus();

    // Listen for auth success
    const removeListener = window.electronAPI.onTwitchAuthStatus((status: { success: boolean }) => {
      if (status.success) {
        setIsAuthorized(true);
        setStatus({ message: 'Twitch認証に成功しました！', type: 'success' });
        setTimeout(() => setStatus({ message: '', type: '' }), 3000);
      }
    });

    return removeListener;
  }, [checkAuthStatus, setStatus]);

  const handleStartAuth = async () => {
    try {
      await window.electronAPI.twitchStartAuth();
      setStatus({ message: 'ブラウザでTwitch認可画面を開きました。', type: 'success' });
    } catch (e: any) {
      setStatus({ message: '認証エラー: ' + e.message, type: 'error' });
    }
  };

  const handleClearAuth = async () => {
    if (window.confirm('Twitchの認証情報を削除しますか？')) {
      await window.electronAPI.twitchClearAuth();
      setIsAuthorized(false);
      setStatus({ message: '認証情報を削除しました。', type: 'success' });
    }
  };

  const twitchSettings = settings.twitch || {};

  return (
    <div className="tab-container anim-fade-in">
      {renderTabHeader?.('Twitch連携')}

      <div className="setting-group">
        <div className="setting-item-row">
          <div className="setting-label-col">
            <label htmlFor="twitch-enabled" className="setting-label">連携を有効にする</label>
            <p className="setting-description">Twitchチャットへの自動応答や配信イベントへの反応を有効にします。</p>
          </div>
          <div className="setting-input-col">
            <label className="switch">
              <input
                id="twitch-enabled"
                type="checkbox"
                checked={twitchSettings.enabled || false}
                onChange={(e) => updateNested('twitch', 'enabled', e.target.checked)}
              />
              <span className="slider"></span>
            </label>
          </div>
        </div>
      </div>

      <div className="setting-group">
        <h3 className="setting-group-title">認証設定</h3>
        <p className="setting-group-description">
          <a href="https://dev.twitch.tv/console" target="_blank" rel="noreferrer" style={{ color: '#9146FF', textDecoration: 'none' }}>
            Twitch Developer Console ↗
          </a> で作成したアプリケーションの情報を入力してください。<br />
          OAuthリダイレクトURIには <code>http://localhost:8677/auth/callback</code> を登録する必要があります。
        </p>

        <div className="setting-item">
          <label htmlFor="twitch-client-id" className="setting-label">Client ID</label>
          <input
            id="twitch-client-id"
            type="text"
            className="input-field"
            value={twitchSettings.client_id || ''}
            onChange={(e) => updateNested('twitch', 'client_id', e.target.value)}
            placeholder="Twitch App Client ID"
          />
        </div>

        <div className="setting-item">
          <label htmlFor="twitch-client-secret" className="setting-label">Client Secret</label>
          <input
            id="twitch-client-secret"
            type="password"
            className="input-field"
            value={twitchSettings.client_secret || ''}
            onChange={(e) => updateNested('twitch', 'client_secret', e.target.value)}
            placeholder="Twitch App Client Secret"
          />
        </div>

        <div className="setting-item" style={{ marginTop: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            {isAuthorized ? (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 12px', background: 'rgba(74, 222, 128, 0.1)', borderRadius: '6px', border: '1px solid rgba(74, 222, 128, 0.2)' }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#4ade80', boxShadow: '0 0 8px #4ade80' }}></span>
                  <span style={{ color: '#4ade80', fontWeight: 'bold', fontSize: '14px' }}>認証済み</span>
                </div>
                <button className="btn btn-outline" onClick={handleClearAuth}>連携を解除</button>
              </>
            ) : (
              <button
                className="btn btn-primary"
                style={{ background: '#9146FF', border: 'none' }}
                onClick={handleStartAuth}
                disabled={!twitchSettings.client_id || !twitchSettings.client_secret}
              >
                Twitchと連携を開始
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="setting-group">
        <h3 className="setting-group-title">応答ロジック</h3>

        <div className="setting-item">
          <label htmlFor="twitch-wake-word" className="setting-label">Wake Word (正規表現)</label>
          <p className="setting-description">チャットのどこかにこの正規表現にマッチする単語が含まれる場合のみ反応します。</p>
          <input
            id="twitch-wake-word"
            type="text"
            className="input-field"
            value={twitchSettings.wake_word || ''}
            onChange={(e) => updateNested('twitch', 'wake_word', e.target.value)}
            placeholder="パルセラ|Parcera"
          />
        </div>

        <div className="setting-item">
          <label htmlFor="twitch-ignored-users" className="setting-label">無視するユーザー</label>
          <p className="setting-description">カンマ区切りで入力（例: Nightbot, Moobot）</p>
          <input
            id="twitch-ignored-users"
            type="text"
            className="input-field"
            value={(twitchSettings.ignored_users || []).join(', ')}
            onChange={(e) => updateNested('twitch', 'ignored_users', e.target.value.split(',').map(s => s.trim()))}
          />
        </div>
      </div>
    </div>
  );
};
