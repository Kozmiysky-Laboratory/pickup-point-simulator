import Phaser from 'phaser';
import { UPGRADES, getUpgradeCost, COLORS } from '../config.js';

export class ShopScene extends Phaser.Scene {
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
