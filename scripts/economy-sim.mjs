// Rally Tycoon — economy simulator (v4)
//
// v4 changes over v3:
//   * the PER-ARM building cap is replaced by a GLOBAL CELL BUDGET per shop type
//     (`maxCellsPerType = 4`): Lv1/Lv2 occupy 1 cell, Lv3 occupies 2, so a type ends as
//     "2x Lv3" or "1x Lv3 + 2x Lv2" and never as 3 Lv3. One sentence to teach, and the
//     100 % island (370 000, 6x Lv3) is unchanged, so prices/gates/unlocks do not move;
//   * `maxPerArm` is kept only as an OPTIONAL legacy guard (Infinity by default) so the
//     historical sweeps in docs/economy-balance.md §11 stay reproducible via --perArm N;
//   * typed customers: every arriving customer draws the next card of a fixed 900-card deck
//     and pays `income x card multiplier` at every shop it can enter.
//
// Usage
//   node scripts/economy-sim.mjs --runs 200 --mix optimal
//   node scripts/economy-sim.mjs --runs 200 --deck 0          # no typed customers
//   node scripts/economy-sim.mjs --runs 200 --cellCap 3       # tighter cell budget (5 types)
//   node scripts/economy-sim.mjs --runs 200 --cellCap 0       # no budget at all (gold farm)
//   node scripts/economy-sim.mjs --runs 200 --cellCap 0 --perArm 2   # the old per-arm rule
//   node scripts/economy-sim.mjs --runs 50 --priceK 0.9 --unlockK 0.9 --gateK 1
//   node scripts/economy-sim.mjs --runs 1 --trace
//   node scripts/economy-sim.mjs --sweep 1,0.9,0.8

export const ARRIVAL_PER_SEC = 1

