import React from 'react';

import { ParceraSettings } from '../../../../shared/types';

interface KnowledgeEditorProps {
  settings: any;
  updateRoot: (key: keyof ParceraSettings, value: any) => void;
}

export const KnowledgeEditor: React.FC<KnowledgeEditorProps> = ({
  settings,
  updateRoot
}) => {
  return (
    <div className="setting-card">
      <h3 className="setting-card-title">追加知識 / シチュエーション</h3>
      <p style={{ fontSize: '12px', color: '#aaa', margin: '8px 0' }}>
        AIが知っておくべき背景情報や攻略情報、現在のシチュエーションを記述します。
      </p>
      <textarea
        className="setting-input"
        value={settings?.knowledge || ''}
        onChange={(e) => updateRoot('knowledge', e.target.value)}
        placeholder="例: A.K.I.の中足はガードさせて有利"
      />
    </div>
  );
};
