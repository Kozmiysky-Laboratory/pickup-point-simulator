/* Standalone bundle: one classic script. Uses the Phaser global loaded before this file. */

/* ===== src/config.js ===== */

const BASE = {
  SHELF_ROWS: ['A', 'B', 'C'],
  SHELF_COLS: [1, 2, 3, 4],
  CLIENT_TIMER_SEC: 20,
  SPAWN_MIN_MS: 5000,
  SPAWN_MAX_MS: 10000,
  REWARD_COINS: 10,
  PENALTY_COINS: 5,
  SHIFT_DURATION_SEC: 90,
  INITIAL_PACKAGE_MIN: 6,
  INITIAL_PACKAGE_MAX: 10,
  EXISTING_ID_CHANCE: 0.7,
};

const COLORS = {
  CLIENT: [0x3498db, 0xe67e22, 0x9b59b6, 0x1abc9c, 0xf39c12],
  PKG_DEFAULT: 0xc0392b,
  PKG_BORDER: 0x922b21,
  PKG_HOVER: 0xe74c3c,
  PKG_SELECTED: 0x2980b9,
  PKG_HIGHLIGHT: 0x27ae60,
  SHELF: 0xdec9a4,
  SHELF_BORDER: 0x8b7355,
  TOP_BAR: 0x16213e,
  BTN: 0x0f3460,
  BTN_ACTIVE: 0x533483,
  DESK: 0x8b4513,
  ACCENT: 0xe94560,
  SUCCESS: 0x2ecc71,
  OVERLAY: 0x000000,
};

function shadeColor(hex, percent) {
  const t = percent < 0 ? 0 : 255;
  const p = Math.abs(percent);
  let r = (hex >> 16) & 255;
  let gv = (hex >> 8) & 255;
  let b = hex & 255;
  r = Math.round((t - r) * p + r);
  gv = Math.round((t - gv) * p + gv);
  b = Math.round((t - b) * p + b);
  return (r << 16) | (gv << 8) | b;
}

const UPGRADES = {
  FASTER_BOOTS: {
    id: 'fasterBoots',
    name: 'Быстрые ботинки',
    desc: 'Клиент ждёт на 3с дольше',
    baseCost: 30,
    costMultiplier: 1.8,
    maxLevel: 5,
  },
  SORT_ASSIST: {
    id: 'sortAssist',
    name: 'Авто-подсветка',
    desc: 'Подсветка нужной полки на 3с',
    baseCost: 50,
    costMultiplier: 2.0,
    maxLevel: 3,
  },
  WAREHOUSE_EXPANSION: {
    id: 'warehouseExpansion',
    name: 'Расширение склада',
    desc: 'Добавляет ряд полок (D, E...)',
    baseCost: 80,
    costMultiplier: 2.5,
    maxLevel: 3,
  },
  HIRE_ASSISTANT: {
    id: 'hireAssistant',
    name: 'Помощник',
    desc: 'Авто-выдаёт каждого 4-го клиента',
    baseCost: 100,
    costMultiplier: 2.0,
    maxLevel: 3,
  },
};

function getDifficultyForDay(day) {
  const spawnFactor = Math.max(0.4, 1 - (day - 1) * 0.08);
  const timerPenalty = Math.min((day - 1) * 1.5, 8);
  const extraPackages = Math.min((day - 1) * 2, 10);
  return {
    spawnMinMs: Math.round(BASE.SPAWN_MIN_MS * spawnFactor),
    spawnMaxMs: Math.round(BASE.SPAWN_MAX_MS * spawnFactor),
    clientTimerSec: Math.max(8, BASE.CLIENT_TIMER_SEC - timerPenalty),
    extraDecoyPackages: Math.round(extraPackages),
  };
}

function getUpgradeCost(upgrade, currentLevel) {
  return Math.round(upgrade.baseCost * Math.pow(upgrade.costMultiplier, currentLevel));
}

function randomId(rows) {
  const row = rows[Phaser.Math.Between(0, rows.length - 1)];
  const num = Phaser.Math.Between(100, 199);
  return `${row}-${num}`;
}


/* ===== src/ui/FloatingText.js ===== */
function showFloatingText(scene, x, y, message, color = '#ffd700') {
  const text = scene.add.text(x, y, message, {
    fontSize: '20px',
    fontFamily: 'Arial',
    color,
    fontStyle: 'bold',
    stroke: '#000000',
    strokeThickness: 3,
  }).setOrigin(0.5).setDepth(1000);

  scene.tweens.add({
    targets: text,
    y: y - 60,
    alpha: 0,
    duration: 1200,
    ease: 'Power2',
    onComplete: () => text.destroy(),
  });
}


/* ===== src/managers/ClientManager.js ===== */

class ClientManager {
  constructor(scene) {
    this.scene = scene;
    this.currentClient = null;
    this.clientTimerEvent = null;
    this.clientTimeLeft = 0;
    this.clientTimeMax = 0;
    this.spawnTimerEvent = null;
    this.clientsServed = 0;
    this.assistantCounter = 0;
  }

  createCounterView(container) {
    const s = this.scene;

    container.add(s.add.image(450, 300, 'counter_scene'));
    container.add(s.add.image(450, 86, 'plaque'));
    container.add(s.add.text(450, 84, 'СТОЙКА ВЫДАЧИ', {
      fontSize: '18px', fontFamily: 'Arial', color: '#fff8ee', fontStyle: 'bold',
    }).setOrigin(0.5));
    container.add(s.add.text(252, 108, 'ПВЗ', {
      fontSize: '15px', fontFamily: 'Arial', color: '#1e3a5f', fontStyle: 'bold',
    }).setOrigin(0.5));

    this.clientSprite = s.add.image(450, 300, 'client_0').setVisible(false);
    container.add(this.clientSprite);

    this.clientIdText = s.add.text(450, 136, '', {
      fontSize: '16px', fontFamily: 'Arial', color: '#2c2416', fontStyle: 'bold',
      backgroundColor: '#fff8ee', padding: { x: 8, y: 4 },
    }).setOrigin(0.5).setVisible(false);
    container.add(this.clientIdText);

    this.clientLabel = s.add.text(450, 164, '', {
      fontSize: '13px', fontFamily: 'Arial', color: '#5c4632', fontStyle: 'bold',
    }).setOrigin(0.5).setVisible(false);
    container.add(this.clientLabel);

    container.add(s.add.image(450, 400, 'counter_desk'));
    container.add(s.add.image(196, 348, 'bell'));

    this.timerBarBg = s.add.image(450, 404, 'timer_bar_bg').setVisible(false);
    container.add(this.timerBarBg);

    this.timerBarFill = s.add.image(450, 404, 'timer_bar_fill')
      .setVisible(false).setOrigin(0.5);
    container.add(this.timerBarFill);

    this.timerBarText = s.add.text(450, 404, '', {
      fontSize: '11px', fontFamily: 'Arial', color: '#fff8ee', fontStyle: 'bold',
    }).setOrigin(0.5).setVisible(false);
    container.add(this.timerBarText);

    this.deliverBtn = s.add.image(450, 492, 'deliver_normal')
      .setInteractive({ useHandCursor: true })
      .setVisible(false);
    container.add(this.deliverBtn);

    this.deliverText = s.add.text(450, 490, 'ВЫДАТЬ ПОСЫЛКУ', {
      fontSize: '16px', fontFamily: 'Arial', color: '#fff8ee', fontStyle: 'bold',
    }).setOrigin(0.5).setVisible(false);
    container.add(this.deliverText);

    this.selectedLabel = s.add.text(450, 534, '', {
      fontSize: '13px', fontFamily: 'Arial', color: '#2c2416', fontStyle: 'bold',
      backgroundColor: '#fff8ee', padding: { x: 6, y: 3 },
    }).setOrigin(0.5).setVisible(false);
    container.add(this.selectedLabel);

    this.deliverBtn.on('pointerover', () => this.deliverBtn.setTexture('deliver_hover'));
    this.deliverBtn.on('pointerout', () => this.deliverBtn.setTexture('deliver_normal'));
    this.deliverBtn.on('pointerdown', () => {
      this.deliverBtn.setTexture('deliver_active');
      this.scene.deliverPackage();
    });

    this.noClientText = s.add.text(450, 250, 'Ожидание клиента...', {
      fontSize: '18px', fontFamily: 'Arial', color: '#6b5344', fontStyle: 'bold',
    }).setOrigin(0.5);
    container.add(this.noClientText);
  }