export const CONFIG = {
  rounds: 15,
  startMoney: 1_000_000,
  sellRefund: 0.75,
  // Buildings of the same type that may stand in ONE arm at the same time.
  // LEGACY (v3): off by default (Infinity). The live rule is `maxCellsPerType`; this remains only
  // so the historical per-arm sweeps in docs/economy-balance.md §11 reproduce with --perArm N.
  maxPerArm: Infinity,
  // Cells (not buildings) one shop type may occupy across the WHOLE island. Lv1/Lv2 = 1 cell,
  // Lv3 = 2 cells, so 4 means "2x Lv3" or "1x Lv3 + 2x Lv2" but never 3 Lv3. 0 = off.
  maxCellsPerType: 4,
  // Customers served at that shop TYPE (global, not per building) needed to unlock upgrades.
  typeGate: { up2: 50, up3: 120 },

  solo: {
    level_1: { money: 300_000, customers: 40 },
    level_2: { money: 500_000, customers: 50 },
    level_3: { money: 700_000, customers: 60 },
  },
  duel: {
    lose: { money: 200_000, customers: 30 },
    draw: { money: 350_000, customers: 40 },
    win: { money: 500_000, customers: 60 },
  },

  plots: [
    { tier: 1, armCells: 4, capacity: 120, unlockServed: 0, cost: 0 },
    { tier: 2, armCells: 5, capacity: 180, unlockServed: 240, cost: 1_150_000 },
    { tier: 3, armCells: 6, capacity: 260, unlockServed: 520, cost: 3_100_000 },
  ],

  // seats[level] and serve[level] define capture. inc[level] is cash per customer at that level.
  shops: [
    { id: 'minimarket', name: 'Minimarket', kind: 'fast', tags: ['retail'], unlock: 0, seats: [5, 8, 16], serve: [8, 7, 5], buy: 250_000, up2: 350_000, inc: [4_000, 6_000, 13_000] },
    { id: 'coffee', name: 'Kedai Kopi', kind: 'fast', tags: ['cafe'], unlock: 0, seats: [5, 8, 16], serve: [8, 7, 5], buy: 300_000, up2: 400_000, inc: [5_000, 8_000, 18_000] },
    { id: 'barber', name: 'Barbershop', kind: 'balanced', tags: ['service'], unlock: 45, seats: [5, 8, 16], serve: [10, 9, 7], buy: 350_000, up2: 500_000, inc: [6_000, 9_000, 20_000] },
    { id: 'books', name: 'Toko Buku', kind: 'balanced', tags: ['retail'], unlock: 45, seats: [5, 8, 16], serve: [10, 9, 7], buy: 400_000, up2: 600_000, inc: [7_000, 10_000, 22_000] },
    { id: 'flower', name: 'Toko Bunga', kind: 'balanced', tags: ['retail'], unlock: 85, seats: [5, 8, 16], serve: [10, 9, 7], buy: 450_000, up2: 700_000, inc: [8_000, 12_000, 26_000] },
    { id: 'icecream', name: 'Es Krim', kind: 'fast', tags: ['fun'], unlock: 85, seats: [5, 8, 16], serve: [8, 7, 5], buy: 500_000, up2: 800_000, inc: [9_000, 13_000, 29_000] },
    { id: 'pizza', name: 'Pizzeria', kind: 'balanced', tags: ['food'], unlock: 155, seats: [5, 8, 16], serve: [10, 9, 7], buy: 600_000, up2: 950_000, inc: [11_000, 16_000, 35_000] },
    { id: 'ramen', name: 'Ramen Bar', kind: 'balanced', tags: ['food'], unlock: 155, seats: [5, 8, 16], serve: [10, 9, 7], buy: 650_000, up2: 1_050_000, inc: [12_000, 17_000, 37_000] },
    { id: 'sushi', name: 'Sushi Bar', kind: 'premium', tags: ['food'], unlock: 210, seats: [5, 8, 16], serve: [12, 10, 8], buy: 800_000, up2: 1_250_000, inc: [14_000, 20_000, 44_000] },
    { id: 'toys', name: 'Toko Mainan', kind: 'balanced', tags: ['fun'], unlock: 210, seats: [5, 8, 16], serve: [10, 9, 7], buy: 850_000, up2: 1_300_000, inc: [15_000, 21_000, 46_000] },
    { id: 'game', name: 'Game Center', kind: 'balanced', tags: ['fun'], unlock: 265, seats: [5, 8, 16], serve: [10, 9, 7], buy: 1_000_000, up2: 1_600_000, inc: [18_000, 25_000, 55_000] },
    { id: 'gold', name: 'Toko Emas', kind: 'premium', tags: ['luxury'], unlock: 265, seats: [5, 8, 16], serve: [12, 10, 8], buy: 1_250_000, up2: 1_950_000, inc: [22_000, 31_000, 68_000] },
    { id: 'bank', name: 'Bank', kind: 'premium', tags: ['luxury'], unlock: 305, seats: [5, 8, 16], serve: [13, 11, 9], buy: 1_350_000, up2: 2_100_000, inc: [20_000, 28_000, 62_000] },
  ],

  // ---------------------------------------------------------------- customer deck
  // A fixed, repeating, deterministic deck. Every team reads it from card 0, so all teams see
  // the same sequence: fair, reproducible, and simulatable without randomness.
  deck: {
    enabled: true,
    size: 900,
    // kind:
    //   all      -> every shop
    //   shops    -> listed shop ids
    //   tag      -> shops carrying one of the tags
    //   class    -> kind in fast/balanced/premium
    //   level    -> shops whose level equals `level`
    //   cells    -> whole island, tiered by occupied cells  (tiers ascending, mults +1 entry)
    //   types    -> whole island, tiered by distinct shop types
    //   first    -> the first `n` shops of the walking order (arm 0 first, then arm 1)
    cards: [
      { id: 'normal', name: 'Pengunjung Biasa', kind: 'all', m: 1, count: 563 },
      { id: 'lover-minimarket', name: 'Ibu Belanja', kind: 'shops', shops: ['minimarket'], m: 2, count: 10 },
      { id: 'lover-coffee', name: 'Pencinta Kopi', kind: 'shops', shops: ['coffee'], m: 2, count: 10 },
      { id: 'lover-icecream', name: 'Anak Es Krim', kind: 'shops', shops: ['icecream'], m: 2, count: 10 },
      { id: 'lover-barber', name: 'Si Rapi', kind: 'shops', shops: ['barber'], m: 2, count: 10 },
      { id: 'lover-books', name: 'Kutu Buku', kind: 'shops', shops: ['books'], m: 2, count: 10 },
      { id: 'lover-flower', name: 'Pecinta Bunga', kind: 'shops', shops: ['flower'], m: 2, count: 10 },
      { id: 'lover-pizza', name: 'Pecinta Pizza', kind: 'shops', shops: ['pizza'], m: 2, count: 10 },
      { id: 'lover-ramen', name: 'Pecinta Ramen', kind: 'shops', shops: ['ramen'], m: 2, count: 10 },
      { id: 'lover-toys', name: 'Pecinta Mainan', kind: 'shops', shops: ['toys'], m: 2, count: 10 },
      { id: 'lover-game', name: 'Gamer', kind: 'shops', shops: ['game'], m: 2, count: 10 },
      { id: 'lover-sushi', name: 'Pecinta Sushi', kind: 'shops', shops: ['sushi'], m: 2, count: 10 },
      { id: 'lover-gold', name: 'Kolektor Emas', kind: 'shops', shops: ['gold'], m: 2, count: 10 },
      { id: 'lover-bank', name: 'Nasabah', kind: 'shops', shops: ['bank'], m: 2, count: 10 },
      { id: 'kid', name: 'Anak-anak', kind: 'tag', tags: ['fun'], m: 1.5, count: 37 },
      { id: 'hungry', name: 'Si Lapar', kind: 'tag', tags: ['food'], m: 2, count: 37 },
      { id: 'techbro', name: 'Anak Nongkrong', kind: 'shops', rules: [{ shops: ['coffee'], m: 3 }, { shops: ['game'], m: 2 }], count: 25 },
      { id: 'socialite', name: 'Sosialita', kind: 'shops', shops: ['flower', 'books'], m: 2, count: 25 },
      { id: 'earlybird', name: 'Si Buru-buru', kind: 'first', n: 3, m: 2, count: 25 },
      { id: 'collector', name: 'Kolektor', kind: 'level', level: 3, m: 2, count: 15 },
      { id: 'tourist', name: 'Turis', kind: 'cells', tiers: [5, 8, 11], mults: [1, 1.25, 1.5, 2], count: 12 },
      { id: 'backpacker', name: 'Turis Lokal', kind: 'level', level: 1, m: 2, count: 12 },
      { id: 'investor', name: 'Investor', kind: 'shops', shops: ['bank', 'gold'], m: 2, count: 6 },
      { id: 'businessman', name: 'Bisnisman', kind: 'class', class: 'premium', m: 2, count: 6 },
      { id: 'rich', name: 'Orang Kaya', kind: 'all', m: 2, count: 6 },
      { id: 'sultan', name: 'Sultan', kind: 'all', m: 3, count: 1 },
    ],
  },

  players: {
    optimal: { merge: true, retool: true },
    nomerge: { merge: false, retool: true },
    noretool: { merge: true, retool: false },
    casual: { merge: false, retool: false },
  },
}

