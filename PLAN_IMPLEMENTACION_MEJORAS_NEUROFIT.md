# Plan de Implementacion - Mejoras NeuroFit

Fecha: 2026-05-07
Estado: preparado para ejecucion

## 1) Objetivo
Aplicar mejoras completas en economia, UI/UX, navegacion, sesiones y logica de juegos sin romper la estructura actual.

## 2) Principios de implementacion
- Prioridad P1 primero: navegacion, reset de partidas, estandarizacion de ayudas y banner superior.
- Centralizar reglas compartidas donde ya existe infraestructura compartida.
- Evitar cambios ad-hoc por pantalla cuando se pueda resolver en componente comun.
- Mantener compatibilidad de guardado para sesiones a medias.

## 3) Dependencias globales (orden recomendado)
1. Definir contratos compartidos de ayudas y economia.
2. Aplicar navegacion back unificada para todos los juegos.
3. Asegurar regla de reset de partida terminada al abandonar pantalla.
4. Estandarizar UI de ayudas y banner superior.
5. Ejecutar cambios de logica y ayudas por juego.
6. Ajustar recompensas finales por dificultad y calibrar.
7. Completar pruebas unitarias y smoke test manual.

## 4) Backlog por prioridad

### P1 - Critico (bugs, navegacion, reset, estandarizacion visual)

#### P1.1 Economia base y costes de ayudas
- [ ] Subir todos los costes en tabla compartida.
- [ ] Ampliar tabla para nuevas ayudas que hoy no existen (por juego).
- [ ] Alinear ids de reason para analytics en cada ayuda nueva.
Archivos principales:
- src/shared/economy/neuroCoinCosts.ts
- src/shared/economy/neuroCoinService.ts
- src/services/analytics.ts

#### P1.2 Banner superior (XP, Liga, Coins)
- [ ] Hacer el banner mas alto y con tipografia mayor.
- [ ] Forzar una sola linea con 3 bloques bien distribuidos: XP, Liga, Coins.
- [ ] Usar PlayerEconomyBar como componente unico para todos los juegos.
- [ ] Inyectar liga actual (label y sublabel) donde proceda.
Archivos principales:
- src/shared/economy/PlayerEconomyBar.tsx
- src/screens/HomeScreen.tsx
- src/screens/GamesScreen.tsx
- src/screens/DailyChallengeScreen.tsx
- src/games/*/*Screen.tsx

#### P1.3 Boton de ayuda estandarizado y layout 4 por fila
- [ ] Convertir NeuroCoinActionButton a estilo amarillo estandar.
- [ ] Unificar altura minima y tamano de texto en todos los juegos.
- [ ] Definir ancho responsive para 4 ayudas por fila.
- [ ] Si hay menos de 4, mantener alineacion visual consistente.
- [ ] Crear contenedor reusable de ayudas para evitar CSS inline repetido.
Archivos principales:
- src/shared/economy/NeuroCoinActionButton.tsx
- src/shared/ui (nuevo componente de fila de ayudas)
- src/games/*/*Screen.tsx

#### P1.4 Back global desde juegos
- [ ] Desde cualquier juego, atras debe ir a Games (si viene de DailyChallenge o cualquier otra pantalla).
- [ ] Segundo atras desde Games debe ir a Home.
- [ ] Cubrir gesto atras, boton header nativo y hardware back Android.
- [ ] Evitar cadenas largas de regreso por historial.
Archivos principales:
- src/app/AppNavigator.tsx
- src/app/routes.ts
- src/games/*/*Screen.tsx
- src/screens/GamesScreen.tsx

#### P1.5 Regla de sesiones al salir
- [ ] Si partida terminada: limpiar estado al salir SIEMPRE.
- [ ] Si partida a medias: mantener reanudacion actual.
- [ ] Implementar hook comun para blur/unmount y no duplicar logica.
- [ ] Garantizar que volver a pantalla no reabra resumen antiguo.
Archivos principales:
- src/games/*/storage/*State.ts
- src/games/*/*Screen.tsx
- src/shared/session (nuevo helper de ciclo de vida)

