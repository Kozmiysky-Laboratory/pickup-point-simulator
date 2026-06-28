import Phaser from 'phaser';

export class PreloadScene extends Phaser.Scene {
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
