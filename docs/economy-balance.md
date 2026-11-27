# Rally Tycoon — Economy & Balance Design (v4)

Status: **v4, simulated and tuned.** Every number here is reproducible with
`node scripts/economy-sim.mjs`; `CONFIG` in that file is the single source of truth.
Organizer decisions are recorded in §13: four decided, one open (§13.5).

v4 change over v3:

| Change | Why |
|---|---|
| **A cell budget per shop type** (`maxCellsPerType = 4`) replaces the per-arm building cap | one sentence to teach — *a shop type may use at most 4 cells*. Lv1/Lv2 = 1 cell, Lv3 = 2, so a type ends as **2× Lv3** and never as 3× Lv3 |
| 100 % island unchanged — **370 000, six Lv3** | prices, gates and the unlock table stay exactly as tuned; only the rule and the endgame spread move |
| Endgame is now **3.9 distinct types** (was 3.2) | leftover cells can no longer be dumped into a 5th gold Lv2 |
| The old per-arm rule was **leaking** | merges may combine Lv2 that stand in different arms, so a type could reach 6 cells and the real ceiling was 390 000, not the 370 000 the design assumed (§11) |

v3 changes over v2 (kept for context):

| Change | Why |
|---|---|
| **Per-arm building cap** replaces the global "max 2 per type" cap | the old cap was a hard, invisible rule; the new one was spatial (2 per arm) |
| **Typed customers** — a fixed 900-card deck, every customer has a type and a multiplier | shops now differ by *who walks in*, not only by income per cell |
| **Bank** added as the 13th shop, **Game Center** moved to balanced | completes the premium trio gold / bank / sushi and gives the Investor card something to target |
| **New unlock table** `0/45/85/155/210/265/305` | re-tuned for the 370 000 ceiling |

Supersedes v1 (open/close tycoon), v2 (global cap) and v3 (per-arm cap). All tuning histories are
kept in §11 because their failures are the useful part.

Related: [architecture.md](./architecture.md) · [supabase-setup.md](./supabase-setup.md)

---

## 1. Design targets

| Target | Value |
|---|---|
| Event length | 4 hours, 15 rounds, ~16 minutes per round |
| Teams / posts | 15 teams; 9 solo posts + 3 duel posts per round, one post per team per round |
| Island completeness at the end | **85 % – 95 % of the maximum island, for every team** |
| Nobody can **exceed** 100 % | the 4-cell budget caps a type at 2× Lv3, so 370 000 is a hard ceiling |
| How often someone **finishes** the island | ~20 % of team-runs (strong teams, round 13–14); §8.6 |
| Winner decided by | **Total Earned = cash + asset value**, not island completeness |
| Customer volume | hundreds per team (≈ 730), arriving 1 customer / second |
| Player-facing numbers | six-figure cash, so "Rp 1.950.000" instead of "195" |

**"85–95 %" is a target for the expected value of each team**, measured over many simulated events.
A single real event swings ±4–5 points per team because post results are random (§8.6). If the
organizer needs a hard per-event guarantee, the lever is the reward spread in §3, not the shop
economy.

---

## 2. The rules that define the whole economy

### 2.1 Customers arrive one by one, and shops have seats

```
A post finishes  →  cash is added immediately
                 →  N customers join the queue, 1 arrival per second

Each customer walks shop 1 → shop 2 → … → shop 12 (see the walking order in §2.4)
At each shop: if a seat is free → enters, stays `servingTime`, pays `income[level] × cardMultiplier`
              if all seats are busy → SKIPS that shop and walks on
```

`seats` is how many customers can be inside at once, `servingTime` is how long one stays. Together
they give one number:

```
capture = min(1, seats / (servingTime × arrivalRate))        arrivalRate = 1 customer/second
effective income = income[level] × capture
```

`capture` is the share of passing customers a shop can actually earn from. It is the most important
number in the game: a shop with 50 % capture earns half of its advertised income.

**Capture Lv1 → Lv3** (all 13 shops follow one of three curves):

| | Seats | Serving | Capture | Meaning |
|---|---:|---:|---:|---|
| Lv1 | 5 | 8–13 s | **38–63 %** | leaks customers, must be upgraded |
| Lv2 | 8 | 7–11 s | **73–100 %** | nearly solved |
| Lv3 | 16 | 5–9 s | **100 %** | no leaks, twice the income of Lv2 |

### 2.2 Timescale: 0× / 0.5× / 1× / 2×

The team controls the clock, so "waiting for customers to stream in" is never a real-time problem.

| Speed | Behaviour |
|---|---|
| **2×** | serving and arrivals run twice as fast (good when a batch just landed) |
| **1×** | normal |
| **0.5×** | half speed (watch a shop drain while you decide) |
| **0× pause** | serving **freezes**; customers **keep arriving** into the parking lot; purchases and merges are still allowed |

Two rules make pausing safe:

1. **Income is resolved when a customer finishes being served**, using the shop's *current* level.
   Upgrading while paused gives exactly the same result as upgrading while open, so pause is **not**
   an income exploit — it is a renovation tool.
2. **The parking lot does not pause.** Its capacity is the plot's `capacity` (120 / 180 / 260). When
   it is full, every new customer is **voided** and logged. Pausing for too long therefore costs
   customers, which is why high seats + fast serving still matter.

### 2.3 Level 3 is a merge, and each shop type has a **cell budget**

| Level | How you get it | Footprint | Income | Seats |
|---|---|---|---:|---:|
| Lv1 | buy | 1×1 | 1.0× | 5 |
| Lv2 | upgrade (cash + gate) | 1×1 | ≈ 1.4× Lv1 | 8 |
| **Lv3** | **merge 2 identical Lv2** (free) | **1×2** | **≈ 2.2× Lv2** | **16** |

The merge is free: the team already paid for both buildings and the merge consumes both.

**The building rule (v4).** One shop type may occupy at most **4 cells across the whole island**.
Lv1 and Lv2 take 1 cell, Lv3 takes 2, so a type always ends as **2× Lv3** (4 cells) or
**1× Lv3 + 2× Lv2** (4 cells) — never as 3× Lv3.

Why cells and not buildings (this is what v4 fixes): counting *buildings per arm* was cheated by
merges, which may combine two Lv2 that stand in **different** arms. Measured under the old rule, the
best island was **gold ×3 Lv3 + bank ×3 Lv3 = 390 000** — 6 cells of a single type, a ceiling
20 000 above what the design assumed, and 105.4 % on the progress bar. A cell budget cannot be
cheated: a Lv3 costs 2 cells wherever it stands and whatever it was merged from.

| Rule consequence | Meaning |
|---|---|
| **2× Lv3 per type max** | 4 cells / 2 cells per Lv3 — the endgame composition is forced by arithmetic, not by a special case |
| **Merging is cell-neutral** | 2× Lv2 (2 cells) → 1× Lv3 (2 cells): the total never changes, so the budget can never block a merge. Placement is the only constraint — the merged 1×2 needs two adjacent cells inside one arm, which the two released Lv2 normally provide |
| **Cross-arm merges are allowed** | the two Lv2 may stand in different arms; the merged 1×2 is placed on an arm that has the room |
| **12 cells ⇒ 3 types at the top** | 12 / 4 = 3 — the four-cell budget is the whole reason the endgame holds three kinds of shop and not one |

