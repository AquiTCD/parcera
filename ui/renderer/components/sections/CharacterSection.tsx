import React from 'react';
import { SectionProps } from './types';
import { FieldRow, SliderRow } from './shared';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Button } from '../ui/button';
import { useLocalSpeakers, useGoogleVoices } from '../../hooks/useTTSSpeakers';
import { AvatarColumn } from '../settings/visuals/AvatarColumn';
import { WindowSettingsSection } from '../settings/WindowSettingsSection';
import { BreatheAnimationSettings } from '../settings/visuals/BreatheAnimationSettings';

export const CharacterSection: React.FC<SectionProps> = ({
  settings,
  defaultSettings,
  updateRoot,
  updateNested,
  updateProvider,
  updateTTSSettings,
  setStatus,
  handleSelectDir,
}) => {
  const currentTTSProvider = settings.tts?.provider || 'aivisspeech';
  const ttsSettingsUrl =
    settings.tts?.providers?.[currentTTSProvider as 'aivisspeech' | 'voicevox']?.api_url;
  const defaultUrl =
    defaultSettings?.tts?.providers?.[currentTTSProvider as 'aivisspeech' | 'voicevox']?.api_url ||
    (currentTTSProvider === 'aivisspeech' ? 'http://127.0.0.1:10101' : 'http://127.0.0.1:50021');
  const ttsUrl = (ttsSettingsUrl || defaultUrl).replace(/\/$/, '');

  const { speakersInfo, isFetchingTTS, retrySpeakers } = useLocalSpeakers(currentTTSProvider, ttsUrl);
  const googleApiKey = settings.tts?.providers?.google?.api_key;
  const { googleVoices, isFetchingGoogleVoice, retryGoogle } = useGoogleVoices(currentTTSProvider, googleApiKey);

  const handleFetchSpeakers = async () => {
    setStatus({ message: 'キャラクターリストを取得中...', type: '' });
    try {
      const port = settings.app?.port || 8676;
      const res = await fetch(`http://127.0.0.1:${port}/tts/speakers?provider=${currentTTSProvider}`);
      const data = await res.json();
      const processed = data.flatMap((speaker: any) =>
        speaker.styles.map((style: any) => ({
          id: style.id,
          name: speaker.name,
          styleName: style.name,
        }))
      );
      retrySpeakers(processed);
      setStatus({ message: 'キャラクターリストを更新しました', type: 'success' });
    } catch (e: any) {
      setStatus({ message: '取得エラー: ' + e.message, type: 'error' });
    }
  };

  const temperature = settings.llm?.providers?.[settings.llm?.provider || 'gemini']?.temperature ?? 0.7;

  const ttsSettings = settings.tts?.settings;
  const speedScale = ttsSettings?.speedScale ?? defaultSettings?.tts?.settings?.speedScale ?? 1.0;
  const intonationScale = ttsSettings?.intonationScale ?? defaultSettings?.tts?.settings?.intonationScale ?? 1.0;
  const pitchScale = ttsSettings?.pitchScale ?? defaultSettings?.tts?.settings?.pitchScale ?? 0;
  const volumeScale = ttsSettings?.volumeScale ?? defaultSettings?.tts?.settings?.volumeScale ?? 1.0;
  const tempoDynamicsScale = ttsSettings?.tempoDynamicsScale ?? defaultSettings?.tts?.settings?.tempoDynamicsScale ?? 1.0;

  return (
    <div className="space-y-6">
      {/* 性格・プロフィール */}
      <Card>
        <CardHeader>
          <CardTitle>性格・プロフィール</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <FieldRow label="名前">
            <Input
              value={settings.ai_profile?.name ?? ''}
              onChange={(e) => updateNested('ai_profile', 'name', e.target.value)}
              placeholder={defaultSettings?.ai_profile?.name}
            />
          </FieldRow>

          <div className="grid grid-cols-2 gap-4">
            <FieldRow label="種族">
              <Input
                value={settings.ai_profile?.species ?? ''}
                onChange={(e) => updateNested('ai_profile', 'species', e.target.value)}
                placeholder={defaultSettings?.ai_profile?.species}
              />
            </FieldRow>
            <FieldRow label="性別">
              <Input
                value={settings.ai_profile?.gender ?? ''}
                onChange={(e) => updateNested('ai_profile', 'gender', e.target.value)}
                placeholder={defaultSettings?.ai_profile?.gender}
              />
            </FieldRow>
          </div>

          <FieldRow label="性格">
            <Input
              value={settings.ai_profile?.personality ?? ''}
              onChange={(e) => updateNested('ai_profile', 'personality', e.target.value)}
              placeholder={defaultSettings?.ai_profile?.personality}
            />
          </FieldRow>

          <FieldRow label="口調">
            <Input
              value={settings.ai_profile?.tone ?? ''}
              onChange={(e) => updateNested('ai_profile', 'tone', e.target.value)}
              placeholder={defaultSettings?.ai_profile?.tone}
            />
          </FieldRow>

          <div className="grid grid-cols-2 gap-4">
            <FieldRow label="一人称">
              <Input
                value={settings.ai_profile?.first_person ?? ''}
                onChange={(e) => updateNested('ai_profile', 'first_person', e.target.value)}
                placeholder={defaultSettings?.ai_profile?.first_person}
              />
            </FieldRow>
            <FieldRow label="趣味">
              <Input
                value={settings.ai_profile?.hobbies ?? ''}
                onChange={(e) => updateNested('ai_profile', 'hobbies', e.target.value)}
                placeholder={defaultSettings?.ai_profile?.hobbies}
              />
            </FieldRow>
          </div>
        </CardContent>
      </Card>

      {/* 追加知識・シチュエーション */}
      <Card>
        <CardHeader>
          <CardTitle>追加知識・シチュエーション</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground mb-3">
            AIが知っておくべき背景情報や攻略情報、現在のシチュエーションを記述します。
          </p>
          <Textarea
            value={settings.knowledge ?? ''}
            onChange={(e) => updateRoot('knowledge', e.target.value)}
            placeholder="例: A.K.I.の中足はガードさせて有利"
            className="min-h-[120px]"
          />
        </CardContent>
      </Card>

      {/* ユーザー設定 */}
      <Card>
        <CardHeader>
          <CardTitle>ユーザー設定</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <FieldRow label="あなたの名前">
              <Input
                value={settings.user_profile?.name ?? ''}
                onChange={(e) => updateNested('user_profile', 'name', e.target.value)}
                placeholder={defaultSettings?.user_profile?.name}
              />
            </FieldRow>
            <FieldRow label="AIからの呼び方">
              <Input
                value={settings.user_profile?.calling ?? ''}
                onChange={(e) => updateNested('user_profile', 'calling', e.target.value)}
                placeholder={defaultSettings?.user_profile?.calling}
              />
            </FieldRow>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <FieldRow label="性別">
              <Input
                value={settings.user_profile?.gender ?? ''}
                onChange={(e) => updateNested('user_profile', 'gender', e.target.value)}
                placeholder={defaultSettings?.user_profile?.gender}
              />
            </FieldRow>
            <FieldRow label="対話モード">
              <Select
                value={settings.user_profile?.mode || 'soliloquy'}
                onValueChange={(val) => updateNested('user_profile', 'mode', val)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="soliloquy">独り言（観戦者モード）</SelectItem>
                  <SelectItem value="conversation">会話（チャットモード）</SelectItem>
                </SelectContent>
              </Select>
            </FieldRow>
          </div>
        </CardContent>
      </Card>

      {/* 返答スタイル */}
      <Card>
        <CardHeader>
          <CardTitle>返答スタイル</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <SliderRow
            label="Temperature"
            description="表現のランダム性。高いほど独創的・多様な表現になります。"
            value={temperature}
            min={0}
            max={2}
            step={0.05}
            onChange={(val) => updateProvider('llm', settings.llm?.provider || 'gemini', 'temperature', val)}
          />
        </CardContent>
      </Card>

      {/* 声 */}
      <Card>
        <CardHeader>
          <CardTitle>声</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <FieldRow label="TTSプロバイダー">
            <Select
              value={settings.tts?.provider || 'aivisspeech'}
              onValueChange={(val) => updateNested('tts', 'provider', val)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="aivisspeech">AivisSpeech（ローカル推奨）</SelectItem>
                <SelectItem value="voicevox">VOICEVOX（ローカル）</SelectItem>
                <SelectItem value="google">Google Cloud TTS</SelectItem>
              </SelectContent>
            </Select>
          </FieldRow>

          {currentTTSProvider === 'google' && (
            <>
              <FieldRow label="音声モデル">
                <div className="flex gap-2">
                  <Select
                    value={settings.tts?.providers?.google?.voice ?? '__none__'}
                    onValueChange={(val) => updateProvider('tts', 'google', 'voice', val === '__none__' ? undefined : val)}
                    disabled={isFetchingGoogleVoice || !googleVoices?.length}
                  >
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="-- 指定なし --" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">-- 指定なし (デフォルト) --</SelectItem>
                      {googleVoices?.map((v: any) => (
                        <SelectItem key={v.id} value={v.id}>{v.id} ({v.gender})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button variant="outline" size="sm" onClick={() => retryGoogle()}>取得</Button>
                </div>
              </FieldRow>

              <div className="grid grid-cols-2 gap-4">
                <SliderRow
                  label="話速 (Speaking Rate)"
                  value={settings.tts?.providers?.google?.speaking_rate ?? defaultSettings?.tts?.providers?.google?.speaking_rate ?? 1.0}
                  min={0.25}
                  max={4.0}
                  step={0.05}
                  onChange={(val) => updateProvider('tts', 'google', 'speaking_rate', val)}
                />
                <SliderRow
                  label="ピッチ (Pitch)"
                  value={settings.tts?.providers?.google?.pitch ?? defaultSettings?.tts?.providers?.google?.pitch ?? 0}
                  min={-20}
                  max={20}
                  step={0.5}
                  onChange={(val) => updateProvider('tts', 'google', 'pitch', val)}
                />
              </div>

              <SliderRow
                label="音量ゲイン (Volume Gain dB)"
                value={settings.tts?.providers?.google?.volume_gain_db ?? defaultSettings?.tts?.providers?.google?.volume_gain_db ?? 0}
                min={-96}
                max={16}
                step={1}
                onChange={(val) => updateProvider('tts', 'google', 'volume_gain_db', val)}
              />
            </>
          )}

          {(currentTTSProvider === 'aivisspeech' || currentTTSProvider === 'voicevox') && (
            <>
              <FieldRow label="キャラクター（音声モデル）">
                <div className="flex gap-2">
                  <Select
                    value={String(
                      settings.tts?.providers?.[currentTTSProvider as 'aivisspeech' | 'voicevox']?.style_id ??
                      settings.tts?.providers?.[currentTTSProvider as 'aivisspeech' | 'voicevox']?.speaker_id ??
                      '__none__'
                    )}
                    onValueChange={(val) =>
                      updateProvider(
                        'tts',
                        currentTTSProvider,
                        currentTTSProvider === 'aivisspeech' ? 'style_id' : 'speaker_id',
                        val === '__none__' ? undefined : Number(val)
                      )
                    }
                    disabled={isFetchingTTS || !speakersInfo?.length}
                  >
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="-- 指定なし --" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">-- 指定なし (デフォルト) --</SelectItem>
                      {speakersInfo?.map((spk: any) => (
                        <SelectItem key={spk.id} value={String(spk.id)}>
                          {spk.name} ({spk.styleName}) - ID:{spk.id}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button variant="outline" size="sm" onClick={handleFetchSpeakers}>
                    取得
                  </Button>
                </div>
              </FieldRow>

              <div className="grid grid-cols-2 gap-4">
                <SliderRow
                  label="話速"
                  value={speedScale}
                  min={0.5}
                  max={2}
                  step={0.05}
                  onChange={(val) => updateTTSSettings?.('speedScale', val)}
                />
                <SliderRow
                  label="抑揚"
                  value={intonationScale}
                  min={0}
                  max={2}
                  step={0.1}
                  onChange={(val) => updateTTSSettings?.('intonationScale', val)}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <SliderRow
                  label="ピッチ"
                  value={pitchScale}
                  min={-0.15}
                  max={0.15}
                  step={0.01}
                  onChange={(val) => updateTTSSettings?.('pitchScale', val)}
                />
                <SliderRow
                  label="出力音量"
                  value={volumeScale}
                  min={0}
                  max={2}
                  step={0.1}
                  onChange={(val) => updateTTSSettings?.('volumeScale', val)}
                />
              </div>

              {currentTTSProvider === 'aivisspeech' && (
                <SliderRow
                  label="話速の緩急"
                  description="AivisSpeech のみ有効"
                  value={tempoDynamicsScale}
                  min={0}
                  max={2}
                  step={0.1}
                  onChange={(val) => updateTTSSettings?.('tempoDynamicsScale', val)}
                />
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* 見た目 */}
      <Card>
        <CardHeader>
          <CardTitle>見た目</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 mb-4">
            <div className="flex-1">
              <AvatarColumn
                type="ai"
                label="AIアバター パス"
                settings={settings}
                defaultSettings={defaultSettings}
                updateNested={updateNested}
                handleSelectDir={handleSelectDir}
              />
            </div>
            <div className="flex-1">
              <AvatarColumn
                type="user"
                label="USERアバター パス"
                settings={settings}
                defaultSettings={defaultSettings}
                updateNested={updateNested}
                handleSelectDir={handleSelectDir}
              />
            </div>
          </div>

          <div className="flex gap-4 mb-4">
            <div className="flex-1">
              <WindowSettingsSection
                type="ai"
                settings={settings}
                defaultSettings={defaultSettings}
                updateNested={updateNested}
              />
            </div>
            <div className="flex-1">
              <WindowSettingsSection
                type="user"
                settings={settings}
                defaultSettings={defaultSettings}
                updateNested={updateNested}
              />
            </div>
          </div>

          <BreatheAnimationSettings
            settings={settings}
            defaultSettings={defaultSettings}
            updateNested={updateNested}
          />
        </CardContent>
      </Card>
    </div>
  );
};

