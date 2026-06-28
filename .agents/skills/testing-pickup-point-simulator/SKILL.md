---
name: testing-pickup-point-simulator
description: Test the Pickup Point Simulator (Симулятор ПВЗ) Phaser 3 game end-to-end. Use when verifying gameplay mechanics, UI, upgrades, or game logic changes.
---

# Testing Pickup Point Simulator

## Prerequisites

- Node.js and npm installed
- Run `npm install` in the project root
- Start dev server: `npx vite --host` (default port 5173, may increment if busy — check terminal output)

## Devin Secrets Needed

None required — this is a client-side-only game with no backend or auth.

## Architecture Overview

The game has 4 Phaser scenes (loaded in order):
- **PreloadScene** — Generates all canvas textures at boot (clients, packages, shelves, buttons, timer bars)
- **BootScene** — Title screen with ИГРАТЬ button, subtitle, version label
- **GameScene** — Main gameplay (Counter/Warehouse views, client spawning, delivery, shift timer)
- **ShopScene** — End-of-day results + upgrade shop (between shifts)

Code is modular:
- `src/config.js` — Constants, difficulty formula, upgrade definitions
- `src/managers/ClientManager.js` — Client spawning, timers, timer bar, delivery logic
- `src/managers/WarehouseManager.js` — Shelf grid, packages, highlights
- `src/scenes/PreloadScene.js` — Canvas texture generation (18 textures)
- `src/scenes/GameScene.js` — Main game loop, shift system, UI, floating text
- `src/scenes/ShopScene.js` — Shop UI, purchase logic, level pips
- `src/ui/FloatingText.js` — Floating text feedback utility

## How to Test

### Key Challenge: Timing

The game has client timers (base 20s, scales down per day) and 90s shift timers. Since browser automation tools have ~5s latency per action, you cannot complete the full delivery flow through pure UI clicks within the timer window.

**Solution:** Use `window.__game.scene.getScene('GameScene')` via `browser_console` to manipulate game state directly.

### Scene Access
```js
const scene = window.__game.scene.getScene('GameScene');
scene.clients.spawnClient(scene.difficulty, scene.warehouse.packages, scene.shelfRows, scene.existingIdChance);
scene.clients.currentClient.requestedId  // what the client wants
scene.clients.clientTimeLeft             // current countdown
scene.clients.clientTimeMax              // max time for ratio calculation
scene.clients.removeClient();
scene.clients.updateTimerBar();          // refresh timer bar visuals

// Timer bar textures: timer_bar_fill (green >50%), timer_bar_warn (yellow >25%), timer_bar_danger (red <=25%)
scene.clients.timerBarFill.texture.key   // current timer bar color
scene.clients.timerBarFill.scaleX        // current fill ratio

// Game state
scene.coins, scene.rating, scene.day
scene.shiftTimeLeft
scene.shiftBarFill.scaleX               // shift timer ratio
scene.shiftBarFill.fillColor            // shift timer color

scene.deliverPackage();
scene.endShift();
scene.updateUI();
```

### Correct Delivery Pattern
```js
const scene = window.__game.scene.getScene('GameScene');
const pkgIds = Array.from(scene.warehouse.packages.keys());
const id = pkgIds[0];
scene.clients.removeClient();
scene.clients.currentClient = { requestedId: id, color: 0x3498db };
scene.clients.clientSprite.setTexture('client_0').setVisible(true).setAlpha(1).setScale(1);
scene.clients.clientIdText.setText('Посылка: ' + id).setVisible(true);
scene.clients.clientLabel.setText('Клиент ожидает').setVisible(true);
scene.clients.noClientText.setVisible(false);
scene.clients.clientTimeLeft = 20;
scene.clients.clientTimeMax = 20;
scene.clients.updateTimerBar();
scene.selectedPackageId = id;
scene.showView('counter');
scene.deliverPackage();
// Floating text '+10 монет' (green #2ecc71) at depth 1000
```

### Visual & UI Tests (Stage 3)
1. **Generated Textures**: `window.__game.textures.exists('key')` for all 18 keys
2. **Timer Bar**: Set `clientTimeLeft` to different ratios, call `updateTimerBar()`, check `timerBarFill.texture.key`
3. **Floating Text**: After delivery, `scene.children.list.filter(c => c.type === 'Text' && c.depth === 1000)`
4. **Shop Pips**: After purchase, first circle pip turns gold, rest grey
5. **Disabled Buttons**: `fillColor=0x555555`, `alpha=0.6`
6. **Shift Timer Bar**: Set `shiftTimeLeft`, call `updateUI()`, check `shiftBarFill.scaleX` and `.fillColor`

### Common Issues
- Vite port may vary — check terminal output
- Floating text auto-destroys after 1200ms — check immediately after delivery
- Timer bar properties undefined if page has stale HMR — do full reload
- ShopScene restarts on purchase — re-read scene instance after buying
