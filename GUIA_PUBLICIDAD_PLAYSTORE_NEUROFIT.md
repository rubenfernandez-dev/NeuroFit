# Guia de Publicidad Play Store para NeuroFit (Banner + Video)

Este documento es solo informativo para implementarlo mas adelante sin tocar ahora el flujo actual.

## 1) Enfoque recomendado para NeuroFit

Objetivo UX:
- Banner discreto en pantallas no criticas (no durante input intenso).
- Video solo al terminar prueba/sesion (nunca en mitad de partida).
- Mantener sensacion premium: frecuencia baja, recompensas claras.

Recomendacion inicial:
- Banner: en Home/Games/Leaderboard (evitar dentro del area activa de juego).
- Interstitial o Rewarded: al finalizar partida, con reglas de frecuencia.

## 2) Formatos y cuando usarlos

Banner:
- Ventaja: ingreso constante.
- Riesgo: distrae si se coloca en zonas activas.
- Uso sugerido: fondo de pantalla (bottom) en Home o Games.

Interstitial (video/pantalla completa):
- Ventaja: CPM alto.
- Riesgo: fatiga si se muestra siempre.
- Uso sugerido: al terminar sesion, max cada X partidas.

Rewarded (video con recompensa):
- Ventaja: menos friccion para el usuario porque es opt-in.
- Uso sugerido: boton "Ver video para bonus" al finalizar partida.

## 3) Libreria recomendada en React Native/Expo prebuild

Para tu stack (Expo prebuild + gradlew assembleRelease):
- Recomendado: react-native-google-mobile-ads

Motivo:
- Compatible con Android release nativo.
- Soporta banner/interstitial/rewarded.
- Bien mantenida para RN moderno.

## 4) Configuracion que haras cuando decidas implementarlo

1. Crear app en AdMob.
2. Crear ad units:
- Banner Android
- Interstitial Android o Rewarded Android (o ambos)

3. Guardar IDs de anuncios (produccion y test).
4. Añadir App ID de AdMob Android en configuracion de proyecto.
5. Configurar modo test en desarrollo y QA.

Nota importante de politica:
- En builds de pruebas usar siempre IDs de test.
- No hacer clics manuales en anuncios reales para probar.

## 5) Arquitectura sugerida (sin tocar logica de juegos)

Crear una capa de ads separada:
- src/shared/ads/adConfig.ts
  - IDs por plataforma y entorno.
- src/shared/ads/adService.ts
  - initAds()
  - loadInterstitial(), showInterstitialIfReady()
  - loadRewarded(), showRewarded(onReward)
- src/shared/ads/useAdCooldown.ts
  - Frecuencia y cooldown centralizado.

Integracion en pantallas:
- Banner en Home/Games (componente BannerAdSlot).
- Video al finalizar sesion en el modal de resultado.

## 6) Frecuencia recomendada para no degradar UX

Regla base sugerida:
- Interstitial: max 1 cada 2-3 partidas finalizadas.
- Nunca mostrar 2 interstitial seguidos.
- Cooldown temporal: 90-120 segundos.

Rewarded:
- Siempre opcional (boton claro).
- Mensaje transparente de recompensa antes de mostrar.

## 7) Estrategia por tipo de juego NeuroFit

Para juegos rapidos (Speed Match, Focus Grid):
- Evitar interstitial en cada fin.
- Mejor rewarded opcional o interstitial con frecuencia baja.

Para juegos largos (Pattern Memory, Sudoku):
- Interstitial tolerable al finalizar, con cooldown.

Mental Math:
- Puede usar rewarded al final para bonus de XP/SP moderado.

## 8) Recompensas recomendadas (si usas rewarded)

Mantener economia controlada:
- Bonus pequeño y fijo (ej: +5% XP de la sesion, con tope).
- Limite diario (ej: 3 recompensas/dia).
- Sin multiplicadores infinitos.

## 9) Eventos y analitica minima

Registrar:
- ad_banner_impression
- ad_interstitial_shown
- ad_interstitial_closed
- ad_rewarded_shown
- ad_rewarded_earned
- ad_show_failed

KPIs utiles:
- eCPM
- ARPDAU
- Retencion D1/D7 antes y despues de ads
- Tasa de completado de rewarded

## 10) Checklist de salida a produccion

- IDs reales de AdMob configurados para release.
- IDs de test removidos de produccion.
- Revisado que no hay anuncios en momentos criticos de input.
- Revisado que el flujo de recompensa no falla sin internet.
- Politicas Play/AdMob cumplidas (contenido, consentimiento, privacidad).

## 11) Riesgos y como mitigarlos

Riesgo: caida de retencion por exceso de anuncios.
Mitigacion: frecuencia baja + rewarded opcional.

Riesgo: errores al mostrar anuncios sin cargar.
Mitigacion: always-safe fallback (si no hay ad lista, continuar flujo normal).

Riesgo: percepcion de paywall.
Mitigacion: nunca bloquear progreso por no ver anuncios.

## 12) Plan de implementacion gradual recomendado

Fase 1:
- Solo banner en Home/Games.
- Medir impacto 7-14 dias.

Fase 2:
- Rewarded opcional al finalizar partida.
- Recompensa pequeña con limite diario.

Fase 3:
- Interstitial muy controlado (si datos lo justifican).

