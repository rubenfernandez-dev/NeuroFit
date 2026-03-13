import React from 'react';
import { View } from 'react-native';
import Button from '../../../shared/ui/Button';

type KeypadProps = {
  onInput: (value: number) => void;
  onClear: () => void;
  disabled?: boolean;
  clearDisabled?: boolean;
  compact?: boolean;
  buttonSize?: number;
  gap?: number;
  showClear?: boolean;
};

export default function Keypad({
  onInput,
  onClear,
  disabled,
  clearDisabled,
  compact = false,
  buttonSize = 52,
  gap = 8,
  showClear = true,
}: KeypadProps) {
  const values = [1, 2, 3, 4, 5, 6, 7, 8, 9];
  const targetHeight = Math.max(compact ? 34 : 40, buttonSize - 10);

  return (
    <View style={{ gap, flexShrink: 0 }}>
      <View style={{ flexDirection: 'row', gap, justifyContent: 'space-between' }}>
        {values.map((value) => (
          <Button
            key={value}
            title={String(value)}
            onPress={() => onInput(value)}
            disabled={disabled}
            style={{
              flex: 1,
              minWidth: 0,
              minHeight: targetHeight,
              borderRadius: 12,
              paddingHorizontal: 0,
              paddingVertical: 0,
            }}
          />
        ))}
      </View>

      {showClear ? (
        <Button
          title="Borrar"
          variant="secondary"
          onPress={onClear}
          disabled={disabled || clearDisabled}
          style={{ minHeight: Math.max(40, buttonSize - 2) }}
        />
      ) : null}
    </View>
  );
}