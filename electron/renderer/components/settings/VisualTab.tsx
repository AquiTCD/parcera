import React from 'react';
import { TabProps } from './types';
import { SettingGroup } from './controls/SettingGroup';
import { CheckboxSetting } from './controls/CheckboxSetting';
import { WindowSettingsSection } from './WindowSettingsSection';
import { AvatarColumn } from './visuals/AvatarColumn';
import { BreatheAnimationSettings } from './visuals/BreatheAnimationSettings';

export const VisualTab: React.FC<TabProps> = ({ settings, defaultSettings, updateNested, renderTabHeader, handleSelectDir }) => {
  return (
    <section className="tab-content-section">
      {renderTabHeader?.('アバター設定')}

      <div style={{ display: 'flex', gap: '20px', flexDirection: 'column' }}>
        <SettingGroup label="アバター画像・透過設定">
          <div style={{ display: 'flex', gap: '15px' }}>
            {/* USER Avatar Column */}
            <AvatarColumn
              type="user"
              label="USERアバター パス"
              settings={settings}
              defaultSettings={defaultSettings}
              updateNested={updateNested}
              handleSelectDir={handleSelectDir}
            />

            {/* AI Avatar Column */}
            <AvatarColumn
              type="ai"
              label="AIアバター パス"
              settings={settings}
              defaultSettings={defaultSettings}
              updateNested={updateNested}
              handleSelectDir={handleSelectDir}
            />
          </div>
        </SettingGroup>

        <div style={{ display: 'flex', gap: '15px', marginBottom: '15px' }}>
          <WindowSettingsSection
            type="user"
            settings={settings}
            defaultSettings={defaultSettings}
            updateNested={updateNested}
          />
          <WindowSettingsSection
            type="ai"
            settings={settings}
            defaultSettings={defaultSettings}
            updateNested={updateNested}
          />
        </div>
      </div>

      <div className="form-group" style={{ marginBottom: '20px' }}>
        <CheckboxSetting
          label="デバッグ情報を表示する (ピークメーター、状態テキスト)"
          defaultValue={defaultSettings?.avatars?.show_debug}
          checked={settings.avatars?.show_debug}
          onChange={(checked: boolean) => updateNested('avatars', 'show_debug', checked)}
        />
      </div>

      <BreatheAnimationSettings
        settings={settings}
        defaultSettings={defaultSettings}
        updateNested={updateNested}
      />
    </section>
  );
};
