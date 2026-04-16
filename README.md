# Darlington First — Netlify Functions Proxy

This moves the Brevo and Airtable API keys out of the client-side HTML and into Netlify server-side environment variables. Forms (newsletter + contact) and the DF Offers page now call `/api/*` endpoints on your own domain instead of the Brevo/Airtable APIs directly.

---

## Files in this package

```
├── index.html                          ← updated: no API keys in source
├── netlify.toml                        ← Netlify config + /api/* rewrites
└── netlify/
    └── functions/
        ├── subscribe.js                ← POST → Brevo "add contact to list"
        ├── contact-email.js            ← POST → Brevo transactional email
        └── offers.js                   ← GET (list) + POST (submit) → Airtable Offers
```

## Client-side endpoints

| Endpoint             | Method | Purpose                                  |
|----------------------|--------|------------------------------------------|
| `/api/subscribe`     | POST   | Newsletter + contact form list-add       |
| `/api/contact-email` | POST   | Contact form transactional email         |
| `/api/offers`        | GET    | List approved offers for Darlington First|
| `/api/offers`        | POST   | Submit new (un-approved) offer           |

---

## Netlify setup

### 1. Ensure the files are in the repo

All 4 files above (plus this README) should sit at the paths shown. `netlify.toml` must be at the repo root — not inside a subfolder.

### 2. Add environment variables

**Site configuration → Environment variables → Add a variable**

Two variables are required:

| Key              | Where to find the value                                         |
|------------------|-----------------------------------------------------------------|
| `BREVO_API_KEY`  | Brevo dashboard → SMTP & API → API Keys                         |
| `AIRTABLE_TOKEN` | Airtable → Builder Hub → Developer Hub → Personal Access Tokens |

Scopes for the Airtable token must include:
- `data.records:read`
- `data.records:write`
- Access to the Darlington First base (Offers table)

Scopes: leave "All scopes" for both. Values: same for all deploy contexts is fine.

### 3. Trigger a fresh deploy

Env vars only apply to new deploys. After adding them:
**Deploys → Trigger deploy → Deploy site**

### 4. Verify functions deployed

**Logs → Functions** — you should see three functions: `subscribe`, `contact-email`, `offers`. If any are missing, check the deploy log for errors in the `netlify/functions/` folder.

---

## Testing each endpoint

**Offers GET (easiest):**
1. Visit `yoursite.com/#offers`
2. DevTools → Network → look for GET to `/api/offers`
3. Response: 200 OK with `{ records: [...] }`

**Offers POST (submission form):**
1. Click "Submit your offer" on the DF Offers page
2. Fill required fields, submit
3. Green tick should appear
4. Airtable: new record with `Site = "Darlington First"`, `Approved = unchecked`

**Newsletter subscribe:**
1. Enter email in any newsletter form, submit
2. DevTools → Network → POST to `/api/subscribe` → 200 OK
3. Brevo → Contacts → email added to list ID 7

**Contact email:**
1. Fill contact form, submit
2. DevTools → Network → POST to `/api/subscribe` (200), then POST to `/api/contact-email` (200)
3. Check `hello@first-connections.com` — enquiry email received

---

## Rotating the API keys (recommended)

The previous Brevo and Airtable keys were visible in browser source view for a period. Even though they're now hidden by the proxy, cached copies may still exist. Best hygiene is to rotate both:

**Brevo:**
1. Brevo dashboard → SMTP & API → API Keys
2. Generate new key
3. Update `BREVO_API_KEY` in Netlify → trigger redeploy
4. Revoke the old key

**Airtable:**
1. Airtable → Builder Hub → Developer Hub → Personal Access Tokens
2. Create new token with the same scopes as above
3. Update `AIRTABLE_TOKEN` in Netlify → trigger redeploy
4. Revoke the old token

---

## Security features in the proxy

- **API keys hidden** — never sent to the browser
- **Field allowlist on offer submissions** — client cannot set `Approved=true` or `Featured=true`; those can only be set manually in Airtable
- **Server-stamped `Site` field** — cannot be spoofed from client
- **HTML escaping** on contact email content — prevents injection in email body
- **Error passthrough** — Brevo/Airtable errors are forwarded to the client for debugging

Not included (can be added later if needed):
- Rate limiting
- CORS allowlist
- Captcha

---

## Airtable table requirements

The `Offers` table (base `appzNaWxLuQstEUSX`, table `tblrQUho0RGnhh03V`) must have these columns:

| Column name     | Type        |
|-----------------|-------------|
| Business Name   | Single line |
| Sector          | Single line |
| Description     | Long text   |
| Offer Headline  | Single line |
| Offer Detail    | Single line |
| Discount Code   | Single line |
| Website URL     | URL         |
| Logo URL        | URL         |
| Town / City     | Single line |
| Site            | Single select: Darlington First / Newcastle First / First Connections / All Sites |
| Approved        | Checkbox    |
| Featured        | Checkbox    |
| Terms           | Long text   |
| How to Claim    | Long text   |
| Contact Name    | Single line |
| Contact Email   | Email       |

---

## Brevo list

The subscribe function writes to list ID **7**. Change the value in `subscribe.js` if you need a different list.

---

## Troubleshooting

**"Server misconfigured" in response:**
Env var isn't set or Netlify hasn't redeployed. Add/verify the env var, then trigger a fresh deploy.

**Function works locally but 404 in production:**
Check `netlify.toml` is at repo root (not inside a subfolder). The `[[redirects]]` section maps `/api/*` → `/.netlify/functions/*`. Without it, functions still work at `/.netlify/functions/subscribe` but not at the shorter `/api/subscribe` path.

**Airtable errors about missing fields:**
Verify all the columns in the table above exist and are named exactly as shown (case-sensitive).

**Offer submissions never appear on the site:**
By design — new submissions come in un-approved. Tick the `Approved` checkbox in Airtable to publish.

**Viewing function logs:**
Netlify dashboard → site → Logs → Functions → click the function name. Each invocation is logged with timings and any `console.error` output.

---

## Extending to Newcastle First / First Connections

Two options:

**Option A (simpler):** Copy these 4 files into each site's repo, set env vars separately on each Netlify project. Change the `SITE_NAME` constant in `offers.js` per site.

**Option B (cleaner for ongoing maintenance):** Extract to a standalone Netlify project at e.g. `api.first-connections.com`, have all three sites call it. Requires adding CORS headers to each function since calls become cross-origin.
