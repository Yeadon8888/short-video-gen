/**
 * Minimal Server-Timing helper.
 *
 *   const t = new Timer();
 *   t.start("db"); await db.query(...); t.end("db");
 *   return NextResponse.json(data, { headers: t.headers() });
 *
 * Shows up as a "Server Timing" entry in Chrome DevTools Network → Timing.
 */
export class Timer {
  private marks = new Map<string, number>();
  private entries: string[] = [];

  start(name: string) {
    this.marks.set(name, performance.now());
  }

  end(name: string, description?: string) {
    const start = this.marks.get(name);
    if (start === undefined) return;
    const dur = performance.now() - start;
    this.marks.delete(name);
    const desc = description ? `;desc="${description}"` : "";
    this.entries.push(`${name}${desc};dur=${dur.toFixed(1)}`);
  }

  mark(name: string, durationMs: number) {
    this.entries.push(`${name};dur=${durationMs.toFixed(1)}`);
  }

  header(): string {
    return this.entries.join(", ");
  }

  headers(extra?: Record<string, string>) {
    return { "Server-Timing": this.header(), ...extra };
  }
}
