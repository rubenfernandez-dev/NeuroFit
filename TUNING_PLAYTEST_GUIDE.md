# NeuroFit Tuning Fino - Guia de Playtest Manual

Ultima actualizacion: 2026-04-11

Objetivo: ajustar dificultad, duracion y recompensas con cambios pequenos, seguros y medibles.

## 1) Mapa de parametros sensibles por juego

### Sudoku

Ubicacion:

- src/games/sudoku/logic/difficulty.ts

Parametros:

- SUDOKU_CLUES por dificultad

Sensibilidad alta:

- numero de pistas (cambia mucho la dificultad percibida)

Ajustes de bajo riesgo recomendados:

- +/- 1 pista por dificultad por iteracion de tuning

Estado actual de decision:

- Sin cambios adicionales por ahora.
- Pendiente exclusivo de validacion por playtest de dificultad.

### Memory

Ubicacion:

- src/games/memory/logic/deck.ts
- src/games/memory/logic/scoring.ts

Parametros:

- cols, rows
- previewTimeMs
- mismatchLockMs
- score por acierto (base + bonus de racha)
- penalizacion por error
- pesos de computeMemoryRewardScore

Sensibilidad alta:

- previewTimeMs en maestro/gran_maestro
- penalizacion por error
- bonus de racha

Ajustes de bajo riesgo recomendados:

- previewTimeMs: pasos de 80-120 ms
- penalizacion: pasos de 1-2 puntos
- bonus maximo de racha: pasos de 1-2 puntos

### Mental Math

Ubicacion:

- src/games/mentalmath/logic/session.ts

Parametros:

- initialTimeSec
- maxTimeSec
- bonusOnCorrectSec
- maxErrors
- minCorrectToWin
- minAccuracyPctToWin
- pesos de computeMentalMathRewardScore

Sensibilidad alta:

- maxErrors
- minCorrectToWin
- bonusOnCorrectSec

Ajustes de bajo riesgo recomendados:

- maxErrors: +/- 1
- minCorrectToWin: +/- 1
- bonusOnCorrectSec: +/- 1 segundo

### Speed Match

Ubicacion:

- src/games/speedmatch/logic.ts

Parametros:

- durationSec
- symbolCount
- matchProbability
- stimulusIntervalMs
- maxMistakes
- minAccuracyPctToWin
- minCorrectToWin
- pesos de computeSpeedMatchRewardScore

Sensibilidad alta:

- stimulusIntervalMs
- maxMistakes
- minAccuracyPctToWin

Ajustes de bajo riesgo recomendados:

- stimulusIntervalMs: pasos de 20-40 ms
- maxMistakes: +/- 1
- minAccuracyPctToWin: +/- 2-3 puntos

### Pattern Memory

Ubicacion:

- src/games/patternmemory/logic.ts
- src/games/patternmemory/PatternMemoryScreen.tsx

Parametros:

- tileOnMs
- tilePauseMs
- maxRound
- totalSeconds
- bonus por acierto (+8s en screen)
- reactionBestMs / reactionWorstMs
- pesos de calculatePatternMemoryScore

Sensibilidad alta:

- bonus por acierto
- tileOnMs + tilePauseMs
- totalSeconds

Ajustes de bajo riesgo recomendados:

- bonus por acierto: +/- 1 segundo
- tileOnMs/tilePauseMs: +/- 20-40 ms
- totalSeconds: +/- 3-5 segundos

### Focus Grid

Ubicacion:

- src/games/focusgrid/logic.ts

Parametros:

- gridSize
- totalSeconds
- targetMinMs / targetMaxMs
- pesos de calculateFocusGridScore

Sensibilidad alta:

- totalSeconds
- gridSize

Ajustes de bajo riesgo recomendados:

- totalSeconds: +/- 2-3 segundos
- targetMinMs/targetMaxMs: ajustar juntos

### Number Match

Ubicacion:

- src/games/numbermatch/logic.ts
- src/games/numbermatch/NumberMatchScreen.tsx

Parametros:

- rows, cols
- initialFilled
- addLineCount
- totalSeconds
- ventana de combo (2500 ms en screen)
- score por match valido (+10 + combo bonus)
- pesos de computeRewardScoreNumberMatch
- umbral de victoria (boardClearedPercent >= 85 en screen)

Sensibilidad alta:

- initialFilled
- addLineCount
- umbral de victoria (85)
- reglas de conexion

Ajustes de bajo riesgo recomendados:

- initialFilled: +/- 1 o 2
- addLineCount: +/- 1
- umbral de victoria: +/- 3-5 puntos

### XP / SP global

Ubicacion:

- src/core/gamification/economy.ts

Parametros:

- difficultyMultipliers
- xpBase, xpPerformance, xpDaily
- spBase, spPerformance, spDaily

Sensibilidad alta:

- difficultyMultipliers
- terminos base (xpBase/spBase)

Ajustes de bajo riesgo recomendados:

- tocar primero multiplicadores por dificultad en pasos pequenos (0.05)

## 2) Plantilla de playtest manual (sin backend)

Una fila por sesion jugada:

| Fecha | Tester | Juego | Dificultad | Victoria (S/N) | Aciertos | Errores | Duracion (s) | Reward Score (0-100) | XP | SP | Sensacion (facil/justa/frustrante) | Nota corta |
|---|---|---|---|---|---:|---:|---:|---:|---:|---:|---|---|
| 2026-04-11 | Ana | Speed Match | maestro | S | 18 | 7 | 49 | 71 | 52 | 33 | justa | final exigente pero controlable |

Minimo sugerido por ronda de tuning:

- 5 sesiones por dificultad objetivo
- al menos 2 testers distintos

## 3) Guia de interpretacion rapida

### Si hay demasiada dificultad

- muchos "frustrante"
- winrate < 35%
- score medio < 45

Accion:

- relajar 1 parametro de umbral (errores maximos, tiempo, objetivo minimo)

### Si hay demasiada facilidad

- muchos "facil"
- winrate > 80%
- score medio > 75

Accion:

- endurecer 1 parametro pequeno (menos tiempo, mayor objetivo, menor errores maximos)

### Si sesiones son demasiado largas

- duracion media muy por encima del target del juego

Accion:

- reducir tiempo base o bonus por acierto; evitar tocar varias cosas a la vez

### Si sesiones son demasiado cortas

- muchos finales rapidos por error/timeout

Accion:

- subir tiempo base o tolerancia de errores en pasos pequenos

### Si recompensas se sienten injustas

- sesiones "buenas" con poco XP/SP
- sesiones "malas" con recompensa alta

Accion:

- ajustar pesos del reward score del juego antes de tocar economia global

## 4) Reglas operativas de tuning (seguras)

- Cambiar solo 1-2 parametros por juego por iteracion.
- Recolectar al menos 10-15 sesiones antes de volver a ajustar.
- No tocar daily ni sessionCompletion durante tuning fino, salvo bug claro.
- No tocar economia global hasta estabilizar reward score por juego.

## 5) Que no tocar todavia

- Arquitectura general de juegos.
- Flujos core de daily (`daily.ts`, `sessionCompletion.ts`).
- Backend, telemetria compleja o almacenamiento remoto.
- Refactors amplios de UI o storage sin evidencia de problema real.
