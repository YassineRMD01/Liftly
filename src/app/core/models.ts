export type Role = 'SUPER_ADMIN' | 'ADMIN' | 'COACH' | 'CLIENT' | 'STAFF';
export type Gender = 'MALE' | 'FEMALE';

export interface User {
  id: string;
  /** notification categories the user muted */
  notifyOff?: NotifyCategory[];
  role: Role;
  firstName: string;
  lastName: string;
  email: string;
  password: string; // demo only — never store plain passwords in a real app
  phone?: string;
  avatarUrl?: string;
  gender?: Gender;
  /** ISO 3166 alpha-2 — sets the currency the user's accounting is shown in. */
  country?: string;
  /** Classes (GymClass ids) the member starred. */
  favoriteClasses?: string[];
  createdAt: string;
  active: boolean;
  /** Pending invitation: the account is activated from a link and the user picks a password. */
  invite?: { token: string; expiresAt: string };
  /** Member who referred this user (referral program). */
  referredBy?: string;
}

export interface CoachProfile {
  userId: string;
  bio: string;
  specialties: string[];
  yearsExperience: number;
  hourlyRate: number;
  /** Currency of the hourly rate (ISO 4217) — a coach may work at gyms using different currencies. */
  currency: string;
  /** How the coach prefers to be paid by gyms. */
  payoutMethod?: PayoutMethod;
  /** Bank details for transfers (shown to the gyms that pay the coach). */
  bank?: BankDetails;
}

export type PayoutMethod = 'CASH' | 'TRANSFER';

export interface BankDetails {
  holder: string;
  bankName: string;
  iban: string;
  swift?: string;
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
  /** App modules included (all when not set). */
  modules?: GymModule[];
}

export type GymModule = 'CLASSES' | 'CHECKIN' | 'KIOSK' | 'ACCOUNTING' | 'WAIVERS' | 'EQUIPMENT' | 'SHIFTS' | 'CHALLENGES' | 'IMPORT' | 'LOCATIONS';

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
  /** VAT / sales tax rate in %, shown on receipts and invoices (prices include it). */
  vatRate?: number;
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
  /**
   * Secondary (surface) color: tints backgrounds, cards, borders and muted text.
   * One base color per mode — the light one is used in light mode, the dark one in dark mode.
   */
  surface?: { light: string; dark: string };
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
  /** Branches of the gym. Empty = a single site at `address`. */
  locations?: GymLocation[];
  /** Listed in the public gym directory. */
  published?: boolean;
  /** What members get for bringing a friend (shown on their referral card). */
  referralReward?: string;
  /** Liability waiver members sign in the app (a new version asks everyone to sign again). */
  waiver?: { title: string; text: string; version: number; updatedAt: string };
}

/** A member's signature of a gym waiver version. */
export interface WaiverSignature {
  id: string;
  gymId: string;
  clientId: string;
  version: number;
  /** Name typed by the member. */
  name: string;
  /** Drawn signature (PNG data URL). */
  signature: string;
  signedAt: string;
}

export type EquipmentStatus = 'OK' | 'SERVICE_DUE' | 'OUT_OF_ORDER';
export interface Equipment {
  id: string;
  gymId: string;
  name: string;
  category: string;
  locationId?: string;
  status: EquipmentStatus;
  purchasedAt?: string;
  /** Service interval in days (a reminder shows when it is due). */
  serviceEveryDays?: number;
  lastServiceAt?: string;
  notes?: string;
  log: { date: string; note: string; cost?: number }[];
}

export interface Locker {
  id: string;
  gymId: string;
  number: string;
  locationId?: string;
  clientId?: string;
  /** Rented until (YYYY-MM-DD). */
  until?: string;
}

/** A front-desk / staff work shift. */
export interface StaffShift {
  id: string;
  gymId: string;
  userId: string;
  date: string; // YYYY-MM-DD
  start: string;
  end: string;
  locationId?: string;
  note?: string;
}

/** A branch / site of a gym. */
export interface GymLocation {
  id: string;
  name: string;
  address: string;
  city: string;
}

export type JoinRequestStatus = 'NEW' | 'CONTACTED' | 'CONVERTED' | 'DECLINED';

