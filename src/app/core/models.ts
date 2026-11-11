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
}

export type BillingCycle = 'MONTHLY' | 'YEARLY';
export type GymStatus = 'ACTIVE' | 'TRIAL' | 'SUSPENDED';

export interface GymTheme {
  primary: string; // hex
  logoText: string;
  logoUrl?: string;
}

export interface Gym {
  id: string;
  ownerId: string; // ADMIN user
  name: string;
  sports: string[];
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
  startDate: string;
  endDate: string;
  status: MembershipStatus;
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
  sport?: string; // undefined = whole gym / all sports
  note?: string;
}

/** One-off closure (holiday, maintenance…). */
export interface ScheduleClosure {
  id: string;
  gymId: string;
  date: string; // 'YYYY-MM-DD'
  reason: string;
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
}
