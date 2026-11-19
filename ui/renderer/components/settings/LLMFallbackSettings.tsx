import React from 'react';
import { LLMFallbackSettings as LLMFallbackConfig, LLMProviderConfig, ParceraSettings } from '../../../shared/types';
import { FieldRow, PasswordField } from '../sections/shared';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { useLLMModels } from '../../hooks/useLLMModels';

const LOCAL_MODEL_PRESETS = [
  { label: 'Gemma 4 4B (MLX)', value: 'mlx-community/gemma-4-e4b-it-4bit' },
  { label: 'Gemma 2 9B (MLX)', value: 'mlx-community/gemma-2-9b-it-4bit' },
  { label: 'Qwen3.5 9B (MLX)', value: 'mlx-community/Qwen3.5-9B-MLX-4bit' },
  { label: 'Qwen3.5 4B (MLX) - 軽量', value: 'mlx-community/Qwen3.5-4B-MLX-4bit' },
] as const;

interface LLMFallbackSettingsProps {
  settings: ParceraSettings;
  defaultSettings?: ParceraSettings;
  isWindows: boolean;
  updateNested: (section: keyof ParceraSettings, key: string, value: unknown) => void;
  setStatus: (status: { message: string; type: '' | 'error' | 'success' }) => void;
}

/**
 * Renders configuration for the optional secondary (fallback) LLM used when
 * the primary LLM hits rate limits or times out.
 */
export const LLMFallbackSettings: React.FC<LLMFallbackSettingsProps> = ({
  settings,
  defaultSettings,
  isWindows,
  updateNested,
  setStatus,
}) => {
  const fallback: LLMFallbackConfig = settings.llm?.fallback ?? {};
  const fbProvider = fallback.provider || '';
  const cooldownHours = Math.max(1, Math.round((fallback.cooldown_seconds ?? 10800) / 3600));
  const providerCfg: LLMProviderConfig = (fbProvider && fallback.providers?.[fbProvider]) || {};

  const activeApiKey = fbProvider && fbProvider !== 'local' ? providerCfg.api_key : undefined;
  const { models, isFetchingModels, retryModels } = useLLMModels(
    fbProvider || 'gemini',
    activeApiKey
  );

  const updateFallbackField = (patch: Partial<LLMFallbackConfig>) => {
    updateNested('llm', 'fallback', {
      ...fallback,
      ...patch,
    });
  };

  const updateFallbackProviderField = (field: keyof LLMProviderConfig, value: unknown) => {
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

  const handleFetchModels = () => {
    if (!activeApiKey) {
      setStatus({ message: 'APIキーを入力してからモデル一覧を取得してください。', type: 'error' });
      return;
    }
    retryModels();
  };

  return (
    <div className="space-y-4 rounded-md border border-border/60 bg-muted/20 p-4">
      <div>
        <h5 className="text-sm font-semibold">フォールバックLLM（2nd）</h5>
        <p className="text-xs text-muted-foreground mt-0.5">
          1stのLLMが利用制限（429）やタイムアウトで失敗したときに自動で切り替えます。
        </p>
      </div>

      <FieldRow label="フォールバック先プロバイダー">
        <Select
          value={fbProvider || '__none__'}
          onValueChange={(val) => updateFallbackField({ provider: val === '__none__' ? '' : val })}
        >
          <SelectTrigger aria-label="フォールバック先プロバイダー">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">使用しない（1stのみ）</SelectItem>
            <SelectItem value="gemini">Google Gemini</SelectItem>
            <SelectItem value="openai">OpenAI（GPT-4o等）</SelectItem>
            {!isWindows && (
              <SelectItem value="local">Local Brain（Gemma / Qwen / MLX）</SelectItem>
            )}
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

          {fbProvider === 'local' ? (
            <>
              <FieldRow label="モデル">
                <Select
                  value={providerCfg.model ?? LOCAL_MODEL_PRESETS[0].value}
                  onValueChange={(val) => updateFallbackProviderField('model', val)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LOCAL_MODEL_PRESETS.map((p) => (
                      <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FieldRow>
              <FieldRow label="最大出力トークン数">
                <Input
                  type="number"
                  value={providerCfg.max_tokens ?? defaultSettings?.llm?.providers?.local?.max_tokens ?? 150}
                  onChange={(e) => updateFallbackProviderField('max_tokens', Number(e.target.value))}
                />
              </FieldRow>
            </>
          ) : (
            <>
              <FieldRow label="APIキー">
                <PasswordField
                  value={providerCfg.api_key ?? ''}
                  onChange={(v) => updateFallbackProviderField('api_key', v)}
                  placeholder="API Key"
                  actionButton={
                    <Button variant="outline" size="sm" onClick={handleFetchModels} disabled={isFetchingModels}>
                      モデル取得
                    </Button>
                  }
                />
              </FieldRow>

              <FieldRow label="モデル">
                <Select
                  value={providerCfg.model ?? ''}
                  onValueChange={(val) => {
                    updateFallbackProviderField('model', val);
                  }}
                  disabled={isFetchingModels || !models?.length}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="モデルを選択" />
                  </SelectTrigger>
                  <SelectContent>
                    {models?.map((m: string) => (
                      <SelectItem key={m} value={m}>{m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FieldRow>

              <FieldRow label="思考レベル">
                <Select
                  value={providerCfg.thinking_level || '__default__'}
                  onValueChange={(val) =>
                    updateFallbackProviderField('thinking_level', val === '__default__' ? '' : val)
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__default__">デフォルト（モデル標準）</SelectItem>
                    <SelectItem value="low">low（速度優先・日常会話向け）</SelectItem>
                    <SelectItem value="medium">medium（バランス）</SelectItem>
                    <SelectItem value="high">high（精度・推論重視／応答は遅め）</SelectItem>
                  </SelectContent>
                </Select>
              </FieldRow>
            </>
          )}
        </>
      )}
    </div>
  );
};
