import React from 'react';
import { TabProps, inputStyle } from './types';
import { SettingGroup } from './controls/SettingGroup';
import { InputSetting } from './controls/InputSetting';

export const SystemTab: React.FC<TabProps> = ({ settings, updateRoot, updateNested, renderTabHeader }) => {
  return (
    <section className="animate-fade-in">
      {renderTabHeader?.('システム')}

      <div style={{ background: '#2d2d30', padding: '15px', borderRadius: '8px', marginBottom: '20px' }}>
        <h3 style={{ marginTop: 0, fontSize: '16px' }}>デバッグ・ログ設定</h3>

        <SettingGroup
          label="ログ出力レベル"
          description="WARNING 以上のレベルは INFO レベルの内容も含まれます。"
        >
          <select
            value={settings.log_level ?? 'INFO'}
            onChange={(e) => updateRoot('log_level', e.target.value)}
            style={inputStyle}
          >
            <option value="INFO">INFO (基本のみ: 正常・エラー)</option>
            <option value="WARNING">WARNING (標準: INFO + 警告)</option>
            <option value="DEBUG">DEBUG (開発用: すべて出力)</option>
          </select>
        </SettingGroup>

        <div className="form-group">
          <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={settings.profile_mode ?? false}
              onChange={(e) => updateRoot('profile_mode', e.target.checked)}
              style={{ marginRight: '10px' }}
            />
            パフォーマンス計測ログを表示 ([PERF])
          </label>
        </div>
      </div>

      <div style={{ background: '#2d2d30', padding: '15px', borderRadius: '8px' }}>
        <h3 style={{ marginTop: 0, fontSize: '16px' }}>通信・基本設定</h3>
        <div style={{ marginBottom: '20px' }}>
          <InputSetting
            label="WebSocket ポート番号"
            description="通信に使用するポート番号です。変更後はアプリの再起動が必要です。"
            type="number"
            placeholder="8676"
            value={settings.electron?.port ?? 8676}
            onChange={(val) => updateNested('electron', 'port', val)}
          />
        </div>

        <SettingGroup
          label="内部音声サンプリングレート (Hz)"
          description="TTS出力と合わせる必要があります。標準は16000Hzです。"
        >
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
        </SettingGroup>
      </div>
    </section>
  );
};