  spawnClient(difficulty, packages, shelfRows, existingIdChance) {
    if (this.currentClient || this.scene.shiftPaused) return;

    const requestedId = this.pickRequestedId(packages, shelfRows, existingIdChance);
    const colorIndex = Phaser.Math.Between(0, 4);

    this.currentClient = { requestedId, color: COLORS.CLIENT[colorIndex] };

    // Use client texture
    this.clientSprite.setTexture(`client_${colorIndex}`).setVisible(true);
    this.clientIdText.setText(`Посылка: ${requestedId}`).setVisible(true);
    this.clientLabel.setText('Клиент ожидает').setVisible(true);
    this.noClientText.setVisible(false);

    // Entrance animation
    this.clientSprite.setAlpha(0).setScale(0.8);
    this.scene.tweens.add({
      targets: this.clientSprite,
      alpha: 1,
      scaleX: 1,
      scaleY: 1,
      duration: 300,
      ease: 'Back.easeOut',
    });

    this.updateDeliverButton();

    const bonusTime = (this.scene.upgrades.fasterBoots || 0) * 3;
    this.clientTimeLeft = Math.round(difficulty.clientTimerSec) + bonusTime;
    this.clientTimeMax = this.clientTimeLeft;
    this.updateTimerBar();
    this.scene.updateUI();

    if (this.clientTimerEvent) this.clientTimerEvent.destroy();
    this.clientTimerEvent = this.scene.time.addEvent({
      delay: 1000,
      callback: this.tickClientTimer,
      callbackScope: this,
      repeat: this.clientTimeLeft - 1,
    });

    if (this.scene.viewMode === 'warehouse') {
      this.scene.warehouse.updateRequestText(requestedId);
    }

    if ((this.scene.upgrades.sortAssist || 0) > 0 && packages.has(requestedId)) {
      this.scene.warehouse.highlightShelfForPackage(requestedId);
    }
  }

  pickRequestedId(packages, shelfRows, existingIdChance) {
    const pkgIds = Array.from(packages.keys());
    if (pkgIds.length > 0 && Math.random() < existingIdChance) {
      return Phaser.Utils.Array.GetRandom(pkgIds);
    }
    return randomId(shelfRows);
  }

  updateTimerBar() {
    if (!this.currentClient) {
      this.timerBarBg.setVisible(false);
      this.timerBarFill.setVisible(false);
      this.timerBarText.setVisible(false);
      return;
    }

    this.timerBarBg.setVisible(true);
    this.timerBarFill.setVisible(true);
    this.timerBarText.setVisible(true);

    const ratio = this.clientTimeLeft / this.clientTimeMax;

    // Choose color based on remaining time
    if (ratio > 0.5) {
      this.timerBarFill.setTexture('timer_bar_fill');
    } else if (ratio > 0.25) {
      this.timerBarFill.setTexture('timer_bar_warn');
    } else {
      this.timerBarFill.setTexture('timer_bar_danger');
    }

    this.timerBarFill.setScale(Math.max(0.01, ratio), 1);
    this.timerBarText.setText(`${this.clientTimeLeft}с`);
  }

  tickClientTimer() {
    if (this.scene.shiftPaused) return;
    this.clientTimeLeft--;
    this.updateTimerBar();
    this.scene.updateUI();

    if (this.clientTimeLeft <= 5) {
      this.scene.timerText.setColor('#ff0000');
      // Pulse animation on low time
      if (this.clientSprite.visible) {
        this.scene.tweens.add({
          targets: this.clientSprite,
          scaleX: 1.05,
          scaleY: 1.05,
          duration: 150,
          yoyo: true,
        });
      }
    }

    if (this.clientTimeLeft <= 0) {
      this.clientTimeout();
    }
  }

  clientTimeout() {
    this.scene.rating = Math.max(0, this.scene.rating - 1);
    this.scene.shiftRatingChange--;
    this.scene.showStatus('Клиент ушёл! Рейтинг -1', '#ff0000');
    this.removeClient();
    this.scheduleNextSpawn();
  }

  removeClient() {
    this.currentClient = null;
    this.clientSprite.setVisible(false);
    this.clientIdText.setVisible(false);
    this.clientLabel.setVisible(false);
    this.noClientText.setVisible(true);
    this.scene.selectedPackageId = null;
    this.deliverBtn.setVisible(false);
    this.deliverText.setVisible(false);
    this.selectedLabel.setVisible(false);
    this.timerBarBg.setVisible(false);
    this.timerBarFill.setVisible(false);
    this.timerBarText.setVisible(false);
    this.scene.timerText.setColor('#ff6b6b');

    if (this.clientTimerEvent) {
      this.clientTimerEvent.destroy();
      this.clientTimerEvent = null;
    }

    this.scene.warehouse.updateRequestText('');
    this.scene.updateUI();
    this.scene.warehouse.resetHighlights();
  }

  scheduleNextSpawn() {
    if (this.scene.shiftPaused) return;
    const diff = this.scene.difficulty;
    this.spawnTimerEvent = this.scene.time.addEvent({
      delay: Phaser.Math.Between(diff.spawnMinMs, diff.spawnMaxMs),
      callback: () => this.spawnClient(
        this.scene.difficulty,
        this.scene.warehouse.packages,
        this.scene.shelfRows,
        this.scene.existingIdChance,
      ),
      callbackScope: this,
      loop: false,
    });
  }

  updateDeliverButton() {
    const show = this.currentClient && this.scene.selectedPackageId;
    this.deliverBtn.setVisible(!!show);
    this.deliverText.setVisible(!!show);
    this.selectedLabel.setVisible(!!show);
    if (show) {
      this.deliverBtn.setTexture('deliver_normal');
      this.selectedLabel.setText(`Выбрано: ${this.scene.selectedPackageId}`);
    }
  }

  stopAllTimers() {
    if (this.clientTimerEvent) {
      this.clientTimerEvent.destroy();
      this.clientTimerEvent = null;
    }
    if (this.spawnTimerEvent) {
      this.spawnTimerEvent.destroy();
      this.spawnTimerEvent = null;
    }
  }

  destroy() {
    this.stopAllTimers();
  }
}


/* ===== src/managers/WarehouseManager.js ===== */

class WarehouseManager {
  constructor(scene) {
    this.scene = scene;
    this.shelves = [];
    this.packages = new Map();
    this.highlightTimers = [];
  }

  createWarehouseView(container, shelfRows, shelfCols) {
    this.container = container;
    const s = this.scene;

    container.add(s.add.image(450, 300, 'warehouse_scene'));
    container.add(s.add.image(450, 80, 'plaque'));

    const label = s.add.text(450, 78, 'СКЛАД', {
      fontSize: '20px', fontFamily: 'Arial', color: '#fff8ee', fontStyle: 'bold',
    }).setOrigin(0.5);
    container.add(label);

    this.requestText = s.add.text(450, 108, '', {
      fontSize: '18px', fontFamily: 'Arial', color: '#e94560', fontStyle: 'bold',
      backgroundColor: '#fff5f5', padding: { x: 8, y: 4 },
    }).setOrigin(0.5);
    container.add(this.requestText);

    this.buildGrid(shelfRows, shelfCols);
  }

  buildGrid(shelfRows, shelfCols) {
    for (const shelf of this.shelves) {
      shelf.bg.destroy();
      shelf.label.destroy();
    }
    this.shelves = [];

    const totalRows = shelfRows.length;
    const totalCols = shelfCols.length;
    const maxH = 400;
    const cellH = Math.min(120, Math.floor(maxH / totalRows));
    const cellW = 160;
    const gridWidth = totalCols * cellW;
    const startX = 450 - gridWidth / 2 + cellW / 2;
    const startY = 175;

    for (let r = 0; r < totalRows; r++) {
      for (let c = 0; c < totalCols; c++) {
        const x = startX + c * cellW;
        const y = startY + r * cellH;
        const shelfId = `${shelfRows[r]}${shelfCols[c]}`;

        const bg = this.scene.add.image(x, y, 'shelf');
        const scaleW = (cellW - 10) / 150;
        const scaleH = (cellH - 10) / 110;
        bg.setScale(scaleW, scaleH);
        this.container.add(bg);

        const label = this.scene.add.text(x, y - (cellH / 2 - 15), shelfId, {
          fontSize: '13px', fontFamily: 'Arial', color: '#fff8ee', fontStyle: 'bold',
          stroke: '#3a2415', strokeThickness: 3,
        }).setOrigin(0.5);
        this.container.add(label);

        this.shelves.push({ id: shelfId, x, y, bg, label, packageObj: null, scaleW, scaleH });
      }
    }
  }

