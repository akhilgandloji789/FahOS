'use strict';
const { ipcRenderer } = require('electron');

const canvas = document.getElementById('backdropCanvas');
const ctx = canvas.getContext('2d');
const actionToolbar = document.getElementById('actionToolbar');
const dimensionLabel = document.getElementById('dimensionLabel');
const confirmBtn = document.getElementById('confirmBtn');
const cancelBtn = document.getElementById('cancelBtn');
const instructionBar = document.getElementById('instructionBar');

let isDragging = false;
let startX = 0;
let startY = 0;
let currentX = 0;
let currentY = 0;
let selectedRect = null;

function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  draw();
}

window.addEventListener('resize', resizeCanvas);
window.addEventListener('DOMContentLoaded', resizeCanvas);

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Fill entire screen with semi-transparent dark backdrop
  ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  if (selectedRect && selectedRect.width > 2 && selectedRect.height > 2) {
    // Cutout transparent area for selected region
    ctx.clearRect(selectedRect.x, selectedRect.y, selectedRect.width, selectedRect.height);

    // Neon / Emerald border around selected area
    ctx.strokeStyle = '#10B981';
    ctx.lineWidth = 2;
    ctx.setLineDash([]);
    ctx.strokeRect(selectedRect.x, selectedRect.y, selectedRect.width, selectedRect.height);

    // Subtle corner guides
    const cornerSize = 8;
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(selectedRect.x - 2, selectedRect.y - 2, cornerSize, 2);
    ctx.fillRect(selectedRect.x - 2, selectedRect.y - 2, 2, cornerSize);
    ctx.fillRect(selectedRect.x + selectedRect.width - cornerSize + 2, selectedRect.y - 2, cornerSize, 2);
    ctx.fillRect(selectedRect.x + selectedRect.width, selectedRect.y - 2, 2, cornerSize);
  }
}

window.addEventListener('mousedown', (e) => {
  // If clicking inside toolbar, ignore
  if (e.target.closest('#actionToolbar')) return;

  isDragging = true;
  startX = e.clientX;
  startY = e.clientY;
  currentX = e.clientX;
  currentY = e.clientY;
  selectedRect = null;
  actionToolbar.style.display = 'none';
  instructionBar.style.opacity = '0.3';
  draw();
});

window.addEventListener('mousemove', (e) => {
  if (!isDragging) return;

  currentX = e.clientX;
  currentY = e.clientY;

  const x = Math.min(startX, currentX);
  const y = Math.min(startY, currentY);
  const width = Math.abs(currentX - startX);
  const height = Math.abs(currentY - startY);

  selectedRect = { x, y, width, height };
  draw();
});

window.addEventListener('mouseup', (e) => {
  if (!isDragging) return;
  isDragging = false;
  instructionBar.style.opacity = '1';

  if (!selectedRect || selectedRect.width < 10 || selectedRect.height < 10) {
    selectedRect = null;
    actionToolbar.style.display = 'none';
    draw();
    return;
  }

  // Show action toolbar below selection
  dimensionLabel.textContent = `${Math.round(selectedRect.width)} × ${Math.round(selectedRect.height)}`;
  actionToolbar.style.display = 'flex';

  // Position toolbar right below bottom-right or inside if near window edge
  let tbX = selectedRect.x + selectedRect.width - actionToolbar.offsetWidth;
  let tbY = selectedRect.y + selectedRect.height + 10;

  if (tbX < 10) tbX = 10;
  if (tbX + actionToolbar.offsetWidth > window.innerWidth - 10) {
    tbX = window.innerWidth - actionToolbar.offsetWidth - 10;
  }
  if (tbY + actionToolbar.offsetHeight > window.innerHeight - 10) {
    tbY = selectedRect.y - actionToolbar.offsetHeight - 10;
  }
  if (tbY < 10) tbY = selectedRect.y + 10;

  actionToolbar.style.left = `${tbX}px`;
  actionToolbar.style.top = `${tbY}px`;
});

function confirmSelection() {
  if (!selectedRect || selectedRect.width < 5 || selectedRect.height < 5) return;
  // Send logical (CSS) pixel coordinates directly — the crop function
  // in visualAgent.js works in raw screen pixels, and Electron's
  // BrowserWindow uses the same coordinate space as the renderer.
  const payload = {
    x: Math.round(selectedRect.x),
    y: Math.round(selectedRect.y),
    width: Math.round(selectedRect.width),
    height: Math.round(selectedRect.height),
    logicalBounds: {
      x: selectedRect.x,
      y: selectedRect.y,
      width: selectedRect.width,
      height: selectedRect.height
    }
  };
  ipcRenderer.send('fahos:confirmSnip', payload);
}

function cancelSelection() {
  ipcRenderer.send('fahos:cancelSnip');
}

confirmBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  confirmSelection();
});

cancelBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  cancelSelection();
});

window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    e.preventDefault();
    cancelSelection();
  } else if (e.key === 'Enter') {
    e.preventDefault();
    if (selectedRect) confirmSelection();
  }
});