---

Si quieres, en el siguiente paso te preparo un plan tecnico exacto archivo-por-archivo para integrar ads sin tocar reglas de los juegos ni el flujo de release que ya te funciona.





CHAT GPT:
🧠 GUÍA DE PUBLICIDAD + ECONOMÍA PARA NEUROFIT (VERSIÓN PRO)

Documento estratégico para implementación futura.
NO aplicar todavía. Mantener el flujo actual intacto.

────────────────────────────────────

1) 🎯 ENFOQUE GENERAL

Objetivo UX:
- Sensación premium, limpia y sin fricción
- No romper el flujo mental
- Monetización natural y opcional

Principios:
- ❌ Nunca anuncios durante gameplay
- ❌ Nunca bloquear progreso por anuncios
- ✔️ Anuncios solo en pausas naturales
- ✔️ El usuario tiene control

────────────────────────────────────

2) 📺 ESTRATEGIA DE ANUNCIOS

Ubicación:

Banner:
- Home / Games / Leaderboard
- Nunca en zona activa

Video:
- Solo al finalizar partida
- Nunca en mitad del juego

Formatos:

Banner:
- Ingreso constante
- Discreto (modo oscuro)
- Bottom

Interstitial:
- Alto ingreso
- Uso muy controlado
- Solo tras partida
- Nunca seguidos
- Con cooldown

Rewarded:
- Opcional
- Integrado en gameplay
- Formato principal de monetización

────────────────────────────────────

3) 🧠 SEGMENTACIÓN DE USUARIOS

Tipos:
- Casual (1–3 partidas)
- Medio (4–10)
- Intensivo (10+)

Estrategia:
- Casual → sin interstitial
- Medio → ocasional
- Intensivo → más frecuencia

────────────────────────────────────

4) ⏱️ FRECUENCIA

Interstitial:
- Cada 4–5 partidas
- o cada 2–3 min de uso
- Cooldown: 90–120s
- Nunca 2 seguidos

Rewarded:
- Siempre opcional
- Máx 3–5 al día

────────────────────────────────────

5) 💰 ECONOMÍA

Separación clave:

XP:
- Progreso
- Niveles
- Desbloqueos

FP (Focus Points):
- Moneda
- Decisiones
- Ventajas

NO mezclar XP con economía

Obtención FP:
- Partidas
- Misiones
- Rachas
- Rewarded

────────────────────────────────────

6) 🎮 USO DE FP

Sudoku:
- Recuperar fallo → 1 FP
- Pista → 2 FP
- Desbloquear → 3 FP

Focus Grid:
- Slow time → 2 FP
- Siguiente número → 1 FP
- +3s → 2 FP

Mental Math:
- Eliminar opción → 1 FP
- Ayuda parcial → 2 FP
- +3s → 2 FP

Memory:
- Más tiempo → 2 FP
- Repetir → 3 FP

Juegos rápidos:
- Retry → 1 FP
- +1 vida → 2 FP

────────────────────────────────────

7) 🎯 REWARDED ADS

En vez de XP:

✔️ Ver anuncio → +FP
✔️ Ver anuncio → recuperar fallo GRATIS

────────────────────────────────────

8) 🧠 SISTEMA DE DECISIÓN

Momento clave:

Usuario falla o está en riesgo:

Opciones:
- Usar FP
- Ver anuncio
- Continuar

Esto crea engagement real

────────────────────────────────────

9) 🎁 SISTEMAS EXTRA

Misiones:
- Completar juegos → FP
- Sin fallos → bonus

Rachas:
- Mantener → recompensa
- Recuperar → coste FP

Personalización:
- Temas
- Colores
- Animaciones

Retos:
- Modo extremo
- Entrada con FP

────────────────────────────────────

10) 🧘 MODO CONCENTRACIÓN

“30 min sin interrupciones”

Activación:
- Ver anuncio
- o gastar FP

────────────────────────────────────

11) 🏗️ ARQUITECTURA

src/shared/ads/
- adConfig.ts
- adService.ts
- useAdCooldown.ts

Funciones:
- initAds()
- loadInterstitial()
- showInterstitialIfReady()
- loadRewarded()
- showRewarded(onReward)

Estado:
- isAdReady
- lastAdShownAt
- sessionAdsCount

Fallback obligatorio:

if (!adReady) {
  continueFlow();
}

────────────────────────────────────

12) 📊 ANALÍTICA

Eventos:
- ad_banner_impression
- ad_interstitial_shown
- ad_interstitial_closed
- ad_rewarded_shown
- ad_rewarded_earned
- ad_show_failed

KPIs:
- eCPM
- ARPDAU
- Retención D1/D7
- session_length_after_ad
- quit_after_interstitial

────────────────────────────────────

13) ⚠️ RIESGOS

Retención baja:
→ frecuencia baja

Errores:
→ fallback

Paywall:
→ nunca bloquear progreso

────────────────────────────────────

14) 🚀 PLAN

Fase 1:
- Banner + analítica

Fase 2:
- Rewarded + FP

Fase 3:
- Interstitial controlado

────────────────────────────────────

🧨 CONCLUSIÓN

XP = progreso
FP = decisiones
Ads = herramienta opcional

NeuroFit = experiencia premium + monetización inteligente