#### P1.6 Ajuste UI Mental Math (legibilidad)
- [ ] Aumentar visibilidad del resultado introducido por usuario.
- [ ] Reducir ligeramente tamano de tiempo, aciertos y fallos.
- [ ] Mantener jerarquia visual sin romper layout en moviles chicos.
Archivos principales:
- src/games/mentalmath/MentalMathScreen.tsx

### P2 - Funcional (niveles y ayudas por juego)

#### P2.1 Speed Match
- [ ] Niveles de simbolos: 2, 3, 4, 5, 6.
- [ ] Match verdadero solo si coinciden todos los simbolos del frame.
- [ ] Velocidad maxima en todos los niveles (intervalo unificado rapido).
- [ ] Nuevas ayudas:
  - +5s coste 40 max 3
  - +10s coste 70 max 3
  - eliminar 1 simbolo coste 70 max 1
- [ ] UI con hasta 3 ayudas en misma fila estandar.
Archivos principales:
- src/games/speedmatch/logic.ts
- src/games/speedmatch/SpeedMatchScreen.tsx
- src/games/speedmatch/storage/speedmatchState.ts

#### P2.2 Pattern Memory
- [ ] Niveles de pulsadores: 2, 3, 4, 5, 6.
- [ ] Adaptar generacion de secuencia y render de tablero al numero de pulsadores.
- [ ] Ayudas:
  - repetir secuencia pausando tiempo coste 40
  - eliminar un pulsador coste 70 max 1
- [ ] Revisar persistencia para compatibilidad con nuevo tamano de tablero.
Archivos principales:
- src/games/patternmemory/logic.ts
- src/games/patternmemory/PatternMemoryScreen.tsx
- src/games/patternmemory/storage/patternMemoryState.ts

#### P2.3 Mental Math
- [ ] Maestro: incluir raices cuadradas y potencias basicas.
- [ ] Gran Maestro: raices y potencias avanzadas.
- [ ] Ayudas:
  - +5s coste 30 max 3
  - +10s coste 50 max 3
  - saltar operacion coste 60 max 3
- [ ] Ajustar generador para evitar expresiones ilegibles en pantalla.
Archivos principales:
- src/games/mentalmath/logic/questions.ts
- src/games/mentalmath/logic/session.ts
- src/games/mentalmath/MentalMathScreen.tsx

#### P2.4 Sudoku
- [ ] Ayudas:
  - recuperar fallo coste 60 max 3
  - rellenar casilla pulsada coste 50 max 3
  - pista aleatoria coste 40 max 3
- [ ] Integrar ayudas nuevas con reglas existentes de bloqueo/game over.
Archivos principales:
- src/games/sudoku/SudokuScreen.tsx
- src/games/sudoku/logic y componentes relacionados

#### P2.5 Number Match
- [ ] Ayudas:
  - sugerir combinacion coste 40 max 3
  - restaurar un fallo coste 50 max 3 (limite de 5 fallos)
  - eliminar una pareja del numero pulsado coste 50 max 3
  - anadir linea coste 30 ilimitado (pasa a accion con coste)
- [ ] Ajustar estado para contador de fallos restaurables.
Archivos principales:
- src/games/numbermatch/NumberMatchScreen.tsx
- src/games/numbermatch/logic.ts
- src/games/numbermatch/numberMatchState.ts

#### P2.6 Memory (cartas)
- [ ] Ayudas:
  - mostrar todas 1s coste 100 max 3
  - mostrar todas 0.5s coste 60 max 3
  - descubrir 1 pareja coste 60 max 3
- [ ] Mantener compatibilidad con preview inicial y lock de input.
Archivos principales:
- src/games/memory/MemoryScreen.tsx
- src/games/memory/logic.ts
- src/games/memory/storage/memoryState.ts

#### P2.7 Cuadricula de enfoque
- [ ] Ayudas:
  - +3s coste 30 max 3
  - +6s coste 50 max 3
  - mostrar siguiente numero con parpadeo coste 50 max 3
- [ ] Conservar flujo actual de feedback visual de celda sugerida.
Archivos principales:
- src/games/focusgrid/FocusGridScreen.tsx
- src/games/focusgrid/components/FocusGridBoard.tsx

### P3 - Mejora y tuning

