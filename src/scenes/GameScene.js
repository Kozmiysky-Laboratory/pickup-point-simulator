import Phaser from 'phaser';
import { BASE, COLORS, getDifficultyForDay } from '../config.js';
import { ClientManager } from '../managers/ClientManager.js';
import { WarehouseManager } from '../managers/WarehouseManager.js';
import { showFloatingText } from '../ui/FloatingText.js';

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
