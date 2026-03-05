import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../app/routes';
import { difficultyLabel, Difficulty, normalizeDifficulty } from '../types';
import { generateQuestions } from './logic/questions';
import HUD from './components/HUD';
import Button from '../../shared/ui/Button';
import Card from '../../shared/ui/Card';
import { useAppTheme } from '../../shared/theme/theme';
import { clearMentalMathState, getMentalMathState, saveMentalMathState } from './storage/mentalmathState';
import { trackSessionStart, trackWin } from '../../shared/storage/stats';
import { grantXp } from '../../shared/gamification/xp';
import { grantSeasonPoints } from '../../shared/gamification/seasonPoints';
import { claimDailyReward, completeDailyStage, ensureDailyToday, getDailyProgress, markDailyStageStarted } from '../../shared/storage/daily';
import { getProfile } from '../../shared/storage/profile';
import Screen from '../../shared/ui/Screen';
import Pill from '../../shared/ui/Pill';
import { updateNeuroAfterGame } from '../../core/gamification/neuroscore';

type Props = NativeStackScreenProps<RootStackParamList, 'MentalMath'>;

export default function MentalMathScreen({ route, navigation }: Props) {
  const { theme } = useAppTheme();
  const difficulty = normalizeDifficulty(route.params?.difficulty, 'avanzado') as Difficulty;
  const isDaily = route.params?.mode === 'daily' || !!route.params?.isDaily;
  const dailyDateISO = route.params?.dailyDateISO;
  const dailySeed = route.params?.dailySeed;
  const stageIndex = route.params?.stageIndex;

  const [questions, setQuestions] = useState(generateQuestions(difficulty, 40, isDaily ? dailySeed : undefined));
  const [currentIndex, setCurrentIndex] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [wrong, setWrong] = useState(0);
  const [timeLeft, setTimeLeft] = useState(60);
  const [inputValue, setInputValue] = useState('');
  const [sessionStarted, setSessionStarted] = useState(false);
  const [didFinish, setDidFinish] = useState(false);
  const [finishing, setFinishing] = useState(false);
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
      setTimeLeft(60);
      setInputValue('');
      setSessionStarted(true);
      setDidFinish(false);
      await trackSessionStart({ gameId: 'mentalmath', mode: isDaily ? 'daily' : 'normal' });
    };

    init();
    return () => {
      mounted = false;
    };
  }, [difficulty, isDaily, dailyDateISO, dailySeed, stageIndex]);

  useEffect(() => {
    if (!sessionStarted || didFinish || dailyBlockedReason) return;
    const timer = setInterval(() => {
      setTimeLeft((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [sessionStarted, didFinish, dailyBlockedReason]);

  useEffect(() => {
    saveMentalMathState({
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
    });
  }, [questions, currentIndex, correct, wrong, timeLeft, inputValue, sessionStarted, didFinish, difficulty, isDaily, dailyDateISO, dailySeed]);

  const current = useMemo(() => questions[currentIndex % questions.length], [questions, currentIndex]);

  const finish = async () => {
    if (finishing || didFinish) return;
    setFinishing(true);
    setDidFinish(true);
    await trackWin({
      gameId: 'mentalmath',
      mode: isDaily ? 'daily' : 'normal',
      difficulty,
      durationMs: 60000,
      score: correct,
    });
    let earnedXp = 0;
    let earnedSp = 0;

    if (isDaily) {
      const stageResult = await completeDailyStage({
        stageIndex,
        gameId: 'mentalmath',
        difficulty,
        result: {
          durationMs: 60_000,
          score: correct,
          mistakes: wrong,
        },
      });

      if (stageResult.stageCompletedNow) {
        await updateNeuroAfterGame({
          gameId: 'mentalmath',
          difficulty,
          won: true,
          durationMs: 60_000,
          score: correct,
          mistakes: wrong,
          mode: 'daily',
        });
      }

      if (stageResult.circuitCompletedNow) {
        const { alreadyClaimed } = await claimDailyReward();
        if (!alreadyClaimed) {
          const profile = await getProfile();
          const xpResult = await grantXp({
            gameId: 'mentalmath',
            difficulty,
            won: true,
            durationMs: 60000,
            score: correct,
            mode: 'daily',
            streakCurrent: profile.streakCurrent,
          });
          earnedXp = xpResult.earnedXp;

          const spResult = await grantSeasonPoints({
            gameId: 'mentalmath',
            difficulty,
            durationMs: 60000,
            isDaily: true,
            dailyCompletedAndClaimable: true,
          });
          earnedSp = spResult.earnedSeasonPoints;
        }
      }

      const progress = getDailyProgress(stageResult.daily);
      await clearMentalMathState();
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
        gameId: 'mentalmath',
        difficulty,
        won: true,
        durationMs: 60_000,
        score: correct,
        mistakes: wrong,
        mode: 'normal',
      });

      const xpResult = await grantXp({
        gameId: 'mentalmath',
        difficulty,
        won: true,
        durationMs: 60000,
        score: correct,
        mode: 'normal',
      });
      earnedXp = xpResult.earnedXp;

      const spResult = await grantSeasonPoints({
        gameId: 'mentalmath',
        difficulty,
        durationMs: 60000,
        isDaily: false,
      });
      earnedSp = spResult.earnedSeasonPoints;
    }

    await clearMentalMathState();
    setSessionStarted(false);
    Alert.alert('Sesión terminada', `Aciertos: ${correct} · +${earnedXp} XP · +${earnedSp} SP`);
    setFinishing(false);
  };

  useEffect(() => {
    if (timeLeft === 0) {
      finish();
    }
  }, [timeLeft]);

  const submit = () => {
    if (dailyBlockedReason || didFinish) return;
    const answer = Number(inputValue);
    if (!Number.isFinite(answer)) return;

    if (answer === current.answer) setCorrect((prev) => prev + 1);
    else setWrong((prev) => prev + 1);

    setCurrentIndex((prev) => prev + 1);
    setInputValue('');
  };

  const appendDigit = (digit: string) => {
    if (dailyBlockedReason || didFinish) return;
    if (digit === '-' && inputValue.includes('-')) return;
    setInputValue((prev) => (prev === '0' ? digit : prev + digit));
  };

  const resetSession = () => {
    if (isDaily) return;
    setQuestions(generateQuestions(difficulty, 40, isDaily ? dailySeed : undefined));
    setCurrentIndex(0);
    setCorrect(0);
    setWrong(0);
    setTimeLeft(60);
    setInputValue('');
    setDidFinish(false);
    setSessionStarted(true);
    trackSessionStart({ gameId: 'mentalmath', mode: isDaily ? 'daily' : 'normal' });
  };

  return (
    <Screen>
      <HUD timeLeft={timeLeft} correct={correct} wrong={wrong} />

      <Card variant="pink">
        <Text style={[theme.typography.h3, { color: theme.colors.text }]}>Mental Math · {difficultyLabel(difficulty)}</Text>
        <View style={{ marginTop: 8 }}>
          <Pill label={isDaily ? `Reto diario · ${difficultyLabel(difficulty)}` : `Modo normal · ${difficultyLabel(difficulty)}`} tone={isDaily ? 'warning' : 'default'} />
        </View>
        <Text style={{ color: theme.colors.text, fontSize: 32, fontWeight: '700', marginTop: 10 }}>{current?.text ?? '-'}</Text>
        <Text style={{ color: theme.colors.textMuted, marginTop: 10 }}>Respuesta: {inputValue || '...'}</Text>
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
        {['1', '2', '3', '4', '5', '6', '7', '8', '9', '-', '0'].map((digit) => (
          <Button key={digit} title={digit} onPress={() => appendDigit(digit)} style={{ width: 68 }} />
        ))}
        </View>
      ) : null}

      <Card>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Button title="Borrar" variant="secondary" onPress={() => setInputValue('')} style={{ flex: 1 }} disabled={!!dailyBlockedReason} />
          <Button title="Enviar" onPress={submit} style={{ flex: 1 }} disabled={!!dailyBlockedReason} />
        </View>
      </Card>

      <Button title="Reiniciar" variant="ghost" onPress={resetSession} disabled={isDaily || !!dailyBlockedReason} />
    </Screen>
  );
}