/** Someone asking to join a gym from its public page. */
export interface JoinRequest {
  id: string;
  gymId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  planId?: string;
  message?: string;
  /** Referral code typed in or carried by the link. */
  ref?: string;
  status: JoinRequestStatus;
  createdAt: string;
  clientId?: string;
}

/** One entry of the platform activity log (super-admin). */
export interface AuditEntry {
  id: string;
  at: string;
  actorId?: string;
  action: string;
  gymId?: string;
  /** Short human summary (who / what). */
  target?: string;
}

/** Many-to-many: a coach works at many gyms, a gym has many coaches. */
export interface GymCoach {
  gymId: string;
  coachId: string;
  since: string;
  /** What the gym pays the coach for each class taught (gym currency). */
  classRate?: number;
  /** Classes are counted towards the coach's balance from this date (YYYY-MM-DD). */
  ratesFrom?: string;
}

export type ExpenseOwner = 'PLATFORM' | 'GYM' | 'COACH';
export type ExpenseCategory = 'RENT' | 'SALARIES' | 'EQUIPMENT' | 'UTILITIES' | 'MARKETING' | 'MAINTENANCE' | 'SOFTWARE' | 'HOSTING' | 'TAXES' | 'TRAVEL' | 'FEES' | 'OTHER';

/** A cost recorded by the platform, a gym or a coach. */
export interface Expense {
  id: string;
  owner: ExpenseOwner;
  /** Gym id or coach user id (none for the platform). */
  ownerId?: string;
  date: string; // YYYY-MM-DD
  category: ExpenseCategory;
  label: string;
  amount: number;
  currency: string;
  method?: PaymentMethod;
  /** Share of VAT included in the amount, in % (deductible). */
  vatRate?: number;
}

/** Money a gym pays a coach (for classes taught), in cash or by bank transfer. */
export interface CoachPayout {
  id: string;
  gymId: string;
  coachId: string;
  date: string; // YYYY-MM-DD
  amount: number;
  currency: string;
  method: PayoutMethod;
  /** Bank transfer reference or receipt number. */
  reference?: string;
  /** Month the payout settles (YYYY-MM). */
  period?: string;
  note?: string;
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
  /** TIME = unlimited for the duration (default), PACK = N visits, DROPIN = a single visit. */
  kind?: PlanKind;
  /** Visits included in a PACK. */
  credits?: number;
  /** Family plan: how many people (holder included) it covers. */
  familyMax?: number;
}

export type PlanKind = 'TIME' | 'PACK' | 'DROPIN';

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
  /** Pauses (illness, travel…); each one pushes endDate back by its length. */
  freezes?: MembershipFreeze[];
  /** Visits left on a pack / drop-in (one is used at each check-in). */
  credits?: number;
  /** Other members covered by a family plan. */
  familyMembers?: string[];
}

export interface MembershipFreeze {
  start: string; // YYYY-MM-DD
  end: string; // YYYY-MM-DD (inclusive)
  reason: string;
}

/** Receptionist / front-desk staff of a gym (limited permissions). */
export interface GymStaff {
  gymId: string;
  userId: string;
  since: string;
}

export type ClassLevel = 'ALL' | 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED';

/** A recurring weekly class members can book. */
export interface GymClass {
  id: string;
  gymId: string;
  name: string;
  sportId?: string;
  coachId?: string;
  day: number; // getDay(): 0 = Sunday
  start: string; // HH:mm
  end: string; // HH:mm
  capacity: number;
  audience: Audience;
  level: ClassLevel;
  room?: string;
  locationId?: string;
  active: boolean;
}

export type BookingStatus = 'BOOKED' | 'WAITLIST' | 'CANCELLED' | 'ATTENDED' | 'NO_SHOW';

/** A member's place in one occurrence (date) of a class. Waitlist order = createdAt. */
export interface ClassBooking {
  id: string;
  classId: string;
  gymId: string;
  clientId: string;
  date: string; // YYYY-MM-DD
  status: BookingStatus;
  createdAt: string;
}

export interface CheckIn {
  id: string;
  gymId: string;
  clientId: string;
  at: string;
  method: 'QR' | 'MANUAL';
  ok: boolean;
  /** Why it was refused, or a warning (English key, translated for display). */
  reason?: string;
  staffId?: string;
  locationId?: string;
  /** recorded while offline, sent when the connection is back */
  queued?: boolean;
}

