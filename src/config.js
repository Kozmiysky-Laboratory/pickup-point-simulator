import Phaser from 'phaser';

export const BASE = {
  SHELF_ROWS: ['A', 'B', 'C'],
  SHELF_COLS: [1, 2, 3, 4],
  CLIENT_TIMER_SEC: 20,
  SPAWN_MIN_MS: 5000,
  SPAWN_MAX_MS: 10000,
  REWARD_COINS: 10,
  PENALTY_COINS: 5,
  SHIFT_DURATION_SEC: 90,
  INITIAL_PACKAGE_MIN: 6,
  INITIAL_PACKAGE_MAX: 10,
  EXISTING_ID_CHANCE: 0.7,
};

export const COLORS = {
  CLIENT: [0x3498db, 0xe67e22, 0x9b59b6, 0x1abc9c, 0xf39c12],
  PKG_DEFAULT: 0xc0392b,
  PKG_BORDER: 0x922b21,
  PKG_HOVER: 0xe74c3c,
  PKG_SELECTED: 0x2980b9,
  PKG_HIGHLIGHT: 0x27ae60,
  SHELF: 0xdec9a4,
  SHELF_BORDER: 0x8b7355,
  TOP_BAR: 0x16213e,
  BTN: 0x0f3460,
  BTN_ACTIVE: 0x533483,
  DESK: 0x8b4513,
  ACCENT: 0xe94560,
  SUCCESS: 0x2ecc71,
  OVERLAY: 0x000000,
};

export const UPGRADES = {
  FASTER_BOOTS: {
    id: 'fasterBoots',
    name: 'Быстрые ботинки',
    desc: 'Клиент ждёт на 3с дольше',
    baseCost: 30,
    costMultiplier: 1.8,
    maxLevel: 5,
  },
  SORT_ASSIST: {
    id: 'sortAssist',
    name: 'Авто-подсветка',
    desc: 'Подсветка нужной полки на 3с',
    baseCost: 50,
    costMultiplier: 2.0,
    maxLevel: 3,
  },
  WAREHOUSE_EXPANSION: {
    id: 'warehouseExpansion',
    name: 'Расширение склада',
    desc: 'Добавляет ряд полок (D, E...)',
    baseCost: 80,
    costMultiplier: 2.5,
    maxLevel: 3,
  },
  HIRE_ASSISTANT: {
    id: 'hireAssistant',
    name: 'Помощник',
    desc: 'Авто-выдаёт каждого 4-го клиента',
    baseCost: 100,
    costMultiplier: 2.0,
    maxLevel: 3,
  },
};

export function getDifficultyForDay(day) {
  const spawnFactor = Math.max(0.4, 1 - (day - 1) * 0.08);
  const timerPenalty = Math.min((day - 1) * 1.5, 8);
  const extraPackages = Math.min((day - 1) * 2, 10);
  return {
    spawnMinMs: Math.round(BASE.SPAWN_MIN_MS * spawnFactor),
    spawnMaxMs: Math.round(BASE.SPAWN_MAX_MS * spawnFactor),
    clientTimerSec: Math.max(8, BASE.CLIENT_TIMER_SEC - timerPenalty),
    extraDecoyPackages: Math.round(extraPackages),
  };
}

export function getUpgradeCost(upgrade, currentLevel) {
  return Math.round(upgrade.baseCost * Math.pow(upgrade.costMultiplier, currentLevel));
}

export function randomId(rows) {
  const row = rows[Phaser.Math.Between(0, rows.length - 1)];
  const num = Phaser.Math.Between(100, 199);
  return `${row}-${num}`;
}
