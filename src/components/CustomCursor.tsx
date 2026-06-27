import React, { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  alpha: number;
  size: number;
};

export const CustomCursor: React.FC = () => {
  const location = useLocation();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Mouse coords
  const mouseRef = useRef({ x: -100, y: -100 });
  const smoothedMouseRef = useRef({ x: -100, y: -100 });
  
  // Hover & Snap states
  const [isHovering, setIsHovering] = useState<boolean>(false);
  const [hoverScale, setHoverScale] = useState<number>(1);
  const snapTargetRef = useRef<DOMRect | null>(null);

  // Trail history
  const trailHistoryRef = useRef<{ x: number; y: number }[]>([]);
  const particlesRef = useRef<Particle[]>([]);

  // Choose neon color based on route
  const getCursorColor = (): string => {
    const path = location.pathname;
    if (path.includes('cloak')) return '#ff007f'; // neon pink
    if (path.includes('drawing')) return '#00f0ff'; // neon blue
    if (path.includes('hunter')) return '#39ff14'; // neon green
    if (path.includes('rps')) return '#ff007f'; // neon pink
    if (path.includes('avengers')) return '#b026ff'; // neon purple
    if (path.includes('effects')) return '#ff5f00'; // neon orange
    if (path.includes('puzzle')) return '#00f0ff'; // neon blue
    return '#00f0ff'; // Default neon blue for homepage
  };

  const cursorColor = getCursorColor();

  // Detect touch devices
  const [isTouchDevice, setIsTouchDevice] = useState<boolean>(false);

  useEffect(() => {
    const checkTouch = () => {
      const match = window.matchMedia('(pointer: coarse)').matches || ('ontouchstart' in window);
      setIsTouchDevice(match);
    };
    checkTouch();
  }, []);

  useEffect(() => {
    if (isTouchDevice) return;

    // Track mouse coords
    const handleMouseMove = (e: MouseEvent) => {
      let x = e.clientX;
      let y = e.clientY;

      // Magnetic hover detection
      const target = e.target as HTMLElement;
      const hoverNode = target.closest('button, a, [role="button"], .hover-target');

      if (hoverNode) {
        setIsHovering(true);
        const rect = hoverNode.getBoundingClientRect();
        snapTargetRef.current = rect;
        
        // Snap slightly towards button center (magnetic lerp)
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        x = x + (cx - x) * 0.35;
        y = y + (cy - y) * 0.35;
        
        setHoverScale(2.2);
      } else {
        setIsHovering(false);
        snapTargetRef.current = null;
        setHoverScale(1.0);
      }

      mouseRef.current = { x, y };
    };

    const handleMouseDown = () => {
      // Spawn particle burst
      const targetX = smoothedMouseRef.current.x;
      const targetY = smoothedMouseRef.current.y;
      
      for (let i = 0; i < 15; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 1.5 + Math.random() * 3.5;
        particlesRef.current.push({
          x: targetX,
          y: targetY,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          alpha: 1.0,
          size: 1.5 + Math.random() * 2
        });
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mousedown', handleMouseDown);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mousedown', handleMouseDown);
    };
  }, [isTouchDevice]);

  // Main Canvas Rendering Loop
  useEffect(() => {
    if (isTouchDevice) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    let animationId: number;

    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Lerp mouse coordinate for smooth motion
      const targetX = mouseRef.current.x;
      const targetY = mouseRef.current.y;
      const currentX = smoothedMouseRef.current.x;
      const currentY = smoothedMouseRef.current.y;

      // Elastic smoothing interpolation
      const nextX = currentX + (targetX - currentX) * 0.22;
      const nextY = currentY + (targetY - currentY) * 0.22;
      smoothedMouseRef.current = { x: nextX, y: nextY };

      // Update trail history
      const history = trailHistoryRef.current;
      history.push({ x: nextX, y: nextY });
      if (history.length > 20) {
        history.shift();
      }

      // Draw Cursor Trail (Smooth Bezier)
      if (history.length > 1) {
        ctx.save();
        ctx.shadowBlur = 10;
        ctx.shadowColor = cursorColor;
        ctx.lineWidth = 2.5;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        for (let i = 1; i < history.length; i++) {
          const ratio = i / history.length;
          ctx.strokeStyle = cursorColor;
          ctx.globalAlpha = ratio * 0.45; // trail fades towards tail
          ctx.lineWidth = ratio * 3.5;

          ctx.beginPath();
          ctx.moveTo(history[i - 1].x, history[i - 1].y);
          ctx.lineTo(history[i].x, history[i].y);
          ctx.stroke();
        }
        ctx.restore();
      }

      // Render Burst Particles
      const particles = particlesRef.current;
      const remainingParticles: Particle[] = [];

      ctx.save();
      particles.forEach(p => {
        p.x += p.vx;
        p.y += p.vy;
        p.alpha -= 0.04;
        
        if (p.alpha > 0) {
          ctx.fillStyle = cursorColor;
          ctx.shadowBlur = 8;
          ctx.shadowColor = cursorColor;
          ctx.globalAlpha = p.alpha;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();
          remainingParticles.push(p);
        }
      });
      particlesRef.current = remainingParticles;
      ctx.restore();

      // Draw glowing central reticle dot
      ctx.save();
      ctx.shadowBlur = isHovering ? 15 : 8;
      ctx.shadowColor = cursorColor;
      ctx.fillStyle = cursorColor;

      ctx.beginPath();
      // Scales dot size during magnetic snappings
      const dotRadius = isHovering ? 10 * hoverScale : 5;
      ctx.arc(nextX, nextY, dotRadius, 0, Math.PI * 2);
      ctx.fill();

      // Outer rings if hovering
      if (isHovering) {
        ctx.strokeStyle = cursorColor;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(nextX, nextY, 15 * hoverScale, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();

      animationId = requestAnimationFrame(render);
    };

    animationId = requestAnimationFrame(render);

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      cancelAnimationFrame(animationId);
    };
  }, [isTouchDevice, cursorColor, isHovering, hoverScale]);

  // Render nothing on touch screens to allow normal tap gestures
  if (isTouchDevice) return null;

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none fixed inset-0 z-[9999] hidden sm:block"
    />
  );
};
export default CustomCursor;