  populateWarehouse(shelfRows, minPkg, maxPkg, extraDecoy) {
    this.clearPackages();

    const baseCount = Phaser.Math.Between(minPkg, maxPkg);
    const count = baseCount + extraDecoy;
    const available = Phaser.Utils.Array.Shuffle([...this.shelves]);
    const used = available.slice(0, Math.min(count, available.length));

    for (const shelf of used) {
      this.addPackageToShelf(shelf, randomId(shelfRows));
    }
  }

  addPackageToShelf(shelf, pkgId) {
    if (this.packages.has(pkgId)) return;

    const s = this.scene;
    const img = s.add.image(shelf.x, shelf.y + 5, 'pkg_default')
      .setInteractive({ useHandCursor: true });
    const text = s.add.text(shelf.x, shelf.y + 5, pkgId, {
      fontSize: '12px', fontFamily: 'Arial', color: '#2c2416', fontStyle: 'bold',
      stroke: '#fff8ee', strokeThickness: 3,
    }).setOrigin(0.5);

    this.container.add(img);
    this.container.add(text);

    img.on('pointerover', () => {
      if (s.selectedPackageId !== pkgId) img.setTexture('pkg_hover');
      img.setScale(1.1);
    });
    img.on('pointerout', () => {
      img.setTexture(s.selectedPackageId === pkgId ? 'pkg_selected' : 'pkg_default');
      img.setScale(1);
    });
    img.on('pointerdown', () => s.selectPackage(pkgId, img));

    const pkg = { id: pkgId, rect: img, text, shelf };
    shelf.packageObj = pkg;
    this.packages.set(pkgId, pkg);
  }

  removePackage(pkgId) {
    const pkg = this.packages.get(pkgId);
    if (pkg) {
      pkg.rect.destroy();
      pkg.text.destroy();
      pkg.shelf.packageObj = null;
      this.packages.delete(pkgId);
    }
  }

  addRandomPackages(count, shelfRows) {
    const emptyShelves = this.shelves.filter((s) => !s.packageObj);
    const toFill = Phaser.Utils.Array.Shuffle(emptyShelves)
      .slice(0, Math.min(count, emptyShelves.length));

    for (const shelf of toFill) {
      const pkgId = randomId(shelfRows);
      this.addPackageToShelf(shelf, pkgId);
    }
  }

  clearPackages() {
    this.packages.forEach((pkg) => {
      pkg.rect.destroy();
      pkg.text.destroy();
      if (pkg.shelf) pkg.shelf.packageObj = null;
    });
    this.packages.clear();
  }

  updateRequestText(text) {
    if (text) {
      this.requestText.setText(`Клиент ждёт: ${text}`);
    } else {
      this.requestText.setText('');
    }
  }

  resetHighlights() {
    this.packages.forEach((pkg) => {
      pkg.rect.setTexture('pkg_default');
    });
    for (const timer of this.highlightTimers) {
      timer.destroy();
    }
    this.highlightTimers = [];
  }

  highlightShelfForPackage(pkgId) {
    const pkg = this.packages.get(pkgId);
    if (!pkg) return;

    const shelf = pkg.shelf;
    shelf.bg.setTexture('shelf_highlight');

    const duration = 3000 + (this.scene.upgrades.sortAssist - 1) * 1500;
    const timer = this.scene.time.delayedCall(duration, () => {
      shelf.bg.setTexture('shelf');
    });
    this.highlightTimers.push(timer);
  }

  destroy() {
    this.clearPackages();
    for (const timer of this.highlightTimers) {
      timer.destroy();
    }
    this.highlightTimers = [];
  }
}


/* ===== src/scenes/PreloadScene.js ===== */

class PreloadScene extends Phaser.Scene {
  constructor() {
    super('PreloadScene');
  }

  preload() {
    this.generateTextures();
  }

  create() {
    this.scene.start('BootScene');
  }

  generateTextures() {
    this.generateClient();
    this.generatePackage();
    this.generateShelf();
    this.generateButtons();
    this.generateTimerBar();
    this.generateIcons();
    this.generateScenes();
  }

  generateClient() {
    COLORS.CLIENT.forEach((color, i) => this.paintClient(i, color));
  }

  paintClient(i, cloth) {
    const g = this.make.graphics({ add: false });
    const skin = 0xf3c7a4;
    const skinDeep = 0xd9a47e;
    const hair = [0x2c2118, 0x6a3b22, 0x1c1c1c, 0x8d6840, 0x3a2a44][i];
    const clothDeep = shadeColor(cloth, -0.28);

    g.fillStyle(0x000000, 0.18);
    g.fillEllipse(48, 132, 46, 12);

    g.fillStyle(0x2c3548, 1);
    g.fillRoundedRect(30, 102, 14, 26, 4);
    g.fillRoundedRect(52, 102, 14, 26, 4);
    g.fillStyle(0x241910, 1);
    g.fillRoundedRect(26, 122, 20, 9, 3);
    g.fillRoundedRect(50, 122, 20, 9, 3);

    g.fillStyle(cloth, 1);
    g.fillRoundedRect(8, 66, 16, 34, 7);
    g.fillRoundedRect(72, 66, 16, 34, 7);
    g.fillStyle(skin, 1);
    g.fillCircle(16, 100, 7);
    g.fillCircle(80, 100, 7);

    g.fillStyle(cloth, 1);
    g.fillRoundedRect(22, 60, 52, 48, 12);
    g.fillStyle(clothDeep, 1);
    g.fillRect(22, 94, 52, 12);
    g.fillStyle(0x000000, 0.15);
    g.fillRoundedRect(36, 78, 24, 14, 3);
    g.fillStyle(0xfff8ee, 1);
    g.fillTriangle(38, 62, 58, 62, 48, 78);
    g.fillStyle(skinDeep, 1);
    g.fillRoundedRect(42, 52, 12, 14, 3);

    g.fillStyle(skin, 1);
    g.fillCircle(28, 40, 5);
    g.fillCircle(68, 40, 5);
    g.fillStyle(hair, 1);
    g.fillCircle(48, 30, 20);
    g.fillStyle(skin, 1);
    g.fillCircle(48, 40, 16);
    g.fillStyle(hair, 1);
    g.fillEllipse(48, 26, 36, 16);

    g.fillStyle(0xfffaf2, 1);
    g.fillEllipse(41, 40, 8, 9);
    g.fillEllipse(55, 40, 8, 9);
    g.fillStyle(0x2a241c, 1);
    g.fillCircle(42, 41, 2.2);
    g.fillCircle(56, 41, 2.2);
    g.lineStyle(2, hair, 1);
    g.lineBetween(36, 34, 46, 35);
    g.lineBetween(50, 35, 60, 34);
    g.lineStyle(2, 0xa15b48, 1);
    g.beginPath();
    g.arc(48, 46, 6, 0.25, Math.PI - 0.25, false);
    g.strokePath();
    g.fillStyle(0xe7a090, 0.4);
    g.fillEllipse(36, 46, 6, 3);
    g.fillEllipse(60, 46, 6, 3);

    g.generateTexture('client_' + i, 96, 140);
    g.destroy();
  }

  generatePackage() {
    this.paintPackage('pkg_default', 0xd7b07a, 0x7a4a28, 0xc45c26, 2);
    this.paintPackage('pkg_hover', 0xf0d09a, 0xa85a28, 0xe07030, 2);
    this.paintPackage('pkg_selected', 0xe7c48a, 0x1d6fa5, 0x2478b0, 3);
  }

  paintPackage(key, body, edge, tape, borderW) {
    const g = this.make.graphics({ add: false });
    g.fillStyle(0x000000, 0.16);
    g.fillRoundedRect(3, 4, 62, 38, 4);
    g.fillStyle(body, 1);
    g.fillRoundedRect(1, 1, 64, 40, 4);
    g.fillStyle(edge, 0.25);
    g.fillRect(1, 28, 64, 13);
    g.fillStyle(tape, 1);
    g.fillTriangle(1, 1, 16, 1, 1, 16);
    g.fillTriangle(65, 41, 50, 41, 65, 26);
    g.fillRect(1, 1, 64, 5);
    g.fillRect(1, 36, 64, 5);
    g.fillStyle(0xfffaf2, 1);
    g.fillRoundedRect(7, 11, 54, 20, 3);
    g.lineStyle(1, 0xd9c7ae, 1);
    g.strokeRoundedRect(7, 11, 54, 20, 3);
    g.lineStyle(borderW, edge, 1);
    g.strokeRoundedRect(1.5, 1.5, 63, 39, 4);
    g.generateTexture(key, 68, 44);
    g.destroy();
  }

