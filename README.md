# Liftly — multi-tenant gym management front-end

Angular 22 · Tailwind CSS 4 · PrimeNG 22 · Font Awesome · signals, zoneless, standalone components.

Works for any sport (gym, pool, dojo, court…). Five roles:

| Role | What they can do |
|---|---|
| **Super-admin** | Platform KPIs and **charts** (MRR trend, new users, gyms by country, reports), manage the SaaS **pricing plans** with **local prices per country**, **currencies & countries** (exchange rates for stats), the **home theme** and the **sport catalog** (Settings), review **coach reports** of every gym, change a gym's plan/status (active / trial / suspended), activate/deactivate users, impersonate |
| **Gym admin** | Dashboard **charts** (revenue, active members, clients by status, members by plan) and gym rating; manages the gym's **sports** (catalog or custom, with icons); **renews** memberships with an optional **plan change**; **bans / unbans** clients (client status Active / Expired / Banned); reviews **coach reports**; runs a gym with **one or more sports**, manages the **weekly schedule** (opening/closing hours per day as mixed, men-only or women-only sessions, for the whole gym or one sport/area; templates, copy-a-day, holiday closures, overlap checks), manages each client's **payments on a yearly calendar** (click any day to add / edit / delete a payment: amount, method, note; months covered by a membership are highlighted; yearly and all-time totals), subscribes to a SaaS plan (sign-up + billing page: upgrade/downgrade, monthly↔yearly), **custom theme color & logo** (live preview, Pro+ plans), membership plans CRUD, **promo codes** (% or fixed, date range, max uses, plan restriction), **registers clients** — the only way a member account or membership is created (new account with temporary password `welcome`, add / renew / cancel / assign coach, apply promo), link coaches from the network or invite new ones; plan limits are enforced |
| **Coach** | Works at **many gyms**, dashboard of gyms & assigned athletes, **star ratings & comments** with rating breakdown, editable public profile |
| **Front desk (staff)** | Receptionist accounts created by the gym admin (Staff page): **QR / manual check-in**, members list (read-only), class rosters and attendance stats; no billing or settings |
| **Client** | Account and memberships are **created only by the gym admin** (no self sign-up, no self checkout). Can be a member of **many gyms**, browses gyms (sports, plans, coaches, hours), sees live *open now* status, the gym schedule as a **weekly calendar** (hours open to them by gender), their **own payments** on the yearly calendar (read-only), **rates & reviews coaches** (1 review per coach per gym), **rates gyms**, **reports a coach** for inappropriate behavior |

### Classes, waitlist & check-in
- **Classes** (`GymClass`): weekly timetable per gym (day, time, coach, sport, capacity, level, room, who can attend). Admins edit it; members see the next 7 days and **book**. When a class is full, members **join the waitlist**; when someone cancels, the first person waiting is booked automatically and gets a notification. Bookings close when the class starts and respect bans, freezes, membership status and men/women sessions.
- **Rosters:** admins, front desk and the class coach open an occurrence to see who's booked and who's waiting, mark **attended / no-show**, or remove someone (`shared/class-roster`).
- **QR check-in:** each member has a **QR card** (`/client/card`, payload signed in `core/qr.ts`). The front desk scans it with the device camera (`jsqr`) or searches by name. Entry is refused for unknown codes, bans, frozen or missing memberships, and allowed with a warning outside the sessions open to that member. A check-in marks today's booked classes as attended.
- **Attendance:** check-ins per day, busiest hours and weekdays, class show-up rate, and **members at risk** (active, but no visit for 14+ days).
- **Freeze:** admins pause a membership for N days (holiday, injury); the end date moves back by the same amount, and unfreezing gives back unused days. A frozen member's status is `FROZEN`, so they can't check in or book.
- **Notifications** (bell in the header): waitlist promotions, cancelled classes, freezes and **renewal reminders**. Members are reminded automatically when a membership ends within 7 days, and admins can send reminders from the dashboard's *Ending this week* card. These are in-app only; email, SMS and push need a backend.

