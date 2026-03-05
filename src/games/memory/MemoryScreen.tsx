import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../app/routes';
import { difficultyLabel, Difficulty, normalizeDifficulty } from '../types';
import { buildDeck, getBoardSize } from './logic/deck';
import MemoryCard from './components/MemoryCard';
import { clearMemoryState, getMemoryState, saveMemoryState } from './storage/memoryState';
import Card from '../../shared/ui/Card';
import Button from '../../shared/ui/Button';
import { useAppTheme } from '../../shared/theme/theme';
import { msToClock } from '../../shared/utils/time';
import { trackSessionStart, trackWin } from '../../shared/storage/stats';
import { grantXp } from '../../shared/gamification/xp';
import { grantSeasonPoints } from '../../shared/gamification/seasonPoints';
import { claimDailyReward, completeDailyStage, ensureDailyToday, getDailyProgress, markDailyStageStarted } from '../../shared/storage/daily';
import { getProfile } from '../../shared/storage/profile';
import Screen from '../../shared/ui/Screen';
import Pill from '../../shared/ui/Pill';
import { updateNeuroAfterGame } from '../../core/gamification/neuroscore';

type Props = NativeStackScreenProps<RootStackParamList, 'Memory'>;

export default function MemoryScreen({ route, navigation }: Props) {
  const { theme } = useAppTheme();
  const difficulty = normalizeDifficulty(route.params?.difficulty, 'principiante') as Difficulty;
  const isDaily = route.params?.mode === 'daily' || !!route.params?.isDaily;
  const dailyDateISO = route.params?.dailyDateISO;
  const dailySeed = route.params?.dailySeed;
  const stageIndex = route.params?.stageIndex;

  const [cards, setCards] = useState<ReturnType<typeof buildDeck>>([]);
  const [flipped, setFlipped] = useState<number[]>([]);
  const [matched, setMatched] = useState<number[]>([]);
  const [attempts, setAttempts] = useState(0);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [lockInput, setLockInput] = useState(false);
  const [sessionStarted, setSessionStarted] = useState(false);
  const [didFinish, setDidFinish] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [dailyBlockedReason, setDailyBlockedReason] = useState<string | null>(null);

  const { cols } = getBoardSize(difficulty);

  useEffect(() => {
    let mounted = true;
    const init = async () => {
      if (isDaily) {
        const daily = await ensureDailyToday();
        const expectedStage = daily.stages[daily.currentStageIndex];
        if (daily.completed) {
          setDailyBlockedReason('Reto diario ya completado, vuelve mañana.');
          Alert.alert('Reto diario completado', 'Reto diario ya completado, vuelve mañana.');
          return;
        }

        if (!expectedStage || expectedStage.gameId !== 'memory') {
          setDailyBlockedReason('Esta etapa no está activa. Continúa el circuito desde Reto diario.');
          return;
        }

        if (typeof stageIndex === 'number' && stageIndex !== daily.currentStageIndex) {
          setDailyBlockedReason('Esta etapa ya no está activa. Continúa desde Reto diario.');
          return;
        }

        await markDailyStageStarted({ stageIndex, gameId: 'memory' });
      }

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
        setSessionStarted(Boolean(saved.sessionStarted));
        setDidFinish(Boolean(saved.didFinish));

        if (!saved.sessionStarted) {
          await trackSessionStart({ gameId: 'memory', mode: isDaily ? 'daily' : 'normal' });
          setSessionStarted(true);
        }

        return;
      }
      if (!mounted) return;
      setCards(buildDeck(difficulty, isDaily ? dailySeed : undefined));
      setFlipped([]);
      setMatched([]);
      setAttempts(0);
      setElapsedMs(0);
      setDidFinish(false);
      setSessionStarted(true);
      await trackSessionStart({ gameId: 'memory', mode: isDaily ? 'daily' : 'normal' });
    };
    init();

    return () => {
      mounted = false;
    };
  }, [difficulty, isDaily, dailyDateISO, dailySeed, stageIndex]);

  useEffect(() => {
    if (!sessionStarted || cards.length === 0 || didFinish || dailyBlockedReason) return;
    const timer = setInterval(() => setElapsedMs((prev) => prev + 1000), 1000);
    return () => clearInterval(timer);
  }, [sessionStarted, cards.length, didFinish, dailyBlockedReason]);

  useEffect(() => {
    if (!cards.length) return;
    saveMemoryState({ cards, flipped, matched, attempts, elapsedMs, difficulty, isDaily, dailyDateISO, seed: dailySeed, sessionStarted, didFinish });
  }, [cards, flipped, matched, attempts, elapsedMs, difficulty, isDaily, dailyDateISO, dailySeed, sessionStarted, didFinish]);

  const isComplete = useMemo(() => cards.length > 0 && matched.length === cards.length, [cards.length, matched.length]);

  useEffect(() => {
    if (!isComplete || finishing || didFinish) return;
    const finalize = async () => {
      setFinishing(true);
      setDidFinish(true);
      const score = Math.max(0, cards.length * 10 - attempts * 3);
      await trackWin({
        gameId: 'memory',
        mode: isDaily ? 'daily' : 'normal',
        difficulty,
        durationMs: elapsedMs,
        score,
      });
      let earnedXp = 0;
      let earnedSp = 0;

      if (isDaily) {
        const stageResult = await completeDailyStage({
          stageIndex,
          gameId: 'memory',
          difficulty,
          result: {
            durationMs: elapsedMs,
            score,
            mistakes: attempts,
          },
        });

        if (stageResult.stageCompletedNow) {
          await updateNeuroAfterGame({
            gameId: 'memory',
            difficulty,
            won: true,
            durationMs: elapsedMs,
            score,
            mistakes: attempts,
            mode: 'daily',
          });
        }

        if (stageResult.circuitCompletedNow) {
          const { alreadyClaimed } = await claimDailyReward();
          if (!alreadyClaimed) {
            const profile = await getProfile();
            const xpResult = await grantXp({
              gameId: 'memory',
              difficulty,
              won: true,
              durationMs: elapsedMs,
              score,
              mode: 'daily',
              streakCurrent: profile.streakCurrent,
            });
            earnedXp = xpResult.earnedXp;

            const spResult = await grantSeasonPoints({
              gameId: 'memory',
              difficulty,
              durationMs: elapsedMs,
              isDaily: true,
              dailyCompletedAndClaimable: true,
            });
            earnedSp = spResult.earnedSeasonPoints;
          }
        }

        const progress = getDailyProgress(stageResult.daily);
        await clearMemoryState();
        setSessionStarted(false);
        setFinishing(false);

        const completedStageIndex = typeof stageIndex === 'number' ? stageIndex : Math.max(0, stageResult.daily.currentStageIndex - 1);
        const savedResult = stageResult.daily.stages[completedStageIndex]?.result;
        navigation.replace('DailyChallenge', {
          completion: {
            kind: stageResult.circuitCompletedNow ? 'final' : 'stage',
            stageIndex: completedStageIndex,
            earnedXp,
            earnedSp,
            result: savedResult,
            progress,
          },
        });
        return;
      } else {
        await updateNeuroAfterGame({
          gameId: 'memory',
          difficulty,
          won: true,
          durationMs: elapsedMs,
          score,
          mistakes: attempts,
          mode: 'normal',
        });

        const xpResult = await grantXp({
          gameId: 'memory',
          difficulty,
          won: true,
          durationMs: elapsedMs,
          score,
          mode: 'normal',
        });
        earnedXp = xpResult.earnedXp;

        const spResult = await grantSeasonPoints({
          gameId: 'memory',
          difficulty,
          durationMs: elapsedMs,
          isDaily: false,
        });
        earnedSp = spResult.earnedSeasonPoints;
      }

      await clearMemoryState();
      setSessionStarted(false);
      Alert.alert('¡Memory completado!', `Score ${score} · +${earnedXp} XP · +${earnedSp} SP`);
      setFinishing(false);
    };
    finalize();
  }, [isComplete, finishing, didFinish, cards.length, attempts, difficulty, elapsedMs, isDaily]);

  const onCardPress = (index: number) => {
    if (dailyBlockedReason) return;
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
    if (isDaily) return;
    setCards(buildDeck(difficulty, isDaily ? dailySeed : undefined));
    setFlipped([]);
    setMatched([]);
    setAttempts(0);
    setElapsedMs(0);
    setDidFinish(false);
    setSessionStarted(true);
    trackSessionStart({ gameId: 'memory', mode: isDaily ? 'daily' : 'normal' });
  };

  return (
    <Screen>
      <Card variant="cyan">
        <Text style={[theme.typography.h3, { color: theme.colors.text }]}>Memory · {difficultyLabel(difficulty)}</Text>
        <View style={{ marginTop: 8 }}>
          <Pill label={isDaily ? `Reto diario · ${difficultyLabel(difficulty)}` : `Modo normal · ${difficultyLabel(difficulty)}`} tone={isDaily ? 'warning' : 'default'} />
        </View>
        <Text style={{ color: theme.colors.textMuted, marginTop: 6 }}>
          Tiempo: {msToClock(elapsedMs)} · Intentos: {attempts}
        </Text>
      </Card>

      {dailyBlockedReason ? (
        <Card>
          <Text style={[theme.typography.body, { color: theme.colors.warning }]}>{dailyBlockedReason}</Text>
          <View style={{ marginTop: 10 }}>
            <Button title="Volver al reto diario" onPress={() => navigation.navigate('DailyChallenge')} />
          </View>
        </Card>
      ) : null}

      {!dailyBlockedReason ? (
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
      ) : null}

      <Button title="Reiniciar" onPress={restart} disabled={isDaily || !!dailyBlockedReason} />
    </Screen>
  );
}