  generateShelf() {
    this.paintShelf('shelf', false);
    this.paintShelf('shelf_highlight', true);
  }

  paintShelf(key, highlight) {
    const g = this.make.graphics({ add: false });
    const W = 150;
    const H = 110;
    g.fillStyle(0x000000, 0.18);
    g.fillRoundedRect(4, 6, W - 6, H - 6, 4);
    g.fillStyle(highlight ? 0xd7f0df : 0xf4e7d0, 1);
    g.fillRect(12, 18, W - 24, H - 36);
    g.fillStyle(0x000000, 0.07);
    g.fillRect(12, 18, W - 24, 14);
    g.fillStyle(0x5c3418, 1);
    g.fillRect(0, 0, 12, H);
    g.fillRect(W - 12, 0, 12, H);
    g.fillStyle(0xa56b3c, 1);
    g.fillRect(2, 0, 4, H);
    g.fillRect(W - 6, 0, 4, H);
    g.fillStyle(0x6b3e24, 1);
    g.fillRect(0, 0, W, 16);
    g.fillStyle(0xd7a15a, 1);
    g.fillRect(0, 0, W, 5);
    g.fillStyle(0x6b3e24, 1);
    g.fillRect(0, H - 18, W, 18);
    g.fillStyle(0xd7a15a, 1);
    g.fillRect(0, H - 18, W, 5);
    g.fillStyle(0x2a1a10, 1);
    g.fillCircle(6, 8, 1.7);
    g.fillCircle(W - 6, 8, 1.7);
    g.fillCircle(6, H - 9, 1.7);
    g.fillCircle(W - 6, H - 9, 1.7);
    g.lineStyle(highlight ? 4 : 2, highlight ? 0x1f8a4c : 0x4a2c16, 1);
    g.strokeRoundedRect(2, 2, W - 4, H - 4, 4);
    g.generateTexture(key, W, H);
    g.destroy();
  }

  generateButtons() {
    this.paintButton('btn_normal', 96, 36, 0x1e3a5f, 0x14283f);
    this.paintButton('btn_hover', 96, 36, 0xd27a2c, 0x8a4e16);
    this.paintButton('btn_active', 96, 36, 0xa85e18, 0x6e3c0e);
    this.paintButton('btn_disabled', 96, 36, 0x5c5348, 0x3e3832);
    this.paintButton('deliver_normal', 240, 54, 0x2f8f5b, 0x1e6b40);
    this.paintButton('deliver_hover', 240, 54, 0x38a86a, 0x1e6b40);
    this.paintButton('deliver_active', 240, 54, 0x21764a, 0x164e32);
    this.paintButton('play_normal', 280, 64, 0xd6453d, 0x8e2c28);
    this.paintButton('play_hover', 280, 64, 0xe26458, 0x8e2c28);
    this.paintButton('play_active', 280, 64, 0xb1332e, 0x8e2c28);
    this.paintButton('help_normal', 220, 46, 0x1e3a5f, 0x14283f);
    this.paintButton('help_hover', 220, 46, 0x2d5688, 0x14283f);
    this.paintButton('ok_normal', 180, 48, 0xd6453d, 0x8e2c28);
    this.paintButton('ok_hover', 180, 48, 0xe26458, 0x8e2c28);
    this.paintButton('nextday_normal', 250, 50, 0xd6453d, 0x8e2c28);
    this.paintButton('nextday_hover', 250, 50, 0xe26458, 0x8e2c28);
    this.paintButton('nextday_active', 250, 50, 0xb1332e, 0x8e2c28);
    this.paintButton('buy_ok', 130, 38, 0x2f8f5b, 0x1e6b40);
    this.paintButton('buy_hover', 130, 38, 0x38a86a, 0x1e6b40);
    this.paintButton('buy_no', 130, 38, 0x6d6258, 0x4e453e);
    this.paintButton('back_normal', 112, 36, 0xf2c14e, 0xc4922a);
    this.paintButton('back_hover', 112, 36, 0xffe08a, 0xc4922a);
  }

  paintButton(key, w, h, fill, edge) {
    const g = this.make.graphics({ add: false });
    g.fillStyle(edge, 1);
    g.fillRoundedRect(2, 4, w - 4, h - 6, 10);
    g.fillStyle(fill, 1);
    g.fillRoundedRect(2, 1, w - 4, h - 8, 10);
    g.fillStyle(0xffffff, 0.2);
    g.fillRoundedRect(8, 4, w - 16, Math.max(6, Math.round((h - 8) * 0.28)), 6);
    g.generateTexture(key, w, h);
    g.destroy();
  }

  generateTimerBar() {
    const gb = this.make.graphics({ add: false });
    gb.fillStyle(0x2a2118, 1);
    gb.fillRoundedRect(0, 0, 200, 16, 8);
    gb.lineStyle(2, 0x6b5344, 1);
    gb.strokeRoundedRect(1, 1, 198, 14, 7);
    gb.generateTexture('timer_bar_bg', 200, 16);
    gb.destroy();
    this.paintBar('timer_bar_fill', 0x2f8f5b);
    this.paintBar('timer_bar_warn', 0xe0a23a);
    this.paintBar('timer_bar_danger', 0xd6453d);
  }

  paintBar(key, color) {
    const g = this.make.graphics({ add: false });
    g.fillStyle(color, 1);
    g.fillRoundedRect(0, 0, 200, 16, 8);
    g.fillStyle(0xffffff, 0.28);
    g.fillRoundedRect(4, 2, 192, 5, 3);
    g.generateTexture(key, 200, 16);
    g.destroy();
  }

  generateIcons() {
    const coin = this.make.graphics({ add: false });
    coin.fillStyle(0xb8860b, 1);
    coin.fillCircle(11, 11, 10);
    coin.fillStyle(0xf2c14e, 1);
    coin.fillCircle(11, 11, 8);
    coin.fillStyle(0xffe7a3, 1);
    coin.fillCircle(8, 8, 3);
    coin.lineStyle(1.5, 0xa87412, 1);
    coin.strokeCircle(11, 11, 5);
    coin.generateTexture('coin', 22, 22);
    coin.destroy();

    const star = this.make.graphics({ add: false });
    star.fillStyle(0xf2c14e, 1);
    const pts = [];
    for (let i = 0; i < 10; i++) {
      const ang = -Math.PI / 2 + i * Math.PI / 5;
      const rad = i % 2 === 0 ? 10 : 4.4;
      pts.push({ x: 11 + Math.cos(ang) * rad, y: 11 + Math.sin(ang) * rad });
    }
    star.fillPoints(pts, true);
    star.lineStyle(1, 0xa87412, 1);
    star.strokePoints(pts, true);
    star.generateTexture('star', 22, 22);
    star.destroy();

    const bell = this.make.graphics({ add: false });
    bell.fillStyle(0x000000, 0.16);
    bell.fillEllipse(28, 30, 46, 8);
    bell.fillStyle(0xf2c14e, 1);
    bell.fillCircle(28, 18, 13);
    bell.fillStyle(0xc4922a, 1);
    bell.fillRoundedRect(4, 18, 48, 8, 3);
    bell.fillStyle(0xe8c15a, 1);
    bell.fillRoundedRect(8, 18, 40, 5, 2);
    bell.fillStyle(0xfff1c2, 1);
    bell.fillEllipse(22, 13, 10, 6);
    bell.fillStyle(0x6b3e24, 1);
    bell.fillCircle(28, 5, 3);
    bell.generateTexture('bell', 56, 34);
    bell.destroy();

    const plaque = this.make.graphics({ add: false });
    plaque.fillStyle(0x14283f, 1);
    plaque.fillRoundedRect(0, 3, 280, 34, 8);
    plaque.fillStyle(0x1e3a5f, 1);
    plaque.fillRoundedRect(0, 0, 280, 32, 8);
    plaque.fillStyle(0xf2c14e, 1);
    plaque.fillRect(16, 28, 248, 3);
    plaque.generateTexture('plaque', 280, 36);
    plaque.destroy();

    const hud = this.make.graphics({ add: false });
    hud.fillStyle(0x1b314f, 1);
    hud.fillRect(0, 0, 900, 50);
    hud.fillStyle(0xf2c14e, 1);
    hud.fillRect(0, 47, 900, 3);
    hud.generateTexture('hud_bar', 900, 50);
    hud.destroy();
  }

