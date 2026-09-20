import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    title: 'BoardBank — Crear o unirse',
    loadComponent: () => import('./features/home/home.component').then((m) => m.HomeComponent),
  },
  {
    path: 'lobby/:roomId',
    title: 'Sala — BoardBank',
    loadComponent: () => import('./features/lobby/lobby.component').then((m) => m.LobbyComponent),
  },
  {
    path: 'game/:roomId',
    title: 'Partida — BoardBank',
    loadComponent: () => import('./features/game/game.component').then((m) => m.GameComponent),
  },
  {
    path: 'history/:roomId',
    title: 'Resumen — BoardBank',
    loadComponent: () => import('./features/history/history.component').then((m) => m.HistoryComponent),
  },
  {
    path: 'editions',
    title: 'Ediciones — BoardBank',
    loadComponent: () => import('./features/editions/editions.component').then((m) => m.EditionsComponent),
  },
  {
    path: '**',
    redirectTo: '',
  },
];
