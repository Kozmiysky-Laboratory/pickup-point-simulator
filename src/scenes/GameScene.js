import Phaser from 'phaser';
import { BASE, COLORS, getDifficultyForDay } from '../config.js';
import { ClientManager } from '../managers/ClientManager.js';
import { WarehouseManager } from '../managers/WarehouseManager.js';

const EXTRA_ROWS = ['D', 'E', 'F'];

export class GameScene extends Phaser.Scene {
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

    // Shift tracking
    this.shiftTimeLeft = BASE.SHIFT_DURATION_SEC;
    this.shiftDelivered = 0;
    this.shiftCoinsEarned = 0;
    this.shiftRatingChange = 0;
    this.coinsAtStart = this.coins;

    // Difficulty
    this.difficulty = getDifficultyForDay(this.day);

    // Shelf configuration (base + expansion)
    this.shelfRows = [...BASE.SHELF_ROWS];
    const expansionLevel = this.upgrades.warehouseExpansion || 0;
    for (let i = 0; i < expansionLevel; i++) {
      if (i < EXTRA_ROWS.length) this.shelfRows.push(EXTRA_ROWS[i]);
    }
    this.shelfCols = [...BASE.SHELF_COLS];
    this.existingIdChance = BASE.EXISTING_ID_CHANCE;

    // Managers
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

    // Start spawning
    this.clients.scheduleNextSpawn();

    // Shift timer
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

    this.coinsText = this.add.text(15, 12, 'Монеты: 0', {
      fontSize: '16px', fontFamily: 'Arial', color: '#ffd700', fontStyle: 'bold',
    });

    this.ratingText = this.add.text(170, 12, 'Рейтинг: 0', {
      fontSize: '16px', fontFamily: 'Arial', color: '#00ff88', fontStyle: 'bold',
    });

    this.timerText = this.add.text(350, 12, 'Таймер: --', {
      fontSize: '16px', fontFamily: 'Arial', color: '#ff6b6b', fontStyle: 'bold',
    });

    this.dayText = this.add.text(520, 12, `День: ${this.day}`, {
      fontSize: '16px', fontFamily: 'Arial', color: '#88ccff', fontStyle: 'bold',
    });

    this.shiftTimerText = this.add.text(650, 12, `Смена: ${this.shiftTimeLeft}с`, {
      fontSize: '16px', fontFamily: 'Arial', color: '#ffaa44', fontStyle: 'bold',
    });

    this.statusText = this.add.text(800, 12, '', {
      fontSize: '14px', fontFamily: 'Arial', color: '#ffffff',
    });

    this.counterBtn = this.createButton(750, 575, 'Стойка', () => this.showView('counter'));
    this.warehouseBtn = this.createButton(850, 575, 'Склад', () => this.showView('warehouse'));
  }

  createButton(x, y, label, callback) {
    const bg = this.add.rectangle(x, y, 90, 30, COLORS.BTN)
      .setInteractive({ useHandCursor: true });
    const txt = this.add.text(x, y, label, {
      fontSize: '14px', fontFamily: 'Arial', color: '#ffffff', fontStyle: 'bold',
    }).setOrigin(0.5);
    bg.on('pointerover', () => bg.setFillStyle(COLORS.BTN_ACTIVE));
    bg.on('pointerout', () => bg.setFillStyle(COLORS.BTN));
    bg.on('pointerdown', callback);
    return { bg, txt };
  }

  updateUI() {
    this.coinsText.setText(`Монеты: ${this.coins}`);
    this.ratingText.setText(`Рейтинг: ${this.rating}`);
    this.dayText.setText(`День: ${this.day}`);
    this.shiftTimerText.setText(`Смена: ${this.shiftTimeLeft}с`);
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

    this.counterBtn.bg.setFillStyle(mode === 'counter' ? COLORS.BTN_ACTIVE : COLORS.BTN);
    this.warehouseBtn.bg.setFillStyle(mode === 'warehouse' ? COLORS.BTN_ACTIVE : COLORS.BTN);

    if (mode === 'warehouse' && this.clients.currentClient) {
      this.warehouse.updateRequestText(this.clients.currentClient.requestedId);
    } else {
      this.warehouse.updateRequestText('');
    }
  }

  /* ---------- Package selection ---------- */

  selectPackage(pkgId, rect) {
    this.warehouse.resetHighlights();
    this.selectedPackageId = pkgId;
    rect.setFillStyle(COLORS.PKG_SELECTED);
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
    }

    this.clients.removeClient();
    this.updateUI();

    // Hire Assistant: auto-fulfill every 4th client
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

    // Spawn a client and immediately fulfill them
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

    if (this.shiftTimeLeft <= 10) {
      this.shiftTimerText.setColor('#ff0000');
    }

    if (this.shiftTimeLeft <= 0) {
      this.endShift();
    }
  }

  endShift() {
    this.shiftPaused = true;

    // Stop all timers
    this.clients.stopAllTimers();
    if (this.shiftTimerEvent) {
      this.shiftTimerEvent.destroy();
      this.shiftTimerEvent = null;
    }

    // Remove current client silently
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
