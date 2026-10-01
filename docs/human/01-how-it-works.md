# 1. How it works

This guide explains the whole system in plain language: what each part does, how a tap on the phone ends up on the stream, and why it was built this way.

---

## The big picture

There are four parts. Only one of them runs on your streaming PC.

| Part | Runs on | Job |
|---|---|---|
| **Park Day app** | Your phone (and mods' phones) | Pick what's NOW, plan the day, choose NEXT and the countdown |
| **Worker + storage + live hub** | Cloudflare, in the cloud | Saves the day, checks who is allowed to do what, pushes every change out instantly |
| **Overlay pages** | OBS browser sources on the streaming PC | Draw the NOW/NEXT card and countdown on stream |
| **Helper** | The streaming PC (Python) | Switches OBS to the camera-only scene when someone taps **Switch to LIVE scene** |

Park information (rides, waits, showtimes, restaurants, time zones) comes from **ThemeParks.wiki**, a free public API. The phone asks it directly, so browsing rides costs nothing on the Cloudflare side.

---

## What happens when you tap something

Example: you're in line for Haunted Mansion and tap **In line**, then **Haunted Mansion**.

1. **The phone updates itself first.** The preview box ("What viewers see") changes right away, even with no signal.
2. **The phone saves to Cloudflare.** Within 0.4 seconds it sends the whole day (your plan plus a ready-made description of the card) to the Worker. With no signal it keeps retrying every 5 seconds and nothing is lost.
3. **The Worker checks the sender.** It checks the code and, for a mod, that the change only touches things they're allowed to change.
4. **It saves one small file.** `state.json` goes into an R2 storage bucket.
5. **The live hub pushes it out.** Every open connection receives the new day: the OBS overlay, other phones, mods.
6. **The overlay redraws the card.** It slides the new card in with the wait sticker. Total time is usually under a second.

The overlay never asks "anything new?" over and over. It connects once when its scene becomes visible and then just listens. When the scene is hidden, OBS shuts the page down and nothing is requested at all.

---

## The one-list model

The whole day is **one list of stops** (the plan). Everything else points into it:

| Idea | How it's stored |
|---|---|
| **NOW** | The one stop you're doing right now (`cur` points at it) |
| **Stage** of NOW | Walking there, In line, or Doing it (On ride, Eating, Watching...) |
| **NEXT** | Worked out automatically: the earliest unfinished stop that isn't more than 30 minutes late. You can pin a different one by hand. |
| **Top countdown** | Whichever stop has ⏱ ticked. Only one at a time. Nothing ticked means no countdown. |
| **Paused** | NOW taken off stream for a break, remembered so **Resume** brings it back |

Quick picks from the category buttons ("Shopping", or a ride you never planned) become temporary stops. If you replace them without finishing, they disappear instead of cluttering the plan.

### The automatic rules

- **Done ✓** checks off NOW. If NEXT starts within 5 minutes (or is running up to 30 minutes late), it becomes NOW automatically, in the "Walking there" stage.
- **▶ Next** makes NEXT the new NOW and checks off the old one.
- A planned stop more than **30 minutes late** stops being NEXT.
- A show stays **HAPPENING NOW** on stream for **30 minutes** after its start time.
- Anything not updated for **12 hours** is ignored by the overlay, so yesterday's plan never appears at the start of a stream.
- Changing the park you're at clears NOW (whatever you were doing at the old park is over).
- **Undo** appears for 4.5 seconds after every change.

---

## Accounts

| Account | Signs in at | Can do |
|---|---|---|
| **Owner** (you) | the app | Everything |
| **Owner dashboard** | `/admin` | Add and remove mods, choose their abilities, make new codes. Cannot change the stream. |
| **Mod** | the app | Only the abilities you ticked (15 separate ones) |
| **Overlay** (OBS) | automatic, read-only key | Read the day, receive live updates |
| **Helper** (home PC) | automatic, bot key | Receive the "switch to live scene" command, report which scene is on air |

Mod codes are shown once when created, then stored scrambled (hashed), so nobody can read them back later, not even you. Turning a mod off, removing them, or giving them a new code disconnects their open app at once. See [Mods and the owner dashboard](05-mods-and-owner-dashboard.md) and [Security](06-security.md).

---

## Why it's built this way

| Choice | Reason |
|---|---|
| Phone app instead of a native app | Installs from the browser, updates itself, no app store |
| Cloudflare free plan | Fast worldwide, costs nothing at this size, custom domain included |
| One JSON file for the day | A park day is a few KB; simple to back up, read and debug |
| Push instead of polling | Instant updates and almost no requests |
| Phone builds the card text | The overlay stays simple and never needs park data or park API calls |
| Helper on the PC connects out | No ports opened on the home router; the PC is never reachable from the internet |
| Only one command (`scene.live`) | Even a leaked key can't start or stop the stream or change settings |
