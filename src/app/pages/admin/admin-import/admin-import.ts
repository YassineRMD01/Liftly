import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MessageService } from 'primeng/api';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import { ButtonDirective } from 'primeng/button';
import { Checkbox } from 'primeng/checkbox';
import { Select } from 'primeng/select';
import { Tag } from 'primeng/tag';
import { AuthService } from '../../../core/auth.service';
import { downloadCsv, parseCsv } from '../../../core/csv';
import { TranslatePipe, t } from '../../../core/i18n/i18n';
import { Gender } from '../../../core/models';
import { StoreService } from '../../../core/store.service';
import { PageHeader } from '../../../shared/page-header/page-header';

type Field = 'firstName' | 'lastName' | 'fullName' | 'email' | 'phone' | 'gender' | 'plan' | 'start';
export const FIELD_LABEL: Record<Field, string> = { firstName: 'First name', lastName: 'Last name', fullName: 'Full name', email: 'Email', phone: 'Phone', gender: 'Gender', plan: 'Membership plan', start: 'Start date' };
/** Header words (en / fr / es / ar) recognised for each field. */
const GUESS: Record<Field, RegExp> = {
  firstName: /^(first|given|prénom|prenom|nombre|الاسم الأول)/i,
  lastName: /^(last|surname|family|nom de famille|^nom$|apellido|اسم العائلة|اللقب)/i,
  fullName: /^(name|full ?name|nom complet|nombre completo|الاسم)$/i,
  email: /(e-?mail|courriel|correo|البريد)/i,
  phone: /(phone|mobile|tel|téléphone|teléfono|celular|الهاتف)/i,
  gender: /(gender|sex|sexe|género|genero|الجنس)/i,
  plan: /(plan|membership|abonnement|formule|membresía|الاشتراك)/i,
  start: /(start|début|debut|inicio|البداية)/i,
};
export interface ImportRow { line: number; firstName: string; lastName: string; email: string; phone: string; gender?: Gender; planId?: string; start?: string; status: 'NEW' | 'EXISTING' | 'ERROR'; error?: string; selected: boolean; }

/** Import members from a CSV or Excel file: column matching, preview with checks, invitations. */
@Component({
  selector: 'app-admin-import',
  imports: [TranslatePipe, FormsModule, RouterLink, FaIconComponent, ButtonDirective, Checkbox, Select, Tag, PageHeader],
  templateUrl: './admin-import.html',
  styleUrl: './admin-import.css',
})
export class AdminImport {
  private readonly auth = inject(AuthService);
  protected readonly store = inject(StoreService);
  private readonly toast = inject(MessageService);
  protected readonly gym = this.auth.activeGym;
  protected readonly fieldLabel = FIELD_LABEL;
  protected readonly fields = Object.keys(FIELD_LABEL) as Field[];

  protected readonly fileName = signal('');
  protected readonly header = signal<string[]>([]);
  protected readonly data = signal<string[][]>([]);
  /** column index → field */
  protected readonly mapping = signal<Record<number, Field | null>>({});
  protected readonly defaultPlan = signal<string | null>(null);
  protected readonly createMemberships = signal(true);
  protected readonly done = signal<{ created: number; linked: number; memberships: number; invites: { name: string; email: string; link: string }[] } | null>(null);

  protected readonly plans = computed(() => this.store.plansOfGym(this.gym()?.id ?? '').filter((p) => p.active));
  protected readonly fieldOptions = computed(() => [{ value: null, label: t('Ignore') }, ...this.fields.map((f) => ({ value: f, label: t(FIELD_LABEL[f]) }))]);

  protected readonly rows = signal<ImportRow[]>([]);
  protected readonly counts = computed(() => {
    const r = this.rows();
    return { total: r.length, new: r.filter((x) => x.status === 'NEW').length, existing: r.filter((x) => x.status === 'EXISTING').length, errors: r.filter((x) => x.status === 'ERROR').length, selected: r.filter((x) => x.selected && x.status !== 'ERROR').length };
  });

  async onFile(ev: Event) {
    const input = ev.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    this.done.set(null);
    try {
      let table: string[][];
      if (/\.xlsx$/i.test(file.name)) {
        const { readSheet } = await import('read-excel-file/browser');
        table = (await readSheet(file)).map((r) => r.map((c) => (c == null ? '' : c instanceof Date ? c.toISOString().slice(0, 10) : String(c).trim())));
      } else {
        table = parseCsv(await file.text());
      }
      table = table.filter((r) => r.some((c) => c));
      if (table.length < 2) { this.toast.add({ severity: 'error', summary: t('The file has no rows to import.') }); return; }
      this.fileName.set(file.name);
      this.header.set(table[0]);
      this.data.set(table.slice(1));
      this.mapping.set(this.guess(table[0]));
      this.validate();
    } catch {
      this.toast.add({ severity: 'error', summary: t('This file could not be read. Use CSV or .xlsx.') });
    }
  }

  private guess(header: string[]) {
    const used = new Set<Field>();
    const m: Record<number, Field | null> = {};
    header.forEach((h, i) => {
      const f = this.fields.find((x) => !used.has(x) && GUESS[x].test(h.trim()));
      m[i] = f ?? null;
      if (f) used.add(f);
    });
    return m;
  }
  setMapping(col: number, f: Field | null) { this.mapping.update((m) => ({ ...m, [col]: f })); this.validate(); }