  generateScenes() {
    this.paintCounterDesk();
    this.paintHelpPanel();
    this.paintReceipt();
    this.paintShopRow();
    this.paintMenuBg();
    this.paintCounterScene();
    this.paintWarehouseScene();
    this.paintShopBg();
  }

  paintCounterDesk() {
    const g = this.make.graphics({ add: false });
    const w = 820;
    const h = 120;
    g.fillStyle(0xc9843e, 1);
    g.fillRoundedRect(0, 0, w, 28, 6);
    g.fillStyle(0xf0cb8a, 1);
    g.fillRect(12, 4, w - 24, 8);
    g.fillStyle(0x8a532c, 1);
    g.fillRoundedRect(8, 22, w - 16, h - 30, 8);
    g.fillStyle(0x5c3418, 1);
    g.fillRect(8, 22, w - 16, 10);
    g.fillStyle(0x6e4222, 1);
    for (let i = 0; i < 4; i++) {
      const x = 36 + i * 192;
      g.fillRoundedRect(x, 46, 156, 56, 4);
    }
    g.lineStyle(2, 0xc4925a, 0.75);
    for (let i = 0; i < 4; i++) {
      g.strokeRoundedRect(36 + i * 192, 46, 156, 56, 4);
    }
    g.fillStyle(0x3a2415, 1);
    g.fillRect(28, h - 10, 16, 10);
    g.fillRect(w - 44, h - 10, 16, 10);
    g.generateTexture('counter_desk', w, h);
    g.destroy();
  }

  paintHelpPanel() {
    const g = this.make.graphics({ add: false });
    const w = 560;
    const h = 340;
    g.fillStyle(0x6b3e24, 1);
    g.fillRoundedRect(0, 6, w, h - 6, 16);
    g.fillStyle(0xfff8ee, 1);
    g.fillRoundedRect(0, 0, w, h - 8, 16);
    g.lineStyle(3, 0xe2c8a4, 1);
    g.strokeRoundedRect(14, 14, w - 28, h - 36, 10);
    g.lineStyle(2, 0xe2c8a4, 1);
    g.lineBetween(40, 52, w - 40, 52);
    g.generateTexture('help_panel', w, h);
    g.destroy();
  }

  paintReceipt() {
    const g = this.make.graphics({ add: false });
    const w = 500;
    const h = 120;
    g.fillStyle(0x6b3e24, 1);
    g.fillRoundedRect(0, 4, w, h - 4, 12);
    g.fillStyle(0xfff8ee, 1);
    g.fillRoundedRect(0, 0, w, h - 6, 12);
    g.lineStyle(2, 0xe2c8a4, 1);
    g.strokeRoundedRect(8, 8, w - 16, h - 22, 8);
    g.generateTexture('receipt', w, h);
    g.destroy();
  }

  paintShopRow() {
    const g = this.make.graphics({ add: false });
    const w = 780;
    const h = 56;
    g.fillStyle(0x2a211c, 1);
    g.fillRoundedRect(0, 3, w, h - 3, 10);
    g.fillStyle(0x3e3128, 1);
    g.fillRoundedRect(0, 0, w, h - 4, 10);
    g.fillStyle(0xf2c14e, 1);
    g.fillRoundedRect(0, 8, 6, h - 20, 2);
    g.lineStyle(2, 0x6b5344, 1);
    g.strokeRoundedRect(1, 1, w - 2, h - 6, 10);
    g.generateTexture('shop_row', w, h);
    g.destroy();
  }

  paintMenuBg() {
    const g = this.make.graphics({ add: false });
    this.paintRoom(g, 900, 600, 392);
    this.paintWindow(g, 36, 118, 156, 108);
    this.paintWindow(g, 708, 118, 156, 108);
    g.lineStyle(4, 0x5c5348, 1);
    g.lineBetween(260, 0, 260, 16);
    g.lineBetween(640, 0, 640, 16);
    g.fillStyle(0x1e3a5f, 1);
    g.fillRoundedRect(170, 16, 560, 96, 12);
    g.fillStyle(0xf6d98a, 1);
    g.fillRoundedRect(184, 28, 532, 72, 8);
    g.lineStyle(2, 0xc4922a, 1);
    g.strokeRoundedRect(196, 38, 508, 52, 6);
    g.generateTexture('menu_bg', 900, 600);
    g.destroy();
  }

  paintCounterScene() {
    const g = this.make.graphics({ add: false });
    this.paintRoom(g, 900, 500, 292);
    this.paintWindow(g, 24, 20, 160, 112);
    this.paintWindow(g, 710, 20, 166, 112);
    this.paintPoster(g, 214, 36);
    g.fillStyle(0x8e3b3b, 1);
    g.fillRoundedRect(250, 418, 400, 52, 8);
    g.lineStyle(3, 0xf2c14e, 0.9);
    g.strokeRoundedRect(262, 428, 376, 32, 6);
    g.generateTexture('counter_scene', 900, 500);
    g.destroy();
  }

  paintWarehouseScene() {
    const g = this.make.graphics({ add: false });
    g.fillStyle(0xefe2d0, 1);
    g.fillRect(0, 0, 900, 500);
    g.fillStyle(0xe5d4ba, 1);
    for (let x = 0; x < 900; x += 120) g.fillRect(x, 0, 2, 340);
    g.fillStyle(0xffe3a3, 0.2);
    g.fillEllipse(450, 28, 420, 80);
    g.fillStyle(0x3a342c, 1);
    g.fillRoundedRect(418, 6, 64, 14, 3);
    g.fillStyle(0xf2c14e, 1);
    g.fillCircle(450, 26, 5);
    g.fillStyle(0x8d8274, 1);
    g.fillRect(0, 340, 900, 160);
    g.fillStyle(0xf2c14e, 1);
    g.fillRect(0, 340, 900, 6);
    g.fillStyle(0x7a7064, 1);
    for (let y = 360; y < 500; y += 22) g.fillRect(0, y, 900, 2);
    this.paintStack(g, 22, 390);
    this.paintStack(g, 812, 378);
    g.generateTexture('warehouse_scene', 900, 500);
    g.destroy();
  }

  paintShopBg() {
    const g = this.make.graphics({ add: false });
    g.fillStyle(0x2a211c, 1);
    g.fillRect(0, 0, 900, 600);
    g.fillStyle(0x342822, 1);
    for (let x = 0; x < 900; x += 90) g.fillRect(x, 72, 86, 528);
    g.fillStyle(0x1b314f, 1);
    g.fillRect(0, 0, 900, 64);
    g.fillStyle(0xf2c14e, 1);
    g.fillRect(0, 64, 900, 4);
    g.generateTexture('shop_bg', 900, 600);
    g.destroy();
  }

  paintRoom(g, w, h, floorY) {
    g.fillStyle(0xf7ead6, 1);
    g.fillRect(0, 0, w, h);
    g.fillStyle(0xf1dfc6, 1);
    const panelH = Math.max(40, floorY - 36);
    for (let x = 8; x < w; x += 108) {
      g.fillRoundedRect(x, 14, 100, panelH, 6);
    }
    g.lineStyle(2, 0xe4cfae, 0.85);
    for (let x = 8; x < w; x += 108) {
      g.strokeRoundedRect(x, 14, 100, panelH, 6);
    }
    g.fillStyle(0x6b3e24, 1);
    g.fillRect(0, floorY, w, 16);
    g.fillStyle(0xd7a15a, 1);
    g.fillRect(0, floorY, w, 4);
    g.fillStyle(0xdcc3a0, 1);
    g.fillRect(0, floorY + 16, w, h - floorY - 16);
    g.lineStyle(2, 0xc8ab82, 0.9);
    for (let y = floorY + 34; y < h; y += 26) g.lineBetween(0, y, w, y);
    g.lineStyle(1, 0xb99572, 0.4);
    for (let x = 24; x < w; x += 140) g.lineBetween(x, floorY + 16, x, h);
  }

  paintWindow(g, x, y, w, h) {
    g.fillStyle(0x6b3e24, 1);
    g.fillRoundedRect(x - 6, y - 6, w + 12, h + 12, 5);
    g.fillStyle(0x9fd7ee, 1);
    g.fillRect(x, y, w, h);
    g.fillStyle(0xf7e2a8, 0.45);
    g.fillRect(x, y + Math.floor(h * 0.58), w, Math.ceil(h * 0.42));
    g.fillStyle(0xf6e7cf, 1);
    g.fillRect(x + Math.floor(w / 2) - 3, y, 6, h);
    g.fillRect(x, y + Math.floor(h / 2) - 3, w, 6);
    g.fillStyle(0x8d5a32, 1);
    g.fillRect(x - 10, y + h, w + 20, 8);
  }

