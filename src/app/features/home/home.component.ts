import { Component, computed, inject, signal } from '@angular/core';
import { AuthService } from '../../core/services/auth.service';
import { SoundService } from '../../core/services/sound.service';
import { ButtonComponent } from '../../shared/components/ui/button.component';
import { LogoComponent } from '../../shared/components/ui/logo.component';
import { ModalComponent } from '../../shared/components/ui/modal.component';
import { SpinnerComponent } from '../../shared/components/ui/spinner.component';
import { ICONS } from '../../shared/icons';
import { CreateFlowComponent } from './flows/create-flow.component';
import { JoinFlowComponent } from './flows/join-flow.component';
import { HeroComponent } from './sections/hero.component';
import { HomeBackgroundComponent } from './sections/home-background.component';
import { HowItWorksComponent } from './sections/how-it-works.component';
import { ProductPreviewComponent } from './sections/product-preview.component';
import { SiteFooterComponent } from './sections/site-footer.component';
import { SocialSectionComponent } from './sections/social-section.component';

@Component({
  selector: 'app-home',
  imports: [
    LogoComponent,
    ModalComponent,
    SpinnerComponent,
    HeroComponent,
    HomeBackgroundComponent,
    HowItWorksComponent,
    ProductPreviewComponent,
    SocialSectionComponent,
    SiteFooterComponent,
    CreateFlowComponent,
    JoinFlowComponent,
  ],
  templateUrl: './home.component.html',
})
export class HomeComponent {
  private readonly auth = inject(AuthService);
  protected readonly soundService = inject(SoundService);

  readonly authReady = this.auth.ready;
  readonly authError = this.auth.error;
  readonly showCreateModal = signal(false);
  readonly showJoinModal = signal(false);
  readonly soundEnabled = this.soundService.enabled;
  protected readonly ICONS = ICONS;

  protected readonly volumeIcon = computed(() =>
    this.soundEnabled() ? ICONS['volume2'] : ICONS['volumeX'],
  );

  protected openCreate(): void {
    this.showCreateModal.set(true);
  }

  protected openJoin(): void {
    this.showJoinModal.set(true);
  }

  protected closeJoin(): void {
    this.showJoinModal.set(false);
  }

  protected toggleSound(): void {
    this.soundService.toggle();
  }
}
