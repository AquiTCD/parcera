import React from 'react';
import { SettingGroup } from '../controls/SettingGroup';
import { InputSetting } from '../controls/InputSetting';

import { ParceraSettings } from '../../../../shared/types';

interface BreatheAnimationSettingsProps {
  settings: any;
  defaultSettings?: any;
  updateNested: (category: keyof ParceraSettings, key: string, value: any) => void;
}

export const BreatheAnimationSettings: React.FC<BreatheAnimationSettingsProps> = ({
  settings,
  defaultSettings,
  updateNested
}) => {
  return (
    <div className="setting-card">
      <SettingGroup label="呼吸アニメーション設定">
        <div style={{ display: 'flex', gap: '10px' }}>
          <div style={{ flex: 1 }}>
            <InputSetting
              label="呼吸のスケーリング幅"
              type="number"
              defaultValue={defaultSettings?.avatars?.breathe_scale}
              value={settings.avatars?.breathe_scale}
              onChange={(val) => updateNested('avatars', 'breathe_scale', val)}
            />
          </div>
          <div style={{ flex: 1 }}>
            <InputSetting
              label="呼吸の上下動幅 (px)"
              type="number"
              defaultValue={defaultSettings?.avatars?.breathe_amplitude}
              value={settings.avatars?.breathe_amplitude}
              onChange={(val) => updateNested('avatars', 'breathe_amplitude', val)}
            />
          </div>
          <div style={{ flex: 1 }}>
            <InputSetting
              label="呼吸の周期基準 (ms)"
              type="number"
              defaultValue={defaultSettings?.avatars?.breathe_duration}
              value={settings.avatars?.breathe_duration}
              onChange={(val) => updateNested('avatars', 'breathe_duration', val)}
            />
          </div>
        </div>
      </SettingGroup>
    </div>
  );
};
