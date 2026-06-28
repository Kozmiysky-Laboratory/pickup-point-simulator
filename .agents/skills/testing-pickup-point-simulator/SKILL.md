---
name: testing-pickup-point-simulator
description: Test the Pickup Point Simulator (Симулятор ПВЗ) Phaser 3 game end-to-end. Use when verifying gameplay mechanics, UI, upgrades, or game logic changes.
---

# Testing Pickup Point Simulator

## Prerequisites

- Node.js and npm installed
- Run `npm install` in the project root
- Start dev server: `npx vite --host` (default port 5173, may increment if busy — check terminal output or try 5175)

## Devin Secrets Needed

None required — this is a client-side-only game with no backend or auth.

## Architecture Overview

The game has 3 Phaser scenes:
- **BootScene** — Title screen with "ИГРАТЬ" button
- **GameScene** — Main gameplay (Counter/Warehouse views, client spawning, delivery)
- **ShopScene** — End-of-day results + upgrade shop (between shifts)

Code is modular:
- `src/config.js` — Constants, difficulty formula, upgrade definitions
- `src/managers/ClientManager.js` — Client spawning, timers, delivery logic
- `src/managers/WarehouseManager.js` — Shelf grid, packages, highlights
- `src/scenes/GameScene.js` — Main game loop, shift system, UI
- `src/scenes/ShopScene.js` — Shop UI, purchase logic

## How to Test

### Key Challenge: Timing

The game has client timers (base 20s, scales down per day) and 90s shift timers. Since browser automation tools have ~5s latency per action, you cannot complete the full delivery flow through pure UI clicks within the timer window.

**Solution:** Use `window.__game.scene.getScene('GameScene')` via `browser_console` to:

#### Scene Access (Stage 2 — modular managers)
```js
const scene = window.__game.scene.getScene('GameScene');
// Client manager
scene.clients.spawnClient(scene.difficulty, scene.warehouse.packages, scene.shelfRows, scene.existingIdChance);
scene.clients.currentClient.requestedId  // what the client wants
scene.clients.clientTimeLeft             // current countdown
scene.clients.removeClient();            // dismiss client
scene.clients.stopAllTimers();           // stop spawn + client timers
scene.clients.clientTimeout();           // force timeout

// Warehouse manager  
Array.from(scene.warehouse.packages.keys())  // list all package IDs
scene.warehouse.packages.get(id)             // get package object
scene.warehouse.shelves.length               // shelf count
scene.warehouse.removePackage(id);           // remove a package

// Game state
scene.coins, scene.rating, scene.day
scene.upgrades                           // {fasterBoots, sortAssist, warehouseExpansion, hireAssistant}
scene.difficulty                         // {spawnMinMs, spawnMaxMs, clientTimerSec, extraDecoyPackages}
scene.shiftTimeLeft                      // seconds remaining in shift
scene.shelfRows                          // ['A','B','C'] + expansion rows

// Actions
scene.selectPackage(id, pkg.rect);       // select a package
scene.deliverPackage();                  // deliver selected package
scene.endShift();                        // force end-of-shift → ShopScene
scene.updateUI();                        // refresh UI text
```

#### Correct Delivery Pattern (via console)
```js
const scene = window.__game.scene.getScene('GameScene');
const pkgIds = Array.from(scene.warehouse.packages.keys());
const id = pkgIds[0];
const pkg = scene.warehouse.packages.get(id);
scene.clients.currentClient = { requestedId: id, color: 0x3498db };
scene.selectedPackageId = id;
scene.deliverPackage();
// coins += 10, rating += 1, shiftDelivered += 1
```

### Test Flows

#### Core Gameplay (Stage 1)
1. **Boot Screen**: Reload → verify title "Симулятор ПВЗ" + "ИГРАТЬ" → click to enter
2. **Counter View**: Verify "СТОЙКА ВЫДАЧИ", "Монеты: 0", "Рейтинг: 0"
3. **Correct Delivery**: Spawn → select matching pkg → deliver → coins +10, rating +1
4. **Wrong Delivery**: Spawn → select wrong pkg → deliver → coins -5, rating unchanged
5. **Client Timeout**: `scene.clients.clientTimeout()` → rating -1

