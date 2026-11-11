import { t } from './i18n/i18n';
import { Injectable, computed, effect, signal } from '@angular/core';
import {
  ClientMembership, CoachProfile, CoachReview, DbState, Gender, Gym, MembershipPlan, Payment, PromoCode, SaasPlan, ScheduleClosure, ScheduleSlot, User,
} from './models';
import { openStatus } from './schedule';
import { DEFAULT_CURRENCY, formatMoney, formatTotals } from './currency';
import { SEED } from './seed';

const STORAGE_KEY = 'liftly-db-v7';

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
        db.gyms = db.gyms.map((g) => ({ ...g, sports: g.sports ?? [(g as unknown as { sport?: string }).sport ?? 'Fitness'], currency: g.currency ?? DEFAULT_CURRENCY }));
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
  subscribeClient(input: { gymId: string; clientId: string; planId: string; coachId?: string; promoCode?: string }): ClientMembership {
    const plan = this.plan(input.planId)!;
    const check = input.promoCode ? this.checkPromo(input.gymId, input.planId, input.promoCode) : undefined;
    const start = new Date();
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
}
