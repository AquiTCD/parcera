import React from 'react';
import { TabProps } from './types';
import { InputSetting } from './controls/InputSetting';
import { SelectSetting } from './controls/SelectSetting';

export const AIProfileTab: React.FC<TabProps> = ({
  settings,
  defaultSettings,
  updateNested,
  updateRoot,
  renderTabHeader
}) => {
  return (
    <section className="tab-content-section">
      {renderTabHeader?.('キャラクター設定')}

      {/* AI Profile Section */}
      <div className="setting-card">
        <h3 className="setting-card-title">AI キャラクター設定</h3>

        <InputSetting
          label="名前"
          description="AIキャラクターの名前です。"
          defaultValue={defaultSettings?.ai_profile?.name}
          value={settings.ai_profile?.name}
          onChange={(val) => updateNested('ai_profile', 'name', val)}
        />

        <div className="setting-form-row">
          <div style={{ flex: 1 }}>
            <InputSetting
              label="種族"
              defaultValue={defaultSettings?.ai_profile?.species}
              value={settings.ai_profile?.species}
              onChange={(val) => updateNested('ai_profile', 'species', val)}
            />
          </div>
          <div style={{ flex: 1 }}>
            <InputSetting
              label="性別"
              defaultValue={defaultSettings?.ai_profile?.gender}
              value={settings.ai_profile?.gender}
              onChange={(val) => updateNested('ai_profile', 'gender', val)}
            />
          </div>
        </div>

        <InputSetting
          label="性格"
          description="どのような性格ですか？"
          defaultValue={defaultSettings?.ai_profile?.personality}
          value={settings.ai_profile?.personality}
          onChange={(val) => updateNested('ai_profile', 'personality', val)}
        />

        <InputSetting
          label="口調"
          description="話し方のスタイルを指定します。"
          defaultValue={defaultSettings?.ai_profile?.tone}
          value={settings.ai_profile?.tone}
          onChange={(val) => updateNested('ai_profile', 'tone', val)}
        />

        <div className="setting-form-row">
          <div style={{ flex: 1 }}>
            <InputSetting
              label="一人称"
              defaultValue={defaultSettings?.ai_profile?.first_person}
              value={settings.ai_profile?.first_person}
              onChange={(val) => updateNested('ai_profile', 'first_person', val)}
            />
          </div>
          <div style={{ flex: 1 }}>
            <InputSetting
              label="趣味"
              defaultValue={defaultSettings?.ai_profile?.hobbies}
              value={settings.ai_profile?.hobbies}
              onChange={(val) => updateNested('ai_profile', 'hobbies', val)}
            />
          </div>
        </div>
      </div>

      {/* User Profile Section */}
      <div className="setting-card">
        <h3 className="setting-card-title">ユーザー設定 (あなたについて)</h3>

        <div className="setting-form-row">
          <div style={{ flex: 1 }}>
            <InputSetting
              label="あなたの名前"
              defaultValue={defaultSettings?.user_profile?.name}
              value={settings.user_profile?.name}
              onChange={(val) => updateNested('user_profile', 'name', val)}
            />
          </div>
          <div style={{ flex: 1 }}>
            <InputSetting
              label="AIからの呼び方"
              defaultValue={defaultSettings?.user_profile?.calling}
              value={settings.user_profile?.calling}
              onChange={(val) => updateNested('user_profile', 'calling', val)}
            />
          </div>
        </div>

        <div className="setting-form-row">
          <div style={{ flex: 1 }}>
            <InputSetting
              label="性別"
              defaultValue={defaultSettings?.user_profile?.gender}
              value={settings.user_profile?.gender}
              onChange={(val) => updateNested('user_profile', 'gender', val)}
            />
          </div>
          <div style={{ flex: 1 }}>
            <SelectSetting
              label="対話モード"
              value={settings.user_profile?.mode || 'soliloquy'}
              onChange={(val) => updateNested('user_profile', 'mode', val)}
              options={[
                { value: 'soliloquy', label: '独り言 (観戦者モード)' },
                { value: 'conversation', label: '会話 (チャットモード)' }
              ]}
            />
          </div>
        </div>
      </div>

      {/* Knowledge Base Section */}
      <div className="setting-card">
        <h3 className="setting-card-title">追加知識 / シチュエーション</h3>
        <p style={{ fontSize: '12px', color: '#aaa', margin: '8px 0' }}>
          AIが知っておくべき背景情報や攻略情報、現在のシチュエーションを記述します。
        </p>
        <textarea
          className="setting-input"
          value={settings.knowledge || ''}
          onChange={(e) => updateRoot('knowledge', e.target.value)}
          placeholder="例: A.K.I.の中足はガードさせて有利"
        />
      </div>
    </section>
  );
};
