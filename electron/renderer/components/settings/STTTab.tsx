import React from 'react';
import { TabProps, inputStyle } from './types';
import { SettingGroup } from './controls/SettingGroup';
import { CheckboxSetting } from './controls/CheckboxSetting';
import { InputSetting } from './controls/InputSetting';
import { PasswordSetting } from './controls/PasswordSetting';

export const STTTab: React.FC<TabProps> = ({ settings, updateNested, updateRoot, updateProvider, renderTabHeader }) => {
  const currentSTTProvider = settings.stt?.provider || 'faster_whisper';

  return (
    <section className="animate-fade-in">
      {renderTabHeader?.('音声認識（耳）')}

      <div style={{ background: '#2d2d30', padding: '15px', borderRadius: '8px', marginBottom: '20px' }}>
        <h3 style={{ marginTop: 0, fontSize: '16px' }}>VAD設定 (声の検出)</h3>

        <CheckboxSetting
          label="起動時にマイクをミュートにする"
          checked={settings.vad?.start_muted ?? false}
          onChange={(checked) => updateNested('vad', 'start_muted', checked)}
          style={{ marginBottom: '20px' }}
        />

        <SettingGroup
          label="音声検出の音量閾値 (dB)"
          description="環境音に合わせて調整（0に近いほど反応が鈍くなります）"
        >
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <input
              type="range"
              min="-60"
              max="0"
              step="1"
              value={settings.vad?.volume_db_threshold ?? -20}
              onChange={(e) => updateNested('vad', 'volume_db_threshold', Number(e.target.value))}
              style={{ flex: 1, marginRight: '15px' }}
            />
            <span style={{ width: '50px', textAlign: 'right' }}>{settings.vad?.volume_db_threshold ?? -20} dB</span>
          </div>
        </SettingGroup>

        <div style={{ display: 'flex', gap: '15px' }}>
          <div style={{ flex: 1 }}>
            <InputSetting
              label="発話終了判定の無音時間 (秒)"
              description="短くすると反応が早まりますが、文章が細切れになるリスクがあります。"
              type="number"
              step="0.1"
              placeholder="0.4"
              value={settings.vad?.silence_duration_threshold ?? 0.4}
              onChange={(val) => updateNested('vad', 'silence_duration_threshold', val)}
            />
          </div>
          <div style={{ flex: 1 }}>
            <InputSetting
              label="最大録音時間 (秒)"
              description="環境音などで録音が止まらなくなった際の強制終了時間"
              type="number"
              step="1.0"
              placeholder="15.0"
              value={settings.vad?.max_duration ?? 15.0}
              onChange={(val) => updateNested('vad', 'max_duration', val)}
            />
          </div>
        </div>
      </div>

      <div style={{ background: '#2d2d30', padding: '15px', borderRadius: '8px', marginBottom: '20px' }}>
        <h3 style={{ marginTop: 0, fontSize: '16px' }}>割り込み・応答感度設定</h3>

        <InputSetting
          label="強制応答キーワード"
          description="カンマ区切りで複数指定可能です。"
          type="text"
          placeholder="パルセラ"
          value={settings.force_keywords?.join(', ') ?? ''}
          onChange={(val) => updateRoot('force_keywords', typeof val === 'string' ? val.split(',').map(s => s.trim()).filter(s => s) : [])}
        />

        <InputSetting
          label="無視するフレーズ"
          description="カンマ区切りで複数指定可能です。"
          type="text"
          placeholder="うん, はい"
          value={settings.stt?.ignore_sentences?.join(', ') ?? ''}
          onChange={(val) => updateNested('stt', 'ignore_sentences', typeof val === 'string' ? val.split(',').map(s => s.trim()).filter(s => s) : [])}
        />

        <SettingGroup label="応答頻度">
          <select
            value={settings.response_sensitivity ?? 'medium'}
            onChange={(e) => updateRoot('response_sensitivity', e.target.value)}
            style={inputStyle}
          >
            <option value="high">高い - 頻繁に反応</option>
            <option value="medium">普通 - 通常の会話</option>
            <option value="low">低い - 短い発話にはあまり反応しない</option>
          </select>
        </SettingGroup>

        <InputSetting
          label="発話の結合待機時間 (秒)"
          description="文字化した後に続きを待つ時間。これと無音時間の合計が、AIが考え始めるまでの『間』になります。"
          type="number"
          step="0.1"
          placeholder="0.6"
          value={settings.merge_request_threshold ?? 0.6}
          onChange={(val) => updateRoot('merge_request_threshold', val)}
        />
      </div>

      <SettingGroup label="使用するSTTプロバイダ">
        <select
          value={currentSTTProvider}
          onChange={(e) => updateNested('stt', 'provider', e.target.value)}
          style={inputStyle}
        >
          <option value="faster_whisper">Faster Whisper (ローカル推奨)</option>
          <option value="google">Google Cloud STT</option>
          <option value="azure">Azure Speech to Text</option>
        </select>
      </SettingGroup>

      {currentSTTProvider === 'faster_whisper' && (
        <div style={{ background: '#2d2d30', padding: '15px', borderRadius: '8px' }}>
          <h3 style={{ marginTop: 0, fontSize: '16px' }}>Faster Whisper 設定</h3>
          <SettingGroup label="モデル (HuggingFace形式)">
            <input
              type="text"
              placeholder="longisland3/kotoba-whisper-v2.2-faster"
              value={(settings.stt?.providers?.faster_whisper as any)?.model ?? 'longisland3/kotoba-whisper-v2.2-faster'}
              onChange={(e) => updateProvider('stt', 'faster_whisper', 'model', e.target.value)}
              style={inputStyle}
            />
          </SettingGroup>
          <div style={{ display: 'flex', gap: '15px', marginBottom: '15px' }}>
            <div style={{ flex: 1 }}>
              <SettingGroup label="演算デバイス">
                <select
                  value={(settings.stt?.providers?.faster_whisper as any)?.device ?? 'auto'}
                  onChange={(e) => updateProvider('stt', 'faster_whisper', 'device', e.target.value)}
                  style={inputStyle}
                >
                  <option value="auto">Auto</option>
                  <option value="cpu">CPU</option>
                  <option value="cuda">CUDA (NVIDIA GPU)</option>
                  <option value="mps">MPS (Apple Silicon)</option>
                </select>
              </SettingGroup>
            </div>
            <div style={{ flex: 1 }}>
              <SettingGroup label="量子化">
                <select
                  value={(settings.stt?.providers?.faster_whisper as any)?.compute_type ?? 'default'}
                  onChange={(e) => updateProvider('stt', 'faster_whisper', 'compute_type', e.target.value)}
                  style={inputStyle}
                >
                  <option value="default">デフォルト</option>
                  <option value="int8">int8 (推奨 / 軽量)</option>
                  <option value="float16">float16 (高精度GPU用)</option>
                </select>
              </SettingGroup>
            </div>
          </div>
          <CheckboxSetting
            label="Whisper内蔵VADを使用"
            description="長文向けの設定（短文が無視されるリスクがあります）"
            checked={(settings.stt?.providers?.faster_whisper as any)?.whisper_vad_filter ?? false}
            onChange={(checked) => updateProvider('stt', 'faster_whisper', 'whisper_vad_filter', checked)}
          />
        </div>
      )}

      {currentSTTProvider === 'google' && (
        <div style={{ background: '#2d2d30', padding: '15px', borderRadius: '8px' }}>
          <h3 style={{ marginTop: 0, fontSize: '16px' }}>Google STT 設定</h3>
          <PasswordSetting
            label="APIキー"
            placeholder="Google Cloud API Key"
            value={(settings.stt?.providers?.google as any)?.api_key ?? ''}
            onChange={(val) => updateProvider('stt', 'google', 'api_key', val)}
          />
          <InputSetting
            label="言語"
            placeholder="ja-JP"
            value={(settings.stt?.providers?.google as any)?.language ?? 'ja-JP'}
            onChange={(val) => updateProvider('stt', 'google', 'language', val)}
          />
        </div>
      )}

      {currentSTTProvider === 'azure' && (
        <div style={{ background: '#2d2d30', padding: '15px', borderRadius: '8px' }}>
          <h3 style={{ marginTop: 0, fontSize: '16px' }}>Azure STT 設定</h3>
          <PasswordSetting
            label="APIキー"
            placeholder="Azure API Key"
            value={(settings.stt?.providers?.azure as any)?.api_key ?? ''}
            onChange={(val) => updateProvider('stt', 'azure', 'api_key', val)}
          />
          <InputSetting
            label="リージョン"
            placeholder="eastus"
            value={(settings.stt?.providers?.azure as any)?.region ?? ''}
            onChange={(val) => updateProvider('stt', 'azure', 'region', val)}
          />
          <InputSetting
            label="言語"
            placeholder="ja-JP"
            value={(settings.stt?.providers?.azure as any)?.language ?? 'ja-JP'}
            onChange={(val) => updateProvider('stt', 'azure', 'language', val)}
          />
        </div>
      )}
    </section>
  );
};
