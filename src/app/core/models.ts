export type Role = 'SUPER_ADMIN' | 'ADMIN' | 'COACH' | 'CLIENT';
export type Gender = 'MALE' | 'FEMALE';

export interface User {
  id: string;
  role: Role;
  firstName: string;
  lastName: string;
  email: string;
  password: string; // demo only — never store plain passwords in a real app
  phone?: string;
  avatarUrl?: string;
  gender?: Gender;
  createdAt: string;
  active: boolean;
}

export interface CoachProfile {
  userId: string;
  bio: string;
  specialties: string[];
  yearsExperience: number;
  hourlyRate: number;
  /** Currency of the hourly rate (ISO 4217) — a coach may work at gyms using different currencies. */
  currency: string;
}

/** Pricing plans of the SaaS itself (what gym admins pay). Managed by super-admin. */
export interface SaasPlan {
  id: string;
  name: string;
  description: string;
  monthlyPrice: number;
  yearlyPrice: number;
  maxCoaches: number; // -1 = unlimited
  maxClients: number; // -1 = unlimited
  features: string[];
  customTheme: boolean;
  highlighted: boolean;
  active: boolean;
  /** Local prices per country, in that country's currency. Countries without one pay the USD price. */
  countryPrices: CountryPrice[];
}

export interface CountryPrice {
  country: string; // ISO 3166 alpha-2, e.g. 'MA'
  monthly: number;
  yearly: number;
}

/** A country gyms can sign up from, with its default currency. Managed by super-admin. */
export interface Country {
  code: string; // ISO 3166 alpha-2
  currency: string; // ISO 4217
  active: boolean;
}

/** A currency the platform supports. Managed by super-admin. */
export interface CurrencySetting {
  code: string; // ISO 4217
  /** Value of 1 unit in USD — used to compare / sum amounts across currencies in statistics. */
  rateToUsd: number;
  active: boolean;
}

/** A sport or activity. Catalog sports (no gymId) are shared; gyms can also create their own. */
export interface Sport {
  id: string;
  name: string; // catalog names are English and translated for display; custom names are shown as typed
  icon: string; // Font Awesome icon name
  gymId?: string;
}

/** Platform-wide settings managed by the super-admin. */
export interface PlatformSettings {
  /** Theme of the public site (home, pricing, login) and of users outside a gym context. */
  theme: GymTheme;
  defaultCountry: string;
}

export type BillingCycle = 'MONTHLY' | 'YEARLY';
export type GymStatus = 'ACTIVE' | 'TRIAL' | 'SUSPENDED';

/** Light / dark: follow the visitor's system setting, or force one. */
export type Appearance = 'system' | 'light' | 'dark';

export interface GymTheme {
  primary: string; // hex
  logoText: string;
  /** Uploaded logo (resized data URL). Falls back to logoText initials. */
  logoUrl?: string;
  /** Default light/dark mode of this theme (system when unset). Users can override it for themselves. */
  appearance?: Appearance;
}

export interface Gym {
  id: string;
  ownerId: string; // ADMIN user
  name: string;
  sportIds: string[];
  /** ISO 3166 alpha-2 — drives the price of the gym's Liftly subscription. */
  country: string;
  /** ISO 4217 code the gym prices memberships, promo codes and payments in. */
  currency: string;
  city: string;
  address: string;
  description: string;
  coverUrl?: string;
  theme: GymTheme;
  saasPlanId: string;
  billingCycle: BillingCycle;
  status: GymStatus;
  subscribedAt: string;
  renewsAt: string;
}

/** Many-to-many: a coach works at many gyms, a gym has many coaches. */
export interface GymCoach {
  gymId: string;
  coachId: string;
  since: string;
}

/** Plans a gym sells to its clients. Managed by the gym admin. */
export interface MembershipPlan {
  id: string;
  gymId: string;
  name: string;
  description: string;
  price: number;
  durationDays: number;
  sessionsPerWeek: number; // -1 = unlimited
  includesCoaching: boolean;
  active: boolean;
  /** Currency of this plan's price (ISO 4217). Defaults to the gym currency. */
  currency?: string;
}

