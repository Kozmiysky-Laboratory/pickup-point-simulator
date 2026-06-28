import Phaser from 'phaser';

export class BootScene extends Phaser.Scene {
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
