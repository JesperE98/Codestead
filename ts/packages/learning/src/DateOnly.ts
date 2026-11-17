/**
 * A calendar day without a time (C#'s DateOnly): what the streak counts in. Built from a local time, like
 * DateOnly.FromDateTime(DateTime.Now). Days are counted in UTC internally, so daylight saving time never moves them.
 */
export class DateOnly {
  private constructor(
    readonly year: number,
    /** 1–12. */
    readonly month: number,
    readonly day: number,
  ) {}

  static of(year: number, month: number, day: number): DateOnly {
    const d = new Date(Date.UTC(year, month - 1, day));
    return new DateOnly(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
  }

  /** The local calendar day of a time. */
  static fromDate(t: Date): DateOnly {
    return new DateOnly(t.getFullYear(), t.getMonth() + 1, t.getDate());
  }

  /** "yyyy-MM-dd" exactly (DateOnly.TryParseExact with the invariant culture); null otherwise. */
  static tryParseExact(s: string | null | undefined): DateOnly | null {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s ?? "");
    if (!m) return null;
    const [year, month, day] = [Number(m[1]), Number(m[2]), Number(m[3])];
    const d = DateOnly.of(year, month, day);
    // 2026-02-30 is not a day.
    return d.year === year && d.month === month && d.day === day && year >= 1 ? d : null;
  }

  addDays(days: number): DateOnly {
    return DateOnly.of(this.year, this.month, this.day + days);
  }

  /** Days since 1970-01-01. */
  private get number(): number {
    return Date.UTC(this.year, this.month - 1, this.day) / 86_400_000;
  }

  compareTo(other: DateOnly): number {
    return this.number - other.number;
  }

  equals(other: DateOnly | null | undefined): boolean {
    return other != null && this.compareTo(other) === 0;
  }

  /** "yyyy-MM-dd". */
  toString(): string {
    return `${String(this.year).padStart(4, "0")}-${String(this.month).padStart(2, "0")}-${String(this.day).padStart(2, "0")}`;
  }
}

const two = (n: number) => String(n).padStart(2, "0");

/** A local time as "yyyy-MM-ddTHH:mm" (how achievements are stamped). */
export function stamp(t: Date): string {
  return `${DateOnly.fromDate(t).toString()}T${two(t.getHours())}:${two(t.getMinutes())}`;
}

/** Parses "yyyy-MM-ddTHH:mm" (DateTime.TryParseExact with the invariant culture) as a local time; null otherwise. */
export function parseStamp(s: string | null | undefined): Date | null {
  const m = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})$/.exec(s ?? "");
  if (!m) return null;
  const day = DateOnly.tryParseExact(m[1]);
  const hours = Number(m[2]);
  const minutes = Number(m[3]);
  if (!day || hours > 23 || minutes > 59) return null;
  return new Date(day.year, day.month - 1, day.day, hours, minutes);
}
