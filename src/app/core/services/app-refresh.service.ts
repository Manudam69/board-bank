import { DOCUMENT } from '@angular/common';
import { inject, Service } from '@angular/core';
import { SwUpdate } from '@angular/service-worker';

@Service()
export class AppRefreshService {
  private readonly updates = inject(SwUpdate, { optional: true });
  private readonly document = inject(DOCUMENT);
  private request = 0;

  async reload(): Promise<void> {
    const request = ++this.request;
    const deadline = performance.now() + 10_000;
    const ensureCurrent = () => {
      if (request !== this.request || performance.now() >= deadline) {
        throw new Error('La solicitud de recarga ha caducado. Reintenta.');
      }
    };
    if (this.updates?.isEnabled) {
      await this.updates.checkForUpdate();
      ensureCurrent();
      await this.updates.activateUpdate();
    }
    ensureCurrent();
    const window = this.document.defaultView;
    if (!window) throw new Error('No se pudo acceder a la ventana de la aplicación.');
    window.location.reload();
  }
}
