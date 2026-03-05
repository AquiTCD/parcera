import React, { useState, useEffect, useCallback } from 'react';
import { TabProps } from './types';
import { CheckboxSetting } from './controls/CheckboxSetting';
import { InputSetting } from './controls/InputSetting';
import { PasswordSetting } from './controls/PasswordSetting';
import { SelectSetting } from './controls/SelectSetting';
import { SettingGroup } from './controls/SettingGroup';
import { useModelDownloader, ModelDownloaderUI } from './controls/ModelDownloader';
import { TrainingView } from '../TrainingView';

type FasterWhisperProps = Pick<TabProps, 'settings' | 'defaultSettings' | 'updateProvider' | 'updateNested'>;
type MoonshineProps = Pick<TabProps, 'settings' | 'defaultSettings' | 'updateProvider' | 'updateNested'>;

const MoonshineSection: React.FC<MoonshineProps> = ({ settings, defaultSettings, updateProvider, updateNested }) => {
  const port = settings.electron?.port || 8676;
  const { modelStatus, progress, progressDetail, errorMsg, handleDownload } = useModelDownloader('base-ja', port);
  const [showTraining, setShowTraining] = useState(false);

  if (showTraining) {
    return (
      <div className="setting-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h3 className="setting-card-title" style={{ margin: 0 }}>パルセラ特訓モード</h3>
          <button className="btn btn-secondary" onClick={() => setShowTraining(false)}>キャンセル</button>
        </div>
        <TrainingView />
      </div>
    );
  }

  return (
    <div className="setting-card">
      <h3 className="setting-card-title">Moonshine 設定</h3>

      <div style={{ marginBottom: '15px', padding: '12px', background: '#1e1e1e', borderRadius: '6px', fontSize: '13px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ color: '#888' }}>モデルサイズ</span>
        <span style={{ fontWeight: 600, color: '#4fc1ff' }}>Base-ja</span>
      </div>

      <ModelDownloaderUI
        status={modelStatus}
        progress={progress}
        progressDetail={progressDetail}
        errorMsg={errorMsg}
        onDownload={handleDownload}
        notCachedDescription="Moonshine を使用するにはモデルのダウンロードが必要です"
      />

      <div style={{ marginTop: '20px', borderTop: '1px solid #333', paddingTop: '20px' }}>
        <h4 style={{ fontSize: '14px', marginBottom: '10px' }}>パーソナライズ（追加学習）</h4>
        <p style={{ fontSize: '12px', color: '#888', marginBottom: '15px' }}>
          アキさんの声や、特定の用語（格ゲー用語など）をパルセラに覚え込ませます。
          約100フレーズを読み上げることで、認識精度が劇的に向上します。
        </p>
        <button
          className="btn btn-primary"
          onClick={() => setShowTraining(true)}
          style={{ width: '100%', background: 'linear-gradient(90deg, #4fc1ff, #a155ff)', border: 'none' }}
        >
          🎤 パルセラ特訓モードを開始
        </button>
      </div>
    </div>
  );
};

const FasterWhisperSection: React.FC<FasterWhisperProps> = ({ settings, defaultSettings, updateProvider, updateNested }) => {
  const modelName = (settings.stt?.providers?.faster_whisper)?.model
    || (defaultSettings?.stt?.providers?.faster_whisper)?.model
    || 'longisland3/kotoba-whisper-v2.2-faster';
  const port = settings.electron?.port || 8676;

  const { modelStatus, progress, progressDetail, errorMsg, handleDownload } = useModelDownloader(modelName, port);

  return (
    <div className="setting-card">
      <h3 className="setting-card-title">Faster Whisper 設定</h3>

      <InputSetting
        label="モデル (HuggingFace形式)"
        defaultValue={(defaultSettings?.stt?.providers?.faster_whisper)?.model}
        value={(settings.stt?.providers?.faster_whisper)?.model}
        onChange={(val) => {
          updateProvider('stt', 'faster_whisper', 'model', val);
        }}
      />

      {/* Model download status */}
      <ModelDownloaderUI
        status={modelStatus}
        progress={progress}
        progressDetail={progressDetail}
        errorMsg={errorMsg}
        onDownload={handleDownload}
        notCachedDescription="Faster Whisper を使用するにはモデルのダウンロードが必要です（約1.5GB）"
      />

      {/* Settings only shown when model is ready */}
      {modelStatus === 'ready' && (
        <>
          <div style={{ display: 'flex', gap: '15px', marginBottom: '15px' }}>
            <div style={{ flex: 1 }}>
              <SelectSetting
                label="演算デバイス"
                value={(settings.stt?.providers?.faster_whisper)?.device ?? (defaultSettings?.stt?.providers?.faster_whisper)?.device ?? 'auto'}
                onChange={(val) => updateProvider('stt', 'faster_whisper', 'device', val)}
                options={[
                  { value: 'auto', label: 'Auto' },
                  { value: 'cpu', label: 'CPU' },
                  { value: 'cuda', label: 'CUDA (NVIDIA GPU)' }
                ]}
              />
            </div>
            <div style={{ flex: 1 }}>
              <SelectSetting
                label="量子化"
                value={(settings.stt?.providers?.faster_whisper)?.compute_type ?? (defaultSettings?.stt?.providers?.faster_whisper)?.compute_type ?? 'default'}
                onChange={(val) => updateProvider('stt', 'faster_whisper', 'compute_type', val)}
                options={[
                  { value: 'default', label: 'デフォルト' },
                  { value: 'int8', label: 'int8 (推奨 / 軽量)' },
                  { value: 'float16', label: 'float16 (高精度GPU用)' }
                ]}
              />
            </div>
          </div>
          <CheckboxSetting
            label="Whisper内蔵VADを使用"
            description="長文向けの設定（短文が無視されるリスクがあります）"
            defaultValue={(defaultSettings?.stt?.providers?.faster_whisper)?.whisper_vad_filter}
            checked={(settings.stt?.providers?.faster_whisper)?.whisper_vad_filter}
            onChange={(checked) => updateProvider('stt', 'faster_whisper', 'whisper_vad_filter', checked)}
          />

          <div style={{ marginTop: '15px' }}>
            <InputSetting
              label="Whisper 認識強化辞書"
              description="認識させたいテクニカルワードをカンマ区切りで入力します。AI名や強制応答キーワードと自動的に統合されます。"
              type="text"
              defaultValue={defaultSettings?.stt?.dictionary?.specific_keywords?.join(', ')}
              value={settings.stt?.dictionary?.specific_keywords?.join(', ')}
              onChange={(val) => {
                const words = typeof val === 'string' ? val.split(',').map(s => s.trim()).filter(s => s) : [];
                if (!settings.stt?.dictionary) {
                  updateNested('stt', 'dictionary', { specific_keywords: words });
                } else {
                  updateNested('stt', 'dictionary', { ...settings.stt.dictionary, specific_keywords: words });
                }
              }}
            />
          </div>
        </>
      )}
    </div>
  );
};

export const STTTab: React.FC<TabProps> = ({ settings, defaultSettings, updateNested, updateRoot, updateProvider, renderTabHeader }) => {
  const currentSTTProvider = settings.stt?.provider || 'moonshine';
  const [devices, setDevices] = useState<{ value: string, label: string }[]>([]);

  useEffect(() => {
    const fetchDevices = async () => {
      try {
        const allDevices = await navigator.mediaDevices.enumerateDevices();
        const audioInputs = allDevices
          .filter(d => d.kind === 'audioinput')
          .map(d => ({
            value: d.deviceId,
            label: d.label || 'Microphone'
          }))
          .filter((v, i, a) => v.value && a.findIndex(t => t.value === v.value) === i); // Unique IDs

        setDevices([
          { value: 'default', label: 'システムデフォルト' },
          ...audioInputs.filter(d => d.value !== 'default' && d.value !== '')
        ]);
      } catch (err) {
        console.error('Failed to list audio devices:', err);
      }
    };
    fetchDevices();

    navigator.mediaDevices.addEventListener('devicechange', fetchDevices);
    return () => {
      navigator.mediaDevices.removeEventListener('devicechange', fetchDevices);
    };
  }, []);


  return (
    <section className="tab-content-section">
      {renderTabHeader?.('音声認識（耳）')}

      <div className="setting-card">
        <h3 className="setting-card-title">VAD設定 (声の検出)</h3>

        <div style={{ marginBottom: '20px' }}>
          <SelectSetting
            label="使用するマイク"
            description="音声入力に使用するデバイスを選択します。"
            value={settings.electron?.mic_device_id ?? 'default'}
            onChange={(val) => updateNested('electron', 'mic_device_id', val)}
            options={devices}
          />
        </div>

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

        <div className="setting-form-row">
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

      <div className="setting-card">
        <h3 className="setting-card-title">割り込み・応答感度設定</h3>

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

        <SelectSetting
          label="応答頻度"
          value={settings.response_sensitivity ?? defaultSettings?.response_sensitivity ?? 'medium'}
          onChange={(val) => updateRoot('response_sensitivity', val)}
          options={[
            { value: 'high', label: '高い - 頻繁に反応' },
            { value: 'medium', label: '普通 - 通常の会話' },
            { value: 'low', label: '低い - 短い発話にはあまり反応しない' }
          ]}
        />

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

      <SelectSetting
        label="使用するSTTプロバイダ"
        value={settings.stt?.provider ?? defaultSettings?.stt?.provider ?? 'moonshine'}
        onChange={(val) => updateNested('stt', 'provider', val)}
        options={[
          { value: 'moonshine', label: 'Moonshine (超低遅延・高速 / オススメ)' },
          { value: 'faster_whisper', label: 'Faster Whisper (ローカル)' },
          { value: 'google', label: 'Google Cloud STT' },
          { value: 'azure', label: 'Azure Speech to Text' }
        ]}
      />

      {currentSTTProvider === 'faster_whisper' && (
        <FasterWhisperSection
          settings={settings}
          defaultSettings={defaultSettings}
          updateProvider={updateProvider}
          updateNested={updateNested}
        />
      )}

      {currentSTTProvider === 'moonshine' && (
        <MoonshineSection
          settings={settings}
          defaultSettings={defaultSettings}
          updateProvider={updateProvider}
          updateNested={updateNested}
        />
      )}

      {currentSTTProvider === 'google' && (
        <div className="setting-card">
          <h3 className="setting-card-title">Google STT 設定</h3>
          <PasswordSetting
            label="APIキー"
            placeholder="Google Cloud API Key"
            value={(settings.stt?.providers?.google)?.api_key ?? ''}
            onChange={(val) => updateProvider('stt', 'google', 'api_key', val)}
          />
          <InputSetting
            label="言語"
            defaultValue={(defaultSettings?.stt?.providers?.google)?.language}
            value={(settings.stt?.providers?.google)?.language}
            onChange={(val) => updateProvider('stt', 'google', 'language', val)}
          />
        </div>
      )}

      {currentSTTProvider === 'azure' && (
        <div className="setting-card">
          <h3 className="setting-card-title">Azure STT 設定</h3>
          <PasswordSetting
            label="APIキー"
            placeholder="Azure API Key"
            value={(settings.stt?.providers?.azure)?.api_key ?? ''}
            onChange={(val) => updateProvider('stt', 'azure', 'api_key', val)}
          />
          <SelectSetting
            label="リージョン (Region)"
            value={(settings.stt?.providers?.azure)?.region ?? (defaultSettings?.stt?.providers?.azure)?.region ?? 'japaneast'}
            onChange={(val) => updateProvider('stt', 'azure', 'region', val)}
            options={[
              { value: 'japaneast', label: 'Japan East (東日本)' },
              { value: 'japanwest', label: 'Japan West (西日本)' },
              { value: 'eastus', label: 'East US (米国東部)' },
              { value: 'westus', label: 'West US (米国西部)' },
              { value: 'southeastasia', label: 'Southeast Asia (東南アジア)' },
              { value: 'westeurope', label: 'West Europe (西欧)' },
              { value: 'custom', label: '-- 手入力 (カスタム) --' }
            ]}
          />
          {((settings.stt?.providers?.azure)?.region &&
            !['japaneast', 'japanwest', 'eastus', 'westus', 'southeastasia', 'westeurope'].includes((settings.stt?.providers?.azure)?.region)) && (
              <InputSetting
                label="カスタムリージョン名"
                placeholder="例: centralus"
                defaultValue={(defaultSettings?.stt?.providers?.azure)?.region}
                value={(settings.stt?.providers?.azure)?.region}
                onChange={(val) => updateProvider('stt', 'azure', 'region', val)}
              />
            )}
          <InputSetting
            label="言語"
            defaultValue={(defaultSettings?.stt?.providers?.azure)?.language}
            value={(settings.stt?.providers?.azure)?.language}
            onChange={(val) => updateProvider('stt', 'azure', 'language', val)}
          />
        </div>
      )}
    </section>
  );
};
