import React, { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import type { TwitchSettings } from '../../../shared/types';
import { SectionProps } from './types';
import { FieldRow, PasswordField } from './shared';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Label } from '../ui/label';
import { Input } from '../ui/input';
import { Switch } from '../ui/switch';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Separator } from '../ui/separator';
import { useTwitchAuth } from '../../hooks/useTwitchAuth';

export const IntegrationSection: React.FC<SectionProps> = ({
  settings,
  defaultSettings,
  updateNested,
  setStatus,
}) => {
  const { isAuthorized, handleStartAuth, handleClearAuth } = useTwitchAuth(setStatus);
  const [sessionId, setSessionId] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthorized) return;
    const fetchStatus = async () => {
      try {
        const status = await api.getTwitchStatus();
        if (status?.session_id) setSessionId(status.session_id);
      } catch {
        // ignore
      }
    };
    fetchStatus();
    const interval = setInterval(() => {
      if (sessionId) clearInterval(interval);
      else fetchStatus();
    }, 10000);
    return () => clearInterval(interval);
  }, [isAuthorized, !!sessionId]);

  const tw = settings.twitch || {};
  const twDefault = defaultSettings?.twitch || {};

  const handleTestEvent = async (type: string) => {
    try {
      await api.twitchTestEvent(type);
    } catch {
      // ignore
    }
  };

  return (
    <div className="space-y-6">
      {/* Twitch */}
      <Card>
        <CardHeader>
          <CardTitle>Twitch</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* 有効化 */}
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm font-medium">Twitch連携を有効にする</Label>
              <p className="text-xs text-muted-foreground">Twitchチャットへの自動応答や配信イベントへの反応を有効にします。</p>
            </div>
            <Switch
              checked={tw.enabled ?? false}
              onCheckedChange={(v) => updateNested('twitch', 'enabled', v)}
            />
          </div>

          <Separator />

          {/* 認証 */}
          <div className="space-y-4">
            <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">認証</h4>
            <FieldRow label="Client ID">
              <Input
                value={tw.client_id || ''}
                onChange={(e) => updateNested('twitch', 'client_id', e.target.value)}
                placeholder="Twitch App Client ID"
              />
            </FieldRow>
            <FieldRow label="Client Secret">
              <PasswordField
                value={tw.client_secret || ''}
                onChange={(v) => updateNested('twitch', 'client_secret', v)}
                placeholder="Twitch App Client Secret"
              />
            </FieldRow>
            <p className="text-xs text-muted-foreground">
              <a
                href="https://dev.twitch.tv/console"
                target="_blank"
                rel="noopener noreferrer"
                className="underline"
              >
                Twitch Developer Console
              </a>
              のアプリ設定で OAuth Redirect URL に{' '}
              <code className="bg-muted px-1 rounded text-xs">http://localhost:8678/auth/callback</code>{' '}
              を登録してください。
            </p>
            <div className="flex items-center gap-3 mt-2">
              {isAuthorized ? (
                <>
                  <Badge variant="success">認証済み</Badge>
                  {sessionId && <Badge variant="success">EventSub 接続済み</Badge>}
                  <Button variant="outline" size="sm" onClick={handleClearAuth}>連携を解除</Button>
                </>
              ) : (
                <Button
                  onClick={handleStartAuth}
                  disabled={!tw.client_id || !tw.client_secret}
                  size="sm"
                >
                  Twitchと連携を開始
                </Button>
              )}
            </div>
          </div>

          <Separator />

          {/* 反応するイベント */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">反応するイベント</h4>
            {(
              [
                { key: 'react_to_follow', label: 'フォローに反応する', eventType: 'follow' },
                { key: 'react_to_subscribe', label: 'サブスクライブに反応する', eventType: 'subscribe' },
                { key: 'react_to_raid', label: 'レイドに反応する', eventType: 'raid' },
              ] as Array<{ key: 'react_to_follow' | 'react_to_subscribe' | 'react_to_raid'; label: string; eventType: string }>
            ).map(({ key, label, eventType }) => (
              <div key={key} className="flex items-center justify-between">
                <Label>{label}</Label>
                <div className="flex items-center gap-2">
                  {sessionId && isAuthorized && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs h-7 px-2 text-muted-foreground"
                      onClick={() => handleTestEvent(eventType)}
                    >
                      テスト
                    </Button>
                  )}
                  <Switch
                    checked={tw[key] !== false}
                    onCheckedChange={(v) => updateNested('twitch', key, v)}
                  />
                </div>
              </div>
            ))}
          </div>

          <Separator />

          {/* フィルター */}
          <div className="space-y-4">
            <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">フィルター</h4>
            <FieldRow label="Wake Word（正規表現）">
              <Input
                value={tw.wake_word || ''}
                onChange={(e) => updateNested('twitch', 'wake_word', e.target.value)}
                placeholder={twDefault.wake_word || ''}
              />
            </FieldRow>
            <FieldRow label="無視するユーザー">
              <Input
                value={(tw.ignored_users || []).join(', ')}
                onChange={(e) =>
                  updateNested('twitch', 'ignored_users', e.target.value.split(',').map((s) => s.trim()).filter(Boolean))
                }
                placeholder="カンマ区切り (例: Nightbot, Moobot)"
              />
            </FieldRow>
            <FieldRow label="NGワード（正規表現・カンマ区切り）">
              <Input
                value={(tw.ng_words || []).join(', ')}
                onChange={(e) =>
                  updateNested('twitch', 'ng_words', e.target.value.split(',').map((s) => s.trim()).filter(Boolean))
                }
                placeholder=""
              />
            </FieldRow>
          </div>

          <Separator />

          {/* 詳細 — 格下げカード */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Separator className="flex-1" />
              <span className="text-xs text-muted-foreground/60 shrink-0">詳細</span>
              <Separator className="flex-1" />
            </div>
            <div className="rounded-lg bg-card/50 border border-border/50 p-4 space-y-4">
              <FieldRow label="反応までの待ち時間">
                <Select
                  value={tw.response_speed || 'natural'}
                  onValueChange={(v) => updateNested('twitch', 'response_speed', v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="instant">なし</SelectItem>
                    <SelectItem value="fast">短め</SelectItem>
                    <SelectItem value="natural">標準</SelectItem>
                    <SelectItem value="slow">長め</SelectItem>
                  </SelectContent>
                </Select>
              </FieldRow>
              <div className="grid grid-cols-2 gap-4">
                <FieldRow label="同一ユーザーのクールダウン（秒）">
                  <Input
                    type="number"
                    value={tw.user_cooldown ?? twDefault.user_cooldown ?? 60}
                    onChange={(e) => updateNested('twitch', 'user_cooldown', Number(e.target.value))}
                  />
                </FieldRow>
                <FieldRow label="全体のクールダウン（秒）">
                  <Input
                    type="number"
                    value={tw.global_cooldown ?? twDefault.global_cooldown ?? 30}
                    onChange={(e) => updateNested('twitch', 'global_cooldown', Number(e.target.value))}
                  />
                </FieldRow>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <FieldRow label="キューの最大数">
                  <Input
                    type="number"
                    value={tw.max_queue_size ?? twDefault.max_queue_size ?? 5}
                    onChange={(e) => updateNested('twitch', 'max_queue_size', Number(e.target.value))}
                  />
                </FieldRow>
                <FieldRow label="メッセージの有効期限（秒）">
                  <Input
                    type="number"
                    value={tw.queue_expiry_seconds ?? twDefault.queue_expiry_seconds ?? 120}
                    onChange={(e) => updateNested('twitch', 'queue_expiry_seconds', Number(e.target.value))}
                  />
                </FieldRow>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

