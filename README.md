# rsvp.marwaan.net 🐯

RSVP page for Marwaan's 6th birthday party: **Sunday, Nov 15, 2026, 4–6 PM** at **Tiny Tiger, San Diego**.

It's a static site (HTML/CSS/vanilla JS with no build step) hosted on **GitHub Pages**. RSVPs go to a **Google Sheet** through a small Google Apps Script web app.

```
index.html            page markup
assets/config.js      party details + RSVP endpoint URL  ← edit this
assets/styles.css     styles
assets/app.js         countdown, calendar links, form, confetti
apps-script/Code.gs   Google Apps Script backend (paste into your Sheet)
CNAME                 custom domain for GitHub Pages
```

## 1. Connect the RSVP sheet (about 5 minutes)

1. Create a new Google Sheet, e.g. "Marwaan 6th Birthday RSVPs".
2. Open **Extensions → Apps Script**, delete the sample code, and paste in everything from [`apps-script/Code.gs`](apps-script/Code.gs). Save.
3. Click **Deploy → New deployment**, pick the gear icon, and choose **Web app**:
   - Execute as: **Me**
   - Who has access: **Anyone**
4. Click **Deploy** and approve the permissions. The script needs access to this spreadsheet and permission to send you email.
5. Copy the **Web app URL** (`https://script.google.com/macros/s/…/exec`) into `assets/config.js` as `endpoint`, then commit and push.

Each RSVP adds a row to the `RSVPs` tab. If a guest submits again with the same email, their existing row is updated. You also get an email for each RSVP with the running headcount. To turn the emails off, set `NOTIFY_EMAIL = false`.

> If you edit `Code.gs` later, go to **Deploy → Manage deployments → Edit → Version: New version** so the URL stays the same.

## 2. Point rsvp.marwaan.net at GitHub Pages

At your DNS provider for `marwaan.net`, add:

| Type  | Host / Name | Value             |
|-------|-------------|-------------------|
| CNAME | `rsvp`      | `nuhil.github.io` |

Then go to the repo's **Settings → Pages** and wait for the DNS check to pass. Once it does, turn on **Enforce HTTPS**.

## Preview locally

```sh
python3 -m http.server 8000   # then open http://localhost:8000
```

## Customize

All party details are in `assets/config.js`: date and time, venue, optional street address, and RSVP-by date.
