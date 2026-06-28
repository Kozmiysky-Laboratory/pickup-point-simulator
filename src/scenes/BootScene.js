import Phaser from 'phaser';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  create() {
    const bg = this.add.rectangle(450, 300, 900, 600, 0x1a1a2e);
    const title = this.add.text(450, 220, 'Симулятор ПВЗ', {
      fontSize: '48px',
      fontFamily: 'Arial, sans-serif',
      color: '#e94560',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    const subtitle = this.add.text(450, 280, 'Pickup Point Simulator', {
      fontSize: '20px',
      fontFamily: 'Arial, sans-serif',
      color: '#ffffff',
    }).setOrigin(0.5);

    const startBtn = this.add.rectangle(450, 380, 200, 50, 0xe94560, 1)
      .setInteractive({ useHandCursor: true });
    const startText = this.add.text(450, 380, 'ИГРАТЬ', {
      fontSize: '22px',
      fontFamily: 'Arial, sans-serif',
      color: '#ffffff',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    startBtn.on('pointerover', () => startBtn.setFillStyle(0xff6b6b));
    startBtn.on('pointerout', () => startBtn.setFillStyle(0xe94560));
    startBtn.on('pointerdown', () => {
      this.scene.start('GameScene');
    });
  }
}
