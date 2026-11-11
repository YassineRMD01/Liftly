import { Audience, DbState, Payment, ScheduleSlot } from './models';

const d = (offsetDays: number) => new Date(Date.now() + offsetDays * 86400000).toISOString();

let slotN = 0;
/** Build slots for several days at once. */
const slots = (gymId: string, days: number[], open: string, close: string, audience: Audience, sport?: string, note?: string): ScheduleSlot[] =>
  days.map((day) => ({ id: `s-${++slotN}`, gymId, day, open, close, audience, ...(sport ? { sport } : {}), ...(note ? { note } : {}) }));
const WEEKDAYS = [1, 2, 3, 4, 5];
const isoDay = (offsetDays: number) => new Date(Date.now() + offsetDays * 86400000).toISOString().slice(0, 10);

let payN = 0;
/** Monthly payments going back n months from today (on the given day of month). */
const monthly = (gymId: string, clientId: string, amount: number, months: number, dayOfMonth: number, method: Payment['method'] = 'CASH'): Payment[] =>
  Array.from({ length: months }, (_, i) => {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() - i);
    d.setDate(Math.min(dayOfMonth, 28));
    return { id: `p-${++payN}`, gymId, clientId, date: d.toISOString().slice(0, 10), amount, method };
  }).filter((p) => p.date <= new Date().toISOString().slice(0, 10));

let histN = 0;
/** Expired monthly memberships for the months before the current one, matching monthly() payments. */
const history = (gymId: string, clientId: string, planId: string, price: number, months: number, dayOfMonth: number) =>
  Array.from({ length: months - 1 }, (_, k) => {
    const start = new Date();
    start.setDate(1);
    start.setMonth(start.getMonth() - (k + 1));
    start.setDate(Math.min(dayOfMonth, 28));
    const end = new Date(start.getTime() + 30 * 86400000);
    return { id: `mh-${++histN}`, gymId, clientId, planId, pricePaid: price, startDate: start.toISOString(), endDate: end.toISOString(), status: 'EXPIRED' as const };
  });

