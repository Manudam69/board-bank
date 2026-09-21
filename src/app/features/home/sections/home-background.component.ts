import { Component } from '@angular/core';

@Component({
  selector: 'app-home-background',
  template: `
    <div class="pointer-events-none fixed inset-0 -z-10 overflow-hidden" aria-hidden="true">
      <svg
        class="absolute left-[5%] top-[12%] h-24 w-24 text-text opacity-[0.04] blur-[2px] animate-float-slow"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1"
      >
        <rect x="3" y="3" width="18" height="18" rx="4" />
        <circle cx="8" cy="8" r="1.5" fill="currentColor" stroke="none" />
        <circle cx="16" cy="8" r="1.5" fill="currentColor" stroke="none" />
        <circle cx="8" cy="16" r="1.5" fill="currentColor" stroke="none" />
        <circle cx="16" cy="16" r="1.5" fill="currentColor" stroke="none" />
        <circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" />
      </svg>

      <svg
        class="absolute right-[-5%] top-[20%] h-40 w-40 text-text opacity-[0.03] blur-[1px] animate-float-reverse"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1"
      >
        <rect x="2" y="6" width="20" height="12" rx="2" />
        <line x1="2" y1="12" x2="22" y2="12" />
      </svg>

      <svg
        class="absolute bottom-[25%] left-[-3%] h-32 w-32 text-accent opacity-[0.04] blur-[2px] animate-float"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1"
      >
        <path d="M12 3l9 8v10H3V11l9-8z" />
        <rect x="7" y="13" width="10" height="8" rx="1" />
      </svg>

      <svg
        class="absolute bottom-[15%] right-[8%] h-28 w-28 text-positive opacity-[0.03] blur-[1px] animate-float-slow"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1"
      >
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v2.5M12 13.5V16M8 10h8M8 14h8" />
      </svg>

      <svg
        class="absolute left-[40%] top-[45%] h-20 w-20 text-text opacity-[0.02] blur-[3px] animate-float-reverse"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1"
      >
        <path d="M3 21h18M5 21V8l7-4 7 4v13M8 11h8M8 15h8" />
      </svg>
    </div>
  `,
})
export class HomeBackgroundComponent {}
