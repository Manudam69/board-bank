import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./features/home/home.component').then((m) => m.HomeComponent),
  },
  {
    path: 'lobby/:roomId',
    loadComponent: () => import('./features/lobby/lobby.component').then((m) => m.LobbyComponent),
  },
  {
    path: 'game/:roomId',
    loadComponent: () => import('./features/game/game.component').then((m) => m.GameComponent),
  },
  {
    path: 'history/:roomId',
    loadComponent: () => import('./features/history/history.component').then((m) => m.HistoryComponent),
  },
  {
    path: 'editions',
    loadComponent: () => import('./features/editions/editions.component').then((m) => m.EditionsComponent),
  },
  {
    path: '**',
    redirectTo: '',
  },
];
