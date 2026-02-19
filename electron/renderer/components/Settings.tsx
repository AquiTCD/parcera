import React, { useState, useEffect } from 'react';
import type { ParceraSettings, EngineConfig } from '../shared/types';

export const Settings: React.FC = () => {
  const [settings, setSettings] = useState<ParceraSettings | null>(null);
  const [status, setStatus] = useState<{ message: string; type: 'success' | 'error' | '' }>({ message: '', type: '' });

  useEffect(() => {
    window.electronAPI.getSettings().then(setSettings);
  }, []);

  const handleSave = async () => {
    if (!settings) return;
    setStatus({ message: 'Saving...', type: '' });
    const result = await window.electronAPI.saveSettings(settings);
    if (result.success) {
      setStatus({ message: 'Settings saved successfully!', type: 'success' });
      setTimeout(() => setStatus({ message: '', type: '' }), 3000);
    } else {
      setStatus({ message: 'Error saving settings: ' + result.error, type: 'error' });
    }
  };

  const updateVAD = (key: keyof NonNullable<ParceraSettings['vad']>, value: number) => {
    setSettings(prev => prev ? ({ ...prev, vad: { ...prev.vad, [key]: value } }) : null);
  };

  const updateElectron = (key: keyof NonNullable<ParceraSettings['electron']>, value: any) => {
    setSettings(prev => prev ? ({ ...prev, electron: { ...prev.electron, [key]: value } }) : null);
  };

  const updateAvatar = (key: string, value: any) => {
    setSettings(prev => prev ? ({ ...prev, avatars: { ...prev.avatars, [key]: value } }) : null);
  };

  if (!settings) return <div style={{ color: 'white', padding: 20 }}>Loading settings...</div>;

  return (
    <div className="settings-container" style={{ padding: '20px', color: '#e0e0e0', fontFamily: 'system-ui, sans-serif', maxWidth: '800px', margin: '0 auto', background: '#1e1e1e', minHeight: '100vh', boxSizing: 'border-box' }}>
      <h1 style={{ borderBottom: '1px solid #333', paddingBottom: '10px' }}>Parcera Settings</h1>

      {/* VAD Settings */}
      <section style={{ marginBottom: '30px' }}>
        <h2 style={{ color: '#61dafb' }}>Voice Activity Detection (VAD)</h2>
        <div className="form-group" style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '5px' }}>Volume Threshold (dB)</label>
          <input
            type="number"
            value={settings.vad?.volume_db_threshold ?? -20}
            onChange={(e) => updateVAD('volume_db_threshold', Number(e.target.value))}
            style={{ padding: '8px', borderRadius: '4px', border: '1px solid #444', background: '#333', color: 'white', width: '100%' }}
          />
          <small style={{ color: '#888' }}>Lower is more sensitive. Adjust if AI can't hear you.</small>
        </div>
        <div className="form-group" style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '5px' }}>Max Duration (seconds)</label>
          <input
            type="number"
            value={settings.vad?.max_duration ?? 15.0}
            onChange={(e) => updateVAD('max_duration', Number(e.target.value))}
            style={{ padding: '8px', borderRadius: '4px', border: '1px solid #444', background: '#333', color: 'white', width: '100%' }}
          />
        </div>
      </section>

      {/* Electron Settings */}
      <section style={{ marginBottom: '30px' }}>
        <h2 style={{ color: '#61dafb' }}>System Configuration</h2>
        <div className="form-group" style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '5px' }}>WebSocket Port</label>
          <input
            type="number"
            value={settings.electron?.port ?? 8080}
            onChange={(e) => updateElectron('port', Number(e.target.value))}
            style={{ padding: '8px', borderRadius: '4px', border: '1px solid #444', background: '#333', color: 'white', width: '100%' }}
          />
        </div>
        <div className="form-group" style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '5px' }}>Audio Sample Rate (Hz)</label>
          <input
            type="number"
            value={settings.electron?.ai_audio_sample_rate ?? 16000}
            onChange={(e) => updateElectron('ai_audio_sample_rate', Number(e.target.value))}
            style={{ padding: '8px', borderRadius: '4px', border: '1px solid #444', background: '#333', color: 'white', width: '100%' }}
          />
        </div>
      </section>

      {/* Avatar Settings */}
      <section style={{ marginBottom: '30px' }}>
        <h2 style={{ color: '#61dafb' }}>Avatar Visuals</h2>
        <div className="form-group" style={{ marginBottom: '15px' }}>
          <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={settings.avatars?.show_debug ?? true}
              onChange={(e) => updateAvatar('show_debug', e.target.checked)}
              style={{ marginRight: '10px' }}
            />
            Show Debug Overlay
          </label>
        </div>
        <div className="form-group" style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '5px' }}>Breathe Scale</label>
          <input
            type="number"
            step="0.001"
            value={settings.avatars?.breathe_scale ?? 1.005}
            onChange={(e) => updateAvatar('breathe_scale', Number(e.target.value))}
            style={{ padding: '8px', borderRadius: '4px', border: '1px solid #444', background: '#333', color: 'white', width: '100%' }}
          />
        </div>
        <div className="form-group" style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '5px' }}>Breathe Duration (ms)</label>
          <input
            type="number"
            value={settings.avatars?.breathe_duration ?? 5000}
            onChange={(e) => updateAvatar('breathe_duration', Number(e.target.value))}
            style={{ padding: '8px', borderRadius: '4px', border: '1px solid #444', background: '#333', color: 'white', width: '100%' }}
          />
        </div>
      </section>

      {/* Action Bar */}
      <div style={{ position: 'sticky', bottom: 0, background: '#1e1e1e', padding: '20px 0', borderTop: '1px solid #333', display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '15px' }}>
        {status.message && (
          <span style={{ color: status.type === 'error' ? '#ff6b6b' : '#51cf66' }}>
            {status.message}
          </span>
        )}
        <button
          onClick={handleSave}
          style={{
            padding: '10px 20px',
            background: '#61dafb',
            color: '#000',
            border: 'none',
            borderRadius: '4px',
            fontWeight: 'bold',
            cursor: 'pointer',
            fontSize: '16px'
          }}
        >
          Save Changes
        </button>
      </div>
    </div>
  );
};
