// ============================================================
//  TODAY'S PLAN  (edit before you leave, save, done)
//  The overlays recheck this file every 30 seconds.
//
//  PARADE / FIREWORKS TIMES ARE AUTOMATIC.
//  They come live from the park schedule for the park below.
//  You only list your own stops here (rides, food, meetups).
//
//  park: Magic Kingdom, EPCOT, Hollywood Studios, Animal Kingdom,
//        Disneyland, California Adventure, Universal Studios Florida,
//        Islands of Adventure, Epic Universe, Universal Studios Hollywood
//  party: true on Halloween / Christmas party nights (adds party-only shows)
//  time: 24-hour clock "HH:MM" (2:30 PM = "14:30")
// ============================================================
window.CTPG_PLAN = {
  park: "Magic Kingdom",
  party: false,

  items: [
    // { time: "08:00", label: "Rope Drop" },
    // { time: "09:30", label: "Big Thunder Mountain" },
    // { time: "12:00", label: "Lunch at Pecos Bill's" },
  ],

  // Optional: extra shows to count down to, or shows to ignore (part of the name is enough)
  watch: [],
  skip: [],
};
