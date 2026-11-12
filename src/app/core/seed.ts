import { Audience, CheckIn, ClassBooking, DbState, GymClass, Payment, ScheduleSlot } from './models';

const d = (offsetDays: number) => new Date(Date.now() + offsetDays * 86400000).toISOString();

let slotN = 0;
/** Build slots for several days at once. */
const slots = (gymId: string, days: number[], open: string, close: string, audience: Audience, sportId?: string, note?: string): ScheduleSlot[] =>
  days.map((day) => ({ id: `s-${++slotN}`, gymId, day, open, close, audience, ...(sportId ? { sportId } : {}), ...(note ? { note } : {}) }));
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

/** Demo logos (SVG data URLs). */
const IRON_LOGO = 'data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20viewBox%3D%220%200%20120%20120%22%3E%3Ccircle%20cx%3D%2260%22%20cy%3D%2260%22%20r%3D%2256%22%20fill%3D%22%23111827%22/%3E%3Ccircle%20cx%3D%2260%22%20cy%3D%2260%22%20r%3D%2246%22%20fill%3D%22%23ef4444%22/%3E%3Crect%20x%3D%2222%22%20y%3D%2254%22%20width%3D%2276%22%20height%3D%2212%22%20rx%3D%223%22%20fill%3D%22%23fff%22/%3E%3Crect%20x%3D%2228%22%20y%3D%2240%22%20width%3D%2210%22%20height%3D%2240%22%20rx%3D%223%22%20fill%3D%22%23fff%22/%3E%3Crect%20x%3D%2282%22%20y%3D%2240%22%20width%3D%2210%22%20height%3D%2240%22%20rx%3D%223%22%20fill%3D%22%23fff%22/%3E%3Crect%20x%3D%2216%22%20y%3D%2247%22%20width%3D%228%22%20height%3D%2226%22%20rx%3D%223%22%20fill%3D%22%23fff%22/%3E%3Crect%20x%3D%2296%22%20y%3D%2247%22%20width%3D%228%22%20height%3D%2226%22%20rx%3D%223%22%20fill%3D%22%23fff%22/%3E%3C/svg%3E';
const WAVE_LOGO = 'data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20viewBox%3D%220%200%20120%20120%22%3E%3Crect%20width%3D%22120%22%20height%3D%22120%22%20rx%3D%2228%22%20fill%3D%22%230ea5e9%22/%3E%3Cpath%20d%3D%22M10%2070%20Q30%2050%2050%2070%20T90%2070%20T130%2070%20V120%20H10Z%22%20fill%3D%22%230369a1%22/%3E%3Cpath%20d%3D%22M10%2082%20Q30%2064%2050%2082%20T90%2082%20T130%2082%20V120%20H10Z%22%20fill%3D%22%23e0f2fe%22/%3E%3Ccircle%20cx%3D%2284%22%20cy%3D%2236%22%20r%3D%2214%22%20fill%3D%22%23facc15%22/%3E%3C/svg%3E';

/** Next date (today included) falling on a weekday (getDay()), as YYYY-MM-DD. */
const nextDate = (day: number, weeksAhead = 0) => {
  const t = new Date();
  const diff = (day - t.getDay() + 7) % 7 + weeksAhead * 7;
  const x = new Date(t.getFullYear(), t.getMonth(), t.getDate() + diff);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
};

const cls = (id: string, gymId: string, name: string, day: number, start: string, end: string, capacity: number, audience: Audience, extra: Partial<GymClass> = {}): GymClass =>
  ({ id: `${id}-${day}`, gymId, name, day, start, end, capacity, audience, level: 'ALL', active: true, ...extra });

/** Deterministic pseudo-random numbers so the demo check-in history is stable. */
let seedN = 7;
const rnd = () => ((seedN = (seedN * 16807) % 2147483647) / 2147483647);

