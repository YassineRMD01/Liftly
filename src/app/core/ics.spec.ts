import { buildIcs } from './ics';

describe('buildIcs', () => {
  it('writes one VEVENT per event with local times and escaped text', () => {
    const ics = buildIcs([{ uid: 'b-1', title: 'Squat, bench; deadlift', date: '2026-11-24', start: '19:00', end: '20:30', location: 'Iron Temple' }]);
    expect(ics).toContain('BEGIN:VCALENDAR');
    expect(ics).toContain('DTSTART:20261124T190000');
    expect(ics).toContain('DTEND:20261124T203000');
    expect(ics).toContain('SUMMARY:Squat\\, bench\\; deadlift');
    expect(ics.match(/BEGIN:VEVENT/g)?.length).toBe(1);
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true);
  });
});