  paintPoster(g, x, y) {
    g.fillStyle(0x1e3a5f, 1);
    g.fillRoundedRect(x, y, 76, 98, 6);
    g.fillStyle(0xf6d98a, 1);
    g.fillRoundedRect(x + 8, y + 10, 60, 24, 4);
    g.fillStyle(0xc45c26, 1);
    g.fillRoundedRect(x + 16, y + 44, 44, 30, 3);
    g.fillStyle(0xd7b07a, 1);
    g.fillRoundedRect(x + 20, y + 48, 36, 22, 2);
    g.fillStyle(0xf2c14e, 1);
    g.fillRect(x + 14, y + 82, 48, 5);
  }

  paintStack(g, x, y) {
    g.fillStyle(0xb88958, 1);
    g.fillRoundedRect(x, y + 28, 62, 36, 3);
    g.fillStyle(0xc45c26, 1);
    g.fillRect(x, y + 40, 62, 6);
    g.fillStyle(0xd7b07a, 1);
    g.fillRoundedRect(x + 8, y + 8, 50, 32, 3);
    g.fillStyle(0xc45c26, 1);
    g.fillRect(x + 8, y + 20, 50, 5);
    g.fillStyle(0xfff8ee, 1);
    g.fillRect(x + 16, y + 12, 22, 10);
  }
}


/* ===== src/scenes/BootScene.js ===== */

class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  create() {
    this.add.image(450, 300, 'menu_bg');
    this.add.image(450, 300, 'client_1');
    this.add.image(450, 400, 'counter_desk');
    this.add.image(188, 348, 'bell');
    this.add.image(548, 354, 'pkg_default').setAngle(-7);
    this.add.image(630, 348, 'pkg_hover').setAngle(6).setScale(0.92);
    this.add.image(706, 358, 'pkg_default').setAngle(-4).setScale(0.82);

