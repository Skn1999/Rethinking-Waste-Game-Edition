# Rethinking Waste — Number Draw Game

Nov 19, 2026 · @Sumit

## Overview

**Working name: Who's Sorting?** A big-screen party game for the Rethinking Waste cookout. Every guest gets a number at the door; during the event the host shows a waste question, the app draws a random number, and that guest answers.

**Goals**

- Get people talking about waste, sorting and reuse without it feeling like a lecture.
- Be runnable by one host from a laptop, with the questions on a projector or TV.
- Work offline and survive a laptop sleep or tab reload mid-event.

**Users**

| User | Where they are | What they need |
| --- | --- | --- |
| Host | Laptop, host console | Load questions, draw numbers, reveal answers, skip absent guests, with a few taps |
| Guests | Standing in front of the big screen | Read the question from 5+ m away, see the drawn number clearly, enjoy the reveal |
| Answering guest | Called up on the spot | Clear question, visible options and timer, a friendly result either way |

**Success at the event**

- Host runs a round (question → draw → answer → reveal) in under 2 minutes.
- No number is drawn twice unless the host chooses to.
- Zero crashes; state is kept if the browser reloads.

## Design language

Linear-style restraint on a modular bento grid: near-black surfaces, hairline borders, one bright accent, and the real waste-sorting colours used as the only other colour. The big screen is a stage, so type is huge and everything else gets out of the way.

**Principles**

1. **Quiet chrome, loud content.** UI frames are dark and thin; the question, the number and the answer are the only big things.
2. **Modules, not pages.** Every screen is built from rectangular cards on a 12-column grid with a 16 px gap, like a bento box. Cards never overlap.
3. **Colour means a bin.** Category colours map to real sorting streams, so the palette itself teaches sorting.
4. **Readable at 6 metres.** Question text is at least 64 px on a 1080p screen; contrast is 7:1 or better for key text.
5. **Motion with purpose.** Only the number draw and the answer reveal animate with any drama; everything else fades in 150 ms.

**Colour tokens (dark theme, default)**

| Token | Hex | Use |
| --- | --- | --- |
| bg/canvas | #08090A | Page background |
| bg/card | #111214 | Module surfaces |
| bg/card-raised | #18191C | Hover, active card |
| border/hairline | #23252A | 1 px card borders, dividers |
| text/primary | #F7F8F8 | Questions, numbers |
| text/secondary | #8A8F98 | Labels, meta |
| text/tertiary | #5C616B | Hints, disabled |
| accent/compost | #C8F560 | Primary actions, drawn number glow, focus rings |
| state/correct | #4CC38A | Correct answer |
| state/wrong | #F2555A | Wrong answer |
| state/warning | #F5A524 | Timer last 5 s |

**Waste category tokens** (tags on questions, option chips, poster accents)

| Token | Hex | Stream |
| --- | --- | --- |
| bin/bio | #7BAE45 | Biowaste and food scraps |
| bin/paper | #4C8DF6 | Paper |
| bin/cardboard | #C08A4E | Cardboard |
| bin/plastic | #F2C230 | Plastic packaging |
| bin/glass | #3FB8A8 | Glass |
| bin/metal | #A3A9B4 | Metal |
| bin/mixed | #6B6F78 | Mixed waste |
| bin/hazard | #E5484D | Hazardous and e-waste |
| bin/reuse | #B48CF2 | Reuse, repair, reduce (non-bin questions) |

Use a category colour as a 6 px dot, a 2 px top border on a card, or a 12% tint behind a chip, never as a large fill behind text.

**Typography**

- Family: Inter (variable) for everything; JetBrains Mono for the drawn number and timer, tabular figures on.
- Weights: 400 body, 500 labels, 600 headings. Letter-spacing −2% on anything 32 px and up.