export const SEED: DbState = {
  users: [
    { id: 'u-sa', role: 'SUPER_ADMIN', firstName: 'Sam', lastName: 'Root', email: 'super@liftly.io', password: 'demo', createdAt: d(-400), active: true },
    { id: 'u-a1', gender: 'MALE', role: 'ADMIN', firstName: 'Alex', lastName: 'Stone', email: 'admin@irontemple.io', password: 'demo', phone: '+1 555 0101', createdAt: d(-300), active: true },
    { id: 'u-a2', gender: 'FEMALE', role: 'ADMIN', firstName: 'Maya', lastName: 'Rivers', email: 'admin@bluewave.io', password: 'demo', phone: '+1 555 0102', createdAt: d(-200), active: true },
    { id: 'u-a3', gender: 'MALE', role: 'ADMIN', firstName: 'Kenji', lastName: 'Mori', email: 'admin@kumite.io', password: 'demo', createdAt: d(-20), active: true },
    { id: 'u-c1', gender: 'MALE', role: 'COACH', firstName: 'Jordan', lastName: 'Blake', email: 'coach@liftly.io', password: 'demo', createdAt: d(-280), active: true },
    { id: 'u-c2', gender: 'FEMALE', role: 'COACH', firstName: 'Lina', lastName: 'Costa', email: 'lina@liftly.io', password: 'demo', createdAt: d(-250), active: true },
    { id: 'u-c3', gender: 'MALE', role: 'COACH', firstName: 'Omar', lastName: 'Haddad', email: 'omar@liftly.io', password: 'demo', createdAt: d(-150), active: true },
    { id: 'u-c4', gender: 'FEMALE', role: 'COACH', firstName: 'Sofia', lastName: 'Novak', email: 'sofia@liftly.io', password: 'demo', createdAt: d(-90), active: true },
    { id: 'u-k1', gender: 'MALE', role: 'CLIENT', firstName: 'Chris', lastName: 'Evans', email: 'client@liftly.io', password: 'demo', createdAt: d(-120), active: true },
    { id: 'u-k2', gender: 'FEMALE', role: 'CLIENT', firstName: 'Nora', lastName: 'Ali', email: 'nora@liftly.io', password: 'demo', createdAt: d(-100), active: true },
    { id: 'u-k3', gender: 'MALE', role: 'CLIENT', firstName: 'Ethan', lastName: 'Park', email: 'ethan@liftly.io', password: 'demo', createdAt: d(-80), active: true },
    { id: 'u-k4', gender: 'FEMALE', role: 'CLIENT', firstName: 'Zoe', lastName: 'Martin', email: 'zoe@liftly.io', password: 'demo', createdAt: d(-60), active: true },
    { id: 'u-k5', gender: 'MALE', role: 'CLIENT', firstName: 'Liam', lastName: 'Brown', email: 'liam@liftly.io', password: 'demo', createdAt: d(-30), active: true },
  ],
  coachProfiles: [
    { userId: 'u-c1', bio: 'Strength & conditioning coach, former powerlifter.', specialties: ['Powerlifting', 'Hypertrophy', 'Mobility'], yearsExperience: 9, hourlyRate: 45, currency: 'USD' },
    { userId: 'u-c2', bio: 'Competitive swimmer turned coach. Technique obsessed.', specialties: ['Swimming', 'Triathlon', 'Endurance'], yearsExperience: 7, hourlyRate: 50, currency: 'EUR' },
    { userId: 'u-c3', bio: 'Black belt in karate and BJJ purple belt.', specialties: ['Karate', 'BJJ', 'Self-defense'], yearsExperience: 12, hourlyRate: 400, currency: 'MAD' },
    { userId: 'u-c4', bio: 'Functional fitness and HIIT specialist.', specialties: ['HIIT', 'CrossFit', 'Nutrition'], yearsExperience: 5, hourlyRate: 35, currency: 'USD' },
  ],
  saasPlans: [
    { id: 'sp-starter', name: 'Starter', description: 'For small studios getting started.', monthlyPrice: 29, yearlyPrice: 290, maxCoaches: 3, maxClients: 100, features: ['Membership plans', 'Promo codes', 'Coach ratings', 'Email support'], customTheme: false, highlighted: false, active: true },
    { id: 'sp-pro', name: 'Pro', description: 'For growing gyms that want their own brand.', monthlyPrice: 79, yearlyPrice: 790, maxCoaches: 15, maxClients: 1000, features: ['Everything in Starter', 'Custom brand colors & logo', 'Advanced analytics', 'Priority support'], customTheme: true, highlighted: true, active: true },
    { id: 'sp-elite', name: 'Elite', description: 'Multi-location clubs and franchises.', monthlyPrice: 199, yearlyPrice: 1990, maxCoaches: -1, maxClients: -1, features: ['Everything in Pro', 'Unlimited coaches & clients', 'Dedicated account manager', 'API access'], customTheme: true, highlighted: false, active: true },
  ],
  gyms: [
    { id: 'g-iron', ownerId: 'u-a1', name: 'Iron Temple', sports: ['Bodybuilding', 'Fitness', 'CrossFit'], currency: 'USD', city: 'Austin', address: '12 Lift St', description: 'Old-school iron paradise with modern equipment.', theme: { primary: '#ef4444', logoText: 'IT' }, saasPlanId: 'sp-pro', billingCycle: 'MONTHLY', status: 'ACTIVE', subscribedAt: d(-300), renewsAt: d(12) },
    { id: 'g-wave', ownerId: 'u-a2', name: 'Blue Wave Aquatics', sports: ['Swimming', 'Aqua Fitness'], currency: 'EUR', city: 'San Diego', address: '4 Ocean Ave', description: 'Olympic pool, lessons for every level.', theme: { primary: '#0ea5e9', logoText: 'BW' }, saasPlanId: 'sp-elite', billingCycle: 'YEARLY', status: 'ACTIVE', subscribedAt: d(-200), renewsAt: d(165) },
    { id: 'g-kumite', ownerId: 'u-a3', name: 'Kumite Dojo', sports: ['Karate', 'BJJ', 'Kickboxing'], currency: 'MAD', city: 'Seattle', address: '88 Zen Rd', description: 'Karate, BJJ and kickboxing for all ages.', theme: { primary: '#10b981', logoText: 'KD' }, saasPlanId: 'sp-starter', billingCycle: 'MONTHLY', status: 'TRIAL', subscribedAt: d(-20), renewsAt: d(10) },
  ],
  gymCoaches: [
    { gymId: 'g-iron', coachId: 'u-c1', since: d(-280) },
    { gymId: 'g-iron', coachId: 'u-c4', since: d(-90) },
    { gymId: 'g-wave', coachId: 'u-c2', since: d(-250) },
    { gymId: 'g-wave', coachId: 'u-c4', since: d(-60) },
    { gymId: 'g-kumite', coachId: 'u-c3', since: d(-20) },
    { gymId: 'g-kumite', coachId: 'u-c1', since: d(-15) },
  ],
  membershipPlans: [
    { id: 'mp-1', gymId: 'g-iron', name: 'Monthly Open Gym', description: 'Unlimited access to the gym floor.', price: 49, durationDays: 30, sessionsPerWeek: -1, includesCoaching: false, active: true },
    { id: 'mp-2', gymId: 'g-iron', name: 'Coached Strength', description: '3 coached sessions per week + open gym.', price: 149, durationDays: 30, sessionsPerWeek: 3, includesCoaching: true, active: true },
    { id: 'mp-3', gymId: 'g-iron', name: 'Annual Pass', description: '12 months unlimited, best value.', price: 450, durationDays: 365, sessionsPerWeek: -1, includesCoaching: false, active: true },
    { id: 'mp-4', gymId: 'g-wave', name: 'Lap Swim', description: 'Open lanes, every day.', price: 39, durationDays: 30, sessionsPerWeek: -1, includesCoaching: false, active: true },
    { id: 'mp-5', gymId: 'g-wave', name: 'Swim School', description: '2 lessons a week with a coach.', price: 99, durationDays: 30, sessionsPerWeek: 2, includesCoaching: true, active: true },
    { id: 'mp-7', gymId: 'g-kumite', name: 'Visitor week pass', description: 'One week of classes for visitors and tourists.', price: 25, currency: 'EUR', durationDays: 7, sessionsPerWeek: -1, includesCoaching: false, active: true },
    { id: 'mp-6', gymId: 'g-kumite', name: 'Dojo Monthly', description: 'All classes, all disciplines.', price: 450, durationDays: 30, sessionsPerWeek: -1, includesCoaching: true, active: true },
  ],
  promoCodes: [
    { id: 'pc-1', gymId: 'g-iron', code: 'IRON20', discountType: 'PERCENT', value: 20, validFrom: d(-30), validUntil: d(60), maxUses: 100, uses: 14, planIds: [], active: true },
    { id: 'pc-2', gymId: 'g-iron', code: 'SUMMER10', discountType: 'FIXED', value: 10, validFrom: d(-120), validUntil: d(-5), maxUses: 50, uses: 50, planIds: ['mp-1'], active: true },
    { id: 'pc-3', gymId: 'g-wave', code: 'SPLASH15', discountType: 'PERCENT', value: 15, validFrom: d(-10), validUntil: d(90), maxUses: -1, uses: 3, planIds: [], active: true },
  ],
  memberships: [
    { id: 'm-1', gymId: 'g-iron', clientId: 'u-k1', planId: 'mp-2', coachId: 'u-c1', promoCodeId: 'pc-1', pricePaid: 119.2, startDate: d(-10), endDate: d(20), status: 'ACTIVE' },
    { id: 'm-2', gymId: 'g-wave', clientId: 'u-k1', planId: 'mp-4', pricePaid: 39, startDate: d(-5), endDate: d(25), status: 'ACTIVE' },
    { id: 'm-3', gymId: 'g-iron', clientId: 'u-k2', planId: 'mp-1', pricePaid: 49, startDate: d(-40), endDate: d(-10), status: 'EXPIRED' },
    { id: 'm-4', gymId: 'g-iron', clientId: 'u-k3', planId: 'mp-3', pricePaid: 450, startDate: d(-80), endDate: d(285), status: 'ACTIVE' },
    { id: 'm-5', gymId: 'g-wave', clientId: 'u-k4', planId: 'mp-5', coachId: 'u-c2', pricePaid: 99, startDate: d(-3), endDate: d(27), status: 'ACTIVE' },
    { id: 'm-6', gymId: 'g-kumite', clientId: 'u-k5', planId: 'mp-6', coachId: 'u-c3', pricePaid: 450, startDate: d(-7), endDate: d(23), status: 'ACTIVE' },
    { id: 'm-7', gymId: 'g-kumite', clientId: 'u-k2', planId: 'mp-6', coachId: 'u-c1', pricePaid: 450, startDate: d(-2), endDate: d(28), status: 'ACTIVE' },
    ...history('g-iron', 'u-k1', 'mp-2', 149, 5, 2),
    ...history('g-iron', 'u-k2', 'mp-1', 49, 3, 10),
    ...history('g-wave', 'u-k1', 'mp-4', 39, 2, 6),
    ...history('g-wave', 'u-k4', 'mp-5', 99, 4, 8),
    ...history('g-kumite', 'u-k5', 'mp-6', 450, 2, 4),
  ],
  reviews: [
    { id: 'r-1', coachId: 'u-c1', clientId: 'u-k1', gymId: 'g-iron', rating: 5, comment: 'Added 40kg to my deadlift in 3 months. Jordan is the real deal.', createdAt: d(-6) },
    { id: 'r-2', coachId: 'u-c1', clientId: 'u-k3', gymId: 'g-iron', rating: 4, comment: 'Great programming, sometimes hard to book.', createdAt: d(-20) },
    { id: 'r-3', coachId: 'u-c2', clientId: 'u-k4', gymId: 'g-wave', rating: 5, comment: 'Fixed my freestyle breathing in two lessons!', createdAt: d(-2) },
    { id: 'r-4', coachId: 'u-c4', clientId: 'u-k1', gymId: 'g-wave', rating: 4, comment: 'Fun and intense HIIT classes.', createdAt: d(-15) },
    { id: 'r-5', coachId: 'u-c3', clientId: 'u-k5', gymId: 'g-kumite', rating: 5, comment: 'Patient, precise and motivating sensei.', createdAt: d(-4) },
    { id: 'r-6', coachId: 'u-c1', clientId: 'u-k2', gymId: 'g-kumite', rating: 3, comment: 'Good coach, but more of a lifting guy than martial arts.', createdAt: d(-1) },
  ],
  schedule: [
    // Iron Temple: mixed most of the day, women-only morning & evening sessions
    ...slots('g-iron', WEEKDAYS, '06:00', '09:00', 'MIXED'),
    ...slots('g-iron', WEEKDAYS, '09:00', '12:00', 'WOMEN', undefined, 'Ladies hours'),
    ...slots('g-iron', WEEKDAYS, '12:00', '22:00', 'MIXED'),
    ...slots('g-iron', [6], '08:00', '18:00', 'MIXED'),
    ...slots('g-iron', [3, 5], '18:00', '19:00', 'MIXED', 'CrossFit', 'WOD class'),
    // Blue Wave: separated pool sessions
    ...slots('g-wave', WEEKDAYS, '06:00', '10:00', 'MIXED', 'Swimming', 'Lap swim'),
    ...slots('g-wave', WEEKDAYS, '10:00', '14:00', 'WOMEN', 'Swimming'),
    ...slots('g-wave', WEEKDAYS, '14:00', '18:00', 'MEN', 'Swimming'),
    ...slots('g-wave', [2, 4], '18:00', '19:00', 'WOMEN', 'Aqua Fitness'),
    ...slots('g-wave', [6, 0], '08:00', '13:00', 'WOMEN', 'Swimming'),
    ...slots('g-wave', [6, 0], '13:00', '18:00', 'MEN', 'Swimming'),
    // Kumite Dojo: kids/mixed classes plus separate adult sessions
    ...slots('g-kumite', WEEKDAYS, '16:00', '18:00', 'MIXED', 'Karate', 'Kids & teens'),
    ...slots('g-kumite', [1, 3, 5], '18:00', '20:00', 'MEN', 'BJJ'),
    ...slots('g-kumite', [2, 4], '18:00', '20:00', 'WOMEN', 'Kickboxing', 'Women self-defense'),
    ...slots('g-kumite', [6], '10:00', '14:00', 'MIXED'),
  ],
  closures: [
    { id: 'cl-1', gymId: 'g-iron', date: isoDay(14), reason: 'Equipment maintenance' },
    { id: 'cl-2', gymId: 'g-wave', date: isoDay(30), reason: 'Pool cleaning' },
  ],
  payments: [
    ...monthly('g-iron', 'u-k1', 149, 5, 2, 'CARD'),
    ...monthly('g-iron', 'u-k2', 49, 3, 10),
    { id: 'p-ann', gymId: 'g-iron', clientId: 'u-k3', date: isoDay(-80), amount: 450, method: 'TRANSFER', note: 'Annual pass' },
    ...monthly('g-wave', 'u-k1', 39, 2, 6, 'CARD'),
    ...monthly('g-wave', 'u-k4', 99, 4, 8),
    ...monthly('g-kumite', 'u-k5', 450, 2, 4),
    ...monthly('g-kumite', 'u-k2', 450, 1, 9),
  ],
};
