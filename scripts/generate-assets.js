/**
 * Generates placeholder app icon and splash screen PNGs.
 * Run once: node scripts/generate-assets.js
 * Replace with production assets before App Store submission.
 *
 * Requires: npm install -g canvas  (or: npm install canvas --save-dev)
 */

const { createCanvas } = require('canvas');
const fs = require('fs');
const path = require('path');

const OUT = path.join(__dirname, '..', 'assets');

// ── Design tokens ──────────────────────────────────────────────────────────────
const BG = '#0A0A0F';
const BLUE = '#3B82F6';
const BLUE_LIGHT = 'rgba(59,130,246,0.15)';
const TEXT = '#F0F0F8';

function drawIcon(canvas) {
  const ctx = canvas.getContext('2d');
  const w = canvas.width;

  // Background
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, w, w);

  // Rounded rect card
  const pad = w * 0.15;
  const r = w * 0.22;
  ctx.beginPath();
  ctx.roundRect(pad, pad, w - pad * 2, w - pad * 2, r);
  ctx.fillStyle = '#16161F';
  ctx.fill();
  ctx.strokeStyle = BLUE + '50';
  ctx.lineWidth = w * 0.02;
  ctx.stroke();

  // "T" letter
  ctx.fillStyle = BLUE;
  ctx.font = `bold ${w * 0.42}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('T', w / 2, w / 2 + w * 0.02);
}

function drawSplash(canvas) {
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;

  // Background
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, w, h);

  // Subtle glow
  const grad = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w * 0.6);
  grad.addColorStop(0, 'rgba(59,130,246,0.08)');
  grad.addColorStop(1, 'transparent');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  // Icon card
  const iconSize = w * 0.28;
  const ix = (w - iconSize) / 2;
  const iy = h / 2 - iconSize * 0.8;
  ctx.beginPath();
  ctx.roundRect(ix, iy, iconSize, iconSize, iconSize * 0.22);
  ctx.fillStyle = '#16161F';
  ctx.fill();
  ctx.strokeStyle = BLUE + '60';
  ctx.lineWidth = 3;
  ctx.stroke();

  // T letter in icon
  ctx.fillStyle = BLUE;
  ctx.font = `bold ${iconSize * 0.5}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('T', w / 2, iy + iconSize / 2);

  // App name
  ctx.fillStyle = TEXT;
  ctx.font = `bold ${w * 0.09}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText('TibFit', w / 2, iy + iconSize + iconSize * 0.22);

  // Tagline
  ctx.fillStyle = 'rgba(240,240,248,0.4)';
  ctx.font = `${w * 0.045}px sans-serif`;
  ctx.fillText('Coach sportif IA', w / 2, iy + iconSize + iconSize * 0.22 + w * 0.12);
}

function save(canvas, filename) {
  const buffer = canvas.toBuffer('image/png');
  fs.writeFileSync(path.join(OUT, filename), buffer);
  console.log(`✓ ${filename} (${canvas.width}×${canvas.height})`);
}

// Icon 1024×1024
const icon = createCanvas(1024, 1024);
drawIcon(icon);
save(icon, 'icon.png');

// Adaptive icon (Android) 1024×1024
save(icon, 'adaptive-icon.png');

// Splash 1284×2778 (iPhone 14 Pro Max)
const splash = createCanvas(1284, 2778);
drawSplash(splash);
save(splash, 'splash.png');

console.log('\nAssets générés dans mobile/assets/');
console.log('Remplacez-les par vos visuels finaux avant la soumission App Store.');
