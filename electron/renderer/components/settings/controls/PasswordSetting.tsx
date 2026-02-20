import React, { useState } from 'react';
import { inputStyle } from '../types';
import { SettingGroup } from './SettingGroup';

interface PasswordSettingProps {
  label: string;
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  buttonAction?: React.ReactNode;
}

export const PasswordSetting: React.FC<PasswordSettingProps> = ({
  label,
  value,
  onChange,
  placeholder,
  buttonAction
}) => {
  const [show, setShow] = useState(false);

  return (
    <SettingGroup label={label}>
      <div style={{ display: 'flex', gap: '5px' }}>
        <input
          type={show ? "text" : "password"}
          placeholder={placeholder}
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
          style={inputStyle}
        />
        <button
          onClick={() => setShow(!show)}
          style={{
            padding: '0 10px',
            background: '#333',
            border: '1px solid #555',
            color: 'white',
            borderRadius: '4px',
            cursor: 'pointer',
            whiteSpace: 'nowrap'
          }}
        >
          {show ? '隠す' : '表示'}
        </button>
      </div>
      {buttonAction && <div style={{ marginTop: '8px' }}>{buttonAction}</div>}
    </SettingGroup>
  );
};
