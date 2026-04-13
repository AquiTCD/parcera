import React from 'react';
import { ParceraSettings } from '../../../../shared/types';
import { FieldRow } from '../../sections/shared';
import { Label } from '../../ui/label';
import { Input } from '../../ui/input';
import { Button } from '../../ui/button';
import { Switch } from '../../ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select';

interface AvatarColumnProps {
  type: 'user' | 'ai';
  label: string;
  settings: ParceraSettings;
  defaultSettings?: ParceraSettings;
  updateNested: (category: keyof ParceraSettings, key: string, value: any) => void;
  handleSelectDir?: (type: 'user' | 'ai') => Promise<void>;
}

export const AvatarColumn: React.FC<AvatarColumnProps> = ({
  type,
  label,
  settings,
  defaultSettings,
  updateNested,
  handleSelectDir,
}) => {
  const avatarSettings = settings.avatars?.[type] || {};
  const defaultAvatarSettings = defaultSettings?.avatars?.[type] || {};

  const pathId = `avatar-path-${type}`;
  const flipId = `avatar-flip-${type}`;
  const chromaId = `avatar-chroma-${type}`;

  return (
    <div className="space-y-3" data-testid={`avatar-column-${type}`}>
      <FieldRow label={label} htmlFor={pathId}>
        <Input
          id={pathId}
          value={avatarSettings.assets_dir ?? ''}
          onChange={(e) => updateNested('avatars', type, { ...avatarSettings, assets_dir: e.target.value })}
          placeholder={defaultAvatarSettings.assets_dir}
        />
      </FieldRow>
      <Button variant="outline" size="sm" onClick={() => handleSelectDir?.(type)}>
        フォルダ選択
      </Button>

      <div className="border-t border-border pt-3 space-y-3">
        <div className="flex items-center justify-between">
          <Label htmlFor={flipId} className="text-sm">左右反転する</Label>
          <Switch
            id={flipId}
            checked={avatarSettings.flip_horizontal ?? false}
            onCheckedChange={(checked) => updateNested('avatars', type, { ...avatarSettings, flip_horizontal: checked })}
          />
        </div>
        <div className="flex items-center justify-between">
          <Label htmlFor={chromaId} className="text-sm">背景透過（クロマキー）</Label>
          <Switch
            id={chromaId}
            checked={avatarSettings.chroma_key_enabled ?? false}
            onCheckedChange={(checked) => updateNested('avatars', type, { ...avatarSettings, chroma_key_enabled: checked })}
          />
        </div>
        <FieldRow label="クロマキー色">
          <Select
            value={avatarSettings.chroma_key_color ?? defaultAvatarSettings.chroma_key_color ?? 'green'}
            onValueChange={(val) => updateNested('avatars', type, { ...avatarSettings, chroma_key_color: val })}
            disabled={!avatarSettings.chroma_key_enabled}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="green">グリーンバック</SelectItem>
              <SelectItem value="blue">ブルーバック</SelectItem>
            </SelectContent>
          </Select>
        </FieldRow>
      </div>
    </div>
  );
};