### Coaching, messages & mobile app
- **Private sessions:** coaches set weekly availability per gym (windows split into 30–90 min slots). Members pick a coach from their gyms, see free slots for the next 14 days and send a request with a note. The price comes from the coach's hourly rate and currency. The coach confirms, declines, cancels or marks it done, and the member is notified each time. Payment happens at the gym (no online payment).
- **Workout & nutrition plans:** coaches write plans for their athletes, grouped by day or meal, with sets × reps or quantities. Members tick off items as they go and can start the plan over.
- **Progress tracking:** weight, body fat, waist and an optional photo (resized in the browser). Shows a chart per metric, change since the start, a photo gallery and the history. Both the member and their coach can add entries.
- **Messages:** one-to-one chat between members and their gyms' coaches and admins, coaches and their gyms' members, and admins and their staff. Unread counts show in the sidebar.
- **Announcements:** admins post news to their gym (optionally pinned). Every member, coach and staff member gets an in-app notification.
- **PWA:** web app manifest, icons and an Angular service worker in production builds. The app can be installed (an *Install app* button appears when the browser offers it) and works offline; demo data lives in `localStorage`. An *Update* button appears when a new version has been downloaded.

### Growth, billing documents & admin tools
- **Public gym directory** (`/gyms`): search by name or city, filter by sport and country. Each gym has a **public page** (`/gyms/:id`) in its own theme with plans, classes, opening hours, coaches, reviews and locations, plus an **Ask to join** form. Admins can hide the page (Branding → *Public page & referrals*).
- **Join requests** (`/admin/requests`, with a badge for new ones): mark as contacted, decline, or *Create member*. That makes an invited account; the admin then adds the membership.
- **Invitations instead of shared passwords:** members, coaches and staff created by an admin get an **activation link** (`/activate/:token`, valid 7 days) to choose their own password. The admin can copy it, show it as a QR code or open a pre-filled e-mail. Invited users cannot sign in until they activate.
- **Referrals:** every member has a code (their first name, made unique) and a share link per gym (`/gyms/:id?ref=CODE`) on their QR card page. The gym's reward text is shown there and on the join form. Converted requests credit the referrer, and the admin dashboard lists *Top referrers*.
- **Multi-location gyms** (`/admin/locations`): branches with addresses. Classes can be tied to a location, the check-in desk remembers its location, and attendance can be filtered by location.
- **Receipts & invoices with VAT:** each country has a VAT rate (super-admin → Currencies & countries). Member payments get a printable **receipt** (`/receipt/:id`, linked from the payment calendar for admins and members). Gyms get printable **Liftly invoices** per billing period (`/invoice/:gymId/:number`, from Billing). Prices include VAT and the net/VAT split is shown; *Print / save as PDF* uses an A4 print stylesheet.
- **Activity log** (`/super-admin/activity`): users created or invited, memberships, payments, bans, freezes, plan and status changes, announcements, locations and more. Each entry records who, when and which gym, with search, filters and CSV export.
- **Trial reminders:** the super-admin dashboard lists trials ending within 7 days and can send reminders. Gym owners are also reminded automatically, and Billing shows a countdown banner.
- **Retention cohorts:** members grouped by the month of their first membership, with the share still subscribed each following month. Shown platform-wide on the super-admin dashboard and per gym on the admin dashboard.
- **CSV export:** clients, check-ins, join requests, gyms, users and the activity log (`core/csv.ts`, UTF-8 with BOM so Excel keeps accents).

### Tests & CI
- Unit tests run on Vitest through Angular's unit-test builder: `npm test` (watch mode) or `npm run test:ci`. They cover booking/waitlist promotion, booking rules, check-in rules, freeze, private-session slots, invitations, referrals, join requests, VAT, invoices, audit, messages, CSV and QR codes (`src/app/core/*.spec.ts`).
- GitHub Actions (`.github/workflows/ci.yml`) runs `npm ci`, the unit tests and a production build on every push to `main` and on pull requests, and uploads the built app as an artifact. `.npmrc` sets `legacy-peer-deps` because of an optional Vitest peer range.

