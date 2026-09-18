// Formatação de datas/horas de evento SEMPRE no fuso de Campo Grande (UTC-4),
// independente do fuso do navegador de quem abre. Espelha o util do admin
// (portal-iecg app/utils/dateTime.js) para que "19:20" cadastrado apareça 19:20
// em qualquer dispositivo.

export const APP_TIME_ZONE = 'America/Campo_Grande';
export const APP_DATE_LOCALE = 'pt-BR';

// dd/mm/yyyy [T|espaço HH:mm[:ss]] — strings legadas em formato brasileiro.
const BRAZILIAN_DATE_REGEX =
  /^(\d{2})\/(\d{2})\/(\d{4})(?:[T\s](\d{2}):(\d{2})(?::(\d{2}))?)?$/;

// yyyy-mm-ddTHH:mm[:ss] SEM offset (hora de parede "solta").
const NAIVE_ISO_REGEX =
  /^(\d{4})-(\d{2})-(\d{2})[T\s](\d{2}):(\d{2})(?::(\d{2}))?$/;

// Offset (ms) do fuso no instante `date`: asUTC(wall-clock) - date.
function getTimeZoneOffsetMs(date: Date, timeZone: string): number {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const parts = dtf.formatToParts(date).reduce<Record<string, string>>((acc, part) => {
    if (part.type !== 'literal') acc[part.type] = part.value;
    return acc;
  }, {});
  const asUTC = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second)
  );
  return asUTC - date.getTime();
}

// Hora de parede (componentes) em Campo Grande -> instante UTC correto.
function wallClockToInstant(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number
): Date {
  const asUTC = Date.UTC(year, month - 1, day, hour, minute, second);
  const offset = getTimeZoneOffsetMs(new Date(asUTC), APP_TIME_ZONE);
  return new Date(asUTC - offset);
}

// Converte qualquer valor de data de evento num instante (Date):
// - ISO com offset/Z (formato real da API): usado como o instante exato.
// - "dd/mm/yyyy HH:mm" ou "yyyy-mm-ddTHH:mm" SEM offset: hora de parede de Campo Grande.
export function parseEventDate(value?: string | Date | null): Date | null {
  if (!value) return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  const trimmed = String(value).trim();
  if (!trimmed) return null;

  const brazil = BRAZILIAN_DATE_REGEX.exec(trimmed);
  if (brazil) {
    const [, day, month, year, hour, minute, second] = brazil;
    return wallClockToInstant(
      Number(year),
      Number(month),
      Number(day),
      Number(hour ?? '0'),
      Number(minute ?? '0'),
      Number(second ?? '0')
    );
  }

  const naive = NAIVE_ISO_REGEX.exec(trimmed);
  if (naive) {
    const [, year, month, day, hour, minute, second] = naive;
    return wallClockToInstant(
      Number(year),
      Number(month),
      Number(day),
      Number(hour),
      Number(minute),
      Number(second ?? '0')
    );
  }

  // ISO com offset/Z, ou qualquer coisa que o Date entenda como instante absoluto.
  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

const DATE_TIME_OPTIONS: Intl.DateTimeFormatOptions = {
  day: '2-digit',
  month: 'long',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
};

const DATE_OPTIONS: Intl.DateTimeFormatOptions = {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
};

const TIME_OPTIONS: Intl.DateTimeFormatOptions = {
  hour: '2-digit',
  minute: '2-digit',
};

// Formata data + hora do evento no fuso de Campo Grande.
export function formatEventDateTime(
  value?: string | Date | null,
  options: Intl.DateTimeFormatOptions = DATE_TIME_OPTIONS,
  fallback = ''
): string {
  const parsed = parseEventDate(value);
  if (!parsed) return fallback;
  return parsed.toLocaleString(APP_DATE_LOCALE, {
    timeZone: APP_TIME_ZONE,
    hourCycle: 'h23',
    ...options,
  });
}

// Formata só a data (sem hora) no fuso de Campo Grande.
export function formatEventDate(
  value?: string | Date | null,
  options: Intl.DateTimeFormatOptions = DATE_OPTIONS,
  fallback = ''
): string {
  const parsed = parseEventDate(value);
  if (!parsed) return fallback;
  return parsed.toLocaleDateString(APP_DATE_LOCALE, {
    timeZone: APP_TIME_ZONE,
    ...options,
  });
}

// Formata só a hora (HH:mm) no fuso de Campo Grande.
export function formatEventTime(
  value?: string | Date | null,
  fallback = ''
): string {
  const parsed = parseEventDate(value);
  if (!parsed) return fallback;
  return parsed.toLocaleTimeString(APP_DATE_LOCALE, {
    timeZone: APP_TIME_ZONE,
    hourCycle: 'h23',
    ...TIME_OPTIONS,
  });
}
