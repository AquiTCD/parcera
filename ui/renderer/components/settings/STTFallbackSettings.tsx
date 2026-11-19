import React from 'react';
import { ParceraSettings, STTFallbackSettings as STTFallbackConfig, STTProviderConfig } from '../../../shared/types';
import { FieldRow, PasswordField } from '../sections/shared';
import { Input } from '../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';

interface STTFallbackSettingsProps {
  settings: ParceraSettings;
  defaultSettings?: ParceraSettings;
  updateNested: (section: keyof ParceraSettings, key: string, value: unknown) => void;
}

/**
 * Renders configuration for the optional secondary (fallback) STT recognizer
 * used when the primary STT hits rate limits or times out.
 */
export const STTFallbackSettings: React.FC<STTFallbackSettingsProps> = ({
  settings,
  defaultSettings,
  updateNested,
}) => {
  const fallback: STTFallbackConfig = settings.stt?.fallback ?? {};
  const fbProvider = fallback.provider || '';
  const cooldownHours = Math.max(1, Math.round((fallback.cooldown_seconds ?? 10800) / 3600));
  const providerCfg: STTProviderConfig = (fbProvider && fallback.providers?.[fbProvider]) || {};

  const updateFallbackField = (patch: Partial<STTFallbackConfig>) => {
    updateNested('stt', 'fallback', {
      ...fallback,
      ...patch,
    });
  };

  const updateFallbackProviderField = (field: keyof STTProviderConfig, value: unknown) => {
    if (!fbProvider) return;
    updateFallbackField({
      providers: {
        ...(fallback.providers ?? {}),
        [fbProvider]: {
          ...providerCfg,
          [field]: value,
        },
      },
    });
  };

  return (
    <div className="space-y-4 rounded-md border border-border/60 bg-muted/20 p-4">
      <div>
        <h5 className="text-sm font-semibold">フォールバックSTT（2nd）</h5>
        <p className="text-xs text-muted-foreground mt-0.5">
          1stのSTTが利用制限（429）やタイムアウトで失敗したときに自動で切り替えます（遅延ロード）。
        </p>
      </div>

      <FieldRow label="フォールバック先プロバイダー" restartRequired>
        <Select
          value={fbProvider || '__none__'}
          onValueChange={(val) => updateFallbackField({ provider: val === '__none__' ? '' : val })}
        >
          <SelectTrigger aria-label="フォールバックSTTプロバイダー">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">使用しない（1stのみ）</SelectItem>
            <SelectItem value="moonshine">Moonshine（超低遅延・高速 / ローカル）</SelectItem>
            <SelectItem value="faster_whisper">Faster Whisper（ローカル）</SelectItem>
            <SelectItem value="google">Google Cloud STT</SelectItem>
            <SelectItem value="azure">Azure Speech to Text</SelectItem>
          </SelectContent>
        </Select>
      </FieldRow>

      {fbProvider && (
        <>
          <FieldRow label="復帰チェック間隔（時間）">
            <Input
              type="number"
              min={1}
              value={cooldownHours}
              onChange={(e) => {
                const hours = Math.max(1, Number(e.target.value) || 1);
                updateFallbackField({ cooldown_seconds: hours * 3600 });
              }}
            />
            <p className="text-xs text-muted-foreground mt-1">
              2ndへ切り替え後、この時間だけ1stをスキップし、経過後に1stへの復帰を再試行します。
            </p>
          </FieldRow>

          {fbProvider === 'faster_whisper' && (
            <>
              <FieldRow label="モデル（HuggingFace形式）" restartRequired>
                <Input
                  value={providerCfg.model ?? ''}
                  onChange={(e) => updateFallbackProviderField('model', e.target.value)}
                  placeholder={defaultSettings?.stt?.providers?.faster_whisper?.model}
                />
              </FieldRow>
              <div className="grid grid-cols-2 gap-4">
                <FieldRow label="演算デバイス" restartRequired>
                  <Select
                    value={providerCfg.device ?? 'auto'}
                    onValueChange={(v) => updateFallbackProviderField('device', v)}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="auto">Auto</SelectItem>
                      <SelectItem value="cpu">CPU</SelectItem>
                      <SelectItem value="cuda">CUDA (NVIDIA GPU)</SelectItem>
                    </SelectContent>
                  </Select>
                </FieldRow>
                <FieldRow label="量子化" restartRequired>
                  <Select
                    value={providerCfg.compute_type ?? 'default'}
                    onValueChange={(v) => updateFallbackProviderField('compute_type', v)}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="default">デフォルト</SelectItem>
                      <SelectItem value="int8">int8（推奨 / 軽量）</SelectItem>
                      <SelectItem value="float16">float16（高精度GPU用）</SelectItem>
                    </SelectContent>
                  </Select>
                </FieldRow>
              </div>
            </>
          )}

          {(fbProvider === 'google' || fbProvider === 'azure') && (
            <FieldRow label="APIキー">
              <PasswordField
                value={providerCfg.api_key ?? ''}
                onChange={(v) => updateFallbackProviderField('api_key', v)}
              />
            </FieldRow>
          )}
        </>
      )}
    </div>
  );
};
