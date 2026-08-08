# Deploying the API publicly

The chatbot, chat widget, booking, lead capture and payment webhooks all need the API to be reachable by visitors. It's a **long-running Node server** (Telegram polling, follow-up scheduler) — deploy it to a permanent host, not serverless.

## Quickest: Render / Railway / Fly.io
1. Create a new web service pointing at this repo
2. Root directory: `apps/generator-api`
3. Start command: `node --import tsx src/index.ts` (the `Procfile` is already here)
4. Add these environment variables (copy from `.env`):
   - `DEEPSEEK_API_KEY`, `GCP_PLACES_API_KEY`, `DEPLOY_TOKEN`, `DEPLOY_PROVIDER`, `DEPLOY_SITE_NAME`
   - `TELEGRAM_BOT_TOKEN`, `TELEGRAM_ADMIN_CHAT_ID`
   - `OUTREACH_*`, `RESEND_API_KEY`, `SMTP_*`
   - `PAYMENT_PROVIDER`, `PAYFAST_*`, `PAYSTACK_SECRET_KEY`
   - `PUBLIC_BASE_URL` = your public API URL (e.g. `https://api.yourbrand.com`)
   - `AUTOPILOT_STORE`, `AUTOPILOT_API_URL`, `AUTOPILOT_MODE`
   - `ULTRA_MSG_INSTANCE_ID`, `ULTRA_MSG_API_TOKEN`
5. Give the service a persistent disk if you want the JSON stores (`data/`) to survive restarts — or keep them ephemeral.

## VPS (Ubuntu)
```bash
cd demo-site-generator/apps/generator-api
pnpm install
npx tsx src/index.ts   # or use pm2: pm2 start --name api "npx tsx src/index.ts"
```
Set the same env vars, then put it behind nginx + HTTPS.

## Once it's live
1. Set `PUBLIC_BASE_URL` to the public URL → the demo sites' chatbot/booking/chat/leads point there automatically (the builder reads it).
2. Resend inbound: point Resend's inbound webhook for your domain at `https://your-api/api/email/inbound` so client email replies flow into the system.
3. The single Telegram poller stays in the autopilot — do **not** run the API's bot polling (already disabled).
