import { CURRENT_LANGUAGE, t } from './i18n/i18n';
import { Injectable, computed, effect, signal } from '@angular/core';
import {
  Announcement, AppNotification, AuditEntry, AthleteNote, CoachTimeOff, Exercise, GymModule, PlanTemplate, PlatformAnnouncement, Equipment, Locker, StaffShift, WaiverSignature, ChallengeMetric, ClassReview, FreezeRequest, GymChallenge, WorkoutLog, CoachPayout, Expense, ExpenseOwner, PayoutMethod, GymLocation, JoinRequest, JoinRequestStatus, BillingCycle, ChatMessage, CoachAvailability, PrivateSession, ProgressEntry, SessionStatus, TrainingPlan, CheckIn, ClassBooking, ClientMembership, ClientStatus, GymClass, CoachProfile, CoachReport, CoachReview, Country, CurrencySetting, DbState, Gender, Gym, GymReview,
  MembershipPlan, Payment, PlatformSettings, PromoCode, SaasPlan, ScheduleClosure, ScheduleSlot, Sport, User,
  NotifyCategory, notifyCategory,
} from './models';
import { canAttend, isoDate, openStatus, toMin } from './schedule';
import { DEFAULT_CURRENCY, countryName, currencyName, formatMoney, formatTotals } from './currency';
import { SEED } from './seed';

const STORAGE_KEY = 'liftly-db-v19';

export const uid = (prefix: string) => `${prefix}-${Math.random().toString(36).slice(2, 9)}`;

export interface PromoCheck {
  ok: boolean;
  message: string;
  promo?: PromoCode;
  finalPrice: number;
}

/**
 * In-memory mock backend persisted to localStorage.
 * Swap these methods for HttpClient calls when wiring up a real API.
 */
@Injectable({ providedIn: 'root' })
export class StoreService {
  private readonly state = signal<DbState>(this.load());

  readonly users = computed(() => this.state().users);
  readonly saasPlans = computed(() => this.state().saasPlans);
  readonly gyms = computed(() => this.state().gyms);
  readonly gymCoaches = computed(() => this.state().gymCoaches);
  readonly membershipPlans = computed(() => this.state().membershipPlans);
  readonly promoCodes = computed(() => this.state().promoCodes);
  readonly memberships = computed(() => this.state().memberships);
  readonly reviews = computed(() => this.state().reviews);
  readonly coachProfiles = computed(() => this.state().coachProfiles);
  readonly schedule = computed(() => this.state().schedule);
  readonly closures = computed(() => this.state().closures);
  readonly payments = computed(() => this.state().payments);
  readonly sports = computed(() => this.state().sports);
  readonly countries = computed(() => this.state().countries);
  readonly currencies = computed(() => this.state().currencies);
  readonly platform = computed(() => this.state().platform);
  readonly bans = computed(() => this.state().bans);
  readonly reports = computed(() => this.state().reports);
  readonly gymReviews = computed(() => this.state().gymReviews);
  readonly staff = computed(() => this.state().staff);
  readonly classes = computed(() => this.state().classes);
  readonly bookings = computed(() => this.state().bookings);
  readonly checkIns = computed(() => this.state().checkIns);
  readonly notifications = computed(() => this.state().notifications);
  readonly availability = computed(() => this.state().availability);
  readonly sessions = computed(() => this.state().sessions);
  readonly plans = computed(() => this.state().plans);
  readonly progress = computed(() => this.state().progress);
  readonly messages = computed(() => this.state().messages);
  readonly announcements = computed(() => this.state().announcements);
  readonly joinRequests = computed(() => this.state().joinRequests);
  readonly audit = computed(() => this.state().audit);
  readonly expenses = computed(() => this.state().expenses);
  readonly coachPayouts = computed(() => this.state().coachPayouts);
  readonly workouts = computed(() => this.state().workouts);
  readonly challenges = computed(() => this.state().challenges);
  readonly classReviews = computed(() => this.state().classReviews);
  readonly freezeRequests = computed(() => this.state().freezeRequests);
  readonly waiverSignatures = computed(() => this.state().waiverSignatures);
  readonly equipment = computed(() => this.state().equipment);
  readonly lockers = computed(() => this.state().lockers);
  readonly shifts = computed(() => this.state().shifts);
  readonly exercises = computed(() => this.state().exercises);
  readonly planTemplates = computed(() => this.state().planTemplates);
  readonly timeOff = computed(() => this.state().timeOff);
  readonly athleteNotes = computed(() => this.state().athleteNotes);
  readonly platformAnnouncements = computed(() => this.state().platformAnnouncements);
  /** Signed-in user, set by AuthService: recorded as the actor of audit entries. */
  readonly actorId = signal<string | null>(null);

  /** Platform catalog of sports (shared by all gyms). */
  readonly catalogSports = computed(() => this.sports().filter((s) => !s.gymId));
  /** Active currencies for pickers: { code, label }. */
  readonly currencyOptions = computed(() => this.currencies().filter((c) => c.active).map((c) => ({ code: c.code, label: currencyName(c.code) })));
  /** Active countries for pickers: { code, label, currency }, sorted by name. */
  readonly countryOptions = computed(() =>
    this.countries().filter((c) => c.active).map((c) => ({ code: c.code, label: countryName(c.code), currency: c.currency })).sort((a, b) => a.label.localeCompare(b.label)));

  readonly coaches = computed(() => this.users().filter((u) => u.role === 'COACH'));
  readonly clients = computed(() => this.users().filter((u) => u.role === 'CLIENT'));

