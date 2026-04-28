import { useState, useCallback, useEffect } from 'react';
import { api } from '../lib/electron-bridge';

export const useTwitchAuth = (setStatus: (status: { message: string; type: '' | 'success' | 'error' }) => void) => {
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [isChecking, setIsChecking] = useState(true);

  const checkAuthStatus = useCallback(async () => {
    try {
      const status = await api.twitchGetAuthStatus();
      setIsAuthorized(status);
    } catch (e) {
      console.error('Failed to check Twitch auth status:', e);
    } finally {
      setIsChecking(false);
    }
  }, []);

  useEffect(() => {
    checkAuthStatus();

    const removeListener = api.onTwitchAuthStatus((status: { success: boolean }) => {
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
      await api.twitchStartAuth();
      setStatus({ message: 'ブラウザでTwitch認可画面を開きました。', type: 'success' });
    } catch (e: any) {
      setStatus({ message: '認証エラー: ' + e.message, type: 'error' });
    }
  };

  const handleClearAuth = async () => {
    if (window.confirm('Twitchの認証情報を削除しますか？')) {
      await api.twitchClearAuth();
      setIsAuthorized(false);
      setStatus({ message: '認証情報を削除しました。', type: 'success' });
    }
  };

  return { isAuthorized, isChecking, handleStartAuth, handleClearAuth };
};
