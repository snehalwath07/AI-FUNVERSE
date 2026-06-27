import React, { useState, useEffect, useRef } from 'react';
import CameraManager from '../components/CameraManager';
import InstructionsPanel from '../components/InstructionsPanel';
import { useHandLandmarker } from '../hooks/useMediaPipe';
import { Heart, Trophy, RefreshCw, Zap, Play } from 'lucide-react';
import { playPop, playSpell, playGameOver } from '../utils/audio';
import { LandmarkSmoother, mapLandmark } from '../utils/tracking';

type Ball = {
  id: number;
  x: number;
  y: number;
  radius: number;
  speed: number;
  color: string;
  type: 'normal' | 'bomb' | 'star';
  pulse: number;
};

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  alpha: number;
  size: number;
};

type ScorePopup = {
  id: number;
  x: number;
  y: number;
  text: string;
  color: string;
  alpha: number;
};

type ScoreEntry = {
  score: number;
  date: string;
};

export const ColorBallHunter: React.FC = () => {
  const { model: handLandmarker, loading: modelLoading, error: modelError } = useHandLandmarker();

  // Game states
  const [gameState, setGameState] = useState<'idle' | 'playing' | 'gameover'>('idle');
  const [score, setScore] = useState<number>(0);
  const [lives, setLives] = useState<number>(5); // Upgraded to 5 lives for better gameplay
  const [combo, setCombo] = useState<number>(1);
  const [timeRemaining, setTimeRemaining] = useState<number>(60);
  const [leaderboard, setLeaderboard] = useState<ScoreEntry[]>([]);

  // Refs for tracking variables inside frame loop
  const ballsRef = useRef<Ball[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const popupsRef = useRef<ScorePopup[]>([]);
  
  const nextBallIdRef = useRef<number>(0);
  const nextPopupIdRef = useRef<number>(0);
  const lastSpawnTimeRef = useRef<number>(0);
  
  const scoreRef = useRef<number>(0);
  const comboRef = useRef<number>(1);
  const livesRef = useRef<number>(5);

  // Instantiating tracking smoother
  const smootherRef = useRef<LandmarkSmoother>(new LandmarkSmoother(0.25));

  // Sync refs with React state
  useEffect(() => {
    scoreRef.current = score;
  }, [score]);
  useEffect(() => {
    comboRef.current = combo;
  }, [combo]);
  useEffect(() => {
    livesRef.current = lives;
  }, [lives]);

  // Load leaderboard
  useEffect(() => {
    const saved = localStorage.getItem('aifun_hunter_leaderboard');
    if (saved) {
      setLeaderboard(JSON.parse(saved));
    }
  }, []);

  // Timer loop
  useEffect(() => {
    if (gameState !== 'playing') return;

    const interval = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          endGame();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [gameState]);

  const startGame = () => {
    playSpell();
    setScore(0);
    setLives(5);
    setCombo(1);
    setTimeRemaining(60);
    ballsRef.current = [];
    particlesRef.current = [];
    popupsRef.current = [];
    nextBallIdRef.current = 0;
    nextPopupIdRef.current = 0;
    lastSpawnTimeRef.current = performance.now();
    smootherRef.current.reset();
    setGameState('playing');
  };

  const endGame = () => {
    playGameOver();
    setGameState('gameover');
    
    const newScore: ScoreEntry = {
      score: scoreRef.current,
      date: new Date().toLocaleDateString()
    };
    
    setLeaderboard((prev) => {
      const updated = [...prev, newScore]
        .sort((a, b) => b.score - a.score)
        .slice(0, 5);
      localStorage.setItem('aifun_hunter_leaderboard', JSON.stringify(updated));
      return updated;
    });
  };

  const spawnBall = (width: number) => {
    const types: ('normal' | 'bomb' | 'star')[] = ['normal', 'normal', 'normal', 'normal', 'star', 'bomb'];
    const type = types[Math.floor(Math.random() * types.length)];
    
    let color = '#39ff14'; // green normal
    let radius = 22;
    let baseSpeed = 2.5 + Math.min(scoreRef.current / 200, 5.0); // difficulty scaling

    if (type === 'star') {
      color = '#00f0ff'; // blue star
      radius = 16;
      baseSpeed *= 1.35;
    } else if (type === 'bomb') {
      color = '#ff007f'; // pink bomb
      radius = 25;
      baseSpeed *= 0.85;
    }

    const newBall: Ball = {
      id: nextBallIdRef.current++,
      x: Math.random() * (width - 60) + 30,
      y: -30,
      radius,
      speed: baseSpeed + Math.random() * 1.5,
      color,
      type,
      pulse: 0
    };

    ballsRef.current.push(newBall);
  };

  const createParticles = (x: number, y: number, color: string) => {
    for (let i = 0; i < 15; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 2 + Math.random() * 5;
      particlesRef.current.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        color,
        alpha: 1,
        size: 2.0 + Math.random() * 3.5
      });
    }
  };

  const addScorePopup = (x: number, y: number, text: string, color: string) => {
    popupsRef.current.push({
      id: nextPopupIdRef.current++,
      x,
      y,
      text,
      color,
      alpha: 1.0
    });
  };

  const handleFrame = (video: HTMLVideoElement, canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D) => {
    const width = canvas.width;
    const height = canvas.height;

    // Retrieve hand landmarks
    let indexFingerCursor: { x: number; y: number } | null = null;
    
    if (handLandmarker) {
      const results = handLandmarker.detectForVideo(video, performance.now());
      if (results && results.landmarks && results.landmarks.length > 0) {
        const hand = results.landmarks[0];
        
        // Track strictly index fingertip (landmark 8)
        if (hand[8]) {
          const rawCoord = mapLandmark(hand[8], width, height, true);
          indexFingerCursor = smootherRef.current.smooth(rawCoord.x, rawCoord.y);
        }
      } else {
        smootherRef.current.reset();
      }
    }

    // 1. Spawning
    if (gameState === 'playing') {
      const now = performance.now();
      const spawnInterval = Math.max(500, 1600 - (scoreRef.current * 1.8)); // Spawns faster as score increases
      if (now - lastSpawnTimeRef.current > spawnInterval) {
        spawnBall(width);
        lastSpawnTimeRef.current = now;
      }
    }

    // 2. Collision & Physics Updates
    const remainingBalls: Ball[] = [];
    ballsRef.current.forEach((ball) => {
      ball.y += ball.speed;
      ball.pulse += 0.1;

      let popped = false;

      // Restrict collision checks strictly to the index fingertip cursor
      if (gameState === 'playing' && indexFingerCursor) {
        const d = Math.sqrt((ball.x - indexFingerCursor.x) ** 2 + (ball.y - indexFingerCursor.y) ** 2);
        if (d < ball.radius + 15) { // 15px bounding buffer
          popped = true;
        }
      }

      if (popped) {
        createParticles(ball.x, ball.y, ball.color);
        if (ball.type === 'normal') {
          playPop();
          const points = 10 * comboRef.current;
          setScore(prev => prev + points);
          addScorePopup(ball.x, ball.y, `+${points}`, '#39ff14');
          setCombo(prev => prev + 1);
        } else if (ball.type === 'star') {
          playSpell();
          const points = 30 * comboRef.current;
          setScore(prev => prev + points);
          addScorePopup(ball.x, ball.y, `+${points} Combo Double!`, '#00f0ff');
          setCombo(prev => prev + 2);
        } else if (ball.type === 'bomb') {
          playGameOver();
          setScore(prev => Math.max(0, prev - 50));
          addScorePopup(ball.x, ball.y, `-50`, '#ff007f');
          setCombo(1);
          setLives(prev => {
            const nextL = prev - 1;
            if (nextL <= 0) endGame();
            return nextL;
          });
        }
      } else if (ball.y > height + 30) {
        // Missing a ball costs combo and lives
        if (gameState === 'playing' && ball.type !== 'bomb') {
          setCombo(1);
          setLives(prev => {
            const nextL = prev - 1;
            if (nextL <= 0) endGame();
            return nextL;
          });
        }
      } else {
        remainingBalls.push(ball);
      }
    });
    ballsRef.current = remainingBalls;

    // Update Particles
    const remainingParticles: Particle[] = [];
    particlesRef.current.forEach(p => {
      p.x += p.vx;
      p.y += p.vy;
      p.alpha -= 0.025;
      if (p.alpha > 0) {
        remainingParticles.push(p);
      }
    });
    particlesRef.current = remainingParticles;

    // Update Floating Score Popups
    const remainingPopups: ScorePopup[] = [];
    popupsRef.current.forEach(popup => {
      popup.y -= 1.2; // Float upwards
      popup.alpha -= 0.02; // Fade out
      if (popup.alpha > 0) {
        remainingPopups.push(popup);
      }
    });
    popupsRef.current = remainingPopups;

    // 3. Drawing
    // Draw Balls
    ballsRef.current.forEach(ball => {
      ctx.save();
      ctx.shadowBlur = 15;
      ctx.shadowColor = ball.color;

      ctx.strokeStyle = ball.color;
      ctx.lineWidth = 3;
      ctx.beginPath();
      const pulseSize = Math.sin(ball.pulse) * 3;
      ctx.arc(ball.x, ball.y, ball.radius + pulseSize, 0, Math.PI * 2);
      ctx.stroke();

      const grad = ctx.createRadialGradient(ball.x, ball.y, 2, ball.x, ball.y, ball.radius);
      grad.addColorStop(0, 'rgba(255, 255, 255, 0.8)');
      grad.addColorStop(0.3, ball.color + '44');
      grad.addColorStop(1, 'rgba(0, 0, 0, 0.2)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
      ctx.fill();

      if (ball.type === 'bomb') {
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 12px Orbitron';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('X', ball.x, ball.y);
      } else if (ball.type === 'star') {
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 12px Orbitron';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('★', ball.x, ball.y);
      }
      ctx.restore();
    });

    // Draw Particles
    particlesRef.current.forEach(p => {
      ctx.save();
      ctx.fillStyle = p.color;
      ctx.globalAlpha = p.alpha;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });

    // Draw Floating Text Popups
    popupsRef.current.forEach(popup => {
      ctx.save();
      ctx.fillStyle = popup.color;
      ctx.globalAlpha = popup.alpha;
      ctx.font = 'bold 12px Orbitron';
      ctx.textAlign = 'center';
      ctx.fillText(popup.text, popup.x, popup.y);
      ctx.restore();
    });

    // Draw index-finger cursor and its combo aura
    if (indexFingerCursor) {
      ctx.save();
      
      // Draw combo aura ring
      const currentCombo = comboRef.current;
      if (currentCombo > 1) {
        ctx.shadowBlur = 15;
        ctx.shadowColor = '#00f0ff';
        ctx.strokeStyle = 'rgba(0, 240, 255, 0.7)';
        ctx.lineWidth = 2.0;
        
        // Aura expands based on combo size
        const auraRadius = 10 + Math.min(currentCombo * 1.5, 30);
        ctx.beginPath();
        ctx.arc(indexFingerCursor.x, indexFingerCursor.y, auraRadius, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Draw index tip cursor dot
      ctx.shadowBlur = 10;
      ctx.shadowColor = '#00f0ff';
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2.5;
      ctx.fillStyle = 'rgba(0, 240, 255, 0.6)';
      ctx.beginPath();
      ctx.arc(indexFingerCursor.x, indexFingerCursor.y, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.restore();
    }
  };

  const instructions = [
    "Raise your hand in front of the camera.",
    "Hover your index finger over falling colored balls to pop them.",
    "Pop green spheres for points and to build your combo.",
    "Pop blue stars for double points.",
    "Avoid pink bombs! Popping them resets combo and costs 1 life.",
    "If a green or blue sphere falls off the bottom, you lose 1 life.",
    "You have 5 lives. Try to survive for 60 seconds!"
  ];

  const gestures = [
    { gesture: "Index Fingertip", action: "Pop falling target spheres" },
    { gesture: "Combo Glow", action: "Sparkling ring expands around finger as combo grows" }
  ];

  const tips = [
    "Keep your index finger pointed straight up for the best camera tracking.",
    "Control your sweeps: moving in small horizontal paths is most effective.",
    "Only your index finger counts for popping; other fingers are ignored."
  ];

  return (
    <div className="min-h-[calc(100vh-80px)] py-8 px-4 flex flex-col items-center">
      <div className="max-w-6xl w-full flex flex-col gap-6">
        {/* Header */}
        <div className="text-center md:text-left">
          <h1 className="font-orbitron font-black text-3xl md:text-4xl tracking-wider bg-gradient-to-r from-neon-green via-neon-blue to-neon-purple bg-clip-text text-transparent glow-text-green">
            COLOR BALL HUNTER
          </h1>
          <p className="text-slate-400 text-sm font-outfit mt-1">
            Pop glowing targets with your fingertip.
          </p>
        </div>

        {/* Game Layout */}
        <div className="flex flex-col lg:flex-row gap-6 w-full items-start">
          {/* Left Column: Camera and HUD panel */}
          <div className="flex-1 flex flex-col gap-4 w-full">
            <CameraManager 
              modelLoading={modelLoading} 
              modelError={modelError} 
              onFrame={handleFrame}
            >
              {/* Game Start/Over HUD Screen */}
              {gameState === 'idle' && (
                <div className="absolute inset-0 bg-black/85 flex flex-col items-center justify-center p-6 text-center select-none pointer-events-auto">
                  <h3 className="font-orbitron font-black text-2xl text-neon-green tracking-wider glow-text-green mb-4 uppercase">
                    Popping Arena
                  </h3>
                  <button
                    onClick={startGame}
                    className="flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-neon-green to-neon-blue text-black font-orbitron font-black text-sm tracking-widest hover:scale-105 active:scale-95 transition-all cursor-pointer shadow-[0_0_15px_rgba(57,255,20,0.4)] hover-target"
                  >
                    <Play className="w-4 h-4 fill-black" />
                    START GAME
                  </button>
                </div>
              )}

              {gameState === 'gameover' && (
                <div className="absolute inset-0 bg-black/90 flex flex-col items-center justify-center p-6 text-center select-none pointer-events-auto">
                  <h3 className="font-orbitron font-black text-3xl text-red-500 tracking-wider mb-2">
                    GAME OVER
                  </h3>
                  <p className="font-orbitron text-slate-300 text-sm mb-6 uppercase">
                    Final Score: <span className="text-neon-green font-bold glow-text-green">{score}</span>
                  </p>
                  <button
                    onClick={startGame}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-red-500 to-neon-pink text-white font-orbitron font-bold text-sm tracking-wider hover:scale-105 active:scale-95 transition-all cursor-pointer shadow-[0_0_10px_rgba(239,68,68,0.3)] hover-target"
                  >
                    <RefreshCw className="w-4 h-4" />
                    PLAY AGAIN
                  </button>
                </div>
              )}

              {/* Running Score HUD */}
              {gameState === 'playing' && (
                <div className="absolute top-4 left-4 right-4 flex justify-between pointer-events-none select-none">
                  {/* Hearts / Lives */}
                  <div className="flex gap-1.5 p-2 rounded-xl bg-black/60 border border-white/10 backdrop-blur">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Heart
                        key={i}
                        className={`w-4 h-4 ${
                          i < lives ? 'text-red-500 fill-red-500 animate-pulse' : 'text-slate-600'
                        }`}
                      />
                    ))}
                  </div>

                  {/* Combo & Time */}
                  <div className="flex gap-2">
                    {combo > 1 && (
                      <div className="flex items-center gap-1 px-3 py-1 rounded-xl bg-neon-pink/10 border border-neon-pink/30 text-neon-pink text-xs font-orbitron font-black glow-text-pink animate-bounce">
                        <Zap className="w-3.5 h-3.5 fill-neon-pink" />
                        COMBO: x{combo}
                      </div>
                    )}
                    <div className="px-3 py-1 rounded-xl bg-black/60 border border-white/10 backdrop-blur text-xs font-orbitron text-white">
                      Time: <span className="font-bold">{timeRemaining}s</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Bottom Score display */}
              {gameState === 'playing' && (
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/60 backdrop-blur border border-white/10 rounded-xl px-4 py-2 text-center pointer-events-none select-none">
                  <span className="text-[10px] font-orbitron text-slate-400 block uppercase">
                    Score
                  </span>
                  <span className="font-orbitron font-black text-lg text-neon-green glow-text-green">
                    {score}
                  </span>
                </div>
              )}
            </CameraManager>

            {/* Local Leaderboards glass panel */}
            <div className="glass-panel rounded-2xl p-6 border border-white/10 w-full max-w-3xl flex flex-col gap-4 shadow-lg">
              <h4 className="font-orbitron font-bold text-sm text-neon-blue uppercase flex items-center gap-1.5 border-b border-white/5 pb-2">
                <Trophy className="w-4 h-4 text-amber-400" />
                TOP HIGH SCORES
              </h4>
              <div className="grid grid-cols-1 gap-2">
                {leaderboard.length === 0 ? (
                  <p className="text-xs text-slate-500 font-outfit italic">
                    No records registered yet. Play a game to set the standard!
                  </p>
                ) : (
                  leaderboard.map((entry, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-2 rounded bg-white/5 border border-white/5 text-xs font-orbitron"
                    >
                      <div className="flex items-center gap-3">
                        <span className="font-black text-neon-pink">#0{idx + 1}</span>
                        <span className="text-slate-400">{entry.date}</span>
                      </div>
                      <span className="text-neon-green font-bold glow-text-green">
                        {entry.score} PTS
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Right Column: Instructions */}
          <InstructionsPanel
            title="Color Ball Hunter"
            instructions={instructions}
            gestures={gestures}
            tips={tips}
          />
        </div>
      </div>
    </div>
  );
};
export default ColorBallHunter;