    this.add.text(450, 52, 'Симулятор ПВЗ', {
      fontSize: '40px',
      fontFamily: 'Arial, sans-serif',
      color: '#1e3a5f',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    this.add.text(450, 84, 'Выдай заказы до конца смены', {
      fontSize: '16px',
      fontFamily: 'Arial, sans-serif',
      color: '#5c3d22',
    }).setOrigin(0.5);

    this.playBtn = this.add.image(450, 492, 'play_normal').setInteractive({ useHandCursor: true });
    this.playText = this.add.text(450, 490, 'Играть', {
      fontSize: '28px',
      fontFamily: 'Arial, sans-serif',
      color: '#fff8ee',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    this.playBtn.on('pointerover', () => {
      this.playBtn.setTexture('play_hover');
      this.tweens.add({
        targets: [this.playBtn, this.playText],
        scaleX: 1.04,
        scaleY: 1.04,
        duration: 100,
      });
    });
    this.playBtn.on('pointerout', () => {
      this.playBtn.setTexture('play_normal');
      this.tweens.add({
        targets: [this.playBtn, this.playText],
        scaleX: 1,
        scaleY: 1,
        duration: 100,
      });
    });
    this.playBtn.on('pointerdown', () => {
      this.playBtn.setTexture('play_active');
      this.scene.start('GameScene');
    });

    this.helpBtn = this.add.image(450, 566, 'help_normal').setInteractive({ useHandCursor: true });
    this.helpText = this.add.text(450, 564, 'Как играть', {
      fontSize: '18px',
      fontFamily: 'Arial, sans-serif',
      color: '#fff8ee',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    this.helpBtn.on('pointerover', () => this.helpBtn.setTexture('help_hover'));
    this.helpBtn.on('pointerout', () => this.helpBtn.setTexture('help_normal'));
    this.helpBtn.on('pointerdown', () => this.setHelp(true));

    this.dim = this.add.rectangle(450, 300, 900, 600, 0x140e0a, 0.62)
      .setDepth(30)
      .setVisible(false);
    this.dim.on('pointerdown', () => this.setHelp(false));

    this.helpLayer = this.add.container(0, 0).setDepth(31).setVisible(false);
    const panel = this.add.image(450, 308, 'help_panel');
    const helpTitle = this.add.text(450, 168, 'Как играть', {
      fontSize: '26px',
      fontFamily: 'Arial, sans-serif',
      color: '#1e3a5f',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    const helpBody = this.add.text(200, 200,
      '«Стойка» и «Склад» переключают зал и склад.\n'
      + 'На складе кликните посылку с нужным номером.\n'
      + 'На стойке нажмите «Выдать посылку».\n\n'
      + 'Верно: +10 монет и +1 к рейтингу.\n'
      + 'Ошибка: -5 монет. Клиент ушёл — рейтинг -1.\n'
      + 'Смена длится 90 секунд, потом магазин улучшений.',
      {
        fontSize: '16px',
        fontFamily: 'Arial, sans-serif',
        color: '#3a2a1a',
        lineSpacing: 4,
        wordWrap: { width: 500 },
      }
    );
    const closeBtn = this.add.image(450, 438, 'ok_normal').setInteractive({ useHandCursor: true });
    const closeText = this.add.text(450, 436, 'Понятно', {
      fontSize: '18px',
      fontFamily: 'Arial, sans-serif',
      color: '#fff8ee',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    closeBtn.on('pointerover', () => closeBtn.setTexture('ok_hover'));
    closeBtn.on('pointerout', () => closeBtn.setTexture('ok_normal'));
    closeBtn.on('pointerdown', () => this.setHelp(false));

    this.helpLayer.add([panel, helpTitle, helpBody, closeBtn, closeText]);
    panel.setInteractive();
  }

  setHelp(open) {
    this.helpLayer.setVisible(open);
    this.dim.setVisible(open);
    if (open) this.dim.setInteractive();
    else this.dim.disableInteractive();
  }
}


const EXTRA_ROWS = ['D', 'E', 'F'];

class GameScene extends Phaser.Scene {
  constructor() {
    super('GameScene');
  }

  init(data) {
    this.initData = data || {};
  }

  create() {
    this.coins = this.initData.coins || 0;
    this.rating = this.initData.rating || 0;
    this.day = this.initData.day || 1;
    this.upgrades = this.initData.upgrades || {
      fasterBoots: 0,
      sortAssist: 0,
      warehouseExpansion: 0,
      hireAssistant: 0,
    };

    this.selectedPackageId = null;
    this.viewMode = 'counter';
    this.shiftPaused = false;

    this.shiftTimeLeft = BASE.SHIFT_DURATION_SEC;
    this.shiftDelivered = 0;
    this.shiftCoinsEarned = 0;
    this.shiftRatingChange = 0;
    this.coinsAtStart = this.coins;

    this.difficulty = getDifficultyForDay(this.day);

    this.shelfRows = [...BASE.SHELF_ROWS];
    const expansionLevel = this.upgrades.warehouseExpansion || 0;
    for (let i = 0; i < expansionLevel; i++) {
      if (i < EXTRA_ROWS.length) this.shelfRows.push(EXTRA_ROWS[i]);
    }
    this.shelfCols = [...BASE.SHELF_COLS];
    this.existingIdChance = BASE.EXISTING_ID_CHANCE;

    this.clients = new ClientManager(this);
    this.warehouse = new WarehouseManager(this);

    this.drawBackground();
    this.createUI();

    this.counterGroup = this.add.container(0, 0);
    this.clients.createCounterView(this.counterGroup);

    this.warehouseGroup = this.add.container(0, 0);
    this.warehouse.createWarehouseView(this.warehouseGroup, this.shelfRows, this.shelfCols);

    this.showView('counter');

    this.warehouse.populateWarehouse(
      this.shelfRows,
      BASE.INITIAL_PACKAGE_MIN,
      BASE.INITIAL_PACKAGE_MAX,
      this.difficulty.extraDecoyPackages,
    );

    this.clients.scheduleNextSpawn();

    this.shiftTimerEvent = this.time.addEvent({
      delay: 1000,
      callback: this.tickShift,
      callbackScope: this,
      repeat: BASE.SHIFT_DURATION_SEC - 1,
    });

    this.updateUI();
  }

  drawBackground() {
    this.add.rectangle(450, 300, 900, 600, 0xf7ead6);
  }

  createUI() {
    this.hudBar = this.add.image(450, 25, 'hud_bar');
    const topY = 24;

    this.coinIcon = this.add.image(22, topY, 'coin');
    this.coinsText = this.add.text(38, topY, 'Монеты: 0', {
      fontSize: '15px', fontFamily: 'Arial', color: '#ffe7a3', fontStyle: 'bold',
    }).setOrigin(0, 0.5);

    this.starIcon = this.add.image(210, topY, 'star');
    this.ratingText = this.add.text(226, topY, 'Рейтинг: 0', {
      fontSize: '15px', fontFamily: 'Arial', color: '#e7fff1', fontStyle: 'bold',
    }).setOrigin(0, 0.5);

    this.timerText = this.add.text(390, topY, 'Таймер: --', {
      fontSize: '15px', fontFamily: 'Arial', color: '#ffd5ce', fontStyle: 'bold',
    }).setOrigin(0, 0.5);

    this.dayText = this.add.text(530, topY, 'День: ' + this.day, {
      fontSize: '15px', fontFamily: 'Arial', color: '#d6ecff', fontStyle: 'bold',
    }).setOrigin(0, 0.5);

    this.shiftBarBg = this.add.rectangle(760, topY, 148, 16, 0x14283f)
      .setOrigin(0.5)
      .setStrokeStyle(2, 0xf2c14e);
    this.shiftBarFill = this.add.rectangle(760, topY, 140, 12, 0xf2c14e)
      .setOrigin(0.5);
    this.shiftTimerText = this.add.text(760, topY, 'Смена: ' + this.shiftTimeLeft + 'с', {
      fontSize: '11px', fontFamily: 'Arial', color: '#1e3a5f', fontStyle: 'bold',
    }).setOrigin(0.5);

    this.statusText = this.add.text(450, 54, '', {
      fontSize: '14px', fontFamily: 'Arial', color: '#2c2416', fontStyle: 'bold',
      stroke: '#fff8ee', strokeThickness: 4,
    }).setOrigin(0.5, 0);

    this.counterBtn = this.createButton(718, 572, 'Стойка', () => this.showView('counter'));
    this.warehouseBtn = this.createButton(832, 572, 'Склад', () => this.showView('warehouse'));

    [
      this.hudBar, this.coinIcon, this.starIcon,
      this.coinsText, this.ratingText, this.timerText, this.dayText,
      this.shiftBarBg, this.shiftBarFill, this.shiftTimerText, this.statusText,
      this.counterBtn.bg, this.counterBtn.txt, this.warehouseBtn.bg, this.warehouseBtn.txt,
    ].forEach((obj) => obj.setDepth(100));
  }

  createButton(x, y, label, callback) {
    const bg = this.add.image(x, y, 'btn_normal')
      .setInteractive({ useHandCursor: true });
    const txt = this.add.text(x, y - 1, label, {
      fontSize: '15px', fontFamily: 'Arial', color: '#fff8ee', fontStyle: 'bold',
    }).setOrigin(0.5);

    bg.on('pointerover', () => bg.setTexture('btn_hover'));
    bg.on('pointerout', () => {
      const isActive =
        (label === 'Стойка' && this.viewMode === 'counter') ||
        (label === 'Склад' && this.viewMode === 'warehouse');
      bg.setTexture(isActive ? 'btn_hover' : 'btn_normal');
    });
    bg.on('pointerdown', () => {
      bg.setTexture('btn_active');
      callback();
    });
    return { bg, txt };
  }

  updateUI() {
    this.coinsText.setText(`Монеты: ${this.coins}`);
    this.ratingText.setText(`Рейтинг: ${this.rating}`);
    this.dayText.setText(`День: ${this.day}`);

    // Update shift bar
    const ratio = this.shiftTimeLeft / BASE.SHIFT_DURATION_SEC;
    this.shiftBarFill.setScale(Math.max(0.01, ratio), 1);
    this.shiftTimerText.setText(`Смена: ${this.shiftTimeLeft}с`);

    if (ratio > 0.3) {
      this.shiftBarFill.setFillStyle(0xf2c14e);
    } else if (ratio > 0.1) {
      this.shiftBarFill.setFillStyle(0xe07a2f);
    } else {
      this.shiftBarFill.setFillStyle(0xd6453d);
    }

    if (this.clients.currentClient) {
      this.timerText.setText(`Таймер: ${this.clients.clientTimeLeft}с`);
    } else {
      this.timerText.setText('Таймер: --');
    }
  }

  showStatus(msg, color = '#ffffff') {
    this.statusText.setText(msg).setColor(color);
    this.time.delayedCall(2000, () => {
      if (this.statusText.text === msg) this.statusText.setText('');
    });
  }

  /* ---------- View switching ---------- */

  showView(mode) {
    this.viewMode = mode;
    this.counterGroup.setVisible(mode === 'counter');
    this.warehouseGroup.setVisible(mode === 'warehouse');

    this.counterBtn.bg.setTexture(mode === 'counter' ? 'btn_hover' : 'btn_normal');
    this.warehouseBtn.bg.setTexture(mode === 'warehouse' ? 'btn_hover' : 'btn_normal');

    if (mode === 'warehouse' && this.clients.currentClient) {
      this.warehouse.updateRequestText(this.clients.currentClient.requestedId);
    } else {
      this.warehouse.updateRequestText('');
    }
  }

  /* ---------- Package selection ---------- */

  selectPackage(pkgId, img) {
    this.warehouse.resetHighlights();
    this.selectedPackageId = pkgId;
    img.setTexture('pkg_selected');
    this.showStatus(`Выбрана: ${pkgId}`, '#2980b9');
    this.clients.updateDeliverButton();
  }

  /* ---------- Delivery ---------- */

  deliverPackage() {
    if (!this.clients.currentClient || !this.selectedPackageId) return;

    const requestedId = this.clients.currentClient.requestedId;
    const correct = this.selectedPackageId === requestedId;

    if (correct) {
      this.coins += BASE.REWARD_COINS;
      this.rating += 1;
      this.shiftDelivered++;
      this.shiftCoinsEarned += BASE.REWARD_COINS;
      this.shiftRatingChange++;
      this.showStatus(`+${BASE.REWARD_COINS} монет! +1 рейтинг`, '#2ecc71');
      showFloatingText(this, 450, 350, `+${BASE.REWARD_COINS} монет`, '#2ecc71');

      this.warehouse.removePackage(this.selectedPackageId);

      if (this.warehouse.packages.size < 4) {
        this.warehouse.addRandomPackages(
          Phaser.Math.Between(3, 5),
          this.shelfRows,
        );
      }
    } else {
      this.coins = Math.max(0, this.coins - BASE.PENALTY_COINS);
      this.showStatus(`Неверная посылка! -${BASE.PENALTY_COINS} монет`, '#e74c3c');
      showFloatingText(this, 450, 350, `-${BASE.PENALTY_COINS} монет`, '#e74c3c');
    }

    this.clients.removeClient();
    this.updateUI();

    this.clients.clientsServed++;
    if (!correct) {
      this.clients.scheduleNextSpawn();
      return;
    }

    const assistLevel = this.upgrades.hireAssistant || 0;
    if (assistLevel > 0) {
      this.clients.assistantCounter++;
      const threshold = Math.max(1, 4 - (assistLevel - 1));
      if (this.clients.assistantCounter >= threshold) {
        this.clients.assistantCounter = 0;
        this.time.delayedCall(1500, () => this.autoFulfillClient());
        return;
      }
    }

    this.clients.scheduleNextSpawn();
  }

  autoFulfillClient() {
    if (this.shiftPaused) return;

    const pkgIds = Array.from(this.warehouse.packages.keys());
    if (pkgIds.length === 0) {
      this.clients.scheduleNextSpawn();
      return;
    }

    const autoId = Phaser.Utils.Array.GetRandom(pkgIds);
    this.coins += BASE.REWARD_COINS;
    this.rating += 1;
    this.shiftDelivered++;
    this.shiftCoinsEarned += BASE.REWARD_COINS;
    this.shiftRatingChange++;

    this.warehouse.removePackage(autoId);
    this.showStatus(`Помощник выдал ${autoId}! +${BASE.REWARD_COINS}`, '#27ae60');
    showFloatingText(this, 450, 300, `Помощник +${BASE.REWARD_COINS}`, '#27ae60');
    this.updateUI();

    if (this.warehouse.packages.size < 4) {
      this.warehouse.addRandomPackages(
        Phaser.Math.Between(3, 5),
        this.shelfRows,
      );
    }

    this.clients.scheduleNextSpawn();
  }

  /* ---------- Shift system ---------- */

  tickShift() {
    this.shiftTimeLeft--;
    this.updateUI();

    if (this.shiftTimeLeft <= 0) {
      this.endShift();
    }
  }

  endShift() {
    this.shiftPaused = true;

    this.clients.stopAllTimers();
    if (this.shiftTimerEvent) {
      this.shiftTimerEvent.destroy();
      this.shiftTimerEvent = null;
    }

    if (this.clients.currentClient) {
      this.clients.removeClient();
    }

    this.scene.start('ShopScene', {
      coins: this.coins,
      rating: this.rating,
      day: this.day,
      shiftDelivered: this.shiftDelivered,
      shiftCoinsEarned: this.shiftCoinsEarned,
      shiftRatingChange: this.shiftRatingChange,
      upgrades: this.upgrades,
    });
  }
}


/* ===== src/scenes/ShopScene.js ===== */

class ShopScene extends Phaser.Scene {
  constructor() {
    super('ShopScene');
  }

  init(data) {
    this.gameState = data;
  }

  create() {
    const { coins, rating, day, shiftDelivered, shiftCoinsEarned, shiftRatingChange, upgrades } = this.gameState;

    this.playerCoins = coins;
    this.playerUpgrades = { ...upgrades };

    this.add.image(450, 300, 'shop_bg');

    const back = this.add.image(78, 32, 'back_normal').setInteractive({ useHandCursor: true });
    const backText = this.add.text(78, 31, 'В меню', {
      fontSize: '14px', fontFamily: 'Arial', color: '#1e3a5f', fontStyle: 'bold',
    }).setOrigin(0.5);
    back.on('pointerover', () => back.setTexture('back_hover'));
    back.on('pointerout', () => back.setTexture('back_normal'));
    back.on('pointerdown', () => this.scene.start('BootScene'));

    this.add.text(470, 32, 'ДЕНЬ ' + day + ' — ИТОГИ СМЕНЫ', {
      fontSize: '24px', fontFamily: 'Arial', color: '#fff8ee', fontStyle: 'bold',
    }).setOrigin(0.5);

    this.add.image(450, 142, 'receipt');
    this.add.text(450, 118, 'Посылок выдано: ' + shiftDelivered, {
      fontSize: '18px', fontFamily: 'Arial', color: '#1b7a43', fontStyle: 'bold',
    }).setOrigin(0.5);
    this.add.text(450, 146, 'Монет заработано: ' + shiftCoinsEarned, {
      fontSize: '18px', fontFamily: 'Arial', color: '#8a5a10', fontStyle: 'bold',
    }).setOrigin(0.5);

    const ratingColor = shiftRatingChange >= 0 ? '#0e7a3d' : '#c0392b';
    const ratingSign = shiftRatingChange >= 0 ? '+' : '';
    this.add.text(450, 174, 'Рейтинг: ' + ratingSign + shiftRatingChange, {
      fontSize: '18px', fontFamily: 'Arial', color: ratingColor, fontStyle: 'bold',
    }).setOrigin(0.5);

    this.add.text(450, 214, 'МАГАЗИН УЛУЧШЕНИЙ', {
      fontSize: '22px', fontFamily: 'Arial', color: '#f6d98a', fontStyle: 'bold',
    }).setOrigin(0.5);

    this.add.image(392, 242, 'coin');
    this.coinsText = this.add.text(408, 242, 'Монеты: ' + this.playerCoins, {
      fontSize: '16px', fontFamily: 'Arial', color: '#ffe7a3', fontStyle: 'bold',
    }).setOrigin(0, 0.5);

    const upgradeList = [
      UPGRADES.FASTER_BOOTS,
      UPGRADES.SORT_ASSIST,
      UPGRADES.WAREHOUSE_EXPANSION,
      UPGRADES.HIRE_ASSISTANT,
    ];

    this.upgradeButtons = [];
    const startY = 286;
    const itemH = 62;

    for (let i = 0; i < upgradeList.length; i++) {
      this.createUpgradeRow(upgradeList[i], startY + i * itemH);
    }

    this.createNextDayButton(450, 552, day, rating);
  }

  createNextDayButton(x, y, day, rating) {
    const bg = this.add.image(x, y, 'nextday_normal').setInteractive({ useHandCursor: true });
    const txt = this.add.text(x, y - 1, 'СЛЕДУЮЩИЙ ДЕНЬ', {
      fontSize: '16px', fontFamily: 'Arial', color: '#fff8ee', fontStyle: 'bold',
    }).setOrigin(0.5);

    bg.on('pointerover', () => {
      bg.setTexture('nextday_hover');
      this.tweens.add({ targets: [bg, txt], scaleX: 1.04, scaleY: 1.04, duration: 100 });
    });
    bg.on('pointerout', () => {
      bg.setTexture('nextday_normal');
      this.tweens.add({ targets: [bg, txt], scaleX: 1, scaleY: 1, duration: 100 });
    });
    bg.on('pointerdown', () => {
      bg.setTexture('nextday_active');
      this.scene.start('GameScene', {
        coins: this.playerCoins,
        rating,
        day: day + 1,
        upgrades: this.playerUpgrades,
      });
    });
  }

  createUpgradeRow(upg, y) {
    const currentLevel = this.playerUpgrades[upg.id] || 0;
    const maxed = currentLevel >= upg.maxLevel;
    const cost = maxed ? 0 : getUpgradeCost(upg, currentLevel);
    const canAfford = !maxed && this.playerCoins >= cost;

    this.add.image(450, y, 'shop_row');

    this.add.text(108, y - 10, upg.name, {
      fontSize: '16px', fontFamily: 'Arial', color: '#fff8ee', fontStyle: 'bold',
    }).setOrigin(0, 0.5);
    this.add.text(108, y + 12, upg.desc, {
      fontSize: '12px', fontFamily: 'Arial', color: '#e6d3b8',
    }).setOrigin(0, 0.5);

    const pipStartX = 520;
    for (let i = 0; i < upg.maxLevel; i++) {
      const pipColor = i < currentLevel ? 0xf2c14e : 0x6b5344;
      this.add.circle(pipStartX + i * 16, y, 5, pipColor);
    }
    this.add.text(pipStartX + upg.maxLevel * 16 + 6, y, currentLevel + '/' + upg.maxLevel, {
      fontSize: '12px', fontFamily: 'Arial', color: '#f2c14e',
    }).setOrigin(0, 0.5);

    if (maxed) {
      this.add.image(748, y, 'buy_no');
      this.add.text(748, y, 'МАКС', {
        fontSize: '14px', fontFamily: 'Arial', color: '#efe6da', fontStyle: 'bold',
      }).setOrigin(0.5);
    } else {
      const btn = this.add.image(748, y, canAfford ? 'buy_ok' : 'buy_no');
      const btnText = this.add.text(748, y, cost + ' монет', {
        fontSize: '13px', fontFamily: 'Arial', color: '#fff8ee', fontStyle: 'bold',
      }).setOrigin(0.5);

      if (canAfford) {
        btn.setInteractive({ useHandCursor: true });
        btn.on('pointerover', () => {
          btn.setTexture('buy_hover');
          this.tweens.add({ targets: [btn, btnText], scaleX: 1.06, scaleY: 1.06, duration: 80 });
        });
        btn.on('pointerout', () => {
          btn.setTexture('buy_ok');
          this.tweens.add({ targets: [btn, btnText], scaleX: 1, scaleY: 1, duration: 80 });
        });
        btn.on('pointerdown', () => {
          this.playerCoins -= cost;
          this.playerUpgrades[upg.id] = currentLevel + 1;
          this.scene.restart({
            ...this.gameState,
            coins: this.playerCoins,
            upgrades: this.playerUpgrades,
          });
        });
      } else {
        btn.setAlpha(0.7);
        btnText.setAlpha(0.7);
      }
    }
  }
}


const config = {
  type: Phaser.AUTO,
  width: 900,
  height: 600,
  parent: 'game-container',
  backgroundColor: '#f7ead6',
  scene: [PreloadScene, BootScene, GameScene, ShopScene],
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    min: { width: 320, height: 480 },
    max: { width: 1920, height: 1080 },
  },
  input: {
    activePointers: 3,
  },
};

window.__game = new Phaser.Game(config);