| Role | Big screen (1920×1080) | Host console |
| --- | --- | --- |
| Drawn number | 320 px mono, 600 | 48 px mono |
| Question | 64–80 px, 600, max 3 lines | 20 px, 500 |
| Option | 40 px, 500 | 16 px |
| Label / meta | 20 px, 500, uppercase, +4% tracking | 12 px, 500 |
| Body | 28 px | 14 px |

**Spacing, radius, elevation**

- 4 px base scale: 4, 8, 12, 16, 24, 32, 48, 64, 96.
- Radius: 6 px chips and buttons, 12 px cards, 20 px big-screen hero card.
- No drop shadows. Depth comes from bg/card-raised plus a 1 px border; the drawn number gets a soft accent glow (0 0 80px of #C8F560 at 35%).

**Components**

| Component | Notes |
| --- | --- |
| Card (module) | bg/card, 1 px hairline border, 12 px radius, 24 px padding; optional 2 px category top border |
| Button | Primary: accent fill, #08090A text. Secondary: transparent, hairline border. Height 36 px console, 64 px on any touch screen. Each shows its keyboard shortcut as a small kbd chip |
| Kbd chip | 20 px tall, bg/card-raised, mono 12 px, e.g. Space, R, S |
| Category tag | dot + label, e.g. ● Glass |
| Option row | Letter badge (A–D) + text; states: idle, selected, correct, wrong, dimmed |
| Number tile | Square, mono number; states: available, drawn, absent, answered |
| Timer ring | Thin circular stroke depleting clockwise; turns warning colour at 5 s |
| Toast | Bottom-centre, 3 s, for undo (“Number 23 marked absent · Undo”) |

**Motion**

- Default: 150 ms ease-out fades and 8 px slides.
- Number draw: 2.5 s slot-machine roll through available numbers, slowing on a cubic ease-out, then a 400 ms scale-and-glow settle. Respects prefers-reduced-motion (instant reveal with fade).
- Answer reveal: wrong options dim to 30%, the correct option fills with state/correct, then the explanation card slides up.
- Optional sound: soft tick during the roll, one chime on reveal; muted by default, toggle in the host console.

**Voice and tone**

Curious, warm, a bit cheeky; never preachy. Short sentences. Celebrate tries, not just right answers (“Close! Pizza boxes with grease go to bio.”). Example labels: “Draw a number”, “Who's sorting?”, “Reveal the bin”, “Next question”.

## Event flow

One round takes about 90 seconds: show the question, draw a number, the guest answers, reveal the bin.

**Before the event**

1. Host opens the app, sets the number range (e.g. 1–60) and imports the question list.
2. Host prints numbered cards (the app generates a printable sheet) or uses any existing tickets.
3. Host opens the Stage view on the projector/TV and keeps the Host console on the laptop.

**At the door**

4. Each guest picks a numbered card. Unused numbers can be marked “not handed out” so they are never drawn.

**Each round**

5. Host presses Next question. The Stage shows the question, its category tag and the options; a “Who's sorting?” card idles beside it.
6. Host presses Draw (Space). The Stage rolls through available numbers and lands on one.
7. The guest with that number comes forward. If nobody answers within 15 s, the host presses Absent (A): the number is parked and a new one is drawn.
8. The guest answers out loud. Host optionally starts the timer (T, default 30 s) and taps the option they chose (1–4).
9. Host presses Reveal (R). The correct option lights up, and the explanation or fun fact appears.
10. Host presses Next (N). The drawn number is marked answered and the next question loads.

**End**

11. Optional finale screen: number of questions played, how many were answered correctly, and a thank-you message.

## Functional requirements

Three routes in one web app: **/setup**, **/host** (laptop) and **/stage** (projector). Host and Stage stay in sync live in the same browser. P0 = must have for the event, P1 = nice to have.

**Setup (/setup)**

| ID | Requirement | Priority |
| --- | --- | --- |
| S1 | Set event name, number range (min–max) and a list of excluded numbers | P0 |
| S2 | Import questions from JSON or CSV (paste or file upload); show a validation summary with row errors | P0 |
| S3 | Add, edit, reorder and delete questions in a simple list editor | P1 |
| S4 | Choose question order: as listed or shuffled | P0 |
| S5 | Settings: timer length (default 30 s), sound on/off, reduced motion, allow repeat numbers on/off (default off) | P0 |
| S6 | Generate a printable A4 sheet of number cards (e.g. 12 per page) in the event style | P1 |
| S7 | Export and import the whole game state as a JSON file (backup) | P1 |

**Host console (/host)**

| ID | Requirement | Priority |
| --- | --- | --- |
| H1 | Bento layout: current question card, next-up card, draw panel, number grid, controls bar | P0 |
| H2 | Next question, Previous, Skip question | P0 |
| H3 | Draw a random number from available numbers (not drawn, not excluded, not absent) | P0 |
| H4 | Mark drawn number Absent and auto-redraw; absent numbers return to the pool after 3 rounds (configurable) | P0 |
| H5 | Record the guest's chosen option; Reveal answer; mark round correct/incorrect | P0 |
| H6 | Start, pause and reset the timer | P0 |
| H7 | Number grid showing every number's state (available, drawn, absent, answered, excluded); click a number to toggle exclude or force-pick it | P0 |
| H8 | Undo the last action (toast with Undo for 5 s) | P0 |
| H9 | Keyboard shortcuts: Space draw, R reveal, N next, A absent, T timer, 1–4 choose option, Z undo, F fullscreen stage | P0 |
| H10 | Presenter notes per question (only on Host, never on Stage) | P1 |
| H11 | Open Stage in a new window button | P0 |

**Stage (/stage)**

| ID | Requirement | Priority |
| --- | --- | --- |
| ST1 | Full-screen 16:9 layout that scales from 1280×720 to 3840×2160 without scroll | P0 |
| ST2 | Idle screen: event title, “Rethinking Waste”, a big “Who's sorting?” prompt and a slow ambient animation | P0 |
| ST3 | Question view: category tag, question (max 3 lines), up to 4 options with letter badges, optional image | P0 |
| ST4 | Draw animation and the drawn number in a hero card | P0 |
| ST5 | Timer ring visible while running | P0 |
| ST6 | Reveal: correct option highlighted, explanation card, the right bin shown with its category colour | P0 |
| ST7 | Finale screen with simple stats | P1 |
| ST8 | Stage never shows host-only data (answer before reveal, notes, the number grid) | P0 |

**Question types**

| Type | How it works on Stage | Priority |
| --- | --- | --- |
| Multiple choice | 2–4 options, one correct | P0 |
| Which bin? | An item (text + optional image), options are bin category chips | P0 |
| True / false | Two big options | P0 |
| Open discussion | No correct answer; Reveal shows a talking point or fact | P1 |

**Non-functional**

- Works fully offline after first load; no login, no backend, no analytics.
- State persists in localStorage after every action; a reload restores the exact round.
- Random draws use crypto.getRandomValues for fair picks.
- Runs in current Chrome, Edge, Safari and Firefox on a laptop; Stage is view-only.
- Accessibility: keyboard-operable host console, visible focus rings, colour is never the only signal (correct/wrong also show ✓/✕ icons).

## Data model and tech

A client-only React app: all state lives in one store, saved to localStorage and shared between the Host and Stage windows with BroadcastChannel.

**Stack**

- Vite + React + TypeScript, Tailwind CSS with the tokens above as CSS variables, Zustand for state, Framer Motion for the draw and reveal.
- Routing: React Router with /setup, /host, /stage.
- Sync: BroadcastChannel("rethinking-waste") sends the full state on every change; Stage is read-only and renders from it.
- Deploy as a static site (Vercel, Netlify or GitHub Pages); also runs from `npm run dev` on the host laptop.

**Question format (JSON)**

```json
[
  {
    "id": "q01",
    "type": "which-bin",
    "category": "bio",
    "prompt": "A greasy pizza box. Which bin?",
    "image": "",
    "options": ["cardboard", "bio", "mixed", "paper"],
    "answer": 1,
    "explanation": "Grease ruins cardboard recycling. Clean parts can go to cardboard, greasy parts to bio.",
    "notes": "Ask the crowd first"
  }
]
```

- `type`: multiple-choice | which-bin | true-false | discussion
- `category`: bio | paper | cardboard | plastic | glass | metal | mixed | hazard | reuse
- `answer`: index into options; omitted for discussion

CSV import uses the same fields as columns, with options separated by `|`.

**Game state**

| Field | Type | Notes |
| --- | --- | --- |
| settings | object | eventName, range {min, max}, excluded\[\], timerSeconds, sound, reducedMotion, allowRepeats, absentCooldownRounds, shuffle |
| questions | Question\[\] | As imported |
| order | string\[\] | Question ids in play order |
| currentIndex | number | Position in order |
| phase | enum | idle, question, drawing, drawn, answering, revealed, finale |
| numbers | Record\<number, state> | available, drawn, absent, answered, excluded |
| currentNumber | number or null | The drawn guest |
| selectedOption | number or null | What the guest chose |
| rounds | Round\[\] | {questionId, number, selectedOption, correct, timestamp} |
| history | Snapshot\[\] | Last 20 states for Undo |

**Draw logic**

1. Pool = numbers in range that are available (absent numbers rejoin after the cooldown).
2. If the pool is empty, offer “All numbers have played — reset the pool?”
3. Pick with crypto.getRandomValues; the roll animation shows random pool numbers and always lands on the pre-picked one.

## Build plan for Antigravity

Paste this whole doc into Antigravity (export it as Markdown), then give the agent the prompt below and build one milestone at a time, checking each in the browser before moving on.

```markdown
You are building "Who's Sorting?", a client-only party game web app for a cookout themed "Rethinking Waste".
The attached PRD is the source of truth: follow its design tokens, components, routes, requirements (P0 first) and data model exactly.

Stack: Vite + React + TypeScript, Tailwind (tokens as CSS variables), Zustand, React Router, Framer Motion. No backend, no auth.
Sync /host and /stage with BroadcastChannel; persist state to localStorage after every action.

Build in these milestones and stop after each for review:
1. Project scaffold, design tokens, base components (Card, Button, Kbd, CategoryTag, OptionRow, NumberTile, TimerRing, Toast) on a /kitchen-sink page.
2. Store + question import (JSON/CSV) + /setup page, with 10 sample waste-sorting questions.
3. /host console with draw, absent, reveal, next, undo, timer and keyboard shortcuts.
4. /stage view with idle, question, draw animation, reveal and finale; verify sync with two windows.
5. P1 items: printable number cards, backup export/import, sound, presenter notes.

Acceptance: a full round runs from keyboard only; reload restores state; no number repeats unless allowed; Stage readable at 1920x1080 from 6 m (question >= 64px).
```

**Milestones**

| # | Deliverable | Done when |
| --- | --- | --- |
| 1 | Tokens + component kit | Kitchen-sink page matches the design language |
| 2 | Setup + import | Sample questions import with no errors |
| 3 | Host console | Full round works from the keyboard |
| 4 | Stage | Two-window sync works; looks right on the projector |
| 5 | Polish (P1) | Cards print; backup restores |

**Out of scope for v1**

- Guests joining or answering on their phones
- Accounts, online leaderboards or any data leaving the laptop
- Multiple simultaneous games

**Open questions**

- [ ] Event name, date and venue for the idle screen and poster
- [ ] Rough guest count, to set the number range
- [ ] Points or prizes for correct answers, or just for fun?
- [ ] Should questions be in English only, or English + Finnish?
- [ ] Projector/TV resolution at the venue
