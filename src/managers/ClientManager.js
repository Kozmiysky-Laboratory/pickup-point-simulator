import Phaser from 'phaser';
import { COLORS, randomId } from '../config.js';

export class ClientManager {
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
