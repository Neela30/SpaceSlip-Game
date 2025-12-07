import { GAME_HEIGHT, GAME_WIDTH, STAR_COUNT, VISUAL_SCALE } from './constants';
import { getShapeSize } from './physics';

export const drawRoundedRect = (ctx, x, y, width, height, radius, fillStyle, strokeStyle) => {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
  ctx.fillStyle = fillStyle;
  ctx.fill();
  if (strokeStyle) {
    ctx.strokeStyle = strokeStyle;
    ctx.lineWidth = 2;
    ctx.stroke();
  }
};

export const createStarfield = () =>
  Array.from({ length: STAR_COUNT }, () => ({
    x: Math.random() * GAME_WIDTH,
    y: Math.random() * GAME_HEIGHT,
    depth: 0.5 + Math.random() * 1.5
  }));

export const drawStar = (ctx, { x, y, radius, rotation = 0, fill = '#ffd166', glow = 'rgba(255, 209, 102, 0.6)' }) => {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotation);
  ctx.beginPath();
  const spikes = 5;
  const inner = radius * 0.48;
  for (let i = 0; i < spikes; i++) {
    const outerAngle = (i * 2 * Math.PI) / spikes - Math.PI / 2;
    const innerAngle = outerAngle + Math.PI / spikes;
    ctx.lineTo(Math.cos(outerAngle) * radius, Math.sin(outerAngle) * radius);
    ctx.lineTo(Math.cos(innerAngle) * inner, Math.sin(innerAngle) * inner);
  }
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.shadowColor = glow;
  ctx.shadowBlur = 14;
  ctx.fill();
  ctx.restore();
};

