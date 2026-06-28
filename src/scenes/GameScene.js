import Phaser from 'phaser';

const SHELF_ROWS = ['A', 'B', 'C'];
const SHELF_COLS = [1, 2, 3, 4];
const CLIENT_TIMER_SEC = 20;
const SPAWN_MIN_MS = 5000;
const SPAWN_MAX_MS = 10000;
const REWARD_COINS = 10;
const PENALTY_COINS = 5;

function randomId() {
  const row = SHELF_ROWS[Phaser.Math.Between(0, SHELF_ROWS.length - 1)];
  const num = Phaser.Math.Between(100, 199);
  return `${row}-${num}`;
}

export class GameScene extends Phaser.Scene {
  constructor() {
    super('GameScene');
  }

  create() {
    this.coins = 0;
    this.rating = 0;
    this.currentClient = null;
    this.clientTimerEvent = null;
    this.clientTimeLeft = 0;
    this.selectedPackageId = null;
    this.viewMode = 'counter'; // 'counter' or 'warehouse'

    this.shelves = [];
    this.packages = new Map();

    this.drawBackground();
    this.createUI();
    this.createCounterView();
    this.createWarehouseView();
    this.showView('counter');

    this.spawnTimerEvent = this.time.addEvent({
      delay: Phaser.Math.Between(SPAWN_MIN_MS, SPAWN_MAX_MS),
      callback: this.spawnClient,
      callbackScope: this,
      loop: false,
    });

    this.populateWarehouse();
  }

  drawBackground() {
    // Divider line
    this.add.rectangle(450, 0, 2, 600, 0x333333).setOrigin(0.5, 0);
  }

  /* ---------- UI (always visible) ---------- */

  createUI() {
    // Top bar
    this.add.rectangle(450, 0, 900, 50, 0x16213e).setOrigin(0.5, 0);

    this.coinsText = this.add.text(20, 12, 'Монеты: 0', {
      fontSize: '18px', fontFamily: 'Arial', color: '#ffd700', fontStyle: 'bold',
    });

    this.ratingText = this.add.text(200, 12, 'Рейтинг: 0', {
      fontSize: '18px', fontFamily: 'Arial', color: '#00ff88', fontStyle: 'bold',
    });

    this.timerText = this.add.text(420, 12, 'Таймер: --', {
      fontSize: '18px', fontFamily: 'Arial', color: '#ff6b6b', fontStyle: 'bold',
    });

    this.statusText = this.add.text(650, 12, '', {
      fontSize: '16px', fontFamily: 'Arial', color: '#ffffff',
    });

    // View toggle buttons
    this.counterBtn = this.createButton(750, 575, 'Стойка', () => this.showView('counter'));
    this.warehouseBtn = this.createButton(850, 575, 'Склад', () => this.showView('warehouse'));
  }

  createButton(x, y, label, callback) {
    const bg = this.add.rectangle(x, y, 90, 30, 0x0f3460).setInteractive({ useHandCursor: true });
    const txt = this.add.text(x, y, label, {
      fontSize: '14px', fontFamily: 'Arial', color: '#ffffff', fontStyle: 'bold',
    }).setOrigin(0.5);
    bg.on('pointerover', () => bg.setFillStyle(0x533483));
    bg.on('pointerout', () => bg.setFillStyle(0x0f3460));
    bg.on('pointerdown', callback);
    return { bg, txt };
  }