Worked example, Toko Emas (effective Lv1 9 167 / Lv2 24 800 / Lv3 68 000):

| State | Cells | Income | Legal? |
|---|---|---:|---|
| A. 2× Lv2, never merged | 2 | 49 600 | ✅ |
| B. merge them → 1× Lv3 | 2 | 68 000 (+37 %) | ✅ |
| C. 1× Lv3 + 2× Lv2 | 4 | 117 600 | ✅ at the cap |
| D. **2× Lv3** | 4 | **136 000** | ✅ at the cap — the endgame target |
| E. 2× Lv3 + 1× Lv2 | 5 | 160 800 | ❌ over the budget |

Two implementation rules:

- A Lv3 needs **two adjacent cells in the same arm** (it cannot jump over the bank).
- **Relocation is free**; selling refunds **75 %** of cash paid. Without this, a full island of 1×1
  shops would permanently block every 1×2 upgrade (v1 stalled at 42 % because of it).

### 2.4 Typed customers — the deck

Every arriving customer draws the next card from a **fixed 900-card deck**. All 15 teams read the
deck from card 0, so every team meets the same customers in the same order: deterministic, fair and
simulatable without randomness. Card 901 wraps to card 1 (a team normally sees ~730 cards, i.e. the
deck once).

```
income from one customer = Σ over shops it enters of  effective_income(shop) × cardMultiplier(card, shop)
```

Rules that make the deck safe:

