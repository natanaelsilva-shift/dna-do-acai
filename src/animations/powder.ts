// Nuvem de leite em pó em canvas 2D. Partículas finas, claras e com leve
// desfoque — nada de formas ilustradas. O loop só roda enquanto há partícula
// viva ou poeira suspensa em tela; fora disso o rAF para.

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  life: number;
  maxLife: number;
  alpha: number;
  suspended: boolean;
};

export type PowderField = {
  burst: (originX: number, originY: number, count: number) => void;
  suspend: (count: number) => void;
  setVisible: (visible: boolean) => void;
  destroy: () => void;
};

export function createPowderField(canvas: HTMLCanvasElement): PowderField {
  const context = canvas.getContext("2d");
  const particles: Particle[] = [];
  let frame = 0;
  let visible = true;
  let width = 0;
  let height = 0;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);

  function resize() {
    const rect = canvas.getBoundingClientRect();
    width = rect.width;
    height = rect.height;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    context?.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  const observer = new ResizeObserver(resize);
  observer.observe(canvas);
  resize();

  function tick() {
    frame = 0;

    if (!context || !visible) {
      return;
    }

    context.clearRect(0, 0, width, height);

    for (let index = particles.length - 1; index >= 0; index -= 1) {
      const particle = particles[index];
      particle.life += 1;

      if (particle.suspended) {
        particle.x += particle.vx + Math.sin(particle.life / 70 + particle.r) * 0.08;
        particle.y += particle.vy;
        if (particle.y < -10) particle.y = height + 10;
      } else {
        particle.vx *= 0.985;
        particle.vy = Math.min(particle.vy + 0.035, 2.2);
        particle.x += particle.vx;
        particle.y += particle.vy;
      }

      const fadeIn = Math.min(particle.life / 18, 1);
      const fadeOut = particle.suspended
        ? 1
        : Math.max(1 - particle.life / particle.maxLife, 0);
      const alpha = particle.alpha * fadeIn * fadeOut;

      if (!particle.suspended && particle.life >= particle.maxLife) {
        particles.splice(index, 1);
        continue;
      }

      context.beginPath();
      context.fillStyle = `rgba(250, 244, 232, ${alpha})`;
      context.arc(particle.x, particle.y, particle.r, 0, Math.PI * 2);
      context.fill();
    }

    if (particles.length > 0) {
      frame = requestAnimationFrame(tick);
    }
  }

  function schedule() {
    if (!frame && visible) {
      frame = requestAnimationFrame(tick);
    }
  }

  return {
    burst(originX, originY, count) {
      for (let index = 0; index < count; index += 1) {
        const spread = (Math.random() - 0.5) * 2;
        particles.push({
          x: originX * width + spread * width * 0.06,
          y: originY * height + Math.random() * 12,
          vx: spread * 1.4,
          vy: -Math.random() * 1.6,
          r: 0.6 + Math.random() * 1.6,
          life: 0,
          maxLife: 90 + Math.random() * 90,
          alpha: 0.35 + Math.random() * 0.5,
          suspended: false,
        });
      }
      schedule();
    },
    suspend(count) {
      for (let index = 0; index < count; index += 1) {
        particles.push({
          x: Math.random() * width,
          y: Math.random() * height,
          vx: (Math.random() - 0.5) * 0.12,
          vy: -0.05 - Math.random() * 0.12,
          r: 0.5 + Math.random() * 1.1,
          life: 0,
          maxLife: Infinity,
          alpha: 0.12 + Math.random() * 0.25,
          suspended: true,
        });
      }
      schedule();
    },
    setVisible(nextVisible) {
      visible = nextVisible;
      if (visible) {
        schedule();
      } else if (frame) {
        cancelAnimationFrame(frame);
        frame = 0;
      }
    },
    destroy() {
      if (frame) cancelAnimationFrame(frame);
      observer.disconnect();
      particles.length = 0;
    },
  };
}
