import React from 'react';
import { Text, View } from 'react-native';
import Button from '../../../shared/ui/Button';
import { useAppTheme } from '../../../shared/theme/theme';

type KeypadProps = {
  onInput: (value: number) => void;
  onClear: () => void;
  disabled?: boolean;
  clearDisabled?: boolean;
  compact?: boolean;
  buttonSize?: number;
  gap?: number;
  showClear?: boolean;
  hiddenValues?: number[];
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
  hiddenValues = [],
}: KeypadProps) {
  const { theme } = useAppTheme();
  const values = [1, 2, 3, 4, 5, 6, 7, 8, 9];
  const hiddenSet = new Set(hiddenValues);
  const visibleValues = values.filter((value) => !hiddenSet.has(value));
  const targetHeight = Math.max(compact ? 34 : 40, buttonSize - 10);

  return (
    <View style={{ gap, flexShrink: 0 }}>
      <View style={{ flexDirection: 'row', gap, justifyContent: 'space-between' }}>
        {visibleValues.map((value) => (
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

      {visibleValues.length === 0 ? (
        <Text style={{ color: theme.colors.success, textAlign: 'center', fontWeight: '700' }}>Numeros 1-9 completados</Text>
      ) : null}

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