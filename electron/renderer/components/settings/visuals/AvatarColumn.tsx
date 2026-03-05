import React from 'react';
import { InputSetting } from '../controls/InputSetting';
import { CheckboxSetting } from '../controls/CheckboxSetting';
import { SelectSetting } from '../controls/SelectSetting';

import { ParceraSettings } from '../../../../shared/types';

interface AvatarColumnProps {
  type: 'user' | 'ai';
  label: string;
  settings: any;
  defaultSettings?: any;
  updateNested: (category: keyof ParceraSettings, key: string, value: any) => void;
  handleSelectDir?: (type: 'user' | 'ai') => Promise<void>;
}

export const AvatarColumn: React.FC<AvatarColumnProps> = ({
  type,
  label,
  settings,
  defaultSettings,
  updateNested,
  handleSelectDir
}) => {
  const avatarSettings = settings.avatars?.[type] || {};
  const defaultAvatarSettings = defaultSettings?.avatars?.[type] || {};

  return (
    <div className="setting-card" style={{ flex: 1, marginBottom: 0 }}>
      <InputSetting
        label={label}
        defaultValue={defaultAvatarSettings.assets_dir}
        value={avatarSettings.assets_dir}
        onChange={(val) => updateNested('avatars', type, { ...avatarSettings, assets_dir: val })}
      />
      <button
        onClick={() => handleSelectDir?.(type)}
        className="btn btn-outline"
        style={{ marginTop: '5px', marginBottom: '15px', width: 'auto' }}
      >
        📁 フォルダ選択
      </button>

      <div style={{ borderTop: '1px solid #444', paddingTop: '15px' }}>
        <CheckboxSetting
          label="左右反転する"
          defaultValue={defaultAvatarSettings.flip_horizontal}
          checked={avatarSettings.flip_horizontal}
          onChange={(checked: boolean) => updateNested('avatars', type, { ...avatarSettings, flip_horizontal: checked })}
          style={{ marginBottom: '10px' }}
        />
        <CheckboxSetting
          label="背景透過 (クロマキー)"
          defaultValue={defaultAvatarSettings.chroma_key_enabled}
          checked={avatarSettings.chroma_key_enabled}
          onChange={(checked: boolean) => updateNested('avatars', type, { ...avatarSettings, chroma_key_enabled: checked })}
        />
        <SelectSetting
          label="クロマキー色"
          value={avatarSettings.chroma_key_color ?? defaultAvatarSettings.chroma_key_color ?? 'green'}
          onChange={(val) => updateNested('avatars', type, { ...avatarSettings, chroma_key_color: val })}
          disabled={!avatarSettings.chroma_key_enabled}
          options={[
            { value: 'green', label: 'グリーンバック' },
            { value: 'blue', label: 'ブルーバック' }
          ]}
          style={{ marginTop: '10px' }}
        />
      </div>
    </div>
  );
};
