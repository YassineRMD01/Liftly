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
  describe('coach scheduling', () => {
    const wed = future(3); // Jordan teaches CrossFit WOD Wed 18:00–19:00 at Iron Temple

    it('shows classes and sessions in the coach agenda', () => {
      const kinds = store.coachAgenda('u-c1', wed, wed).map((i) => `${i.kind}:${i.title}`);
      expect(kinds).toContain('CLASS:CrossFit WOD');
    });
    it('books a confirmed lesson and refuses double bookings', () => {
      const ok = store.scheduleSession({ coachId: 'u-c1', clientId: 'u-k3', gymId: 'g-iron', date: wed, start: '14:00', end: '15:00' });
      expect(ok.ok && ok.session.status).toBe('CONFIRMED');
      expect(store.notificationsOf('u-k3')[0].title).toBe('Session scheduled');
      expect(store.scheduleSession({ coachId: 'u-c1', clientId: 'u-k1', gymId: 'g-iron', date: wed, start: '14:30', end: '15:30' })).toEqual({ ok: false, reason: 'You already have a session at that time.' });
      expect(store.scheduleSession({ coachId: 'u-c1', clientId: 'u-k1', gymId: 'g-iron', date: wed, start: '18:30', end: '19:30' })).toEqual({ ok: false, reason: 'You teach a class at that time.' });
    });
    it('reschedules a session', () => {
      const r = store.scheduleSession({ coachId: 'u-c1', clientId: 'u-k3', gymId: 'g-iron', date: wed, start: '09:00', end: '10:00' });
      expect(r.ok).toBe(true);
      if (r.ok) expect(store.rescheduleSession(r.session.id, wed, '11:00', '12:00').ok).toBe(true);
    });
  });

  describe('coach pay & accounting', () => {
    it('counts only ended classes since the rate was set', () => {
      store.setClassRate('g-iron', 'u-c4', 30);
      const st = store.coachStatement('g-iron', 'u-c4');
      expect(st.rate).toBe(30);
      expect(st.earned).toBe(st.classes * 30);
    });
    it('reduces the balance due with payouts and notifies the coach', () => {
      const before = store.coachStatement('g-iron', 'u-c1').due;
      store.saveCoachPayout({ id: '', gymId: 'g-iron', coachId: 'u-c1', date: isoDate(), amount: 100, currency: 'USD', method: 'CASH' });
      expect(store.coachStatement('g-iron', 'u-c1').due).toBeCloseTo(before - 100, 2);
      expect(store.notificationsOf('u-c1')[0].title).toBe('Payment received');
    });
    it('puts member payments, expenses, coach pay and Liftly invoices in the gym ledger', () => {
      const sources = new Set(store.gymLedger('g-iron').map((l) => l.source));
      expect([...sources].sort()).toEqual(['EXPENSE', 'INVOICE', 'PAYMENT', 'PAYOUT']);
    });
    it('adds paid private lessons to the coach ledger', () => {
      const unpaid = store.sessions().find((s) => s.id === 'ps-5')!;
      expect(store.coachLedger('u-c1').some((l) => l.id === unpaid.id)).toBe(false);
      store.markSessionPaid('ps-5', 'TRANSFER', 'REF-1');
      const line = store.coachLedger('u-c1').find((l) => l.id === 'ps-5')!;
      expect(line).toMatchObject({ type: 'INCOME', method: 'TRANSFER', reference: 'REF-1', amount: 45 });
    });
    it('splits VAT on platform invoices by gym country', () => {
      const es = store.platformLedger().filter((l) => l.country === 'ES');
      expect(es.length).toBeGreaterThan(0);
      for (const l of es) expect(l.vat).toBeCloseTo(l.amount - l.amount / 1.21, 1);
    });
    it('records and deletes expenses', () => {
      const e = store.saveExpense({ id: '', owner: 'GYM', ownerId: 'g-wave', date: isoDate(), category: 'RENT', label: 'Rent', amount: 500, currency: 'EUR' });
      expect(store.expensesOf('GYM', 'g-wave').map((x) => x.id)).toContain(e.id);
      store.deleteExpense(e.id);
      expect(store.expensesOf('GYM', 'g-wave').map((x) => x.id)).not.toContain(e.id);
    });
  });
  describe('accounting currency', () => {
    it('follows the country of the user', () => {
      expect(store.accountingCurrency('u-a2')).toBe('EUR'); // Spain
      expect(store.accountingCurrency('u-c3')).toBe('MAD'); // Morocco
      store.setUserCountry('u-sa', 'MA');
      expect(store.accountingCurrency('u-sa')).toBe('MAD');
    });
    it('falls back to the gym or rate currency without a country', () => {
      store.updateUser({ ...store.user('u-a2')!, country: undefined });
      expect(store.accountingCurrency('u-a2')).toBe(store.gymsOfAdmin('u-a2')[0].currency);
    });
    it('converts the journals into the chosen currency', () => {
      const usd = store.platformLedger('USD');
      const mad = store.platformLedger('MAD');
      const sum = (l: typeof usd) => l.filter((x) => x.type === 'INCOME').reduce((s, x) => s + x.amount, 0);
      expect(sum(mad)).toBeCloseTo(store.convert(sum(usd), 'USD', 'MAD'), 0);
      const gym = store.gymLedger('g-iron', 'EUR').find((l) => l.source === 'PAYMENT')!;
      expect(gym.original?.currency).toBe('USD');
    });
  });
  describe('member engagement', () => {
    it('logs workouts, ticks plan items and tracks personal records', () => {
      const before = store.personalRecords('u-k1').find((r) => r.exercise === 'Back squat')!.e1rm;
      store.saveWorkout({ id: '', clientId: 'u-k1', date: isoDate(), title: 'Day 1', planId: 'tp-1', entries: [{ exercise: 'Back squat', itemId: 'i3', sets: [{ reps: 3, weight: 150 }] }], createdAt: '' });
      expect(store.personalRecords('u-k1').find((r) => r.exercise === 'Back squat')!.e1rm).toBeGreaterThan(before);
      expect(store.plans().find((p) => p.id === 'tp-1')!.items.find((i) => i.id === 'i3')!.done).toBe(true);
      expect(store.e1rm(100, 5)).toBeCloseTo(116.7, 1);
    });
    it('computes badges, streaks and challenge progress', () => {
      const badges = store.badges('u-k1');
      expect(badges.find((b) => b.key === 'first-visit')!.earned).toBe(true);
      expect(store.visitStreak('u-k1').longest).toBeGreaterThanOrEqual(store.visitStreak('u-k1').current);
      const ch = store.challenges().find((c) => c.id === 'ch-1')!;
      const before = store.challengeProgress(ch, 'u-k1');
      store.checkIn('g-iron', 'u-k1', 'QR');
      expect(store.challengeProgress(ch, 'u-k1')).toBe(before + 1);
      expect(store.leaderboard(ch)[0].user.id).toBe('u-k1');
    });
    it('lets only attendees rate a class, and toggles favourites', () => {
      const b = store.bookings().find((x) => x.id === 'b-13')!;
      expect(store.reviewClass(b.classId, b.date, 'u-k1', 4)).toBe(true);
      expect(store.reviewClass(b.classId, b.date, 'u-k2', 4)).toBe(false);
      expect(store.myClassReview(b.classId, b.date, 'u-k1')?.rating).toBe(4);
      store.toggleFavoriteClass('u-k3', 'c-hiit-1');
      expect(store.isFavoriteClass('u-k3', 'c-hiit-1')).toBe(true);
      store.toggleFavoriteClass('u-k3', 'c-hiit-1');
      expect(store.isFavoriteClass('u-k3', 'c-hiit-1')).toBe(false);
    });
    it('turns an approved freeze request into a freeze', () => {
      const r = store.requestFreeze({ membershipId: 'm-10', start: isoDate(), days: 7, reason: 'Trip' })!;
      expect(store.requestFreeze({ membershipId: 'm-10', start: isoDate(), days: 7, reason: 'Again' })).toBeNull();
      expect(store.notificationsOf('u-a1')[0].title).toBe('Freeze request');
      store.handleFreezeRequest(r.id, true);
      expect(store.clientStatus('g-iron', 'u-k6')).toBe('FROZEN');
    });
  });
  describe('gym operations', () => {
    it('uses one visit per check-in on a pass, and refuses when it is empty', () => {
      const pass = () => store.memberships().find((m) => m.id === 'm-11')!;
      const before = pass().credits!;
      expect(store.checkIn('g-iron', 'u-k5', 'QR').ok).toBe(true);
      expect(pass().credits).toBe(before - 1);
      // scanning again right away does not use another visit
      expect(store.checkIn('g-iron', 'u-k5', 'QR').reason).toBe('Already checked in');
      expect(pass().credits).toBe(before - 1);
    });
    it('covers family members with the holder plan', () => {
      const m = store.subscribeClient({ gymId: 'g-iron', clientId: 'u-k4', planId: 'mp-family' });
      expect(store.clientStatus('g-iron', 'u-k2')).toBe('EXPIRED');
      expect(store.addFamilyMember(m.id, 'u-k2').ok).toBe(true);
      expect(store.clientStatus('g-iron', 'u-k2')).toBe('ACTIVE');
      expect(store.addFamilyMember(m.id, 'u-k2')).toEqual({ ok: false, reason: 'Already covered by this plan.' });
    });
    it('asks members to sign a new waiver version', () => {
      expect(store.needsWaiver('g-iron', 'u-k1')).toBe(false);
      store.saveWaiver('g-iron', 'Liability waiver', 'New rules: always use the safety pins on the squat racks.');
      expect(store.needsWaiver('g-iron', 'u-k1')).toBe(true);
      expect(store.checkIn('g-iron', 'u-k1', 'MANUAL').reason).toBe('Waiver not signed');
      store.signWaiver('g-iron', 'u-k1', 'Chris Evans', 'data:image/png;base64,AAAA');
      expect(store.needsWaiver('g-iron', 'u-k1')).toBe(false);
    });
    it('books the cost of a service as a maintenance expense', () => {
      store.serviceEquipment('eq-2', 'Belt lubricated', 45);
      expect(store.equipmentState(store.equipment().find((e) => e.id === 'eq-2')!)).toBe('OK');
      expect(store.expensesOf('GYM', 'g-iron').some((e) => e.category === 'MAINTENANCE' && e.amount === 45)).toBe(true);
    });
    it('refuses overlapping shifts for the same person', () => {
      const day = store.shifts()[0];
      expect(store.saveShift({ ...day, id: '', start: '10:00', end: '12:00' })).toEqual({ ok: false, reason: 'This person already works at that time.' });
      expect(store.saveShift({ ...day, id: '', start: '15:00', end: '18:00' }).ok).toBe(true);
    });
  });
  describe('coach tools & platform', () => {
    it('limits modules by Liftly plan', () => {
      expect(store.hasModule('g-iron', 'KIOSK')).toBe(true); // Pro
      expect(store.hasModule('g-kumite', 'KIOSK')).toBe(false); // Starter
      expect(store.planWithModule('KIOSK')?.name).toBe('Pro');
    });
    it('assigns a template to athletes as their own plans', () => {
      const before = store.plansOfClient('u-k2').length;
      expect(store.assignTemplate('pt-1', ['u-k2'])).toBe(1);
      const p = store.plansOfClient('u-k2')[0];
      expect(store.plansOfClient('u-k2').length).toBe(before + 1);
      expect(p.title).toBe('Beginner full body — 3 days');
      expect(p.items.every((i) => !i.done)).toBe(true);
    });
    it('has no free slots on days off and can cancel booked sessions', () => {
      const monday = future(1);
      const s = store.requestSession({ coachId: 'u-c1', clientId: 'u-k1', gymId: 'g-iron', date: monday, start: '10:00', end: '11:00' })!;
      store.addTimeOff({ coachId: 'u-c1', start: monday, end: monday }, true);
      expect(store.freeSlots('u-c1', 'g-iron', monday)).toEqual([]);
      expect(store.sessions().find((x) => x.id === s.id)?.status).toBe('CANCELLED');
    });
    it('scores gym health between 0 and 100 with explained factors', () => {
      const h = store.gymHealth('g-iron');
      expect(h.score).toBeGreaterThanOrEqual(0);
      expect(h.score).toBeLessThanOrEqual(100);
      expect(h.factors.map((f) => f.key)).toEqual(['activity', 'growth', 'retention', 'engagement', 'account']);
    });
    it('shows platform banners to the right audience until dismissed', () => {
      store.postPlatformAnnouncement({ title: 'Maintenance', body: 'Sunday 2–4 am', level: 'MAINTENANCE', audience: 'ADMINS' });
      expect(store.platformBannersFor('u-a1').some((b) => b.title === 'Maintenance')).toBe(true);
      expect(store.platformBannersFor('u-k1').some((b) => b.title === 'Maintenance')).toBe(false);
      const id = store.platformBannersFor('u-a1').find((b) => b.title === 'Maintenance')!.id;
      store.dismissPlatformAnnouncement(id, 'u-a1');
      expect(store.platformBannersFor('u-a1').some((b) => b.id === id)).toBe(false);
    });
  });
});