/** ~30 days of past check-ins for members with memberships (for attendance stats). */
const checkInHistory = (): CheckIn[] => {
  const members: [string, string, number][] = [
    ['g-iron', 'u-k1', 0.7], ['g-iron', 'u-k3', 0.5], ['g-wave', 'u-k1', 0.25], ['g-wave', 'u-k4', 0.6],
    ['g-kumite', 'u-k5', 0.55], ['g-kumite', 'u-k6', 0.45], ['g-kumite', 'u-k2', 0.3],
  ];
  const out: CheckIn[] = [];
  let n = 0;
  for (let back = 30; back >= 1; back--) {
    for (const [gymId, clientId, p] of members) {
      if (rnd() > p) continue;
      const day = new Date(Date.now() - back * 86400000);
      const hour = [7, 8, 12, 13, 17, 18, 19, 20][Math.floor(rnd() * 8)];
      day.setHours(hour, Math.floor(rnd() * 60), 0, 0);
      out.push({ id: `ci-${++n}`, gymId, clientId, at: day.toISOString(), method: rnd() > 0.2 ? 'QR' : 'MANUAL', ok: true });
    }
  }
  // Ethan (Iron) stopped coming two weeks ago: shows up in "members at risk"
  return out.filter((c) => !(c.clientId === 'u-k3' && c.at > new Date(Date.now() - 16 * 86400000).toISOString()));
};

