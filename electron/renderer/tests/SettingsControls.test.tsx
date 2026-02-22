import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import React from 'react';
import { CheckboxSetting } from '@/components/settings/controls/CheckboxSetting';
import { InputSetting } from '@/components/settings/controls/InputSetting';

describe('Settings Controls', () => {
  describe('CheckboxSetting', () => {
    it('should trigger onChange when clicked', () => {
      const onChange = vi.fn();
      const { container } = render(
        <CheckboxSetting label="Test Checkbox" checked={false} onChange={onChange} />
      );

      const checkbox = container.querySelector('input[type="checkbox"]');
      if (!checkbox) throw new Error('Checkbox not found');
      fireEvent.click(checkbox);
      expect(onChange).toHaveBeenCalledWith(true);
    });
  });

  describe('InputSetting', () => {
    it('should trigger onChange when value changes', () => {
      const onChange = vi.fn();
      const { container } = render(
        <InputSetting label="Test Input" value="" onChange={onChange} />
      );

      const input = container.querySelector('input');
      if (!input) throw new Error('Input not found');
      fireEvent.change(input, { target: { value: 'new value' } });
      expect(onChange).toHaveBeenCalledWith('new value');
    });
  });
});