#### Day/Shift System (Stage 2)
1. **Shift Timer**: Verify "День: 1" and "Смена: ~90с" in top bar after starting game
2. **End of Shift**: Do N deliveries → `scene.endShift()` → ShopScene shows "ДЕНЬ X — ИТОГИ СМЕНЫ" with correct "Посылок выдано", "Монет заработано", "Рейтинг: +/-N"
3. **Shop UI**: 4 upgrades listed with names, levels ("Ур. X/Y"), costs, buy buttons (green if affordable, grey if not)
4. **Purchase**: Click buy button → coins deducted, level incremented, cost scales (baseCost × multiplier^level)
5. **Next Day**: Click "СЛЕДУЮЩИЙ ДЕНЬ" → GameScene with day+1, coins/rating/upgrades persisted

#### Upgrade Effects (Stage 2)
1. **Faster Boots**: After purchase, spawn fresh client → `scene.clients.clientTimeLeft` should be `round(difficulty.clientTimerSec) + fasterBoots * 3`
2. **Sort Assist**: After purchase, spawn client for existing package → shelf border highlights green (check visually in warehouse view)
3. **Warehouse Expansion**: After purchase + next day → `scene.shelfRows` includes 'D' (level 1), 'E' (level 2), 'F' (level 3); warehouse grid shows extra row visually
4. **Hire Assistant**: After correct delivery, if `assistantCounter >= threshold`, auto-fulfill fires with status message "Помощник выдал..."

#### Difficulty Scaling (Stage 2)
Verify via console after starting day N:
- Day 1: `{spawnMinMs: 5000, spawnMaxMs: 10000, clientTimerSec: 20, extraDecoyPackages: 0}`
- Day 2: `{spawnMinMs: 4600, spawnMaxMs: 9200, clientTimerSec: 18.5, extraDecoyPackages: 2}`
- Day 5: `{spawnMinMs: 3400, spawnMaxMs: 6800, clientTimerSec: 14, extraDecoyPackages: 8}`

### UI Navigation

- **Boot screen** → click "ИГРАТЬ" (centered red button)
- **Counter ↔ Warehouse**: "Стойка" / "Склад" buttons at bottom-right (~750,575 and ~850,575 in game coords)
- **Deliver**: "ВЫДАТЬ ПОСЫЛКУ" green button appears below counter desk when client + package selected
- **ShopScene**: Upgrade buy buttons at ~700,y for each row; "СЛЕДУЮЩИЙ ДЕНЬ" at ~450,555

### Game Constants (from config.js)

- `SHIFT_DURATION_SEC = 90` — shift length
- `CLIENT_TIMER_SEC = 20` — base client patience
- `SPAWN_MIN_MS = 5000`, `SPAWN_MAX_MS = 10000` — base spawn interval
- `REWARD_COINS = 10`, `PENALTY_COINS = 5`
- `SHELF_ROWS = ['A', 'B', 'C']`, `SHELF_COLS = [1, 2, 3, 4]` — base 12 shelves
- Package IDs: `{ROW}-{100-199}` (e.g. "B-142")
- `EXISTING_ID_CHANCE = 0.7` — 70% chance client asks for existing package

### Upgrade Costs (baseCost × multiplier^level)

| Upgrade | Base | Multiplier | Max | Costs by level |
|---|---|---|---|---|
| Faster Boots | 30 | 1.8 | 5 | 30→54→97→175→315 |
| Sort Assist | 50 | 2.0 | 3 | 50→100→200 |
| Warehouse Expansion | 80 | 2.5 | 3 | 80→200→500 |
| Hire Assistant | 100 | 2.0 | 3 | 100→200→400 |

### Common Issues

- If `window.__game` is undefined, check `src/main.js` for `window.__game = new Phaser.Game(config)`.
- Vite dev server may use a different port if 5173 is occupied — check terminal output or try 5175.
- The game uses Phaser Scale.FIT, so canvas scales to fit container. Coordinate clicks may need adjustment.
- When reading `clientTimeLeft` after auto-spawn, the timer may have already ticked down — remove existing client first, then spawn fresh to get initial value.
- ShopScene restarts itself on purchase (`scene.restart()`), so read state from the new scene instance after buying.
