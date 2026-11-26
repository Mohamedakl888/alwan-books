# ألوان | Alwan Books

Arabic RTL personalized coloring-book website. Built with static HTML, CSS and JavaScript.

## Local preview

```sh
npm install
```

Set a strong admin password (at least 16 characters) and start the backend.

```sh
export ADMIN_PASSWORD="replace-with-a-random-secret-at-least-16-chars"
npm run dev
```

PowerShell on Windows:

```powershell
$env:ADMIN_PASSWORD="replace-with-a-random-secret-at-least-16-chars"
npm run dev
```

Open http://localhost:8080 for the website, or http://localhost:8080/control for the separate orders dashboard. The dashboard is not linked from the storefront. Sign in with username `admin` and the configured password. The dashboard fails closed unless `ADMIN_PASSWORD` is at least 16 characters.
The frontend has no build step.

## Database and backend setup

The backend uses Supabase PostgreSQL and a private Supabase Storage bucket for child photos. The Supabase CLI is configured in `supabase/config.jsonc`. To apply database migrations from a terminal, authenticate and link the project, then push the migration:

```sh
npx supabase login
npx supabase link --project-ref <project-ref>
npx supabase db push
```

`supabase link` may prompt for the database password; enter it only in the local terminal, never in chat or source files. Alternatively, run `supabase/migrations/20261126020448_initial_schema.sql` and the later migration files in `supabase/migrations/` in the Supabase SQL Editor. After applying the schema, configure these server environment variables in Hostinger:

- `SUPABASE_URL`
- `SUPABASE_SECRET_KEY` (server only; alternatively, legacy `SUPABASE_SERVICE_ROLE_KEY`; never put either in browser code)
- `SUPABASE_PHOTO_BUCKET` (optional; defaults to `child-photos`)
- `SUPABASE_GENERATED_BUCKET` (optional; defaults to `generated-books`)
- `ADMIN_PASSWORD`

Without the Supabase URL and server secret key, order APIs return HTTP 503 rather than silently writing to local JSON. The local `data/orders.json` file is not changed by the migration tool. To inspect its order count first, run `npm run migrate:supabase`; after applying the SQL and configuring the environment, run `npm run migrate:supabase -- --apply` to idempotently import existing orders and photos. It keeps the local JSON file unchanged.

Child photos are normalized server-side to JPEG, resized to at most 1600 px, and compressed below 4 MB before upload to the private bucket. They and generated files are retained until an administrator or the preview owner deletes them; there is no automatic expiration. Parents must consent before an image is sent to OpenAI for review and illustration generation. The browser also checks for a single clear, front-facing face before checkout. Keep private-bucket access server-side and use the dashboard or the preview's deletion control to remove stored content.

The database has `preview_sessions`, `generation_jobs`, and `generation_job_dependencies` tables plus a private `generated-books` bucket. A free-preview request stores a resumable token and queues a photo-review job followed by two preview pages. After verified payment, the backend queues photo-review, illustration, and PDF-assembly jobs; the dashboard shows status and can retry failed jobs. Apply every migration, including `20261126033000_generation_worker.sql`, before starting the worker.

The worker is a separate, long-running Node.js process. Configure `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `OPENAI_API_KEY`, and `GENERATION_WORKER_ENABLED=true` in the worker's server environment, then run `npm run worker`. It uses `OPENAI_REVIEW_MODEL` (default `gpt-6.2-astra`) for photo-quality checks and `OPENAI_IMAGE_MODEL` (default `gpt-image-2.6-sunburst`) for line-art pages. It saves generated images and PDFs only to the private bucket, retries temporary failures with backoff, and leaves uncertain photos for an administrator to review. Keep the worker disabled until the credentials, migration, and a persistent process manager are configured; each book page requires an image-generation request and may incur OpenAI charges. Never put API keys in browser code or this repository.

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

Deploy the Node.js project root as a Node.js app on Hostinger and set the variables above in its app environment. Run `npm run worker` as a separate persistent process; do not start a second copy of the HTTP server for the worker. Publishing only the `dist` directory provides a static preview without the backend or dashboard APIs. Use HTTPS and strong server-side secrets in production.

## Current scope

Includes the landing page, personalization form, local face screening, server-side image normalization/compression, resumable preview/job records, package selection, Supabase-backed order API and admin dashboard, private photo and generated-file storage, saved story templates, a separately enabled OpenAI generation worker with PDF assembly, TAP hosted payments, and opt-in Meta WhatsApp order updates. TAP, Meta, SMTP, and OpenAI require their server-side credentials; WhatsApp also requires an approved Meta template. The non-personalized sample illustrations remain pre-generated examples. Trial requests are stored, but no verification code is sent.

Do not commit API keys, the `data` directory, or customer data. The local JSON file is kept unchanged as a migration source/backup; runtime order APIs use Supabase. Child photos and generated content remain in private storage until manually deleted.
