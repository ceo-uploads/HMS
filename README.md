# Kabirhat Private Hospital & Normal Delivery Center

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

This creates `release/Kabirhat-Private-Hospital-Setup-<version>.exe`, an NSIS per-user installer, plus `latest.yml` and block-map metadata required by `electron-updater`.

## Publish an update

1. Increase `version` in `package.json` (for example, `1.0.0` to `1.0.1`).
2. Set a GitHub token with permission to publish releases in the current PowerShell session. Never commit or share the token:

```powershell
$env:GH_TOKEN = 'your-token'
```

3. Publish the installer and update metadata to the configured `ceo-uploads/HMS` GitHub release:

```powershell
npm run publish
```

Installed applications can check the release from Management > Dev Tunnel. Users explicitly start the download, see its progress and log, then restart to install. The updater is disabled for development runs. GitHub must host published releases, and a new release must have a version greater than the installed app.

The repository currently has no published GitHub release. Publish the first installer before expecting the in-app check to find an update.

The installer updates application files only. The JSON database and copied assets remain in `%APPDATA%/hmss-desktop/`; keep routine backups separately.

## Local data

When running with `npm start`, records are stored in the three JSON files under `Database/`: `clinic-test-db.json` (users, tests, referrals and diagnostic bills), `doctor-appointment-db.json` (doctors and appointments), and `cabin-bookings-db.json` (cabins and indoor bookings). The browser-only preview fallback uses browser storage; the Electron app uses the JSON files. The installed application stores the same three files in `%APPDATA%/hmss-desktop/Database/` so updates do not overwrite or require writing to the installation directory. Existing `%APPDATA%/hmss-desktop/hospital-data.json` records are migrated to the three files on first launch after this change. Profile photos are copied locally into `assets/doctors/`, `assets/marketing_agent/` or `assets/Special_Referrer/` while running from source, and into the equivalent per-user assets folders in the installed application. No remote services are required.

The starter catalog is written on first launch. The built-in sign-in is a basic local gate, not a security boundary: JSON data and credentials are not encrypted. Use this build with demo data only until proper account controls, encrypted storage and backups are implemented.

## Included workflows

- Diagnostics bills, discounts, advances, due balances, report handover and printable slips
- Doctor directory, live and reserved visits, patient history and visit slips
- Cabin availability, admission payments, renewals, release and booking history
- Management of tests, doctors, cabins, marketing agents and special referrers
- Searchable activity archive with date/status filters, doctor referral metrics, activity trends, payment summaries, test rankings, cabin utilization and paginated analytics
- Printable indoor bills with client and office copies on one A4 sheet; test cash memos use A5 paper, with black high-contrast text and the Unreal Studio icon credit

Right-click menus are disabled. The application uses custom in-app dialogs and stores its operational data locally so the persistence layer can later be replaced or extended for Firebase Realtime Database.