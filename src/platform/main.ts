// Browser entry point (the shell). For now this just paints a blank canvas so
// `npm run dev` serves something; the fixed-step loop + real renderer arrive in T1.3.
// All game logic lives in the pure sim core — nothing here may leak into sim/.

const canvas = document.getElementById('gameCanvas') as HTMLCanvasElement | null;
if (!canvas) throw new Error('gameCanvas element not found');

const ctx = canvas.getContext('2d');
if (!ctx) throw new Error('2D canvas context unavailable');

function resize(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D): void {
  const dpr = Math.min(window.devicePixelRatio || 1, 2); // cap dPR per design §17
  canvas.width = Math.floor(canvas.clientWidth * dpr);
  canvas.height = Math.floor(canvas.clientHeight * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, canvas.clientWidth, canvas.clientHeight);
}

resize(canvas, ctx);
window.addEventListener('resize', () => resize(canvas, ctx));