  constructor() {
    effect(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state()));
      } catch { /* storage unavailable */ }
    });
  }

  private load(): DbState {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const db = JSON.parse(raw) as DbState;
        // light migration for older saved data
        db.schedule ??= [];
        db.closures ??= [];
        db.payments ??= [];
        db.coachProfiles = db.coachProfiles.map((p) => ({ ...p, currency: p.currency ?? DEFAULT_CURRENCY }));
        db.gyms = db.gyms.map((g) => ({ ...g, currency: g.currency ?? DEFAULT_CURRENCY }));
        return db;
      }
    } catch { /* ignore */ }
    return structuredClone(SEED);
  }

  resetDemo() {
    this.state.set(structuredClone(SEED));
  }

  /** Copy of some collections, with a function that puts them back (used by undo). */
  snapshot(keys: (keyof DbState)[]) {
    const saved = Object.fromEntries(keys.map((k) => [k, structuredClone(this.state()[k])])) as Partial<DbState>;
    return () => this.patch(() => structuredClone(saved));
  }
  private patch(fn: (s: DbState) => Partial<DbState>) {
    this.state.update((s) => ({ ...s, ...fn(s) }));
  }

  // ---------- lookups ----------
  user(id: string | undefined) { return this.users().find((u) => u.id === id); }
  gym(id: string | undefined) { return this.gyms().find((g) => g.id === id); }
  /** Currency code of a gym (USD if unknown). */
  currencyOf(gymId: string | undefined) { return this.gym(gymId)?.currency ?? DEFAULT_CURRENCY; }
  /** Currency of a membership plan (its own, else the gym's). */
  planCurrency(plan: MembershipPlan | undefined | null) { return plan?.currency || this.currencyOf(plan?.gymId); }
  /** Currency a membership was paid in. */
  membershipCurrency(m: ClientMembership) { return m.currency || this.plan(m.planId)?.currency || this.currencyOf(m.gymId); }
  /** Currency of a payment. */
  paymentCurrency(p: Payment) { return p.currency || this.currencyOf(p.gymId); }
  saasPlan(id: string | undefined) { return this.saasPlans().find((p) => p.id === id); }
  plan(id: string | undefined) { return this.membershipPlans().find((p) => p.id === id); }
  promo(id: string | undefined) { return this.promoCodes().find((p) => p.id === id); }
  coachProfile(id: string) { return this.coachProfiles().find((p) => p.userId === id); }
  fullName(id: string | undefined) {
    const u = this.user(id);
    return u ? `${u.firstName} ${u.lastName}` : '—';
  }

  gymsOfAdmin(adminId: string) { return this.gyms().filter((g) => g.ownerId === adminId); }
  coachesOfGym(gymId: string) {
    const ids = this.gymCoaches().filter((l) => l.gymId === gymId).map((l) => l.coachId);
    return this.users().filter((u) => ids.includes(u.id));
  }
  gymsOfCoach(coachId: string) {
    const ids = this.gymCoaches().filter((l) => l.coachId === coachId).map((l) => l.gymId);
    return this.gyms().filter((g) => ids.includes(g.id));
  }
  membershipsOfGym(gymId: string) { return this.memberships().filter((m) => m.gymId === gymId); }
  /** The membership is the member's own, or a family plan they are added to. */
  covers(m: ClientMembership, clientId: string) { return m.clientId === clientId || !!m.familyMembers?.includes(clientId); }
  membershipsOfClient(clientId: string) { return this.memberships().filter((m) => this.covers(m, clientId)); }
  clientsOfGym(gymId: string) {
    const ids = new Set(this.membershipsOfGym(gymId).flatMap((m) => [m.clientId, ...(m.familyMembers ?? [])]));
    return this.users().filter((u) => ids.has(u.id));
  }
  gymsOfClient(clientId: string) {
    const ids = new Set(this.membershipsOfClient(clientId).map((m) => m.gymId));
    return this.gyms().filter((g) => ids.has(g.id));
  }
  plansOfGym(gymId: string) { return this.membershipPlans().filter((p) => p.gymId === gymId); }
  promosOfGym(gymId: string) { return this.promoCodes().filter((p) => p.gymId === gymId); }
  reviewsOfCoach(coachId: string) {
    return this.reviews().filter((r) => r.coachId === coachId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
  coachRating(coachId: string) {
    const list = this.reviews().filter((r) => r.coachId === coachId);
    const avg = list.length ? list.reduce((s, r) => s + r.rating, 0) / list.length : 0;
    return { avg: Math.round(avg * 10) / 10, count: list.length };
  }
  /** Revenue of a gym, summed per currency ("$1,200.00 + €50.00"). */
  gymRevenue(gymId: string, decimals?: 0 | 2) {
    return formatTotals(this.membershipsOfGym(gymId).map((m) => ({ amount: m.pricePaid, currency: this.membershipCurrency(m) })), this.currencyOf(gymId), decimals);
  }

  // ---------- users ----------
  /** Create an account. Without a password the user gets an invitation link to activate it (7 days). */
  addUser(u: Omit<User, 'id' | 'createdAt' | 'active' | 'password'> & { password?: string }): User {
    const invite = u.password ? undefined : { token: uid('inv') + Math.random().toString(36).slice(2, 10), expiresAt: new Date(Date.now() + 7 * 86400000).toISOString() };
    const user: User = { ...u, password: u.password ?? '', ...(invite ? { invite } : {}), id: uid('u'), createdAt: new Date().toISOString(), active: true };
    this.log(invite ? 'User invited' : 'User created', `${user.firstName} ${user.lastName} · ${user.role}`);
    this.patch((s) => ({ users: [...s.users, user] }));
    if (user.role === 'COACH') {
      this.upsertCoachProfile({ userId: user.id, bio: '', specialties: [], yearsExperience: 0, hourlyRate: 0, currency: DEFAULT_CURRENCY });
    }
    return user;
  }
  updateUser(u: User) { this.patch((s) => ({ users: s.users.map((x) => (x.id === u.id ? u : x)) })); }
  upsertCoachProfile(p: CoachProfile) {
    this.patch((s) => ({
      coachProfiles: s.coachProfiles.some((x) => x.userId === p.userId)
        ? s.coachProfiles.map((x) => (x.userId === p.userId ? p : x))
        : [...s.coachProfiles, p],
    }));
  }

  // ---------- SaaS plans (super-admin) ----------
  saveSaasPlan(p: SaasPlan) {
    this.log('SaaS plan saved', p.name);
    this.patch((s) => ({
      saasPlans: s.saasPlans.some((x) => x.id === p.id)
        ? s.saasPlans.map((x) => (x.id === p.id ? p : x))
        : [...s.saasPlans, { ...p, id: p.id || uid('sp') }],
    }));
  }
  deleteSaasPlan(id: string) { this.patch((s) => ({ saasPlans: s.saasPlans.filter((p) => p.id !== id) })); }

  // ---------- gyms ----------
  addGym(g: Omit<Gym, 'id'>): Gym {
    const gym = { ...g, id: uid('g') };
    this.patch((s) => ({ gyms: [...s.gyms, gym] }));
    this.log('Gym created', gym.name, gym.id);
    return gym;
  }
  updateGym(g: Gym) {
    const before = this.gym(g.id);
    if (before && before.status !== g.status) this.log('Gym status changed', `${g.name}: ${before.status} → ${g.status}`, g.id);
    if (before && before.saasPlanId !== g.saasPlanId) this.log('Gym plan changed', `${g.name}: ${this.saasPlan(g.saasPlanId)?.name ?? ''}`, g.id);
    this.patch((s) => ({ gyms: s.gyms.map((x) => (x.id === g.id ? g : x)) }));
  }

  // ---------- gym <-> coach ----------
  linkCoach(gymId: string, coachId: string) {
    this.log('Coach linked', this.fullName(coachId), gymId);
    if (this.gymCoaches().some((l) => l.gymId === gymId && l.coachId === coachId)) return;
    this.patch((s) => ({ gymCoaches: [...s.gymCoaches, { gymId, coachId, since: new Date().toISOString() }] }));
  }
  unlinkCoach(gymId: string, coachId: string) {
    this.log('Coach removed', this.fullName(coachId), gymId);
    this.patch((s) => ({ gymCoaches: s.gymCoaches.filter((l) => !(l.gymId === gymId && l.coachId === coachId)) }));
  }

  // ---------- membership plans ----------
  saveMembershipPlan(p: MembershipPlan) {
    this.log('Membership plan saved', p.name, p.gymId);
    this.patch((s) => ({
      membershipPlans: s.membershipPlans.some((x) => x.id === p.id)
        ? s.membershipPlans.map((x) => (x.id === p.id ? p : x))
        : [...s.membershipPlans, { ...p, id: p.id || uid('mp') }],
    }));
  }
  deleteMembershipPlan(id: string) {
    this.patch((s) => ({ membershipPlans: s.membershipPlans.filter((p) => p.id !== id) }));
  }

  // ---------- promo codes ----------
  savePromo(p: PromoCode) {
    this.log('Promo code saved', p.code.toUpperCase(), p.gymId);
    const code = p.code.trim().toUpperCase();
    this.patch((s) => ({
      promoCodes: s.promoCodes.some((x) => x.id === p.id)
        ? s.promoCodes.map((x) => (x.id === p.id ? { ...p, code } : x))
        : [...s.promoCodes, { ...p, code, id: p.id || uid('pc') }],
    }));
  }
  deletePromo(id: string) { this.patch((s) => ({ promoCodes: s.promoCodes.filter((p) => p.id !== id) })); }

  checkPromo(gymId: string, planId: string, rawCode: string): PromoCheck {
    const plan = this.plan(planId);
    const price = plan?.price ?? 0;
    const code = rawCode.trim().toUpperCase();
    if (!code) return { ok: false, message: t('Enter a code'), finalPrice: price };
    const promo = this.promoCodes().find((p) => p.gymId === gymId && p.code === code);
    const now = new Date().toISOString();
    if (!promo || !promo.active) return { ok: false, message: t('Invalid promo code'), finalPrice: price };
    if (now < promo.validFrom || now > promo.validUntil) return { ok: false, message: t('This code has expired'), finalPrice: price };
    if (promo.maxUses !== -1 && promo.uses >= promo.maxUses) return { ok: false, message: t('Usage limit reached'), finalPrice: price };
    if (promo.planIds.length && !promo.planIds.includes(planId)) return { ok: false, message: t('Not valid for this plan'), finalPrice: price };
    const discount = promo.discountType === 'PERCENT' ? (price * promo.value) / 100 : promo.value;
    const finalPrice = Math.max(0, Math.round((price - discount) * 100) / 100);
    const label = promo.discountType === 'PERCENT' ? `${promo.value}% off` : `${formatMoney(promo.value, this.planCurrency(plan))} off`;
    return { ok: true, message: t('Code applied: {0}', { 0: label }), promo, finalPrice };
  }

  // ---------- client memberships ----------
  subscribeClient(input: { gymId: string; clientId: string; planId: string; coachId?: string; promoCode?: string; start?: Date }): ClientMembership {
    if (this.isBanned(input.gymId, input.clientId)) throw new Error('Client is banned from this gym');
    const plan = this.plan(input.planId)!;
    const check = input.promoCode ? this.checkPromo(input.gymId, input.planId, input.promoCode) : undefined;
    const start = input.start ?? new Date();
    const end = new Date(start.getTime() + plan.durationDays * 86400000);
    const m: ClientMembership = {
      id: uid('m'),
      gymId: input.gymId,
      clientId: input.clientId,
      planId: plan.id,
      coachId: input.coachId,
      promoCodeId: check?.ok ? check.promo!.id : undefined,
      pricePaid: check?.ok ? check.finalPrice : plan.price,
      currency: this.planCurrency(plan),
      startDate: start.toISOString(),
      endDate: end.toISOString(),
      status: 'ACTIVE',
      ...(plan.kind === 'PACK' || plan.kind === 'DROPIN' ? { credits: plan.credits ?? 1 } : {}),
    };
    const payment: Payment = { id: uid('p'), gymId: m.gymId, clientId: m.clientId, date: m.startDate.slice(0, 10), amount: m.pricePaid, currency: m.currency, method: 'CASH', note: plan.name };
    this.patch((s) => ({
      memberships: [...s.memberships, m],
      payments: m.pricePaid > 0 ? [...s.payments, payment] : s.payments,
      promoCodes: check?.ok
        ? s.promoCodes.map((p) => (p.id === check.promo!.id ? { ...p, uses: p.uses + 1 } : p))
        : s.promoCodes,
    }));
    this.log('Membership created', `${this.fullName(m.clientId)} · ${plan.name}`, m.gymId);
    return m;
  }
  updateMembership(m: ClientMembership) {
    this.patch((s) => ({ memberships: s.memberships.map((x) => (x.id === m.id ? m : x)) }));
  }

  // ---------- reviews ----------
  saveReview(r: Omit<CoachReview, 'id' | 'createdAt'>) {
    const existing = this.reviews().find((x) => x.coachId === r.coachId && x.clientId === r.clientId && x.gymId === r.gymId);
    const review: CoachReview = { ...r, id: existing?.id ?? uid('r'), createdAt: new Date().toISOString() };
    this.patch((s) => ({
      reviews: existing ? s.reviews.map((x) => (x.id === existing.id ? review : x)) : [...s.reviews, review],
    }));
  }
  deleteReview(id: string) { this.patch((s) => ({ reviews: s.reviews.filter((r) => r.id !== id) })); }

  // ---------- schedule ----------
  scheduleOfGym(gymId: string) {
    return this.schedule().filter((s) => s.gymId === gymId).sort((a, b) => a.open.localeCompare(b.open));
  }
  closuresOfGym(gymId: string) {
    return this.closures().filter((c) => c.gymId === gymId).sort((a, b) => a.date.localeCompare(b.date));
  }
  /** Insert or update several slots at once (e.g. one slot applied to many days). */
  saveSlots(slots: ScheduleSlot[]) {
    this.patch((s) => {
      const list = [...s.schedule];
      for (const slot of slots) {
        const withId = { ...slot, id: slot.id || uid('s') };
        const i = list.findIndex((x) => x.id === withId.id);
        if (i >= 0) list[i] = withId; else list.push(withId);
      }
      return { schedule: list };
    });
  }
  deleteSlot(id: string) { this.patch((s) => ({ schedule: s.schedule.filter((x) => x.id !== id) })); }
  /** Replace the whole week of a gym (used by templates / copy actions). */
  replaceSchedule(gymId: string, slots: Omit<ScheduleSlot, 'id' | 'gymId'>[]) {
    this.patch((s) => ({
      schedule: [...s.schedule.filter((x) => x.gymId !== gymId), ...slots.map((x) => ({ ...x, gymId, id: uid('s') }))],
    }));
  }
  addClosure(c: Omit<ScheduleClosure, 'id'>) { this.patch((s) => ({ closures: [...s.closures, { ...c, id: uid('cl') }] })); }
  deleteClosure(id: string) { this.patch((s) => ({ closures: s.closures.filter((c) => c.id !== id) })); }
  gymOpenStatus(gymId: string, gender?: Gender) {
    return openStatus(this.scheduleOfGym(gymId), this.closuresOfGym(gymId), gender);
  }

  // ---------- payments ----------
  paymentsOf(gymId: string, clientId: string) {
    return this.payments().filter((p) => p.gymId === gymId && p.clientId === clientId).sort((a, b) => a.date.localeCompare(b.date));
  }
  savePayment(p: Payment) {
    this.log(this.payments().some((x) => x.id === p.id) ? 'Payment edited' : 'Payment recorded', `${this.fullName(p.clientId)} · ${formatMoney(p.amount, p.currency ?? this.currencyOf(p.gymId))}`, p.gymId);
    this.patch((s) => ({
      payments: s.payments.some((x) => x.id === p.id)
        ? s.payments.map((x) => (x.id === p.id ? p : x))
        : [...s.payments, { ...p, id: p.id || uid('p') }],
    }));
  }
  deletePayment(id: string) { this.patch((s) => ({ payments: s.payments.filter((p) => p.id !== id) })); }

  // ---------- sports ----------
  sport(id: string | undefined) { return this.sports().find((s) => s.id === id); }
  /** Display name: catalog sports are translated, custom sports are shown as typed. */
  sportName(id: string | undefined) {
    const sp = this.sport(id);
    return sp ? (sp.gymId ? sp.name : t(sp.name)) : '';
  }
  sportsOfGym(gym: Gym | undefined) {
    return (gym?.sportIds ?? []).map((id) => this.sport(id)).filter((s): s is Sport => !!s);
  }
  sportNames(gym: Gym | undefined) { return this.sportsOfGym(gym).map((s) => this.sportName(s.id)).join(', '); }
  /** Sports a gym can pick: the catalog plus its own custom sports. */
  availableSports(gymId: string) { return this.sports().filter((s) => !s.gymId || s.gymId === gymId); }
  saveSport(sp: Sport): Sport {
    const saved = { ...sp, id: sp.id || uid('sport') };
    this.patch((s) => ({ sports: s.sports.some((x) => x.id === saved.id) ? s.sports.map((x) => (x.id === saved.id ? saved : x)) : [...s.sports, saved] }));
    return saved;
  }
  /** Number of gyms and schedule slots using a sport. */
  sportUsage(id: string) {
    return { gyms: this.gyms().filter((g) => g.sportIds.includes(id)).length, slots: this.schedule().filter((x) => x.sportId === id).length };
  }
  deleteSport(id: string) {
    this.log('Sport deleted', this.sportName(id));
    this.patch((s) => ({
      sports: s.sports.filter((x) => x.id !== id),
      gyms: s.gyms.map((g) => ({ ...g, sportIds: g.sportIds.filter((x) => x !== id) })),
      schedule: s.schedule.map((x) => (x.sportId === id ? { ...x, sportId: undefined } : x)),
    }));
  }
  /** Remove a sport from one gym; its schedule slots for that sport become "whole gym". Custom sports are deleted. */
  removeSportFromGym(gymId: string, sportId: string) {
    const custom = this.sport(sportId)?.gymId === gymId;
    this.patch((s) => ({
      gyms: s.gyms.map((g) => (g.id === gymId ? { ...g, sportIds: g.sportIds.filter((x) => x !== sportId) } : g)),
      schedule: s.schedule.map((x) => (x.gymId === gymId && x.sportId === sportId ? { ...x, sportId: undefined } : x)),
      sports: custom ? s.sports.filter((x) => x.id !== sportId) : s.sports,
    }));
  }
  slotsUsingSport(gymId: string, sportId: string) { return this.schedule().filter((x) => x.gymId === gymId && x.sportId === sportId).length; }
  setGymSports(gymId: string, sportIds: string[]) {
    this.patch((s) => ({ gyms: s.gyms.map((g) => (g.id === gymId ? { ...g, sportIds } : g)) }));
  }

  // ---------- platform, countries & currencies ----------
  updatePlatform(p: PlatformSettings) { this.patch(() => ({ platform: p })); }
  country(code: string | undefined) { return this.countries().find((c) => c.code === code); }
  saveCountry(c: Country) {
    this.log('Country saved', `${c.code} · ${c.currency}${c.vatRate != null ? ' · VAT ' + c.vatRate + '%' : ''}`);
    this.patch((s) => ({ countries: s.countries.some((x) => x.code === c.code) ? s.countries.map((x) => (x.code === c.code ? c : x)) : [...s.countries, c] }));
  }
  deleteCountry(code: string) { this.patch((s) => ({ countries: s.countries.filter((c) => c.code !== code) })); }
  currencySetting(code: string | undefined) { return this.currencies().find((c) => c.code === code); }
  saveCurrency(c: CurrencySetting) {
    this.log('Currency saved', `${c.code} = ${c.rateToUsd} USD`);
    this.patch((s) => ({ currencies: s.currencies.some((x) => x.code === c.code) ? s.currencies.map((x) => (x.code === c.code ? c : x)) : [...s.currencies, c] }));
  }
  deleteCurrency(code: string) { this.patch((s) => ({ currencies: s.currencies.filter((c) => c.code !== code) })); }
  /** Where a currency is used (gyms, plans, countries) — currencies in use cannot be deleted. */
  currencyUsage(code: string) {
    return {
      gyms: this.gyms().filter((g) => g.currency === code).length,
      plans: this.membershipPlans().filter((p) => p.currency === code).length,
      countries: this.countries().filter((c) => c.currency === code).length,
    };
  }
  /** Convert an amount to USD with the super-admin's rates (1 if unknown). */
  toUsd(amount: number, currency: string) { return amount * (this.currencySetting(currency)?.rateToUsd ?? 1); }
  /** Convert between two currencies through USD. */
  convert(amount: number, from: string, to: string) {
    if (from === to) return amount;
    return this.toUsd(amount, from) / (this.currencySetting(to)?.rateToUsd ?? 1);
  }

  /** Price of a SaaS plan for a country: the local price if the super-admin set one, else the USD price. */
  saasPrice(plan: SaasPlan | undefined, countryCode: string | undefined, cycle: BillingCycle) {
    if (!plan) return { amount: 0, currency: DEFAULT_CURRENCY, local: false };
    const local = plan.countryPrices?.find((cp) => cp.country === countryCode);
    const country = this.country(countryCode);
    if (local && country) return { amount: cycle === 'MONTHLY' ? local.monthly : local.yearly, currency: country.currency, local: true };
    return { amount: cycle === 'MONTHLY' ? plan.monthlyPrice : plan.yearlyPrice, currency: DEFAULT_CURRENCY, local: false };
  }
  /** What a gym pays per month for its Liftly plan, in USD (for MRR). */
  gymMrrUsd(gym: Gym) {
    if (gym.status !== 'ACTIVE') return 0;
    const p = this.saasPrice(this.saasPlan(gym.saasPlanId), gym.country, gym.billingCycle);
    const monthly = gym.billingCycle === 'MONTHLY' ? p.amount : p.amount / 12;
    return this.toUsd(monthly, p.currency);
  }

  // ---------- client status & bans ----------
  ban(gymId: string, clientId: string) { return this.bans().find((b) => b.gymId === gymId && b.clientId === clientId); }
  isBanned(gymId: string, clientId: string) { return !!this.ban(gymId, clientId); }
  /** BANNED if banned, ACTIVE with an active membership, otherwise EXPIRED. */
  clientStatus(gymId: string, clientId: string): ClientStatus {
    if (this.isBanned(gymId, clientId)) return 'BANNED';
    const now = new Date().toISOString();
    const active = this.activeMemberships(gymId, clientId, now);
    if (!active.length) return 'EXPIRED';
    return active.every((m) => this.frozenToday(m)) ? 'FROZEN' : 'ACTIVE';
  }
  /** Running memberships covering a member at a gym (packs need credits left). */
  activeMemberships(gymId: string, clientId: string, now = new Date().toISOString()) {
    return this.memberships().filter((m) => m.gymId === gymId && this.covers(m, clientId) && m.status === 'ACTIVE' && m.startDate <= now && m.endDate >= now && (m.credits === undefined || m.credits > 0));
  }
  /** Is today inside one of the membership's freezes? */
  frozenToday(m: ClientMembership) {
    const today = isoDate();
    return (m.freezes ?? []).some((f) => f.start <= today && today <= f.end);
  }
  /** Pause a membership for `days` days from `start`: the end date moves back by the same length. */
  freezeMembership(id: string, start: string, days: number, reason: string) {
    const fm = this.memberships().find((x) => x.id === id);
    if (fm) this.log('Membership frozen', `${this.fullName(fm.clientId)} · ${days} d`, fm.gymId);
    this.patch((s) => ({
      memberships: s.memberships.map((m) => {
        if (m.id !== id) return m;
        const startD = new Date(start + 'T00:00:00');
        const end = isoDate(new Date(startD.getTime() + (days - 1) * 86400000));
        return { ...m, endDate: new Date(new Date(m.endDate).getTime() + days * 86400000).toISOString(), freezes: [...(m.freezes ?? []), { start, end, reason }] };
      }),
    }));
    const m = this.memberships().find((x) => x.id === id);
    if (m) this.notify(m.clientId, 'Membership frozen', 'Your membership at {gym} is paused from {start} for {days} days. Its end date moved back accordingly.', { gym: this.gym(m.gymId)?.name ?? '', start, days }, '/client');
  }
  unfreezeMembership(id: string) {
    // ends the current freeze today; the days not used are given back to the end date
    const today = isoDate();
    this.patch((s) => ({
      memberships: s.memberships.map((m) => {
        if (m.id !== id) return m;
        let giveBack = 0;
        const freezes = (m.freezes ?? []).flatMap((f) => {
          if (f.end < today) return [f];
          const unused = Math.round((new Date(f.end).getTime() - new Date(f.start > today ? f.start : today).getTime()) / 86400000) + (f.start > today ? 1 : 0);
          giveBack += Math.max(0, unused);
          return f.start > today ? [] : [{ ...f, end: isoDate(new Date(Date.now() - 86400000)) }];
        });
        return { ...m, freezes, endDate: new Date(new Date(m.endDate).getTime() - giveBack * 86400000).toISOString() };
      }),
    }));
  }
  /** Ban a client from a gym: their active memberships are cancelled. */
  banClient(gymId: string, clientId: string, reason: string) {
    this.log('Client banned', `${this.fullName(clientId)} · ${reason}`, gymId);
    if (this.isBanned(gymId, clientId)) return;
    this.patch((s) => ({
      bans: [...s.bans, { gymId, clientId, reason, date: new Date().toISOString() }],
      memberships: s.memberships.map((m) => (m.gymId === gymId && m.clientId === clientId && m.status === 'ACTIVE' ? { ...m, status: 'CANCELLED' as const } : m)),
    }));
  }
  unbanClient(gymId: string, clientId: string) {
    this.log('Client unbanned', this.fullName(clientId), gymId);
    this.patch((s) => ({ bans: s.bans.filter((b) => !(b.gymId === gymId && b.clientId === clientId)) }));
  }

  // ---------- coach reports ----------
  reportsOfGym(gymId: string) { return this.reports().filter((r) => r.gymId === gymId).sort((a, b) => b.createdAt.localeCompare(a.createdAt)); }
  addReport(r: Omit<CoachReport, 'id' | 'status' | 'createdAt'>) {
    this.patch((s) => ({ reports: [...s.reports, { ...r, id: uid('rep'), status: 'OPEN' as const, createdAt: new Date().toISOString() }] }));
  }
  updateReport(r: CoachReport) { this.patch((s) => ({ reports: s.reports.map((x) => (x.id === r.id ? r : x)) })); }

  // ---------- gym reviews ----------
  reviewsOfGym(gymId: string) { return this.gymReviews().filter((r) => r.gymId === gymId).sort((a, b) => b.createdAt.localeCompare(a.createdAt)); }
  gymRating(gymId: string) {
    const list = this.gymReviews().filter((r) => r.gymId === gymId);
    const avg = list.length ? list.reduce((s, r) => s + r.rating, 0) / list.length : 0;
    return { avg: Math.round(avg * 10) / 10, count: list.length };
  }
  gymReviewBy(gymId: string, clientId: string) { return this.gymReviews().find((r) => r.gymId === gymId && r.clientId === clientId); }
  saveGymReview(r: Omit<GymReview, 'id' | 'createdAt'>) {
    const existing = this.gymReviewBy(r.gymId, r.clientId);
    const review: GymReview = { ...r, id: existing?.id ?? uid('gr'), createdAt: new Date().toISOString() };
    this.patch((s) => ({ gymReviews: existing ? s.gymReviews.map((x) => (x.id === existing.id ? review : x)) : [...s.gymReviews, review] }));
  }
  deleteGymReview(id: string) { this.patch((s) => ({ gymReviews: s.gymReviews.filter((r) => r.id !== id) })); }

  // ---------- staff (front desk) ----------
  staffOfGym(gymId: string) {
    const ids = this.staff().filter((x) => x.gymId === gymId).map((x) => x.userId);
    return this.users().filter((u) => ids.includes(u.id));
  }
  gymsOfStaff(userId: string) {
    const ids = this.staff().filter((x) => x.userId === userId).map((x) => x.gymId);
    return this.gyms().filter((g) => ids.includes(g.id));
  }
  linkStaff(gymId: string, userId: string) {
    this.log('Staff added', this.fullName(userId), gymId);
    if (this.staff().some((x) => x.gymId === gymId && x.userId === userId)) return;
    this.patch((s) => ({ staff: [...s.staff, { gymId, userId, since: new Date().toISOString() }] }));
  }
  unlinkStaff(gymId: string, userId: string) { this.patch((s) => ({ staff: s.staff.filter((x) => !(x.gymId === gymId && x.userId === userId)) })); }

  // ---------- classes & bookings ----------
  classesOfGym(gymId: string) { return this.classes().filter((c) => c.gymId === gymId).sort((a, b) => (a.day - b.day) || a.start.localeCompare(b.start)); }
  gymClass(id: string | undefined) { return this.classes().find((c) => c.id === id); }
  saveClass(c: GymClass): GymClass {
    const saved = { ...c, id: c.id || uid('cls') };
    this.patch((s) => ({ classes: s.classes.some((x) => x.id === saved.id) ? s.classes.map((x) => (x.id === saved.id ? saved : x)) : [...s.classes, saved] }));
    return saved;
  }
  /** Delete a class: future bookings are cancelled and their members notified. */
  deleteClass(id: string) {
    this.log('Class deleted', this.gymClass(id)?.name ?? id, this.gymClass(id)?.gymId);
    const c = this.gymClass(id);
    const today = isoDate();
    const affected = this.bookings().filter((b) => b.classId === id && b.date >= today && (b.status === 'BOOKED' || b.status === 'WAITLIST'));
    this.patch((s) => ({ classes: s.classes.filter((x) => x.id !== id), bookings: s.bookings.map((b) => (affected.includes(b) ? { ...b, status: 'CANCELLED' as const } : b)) }));
    for (const b of affected) this.notify(b.clientId, 'Class cancelled', '{class} on {date} was cancelled by the gym.', { class: c?.name ?? '', date: b.date }, '/client/classes');
  }

  /** Bookings of one class occurrence, in booking order. */
  bookingsOf(classId: string, date: string) {
    return this.bookings().filter((b) => b.classId === classId && b.date === date).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }
  /** Places taken (booked or attended) and waitlist length of an occurrence. */
  occupancy(classId: string, date: string) {
    const list = this.bookingsOf(classId, date);
    return { taken: list.filter((b) => b.status === 'BOOKED' || b.status === 'ATTENDED').length, waitlist: list.filter((b) => b.status === 'WAITLIST').length };
  }
  /** Occurrences of a gym's active classes over the next `days` days (today included), by start time. */
  upcomingClasses(gymId: string, days = 7) {
    const out: { cls: GymClass; date: string }[] = [];
    const now = new Date();
    for (let i = 0; i < days; i++) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
      for (const c of this.classesOfGym(gymId).filter((x) => x.active && x.day === d.getDay())) out.push({ cls: c, date: isoDate(d) });
    }
    return out;
  }
  /** Has this occurrence already started? */
  started(c: GymClass, date: string) {
    const now = new Date();
    return date < isoDate(now) || (date === isoDate(now) && toMin(c.start) <= now.getHours() * 60 + now.getMinutes());
  }
  myBooking(classId: string, date: string, clientId: string) {
    return this.bookingsOf(classId, date).find((b) => b.clientId === clientId && b.status !== 'CANCELLED');
  }
  /** Can a client book this occurrence? Returns the English reason when not. */
  canBook(c: GymClass, date: string, clientId: string): { ok: boolean; reason?: string } {
    const status = this.clientStatus(c.gymId, clientId);
    if (status === 'BANNED') return { ok: false, reason: 'You are banned from this gym.' };
    if (status === 'FROZEN') return { ok: false, reason: 'Your membership is frozen.' };
    if (status !== 'ACTIVE') return { ok: false, reason: 'You need an active membership at this gym.' };
    if (!canAttend({ audience: c.audience } as ScheduleSlot, this.user(clientId)?.gender)) return { ok: false, reason: 'This class is not open to you.' };
    if (this.started(c, date)) return { ok: false, reason: 'This class has already started.' };
    if (this.myBooking(c.id, date, clientId)) return { ok: false, reason: 'You already have a place.' };
    return { ok: true };
  }
  /** Book a place, or join the waitlist when the class is full. */
  book(classId: string, date: string, clientId: string): ClassBooking | null {
    const c = this.gymClass(classId);
    if (!c || !this.canBook(c, date, clientId).ok) return null;
    const full = this.occupancy(classId, date).taken >= c.capacity;
    const b: ClassBooking = { id: uid('b'), classId, gymId: c.gymId, clientId, date, status: full ? 'WAITLIST' : 'BOOKED', createdAt: new Date().toISOString() };
    this.patch((s) => ({ bookings: [...s.bookings, b] }));
    return b;
  }
  /** Cancel a booking; a freed place goes to the first person on the waitlist (who is notified). */
  cancelBooking(id: string) {
    const b = this.bookings().find((x) => x.id === id);
    if (!b) return;
    this.patch((s) => ({ bookings: s.bookings.map((x) => (x.id === id ? { ...x, status: 'CANCELLED' as const } : x)) }));
    if (b.status === 'BOOKED') this.promoteWaitlist(b.classId, b.date);
  }
  private promoteWaitlist(classId: string, date: string) {
    const c = this.gymClass(classId);
    if (!c) return;
    const { taken } = this.occupancy(classId, date);
    const next = this.bookingsOf(classId, date).find((x) => x.status === 'WAITLIST');
    if (!next || taken >= c.capacity) return;
    this.patch((s) => ({ bookings: s.bookings.map((x) => (x.id === next.id ? { ...x, status: 'BOOKED' as const } : x)) }));
    this.notify(next.clientId, 'You got a place!', 'A spot opened up in {class} on {date} at {time}. You are now booked.', { class: c.name, date, time: c.start }, '/client/classes');
  }
  /** Gym staff: mark a booking attended / no-show. */
  setBookingStatus(id: string, status: ClassBooking['status']) {
    this.patch((s) => ({ bookings: s.bookings.map((x) => (x.id === id ? { ...x, status } : x)) }));
  }
  bookingsOfClient(clientId: string) { return this.bookings().filter((b) => b.clientId === clientId).sort((a, b) => a.date.localeCompare(b.date)); }

  // ---------- check-in ----------
  checkInsOfGym(gymId: string) { return this.checkIns().filter((c) => c.gymId === gymId).sort((a, b) => b.at.localeCompare(a.at)); }
  checkInsOfClient(clientId: string) { return this.checkIns().filter((c) => c.clientId === clientId).sort((a, b) => b.at.localeCompare(a.at)); }
  /**
   * Check a member in at a gym. Refused when unknown, banned, frozen or without an active membership;
   * allowed with a warning outside the sessions open to them. Today's booked class is marked attended.
   */
  checkIn(gymId: string, clientId: string, method: CheckIn['method'], staffId?: string, locationId?: string): CheckIn {
    const user = this.user(clientId);
    let ok = true;
    let reason: string | undefined;
    if (!user || user.role !== 'CLIENT') { ok = false; reason = 'Unknown member'; }
    else {
      const status = this.clientStatus(gymId, clientId);
      if (status === 'BANNED') { ok = false; reason = 'Banned from this gym'; }
      else if (status === 'FROZEN') { ok = false; reason = 'Membership frozen'; }
      else if (status === 'EXPIRED') {
        ok = false;
        const now = new Date().toISOString();
        const emptyPack = this.memberships().some((m) => m.gymId === gymId && this.covers(m, clientId) && m.status === 'ACTIVE' && m.endDate >= now && m.credits === 0);
        reason = emptyPack ? 'No visits left on the pass' : 'No active membership';
      }
      else if (this.needsWaiver(gymId, clientId)) reason = 'Waiver not signed';
      else if (!this.gymOpenStatus(gymId, user.gender).open) reason = 'Outside the sessions open to this member';
    }
    // scanned twice (or standing in front of the kiosk): no second entry, no second visit used
    if (ok && user) {
      const since = new Date(Date.now() - 15 * 60000).toISOString();
      const recent = this.checkIns().find((c) => c.ok && c.gymId === gymId && c.clientId === clientId && c.at >= since);
      if (recent) return { ...recent, reason: 'Already checked in' };
    }
    // passes: a visit is used, unless the member also has an unlimited membership
    let creditFrom: string | undefined;
    if (ok) {
      const active = this.activeMemberships(gymId, clientId).filter((m) => !this.frozenToday(m));
      if (active.length && active.every((m) => m.credits !== undefined)) creditFrom = active.sort((a, b) => a.endDate.localeCompare(b.endDate))[0].id;
    }
    const entry: CheckIn = { id: uid('ci'), gymId, clientId, at: new Date().toISOString(), method, ok, ...(reason ? { reason } : {}), ...(staffId ? { staffId } : {}), ...(locationId ? { locationId } : {}) };
    const today = isoDate();
    this.patch((s) => ({
      checkIns: [...s.checkIns, entry],
      bookings: ok ? s.bookings.map((b) => (b.gymId === gymId && b.clientId === clientId && b.date === today && b.status === 'BOOKED' ? { ...b, status: 'ATTENDED' as const } : b)) : s.bookings,
      memberships: creditFrom ? s.memberships.map((m) => (m.id === creditFrom ? { ...m, credits: Math.max(0, (m.credits ?? 1) - 1) } : m)) : s.memberships,
    }));
    return entry;
  }

  // ---------- notifications ----------
  notificationsOf(userId: string) { return this.notifications().filter((n) => n.userId === userId).sort((a, b) => b.createdAt.localeCompare(a.createdAt)); }
  /** Send an in-app notification (title/body are English keys translated for the reader). Skipped if `key` was already sent. */
  notify(userId: string, title: string, body: string, params?: Record<string, string | number>, link?: string, key?: string) {
    if (key && this.notifications().some((n) => n.key === key && n.userId === userId)) return false;
    if (this.user(userId)?.notifyOff?.includes(notifyCategory(title))) return false;
    const n: AppNotification = { id: uid('n'), userId, title, body, ...(params ? { params } : {}), ...(link ? { link } : {}), read: false, createdAt: new Date().toISOString(), ...(key ? { key } : {}) };
    this.patch((s) => ({ notifications: [...s.notifications, n] }));
    return true;
  }
  setNotifyOff(userId: string, cat: NotifyCategory, off: boolean) {
    this.patch((s) => ({ users: s.users.map((u) => u.id !== userId ? u : { ...u, notifyOff: off ? [...new Set([...(u.notifyOff ?? []), cat])] : (u.notifyOff ?? []).filter((c) => c !== cat) }) }));
  }
  markRead(id: string) { this.patch((s) => ({ notifications: s.notifications.map((n) => (n.id === id ? { ...n, read: true } : n)) })); }
  markAllRead(userId: string) { this.patch((s) => ({ notifications: s.notifications.map((n) => (n.userId === userId ? { ...n, read: true } : n)) })); }

  /** Active memberships of a gym ending within `days` days. */
  endingSoon(gymId: string, days = 7) {
    const now = new Date().toISOString();
    const limit = new Date(Date.now() + days * 86400000).toISOString();
    return this.membershipsOfGym(gymId).filter((m) => m.status === 'ACTIVE' && m.endDate >= now && m.endDate <= limit
      && !this.membershipsOfGym(gymId).some((o) => o.clientId === m.clientId && o.id !== m.id && o.status === 'ACTIVE' && o.startDate >= m.startDate));
  }
  /** Remind members whose membership ends soon (once per membership). Returns how many were sent. */
  sendRenewalReminders(gymId: string, days = 7) {
    let sent = 0;
    for (const m of this.endingSoon(gymId, days)) {
      if (this.notify(m.clientId, 'Your membership ends soon', 'Your {plan} membership at {gym} ends on {date}. Ask the gym to renew it.',
        { plan: this.plan(m.planId)?.name ?? '', gym: this.gym(gymId)?.name ?? '', date: m.endDate.slice(0, 10) }, '/client', `renew-${m.id}`)) sent++;
    }
    return sent;
  }
  // ---------- coach athletes ----------
  /** Members who have this coach on an active membership. */
  athletesOf(coachId: string) {
    const ids = new Set(this.memberships().filter((m) => m.coachId === coachId && m.status === 'ACTIVE').map((m) => m.clientId));
    return this.users().filter((u) => ids.has(u.id));
  }
  /** Coaches a member can work with: coaches of the gyms where they have an active membership. */
  coachesForClient(clientId: string) {
    const gyms = this.gymsOfClient(clientId).filter((g) => this.clientStatus(g.id, clientId) === 'ACTIVE');
    return gyms.flatMap((g) => this.coachesOfGym(g.id).map((c) => ({ coach: c, gym: g })));
  }

  // ---------- private sessions ----------
  availabilityOf(coachId: string, gymId?: string) {
    return this.availability().filter((a) => a.coachId === coachId && (!gymId || a.gymId === gymId)).sort((a, b) => (a.day - b.day) || a.start.localeCompare(b.start));
  }
  saveAvailability(a: CoachAvailability) {
    const saved = a.id ? a : { ...a, id: uid('av') };
    this.patch((s) => ({ availability: s.availability.some((x) => x.id === saved.id) ? s.availability.map((x) => (x.id === saved.id ? saved : x)) : [...s.availability, saved] }));
  }
  deleteAvailability(id: string) { this.patch((s) => ({ availability: s.availability.filter((x) => x.id !== id) })); }

  /** Sessions still holding a slot. */
  private busy(s: PrivateSession) { return s.status === 'REQUESTED' || s.status === 'CONFIRMED'; }
  /** Free session slots of a coach at a gym on a date (availability minus booked sessions and the past). */
  freeSlots(coachId: string, gymId: string, date: string) {
    if (this.isOff(coachId, date)) return [];
    const day = new Date(date + 'T00:00:00').getDay();
    const taken = this.sessions().filter((s) => s.coachId === coachId && s.date === date && this.busy(s));
    const now = new Date();
    const out: { start: string; end: string }[] = [];
    const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
    for (const a of this.availabilityOf(coachId, gymId).filter((x) => x.day === day)) {
      for (let m = toMin(a.start); m + a.slotMin <= toMin(a.end); m += a.slotMin) {
        const start = hhmm(m), end = hhmm(m + a.slotMin);
        if (new Date(`${date}T${start}:00`) <= now) continue;
        if (taken.some((s) => toMin(s.start) < m + a.slotMin && m < toMin(s.end))) continue;
        out.push({ start, end });
      }
    }
    return out;
  }
  sessionsOfCoach(coachId: string) { return this.sessions().filter((s) => s.coachId === coachId).sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start)); }
  sessionsOfClient(clientId: string) { return this.sessions().filter((s) => s.clientId === clientId).sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start)); }
  /** A member asks a coach for a session; the coach confirms or declines it. */
  requestSession(r: { coachId: string; clientId: string; gymId: string; date: string; start: string; end: string; note?: string }) {
    if (!this.freeSlots(r.coachId, r.gymId, r.date).some((x) => x.start === r.start)) return null;
    const profile = this.coachProfile(r.coachId);
    const minutes = toMin(r.end) - toMin(r.start);
    const session: PrivateSession = {
      ...r, id: uid('ps'), status: 'REQUESTED', createdAt: new Date().toISOString(),
      price: Math.round((profile?.hourlyRate ?? 0) * minutes / 60 * 100) / 100, currency: profile?.currency ?? DEFAULT_CURRENCY,
    };
    this.patch((s) => ({ sessions: [...s.sessions, session] }));
    this.notify(r.coachId, 'New session request', '{name} asks for a session on {date} at {time}.', { name: this.fullName(r.clientId), date: r.date, time: r.start }, '/coach/sessions');
    return session;
  }
  setSessionStatus(id: string, status: SessionStatus, byId?: string) {
    const ses = this.sessions().find((x) => x.id === id);
    if (!ses) return;
    this.patch((s) => ({ sessions: s.sessions.map((x) => (x.id === id ? { ...x, status } : x)) }));
    const params = { name: this.fullName(ses.coachId), date: ses.date, time: ses.start };
    if (status === 'CONFIRMED') this.notify(ses.clientId, 'Session confirmed', '{name} confirmed your session on {date} at {time}.', params, '/client/sessions');
    if (status === 'DECLINED') this.notify(ses.clientId, 'Session declined', '{name} cannot do {date} at {time}. Pick another slot.', params, '/client/sessions');
    if (status === 'CANCELLED') {
      if (byId === ses.clientId) this.notify(ses.coachId, 'Session cancelled', '{name} cancelled the session on {date} at {time}.', { ...params, name: this.fullName(ses.clientId) }, '/coach/sessions');
      else this.notify(ses.clientId, 'Session cancelled', '{name} cancelled the session on {date} at {time}.', params, '/client/sessions');
    }
  }

  // ---------- training plans ----------
  plansOfClient(clientId: string) { return this.plans().filter((p) => p.clientId === clientId).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)); }
  plansByCoach(coachId: string) { return this.plans().filter((p) => p.coachId === coachId).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)); }
  savePlan(p: TrainingPlan) {
    const now = new Date().toISOString();
    const isNew = !p.id;
    const saved: TrainingPlan = { ...p, id: p.id || uid('tp'), createdAt: p.createdAt || now, updatedAt: now, items: p.items.map((i) => ({ ...i, id: i.id || uid('it') })) };
    this.patch((s) => ({ plans: isNew ? [...s.plans, saved] : s.plans.map((x) => (x.id === saved.id ? saved : x)) }));
    this.notify(p.clientId, isNew ? 'New plan from your coach' : 'Your plan was updated', '{name}: {title}', { name: this.fullName(p.coachId), title: p.title }, '/client/plans');
    return saved;
  }
  deletePlan(id: string) { this.patch((s) => ({ plans: s.plans.filter((x) => x.id !== id) })); }
  /** Member ticks an exercise or meal as done. */
  toggleItem(planId: string, itemId: string) {
    this.patch((s) => ({ plans: s.plans.map((p) => (p.id !== planId ? p : { ...p, items: p.items.map((i) => (i.id === itemId ? { ...i, done: !i.done } : i)) })) }));
  }
  resetPlanProgress(planId: string) {
    this.patch((s) => ({ plans: s.plans.map((p) => (p.id !== planId ? p : { ...p, items: p.items.map((i) => ({ ...i, done: false })) })) }));
  }

  // ---------- progress ----------
  progressOf(clientId: string) { return this.progress().filter((p) => p.clientId === clientId).sort((a, b) => a.date.localeCompare(b.date)); }
  addProgress(e: Omit<ProgressEntry, 'id'>) { this.patch((s) => ({ progress: [...s.progress, { ...e, id: uid('pr') }] })); }
  deleteProgress(id: string) { this.patch((s) => ({ progress: s.progress.filter((x) => x.id !== id) })); }

  // ---------- messages ----------
  /** People a user may write to: members ↔ their gyms' coaches and admins; coaches ↔ their gyms' members and admins; staff ↔ their gym's admins. */
  contactsOf(userId: string): User[] {
    const u = this.user(userId);
    if (!u) return [];
    const admins = (gymIds: string[]) => this.gyms().filter((g) => gymIds.includes(g.id)).map((g) => g.ownerId);
    let ids: string[] = [];
    if (u.role === 'CLIENT') {
      const gyms = this.gymsOfClient(userId).map((g) => g.id);
      ids = [...gyms.flatMap((g) => this.coachesOfGym(g).map((c) => c.id)), ...admins(gyms)];
    } else if (u.role === 'COACH') {
      const gyms = this.gymsOfCoach(userId).map((g) => g.id);
      ids = [...gyms.flatMap((g) => this.clientsOfGym(g).map((c) => c.id)), ...admins(gyms)];
    } else if (u.role === 'ADMIN') {
      const gyms = this.gyms().filter((g) => g.ownerId === userId).map((g) => g.id);
      ids = gyms.flatMap((g) => [...this.coachesOfGym(g), ...this.clientsOfGym(g), ...this.staffOfGym(g)].map((x) => x.id));
    } else if (u.role === 'STAFF') {
      ids = admins(this.gymsOfStaff(userId).map((g) => g.id));
    }
    // anyone who already wrote to the user stays reachable
    ids.push(...this.messages().filter((m) => m.toId === userId).map((m) => m.fromId));
    const set = new Set(ids.filter((id) => id !== userId));
    return this.users().filter((x) => set.has(x.id)).sort((a, b) => a.firstName.localeCompare(b.firstName));
  }
  thread(a: string, b: string) {
    return this.messages().filter((m) => (m.fromId === a && m.toId === b) || (m.fromId === b && m.toId === a)).sort((x, y) => x.at.localeCompare(y.at));
  }
  /** Conversations of a user, latest first. */
  conversationsOf(userId: string) {
    const map = new Map<string, { otherId: string; last: ChatMessage; unread: number }>();
    for (const m of [...this.messages()].sort((x, y) => x.at.localeCompare(y.at))) {
      if (m.fromId !== userId && m.toId !== userId) continue;
      const other = m.fromId === userId ? m.toId : m.fromId;
      const c = map.get(other) ?? { otherId: other, last: m, unread: 0 };
      c.last = m;
      if (m.toId === userId && !m.read) c.unread++;
      map.set(other, c);
    }
    return [...map.values()].sort((a, b) => b.last.at.localeCompare(a.last.at));
  }
  unreadMessages(userId: string) { return this.messages().filter((m) => m.toId === userId && !m.read).length; }
  sendMessage(fromId: string, toId: string, body: string) {
    const text = body.trim();
    if (!text) return;
    this.patch((s) => ({ messages: [...s.messages, { id: uid('msg'), fromId, toId, body: text, at: new Date().toISOString(), read: false }] }));
  }
  markThreadRead(me: string, other: string) {
    if (!this.messages().some((m) => m.toId === me && m.fromId === other && !m.read)) return;
    this.patch((s) => ({ messages: s.messages.map((m) => (m.toId === me && m.fromId === other ? { ...m, read: true } : m)) }));
  }

  // ---------- announcements ----------
  /** Gyms whose announcements a user sees. */
  gymsForUser(userId: string) {
    const u = this.user(userId);
    if (!u) return [];
    if (u.role === 'CLIENT') return this.gymsOfClient(userId);
    if (u.role === 'COACH') return this.gymsOfCoach(userId);
    if (u.role === 'STAFF') return this.gymsOfStaff(userId);
    if (u.role === 'ADMIN') return this.gyms().filter((g) => g.ownerId === userId);
    return [];
  }
  announcementsFor(userId: string) {
    const ids = this.gymsForUser(userId).map((g) => g.id);
    return this.announcements().filter((a) => ids.includes(a.gymId)).sort((a, b) => Number(!!b.pinned) - Number(!!a.pinned) || b.at.localeCompare(a.at));
  }
  /** Post to everyone at the gym (members, coaches, staff); each gets a notification. */
  postAnnouncement(a: Omit<Announcement, 'id' | 'at'>) {
    this.log('Announcement posted', a.title, a.gymId);
    const ann: Announcement = { ...a, id: uid('an'), at: new Date().toISOString() };
    this.patch((s) => ({ announcements: [...s.announcements, ann] }));
    const people = [...this.clientsOfGym(a.gymId), ...this.coachesOfGym(a.gymId), ...this.staffOfGym(a.gymId)];
    for (const p of new Set(people.map((x) => x.id))) {
      this.notify(p, 'Announcement from {gym}', a.title, { gym: this.gym(a.gymId)?.name ?? '' }, undefined, `ann-${ann.id}`);
    }
    return people.length;
  }
  togglePin(id: string) { this.patch((s) => ({ announcements: s.announcements.map((a) => (a.id === id ? { ...a, pinned: !a.pinned } : a)) })); }
  deleteAnnouncement(id: string) { this.patch((s) => ({ announcements: s.announcements.filter((a) => a.id !== id) })); }
  // ---------- audit log ----------
  /** Record an action in the platform activity log (newest kept, capped at 500). */
  log(action: string, target?: string, gymId?: string) {
    const e: AuditEntry = { id: uid('au'), at: new Date().toISOString(), action, ...(this.actorId() ? { actorId: this.actorId()! } : {}), ...(target ? { target } : {}), ...(gymId ? { gymId } : {}) };
    this.patch((s) => ({ audit: [...(s.audit ?? []), e].slice(-500) }));
  }
  auditLog() { return [...this.audit()].sort((a, b) => b.at.localeCompare(a.at)); }

  // ---------- invitations ----------
  userByInvite(token: string) {
    const u = this.users().find((x) => x.invite?.token === token);
    return u && u.invite!.expiresAt > new Date().toISOString() ? u : undefined;
  }
  inviteLink(u: User) { return u.invite ? `${location.origin}/activate/${u.invite.token}` : ''; }
  /** New invitation link (e.g. the first one expired). */
  reinvite(userId: string) {
    const invite = { token: uid('inv') + Math.random().toString(36).slice(2, 10), expiresAt: new Date(Date.now() + 7 * 86400000).toISOString() };
    this.patch((s) => ({ users: s.users.map((u) => (u.id === userId ? { ...u, invite } : u)) }));
    return this.user(userId)!;
  }
  /** The invited user chooses a password: the account becomes usable. */
  activate(token: string, password: string) {
    const u = this.userByInvite(token);
    if (!u) return null;
    this.patch((s) => ({ users: s.users.map((x) => (x.id === u.id ? { ...x, password, invite: undefined } : x)) }));
    const prev = this.actorId();
    this.actorId.set(u.id);
    this.log('Account activated', `${u.firstName} ${u.lastName}`);
    this.actorId.set(prev);
    return this.user(u.id)!;
  }

  // ---------- referrals ----------
  /** A member's referral code: their first name, made unique when needed. */
  refCode(userId: string) {
    const u = this.user(userId);
    if (!u) return '';
    const base = u.firstName.normalize('NFD').replace(/[^A-Za-z]/g, '').toUpperCase().slice(0, 8) || 'LIFTLY';
    const clash = this.users().some((x) => x.id !== u.id && x.role === 'CLIENT' && x.firstName.normalize('NFD').replace(/[^A-Za-z]/g, '').toUpperCase().slice(0, 8) === base);
    return clash ? base + u.id.replace(/[^a-z0-9]/gi, '').slice(-3).toUpperCase() : base;
  }
  userByRefCode(code: string | undefined) {
    const c = (code ?? '').trim().toUpperCase();
    return c ? this.clients().find((u) => this.refCode(u.id) === c) : undefined;
  }
  referralsOf(userId: string) { return this.users().filter((u) => u.referredBy === userId); }
  /** Members of a gym ranked by how many people they brought to it. */
  topReferrers(gymId: string) {
    const members = new Set(this.clientsOfGym(gymId).map((c) => c.id));
    const counts = new Map<string, number>();
    for (const u of this.users()) if (u.referredBy && members.has(u.id)) counts.set(u.referredBy, (counts.get(u.referredBy) ?? 0) + 1);
    return [...counts.entries()].map(([id, count]) => ({ user: this.user(id)!, count })).filter((x) => x.user).sort((a, b) => b.count - a.count);
  }
  publicGymLink(gymId: string, ref?: string) { return `${location.origin}/gyms/${gymId}${ref ? '?ref=' + encodeURIComponent(ref) : ''}`; }

  // ---------- public directory & join requests ----------
  publishedGyms() { return this.gyms().filter((g) => g.published !== false && g.status !== 'SUSPENDED'); }
  joinRequestsOf(gymId: string) { return this.joinRequests().filter((r) => r.gymId === gymId).sort((a, b) => b.createdAt.localeCompare(a.createdAt)); }
  addJoinRequest(r: Omit<JoinRequest, 'id' | 'status' | 'createdAt'>) {
    const req: JoinRequest = { ...r, id: uid('jr'), status: 'NEW', createdAt: new Date().toISOString() };
    this.patch((s) => ({ joinRequests: [...s.joinRequests, req] }));
    const gym = this.gym(r.gymId);
    if (gym) this.notify(gym.ownerId, 'New join request', '{name} wants to join {gym}.', { name: `${r.firstName} ${r.lastName}`, gym: gym.name }, '/admin/requests');
    this.log('Join request', `${r.firstName} ${r.lastName}`, r.gymId);
    return req;
  }
  setJoinRequestStatus(id: string, status: JoinRequestStatus) { this.patch((s) => ({ joinRequests: s.joinRequests.map((r) => (r.id === id ? { ...r, status } : r)) })); }
  /** Create (or reuse) the member account for a request; new accounts get an invitation link. */
  convertJoinRequest(id: string) {
    const r = this.joinRequests().find((x) => x.id === id);
    if (!r) return null;
    let user = this.users().find((u) => u.email.toLowerCase() === r.email.toLowerCase());
    if (user && user.role !== 'CLIENT') return null;
    const referrer = this.userByRefCode(r.ref);
    if (!user) user = this.addUser({ role: 'CLIENT', firstName: r.firstName, lastName: r.lastName, email: r.email, ...(r.phone ? { phone: r.phone } : {}), ...(referrer ? { referredBy: referrer.id } : {}) });
    this.patch((s) => ({ joinRequests: s.joinRequests.map((x) => (x.id === id ? { ...x, status: 'CONVERTED' as const, clientId: user!.id } : x)) }));
    return user;
  }

  // ---------- locations ----------
  locationsOf(gymId: string) { return this.gym(gymId)?.locations ?? []; }
  location(gymId: string, id: string | undefined) { return this.locationsOf(gymId).find((l) => l.id === id); }
  saveLocation(gymId: string, loc: GymLocation) {
    const g = this.gym(gymId);
    if (!g) return;
    const saved = loc.id ? loc : { ...loc, id: uid('loc') };
    const list = g.locations ?? [];
    this.updateGym({ ...g, locations: list.some((l) => l.id === saved.id) ? list.map((l) => (l.id === saved.id ? saved : l)) : [...list, saved] });
    this.log('Location saved', `${g.name} · ${saved.name}`, gymId);
  }
  deleteLocation(gymId: string, id: string) {
    const g = this.gym(gymId);
    if (!g) return;
    this.updateGym({ ...g, locations: (g.locations ?? []).filter((l) => l.id !== id) });
    this.patch((s) => ({ classes: s.classes.map((c) => (c.gymId === gymId && c.locationId === id ? { ...c, locationId: undefined } : c)) }));
  }

  // ---------- receipts & invoices (VAT) ----------
  vatRate(country: string | undefined) { return this.countries().find((c) => c.code === country)?.vatRate ?? 0; }
  /** Split a VAT-inclusive amount. */
  vatSplit(gross: number, rate: number) {
    const net = Math.round((gross / (1 + rate / 100)) * 100) / 100;
    return { gross, net, vat: Math.round((gross - net) * 100) / 100, rate };
  }
  /** Sequential-looking receipt number for a member payment. */
  receiptNumber(p: Payment) { return `R-${p.date.slice(0, 4)}-${p.id.replace(/[^a-z0-9]/gi, '').slice(-6).toUpperCase()}`; }
  /** Liftly subscription invoices of a gym: one per billing period since it subscribed (newest first). */
  saasInvoices(gymId: string) {
    const g = this.gym(gymId);
    if (!g) return [];
    const plan = this.saasPlan(g.saasPlanId);
    const price = this.saasPrice(plan, g.country, g.billingCycle);
    const out: { index: number; number: string; date: string; periodEnd: string; amount: number; currency: string; plan: string; paid: boolean }[] = [];
    const start = new Date(g.subscribedAt);
    const step = g.billingCycle === 'YEARLY' ? 12 : 1;
    for (let i = 0; ; i++) {
      const d = new Date(start.getFullYear(), start.getMonth() + i * step, start.getDate());
      if (d > new Date() || i > 60) break;
      const end = new Date(d.getFullYear(), d.getMonth() + step, d.getDate() - 1);
      if (g.status === 'TRIAL') break;
      out.push({ index: i, number: `LF-${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}-${g.id.replace(/[^a-z0-9]/gi, '').slice(-4).toUpperCase()}`, date: isoDate(d), periodEnd: isoDate(end), amount: price.amount, currency: price.currency, plan: plan?.name ?? '', paid: true });
    }
    return out.reverse();
  }

  // ---------- trials ----------
  /** Gyms on trial whose trial ends within `days` days. */
  trialsEnding(days = 7) {
    const limit = new Date(Date.now() + days * 86400000).toISOString();
    return this.gyms().filter((g) => g.status === 'TRIAL' && g.renewsAt <= limit);
  }
  trialDaysLeft(g: Gym) { return Math.max(0, Math.ceil((new Date(g.renewsAt).getTime() - Date.now()) / 86400000)); }
  sendTrialReminders(days = 7) {
    let n = 0;
    for (const g of this.trialsEnding(days)) {
      if (this.notify(g.ownerId, 'Your trial ends soon', 'The free trial of {gym} ends in {days} days. Choose a plan in Billing to keep your data and members.', { gym: g.name, days: this.trialDaysLeft(g) }, '/admin/billing', `trial-${g.id}-${g.renewsAt.slice(0, 10)}`)) n++;
    }
    return n;
  }

  // ---------- retention cohorts ----------
  /**
   * Members grouped by the month of their first membership (at one gym, or anywhere);
   * pct[k] = share still holding a membership k months later.
   */
  retentionCohorts(gymId?: string, months = 6) {
    const list = this.memberships().filter((m) => !gymId || m.gymId === gymId);
    const byClient = new Map<string, ClientMembership[]>();
    for (const m of list) byClient.set(m.clientId, [...(byClient.get(m.clientId) ?? []), m]);
    const now = new Date();
    const monthKey = (d: Date) => d.getFullYear() * 12 + d.getMonth();
    const nowKey = monthKey(now);
    const cohorts = new Map<number, string[]>();
    for (const [client, ms] of byClient) {
      const first = Math.min(...ms.map((m) => monthKey(new Date(m.startDate))));
      if (nowKey - first > months - 1) continue;
      cohorts.set(first, [...(cohorts.get(first) ?? []), client]);
    }
    const activeIn = (ms: ClientMembership[], key: number) => {
      const from = new Date(Math.floor(key / 12), key % 12, 1).toISOString();
      const to = new Date(Math.floor(key / 12), key % 12 + 1, 0, 23, 59).toISOString();
      return ms.some((m) => m.startDate <= to && m.endDate >= from);
    };
    const f = new Intl.DateTimeFormat(CURRENT_LANGUAGE.locale, { month: 'short', year: 'numeric' });
    return [...cohorts.entries()].sort((a, b) => a[0] - b[0]).map(([key, clients]) => ({
      key,
      label: f.format(new Date(Math.floor(key / 12), key % 12, 1)),
      size: clients.length,
      pct: Array.from({ length: Math.min(months, nowKey - key + 1) }, (_, k) =>
        Math.round((clients.filter((c) => activeIn(byClient.get(c)!, key + k)).length / clients.length) * 100)),
    }));
  }
  // ---------- coach agenda & scheduling ----------
  /** Classes of a coach (at every gym) taking place between two dates, inclusive. */
  classOccurrences(coachId: string, from: string, to: string, gymId?: string) {
    const out: { cls: GymClass; date: string }[] = [];
    const classes = this.classes().filter((c) => c.coachId === coachId && c.active && (!gymId || c.gymId === gymId));
    if (!classes.length) return out;
    const closed = new Set(this.closures().map((c) => `${c.gymId}|${c.date}`));
    for (let d = new Date(from + 'T00:00:00'); isoDate(d) <= to; d.setDate(d.getDate() + 1)) {
      const date = isoDate(d);
      for (const c of classes) if (c.day === d.getDay() && !closed.has(`${c.gymId}|${date}`)) out.push({ cls: c, date });
    }
    return out.sort((a, b) => (a.date + a.cls.start).localeCompare(b.date + b.cls.start));
  }
  /** Everything in a coach's week: classes they teach, private sessions, and their availability windows. */
  coachAgenda(coachId: string, from: string, to: string) {
    type Item = { kind: 'CLASS' | 'SESSION'; id: string; date: string; start: string; end: string; gymId: string; title: string; status?: string };
    const items: Item[] = this.classOccurrences(coachId, from, to).map(({ cls, date }) => ({ kind: 'CLASS', id: cls.id, date, start: cls.start, end: cls.end, gymId: cls.gymId, title: cls.name }));
    for (const s of this.sessions()) {
      if (s.coachId !== coachId || s.date < from || s.date > to || s.status === 'CANCELLED' || s.status === 'DECLINED') continue;
      items.push({ kind: 'SESSION', id: s.id, date: s.date, start: s.start, end: s.end, gymId: s.gymId, title: this.fullName(s.clientId), status: s.status });
    }
    return items.sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start));
  }
  /** What already occupies a coach at that time (a class or a session), if anything. */
  coachConflict(coachId: string, date: string, start: string, end: string, ignoreSessionId?: string) {
    const a = toMin(start), b = toMin(end);
    return this.coachAgenda(coachId, date, date).find((i) => i.id !== ignoreSessionId && toMin(i.start) < b && a < toMin(i.end));
  }
  /** A coach books a private lesson directly with one of their members (confirmed straight away). */
  scheduleSession(r: { coachId: string; clientId: string; gymId: string; date: string; start: string; end: string; note?: string; price?: number }) {
    if (toMin(r.end) <= toMin(r.start)) return { ok: false as const, reason: 'The end must be after the start.' };
    if (new Date(`${r.date}T${r.start}:00`) < new Date()) return { ok: false as const, reason: 'This time is in the past.' };
    const clash = this.coachConflict(r.coachId, r.date, r.start, r.end);
    if (clash) return { ok: false as const, reason: clash.kind === 'CLASS' ? 'You teach a class at that time.' : 'You already have a session at that time.' };
    const profile = this.coachProfile(r.coachId);
    const minutes = toMin(r.end) - toMin(r.start);
    const session: PrivateSession = {
      id: uid('ps'), coachId: r.coachId, clientId: r.clientId, gymId: r.gymId, date: r.date, start: r.start, end: r.end, status: 'CONFIRMED',
      ...(r.note ? { note: r.note } : {}), createdAt: new Date().toISOString(),
      price: r.price ?? Math.round((profile?.hourlyRate ?? 0) * minutes / 60 * 100) / 100, currency: profile?.currency ?? DEFAULT_CURRENCY,
    };
    this.patch((s) => ({ sessions: [...s.sessions, session] }));
    this.notify(r.clientId, 'Session scheduled', '{name} booked a private session with you on {date} at {time}.', { name: this.fullName(r.coachId), date: r.date, time: r.start }, '/client/sessions');
    return { ok: true as const, session };
  }
  /** Move a session to another time (coach side); the member is told. */
  rescheduleSession(id: string, date: string, start: string, end: string) {
    const ses = this.sessions().find((x) => x.id === id);
    if (!ses) return { ok: false as const, reason: 'Unknown session' };
    const clash = this.coachConflict(ses.coachId, date, start, end, id);
    if (clash) return { ok: false as const, reason: clash.kind === 'CLASS' ? 'You teach a class at that time.' : 'You already have a session at that time.' };
    this.patch((s) => ({ sessions: s.sessions.map((x) => (x.id === id ? { ...x, date, start, end } : x)) }));
    this.notify(ses.clientId, 'Session moved', '{name} moved your session to {date} at {time}.', { name: this.fullName(ses.coachId), date, time: start }, '/client/sessions');
    return { ok: true as const };
  }
  /** The member paid the coach for a session (cash or bank transfer). */
  markSessionPaid(id: string, method: PayoutMethod, reference?: string) {
    this.patch((s) => ({ sessions: s.sessions.map((x) => (x.id === id ? { ...x, paid: { method, at: new Date().toISOString(), ...(reference ? { reference } : {}) } } : x)) }));
  }
  markSessionUnpaid(id: string) { this.patch((s) => ({ sessions: s.sessions.map((x) => (x.id === id ? { ...x, paid: undefined } : x)) })); }

  // ---------- coach pay (gyms → coaches) ----------
  gymCoachLink(gymId: string, coachId: string) { return this.gymCoaches().find((l) => l.gymId === gymId && l.coachId === coachId); }
  setClassRate(gymId: string, coachId: string, classRate: number) {
    this.patch((s) => ({ gymCoaches: s.gymCoaches.map((l) => (l.gymId === gymId && l.coachId === coachId ? { ...l, classRate, ratesFrom: l.ratesFrom ?? isoDate() } : l)) }));
    this.log('Coach rate set', `${this.fullName(coachId)} · ${formatMoney(classRate, this.currencyOf(gymId))} / class`, gymId);
  }
  /** Classes a coach has already taught at a gym between two dates (counted from the rate start date). */
  classesTaught(gymId: string, coachId: string, from: string, to: string) {
    const link = this.gymCoachLink(gymId, coachId);
    if (!link?.classRate || !link.ratesFrom) return [];
    const start = from > link.ratesFrom ? from : link.ratesFrom;
    const now = new Date();
    return this.classOccurrences(coachId, start, to, gymId).filter((o) => new Date(`${o.date}T${o.cls.end}:00`) <= now);
  }
  /** Earned / paid / due for a coach at a gym (gym currency). With `month` (YYYY-MM) only that month. */
  coachStatement(gymId: string, coachId: string, month?: string) {
    const link = this.gymCoachLink(gymId, coachId);
    const cur = this.currencyOf(gymId);
    const from = month ? `${month}-01` : link?.ratesFrom ?? isoDate();
    const to = month ? isoDate(new Date(+month.slice(0, 4), +month.slice(5, 7), 0)) : isoDate();
    const taught = this.classesTaught(gymId, coachId, from, to);
    const earned = taught.length * (link?.classRate ?? 0);
    const payouts = this.coachPayouts().filter((p) => p.gymId === gymId && p.coachId === coachId && (!month || (p.period ?? p.date.slice(0, 7)) === month));
    const paid = payouts.reduce((t, p) => t + this.convert(p.amount, p.currency, cur), 0);
    return { classes: taught.length, rate: link?.classRate ?? 0, earned, paid: Math.round(paid * 100) / 100, due: Math.round((earned - paid) * 100) / 100, currency: cur, payouts };
  }
  payoutsOf(filter: { gymId?: string; coachId?: string }) {
    return this.coachPayouts().filter((p) => (!filter.gymId || p.gymId === filter.gymId) && (!filter.coachId || p.coachId === filter.coachId)).sort((a, b) => b.date.localeCompare(a.date));
  }
  saveCoachPayout(p: CoachPayout) {
    const isNew = !p.id;
    const saved = isNew ? { ...p, id: uid('po') } : p;
    this.patch((s) => ({ coachPayouts: isNew ? [...s.coachPayouts, saved] : s.coachPayouts.map((x) => (x.id === saved.id ? saved : x)) }));
    this.log(isNew ? 'Coach paid' : 'Coach payout edited', `${this.fullName(p.coachId)} · ${formatMoney(p.amount, p.currency)} · ${p.method}`, p.gymId);
    if (isNew) this.notify(p.coachId, 'Payment received', '{gym} paid you {amount} ({method}).', { gym: this.gym(p.gymId)?.name ?? '', amount: formatMoney(p.amount, p.currency), method: p.method === 'CASH' ? t('Cash') : t('Bank transfer') }, '/coach/accounting');
    return saved;
  }
  deleteCoachPayout(id: string) { this.patch((s) => ({ coachPayouts: s.coachPayouts.filter((x) => x.id !== id) })); }
  saveCoachBank(coachId: string, payoutMethod: PayoutMethod, bank?: CoachProfile['bank']) {
    const p = this.coachProfile(coachId);
    if (p) this.upsertCoachProfile({ ...p, payoutMethod, bank });
  }

  // ---------- workout log ----------
  workoutsOf(clientId: string) { return this.workouts().filter((w) => w.clientId === clientId).sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt)); }
  /** Save a logged workout; plan lines it follows are ticked in the plan. */
  saveWorkout(w: WorkoutLog) {
    const isNew = !w.id;
    const saved: WorkoutLog = { ...w, id: w.id || uid('wo'), createdAt: w.createdAt || new Date().toISOString() };
    this.patch((s) => ({ workouts: isNew ? [...s.workouts, saved] : s.workouts.map((x) => (x.id === saved.id ? saved : x)) }));
    if (w.planId) {
      const done = new Set(w.entries.map((e) => e.itemId).filter(Boolean));
      this.patch((s) => ({ plans: s.plans.map((p) => (p.id !== w.planId ? p : { ...p, items: p.items.map((i) => (done.has(i.id) ? { ...i, done: true } : i)) })) }));
    }
    return saved;
  }
  deleteWorkout(id: string) { this.patch((s) => ({ workouts: s.workouts.filter((w) => w.id !== id) })); }
  /** Estimated one-rep max (Epley). */
  e1rm(weight: number, reps: number) { return reps <= 1 ? weight : Math.round(weight * (1 + reps / 30) * 10) / 10; }
  /** Exercises a member does: from their plans and their logs. */
  exercisesOf(clientId: string) {
    const names = new Set<string>();
    for (const p of this.plansOfClient(clientId)) if (p.kind === 'WORKOUT') p.items.forEach((i) => names.add(i.name));
    for (const w of this.workoutsOf(clientId)) w.entries.forEach((e) => names.add(e.exercise));
    return [...names].sort((a, b) => a.localeCompare(b));
  }
  /** Best set per session for one exercise, oldest first. */
  exerciseHistory(clientId: string, exercise: string) {
    const key = exercise.trim().toLowerCase();
    return this.workoutsOf(clientId).slice().reverse().flatMap((w) => {
      const sets = w.entries.filter((e) => e.exercise.trim().toLowerCase() === key).flatMap((e) => e.sets);
      if (!sets.length) return [];
      const best = sets.reduce((a, b) => (this.e1rm(b.weight, b.reps) > this.e1rm(a.weight, a.reps) ? b : a));
      return [{ date: w.date, weight: best.weight, reps: best.reps, e1rm: this.e1rm(best.weight, best.reps), volume: sets.reduce((v, s) => v + s.reps * s.weight, 0) }];
    });
  }
  /** Personal record (heaviest estimated 1RM) per exercise. */
  personalRecords(clientId: string) {
    return this.exercisesOf(clientId).map((exercise) => {
      const h = this.exerciseHistory(clientId, exercise);
      if (!h.length) return null;
      const best = h.reduce((a, b) => (b.e1rm > a.e1rm ? b : a));
      return { exercise, ...best, sessions: h.length, improving: h.length > 1 && h.at(-1)!.e1rm >= best.e1rm };
    }).filter((x): x is NonNullable<typeof x> => !!x && x.weight > 0).sort((a, b) => b.e1rm - a.e1rm);
  }

  // ---------- streaks, badges & challenges ----------
  /** Weeks in a row (ending this or last week) with at least one check-in, and the longest run. */
  visitStreak(clientId: string) {
    const weekKey = (d: Date) => { const x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return isoDate(x); };
    const weeks = new Set(this.checkInsOfClient(clientId).filter((c) => c.ok).map((c) => weekKey(new Date(c.at))));
    const week = (offset: number) => { const d = new Date(); d.setDate(d.getDate() - offset * 7); return weekKey(d); };
    let current = 0;
    let start = weeks.has(week(0)) ? 0 : weeks.has(week(1)) ? 1 : -1;
    if (start >= 0) while (weeks.has(week(start + current))) current++;
    const sorted = [...weeks].sort();
    let longest = 0, run = 0, prev = '';
    for (const w of sorted) {
      const expected = prev ? isoDate(new Date(new Date(prev + 'T00:00:00').getTime() + 7 * 86400000)) : '';
      run = prev && w === expected ? run + 1 : 1; longest = Math.max(longest, run); prev = w;
    }
    return { current, longest: Math.max(longest, current) };
  }
  /** Badges and how close the member is to each. */
  badges(clientId: string) {
    const visits = this.checkInsOfClient(clientId).filter((c) => c.ok);
    const hour = (c: { at: string }) => new Date(c.at).getHours();
    const attended = this.bookingsOfClient(clientId).filter((b) => b.status === 'ATTENDED');
    const workouts = this.workoutsOf(clientId);
    const streak = this.visitStreak(clientId).longest;
    const prs = this.personalRecords(clientId).filter((p) => p.sessions > 1).length;
    const b = (key: string, title: string, description: string, icon: string, value: number, target: number) => ({ key, title, description, icon, value: Math.min(value, target), target, earned: value >= target });
    return [
      b('first-visit', 'First visit', 'Check in for the first time', 'door-open', visits.length, 1),
      b('visits-10', 'Regular', '10 visits', 'person-walking', visits.length, 10),
      b('visits-50', 'Committed', '50 visits', 'fire', visits.length, 50),
      b('early-bird', 'Early bird', '5 check-ins before 8:00', 'sun', visits.filter((c) => hour(c) < 8).length, 5),
      b('night-owl', 'Night owl', '5 check-ins after 20:00', 'moon', visits.filter((c) => hour(c) >= 20).length, 5),
      b('classes-10', 'Class regular', 'Attend 10 classes', 'calendar-check', attended.length, 10),
      b('first-workout', 'Logbook', 'Log your first workout', 'pen', workouts.length, 1),
      b('workouts-10', 'Grinder', 'Log 10 workouts', 'dumbbell', workouts.length, 10),
      b('records', 'Record breaker', 'Improve 3 exercises', 'medal', prs, 3),
      b('streak-4', 'On a roll', 'Come 4 weeks in a row', 'bolt', streak, 4),
      b('streak-12', 'Unstoppable', 'Come 12 weeks in a row', 'trophy', streak, 12),
      b('referral', 'Ambassador', 'Bring a friend', 'gift', this.referralsOf(clientId).length, 1),
    ];
  }
  challengesOfGym(gymId: string) { return this.challenges().filter((c) => c.gymId === gymId).sort((a, b) => b.start.localeCompare(a.start)); }
  /** Running and upcoming challenges at the member's gyms. */
  challengesFor(clientId: string) {
    const gyms = new Set(this.gymsOfClient(clientId).map((g) => g.id));
    return this.challenges().filter((c) => gyms.has(c.gymId) && c.end >= isoDate()).sort((a, b) => a.end.localeCompare(b.end));
  }
  challengeProgress(c: GymChallenge, clientId: string) {
    const inRange = (d: string) => d >= c.start && d <= c.end;
    return this.metricCount(c.metric, c.gymId, clientId, inRange);
  }
  private metricCount(metric: ChallengeMetric, gymId: string, clientId: string, inRange: (d: string) => boolean) {
    if (metric === 'VISITS') return this.checkIns().filter((x) => x.ok && x.gymId === gymId && x.clientId === clientId && inRange(x.at.slice(0, 10))).length;
    if (metric === 'CLASSES') return this.bookings().filter((x) => x.status === 'ATTENDED' && x.gymId === gymId && x.clientId === clientId && inRange(x.date)).length;
    return this.workouts().filter((x) => x.clientId === clientId && inRange(x.date)).length;
  }
  /** Members of the gym ranked by progress (ties: first to reach it). */
  leaderboard(c: GymChallenge) {
    return this.clientsOfGym(c.gymId).map((u) => ({ user: u, value: this.challengeProgress(c, u.id) })).filter((x) => x.value > 0).sort((a, b) => b.value - a.value);
  }
  saveChallenge(c: GymChallenge) {
    const isNew = !c.id;
    const saved = isNew ? { ...c, id: uid('ch') } : c;
    this.patch((s) => ({ challenges: isNew ? [...s.challenges, saved] : s.challenges.map((x) => (x.id === saved.id ? saved : x)) }));
    if (isNew) for (const m of this.clientsOfGym(c.gymId)) this.notify(m.id, 'New challenge', '{gym}: {title}', { gym: this.gym(c.gymId)?.name ?? '', title: c.title }, '/client/achievements', `ch-${saved.id}`);
    return saved;
  }
  deleteChallenge(id: string) { this.patch((s) => ({ challenges: s.challenges.filter((x) => x.id !== id) })); }

  // ---------- class reviews & favourites ----------
  classRating(classId: string) {
    const list = this.classReviews().filter((r) => r.classId === classId);
    return { avg: list.length ? Math.round((list.reduce((s, r) => s + r.rating, 0) / list.length) * 10) / 10 : 0, count: list.length };
  }
  /** Rating of every occurrence of a class series (same name at the same gym). */
  classSeriesRating(gymId: string, name: string) {
    const ids = new Set(this.classesOfGym(gymId).filter((c) => c.name === name).map((c) => c.id));
    const list = this.classReviews().filter((r) => ids.has(r.classId));
    return { avg: list.length ? Math.round((list.reduce((s, r) => s + r.rating, 0) / list.length) * 10) / 10 : 0, count: list.length };
  }
  myClassReview(classId: string, date: string, clientId: string) { return this.classReviews().find((r) => r.classId === classId && r.date === date && r.clientId === clientId); }
  /** Only members who attended can rate (once per occurrence; rating again replaces it). */
  reviewClass(classId: string, date: string, clientId: string, rating: number, comment?: string) {
    const attended = this.bookings().some((b) => b.classId === classId && b.date === date && b.clientId === clientId && b.status === 'ATTENDED');
    if (!attended) return false;
    const cls = this.gymClass(classId);
    const existing = this.myClassReview(classId, date, clientId);
    const r: ClassReview = { id: existing?.id ?? uid('cr'), classId, gymId: cls?.gymId ?? '', clientId, date, rating, ...(comment ? { comment } : {}), createdAt: new Date().toISOString() };
    this.patch((s) => ({ classReviews: existing ? s.classReviews.map((x) => (x.id === r.id ? r : x)) : [...s.classReviews, r] }));
    return true;
  }
  isFavoriteClass(userId: string, classId: string) { return !!this.user(userId)?.favoriteClasses?.includes(classId); }
  toggleFavoriteClass(userId: string, classId: string) {
    this.patch((s) => ({ users: s.users.map((u) => {
      if (u.id !== userId) return u;
      const fav = new Set(u.favoriteClasses ?? []);
      if (fav.has(classId)) fav.delete(classId); else fav.add(classId);
      return { ...u, favoriteClasses: [...fav] };
    }) }));
  }

  // ---------- freeze requests ----------
  freezeRequestsOf(gymId: string) { return this.freezeRequests().filter((r) => r.gymId === gymId).sort((a, b) => b.createdAt.localeCompare(a.createdAt)); }
  freezeRequestsOfClient(clientId: string) { return this.freezeRequests().filter((r) => r.clientId === clientId).sort((a, b) => b.createdAt.localeCompare(a.createdAt)); }
  requestFreeze(r: { membershipId: string; start: string; days: number; reason: string }) {
    const m = this.memberships().find((x) => x.id === r.membershipId);
    if (!m) return null;
    if (this.freezeRequests().some((x) => x.membershipId === m.id && x.status === 'PENDING')) return null;
    const req: FreezeRequest = { ...r, id: uid('fr'), gymId: m.gymId, clientId: m.clientId, status: 'PENDING', createdAt: new Date().toISOString() };
    this.patch((s) => ({ freezeRequests: [...s.freezeRequests, req] }));
    const gym = this.gym(m.gymId);
    if (gym) this.notify(gym.ownerId, 'Freeze request', '{name} asks to pause their membership for {days} days from {start}.', { name: this.fullName(m.clientId), days: r.days, start: r.start }, '/admin/clients');
    return req;
  }
  handleFreezeRequest(id: string, approve: boolean) {
    const r = this.freezeRequests().find((x) => x.id === id);
    if (!r || r.status !== 'PENDING') return;
    this.patch((s) => ({ freezeRequests: s.freezeRequests.map((x) => (x.id === id ? { ...x, status: approve ? 'APPROVED' as const : 'DECLINED' as const, handledAt: new Date().toISOString() } : x)) }));
    if (approve) this.freezeMembership(r.membershipId, r.start, r.days, r.reason);
    else this.notify(r.clientId, 'Freeze request declined', '{gym} could not pause your membership. Contact the front desk.', { gym: this.gym(r.gymId)?.name ?? '' }, '/client');
  }

  // ---------- family plans & passes ----------
  addFamilyMember(membershipId: string, clientId: string) {
    const m = this.memberships().find((x) => x.id === membershipId);
    const max = this.plan(m?.planId)?.familyMax ?? 0;
    if (!m || !max) return { ok: false as const, reason: 'This plan is not a family plan.' };
    const members = m.familyMembers ?? [];
    if (members.includes(clientId) || m.clientId === clientId) return { ok: false as const, reason: 'Already covered by this plan.' };
    if (members.length + 1 >= max) return { ok: false as const, reason: 'The family plan is full.' };
    this.patch((s) => ({ memberships: s.memberships.map((x) => (x.id === membershipId ? { ...x, familyMembers: [...members, clientId] } : x)) }));
    this.log('Family member added', `${this.fullName(clientId)} → ${this.fullName(m.clientId)}`, m.gymId);
    return { ok: true as const };
  }
  removeFamilyMember(membershipId: string, clientId: string) {
    this.patch((s) => ({ memberships: s.memberships.map((x) => (x.id === membershipId ? { ...x, familyMembers: (x.familyMembers ?? []).filter((c) => c !== clientId) } : x)) }));
  }
  /** Top up a pass with extra visits. */
  addCredits(membershipId: string, credits: number) {
    this.patch((s) => ({ memberships: s.memberships.map((x) => (x.id === membershipId ? { ...x, credits: (x.credits ?? 0) + credits } : x)) }));
  }
  /** Extend memberships by N days (bulk action). */
  extendMemberships(ids: string[], days: number) {
    const set = new Set(ids);
    this.patch((s) => ({ memberships: s.memberships.map((m) => (set.has(m.id) ? { ...m, endDate: new Date(new Date(m.endDate).getTime() + days * 86400000).toISOString() } : m)) }));
    this.log('Memberships extended', `${ids.length} × ${days} d`);
  }

  // ---------- waivers ----------
  saveWaiver(gymId: string, title: string, text: string) {
    const g = this.gym(gymId);
    if (!g) return;
    const changed = !g.waiver || g.waiver.text !== text || g.waiver.title !== title;
    if (!changed) return;
    const version = (g.waiver?.version ?? 0) + 1;
    this.updateGym({ ...g, waiver: { title, text, version, updatedAt: new Date().toISOString() } });
    this.log('Waiver updated', `${g.name} · v${version}`, gymId);
    for (const c of this.clientsOfGym(gymId)) this.notify(c.id, 'Please sign the waiver', '{gym} updated its waiver. Sign it before your next visit.', { gym: g.name }, '/client', `waiver-${gymId}-${version}`);
  }
  removeWaiver(gymId: string) { const g = this.gym(gymId); if (g) this.updateGym({ ...g, waiver: undefined }); }
  waiverSignature(gymId: string, clientId: string) {
    const v = this.gym(gymId)?.waiver?.version;
    return v ? this.waiverSignatures().find((w) => w.gymId === gymId && w.clientId === clientId && w.version === v) : undefined;
  }
  needsWaiver(gymId: string, clientId: string) { return !!this.gym(gymId)?.waiver && !this.waiverSignature(gymId, clientId); }
  signWaiver(gymId: string, clientId: string, name: string, signature: string) {
    const v = this.gym(gymId)?.waiver?.version;
    if (!v || !name.trim() || !signature) return null;
    const w: WaiverSignature = { id: uid('ws'), gymId, clientId, version: v, name: name.trim(), signature, signedAt: new Date().toISOString() };
    this.patch((s) => ({ waiverSignatures: [...s.waiverSignatures.filter((x) => !(x.gymId === gymId && x.clientId === clientId && x.version === v)), w] }));
    return w;
  }

  // ---------- equipment & lockers ----------
  equipmentOf(gymId: string) { return this.equipment().filter((e) => e.gymId === gymId).sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name)); }
  /** Next service date, if the item has an interval. */
  nextService(e: Equipment) {
    if (!e.serviceEveryDays) return undefined;
    const base = e.lastServiceAt ?? e.purchasedAt ?? isoDate();
    return isoDate(new Date(new Date(base + 'T00:00:00').getTime() + e.serviceEveryDays * 86400000));
  }
  /** OUT_OF_ORDER stays; otherwise SERVICE_DUE once the next service date is reached. */
  equipmentState(e: Equipment): Equipment['status'] {
    if (e.status === 'OUT_OF_ORDER') return e.status;
    const next = this.nextService(e);
    return next && next <= isoDate() ? 'SERVICE_DUE' : 'OK';
  }
  saveEquipment(e: Equipment) {
    const isNew = !e.id;
    const saved = isNew ? { ...e, id: uid('eq') } : e;
    this.patch((s) => ({ equipment: isNew ? [...s.equipment, saved] : s.equipment.map((x) => (x.id === saved.id ? saved : x)) }));
    return saved;
  }
  deleteEquipment(id: string) { this.patch((s) => ({ equipment: s.equipment.filter((x) => x.id !== id) })); }
  /** Record a service; its cost is booked as a maintenance expense of the gym. */
  serviceEquipment(id: string, note: string, cost?: number) {
    const e = this.equipment().find((x) => x.id === id);
    if (!e) return;
    const date = isoDate();
    this.patch((s) => ({ equipment: s.equipment.map((x) => (x.id === id ? { ...x, status: 'OK' as const, lastServiceAt: date, log: [{ date, note, ...(cost ? { cost } : {}) }, ...x.log] } : x)) }));
    if (cost) this.saveExpense({ id: '', owner: 'GYM', ownerId: e.gymId, date, category: 'MAINTENANCE', label: `${e.name} — ${note}`, amount: cost, currency: this.currencyOf(e.gymId), method: 'CARD' });
  }
  lockersOf(gymId: string) { return this.lockers().filter((l) => l.gymId === gymId).sort((a, b) => a.number.localeCompare(b.number, undefined, { numeric: true })); }
  assignLocker(id: string, clientId: string | undefined, until?: string) {
    this.patch((s) => ({ lockers: s.lockers.map((l) => (l.id === id ? { ...l, clientId, until: clientId ? until : undefined } : l)) }));
  }
  addLockers(gymId: string, prefix: string, count: number, locationId?: string) {
    const existing = new Set(this.lockersOf(gymId).map((l) => l.number));
    const added: Locker[] = [];
    for (let i = 1; added.length < count && i < 1000; i++) {
      const number = `${prefix}${String(i).padStart(2, '0')}`;
      if (!existing.has(number)) added.push({ id: uid('lk'), gymId, number, ...(locationId ? { locationId } : {}) });
    }
    this.patch((s) => ({ lockers: [...s.lockers, ...added] }));
    return added.length;
  }
  deleteLocker(id: string) { this.patch((s) => ({ lockers: s.lockers.filter((l) => l.id !== id) })); }
  lockerOf(gymId: string, clientId: string) { return this.lockersOf(gymId).find((l) => l.clientId === clientId); }

  // ---------- staff shifts ----------
  shiftsOf(gymId: string, from: string, to: string) { return this.shifts().filter((x) => x.gymId === gymId && x.date >= from && x.date <= to).sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start)); }
  shiftsOfUser(userId: string, from: string, to: string) { return this.shifts().filter((x) => x.userId === userId && x.date >= from && x.date <= to).sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start)); }
  saveShift(sh: StaffShift) {
    if (toMin(sh.end) <= toMin(sh.start)) return { ok: false as const, reason: 'The end must be after the start.' };
    const clash = this.shifts().find((x) => x.id !== sh.id && x.userId === sh.userId && x.date === sh.date && toMin(x.start) < toMin(sh.end) && toMin(sh.start) < toMin(x.end));
    if (clash) return { ok: false as const, reason: 'This person already works at that time.' };
    const isNew = !sh.id;
    const saved = isNew ? { ...sh, id: uid('sh') } : sh;
    this.patch((s) => ({ shifts: isNew ? [...s.shifts, saved] : s.shifts.map((x) => (x.id === saved.id ? saved : x)) }));
    return { ok: true as const, shift: saved };
  }
  deleteShift(id: string) { this.patch((s) => ({ shifts: s.shifts.filter((x) => x.id !== id) })); }
  /** Copy a week of shifts 7 days later (skipping ones that would clash). */
  copyShiftsWeek(gymId: string, weekStart: string) {
    const end = isoDate(new Date(new Date(weekStart + 'T00:00:00').getTime() + 6 * 86400000));
    let n = 0;
    for (const sh of this.shiftsOf(gymId, weekStart, end)) {
      const date = isoDate(new Date(new Date(sh.date + 'T00:00:00').getTime() + 7 * 86400000));
      if (this.saveShift({ ...sh, id: '', date }).ok) n++;
    }
    return n;
  }
  /** Hours planned per person in a period. */
  shiftHours(list: StaffShift[]) {
    const map = new Map<string, number>();
    for (const sh of list) map.set(sh.userId, (map.get(sh.userId) ?? 0) + (toMin(sh.end) - toMin(sh.start)) / 60);
    return map;
  }

  // ---------- plan modules ----------
  /** Does the gym's Liftly plan include this module? (plans without a list include everything) */
  hasModule(gymId: string | undefined, mod: GymModule) {
    const g = this.gym(gymId);
    const mods = this.saasPlan(g?.saasPlanId)?.modules;
    return !mods || mods.includes(mod);
  }
  /** Cheapest active plan that includes a module. */
  planWithModule(mod: GymModule) { return this.saasPlans().filter((p) => p.active && (!p.modules || p.modules.includes(mod))).sort((a, b) => a.monthlyPrice - b.monthlyPrice)[0]; }

  // ---------- coach library & templates ----------
  libraryOf(coachId: string) { return this.exercises().filter((e) => e.coachId === coachId).sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name)); }
  /** Library entry for an exercise name (any coach of the member's plan). */
  exerciseInfo(coachId: string, name: string) { const n = name.trim().toLowerCase(); return this.exercises().find((e) => e.coachId === coachId && e.name.toLowerCase() === n); }
  saveExercise(e: Exercise) {
    const isNew = !e.id;
    const saved = isNew ? { ...e, id: uid('ex') } : e;
    this.patch((s) => ({ exercises: isNew ? [...s.exercises, saved] : s.exercises.map((x) => (x.id === saved.id ? saved : x)) }));
    return saved;
  }
  deleteExercise(id: string) { this.patch((s) => ({ exercises: s.exercises.filter((x) => x.id !== id) })); }
  templatesOf(coachId: string) { return this.planTemplates().filter((p) => p.coachId === coachId).sort((a, b) => b.createdAt.localeCompare(a.createdAt)); }
  savePlanTemplate(t: PlanTemplate) {
    const isNew = !t.id;
    const saved: PlanTemplate = { ...t, id: t.id || uid('pt'), createdAt: t.createdAt || new Date().toISOString(), items: t.items.map((i) => ({ ...i, id: i.id || uid('it'), done: false })) };
    this.patch((s) => ({ planTemplates: isNew ? [...s.planTemplates, saved] : s.planTemplates.map((x) => (x.id === saved.id ? saved : x)) }));
    return saved;
  }
  deletePlanTemplate(id: string) { this.patch((s) => ({ planTemplates: s.planTemplates.filter((x) => x.id !== id) })); }
  /** Copy a template to athletes as their own plans (each is notified). */
  assignTemplate(templateId: string, clientIds: string[]) {
    const tpl = this.planTemplates().find((x) => x.id === templateId);
    if (!tpl) return 0;
    for (const clientId of clientIds) {
      this.savePlan({ id: '', coachId: tpl.coachId, clientId, kind: tpl.kind, title: tpl.title, notes: tpl.notes, items: tpl.items.map((i) => ({ ...i, id: '', done: false })), createdAt: '', updatedAt: '' });
    }
    return clientIds.length;
  }

  // ---------- coach days off ----------
  timeOffOf(coachId: string) { return this.timeOff().filter((x) => x.coachId === coachId).sort((a, b) => a.start.localeCompare(b.start)); }
  isOff(coachId: string, date: string) { return this.timeOff().some((x) => x.coachId === coachId && x.start <= date && date <= x.end); }
  /** Private sessions still planned inside a period. */
  sessionsInPeriod(coachId: string, start: string, end: string) { return this.sessions().filter((s) => s.coachId === coachId && s.date >= start && s.date <= end && (s.status === 'REQUESTED' || s.status === 'CONFIRMED')); }
  /** Add days off; optionally cancel the sessions inside them (members are notified). */
  addTimeOff(t: Omit<CoachTimeOff, 'id'>, cancelSessions: boolean) {
    if (t.end < t.start) return null;
    const off: CoachTimeOff = { ...t, id: uid('to') };
    this.patch((s) => ({ timeOff: [...s.timeOff, off] }));
    if (cancelSessions) for (const ses of this.sessionsInPeriod(t.coachId, t.start, t.end)) this.setSessionStatus(ses.id, 'CANCELLED', t.coachId);
    return off;
  }
  deleteTimeOff(id: string) { this.patch((s) => ({ timeOff: s.timeOff.filter((x) => x.id !== id) })); }

  // ---------- athlete notes ----------
  notesOf(coachId: string, clientId: string) { return this.athleteNotes().filter((n) => n.coachId === coachId && n.clientId === clientId).sort((a, b) => Number(!!b.pinned) - Number(!!a.pinned) || b.date.localeCompare(a.date)); }
  saveNote(n: AthleteNote) {
    const isNew = !n.id;
    const saved = isNew ? { ...n, id: uid('nt') } : n;
    this.patch((s) => ({ athleteNotes: isNew ? [...s.athleteNotes, saved] : s.athleteNotes.map((x) => (x.id === saved.id ? saved : x)) }));
    return saved;
  }
  deleteNote(id: string) { this.patch((s) => ({ athleteNotes: s.athleteNotes.filter((x) => x.id !== id) })); }

  // ---------- gym health (super-admin) ----------
  /** 0–100 score from activity, growth, retention, engagement and account state, with each factor explained. */
  gymHealth(gymId: string) {
    const g = this.gym(gymId)!;
    const now = Date.now(), day = 86400000;
    const iso = (ms: number) => new Date(ms).toISOString();
    const clamp = (v: number) => Math.max(0, Math.min(100, Math.round(v)));
    const ms = this.membershipsOfGym(gymId);
    const activeIds = new Set(ms.filter((m) => m.status === 'ACTIVE' && m.endDate >= iso(now)).map((m) => m.clientId));
    const everIds = new Set(ms.map((m) => m.clientId));
    const visits = this.checkInsOfGym(gymId).filter((c) => c.ok && c.at >= iso(now - 30 * day)).length;
    const perMember = activeIds.size ? visits / activeIds.size : 0;
    const firsts = new Map<string, string>();
    for (const m of ms) if (!firsts.has(m.clientId) || m.startDate < firsts.get(m.clientId)!) firsts.set(m.clientId, m.startDate);
    const newRecent = [...firsts.values()].filter((d) => d >= iso(now - 90 * day)).length;
    const newBefore = [...firsts.values()].filter((d) => d >= iso(now - 180 * day) && d < iso(now - 90 * day)).length;
    const bookings = this.bookings().filter((b) => b.gymId === gymId && b.createdAt >= iso(now - 30 * day) && b.status !== 'CANCELLED').length;
    const lastAdmin = this.audit().filter((a) => a.gymId === gymId && a.actorId === g.ownerId).sort((a, b) => b.at.localeCompare(a.at))[0]?.at;
    const idleDays = lastAdmin ? Math.floor((now - new Date(lastAdmin).getTime()) / day) : 999;
    let account = g.status === 'ACTIVE' ? 100 : g.status === 'TRIAL' ? (this.trialDaysLeft(g) <= 7 ? 40 : 60) : 0;
    if (idleDays > 14) account -= 30;
    const factors = [
      { key: 'activity', label: 'Activity', weight: 30, score: clamp((perMember / 8) * 100), detail: `${visits} check-ins / 30 d · ${perMember.toFixed(1)} per member` },
      { key: 'growth', label: 'Growth', weight: 20, score: clamp(newRecent === 0 ? 0 : newBefore === 0 ? 80 : (newRecent / newBefore) * 60), detail: `${newRecent} new members in 90 d (before: ${newBefore})` },
      { key: 'retention', label: 'Retention', weight: 20, score: clamp(everIds.size ? (activeIds.size / everIds.size) * 100 : 0), detail: `${activeIds.size} active of ${everIds.size} members ever` },
      { key: 'engagement', label: 'Engagement', weight: 15, score: clamp(activeIds.size ? (bookings / activeIds.size / 4) * 100 : 0), detail: `${bookings} class bookings / 30 d` },
      { key: 'account', label: 'Account', weight: 15, score: clamp(account), detail: `${g.status}${idleDays < 999 ? ` · admin active ${idleDays} d ago` : ' · no admin activity logged'}` },
    ];
    const score = Math.round(factors.reduce((s, f) => s + f.score * f.weight, 0) / 100);
    return { score, level: (score >= 65 ? 'HEALTHY' : score >= 40 ? 'WATCH' : 'AT_RISK') as 'HEALTHY' | 'WATCH' | 'AT_RISK', factors };
  }

  // ---------- platform announcements ----------
  postPlatformAnnouncement(a: Omit<PlatformAnnouncement, 'id' | 'at' | 'dismissedBy'>) {
    const ann: PlatformAnnouncement = { ...a, id: uid('pa'), at: new Date().toISOString(), dismissedBy: [] };
    this.patch((s) => ({ platformAnnouncements: [...s.platformAnnouncements, ann] }));
    const roles = a.audience === 'ADMINS' ? ['ADMIN'] : a.audience === 'STAFF' ? ['ADMIN', 'STAFF', 'COACH'] : ['ADMIN', 'STAFF', 'COACH', 'CLIENT'];
    let n = 0;
    for (const u of this.users().filter((x) => roles.includes(x.role) && x.active)) { if (this.notify(u.id, 'Liftly: {title}', a.body, { title: a.title }, undefined, `pa-${ann.id}`)) n++; }
    this.log('Platform announcement', a.title);
    return n;
  }
  deletePlatformAnnouncement(id: string) { this.patch((s) => ({ platformAnnouncements: s.platformAnnouncements.filter((x) => x.id !== id) })); }
  /** Banners a user should see now (not dismissed, not expired, audience matches). */
  platformBannersFor(userId: string) {
    const u = this.user(userId);
    if (!u) return [];
    const today = isoDate();
    const ok = (a: PlatformAnnouncement) => a.audience === 'EVERYONE' || (a.audience === 'ADMINS' ? u.role === 'ADMIN' : ['ADMIN', 'STAFF', 'COACH'].includes(u.role));
    return this.platformAnnouncements().filter((a) => ok(a) && !a.dismissedBy.includes(userId) && (!a.until || a.until >= today)).sort((a, b) => b.at.localeCompare(a.at));
  }
  dismissPlatformAnnouncement(id: string, userId: string) {
    this.patch((s) => ({ platformAnnouncements: s.platformAnnouncements.map((a) => (a.id === id ? { ...a, dismissedBy: [...a.dismissedBy, userId] } : a)) }));
  }

  // ---------- accounting currency ----------
  /** Currency of a country (its default currency, when that currency is enabled). */
  countryCurrency(code: string | undefined) {
    const c = this.countries().find((x) => x.code === code)?.currency;
    return c && this.currencySetting(c)?.active !== false ? c : undefined;
  }
  /**
   * Currency a user's accounting is shown in: the currency of their country, or — when no country is set —
   * their gym's currency (admin / staff), their rate currency (coach) or USD (super-admin).
   */
  accountingCurrency(userId: string | undefined): string {
    const u = this.user(userId);
    if (!u) return DEFAULT_CURRENCY;
    const fromCountry = this.countryCurrency(u.country);
    if (fromCountry) return fromCountry;
    if (u.role === 'ADMIN') return this.gymsOfAdmin(u.id)[0]?.currency ?? DEFAULT_CURRENCY;
    if (u.role === 'STAFF') return this.gymsOfStaff(u.id)[0]?.currency ?? DEFAULT_CURRENCY;
    if (u.role === 'COACH') return this.coachProfile(u.id)?.currency ?? DEFAULT_CURRENCY;
    return 'USD';
  }
  setUserCountry(userId: string, country: string) {
    this.patch((s) => ({ users: s.users.map((u) => (u.id === userId ? { ...u, country } : u)) }));
  }

  // ---------- expenses & ledgers ----------
  expensesOf(owner: ExpenseOwner, ownerId?: string) { return this.expenses().filter((e) => e.owner === owner && (owner === 'PLATFORM' || e.ownerId === ownerId)); }
  saveExpense(e: Expense) {
    const isNew = !e.id;
    const saved = isNew ? { ...e, id: uid('ex') } : e;
    this.patch((s) => ({ expenses: isNew ? [...s.expenses, saved] : s.expenses.map((x) => (x.id === saved.id ? saved : x)) }));
    if (e.owner !== 'COACH') this.log(isNew ? 'Expense recorded' : 'Expense edited', `${e.label} · ${formatMoney(e.amount, e.currency)}`, e.owner === 'GYM' ? e.ownerId : undefined);
    return saved;
  }
  deleteExpense(id: string) { this.patch((s) => ({ expenses: s.expenses.filter((x) => x.id !== id) })); }

  private expenseLines(owner: ExpenseOwner, ownerId: string | undefined, cur: string): LedgerLine[] {
    return this.expensesOf(owner, ownerId).map((e) => {
      const amount = this.convert(e.amount, e.currency, cur);
      return { id: e.id, date: e.date, type: 'EXPENSE', category: e.category, label: e.label, amount, vat: this.vatSplit(amount, e.vatRate ?? 0).vat, method: e.method, source: 'EXPENSE', expenseId: e.id, ...(e.currency !== cur ? { original: { amount: e.amount, currency: e.currency } } : {}) };
    });
  }
  /** Journal of a gym (gym currency): member payments in; expenses, coach pay and the Liftly subscription out. */
  gymLedger(gymId: string, currency?: string): LedgerLine[] {
    const g = this.gym(gymId);
    if (!g) return [];
    const cur = currency ?? g.currency, vat = this.vatRate(g.country);
    const lines: LedgerLine[] = this.payments().filter((p) => p.gymId === gymId).map((p) => {
      const amount = this.convert(p.amount, this.paymentCurrency(p), cur);
      return { id: p.id, date: p.date, type: 'INCOME', category: 'MEMBERSHIPS', label: p.note || t('Membership payment'), counterparty: this.fullName(p.clientId), amount, vat: this.vatSplit(amount, vat).vat, method: p.method, source: 'PAYMENT', ...(this.paymentCurrency(p) !== cur ? { original: { amount: p.amount, currency: this.paymentCurrency(p) } } : {}) };
    });
    lines.push(...this.expenseLines('GYM', gymId, cur));
    for (const p of this.payoutsOf({ gymId })) {
      lines.push({ id: p.id, date: p.date, type: 'EXPENSE', category: 'COACHES', label: t('Coach pay') + (p.period ? ` · ${p.period}` : ''), counterparty: this.fullName(p.coachId), amount: this.convert(p.amount, p.currency, cur), vat: 0, method: p.method, reference: p.reference, source: 'PAYOUT', payoutId: p.id });
    }
    for (const i of this.saasInvoices(gymId)) {
      const amount = this.convert(i.amount, i.currency, cur);
      lines.push({ id: i.number, date: i.date, type: 'EXPENSE', category: 'SOFTWARE', label: t('Liftly {plan} plan', { plan: i.plan }), counterparty: 'Liftly', amount, vat: this.vatSplit(amount, vat).vat, method: 'CARD', reference: i.number, source: 'INVOICE' });
    }
    return lines.sort((a, b) => b.date.localeCompare(a.date));
  }
  /** Journal of the platform (USD): subscription invoices of every gym in, platform expenses out. */
  platformLedger(cur = 'USD'): LedgerLine[] {
    const lines: LedgerLine[] = [];
    for (const g of this.gyms()) {
      const rate = this.vatRate(g.country);
      for (const i of this.saasInvoices(g.id)) {
        const amount = this.convert(i.amount, i.currency, cur);
        lines.push({ id: `${g.id}-${i.number}`, date: i.date, type: 'INCOME', category: 'SUBSCRIPTIONS', label: t('Liftly {plan} plan', { plan: i.plan }), counterparty: g.name, country: g.country, amount, vat: this.vatSplit(amount, rate).vat, method: 'CARD', reference: i.number, source: 'INVOICE', ...(i.currency !== cur ? { original: { amount: i.amount, currency: i.currency } } : {}) });
      }
    }
    lines.push(...this.expenseLines('PLATFORM', undefined, cur));
    return lines.sort((a, b) => b.date.localeCompare(a.date));
  }
  /** Journal of a coach (coach currency): gym pay and paid private sessions in, own expenses out. */
  coachLedger(coachId: string, currency?: string): LedgerLine[] {
    const cur = currency ?? this.coachProfile(coachId)?.currency ?? DEFAULT_CURRENCY;
    const lines: LedgerLine[] = this.payoutsOf({ coachId }).map((p) => ({
      id: p.id, date: p.date, type: 'INCOME' as const, category: 'GYM_PAY', label: t('Classes') + (p.period ? ` · ${p.period}` : ''), counterparty: this.gym(p.gymId)?.name, amount: this.convert(p.amount, p.currency, cur), vat: 0, method: p.method, reference: p.reference, source: 'PAYOUT' as const,
      ...(p.currency !== cur ? { original: { amount: p.amount, currency: p.currency } } : {}),
    }));
    for (const s of this.sessions()) {
      if (s.coachId !== coachId || !s.paid) continue;
      lines.push({ id: s.id, date: s.paid.at.slice(0, 10), type: 'INCOME', category: 'PRIVATE', label: t('Private session') + ` · ${s.date}`, counterparty: this.fullName(s.clientId), amount: this.convert(s.price, s.currency, cur), vat: 0, method: s.paid.method, reference: s.paid.reference, source: 'SESSION', ...(s.currency !== cur ? { original: { amount: s.price, currency: s.currency } } : {}) });
    }
    lines.push(...this.expenseLines('COACH', coachId, cur));
    return lines.sort((a, b) => b.date.localeCompare(a.date));
  }
}

/** One line of an accounting journal, already converted to the journal currency. */
export interface LedgerLine {
  id: string;
  date: string; // YYYY-MM-DD
  type: 'INCOME' | 'EXPENSE';
  /** Category key (English, translated for display). */
  category: string;
  label: string;
  counterparty?: string;
  country?: string;
  amount: number;
  /** VAT included in the amount. */
  vat: number;
  method?: string;
  reference?: string;
  original?: { amount: number; currency: string };
  source: 'PAYMENT' | 'EXPENSE' | 'PAYOUT' | 'INVOICE' | 'SESSION';
  expenseId?: string;
  payoutId?: string;
}
