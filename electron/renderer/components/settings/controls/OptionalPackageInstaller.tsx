import React, { useState, useEffect, useCallback } from 'react';

export type PackageStatus = 'checking' | 'not_installed' | 'installing' | 'installed' | 'error';

export function useOptionalPackageInstaller(provider: string, port: number) {
  const [status, setStatus] = useState<PackageStatus>('checking');
  const [progress, setProgress] = useState(0);
  const [errorMsg, setErrorMsg] = useState('');

  const checkInstalled = useCallback(async () => {
    setStatus('checking');
    try {
      const res = await fetch(`http://127.0.0.1:${port}/optional-packages/status`);
      if (!res.ok) throw new Error('Server not ready');
      const data = await res.json();
      setStatus(data[provider]?.installed ? 'installed' : 'not_installed');
    } catch {
      setTimeout(() => checkInstalled(), 2000);
    }
  }, [provider, port]);

  useEffect(() => { checkInstalled(); }, [checkInstalled]);

  const handleInstall = useCallback(async () => {
    setStatus('installing');
    setProgress(0);
    setErrorMsg('');
    try {
      const res = await fetch(
        `http://127.0.0.1:${port}/optional-packages/install?provider=${provider}`,
        { method: 'POST' }
      );
      if (!res.ok || !res.body) throw new Error('Install request failed');
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        for (const line of decoder.decode(value).split('\n')) {
          if (!line.startsWith('data: ')) continue;
          const event = JSON.parse(line.slice(6));
          if (event.status === 'complete') {
            setStatus('installed');
            setProgress(100);
          } else if (event.status === 'error') {
            setStatus('error');
            setErrorMsg(event.error || 'インストールに失敗しました');
          } else if (event.progress !== undefined && event.progress >= 0) {
            setProgress(event.progress);
          }
        }
      }
    } catch (err) {
      setStatus('error');
      setErrorMsg(String(err));
    }
  }, [provider, port]);

  return { status, progress, errorMsg, checkInstalled, handleInstall };
}

interface OptionalPackageInstallerUIProps {
  status: PackageStatus;
  progress: number;
  errorMsg: string;
  onInstall: () => void;
  sizeMb: number;
  description: string;
}

export const OptionalPackageInstallerUI: React.FC<OptionalPackageInstallerUIProps> = ({
  status,
  progress,
  errorMsg,
  onInstall,
  sizeMb,
  description,
}) => {
  const actionButtonStyle: React.CSSProperties = {
    padding: '8px 20px',
    background: '#0e639c',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '14px',
  };

  if (status === 'checking') {
    return (
      <div style={{ padding: '12px', background: '#1e1e1e', borderRadius: '6px', marginBottom: '15px', color: '#888' }}>
        ⏳ ライブラリの状態を確認中...
      </div>
    );
  }

  if (status === 'not_installed') {
    return (
      <div style={{ padding: '12px', background: '#1e1e1e', borderRadius: '6px', marginBottom: '15px' }}>
        <div style={{ color: '#e8a838', marginBottom: '10px' }}>
          ⚠️ ライブラリがインストールされていません
        </div>
        <div style={{ color: '#888', fontSize: '12px', marginBottom: '10px' }}>
          {description}（約{sizeMb}MB）
        </div>
        <button onClick={onInstall} style={actionButtonStyle}>
          ライブラリをインストール
        </button>
      </div>
    );
  }

  if (status === 'installing') {
    return (
      <div style={{ padding: '12px', background: '#1e1e1e', borderRadius: '6px', marginBottom: '15px' }}>
        <div style={{ color: '#4fc1ff', marginBottom: '8px' }}>
          📥 インストール中... {progress}%
        </div>
        <div style={{ width: '100%', height: '8px', background: '#333', borderRadius: '4px', overflow: 'hidden' }}>
          <div style={{
            width: `${progress}%`,
            height: '100%',
            background: 'linear-gradient(90deg, #0e639c, #4fc1ff)',
            borderRadius: '4px',
            transition: 'width 0.3s ease',
          }} />
        </div>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div style={{ padding: '12px', background: '#1e1e1e', borderRadius: '6px', marginBottom: '15px' }}>
        <div style={{ color: '#f44747', marginBottom: '10px' }}>❌ {errorMsg}</div>
        <button onClick={onInstall} style={actionButtonStyle}>リトライ</button>
      </div>
    );
  }

  return null; // 'installed' — parent renders the next step
};
