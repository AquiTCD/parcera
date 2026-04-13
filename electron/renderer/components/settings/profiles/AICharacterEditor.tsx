import React from 'react';
import { InputSetting } from '../controls/InputSetting';

import { ParceraSettings } from '../../../../shared/types';

interface AICharacterEditorProps {
  settings: ParceraSettings;
  defaultSettings?: ParceraSettings;
  updateNested: (category: keyof ParceraSettings, key: string, value: unknown) => void;
}

export const AICharacterEditor: React.FC<AICharacterEditorProps> = ({
  settings,
  defaultSettings,
  updateNested
}) => {
  return (
    <div className="setting-card">
      <h3 className="setting-card-title">AI キャラクター設定</h3>

      <InputSetting
        label="名前"
        description="AIキャラクターの名前です。"
        defaultValue={defaultSettings?.ai_profile?.name}
        value={settings?.ai_profile?.name}
        onChange={(val) => updateNested('ai_profile', 'name', val)}
      />

      <div className="setting-form-row">
        <div style={{ flex: 1 }}>
          <InputSetting
            label="種族"
            defaultValue={defaultSettings?.ai_profile?.species}
            value={settings?.ai_profile?.species}
            onChange={(val) => updateNested('ai_profile', 'species', val)}
          />
        </div>
        <div style={{ flex: 1 }}>
          <InputSetting
            label="性別"
            defaultValue={defaultSettings?.ai_profile?.gender}
            value={settings?.ai_profile?.gender}
            onChange={(val) => updateNested('ai_profile', 'gender', val)}
          />
        </div>
      </div>

      <InputSetting
        label="性格"
        description="どのような性格ですか？"
        defaultValue={defaultSettings?.ai_profile?.personality}
        value={settings?.ai_profile?.personality}
        onChange={(val) => updateNested('ai_profile', 'personality', val)}
      />

      <InputSetting
        label="口調"
        description="話し方のスタイルを指定します。"
        defaultValue={defaultSettings?.ai_profile?.tone}
        value={settings?.ai_profile?.tone}
        onChange={(val) => updateNested('ai_profile', 'tone', val)}
      />

      <div className="setting-form-row">
        <div style={{ flex: 1 }}>
          <InputSetting
            label="一人称"
            defaultValue={defaultSettings?.ai_profile?.first_person}
            value={settings?.ai_profile?.first_person}
            onChange={(val) => updateNested('ai_profile', 'first_person', val)}
          />
        </div>
        <div style={{ flex: 1 }}>
          <InputSetting
            label="趣味"
            defaultValue={defaultSettings?.ai_profile?.hobbies}
            value={settings?.ai_profile?.hobbies}
            onChange={(val) => updateNested('ai_profile', 'hobbies', val)}
          />
        </div>
      </div>
    </div>
  );
};
