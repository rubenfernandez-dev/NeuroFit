import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { normalizeGameRouteParams, RootStackParamList } from '../../app/routes';
import { difficultyLabel, Difficulty, normalizeDifficulty } from '../types';
import { generateQuestions } from './logic/questions';
import { computeMentalMathRewardScore, evaluateMentalMathWin, getMentalMathSessionConfig } from './logic/session';
import HUD from './components/HUD';
import Button from '../../shared/ui/Button';
import Card from '../../shared/ui/Card';
import { useAppTheme } from '../../shared/theme/theme';
import { clearMentalMathState, getMentalMathState, saveMentalMathState } from './storage/mentalmathState';
import { trackSessionStart, trackWin } from '../../shared/storage/stats';
import { ensureDailyToday, markDailyStageStarted } from '../../shared/storage/daily';
import Screen from '../../shared/ui/Screen';
import Pill from '../../shared/ui/Pill';
import { completeGameSession } from '../../shared/gamification/sessionCompletion';
import { playDefeatFeedback, playErrorFeedback, playSuccessFeedback, playVictoryFeedback } from '../../shared/feedback/gameFeedback';
import GameResultModal from '../../shared/feedback/GameResultModal';

type Props = NativeStackScreenProps<RootStackParamList, 'MentalMath'>;

type ResultSummary = {
  correct: number;
  wrong: number;
  score: number;
  won: boolean;
  reason: 'timeout' | 'error_limit';
  earnedXp: number;
  earnedSp: number;
};

