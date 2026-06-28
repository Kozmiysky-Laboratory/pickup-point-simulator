import Phaser from 'phaser';
import { PreloadScene } from './scenes/PreloadScene.js';
import { BootScene } from './scenes/BootScene.js';
import { GameScene } from './scenes/GameScene.js';
import { ShopScene } from './scenes/ShopScene.js';

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
