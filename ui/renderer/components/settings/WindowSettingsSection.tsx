import React from 'react';
import { api } from '../../lib/api';
import { ParceraSettings } from '../../../shared/types';
import { Label } from '../ui/label';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { Switch } from '../ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';

type StatusMessage = { message: string; type: 'success' | 'error' | '' };

interface WindowSettingsSectionProps {
  type: 'user' | 'ai';
  settings: ParceraSettings;
  defaultSettings?: ParceraSettings;
  updateNested: (category: keyof ParceraSettings, key: string, value: unknown) => void;
  setStatus?: (status: StatusMessage) => void;
}

export const WindowSettingsSection: React.FC<WindowSettingsSectionProps> = ({
  type,
  settings,
  defaultSettings,
  updateNested,
  setStatus,
}) => {
  const winParams = settings.app?.windows?.[type] || {};
  const defaultWinParams = defaultSettings?.app?.windows?.[type] || {};
  const labelPrefix = type === 'user' ? 'USER' : 'AI';
  const isVisible = winParams.visible ?? true;

  const updateWinParam = (key: string, value: unknown) => {
    updateNested('app', 'windows', {
      ...settings.app?.windows,
      [type]: { ...winParams, [key]: value },
    });
  };

  const handleVisibleChange = (checked: boolean) => {
    updateWinParam('visible', checked);
  };

  return (
    <div className="space-y-3">
      <h5 className="text-sm font-semibold text-foreground">{labelPrefix}ウィンドウ</h5>

      <div className="flex items-center justify-between">
        <Label className="text-sm">アバターウィンドウを表示する</Label>
        <Switch
          checked={isVisible}
          onCheckedChange={handleVisibleChange}
        />
      </div>

      <div className={`space-y-3 ${!isVisible ? 'pointer-events-none opacity-40' : ''}`}>
        <div className="flex items-center justify-between">
          <Label className="text-sm">常に最前面に表示する</Label>
          <Switch
            checked={winParams.alwaysOnTop ?? false}
            onCheckedChange={(checked) => updateWinParam('alwaysOnTop', checked)}
            disabled={!isVisible}
          />
        </div>

        <div className="flex items-center justify-between">
          <Label className="text-sm">起動時にウィンドウ位置をロックする</Label>
          <Switch
            checked={winParams.locked ?? defaultWinParams.locked ?? false}
            onCheckedChange={(checked) => updateWinParam('locked', checked)}
            disabled={!isVisible}
          />
        </div>

        <Button
          variant="outline"
          size="sm"
          className="w-full text-xs"
          disabled={!isVisible}
          onClick={async () => {
            const bounds = await api.getAvatarWindowBounds(type);
            if (bounds) {
              updateNested('app', 'windows', {
                ...settings.app?.windows,
                [type]: { ...winParams, x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height },
              });
            } else {
              setStatus?.({ message: `${labelPrefix}ウィンドウが見つかりません`, type: 'error' });
            }
          }}
        >
          現在の{labelPrefix}ウィンドウの座標・サイズを取得
        </Button>

        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">X座標</Label>
            <Input type="number" disabled={!isVisible} value={winParams.x ?? defaultWinParams.x ?? 0} onChange={(e) => updateWinParam('x', Number(e.target.value))} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Y座標</Label>
            <Input type="number" disabled={!isVisible} value={winParams.y ?? defaultWinParams.y ?? 0} onChange={(e) => updateWinParam('y', Number(e.target.value))} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">幅</Label>
            <Input type="number" disabled={!isVisible} value={winParams.width ?? defaultWinParams.width ?? 300} onChange={(e) => updateWinParam('width', Number(e.target.value))} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">高さ</Label>
            <Input type="number" disabled={!isVisible} value={winParams.height ?? defaultWinParams.height ?? 300} onChange={(e) => updateWinParam('height', Number(e.target.value))} />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">操作ボタンの表示位置</Label>
          <Select
            value={winParams.control_corner ?? defaultWinParams.control_corner ?? 'bottom-right'}
            onValueChange={(val) => updateWinParam('control_corner', val)}
            disabled={!isVisible}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="top-left">左上</SelectItem>
              <SelectItem value="top-right">右上</SelectItem>
              <SelectItem value="bottom-left">左下</SelectItem>
              <SelectItem value="bottom-right">右下</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
};
