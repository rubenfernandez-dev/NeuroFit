import * as Sentry from '@sentry/react-native';

type LogContext = Record<string, unknown>;
type DataFailureType = 'corrupt_data' | 'unexpected_error';

type ErrorDetails = {
  name: string;
  message: string;
  stack?: string;
};

let sentryInitialized = false;
let sentryDisabledLogged = false;

function toErrorDetails(error: unknown): ErrorDetails {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };
  }

  return {
    name: 'UnknownError',
    message: typeof error === 'string' ? error : 'Unknown error',
  };
}

function emit(level: 'warning' | 'error', event: string, context: LogContext = {}, error?: unknown) {
  const payload = {
    ts: new Date().toISOString(),
    level,
    event,
    context,
    error: error ? toErrorDetails(error) : undefined,
  };

  const line = JSON.stringify(payload);
  if (level === 'error') {
    console.error(line);
  } else {
    console.warn(line);
  }
}

export function logWarning(event: string, context: LogContext = {}) {
  emit('warning', event, context);
}

export function logError(event: string, error?: unknown, context: LogContext = {}) {
  emit('error', event, context, error);
}

export function classifyDataFailure(error: unknown): DataFailureType {
  if (error instanceof SyntaxError) return 'corrupt_data';
  const message = error instanceof Error ? error.message.toLowerCase() : '';
  if (message.includes('json')) return 'corrupt_data';
  return 'unexpected_error';
}

export function formatLoadFailureMessage(failureType: DataFailureType): string {
  if (failureType === 'corrupt_data') {
    return 'Se detectaron datos locales corruptos. Recuperamos una copia segura para continuar.';
  }
  return 'No pudimos cargar tus datos ahora mismo. Intenta de nuevo en unos segundos.';
}

export function initCrashReporting() {
  if (sentryInitialized) return true;

  const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;
  if (!dsn) {
    if (!sentryDisabledLogged) {
      logWarning('observability.sentry.disabled', { reason: 'missing_dsn' });
      sentryDisabledLogged = true;
    }
    return false;
  }

  try {
    Sentry.init({
      dsn,
      enabled: !__DEV__,
      debug: __DEV__,
      environment: process.env.EXPO_PUBLIC_APP_ENV ?? (__DEV__ ? 'development' : 'production'),
      tracesSampleRate: 0,
    });
    sentryInitialized = true;
    return true;
  } catch (error) {
    logError('observability.sentry.init_failed', error);
    return false;
  }
}

export function captureException(error: unknown, context: LogContext = {}) {
  logError('exception.captured', error, context);

  if (!sentryInitialized) return;

  const normalized = error instanceof Error ? error : new Error(toErrorDetails(error).message);
  Sentry.captureException(normalized, {
    extra: context,
  });
}