#### P3.1 Sonidos Pattern Memory por color
- [ ] Asociar cada pulsador/color a nota musical distinta.
- [ ] Sonido al reproducir secuencia y al tap del usuario.
- [ ] Respetar mute global y no bloquear rendimiento.
Archivos principales:
- src/games/patternmemory/PatternMemoryScreen.tsx
- src/shared/feedback (utilidad comun de audio si conviene)

#### P3.2 Recompensas por dificultad (tabla solicitada)
- [ ] Aplicar factor por dificultad para recompensa final XP/coins:
  - principiante 50%
  - avanzado 65%
  - experto 70%
  - maestro 85%
  - gran_maestro 100%
- [ ] Evitar doble aplicacion con multiplicadores existentes.
- [ ] Ajustar tests de economia y sesiones.
Archivos principales:
- src/core/gamification/economy.ts
- src/shared/session/completeGameSession (si aplica)
- src/core/gamification/economy.test.ts

#### P3.3 Ajuste fino y calibracion
- [ ] Revisar telemetria de gasto de ayudas vs ganancia.
- [ ] Ajustar mensajes UX de saldo insuficiente y feedback de compra.
- [ ] Verificar consistencia visual final en todos los juegos.
Archivos principales:
- src/services/analytics.ts
- src/shared/economy/*
- src/games/*/*Screen.tsx

## 5) Estandarizaciones transversales obligatorias
- [ ] Definir un esquema unico de ayudas por juego (id, label, coste, maxUsos, accion).
- [ ] Migrar juegos a ese esquema progresivamente.
- [ ] Reutilizar hook de gasto (useGameHelp) en todos los juegos que aun no lo usan.
- [ ] Eliminar numeros magicos de costes/limites embebidos en pantallas.

## 6) Riesgos y mitigaciones
- Riesgo: cambios de navegacion rompen flujo de reto diario.
  Mitigacion: regla condicional por mode daily y tests manuales por ruta.
- Riesgo: nueva logica de ayudas rompe persistencia de partidas guardadas.
  Mitigacion: normalizadores robustos en storage y fallback a sesion limpia.
- Riesgo: duplicidad de multiplicadores en economia.
  Mitigacion: test unitario de recompensa final por dificultad con snapshots numericos.

## 7) Plan de validacion

### Unit tests
- [ ] Actualizar tests de economia y neuroscore.
- [ ] Agregar tests de configuraciones por dificultad en SpeedMatch y PatternMemory.
- [ ] Agregar tests de generador MentalMath (incluye raices/potencias).

### Integracion local
- [ ] Flujo normal por cada juego: iniciar, usar ayudas, terminar.
- [ ] Flujo salida en partida a medias: retoma estado.
- [ ] Flujo salida tras terminar: no retoma partida completada.
- [ ] Flujo atras: juego -> Games -> Home.

### QA visual
- [ ] Verificar boton ayuda uniforme en todos los juegos.
- [ ] Verificar 4 ayudas por fila en anchos pequenos y grandes.
- [ ] Verificar banner superior grande en una linea.
- [ ] Verificar ajustes de tipografia en MentalMath.

## 8) Orden de ejecucion sugerido (sprints cortos)

### Sprint 1 (P1 completo)
- Economia base de ayudas, UI estandar de ayudas, banner superior, back global, regla reset al salir.

### Sprint 2 (P2 juegos 1)
- SpeedMatch, PatternMemory, MentalMath.

### Sprint 3 (P2 juegos 2)
- Sudoku, NumberMatch, Memory, FocusGrid.

### Sprint 4 (P3)
- Sonidos PatternMemory, tabla final de recompensas por dificultad, tuning y QA final.

## 9) Criterios de aceptacion finales
- [ ] Todas las ayudas tienen coste actualizado y limite correcto.
- [ ] Back global cumple juego -> Games -> Home sin historiales largos.
- [ ] Partida terminada nunca se reanuda al volver a entrar.
- [ ] Partida a medias se reanuda (o se mantiene comportamiento actual acordado).
- [ ] SpeedMatch y PatternMemory aplican progresion de niveles solicitada.
- [ ] MentalMath incluye raices/potencias por dificultad alta.
- [ ] Banner y botones de ayuda se ven uniformes en toda la app.
- [ ] Tests y smoke manual sin regresiones graves.
