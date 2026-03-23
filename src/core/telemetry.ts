/**
 * Internal telemetry — zero external dependencies.
 * Logs business events for debugging and monitoring without affecting user-visible behaviour.
 *
 * DEV  : emits to console (log / warn / error)
 * PROD : logEvent / logWarn are no-ops; logError always emits to console.error
 */

type TelemetryPayload = Record<string, unknown>;

function fmt(name: string, payload?: TelemetryPayload): string {
  return JSON.stringify({ ts: new Date().toISOString(), event: name, ...(payload ?? {}) });
}

export function logEvent(name: string, payload?: TelemetryPayload): void {
  if (__DEV__) {
    console.log('[telemetry]', fmt(name, payload));
  }
}

export function logWarn(name: string, payload?: TelemetryPayload): void {
  if (__DEV__) {
    console.warn('[telemetry:warn]', fmt(name, payload));
  }
}

export function logError(name: string, payload?: TelemetryPayload): void {
  console.error('[telemetry:error]', fmt(name, payload));
}
