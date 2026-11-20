import { Injectable, inject } from '@angular/core';
import { MessageService } from 'primeng/api';
import { t } from './i18n/i18n';
import { DbState } from './models';
import { StoreService } from './store.service';

/**
 * "Undo" instead of "Are you sure?": the action runs at once and a toast offers to undo it for a few
 * seconds. Only the listed collections are restored, so other changes made meanwhile are kept.
 */
@Injectable({ providedIn: 'root' })
export class UndoService {
  private readonly store = inject(StoreService);
  private readonly toast = inject(MessageService);
  private readonly pending = new Map<string, () => void>();

  run(summary: string, keys: (keyof DbState)[], action: () => void, detail?: string) {
    const restore = this.store.snapshot(keys);
    action();
    const id = Math.random().toString(36).slice(2);
    this.pending.set(id, restore);
    setTimeout(() => this.pending.delete(id), 8000);
    this.toast.add({ severity: 'info', summary, detail, life: 6000, data: { undoId: id } });
  }
  canUndo(id: string | undefined) { return !!id && this.pending.has(id); }
  undo(id: string) {
    const restore = this.pending.get(id);
    if (!restore) return;
    restore();
    this.pending.delete(id);
    this.toast.clear();
    this.toast.add({ severity: 'success', summary: t('Undone'), life: 1500 });
  }
}
