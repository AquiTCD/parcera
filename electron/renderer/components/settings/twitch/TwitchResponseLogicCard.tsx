import React from 'react';
import { InputSetting } from '../controls/InputSetting';
import { SelectSetting } from '../controls/SelectSetting';

interface Props {
  twitchSettings: any;
  defaultSettings?: any;
  updateNested: any;
}

export const TwitchResponseLogicCard: React.FC<Props> = ({
  twitchSettings,
  defaultSettings,
  updateNested,
}) => {
  return (
    <div className="setting-card">
      <h3 className="setting-card-title">応答ロジック</h3>

      <SelectSetting
        label="反応までの待ち時間"
        description="チャットが届いてからパルセラが反応するまでの時間を調整します。棒読みちゃんの読み上げ待ちなどを考慮できます。"
        value={twitchSettings.response_speed || 'natural'}
        options={[
          { label: 'なし', value: 'instant' },
          { label: '短め', value: 'fast' },
          { label: '標準', value: 'natural' },
          { label: '長め', value: 'slow' },
        ]}
        onChange={(val: string | number) => updateNested('twitch', 'response_speed', val)}
      />

      <InputSetting
        label="Wake Word (正規表現)"
        description="チャットのどこかにこの正規表現にマッチする単語が含まれる場合のみ反応します。"
        value={twitchSettings.wake_word || ''}
        defaultValue={defaultSettings?.twitch?.wake_word}
        onChange={(val: string | number) => updateNested('twitch', 'wake_word', val)}
      />

      <InputSetting
        label="無視するユーザー"
        description="カンマ区切りで入力（例: Nightbot, Moobot）"
        value={(twitchSettings.ignored_users || []).join(', ')}
        defaultValue={defaultSettings?.twitch?.ignored_users?.join(', ')}
        onChange={(val: string | number) => updateNested('twitch', 'ignored_users', String(val).split(',').map((s: string) => s.trim()).filter((s: string) => s))}
      />

      <InputSetting
        label="NGワード (正規表現)"
        description="これらの単語が含まれるチャットを無視します。カンマ区切りで入力。"
        value={(twitchSettings.ng_words || []).join(', ')}
        defaultValue={defaultSettings?.twitch?.ng_words?.join(', ')}
        onChange={(val: string | number) => updateNested('twitch', 'ng_words', String(val).split(',').map((s: string) => s.trim()).filter((s: string) => s))}
      />

      <div style={{ marginTop: '20px', paddingTop: '15px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
        <h4 style={{ fontSize: '14px', marginBottom: '15px', color: '#94a3b8' }}>詳細な配信制御</h4>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
          <InputSetting
            label="同一ユーザーのクールダウン (秒)"
            description="連投への反応を抑制します。"
            value={twitchSettings.user_cooldown ?? 60}
            onChange={(val: string | number) => updateNested('twitch', 'user_cooldown', Number(val))}
          />
          <InputSetting
            label="全体のクールダウン (秒)"
            description="パルセラの反応間隔を制御します。"
            value={twitchSettings.global_cooldown ?? 10}
            onChange={(val: string | number) => updateNested('twitch', 'global_cooldown', Number(val))}
          />
          <InputSetting
            label="キューの最大数"
            description="溜め込むチャットの最大数です。"
            value={twitchSettings.max_queue_size ?? 3}
            onChange={(val: string | number) => updateNested('twitch', 'max_queue_size', Number(val))}
          />
          <InputSetting
            label="メッセージの有効期限 (秒)"
            description="これ以上古いチャットは無視します。"
            value={twitchSettings.queue_expiry_seconds ?? 120}
            onChange={(val: string | number) => updateNested('twitch', 'queue_expiry_seconds', Number(val))}
          />
        </div>
      </div>
    </div>
  );
};
