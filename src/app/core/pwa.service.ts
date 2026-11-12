import { Injectable, inject, signal } from '@angular/core';
import { SwUpdate } from '@angular/service-worker';
import { filter } from 'rxjs';

interface InstallPromptEvent extends Event { prompt(): Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>; }

/** Installable app (beforeinstallprompt) and new-version detection from the service worker. */
@Injectable({ providedIn: 'root' })
export class PwaService {
  private readonly updates = inject(SwUpdate);
  private deferred: InstallPromptEvent | null = null;
  /** The browser offers to install the app. */
  readonly canInstall = signal(false);
  /** A new version was downloaded and is ready after a reload. */
  readonly updateReady = signal(false);
  readonly installed = signal(typeof window !== 'undefined' && window.matchMedia?.('(display-mode: standalone)').matches);

  constructor() {
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      this.deferred = e as InstallPromptEvent;
      this.canInstall.set(true);
    });
    window.addEventListener('appinstalled', () => { this.canInstall.set(false); this.installed.set(true); });
    if (this.updates.isEnabled) {
      this.updates.versionUpdates.pipe(filter((e) => e.type === 'VERSION_READY')).subscribe(() => this.updateReady.set(true));
    }
  }

  async install() {
    if (!this.deferred) return;
    await this.deferred.prompt();
    await this.deferred.userChoice;
    this.deferred = null;
    this.canInstall.set(false);
  }

  reload() { document.location.reload(); }
}
