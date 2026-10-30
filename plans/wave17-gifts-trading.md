# Wave 17 · Gifts and trading (plan, 2026-10-29)

> **Changed the same day (owner):** "I'm not sure if we needed two separate options. Something becomes a gift simply by trading an
> empty item." There is now ONE button, **🔁 Trade with Dad**, and the panel has a **📦 Nothing** tile: offering Nothing asks for a
> present, picking Nothing back keeps the offer as a present (never Nothing for Nothing). The asker always says the last yes. The
> save rules below are unchanged (a side's item list may simply be empty); the `yes` message is gone. The sections below describe
> the first version where they differ.

Between friends playing together (ROADMAP "Wave 17"): **give a creature** to a friend, and **trade** one creature for one of
theirs. Blocks and Capture Cubes are not built yet, but the parts below are made so they are one more entry later.

## What the child sees (easy to understand)

- Pause screen, the "Play together" box: for every friend who plays with you, two big buttons:
  **🎁 Give Dad a creature** and **🔁 Trade with Dad**. Nothing else changed: looking at a friend still asks for a battle.
- Both open the **Swap panel** (`#swap`): big portrait tiles of your team and Box. Tap one, then one big yes button
  ("🎁 Give!" / "🔁 Offer!"). Your last team creature cannot be given ("Keep one friend in your team!").
- **Gift:** the friend gets the present box question "🎁 Dad sent you a present! Open it?" (`ui.ask`, kind `incoming`).
  Open = the creature jumps out (confetti line, Book page added). Not now = Dad is told, nothing moves.
- **Trade:** the friend gets "🔁 Dad wants to trade! They offer Sparky (Lv 12)." Pick one! opens their Swap panel with
  Sparky on top; they tap one of theirs and say **🔁 Swap!**. Dad sees "Kid offers Leafo (Lv 9) for your Sparky" and
  says **🔁 Swap!** or **No thanks**. Both see the new friend arrive.
- Anything can be stopped before the last yes (Not now, Esc, closing the panel, walking away is fine: it is a panel).
- Works the same in every place (main world, Swirl, every Picture World, a friend's world): only party, Box, save and
  play-together messages are used. No world file knows about it.

## Never lost, never doubled (the save)

A swap moves items between two saves. Only two moments change a save, each one `save(true)` at once:

1. **The giver commits** (after every yes): the items leave the team / Box into the giver's **escrow**,
   `swaps.out[sid] = { to: friend's playerId, name, give: [items], get: [items], from: [where each came from] }`.
2. **The receiver commits** when the `give` message arrives (only for a swap it said yes to in this page):
   takes its own `get` items out, puts the `give` items in (a traded creature takes the place of the one it replaced),
   and remembers the answer in `swaps.seen` (`[sid, 'got' | 'no', time]`, the newest 200). Then it answers `got`.
   A `give` it did not agree to (a reload forgot the yes, the creature it would trade is gone) is answered `no`, also
   remembered, so a later copy of the same `give` can never be taken.

The giver **settles** on the answer: `got` = the `get` items come in, escrow gone; `no` = the `give` items go back where they
were. Until then the giver re-sends `give` every 3 s while the friend is there, and again every time that friend comes back
(friends are known by their saved `playerId`, said in a `hi` message, never by the per-page play-together id). The receiver
answers a repeated `give` from `seen`, so nothing happens twice.

| The browser closes... | Then |
| --- | --- |
| before the giver's commit | nothing moved |
| after the giver's commit, before the receiver's | escrow is saved; next time they play together, the `give` goes again: the receiver says `no` (its yes was forgotten) and the creature comes home |
| after the receiver's commit, before the `got` arrives | the receiver remembers `got`; next time the giver hears `got` again and settles |
| after `got` | done on both sides |

While a swap waits in escrow, the Swap panel shows it ("Sparky is on the way to Dad"), and a toast after loading says
"Play together with Dad again to finish it." Escrowed creatures are not in the team or Box, so they cannot be used, given or
let go twice. Nothing is applied in a battle: a `give` / `got` that arrives then waits (the re-send brings it again after).

Creatures keep everything: `uid`, `species`, `level`, `xp`, `hp`, `moves`, `learned`, `traits` (cleaned by the receiver:
`cleanTraits`, known moves only, level 1..`MAX_LEVEL`; a legendary is never sent). The receiver's Book marks it caught
(`book.markCaught`), the Box shows it like any other.

## Parts (generic, ready for blocks and cubes)

- `src/swapcore.js` (pure rules): `SWAP` (version, timings, caps), **`PARCELS`** = the kinds of things that can move,
  each `{ clean(item), find(game, item), take(game, item), put(game, item, at), label(item), pic(item) }`. Only
  `creature` is built. A later `cubes` kind (`{ kind: 'cubes', n }`: take = `game.cubes -= n`) or `block` kind
  (`{ kind: 'block', id, n }` via `blockCounts`) is one `addParcel` call plus a panel tab; the ledger, the messages and the
  commit rules never look at a kind. `loadSwaps(saved)` cleans the save field; `commitOut`, `receive`, `settle` are the
  three save changes above.
- `src/swaps.js`: `createSwaps(game, { save })` -> `game.swaps`: the messages, the asks, `hi` / re-sends, the waiting
  states; test hooks `drop` (message types not sent) and `info()`.
- `src/swapui.js`: `createSwapUi(game)` -> `game.swapUi`: the `#swap` panel (pick, confirm, waiting, escrow lines).
- Small marked lines in shared files: `multiplayer.js` (`'swap'` in `EVENTS`, its listener, `sendSwap`),
  `playtogether.js` (the two buttons per friend, `hooks.swap`), `main.js` (create, save field `swaps`, load,
  `update`, `togglePanel('swap')`), `ui.js` (`panelOpen` / `openPanel` / `closePanel` know `#swap`), `index.html` /
  `style.css` (the panel).

## Messages (one new play-together event `swap`; old clients never subscribe to it)

All carry `{ v, sid, from, to, name }`. `v` = `SWAP.version` (1): a different `v` gets `no` with `old: true` ("Dad needs to
reload the game to trade").

| type | who | what |
| --- | --- | --- |
| `hi` | everyone, once per friend | `pid` (saved `playerId`). Only friends who said `hi` get the buttons; others: "X's game is older: reload to trade" |
| `offer` | giver | `kind` `'gift'` / `'trade'`, `give` items (to show them) |
| `yes` / `no` | receiver | gift opened / not now (or `busy`, `old`) |
| `pick` | receiver (trade) | `get` items it offers back |
| `cancel` | either | stop before the commit (closing the panel, Not now, No thanks, leaving) |
| `give` | giver after its commit | `give`, `get` (uids), re-sent until answered |
| `got` / `no` | receiver | the answer from `seen` |

No `WORLD_VERSION` bump (no blocks change), no duel `VERSION` bump (battles unchanged). Save field `swaps` (old saves:
none = empty).

## Tests (`tests/specs/swap.mjs`, two browsers with `openPair`)

`SWAP_ONLY=rules|gift|trade|crash|old|ipad`:
- **rules:** `swapcore.js` in the page: clean creatures (bad species, levels, moves, traits), commit / receive / settle on
  stand-in games, a repeated `give` answered from `seen`, never doubled.
- **gift / trade:** the whole flow with real buttons; the uid, traits and learned arrive unchanged, the Book and Box update,
  both `localStorage` saves agree; Not now / No thanks move nothing.
- **crash:** the three rows of the table above with messages dropped and the page reloaded, then rejoined: each uid is in
  exactly one save afterwards.
- **old:** a friend whose game never says `hi` gets no buttons and is never sent a swap.
- **ipad:** the pair on an emulated iPad (touch taps on tiles and buttons).

Chapter 3's eggs that hatch with a friend's help can be one more parcel kind later.
