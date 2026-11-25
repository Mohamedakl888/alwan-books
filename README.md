# ألوان | Alwan Books

Arabic RTL personalized coloring-book website. Built with static HTML, CSS and JavaScript.

## Local preview

```sh
npm install
npm run dev
```

Open http://localhost:8080 . No build step or package installation is required.
Set an admin password and start the backend:

```sh
set ADMIN_PASSWORD=your-strong-password
npm run dev
```

PowerShell on Windows:

```powershell
$env:ADMIN_PASSWORD="your-strong-password"
npm run dev
```

Open the orders dashboard at http://localhost:8080/admin and sign in with username `admin` and the configured password.

To check local HTML files and asset references:

```sh
npm run validate
```

## Hosting

Publish the `dist` directory. For Vercel, select Other with no build command and output directory `dist`.

## Current scope

Includes landing page, personalization form, image validation UI, local draft persistence, example preview, size selection and checkout interface. Payments, WhatsApp delivery and AI personalized book generation require backend integrations; sample preview illustrations are pre-generated examples.

Do not commit API keys or customer data. Uploaded data is handled by the frontend; review storage and privacy behavior before production commerce.
