# AirCrypto MZ — V1 MVP

Crypto-powered digital services marketplace for Mozambique. **Bitcoin Cash (BCH) first.**

## What it does

Customers buy **mobile airtime** (Vodacom / Movitel / Tmcel) and pay with cryptocurrency — primarily BCH.

Flow:

1. Choose service & operator  
2. Enter phone + amount  
3. Pay with BCH (or other enabled crypto) via NOWPayments  
4. Webhook confirms payment → backend fulfills via Reloadly  
5. Customer sees success + reference (no account required)

TV (GOtv / DStv / ZAP) is scaffolded but **disabled** until a legitimate fulfillment API is connected.

## Architecture

```
Browser  →  AirCrypto Backend  →  NOWPayments
                              →  Reloadly (airtime)
                              →  JSON file store (atomic writes; schema ready for SQLite)
```

- No secrets in the frontend  
- Server-side pricing & order creation  
- Idempotent fulfillment (never double top-up)  
- Webhook signature verification  
- Database is a simple atomic JSON store for V1; swap `src/db` for better-sqlite3 later without changing callers  

## Quick start

```bash
cd aircrypto-mz
cp .env.example .env
# Edit .env with your keys (or leave empty for UI-only exploration)

npm install
npm run db:seed
npm run dev
```

Open:

- App: http://localhost:3000  
- Admin: http://localhost:3000/admin.html (token = `ADMIN_TOKEN` from `.env`)

## Environment

See `.env.example`. Critical variables:

| Variable | Purpose |
|----------|---------|
| `NOWPAYMENTS_API_KEY` | Create payments |
| `NOWPAYMENTS_IPN_SECRET` | Verify webhooks |
| `RELOADLY_CLIENT_ID` / `SECRET` | Airtime fulfillment |
| `RELOADLY_SANDBOX` / `NOWPAYMENTS_SANDBOX` | Use test environments |
| `PUBLIC_BASE_URL` | Must be reachable by NOWPayments for IPN |
| `ADMIN_TOKEN` | Protects `/api/admin/*` |
| `ALLOW_SIMULATION` | Dev-only simulate-payment button |

## Development simulation

When `ALLOW_SIMULATION=true` and `NODE_ENV !== production`, the payment screen shows a **Simulate payment (dev)** button. This confirms payment and attempts Reloadly fulfillment (sandbox if configured). It is **never** available in production.

## Security notes

- API keys stay server-side only  
- Prices recalculated on the backend  
- Fulfillment is idempotent (`fulfillment_status === completed` → no second top-up)  
- Rate limiting on order creation  
- Admin routes require `x-admin-token`

## V1 scope (intentionally small)

✅ Airtime via Reloadly (dynamic operator lookup)  
✅ BCH-first payment UX + real QR  
✅ NOWPayments + IPN  
✅ Order + profit tracking  
✅ Minimal admin dashboard  
❌ User accounts / wallets  
❌ TV automation (architecture ready, providers inactive)  
❌ Native app  

## License

Private — AirCrypto MZ
