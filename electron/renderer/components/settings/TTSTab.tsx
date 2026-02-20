import React from 'react';
import { TabProps, inputStyle } from './types';
import { SettingGroup } from './controls/SettingGroup';
import { InputSetting } from './controls/InputSetting';
import { PasswordSetting } from './controls/PasswordSetting';
import useSWR from 'swr';

export const TTSTab: React.FC<TabProps> = ({
  settings,
  updateNested,
  updateProvider,
  updateTTSSettings,
  setStatus,
  renderTabHeader
}) => {
  const currentTTSProvider = settings.tts?.provider || 'aivisspeech';
  const ttsSettingsUrl = settings.tts?.providers?.[currentTTSProvider as ('aivisspeech' | 'voicevox')]?.api_url;
  const rawUrl = ttsSettingsUrl || (currentTTSProvider === 'aivisspeech' ? 'http://127.0.0.1:10101' : 'http://127.0.0.1:50021');
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

  const handleFetchSpeakers = () => retrySpeakers();
  const handleFetchGoogleVoices = () => {
    if (!googleApiKey) {
      setStatus({ message: 'APIキーを入力してから、音声一覧を取得してください。', type: 'error' });
      return;
    }
    retryGoogle();
  };

  return (
    <section className="animate-fade-in">
      {renderTabHeader?.('口・音声合成 (TTS)')}

      <SettingGroup label="使用するTTSプロバイダ">
        <select
          value={settings.tts?.provider ?? 'aivisspeech'}
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
          <h3 style={{ marginTop: 0, fontSize: '16px' }}>{currentTTSProvider} エンジン設定</h3>
          <InputSetting
            label="API URL"
            placeholder={currentTTSProvider === 'aivisspeech' ? 'http://127.0.0.1:10101' : 'http://127.0.0.1:50021'}
            value={settings.tts?.providers?.[currentTTSProvider]?.api_url ?? ''}
            onChange={(val) => updateProvider('tts', currentTTSProvider, 'api_url', val)}
          />
          <InputSetting
            label="エンジン起動パス (空なら自動起動しない)"
            placeholder="/Applications/.../run"
            value={settings.tts?.providers?.[currentTTSProvider]?.engine_path ?? ''}
            onChange={(val) => updateProvider('tts', currentTTSProvider, 'engine_path', val)}
          />
          <SettingGroup label="キャラクター (Speaker/Style ID)">
            <div style={{ display: 'flex', gap: '5px', marginBottom: '5px' }}>
              <button
                onClick={handleFetchSpeakers}
                disabled={isFetchingTTS}
                style={{ padding: '6px 12px', background: '#333', border: '1px solid #555', color: 'white', borderRadius: '4px', cursor: isFetchingTTS ? 'wait' : 'pointer', fontSize: '13px' }}
              >
                エンジンからキャラ一覧を取得する
              </button>
            </div>
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
        </div>
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
          <SettingGroup label="2. 音声名 (Voice)">
            <select
              value={settings.tts?.providers?.google?.voice ?? 'ja-JP-Neural2-B'}
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

      {(currentTTSProvider === 'aivisspeech' || currentTTSProvider === 'voicevox') && (
        <div style={{ borderTop: '1px solid #444', paddingTop: '20px' }}>
          <h3 style={{ marginTop: 0, fontSize: '16px' }}>共通音声パラメーター (ローカル系)</h3>
          <InputSetting
            label="話すスピード (Speed Scale)"
            type="number"
            step="0.05"
            placeholder="1.25"
            value={settings.tts?.settings?.speedScale ?? 1.25}
            onChange={(val) => updateTTSSettings?.('speedScale', val)}
          />
          <InputSetting
            label="抑揚 (Tempo Dynamic Scale)"
            type="number"
            step="0.1"
            placeholder="0.7"
            value={settings.tts?.settings?.tempoDynamicScale ?? 0.7}
            onChange={(val) => updateTTSSettings?.('tempoDynamicScale', val)}
          />
          <InputSetting
            label="音量 (Volume Scale) 0.0〜1.0"
            type="number"
            step="0.1"
            placeholder="0.5"
            value={settings.tts?.settings?.volumeScale ?? 0.5}
            onChange={(val) => updateTTSSettings?.('volumeScale', val)}
          />
        </div>
      )}

      {currentTTSProvider === 'google' && (
        <div style={{ borderTop: '1px solid #444', paddingTop: '20px' }}>
          <h3 style={{ marginTop: 0, fontSize: '16px' }}>Google TTS 音声パラメーター</h3>
          <InputSetting
            label="話すスピード (Speaking Rate)"
            type="number"
            step="0.05"
            placeholder="1.25"
            value={settings.tts?.providers?.google?.speaking_rate ?? 1.25}
            onChange={(val) => updateProvider('tts', 'google', 'speaking_rate', val)}
          />
          <InputSetting
            label="ピッチ調整 (Pitch) -20.0〜20.0"
            type="number"
            step="0.5"
            placeholder="0.0"
            value={settings.tts?.providers?.google?.pitch ?? 0.0}
            onChange={(val) => updateProvider('tts', 'google', 'pitch', val)}
          />
          <InputSetting
            label="音量ゲイン (Volume Gain dB) -96〜16"
            type="number"
            step="1"
            placeholder="0.0"
            value={settings.tts?.providers?.google?.volume_gain_db ?? 0.0}
            onChange={(val) => updateProvider('tts', 'google', 'volume_gain_db', val)}
          />
        </div>
      )}
    </section>
  );
};
