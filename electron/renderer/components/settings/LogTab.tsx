import React, { useEffect, useState, useRef } from 'react';
import { SidecarLogMessage } from '../../../shared/types';

export const LogTab: React.FC = () => {
  const [logs, setLogs] = useState<SidecarLogMessage[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Fetch initial log history
    window.electronAPI.getLogHistory().then((history) => {
      setLogs(history.slice(-100));
    });

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
          let contentColor = '#ccc'; // Default neutral grey
          if (log.source === 'stderr') contentColor = '#ff6b6b'; // Error

          if (cleanText.includes('(ignored)')) {
            contentColor = '#888'; // Grey for ignored (Matches Python white/skipped)
          } else if (cleanText.includes('[USER]')) {
            contentColor = '#22d3ee'; // Bold Cyan (Matches Python \033[1;36m)
          } else if (cleanText.includes('[AI]')) {
            contentColor = '#4ade80'; // Bold Green (Matches Python \033[1;32m)
          } else if (cleanText.includes('[Main]')) {
            contentColor = '#888'; // Main process (Medium grey)
          } else if (cleanText.includes('INFO:')) {
            contentColor = '#bbb'; // Standard Info (Light grey)
          }

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
