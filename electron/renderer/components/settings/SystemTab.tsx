import React from 'react';
import { TabProps } from './types';
import { InputSetting } from './controls/InputSetting';
import { CheckboxSetting } from './controls/CheckboxSetting';
import { SelectSetting } from './controls/SelectSetting';

export const SystemTab: React.FC<TabProps> = ({ settings, defaultSettings, updateRoot, updateNested, renderTabHeader }) => {
  return (
    <section className="animate-fade-in">
      {renderTabHeader?.('システム')}

      <div style={{ background: '#2d2d30', padding: '15px', borderRadius: '8px', marginBottom: '20px' }}>
        <h3 style={{ marginTop: 0, fontSize: '16px' }}>デバッグ・ログ設定</h3>

        <SelectSetting
          label="ログ出力レベル"
          description="WARNING 以上のレベルは INFO レベルの内容も含まれます。"
          value={settings.log_level ?? defaultSettings?.log_level ?? 'INFO'}
          onChange={(val) => updateRoot('log_level', val)}
          options={[
            { value: 'INFO', label: 'INFO (基本のみ: 正常・エラー)' },
            { value: 'WARNING', label: 'WARNING (標準: INFO + 警告)' },
            { value: 'DEBUG', label: 'DEBUG (開発用: すべて出力)' }
          ]}
        />

        <CheckboxSetting
          label="パフォーマンス計測ログを表示 ([PERF])"
          defaultValue={defaultSettings?.profile_mode}
          checked={settings.profile_mode}
          onChange={(checked) => updateRoot('profile_mode', checked)}
        />
      </div>

      <div style={{ background: '#2d2d30', padding: '15px', borderRadius: '8px' }}>
        <h3 style={{ marginTop: 0, fontSize: '16px' }}>通信・基本設定</h3>
        <div style={{ marginBottom: '20px' }}>
          <InputSetting
            label="WebSocket ポート番号"
            description="通信に使用するポート番号です。変更後はアプリの再起動が必要です。"
            type="number"
            defaultValue={defaultSettings?.electron?.port}
            value={settings.electron?.port}
            onChange={(val) => updateNested('electron', 'port', val)}
          />
        </div>

        <SelectSetting
          label="内部音声サンプリングレート (Hz)"
          description="TTS出力と合わせる必要があります。標準は16000Hzです。"
          value={settings.electron?.ai_audio_sample_rate ?? defaultSettings?.electron?.ai_audio_sample_rate ?? 16000}
          onChange={(val) => updateNested('electron', 'ai_audio_sample_rate', Number(val))}
          options={[
            { value: 16000, label: '16,000 Hz (TTS標準)' },
            { value: 24000, label: '24,000 Hz' },
            { value: 32000, label: '32,000 Hz' },
            { value: 44100, label: '44,100 Hz (CD音質)' },
            { value: 48000, label: '48,000 Hz (DVD音質)' }
          ]}
        />
      </div>
    </section>
  );
};
