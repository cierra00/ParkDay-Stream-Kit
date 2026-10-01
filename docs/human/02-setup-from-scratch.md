# 2. Set it up from scratch

Every step needed to run your own copy. Plan about 1 to 2 hours the first time.

---

## What you need

| Need | Notes |
|---|---|
| A Cloudflare account | Free plan is enough |
| A domain on Cloudflare | For a URL like `planner.yourdomain.com`. (A free `*.workers.dev` address also works.) |
| A Windows PC with OBS Studio 30+ | The streaming PC. OBS websocket must be on (Tools, WebSocket Server Settings) |
| Node.js 20+ | To build and deploy the app |
| Python 3.10+ | For the helper and the OBS install scripts |
| Optional: Aitum Vertical plugin | Only if you stream a second vertical canvas |

---

## Step 1: Get the code ready

```powershell
git clone https://github.com/<you>/ParkDay-Stream-Kit.git
cd ParkDay-Stream-Kit\planner
npm install
```

Then download the media pack (photos, the low-data video, fonts) and unzip it into the repo root:

```powershell
curl.exe -L -o media.zip https://github.com/cierra00/ParkDay-Stream-Kit/releases/download/media-v1/ParkDay-Stream-Kit-media.zip
Expand-Archive media.zip -DestinationPath .. -Force
```

(Run from inside `planner\`, so `..` is the repo root. Details in [MEDIA.md](../../MEDIA.md).)

## Step 2: Connect to Cloudflare

```powershell
npx wrangler login
```

A browser window asks you to allow access. If you have more than one Cloudflare account, set which one to use:

```powershell
$env:CLOUDFLARE_ACCOUNT_ID = '<CLOUDFLARE_ACCOUNT_ID>'
```

(Find it in the Cloudflare dashboard, on the right side of the Workers & Pages overview.)

## Step 3: Create the storage bucket

```powershell
npx wrangler r2 bucket create ctpg-planner
```

Any name works. If you choose another, change `bucket_name` in `planner/wrangler.jsonc`.

## Step 4: Edit `planner/wrangler.jsonc`

| Setting | Change it to |
|---|---|
| `name` | Your Worker name (for example `parkday`) |
| `r2_buckets[0].bucket_name` | The bucket from step 3 |
| `routes[0].pattern` | Your domain, for example `planner.yourdomain.com`. Or delete `routes` to use `*.workers.dev` |

Leave `durable_objects`, `migrations` and `assets` as they are.

## Step 5: Set the passcodes and keys

There are four secrets. None of them are ever written into the code.

| Secret | What it is | How to set it |
|---|---|---|
| `OWNER_PASS` | Your passcode for the app | `npx wrangler secret put OWNER_PASS`, then type it |
| `ADMIN_PASS` | Owner dashboard passcode. Must be different from OWNER_PASS | `npx wrangler secret put ADMIN_PASS` (or run `scripts/set_admin_pass.ps1`) |
| `OVERLAY_KEY` | Read-only key for OBS | Made by `scripts/set_keys.ps1` |
| `BOT_KEY` | Key for the home PC helper | Made by `scripts/set_keys.ps1` |

```powershell
powershell -ExecutionPolicy Bypass -File scripts\set_keys.ps1
```

`set_keys.ps1` creates two long random keys, saves them in `planner\.keys.json` on your PC only (it's in `.gitignore`), and uploads them to Cloudflare. It never prints them. **Edit the paths and account ID at the top of the script** to match your setup. The same goes for `set_admin_pass.ps1` and `deploy_cdtick.ps1`.

Use long passcodes. The server locks out an address after 10 wrong tries in 15 minutes, but a strong passcode is still the real protection.

## Step 6: Build and deploy

```powershell
npm run deploy
```

This builds the app into `dist\` and deploys the Worker. Open your domain on your phone and sign in with `OWNER_PASS`.

**Install on the phone:** open the URL in Safari (iPhone) or Chrome (Android), not inside another app. iPhone: Share, Add to Home Screen. Android: menu, Install app.

## Step 7: Put the overlay in OBS

1. Copy `overlays\planner_key.example.js` to `overlays\planner_key.js` (same folder as `overlay.html`).
2. Fill it in:
   ```js
   window.CTPG_PLANNER = { url: 'https://planner.yourdomain.com', key: '<OVERLAY_KEY>' };
   ```
   The key is the `OVERLAY_KEY` value from `planner\.keys.json`. Never commit this file.
3. In OBS, make a scene (for example **Now**) with your camera, then add a **Browser** source:
   - **Local file** off. **URL:** `file:///C:/path/to/overlays/overlay.html?planner=1&look=ticket`
   - **Width 3840, Height 2160** (or your canvas size)
   - Turn on **Shutdown source when not visible** and **Refresh browser when scene becomes active**
4. Vertical canvas (optional): same source with `&layout=vertical`, size 1080 x 1920.
5. Test: change NOW on the phone and watch the card change.

The other overlay pages (offline, pause, low data, BRB) are described in [Overlays in OBS](04-overlays.md). The scripts in `obs-install/` can add sources for you, but they're written for the original scene collection (named `Moblin`) and its scene names. Read each script before running it, and always close OBS first. Each one makes a backup.

**Fonts and images** are not in the repo (see [MEDIA.md](../../MEDIA.md)). The overlay falls back to system fonts without them. For the original look, install the Google Fonts listed in `overlays/fonts/gf.css` and add your own park photos.

## Step 8: Set up the helper (optional, for Switch to LIVE scene)

1. `pip install obsws-python websocket-client`
2. Open `helper\ctpg_remote.py` and check the top:
   - the path to `.keys.json` (for `BOT_KEY`),
   - the path to `planner_key.js` (for the URL),
   - the scene names `"live"` and `"live Vertical"`: change them to your camera-only scenes,
   - `VERTICAL`: your Aitum Vertical canvas ID, or ignore it if you don't use one.
3. Test the OBS part alone (OBS open): `python ctpg_remote.py --test-live`
4. Run it for real in the background: `start_remote.bat` (uses `pythonw`, no window). It writes `remote.log` next to itself.
5. To start it with Windows, put a shortcut to `start_remote.bat` in `shell:startup`.

The helper reads the OBS websocket password from OBS's own settings file, so you never type it anywhere.

## Step 9: Add a mod

1. Open `https://planner.yourdomain.com/admin` and sign in with `ADMIN_PASS`.
2. Type their name, choose a role (the **Mod** preset is a good start), tap **Add**.
3. Copy the code shown (it's shown only once) and send it to them privately.
4. They open the app URL and type the code.

## Step 10: Check it all

| Check | Expected |
|---|---|
| Phone pill top right | **On stream ✓** after a change |
| OBS card | Changes within about a second |
| Mod phone | Sees only the controls you gave them |
| Mod taps Switch to LIVE scene | OBS switches; `remote.log` shows it; the mod sees "On air: live" |
| Wrong code 11 times | "Too many wrong codes. Try again in 15 min." |

---

## Updating later

1. Change code in `planner\src`, `planner\worker` or `planner\public`.
2. `npm run deploy` (or `scripts\deploy_cdtick.ps1 deploy`).
3. Phones update themselves the next time the app opens. In OBS, right-click the overlay source and **Refresh**.

## Backups

The whole day lives in one file in R2 (`state.json`), the mod list in another (`mods.json`, hashed codes only). Download them from the Cloudflare dashboard (R2, your bucket) any time.
