import { TestBed } from '@angular/core/testing';
import { isoDate } from './schedule';
import { StoreService } from './store.service';

/** Date of the next `day` (0 = Sunday) at least 7 days from now, so classes never "already started". */
function future(day: number) {
  const d = new Date();
  d.setDate(d.getDate() + 7 + ((day - d.getDay() + 7) % 7));
  return isoDate(d);
}

describe('StoreService', () => {
  let store: StoreService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
    store = TestBed.inject(StoreService);
    store.resetDemo();
  });

  describe('class booking & waitlist', () => {
    const date = future(2); // Tuesday: "Powerlifting basics", capacity 2

    it('books until full, then puts people on the waitlist', () => {
      expect(store.book('c-power-2', date, 'u-k1')?.status).toBe('BOOKED');
      expect(store.book('c-power-2', date, 'u-k3')?.status).toBe('BOOKED');
      expect(store.book('c-power-2', date, 'u-k6')?.status).toBe('WAITLIST');
      expect(store.occupancy('c-power-2', date)).toEqual({ taken: 2, waitlist: 1 });
    });

    it('gives a freed place to the first person waiting and notifies them', () => {
      const first = store.book('c-power-2', date, 'u-k1')!;
      store.book('c-power-2', date, 'u-k3');
      store.book('c-power-2', date, 'u-k6');
      store.cancelBooking(first.id);
      expect(store.myBooking('c-power-2', date, 'u-k6')?.status).toBe('BOOKED');
      expect(store.notificationsOf('u-k6').some((n) => n.title === 'You got a place!')).toBe(true);
    });

    it('refuses a second booking and members without a membership', () => {
      store.book('c-power-2', date, 'u-k1');
      expect(store.book('c-power-2', date, 'u-k1')).toBeNull();
      // Nora (u-k2) has no active membership at Iron Temple
      expect(store.canBook(store.gymClass('c-power-2')!, date, 'u-k2')).toEqual({ ok: false, reason: 'You need an active membership at this gym.' });
    });

    it('respects women-only classes', () => {
      // Amine is a male member of Kumite Dojo; its kickboxing class is women-only
      expect(store.canBook(store.gymClass('c-kick-2')!, future(2), 'u-k6').reason).toBe('This class is not open to you.');
    });
  });

  describe('check-in', () => {
    it('lets an active member in and refuses unknown codes', () => {
      expect(store.checkIn('g-iron', 'u-k1', 'QR').ok).toBe(true);
      expect(store.checkIn('g-iron', 'nobody', 'QR')).toMatchObject({ ok: false, reason: 'Unknown member' });
    });
    it('refuses members without a membership, banned or frozen', () => {
      expect(store.checkIn('g-iron', 'u-k2', 'MANUAL').reason).toBe('No active membership');
      store.banClient('g-iron', 'u-k3', 'test');
      expect(store.checkIn('g-iron', 'u-k3', 'MANUAL').reason).toBe('Banned from this gym');
      store.freezeMembership('m-10', isoDate(), 7, 'holiday');
      expect(store.checkIn('g-iron', 'u-k6', 'MANUAL').reason).toBe('Membership frozen');
    });
    it('records the location of the desk', () => {
      expect(store.checkIn('g-iron', 'u-k1', 'QR', undefined, 'loc-north').locationId).toBe('loc-north');
    });
  });

  describe('freeze', () => {
    it('moves the end date back by the frozen days and marks the member FROZEN', () => {
      const before = new Date(store.memberships().find((m) => m.id === 'm-10')!.endDate).getTime();
      store.freezeMembership('m-10', isoDate(), 10, 'injury');
      const after = new Date(store.memberships().find((m) => m.id === 'm-10')!.endDate).getTime();
      expect(Math.round((after - before) / 86400000)).toBe(10);
      expect(store.clientStatus('g-iron', 'u-k6')).toBe('FROZEN');
      store.unfreezeMembership('m-10');
      expect(store.clientStatus('g-iron', 'u-k6')).toBe('ACTIVE');
    });
  });

  describe('private sessions', () => {
    const monday = future(1); // Jordan: Mon 10:00–13:00, 60 min slots

    it('splits availability into slots and hides taken ones', () => {
      expect(store.freeSlots('u-c1', 'g-iron', monday).map((s) => s.start)).toEqual(['10:00', '11:00', '12:00']);
      const s = store.requestSession({ coachId: 'u-c1', clientId: 'u-k1', gymId: 'g-iron', date: monday, start: '11:00', end: '12:00' });
      expect(s?.price).toBe(45);
      expect(store.freeSlots('u-c1', 'g-iron', monday).map((x) => x.start)).toEqual(['10:00', '12:00']);
      expect(store.requestSession({ coachId: 'u-c1', clientId: 'u-k6', gymId: 'g-iron', date: monday, start: '11:00', end: '12:00' })).toBeNull();
    });

    it('notifies the member when the coach confirms', () => {
      const s = store.requestSession({ coachId: 'u-c1', clientId: 'u-k1', gymId: 'g-iron', date: monday, start: '10:00', end: '11:00' })!;
      store.setSessionStatus(s.id, 'CONFIRMED', 'u-c1');
      expect(store.notificationsOf('u-k1')[0].title).toBe('Session confirmed');
    });
  });

  describe('invitations', () => {
    it('creates invited accounts that activate with a password', () => {
      const u = store.addUser({ role: 'CLIENT', firstName: 'Ines', lastName: 'Diaz', email: 'ines@example.com' });
      expect(u.password).toBe('');
      expect(store.userByInvite(u.invite!.token)?.id).toBe(u.id);
      const active = store.activate(u.invite!.token, 'secret1')!;
      expect(active.password).toBe('secret1');
      expect(active.invite).toBeUndefined();
      expect(store.userByInvite(u.invite!.token)).toBeUndefined();
    });
  });

  describe('referrals & join requests', () => {
    it('derives readable referral codes', () => {
      expect(store.refCode('u-k1')).toBe('CHRIS');
      expect(store.userByRefCode('chris')?.id).toBe('u-k1');
    });
    it('converts a join request into an invited member credited to the referrer', () => {
      const u = store.convertJoinRequest('jr-1')!;
      expect(u.referredBy).toBe('u-k1');
      expect(u.invite).toBeDefined();
      expect(store.joinRequests().find((r) => r.id === 'jr-1')?.status).toBe('CONVERTED');
    });
    it('notifies the gym owner of a new request', () => {
      store.addJoinRequest({ gymId: 'g-wave', firstName: 'Ana', lastName: 'Ruiz', email: 'ana@example.com' });
      expect(store.notificationsOf('u-a2')[0].title).toBe('New join request');
    });
  });

  describe('VAT, invoices & audit', () => {
    it('splits VAT-inclusive amounts', () => {
      expect(store.vatSplit(120, 20)).toEqual({ gross: 120, net: 100, vat: 20, rate: 20 });
      expect(store.vatRate('FR')).toBe(20);
      expect(store.vatRate('XX')).toBe(0);
    });
    it('issues no subscription invoices during a trial', () => {
      expect(store.saasInvoices('g-kumite')).toEqual([]);
      expect(store.saasInvoices('g-iron').length).toBeGreaterThan(5);
    });
    it('records important actions with their author', () => {
      store.actorId.set('u-a1');
      store.banClient('g-iron', 'u-k3', 'rude');
      expect(store.auditLog()[0]).toMatchObject({ action: 'Client banned', actorId: 'u-a1', gymId: 'g-iron' });
    });
    it('finds trials ending soon', () => {
      expect(store.trialsEnding(7).map((g) => g.id)).toContain('g-kumite');
    });
  });

  describe('messages', () => {
    it('counts unread messages and clears them when the thread is read', () => {
      expect(store.unreadMessages('u-k1')).toBe(1);
      store.markThreadRead('u-k1', 'u-c1');
      expect(store.unreadMessages('u-k1')).toBe(0);
      store.sendMessage('u-k1', 'u-c1', '  hi  ');
      expect(store.thread('u-k1', 'u-c1').at(-1)?.body).toBe('hi');
    });
  });
});
