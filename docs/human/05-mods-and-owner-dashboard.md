# 5. Mods and the owner dashboard

Mods are helpers (friends, co-hosts, channel mods) who can run parts of the stream from their own phones. You decide exactly what each one can do.

---

## Three kinds of sign-in

| Sign-in | Where | Code |
|---|---|---|
| **You (owner)** | The app | `OWNER_PASS` (you set it in Cloudflare) |
| **Owner dashboard** | Your app address + `/admin` | `ADMIN_PASS` (a different passcode, also set in Cloudflare) |
| **Mod** | The app | Their own code, made in the dashboard |

The dashboard can only manage mods. It can't change the stream. The owner code opens the dashboard too, but the dashboard code doesn't open the app: it says "That's the owner dashboard code. Open this address with /admin at the end."

---

## Adding a mod

1. Open `/admin` and sign in.
2. Type their name, pick a role, tap **+ Add**.
3. Their code appears once, like `CASTLE-DUMBO-ZEPHYR-4821` (three random words and four digits). Tap **Copy code** and send it privately.
4. They open the app address and type the code once. Their phone remembers it.

**The code is not one-time.** It keeps working on any device until you turn it off. It's shown only once because the server keeps only a scrambled (hashed) copy.

## Managing a mod

| Button | Does |
|---|---|
| **Role** dropdown | Apply a preset (below) |
| **Choose abilities** | Open the 15 checkboxes, grouped |
| **All / None** | Tick or clear every ability |
| **Turn off / Turn on** | Pause their access without deleting them |
| **New code** | Make a new code (the old one stops working) |
| **Remove** | Tap twice to delete them |

Turn off, New code and Remove all **disconnect their open app immediately** and sign them out.

---

## The 15 abilities

| Group | Ability | Lets them |
|---|---|---|
| Stream | **Switch to LIVE scene button** | Switch OBS to the camera-only scene with overlays off. It never starts or stops the stream |
| NOW card | **Put things on NOW** | Pick what you're doing, start a stop, the ▶ buttons |
| NOW card | **Done / Clear** | Check off NOW (starts NEXT if due in 5 minutes) |
| NOW card | **Pause and Resume** | Take NOW off stream for a bit |
| NOW card | **NOW details** | Walking there / In line / On ride, how you're getting around, band name |
| NEXT | **Choose NEXT** | Pick or change NEXT |
| Countdown | **Pick the countdown stop** | Tick or untick ⏱ |
| Countdown | **Countdown switch and timing** | Countdown on/off and how early it shows |
| On stream | **NEXT line and live-scene card** | Those two on-stream switches |
| Plan | **Add stops** | Rides, food, showtimes, own stops |
| Plan | **Change times** | Set, change or clear times |
| Plan | **Check stops off** | Tick stops done or bring them back |
| Plan | **Remove stops** | Delete stops |
| Parks | **Change the park we're at** | Park hopping |
| Parks | **Add or remove today's parks** | The park list |

Every mod can always **see** what viewers see. With no abilities they get a watch-only view.

## Presets

| Preset | Abilities |
|---|---|
| **Mod** (default) | Switch to LIVE scene, all NOW card abilities, Choose NEXT, and add / change times / check off / remove stops |
| Scene only | Switch to LIVE scene button only |
| Live helper | Switch to LIVE scene, NOW card, NEXT, countdown stop |
| Planner | NEXT, countdown stop, all Plan abilities (nothing live) |
| Co-host | Everything |
| Viewer | Nothing (watch only) |
| Custom | Any mix you tick |

## What a mod sees

- The yellow "Mod: name" tag and **Sign out** in the top bar.
- The big **🎥 Switch to LIVE scene (overlays off)** button, if they have it, with "On air: <scene>" under it from the home PC.
- Only the controls they're allowed. Anything else is hidden or greyed out.
- A **What you can do** list on the Parks tab.

If they try something they're not allowed to anyway, the server refuses it. Their phone says "You don't have: ..." and reloads what's really on stream.

## Switch to LIVE scene

Needs the helper running on the streaming PC (see [Set it up](02-setup-from-scratch.md), step 8). When a mod taps it:

1. The request goes to Cloudflare, which checks the mod has that ability.
2. Cloudflare passes the command to the helper over its open connection.
3. The helper switches the main canvas to `live` and the vertical canvas to `live Vertical`.
4. The result comes back to the mod ("Switching to LIVE…", then "On air: live").

If the helper isn't running, the mod sees "Streamer.bot is not connected (is the home PC on?)".
