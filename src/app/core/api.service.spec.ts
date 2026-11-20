import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { MessageService } from 'primeng/api';
import { ApiService } from './api.service';
import { mockBackendInterceptor } from './mock-backend.interceptor';
import { OfflineQueueService } from './offline-queue.service';
import { StoreService } from './store.service';

describe('ApiService + mock backend', () => {
  let api: ApiService;
  let store: StoreService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [provideHttpClient(withInterceptors([mockBackendInterceptor])), MessageService] });
    api = TestBed.inject(ApiService);
    store = TestBed.inject(StoreService);
    store.resetDemo();
  });
  afterEach(() => vi.restoreAllMocks());

  it('answers GET requests from the store', async () => {
    expect((await api.gyms()).length).toBe(store.gyms().length);
    expect((await api.gym('g-iron')).name).toBe(store.gym('g-iron')!.name);
    const members = await api.members('g-iron');
    expect(members.length).toBeGreaterThan(0);
    expect(members.some((m) => 'password' in m)).toBe(false);
  });

  it('returns 404 for unknown resources', async () => {
    await expect(api.gym('nope')).rejects.toMatchObject({ status: 404 });
  });

  it('records a check-in through POST', async () => {
    const before = store.checkIns().length;
    const r = await api.checkIn('g-iron', { clientId: 'u-k1', method: 'QR' });
    expect(r.ok).toBe(true);
    expect(store.checkIns().length).toBe(before + 1);
  });

  it('queues check-ins while offline and sends them later', async () => {
    const q = TestBed.inject(OfflineQueueService);
    const before = store.checkIns().length;
    const online = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    const r = await q.checkIn('g-iron', 'u-k1', 'MANUAL');
    expect(r.queued).toBe(true);
    expect(q.count()).toBe(1);
    expect(store.checkIns().length).toBe(before);
    online.mockReturnValue(true);
    await q.sync();
    expect(q.count()).toBe(0);
    expect(store.checkIns().length).toBe(before + 1);
  });
});
