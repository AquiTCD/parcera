import React from 'react';
import { ParceraSettings } from '../../../shared/types';
import { Label } from '../ui/label';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { Switch } from '../ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';

interface WindowSettingsSectionProps {
  type: 'user' | 'ai';
  settings: ParceraSettings;
  defaultSettings?: ParceraSettings;
  updateNested: (category: keyof ParceraSettings, key: string, value: unknown) => void;
}

export const WindowSettingsSection: React.FC<WindowSettingsSectionProps> = ({
  type,
  settings,
  defaultSettings,
  updateNested,
}) => {
  const winParams = settings.electron?.windows?.[type] || {};
  const defaultWinParams = defaultSettings?.electron?.windows?.[type] || {};
  const labelPrefix = type === 'user' ? 'USER' : 'AI';

  const updateWinParam = (key: string, value: unknown) => {
    updateNested('electron', 'windows', {
      ...settings.electron?.windows,
      [type]: { ...winParams, [key]: value },
    });
  };

  return (
    <div className="space-y-3">
      <h5 className="text-sm font-semibold text-foreground">{labelPrefix}ウィンドウ</h5>

      <div className="flex items-center justify-between">
        <Label className="text-sm">常に最前面に表示する</Label>
        <Switch
          checked={winParams.alwaysOnTop ?? false}
          onCheckedChange={(checked) => updateWinParam('alwaysOnTop', checked)}
        />
      </div>

      <div className="flex items-center justify-between">
        <Label className="text-sm">起動時にウィンドウ位置をロックする</Label>
        <Switch
          checked={winParams.locked ?? defaultWinParams.locked ?? false}
          onCheckedChange={(checked) => updateWinParam('locked', checked)}
        />
      </div>

      <Button
        variant="outline"
        size="sm"
        className="w-full text-xs"
        onClick={async () => {
          const bounds = await window.electronAPI.getAvatarWindowBounds(type);
          if (bounds) {
            updateNested('electron', 'windows', {
              ...settings.electron?.windows,
              [type]: { ...winParams, x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height },
            });
          } else {
            alert(`${labelPrefix}ウィンドウが見つかりません`);
          }
        }}
      >
        現在の{labelPrefix}ウィンドウの座標・サイズを取得
      </Button>

      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">X座標</Label>
          <Input type="number" value={winParams.x ?? defaultWinParams.x ?? 0} onChange={(e) => updateWinParam('x', Number(e.target.value))} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Y座標</Label>
          <Input type="number" value={winParams.y ?? defaultWinParams.y ?? 0} onChange={(e) => updateWinParam('y', Number(e.target.value))} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">幅</Label>
          <Input type="number" value={winParams.width ?? defaultWinParams.width ?? 300} onChange={(e) => updateWinParam('width', Number(e.target.value))} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">高さ</Label>
          <Input type="number" value={winParams.height ?? defaultWinParams.height ?? 300} onChange={(e) => updateWinParam('height', Number(e.target.value))} />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">操作ボタンの表示位置</Label>
        <Select
          value={winParams.control_corner ?? defaultWinParams.control_corner ?? 'bottom-right'}
          onValueChange={(val) => updateWinParam('control_corner', val)}
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
  );
};
