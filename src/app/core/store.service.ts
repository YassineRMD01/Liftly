import { t } from './i18n/i18n';
import { Injectable, computed, effect, signal } from '@angular/core';
import {
  AppNotification, BillingCycle, CheckIn, ClassBooking, ClientMembership, ClientStatus, GymClass, CoachProfile, CoachReport, CoachReview, Country, CurrencySetting, DbState, Gender, Gym, GymReview,
  MembershipPlan, Payment, PlatformSettings, PromoCode, SaasPlan, ScheduleClosure, ScheduleSlot, Sport, User,
} from './models';
import { canAttend, isoDate, openStatus, toMin } from './schedule';
import { DEFAULT_CURRENCY, countryName, currencyName, formatMoney, formatTotals } from './currency';
import { SEED } from './seed';

const STORAGE_KEY = 'liftly-db-v11';

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
  membershipsOfClient(clientId: string) { return this.memberships().filter((m) => m.clientId === clientId); }
  clientsOfGym(gymId: string) {
    const ids = new Set(this.membershipsOfGym(gymId).map((m) => m.clientId));
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
  addUser(u: Omit<User, 'id' | 'createdAt' | 'active'>): User {
    const user: User = { ...u, id: uid('u'), createdAt: new Date().toISOString(), active: true };
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
    return gym;
  }
  updateGym(g: Gym) { this.patch((s) => ({ gyms: s.gyms.map((x) => (x.id === g.id ? g : x)) })); }

  // ---------- gym <-> coach ----------
  linkCoach(gymId: string, coachId: string) {
    if (this.gymCoaches().some((l) => l.gymId === gymId && l.coachId === coachId)) return;
    this.patch((s) => ({ gymCoaches: [...s.gymCoaches, { gymId, coachId, since: new Date().toISOString() }] }));
  }
  unlinkCoach(gymId: string, coachId: string) {
    this.patch((s) => ({ gymCoaches: s.gymCoaches.filter((l) => !(l.gymId === gymId && l.coachId === coachId)) }));
  }

  // ---------- membership plans ----------
  saveMembershipPlan(p: MembershipPlan) {
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
    };
    const payment: Payment = { id: uid('p'), gymId: m.gymId, clientId: m.clientId, date: m.startDate.slice(0, 10), amount: m.pricePaid, currency: m.currency, method: 'CASH', note: plan.name };
    this.patch((s) => ({
      memberships: [...s.memberships, m],
      payments: m.pricePaid > 0 ? [...s.payments, payment] : s.payments,
      promoCodes: check?.ok
        ? s.promoCodes.map((p) => (p.id === check.promo!.id ? { ...p, uses: p.uses + 1 } : p))
        : s.promoCodes,
    }));
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
    this.patch((s) => ({ countries: s.countries.some((x) => x.code === c.code) ? s.countries.map((x) => (x.code === c.code ? c : x)) : [...s.countries, c] }));
  }
  deleteCountry(code: string) { this.patch((s) => ({ countries: s.countries.filter((c) => c.code !== code) })); }
  currencySetting(code: string | undefined) { return this.currencies().find((c) => c.code === code); }
  saveCurrency(c: CurrencySetting) {
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
    const active = this.memberships().filter((m) => m.gymId === gymId && m.clientId === clientId && m.status === 'ACTIVE' && m.startDate <= now && m.endDate >= now);
    if (!active.length) return 'EXPIRED';
    return active.every((m) => this.frozenToday(m)) ? 'FROZEN' : 'ACTIVE';
  }
  /** Is today inside one of the membership's freezes? */
  frozenToday(m: ClientMembership) {
    const today = isoDate();
    return (m.freezes ?? []).some((f) => f.start <= today && today <= f.end);
  }
  /** Pause a membership for `days` days from `start`: the end date moves back by the same length. */
  freezeMembership(id: string, start: string, days: number, reason: string) {
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
    if (this.isBanned(gymId, clientId)) return;
    this.patch((s) => ({
      bans: [...s.bans, { gymId, clientId, reason, date: new Date().toISOString() }],
      memberships: s.memberships.map((m) => (m.gymId === gymId && m.clientId === clientId && m.status === 'ACTIVE' ? { ...m, status: 'CANCELLED' as const } : m)),
    }));
  }
  unbanClient(gymId: string, clientId: string) {
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
  checkIn(gymId: string, clientId: string, method: CheckIn['method'], staffId?: string): CheckIn {
    const user = this.user(clientId);
    let ok = true;
    let reason: string | undefined;
    if (!user || user.role !== 'CLIENT') { ok = false; reason = 'Unknown member'; }
    else {
      const status = this.clientStatus(gymId, clientId);
      if (status === 'BANNED') { ok = false; reason = 'Banned from this gym'; }
      else if (status === 'FROZEN') { ok = false; reason = 'Membership frozen'; }
      else if (status === 'EXPIRED') { ok = false; reason = 'No active membership'; }
      else if (!this.gymOpenStatus(gymId, user.gender).open) reason = 'Outside the sessions open to this member';
    }
    const entry: CheckIn = { id: uid('ci'), gymId, clientId, at: new Date().toISOString(), method, ok, ...(reason ? { reason } : {}), ...(staffId ? { staffId } : {}) };
    const today = isoDate();
    this.patch((s) => ({
      checkIns: [...s.checkIns, entry],
      bookings: ok ? s.bookings.map((b) => (b.gymId === gymId && b.clientId === clientId && b.date === today && b.status === 'BOOKED' ? { ...b, status: 'ATTENDED' as const } : b)) : s.bookings,
    }));
    return entry;
  }

  // ---------- notifications ----------
  notificationsOf(userId: string) { return this.notifications().filter((n) => n.userId === userId).sort((a, b) => b.createdAt.localeCompare(a.createdAt)); }
  /** Send an in-app notification (title/body are English keys translated for the reader). Skipped if `key` was already sent. */
  notify(userId: string, title: string, body: string, params?: Record<string, string | number>, link?: string, key?: string) {
    if (key && this.notifications().some((n) => n.key === key && n.userId === userId)) return false;
    const n: AppNotification = { id: uid('n'), userId, title, body, ...(params ? { params } : {}), ...(link ? { link } : {}), read: false, createdAt: new Date().toISOString(), ...(key ? { key } : {}) };
    this.patch((s) => ({ notifications: [...s.notifications, n] }));
    return true;
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
}
