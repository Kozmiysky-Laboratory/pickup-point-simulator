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

    const desk = s.add.rectangle(450, 400, 700, 12, COLORS.DESK);
    container.add(desk);

    const label = s.add.text(450, 70, 'СТОЙКА ВЫДАЧИ', {
      fontSize: '22px', fontFamily: 'Arial', color: '#16213e', fontStyle: 'bold',
    }).setOrigin(0.5);
    container.add(label);

    const waitArea = s.add.rectangle(450, 280, 300, 200, 0xe8dcc8, 0.5)
      .setStrokeStyle(2, 0x999999);
    container.add(waitArea);

    const waitLabel = s.add.text(450, 195, 'Зона ожидания', {
      fontSize: '14px', fontFamily: 'Arial', color: '#888888',
    }).setOrigin(0.5);
    container.add(waitLabel);

    // Client sprite (using generated texture)
    this.clientSprite = s.add.image(450, 280, 'client_0').setVisible(false);
    container.add(this.clientSprite);

    this.clientIdText = s.add.text(450, 215, '', {
      fontSize: '16px', fontFamily: 'Arial', color: '#ffffff', fontStyle: 'bold',
      backgroundColor: '#333333', padding: { x: 6, y: 3 },
    }).setOrigin(0.5).setVisible(false);
    container.add(this.clientIdText);

    this.clientLabel = s.add.text(450, 345, '', {
      fontSize: '13px', fontFamily: 'Arial', color: '#333333',
    }).setOrigin(0.5).setVisible(false);
    container.add(this.clientLabel);

    // Timer bar
    this.timerBarBg = s.add.image(450, 365, 'timer_bar_bg').setVisible(false);
    container.add(this.timerBarBg);

    this.timerBarFill = s.add.image(450, 365, 'timer_bar_fill')
      .setVisible(false).setOrigin(0.5);
    container.add(this.timerBarFill);

    this.timerBarText = s.add.text(450, 365, '', {
      fontSize: '10px', fontFamily: 'Arial', color: '#ffffff', fontStyle: 'bold',
    }).setOrigin(0.5).setVisible(false).setDepth(10);
    container.add(this.timerBarText);

    // Deliver button (using generated texture)
    this.deliverBtn = s.add.image(450, 470, 'deliver_normal')
      .setInteractive({ useHandCursor: true })
      .setVisible(false);
    container.add(this.deliverBtn);

    this.deliverText = s.add.text(450, 470, 'ВЫДАТЬ ПОСЫЛКУ', {
      fontSize: '14px', fontFamily: 'Arial', color: '#ffffff', fontStyle: 'bold',
    }).setOrigin(0.5).setVisible(false);
    container.add(this.deliverText);

    this.selectedLabel = s.add.text(450, 505, '', {
      fontSize: '12px', fontFamily: 'Arial', color: '#16213e',
    }).setOrigin(0.5).setVisible(false);
    container.add(this.selectedLabel);

    this.deliverBtn.on('pointerover', () => this.deliverBtn.setTexture('deliver_hover'));
    this.deliverBtn.on('pointerout', () => this.deliverBtn.setTexture('deliver_normal'));
    this.deliverBtn.on('pointerdown', () => {
      this.deliverBtn.setTexture('deliver_active');
      this.scene.deliverPackage();
    });

    this.noClientText = s.add.text(450, 280, 'Ожидание клиента...', {
      fontSize: '18px', fontFamily: 'Arial', color: '#aaaaaa',
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

    const label = s.add.text(450, 70, 'СКЛАД', {
      fontSize: '22px', fontFamily: 'Arial', color: '#16213e', fontStyle: 'bold',
    }).setOrigin(0.5);
    container.add(label);

    this.requestText = s.add.text(450, 100, '', {
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
          fontSize: '14px', fontFamily: 'Arial', color: '#555555', fontStyle: 'bold',
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
      fontSize: '12px', fontFamily: 'Arial', color: '#ffffff', fontStyle: 'bold',
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
    this.generateButton();
    this.generateDeliverButton();
    this.generateTimerBar();
  }

  generateClient() {
    const colors = [0x3498db, 0xe67e22, 0x9b59b6, 0x1abc9c, 0xf39c12];
    colors.forEach((color, i) => {
      const g = this.make.graphics({ add: false });
      const r = (color >> 16) & 0xff;
      const gv = (color >> 8) & 0xff;
      const b = color & 0xff;

      // Body
      g.fillStyle(color, 1);
      g.fillRoundedRect(10, 30, 60, 70, 8);

      // Head
      g.fillStyle(color, 1);
      g.fillCircle(40, 22, 18);

      // Face
      g.fillStyle(0xffffff, 1);
      g.fillCircle(33, 18, 4);
      g.fillCircle(47, 18, 4);
      g.fillStyle(0x333333, 1);
      g.fillCircle(33, 18, 2);
      g.fillCircle(47, 18, 2);

      // Smile
      g.lineStyle(2, 0x333333, 1);
      g.beginPath();
      g.arc(40, 26, 6, 0.2, Math.PI - 0.2);
      g.strokePath();

      // Border
      g.lineStyle(2, Math.max(0, (r - 40) << 16 | (gv - 40) << 8 | (b - 40)), 1);
      g.strokeRoundedRect(10, 30, 60, 70, 8);

      g.generateTexture(`client_${i}`, 80, 100);
      g.destroy();
    });
  }

  generatePackage() {
    // Default
    const gd = this.make.graphics({ add: false });
    gd.fillStyle(0xc0392b, 1);
    gd.fillRoundedRect(2, 2, 56, 36, 4);
    gd.lineStyle(2, 0x922b21, 1);
    gd.strokeRoundedRect(2, 2, 56, 36, 4);
    gd.lineStyle(1, 0xffffff, 0.3);
    gd.lineBetween(30, 4, 30, 36);
    gd.lineBetween(4, 20, 56, 20);
    gd.generateTexture('pkg_default', 60, 40);
    gd.destroy();

    // Hover
    const gh = this.make.graphics({ add: false });
    gh.fillStyle(0xe74c3c, 1);
    gh.fillRoundedRect(2, 2, 56, 36, 4);
    gh.lineStyle(2, 0xc0392b, 1);
    gh.strokeRoundedRect(2, 2, 56, 36, 4);
    gh.lineStyle(1, 0xffffff, 0.4);
    gh.lineBetween(30, 4, 30, 36);
    gh.lineBetween(4, 20, 56, 20);
    gh.generateTexture('pkg_hover', 60, 40);
    gh.destroy();

    // Selected
    const gs = this.make.graphics({ add: false });
    gs.fillStyle(0x2980b9, 1);
    gs.fillRoundedRect(2, 2, 56, 36, 4);
    gs.lineStyle(3, 0x3498db, 1);
    gs.strokeRoundedRect(2, 2, 56, 36, 4);
    gs.lineStyle(1, 0xffffff, 0.4);
    gs.lineBetween(30, 4, 30, 36);
    gs.lineBetween(4, 20, 56, 20);
    gs.generateTexture('pkg_selected', 60, 40);
    gs.destroy();
  }

  generateShelf() {
    const g = this.make.graphics({ add: false });
    g.fillStyle(0xdec9a4, 1);
    g.fillRoundedRect(2, 2, 146, 106, 6);
    g.lineStyle(2, 0x8b7355, 1);
    g.strokeRoundedRect(2, 2, 146, 106, 6);
    // Wood grain effect
    g.lineStyle(1, 0xc9b48c, 0.4);
    for (let i = 20; i < 100; i += 18) {
      g.lineBetween(8, i, 142, i);
    }
    g.generateTexture('shelf', 150, 110);
    g.destroy();

    // Highlighted shelf
    const gh = this.make.graphics({ add: false });
    gh.fillStyle(0xdec9a4, 1);
    gh.fillRoundedRect(2, 2, 146, 106, 6);
    gh.lineStyle(4, 0x27ae60, 1);
    gh.strokeRoundedRect(2, 2, 146, 106, 6);
    gh.lineStyle(1, 0xc9b48c, 0.4);
    for (let i = 20; i < 100; i += 18) {
      gh.lineBetween(8, i, 142, i);
    }
    gh.generateTexture('shelf_highlight', 150, 110);
    gh.destroy();
  }

  generateButton() {
    const states = [
      { key: 'btn_normal', fill: 0x0f3460, border: 0x1a4a8a },
      { key: 'btn_hover', fill: 0x533483, border: 0x6b44a8 },
      { key: 'btn_active', fill: 0x1a4a8a, border: 0x2060b0 },
      { key: 'btn_disabled', fill: 0x333333, border: 0x444444 },
    ];
    states.forEach(({ key, fill, border }) => {
      const g = this.make.graphics({ add: false });
      g.fillStyle(fill, 1);
      g.fillRoundedRect(2, 2, 86, 30, 6);
      g.lineStyle(2, border, 1);
      g.strokeRoundedRect(2, 2, 86, 30, 6);
      g.generateTexture(key, 90, 34);
      g.destroy();
    });
  }

  generateDeliverButton() {
    const states = [
      { key: 'deliver_normal', fill: 0x2ecc71, border: 0x27ae60 },
      { key: 'deliver_hover', fill: 0x27ae60, border: 0x219a52 },
      { key: 'deliver_active', fill: 0x219a52, border: 0x1b8a45 },
    ];
    states.forEach(({ key, fill, border }) => {
      const g = this.make.graphics({ add: false });
      g.fillStyle(fill, 1);
      g.fillRoundedRect(2, 2, 196, 50, 8);
      g.lineStyle(2, border, 1);
      g.strokeRoundedRect(2, 2, 196, 50, 8);
      g.generateTexture(key, 200, 54);
      g.destroy();
    });
  }

  generateTimerBar() {
    // Timer bar background
    const gb = this.make.graphics({ add: false });
    gb.fillStyle(0x333333, 1);
    gb.fillRoundedRect(0, 0, 200, 12, 6);
    gb.generateTexture('timer_bar_bg', 200, 12);
    gb.destroy();

    // Timer bar fill (green)
    const gf = this.make.graphics({ add: false });
    gf.fillStyle(0x2ecc71, 1);
    gf.fillRoundedRect(0, 0, 200, 12, 6);
    gf.generateTexture('timer_bar_fill', 200, 12);
    gf.destroy();

    // Timer bar fill (yellow)
    const gy = this.make.graphics({ add: false });
    gy.fillStyle(0xf39c12, 1);
    gy.fillRoundedRect(0, 0, 200, 12, 6);
    gy.generateTexture('timer_bar_warn', 200, 12);
    gy.destroy();

    // Timer bar fill (red)
    const gr = this.make.graphics({ add: false });
    gr.fillStyle(0xe74c3c, 1);
    gr.fillRoundedRect(0, 0, 200, 12, 6);
    gr.generateTexture('timer_bar_danger', 200, 12);
    gr.destroy();
  }
}


/* ===== src/scenes/BootScene.js ===== */

class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  create() {
    this.add.rectangle(450, 300, 900, 600, 0x1a1a2e);

    this.add.text(450, 200, 'Симулятор ПВЗ', {
      fontSize: '48px',
      fontFamily: 'Arial, sans-serif',
      color: '#e94560',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    this.add.text(450, 260, 'Pickup Point Simulator', {
      fontSize: '20px',
      fontFamily: 'Arial, sans-serif',
      color: '#ffffff',
    }).setOrigin(0.5);

    this.add.text(450, 300, 'Управляй пунктом выдачи заказов!', {
      fontSize: '14px',
      fontFamily: 'Arial, sans-serif',
      color: '#aaaaaa',
    }).setOrigin(0.5);

    const startBtn = this.add.rectangle(450, 380, 200, 55, 0xe94560, 1)
      .setInteractive({ useHandCursor: true })
      .setStrokeStyle(2, 0xc0354d);
    const startText = this.add.text(450, 380, 'ИГРАТЬ', {
      fontSize: '24px',
      fontFamily: 'Arial, sans-serif',
      color: '#ffffff',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    startBtn.on('pointerover', () => {
      startBtn.setFillStyle(0xff6b6b);
      this.tweens.add({
        targets: [startBtn, startText],
        scaleX: 1.08,
        scaleY: 1.08,
        duration: 120,
      });
    });
    startBtn.on('pointerout', () => {
      startBtn.setFillStyle(0xe94560);
      this.tweens.add({
        targets: [startBtn, startText],
        scaleX: 1,
        scaleY: 1,
        duration: 120,
      });
    });
    startBtn.on('pointerdown', () => {
      startBtn.setFillStyle(0xc0354d);
      this.scene.start('GameScene');
    });

    // Version
    this.add.text(450, 560, 'v0.3.0', {
      fontSize: '12px',
      fontFamily: 'Arial, sans-serif',
      color: '#555555',
    }).setOrigin(0.5);
  }
}


/* ===== src/scenes/GameScene.js ===== */

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
    this.add.rectangle(450, 0, 2, 600, 0x333333).setOrigin(0.5, 0);
  }

  /* ---------- UI ---------- */

  createUI() {
    this.add.rectangle(450, 0, 900, 50, COLORS.TOP_BAR).setOrigin(0.5, 0);

    const topY = 14;
    const fontSize = '14px';

    this.coinsText = this.add.text(10, topY, 'Монеты: 0', {
      fontSize, fontFamily: 'Arial', color: '#ffd700', fontStyle: 'bold',
    });

    this.ratingText = this.add.text(140, topY, 'Рейтинг: 0', {
      fontSize, fontFamily: 'Arial', color: '#00ff88', fontStyle: 'bold',
    });

    this.timerText = this.add.text(290, topY, 'Таймер: --', {
      fontSize, fontFamily: 'Arial', color: '#ff6b6b', fontStyle: 'bold',
    });

    this.dayText = this.add.text(440, topY, `День: ${this.day}`, {
      fontSize, fontFamily: 'Arial', color: '#88ccff', fontStyle: 'bold',
    });

    // Shift timer bar in the top bar
    this.shiftBarBg = this.add.rectangle(700, topY + 8, 160, 14, 0x333333, 0.8)
      .setOrigin(0.5);
    this.shiftBarFill = this.add.rectangle(700, topY + 8, 158, 12, 0xffaa44)
      .setOrigin(0.5);
    this.shiftTimerText = this.add.text(700, topY + 8, `${this.shiftTimeLeft}с`, {
      fontSize: '11px', fontFamily: 'Arial', color: '#ffffff', fontStyle: 'bold',
    }).setOrigin(0.5);

    this.statusText = this.add.text(850, topY, '', {
      fontSize: '12px', fontFamily: 'Arial', color: '#ffffff',
    }).setOrigin(0.5, 0);

    this.counterBtn = this.createButton(730, 575, 'Стойка', () => this.showView('counter'));
    this.warehouseBtn = this.createButton(840, 575, 'Склад', () => this.showView('warehouse'));
  }

  createButton(x, y, label, callback) {
    const bg = this.add.image(x, y, 'btn_normal')
      .setInteractive({ useHandCursor: true });
    const txt = this.add.text(x, y, label, {
      fontSize: '14px', fontFamily: 'Arial', color: '#ffffff', fontStyle: 'bold',
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
      this.shiftBarFill.setFillStyle(0xffaa44);
    } else if (ratio > 0.1) {
      this.shiftBarFill.setFillStyle(0xff6b44);
    } else {
      this.shiftBarFill.setFillStyle(0xff0000);
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

    // Background
    this.add.rectangle(450, 300, 900, 600, 0x1a1a2e);

    // Day results header
    this.add.text(450, 30, `ДЕНЬ ${day} — ИТОГИ СМЕНЫ`, {
      fontSize: '28px', fontFamily: 'Arial', color: '#ffd700', fontStyle: 'bold',
    }).setOrigin(0.5);

    // Results box
    const boxY = 100;
    this.add.rectangle(450, boxY, 400, 120, 0x16213e).setStrokeStyle(2, 0x333366);

    this.add.text(450, boxY - 35, `Посылок выдано: ${shiftDelivered}`, {
      fontSize: '18px', fontFamily: 'Arial', color: '#2ecc71', fontStyle: 'bold',
    }).setOrigin(0.5);
    this.add.text(450, boxY, `Монет заработано: ${shiftCoinsEarned}`, {
      fontSize: '18px', fontFamily: 'Arial', color: '#ffd700', fontStyle: 'bold',
    }).setOrigin(0.5);

    const ratingColor = shiftRatingChange >= 0 ? '#00ff88' : '#ff4444';
    const ratingSign = shiftRatingChange >= 0 ? '+' : '';
    this.add.text(450, boxY + 35, `Рейтинг: ${ratingSign}${shiftRatingChange}`, {
      fontSize: '18px', fontFamily: 'Arial', color: ratingColor, fontStyle: 'bold',
    }).setOrigin(0.5);

    // Shop title
    this.add.text(450, 190, 'МАГАЗИН УЛУЧШЕНИЙ', {
      fontSize: '24px', fontFamily: 'Arial', color: '#e94560', fontStyle: 'bold',
    }).setOrigin(0.5);

    // Coins display
    this.coinsText = this.add.text(450, 218, `Монеты: ${this.playerCoins}`, {
      fontSize: '16px', fontFamily: 'Arial', color: '#ffd700', fontStyle: 'bold',
    }).setOrigin(0.5);

    // Upgrade items
    const upgradeList = [
      UPGRADES.FASTER_BOOTS,
      UPGRADES.SORT_ASSIST,
      UPGRADES.WAREHOUSE_EXPANSION,
      UPGRADES.HIRE_ASSISTANT,
    ];

    this.upgradeButtons = [];
    const startY = 260;
    const itemH = 70;

    for (let i = 0; i < upgradeList.length; i++) {
      const upg = upgradeList[i];
      const y = startY + i * itemH;
      this.createUpgradeRow(upg, y);
    }

    // Next Day button
    this.createNextDayButton(450, 555, day, rating);
  }

  createNextDayButton(x, y, day, rating) {
    const bg = this.add.rectangle(x, y, 200, 45, COLORS.ACCENT)
      .setInteractive({ useHandCursor: true })
      .setStrokeStyle(2, 0xc0354d);
    const txt = this.add.text(x, y, 'СЛЕДУЮЩИЙ ДЕНЬ', {
      fontSize: '16px', fontFamily: 'Arial', color: '#ffffff', fontStyle: 'bold',
    }).setOrigin(0.5);

    bg.on('pointerover', () => {
      bg.setFillStyle(0xff6b6b);
      this.tweens.add({ targets: [bg, txt], scaleX: 1.05, scaleY: 1.05, duration: 100 });
    });
    bg.on('pointerout', () => {
      bg.setFillStyle(COLORS.ACCENT);
      this.tweens.add({ targets: [bg, txt], scaleX: 1, scaleY: 1, duration: 100 });
    });
    bg.on('pointerdown', () => {
      bg.setFillStyle(0xc0354d);
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

    // Background
    const rowBg = this.add.rectangle(450, y, 750, 55, 0x0f3460, 0.8)
      .setStrokeStyle(1, 0x333366);

    // Name + description
    this.add.text(100, y - 12, upg.name, {
      fontSize: '16px', fontFamily: 'Arial', color: '#ffffff', fontStyle: 'bold',
    }).setOrigin(0, 0.5);
    this.add.text(100, y + 12, upg.desc, {
      fontSize: '12px', fontFamily: 'Arial', color: '#aaaaaa',
    }).setOrigin(0, 0.5);

    // Level indicator with filled pips
    const pipStartX = 500;
    for (let i = 0; i < upg.maxLevel; i++) {
      const pipColor = i < currentLevel ? 0xffd700 : 0x444444;
      this.add.circle(pipStartX + i * 16, y, 5, pipColor);
    }
    this.add.text(pipStartX + upg.maxLevel * 16 + 5, y, `${currentLevel}/${upg.maxLevel}`, {
      fontSize: '12px', fontFamily: 'Arial', color: '#ffd700',
    }).setOrigin(0, 0.5);

    // Buy button
    if (maxed) {
      const maxBg = this.add.rectangle(700, y, 110, 35, 0x333333)
        .setStrokeStyle(1, 0x444444);
      this.add.text(700, y, 'МАКС', {
        fontSize: '14px', fontFamily: 'Arial', color: '#888888', fontStyle: 'bold',
      }).setOrigin(0.5);
    } else {
      const btnColor = canAfford ? 0x2ecc71 : 0x555555;
      const btnBorder = canAfford ? 0x27ae60 : 0x444444;
      const btn = this.add.rectangle(700, y, 110, 35, btnColor)
        .setStrokeStyle(1, btnBorder);

      const btnText = this.add.text(700, y, `${cost} монет`, {
        fontSize: '13px', fontFamily: 'Arial', color: '#ffffff', fontStyle: 'bold',
      }).setOrigin(0.5);

      if (canAfford) {
        btn.setInteractive({ useHandCursor: true });
        btn.on('pointerover', () => {
          btn.setFillStyle(0x27ae60);
          this.tweens.add({ targets: [btn, btnText], scaleX: 1.08, scaleY: 1.08, duration: 80 });
        });
        btn.on('pointerout', () => {
          btn.setFillStyle(0x2ecc71);
          this.tweens.add({ targets: [btn, btnText], scaleX: 1, scaleY: 1, duration: 80 });
        });
        btn.on('pointerdown', () => {
          btn.setFillStyle(0x1b8a45);
          this.playerCoins -= cost;
          this.playerUpgrades[upg.id] = currentLevel + 1;
          this.scene.restart({
            ...this.gameState,
            coins: this.playerCoins,
            upgrades: this.playerUpgrades,
          });
        });
      } else {
        // Disabled state - grey tint
        btn.setAlpha(0.6);
        btnText.setAlpha(0.6);
      }
    }
  }
}


const config = {
  type: Phaser.AUTO,
  width: 900,
  height: 600,
  parent: 'game-container',
  backgroundColor: '#f0e6d3',
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