export const SEED: DbState = {
  platform: { theme: { primary: '#6366f1', logoText: 'LF', appearance: 'system' }, defaultCountry: 'US' },
  sports: [
    { id: 'sport-fitness', name: 'Fitness', icon: 'dumbbell' },
    { id: 'sport-bodybuilding', name: 'Bodybuilding', icon: 'dumbbell' },
    { id: 'sport-crossfit', name: 'CrossFit', icon: 'fire' },
    { id: 'sport-cardio', name: 'Cardio', icon: 'heart-pulse' },
    { id: 'sport-swimming', name: 'Swimming', icon: 'person-swimming' },
    { id: 'sport-aqua', name: 'Aqua Fitness', icon: 'water' },
    { id: 'sport-martial', name: 'Martial Arts', icon: 'hand-fist' },
    { id: 'sport-karate', name: 'Karate', icon: 'hand-fist' },
    { id: 'sport-bjj', name: 'BJJ', icon: 'user-ninja' },
    { id: 'sport-kickboxing', name: 'Kickboxing', icon: 'hand-fist' },
    { id: 'sport-boxing', name: 'Boxing', icon: 'hand-fist' },
    { id: 'sport-yoga', name: 'Yoga', icon: 'spa' },
    { id: 'sport-pilates', name: 'Pilates', icon: 'person-walking' },
    { id: 'sport-tennis', name: 'Tennis', icon: 'table-tennis-paddle-ball' },
    { id: 'sport-padel', name: 'Padel', icon: 'table-tennis-paddle-ball' },
    { id: 'sport-squash', name: 'Squash', icon: 'table-tennis-paddle-ball' },
    { id: 'sport-climbing', name: 'Climbing', icon: 'mountain' },
    { id: 'sport-dance', name: 'Dance', icon: 'music' },
    { id: 'sport-cycling', name: 'Cycling', icon: 'bicycle' },
    { id: 'sport-football', name: 'Football', icon: 'futbol' },
    { id: 'sport-basketball', name: 'Basketball', icon: 'basketball' },
    { id: 'sport-running', name: 'Running', icon: 'person-running' },
    { id: 'sport-kids-karate', name: 'Kids karate', icon: 'child', gymId: 'g-kumite' },
  ],
  countries: [
    { code: 'US', currency: 'USD', active: true },
    { code: 'CA', currency: 'CAD', active: true },
    { code: 'GB', currency: 'GBP', active: true },
    { code: 'FR', currency: 'EUR', active: true },
    { code: 'ES', currency: 'EUR', active: true },
    { code: 'DE', currency: 'EUR', active: true },
    { code: 'MA', currency: 'MAD', active: true },
    { code: 'DZ', currency: 'DZD', active: true },
    { code: 'TN', currency: 'TND', active: true },
    { code: 'EG', currency: 'EGP', active: true },
    { code: 'AE', currency: 'AED', active: true },
    { code: 'SA', currency: 'SAR', active: true },
    { code: 'QA', currency: 'QAR', active: false },
    { code: 'TR', currency: 'TRY', active: false },
    { code: 'CH', currency: 'CHF', active: false },
    { code: 'SN', currency: 'XOF', active: false },
  ],
  // demo exchange rates (value of 1 unit in USD) — replace with a live rates feed in production
  currencies: [
    { code: 'USD', rateToUsd: 1, active: true },
    { code: 'EUR', rateToUsd: 1.08, active: true },
    { code: 'GBP', rateToUsd: 1.27, active: true },
    { code: 'MAD', rateToUsd: 0.1, active: true },
    { code: 'DZD', rateToUsd: 0.0074, active: true },
    { code: 'TND', rateToUsd: 0.32, active: true },
    { code: 'EGP', rateToUsd: 0.02, active: true },
    { code: 'AED', rateToUsd: 0.27, active: true },
    { code: 'SAR', rateToUsd: 0.27, active: true },
    { code: 'QAR', rateToUsd: 0.27, active: false },
    { code: 'KWD', rateToUsd: 3.25, active: false },
    { code: 'TRY', rateToUsd: 0.029, active: false },
    { code: 'CAD', rateToUsd: 0.73, active: true },
    { code: 'CHF', rateToUsd: 1.13, active: false },
    { code: 'XOF', rateToUsd: 0.00165, active: false },
  ],
  bans: [
    { gymId: 'g-iron', clientId: 'u-k7', reason: 'Repeated aggressive behavior towards other members.', date: d(-12) },
  ],
  reports: [
    { id: 'rep-1', gymId: 'g-kumite', coachId: 'u-c1', clientId: 'u-k2', category: 'UNPROFESSIONAL', description: 'Arrived 30 minutes late twice and spent the class on his phone.', status: 'OPEN', createdAt: d(-1) },
    { id: 'rep-2', gymId: 'g-iron', coachId: 'u-c4', clientId: 'u-k3', category: 'UNSAFE_TRAINING', description: 'Pushed me to lift far above my level without spotting.', status: 'RESOLVED', createdAt: d(-25), resolutionNote: 'Talked with the coach; spotting is now mandatory on heavy sets.', handledAt: d(-22) },
  ],
  gymReviews: [
    { id: 'gr-1', gymId: 'g-iron', clientId: 'u-k1', rating: 5, comment: 'Best equipment in town and a great atmosphere.', createdAt: d(-8) },
    { id: 'gr-2', gymId: 'g-iron', clientId: 'u-k3', rating: 4, comment: 'Busy after 6pm, otherwise perfect.', createdAt: d(-30) },
    { id: 'gr-3', gymId: 'g-wave', clientId: 'u-k4', rating: 5, comment: 'Clean pool and the women-only sessions are a big plus.', createdAt: d(-3) },
    { id: 'gr-4', gymId: 'g-wave', clientId: 'u-k1', rating: 4, comment: 'Lovely place, lanes can get crowded in the morning.', createdAt: d(-6) },
    { id: 'gr-5', gymId: 'g-kumite', clientId: 'u-k5', rating: 5, comment: 'Welcoming dojo with very good senseis.', createdAt: d(-5) },
    { id: 'gr-6', gymId: 'g-kumite', clientId: 'u-k6', rating: 4, comment: 'Great classes, the changing rooms could be bigger.', createdAt: d(-2) },
  ],
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
    { id: 'u-k6', gender: 'MALE', role: 'CLIENT', firstName: 'Amine', lastName: 'El Idrissi', email: 'amine@liftly.io', password: 'demo', phone: '+212 600 000 106', createdAt: d(-45), active: true },
    { id: 'u-s1', gender: 'FEMALE', role: 'STAFF', firstName: 'Rita', lastName: 'Gomez', email: 'staff@liftly.io', password: 'demo', createdAt: d(-90), active: true },
    { id: 'u-k7', gender: 'FEMALE', role: 'CLIENT', firstName: 'Sara', lastName: 'Lopez', email: 'sara@liftly.io', password: 'demo', createdAt: d(-70), active: true },
  ],
  coachProfiles: [
    { userId: 'u-c1', bio: 'Strength & conditioning coach, former powerlifter.', specialties: ['Powerlifting', 'Hypertrophy', 'Mobility'], yearsExperience: 9, hourlyRate: 45, currency: 'USD' },
    { userId: 'u-c2', bio: 'Competitive swimmer turned coach. Technique obsessed.', specialties: ['Swimming', 'Triathlon', 'Endurance'], yearsExperience: 7, hourlyRate: 50, currency: 'EUR' },
    { userId: 'u-c3', bio: 'Black belt in karate and BJJ purple belt.', specialties: ['Karate', 'BJJ', 'Self-defense'], yearsExperience: 12, hourlyRate: 400, currency: 'MAD' },
    { userId: 'u-c4', bio: 'Functional fitness and HIIT specialist.', specialties: ['HIIT', 'CrossFit', 'Nutrition'], yearsExperience: 5, hourlyRate: 35, currency: 'USD' },
  ],
  saasPlans: [
    { id: 'sp-starter', name: 'Starter', description: 'For small studios getting started.', monthlyPrice: 29, yearlyPrice: 290, maxCoaches: 3, maxClients: 100, features: ['Membership plans', 'Promo codes', 'Coach ratings', 'Email support'], customTheme: false, highlighted: false, active: true, countryPrices: [{ country: 'MA', monthly: 249, yearly: 2490 }, { country: 'FR', monthly: 27, yearly: 270 }, { country: 'ES', monthly: 25, yearly: 250 }] },
    { id: 'sp-pro', name: 'Pro', description: 'For growing gyms that want their own brand.', monthlyPrice: 79, yearlyPrice: 790, maxCoaches: 15, maxClients: 1000, features: ['Everything in Starter', 'Custom brand colors & logo', 'Advanced analytics', 'Priority support'], customTheme: true, highlighted: true, active: true, countryPrices: [{ country: 'MA', monthly: 690, yearly: 6900 }, { country: 'FR', monthly: 72, yearly: 720 }, { country: 'ES', monthly: 69, yearly: 690 }] },
    { id: 'sp-elite', name: 'Elite', description: 'Multi-location clubs and franchises.', monthlyPrice: 199, yearlyPrice: 1990, maxCoaches: -1, maxClients: -1, features: ['Everything in Pro', 'Unlimited coaches & clients', 'Dedicated account manager', 'API access'], customTheme: true, highlighted: false, active: true, countryPrices: [{ country: 'MA', monthly: 1790, yearly: 17900 }, { country: 'FR', monthly: 185, yearly: 1850 }, { country: 'ES', monthly: 179, yearly: 1790 }] },
  ],
  gyms: [
    { id: 'g-iron', ownerId: 'u-a1', name: 'Iron Temple', sportIds: ['sport-bodybuilding', 'sport-fitness', 'sport-crossfit'], country: 'US', currency: 'USD', city: 'Austin', address: '12 Lift St', description: 'Old-school iron paradise with modern equipment.', theme: { primary: '#ef4444', logoText: 'IT', logoUrl: IRON_LOGO, appearance: 'system' }, saasPlanId: 'sp-pro', billingCycle: 'MONTHLY', status: 'ACTIVE', subscribedAt: d(-300), renewsAt: d(12) },
    { id: 'g-wave', ownerId: 'u-a2', name: 'Blue Wave Aquatics', sportIds: ['sport-swimming', 'sport-aqua'], country: 'ES', currency: 'EUR', city: 'Barcelona', address: 'Passeig Marítim 4', description: 'Olympic pool, lessons for every level.', theme: { primary: '#0ea5e9', logoText: 'BW', logoUrl: WAVE_LOGO, appearance: 'light' }, saasPlanId: 'sp-elite', billingCycle: 'YEARLY', status: 'ACTIVE', subscribedAt: d(-200), renewsAt: d(165) },
    { id: 'g-kumite', ownerId: 'u-a3', name: 'Kumite Dojo', sportIds: ['sport-karate', 'sport-bjj', 'sport-kickboxing', 'sport-kids-karate'], country: 'MA', currency: 'MAD', city: 'Casablanca', address: '88 Bd Zerktouni', description: 'Karate, BJJ and kickboxing for all ages.', theme: { primary: '#10b981', logoText: 'KD' }, saasPlanId: 'sp-starter', billingCycle: 'MONTHLY', status: 'TRIAL', subscribedAt: d(-20), renewsAt: d(10) },
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
    { id: 'm-1', gymId: 'g-iron', clientId: 'u-k1', planId: 'mp-2', coachId: 'u-c1', promoCodeId: 'pc-1', pricePaid: 119.2, startDate: d(-25), endDate: d(5), status: 'ACTIVE' },
    { id: 'm-2', gymId: 'g-wave', clientId: 'u-k1', planId: 'mp-4', pricePaid: 39, startDate: d(-5), endDate: d(25), status: 'ACTIVE' },
    { id: 'm-3', gymId: 'g-iron', clientId: 'u-k2', planId: 'mp-1', pricePaid: 49, startDate: d(-40), endDate: d(-10), status: 'EXPIRED' },
    { id: 'm-4', gymId: 'g-iron', clientId: 'u-k3', planId: 'mp-3', pricePaid: 450, startDate: d(-80), endDate: d(285), status: 'ACTIVE' },
    { id: 'm-5', gymId: 'g-wave', clientId: 'u-k4', planId: 'mp-5', coachId: 'u-c2', pricePaid: 99, startDate: d(-3), endDate: d(27), status: 'ACTIVE' },
    { id: 'm-6', gymId: 'g-kumite', clientId: 'u-k5', planId: 'mp-6', coachId: 'u-c3', pricePaid: 450, startDate: d(-7), endDate: d(23), status: 'ACTIVE' },
    { id: 'm-8', gymId: 'g-kumite', clientId: 'u-k6', planId: 'mp-6', coachId: 'u-c3', pricePaid: 450, startDate: d(-12), endDate: d(18), status: 'ACTIVE' },
    { id: 'm-10', gymId: 'g-iron', clientId: 'u-k6', planId: 'mp-1', pricePaid: 49, startDate: d(-5), endDate: d(25), status: 'ACTIVE' },
    { id: 'm-9', gymId: 'g-iron', clientId: 'u-k7', planId: 'mp-1', pricePaid: 49, startDate: d(-60), endDate: d(-12), status: 'CANCELLED' },
    { id: 'm-7', gymId: 'g-kumite', clientId: 'u-k2', planId: 'mp-6', coachId: 'u-c1', pricePaid: 450, startDate: d(-2), endDate: d(28), status: 'ACTIVE' },
    ...history('g-iron', 'u-k1', 'mp-2', 149, 5, 2),
    ...history('g-iron', 'u-k2', 'mp-1', 49, 3, 10),
    ...history('g-wave', 'u-k1', 'mp-4', 39, 2, 6),
    ...history('g-wave', 'u-k4', 'mp-5', 99, 4, 8),
    ...history('g-kumite', 'u-k5', 'mp-6', 450, 2, 4),
    ...history('g-kumite', 'u-k6', 'mp-6', 450, 2, 14),
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
    ...slots('g-iron', [3, 5], '18:00', '19:00', 'MIXED', 'sport-crossfit', 'WOD class'),
    // Blue Wave: separated pool sessions
    ...slots('g-wave', WEEKDAYS, '06:00', '10:00', 'MIXED', 'sport-swimming', 'Lap swim'),
    ...slots('g-wave', WEEKDAYS, '10:00', '14:00', 'WOMEN', 'sport-swimming'),
    ...slots('g-wave', WEEKDAYS, '14:00', '18:00', 'MEN', 'sport-swimming'),
    ...slots('g-wave', [2, 4], '18:00', '19:00', 'WOMEN', 'sport-aqua'),
    ...slots('g-wave', [6, 0], '08:00', '13:00', 'WOMEN', 'sport-swimming'),
    ...slots('g-wave', [6, 0], '13:00', '18:00', 'MEN', 'sport-swimming'),
    // Kumite Dojo: kids/mixed classes plus separate adult sessions
    ...slots('g-kumite', WEEKDAYS, '16:00', '18:00', 'MIXED', 'sport-kids-karate', 'Kids & teens'),
    ...slots('g-kumite', [1, 3, 5], '18:00', '20:00', 'MEN', 'sport-bjj'),
    ...slots('g-kumite', [2, 4], '18:00', '20:00', 'WOMEN', 'sport-kickboxing', 'Women self-defense'),
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
    ...monthly('g-kumite', 'u-k6', 450, 2, 14),
    { id: 'p-sara', gymId: 'g-iron', clientId: 'u-k7', date: isoDay(-60), amount: 49, method: 'CASH' },
    ...monthly('g-kumite', 'u-k2', 450, 1, 9),
  ],
  staff: [{ gymId: 'g-iron', userId: 'u-s1', since: d(-90) }],
  classes: [
    ...[1, 3, 5].map((day) => cls('c-hiit', 'g-iron', 'Morning HIIT', day, '07:00', '08:00', 12, 'MIXED', { coachId: 'u-c4', sportId: 'sport-fitness', room: 'Studio A' })),
    ...[3, 5].map((day) => cls('c-wod', 'g-iron', 'CrossFit WOD', day, '18:00', '19:00', 10, 'MIXED', { coachId: 'u-c1', sportId: 'sport-crossfit', level: 'INTERMEDIATE', room: 'Box' })),
    ...[2, 4].map((day) => cls('c-power', 'g-iron', 'Powerlifting basics', day, '19:00', '20:30', 2, 'MIXED', { coachId: 'u-c1', sportId: 'sport-bodybuilding', level: 'BEGINNER', room: 'Platform 1' })),
    ...[2, 4].map((day) => cls('c-swimtech', 'g-wave', 'Swim technique', day, '10:30', '11:30', 8, 'WOMEN', { coachId: 'u-c2', sportId: 'sport-swimming', room: 'Lane 1-2' })),
    ...[2, 4].map((day) => cls('c-aqua', 'g-wave', 'Aqua fitness', day, '18:00', '19:00', 15, 'WOMEN', { coachId: 'u-c4', sportId: 'sport-aqua', room: 'Small pool' })),
    ...[6].map((day) => cls('c-masters', 'g-wave', 'Masters swim', day, '14:00', '15:00', 10, 'MEN', { coachId: 'u-c2', sportId: 'sport-swimming', level: 'ADVANCED', room: 'Lane 3-6' })),
    ...[1, 2, 3, 4, 5].map((day) => cls('c-kids', 'g-kumite', 'Kids karate', day, '16:00', '17:00', 15, 'MIXED', { coachId: 'u-c3', sportId: 'sport-kids-karate', room: 'Tatami' })),
    ...[1, 3, 5].map((day) => cls('c-bjj', 'g-kumite', 'BJJ fundamentals', day, '18:00', '19:30', 12, 'MEN', { coachId: 'u-c3', sportId: 'sport-bjj', level: 'BEGINNER', room: 'Tatami' })),
    ...[2, 4].map((day) => cls('c-kick', 'g-kumite', 'Women kickboxing', day, '18:00', '19:30', 12, 'WOMEN', { coachId: 'u-c1', sportId: 'sport-kickboxing', room: 'Tatami' })),
  ],
  bookings: ([
    // Powerlifting basics (capacity 2) is full next Tuesday, with Amine on the waitlist
    ['b-1', 'c-power-2', 'g-iron', 'u-k1', nextDate(2), 'BOOKED', -3],
    ['b-2', 'c-power-2', 'g-iron', 'u-k3', nextDate(2), 'BOOKED', -2.5],
    ['b-5', 'c-power-2', 'g-iron', 'u-k6', nextDate(2), 'WAITLIST', -1],
    ['b-6', 'c-wod-3', 'g-iron', 'u-k1', nextDate(3), 'BOOKED', -1],
    ['b-7', 'c-kick-2', 'g-kumite', 'u-k2', nextDate(2), 'BOOKED', -1],
    ['b-8', 'c-bjj-1', 'g-kumite', 'u-k5', nextDate(1), 'BOOKED', -1],
    ['b-9', 'c-bjj-1', 'g-kumite', 'u-k6', nextDate(1), 'BOOKED', -1],
    ['b-10', 'c-swimtech-2', 'g-wave', 'u-k4', nextDate(2), 'BOOKED', -2],
  ] as [string, string, string, string, string, ClassBooking['status'], number][]).map(([id, classId, gymId, clientId, date, status, ago]) =>
    ({ id, classId, gymId, clientId, date, status, createdAt: d(ago) })),
  checkIns: checkInHistory(),
  notifications: [],
};
