import React from 'react';
import { inputStyle } from './types';

export const SettingGroup: React.FC<{ label: string; children: React.ReactNode; labelStyle?: React.CSSProperties }> = ({ label, children, labelStyle }) => (
  <div className="form-group" style={{ marginBottom: '15px' }}>
    <label style={{ display: 'block', marginBottom: '5px', ...labelStyle }}>{label}</label>
    {children}
  </div>
);

export const CheckboxSetting: React.FC<{
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  style?: React.CSSProperties;
  labelStyle?: React.CSSProperties;
}> = ({ label, checked, onChange, style, labelStyle }) => (
  <div className="form-group" style={{ marginBottom: '15px', ...style }}>
    <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', ...labelStyle }}>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        style={{ marginRight: '10px' }}
      />
      {label}
    </label>
  </div>
);

export const InputSetting: React.FC<{
  label: string;
  type?: 'text' | 'number' | 'password';
  value: string | number;
  onChange: (val: any) => void;
  placeholder?: string;
  step?: string;
  labelStyle?: React.CSSProperties;
}> = ({ label, type = 'text', value, onChange, placeholder, step, labelStyle }) => (
  <SettingGroup label={label} labelStyle={labelStyle}>
    <input
      type={type}
      placeholder={placeholder}
      value={value ?? ''}
      step={step}
      onChange={(e) => onChange(type === 'number' ? Number(e.target.value) : e.target.value)}
      style={inputStyle}
    />
  </SettingGroup>
);

export const PasswordSetting: React.FC<{
  label: string;
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  showPasswordState: [boolean, React.Dispatch<React.SetStateAction<boolean>>];
  buttonAction?: React.ReactNode;
}> = ({ label, value, onChange, placeholder, showPasswordState, buttonAction }) => {
  const [show, setShow] = showPasswordState;
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
          style={{ padding: '0 10px', background: '#333', border: '1px solid #555', color: 'white', borderRadius: '4px', cursor: 'pointer', whiteSpace: 'nowrap' }}
        >
          {show ? '隠す' : '表示'}
        </button>
      </div>
      {buttonAction && <div style={{ marginTop: '8px' }}>{buttonAction}</div>}
    </SettingGroup>
  );
};
