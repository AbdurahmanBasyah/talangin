# Talangin

Split restaurant bills fairly: connect receipt items to people, share tax and service in proportion, support several payers, and see who pays whom (rupiah).

Stack: React 19, Vite 8, Tailwind CSS 4, plus one Cloudflare Worker route for receipt reading.

## Run locally

```bash
pnpm install
pnpm dev        # http://localhost:8443 (everything except receipt reading)
```

`pnpm dev` does not run the Worker, so uploading a receipt shows a message and you type the items instead. To test receipt reading locally:

1. Get a Gemini API key from Google AI Studio.
2. Copy `.dev.vars.example` to `.dev.vars` and paste the key.
3. Run `pnpm cf:dev` and open the address it prints (http://localhost:8787 by default).

## Deploy to Cloudflare (Workers with static assets)

`wrangler.jsonc` makes the project one Worker: `worker/index.ts` answers `/api/ocr`, and everything else is served from the built site in `dist/`.

Git route (Workers & Pages > Create > Import a repository):

- Build command: `pnpm run build`
- Deploy command: `npx wrangler deploy`
- Build variable: `NODE_VERSION` = `22`

After the first successful deploy the Worker has code, so Settings > Variables and Secrets can be edited. Add `GEMINI_API_KEY` as a Secret. Optional: `GEMINI_MODEL`, one model or a comma-separated list tried in order when a model is overloaded or rate limited (default `gemini-3.5-flash,gemini-3.5-flash-lite,gemini-2.5-flash`). Or from the terminal: `npx wrangler secret put GEMINI_API_KEY`.

Command-line route: `pnpm deploy` (builds, then runs `wrangler deploy`).

If you deploy to Cloudflare Pages instead, the `functions/api/ocr.ts` file is picked up as a Pages Function; use build command `pnpm run build`, output directory `dist`, and add the secret in the Pages settings.

Recommended: add a rate limiting rule for `/api/ocr` (Security > WAF > Rate limiting rules) so strangers cannot use up your free Gemini quota.

## How it works

- `src/calc.ts` holds the money logic: items are split evenly between the people they are connected to, tax + service - discount is shared in proportion to each person's item subtotal, rounding uses the largest remainder method so shares add up exactly, and settlement matches the biggest debtor with the biggest creditor.
- `functions/api/ocr.ts` (called by `worker/index.ts`) receives a downscaled receipt photo from the page, asks Gemini to return items and totals as JSON, and sends the text back. The key never reaches the browser, and visitors do not sign in to anything. It only accepts requests from the site's own origin and images under about 1.5 MB.
- The current split is saved in the browser (localStorage). Receipt photos are not saved.
- "Share link" puts a read-only snapshot of the result (names, totals, transfers) in the URL after `#r=`. Anyone with the link can read it. Chat apps will show a generic preview for it.
- Free Gemini tiers can limit requests per minute and per day, and Google may use free-tier content to improve its products. The landing page tells users that a photo is sent to an AI service.

## Notes

- `.figma/make/site.json` holds the page title, description, and language. It currently sets `robots.index` to `false`, which adds `noindex` to the page and a `robots.txt` that blocks crawlers. Remove that block when you want the site to appear in search.
- The `.figma/` folder and `vite.config.ts` plugins are Figma Make scaffolding. They are harmless in a normal build.
