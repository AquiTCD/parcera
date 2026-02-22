import React from 'react';
import { TabProps, inputStyle } from './types';
import { SettingGroup } from './controls/SettingGroup';
import { CheckboxSetting } from './controls/CheckboxSetting';
import { InputSetting } from './controls/InputSetting';
import { PasswordSetting } from './controls/PasswordSetting';

export const STTTab: React.FC<TabProps> = ({ settings, defaultSettings, updateNested, updateRoot, updateProvider, renderTabHeader }) => {
  const currentSTTProvider = settings.stt?.provider || 'faster_whisper';

  return (
    <section className="animate-fade-in">
      {renderTabHeader?.('音声認識（耳）')}

      <div style={{ background: '#2d2d30', padding: '15px', borderRadius: '8px', marginBottom: '20px' }}>
        <h3 style={{ marginTop: 0, fontSize: '16px' }}>VAD設定 (声の検出)</h3>

        <CheckboxSetting
          label="起動時にマイクをミュートにする"
          defaultValue={defaultSettings?.vad?.start_muted}
          checked={settings.vad?.start_muted}
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
              value={settings.vad?.volume_db_threshold ?? defaultSettings?.vad?.volume_db_threshold ?? -20}
              onChange={(e) => updateNested('vad', 'volume_db_threshold', Number(e.target.value))}
              style={{ flex: 1, marginRight: '15px' }}
            />
            <span style={{ width: '50px', textAlign: 'right' }}>{settings.vad?.volume_db_threshold ?? defaultSettings?.vad?.volume_db_threshold ?? -20} dB</span>
          </div>
        </SettingGroup>

        <div style={{ display: 'flex', gap: '15px' }}>
          <div style={{ flex: 1 }}>
            <InputSetting
              label="発話終了判定の無音時間 (秒)"
              description="短くすると反応が早まりますが、文章が細切れになるリスクがあります。"
              type="number"
              step="0.1"
              defaultValue={defaultSettings?.vad?.silence_duration_threshold}
              value={settings.vad?.silence_duration_threshold}
              onChange={(val) => updateNested('vad', 'silence_duration_threshold', val)}
            />
          </div>
          <div style={{ flex: 1 }}>
            <InputSetting
              label="最大録音時間 (秒)"
              description="環境音などで録音が止まらなくなった際の強制終了時間"
              type="number"
              step="1.0"
              defaultValue={defaultSettings?.vad?.max_duration}
              value={settings.vad?.max_duration}
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
          defaultValue={defaultSettings?.force_keywords?.join(', ')}
          value={settings.force_keywords?.join(', ')}
          onChange={(val) => updateRoot('force_keywords', typeof val === 'string' ? val.split(',').map(s => s.trim()).filter(s => s) : [])}
        />

        <InputSetting
          label="無視するフレーズ"
          description="カンマ区切りで複数指定可能です。"
          type="text"
          defaultValue={defaultSettings?.stt?.ignore_sentences?.join(', ')}
          value={settings.stt?.ignore_sentences?.join(', ')}
          onChange={(val) => updateNested('stt', 'ignore_sentences', typeof val === 'string' ? val.split(',').map(s => s.trim()).filter(s => s) : [])}
        />

        <SettingGroup label="応答頻度">
          <select
            value={settings.response_sensitivity ?? defaultSettings?.response_sensitivity ?? 'medium'}
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
          defaultValue={defaultSettings?.merge_request_threshold}
          value={settings.merge_request_threshold}
          onChange={(val) => updateRoot('merge_request_threshold', val)}
        />
      </div>

      <SettingGroup label="使用するSTTプロバイダ">
        <select
          value={settings.stt?.provider ?? defaultSettings?.stt?.provider ?? 'faster_whisper'}
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
          <InputSetting
            label="モデル (HuggingFace形式)"
            defaultValue={(defaultSettings?.stt?.providers?.faster_whisper as any)?.model}
            value={(settings.stt?.providers?.faster_whisper as any)?.model}
            onChange={(val) => updateProvider('stt', 'faster_whisper', 'model', val)}
          />
          <div style={{ display: 'flex', gap: '15px', marginBottom: '15px' }}>
            <div style={{ flex: 1 }}>
              <SettingGroup label="演算デバイス">
                <select
                  value={(settings.stt?.providers?.faster_whisper as any)?.device ?? (defaultSettings?.stt?.providers?.faster_whisper as any)?.device ?? 'auto'}
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
                  value={(settings.stt?.providers?.faster_whisper as any)?.compute_type ?? (defaultSettings?.stt?.providers?.faster_whisper as any)?.compute_type ?? 'default'}
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
            defaultValue={(defaultSettings?.stt?.providers?.faster_whisper as any)?.whisper_vad_filter}
            checked={(settings.stt?.providers?.faster_whisper as any)?.whisper_vad_filter}
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
            defaultValue={(defaultSettings?.stt?.providers?.google as any)?.language}
            value={(settings.stt?.providers?.google as any)?.language}
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
          <SettingGroup label="リージョン (Region)">
            <select
              value={(settings.stt?.providers?.azure as any)?.region ?? (defaultSettings?.stt?.providers?.azure as any)?.region ?? 'japaneast'}
              onChange={(e) => updateProvider('stt', 'azure', 'region', e.target.value)}
              style={{ ...inputStyle, marginBottom: '10px' }}
            >
              <option value="japaneast">Japan East (東日本)</option>
              <option value="japanwest">Japan West (西日本)</option>
              <option value="eastus">East US (米国東部)</option>
              <option value="westus">West US (米国西部)</option>
              <option value="southeastasia">Southeast Asia (東南アジア)</option>
              <option value="westeurope">West Europe (西欧)</option>
              <option value="custom">-- 手入力 (カスタム) --</option>
            </select>
            {((settings.stt?.providers?.azure as any)?.region &&
              !['japaneast', 'japanwest', 'eastus', 'westus', 'southeastasia', 'westeurope'].includes((settings.stt?.providers?.azure as any)?.region)) && (
                <InputSetting
                  label="カスタムリージョン名"
                  placeholder="例: centralus"
                  defaultValue={(defaultSettings?.stt?.providers?.azure as any)?.region}
                  value={(settings.stt?.providers?.azure as any)?.region}
                  onChange={(val) => updateProvider('stt', 'azure', 'region', val)}
                />
              )}
            {/* Show manual input if user explicitly selects 'custom' or is already using one not in list */}
            {/* Simple toggle: if it's not in the common list, show the text input */}
          </SettingGroup>
          <InputSetting
            label="言語"
            defaultValue={(defaultSettings?.stt?.providers?.azure as any)?.language}
            value={(settings.stt?.providers?.azure as any)?.language}
            onChange={(val) => updateProvider('stt', 'azure', 'language', val)}
          />
        </div>
      )}
    </section>
  );
};