/** In-app notification. Title/body are English keys translated for the reader, with params. */
export interface AppNotification {
  id: string;
  userId: string;
  title: string;
  body: string;
  params?: Record<string, string | number>;
  link?: string;
  read: boolean;
  createdAt: string;
  /** De-duplication key (e.g. one renewal reminder per membership). */
  key?: string;
}

/** Weekly window in which a coach takes private sessions at a gym. */
export interface CoachAvailability {
  id: string;
  coachId: string;
  gymId: string;
  day: number; // getDay(): 0 = Sunday
  start: string; // HH:mm
  end: string; // HH:mm
  /** Length of one session in minutes. */
  slotMin: number;
}

export type SessionStatus = 'REQUESTED' | 'CONFIRMED' | 'DECLINED' | 'CANCELLED' | 'DONE';

/** A one-to-one session requested by a member with a coach. */
export interface PrivateSession {
  id: string;
  coachId: string;
  clientId: string;
  gymId: string;
  date: string; // YYYY-MM-DD
  start: string;
  end: string;
  status: SessionStatus;
  note?: string;
  price: number;
  currency: string;
  createdAt: string;
  /** The member paid the coach, and how. */
  paid?: { method: PayoutMethod; at: string; reference?: string };
}

export type TrainingPlanKind = 'WORKOUT' | 'NUTRITION';

/** One line of a plan: an exercise (sets/reps in detail) or a meal. */
export interface TrainingPlanItem {
  id: string;
  /** Group heading, e.g. "Day 1" or "Breakfast". */
  group: string;
  name: string;
  detail?: string;
  done?: boolean;
}

/** A workout or nutrition plan a coach writes for one of their members. */
export interface TrainingPlan {
  id: string;
  coachId: string;
  clientId: string;
  kind: TrainingPlanKind;
  title: string;
  notes?: string;
  items: TrainingPlanItem[];
  createdAt: string;
  updatedAt: string;
}

/** A body measurement logged by the member or their coach. */
export interface ProgressEntry {
  id: string;
  clientId: string;
  date: string; // YYYY-MM-DD
  weight?: number; // kg
  bodyFat?: number; // %
  waist?: number; // cm
  note?: string;
  /** Small progress photo (data URL, resized in the browser). */
  photoUrl?: string;
  byId: string;
}

/** Direct message between two users. */
export interface ChatMessage {
  id: string;
  fromId: string;
  toId: string;
  body: string;
  at: string;
  read: boolean;
}

/** A gym-wide announcement from the admin to members, coaches and staff. */
export interface Announcement {
  id: string;
  gymId: string;
  authorId: string;
  title: string;
  body: string;
  at: string;
  pinned?: boolean;
}

/** Status of a client at one gym, derived from memberships and bans. */
export type ClientStatus = 'ACTIVE' | 'FROZEN' | 'EXPIRED' | 'BANNED';

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
  staff: GymStaff[];
  classes: GymClass[];
  bookings: ClassBooking[];
  checkIns: CheckIn[];
  notifications: AppNotification[];
  availability: CoachAvailability[];
  sessions: PrivateSession[];
  plans: TrainingPlan[];
  progress: ProgressEntry[];
  messages: ChatMessage[];
  announcements: Announcement[];
  joinRequests: JoinRequest[];
  audit: AuditEntry[];
  expenses: Expense[];
  coachPayouts: CoachPayout[];
  workouts: WorkoutLog[];
  challenges: GymChallenge[];
  classReviews: ClassReview[];
  freezeRequests: FreezeRequest[];
  waiverSignatures: WaiverSignature[];
  equipment: Equipment[];
  lockers: Locker[];
  shifts: StaffShift[];
  exercises: Exercise[];
  planTemplates: PlanTemplate[];
  timeOff: CoachTimeOff[];
  athleteNotes: AthleteNote[];
  platformAnnouncements: PlatformAnnouncement[];
}

