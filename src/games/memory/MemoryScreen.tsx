import React, { useEffect, useMemo, useState } from 'react';
import { Alert, ScrollView, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../app/routes';
import { Difficulty } from '../types';
import { buildDeck, getBoardSize } from './logic/deck';
import MemoryCard from './components/MemoryCard';
import { clearMemoryState, getMemoryState, saveMemoryState } from './storage/memoryState';
import Card from '../../shared/ui/Card';
import Button from '../../shared/ui/Button';
import { useAppTheme } from '../../shared/theme/theme';
import { msToClock } from '../../shared/utils/time';
import { recordSession } from '../../shared/storage/stats';
import { grantXp } from '../../shared/gamification/xp';
import { markDailyCompleted } from '../../shared/storage/daily';

type Props = NativeStackScreenProps<RootStackParamList, 'Memory'>;

export default function MemoryScreen({ route }: Props) {
  const { theme } = useAppTheme();
  const difficulty = (route.params?.difficulty ?? 'easy') as Difficulty;
  const isDaily = !!route.params?.isDaily;
  const dailyDateISO = route.params?.dailyDateISO;
  const dailySeed = route.params?.dailySeed;

  const [cards, setCards] = useState<ReturnType<typeof buildDeck>>([]);
  const [flipped, setFlipped] = useState<number[]>([]);
  const [matched, setMatched] = useState<number[]>([]);
  const [attempts, setAttempts] = useState(0);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [lockInput, setLockInput] = useState(false);
  const [finishing, setFinishing] = useState(false);

  const { cols } = getBoardSize(difficulty);

  useEffect(() => {
    let mounted = true;
    const init = async () => {
      const saved = await getMemoryState();
      if (
        saved &&
        saved.difficulty === difficulty &&
        !!saved.isDaily === isDaily &&
        (!isDaily || saved.dailyDateISO === dailyDateISO)
      ) {
        if (!mounted) return;
        setCards(saved.cards);
        setFlipped(saved.flipped);
        setMatched(saved.matched);
        setAttempts(saved.attempts);
        setElapsedMs(saved.elapsedMs);
        return;
      }
      if (!mounted) return;
      setCards(buildDeck(difficulty, isDaily ? dailySeed : undefined));
      setFlipped([]);
      setMatched([]);
      setAttempts(0);
      setElapsedMs(0);
    };
    init();

    return () => {
      mounted = false;
    };
  }, [difficulty, isDaily, dailyDateISO, dailySeed]);

  useEffect(() => {
    if (cards.length === 0) return;
    const timer = setInterval(() => setElapsedMs((prev) => prev + 1000), 1000);
    return () => clearInterval(timer);
  }, [cards.length]);

  useEffect(() => {
    if (!cards.length) return;
    saveMemoryState({ cards, flipped, matched, attempts, elapsedMs, difficulty, isDaily, dailyDateISO, seed: dailySeed });
  }, [cards, flipped, matched, attempts, elapsedMs, difficulty, isDaily, dailyDateISO, dailySeed]);

  const isComplete = useMemo(() => cards.length > 0 && matched.length === cards.length, [cards.length, matched.length]);

  useEffect(() => {
    if (!isComplete || finishing) return;
    const finalize = async () => {
      setFinishing(true);
      const score = Math.max(0, cards.length * 10 - attempts * 3);
      await recordSession({ gameId: 'memory', difficulty, durationMs: elapsedMs, score, won: true });
      const { earnedXp } = await grantXp({ gameId: 'memory', difficulty, won: true, durationMs: elapsedMs, score });
      if (isDaily) await markDailyCompleted();
      await clearMemoryState();
      Alert.alert('¡Memory completado!', `Score ${score} · +${earnedXp} XP`);
      setFinishing(false);
    };
    finalize();
  }, [isComplete, finishing, cards.length, attempts, difficulty, elapsedMs, isDaily]);

  const onCardPress = (index: number) => {
    if (lockInput || flipped.includes(index) || matched.includes(index)) return;
    const nextFlipped = [...flipped, index];
    setFlipped(nextFlipped);

    if (nextFlipped.length === 2) {
      setAttempts((prev) => prev + 1);
      const [a, b] = nextFlipped;
      const match = cards[a].pairId === cards[b].pairId;

      if (match) {
        setMatched((prev) => [...prev, a, b]);
        setFlipped([]);
      } else {
        setLockInput(true);
        setTimeout(() => {
          setFlipped([]);
          setLockInput(false);
        }, 650);
      }
    }
  };

  const restart = () => {
    setCards(buildDeck(difficulty, isDaily ? dailySeed : undefined));
    setFlipped([]);
    setMatched([]);
    setAttempts(0);
    setElapsedMs(0);
  };

  return (
    <ScrollView contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.md }}>
      <Card>
        <Text style={[theme.typography.h3, { color: theme.colors.text }]}>Memory · {difficulty}</Text>
        <Text style={{ color: theme.colors.textMuted, marginTop: 6 }}>
          Tiempo: {msToClock(elapsedMs)} · Intentos: {attempts}
        </Text>
      </Card>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
        {cards.map((card, index) => (
          <MemoryCard
            key={card.id}
            emoji={card.emoji}
            isFaceUp={flipped.includes(index)}
            isMatched={matched.includes(index)}
            onPress={() => onCardPress(index)}
          />
        ))}
      </View>

      <Button title="Reiniciar" onPress={restart} disabled={isDaily} />
    </ScrollView>
  );
}