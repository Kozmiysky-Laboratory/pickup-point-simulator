import Phaser from 'phaser';
import { COLORS, randomId } from '../config.js';

export class WarehouseManager {
  constructor(scene) {
    this.scene = scene;
    this.shelves = [];
    this.packages = new Map();
    this.highlightTimers = [];
  }

  createWarehouseView(container, shelfRows, shelfCols) {
    this.container = container;
    const s = this.scene;

    const label = s.add.text(450, 70, 'СКЛАД', {
      fontSize: '22px', fontFamily: 'Arial', color: '#16213e', fontStyle: 'bold',
    }).setOrigin(0.5);
    container.add(label);

    this.requestText = s.add.text(450, 100, '', {
      fontSize: '18px', fontFamily: 'Arial', color: '#e94560', fontStyle: 'bold',
      backgroundColor: '#fff5f5', padding: { x: 8, y: 4 },
    }).setOrigin(0.5);
    container.add(this.requestText);

    this.buildGrid(shelfRows, shelfCols);
  }

  buildGrid(shelfRows, shelfCols) {
    // Remove old shelf graphics
    for (const shelf of this.shelves) {
      shelf.bg.destroy();
      shelf.label.destroy();
    }
    this.shelves = [];

    const totalRows = shelfRows.length;
    const totalCols = shelfCols.length;
    const maxH = 400;
    const cellH = Math.min(120, Math.floor(maxH / totalRows));
    const cellW = 160;
    const gridWidth = totalCols * cellW;
    const startX = 450 - gridWidth / 2 + cellW / 2;
    const startY = 175;

    for (let r = 0; r < totalRows; r++) {
      for (let c = 0; c < totalCols; c++) {
        const x = startX + c * cellW;
        const y = startY + r * cellH;
        const shelfId = `${shelfRows[r]}${shelfCols[c]}`;

        const bg = this.scene.add.rectangle(x, y, cellW - 10, cellH - 10, COLORS.SHELF)
          .setStrokeStyle(2, COLORS.SHELF_BORDER);
        this.container.add(bg);

        const label = this.scene.add.text(x, y - (cellH / 2 - 15), shelfId, {
          fontSize: '14px', fontFamily: 'Arial', color: '#555555', fontStyle: 'bold',
        }).setOrigin(0.5);
        this.container.add(label);

        this.shelves.push({ id: shelfId, x, y, bg, label, packageObj: null });
      }
    }
  }

  populateWarehouse(shelfRows, minPkg, maxPkg, extraDecoy) {
    this.clearPackages();

    const baseCount = Phaser.Math.Between(minPkg, maxPkg);
    const count = baseCount + extraDecoy;
    const available = Phaser.Utils.Array.Shuffle([...this.shelves]);
    const used = available.slice(0, Math.min(count, available.length));

    for (const shelf of used) {
      this.addPackageToShelf(shelf, randomId(shelfRows));
    }
  }

  addPackageToShelf(shelf, pkgId) {
    if (this.packages.has(pkgId)) return;

    const s = this.scene;
    const rect = s.add.rectangle(shelf.x, shelf.y + 5, 60, 40, COLORS.PKG_DEFAULT)
      .setInteractive({ useHandCursor: true })
      .setStrokeStyle(2, COLORS.PKG_BORDER);
    const text = s.add.text(shelf.x, shelf.y + 5, pkgId, {
      fontSize: '12px', fontFamily: 'Arial', color: '#ffffff', fontStyle: 'bold',
    }).setOrigin(0.5);

    this.container.add(rect);
    this.container.add(text);

    rect.on('pointerover', () => rect.setFillStyle(COLORS.PKG_HOVER));
    rect.on('pointerout', () => {
      rect.setFillStyle(s.selectedPackageId === pkgId ? COLORS.PKG_SELECTED : COLORS.PKG_DEFAULT);
    });
    rect.on('pointerdown', () => s.selectPackage(pkgId, rect));

    const pkg = { id: pkgId, rect, text, shelf };
    shelf.packageObj = pkg;
    this.packages.set(pkgId, pkg);
  }

  removePackage(pkgId) {
    const pkg = this.packages.get(pkgId);
    if (pkg) {
      pkg.rect.destroy();
      pkg.text.destroy();
      pkg.shelf.packageObj = null;
      this.packages.delete(pkgId);
    }
  }

  addRandomPackages(count, shelfRows) {
    const emptyShelves = this.shelves.filter((s) => !s.packageObj);
    const toFill = Phaser.Utils.Array.Shuffle(emptyShelves)
      .slice(0, Math.min(count, emptyShelves.length));

    for (const shelf of toFill) {
      const pkgId = randomId(shelfRows);
      this.addPackageToShelf(shelf, pkgId);
    }
  }

  clearPackages() {
    this.packages.forEach((pkg) => {
      pkg.rect.destroy();
      pkg.text.destroy();
      if (pkg.shelf) pkg.shelf.packageObj = null;
    });
    this.packages.clear();
  }

  updateRequestText(text) {
    if (text) {
      this.requestText.setText(`Клиент ждёт: ${text}`);
    } else {
      this.requestText.setText('');
    }
  }

  resetHighlights() {
    this.packages.forEach((pkg) => {
      pkg.rect.setFillStyle(COLORS.PKG_DEFAULT);
    });
    for (const timer of this.highlightTimers) {
      timer.destroy();
    }
    this.highlightTimers = [];
  }

  highlightShelfForPackage(pkgId) {
    const pkg = this.packages.get(pkgId);
    if (!pkg) return;

    const shelf = pkg.shelf;
    shelf.bg.setStrokeStyle(4, COLORS.PKG_HIGHLIGHT);

    const duration = 3000 + (this.scene.upgrades.sortAssist - 1) * 1500;
    const timer = this.scene.time.delayedCall(duration, () => {
      shelf.bg.setStrokeStyle(2, COLORS.SHELF_BORDER);
    });
    this.highlightTimers.push(timer);
  }

  destroy() {
    this.clearPackages();
    for (const timer of this.highlightTimers) {
      timer.destroy();
    }
    this.highlightTimers = [];
  }
}