| Rule | Value |
|---|---|
| Cards in the deck | **900** (≈ one event's worth of customers, so rarity means something) |
| Deck mean multiplier | **1.089×** — measured on the real endgame island (§8.5) |
| Order | deterministic, evenly spread: no two rare cards adjacent, every 60-card window inside 1.04–1.16× |
| Stacking | one card per customer, never multiplied |
| Applied to | **effective income** (after capture), so a low-capture shop is never subsidised |
| Timing | the multiplier is evaluated when the customer is served, together with the income |
| Fallback | a card whose shops the island does not own pays **1.5× at the best owned shop of the same class** |

The fallback is what keeps all 26 customer types alive. Without it, 10 of the 13 shop-lover cards
would be dead on a finished island (§8.5).

### 2.5 The 26 customer types

Counts are cards in the 900-card deck; "/event" is how often a team actually meets one (≈ 730
customers). The deck is data (`customer_catalog` + `customer_deck`), not code.

| # | Customer (UI name) | Rule | Count | /event | Rarity |
|---:|---|---|---:|---:|---|
| 1 | Pengunjung Biasa | 1× semua toko | 563 | 457 | Umum |
| 2 | Ibu Belanja | 2× Minimarket | 10 | 8 | Jarang |
| 3 | Pencinta Kopi | 2× Kedai Kopi | 10 | 8 | Jarang |
| 4 | Anak Es Krim | 2× Es Krim | 10 | 8 | Jarang |
| 5 | Si Rapi | 2× Barbershop | 10 | 8 | Jarang |
| 6 | Kutu Buku | 2× Toko Buku | 10 | 8 | Jarang |
| 7 | Pecinta Bunga | 2× Toko Bunga | 10 | 8 | Jarang |
| 8 | Pecinta Pizza | 2× Pizzeria | 10 | 8 | Jarang |
| 9 | Pecinta Ramen | 2× Ramen Bar | 10 | 8 | Jarang |
| 10 | Pecinta Mainan | 2× Toko Mainan | 10 | 8 | Jarang |
| 11 | Gamer | 2× Game Center | 10 | 8 | Jarang |
| 12 | Pecinta Sushi | 2× Sushi Bar | 10 | 8 | Jarang |
| 13 | Kolektor Emas | 2× Toko Emas | 10 | 8 | Jarang |
| 14 | Nasabah | 2× Bank | 10 | 8 | Jarang |
| 15 | Anak-anak | 1,5× Es Krim, Toko Mainan, Game Center | 37 | 30 | Sering |
| 16 | Si Lapar | 2× Pizzeria, Ramen Bar, Sushi Bar | 37 | 30 | Sering |
| 17 | Anak Nongkrong | 3× Kedai Kopi, 2× Game Center | 25 | 20 | Jarang |
| 18 | Sosialita | 2× Toko Bunga, Toko Buku | 25 | 20 | Jarang |
| 19 | Si Buru-buru | 2× untuk **3 toko pertama** di lintasan | 25 | 20 | Jarang |
| 20 | Kolektor | 2× semua toko **Lv3** | 15 | 12 | Jarang |
| 21 | Turis | 1× (<5 petak) · 1,25× (5–7) · 1,5× (8–10) · 2× (≥11) | 12 | 10 | Jarang |
| 22 | Turis Lokal | 2× semua toko yang masih **Lv1** | 12 | 10 | Jarang |
| 23 | Investor | 2× Bank, Toko Emas | 6 | 5 | Langka |
| 24 | Bisnisman | 2× semua toko kelas premium | 6 | 5 | Langka |
| 25 | Orang Kaya | 2× semua toko | 6 | 5 | Langka |
| 26 | Sultan | 3× semua toko | 1 | **0,8** | Legendaris |

Design notes:

- **The 13 shop-lover cards share exactly one frequency (10 each).** That is what makes the family
  composition-neutral: your income shares add up to 1, so the expected bonus is the same for any
  island. Never give one shop a more frequent fan than another.
- **Turis** rewards filling the plot (it saturates at 11 of 12 cells), **Turis Lokal** rewards the
  opposite — an island that has not upgraded yet. Together they are the catch-up pair; without Turis
  Lokal every card favours the leader (see the snowball note in §12).
- **Si Buru-buru** needs the walking order: arm 0 from the entrance, then arm 1, by cell slot. It is
  the only card that makes shop *placement* matter, so the team screen should draw the walking path.
- **Sultan at 1 card** is deliberate: ≈ 0,8 appearances per event. It must feel like a legend, not a
  routine. Raising it to 3+ cards turns it into "another Orang Kaya".

---

## 3. Post rewards

Unchanged from v2 — the deck is a *shop-side* mechanic and does not touch post rewards.
**All 12 posts pay from this table, online or offline**; the delivery mode is presentation only
(§13.1).

### 3.1 Solo posts (1–9)

| Result | Cash | Customers |
|---|---:|---:|
| Level 1 | 300 000 | 40 |
| Level 2 | 500 000 | 50 |
| Level 3 | 700 000 | 60 |

### 3.2 Duel posts (10–12, both teams recorded in one transaction)

| Result | Cash | Customers |
|---|---:|---:|
| Lose | 200 000 | 30 |
| Draw | 350 000 | 40 |
| Win | 500 000 | 60 |

### 3.3 Per-team totals over 15 rounds

| | Worst | Average | Best |
|---|---:|---:|---:|
| Post cash | 3 900 000 | ~6 600 000 | 9 300 000 |
| Customers | 540 | **≈ 730** | 900 |

The customer spread (1.67×) is narrower than the cash spread (2.38×) on purpose: customers are the
fuel for unlocks, so even the weakest team must reach the late shop tiers. Cash is where winning
posts pays off, and cash is what the leaderboard counts.

---

## 4. The island

L-shaped island with the bank at the corner (matches `layer_ground_*_native.png`): two arms of green
cells split by the bank and the parking lot.

| Plot tier | Cells/arm | Total cells | Capacity | Unlock (customers) | Cost | Visual |
|---|---:|---:|---:|---:|---:|---|
| **1 — Warung** | 4 | **8** | 120 | 0 | free | `layer_ground_*_native` |
| **2 — Ruko** | 5 | **10** | 180 | **240** | **1 150 000** | `layer_ground_5x5_*` |
| **3 — Mal** | 6 | **12** | 260 | **520** | **3 100 000** | `layer_ground_6x6_*` |

Plot upgrades need **customers served + cash**, and the cost is booked as **asset value** so that
expanding in the last round is never a scoring trap. No third condition: land is already the
scarcest resource, so nobody expands for fun (verified — an extra "own N shops" gate changed the
result by < 1 %).

A 5-cell arm holds 2 Lv3 + 1 single (a real layout puzzle at tier 2). A 6-cell arm holds exactly
3 Lv3 — which is what the 100 % island uses (§6).

---

## 5. Shop catalogue — 13 types, every stat

Seven unlock bands: two shops each, plus Bank on its own at the end.

| Shop | Class | Tags | Unlock | Seats | Serving 1/2/3 (s) | Capture 1/2/3 | Buy | → Lv2 | Income 1/2/3 | **Effective 1/2/3** |
|---|---|---|---:|---|---|---|---:|---:|---|---|
| Minimarket | fast | retail | 0 | 5/8/16 | 8/7/5 | 63 / 100 / 100 % | 250 000 | 350 000 | 4k / 6k / 13k | 2.5k / 6.0k / 13.0k |
| Kedai Kopi | fast | cafe | 0 | 5/8/16 | 8/7/5 | 63 / 100 / 100 % | 300 000 | 400 000 | 5k / 8k / 18k | 3.1k / 8.0k / 18.0k |
| Barbershop | balanced | service | 45 | 5/8/16 | 10/9/7 | 50 / 89 / 100 % | 350 000 | 500 000 | 6k / 9k / 20k | 3.0k / 8.0k / 20.0k |
| Toko Buku | balanced | retail | 45 | 5/8/16 | 10/9/7 | 50 / 89 / 100 % | 400 000 | 600 000 | 7k / 10k / 22k | 3.5k / 8.9k / 22.0k |
| Toko Bunga | balanced | retail | 85 | 5/8/16 | 10/9/7 | 50 / 89 / 100 % | 450 000 | 700 000 | 8k / 12k / 26k | 4.0k / 10.7k / 26.0k |
| Es Krim | fast | fun | 85 | 5/8/16 | 8/7/5 | 63 / 100 / 100 % | 500 000 | 800 000 | 9k / 13k / 29k | 5.6k / 13.0k / 29.0k |
| Pizzeria | balanced | food | 155 | 5/8/16 | 10/9/7 | 50 / 89 / 100 % | 600 000 | 950 000 | 11k / 16k / 35k | 5.5k / 14.2k / 35.0k |
| Ramen Bar | balanced | food | 155 | 5/8/16 | 10/9/7 | 50 / 89 / 100 % | 650 000 | 1 050 000 | 12k / 17k / 37k | 6.0k / 15.1k / 37.0k |
| Sushi Bar | premium | food | 210 | 5/8/16 | 12/10/8 | 42 / 80 / 100 % | 800 000 | 1 250 000 | 14k / 20k / 44k | 5.8k / 16.0k / 44.0k |
| Toko Mainan | balanced | fun | 210 | 5/8/16 | 10/9/7 | 50 / 89 / 100 % | 850 000 | 1 300 000 | 15k / 21k / 46k | 7.5k / 18.7k / 46.0k |
| Game Center | **balanced** | fun | 265 | 5/8/16 | 10/9/7 | 50 / 89 / 100 % | 1 000 000 | 1 600 000 | 18k / 25k / 55k | 9.0k / 22.2k / 55.0k |
| Toko Emas | premium | luxury | 265 | 5/8/16 | 12/10/8 | 42 / 80 / 100 % | 1 250 000 | 1 950 000 | 22k / 31k / 68k | 9.2k / 24.8k / 68.0k |
| **Bank** | premium | luxury | 305 | 5/8/16 | **13/11/9** | **38 / 73 / 100 %** | 1 350 000 | 2 100 000 | 20k / 28k / 62k | 7.7k / 20.4k / 62.0k |

*(k = thousands. "Effective" = income × capture, i.e. what the shop actually pays per passing
customer. Prices are for Lv1 and Lv2; the merge to Lv3 is free.)*

### 5.1 What the three classes mean

| Class | Serving time | Character |
|---|---|---|
| **fast** (Minimarket, Kopi, Es Krim) | 8/7/5 s | highest capture, lowest ticket. Safe income. |
| **balanced** (Barber, Buku, Bunga, Pizza, Ramen, Mainan, **Game**) | 10/9/7 s | middle of everything. |
| **premium** (Sushi, Emas, **Bank**) | 12/10/8 s, Bank 13/11/9 s | highest ticket, worst capture until Lv3. |

A premium shop at Lv1 loses ~60 % of its customers, so it is **only worth buying if you can push it
to Lv2–Lv3**. That is exactly the decision we want: cheap-and-safe vs expensive-and-strong, with the
upgrade gates deciding who can afford the strong route.

Game Center moved from premium to balanced in v3: its income is premium-tier but it is the *third*
premium style shop, and three premium types are enough for the top of the catalogue. Keeping it
premium would have made "all premium" a legal 12-cell island (§6.1) and turned the Bisnisman card
into a global multiplier.

### 5.2 Upgrade gates (this is what makes upgrading "hard")

Gates are measured in **customers actually served by that shop type**, counted **globally per type**
(not per building). A skip does not count. Once unlocked, every new building of that type can be
upgraded immediately.

| Gate | Requirement |
|---|---|
| **Lv2** | 50 customers served by that type |
| **Lv3** | 120 customers served by that type **and** merge 2 identical Lv2 (free) |

Because gates count *served* customers, low capture delays your own upgrades — fixing seats/serving
time is what unlocks progress rather than just more cash.

### 5.3 Tags

Tags exist only for the customer cards; they never change income.

| Tag | Shops | Used by |
|---|---|---|
| `fun` | Es Krim, Toko Mainan, Game Center | Anak-anak |
| `food` | Pizzeria, Ramen Bar, Sushi Bar | Si Lapar |
| `cafe` | Kedai Kopi | Anak Nongkrong |
| `retail` | Minimarket, Toko Buku, Toko Bunga | — (flavour only) |
| `luxury` | Toko Emas, Bank | — (Investor targets the ids directly) |

---

## 6. The 100 % island and the progress metric

**100 % = plot tier 3 (12 cells) with the best legal composition.** Under the 4-cell budget the
simulator's DP finds it exactly — six Lv3, two per type:

| Type | Buildings | Cells | Effective income |
|---|---|---:|---:|
| Toko Emas — Lv3 ×2 | 2 | 4 | 136 000 |
| Bank — Lv3 ×2 | 2 | 4 | 124 000 |
| Game Center — Lv3 ×2 | 2 | 4 | 110 000 |
| **Total** | **6** | **12** | **370 000** |

Cost: **37 000 000** for the shops (6 Lv3 = 12 purchases + 12 upgrades) plus **4 250 000** for plot
tiers 2 and 3 → **41 250 000**. A good team earns 100–160 M, so cash is not the binding constraint;
land, gates and the plot unlock are.

```
progress = effective income / 370 000
```

Example: gold Lv3 ×2 (136 000) + bank Lv3 ×2 (124 000) + game Lv3 + Lv2 (55 000 + 22 222) = 337 222
in 11 cells → **91 %**. (The twelfth cell is usually a Lv2 of a fourth type, worth a few more points.)

### 6.1 What the cell budget buys

| `maxCellsPerType` | Theoretical 100 % | Endgame composition | Distinct types (measured) |
|---|---:|---|---:|
| 3 | 322 022 | 1× Lv3 + 1× Lv2 per type, four types | 5.0 |
| **4 (current)** | **370 000** | gold ×2, bank ×2, game ×2 — all Lv3 | **3.9** |
| 5 | 370 000 | 2× Lv3 + 1× Lv2 on two types | 3.6 |
| 6 | 390 000 | gold ×3 + bank ×3 | 3.2 |
| off | 408 000 | gold ×6 | 1.5 |

*(Types from 30-run sweeps; the 4-cell row is the 200-run headline in §8.2.)*

Three conclusions, all measured:

- **4 is the only budget that keeps the tuned 370 000 ceiling.** So every price, gate and unlock in
  §5 survives untouched, and the whole v3 tuning is still valid.
- **5 is worse on both axes.** 5 = 2 + 2 + 1, so the planner spends the fifth cell on a weak Lv2 and
  ends lower: 86.6 % averaged, dipping to 82.2 % — under the band. Odd budgets always leave a Lv2
  behind; even budgets land exactly on Lv3 blocks.
- **3 buys variety with money.** It reaches 5.0 types, but the ceiling drops to 322 022, which would
  reopen the whole price/gate/unlock table. A v5 option, not a free lunch.

Two notes on the fourth cell:

- The endgame is forced to **3 types** because 12 cells / 4 = 3. What changed versus v3 is the
  *measured* spread: teams end with **3.9** types instead of 3.2, because the cells they used to dump
  into a fifth gold Lv2 now have to become a fourth kind of shop.
- The catalogue's variety still lives in the **journey**: a team re-tools ~16 times on the way up
  (§8.4), and the deck's fallback keeps every customer card alive (§8.5).

Old v3 rule, for reference: 2 buildings per arm, measured 3.2 types and 90.5 %, but cross-arm merges
let a type reach 6 cells, so its real ceiling was 390 000 rather than the 370 000 the design assumed
(§11).

Use progress as an **organizer guard-rail**, not as the leaderboard.

---

## 7. Scoring

```
Total Earned = cash on hand + asset value of the shops and plot that are still standing
asset value  = cash actually paid for the levels currently owned (book value)
```

| Rule | Value | Why |
|---|---:|---|
| Buy / upgrade / merge | cash → asset 1:1 | spending is score-neutral, so nobody hoards |
| Sell a shop | refund **75 %**, book value removed | a wrong build costs 25 %, not the whole game |
| Plot upgrade | counted as asset | expanding late must not cost score |
| Customers still parked at the final bell | auto-served | no dead customers, no last-second trick |
| Merge | free, keeps both buildings' book value | merging must never lose score |

Because cash and assets convert 1:1, the leaderboard is effectively **total cash ever produced**
(customers × income at the time they were served, including customer-type multipliers).

Simulation: winner **159.6 M**, last place **100.3 M** (**+59 %**), while every team's expected island
progress sits inside 87.1–93.7 %.

---

## 8. Simulation

### 8.1 Model

`scripts/economy-sim.mjs`: 15 teams, the real 15-round rotation (same formula as
`src/features/rally/schedule.ts`), skill-based post results, per-shop seats + serving time + capture,
parking capacity and voiding, per-type served gates, merge, relocation, selling at 75 %, a planner
that values a shop by what it can become (Lv3 + Lv2) rather than by its Lv1, the **4-cell-per-type
budget**, and the 900-card customer deck applied per customer.

Not modelled: real-time seconds (capture already compresses them), the Phaser animation, online-post
minigames.

```
node scripts/economy-sim.mjs --runs 200                                  # headline (v4 rule, deck on)
node scripts/economy-sim.mjs --runs 200 --deck 0                         # without typed customers
node scripts/economy-sim.mjs --runs 200 --mix nomerge                    # team never merges
node scripts/economy-sim.mjs --runs 200 --mix noretool                   # team never swaps weak shops
node scripts/economy-sim.mjs --runs 200 --mix casual                     # neither
node scripts/economy-sim.mjs --runs 50 --cellCap 3                       # tighter budget: 5 types
node scripts/economy-sim.mjs --runs 50 --cellCap 5                       # looser: 3.6 types
node scripts/economy-sim.mjs --runs 50 --cellCap 0                       # no budget: gold farm
node scripts/economy-sim.mjs --runs 50 --cellCap 0 --perArm 2            # the old v3 rule
node scripts/economy-sim.mjs --runs 200 --sweep 1,0.9,0.8                # price sensitivity
node scripts/economy-sim.mjs --runs 1 --trace                            # round by round
```

### 8.2 Headline result — 200 runs, all teams play the systems, deck on

| Team | Post skill | Progress | Shops | Types | Merges | Card × | Customers | Served | Total Earned |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|
| T01 | 1.00 | 93.7 % | 6.9 | 3.4 | 5.1 | 1.091 | 810 | 4 494 | 160 M |
| T02 | 0.95 | 93.6 % | 7.0 | 3.6 | 5.0 | 1.089 | 803 | 4 477 | 156 M |
| T03 | 0.89 | 91.7 % | 7.1 | 3.5 | 4.9 | 1.090 | 791 | 4 405 | 150 M |
| T04 | 0.84 | 90.8 % | 7.3 | 3.7 | 4.7 | 1.088 | 769 | 4 250 | 141 M |
| T05 | 0.79 | 89.3 % | 7.3 | 4.0 | 4.7 | 1.088 | 746 | 4 091 | 131 M |
| T06 | 0.73 | 90.0 % | 7.2 | 3.8 | 4.8 | 1.088 | 743 | 4 057 | 130 M |
| T07 | 0.68 | 88.4 % | 7.5 | 4.1 | 4.5 | 1.087 | 736 | 4 049 | 126 M |
| T08 | 0.63 | 90.3 % | 7.1 | 4.1 | 4.9 | 1.087 | 729 | 3 953 | 125 M |
| T09 | 0.57 | 88.3 % | 7.0 | 4.0 | 5.0 | 1.090 | 724 | 3 905 | 126 M |
| T10 | 0.52 | 91.1 % | 6.7 | 3.9 | 5.3 | 1.091 | 724 | 3 867 | 128 M |
| T11 | 0.46 | 91.3 % | 6.8 | 3.9 | 5.2 | 1.089 | 720 | 3 862 | 125 M |
| T12 | 0.41 | 89.3 % | 7.1 | 4.1 | 4.9 | 1.088 | 691 | 3 688 | 113 M |
| T13 | 0.36 | 87.9 % | 6.9 | 4.0 | 5.1 | 1.089 | 675 | 3 588 | 109 M |
| T14 | 0.30 | 87.1 % | 7.0 | 4.0 | 5.0 | 1.089 | 654 | 3 455 | 102 M |
| T15 | 0.25 | 87.3 % | 7.1 | 4.0 | 4.9 | 1.088 | 651 | 3 479 | 100 M |

**average 90.0 % · median 90.0 % · range 87.1 – 93.7 %** → inside the 85–95 % target.
Total Earned spread: **+59 %** (160 M vs 100 M). Voided customers: **0**.

- **Card multiplier ≈ 1.089× for every team**, as expected: the deck is shared, so it cannot favour
  anyone. It adds ~9 % cash and **does not add progress** — with the deck off the same rules give
  91.4 % average. Progress is land-bound, so extra cash has nowhere to go.
- **Strong teams concentrate, weak teams scatter.** The four-cell budget pushes everyone toward the
  same three types; a strong team gets there (T01: 3.4 types, 6.9 shops) while a weak team spreads
  the same cells over four types as Lv2s (T15: 4.0 types, 7.1 shops) and earns ~37 % less.
- **Fewer, bigger buildings.** v4 ends with ~7.0 shops instead of 7.8 and ~5.0 merges instead of 4.1:
  the budget makes “two Lv3” the goal, so teams merge instead of adding a fifth cheap copy.

### 8.3 Round-by-round (one seed, `--trace`)

`money / customers served so far / effective income / plot tier / shops`

| Round | T01 (strong) | T08 (middle) | T15 (weak) |
|---|---|---|---|
| R03 | 22k / 170 / 53k / P1 / 8 | 267k / 140 / 37k / P1 / 8 | 347k / 120 / 34k / P1 / 8 |
| R06 | 74k / 330 / 138k / P2 / 10 | 1 378k / 260 / 82k / P2 / 9 | 18k / 240 / 90k / P2 / 10 |
| R09 | 12 323k / 470 / 203k / P2 / 10 | 4 039k / 400 / 159k / P2 / 9 | 2 976k / 360 / 169k / P2 / 10 |
| R12 | 62 744k / 650 / 370k / P3 / 6 | 16 274k / 510 / 231k / P2 / 8 | 19 958k / 470 / 198k / P2 / 10 |
| R15 | 125 577k / 800 / 370k / P3 / 6 | 64 395k / 680 / 344k / P3 / 6 | 50 999k / 620 / 290k / P3 / 9 |

Plot tier 1 lasts ~4 rounds, tier 2 rounds 5–12, tier 3 from round 10–14. The big income jumps land on
the unlock bands (85 / 155 / 210 / 265 / 305 customers), which is where premium types join. A team
reaches its final three types around **round 11**, then spends the last rounds turning the second copy
of each into Lv3 — that is the intended “the island is finished, now the customers decide” phase, and
it is also why the shop count *falls* (10 → 6) while income rises.

### 8.4 Sensitivity — what happens if a team ignores a system

| Scenario | Average | Range |
|---|---:|---|
| Uses merge + swap (headline) | **90.0 %** | 87.1 – 93.7 % |
| Never merges (keeps 2× Lv2 forever) | 69.5 % | 68.1 – 71.3 % |
| Never swaps weak shops for premium | 43.6 % | 41.7 – 46.2 % |
| Ignores both (casual) | 38.0 % | 36.1 – 39.4 % |
| Mixed field (half optimal, half casual) | 65.6 % | 36.9 – 93.7 % |

The two systems are worth **20 points** (merge) and **46 points** (re-tooling). The game must make
both impossible to miss:

1. **Swap prompt (most important).** While the island is full, the HUD compares every unlocked type
   with the weakest shop and shows *"Toko Emas memberi 68 000/customer, Kedai Kopi Lv2 hanya 8 000.
   Tukar? (jual, 75 % cash kembali)"* with a one-tap button. A team re-tools ~16 times, so this is a
   frequent, first-class action — not a hidden trick.
2. **Merge prompt.** When a team owns 2× Lv2 of a type and the gate is met: *"Gabung jadi Lv3 —
   +18 400/100 customer, gratis"*, one tap.
3. **Show effective income, not sticker income.** The card must display `income × capture`, otherwise
   a premium shop at Lv1 (38–42 % capture) looks better than it is.
4. A 3-minute rules briefing: these two actions are worth 21–47 points of final progress.

### 8.5 Deck audit

| Check | Value |
|---|---|
| Deck size / distinct card types | 900 / 26 |
| Mean multiplier on a finished island | **1.089×** (1.087–1.091 per team) |
| Every 60-card window (one round's batch) | 1.063 – 1.124× |
| Cards that actually hit a target on a finished island | **51.3 %** (was 42.8 % under the v3 rule) |
| Cards that use the same-class fallback | 48.7 % |
| Targeted card types that never hit on any of 150 finished islands | 9 of 22 — the lovers of coffee, barber, flower, minimarket, books, pizza and sushi, plus Sosialita and Turis Lokal (a finished island has no Lv1 left) |

The four-cell budget makes the deck land more often, not less: **51.3 %** of the targeted cards hit a
shop the island actually owns (42.8 % under v3), because a finished island now holds ~4 types instead
of ~3. The rest resolves through the fallback — a "Pecinta Pizza" on an island of gold/bank/game pays
1.5× at the best *balanced* shop — which is what keeps the deck's mean stable at 1.089× and the card
family composition-neutral (§2.5). Pushing direct hits much higher would need an even tighter budget
(3 cells → 5 types), and that costs 48 000 of ceiling (§6.1).

### 8.6 Invariants and the honest variance note

| Check | Expected | Result |
|---|---|---|
| Every team's **expected** progress inside 85–95 % | 15 / 15 | ✅ 87.1 – 93.7 % |
| Nobody's expected progress reaches 100 % | 0 | ✅ best 93.7 % (average); a single run can touch 100 % |
| Nobody's expected progress stalls below 80 % | 0 | ✅ worst 87.1 % |
| Cells of one shop type | ≤ 4 | ✅ 0 violations in 450 team-runs |
| Cells on an island / per arm | ≤ 12 / ≤ 6 | ✅ 0 violations |
| Voided customers with normal play | 0 | ✅ 0 (a batch is 30–60, parking is 120+) |
| Voiding works when the lot is too small | > 0 | ✅ 283 voided per team with parking cut to 30 |
| Merge/sell/budget never leak | — | ✅ `apply()` throws if the budget or the arm cannot take it |
| Money stops binding near the end | by design | ✅ 40–120 M unspent from ~R11; land, the cell budget and gates are the limit |

**Variance, measured:** across 450 team-runs (30 events), **25 %** of single outcomes land above 95 %,
**30 %** below 85 % and **11 %** below 80 % (min 73.5 %, max 100.0 %); there is no run in which all 15
teams are simultaneously inside the band. v3 was 30 % / 24 % / 4.4 %: the new rule trades a slightly
lower tail for a hard ceiling — the old rule let a team print **105.4 %** by stacking three Lv3 of the
same type through cross-arm merges (§2.3), the new one cannot. The cause of the spread is still the
post reward table (a team that rolls high solo results gets 25 % more customers and reaches premium
one round earlier), not the shop economy. Two ways to tighten it if the organizer wants it:

- compress §3 (e.g. customers 45 / 50 / 55 instead of 40 / 50 / 60) — trades drama for predictability;
- or accept it: the band is a *design target for the average*, and variance is what makes the 4 hours
  feel like a competition rather than a spreadsheet.

---

## 9. Number scale (why customers are ×10 and cash is ×1000)

| Quantity | v1 | v2 | v3 | Factor |
|---|---:|---:|---:|---|
| Customers per post | 4–6 | 40–60 | 40–60 | ×10 |
| Customers per team | ~73 | ~730 | ~730 | ×10 |
| Parking capacity | 12 / 18 / 26 | 120 / 180 / 260 | 120 / 180 / 260 | ×10 |
| **Shop seats** | — | 5 / 8 / 16 | 5 / 8 / 16 | **not scaled** |
| **Serving time** | — | 5–12 s | 5–13 s | **not scaled** |
| Income per customer | 4k–66k | 4k–68k | 4k–68k | ≈ ×1000 |
| Shop price Lv1 | 45–330 (old units) | 250k–1.25M | 250k–1.35M | ≈ ×5000 |
| Customer multiplier | — | — | **1.089× deck mean** | new in v3 |
| Total Earned | ~9 400 | ~90 000 000 | ~100–160 000 000 | / |

Three warnings, all of them traps:

1. **Do not scale shop seats with the customer multiplier.** `capture = seats / (serving × arrival)`;
   multiplying seats ×10 makes capture 5.0 → every shop is at 100 % and the capacity system becomes
   decorative. Customers are a *flow*, seats are a *stock*: only the parking lot (a stock) got ×10.
2. **Do not scale income when you add customer cards.** The deck is worth +8.6 % cash. Income is left
   untouched on purpose: the island is land-bound, so the extra cash becomes Total Earned, not
   progress (§8.2). If you ever want the deck to be score-neutral too, divide every `inc` by 1.089.
3. **Use `bigint`** for `money`, `asset_value`, `total_earned`. Values reach 1.6 × 10^8, which fits in
   `integer` today, but the headroom is only ~13× and a bonus round would overflow it.

---

## 10. Implementation notes (server-authoritative)

### 10.1 Schema

| Change | Why |
|---|---|
| `shop_catalog` += `seats int[]`, `serve_seconds int[]`, `unlock_served int`, `income_by_level int[]`, `class`, `tags text[]` | capture, gates, card targeting |
| `team_shops` += `level`, `arm smallint`, `slot_start smallint` | 1×2 placement on the L shape; `arm` is only about adjacency now (no per-arm quota) — the cell budget is derived from `level`, so there is no column for it |
| `team_type_stats(team_id, shop_id, served int)` | the global per-type gate counter |
| `tycoons` += `parked_customers`, `plot_level`, `is_paused`, `timescale numeric`, `last_synced_at`, `deck_position int` | queue + pause + speed + deck cursor |
| `plot_tiers(tier, cells_per_arm, capacity, unlock_served, cost)` | data-driven land |
| `customer_catalog(id, name, kind, m, target jsonb, count int)` | the 26 card types, data not code |
| `customer_deck(position int pk, card_id fk)` | the precomputed 900-card order (seeded once) |
| `economy_transactions.kind` += `customer_income`, `shop_merge`, `shop_sell`, `plot_upgrade` | audit trail |
| all money columns → `bigint` | §9 |

The deck rows are generated once by `buildDeck()` and inserted by `seed.sql`, so every team and every
replay sees the identical order.

### 10.2 Tick

Because arrivals are per second and shops skip when full, the tick is a small deterministic replay:

```text
_sync_tycoon(team):
  read parked, plot, shops, timescale, is_paused, deck_position
  if paused or timescale = 0:  last_synced_at = now(); return
  staffed_seconds = floor((now() - last_synced_at) * timescale)
  for each second (bounded, e.g. 300 s per call, loop until caught up):
      if parked = 0: break
      for each shop in walking order: if free seat: seat it, schedule payout at t + serve_seconds
      take (entered) cards from customer_deck, starting at deck_position, wrap at 900
      parked -= entered; deck_position += entered
  payout = sum over finished visits of income_by_level[current level] × card_multiplier(card, shop)
  advance last_synced_at by staffed_seconds
```

Payouts are computed **per completed visit** with the level *and the card* at that moment, which is
exactly the rule in §2.2 rule 1 and §2.4. Cap the catch-up loop, return a cursor, and let the client
call again until it is done.

`card_multiplier(card, shop)` is a pure function of the card row and the current island (cells, types,
levels, walking order). It is evaluated **server-side only**; the client never computes money.

### 10.3 RPCs

| Function | Rule |
|---|---|
| `award_post_result(...)` | exists; add cash, add `parked = least(capacity, parked + n)`, log voided. The lookup key is `(post, round, result)` only — never `positions.delivery` (§13.1) |
| `purchase_shop(shop_id, arm)` | unlock by total served, **`sum(cells of that type) + 1 <= 4`** where `cells = (level = 3 ? 2 : 1)`, cells free, adjacent slot |
| `upgrade_shop(team_shop_id)` | Lv2: cash + `type_served >= 50`; Lv3: **merge only** |
| `merge_shops(team_shop_id_a, b)` | two identical Lv2, free; cell usage is unchanged (2×1 → 1×2), so the budget never blocks a merge. The merged pair may come from **different arms**; the 1×2 lands on an arm with two adjacent free cells |
| `sell_shop(team_shop_id)` | refund 75 %, remove book value, free cells |
| `move_shop(team_shop_id, arm, slot)` | free relocation, no overlap, quota respected |
| `upgrade_plot()` | `customers >= unlock_served` **and** cash, +2 cells, +capacity |
| `set_timescale(0 | 0.5 | 1 | 2)` | run the tick first, then store; `0` = pause |
| `advance_round()` | hard-confirm when the round still has missing results |

---

## 11. Tuning history (why these numbers)

Every row is a real simulator run. The failures are the interesting part.

| Version | Result | Diagnosis | Fix |
|---|---:|---|---|
| v1 draft 1 (old game numbers) | 36.8 % | prices far above total earnings | — |
| v1 draft 2 | 42 % | twelve 1×1 shops blocked every 1×2 upgrade | relocation + sell |
| v1 draft 3 | 51 % | planner optimised cash efficiency, ignored land | rank by income per cell |
| v1 draft 4 | 71.5 % | land wasted on mid-game junk | sell/retool at 75 % |
| v1 final | 87.5 % | — | — |
| v2 with open/close | — | exploit: closing banked customers and bypassed seats/serving | pause/resume + completion-time income |
| v2 first pass | 41.6 % | shop unlock read a field that no longer existed | fixed the gate field |
| v2 | 56.9 % | premium types unlocked at 440 customers ≈ round 12 | compressed to 290–300 |
| v2 | 58.8 % | sell loop thrashed (117 sells/team) | max 2 sells per round + payback rule |
| v2 | 65.9 % | merge preferred over swapping → island locked into 6 cheap Lv3 | don't invest in types far below the best |
| v2 | 69.6 % | planner valued a premium slot at its Lv1 income | value a build by `Lv3 + Lv2` potential |
| v2 | 80.8 % | two premium Lv1 shops kept swapping forever | compare per-cell value + payback |
| **v2 final** | **87.1 %** | in band, 5.4 types per island | — |
| v3 test: cap removed entirely | 89.2 % (85.8–92.5) | band fine, but **1.9 types**, 81 % of the island = gold, Total Earned spread 1.60× | rejected — the catalogue dies |
| v3 test: "market saturation" instead of a cap | ceiling 338–351 k | even a −55 % penalty on the 3rd copy keeps the optimum at 2–3 premium types | rejected — a soft cap is a cap |
| v3 first pass with `maxPerArm = 2` | 41 % | island full → no free cell → the swap path never fired → teams froze with junk shops | `potential` build flag + quota-aware swap |
| v3 | 134 % | swap built a shop whose arm was at quota → `armFor` returned −1 → 8.5 golds per island | guard in `apply()`, quota check on the freed arm |
| v3 | 90.8 % | planned walk **without** the deck: decay at ~R11–12, 3 types | — |
| **v3 final** | **90.8 % (86.5–94.4)** | deck mean 1.086×, 3 types, 0 voided | — |
| **v4: the per-arm rule was leaking** | best island 390 000 = **105.4 %** | merges may combine Lv2 from different arms, so a type reached **6 cells** (gold ×3 Lv3 + bank ×3 Lv3) instead of the 4 the design assumed | replaced by a cell budget |
| v4 test: cell budget 3 | 91.9 % (88.9–93.6), **5.0 types** | variety up, but the ceiling drops to 322 022 and every price would need re-tuning | rejected for v4 |
| v4 test: cell budget 5 | 86.6 % (82.2–89.7), 3.6 types | 5 = 2 + 2 + 1 leaves a weak Lv2 in the fifth cell, so teams finish *lower* than at 4 | rejected — odd budgets waste a cell |
| v4 test: cell budget 6 | 85.5 % (83.1–88.5), 3.2 types | 6 cells = 3 Lv3 of one type → ceiling 390 000, back to two types | rejected |
| **v4 final** | **90.0 % (87.1–93.7)** | 3.9 types, 370 000 ceiling unchanged, 0 violations of the budget, 0 voided | — |

Four things that looked right and were wrong:

- *Cheaper is easier.* True only up to a point: with money free, teams fill the island with junk and
  progress **drops** (v1: 45 % at ×0.3; v2: 46 % at ×0.7 before the planner fix).
- *Scaling seats with customers.* Makes capture 5.0 and deletes the mechanic (§9).
- *"No cap" only costs variety.* True, and it also makes the balance **unstable**: a ±10 % price
  change moved the no-cap band from 84.3 % to 91.5 % and back (non-monotone), while a capped rule
  moves smoothly. Variety is a buffer against mis-tuning.
- *A spatial rule can't be cheated.* It can. "2 buildings per arm" ignores **where the Lv2 came from**,
  so cross-arm merges let one type reach 6 cells and the ceiling the DP reported (370 000) was not
  the ceiling teams could reach (390 000). Counting **cells** closes that hole because a Lv3 costs 2
  cells no matter which arm its halves stood in.

---

## 12. Knobs and live risks

| Knob | Where | Safe range | Effect |
|---|---|---|---|
| `arrivalPerSec` | §2.1 | 1 (fixed) | defines capture; changing it re-tunes everything |
| `seats` / `serve` | `shop_catalog` | ±1 seat / ±1 s | capture, i.e. real income |
| `typeGate.up2/up3` | CONFIG | 40–70 / 100–140 | how "hard" upgrading feels |
| `maxCellsPerType` | CONFIG | **4** | 3 → 5 types but a 322 k ceiling; 5–6 → fewer types (3.6 / 3.2); off → 408 k gold farm (§6.1) |
| unlock table | `shop_catalog` | ±10 % | the main progress dial (85–95 % band) |
| shop prices | `shop_catalog` | ±15 % | progress, smoothly: ×0.85 → 86.8 %, ×1.15 → 91.1 % |
| `sellRefund` | CONFIG | 0.7–0.8 | forgiveness vs churn penalty |
| plot capacity | `plot_tiers` | 120 / 180 / 260 | pause safety, voiding rate |
| deck size | CONFIG | 900 | below ~750 a team sees rare cards twice; above 900 they never repeat |
| deck count per card | CONFIG | ±20 % | deck mean (and therefore cash scale) — keep the mean ≤ 1.10 |
| timescale | client + RPC | 0 / 0.5 / 1 / 2 | pacing only, never economics |

Live risks:

1. **A team never merges or never swaps** → 38–70 % (§8.4). Mitigate with the prompts in §8.4, not by
   changing the numbers.
2. **The endgame photo is 3 compounded types.** That is arithmetic, not a rule: 12 cells / 4 per type
   = 3. Measured spread is **3.9** types, because a team that cannot finish the third Lv3 keeps a
   Lv2 of a fourth shop instead. Variety therefore lives in the **journey** (~16 re-tools, §8.4). For
   a wider final photo the only lever is a tighter budget (3 cells = 5 types) and that costs 48 000
   of ceiling, i.e. a full re-tune — a v5 project, not a knob.
3. **Pausing forever** → the lot fills and customers are voided. Show "Parkiran penuh — customer
   hangus!" in red.
4. **A team finishes the island (100 %).** Measured: **20.5 %** of 600 team-runs complete all six Lv3,
   always around round 13–14, and none can overshoot (v3 could: its worst run printed 105.4 %). It is a
   legitimate “you won the build game” moment — they still collect cash, so Total Earned keeps moving.
   If the organizer wants fewer of them, raising the Lv3 gate does **not** work (measured: gate 120 →
   150 → 180 moved 20.5 % to 21.2 %), because by then every type has served every customer. The only
   lever that binds is a **merge fee booked as asset value** (score-neutral, so §7 still holds).
5. **Duplicate duel result** → already blocked by the `(round, position, team)` unique key.
6. **Round advanced with missing results** → a missed result costs ~500k + 50 customers and is
   unrecoverable. Make it a hard confirm.
7. **Deck edited after the event starts** → all teams must read the same deck. Change it only before
   round 1, and keep the row order fixed (`customer_deck.position`).

---

## 13. Decisions (was: open decisions)

| # | Question | Decision |
|---|---|---|
| 1 | Which posts are online vs offline | **both exist, identical reward** — the mode is presentation only (§13.1) |
| 2 | Does the HUD show the progress % | **organizer only**; players get cash / parked / seats / card / prompts (§13.2) |
| 3 | When are the timescale buttons available | **from round 1**, taught in the opening tutorial (§13.3) |
| 4 | Is the customer card shown, and how far ahead | **yes — current card plus the next 20** (§13.4) |
| 5 | Is a 3-type final island acceptable | **decided** — 3 types accepted, and the limit became a **4-cell budget per type** (§13.5) |

### 13.1 Post format: one reward table, two deliveries — DECIDED

All 12 posts pay from the **same table** (§3), whether the post is *online* (digital minigame on a
laptop, awarded by the server) or *offline* (physical props, result entered by staff). Only the
**shape of the minigame** differs, never the economy.

| Aspect | Online post | Offline post |
|---|---|---|
| Minigame | digital, laptop + Edge Function | physical props run by staff |
| Reward | §3 table, **identical** | §3 table, **identical** |
| How the result arrives | auto-award | staff input (one account per post) |
| Economic effect of the mode | **none** | **none** |

This is already true in the schema and must stay true: `positions.delivery` (migration 007) is read
only by `_assert_can_record`, to decide *who may record*, and `_apply_award` derives cash and
customers from the level alone. A `delivery` branch inside the reward lookup is a bug, not a feature.

The real risk is **difficulty parity**, because the model's variance rests on it: the factor spread
0.25–1.00 (§8.1) is what produces the +60 % Total Earned gap and the ±4–5 point per-event swing
(§8.6). If the offline props hand out level 3 twice as often as the digital minigame, the economy
tilts for a reason no player can see or learn from.

- Score both formats **mechanically** (attempts used or time thresholds → level 1/2/3), never by staff
  judgement.
- Calibrate each minigame to the same **level 1/2/3 probabilities**; measure over ~30 dry runs before
  the event.

### 13.2 HUD — DECIDED

| Where | Shows |
|---|---|
| **Team screen, always** | cash · parked / capacity · free seats per shop · the **current customer card** (name + one-line rule) · the merge prompt and the swap prompt when they are valid |
| **Team screen, queue strip** | the next 20 customers (§13.4) |
| **Team screen, on tap** | shop detail: level, income, capture, **effective income**, progress toward the next gate |
| **Map overlay** | the walking path (arm 0 from the entrance, then arm 1) and, when *Si Buru-buru* is the current card, a highlight on the **first 3 shops** — that card is unplayable without it (§2.5) |
| **Organizer screen only** | island **progress %**, per-type served vs gate, voided customers, deck position |

Rules:

- **Effective income, never sticker income** — inside the tap-through shop card and inside the
  merge/swap prompts (§8.4 item 3). A premium Lv1 (38–42 % capture) must never look better than a
  cheap Lv3, and the prompts are where the decision is actually taken.
- The **prompts are the tutorial**. Merge and re-tool are worth 21 and 47 points of final progress, so
  they surface as cards on the team screen, not in a settings page.
- **“Parkiran penuh — customer hangus!”** is part of parked/capacity: red, persistent, plus the number
  of customers lost in the last minute. It is the only alarm a player sees and the only thing that
  punishes leaving the game paused (§12 risk 3).
- Progress % stays hidden from players **on purpose**: the leaderboard (Total Earned) is public, while
  completeness is an organizer guard-rail (§6). A team that can watch 94 % starts optimising the
  number instead of playing the market.

### 13.3 Timescale from round 1 — DECIDED

0× / 0.5× / 1× / 2× are available from the first second, because the opening tutorial teaches them.
Nobody should spend round 1 watching a queue drain.

- The tutorial teaches exactly three things: **2× to burn a fresh batch**, **0× to renovate**, and
  **“parkir penuh = hangus”**.
- Timescale remains pacing only, never economics (§2.2): pausing freezes serving but not the parking
  lot, and income is resolved at completion with the shop's *current* level.
- Because a team can sit at 2× from the start, `_sync_tycoon` (§10.2) must replay a whole batch
  (~60 s × 2) in a single call, and a tablet that slept for 10 minutes must replay correctly. Test
  that path before the event: it is the only place where “speed” can corrupt state.

### 13.4 Customer preview: current card plus the next 20 — DECIDED

20 is the right number, and the arithmetic agrees: a team meets ≈ 730 customers over 15 rounds, i.e.
**≈ 3 per minute**, so 20 cards ≈ **6–7 minutes of foresight** (≈ 3 minutes at 2×) — about a third of
a round. Enough to plan a swap or hold cash for an upgrade; not enough to solve the deck.

| Element | Detail |
|---|---|
| Prominent | current card + the next 2, each with its rule in one line (*“Sultan — 3× semua toko”*) |
| Strip | the remaining 17 as icons; tap an icon to read its rule |
| Alarm | highlight the strip when a Langka / Legendaris card is inside the window |
| Source | server `deck_position` — the client never draws cards, and there is nothing to re-roll |
| Advances when | a customer **enters** a shop, not when a post is awarded, so the strip freezes while paused — exactly the planning window we want |

Why not fewer: the deck is interleaved so every 60-card window stays within 1.04–1.16× (§2.4), which
means 563 of the 900 cards are plain *Pengunjung Biasa*; a 3-card window would teach nothing.
Why not more: past ~20 the strip stops being readable on a tablet, and a legendary card you can see
15 minutes early stops being legendary.

### 13.5 The final island — DECIDED (v4)

**Decision: keep a 3-type endgame, and express the limit in cells, not buildings.** One shop type may
occupy **at most 4 cells** (§2.3). Lv1/Lv2 = 1 cell, Lv3 = 2, so a type ends as 2× Lv3 and never as
3× Lv3.

Why this and not the alternatives (all measured, §6.1 / §11):

| Option | Final photo | Verdict |
|---|---|---|
| **4-cell budget** | 3 types at the top, **3.9 measured**, ceiling **370 000** | **chosen** — the tuned prices, gates and unlocks survive untouched |
| No limit at all | 1.5 types, 5.5 of 6.1 buildings are gold, 94.5 % (up to 97.5 %) | rejected — the catalogue becomes decoration and the band breaks |
| 2 buildings per arm (v3) | 3.2 types | rejected — mergeable across arms, so it leaked to 390 000 / 105.4 % |
| 3 cells per type | 5.0 types, ceiling 322 022 | deferred — the most variety, but every price would need re-tuning (a v5 project) |
| Global cap of 2 per type (v2) | 5.4 types, ceiling 294 800 | rejected — invisible on screen and a full re-tune |

The final photo still tells a story **outside the score**: the organizer award *“Pulau Paling Unik”*
(most distinct types) costs nothing economically because it never touches Total Earned.
