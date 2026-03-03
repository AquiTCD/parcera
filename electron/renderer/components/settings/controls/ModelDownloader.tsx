import React, { useState, useEffect, useCallback } from 'react';

export type ModelStatus = 'checking' | 'not_cached' | 'downloading' | 'ready' | 'error';

export function useModelDownloader(modelName: string, port: number) {
  const [modelStatus, setModelStatus] = useState<ModelStatus>('checking');
  const [progress, setProgress] = useState(0);
  const [progressDetail, setProgressDetail] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const checkCache = useCallback(async () => {
    setModelStatus('checking');
    try {
      const healthRes = await fetch(`http://127.0.0.1:${port}/health`);
      if (!healthRes.ok) throw new Error('Server not ready');

      const cached = await (window as any).electronAPI.checkModelCached(modelName, port);
      setModelStatus(cached ? 'ready' : 'not_cached');
    } catch (err) {
      console.log('Model Check: Server not ready, retrying...', err);
      setTimeout(() => checkCache(), 2000);
    }
  }, [modelName, port]);

  useEffect(() => {
    checkCache();
  }, [checkCache]);

  const handleDownload = useCallback(() => {
    setModelStatus('downloading');
    setProgress(0);
    setProgressDetail('');
    setErrorMsg('');

    (window as any).electronAPI.downloadModel(
      modelName,
      async (data: any) => {
        if (data.status === 'complete') {
          await (window as any).electronAPI.reloadModel(port);
          setModelStatus('ready');
          setProgress(100);
        } else if (data.status === 'error') {
          setModelStatus('error');
          setErrorMsg(data.error || 'ダウンロードに失敗しました');
        } else if (data.progress >= 0) {
          setProgress(data.progress);
          if (data.downloaded_mb && data.total_mb) {
            setProgressDetail(`${data.file || 'model'}: ${data.downloaded_mb}MB / ${data.total_mb}MB`);
          }
        }
      },
      port
    );
  }, [modelName, port]);

  return {
    modelStatus,
    progress,
    progressDetail,
    errorMsg,
    checkCache,
    handleDownload
  };
}

interface ModelDownloaderUIProps {
  status: ModelStatus;
  progress: number;
  progressDetail: string;
  errorMsg: string;
  onDownload: () => void;
  notCachedDescription: string;
}

export const ModelDownloaderUI: React.FC<ModelDownloaderUIProps> = ({
  status,
  progress,
  progressDetail,
  errorMsg,
  onDownload,
  notCachedDescription
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
        ⏳ モデルの状態を確認中...
      </div>
    );
  }

  if (status === 'not_cached') {
    return (
      <div style={{ padding: '12px', background: '#1e1e1e', borderRadius: '6px', marginBottom: '15px' }}>
        <div style={{ color: '#e8a838', marginBottom: '10px' }}>
          ⚠️ モデルがダウンロードされていません
        </div>
        <div style={{ color: '#888', fontSize: '12px', marginBottom: '10px' }}>
          {notCachedDescription}
        </div>
        <button onClick={onDownload} style={actionButtonStyle}>
          ダウンロード開始
        </button>
      </div>
    );
  }

  if (status === 'downloading') {
    return (
      <div style={{ padding: '12px', background: '#1e1e1e', borderRadius: '6px', marginBottom: '15px' }}>
        <div style={{ color: '#4fc1ff', marginBottom: '8px' }}>
          📥 ダウンロード中... {progress}%
        </div>
        <div style={{ width: '100%', height: '8px', background: '#333', borderRadius: '4px', overflow: 'hidden', marginBottom: '6px' }}>
          <div style={{
            width: `${progress}%`,
            height: '100%',
            background: 'linear-gradient(90deg, #0e639c, #4fc1ff)',
            borderRadius: '4px',
            transition: 'width 0.3s ease'
          }} />
        </div>
        {progressDetail && <div style={{ color: '#888', fontSize: '12px' }}>{progressDetail}</div>}
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div style={{ padding: '12px', background: '#1e1e1e', borderRadius: '6px', marginBottom: '15px' }}>
        <div style={{ color: '#f44747', marginBottom: '10px' }}>❌ {errorMsg}</div>
        <button onClick={onDownload} style={actionButtonStyle}>リトライ</button>
      </div>
    );
  }

  return null; // When 'ready', UI renders nothing, parent handles showing settings
};
