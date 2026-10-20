# Kabirhat Private Hospital

Local-first Windows desktop application built with Electron, HTML, CSS and JavaScript.

## Run locally

Install Node.js, then run:

```powershell
npm install
npm start
```

With npm 12, Electron's binary download may require approving its install script:

```powershell
npm install-scripts approve electron
npm rebuild electron --foreground-scripts
```

The initial account is `admin` / `admin123`. Change this before using the application with real patient information.

## Build for Windows

```powershell
npm run pack
```

The packaged application is written to `release/HMSS-win32-x64/`.

## Local data

The application creates `hospital-data.json` and an `assets/` folder under Electron's per-user application data directory. On Windows this is `%APPDATA%/hmss-desktop/`. Records are stored as JSON; selected doctor photos are copied into the local assets folder. No remote services are required.

The starter catalog is written on first launch. The built-in sign-in is a basic local gate, not a security boundary: JSON data and credentials are not encrypted. Use this build with demo data only until proper account controls, encrypted storage and backups are implemented.

## Included workflows

- Diagnostics bills, discounts, advances, due balances, report handover and printable slips
- Doctor directory, live and reserved visits, patient history and visit slips
- Cabin availability, admission payments, renewals, release and booking history
- Management of tests, doctors, cabins, marketing agents and special referrers
- Searchable activity archive, date/status filters and basic operational analytics

Right-click menus are disabled. The application uses custom in-app dialogs and stores its operational data locally so the persistence layer can later be replaced or extended for Firebase Realtime Database.