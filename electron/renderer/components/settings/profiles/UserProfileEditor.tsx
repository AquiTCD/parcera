import React from 'react';
import { InputSetting } from '../controls/InputSetting';
import { SelectSetting } from '../controls/SelectSetting';

import { ParceraSettings } from '../../../../shared/types';

interface UserProfileEditorProps {
  settings: ParceraSettings;
  defaultSettings?: ParceraSettings;
  updateNested: (category: keyof ParceraSettings, key: string, value: unknown) => void;
}

export const UserProfileEditor: React.FC<UserProfileEditorProps> = ({
  settings,
  defaultSettings,
  updateNested
}) => {
  return (
    <div className="setting-card">
      <h3 className="setting-card-title">ユーザー設定 (あなたについて)</h3>

      <div className="setting-form-row">
        <div style={{ flex: 1 }}>
          <InputSetting
            label="あなたの名前"
            defaultValue={defaultSettings?.user_profile?.name}
            value={settings?.user_profile?.name}
            onChange={(val) => updateNested('user_profile', 'name', val)}
          />
        </div>
        <div style={{ flex: 1 }}>
          <InputSetting
            label="AIからの呼び方"
            defaultValue={defaultSettings?.user_profile?.calling}
            value={settings?.user_profile?.calling}
            onChange={(val) => updateNested('user_profile', 'calling', val)}
          />
        </div>
      </div>

      <div className="setting-form-row">
        <div style={{ flex: 1 }}>
          <InputSetting
            label="性別"
            defaultValue={defaultSettings?.user_profile?.gender}
            value={settings?.user_profile?.gender}
            onChange={(val) => updateNested('user_profile', 'gender', val)}
          />
        </div>
        <div style={{ flex: 1 }}>
          <SelectSetting
            label="対話モード"
            value={settings?.user_profile?.mode || 'soliloquy'}
            onChange={(val) => updateNested('user_profile', 'mode', val)}
            options={[
              { value: 'soliloquy', label: '独り言 (観戦者モード)' },
              { value: 'conversation', label: '会話 (チャットモード)' }
            ]}
          />
        </div>
      </div>
    </div>
  );
};
