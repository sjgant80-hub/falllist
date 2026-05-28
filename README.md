# FallList

**Your newsletter. Your list. 0% fee. ~£1 per 1,000 emails. Forever.**

One HTML file. Markdown editor. Public sign-up page. Send via your own Resend / Postmark / Mailgun / SendGrid key — no middleman, no cut.

**Live:** https://sjgant80-hub.github.io/falllist/

---

## The grift it obsoletes

> **Mailchimp · 2026 pricing**
> - 500 contacts → $13/mo · $156/yr
> - 2,500 contacts → $50/mo · **$600/yr**
> - 10,000 contacts → **$350/mo · $4,200/yr**
> - **Charges for unsubscribed contacts too**
>
> **Substack · 2026**
> - **10% of every subscription, forever**
> - Plus Stripe processing fees on top
> - $5,000/mo MRR = **$500/mo + Stripe = $6,000+/yr in platform fees**

For storing emails and sending markdown.

FallList = unlimited subscribers · no per-seat · no platform cut · ever.

---

## What it does

| Tab | What you see |
|-----|-------------|
| ▦ Home | Subscriber count · emails sent · savings vs Mailchimp · quick actions |
| ◯ Subs | List · add · import CSV · export CSV · public sign-up URL · iframe embed |
| ✎ Write | Markdown editor · live preview · subject · from-name · send / test / draft |
| 📤 Sent | History of sent newsletters · view · copy HTML · delivery stats |
| ⚙ Share | Backup/restore JSON · mailer info · grift comparison |

### How sending works · BYOM (Bring Your Own Mailer)

FallList doesn't run an SMTP server. You paste an API key from:

| Provider | Free tier | Paid |
|----------|-----------|------|
| **Resend** | 3,000/mo free | $20/mo after |
| **Postmark** | none | ~$15/mo for 10k |
| **Mailgun** | 5,000/mo free for 3mo | **$1 per 1,000 emails** at scale |
| **SendGrid** | 100/day free | enterprise tiers |

FallList sends direct from your browser to the mailer's API. No FallList server. No platform cut. The mailer charges you their rate — that's it.

### Public sign-up

Append `?signup=1` to your URL → page transforms into a clean sign-up form. New emails land in your local subscriber list. Share via:
- Direct link
- iframe embed code (copied from the Subs tab)

---

## ƒ(build) gate · 14/14

```
□ 1  single HTML · works from file://                    ✓ 71 KB
□ 2  <400KB                                              ✓ 18% used
□ 3  L1 FACE · 5 views                                  ✓
□ 4  L2 SWARM · Ω + α subs + β compose + γ send (4 mailer providers) ✓
□ 5  L3 CASCADE · T0 always (markdown render) · T3 AI optional ✓
□ 6  L4 BLOOM · subscriber routing · status filtering   ✓
□ 7  L5 PERSIST · localStorage · CSV + JSON export       ✓
□ 8  L6 SKIN · dark + amber · mobile-first              ✓
□ 9  L7 ASS · "No subscribers yet" guided empty state    ✓
□ 10 Konomi licence shim · sovereign tier               ✓
□ 11 fall-signal · prime 271                            ✓
□ 12 PWA manifest · standalone                          ✓
□ 13 README two-audience · MIT LICENSE                   ✓
□ 14 Pages live · responding 200                         ✓
```

---

## For developers

### postMessage API

```js
window.postMessage({ target: 'falllist', action: 'subscriber_count' }, '*');
// → { count: 1247 }

window.postMessage({ target: 'falllist', action: 'sent_count' }, '*');
// → { count: 23 }
```

### Add a new mailer provider

In `index.html`, add a `sendVia*` function alongside the existing four, then register it in `MAILER_FNS`. About 10 lines of code per provider.

### Fork & rebrand

```bash
gh repo fork sjgant80-hub/falllist --clone=true
cd falllist
# Brand state.settings defaults · adjust listName
gh repo edit --enable-pages --pages-branch main
```

---

## Roadmap

- ✅ Markdown editor · live preview
- ✅ 4 mailer providers (Resend · Postmark · Mailgun · SendGrid)
- ✅ Subscriber list · CSV import/export · public sign-up
- ✅ Send history with delivery stats per recipient
- ✅ Iframe embeddable sign-up form
- ⬜ Open/click tracking via pixel + user's own analytics endpoint
- ⬜ Scheduled sends (browser must be open OR delegate to mailer's scheduling)
- ⬜ Segments (tag-based)
- ⬜ Double opt-in confirmation flow
- ⬜ Newsletter archive · public read view
- ⬜ AI-suggested subject lines via Cascade T3

---

## Sovereignty notes

- Subscribers live on YOUR device
- Mailer API key lives on YOUR device
- Mailer charges YOU direct
- We have no server · no database · no cut
- The list is portable JSON · take it anywhere
- Unsubscribe link in every send → `?unsubscribe=1` route

---

## Licence

MIT · use it, fork it, brand it, sell setup services.

---

## Credit

- **Architecture & build:** Simon Gant · [@sjgant80-hub](https://github.com/sjgant80-hub) · [LinkedIn](https://www.linkedin.com/in/simon-gant-295b56180/)

◊·κ=1 · your list · your terms · 0% fee · ~£1 per 1,000 emails · forever
