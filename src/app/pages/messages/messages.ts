import { Component, ElementRef, computed, effect, inject, signal, untracked, viewChild } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import { Avatar } from 'primeng/avatar';
import { ButtonDirective, ButtonIcon } from 'primeng/button';
import { InputText } from 'primeng/inputtext';
import { Select } from 'primeng/select';
import { AuthService } from '../../core/auth.service';
import { TranslatePipe, t } from '../../core/i18n/i18n';
import { User } from '../../core/models';
import { StoreService } from '../../core/store.service';
import { PageHeader } from '../../shared/page-header/page-header';

/** Direct messages between members, coaches, admins and front desk (same page for every role). */
@Component({
  selector: 'app-messages',
  imports: [TranslatePipe, DatePipe, FormsModule, FaIconComponent, Avatar, ButtonDirective, ButtonIcon, InputText, Select, PageHeader],
  templateUrl: './messages.html',
  styleUrl: './messages.css',
})
export class Messages {
  private readonly auth = inject(AuthService);
  protected readonly store = inject(StoreService);
  private readonly route = inject(ActivatedRoute);
  private readonly scroller = viewChild<ElementRef<HTMLElement>>('scroller');

  protected readonly me = computed(() => this.auth.user()?.id ?? '');
  protected readonly other = signal<string | null>(this.route.snapshot.queryParamMap.get('to'));
  protected readonly draft = signal('');
  protected readonly conversations = computed(() => this.store.conversationsOf(this.me()));
  protected readonly contacts = computed(() => this.store.contactsOf(this.me()).map((u) => ({ id: u.id, label: `${u.firstName} ${u.lastName} · ${t(this.roleOf(u))}` })));
  protected readonly thread = computed(() => (this.other() ? this.store.thread(this.me(), this.other()!) : []));
  protected readonly otherUser = computed(() => this.store.user(this.other() ?? undefined));
  protected readonly canWrite = computed(() => !!this.other() && this.store.contactsOf(this.me()).some((u) => u.id === this.other()));

  constructor() {
    // open conversation: mark as read and scroll to the latest message
    effect(() => {
      const o = this.other();
      this.thread().length;
      untracked(() => {
        if (o) this.store.markThreadRead(this.me(), o);
        queueMicrotask(() => { const el = this.scroller()?.nativeElement; if (el) el.scrollTop = el.scrollHeight; });
      });
    });
  }

  roleOf(u: User) { return ({ ADMIN: 'Gym admin', COACH: 'Coach', CLIENT: 'Member', STAFF: 'Front desk', SUPER_ADMIN: 'Super admin' } as const)[u.role]; }
  initials(id: string) { const u = this.store.user(id); return u ? (u.firstName[0] + u.lastName[0]).toUpperCase() : '?'; }

  start(id: string | null) { if (id) this.other.set(id); }
  send() {
    const o = this.other();
    if (!o || !this.draft().trim()) return;
    this.store.sendMessage(this.me(), o, this.draft());
    this.draft.set('');
  }
}
