import React, { useState } from 'react';
import { SettingGroup } from './SettingGroup';

interface PasswordSettingProps {
  label: string;
  description?: string;
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  buttonAction?: React.ReactNode;
}

export const PasswordSetting: React.FC<PasswordSettingProps> = ({
  label,
  description,
  value,
  onChange,
  placeholder,
  buttonAction
}) => {
  const [show, setShow] = useState(false);
  const inputId = React.useId();

  return (
    <SettingGroup label={label} description={description} contentId={inputId}>
      <div style={{ display: 'flex', gap: '5px' }}>
        <input
          id={inputId}
          type={show ? "text" : "password"}
          placeholder={placeholder}
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
          className="setting-input"
        />
        <button
          onClick={() => setShow(!show)}
          className="btn btn-outline"
          style={{ whiteSpace: 'nowrap', padding: '0 12px' }}
        >
          {show ? '隠す' : '表示'}
        </button>
      </div>
      {buttonAction && <div style={{ marginTop: '8px' }}>{buttonAction}</div>}
    </SettingGroup>
  );
};
