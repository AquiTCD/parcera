import React, { useState, useEffect } from 'react';
import { SectionProps } from './types';
import { FieldRow, SliderRow } from './shared';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Label } from '../ui/label';
import { Input } from '../ui/input';
import { Switch } from '../ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';

export const MicInputSection: React.FC<SectionProps> = ({
  settings,
  defaultSettings,
  updateRoot,
  updateNested,
}) => {
  const [devices, setDevices] = useState<{ value: string; label: string }[]>([
    { value: 'default', label: 'システムデフォルト' },
  ]);

  useEffect(() => {
    const fetchDevices = async () => {
      try {
        const all = await navigator.mediaDevices.enumerateDevices();
        const audioInputs = all
          .filter((d) => d.kind === 'audioinput')
          .map((d) => ({ value: d.deviceId, label: d.label || 'Microphone' }))
          .filter((v, i, a) => v.value && a.findIndex((t) => t.value === v.value) === i);
        setDevices([
          { value: 'default', label: 'システムデフォルト' },
          ...audioInputs.filter((d) => d.value !== 'default' && d.value !== ''),
        ]);
      } catch {
        // silently ignore — device list stays as default
      }
    };
    fetchDevices();
    navigator.mediaDevices.addEventListener('devicechange', fetchDevices);
    return () => navigator.mediaDevices.removeEventListener('devicechange', fetchDevices);
  }, []);

  const volumeDb = settings.vad?.volume_db_threshold ?? defaultSettings?.vad?.volume_db_threshold ?? -20;
  const silenceDuration = settings.vad?.silence_duration_threshold ?? defaultSettings?.vad?.silence_duration_threshold ?? 0.8;
  const maxDuration = settings.vad?.max_duration ?? defaultSettings?.vad?.max_duration ?? 30;
  const mergeThreshold = settings.merge_request_threshold ?? defaultSettings?.merge_request_threshold ?? 0.5;

  return (
    <div className="space-y-6">
      {/* 感度 */}
      <Card>
        <CardHeader>
          <CardTitle>感度</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <FieldRow label="使用するマイク">
            <Select
              value={settings.app?.mic_device_id ?? 'default'}
              onValueChange={(val) => updateNested('app', 'mic_device_id', val)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {devices.map((d) => (
                  <SelectItem key={d.value} value={d.value}>
                    {d.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FieldRow>

          <div className="flex items-center justify-between">
            <Label>起動時ミュート</Label>
            <Switch
              checked={settings.vad?.start_muted ?? false}
              onCheckedChange={(checked) => updateNested('vad', 'start_muted', checked)}
            />
          </div>

          <SliderRow
            label="音量閾値 (dB)"
            description="発話と判定する最小音量レベル。0 に近いほど反応が鈍くなります。"
            value={volumeDb}
            min={-60}
            max={0}
            step={1}
            unit=" dB"
            onChange={(val) => updateNested('vad', 'volume_db_threshold', val)}
          />
        </CardContent>
      </Card>

      {/* 無音判定 */}
      <Card>
        <CardHeader>
          <CardTitle>無音判定</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <FieldRow label="発話終了判定の無音時間 (秒)">
              <Input
                type="number"
                step="0.1"
                value={silenceDuration}
                onChange={(e) => updateNested('vad', 'silence_duration_threshold', Number(e.target.value))}
                placeholder={String(defaultSettings?.vad?.silence_duration_threshold ?? 0.8)}
              />
            </FieldRow>
            <FieldRow label="最大録音時間 (秒)">
              <Input
                type="number"
                step="1"
                value={maxDuration}
                onChange={(e) => updateNested('vad', 'max_duration', Number(e.target.value))}
                placeholder={String(defaultSettings?.vad?.max_duration ?? 30)}
              />
            </FieldRow>
          </div>
        </CardContent>
      </Card>

      {/* 音声連結 */}
      <Card>
        <CardHeader>
          <CardTitle>音声連結</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <FieldRow label="発話の結合待機時間 (秒)">
            <Input
              type="number"
              step="0.1"
              value={mergeThreshold}
              onChange={(e) => updateRoot('merge_request_threshold', Number(e.target.value))}
              placeholder={String(defaultSettings?.merge_request_threshold ?? 0.5)}
            />
          </FieldRow>
          <FieldRow label="無視するフレーズ">
            <Input
              value={settings.stt?.ignore_sentences?.join(', ') ?? ''}
              onChange={(e) =>
                updateNested(
                  'stt',
                  'ignore_sentences',
                  e.target.value.split(',').map((s) => s.trim()).filter(Boolean)
                )
              }
              placeholder="カンマ区切りで複数指定"
            />
          </FieldRow>
        </CardContent>
      </Card>
    </div>
  );
};

