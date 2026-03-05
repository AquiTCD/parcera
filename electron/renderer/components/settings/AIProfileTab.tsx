import React from 'react';
import { TabProps } from './types';
import { AICharacterEditor } from './profiles/AICharacterEditor';
import { UserProfileEditor } from './profiles/UserProfileEditor';
import { KnowledgeEditor } from './profiles/KnowledgeEditor';

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

      <AICharacterEditor
        settings={settings}
        defaultSettings={defaultSettings}
        updateNested={updateNested}
      />

      <UserProfileEditor
        settings={settings}
        defaultSettings={defaultSettings}
        updateNested={updateNested}
      />

      <KnowledgeEditor
        settings={settings}
        updateRoot={updateRoot}
      />
    </section>
  );
};
