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

Open http://localhost:8080 for the website, or http://localhost:8080/control for the separate orders dashboard. The dashboard is not linked from the storefront. Sign in with username `admin` and the configured password.
The frontend has no build step.

## Database and backend setup

The backend uses Supabase PostgreSQL and a private Supabase Storage bucket for child photos. Create a Supabase project, run `supabase/migrations/20261126000000_initial_schema.sql` in its SQL Editor, then configure these server environment variables in Hostinger:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY` (server only; never put this in browser code)
- `SUPABASE_PHOTO_BUCKET` (optional; defaults to `child-photos`)
- `ADMIN_PASSWORD`

Without the Supabase URL and service-role key, order APIs return HTTP 503 rather than silently writing to local JSON. The local `data/orders.json` file is not changed by the migration tool. To inspect its order count first, run `npm run migrate:supabase`; after applying the SQL and configuring the environment, run `npm run migrate:supabase -- --apply` to idempotently import existing orders and unexpired photos. It keeps the local JSON file unchanged. Photos in the private bucket are removed after seven days.

To email order notifications to `wdmohamed762@gmail.com`, configure `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, and `SMTP_PASS`; optionally set `SMTP_FROM`, `SMTP_SECURE`, and `ORDER_NOTIFICATION_EMAIL`. For Gmail SMTP, use host `smtp.gmail.com`, port `465`, `SMTP_SECURE=true`, and a Google app password as `SMTP_PASS` (not your account password). Failed or unconfigured notifications are shown in the dashboard and can be retried from order details.

### TAP payments

Set `APP_URL` to the public HTTPS origin (for example, `https://your-domain.example`) and configure the server-only `TAP_SECRET_KEY`. Checkout creates an EGP hosted charge with TAP's `src_all` source. The verified webhook endpoint is `/api/webhooks/tap`; the customer return page is `/payment/return`. Payment is marked paid only after a valid TAP `hashstring` webhook whose charge ID, order reference, EGP currency, and amount match the stored order. The return page uses a separate random token to show only that order's payment status. Failed attempts can be retried from order details in `/control`. Never put the TAP key in browser code.

### WhatsApp order updates

Configure `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, and `WHATSAPP_TEMPLATE_NAME` on the server. Optionally set `WHATSAPP_TEMPLATE_LANGUAGE` (defaults to `ar`) and `META_GRAPH_API_VERSION` (defaults to `v27.0`). The approved Meta Utility template must have three body parameters in this order: order ID (`{{1}}`), status (`{{2}}`), and total (`{{3}}`). Checkout includes an optional consent checkbox; only customers who opt in receive order and payment updates. The dashboard shows delivery status and can retry a notification. No child photos are sent to WhatsApp.

The order details include a local Arabic story generator with adventure, friendship, and discovery templates. Stories can be edited, saved to Supabase, copied, or downloaded; generation does not send child information to an AI service. Order, story, and trial APIs are protected by the server's admin check where appropriate.

To check local HTML files and asset references:

```sh
npm run validate
```

## Hosting

Deploy the Node.js project root as a Node.js app on Hostinger and set the variables above in its app environment. Publishing only the `dist` directory provides a static preview without the backend or dashboard APIs. Use HTTPS and strong server-side secrets in production.

## Current scope

Includes the landing page, personalization form, image validation, local draft persistence, sample preview, package selection, Supabase-backed order API and admin dashboard, private photo storage, saved story templates, TAP hosted payments, and opt-in Meta WhatsApp order updates. Provider features remain inactive until their server-side credentials and approved Meta template are configured. Sample preview illustrations are pre-generated examples. Trial requests are stored, but no verification code is sent.

Do not commit API keys, the `data` directory, or customer data. The local JSON file is kept unchanged as a migration source/backup; runtime order APIs use Supabase. Uploaded customer photos in the private bucket are deleted after seven days.
