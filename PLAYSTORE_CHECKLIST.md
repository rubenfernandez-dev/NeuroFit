# NeuroFit Play Store Checklist (Baseline)

Last updated: 2026-03-13

This checklist is a practical release baseline. It is not legal advice.

## 1. Product Truth Alignment

Current product reality:

- Local-first app
- No user accounts
- No cloud sync
- Weekly leaderboard is local/simulated, not global live competition

Store listing must not claim:

- Real-time global multiplayer competition
- Cloud profile sync
- Server-backed rankings

## 2. Privacy And Data Safety

Before upload:

1. Finalize legal privacy policy URL (public HTTPS page)
2. Cross-check Play Data Safety answers with:
   - PRIVACY.md
   - final release manifest
   - final SDK list (including Sentry decision)
3. Decide if Sentry is ON in production:
   - If ON: document retention, access, and scrubbing
   - If OFF: keep DSN unset and verify no event traffic

## 3. Android Permissions Review

Manifest source declares:

- INTERNET
- VIBRATE

Merged release manifest can include additional transitive permissions from dependencies (notifications, secure-store stack, Android runtime integrations). Validate with final AAB before submission.

## 4. Required Store Assets

Status in repo:

- App icon: present (`assets/icon.png`)
- Adaptive icon: present (`assets/adaptive-icon.png`)
- Splash assets: present (`assets/splash.png`)

Pending for Play Console (human-provided):

- Feature graphic (1024x500)
- Phone screenshots
- 7-inch/10-inch screenshots if claimed tablet support for listing requirements
- Final short description
- Final full description
- Marketing support/contact details

## 5. Listing Copy Draft (Honest Baseline)

Short description candidate:

- Entrena tu mente con retos diarios y progreso local.

Full description baseline points:

- 6 juegos cognitivos (memoria, logica, velocidad y atencion)
- Reto diario por etapas
- Progreso, racha y niveles en el dispositivo
- Ranking semanal local simulado por liga
- Ajustes de feedback y recordatorios diarios

Avoid in listing text:

- "Compite en tiempo real con jugadores reales"
- "Ranking global online"
- "Sincroniza tu perfil en la nube"

## 6. Final Technical Checks

Current validated status:

- `android\\gradlew.bat assembleDebug`: OK
- `android\\gradlew.bat assembleRelease`: OK
- `android\\gradlew.bat bundleRelease`: OK
- Unsent signed-config state: release signing still needs real `NEUROFIT_UPLOAD_*` credentials
- Known limitation: `android\\gradlew.bat clean assembleRelease` can fail in `:app:externalNativeBuildCleanDebug` due to native clean/autolinking codegen paths with New Architecture

Before upload:

1. Provide real upload keystore and `NEUROFIT_UPLOAD_*` secrets
2. Build signed release AAB
3. Verify merged release manifest from final build
4. Smoke test startup, notifications, settings, and each game flow
5. Validate crash-reporting mode (ON/OFF) matches listing/privacy docs
6. Run typecheck and tests before tagging release
