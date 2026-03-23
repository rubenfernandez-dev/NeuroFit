import { Difficulty } from '../../types';
import { createSeededRng, randomInt } from '../../../shared/utils/random';

export type Question = {
  text: string;
  answer: number;
};

export type MentalMathSampleStats = {
  avgVisualLength: number;
  twoStepOrMoreCount: number;
  divisionCount: number;
  suspiciouslyLongCount: number;
};

export type MentalMathSampleReport = {
  difficulty: Difficulty;
  questions: Question[];
  stats: MentalMathSampleStats;
};

const SAMPLE_DIFFICULTIES: Difficulty[] = ['principiante', 'avanzado', 'experto', 'maestro', 'gran_maestro'];

function makeAddSub(rng: () => number, min: number, max: number, allowNegative: boolean): Question {
  const a = randomInt(min, max, rng);
  const b = randomInt(min, max, rng);

  if (rng() < 0.5) {
    return { text: `${a} + ${b}`, answer: a + b };
  }

  if (allowNegative) {
    return { text: `${a} - ${b}`, answer: a - b };
  }

  const hi = Math.max(a, b);
  const lo = Math.min(a, b);
  return { text: `${hi} - ${lo}`, answer: hi - lo };
}

function makeMultiply(rng: () => number, min: number, max: number): Question {
  const a = randomInt(min, max, rng);
  const b = randomInt(min, max, rng);
  return { text: `${a} × ${b}`, answer: a * b };
}

// Divisiones exactas para evitar resultados decimales poco legibles en móvil.
function makeExactDivision(rng: () => number, divisorMin: number, divisorMax: number, resultMin: number, resultMax: number): Question {
  const divisor = randomInt(divisorMin, divisorMax, rng);
  const result = randomInt(resultMin, resultMax, rng);
  const dividend = divisor * result;
  return { text: `${dividend} ÷ ${divisor}`, answer: result };
}

function makePrincipiante(rng: () => number): Question {
  // 1 paso, numeros chicos, sin negativos.
  return makeAddSub(rng, 1, 20, false);
}

function makeAvanzado(rng: () => number): Question {
  // Predomina suma/resta; multiplicacion basica ocasional.
  const mode = randomInt(0, 4, rng);
  if (mode <= 2) return makeAddSub(rng, 5, 45, false);
  return makeMultiply(rng, 2, 12);
}

function makeExperto(rng: () => number): Question {
  // Mezcla real de +, -, × y ÷ exacta en una sola operacion.
  const mode = randomInt(0, 9, rng);
  if (mode <= 2) return makeAddSub(rng, 8, 70, false);
  if (mode <= 6) return makeMultiply(rng, 3, 16);
  return makeExactDivision(rng, 2, 16, 3, 20);
}

function makeMaestro(rng: () => number): Question {
  // Dos pasos claros y cortos, con parentesis para evitar ambiguedad visual.
  const pattern = randomInt(0, 2, rng);

  if (pattern === 0) {
    const a = randomInt(4, 24, rng);
    const b = randomInt(4, 24, rng);
    const c = randomInt(2, 12, rng);
    const sum = a + b;
    return { text: `(${a} + ${b}) × ${c}`, answer: sum * c };
  }

  if (pattern === 1) {
    const divisor = randomInt(2, 18, rng);
    const quotient = randomInt(3, 20, rng);
    const extra = randomInt(4, 25, rng);
    const dividend = divisor * quotient;
    return { text: `${dividend} ÷ ${divisor} + ${extra}`, answer: quotient + extra };
  }

  const a = randomInt(20, 90, rng);
  const b = randomInt(3, 20, rng);
  const c = randomInt(2, 12, rng);
  return { text: `${a} - ${b} × ${c}`, answer: a - b * c };
}

function makeGranMaestro(rng: () => number): Question {
  // Dos o tres pasos, mayor mezcla y rango que maestro.
  const pattern = randomInt(0, 3, rng);

  if (pattern === 0) {
    const a = randomInt(8, 40, rng);
    const b = randomInt(8, 40, rng);
    const c = randomInt(3, 15, rng);
    const d = randomInt(10, 60, rng);
    return { text: `(${a} + ${b}) × ${c} - ${d}`, answer: (a + b) * c - d };
  }

  if (pattern === 1) {
    const divisor = randomInt(3, 18, rng);
    const quotient = randomInt(6, 30, rng);
    const m1 = randomInt(4, 14, rng);
    const m2 = randomInt(3, 12, rng);
    const dividend = divisor * quotient;
    return { text: `${dividend} ÷ ${divisor} + ${m1} × ${m2}`, answer: quotient + m1 * m2 };
  }

  if (pattern === 2) {
    const a = randomInt(5, 20, rng);
    const b = randomInt(5, 20, rng);
    const c = randomInt(5, 20, rng);
    const d = randomInt(2, 12, rng);
    return { text: `(${a} + ${b} + ${c}) × ${d}`, answer: (a + b + c) * d };
  }

  const a = randomInt(20, 80, rng);
  const b = randomInt(4, 20, rng);
  const c = randomInt(4, 20, rng);
  const d = randomInt(3, 16, rng);
  return { text: `${a} × ${b} - ${c} × ${d}`, answer: a * b - c * d };
}

const FACTORY_BY_DIFFICULTY: Record<Difficulty, (rng: () => number) => Question> = {
  principiante: makePrincipiante,
  avanzado: makeAvanzado,
  experto: makeExperto,
  maestro: makeMaestro,
  gran_maestro: makeGranMaestro,
};

export function generateQuestions(difficulty: Difficulty, count: number, seed?: number): Question[] {
  const rng = typeof seed === 'number' ? createSeededRng(seed) : Math.random;
  const factory = FACTORY_BY_DIFFICULTY[difficulty] ?? makeAvanzado;

  return Array.from({ length: count }).map(() => factory(rng));
}

function countOperators(expression: string): number {
  return (expression.match(/[+\-×÷]/g) ?? []).length;
}

function buildStats(questions: Question[]): MentalMathSampleStats {
  const totalLength = questions.reduce((acc, question) => acc + question.text.length, 0);
  const twoStepOrMoreCount = questions.filter((question) => countOperators(question.text) >= 2).length;
  const divisionCount = questions.filter((question) => question.text.includes('÷')).length;
  const suspiciouslyLongCount = questions.filter((question) => question.text.length > 24).length;

  return {
    avgVisualLength: questions.length > 0 ? Math.round((totalLength / questions.length) * 10) / 10 : 0,
    twoStepOrMoreCount,
    divisionCount,
    suspiciouslyLongCount,
  };
}

export function getMentalMathSampleReports(sampleSize = 10, seed = 20260323): MentalMathSampleReport[] {
  return SAMPLE_DIFFICULTIES.map((difficulty, index) => {
    const questions = generateQuestions(difficulty, sampleSize, seed + index * 997);
    return {
      difficulty,
      questions,
      stats: buildStats(questions),
    };
  });
}