  /** Build the preview rows and check each one. */
  validate() {
    const m = this.mapping();
    const col = (f: Field) => Object.entries(m).find(([, v]) => v === f)?.[0];
    const get = (r: string[], f: Field) => { const i = col(f); return i === undefined ? '' : (r[+i] ?? '').trim(); };
    const seen = new Set<string>();
    const gymId = this.gym()?.id ?? '';
    const planByName = (name: string) => this.plans().find((p) => p.name.toLowerCase() === name.toLowerCase())?.id;
    this.rows.set(this.data().map((r, k) => {
      let firstName = get(r, 'firstName'), lastName = get(r, 'lastName');
      if (!firstName && get(r, 'fullName')) { const parts = get(r, 'fullName').split(/\s+/); firstName = parts.shift() ?? ''; lastName = lastName || parts.join(' '); }
      const email = get(r, 'email').toLowerCase();
      const g = get(r, 'gender').toLowerCase();
      const gender: Gender | undefined = /^(m|male|man|homme|h|hombre|ذكر)/.test(g) ? 'MALE' : /^(f|female|woman|femme|mujer|أنثى)/.test(g) ? 'FEMALE' : undefined;
      const planName = get(r, 'plan');
      const startRaw = get(r, 'start');
      const start = /^\d{4}-\d{2}-\d{2}/.test(startRaw) ? startRaw.slice(0, 10) : /^(\d{1,2})[/.](\d{1,2})[/.](\d{4})$/.test(startRaw) ? startRaw.replace(/^(\d{1,2})[/.](\d{1,2})[/.](\d{4})$/, (_, d, mo, y) => `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`) : undefined;
      const row: ImportRow = { line: k + 2, firstName, lastName, email, phone: get(r, 'phone'), gender, planId: planName ? planByName(planName) : undefined, start, status: 'NEW', selected: true };
      const existing = this.store.users().find((u) => u.email.toLowerCase() === email);
      if (!firstName || !lastName) { row.status = 'ERROR'; row.error = t('Name missing'); }
      else if (!/^\S+@\S+\.\S+$/.test(email)) { row.status = 'ERROR'; row.error = t('Invalid e-mail'); }
      else if (seen.has(email)) { row.status = 'ERROR'; row.error = t('Duplicate in the file'); }
      else if (existing && existing.role !== 'CLIENT') { row.status = 'ERROR'; row.error = t('E-mail used by a staff or coach account'); }
      else if (existing && this.store.isBanned(gymId, existing.id)) { row.status = 'ERROR'; row.error = t('Banned from your gym'); }
      else if (planName && !row.planId) { row.status = 'ERROR'; row.error = t('Unknown plan "{0}"', { 0: planName }); }
      else if (existing) row.status = 'EXISTING';
      seen.add(email);
      row.selected = row.status !== 'ERROR';
      return row;
    }));
  }
  toggle(r: ImportRow) { this.rows.update((list) => list.map((x) => (x === r ? { ...x, selected: !x.selected } : x))); }

  run() {
    const g = this.gym();
    if (!g) return;
    const rows = this.rows().filter((r) => r.selected && r.status !== 'ERROR');
    if (!rows.length) return;
    let created = 0, linked = 0, memberships = 0;
    const invites: { name: string; email: string; link: string }[] = [];
    for (const r of rows) {
      let user = this.store.users().find((u) => u.email.toLowerCase() === r.email);
      if (!user) {
        user = this.store.addUser({ role: 'CLIENT', firstName: r.firstName, lastName: r.lastName, email: r.email, country: g.country, ...(r.phone ? { phone: r.phone } : {}), ...(r.gender ? { gender: r.gender } : {}) });
        invites.push({ name: `${r.firstName} ${r.lastName}`, email: r.email, link: this.store.inviteLink(user) });
        created++;
      } else linked++;
      const planId = r.planId ?? this.defaultPlan();
      if (this.createMemberships() && planId) {
        this.store.subscribeClient({ gymId: g.id, clientId: user.id, planId, ...(r.start ? { start: new Date(r.start + 'T00:00:00') } : {}) });
        memberships++;
      }
    }
    this.store.log('Clients imported', `${created} new · ${linked} existing · ${memberships} memberships`, g.id);
    this.done.set({ created, linked, memberships, invites });
    this.rows.set([]); this.data.set([]);
  }
  downloadInvites() {
    const d = this.done();
    if (d) downloadCsv('invitation-links', ['Name', 'Email', 'Invitation link'], d.invites.map((i) => [i.name, i.email, i.link]));
  }
  template() {
    downloadCsv('liftly-clients-template', ['First name', 'Last name', 'Email', 'Phone', 'Gender', 'Membership plan', 'Start date'],
      [['Sara', 'Lopez', 'sara.lopez@example.com', '+1 555 0190', 'F', this.plans()[0]?.name ?? '', new Date().toISOString().slice(0, 10)]]);
  }
  sev(s: ImportRow['status']) { return ({ NEW: 'success', EXISTING: 'info', ERROR: 'danger' } as const)[s]; }
  planName(id?: string) { return this.store.plan(id)?.name; }
}
