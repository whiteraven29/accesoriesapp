# DukaSmart

A React Native (Expo) point-of-sale and inventory app for Tanzanian phone and
accessory shops. Runs on Android, iOS and the web from one codebase.

## Features

- **Serialised handset stock** — every phone is tracked as its own IMEI unit, so
  warranty, returns and traceability work per device. Stock for these products is
  derived from the units in stock, not typed in by hand.
- **IMEI lookup** — search any IMEI to see whether the shop sold it, when, to
  whom, and whether it is still under warranty.
- **Mobile money at checkout** — M-Pesa, Mixx by Yas, Airtel Money, HaloPesa,
  Azam Pesa and bank transfer, each with its confirmation code captured.
- Customer accounts with credit (loan) ledger and earned loyalty points
- Returns and refunds, with faulty stock kept off the shelf
- Loss / write-off recording that actually reduces stock
- Expenses, reports and a profit dashboard
- English and Kiswahili, light and dark themes, both remembered per device

## Database setup

Run these in the Supabase SQL editor **in order**:

1. `supabase-schema.sql` — base tables, RLS and triggers
2. `new_update.sql` — expenses, stock movements, receipt fields
3. `migration_v3_market_features.sql` — IMEI units, mobile money, returns,
   loyalty accrual, suppliers, and the RPCs that make stock changes atomic
4. `migration_v4_fix_stock_movements.sql` — lets non-serialised sales through
   the stock-movement audit trigger
5. `migration_v5_warranty_and_imei_snapshot.sql` — the receipt keeps its own
   permanent copy of the IMEIs sold, and the seller picks the warranty term
   (3 / 6 / 12 months) per line at the till
6. `migration_v6_receipt_archive.sql` — lets a receipt be filed away without
   being destroyed; archived sales still count in reports and IMEI lookup
7. `migration_v7_winga_consignment.sql` — winga (middlemen) as a contact type,
   an agreed middleman price per product, and consignment stock: handsets that
   have left the shop but are not sold yet
8. `migration_v8_lock_down_definer_functions.sql` — revokes the default PUBLIC
   EXECUTE grant on internal trigger functions, which Supabase's database
   linter flags as reachable over the REST API

Each file is idempotent, so re-running one is safe.

**The app will not sell until step 3 has run.** `complete_sale` gains two
arguments (payment method and reference), so the new client cannot call the old
function.

### Converting existing phone stock to IMEI tracking

Step 3 leaves stock you already have exactly as it is — existing phones keep
trading on a plain piece count. Converting is a deliberate, per-product step:

1. Open the product's IMEI list (the scan icon on its row) and register a real
   IMEI for every handset on the shelf.
2. Run, in the SQL editor:
   `select public.convert_product_to_serialized('<product-id>');`

The function refuses unless the registered IMEIs match the piece count, so it
cannot silently rewrite your stock. Phones added after the migration are
serialised from the start.

## Email delivery (required before launch)

Signup confirmation and password reset both send email, and both are currently
on Supabase's **built-in SMTP**, which is capped at roughly two messages per
hour for the whole project and is explicitly not intended for production.
Testing against the live project hit the ceiling after two signups:

```
HTTP 429  {"error_code":"over_email_send_rate_limit","msg":"email rate limit exceeded"}
```

The same quota then blocked a password reset. In practice that means a shop
onboarding two staff in one afternoon will silently fail to receive the third
confirmation email.

**Configure custom SMTP** in Dashboard → Project Settings → Authentication →
SMTP Settings (Resend, Brevo, SendGrid, Amazon SES all work) and raise the rate
limit under Authentication → Rate Limits.

Also confirm, in Authentication → URL Configuration:

- **Site URL** — the deployed web address.
- **Redirect URLs** — must include the deployed web URL, `http://localhost:8081`
  for development, and `alexapp://*` for the mobile builds. A redirect that is
  not allowlisted is silently replaced with the Site URL, which is why a
  confirmation link can appear to "go to the wrong place".

Email confirmation is currently **on** (`mailer_autoconfirm: false`), so a new
user cannot sign in until they click the link. The login screen detects this and
offers to resend.

## Supabase Integration

This application is integrated with Supabase for backend services including:

- Database storage for customers, products, and sales
- Real-time updates using Supabase's real-time subscriptions
- Email/password authentication, with the session persisted on device

### Setting up Supabase

Follow the instructions in [SUPABASE_SETUP.md](SUPABASE_SETUP.md) to set up your Supabase project and configure the application.

## Getting Started

1. Install dependencies:
   ```bash
   npm install
   ```

2. Set up your Supabase project following the instructions in [SUPABASE_SETUP.md](SUPABASE_SETUP.md)

3. Configure your environment variables in the `.env` file

4. Start the development server:
   ```bash
   npm run dev
   ```

## Platform-Specific Instructions

### Web
To run the app on the web:

1. Start the development server:
   ```bash
   npm run dev
   ```
   Then press `w` in the terminal to open in web browser, or visit `http://localhost:8081`

2. To build for production:
   ```bash
   npm run build:web
   ```
   This will create a `dist` folder with the web build.

### Android
To run the app on Android:

1. Install Expo Go on your Android device from the Google Play Store

2. Start the development server:
   ```bash
   npm run dev
   ```
   Then scan the QR code with Expo Go app

3. To build a production APK:
   ```bash
   npm run build:android
   ```
   This will create an APK file for distribution.

## Project Structure

- `app/` - Expo Router pages (`(tabs)/` is the signed-in app, `auth/` the entry flow)
- `components/` - Shared UI: layout shell, primitives, IMEI manager
- `constants/` - Design tokens (`theme.ts`) and the single breakpoint source (`layout.ts`)
- `hooks/` - Data hooks, theme, language, responsive and network state
- `utils/` - Supabase client, storage adapter, money helpers
- `assets/` - Images and other static assets

### Conventions

- **Breakpoints** come from `constants/layout.ts` only. Do not introduce a local
  `width > 768` check.
- **Colours** come from the palette via `useTheme()`. A screen's `createStyles`
  takes the palette as its last argument and must list it in the `useMemo`
  dependency array.
- **Never declare a component inside a render body** — React treats it as a new
  component type each render and remounts the subtree.
- Text and icons sitting on a filled brand button use `textInverse`, not
  `surface`, so they stay legible in both themes.

## Dependencies

- React Native Expo
- Supabase
- TypeScript
- Supabase Postgres with row-level security and transactional RPCs

## Learn More

To learn more about the technologies used in this project:

- [Expo Documentation](https://docs.expo.dev/)
- [Supabase Documentation](https://supabase.com/docs)
- [React Native Documentation](https://reactnative.dev/)