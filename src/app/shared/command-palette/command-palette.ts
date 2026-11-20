import { Component, ElementRef, computed, inject, input, signal, viewChild } from '@angular/core';
import { Router } from '@angular/router';
import { IconProp } from '@fortawesome/fontawesome-svg-core';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import { Dialog } from 'primeng/dialog';
import { AuthService } from '../../core/auth.service';
import { TranslatePipe, t } from '../../core/i18n/i18n';
import { StoreService } from '../../core/store.service';
import { Modal } from '../modal/modal';

export interface PaletteLink { label: string; icon: IconProp; link: string }
interface Hit { label: string; hint: string; icon: IconProp; link: string; group: string }

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
/** `g` + key jumps to the nav item whose link ends with this segment. */
export const GO_KEYS: Record<string, { seg: string; label: string }> = {
  h: { seg: '', label: 'Home' }, m: { seg: 'messages', label: 'Messages' }, c: { seg: 'classes', label: 'Classes' },
  s: { seg: 'schedule', label: 'Schedule' }, a: { seg: 'announcements', label: 'Announcements' }, u: { seg: 'clients', label: 'Clients' },
  p: { seg: 'plans', label: 'Plans' }, r: { seg: 'reports', label: 'Reports' }, b: { seg: 'accounting', label: 'Accounting' },
};

/** Ctrl+K / ⌘K search across pages and the current user's data, plus global keyboard shortcuts. */
@Component({
  selector: 'app-command-palette',
  imports: [FaIconComponent, Dialog, TranslatePipe, Modal],
  templateUrl: './command-palette.html',
  host: { '(document:keydown)': 'onKey($event)' },
})
export class CommandPalette {
  readonly pages = input.required<PaletteLink[]>();
  private readonly store = inject(StoreService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly box = viewChild<ElementRef<HTMLInputElement>>('box');

  protected readonly visible = signal(false);
  protected readonly help = signal(false);
  protected readonly query = signal('');
  protected readonly active = signal(0);
  protected readonly goKeys = Object.entries(GO_KEYS);
  private pendingG = 0;

  private readonly records = computed<Hit[]>(() => {
    const u = this.auth.user(); if (!u) return [];
    const gym = this.auth.activeGym();
    const out: Hit[] = [];
    const base = u.role === 'STAFF' ? '/staff' : '/admin';
    if ((u.role === 'ADMIN' || u.role === 'STAFF') && gym) {
      for (const c of this.store.clientsOfGym(gym.id)) out.push({ label: `${c.firstName} ${c.lastName}`, hint: c.email, icon: 'user', link: `${base}/clients?q=${encodeURIComponent(c.firstName + ' ' + c.lastName)}`, group: t('Members') });
      for (const k of this.store.classesOfGym(gym.id)) out.push({ label: k.name, hint: `${t(DAYS[k.day])} ${k.start}`, icon: 'calendar-check', link: `${base}/classes`, group: t('Classes') });
      if (u.role === 'ADMIN') for (const c of this.store.coachesOfGym(gym.id)) out.push({ label: `${c.firstName} ${c.lastName}`, hint: t('Coach'), icon: 'user-tie', link: '/admin/coaches', group: t('Coaches') });
    }
    if (u.role === 'COACH') for (const a of this.store.athletesOf(u.id)) out.push({ label: `${a.firstName} ${a.lastName}`, hint: a.email, icon: 'user', link: '/coach/athletes', group: t('Athletes') });
    if (u.role === 'SUPER_ADMIN' || u.role === 'CLIENT') for (const g of this.store.gyms()) out.push({ label: g.name, hint: g.city, icon: 'dumbbell', link: `/gyms/${g.id}`, group: t('Gyms') });
    if (u.role === 'CLIENT') for (const g of this.store.gymsOfClient(u.id)) for (const k of this.store.classesOfGym(g.id)) out.push({ label: k.name, hint: `${g.name} · ${t(DAYS[k.day])} ${k.start}`, icon: 'calendar-check', link: '/client/classes', group: t('Classes') });
    return out;
  });

  protected readonly hits = computed<Hit[]>(() => {
    const q = this.query().trim().toLowerCase();
    const pages: Hit[] = this.pages().map((p) => ({ label: t(p.label), hint: t('Page'), icon: p.icon, link: p.link, group: t('Pages') }));
    if (!q) return pages.slice(0, 8);
    const match = (h: Hit) => h.label.toLowerCase().includes(q) || h.hint.toLowerCase().includes(q);
    return [...pages.filter(match), ...this.records().filter(match)].slice(0, 30);
  });
  protected readonly groups = computed(() => {
    const m = new Map<string, { hit: Hit; i: number }[]>();
    this.hits().forEach((hit, i) => m.set(hit.group, [...(m.get(hit.group) ?? []), { hit, i }]));
    return [...m.entries()].map(([name, items]) => ({ name, items }));
  });

  openPalette() { this.query.set(''); this.active.set(0); this.visible.set(true); setTimeout(() => this.box()?.nativeElement.focus(), 50); }

  onKey(e: KeyboardEvent) {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); this.visible() ? this.visible.set(false) : this.openPalette(); return; }
    const el = e.target as HTMLElement;
    if (this.visible() || e.ctrlKey || e.metaKey || e.altKey || el?.closest('input, textarea, select, [contenteditable="true"], .p-dialog')) return;
    if (e.key === '/') { e.preventDefault(); this.openPalette(); return; }
    if (e.key === '?') { e.preventDefault(); this.help.set(true); return; }
    if (e.key === 'g') { this.pendingG = Date.now(); return; }
    if (this.pendingG && Date.now() - this.pendingG < 1200 && GO_KEYS[e.key]) {
      this.pendingG = 0;
      const seg = GO_KEYS[e.key].seg;
      const links = this.pages().map((p) => p.link);
      const target = seg ? links.find((l) => l.endsWith('/' + seg)) : links[0];
      if (target) { e.preventDefault(); this.router.navigateByUrl(target); }
    }
  }

  onBoxKey(e: KeyboardEvent) {
    const n = this.hits().length;
    if (e.key === 'ArrowDown') { e.preventDefault(); this.active.set(n ? (this.active() + 1) % n : 0); this.scroll(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); this.active.set(n ? (this.active() - 1 + n) % n : 0); this.scroll(); }
    else if (e.key === 'Enter') { e.preventDefault(); const h = this.hits()[this.active()]; if (h) this.go(h); }
  }
  private scroll() { setTimeout(() => document.querySelector(`[data-hit="${this.active()}"]`)?.scrollIntoView({ block: 'nearest' })); }
  setQuery(v: string) { this.query.set(v); this.active.set(0); }
  go(h: Hit) { this.visible.set(false); this.router.navigateByUrl(h.link); }
}
