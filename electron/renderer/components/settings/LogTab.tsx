import React, { useEffect, useState, useRef } from 'react';
import { SidecarLogMessage } from '../../../shared/types';

export const LogTab: React.FC = () => {
  const [logs, setLogs] = useState<SidecarLogMessage[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    return window.electronAPI.onLogMessage((log) => {
      setLogs((prev) => [...prev.slice(-100), log]); // Keep last 100 logs to save memory
    });
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="tab-header-container">
        <div>
          <h2 className="tab-header-title">システムログ</h2>
          <p className="setting-group-description" style={{ marginBottom: 0 }}>Pythonエンジンの稼働状況をリアルタイムで表示します。</p>
        </div>
      </div>

      <div
        ref={scrollRef}
        className="log-viewer"
      >
        {logs.length === 0 && <div style={{ color: '#444' }}>ログを待機中...</div>}
        {logs.map((log, i) => {
          // Clean ANSI escape codes from Python logs
          const cleanText = log.text.replace(/\x1b\[[0-9;]*m/g, '');

          // Determine color based on content
          let contentColor = '#0f0'; // Default green
          if (log.source === 'stderr') contentColor = '#ff6b6b'; // Error
          if (cleanText.includes('[USER]')) contentColor = '#61dafb'; // User (Cyan)
          if (cleanText.includes('[AI]')) contentColor = '#f06292'; // AI (Pink)
          if (cleanText.includes('INFO:')) contentColor = '#e0e0e0'; // Standard Info (Greyish)

          return (
            <div key={i} style={{ marginBottom: '4px', whiteSpace: 'pre-wrap' }}>
              <span style={{ color: '#555', marginRight: '8px' }}>[{log.timestamp}]</span>
              <span style={{ color: contentColor }}>{cleanText}</span>
            </div>
          );
        })}
      </div>

      <div style={{ marginTop: '10px', display: 'flex', gap: '10px' }}>
        <button
          onClick={() => setLogs([])}
          className="btn btn-outline"
        >
          表示ログをクリア
        </button>
      </div>
    </div>
  );
};
