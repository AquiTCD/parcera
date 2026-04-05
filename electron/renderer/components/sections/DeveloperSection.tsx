import React, { useEffect, useRef, useState } from 'react';
import { SectionProps } from './types';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Label } from '../ui/label';
import { Input } from '../ui/input';
import { Switch } from '../ui/switch';
import { Button } from '../ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import type { SidecarLogMessage } from '../../../shared/types';

export const DeveloperSection: React.FC<SectionProps> = ({
  settings,
  defaultSettings,
  updateRoot,
  updateNested,
}) => {
  const [logs, setLogs] = useState<SidecarLogMessage[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    window.electronAPI.getLogHistory().then((history) => {
      setLogs(history.slice(-100));
    });
    return window.electronAPI.onLogMessage((log) => {
      setLogs((prev) => [...prev.slice(-100), log]);
    });
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  return (
    <div className="space-y-6">
      {/* ログビューア */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>ログビューア</CardTitle>
            <Button variant="outline" size="sm" onClick={() => setLogs([])}>
              表示ログをクリア
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div
            ref={scrollRef}
            className="log-viewer bg-stone-950 border border-border rounded-md p-3 h-64 overflow-y-auto text-xs font-mono"
          >
            {logs.length === 0 && (
              <div className="text-muted-foreground/50">ログを待機中...</div>
            )}
            {logs.map((log, i) => {
              const cleanText = log.text.replace(/\x1b\[[0-9;]*m/g, '');
              let color = 'text-stone-400';
              if (log.source === 'stderr') color = 'text-red-400';
              else if (cleanText.includes('[USER]')) color = 'text-cyan-400';
              else if (cleanText.includes('[AI]')) color = 'text-green-400';
              else if (cleanText.includes('[Twitch Chat]') || (cleanText.includes('[Twitch]') && !cleanText.includes('Event'))) color = 'text-yellow-400';
              else if (cleanText.includes('[Twitch Raid]') || cleanText.includes('[Twitch Follow]') || cleanText.includes('[Twitch Subscribe]')) color = 'text-purple-400';
              else if (cleanText.includes('(ignored)')) color = 'text-stone-600';

              return (
                <div key={i} className="mb-1">
                  <span className="text-stone-600 mr-2">[{log.timestamp}]</span>
                  <span className={color}>{cleanText}</span>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* ログ設定 */}
      <Card>
        <CardHeader>
          <CardTitle>ログ設定</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <FieldRow label="ログ出力レベル">
            <Select
              value={settings.log_level ?? defaultSettings?.log_level ?? 'INFO'}
              onValueChange={(v) => updateRoot('log_level', v)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="INFO">INFO（標準: 正常動作・エラー）</SelectItem>
                <SelectItem value="WARNING">WARNING（少なめ: 警告・エラーのみ）</SelectItem>
                <SelectItem value="ERROR">ERROR（最小: エラー発生時のみ）</SelectItem>
                <SelectItem value="DEBUG">DEBUG（開発用: すべてのデバッグ出力）</SelectItem>
              </SelectContent>
            </Select>
          </FieldRow>

          <div className="flex items-center justify-between">
            <div>
              <Label>シンプルログモード</Label>
              <p className="text-xs text-muted-foreground">システムログを非表示にし、会話ログのみを表示します。</p>
            </div>
            <Switch
              checked={settings.simple_log ?? false}
              onCheckedChange={(v) => updateRoot('simple_log', v)}
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label>パフォーマンス計測ログを表示（[PERF]）</Label>
            </div>
            <Switch
              checked={settings.profile_mode ?? false}
              onCheckedChange={(v) => updateRoot('profile_mode', v)}
            />
          </div>
        </CardContent>
      </Card>

      {/* システム設定 */}
      <Card>
        <CardHeader>
          <CardTitle>システム設定</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <FieldRow label="WebSocketポート番号">
            <Input
              type="number"
              value={settings.electron?.port ?? defaultSettings?.electron?.port ?? 8676}
              onChange={(e) => updateNested('electron', 'port', Number(e.target.value))}
            />
            <p className="text-xs text-muted-foreground mt-1">変更後は再起動が必要です。</p>
          </FieldRow>

          <FieldRow label="内部音声サンプリングレート (Hz)">
            <Select
              value={String(settings.electron?.ai_audio_sample_rate ?? 16000)}
              onValueChange={(v) => updateNested('electron', 'ai_audio_sample_rate', Number(v))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="16000">16,000 Hz（TTS標準）</SelectItem>
                <SelectItem value="24000">24,000 Hz</SelectItem>
                <SelectItem value="32000">32,000 Hz</SelectItem>
                <SelectItem value="44100">44,100 Hz（CD音質）</SelectItem>
                <SelectItem value="48000">48,000 Hz（DVD音質）</SelectItem>
              </SelectContent>
            </Select>
          </FieldRow>

          <div className="flex items-center justify-between">
            <div>
              <Label>GPUアクセラレーション</Label>
              <p className="text-xs text-muted-foreground">OBSキャプチャで問題がある場合はOFFにして再起動。</p>
            </div>
            <Switch
              checked={settings.electron?.gpu_acceleration ?? true}
              onCheckedChange={(v) => updateNested('electron', 'gpu_acceleration', v)}
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label>デバッグ情報表示</Label>
              <p className="text-xs text-muted-foreground">アバターウィンドウへのピークメーター・状態テキストを表示。</p>
            </div>
            <Switch
              checked={settings.avatars?.show_debug ?? false}
              onCheckedChange={(v) => updateNested('avatars', 'show_debug', v)}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

const FieldRow: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="space-y-1.5">
    <Label className="text-sm font-medium">{label}</Label>
    {children}
  </div>
);
