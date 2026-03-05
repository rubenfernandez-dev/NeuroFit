import React, { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import { Difficulty, GameId, difficultyLabel, normalizeDifficulty } from '../games/types';
import Card from '../shared/ui/Card';
import Button from '../shared/ui/Button';
import PrimaryButton from '../shared/ui/PrimaryButton';
import { useAppTheme } from '../shared/theme/theme';

type DifficultyModalProps = {
  visible: boolean;
  gameId: GameId | null;
  difficulties: Difficulty[];
  initialValue: Difficulty;
  onCancel: () => void;
  onConfirm: (difficulty: Difficulty) => void;
};

export default function DifficultyModal({
  visible,
  gameId,
  difficulties,
  initialValue,
  onCancel,
  onConfirm,
}: DifficultyModalProps) {
  const { theme } = useAppTheme();
  const fallback = useMemo(() => difficulties[0] ?? 'principiante', [difficulties]);
  const [selected, setSelected] = useState<Difficulty>(normalizeDifficulty(initialValue, fallback));

  useEffect(() => {
    if (!visible) return;
    const normalized = normalizeDifficulty(initialValue, fallback);
    setSelected(difficulties.includes(normalized) ? normalized : fallback);
  }, [visible, initialValue, fallback, difficulties]);

  const confirmDisabled = !gameId || difficulties.length === 0;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={{ flex: 1, justifyContent: 'center', padding: theme.spacing.lg }}>
        <Pressable
          onPress={onCancel}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: '#000000',
            opacity: 0.5,
          }}
        />

        <Card variant="primary">
          <Text style={[theme.typography.h2, { color: theme.colors.text }]}>Elige dificultad</Text>
          <View style={{ marginTop: 12, gap: 8 }}>
            {difficulties.map((difficulty) => {
              const isSelected = selected === difficulty;
              return (
                <Pressable
                  key={difficulty}
                  onPress={() => setSelected(difficulty)}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    paddingVertical: 10,
                    paddingHorizontal: 12,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: isSelected ? theme.colors.primary : theme.colors.border,
                    backgroundColor: isSelected ? theme.colors.primarySoft : theme.colors.bg1,
                  }}
                >
                  <Text style={[theme.typography.body, { color: theme.colors.text }]}>{difficultyLabel(difficulty)}</Text>
                  <View
                    style={{
                      width: 18,
                      height: 18,
                      borderRadius: 9,
                      borderWidth: 2,
                      borderColor: isSelected ? theme.colors.primary : theme.colors.textMuted,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {isSelected ? <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: theme.colors.primary }} /> : null}
                  </View>
                </Pressable>
              );
            })}
          </View>

          <View style={{ marginTop: 14, gap: 8 }}>
            <PrimaryButton
              title="Jugar"
              disabled={confirmDisabled}
              onPress={() => onConfirm(selected)}
              style={{ minHeight: 56, borderRadius: 18 }}
            />
            <Button title="Cancelar" variant="secondary" onPress={onCancel} style={{ minHeight: 52, borderRadius: 16 }} />
          </View>
        </Card>
      </View>
    </Modal>
  );
}
