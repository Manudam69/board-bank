# BoardBank

BoardBank is a digital banker for your Monopoly board games. It replaces the paper money and manual bookkeeping with a real-time, multiplayer web app: one player creates a room and shares a code, QR, or link, everyone else joins from their own phone, and all cash transfers, rent payments, property purchases, mortgages, building of houses/hotels, and player-to-player trades are tracked automatically and kept in sync across every device via Firebase.

Key features:

- **No sign-up, free, multiplayer** — join a room instantly with a short code or QR and play together.
- **Digital cash & bank operations** — pay/collect salary, taxes, rent, and transfers without handling physical bills.
- **Properties, mortgages & buildings** — buy, mortgage/unmortgage properties, and build/sell houses and hotels.
- **Trades** — propose and accept trades of cash and properties between players.
- **Multiple editions** — supports different Monopoly editions with their own board, currency, and rules.
- **Full game log & history** — every operation is recorded so you can review or undo recent actions.
- **Automatic bankruptcy & game end detection** — the last player standing wins.

This project was generated using [Angular CLI](https://github.com/angular/angular-cli) version 22.1.8.

## Development server

To start a local development server, run:

```bash
ng serve
```

Once the server is running, open your browser and navigate to `http://localhost:4200/`. The application will automatically reload whenever you modify any of the source files.

## Code scaffolding

Angular CLI includes powerful code scaffolding tools. To generate a new component, run:

```bash
ng generate component component-name
```

For a complete list of available schematics (such as `components`, `directives`, or `pipes`), run:

```bash
ng generate --help
```

## Building

To build the project run:

```bash
ng build
```

This will compile your project and store the build artifacts in the `dist/` directory. By default, the production build optimizes your application for performance and speed.

## Running unit tests

To execute unit tests with the [Vitest](https://vitest.dev/) test runner, use the following command:

```bash
ng test
```

## Running end-to-end tests

For end-to-end (e2e) testing, run:

```bash
ng e2e
```

Angular CLI does not come with an end-to-end testing framework by default. You can choose one that suits your needs.

## Additional Resources

For more information on using the Angular CLI, including detailed command references, visit the [Angular CLI Overview and Command Reference](https://angular.dev/tools/cli) page.
