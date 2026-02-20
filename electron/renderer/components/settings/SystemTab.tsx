import React from 'react';
import { TabProps, inputStyle } from './types';
import { SettingGroup } from './controls/SettingGroup';
import { InputSetting } from './controls/InputSetting';

export const SystemTab: React.FC<TabProps> = ({ settings, updateNested, renderTabHeader }) => {
  return (
    <section className="animate-fade-in">
      {renderTabHeader?.('システム通信設定')}

      <div className="form-group" style={{ marginBottom: '20px' }}>
        <InputSetting
          label="WebSocket ポート番号"
          type="number"
          placeholder="8080"
          value={settings.electron?.port ?? 8080}
          onChange={(val) => updateNested('electron', 'port', val)}
        />
        <small style={{ color: '#888' }}>バックエンドとフロントエンドを繋ぐポート。変更した場合は両方の再起動が必要です。</small>
      </div>

      <SettingGroup label="内部音声サンプリングレート (Hz)">
        <select
          value={settings.electron?.ai_audio_sample_rate ?? 16000}
          onChange={(e) => updateNested('electron', 'ai_audio_sample_rate', Number(e.target.value))}
          style={inputStyle}
        >
          <option value={16000}>16,000 Hz (TTS標準)</option>
          <option value={24000}>24,000 Hz</option>
          <option value={32000}>32,000 Hz</option>
          <option value={44100}>44,100 Hz (CD音質)</option>
          <option value={48000}>48,000 Hz (DVD音質)</option>
        </select>
        <small style={{ color: '#888' }}>TTS出力と合わせる必要があります。標準は16000Hzです。</small>
      </SettingGroup>
    </section>
  );
};
