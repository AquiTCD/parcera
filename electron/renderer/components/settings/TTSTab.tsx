import React from 'react';
import { TabProps, inputStyle } from './types';
import { SettingGroup } from './controls/SettingGroup';
import { InputSetting } from './controls/InputSetting';
import { PasswordSetting } from './controls/PasswordSetting';
import useSWR from 'swr';

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
  const defaultProviderSettings = (defaultSettings?.tts?.providers as any)?.[currentTTSProvider];
  const ttsSettingsUrl = settings.tts?.providers?.[currentTTSProvider as ('aivisspeech' | 'voicevox')]?.api_url;
  const rawUrl = ttsSettingsUrl || defaultProviderSettings?.api_url || (currentTTSProvider === 'aivisspeech' ? 'http://127.0.0.1:10101' : 'http://127.0.0.1:50021');
  const url = rawUrl.replace(/\/$/, '');

  const { data: speakersInfo, error: speakersError, isValidating: isFetchingTTS, mutate: retrySpeakers } = useSWR(
    (currentTTSProvider === 'aivisspeech' || currentTTSProvider === 'voicevox') ? ['speakers', url] : null,
    async ([_, fetchUrl]) => {
      const res = await fetch(`${fetchUrl}/speakers`);
      if (!res.ok) throw new Error('エンジンに接続できません');
      const data = await res.json();
      return data.flatMap((speaker: any) =>
        speaker.styles.map((style: any) => ({
          id: style.id,
          name: speaker.name,
          styleName: style.name
        }))
      );
    },
    { revalidateOnFocus: false, errorRetryCount: 1 }
  );

  const googleApiKey = (settings.tts?.providers?.google as any)?.api_key;
  const { data: googleVoices, error: googleError, isValidating: isFetchingGoogleVoice, mutate: retryGoogle } = useSWR(
    currentTTSProvider === 'google' && googleApiKey ? ['googleVoices', googleApiKey] : null,
    async ([_, key]) => {
      const res = await fetch(`https://texttospeech.googleapis.com/v1/voices?key=${key}`);
      if (!res.ok) throw new Error('API要求に失敗しました。キーを確認してください');
      const data = await res.json();
      if (!data.voices) throw new Error('音声一覧が取得できませんでした');
      return data.voices.filter((v: any) => v.name.includes('ja-JP')).map((v: any) => ({
        id: v.name,
        gender: v.ssmlGender.replace('SSML_VOICE_GENDER_', '')
      }));
    },
    { revalidateOnFocus: false, errorRetryCount: 1 }
  );

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

      const processed = data.flatMap((speaker: any) =>
        speaker.styles.map((style: any) => ({
          id: style.id,
          name: speaker.name,
          styleName: style.name
        }))
      );

      // Manually update SWR cache using its mutate function
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

      <SettingGroup label="使用するTTSプロバイダ">
        <select
          value={settings.tts?.provider ?? defaultSettings?.tts?.provider ?? 'aivisspeech'}
          onChange={(e) => updateNested('tts', 'provider', e.target.value)}
          style={inputStyle}
        >
          <option value="aivisspeech">AivisSpeech (ローカル推奨)</option>
          <option value="voicevox">VOICEVOX (ローカル)</option>
          <option value="google">Google Cloud TTS</option>
        </select>
      </SettingGroup>

      {(currentTTSProvider === 'aivisspeech' || currentTTSProvider === 'voicevox') ? (
        <div style={{ background: '#2d2d30', padding: '15px', borderRadius: '8px', marginBottom: '20px' }}>
          <h3 style={{ marginTop: 0, fontSize: '16px' }}>{currentTTSProvider === 'aivisspeech' ? 'AivisSpeech' : currentTTSProvider === 'voicevox' ? 'VOICEVOX' : currentTTSProvider} エンジン設定</h3>
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

          <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
            <button
              onClick={handleFetchSpeakers}
              style={{
                padding: '8px 16px',
                background: '#3e3e42',
                border: '1px solid #4d4d50',
                color: '#fff',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              キャラクターリストを取得
            </button>
          </div>
          <SettingGroup label="キャラクター">
            <select
              value={settings.tts?.providers?.[currentTTSProvider as ('aivisspeech' | 'voicevox')]?.style_id ?? settings.tts?.providers?.[currentTTSProvider as ('aivisspeech' | 'voicevox')]?.speaker_id ?? ''}
              onChange={(e) => updateProvider('tts', currentTTSProvider, currentTTSProvider === 'aivisspeech' ? 'style_id' : 'speaker_id', Number(e.target.value))}
              style={inputStyle}
              disabled={isFetchingTTS || !speakersInfo || speakersInfo.length === 0}
            >
              {isFetchingTTS ? (
                <option value="">キャラクターを取得中...</option>
              ) : speakersInfo && speakersInfo.length > 0 ? (
                <>
                  <option value="">-- 指定なし (デフォルト) --</option>
                  {speakersInfo.map((spk: { id: number; name: string; styleName: string }) => (
                    <option key={`${spk.name}-${spk.id}`} value={spk.id}>{spk.name} ({spk.styleName}) - ID:{spk.id}</option>
                  ))}
                </>
              ) : (
                <option value="">(取得失敗: エンジンの起動を確認してください)</option>
              )}
            </select>
          </SettingGroup>
        </div >
      ) : currentTTSProvider === 'google' ? (
        <div style={{ background: '#2d2d30', padding: '15px', borderRadius: '8px', marginBottom: '20px' }}>
          <h3 style={{ marginTop: 0, fontSize: '16px' }}>Google TTS 設定</h3>
          <PasswordSetting
            label="1. APIキー (必須)"
            placeholder="Google Cloud API Key"
            value={(settings.tts?.providers?.google as any)?.api_key ?? ''}
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
          <SettingGroup label="プロバイダー">
            <select
              value={settings.tts?.providers?.google?.voice ?? defaultSettings?.tts?.providers?.google?.voice ?? 'ja-JP-Neural2-B'}
              onChange={(e) => updateProvider('tts', 'google', 'voice', e.target.value)}
              style={inputStyle}
              disabled={isFetchingGoogleVoice || !googleVoices || googleVoices.length === 0}
            >
              {isFetchingGoogleVoice ? (
                <option value="">音声を取得中...</option>
              ) : googleVoices && googleVoices.length > 0 ? (
                <>
                  <option value="">-- 指定なし (デフォルト) --</option>
                  {googleVoices.map((v: { id: string; gender: string }) => (
                    <option key={v.id} value={v.id}>{v.id} ({v.gender})</option>
                  ))}
                </>
              ) : (
                <option value="">(取得失敗: APIキーを確認してください)</option>
              )}
            </select>
          </SettingGroup>
        </div>
      ) : null}

      {
        (currentTTSProvider === 'aivisspeech' || currentTTSProvider === 'voicevox') && (
          <div style={{ borderTop: '1px solid #444', paddingTop: '20px' }}>
            <h3 style={{ marginTop: 0, fontSize: '16px' }}>共通音声パラメーター</h3>
            <InputSetting
              label="話速 (スピード)"
              type="number"
              step="0.05"
              defaultValue={defaultSettings?.tts?.settings?.speedScale}
              value={settings.tts?.settings?.speedScale}
              onChange={(val) => updateTTSSettings?.('speedScale', val)}
            />
            <InputSetting
              label="抑揚 (Intonation)"
              description={currentTTSProvider === 'aivisspeech'
                ? "キャラの感情表現の強さを調整します。1.0が標準です。"
                : "ピッチの上がり下がり（メロディ）の強弱。0にすると棒読みになります。"}
              type="number"
              step="0.1"
              defaultValue={defaultSettings?.tts?.settings?.intonationScale}
              value={settings.tts?.settings?.intonationScale}
              onChange={(val) => updateTTSSettings?.('intonationScale', val)}
            />
            <InputSetting
              label="ピッチ (Pitch)"
              description={currentTTSProvider === 'aivisspeech'
                ? "⚠️ AivisSpeechでは 0.0 以外に設定すると音質が劣化する可能性があります。"
                : "全体の声の高さを調整します。"}
              type="number"
              step="0.01"
              defaultValue={defaultSettings?.tts?.settings?.pitchScale}
              value={settings.tts?.settings?.pitchScale}
              onChange={(val) => updateTTSSettings?.('pitchScale', val)}
            />
            {currentTTSProvider === 'aivisspeech' && (
              <InputSetting
                label="話速の緩急 (Dynamics)"
                description="一文の中でのスピードの変化の強さを調整します。大きくするとより生っぽく（早口に）聞こえます。"
                type="number"
                step="0.1"
                defaultValue={defaultSettings?.tts?.settings?.tempoDynamicsScale}
                value={settings.tts?.settings?.tempoDynamicsScale}
                onChange={(val) => updateTTSSettings?.('tempoDynamicsScale', val)}
              />
            )}
            <InputSetting
              label="出力音量"
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
          <div style={{ borderTop: '1px solid #444', paddingTop: '20px' }}>
            <h3 style={{ marginTop: 0, fontSize: '16px' }}>Google TTS 音声パラメーター</h3>
            <InputSetting
              label="話速 (スピード)"
              type="number"
              step="0.05"
              defaultValue={defaultSettings?.tts?.providers?.google?.speaking_rate}
              value={settings.tts?.providers?.google?.speaking_rate}
              onChange={(val) => updateProvider('tts', 'google', 'speaking_rate', val)}
            />
            <InputSetting
              label="ピッチ調整"
              description="-20.0〜20.0"
              type="number"
              step="0.5"
              defaultValue={defaultSettings?.tts?.providers?.google?.pitch}
              value={settings.tts?.providers?.google?.pitch}
              onChange={(val) => updateProvider('tts', 'google', 'pitch', val)}
            />
            <InputSetting
              label="音量ゲイン (dB)"
              description="-96〜16"
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
