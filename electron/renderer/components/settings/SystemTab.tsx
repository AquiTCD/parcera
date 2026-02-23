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
          description="標準的なログレベル設定です。下に行くほど詳細になります。"
          value={settings.log_level ?? defaultSettings?.log_level ?? 'INFO'}
          onChange={(val) => updateRoot('log_level', val)}
          options={[
            { value: 'INFO', label: 'INFO (標準: 正常動作・エラー)' },
            { value: 'WARNING', label: 'WARNING (少なめ: 警告・エラーのみ)' },
            { value: 'ERROR', label: 'ERROR (最小: エラー発生時のみ)' },
            { value: 'DEBUG', label: 'DEBUG (開発用: すべてのデバッグ出力)' }
          ]}
        />

        <CheckboxSetting
          label="シンプルログモード (会話のみ表示)"
          description="システムログを非表示にし、ターミナルには会話ログのみを表示します。"
          defaultValue={defaultSettings?.simple_log}
          checked={settings.simple_log}
          onChange={(checked) => updateRoot('simple_log', checked)}
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

        <div style={{ marginTop: '20px', borderTop: '1px solid #333', paddingTop: '20px' }}>
          <CheckboxSetting
            label="GPUアクセラレーションを有効にする"
            description="通常はON。OBSのウィンドウキャプチャでアニメーションが止まる場合はOFFにして再起動してください。"
            checked={settings.electron?.gpu_acceleration ?? true}
            onChange={(checked) => updateNested('electron', 'gpu_acceleration', checked)}
          />
        </div>
      </div>
    </section>
  );
};