export type DiscountType = 'PERCENT' | 'FIXED';

export interface PromoCode {
  id: string;
  gymId: string;
  code: string;
  discountType: DiscountType;
  value: number;
  validFrom: string;
  validUntil: string;
  maxUses: number; // -1 = unlimited
  uses: number;
  planIds: string[]; // empty = all plans
  active: boolean;
}

export type MembershipStatus = 'ACTIVE' | 'EXPIRED' | 'CANCELLED';

/** Many-to-many link between clients and gyms, carrying the subscription. */
export interface ClientMembership {
  id: string;
  gymId: string;
  clientId: string;
  planId: string;
  coachId?: string;
  promoCodeId?: string;
  pricePaid: number;
  /** Currency of pricePaid (the plan's currency at subscription time). */
  currency?: string;
  startDate: string;
  endDate: string;
  status: MembershipStatus;
}

/** Status of a client at one gym, derived from memberships and bans. */
export type ClientStatus = 'ACTIVE' | 'EXPIRED' | 'BANNED';

/** A gym admin banning a client from their gym. */
export interface ClientBan {
  gymId: string;
  clientId: string;
  reason: string;
  date: string;
}

export type ReportCategory = 'HARASSMENT' | 'INAPPROPRIATE_LANGUAGE' | 'UNSAFE_TRAINING' | 'DISCRIMINATION' | 'UNPROFESSIONAL' | 'OTHER';
export type ReportStatus = 'OPEN' | 'RESOLVED' | 'DISMISSED';

/** A client reporting a coach's behavior. Reviewed by the gym admin and the super-admin. */
export interface CoachReport {
  id: string;
  gymId: string;
  coachId: string;
  clientId: string;
  category: ReportCategory;
  description: string;
  status: ReportStatus;
  createdAt: string;
  resolutionNote?: string;
  handledAt?: string;
}

/** A client's rating of a gym (one per client and gym). */
export interface GymReview {
  id: string;
  gymId: string;
  clientId: string;
  rating: number; // 1..5
  comment: string;
  createdAt: string;
}

export interface CoachReview {
  id: string;
  coachId: string;
  clientId: string;
  gymId: string;
  rating: number; // 1..5
  comment: string;
  createdAt: string;
}

/** Who may attend during a time slot. */
export type Audience = 'MIXED' | 'MEN' | 'WOMEN';

/** Recurring weekly opening slot. day uses JS Date.getDay(): 0 = Sunday … 6 = Saturday. */
export interface ScheduleSlot {
  id: string;
  gymId: string;
  day: number;
  open: string; // 'HH:mm'
  close: string; // 'HH:mm', must be after open (use 23:59 for midnight)
  audience: Audience;
  sportId?: string; // undefined = whole gym / all sports
  note?: string;
}

/** One-off closure (holiday, maintenance…). */
export interface ScheduleClosure {
  id: string;
  gymId: string;
  date: string; // 'YYYY-MM-DD'
  reason: string;
}

export type PaymentMethod = 'CASH' | 'CARD' | 'TRANSFER';

/** A payment received from a client by a gym, recorded on a calendar day. */
export interface Payment {
  id: string;
  gymId: string;
  clientId: string;
  date: string; // 'YYYY-MM-DD'
  amount: number;
  method: PaymentMethod;
  note?: string;
  /** Currency of the amount. Defaults to the gym currency. */
  currency?: string;
}

export interface DbState {
  users: User[];
  coachProfiles: CoachProfile[];
  saasPlans: SaasPlan[];
  gyms: Gym[];
  gymCoaches: GymCoach[];
  membershipPlans: MembershipPlan[];
  promoCodes: PromoCode[];
  memberships: ClientMembership[];
  reviews: CoachReview[];
  schedule: ScheduleSlot[];
  closures: ScheduleClosure[];
  payments: Payment[];
  sports: Sport[];
  countries: Country[];
  currencies: CurrencySetting[];
  platform: PlatformSettings;
  bans: ClientBan[];
  reports: CoachReport[];
  gymReviews: GymReview[];
}
