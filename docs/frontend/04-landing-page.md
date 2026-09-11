# Landing page — three directions

**Status:** awaiting a pick. Drafted on canvas page 2 ("Landing directions").

Not in the original spec. It sits *upstream* of everything built so far: it's the public page that sells the
coaching and pushes people into the consultation funnel (pay → Google Form → call → plan). Payments stay in the
separate upstream app, so the CTA hands off rather than transacting.

Each direction bets on a different thing. They are deliberately not three versions of one idea.

---

## A — Evidence

**Bets on: proof.** The hero isn't a promise, it's a real client's 16-week record — the weight line, and a
112-square streak grid where each square is one morning logged. The pitch is that the product *is* the data:
"Not a transformation photo. The actual data."

Typography: Geist + Geist Mono, same as the app — deliberate, since the argument is "this is what you get".

- **Strong because** it's the only claim a competitor can't copy-paste, and it needs zero photography.
- **Weak because** it's abstract and there's no human face on the page. Someone shopping on trust in a *person*
  may bounce.

## B — Protocol

**Bets on: seriousness.** Reads like an engineering spec — IBM Plex Mono throughout, hairline rules, no rounded
corners, numbered sections, and a raw sample check-in record rendered as a terminal block. Explicitly anti-hype:
"No app streaks, no group chats, no motivational posting."

- **Strong because** it self-selects the analytical client who actually sticks (both sample intakes so far are
  software engineers), and it's the most differentiated from every other trainer site.
- **Weak because** it's cold. It will not convert someone who wants encouragement, and it narrows the funnel on purpose.

## C — Editorial

**Bets on: emotion.** Instrument Serif display type, full-bleed portraiture, one large client quote, a
sixteen-weeks-apart pair. Premium and magazine-like rather than gym-poster loud.

- **Strong because** it's the most immediately likeable and the easiest to share.
- **Weak because** it depends on real photography — the mockup marks four photo slots as placeholders — and it's
  the most conventional of the three. Without good photos it collapses.

---

## Open questions

- **Where does the CTA go?** Straight to the payment app, to a booking/calendar, or to the Google Form?
- **Do we have photography?** Answers whether C is even viable.
- **Is the client quote real?** The one on C is invented and must be replaced with a real, permitted quote before
  this ever goes live. Same for the "six slots open" line.
- **Does the landing page need its own route in this app**, or does it live separately (and this app stays
  login-only)? Affects whether it ships as a Next.js public route or a static page.
