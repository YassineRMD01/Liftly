/** Calendar files (RFC 5545) generated in the browser: Google, Apple and Outlook calendars import them. */
export interface IcsEvent {
  uid: string;
  title: string;
  /** Local date + time */
  date: string; // YYYY-MM-DD
  start: string; // HH:mm
  end: string; // HH:mm
  location?: string;
  description?: string;
}

const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/([,;])/g, '\\$1');
const stamp = (date: string, time: string) => `${date.replace(/-/g, '')}T${time.replace(':', '')}00`;
/** Lines longer than 75 octets are folded (RFC 5545 §3.1). */
const fold = (line: string) => line.match(/.{1,73}/g)!.join('\r\n ');

export function buildIcs(events: IcsEvent[], calendarName = 'Liftly'): string {
  const now = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Liftly//Gym app//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', `X-WR-CALNAME:${esc(calendarName)}`];
  for (const e of events) {
    lines.push('BEGIN:VEVENT', `UID:${e.uid}@liftly.app`, `DTSTAMP:${now}`, `DTSTART:${stamp(e.date, e.start)}`, `DTEND:${stamp(e.date, e.end)}`, `SUMMARY:${esc(e.title)}`);
    if (e.location) lines.push(`LOCATION:${esc(e.location)}`);
    if (e.description) lines.push(`DESCRIPTION:${esc(e.description)}`);
    lines.push('END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  return lines.map(fold).join('\r\n') + '\r\n';
}

export function downloadIcs(filename: string, events: IcsEvent[], calendarName?: string) {
  const blob = new Blob([buildIcs(events, calendarName)], { type: 'text/calendar;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename.endsWith('.ics') ? filename : `${filename}.ics`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