### Country pricing, currencies & themes
- Gyms have a **country**. Each SaaS plan has a USD price plus optional **local prices per country** (in that country's currency); the pricing page, sign-up and billing show the price for the gym's country. MRR is converted to USD with the super-admin's exchange rates.
- The super-admin manages **currencies** (active, rate to USD) and **countries** (default currency, active).
- **Themes:** each gym has its own theme (Branding); the public site (home, pricing, login) and users outside a gym use the **platform theme** set by the super-admin in Settings.
- **Logos:** gym admins upload a logo (PNG, JPG, SVG, WebP), resized in the browser to 256 px and stored with the theme. Its main colors are extracted (`core/logo.ts`): the strongest becomes the theme color and the others are offered as swatches; any color can still be picked. Gyms without a logo show their initials (`shared/gym-logo`).
- **Platform logo:** the super-admin uploads a logo in Settings (same uploader and logo-color matching as gyms); it is shown on the home, pricing, login and sign-up pages and in the app for users outside a gym.
- **Secondary color:** every theme (gym or platform) has a secondary / surface color — one for light mode and one for dark mode (presets or any color, `shared/surface-picker`). It tints backgrounds, cards, borders and muted text; the palette for the active mode is used automatically (`buildSurface` in `core/theme.service.ts`, applied with one PrimeNG `updatePreset` together with the primary palette).
- **Light / dark:** every theme has an appearance — *Auto (system)*, *Light* or *Dark* — chosen by the gym admin (Branding) or the super-admin (public site). Auto follows the visitor's OS setting and updates live. Each user can override it from the header menu (Auto / Light / Dark), stored in `localStorage` (`liftly-appearance`).

### Sports, bans, reports & reviews
- `Sport` is a model: platform **catalog** sports (managed by the super-admin) and **custom** sports created by a gym; gyms reference sports by id (`Gym.sportIds`, `ScheduleSlot.sportId`).
- **Client status** at a gym is derived: `BANNED` if banned, `ACTIVE` with a running membership, otherwise `EXPIRED`. Banning cancels the client's active memberships and blocks new ones until unbanned.
- **Coach reports** (category + details) go to the gym admin and the super-admin, who resolve, dismiss, reopen, or remove the coach from the gym.
- **Gym reviews**: one rating + comment per client and gym, shown on gym cards, gym details, the admin dashboard and the super-admin gym list.

### Charts
- `shared/chart-card` wraps PrimeNG's chart (Chart.js) with the data-viz rules: validated color-blind-safe palette (separate light/dark steps), status colors only for states, ≤24px bars with 4px rounded ends, 2px lines, legend only for 2+ series, hover tooltips, an accessible **table view** toggle, and mirrored axes in Arabic.

### Languages
- English, Français, Español and العربية (right-to-left), picked from the language menu in the header, landing, login and sign-up pages.
- Templates use the `t` pipe with the English text as key (`{{ 'Save' | t }}`, `[label]="'Save' | t"`); TypeScript uses `t('…')`, with placeholders for values (`t('Renew {0} for {1}?', { 0: plan, 1: name })`). Missing translations fall back to English.
- Dictionaries: `src/app/core/i18n/fr.ts`, `es.ts`, `ar.ts`. To add a text, use it with `t` and add the same English key to each dictionary.
- Switching language saves the choice and reloads, so Angular's `LOCALE_ID` (dates, numbers, currencies), PrimeNG's built-in texts (`core/i18n/primeng-locale.ts`) and `<html dir>` follow it. Month, day and currency names come from `Intl`, so they need no translation.
- Arabic uses the `ar-MA` locale (Latin digits) and RTL layout; templates use start/end Tailwind classes (`ms-`, `me-`, `text-start`…).
- User content (gym names, plan names, reviews…) is not translated; sport names are stored in English and translated for display.

### Currency
- Each gym has its own currency (`Gym.currency`, ISO 4217 — USD, EUR, GBP, MAD, DZD, TND, AED, SAR…), chosen at sign-up and changeable in Admin → Branding.
- Membership prices, promo codes, client payments and revenue are shown in the gym's currency with the `money` pipe (`{{ amount | money: gym.currency }}`); changing it does not convert existing amounts.
- Each membership plan can have its own currency (defaults to the gym's); memberships and payments record the currency they were paid in, and totals mixing currencies are shown per currency ("MAD 1,350 + €25").
- Coaches set the currency of their hourly rate on their profile (`CoachProfile.currency`).
- Liftly's own SaaS pricing (what gym owners pay) stays in USD.

### Payments
- `Payment` = gym + client + day + amount + method (cash / card / transfer) + note.
- Creating a subscription in Admin → Clients records its payment automatically; more can be added from the calendar (Clients table → calendar icon).

### Schedule rules
- Shown as a sideways weekly calendar: one row per day, hours across the full width (all hours visible, no vertical scroll), a "now" line on today; parallel sessions stack inside the day row. Admins click a session to edit it.
- A slot = day + open/close time + audience (`MIXED` / `MEN` / `WOMEN`) + optional sport (empty = whole gym).
- Overlapping slots on the same day and area are refused, **except** a men-only and a women-only session running in parallel (separate areas).
- Closures (holidays, maintenance) close the gym all day on a date.
- "Open now" uses the viewer's browser clock and gender; members without a gender see all sessions.

Relationships: `Gym ⟷ Coach` many-to-many (`GymCoach`), `Gym ⟷ Client` many-to-many through `ClientMembership`.

## Run

```bash
npm install
npm start          # http://localhost:4200
npm run build
```

Demo accounts (password `demo`, or use the one-click buttons on /login):
`super@liftly.io`, `admin@irontemple.io`, `admin@bluewave.io`, `admin@kumite.io` (gym on a trial ending soon), `coach@liftly.io`, `staff@liftly.io` (front desk at Iron Temple), `client@liftly.io`, `amine@liftly.io` (on the waitlist for *Powerlifting basics*).
Super-admin → Users → "Reset demo data" restores the seed.

## PrimeNG license

PrimeNG 22 shows an **"Invalid PrimeUI License"** banner unless a license key is configured.
Get one at https://primeui.dev/licenses and paste it into `src/app/core/app-settings.ts`.

## Structure

Every component lives in its own folder with three files — `name.ts` (logic), `name.html` (template) and `name.css` (styles; Tailwind utilities are used in the templates, so most are empty):

```
src/app/
  app.ts / app.html / app.css      root component
  app.routes.ts, app.config.ts
  core/        models.ts, seed.ts, store.service.ts (mock backend, localStorage), auth.service.ts,
               guards.ts, theme.service.ts (white-label palette), schedule.ts, currency.ts (+ money pipe), icons.ts,
               i18n/ (t pipe + translations fr / es / ar, PrimeNG locale)
  layout/
    shell/                         role-based sidebar, gym switcher, dark mode
  shared/
    page-header/  stat-card/  stars/  coach-card/
    audience-tag/  open-status/  week-schedule/  week-calendar/
    payment-calendar/  language-switcher/  chart-card/  sport-dialog/
    gym-logo/  logo-upload/  surface-picker/  appearance-switcher/
  pages/
    public/       landing/  login/  signup/
    super-admin/  sa-dashboard/  sa-gyms/  sa-plans/  sa-users/  sa-currencies/  sa-settings/
    admin/        admin-dashboard/  admin-memberships/  admin-promos/  admin-clients/
                  admin-coaches/  admin-schedule/  admin-sports/  admin-branding/  admin-billing/
    reports/      coach reports (admin + super-admin)
    coach/        coach-dashboard/  coach-reviews/  coach-profile/
    client/       client-dashboard/  client-gyms/  client-coaches/
```

### Wiring a real backend
All data goes through `StoreService`. Replace its methods with `HttpClient` calls (or resources)
and replace `AuthService.login` with your JWT flow. Payment in sign-up/billing is a mock: plug in Stripe or your payment provider there.

### Theming
`ThemeService` builds a 50–950 palette from the gym's hex color and calls PrimeNG `updatePrimaryPalette`.
`tailwindcss-primeui` maps the palette to Tailwind classes (`bg-primary`, `text-primary-600`…), so PrimeNG components and Tailwind utilities change color together.

### Buttons (PrimeNG 22)
Buttons use the `pButton` directive on native elements, not the `<p-button>` component, and `(click)`, not `(onClick)`. The icon and label are content marked with `pButtonIcon` / `pButtonLabel`. Use `iconOnly` for icon-only buttons and `type="button"` unless it submits a form. Links and file-upload labels use the same directive (`<a pButton routerLink=…>`, `<label pButton>`).

```html
<button pButton type="button" severity="secondary" [outlined]="true" (click)="save()">
  <fa-icon pButtonIcon icon="check" /><span pButtonLabel>{{ 'Save' | t }}</span>
</button>
<button pButton type="button" iconOnly [text]="true" [rounded]="true" (click)="remove()"><fa-icon pButtonIcon icon="trash" /></button>
```
Import `ButtonDirective` (plus `ButtonIcon` / `ButtonLabel` when used) from `primeng/button`.

### Icons
Font Awesome icons are registered in `core/icons.ts` (tree-shaken). Add new ones there before using `<fa-icon icon="name" />`.