export default function MentalMathScreen({ route, navigation }: Props) {
  const { theme } = useAppTheme();
  const gameRoute = normalizeGameRouteParams(route.params);
  const difficulty = normalizeDifficulty(gameRoute.difficulty, 'avanzado') as Difficulty;
  const { isDaily, dailyDateISO, dailySeed, stageIndex } = gameRoute;
  const sessionConfig = useMemo(() => getMentalMathSessionConfig(difficulty), [difficulty]);

  const [questions, setQuestions] = useState(generateQuestions(difficulty, 40, isDaily ? dailySeed : undefined));
  const [currentIndex, setCurrentIndex] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [wrong, setWrong] = useState(0);
  const [timeLeft, setTimeLeft] = useState(sessionConfig.initialTimeSec);
  const [inputValue, setInputValue] = useState('');
  const [sessionStarted, setSessionStarted] = useState(false);
  const [didFinish, setDidFinish] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [resultVisible, setResultVisible] = useState(false);
  const [resultSummary, setResultSummary] = useState<ResultSummary | null>(null);
  const [dailyBlockedReason, setDailyBlockedReason] = useState<string | null>(null);

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

        if (!expectedStage || expectedStage.gameId !== 'mentalmath') {
          setDailyBlockedReason('Esta etapa no está activa. Continúa el circuito desde Reto diario.');
          return;
        }

        if (typeof stageIndex === 'number' && stageIndex !== daily.currentStageIndex) {
          setDailyBlockedReason('Esta etapa ya no está activa. Continúa desde Reto diario.');
          return;
        }

        await markDailyStageStarted({ stageIndex, gameId: 'mentalmath' });
      }

      const saved = await getMentalMathState();
      if (
        saved &&
        saved.difficulty === difficulty &&
        !!saved.isDaily === isDaily &&
        (!isDaily || saved.dailyDateISO === dailyDateISO)
      ) {
        if (!mounted) return;
        setQuestions(saved.questions);
        setCurrentIndex(saved.currentIndex);
        setCorrect(saved.correct);
        setWrong(saved.wrong);
        setTimeLeft(saved.timeLeft);
        setInputValue(saved.inputValue);
        setSessionStarted(Boolean(saved.sessionStarted));
        setDidFinish(Boolean(saved.didFinish));
        if (!saved.sessionStarted) {
          await trackSessionStart({ gameId: 'mentalmath', mode: isDaily ? 'daily' : 'normal' });
          setSessionStarted(true);
        }
        return;
      }

      if (!mounted) return;
      setQuestions(generateQuestions(difficulty, 40, isDaily ? dailySeed : undefined));
      setCurrentIndex(0);
      setCorrect(0);
      setWrong(0);
      setTimeLeft(sessionConfig.initialTimeSec);
      setInputValue('');
      setSessionStarted(true);
      setDidFinish(false);
      setResultVisible(false);
      setResultSummary(null);
      await trackSessionStart({ gameId: 'mentalmath', mode: isDaily ? 'daily' : 'normal' });
    };

    init();
    return () => {
      mounted = false;
    };
  }, [difficulty, isDaily, dailyDateISO, dailySeed, stageIndex, sessionConfig.initialTimeSec]);

  useEffect(() => {
    if (!sessionStarted || didFinish || dailyBlockedReason) return;
    const timer = setInterval(() => {
      setTimeLeft((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [sessionStarted, didFinish, dailyBlockedReason]);

  // Ref keeps the full save payload current on every render.
  const mentalMathPersistRef = useRef<Parameters<typeof saveMentalMathState>[0] | null>(null);
  mentalMathPersistRef.current = {
    questions,
    currentIndex,
    correct,
    wrong,
    timeLeft,
    inputValue,
    sessionStarted,
    didFinish,
    difficulty,
    isDaily,
    dailyDateISO,
    seed: dailySeed,
  };

  // Persist on answer submissions (currentIndex / correct / wrong change).
  // timeLeft is excluded — it ticks every second.
  // inputValue is excluded — it is ephemeral (re-entering on restore is low-cost).
  // Both are still captured via the ref when the effect fires on meaningful events.
  useEffect(() => {
    const p = mentalMathPersistRef.current;
    if (!p) return;
    saveMentalMathState(p);
  }, [questions, currentIndex, correct, wrong, sessionStarted, didFinish, difficulty, isDaily, dailyDateISO, dailySeed]);

  // Checkpoint every 30 s + save on unmount (handles back-navigation mid-game).
  useEffect(() => {
    const id = setInterval(() => {
      const p = mentalMathPersistRef.current;
      if (p?.sessionStarted && !p.didFinish) saveMentalMathState(p);
    }, 30_000);
    return () => {
      clearInterval(id);
      const p = mentalMathPersistRef.current;
      if (p?.sessionStarted && !p.didFinish) saveMentalMathState(p);
    };
  }, []);

  const current = useMemo(() => questions[currentIndex % questions.length], [questions, currentIndex]);

  const finish = async (reason: 'timeout' | 'error_limit') => {
    if (finishing || didFinish) return;
    setFinishing(true);
    setDidFinish(true);
    const elapsedSec = Math.max(
      1,
      sessionConfig.initialTimeSec + correct * sessionConfig.bonusOnCorrectSec - timeLeft,
    );
    const score = computeMentalMathRewardScore({ correct, wrong, elapsedSec, difficulty });
    const won = reason !== 'error_limit' && evaluateMentalMathWin({ correct, wrong, difficulty });

    if (won) {
      await trackWin({
        gameId: 'mentalmath',
        mode: isDaily ? 'daily' : 'normal',
        difficulty,
        durationMs: elapsedSec * 1000,
        score,
      });
    }

    const completionResult = await completeGameSession({
      gameId: 'mentalmath',
      difficulty,
      mode: isDaily ? 'daily' : 'normal',
      won,
      stageIndex,
      metrics: {
        durationMs: elapsedSec * 1000,
        score,
        mistakes: wrong,
      },
    });

    if (isDaily && completionResult.dailyCompletion) {
      if (won) void playVictoryFeedback();
      else void playDefeatFeedback();
      await clearMentalMathState();
      setSessionStarted(false);
      setFinishing(false);

      navigation.replace('DailyChallenge', {
        completion: completionResult.dailyCompletion,
      });
      return;
    }

    await clearMentalMathState();
    setSessionStarted(false);
    if (won) void playVictoryFeedback();
    else void playDefeatFeedback();
    setResultSummary({
      correct,
      wrong,
      score,
      won,
      reason,
      earnedXp: completionResult.earnedXp,
      earnedSp: completionResult.earnedSp,
    });
    setResultVisible(true);
    setFinishing(false);
  };

  useEffect(() => {
    if (timeLeft === 0) {
      finish('timeout');
    }
  }, [timeLeft]);

  useEffect(() => {
    if (didFinish) return;
    if (wrong >= sessionConfig.maxErrors) {
      finish('error_limit');
    }
  }, [didFinish, sessionConfig.maxErrors, wrong]);

  const submit = () => {
    if (dailyBlockedReason || didFinish) return;
    const answer = Number(inputValue);
    if (!Number.isFinite(answer)) return;

    if (answer === current.answer) {
      void playSuccessFeedback();
      setCorrect((prev) => prev + 1);
      setTimeLeft((prev) => Math.min(sessionConfig.maxTimeSec, prev + sessionConfig.bonusOnCorrectSec));
    } else {
      void playErrorFeedback();
      setWrong((prev) => prev + 1);
    }

    setCurrentIndex((prev) => prev + 1);
    setInputValue('');
  };

  const appendDigit = (digit: string) => {
    if (dailyBlockedReason || didFinish) return;
    if (digit === '-' && inputValue.includes('-')) return;
    setInputValue((prev) => (prev === '0' ? digit : prev + digit));
  };

  const deleteLastDigit = () => {
    if (dailyBlockedReason || didFinish) return;
    setInputValue((prev) => {
      if (prev.length <= 1) return '';
      return prev.slice(0, -1);
    });
  };

  const resetSession = () => {
    if (isDaily) return;
    setQuestions(generateQuestions(difficulty, 40, isDaily ? dailySeed : undefined));
    setCurrentIndex(0);
    setCorrect(0);
    setWrong(0);
    setTimeLeft(sessionConfig.initialTimeSec);
    setInputValue('');
    setDidFinish(false);
    setResultVisible(false);
    setResultSummary(null);
    setSessionStarted(true);
    trackSessionStart({ gameId: 'mentalmath', mode: isDaily ? 'daily' : 'normal' });
  };

  return (
    <>
    <Screen>
      <HUD timeLeft={timeLeft} correct={correct} wrong={wrong} />

      <Card variant="pink">
        <Text style={[theme.typography.h3, { color: theme.colors.text }]}>Mental Math · {difficultyLabel(difficulty)}</Text>
        <View style={{ marginTop: 8 }}>
          <Pill label={isDaily ? `Reto diario · ${difficultyLabel(difficulty)}` : `Modo normal · ${difficultyLabel(difficulty)}`} tone={isDaily ? 'warning' : 'default'} />
        </View>
        <Text style={{ color: theme.colors.text, fontSize: 32, fontWeight: '700', marginTop: 10 }}>{current?.text ?? '-'}</Text>
        <Text style={{ color: theme.colors.textMuted, marginTop: 10 }}>Respuesta: {inputValue || '...'}</Text>
        <Text style={{ color: theme.colors.textMuted, marginTop: 8 }}>
          +{sessionConfig.bonusOnCorrectSec}s por acierto · Máx. fallos: {sessionConfig.maxErrors}
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
        <View style={{ gap: 8 }}>
          {/* Fila 1: 7 8 9 */}
          <View style={{ flexDirection: 'row', gap: 8, justifyContent: 'center' }}>
            {['7', '8', '9'].map((digit) => (
              <Button key={digit} title={digit} onPress={() => appendDigit(digit)} style={{ flex: 1, maxWidth: 80 }} />
            ))}
          </View>
          {/* Fila 2: 4 5 6 */}
          <View style={{ flexDirection: 'row', gap: 8, justifyContent: 'center' }}>
            {['4', '5', '6'].map((digit) => (
              <Button key={digit} title={digit} onPress={() => appendDigit(digit)} style={{ flex: 1, maxWidth: 80 }} />
            ))}
          </View>
          {/* Fila 3: 1 2 3 */}
          <View style={{ flexDirection: 'row', gap: 8, justifyContent: 'center' }}>
            {['1', '2', '3'].map((digit) => (
              <Button key={digit} title={digit} onPress={() => appendDigit(digit)} style={{ flex: 1, maxWidth: 80 }} />
            ))}
          </View>
          {/* Fila 4: Borrar 0 Enviar */}
          <View style={{ flexDirection: 'row', gap: 8, justifyContent: 'center' }}>
            <Button
              title="⌫"
              variant="primary"
              onPress={deleteLastDigit}
              style={{ flex: 1, maxWidth: 80, backgroundColor: theme.colors.red, borderColor: theme.colors.red }}
              disabled={!!dailyBlockedReason}
            />
            <Button title="0" onPress={() => appendDigit('0')} style={{ flex: 1, maxWidth: 80 }} />
            <Button
              title="✓"
              variant="primary"
              onPress={submit}
              style={{ flex: 1, maxWidth: 80, backgroundColor: theme.colors.green, borderColor: theme.colors.green }}
              disabled={!!dailyBlockedReason}
            />
          </View>

          {/* Fila 5: signo negativo */}
          <View style={{ flexDirection: 'row', gap: 8, justifyContent: 'center' }}>
            <Button title="-" variant="secondary" onPress={() => appendDigit('-')} style={{ flex: 1, maxWidth: 80 }} disabled={!!dailyBlockedReason} />
          </View>
        </View>
      ) : null}

      <Button title="Reiniciar" variant="ghost" onPress={resetSession} disabled={isDaily || !!dailyBlockedReason} />
    </Screen>
    <GameResultModal
      visible={resultVisible}
      onRequestClose={() => setResultVisible(false)}
      variant={resultSummary?.won ? 'victory' : 'defeat'}
      title={resultSummary?.won ? '¡Sesión terminada!' : 'Sesión fallida'}
      subtitle={
        resultSummary?.won
          ? 'Buen cálculo mental, sigue así.'
          : resultSummary?.reason === 'error_limit'
            ? 'Alcanzaste el límite de fallos.'
            : 'No se alcanzó el objetivo mínimo para victoria.'
      }
      metrics={[
        { label: 'Aciertos', value: resultSummary?.correct ?? 0 },
        { label: 'Fallos', value: resultSummary?.wrong ?? 0 },
        { label: 'Score', value: resultSummary?.score ?? 0 },
        { label: 'XP', value: `+${resultSummary?.earnedXp ?? 0}` },
        { label: 'SP', value: `+${resultSummary?.earnedSp ?? 0}` },
      ]}
      primaryAction={{
        label: 'Jugar de nuevo',
        onPress: () => {
          setResultVisible(false);
          resetSession();
        },
      }}
      secondaryAction={{
        label: 'Ver ranking local',
        variant: 'secondary',
        onPress: () => {
          setResultVisible(false);
          navigation.navigate('Leaderboard');
        },
      }}
    />
    </>
  );
}