import Phaser from 'phaser';
import { COLORS, randomId } from '../config.js';

export class ClientManager {
  constructor(scene) {
    this.scene = scene;
    this.currentClient = null;
    this.clientTimerEvent = null;
    this.clientTimeLeft = 0;
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

    this.clientRect = s.add.rectangle(450, 280, 80, 100, 0x999999).setVisible(false);
    container.add(this.clientRect);

    this.clientIdText = s.add.text(450, 230, '', {
      fontSize: '16px', fontFamily: 'Arial', color: '#ffffff', fontStyle: 'bold',
      backgroundColor: '#333333', padding: { x: 6, y: 3 },
    }).setOrigin(0.5).setVisible(false);
    container.add(this.clientIdText);

    this.clientLabel = s.add.text(450, 340, '', {
      fontSize: '13px', fontFamily: 'Arial', color: '#333333',
    }).setOrigin(0.5).setVisible(false);
    container.add(this.clientLabel);

    this.deliverZone = s.add.rectangle(450, 470, 200, 60, COLORS.SUCCESS, 0.6)
      .setStrokeStyle(2, 0x27ae60)
      .setInteractive({ useHandCursor: true })
      .setVisible(false);
    container.add(this.deliverZone);

    this.deliverText = s.add.text(450, 470, 'ВЫДАТЬ ПОСЫЛКУ', {
      fontSize: '14px', fontFamily: 'Arial', color: '#ffffff', fontStyle: 'bold',
    }).setOrigin(0.5).setVisible(false);
    container.add(this.deliverText);

    this.selectedLabel = s.add.text(450, 510, '', {
      fontSize: '12px', fontFamily: 'Arial', color: '#16213e',
    }).setOrigin(0.5).setVisible(false);
    container.add(this.selectedLabel);

    this.deliverZone.on('pointerdown', () => this.scene.deliverPackage());

    this.noClientText = s.add.text(450, 280, 'Ожидание клиента...', {
      fontSize: '18px', fontFamily: 'Arial', color: '#aaaaaa',
    }).setOrigin(0.5);
    container.add(this.noClientText);
  }

  spawnClient(difficulty, packages, shelfRows, existingIdChance) {
    if (this.currentClient || this.scene.shiftPaused) return;

    const requestedId = this.pickRequestedId(packages, shelfRows, existingIdChance);
    const color = Phaser.Utils.Array.GetRandom(COLORS.CLIENT);

    this.currentClient = { requestedId, color };

    this.clientRect.setFillStyle(color).setVisible(true);
    this.clientIdText.setText(`Посылка: ${requestedId}`).setVisible(true);
    this.clientLabel.setText('Клиент ожидает').setVisible(true);
    this.noClientText.setVisible(false);

    this.updateDeliverButton();

    const bonusTime = (this.scene.upgrades.fasterBoots || 0) * 3;
    this.clientTimeLeft = Math.round(difficulty.clientTimerSec) + bonusTime;
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

  tickClientTimer() {
    if (this.scene.shiftPaused) return;
    this.clientTimeLeft--;
    this.scene.updateUI();

    if (this.clientTimeLeft <= 5) {
      this.scene.timerText.setColor('#ff0000');
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
    this.clientRect.setVisible(false);
    this.clientIdText.setVisible(false);
    this.clientLabel.setVisible(false);
    this.noClientText.setVisible(true);
    this.scene.selectedPackageId = null;
    this.deliverZone.setVisible(false);
    this.deliverText.setVisible(false);
    this.selectedLabel.setVisible(false);
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
    this.deliverZone.setVisible(!!show);
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
