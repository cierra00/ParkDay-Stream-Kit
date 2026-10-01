# 3. Using the app on a park day

The app has three tabs: **Now**, **Plan** and **Parks**. The top bar shows the sync pill, a **Sign out** button, and (for mods) a yellow "Mod: name" tag.

---

## Before the day: Parks tab

1. **Parks today:** tap every park you'll visit. Florida and California resorts show first; search finds any park ThemeParks.wiki covers.
2. **We're at now:** tap the park you're in. It shows on the card under the ride name. Tap another when you park hop.

Changing the park you're at clears NOW. Removing a park hides its stops from NEXT (they come back if you re-add the park).

## Build the plan: Plan tab

| Want to | Do |
|---|---|
| Add a ride or restaurant | **Add from the park**, pick the park, Rides or Food, **+ Plan**, choose a time (quick 15-minute slots, an exact time, or **No set time**) |
| Add a showtime | Shows tab, tap a time chip. Tap again to remove it |
| Add your own stop | Type it ("Lunch", "Skyliner"), optional time, **Add** |
| Check a stop off | ✓ circle on the left |
| Change the time | The time button |
| Remove | × on the right |
| Pick the countdown stop | Tick **⏱ Top countdown** on a timed stop |

**NOW** and **NEXT** tags show which stops are on stream.

## During the stream: Now tab

### The preview box ("What viewers see")

This is exactly what's on stream. Under the card:

| Button | Does |
|---|---|
| **✓ Done** | Checks off NOW. If NEXT is due within 5 minutes it starts automatically |
| **Pause** | Takes NOW off stream for a break. **Resume** brings it back |
| **Walking there / In line / On ride** | The stage of NOW (changes the card label and shows the wait in line) |
| Tap the **NEXT** line | Pick a different NEXT (from your plan or anything in the park) |
| **▶ Next** | NEXT becomes NOW, old NOW is checked off |

### The countdown line

Always visible above the preview: what the top countdown is set to, with a ⏱ box to tick or untick it. The last stop stays listed after you untick, so you can tick it back.

### Doing something else?

Category buttons for anything not in the plan:

| Button | Then pick | On stream |
|---|---|---|
| 🎢 On a ride | the ride | ON A RIDE / name / park + wait sticker |
| ⏳ In line | the ride | IN LINE · 35 min wait / name |
| 🍽️ Eating | the restaurant | EATING AT / name |
| 🎆 Fireworks | nighttime show | FIREWORKS / name |
| 🎉 Parade | the parade | PARADE / name |
| 🎸 Concert | the concert | series / tonight's band |
| 🎭 Watching a show | the show | WATCHING / name |
| ✨ Meeting characters | the meet and greet | MEETING / name |
| 🛍️ Shopping, 🚶 Exploring, 🚝 Park hopping | nothing | goes on stream right away |
| 🚌 Getting around | how, then where to (optional) | SKYLINER TO / Riviera Resort / From EPCOT |

Nothing goes on stream until you pick the actual ride or show. Closed rides and shows are hidden unless you tick **Include closed**. With two or more parks today, lists show every park with a park tag, your current park first. Picking something at another park switches **We're at now** for you.

**Concerts:** EPCOT's Eat to the Beat fills in tonight's band from the published lineup (`planner/src/concerts.js`). Type over it under **Band on stream** if the act changes.

### Coming up

Your remaining stops in time order, each with ⏱ and a ▶ to start it now.

### On stream controls (fold-out at the bottom)

| Control | Does |
|---|---|
| Top countdown On / Off | Hides or shows the countdown without changing the plan |
| Show it: Right now / 30 min / 1 hr / 3 hrs | How early before the show the countdown appears |
| Show NEXT line On / Off | Hides or shows the NEXT tab on stream |
| Also show the card on the live scene | Adds the card to the camera-only scene too |

## The sync pill

| Pill | Means |
|---|---|
| On stream ✓ | The stream has your latest change |
| Sending… | Saving now |
| Waiting for signal | No connection; it retries every 5 seconds and keeps your change |

## Undo

Every change shows a toast with **Undo** for 4.5 seconds.

## Updates and signing out

The app updates itself when opened. The version is at the bottom of the Parks tab. **Sign out** (top bar) needs two taps within 3 seconds, so a stray tap mid-stream does nothing.