  updateUI() {
    this.coinsText.setText(`Монеты: ${this.coins}`);
    this.ratingText.setText(`Рейтинг: ${this.rating}`);
    if (this.currentClient) {
      this.timerText.setText(`Таймер: ${this.clientTimeLeft}с`);
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

  /* ---------- Counter View ---------- */

  createCounterView() {
    this.counterGroup = this.add.container(0, 0);

    // Counter desk
    const desk = this.add.rectangle(450, 400, 700, 12, 0x8b4513);
    this.counterGroup.add(desk);

    // Label
    const label = this.add.text(450, 70, 'СТОЙКА ВЫДАЧИ', {
      fontSize: '22px', fontFamily: 'Arial', color: '#16213e', fontStyle: 'bold',
    }).setOrigin(0.5);
    this.counterGroup.add(label);

    // Waiting area
    const waitArea = this.add.rectangle(450, 280, 300, 200, 0xe8dcc8, 0.5)
      .setStrokeStyle(2, 0x999999);
    this.counterGroup.add(waitArea);

    const waitLabel = this.add.text(450, 195, 'Зона ожидания', {
      fontSize: '14px', fontFamily: 'Arial', color: '#888888',
    }).setOrigin(0.5);
    this.counterGroup.add(waitLabel);

    // Client placeholder
    this.clientRect = this.add.rectangle(450, 280, 80, 100, 0x999999)
      .setVisible(false);
    this.counterGroup.add(this.clientRect);

    this.clientIdText = this.add.text(450, 230, '', {
      fontSize: '16px', fontFamily: 'Arial', color: '#ffffff', fontStyle: 'bold',
      backgroundColor: '#333333', padding: { x: 6, y: 3 },
    }).setOrigin(0.5).setVisible(false);
    this.counterGroup.add(this.clientIdText);

    this.clientLabel = this.add.text(450, 340, '', {
      fontSize: '13px', fontFamily: 'Arial', color: '#333333',
    }).setOrigin(0.5).setVisible(false);
    this.counterGroup.add(this.clientLabel);

    // Deliver zone
    this.deliverZone = this.add.rectangle(450, 470, 200, 60, 0x2ecc71, 0.6)
      .setStrokeStyle(2, 0x27ae60)
      .setInteractive({ useHandCursor: true })
      .setVisible(false);
    this.counterGroup.add(this.deliverZone);

    this.deliverText = this.add.text(450, 470, 'ВЫДАТЬ ПОСЫЛКУ', {
      fontSize: '14px', fontFamily: 'Arial', color: '#ffffff', fontStyle: 'bold',
    }).setOrigin(0.5).setVisible(false);
    this.counterGroup.add(this.deliverText);

    this.selectedLabel = this.add.text(450, 510, '', {
      fontSize: '12px', fontFamily: 'Arial', color: '#16213e',
    }).setOrigin(0.5).setVisible(false);
    this.counterGroup.add(this.selectedLabel);

    this.deliverZone.on('pointerdown', () => this.deliverPackage());

    // No client message
    this.noClientText = this.add.text(450, 280, 'Ожидание клиента...', {
      fontSize: '18px', fontFamily: 'Arial', color: '#aaaaaa',
    }).setOrigin(0.5);
    this.counterGroup.add(this.noClientText);
  }

  /* ---------- Warehouse View ---------- */

  createWarehouseView() {
    this.warehouseGroup = this.add.container(0, 0);

    const label = this.add.text(450, 70, 'СКЛАД', {
      fontSize: '22px', fontFamily: 'Arial', color: '#16213e', fontStyle: 'bold',
    }).setOrigin(0.5);
    this.warehouseGroup.add(label);

    // Requested ID reminder
    this.warehouseRequestText = this.add.text(450, 100, '', {
      fontSize: '18px', fontFamily: 'Arial', color: '#e94560', fontStyle: 'bold',
      backgroundColor: '#fff5f5', padding: { x: 8, y: 4 },
    }).setOrigin(0.5);
    this.warehouseGroup.add(this.warehouseRequestText);

    const startX = 150;
    const startY = 175;
    const cellW = 160;
    const cellH = 120;

    for (let r = 0; r < SHELF_ROWS.length; r++) {
      for (let c = 0; c < SHELF_COLS.length; c++) {
        const x = startX + c * cellW;
        const y = startY + r * cellH;
        const shelfId = `${SHELF_ROWS[r]}${SHELF_COLS[c]}`;

        const shelfBg = this.add.rectangle(x, y, cellW - 10, cellH - 10, 0xdec9a4)
          .setStrokeStyle(2, 0x8b7355);
        this.warehouseGroup.add(shelfBg);

        const shelfLabel = this.add.text(x, y - 30, shelfId, {
          fontSize: '14px', fontFamily: 'Arial', color: '#555555', fontStyle: 'bold',
        }).setOrigin(0.5);
        this.warehouseGroup.add(shelfLabel);

        this.shelves.push({ id: shelfId, x, y, bg: shelfBg, label: shelfLabel, packageObj: null });
      }
    }
  }

  populateWarehouse() {
    // Clear existing packages
    this.packages.forEach((pkg) => {
      pkg.rect.destroy();
      pkg.text.destroy();
    });
    this.packages.clear();

    // Generate 6-10 packages on random shelves
    const count = Phaser.Math.Between(6, 10);
    const available = Phaser.Utils.Array.Shuffle([...this.shelves]);
    const used = available.slice(0, Math.min(count, available.length));

    for (const shelf of used) {
      const pkgId = randomId();
      const rect = this.add.rectangle(shelf.x, shelf.y + 5, 60, 40, 0xc0392b)
        .setInteractive({ useHandCursor: true })
        .setStrokeStyle(2, 0x922b21);
      const text = this.add.text(shelf.x, shelf.y + 5, pkgId, {
        fontSize: '12px', fontFamily: 'Arial', color: '#ffffff', fontStyle: 'bold',
      }).setOrigin(0.5);

      this.warehouseGroup.add(rect);
      this.warehouseGroup.add(text);

      rect.on('pointerover', () => rect.setFillStyle(0xe74c3c));
      rect.on('pointerout', () => {
        rect.setFillStyle(this.selectedPackageId === pkgId ? 0x2980b9 : 0xc0392b);
      });
      rect.on('pointerdown', () => this.selectPackage(pkgId, rect));

      const pkg = { id: pkgId, rect, text, shelf };
      shelf.packageObj = pkg;
      this.packages.set(pkgId, pkg);
    }
  }

  /* ---------- View switching ---------- */

  showView(mode) {
    this.viewMode = mode;
    this.counterGroup.setVisible(mode === 'counter');
    this.warehouseGroup.setVisible(mode === 'warehouse');

    this.counterBtn.bg.setFillStyle(mode === 'counter' ? 0x533483 : 0x0f3460);
    this.warehouseBtn.bg.setFillStyle(mode === 'warehouse' ? 0x533483 : 0x0f3460);

    if (mode === 'warehouse' && this.currentClient) {
      this.warehouseRequestText.setText(`Клиент ждёт: ${this.currentClient.requestedId}`);
    } else {
      this.warehouseRequestText.setText('');
    }
  }

  /* ---------- Client spawner ---------- */

  spawnClient() {
    if (this.currentClient) {
      this.scheduleNextSpawn();
      return;
    }

    const requestedId = this.pickRequestedId();

    const colors = [0x3498db, 0xe67e22, 0x9b59b6, 0x1abc9c, 0xf39c12];
    const color = Phaser.Utils.Array.GetRandom(colors);

    this.currentClient = {
      requestedId,
      color,
    };

    this.clientRect.setFillStyle(color).setVisible(true);
    this.clientIdText.setText(`Посылка: ${requestedId}`).setVisible(true);
    this.clientLabel.setText('Клиент ожидает').setVisible(true);
    this.noClientText.setVisible(false);

    // Show deliver button if package is selected
    this.updateDeliverButton();

    // Start countdown
    this.clientTimeLeft = CLIENT_TIMER_SEC;
    this.updateUI();

    if (this.clientTimerEvent) this.clientTimerEvent.destroy();
    this.clientTimerEvent = this.time.addEvent({
      delay: 1000,
      callback: this.tickClientTimer,
      callbackScope: this,
      repeat: CLIENT_TIMER_SEC - 1,
    });

    if (this.viewMode === 'warehouse') {
      this.warehouseRequestText.setText(`Клиент ждёт: ${requestedId}`);
    }
  }

  pickRequestedId() {
    // 70% chance to pick an ID that actually exists in warehouse
    const pkgIds = Array.from(this.packages.keys());
    if (pkgIds.length > 0 && Math.random() < 0.7) {
      return Phaser.Utils.Array.GetRandom(pkgIds);
    }
    return randomId();
  }

  tickClientTimer() {
    this.clientTimeLeft--;
    this.updateUI();

    if (this.clientTimeLeft <= 5) {
      this.timerText.setColor('#ff0000');
    }

    if (this.clientTimeLeft <= 0) {
      this.clientTimeout();
    }
  }

  clientTimeout() {
    this.rating = Math.max(0, this.rating - 1);
    this.showStatus('Клиент ушёл! Рейтинг -1', '#ff0000');
    this.removeClient();
    this.scheduleNextSpawn();
  }

  removeClient() {
    this.currentClient = null;
    this.clientRect.setVisible(false);
    this.clientIdText.setVisible(false);
    this.clientLabel.setVisible(false);
    this.noClientText.setVisible(true);
    this.selectedPackageId = null;
    this.deliverZone.setVisible(false);
    this.deliverText.setVisible(false);
    this.selectedLabel.setVisible(false);
    this.timerText.setColor('#ff6b6b');

    if (this.clientTimerEvent) {
      this.clientTimerEvent.destroy();
      this.clientTimerEvent = null;
    }

    this.warehouseRequestText.setText('');
    this.updateUI();

    // Reset package highlights
    this.packages.forEach((pkg) => {
      pkg.rect.setFillStyle(0xc0392b);
    });
  }

  scheduleNextSpawn() {
    this.spawnTimerEvent = this.time.addEvent({
      delay: Phaser.Math.Between(SPAWN_MIN_MS, SPAWN_MAX_MS),
      callback: this.spawnClient,
      callbackScope: this,
      loop: false,
    });
  }

  /* ---------- Package selection ---------- */

  selectPackage(pkgId, rect) {
    // Deselect previous
    this.packages.forEach((pkg) => {
      pkg.rect.setFillStyle(0xc0392b);
    });

    this.selectedPackageId = pkgId;
    rect.setFillStyle(0x2980b9);

    this.showStatus(`Выбрана: ${pkgId}`, '#2980b9');
    this.updateDeliverButton();
  }

  updateDeliverButton() {
    const show = this.currentClient && this.selectedPackageId;
    this.deliverZone.setVisible(!!show);
    this.deliverText.setVisible(!!show);
    this.selectedLabel.setVisible(!!show);
    if (show) {
      this.selectedLabel.setText(`Выбрано: ${this.selectedPackageId}`);
    }
  }

  /* ---------- Delivery ---------- */

  deliverPackage() {
    if (!this.currentClient || !this.selectedPackageId) return;

    const requestedId = this.currentClient.requestedId;
    const correct = this.selectedPackageId === requestedId;

    if (correct) {
      this.coins += REWARD_COINS;
      this.rating += 1;
      this.showStatus(`+${REWARD_COINS} монет! +1 рейтинг`, '#2ecc71');

      // Remove delivered package from warehouse
      const pkg = this.packages.get(this.selectedPackageId);
      if (pkg) {
        pkg.rect.destroy();
        pkg.text.destroy();
        pkg.shelf.packageObj = null;
        this.packages.delete(this.selectedPackageId);
      }

      // Replenish warehouse if too few packages
      if (this.packages.size < 4) {
        this.addRandomPackages(Phaser.Math.Between(3, 5));
      }
    } else {
      this.coins = Math.max(0, this.coins - PENALTY_COINS);
      this.showStatus(`Неверная посылка! -${PENALTY_COINS} монет`, '#e74c3c');
    }

    this.removeClient();
    this.updateUI();
    this.scheduleNextSpawn();
  }

  addRandomPackages(count) {
    const emptyShelves = this.shelves.filter((s) => !s.packageObj);
    const toFill = Phaser.Utils.Array.Shuffle(emptyShelves).slice(0, Math.min(count, emptyShelves.length));

    for (const shelf of toFill) {
      const pkgId = randomId();
      if (this.packages.has(pkgId)) continue;

      const rect = this.add.rectangle(shelf.x, shelf.y + 5, 60, 40, 0xc0392b)
        .setInteractive({ useHandCursor: true })
        .setStrokeStyle(2, 0x922b21);
      const text = this.add.text(shelf.x, shelf.y + 5, pkgId, {
        fontSize: '12px', fontFamily: 'Arial', color: '#ffffff', fontStyle: 'bold',
      }).setOrigin(0.5);

      this.warehouseGroup.add(rect);
      this.warehouseGroup.add(text);

      rect.on('pointerover', () => rect.setFillStyle(0xe74c3c));
      rect.on('pointerout', () => {
        rect.setFillStyle(this.selectedPackageId === pkgId ? 0x2980b9 : 0xc0392b);
      });
      rect.on('pointerdown', () => this.selectPackage(pkgId, rect));

      const pkg = { id: pkgId, rect, text, shelf };
      shelf.packageObj = pkg;
      this.packages.set(pkgId, pkg);
    }
  }
}
