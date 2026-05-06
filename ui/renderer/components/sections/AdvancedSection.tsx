import React, { useEffect } from 'react';
import { api } from '../../lib/api';
import { SectionProps } from './types';
import { FieldRow, PasswordField } from './shared';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Label } from '../ui/label';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Switch } from '../ui/switch';
import { useLLMModels } from '../../hooks/useLLMModels';
import { useOptionalPackageInstaller, OptionalPackageInstallerUI } from '../settings/controls/OptionalPackageInstaller';
import { ModelDownloaderUI, useModelDownloader } from '../settings/controls/ModelDownloader';
import { LocalLLMProfileManager } from '../settings/LocalLLMProfileManager';

const LOCAL_MODEL_PRESETS = [
  { label: 'Gemma 4 4B (MLX)', value: 'mlx-community/gemma-4-e4b-it-4bit' },
  { label: 'Gemma 2 9B (MLX)', value: 'mlx-community/gemma-2-9b-it-4bit' },
  { label: 'Qwen3.5 9B (MLX)', value: 'mlx-community/Qwen3.5-9B-MLX-4bit' },
  { label: 'Qwen3.5 4B (MLX) - 軽量', value: 'mlx-community/Qwen3.5-4B-MLX-4bit' },
] as const;

const OPTIONAL_STT_PROVIDERS = ['moonshine', 'faster_whisper'] as const;
type OptionalSTTProvider = typeof OPTIONAL_STT_PROVIDERS[number];

const OPTIONAL_PACKAGE_META: Record<OptionalSTTProvider, { sizeMb: number; description: string }> = {
  moonshine: { sizeMb: 120, description: 'Moonshine を使用するには追加ライブラリが必要です' },
  faster_whisper: { sizeMb: 200, description: 'Faster Whisper を使用するには追加ライブラリが必要です' },
};

const LocalModelDownloader: React.FC<{ modelName: string; port: number }> = ({ modelName, port }) => {
  const downloader = useModelDownloader(modelName, port);
  return (
    <ModelDownloaderUI
      status={downloader.modelStatus}
      progress={downloader.progress}
      progressDetail={downloader.progressDetail}
      errorMsg={downloader.errorMsg}
      onDownload={downloader.handleDownload}
      notCachedDescription="ローカルでの推論にはモデルのダウンロードが必要です（約6GB）。安定したネット環境で実行してください。"
    />
  );
};

const OptionalPackageCheck: React.FC<{ provider: OptionalSTTProvider; port: number }> = ({ provider, port }) => {
  const { status, progress, errorMsg, handleInstall } = useOptionalPackageInstaller(provider, port);
  const { sizeMb, description } = OPTIONAL_PACKAGE_META[provider];
  if (status === 'installed') return null;
  return (
    <OptionalPackageInstallerUI
      status={status}
      progress={progress}
      errorMsg={errorMsg}
      onInstall={handleInstall}
      sizeMb={sizeMb}
      description={description}
    />
  );
};

const ObsUrlRow: React.FC<{ label: string; url: string }> = ({ label, url }) => {
  const handleCopy = async () => {
    await navigator.clipboard.writeText(url);
  };
  return (
    <div className="flex items-center gap-2">
      <Label className="w-28 shrink-0 text-xs">{label}</Label>
      <code className="flex-1 truncate rounded bg-muted px-2 py-1 text-xs font-mono">{url}</code>
      <Button variant="outline" size="sm" onClick={handleCopy}>コピー</Button>
    </div>
  );
};

export const AdvancedSection: React.FC<SectionProps> = ({
  settings,
  defaultSettings,
  updateNested,
  updateProvider,
  setStatus,
}) => {
  const currentLLMProvider = settings.llm?.provider || 'gemini';
  const apiKey = settings.llm?.providers?.[currentLLMProvider]?.api_key;
  const { models, error: llmError, isFetchingModels, retryModels } = useLLMModels(currentLLMProvider, apiKey);

  useEffect(() => {
    if (llmError) {
      setStatus({ message: `モデル取得エラー: ${llmError.message}`, type: 'error' });
    }
  }, [llmError, setStatus]);

  const handleFetchModels = () => {
    if (!apiKey) {
      setStatus({ message: 'APIキーを入力してからモデル一覧を取得してください。', type: 'error' });
      return;
    }
    retryModels();
  };

  const currentSTTProvider = settings.stt?.provider || 'moonshine';
  const currentTTSProvider = settings.tts?.provider || 'aivisspeech';
  const port = settings.app?.port || 8676;
  const frontendPort = (settings.app as any)?.frontend_port || (port + 1);
  const isWindows = api.platform === 'win32';

  // obs.html is served by the Python server (port=8676) so it does not depend
  // on the Tauri localhost plugin. OBS loads it once; WebSocket reconnection
  // handles Parcera restarts without a manual browser-source refresh.
  const obsAiUrl = `http://localhost:${frontendPort}/?type=ai&obs=1`;
  const obsUserUrl = `http://localhost:${port}/obs.html?type=user`;

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
                  {!isWindows && (
                    <SelectItem value="local">Local Brain（Gemma / Qwen / MLX）</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </FieldRow>

            {currentLLMProvider === 'local' ? (
              <>
                <LocalModelDownloader
                  modelName={settings.llm?.providers?.local?.model ?? LOCAL_MODEL_PRESETS[0].value}
                  port={port}
                />
                <FieldRow label="モデル">
                  <Select
                    value={settings.llm?.providers?.local?.model ?? LOCAL_MODEL_PRESETS[0].value}
                    onValueChange={(val) => updateProvider('llm', 'local', 'model', val)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {LOCAL_MODEL_PRESETS.map(p => (
                        <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FieldRow>
                <FieldRow label="最大出力トークン数">
                  <Input
                    type="number"
                    value={settings.llm?.providers?.local?.max_tokens ?? defaultSettings?.llm?.providers?.local?.max_tokens ?? 200}
                    onChange={(e) => updateProvider('llm', 'local', 'max_tokens', Number(e.target.value))}
                  />
                </FieldRow>
              </>
            ) : (
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
              <div className="flex items-start justify-between pt-6 gap-4">
                <div>
                  <Label>会話履歴を保持</Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    有効にすると文脈精度が上がりますが、トークン消費・コスト・応答速度に影響します。長時間使用では定期的なリセットを推奨。
                  </p>
                </div>
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

            {OPTIONAL_STT_PROVIDERS.includes(currentSTTProvider as OptionalSTTProvider) && (
              <OptionalPackageCheck
                provider={currentSTTProvider as OptionalSTTProvider}
                port={port}
              />
            )}

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

      {/* 追加学習 — Local LLM 選択時のみ表示 */}
      {currentLLMProvider === 'local' && (
        <LocalLLMProfileManager
          settings={settings}
          updateProvider={updateProvider}
          port={port}
          setStatus={setStatus}
        />
      )}

      {/* OBS Browser Source */}
      <Card>
        <CardHeader>
          <CardTitle>OBS Browser Source URL</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">
            OBS の「ブラウザソース」に以下の URL を貼り付けることで、ウィンドウキャプチャなしにアバターを配信へ組み込めます。
          </p>
          <ObsUrlRow label="AI アバター" url={obsAiUrl} />
          <ObsUrlRow label="User アバター" url={obsUserUrl} />
          <p className="text-xs text-muted-foreground">
            User アバターは独立した静的ページです。Parcera を再起動しても WebSocket が自動的に再接続するため、OBS 側の手動更新は不要です。
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

