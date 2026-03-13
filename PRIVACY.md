# NeuroFit Privacy Baseline

Last updated: 2026-03-13

This file is a practical privacy baseline for release preparation. It is not legal advice and does not replace a lawyer-reviewed privacy policy.

## Product Scope

NeuroFit is currently a local-first app:

- No account system
- No backend profile sync
- No global real-time multiplayer
- Weekly leaderboard is simulated locally on device

## Data Processed Today

### 1. Local gameplay and progress data

Stored on the device using secure/local storage:

- Profile and progression (XP, level, league, streak)
- Game stats and session state
- Daily challenge state
- User preferences (theme, feedback settings, reminders)

Purpose:

- Keep progress between app launches
- Restore interrupted sessions
- Power local gamification and UI

Retention:

- Stays on device until app is uninstalled or user resets data

### 2. Local notifications

If user enables reminders:

- App asks notification permission
- App schedules local daily reminder
- Reminder time and notification id are saved locally

Purpose:

- Send daily challenge reminder on device

### 3. Crash and operational telemetry (optional)

Sentry is integrated but disabled unless configured:

- Enabled only when EXPO_PUBLIC_SENTRY_DSN is set
- Intended for startup/load exceptions and app diagnostics

Potential data in crash events:

- Error message, stack trace
- Operational context passed by app code
- Basic device/runtime metadata provided by SDK

Purpose:

- Detect and fix production errors

Current limitation:

- Exact production payload should be reviewed in Sentry project settings before public rollout

## Data Not Collected by Current Product Design

- No email/password credentials
- No user account database
- No cloud save service
- No in-app advertising identifiers managed by app logic

## Android Permission Baseline

Expected permission surface for release includes:

- INTERNET: required by app runtime and optional telemetry SDK/network libraries
- VIBRATE: used by haptic/game feedback and notification channel behavior
- POST_NOTIFICATIONS: needed on Android 13+ for reminders

Transitive permissions can still be merged by dependencies. Validate final release manifest before upload.

## User Controls

- Notification reminders can be enabled/disabled in Settings
- Progress can be reset from Settings
- App data can be removed by uninstalling the app

## Pending Human Decisions Before Store Publication

1. Provide final legal privacy policy URL for Play Console listing
2. Confirm whether Sentry is enabled for production, and if yes:
   - Define data retention window
   - Define access controls
   - Review event scrubbing and PII safeguards
3. Review Play Data Safety form answers against final release build

## Disclaimer

This document is a technical baseline. Final compliance and legal wording must be validated by the product owner and legal counsel.