export const renderShape = (ctx, { x, y, width, height, rotation, type, colors, alpha = 1, scale = 1 }) => {
  const [c1, c2] = colors;
  const size = Math.max(width, height);
  const cx = x + width / 2;
  const cy = y + height / 2;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate((rotation * Math.PI) / 180);
  ctx.scale(scale, scale);
  ctx.globalAlpha *= alpha;

  const drawRoundedRect = (x2, y2, w, h, radius, fillStyle, strokeStyle) => {
    ctx.beginPath();
    ctx.moveTo(x2 + radius, y2);
    ctx.lineTo(x2 + w - radius, y2);
    ctx.quadraticCurveTo(x2 + w, y2, x2 + w, y2 + radius);
    ctx.lineTo(x2 + w, y2 + h - radius);
    ctx.quadraticCurveTo(x2 + w, y2 + h, x2 + w - radius, y2 + h);
    ctx.lineTo(x2 + radius, y2 + h);
    ctx.quadraticCurveTo(x2, y2 + h, x2, y2 + h - radius);
    ctx.lineTo(x2, y2 + radius);
    ctx.quadraticCurveTo(x2, y2, x2 + radius, y2);
    ctx.closePath();
    ctx.fillStyle = fillStyle;
    ctx.fill();
    if (strokeStyle) {
      ctx.strokeStyle = strokeStyle;
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  };

  const drawSatellite = () => {
    const panelW = Math.max(28, size * 0.32);
    const panelH = Math.max(14, size * 0.16);
    const arm = Math.max(10, size * 0.1);
    const panelFill = ctx.createLinearGradient(-panelW, -panelH / 2, panelW, panelH / 2);
    panelFill.addColorStop(0, '#0a2440');
    panelFill.addColorStop(1, '#0d4c80');
    const panelStroke = 'rgba(120, 210, 255, 0.35)';
    drawRoundedRect(-panelW - arm, -panelH / 2, panelW, panelH, 6, panelFill, panelStroke);
    drawRoundedRect(arm, -panelH / 2, panelW, panelH, 6, panelFill, panelStroke);

    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.lineWidth = 1;
    [-6, 0, 6].forEach((yLine) => {
      ctx.beginPath();
      ctx.moveTo(-panelW - arm + 4, yLine);
      ctx.lineTo(-arm - 4, yLine);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(arm + 4, yLine);
      ctx.lineTo(panelW + arm - 4, yLine);
      ctx.stroke();
    });

    const bodyW = Math.max(26, size * 0.28);
    const bodyH = Math.max(26, size * 0.28);
    const bodyFill = ctx.createLinearGradient(-bodyW / 2, -bodyH / 2, bodyW / 2, bodyH / 2);
    bodyFill.addColorStop(0, c1);
    bodyFill.addColorStop(1, c2);
    drawRoundedRect(-bodyW / 2, -bodyH / 2, bodyW, bodyH, 8, bodyFill, 'rgba(255,255,255,0.25)');

    ctx.beginPath();
    ctx.strokeStyle = 'rgba(200,230,255,0.8)';
    ctx.lineWidth = 2;
    ctx.arc(0, -bodyH / 2 - 8, 10, Math.PI * 0.2, Math.PI * 0.8);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, -bodyH / 2);
    ctx.lineTo(0, -bodyH / 2 - 8);
    ctx.stroke();

    ctx.fillStyle = 'rgba(120,230,255,0.9)';
    ctx.fillRect(-4, -4, 2, 2);
    ctx.fillRect(2, -8, 2, 2);
    ctx.fillRect(6, 6, 2, 2);

    ctx.fillStyle = 'rgba(255,180,120,0.9)';
    ctx.beginPath();
    ctx.moveTo(-4, bodyH / 2);
    ctx.lineTo(0, bodyH / 2 + 12 + Math.sin(performance.now() / 80) * 2);
    ctx.lineTo(4, bodyH / 2);
    ctx.closePath();
    ctx.fill();
  };

  const drawPod = () => {
    const bodySize = size * 0.65;
    const radius = Math.max(8, bodySize * 0.18);
    const bodyFill = ctx.createLinearGradient(-bodySize / 2, -bodySize / 2, bodySize / 2, bodySize / 2);
    bodyFill.addColorStop(0, '#1a2744');
    bodyFill.addColorStop(1, '#2f8acb');
    drawRoundedRect(-bodySize / 2, -bodySize / 2, bodySize, bodySize, radius, bodyFill, 'rgba(255,255,255,0.2)');
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 6]);
    ctx.strokeRect(-bodySize / 2 + 6, -bodySize / 2 + 6, bodySize - 12, bodySize - 12);
    ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(120,230,255,0.9)';
    ctx.fillRect(-4, -4, 3, 3);
    ctx.fillRect(2, 2, 3, 3);
  };

  const drawProbe = () => {
    const orbR = size * 0.34;
    const orbFill = ctx.createRadialGradient(0, 0, orbR * 0.3, 0, 0, orbR);
    orbFill.addColorStop(0, '#9edcff');
    orbFill.addColorStop(1, '#3a4f6f');
    ctx.beginPath();
    ctx.arc(0, 0, orbR, 0, Math.PI * 2);
    ctx.fillStyle = orbFill;
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.strokeStyle = 'rgba(120, 230, 255, 0.7)';
    ctx.lineWidth = 3;
    const armLen = orbR * 1.6;
    [0, 120, 240].forEach((deg) => {
      const rad = (deg * Math.PI) / 180;
      ctx.beginPath();
      ctx.moveTo(Math.cos(rad) * (orbR * 0.6), Math.sin(rad) * (orbR * 0.6));
      ctx.lineTo(Math.cos(rad) * armLen, Math.sin(rad) * armLen);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(Math.cos(rad) * armLen, Math.sin(rad) * armLen, 6, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(100,210,255,0.8)';
      ctx.fill();
    });
  };

  const drawRocket = () => {
    const bodyH = Math.max(size * 0.9, 70);
    const bodyW = Math.max(size * 0.45, 28);
    const noseH = bodyH * 0.25;
    const finH = bodyH * 0.18;
    const finW = bodyW * 0.65;

    ctx.fillStyle = '#22314f';
    ctx.beginPath();
    ctx.moveTo(-bodyW / 2, bodyH / 2);
    ctx.lineTo(-bodyW / 2 - finW, bodyH / 2 + finH);
    ctx.lineTo(-bodyW / 2, bodyH / 2 + finH * 0.2);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(bodyW / 2, bodyH / 2);
    ctx.lineTo(bodyW / 2 + finW, bodyH / 2 + finH);
    ctx.lineTo(bodyW / 2, bodyH / 2 + finH * 0.2);
    ctx.closePath();
    ctx.fill();

    const bodyFill = ctx.createLinearGradient(0, -bodyH / 2, 0, bodyH / 2);
    bodyFill.addColorStop(0, '#1b2a46');
    bodyFill.addColorStop(1, '#3ad2ff');
    drawRoundedRect(-bodyW / 2, -bodyH / 2, bodyW, bodyH, 14, bodyFill, 'rgba(255,255,255,0.18)');

    ctx.fillStyle = 'rgba(255, 184, 94, 0.9)';
    ctx.beginPath();
    ctx.moveTo(-bodyW / 4, bodyH / 2);
    ctx.lineTo(0, bodyH / 2 + 18 + Math.sin(performance.now() / 90) * 2);
    ctx.lineTo(bodyW / 4, bodyH / 2);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = 'rgba(120,230,255,0.9)';
    ctx.beginPath();
    ctx.arc(0, -bodyH / 2 + noseH * 0.4, bodyW * 0.18, 0, Math.PI * 2);
    ctx.fill();
  };

  if (type === 'rectangle') {
    drawSatellite();
  } else if (type === 'square') {
    drawPod();
  } else if (type === 'circle') {
    drawProbe();
  } else {
    drawRocket();
  }

  ctx.restore();
};

export const drawTrail = (ctx, trail) => {
  ctx.save();
  trail.forEach((snap, idx) => {
    const alpha = 0.24 - idx * 0.02;
    if (alpha <= 0) return;
    const { width, height } = getShapeSize(snap.rotation, snap.type);
    renderShape(ctx, {
      x: snap.x,
      y: snap.y,
      width,
      height,
      rotation: snap.rotation,
      type: snap.type,
      colors: snap.colors,
      alpha,
      scale: (0.98 - idx * 0.02) * VISUAL_SCALE
    });
  });
  ctx.restore();
};

export const drawParticles = (ctx, particles) => {
  ctx.save();
  particles.forEach((p) => {
    p.life += 1;
    const lifeRatio = Math.max(0, 1 - p.life / p.maxLife);
    if (lifeRatio <= 0) return;
    ctx.globalAlpha = lifeRatio * 0.8;
    ctx.fillStyle = p.color;
    if (p.kind === 'shard') {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot || 0);
      ctx.fillRect(-p.size * 0.6, -p.size * 0.3, p.size * 1.2, p.size * 0.6);
      ctx.restore();
    } else {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * lifeRatio, 0, Math.PI * 2);
      ctx.fill();
    }
  });
  ctx.restore();
};
