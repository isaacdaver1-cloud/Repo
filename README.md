# Echo website

The official website for **Echo**, a multiplayer VR game for Meta Quest.

It has a scroll-driven 3D rocket launch intro, the game's home page, and every
page a Meta Horizon Store submission needs:

| Page | Link to give Meta |
| --- | --- |
| Home | `/` |
| Privacy policy | `/privacy.html` |
| Terms of service | `/terms.html` |
| Data deletion instructions | `/data-deletion.html` |
| Support and contact | `/support.html` |
| Community guidelines | `/community-guidelines.html` |
| Copyright and trademarks | `/copyright.html` |

## Before you publish

Open `site.config.json` and fill in your real details. Every page reads from it.

| Setting | What to put |
| --- | --- |
| `developerName` | The studio name (HIVEMIND). It appears as the owner in the copyright notices and privacy policy. |
| `creatorName` | Who built the game (Ivy). Shown in the footer and on the copyright page. |
| `contactEmail` | An email you check. Meta requires a working contact for privacy and deletion requests. |
| `siteUrl` | Your EdgeOne Pages address or custom domain, without a trailing slash. |
| `metaStoreUrl` | Your Meta Horizon Store page, once you have it. Leave empty to show "Coming soon". |
| `discordUrl` | Optional community link. Leave empty to hide the button. |
| `governingLaw` | The country whose law governs the terms. |
| `policyEffectiveDate` | Change this whenever you change the privacy policy or terms. |
| `musicTracks` | Your own songs for the record player (see below). Leave as `[]` to use only the built-in tracks. |

Also read the privacy policy and check it matches what your game really does.
It is written for a Unity game using Photon PUN, Photon Voice and PlayFab with
Meta platform sign-in. If you add analytics, ads, accounts outside Meta, or
anything else that collects data, update the policy before you ship it.

## Publishing on EdgeOne Pages

1. In EdgeOne Pages, create a project and import this GitHub repository.
2. The build settings come from `edgeone.json` automatically:
   - Install command: `npm install`
   - Build command: `npm run build`
   - Output directory: `dist`
   - Node version: 20.18.0
3. Deploy. Every push to `main` redeploys the site.

The build fills in your config, minifies all HTML and CSS, and obfuscates the
site's own JavaScript, so the published code is scrambled and hard to read.
The readable source stays in `src/` in this repository. Keep the repository
private on GitHub if you don't want people to see it.

`edgeone.json` also sets security headers (HTTPS-only, no framing by other
sites, a strict content security policy) and caching for assets.

## Working on the site

```
npm install
npm run preview       # quick build without obfuscation, served at http://localhost:8080
npm run build         # full production build into dist/
```

- Pages are in `src/*.html`. The shared head, top bar and footer are in `src/partials/`.
- Styles: `src/assets/css/site.css`
- Rocket launch: `src/assets/js/rocket.js` (three.js)
- Copy protection, top bar, screenshot viewer: `src/assets/js/site.js`
- Screenshots: `src/assets/img/` (a `.jpg` and a `.webp` of each)

`{{name}}` in any page is replaced with the matching value from `site.config.json`.

## Contact form

Every email link on the site opens `/contact.html`, where visitors pick a reason,
write a description and press Send. Their own email is optional. Messages go to
hivemindgeneration@gmail.com.

Sending uses [Web3Forms](https://web3forms.com) when `web3formsKey` is set in
`site.config.json` (free, 250 messages a month), and falls back to
[FormSubmit](https://formsubmit.co) if Web3Forms fails or no key is set.

**To get a Web3Forms key:** go to web3forms.com, enter hivemindgeneration@gmail.com
and create an access key. It arrives by email. Put it in `web3formsKey`. The key is
meant to be public, so it's fine in the page.

## Music player

The record player in the bottom-left corner comes with three built-in synthwave tracks
(Nebula Drift, Arena Pulse, Station Night) that are generated live in the browser, so
there are no audio files and no licensing issues.

To add your own songs, put MP3 files in `src/assets/music/` and list them in
`site.config.json`. They play before the built-in tracks:

```json
"musicTracks": [
  { "title": "Echo Main Theme", "file": "/assets/music/main-theme.mp3" },
  { "title": "Arena Fight", "file": "/assets/music/arena-fight.mp3" }
]
```

Only use music you made yourself or have a licence to use on a website.

## Copy protection

The site blocks right-click, image dragging and the usual developer-tools,
view-source and save-page shortcuts, and the published JavaScript is
obfuscated. This stops casual copying. No website can fully stop a
determined person from saving what their browser downloads, so the legal
protection (the copyright notices on every page, the copyright page and
`LICENSE`) is what lets you act if someone copies your work.

## Licence

Copyright © 2026 HIVEMIND. All rights reserved. See [LICENSE](LICENSE).