const shopIdx = (cfg) => Object.fromEntries(cfg.shops.map((s) => [s.id, s]))
const capture = (shop, level) => Math.min(1, shop.seats[level - 1] / (shop.serve[level - 1] * ARRIVAL_PER_SEC))
const effIncome = (shop, level) => shop.inc[level - 1] * capture(shop, level)

// ---------------------------------------------------------------- RNG / schedule
function mulberry32(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const SOLO_SLOTS = [0, 1, 2, 3, 4, 5, 6, 7, 8]
const DUEL_SLOTS = [
  [9, 12],
  [10, 14],
  [11, 13],
]
export const teamAtSlot = (round, slot) => ((((slot - 7 * round) % 15) + 15) % 15) + 1

export function buildPlays(rounds) {
  return Array.from({ length: rounds }, (_, r) => ({
    round: r + 1,
    solo: SOLO_SLOTS.map((slot, i) => ({ position: i + 1, team: teamAtSlot(r, slot) })),
    duels: DUEL_SLOTS.map(([a, b], i) => ({ position: 10 + i, teams: [teamAtSlot(r, a), teamAtSlot(r, b)] })),
  }))
}

// ---------------------------------------------------------------- customer deck
// Deterministic, evenly spread deck: rarest card types are placed first with a stride, frequent
// ones fill the gaps. Result: every window of ~60 consecutive cards has a multiplier within a few
// percent of the deck mean, so a 40-60 customer round never lands on a lucky or unlucky block.
export function buildDeck(cfg = CONFIG) {
  const N = cfg.deck.size
  const slots = new Array(N).fill(null)
  const cards = [...cfg.deck.cards].sort((a, b) => a.count - b.count)
  cards.forEach((card, i) => {
    const step = N / card.count
    const offset = (i * 137.508) % N
    for (let k = 0; k < card.count; k++) {
      let p = Math.floor((k + 0.5) * step + offset) % N
      while (slots[p] !== null) p = (p + 1) % N
      slots[p] = card
    }
  })
  return slots
}

const cellsOf = (b) => (b.level === 3 ? 2 : 1)

// Walking order: arm 0 from the entrance, then arm 1. `slot` is the cell index inside the arm.
export function walkingOrder(t) {
  return [...t.buildings].sort((a, b) => a.arm - b.arm || a.slot - b.slot || a.id - b.id)
}

function tierValue(card, value) {
  let idx = 0
  for (const t of card.tiers) if (value >= t) idx += 1
  return card.mults[Math.min(idx, card.mults.length - 1)]
}

export function cardMultiplier(card, b, t, cfg, firstIds) {
  if (card.kind === 'all') return card.m
  if (card.kind === 'cells') return tierValue(card, t.arms[0] + t.arms[1])
  if (card.kind === 'types') return tierValue(card, new Set(t.buildings.map((x) => x.type)).size)
  if (card.kind === 'first') return firstIds.has(b.id) ? card.m : 1
  if (card.kind === 'level') return b.level === card.level ? card.m : 1
  const shop = shopIdx(cfg)[b.type]
  if (card.rules) {
    let m = 1
    for (const r of card.rules) if (r.shops.includes(b.type) || (r.tags && r.tags.some((x) => shop.tags.includes(x)))) m = Math.max(m, r.m)
    return m
  }
  if (card.shops) return card.shops.includes(b.type) ? card.m : 1
  if (card.tags) return card.tags.some((x) => shop.tags.includes(x)) ? card.m : 1
  if (card.class) return shop.kind === card.class ? card.m : 1
  return 1
}

// Cash one customer of this type pays on this island, in effective-income terms.
export function cardBasket(card, t, cfg) {
  const idx = shopIdx(cfg)
  const targeted = card.kind !== 'all' && card.kind !== 'cells' && card.kind !== 'types'
  const firstIds = card.kind === 'first' ? new Set(walkingOrder(t).slice(0, card.n).map((b) => b.id)) : null
  let total = 0
  let base = 0
  for (const b of t.buildings) {
    const eff = effIncome(idx[b.type], b.level)
    base += eff
    total += eff * cardMultiplier(card, b, t, cfg, firstIds)
  }
  // Fallback so no customer type is a dud: if the island owns none of the targeted shops, the
  // customer settles for the best shop of the SAME CLASS it was looking for (a pizza lover still
  // eats somewhere), and only then for the island's single best shop. Flat 1.5x.
  if (targeted && base > 0 && total <= base + 1e-9) {
    const wanted = card.shops?.[0] ?? card.rules?.[0]?.shops?.[0]
    const wantedKind = wanted ? idx[wanted].kind : null
    let best = 0
    let bestSameClass = 0
    for (const b of t.buildings) {
      const eff = effIncome(idx[b.type], b.level)
      if (eff > best) best = eff
      if (wantedKind && idx[b.type].kind === wantedKind && eff > bestSameClass) bestSameClass = eff
    }
    total = base + 0.5 * (bestSameClass || best)
  }
  return total
}

// ---------------------------------------------------------------- maximum island
// Legacy per-arm options (used only when maxCellsPerType = 0): at most `perArm` buildings of a type
// standing in one arm, and a Lv3 needs two Lv2 standing to be merged, so n <= perArm - 1 Lv3.
export function typeOptions(shop, perArm = 2, armCells = 6) {
  if (!Number.isFinite(perArm)) perArm = armCells * 2
  const e2 = effIncome(shop, 2)
  const e3 = effIncome(shop, 3)
  const out = [{ label: '-', blocks: [], cells: 0, eff: 0 }]
  const maxLv3 = Math.max(0, perArm - 1)
  for (let lv3 = 0; lv3 <= maxLv3; lv3++) {
    for (let singles = 0; lv3 + singles <= perArm; singles++) {
      if (lv3 === 0 && singles === 0) continue
      const cells = lv3 * 2 + singles
      if (cells > armCells) continue
      out.push({
        label: `${lv3}xLv3${singles ? `+${singles}xLv2` : ''}`,
        blocks: [...Array(lv3).fill(2), ...Array(singles).fill(1)],
        cells,
        eff: lv3 * e3 + singles * e2,
      })
    }
  }
  return out
}

// The two arms are interchangeable, so the island maximum is twice the best single arm.
export function maxEffectiveIncome(armCells, cfg = CONFIG) {
  const cap = cfg.maxCellsPerType || 0
  if (cap > 0) {
    // Global cell budget: the two arms are no longer independent, so run one knapsack over the
    // whole island. A Lv3 still needs 2 contiguous cells inside one arm, which is always packable
    // here because a type may hold at most floor(cap/2) Lv3 and each arm fits floor(armCells/2).
    const total = armCells * 2
    const maxLv3 = Math.min(Math.floor(cap / 2), 2 * Math.floor(armCells / 2))
    let dp = new Array(total + 1).fill(0)
    for (const shop of cfg.shops) {
      const e2 = effIncome(shop, 2)
      const e3 = effIncome(shop, 3)
      const next = dp.slice()
      for (let lv3 = 0; lv3 <= maxLv3; lv3++) {
        for (let singles = 0; lv3 + singles <= total; singles++) {
          if (lv3 === 0 && singles === 0) continue
          const cells = lv3 * 2 + singles
          if (cells > cap || cells > total) continue
          const eff = lv3 * e3 + singles * e2
          for (let c = cells; c <= total; c++) {
            const v = dp[c - cells] + eff
            if (v > next[c]) next[c] = v
          }
        }
      }
      dp = next
    }
    return Math.max(...dp)
  }
  let dp = new Array(armCells + 1).fill(0)
  for (const shop of cfg.shops) {
    const next = dp.slice()
    for (const opt of typeOptions(shop, cfg.maxPerArm, armCells)) {      for (let c = opt.cells; c <= armCells; c++) {
        const v = dp[c - opt.cells] + opt.eff
        if (v > next[c]) next[c] = v
      }
    }
    dp = next
  }
  return 2 * Math.max(...dp)
}

// ---------------------------------------------------------------- team
const buildingEff = (b, cfg) => effIncome(shopIdx(cfg)[b.type], b.level)
const teamEff = (t, cfg) => t.buildings.reduce((s, b) => s + buildingEff(b, cfg), 0)
const armCells = (t, cfg) => cfg.plots[t.plotTier].armCells
const freeCells = (t, cfg) => armCells(t, cfg) * 2 - t.arms[0] - t.arms[1]
const freeIn = (t, arm, cfg) => armCells(t, cfg) - t.arms[arm]
const countIn = (t, type, arm) => t.buildings.filter((b) => b.type === type && b.arm === arm).length
const typeCells = (t, type) => t.buildings.filter((b) => b.type === type).reduce((s, b) => s + cellsOf(b), 0)
// Global per-type cell budget (off when maxCellsPerType = 0). `extra` = cells the action would add.
const capOk = (t, type, extra, cfg) => !cfg.maxCellsPerType || typeCells(t, type) + extra <= cfg.maxCellsPerType

function armFor(t, cells, cfg, preferType) {
  const fits = [0, 1].filter(
    (a) => freeIn(t, a, cfg) >= cells && countIn(t, preferType, a) < cfg.maxPerArm && capOk(t, preferType, cells, cfg),
  )
  if (fits.length === 0) return -1
  if (preferType) {
    const withSame = fits.find((a) => t.buildings.some((b) => b.arm === a && b.type === preferType))
    if (withSame !== undefined) return withSame
  }
  return fits.sort((a, b) => freeIn(t, a, cfg) - freeIn(t, b, cfg))[0]
}

function newTeam(id, skill, behavior, cfg) {
  return {
    id,
    skill,
    behavior,
    money: cfg.startMoney,
    customers: 0,
    serves: 0,
    parked: 0,
    voided: 0,
    plotTier: 0,
    arms: [0, 0],
    buildings: [], // { id, type, level, arm, slot, paid }
    spent: 0,
    typeServed: Object.fromEntries(cfg.shops.map((s) => [s.id, 0])),
    merges: 0,
    sold: 0,
    nextId: 1,
    roundsLeft: 15,
    soldThisRound: 0,
    pausedRounds: 0,
    deckPos: 0,
    cardIncome: 0, // cash earned through customer multipliers
    plainIncome: 0, // what the same customers would have paid at 1x
  }
}

// What a type can realistically be worth by the end of the event.
function typePotential(shop, roundsLeft) {
  if (roundsLeft >= 5) return effIncome(shop, 3) + effIncome(shop, 2)
  if (roundsLeft >= 3) return effIncome(shop, 2)
  return effIncome(shop, 1)
}

function bestAvailablePotential(t, cfg) {
  return Math.max(...cfg.shops.filter((s) => t.customers >= s.unlock).map((s) => typePotential(s, t.roundsLeft)), 1)
}

function actions(t, cfg) {
  const out = []
  const bestAvail = bestAvailablePotential(t, cfg)
  const keepBar = 0.75 * bestAvail
  for (const shop of cfg.shops) {
    const owned = t.buildings.filter((b) => b.type === shop.id)
    const cellOpen = capOk(t, shop.id, 1, cfg)
    const perArmOpen = cellOpen && [0, 1].some((a) => freeIn(t, a, cfg) >= 1 && countIn(t, shop.id, a) < cfg.maxPerArm)
    const quotaOpen = cellOpen && [0, 1].some((a) => countIn(t, shop.id, a) < cfg.maxPerArm)
    if (perArmOpen || (quotaOpen && freeCells(t, cfg) === 0)) {
      // `feasible` = can be built right now; `potential` = could be built after selling a shop.
      // The island is usually land-locked late, so the re-tool path needs the second flag.
      out.push({
        kind: 'build',
        type: shop.id,
        cost: shop.buy,
        gain: typePotential(shop, t.roundsLeft),
        unlocked: t.customers >= shop.unlock,
        feasible: perArmOpen,
        potential: true,
      })
    }
    const lv1 = owned.filter((b) => b.level === 1)
    const lv2 = owned.filter((b) => b.level === 2)
    const worthKeeping = typePotential(shop, t.roundsLeft) >= keepBar
    if (worthKeeping && lv1.length > 0 && t.typeServed[shop.id] >= cfg.typeGate.up2) {
      out.push({ kind: 'up2', type: shop.id, building: lv1[0], cost: shop.up2, gain: effIncome(shop, 2) - effIncome(shop, 1), unlocked: true, feasible: true })
    }
    if ((cfg.players[t.behavior] ?? cfg.players.casual).merge && worthKeeping && lv2.length >= 2 && t.typeServed[shop.id] >= cfg.typeGate.up3) {
      const [a, b] = lv2
      // The Lv3 needs 2 free cells in one arm *after* both Lv2 are released.
      const roomIn = (arm) => freeIn(t, arm, cfg) + (a.arm === arm ? cellsOf(a) : 0) + (b.arm === arm ? cellsOf(b) : 0)
      const feasible = [0, 1].some((arm) => roomIn(arm) >= 2)
      out.push({ kind: 'merge', type: shop.id, pair: [a, b], cost: 0, gain: effIncome(shop, 3) - 2 * effIncome(shop, 2), unlocked: true, feasible })
    }
  }
  return out
}

function apply(t, a, cfg) {
  if (a.kind === 'build') {
    const arm = armFor(t, 1, cfg, a.type)
    if (arm < 0) throw new Error(`no arm accepts ${a.type} (quota/space violated)`)
    const slot = t.arms[arm]
    t.arms[arm] += 1
    t.buildings.push({ id: t.nextId++, type: a.type, level: 1, arm, slot, paid: a.cost })
  } else if (a.kind === 'up2') {
    a.building.level = 2
    a.building.paid += a.cost
  } else {
    const [x, y] = a.pair
    t.arms[x.arm] -= cellsOf(x)
    t.arms[y.arm] -= cellsOf(y)
    t.buildings = t.buildings.filter((b) => b !== y)
    let arm = freeIn(t, x.arm, cfg) >= 2 ? x.arm : 1 - x.arm
    t.arms[arm] += 2
    x.level = 3
    x.arm = arm
    x.slot = t.arms[arm] - 2
    x.paid += y.paid // inherited book value (the team paid for both buildings)
    t.merges += 1
  }
  t.money -= a.cost
  t.spent += a.cost
}

// Land is the scarce resource, so rank by income gain per CELL first, then by gain per cash.
function rankScore(a) {
  const cells = a.kind === 'build' ? 1 : 0
  return a.gain / (cells + 0.3)
}

function spendLoop(t, cfg) {
  for (;;) {
    const nextPlot = cfg.plots[t.plotTier + 1]
    if (freeCells(t, cfg) === 0 && nextPlot && t.customers >= nextPlot.unlockServed && t.money >= nextPlot.cost) {
      t.money -= nextPlot.cost
      t.spent += nextPlot.cost
      t.plotTier += 1
      continue
    }
    const cands = actions(t, cfg)
      .filter((a) => a.unlocked && a.feasible && t.money >= a.cost)
      .sort((a, b) => (b.kind === 'merge') - (a.kind === 'merge') || rankScore(b) - rankScore(a) || a.cost - b.cost)
    const best = cands[0]
    if (best) {
      apply(t, best, cfg)
      continue
    }
    // Nothing affordable/fits: demolish the weakest shop when a clearly better, already unlocked
    // shop type can replace it. This is how a competent team re-tools a junk-filled island.
    if ((cfg.players[t.behavior] ?? cfg.players.casual).retool && freeCells(t, cfg) === 0 && t.buildings.length > 0 && t.soldThisRound < 2) {
      const bestAvail = bestAvailablePotential(t, cfg)
      const weakest = [...t.buildings]
        .filter((b) => b.level < 3 && typePotential(shopIdx(cfg)[b.type], t.roundsLeft) < 0.9 * bestAvail)
        .sort((a, b) => buildingEff(a, cfg) / cellsOf(a) - buildingEff(b, cfg) / cellsOf(b))[0]
      if (!weakest) return
      const refund = Math.round(weakest.paid * cfg.sellRefund)
      const better = actions(t, cfg)
        .filter(
          (a) =>
            a.kind === 'build' &&
            a.unlocked &&
            a.potential &&
            a.type !== weakest.type &&
            countIn(t, a.type, weakest.arm) < cfg.maxPerArm && // the freed arm must accept it
            capOk(t, a.type, 1, cfg) && // the type's global cell budget must accept it
            t.money + refund >= a.cost,
        )
        .sort((a, b) => b.gain - a.gain)[0]
      // Swap only when the extra income still pays back the 25 % sunk cost before the event ends.
      const betterPerCell = better ? better.gain / 3 : 0
      const currentPerCell = buildingEff(weakest, cfg) / cellsOf(weakest)
      const played = Math.max(1, cfg.rounds - t.roundsLeft + 1)
      const avgPost = t.customers / played
      const payback = (betterPerCell - currentPerCell) * avgPost * t.roundsLeft * 0.5
      const loss = weakest.paid - refund
      if (better && weakest.level < 3 && payback > loss) {
        t.arms[weakest.arm] -= cellsOf(weakest)
        t.buildings = t.buildings.filter((b) => b !== weakest)
        t.money += refund
        t.spent -= weakest.paid
        t.sold += 1
        t.soldThisRound += 1
        apply(t, better, cfg)
        continue
      }
    }
    return
  }
}

// ---------------------------------------------------------------- simulation
export function simulate({ skills, behaviors, seed = 1, cfg = CONFIG }) {
  const rng = mulberry32(seed)
  const teams = skills.map((skill, i) => newTeam(i + 1, skill, behaviors[i], cfg))
  const plays = buildPlays(cfg.rounds)
  const roundLog = []
  const deck = cfg.deck.enabled ? buildDeck(cfg) : null

  const rollSolo = (t) => {
    const p = t.skill
    const p3 = 0.08 + 0.55 * p
    const p2 = 0.34
    const r = rng()
    const level = r < p3 ? 'level_3' : r < p3 + p2 ? 'level_2' : 'level_1'
    return { key: level, ...cfg.solo[level] }
  }
  const rollDuel = (a, b) => {
    const draw = 0.2
    const sig = 1 / (1 + Math.exp(-4.2 * (a.skill - b.skill)))
    const pa = (1 - draw) * sig
    const r = rng()
    const outA = r < pa ? 'win' : r < pa + draw ? 'draw' : 'lose'
    const outB = outA === 'win' ? 'lose' : outA === 'lose' ? 'win' : 'draw'
    return [{ key: outA, ...cfg.duel[outA] }, { key: outB, ...cfg.duel[outB] }]
  }

  for (const play of plays) {
    const rewards = new Map()
    for (const s of play.solo) rewards.set(s.team, rollSolo(teams[s.team - 1]))
    for (const d of play.duels) {
      const [ra, rb] = rollDuel(teams[d.teams[0] - 1], teams[d.teams[1] - 1])
      rewards.set(d.teams[0], ra)
      rewards.set(d.teams[1], rb)
    }

    for (const t of teams) {
      const idx = shopIdx(cfg)
      const reward = rewards.get(t.id)
      t.roundsLeft = cfg.rounds - play.round + 1
      t.soldThisRound = 0
      t.money += reward.money

      // parking lot: a paused team keeps receiving customers, and overflow is voided
      const cap = cfg.plots[t.plotTier].capacity
      const room = Math.max(cap - t.parked, 0)
      const accepted = Math.min(reward.customers, room)
      t.voided += reward.customers - accepted
      t.parked += accepted

      const queue = t.parked
      let servedSum = 0
      for (const b of t.buildings) {
        const shop = idx[b.type]
        const servedHere = Math.round(queue * capture(shop, b.level))
        t.typeServed[b.type] += servedHere
        servedSum += servedHere
      }
      t.serves += servedSum
      t.customers += accepted

      // Cash: every customer walks the island and pays `income x card multiplier` where it gets in.
      // The batch is grouped per card type, so the island basket is computed once per type.
      const plain = queue * teamEff(t, cfg)
      let earned = plain
      if (deck) {
        const hist = new Map()
        for (let k = 0; k < accepted; k++) {
          const card = deck[t.deckPos++ % deck.length]
          hist.set(card, (hist.get(card) ?? 0) + 1)
        }
        earned = 0
        for (const [card, n] of hist) earned += n * cardBasket(card, t, cfg)
        t.cardIncome += earned
        t.plainIncome += plain
      }

      // every customer walks the whole island, so the lot empties regardless of how many shops
      // they could enter
      t.parked = 0
      t.money += earned

      spendLoop(t, cfg)
    }

    if (play.round === cfg.rounds) {
      for (const t of teams) spendLoop(t, cfg)
    }

    roundLog.push({
      round: play.round,
      teams: teams.map((t) => ({
        id: t.id,
        money: t.money,
        served: t.customers,
        income: teamEff(t, cfg),
        plotTier: t.plotTier + 1,
        buildings: t.buildings.length,
        voided: t.voided,
      })),
    })
  }

  const max = maxEffectiveIncome(cfg.plots[cfg.plots.length - 1].armCells, cfg)
  return { teams, roundLog, max, cfg, deck }
}

export const progressOf = (t, max, cfg = CONFIG) => teamEff(t, cfg) / max
export const netWorthOf = (t) => t.money + t.spent
export const typesOf = (t) => new Set(t.buildings.map((b) => b.type))
export const cardMultiplierRealised = (t) => (t.plainIncome > 0 ? t.cardIncome / t.plainIncome : 1)
export const statsOf = (t, cfg = CONFIG) => ({
  eff: teamEff(t, cfg),
  buildings: t.buildings.length,
  merges: t.merges,
  plotTier: t.plotTier + 1,
  types: typesOf(t).size,
})

// ---------------------------------------------------------------- CLI
const isMain = process.argv[1] && process.argv[1].replace(/\\/g, '/').endsWith('scripts/economy-sim.mjs')

if (isMain) {
  const TEAMS = 15
  const argv = process.argv.slice(2)
  const arg = (name, fallback) => {
    const i = argv.indexOf(`--${name}`)
    return i >= 0 ? argv[i + 1] : fallback
  }
  const runs = Number(arg('runs', 200))
  const mix = arg('mix', 'optimal')
  const trace = argv.includes('--trace')
  const sweep = arg('sweep', null)
  const priceK = Number(arg('priceK', 1))
  const gateK = Number(arg('gateK', 1))
  const unlockK = Number(arg('unlockK', 1))
  const perArm = Number(arg('perArm', CONFIG.maxPerArm))
  const cellCap = Number(arg('cellCap', CONFIG.maxCellsPerType))
  const deckOn = arg('deck', '1') !== '0'

  const tune = () => {
    const cfg = structuredClone(CONFIG)
    cfg.maxPerArm = perArm
    cfg.maxCellsPerType = cellCap
    cfg.deck.enabled = deckOn
    cfg.shops.forEach((s) => {
      s.buy = Math.round((s.buy * priceK) / 10_000) * 10_000
      s.up2 = Math.round((s.up2 * priceK) / 10_000) * 10_000
      s.unlock = Math.round(s.unlock * unlockK)
    })
    cfg.plots.forEach((p) => (p.cost = Math.round((p.cost * priceK) / 10_000) * 10_000))
    cfg.typeGate.up2 = Math.round(cfg.typeGate.up2 * gateK)
    cfg.typeGate.up3 = Math.round(cfg.typeGate.up3 * gateK)
    return cfg
  }

  const skills = Array.from({ length: TEAMS }, (_, i) => 1 - (i * 0.75) / (TEAMS - 1))
  const behaviorFor = (i) => (mix === 'mixed' ? (i % 2 === 0 ? 'optimal' : 'casual') : mix)

  const runAll = (cfg) => {
    const acc = {
      progress: Array(TEAMS).fill(0),
      worth: Array(TEAMS).fill(0),
      customers: Array(TEAMS).fill(0),
      serves: Array(TEAMS).fill(0),
      voided: Array(TEAMS).fill(0),
      merges: Array(TEAMS).fill(0),
      shops: Array(TEAMS).fill(0),
      types: Array(TEAMS).fill(0),
      mult: Array(TEAMS).fill(0),
      mix: {},
    }
    let max = 0
    for (let run = 0; run < runs; run++) {
      const res = simulate({ skills, behaviors: skills.map((_, i) => behaviorFor(i)), seed: 9000 + run, cfg })
      max = res.max
      res.teams.forEach((t, i) => {
        acc.progress[i] += progressOf(t, res.max, cfg) / runs
        acc.worth[i] += netWorthOf(t) / runs
        acc.customers[i] += t.customers / runs
        acc.serves[i] += t.serves / runs
        acc.voided[i] += t.voided / runs
        acc.merges[i] += t.merges / runs
        acc.shops[i] += t.buildings.length / runs
        acc.types[i] += typesOf(t).size / runs
        acc.mult[i] += cardMultiplierRealised(t) / runs
        const per = {}
        t.buildings.forEach((b) => (per[b.type] = (per[b.type] ?? 0) + 1))
        for (const [k, v] of Object.entries(per)) acc.mix[k] = (acc.mix[k] ?? 0) + v / (runs * TEAMS)
      })
    }
    return { ...acc, max }
  }

  if (sweep) {
    for (const k of sweep.split(',').map(Number)) {
      const cfg = structuredClone(tune())
      cfg.shops.forEach((s) => {
        s.buy = Math.round((s.buy * k) / 10_000) * 10_000
        s.up2 = Math.round((s.up2 * k) / 10_000) * 10_000
      })
      cfg.plots.forEach((p) => (p.cost = Math.round((p.cost * k) / 10_000) * 10_000))
      const r = runAll(cfg)
      const avg = (r.progress.reduce((a, b) => a + b, 0) / TEAMS) * 100
      console.log(`price x${k.toFixed(2)}  avg ${avg.toFixed(1)}%  top ${(r.progress[0] * 100).toFixed(1)}%  bottom ${(r.progress[TEAMS - 1] * 100).toFixed(1)}%`)
    }
    process.exit(0)
  }

  const cfg = tune()
  const result = runAll(cfg)
  const avg = (result.progress.reduce((a, b) => a + b, 0) / TEAMS) * 100
  console.log(`Rally Tycoon sim v4 — mix=${mix}, runs=${runs}, perArm=${perArm}, cellCap=${cellCap || 'off'}, deck=${deckOn ? 'on' : 'off'}, priceK=${priceK}, gateK=${gateK}, unlockK=${unlockK}`)
  console.log(`max effective income per customer = ${result.max.toLocaleString('id-ID')}`)
  console.table(
    skills.map((skill, i) => ({
      team: `T${String(i + 1).padStart(2, '0')}`,
      skill: skill.toFixed(2),
      play: behaviorFor(i),
      progress: `${(result.progress[i] * 100).toFixed(1)}%`,
      shops: result.shops[i].toFixed(1),
      types: result.types[i].toFixed(1),
      merges: result.merges[i].toFixed(1),
      mult: `${result.mult[i].toFixed(3)}x`,
      customers: result.customers[i].toFixed(0),
      serves: result.serves[i].toFixed(0),
      voided: result.voided[i].toFixed(0),
      netWorth: Math.round(result.worth[i]).toLocaleString('id-ID'),
    })),
  )
  const sorted = [...result.progress].sort((a, b) => a - b)
  console.log(`average progress : ${avg.toFixed(1)}%`)
  console.log(`median           : ${(sorted[7] * 100).toFixed(1)}%`)
  console.log(`range            : ${(sorted[0] * 100).toFixed(1)}% – ${(sorted[TEAMS - 1] * 100).toFixed(1)}%`)
  console.log(`avg distinct types: ${(result.types.reduce((a, b) => a + b, 0) / TEAMS).toFixed(1)}`)
  console.log(`avg card multiplier: ${(result.mult.reduce((a, b) => a + b, 0) / TEAMS).toFixed(3)}x`)
  const mixSorted = Object.entries(result.mix).sort((a, b) => b[1] - a[1])
  console.log(`island mix        : ${mixSorted.map(([k, v]) => `${k} ${v.toFixed(1)}`).join(' · ')}`)

  if (trace) {
    const res = simulate({ skills, behaviors: skills.map((_, i) => behaviorFor(i)), seed: 9001, cfg })
    const pick = [0, 7, 14]
    console.log('\nround | money / served / eff-income / plot / shops  (T01, T08, T15)')
    for (const r of res.roundLog) {
      const parts = pick.map((i) => {
        const t = r.teams[i]
        return `T${t.id}=${Math.round(t.money / 1000)}k/${t.served}/${Math.round(t.income / 1000)}k/P${t.plotTier}/${t.buildings}`
      })
      console.log(String(r.round).padStart(5), '|', parts.join('   '))
    }
  }
}
