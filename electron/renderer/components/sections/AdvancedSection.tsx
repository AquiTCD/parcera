import React from 'react';
import { SectionProps } from './types';
import { FieldRow, PasswordField } from './shared';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Label } from '../ui/label';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Switch } from '../ui/switch';
import { TrainingTab } from '../settings/TrainingTab';
import { useLLMModels } from '../../hooks/useLLMModels';

export const AdvancedSection: React.FC<SectionProps> = ({
  settings,
  defaultSettings,
  updateNested,
  updateProvider,
  setStatus,
}) => {
  const currentLLMProvider = settings.llm?.provider || 'gemini';
  const apiKey = settings.llm?.providers?.[currentLLMProvider]?.api_key;
  const { models, isFetchingModels, retryModels } = useLLMModels(currentLLMProvider, apiKey);

  const handleFetchModels = () => {
    if (!apiKey) {
      setStatus({ message: 'APIキーを入力してからモデル一覧を取得してください。', type: 'error' });
      return;
    }
    retryModels();
  };

  const currentSTTProvider = settings.stt?.provider || 'moonshine';
  const currentTTSProvider = settings.tts?.provider || 'aivisspeech';

  return (
    <div className="space-y-6">
      {/* AIモデル・プロバイダー */}
      <Card>
        <CardHeader>
          <CardTitle>AIモデル・プロバイダー</CardTitle>
        </CardHeader>
        <CardContent className="space-y-8">
          {/* LLM */}
          <div className="space-y-4">
            <h4 className="text-sm font-semibold border-b border-border pb-2">LLM</h4>

            <FieldRow label="プロバイダー">
              <Select
                value={settings.llm?.provider ?? 'gemini'}
                onValueChange={(val) => updateNested('llm', 'provider', val)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="gemini">Google Gemini（推奨）</SelectItem>
                  <SelectItem value="openai">OpenAI（GPT-4o等）</SelectItem>
                  <SelectItem value="local">Local Brain（Gemma 2 / MLX）</SelectItem>
                </SelectContent>
              </Select>
            </FieldRow>

            {currentLLMProvider !== 'local' && (
              <>
                <FieldRow label="APIキー">
                  <PasswordField
                    value={settings.llm?.providers?.[currentLLMProvider]?.api_key ?? ''}
                    onChange={(v) => updateProvider('llm', currentLLMProvider, 'api_key', v)}
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
                    value={settings.llm?.providers?.[currentLLMProvider]?.model ?? ''}
                    onValueChange={(val) => updateProvider('llm', currentLLMProvider, 'model', val)}
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
              </>
            )}

            <div className="grid grid-cols-2 gap-4">
              <FieldRow label="文章の分割文字数">
                <Input
                  type="number"
                  value={settings.llm?.providers?.[currentLLMProvider]?.option_split_threshold ?? defaultSettings?.llm?.providers?.[currentLLMProvider]?.option_split_threshold ?? 50}
                  onChange={(e) => updateProvider('llm', currentLLMProvider, 'option_split_threshold', Number(e.target.value))}
                />
              </FieldRow>
              <div className="flex items-center justify-between pt-6">
                <Label>会話履歴を保持</Label>
                <Switch
                  checked={settings.llm?.providers?.[currentLLMProvider]?.persist_history ?? false}
                  onCheckedChange={(v) => updateProvider('llm', currentLLMProvider, 'persist_history', v)}
                />
              </div>
            </div>
          </div>

          {/* STT */}
          <div className="space-y-4">
            <h4 className="text-sm font-semibold border-b border-border pb-2">STT</h4>

            <FieldRow label="プロバイダー">
              <Select
                value={settings.stt?.provider ?? 'moonshine'}
                onValueChange={(val) => updateNested('stt', 'provider', val)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="moonshine">Moonshine（超低遅延・高速 / オススメ）</SelectItem>
                  <SelectItem value="faster_whisper">Faster Whisper（ローカル）</SelectItem>
                  <SelectItem value="google">Google Cloud STT</SelectItem>
                  <SelectItem value="azure">Azure Speech to Text</SelectItem>
                </SelectContent>
              </Select>
            </FieldRow>

            {currentSTTProvider === 'faster_whisper' && (
              <>
                <FieldRow label="モデル（HuggingFace形式）">
                  <Input
                    value={settings.stt?.providers?.faster_whisper?.model ?? ''}
                    onChange={(e) => updateProvider('stt', 'faster_whisper', 'model', e.target.value)}
                    placeholder={defaultSettings?.stt?.providers?.faster_whisper?.model}
                  />
                </FieldRow>
                <div className="grid grid-cols-2 gap-4">
                  <FieldRow label="演算デバイス">
                    <Select
                      value={settings.stt?.providers?.faster_whisper?.device ?? 'auto'}
                      onValueChange={(v) => updateProvider('stt', 'faster_whisper', 'device', v)}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="auto">Auto</SelectItem>
                        <SelectItem value="cpu">CPU</SelectItem>
                        <SelectItem value="cuda">CUDA (NVIDIA GPU)</SelectItem>
                      </SelectContent>
                    </Select>
                  </FieldRow>
                  <FieldRow label="量子化">
                    <Select
                      value={settings.stt?.providers?.faster_whisper?.compute_type ?? 'default'}
                      onValueChange={(v) => updateProvider('stt', 'faster_whisper', 'compute_type', v)}
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

            {(currentSTTProvider === 'google' || currentSTTProvider === 'azure') && (
              <FieldRow label="APIキー">
                <PasswordField
                  value={settings.stt?.providers?.[currentSTTProvider]?.api_key ?? ''}
                  onChange={(v) => updateProvider('stt', currentSTTProvider, 'api_key', v)}
                />
              </FieldRow>
            )}
          </div>

          {/* TTS接続設定 */}
          <div className="space-y-4">
            <h4 className="text-sm font-semibold border-b border-border pb-2">TTS接続設定</h4>

            {(currentTTSProvider === 'aivisspeech' || currentTTSProvider === 'voicevox') && (
              <>
                <FieldRow label="エンジンのAPI URL">
                  <Input
                    value={settings.tts?.providers?.[currentTTSProvider as 'aivisspeech' | 'voicevox']?.api_url ?? ''}
                    onChange={(e) => updateProvider('tts', currentTTSProvider, 'api_url', e.target.value)}
                    placeholder={defaultSettings?.tts?.providers?.[currentTTSProvider as 'aivisspeech' | 'voicevox']?.api_url}
                  />
                </FieldRow>
                <FieldRow label="エンジン起動パス">
                  <Input
                    value={settings.tts?.providers?.[currentTTSProvider as 'aivisspeech' | 'voicevox']?.engine_path ?? ''}
                    onChange={(e) => updateProvider('tts', currentTTSProvider, 'engine_path', e.target.value)}
                    placeholder="空なら自動起動しません"
                  />
                </FieldRow>
              </>
            )}

            {currentTTSProvider === 'google' && (
              <FieldRow label="Google Cloud TTS APIキー">
                <PasswordField
                  value={settings.tts?.providers?.google?.api_key ?? ''}
                  onChange={(v) => updateProvider('tts', 'google', 'api_key', v)}
                />
              </FieldRow>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 追加学習 */}
      <Card>
        <CardHeader>
          <CardTitle>追加学習</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground mb-4">
            Mac / Apple Silicon 専用。LoRAファインチューニングによる追加学習。
          </p>
          <TrainingTab settings={settings} />
        </CardContent>
      </Card>
    </div>
  );
};

