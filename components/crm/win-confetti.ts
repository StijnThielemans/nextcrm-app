/** One short full-screen burst. Called from the win click, never from render. */

const COLORS = ["#e8c547", "#e07a5f", "#3d9b8f", "#8ecae6", "#f4f1de", "#f4a261", "#c9a0dc"];
const COUNT = 84;
const DURATION_MS = 1700;
const GRAVITY = 1400;

export type ConfettiPiece = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  w: number;
  h: number;
  rot: number;
  spin: number;
  color: string;
};

export function createWinPieces(
  width: number,
  height: number,
  random: () => number = Math.random,
): ConfettiPiece[] {
  const pieces: ConfettiPiece[] = [];
  for (let i = 0; i < COUNT; i += 1) {
    const rain = i % 3 === 0;
    const color = COLORS[i % COLORS.length] ?? COLORS[0];
    if (rain) {
      pieces.push({
        x: random() * width,
        y: -16 - random() * 80,
        vx: (random() - 0.5) * 140,
        vy: 90 + random() * 260,
        w: 6 + random() * 5,
        h: 9 + random() * 6,
        rot: random() * Math.PI,
        spin: (random() - 0.5) * 8,
        color,
      });
      continue;
    }
    const left = i % 2 === 0;
    const angle = -Math.PI / 2 + (random() - 0.5) * 1.15;
    const speed = 420 + random() * 480;
    const outward = left ? -1 : 1;
    pieces.push({
      x: width * (left ? 0.2 : 0.8) + (random() - 0.5) * 36,
      y: height * 0.58,
      vx: Math.cos(angle) * speed + outward * (90 + random() * 140),
      vy: Math.sin(angle) * speed,
      w: 6 + random() * 5,
      h: 8 + random() * 7,
      rot: random() * Math.PI,
      spin: (random() - 0.5) * 10,
      color,
    });
  }
  return pieces;
}

export function stepPiece(piece: ConfettiPiece, dt: number): ConfettiPiece {
  const drag = Math.exp(-0.45 * dt);
  return {
    ...piece,
    x: piece.x + piece.vx * dt,
    y: piece.y + piece.vy * dt,
    vx: piece.vx * drag,
    vy: piece.vy * drag + GRAVITY * dt,
    rot: piece.rot + piece.spin * dt,
  };
}

export function playWinConfetti(): void {
  if (typeof document === "undefined" || typeof window === "undefined") return;
  const canvas = document.createElement("canvas");
  canvas.setAttribute("data-win-confetti", "");
  canvas.setAttribute("aria-hidden", "true");
  canvas.style.position = "fixed";
  canvas.style.inset = "0";
  canvas.style.width = "100%";
  canvas.style.height = "100%";
  canvas.style.pointerEvents = "none";
  canvas.style.zIndex = "80";
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  document.body.appendChild(canvas);

  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const fit = () => {
    canvas.width = Math.floor(window.innerWidth * dpr);
    canvas.height = Math.floor(window.innerHeight * dpr);
  };
  fit();

  let pieces = createWinPieces(window.innerWidth, window.innerHeight);
  const started = performance.now();
  let last = started;

  const frame = (now: number) => {
    const elapsed = now - started;
    const dt = Math.min(0.032, (now - last) / 1000);
    last = now;
    const width = window.innerWidth;
    const height = window.innerHeight;
    if (canvas.width !== Math.floor(width * dpr) || canvas.height !== Math.floor(height * dpr)) fit();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);
    const fadeStart = DURATION_MS * 0.62;
    const fade = elapsed < fadeStart ? 1 : Math.max(0, 1 - (elapsed - fadeStart) / (DURATION_MS - fadeStart));
    ctx.globalAlpha = fade;
    pieces = pieces.map((piece) => stepPiece(piece, dt));
    for (const piece of pieces) {
      ctx.save();
      ctx.translate(piece.x, piece.y);
      ctx.rotate(piece.rot);
      ctx.fillStyle = piece.color;
      ctx.fillRect(-piece.w / 2, -piece.h / 2, piece.w, piece.h);
      ctx.restore();
    }
    ctx.globalAlpha = 1;
    if (elapsed < DURATION_MS) requestAnimationFrame(frame);
    else canvas.remove();
  };
  requestAnimationFrame(frame);
}
