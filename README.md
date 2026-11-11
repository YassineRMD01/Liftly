# Liftly — multi-tenant gym management front-end

Angular 22 · Tailwind CSS 4 · PrimeNG 22 · Font Awesome · signals, zoneless, standalone components.

Works for any sport (gym, pool, dojo, court…). Four roles:

| Role | What they can do |
|---|---|
| **Super-admin** | Platform KPIs and **charts** (MRR trend, new users, gyms by country, reports), manage the SaaS **pricing plans** with **local prices per country**, **currencies & countries** (exchange rates for stats), the **home theme** and the **sport catalog** (Settings), review **coach reports** of every gym, change a gym's plan/status (active / trial / suspended), activate/deactivate users, impersonate |
| **Gym admin** | Dashboard **charts** (revenue, active members, clients by status, members by plan) and gym rating; manages the gym's **sports** (catalog or custom, with icons); **renews** memberships with an optional **plan change**; **bans / unbans** clients (client status Active / Expired / Banned); reviews **coach reports**; runs a gym with **one or more sports**, manages the **weekly schedule** (opening/closing hours per day as mixed, men-only or women-only sessions, for the whole gym or one sport/area; templates, copy-a-day, holiday closures, overlap checks), manages each client's **payments on a yearly calendar** (click any day to add / edit / delete a payment: amount, method, note; months covered by a membership are highlighted; yearly and all-time totals), subscribes to a SaaS plan (sign-up + billing page: upgrade/downgrade, monthly↔yearly), **custom theme color & logo** (live preview, Pro+ plans), membership plans CRUD, **promo codes** (% or fixed, date range, max uses, plan restriction), **registers clients** — the only way a member account or membership is created (new account with temporary password `welcome`, add / renew / cancel / assign coach, apply promo), link coaches from the network or invite new ones; plan limits are enforced |
| **Coach** | Works at **many gyms**, dashboard of gyms & assigned athletes, **star ratings & comments** with rating breakdown, editable public profile |
| **Client** | Account and memberships are **created only by the gym admin** (no self sign-up, no self checkout). Can be a member of **many gyms**, browses gyms (sports, plans, coaches, hours), sees live *open now* status, the gym schedule as a **weekly calendar** (hours open to them by gender), their **own payments** on the yearly calendar (read-only), **rates & reviews coaches** (1 review per coach per gym), **rates gyms**, **reports a coach** for inappropriate behavior |

### Country pricing, currencies & themes
- Gyms have a **country**. Each SaaS plan has a USD price plus optional **local prices per country** (in that country's currency); the pricing page, sign-up and billing show the price for the gym's country. MRR is converted to USD with the super-admin's exchange rates.
- The super-admin manages **currencies** (active, rate to USD) and **countries** (default currency, active).
- **Themes:** each gym has its own theme (Branding); the public site (home, pricing, login) and users outside a gym use the **platform theme** set by the super-admin in Settings.

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
- Shown as a weekly time-grid calendar (Mon → Sun, hour rows, "now" line); parallel sessions sit side by side. Admins click a session to edit it.
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
`super@liftly.io`, `admin@irontemple.io`, `admin@bluewave.io`, `coach@liftly.io`, `client@liftly.io`.
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

### Icons
Font Awesome icons are registered in `core/icons.ts` (tree-shaken). Add new ones there before using `<fa-icon icon="name" />`.
