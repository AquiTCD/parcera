import React from 'react';
import { TabProps } from './types';
import { InputSetting } from './controls/InputSetting';
import { PasswordSetting } from './controls/PasswordSetting';
import { SelectSetting } from './controls/SelectSetting';
import { useLocalSpeakers, useGoogleVoices } from '../../hooks/useTTSSpeakers';

interface RawSpeaker { name: string; styles: Array<{ id: number; name: string }> }
interface SpeakerOption { id: number; name: string; styleName: string }
interface GoogleVoiceOption { id: string; gender: string }

export const TTSTab: React.FC<TabProps> = ({
  settings,
  defaultSettings,
  updateNested,
  updateProvider,
  updateTTSSettings,
  setStatus,
  renderTabHeader
}) => {
  const currentTTSProvider = settings.tts?.provider || 'aivisspeech';
  const defaultProviderSettings = defaultSettings?.tts?.providers?.[currentTTSProvider];
  const ttsSettingsUrl = settings.tts?.providers?.[currentTTSProvider as ('aivisspeech' | 'voicevox')]?.api_url;
  const rawUrl = ttsSettingsUrl || defaultProviderSettings?.api_url || (currentTTSProvider === 'aivisspeech' ? 'http://127.0.0.1:10101' : 'http://127.0.0.1:50021');
  const url = rawUrl.replace(/\/$/, '');

  const { speakersInfo, speakersError, isFetchingTTS, retrySpeakers } = useLocalSpeakers(currentTTSProvider, url);

  const googleApiKey = settings.tts?.providers?.google?.api_key;
  const { googleVoices, googleError, isFetchingGoogleVoice, retryGoogle } = useGoogleVoices(currentTTSProvider, googleApiKey);

  React.useEffect(() => {
    if (speakersError) {
      setStatus({ message: `通信エラー: ${speakersError.message}`, type: 'error' });
    }
    if (googleError) {
      setStatus({ message: `通信エラー: ${googleError.message}`, type: 'error' });
    }
  }, [speakersError, googleError, setStatus]);

  const handleFetchSpeakers = async () => {
    if (!settings) return;
    setStatus({ message: 'キャラクターリストを取得中...', type: '' });
    try {
      const port = settings.electron?.port || 8676;
      const res = await fetch(`http://127.0.0.1:${port}/tts/speakers?provider=${currentTTSProvider}`);
      const data = await res.json();

      if (data.status === 'error') {
        throw new Error(data.message);
      }

      const processed: SpeakerOption[] = data.flatMap((speaker: RawSpeaker) =>
        speaker.styles.map((style) => ({
          id: style.id,
          name: speaker.name,
          styleName: style.name
        }))
      );

      retrySpeakers(processed);
      setStatus({ message: 'キャラクターリストを更新しました', type: 'success' });
    } catch (e: any) {
      console.error(e);
      setStatus({ message: '取得エラー: ' + e.message, type: 'error' });
    }
  };
  const handleFetchGoogleVoices = () => {
    if (!googleApiKey) {
      setStatus({ message: 'APIキーを入力してから、音声一覧を取得してください。', type: 'error' });
      return;
    }
    retryGoogle();
  };

  return (
    <section className="animate-fade-in">
      {renderTabHeader?.('音声出力（口）')}

      <SelectSetting
        label="使用するTTSプロバイダ"
        value={settings.tts?.provider ?? defaultSettings?.tts?.provider ?? 'aivisspeech'}
        onChange={(val) => updateNested('tts', 'provider', val)}
        options={[
          { value: 'aivisspeech', label: 'AivisSpeech (ローカル推奨)' },
          { value: 'voicevox', label: 'VOICEVOX (ローカル)' },
          { value: 'google', label: 'Google Cloud TTS' }
        ]}
      />

      {(currentTTSProvider === 'aivisspeech' || currentTTSProvider === 'voicevox') ? (
        <div className="setting-card">
          <h3 className="setting-card-title">{currentTTSProvider === 'aivisspeech' ? 'AivisSpeech' : currentTTSProvider === 'voicevox' ? 'VOICEVOX' : currentTTSProvider} エンジン設定</h3>
          <InputSetting
            label="エンジンのAPI URL"
            description={`デフォルト: ${defaultProviderSettings?.api_url}`}
            defaultValue={defaultProviderSettings?.api_url}
            value={settings.tts?.providers?.[currentTTSProvider]?.api_url}
            onChange={(val) => updateProvider('tts', currentTTSProvider, 'api_url', val)}
          />
          <InputSetting
            label="エンジン起動パス"
            description="空なら自動起動しません。例: /Applications/.../run"
            defaultValue={defaultProviderSettings?.engine_path}
            value={settings.tts?.providers?.[currentTTSProvider]?.engine_path}
            onChange={(val) => updateProvider('tts', currentTTSProvider, 'engine_path', val)}
          />

          <div style={{ display: 'flex', gap: '10px', marginTop: '10px', marginBottom: '15px' }}>
            <button
              onClick={handleFetchSpeakers}
              className="btn btn-secondary"
              style={{ fontSize: '12px', padding: '6px 14px' }}
            >
              キャラクターリストを取得
            </button>
          </div>

          <SelectSetting
            label="キャラクター"
            value={settings.tts?.providers?.[currentTTSProvider as ('aivisspeech' | 'voicevox')]?.style_id ?? settings.tts?.providers?.[currentTTSProvider as ('aivisspeech' | 'voicevox')]?.speaker_id ?? ''}
            onChange={(val) => updateProvider('tts', currentTTSProvider, currentTTSProvider === 'aivisspeech' ? 'style_id' : 'speaker_id', Number(val))}
            disabled={isFetchingTTS || !speakersInfo || speakersInfo.length === 0}
            options={isFetchingTTS ? [{ value: '', label: 'キャラクターを取得中...' }] : (speakersInfo && speakersInfo.length > 0 ? [
              { value: '', label: '-- 指定なし (デフォルト) --' },
              ...(speakersInfo as SpeakerOption[]).map((spk) => ({ value: spk.id, label: `${spk.name} (${spk.styleName}) - ID:${spk.id}` }))
            ] : [{ value: '', label: '(取得失敗: エンジンの起動を確認してください)' }])}
          />
        </div >
      ) : currentTTSProvider === 'google' ? (
        <div className="setting-card">
          <h3 className="setting-card-title">Google TTS 設定</h3>
          <PasswordSetting
            label="1. APIキー (必須)"
            placeholder="Google Cloud API Key"
            value={settings.tts?.providers?.google?.api_key ?? ''}
            onChange={(val) => updateProvider('tts', 'google', 'api_key', val)}
            buttonAction={
              <button
                onClick={handleFetchGoogleVoices}
                style={{ padding: '6px 12px', background: '#333', border: '1px solid #555', color: 'white', borderRadius: '4px', cursor: 'pointer', fontSize: '13px' }}
                disabled={isFetchingGoogleVoice}
              >
                APIキーを使って音声一覧を取得する
              </button>
            }
          />
          <SelectSetting
            label="プロバイダー"
            value={settings.tts?.providers?.google?.voice ?? defaultSettings?.tts?.providers?.google?.voice ?? 'ja-JP-Neural2-B'}
            onChange={(val) => updateProvider('tts', 'google', 'voice', val)}
            disabled={isFetchingGoogleVoice || !googleVoices || googleVoices.length === 0}
            options={isFetchingGoogleVoice ? [{ value: '', label: '音声を取得中...' }] : (googleVoices && googleVoices.length > 0 ? [
              { value: '', label: '-- 指定なし (デフォルト) --' },
              ...(googleVoices as GoogleVoiceOption[]).map((v) => ({ value: v.id, label: `${v.id} (${v.gender})` }))
            ] : [{ value: '', label: '(取得失敗: APIキーを確認してください)' }])}
          />
        </div>
      ) : null}

      {
        (currentTTSProvider === 'aivisspeech' || currentTTSProvider === 'voicevox') && (
          <div className="setting-card" style={{ borderTop: 'none', paddingTop: '0' }}>
            <h3 className="setting-card-title">共通音声パラメーター</h3>
            <InputSetting
              label="話速 (Speed Scale)"
              description="全体の喋る速さを調整します。(標準: 1.0)"
              type="number"
              step="0.05"
              defaultValue={defaultSettings?.tts?.settings?.speedScale}
              value={settings.tts?.settings?.speedScale}
              onChange={(val) => updateTTSSettings?.('speedScale', val)}
            />
            <InputSetting
              label="抑揚 (Intonation Scale)"
              description={currentTTSProvider === 'aivisspeech'
                ? "キャラの感情表現の強さを調整します。(標準: 1.0)"
                : "ピッチの上がり下がり（メロディ）の強弱を調整します。0にすると棒読みになります。(標準: 1.0)"}
              type="number"
              step="0.1"
              defaultValue={defaultSettings?.tts?.settings?.intonationScale}
              value={settings.tts?.settings?.intonationScale}
              onChange={(val) => updateTTSSettings?.('intonationScale', val)}
            />
            <InputSetting
              label="ピッチ (Pitch Scale)"
              description={currentTTSProvider === 'aivisspeech'
                ? "⚠️ AivisSpeechでは 0.0 以外に設定すると音質が劣化する可能性があります。(標準: 0.0)"
                : "全体の声の高さを調整します。(標準: 0.0)"}
              type="number"
              step="0.01"
              defaultValue={defaultSettings?.tts?.settings?.pitchScale}
              value={settings.tts?.settings?.pitchScale}
              onChange={(val) => updateTTSSettings?.('pitchScale', val)}
            />
            {currentTTSProvider === 'aivisspeech' && (
              <InputSetting
                label="話速の緩急 (Tempo Dynamics Scale)"
                description="一文の中でのスピードの変化の強さを調整します。大きくするとより生っぽく（早口に）聞こえます。(標準: 1.0)"
                type="number"
                step="0.1"
                defaultValue={defaultSettings?.tts?.settings?.tempoDynamicsScale}
                value={settings.tts?.settings?.tempoDynamicsScale}
                onChange={(val) => updateTTSSettings?.('tempoDynamicsScale', val)}
              />
            )}
            <InputSetting
              label="出力音量 (Volume Scale)"
              description={`範囲: 0.0〜1.0 (標準: ${defaultSettings?.tts?.settings?.volumeScale ?? 1.0})`}
              type="number"
              step="0.1"
              defaultValue={defaultSettings?.tts?.settings?.volumeScale}
              value={settings.tts?.settings?.volumeScale}
              onChange={(val) => updateTTSSettings?.('volumeScale', val)}
            />
          </div>
        )
      }

      {
        currentTTSProvider === 'google' && (
          <div className="setting-card" style={{ borderTop: 'none', paddingTop: '0' }}>
            <h3 className="setting-card-title">Google TTS 音声パラメーター</h3>
            <InputSetting
              label="話速 (Speaking Rate)"
              description="Google Cloud TTSのネイティブな話速設定です。(標準: 1.0)"
              type="number"
              step="0.05"
              defaultValue={defaultSettings?.tts?.providers?.google?.speaking_rate}
              value={settings.tts?.providers?.google?.speaking_rate}
              onChange={(val) => updateProvider('tts', 'google', 'speaking_rate', val)}
            />
            <InputSetting
              label="ピッチ調整 (Pitch)"
              description="範囲: -20.0〜20.0 (標準: 0.0)"
              type="number"
              step="0.5"
              defaultValue={defaultSettings?.tts?.providers?.google?.pitch}
              value={settings.tts?.providers?.google?.pitch}
              onChange={(val) => updateProvider('tts', 'google', 'pitch', val)}
            />
            <InputSetting
              label="音量ゲイン (Volume Gain dB)"
              description="範囲: -96〜16 (標準: 0.0)"
              type="number"
              step="1"
              defaultValue={defaultSettings?.tts?.providers?.google?.volume_gain_db}
              value={settings.tts?.providers?.google?.volume_gain_db}
              onChange={(val) => updateProvider('tts', 'google', 'volume_gain_db', val)}
            />
          </div>
        )
      }
    </section>
  );
};
