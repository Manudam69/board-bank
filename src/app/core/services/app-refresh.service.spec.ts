import { DOCUMENT } from '@angular/common';
import { TestBed } from '@angular/core/testing';
import { SwUpdate } from '@angular/service-worker';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppRefreshService } from './app-refresh.service';

describe('AppRefreshService', () => {
  const reload = vi.fn();
  const updates = {
    isEnabled: true,
    checkForUpdate: vi.fn<() => Promise<boolean>>(),
    activateUpdate: vi.fn<() => Promise<boolean>>(),
  };

  beforeEach(() => {
    vi.resetAllMocks();
    updates.isEnabled = true;
    updates.checkForUpdate.mockResolvedValue(true);
    updates.activateUpdate.mockResolvedValue(true);
    TestBed.configureTestingModule({
      providers: [
        { provide: DOCUMENT, useValue: { defaultView: { location: { reload } } } },
        { provide: SwUpdate, useValue: updates },
      ],
    });
  });

  it('downloads and activates the available version before reloading', async () => {
    updates.checkForUpdate.mockImplementation(async () => {
      expect(updates.activateUpdate).not.toHaveBeenCalled();
      expect(reload).not.toHaveBeenCalled();
      return true;
    });
    updates.activateUpdate.mockImplementation(async () => {
      expect(reload).not.toHaveBeenCalled();
      return true;
    });
    await TestBed.inject(AppRefreshService).reload();
    expect(updates.checkForUpdate).toHaveBeenCalledOnce();
    expect(updates.activateUpdate).toHaveBeenCalledOnce();
    expect(reload).toHaveBeenCalledOnce();
  });

  it('activates a previously downloaded version even if the check finds nothing new', async () => {
    updates.checkForUpdate.mockResolvedValue(false);
    await TestBed.inject(AppRefreshService).reload();
    expect(updates.activateUpdate).toHaveBeenCalledOnce();
    expect(reload).toHaveBeenCalledOnce();
  });

  it('reloads normally outside the PWA', async () => {
    updates.isEnabled = false;
    await TestBed.inject(AppRefreshService).reload();
    expect(updates.checkForUpdate).not.toHaveBeenCalled();
    expect(reload).toHaveBeenCalledOnce();
  });

  it('propagates update failures without reporting a successful reload', async () => {
    const error = new Error('Sin conexión');
    updates.checkForUpdate.mockRejectedValue(error);
    await expect(TestBed.inject(AppRefreshService).reload()).rejects.toBe(error);
    expect(reload).not.toHaveBeenCalled();
  });

  it('does not reload later if an update check exceeds the indicator timeout', async () => {
    let finish: (value: boolean) => void = () => {};
    updates.checkForUpdate.mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
    const clock = vi.spyOn(performance, 'now').mockReturnValue(0);
    try {
      const request = TestBed.inject(AppRefreshService).reload();
      clock.mockReturnValue(10_000);
      finish(true);
      await expect(request).rejects.toThrow('caducado');
      expect(updates.activateUpdate).not.toHaveBeenCalled();
      expect(reload).not.toHaveBeenCalled();
    } finally {
      clock.mockRestore();
    }
  });
});
