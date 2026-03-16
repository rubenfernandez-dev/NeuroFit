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
  completedValues?: number[];
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
  completedValues = [],
}: KeypadProps) {
  const { theme } = useAppTheme();
  const values = [1, 2, 3, 4, 5, 6, 7, 8, 9];
  const completedSet = new Set(completedValues);
  const targetHeight = Math.max(compact ? 34 : 40, buttonSize - 10);

  return (
    <View style={{ gap, flexShrink: 0 }}>
      <View style={{ flexDirection: 'row', gap, justifyContent: 'space-between' }}>
        {values.map((value) => (
          <View key={value} style={{ flex: 1, minWidth: 0 }}>
            <Button
              title={String(value)}
              onPress={() => onInput(value)}
              disabled={disabled}
              style={{
                minHeight: targetHeight,
                borderRadius: 12,
                paddingHorizontal: 0,
                paddingVertical: 0,
              }}
            />

            {completedSet.has(value) ? (
              <View
                pointerEvents="none"
                style={{
                  position: 'absolute',
                  top: -6,
                  right: -2,
                  width: 18,
                  height: 18,
                  borderRadius: 9,
                  backgroundColor: theme.colors.success,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text style={{ color: '#FFFFFF', fontSize: 12, fontWeight: '800', lineHeight: 14 }}>✓</Text>
              </View>
            ) : null}
          </View>
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