/** An exercise in a coach's library (reused in plans; members see the video link). */
export interface Exercise {
  id: string;
  coachId: string;
  name: string;
  category: string;
  equipment?: string;
  videoUrl?: string;
  /** Coaching cues shown to members. */
  cues?: string;
}
/** A reusable workout / nutrition plan a coach assigns to several athletes. */
export interface PlanTemplate {
  id: string;
  coachId: string;
  kind: TrainingPlanKind;
  title: string;
  notes?: string;
  items: TrainingPlanItem[];
  createdAt: string;
}
/** Days a coach is away (no private lessons can be booked). */
export interface CoachTimeOff {
  id: string;
  coachId: string;
  start: string; // YYYY-MM-DD
  end: string; // YYYY-MM-DD
  reason?: string;
}
/** A private note a coach keeps about one athlete. */
export interface AthleteNote {
  id: string;
  coachId: string;
  clientId: string;
  date: string;
  text: string;
  pinned?: boolean;
}
export type AnnouncementLevel = 'INFO' | 'FEATURE' | 'MAINTENANCE';
export type AnnouncementAudience = 'ADMINS' | 'STAFF' | 'EVERYONE';
/** A message from the Liftly team to gyms (banner + notification). */
export interface PlatformAnnouncement {
  id: string;
  title: string;
  body: string;
  level: AnnouncementLevel;
  audience: AnnouncementAudience;
  at: string;
  /** Banner hidden after this date (YYYY-MM-DD). */
  until?: string;
  dismissedBy: string[];
}

export interface WorkoutSet { reps: number; weight: number; }
export interface WorkoutEntry {
  exercise: string;
  sets: WorkoutSet[];
  /** Plan line this entry follows (ticked in the plan when logged). */
  itemId?: string;
}
/** A training session a member logged (sets × reps × weight). */
export interface WorkoutLog {
  id: string;
  clientId: string;
  date: string; // YYYY-MM-DD
  title: string;
  planId?: string;
  entries: WorkoutEntry[];
  durationMin?: number;
  note?: string;
  createdAt: string;
}

export type ChallengeMetric = 'VISITS' | 'CLASSES' | 'WORKOUTS';
/** A gym challenge with a leaderboard, e.g. "12 visits in November". */
export interface GymChallenge {
  id: string;
  gymId: string;
  title: string;
  metric: ChallengeMetric;
  target: number;
  start: string; // YYYY-MM-DD
  end: string; // YYYY-MM-DD
  reward?: string;
}

/** A member's rating of a class occurrence they attended. */
export interface ClassReview {
  id: string;
  classId: string;
  gymId: string;
  clientId: string;
  date: string; // occurrence
  rating: number; // 1..5
  comment?: string;
  createdAt: string;
}

export type FreezeRequestStatus = 'PENDING' | 'APPROVED' | 'DECLINED';
/** A member asking the gym to pause their membership. */
export interface FreezeRequest {
  id: string;
  membershipId: string;
  gymId: string;
  clientId: string;
  start: string; // YYYY-MM-DD
  days: number;
  reason: string;
  status: FreezeRequestStatus;
  createdAt: string;
  handledAt?: string;
}

export type NotifyCategory = 'BOOKINGS' | 'SESSIONS' | 'MEMBERSHIP' | 'ANNOUNCEMENTS';
export const NOTIFY_CATEGORIES: { id: NotifyCategory; label: string; hint: string; icon: string }[] = [
  { id: 'BOOKINGS', label: 'Class bookings', hint: 'Waitlist places and cancelled classes', icon: 'calendar-check' },
  { id: 'SESSIONS', label: 'Private sessions', hint: 'Requests, confirmations and changes', icon: 'user-clock' },
  { id: 'MEMBERSHIP', label: 'Membership & payments', hint: 'Renewals, freezes, payments and waivers', icon: 'id-card' },
  { id: 'ANNOUNCEMENTS', label: 'Announcements', hint: 'News from your gym, the platform and challenges', icon: 'bullhorn' },
];
/** Which category a notification title belongs to. */
export function notifyCategory(title: string): NotifyCategory {
  if (/^Session|session request/.test(title)) return 'SESSIONS';
  if (/^(You got a place|Class cancelled)/.test(title)) return 'BOOKINGS';
  if (/^(Announcement|Liftly:|New challenge)/.test(title)) return 'ANNOUNCEMENTS';
  return 'MEMBERSHIP';
}
