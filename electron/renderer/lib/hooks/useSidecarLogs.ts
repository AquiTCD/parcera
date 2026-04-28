import { useState, useEffect, useCallback } from 'react';
import { api } from '../electron-bridge';
import type { LogEntry } from '../bridge';

export function useSidecarLogs() {
  const [logs, setLogs] = useState<LogEntry[]>([]);

  useEffect(() => {
    api.getLogHistory().then(setLogs);
    const unsub = api.onLogMessage((log) => {
      setLogs((prev) => [...prev, log]);
    });
    return unsub;
  }, []);

  const clearLogs = useCallback(() => setLogs([]), []);

  return { logs, clearLogs };
}
