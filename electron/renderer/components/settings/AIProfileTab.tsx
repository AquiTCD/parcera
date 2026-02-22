import React from 'react';
import { TabProps, inputStyle } from './types';
import { InputSetting } from './controls/InputSetting';

export const AIProfileTab: React.FC<TabProps> = ({
  settings,
  defaultSettings,
  updateNested,
  updateRoot,
  renderTabHeader
}) => {
  return (
    <section className="animate-fade-in">
      {renderTabHeader?.('キャラクター設定')}

      {/* AI Profile Section */}
      <div style={{ background: '#2d2d30', padding: '15px', borderRadius: '8px', marginBottom: '20px' }}>
        <h3 style={{ marginTop: 0, fontSize: '16px', borderBottom: '1px solid #444', paddingBottom: '8px' }}>AI キャラクター設定</h3>

        <InputSetting
          label="名前"
          description="AIキャラクターの名前です。"
          defaultValue={defaultSettings?.ai_profile?.name}
          value={settings.ai_profile?.name}
          onChange={(val) => updateNested('ai_profile', 'name', val)}
        />

        <div style={{ display: 'flex', gap: '15px' }}>
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

        <div style={{ display: 'flex', gap: '15px' }}>
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
      <div style={{ background: '#2d2d30', padding: '15px', borderRadius: '8px', marginBottom: '20px' }}>
        <h3 style={{ marginTop: 0, fontSize: '16px', borderBottom: '1px solid #444', paddingBottom: '8px' }}>ユーザー設定 (あなたについて)</h3>

        <div style={{ display: 'flex', gap: '15px' }}>
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

        <div style={{ display: 'flex', gap: '15px' }}>
          <div style={{ flex: 1 }}>
            <InputSetting
              label="性別"
              defaultValue={defaultSettings?.user_profile?.gender}
              value={settings.user_profile?.gender}
              onChange={(val) => updateNested('user_profile', 'gender', val)}
            />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', fontSize: '14px', marginBottom: '8px' }}>対話モード</label>
              <select
                value={settings.user_profile?.mode || 'soliloquy'}
                onChange={(e) => updateNested('user_profile', 'mode', e.target.value)}
                style={inputStyle}
              >
                <option value="soliloquy">独り言 (観戦者モード)</option>
                <option value="conversation">会話 (チャットモード)</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Knowledge Base Section */}
      <div style={{ background: '#2d2d30', padding: '15px', borderRadius: '8px' }}>
        <h3 style={{ marginTop: 0, fontSize: '16px', borderBottom: '1px solid #444', paddingBottom: '8px' }}>追加知識 / シチュエーション</h3>
        <p style={{ fontSize: '12px', color: '#aaa', margin: '8px 0' }}>
          AIが知っておくべき背景情報や攻略情報、現在のシチュエーションを記述します。
        </p>
        <textarea
          style={{
            ...inputStyle,
            height: '120px',
            resize: 'vertical',
            fontFamily: 'inherit'
          }}
          value={settings.knowledge || ''}
          onChange={(e) => updateRoot('knowledge', e.target.value)}
          placeholder="例: A.K.I.の中足はガードさせて有利"
        />
      </div>
    </section>
  );
};
