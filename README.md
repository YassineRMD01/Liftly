# Liftly — multi-tenant gym management front-end

Angular 22 · Tailwind CSS 4 · PrimeNG 22 · Font Awesome · signals, zoneless, standalone components.

Works for any sport (gym, pool, dojo, court…). Four roles:

| Role | What they can do |
|---|---|
| **Super-admin** | Platform KPIs (MRR, gyms, users), manage the SaaS **pricing plans**, change a gym's plan/status (active / trial / suspended), activate/deactivate users, impersonate |
| **Gym admin** | Runs a gym with **one or more sports**, manages the **weekly schedule** (opening/closing hours per day as mixed, men-only or women-only sessions, for the whole gym or one sport/area; templates, copy-a-day, holiday closures, overlap checks), manages each client's **payments on a yearly calendar** (click any day to add / edit / delete a payment: amount, method, note; months covered by a membership are highlighted; yearly and all-time totals), subscribes to a SaaS plan (sign-up + billing page: upgrade/downgrade, monthly↔yearly), **custom theme color & logo** (live preview, Pro+ plans), membership plans CRUD, **promo codes** (% or fixed, date range, max uses, plan restriction), **registers clients** — the only way a member account or membership is created (new account with temporary password `welcome`, add / renew / cancel / assign coach, apply promo), link coaches from the network or invite new ones; plan limits are enforced |
| **Coach** | Works at **many gyms**, dashboard of gyms & assigned athletes, **star ratings & comments** with rating breakdown, editable public profile |
| **Client** | Account and memberships are **created only by the gym admin** (no self sign-up, no self checkout). Can be a member of **many gyms**, browses gyms (sports, plans, coaches, hours), sees live *open now* status, the gym schedule as a **weekly calendar** (hours open to them by gender), their **own payments** on the yearly calendar (read-only), **rates & reviews coaches** (1 review per coach per gym) |

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

```
src/app/
  core/       models.ts, seed.ts, store.service.ts (mock backend, localStorage),
              auth.service.ts, guards.ts, theme.service.ts (white-label palette), icons.ts
  layout/     shell.ts (role-based sidebar, gym switcher, dark mode)
  shared/     ui.ts (page header, stat card, stars, coach card)
  pages/      public/ super-admin/ admin/ coach/ client/
```

### Wiring a real backend
All data goes through `StoreService`. Replace its methods with `HttpClient` calls (or resources)
and replace `AuthService.login` with your JWT flow. Payment in sign-up/billing is a mock: plug in Stripe or your payment provider there.

### Theming
`ThemeService` builds a 50–950 palette from the gym's hex color and calls PrimeNG `updatePrimaryPalette`.
`tailwindcss-primeui` maps the palette to Tailwind classes (`bg-primary`, `text-primary-600`…), so PrimeNG components and Tailwind utilities change color together.

### Icons
Font Awesome icons are registered in `core/icons.ts` (tree-shaken). Add new ones there before using `<fa-icon icon="name" />`.
