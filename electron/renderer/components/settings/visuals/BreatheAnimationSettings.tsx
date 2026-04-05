import React from 'react';
import { ParceraSettings } from '../../../../shared/types';
import { Label } from '../../ui/label';
import { Input } from '../../ui/input';

interface BreatheAnimationSettingsProps {
  settings: any;
  defaultSettings?: any;
  updateNested: (category: keyof ParceraSettings, key: string, value: any) => void;
}

export const BreatheAnimationSettings: React.FC<BreatheAnimationSettingsProps> = ({
  settings,
  defaultSettings,
  updateNested,
}) => {
  return (
    <div className="space-y-3">
      <h5 className="text-sm font-semibold text-foreground border-t border-border pt-4">呼吸アニメーション</h5>
      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="breathe-scale" className="text-xs text-muted-foreground">呼吸のスケーリング幅</Label>
          <Input
            id="breathe-scale"
            type="number"
            value={settings.avatars?.breathe_scale ?? defaultSettings?.avatars?.breathe_scale ?? ''}
            onChange={(e) => updateNested('avatars', 'breathe_scale', Number(e.target.value))}
            placeholder={String(defaultSettings?.avatars?.breathe_scale ?? '')}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="breathe-amplitude" className="text-xs text-muted-foreground">呼吸の上下動幅 (px)</Label>
          <Input
            id="breathe-amplitude"
            type="number"
            value={settings.avatars?.breathe_amplitude ?? defaultSettings?.avatars?.breathe_amplitude ?? ''}
            onChange={(e) => updateNested('avatars', 'breathe_amplitude', Number(e.target.value))}
            placeholder={String(defaultSettings?.avatars?.breathe_amplitude ?? '')}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="breathe-duration" className="text-xs text-muted-foreground">呼吸の周期基準 (ms)</Label>
          <Input
            id="breathe-duration"
            type="number"
            value={settings.avatars?.breathe_duration ?? defaultSettings?.avatars?.breathe_duration ?? ''}
            onChange={(e) => updateNested('avatars', 'breathe_duration', Number(e.target.value))}
            placeholder={String(defaultSettings?.avatars?.breathe_duration ?? '')}
          />
        </div>
      </div>
    </div>
  );
};
