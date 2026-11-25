# ألوان | Alwan Books

Arabic RTL personalized coloring-book website. Built with static HTML, CSS and JavaScript.

## Local preview

```sh
npm install
```

Set an admin password and start the backend.

```sh
export ADMIN_PASSWORD="your-strong-password"
npm run dev
```

PowerShell on Windows:

```powershell
$env:ADMIN_PASSWORD="your-strong-password"
npm run dev
```

Open http://localhost:8080 for the website, or http://localhost:8080/admin for the orders dashboard. Sign in with username `admin` and the configured password. Orders are stored in `data/orders.json`; customer photos are automatically removed after seven days.
The frontend has no build step.

To check local HTML files and asset references:

```sh
npm run validate
```

## Hosting

Publishing only the `dist` directory provides a static preview, not the backend or dashboard APIs. The complete app needs a Node.js host with persistent writable storage and the `ADMIN_PASSWORD` environment variable set. Use HTTPS and a strong secret in production. The JSON file store is intended for a single server; use a database before running multiple instances or handling production orders.

## Current scope

Includes the landing page, personalization form, image validation, local draft persistence, sample preview, package selection, order API, and admin dashboard. The backend validates package choices and calculates totals. Payment processing, WhatsApp/SMS delivery, and AI personalized book generation are not connected; sample preview illustrations are pre-generated examples. Trial requests are acknowledged but do not send a verification code.

Do not commit API keys, the `data` directory, or customer data. Order details remain in the local JSON store until manually removed; uploaded customer photos are deleted automatically within seven days.
