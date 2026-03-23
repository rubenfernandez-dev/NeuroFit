import { describe, it } from 'vitest';
import { getMentalMathSampleReports } from './questions';

describe('MentalMath difficulty samples', () => {
  it('prints 10 questions per difficulty with a compact summary', () => {
    const reports = getMentalMathSampleReports(10, 20260323);

    const lines: string[] = [];

    for (const report of reports) {
      lines.push(`Dificultad: ${report.difficulty}`);
      report.questions.forEach((question, index) => {
        lines.push(`${index + 1}. ${question.text} = ${question.answer}`);
      });
      lines.push(
        `Resumen: longitud media=${report.stats.avgVisualLength}, 2+ pasos=${report.stats.twoStepOrMoreCount}, divisiones=${report.stats.divisionCount}, sospechosamente largas=${report.stats.suspiciouslyLongCount}`,
      );
      lines.push('');
    }

    // Output intended for visual QA during balancing review.
    console.log(lines.join('\n'));
  });
});
