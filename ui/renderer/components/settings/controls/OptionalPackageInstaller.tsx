import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '../../ui/button';

export type PackageStatus = 'checking' | 'not_installed' | 'installing' | 'installed' | 'error';

const MAX_STATUS_RETRIES = 10;

export function useOptionalPackageInstaller(provider: string, port: number) {
  const [status, setStatus] = useState<PackageStatus>('checking');
  const [progress, setProgress] = useState(0);
  const [errorMsg, setErrorMsg] = useState('');
  const isMounted = useRef(true);
  const retryCount = useRef(0);

  useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);

  const checkInstalled = useCallback(async () => {
    if (!isMounted.current) return;
    setStatus('checking');
    try {
      const res = await fetch(`http://127.0.0.1:${port}/optional-packages/status`);
      if (!res.ok) throw new Error('Server not ready');
      const data = await res.json();
      retryCount.current = 0;
      if (isMounted.current) {
        setStatus(data[provider]?.installed ? 'installed' : 'not_installed');
      }
    } catch {
      if (!isMounted.current) return;
      retryCount.current += 1;
      if (retryCount.current < MAX_STATUS_RETRIES) {
        setTimeout(() => checkInstalled(), 2000);
      } else {
        setStatus('error');
        setErrorMsg('サーバーに接続できません');
      }
    }
  }, [provider, port]);

  useEffect(() => { checkInstalled(); }, [checkInstalled]);

  const handleInstall = useCallback(async () => {
    if (!isMounted.current) return;
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
          if (!isMounted.current) return;
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
      if (!isMounted.current) return;
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
  if (status === 'checking') {
    return (
      <div className="rounded-md bg-muted p-3 mb-4 text-muted-foreground text-sm">
        ⏳ ライブラリの状態を確認中...
      </div>
    );
  }

  if (status === 'not_installed') {
    return (
      <div className="rounded-md bg-muted p-3 mb-4 space-y-2">
        <div className="text-yellow-500 text-sm font-medium">
          ⚠️ ライブラリがインストールされていません
        </div>
        <div className="text-muted-foreground text-xs">
          {description}（約{sizeMb}MB）
        </div>
        <Button variant="outline" size="sm" onClick={onInstall}>
          ライブラリをインストール
        </Button>
      </div>
    );
  }

  if (status === 'installing') {
    return (
      <div className="rounded-md bg-muted p-3 mb-4 space-y-2">
        <div className="text-blue-400 text-sm">
          📥 インストール中... {progress}%
        </div>
        <div className="w-full h-2 bg-secondary rounded-full overflow-hidden">
          <div
            className="h-full bg-blue-500 rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="rounded-md bg-muted p-3 mb-4 space-y-2">
        <div className="text-destructive text-sm">❌ {errorMsg}</div>
        <Button variant="outline" size="sm" onClick={onInstall}>リトライ</Button>
      </div>
    );
  }

  return null; // 'installed' — parent renders the next step
};
