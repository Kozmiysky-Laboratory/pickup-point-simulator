export function showFloatingText(scene, x, y, message, color = '#ffd700') {
  const text = scene.add.text(x, y, message, {
    fontSize: '20px',
    fontFamily: 'Arial',
    color,
    fontStyle: 'bold',
    stroke: '#000000',
    strokeThickness: 3,
  }).setOrigin(0.5).setDepth(1000);

  scene.tweens.add({
    targets: text,
    y: y - 60,
    alpha: 0,
    duration: 1200,
    ease: 'Power2',
    onComplete: () => text.destroy(),
  });
}
