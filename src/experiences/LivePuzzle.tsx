import React, { useState, useEffect, useRef } from 'react';
import CameraManager from '../components/CameraManager';
import InstructionsPanel from '../components/InstructionsPanel';
import { useHandLandmarker } from '../hooks/useMediaPipe';
import { Trophy, RefreshCw, CheckCircle, Camera, Crop } from 'lucide-react';
import { playPop, playSpell, playVictory, playClick } from '../utils/audio';
import { LandmarkSmoother, mapLandmark } from '../utils/tracking';
import confetti from 'canvas-confetti';

type Tile = {
  id: number;          // Original correct tile index (0 to N*N-1)
  currentPos: number;  // Current grid slot index
  isDragging: boolean;
  dragX: number;
  dragY: number;
  currentX: number;    // Animation visual X
  currentY: number;    // Animation visual Y
};

type LeaderboardEntry = {
  moves: number;
  time: number;
  difficulty: string;
  date: string;
};

type CropBox = {
  x: number;
  y: number;
  w: number;
  h: number;
};

export const LivePuzzle: React.FC = () => {
  const { model: handLandmarker, loading: modelLoading, error: modelError } = useHandLandmarker();

  // Redesigned puzzle states: 'cropping' | 'solving' | 'solved'
  const [puzzleState, setPuzzleState] = useState<'cropping' | 'solving' | 'solved'>('cropping');
  const [gridSize, setGridSize] = useState<number>(3); // 3x3 default
  const [tiles, setTiles] = useState<Tile[]>([]);
  
  // Game stats
  const [moves, setMoves] = useState<number>(0);
  const [seconds, setSeconds] = useState<number>(0);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);

  // Crop tracking states
  const [activeCropBox, setActiveCropBox] = useState<CropBox | null>(null);

  const tilesRef = useRef<Tile[]>([]);
  const draggedTileRef = useRef<number | null>(null); 
  const movesRef = useRef<number>(0);

  // Buffer for cropped webcam image
  const croppedImageCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const cropBoxRef = useRef<CropBox | null>(null);
  const doublePinchTimerRef = useRef<number>(0);

  // Cursors for two hands in cropping state
  const leftCursorRef = useRef<LandmarkSmoother>(new LandmarkSmoother(0.22));
  const rightCursorRef = useRef<LandmarkSmoother>(new LandmarkSmoother(0.22));
  const indexSmootherRef = useRef<LandmarkSmoother>(new LandmarkSmoother(0.25));

  // Sync refs
  useEffect(() => {
    tilesRef.current = tiles;
  }, [tiles]);
  useEffect(() => {
    movesRef.current = moves;
  }, [moves]);

  // Timer loop
  useEffect(() => {
    if (puzzleState !== 'solving') return;
    const interval = setInterval(() => {
      setSeconds(prev => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [puzzleState]);

  // Load leaderboard
  useEffect(() => {
    const saved = localStorage.getItem('aifun_puzzle_leaderboard');
    if (saved) {
      setLeaderboard(JSON.parse(saved));
    }
  }, []);

  const captureCropRegion = (video: HTMLVideoElement, crop: CropBox) => {
    playSpell();
    
    // Create offscreen canvas to store cropped webcam portion
    const cropCanvas = document.createElement('canvas');
    cropCanvas.width = crop.w;
    cropCanvas.height = crop.h;
    const ctx = cropCanvas.getContext('2d')!;

    // Map crop coordinates relative to video dimensions
    // Video aspect ratio vs canvas aspect ratio:
    const scaleX = video.videoWidth / 640;
    const scaleY = video.videoHeight / 480;

    const sx = crop.x * scaleX;
    const sy = crop.y * scaleY;
    const sw = crop.w * scaleX;
    const sh = crop.h * scaleY;

    // Draw video portion mirrored to match display
    ctx.save();
    ctx.translate(crop.w, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, sx, sy, sw, sh, 0, 0, crop.w, crop.h);
    ctx.restore();

    croppedImageCanvasRef.current = cropCanvas;
    cropBoxRef.current = crop;

    // Initialize puzzle pieces
    initializeShuffledTiles(gridSize, crop.w, crop.h);
    setPuzzleState('solving');
  };

  const initializeShuffledTiles = (size: number, cropW: number, cropH: number) => {
    const count = size * size;
    const initialTiles: Tile[] = [];
    const tileW = cropW / size;
    const tileH = cropH / size;

    for (let i = 0; i < count; i++) {
      initialTiles.push({
        id: i,
        currentPos: i,
        isDragging: false,
        dragX: 0,
        dragY: 0,
        currentX: (i % size) * tileW,
        currentY: Math.floor(i / size) * tileH
      });
    }

    // Shuffle slots
    const shufPos = Array.from({ length: count }, (_, i) => i);
    for (let i = count - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shufPos[i], shufPos[j]] = [shufPos[j], shufPos[i]];
    }

    const shuffledTiles = initialTiles.map((tile, idx) => {
      const targetSlot = shufPos[idx];
      return {
        ...tile,
        currentPos: targetSlot,
        currentX: (targetSlot % size) * tileW,
        currentY: Math.floor(targetSlot / size) * tileH
      };
    });

    setTiles(shuffledTiles);
    setMoves(0);
    setSeconds(0);
    draggedTileRef.current = null;
    indexSmootherRef.current.reset();
  };

  const checkVictory = (currentTiles: Tile[]) => {
    const isSolved = currentTiles.every(t => t.id === t.currentPos);
    if (isSolved) {
      playVictory();
      setPuzzleState('solved');
      confetti({
        particleCount: 150,
        spread: 80,
        origin: { y: 0.6 }
      });

      // Save to leaderboard
      const newEntry: LeaderboardEntry = {
        moves: movesRef.current,
        time: seconds,
        difficulty: `${gridSize}x${gridSize}`,
        date: new Date().toLocaleDateString()
      };
      setLeaderboard(prev => {
        const updated = [...prev, newEntry]
          .sort((a, b) => a.time - b.time || a.moves - b.moves)
          .slice(0, 5);
        localStorage.setItem('aifun_puzzle_leaderboard', JSON.stringify(updated));
        return updated;
      });
    }
  };

  const handleFrame = (video: HTMLVideoElement, canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D) => {
    const width = canvas.width;
    const height = canvas.height;

    // Detect hand landmarks
    let allLandmarks: any[] = [];
    if (handLandmarker) {
      const results = handLandmarker.detectForVideo(video, performance.now());
      if (results && results.landmarks && results.landmarks.length > 0) {
        allLandmarks = results.landmarks;
      }
    }

    // --- STEP 1 & 2: CROPPING STATE ---
    if (puzzleState === 'cropping') {
      let leftHandPinch: { x: number; y: number } | null = null;
      let rightHandPinch: { x: number; y: number } | null = null;

      let isLeftPinching = false;
      let isRightPinching = false;

      if (allLandmarks.length > 0) {
        // Classify Hand 1
        const h1Tip = allLandmarks[0][8];
        const h1Thumb = allLandmarks[0][4];
        const mapped1 = mapLandmark(h1Tip, width, height, true);
        const smoothed1 = leftCursorRef.current.smooth(mapped1.x, mapped1.y);

        const dist1 = Math.sqrt((h1Tip.x - h1Thumb.x)**2 + (h1Tip.y - h1Thumb.y)**2);
        const pinch1 = dist1 < 0.045;

        // Since video is mirrored, decide left/right by coordinate
        if (smoothed1.x < width / 2) {
          leftHandPinch = smoothed1;
          isLeftPinching = pinch1;
        } else {
          rightHandPinch = smoothed1;
          isRightPinching = pinch1;
        }

        // Classify Hand 2 if present
        if (allLandmarks.length > 1) {
          const h2Tip = allLandmarks[1][8];
          const h2Thumb = allLandmarks[1][4];
          const mapped2 = mapLandmark(h2Tip, width, height, true);
          const smoothed2 = rightCursorRef.current.smooth(mapped2.x, mapped2.y);

          const dist2 = Math.sqrt((h2Tip.x - h2Thumb.x)**2 + (h2Tip.y - h2Thumb.y)**2);
          const pinch2 = dist2 < 0.045;

          if (smoothed2.x < width / 2) {
            leftHandPinch = smoothed2;
            isLeftPinching = pinch2;
          } else {
            rightHandPinch = smoothed2;
            isRightPinching = pinch2;
          }
        }
      } else {
        leftCursorRef.current.reset();
        rightCursorRef.current.reset();
      }

      // Draw Crop Box boundaries
      if (leftHandPinch && rightHandPinch) {
        const x = Math.min(leftHandPinch.x, rightHandPinch.x);
        const y = Math.min(leftHandPinch.y, rightHandPinch.y);
        const w = Math.max(20, Math.abs(leftHandPinch.x - rightHandPinch.x));
        const h = Math.max(20, Math.abs(leftHandPinch.y - rightHandPinch.y));

        const activeBox = { x, y, w, h };
        setActiveCropBox(activeBox);

        // Draw glowing selection box
        ctx.save();
        ctx.shadowBlur = 15;
        ctx.shadowColor = '#00f0ff';
        ctx.strokeStyle = '#00f0ff';
        ctx.lineWidth = 3.5;
        ctx.strokeRect(x, y, w, h);
        ctx.restore();

        // Hold steady to capture logic
        if (isLeftPinching && isRightPinching) {
          doublePinchTimerRef.current += 1.5; // increment speed
          const progress = Math.min(100, (doublePinchTimerRef.current / 60) * 100);

          // Draw progress loader above selection box
          ctx.save();
          ctx.fillStyle = '#00f0ff';
          ctx.font = 'bold 12px Orbitron';
          ctx.textAlign = 'center';
          ctx.fillText(`HOLD STEADY TO CAPTURE: ${Math.round(progress)}%`, x + w/2, y - 12);
          ctx.restore();

          if (progress >= 100) {
            captureCropRegion(video, activeBox);
            doublePinchTimerRef.current = 0;
            return;
          }
        } else {
          doublePinchTimerRef.current = 0;
        }

        // Draw pinch pointers
        const drawPointer = (pt: {x: number, y: number}, active: boolean) => {
          ctx.save();
          ctx.fillStyle = active ? '#39ff14' : '#00f0ff';
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, 6, 0, Math.PI*2);
          ctx.fill();
          ctx.restore();
        };
        drawPointer(leftHandPinch, isLeftPinching);
        drawPointer(rightHandPinch, isRightPinching);

      } else {
        setActiveCropBox(null);
        doublePinchTimerRef.current = 0;
      }
    }

    // --- STEP 3 & 4: SOLVING & SOLVED STATES ---
    if ((puzzleState === 'solving' || puzzleState === 'solved') && croppedImageCanvasRef.current && cropBoxRef.current) {
      const crop = cropBoxRef.current;
      const tileW = crop.w / gridSize;
      const tileH = crop.h / gridSize;

      // Center puzzle on camera screen
      const startX = (width - crop.w) / 2;
      const startY = (height - crop.h) / 2;

      // Draw background shield
      ctx.fillStyle = 'rgba(0,0,0,0.85)';
      ctx.fillRect(0, 0, width, height);
      ctx.strokeStyle = '#00f0ff';
      ctx.strokeRect(startX - 2, startY - 2, crop.w + 4, crop.h + 4);

      // Track index fingertip only (ignore thumb)
      let indexCursor: { x: number; y: number } | null = null;
      let isIndexActive = false; // grab state: index finger must be extended

      if (allLandmarks.length > 0) {
        const hand = allLandmarks[0];
        const indexTip = hand[8];
        const indexPip = hand[6];

        const mappedIndex = mapLandmark(indexTip, width, height, true);
        indexCursor = indexSmootherRef.current.smooth(mappedIndex.x, mappedIndex.y);
        
        // Grab is active if index finger is pointed UP (tip above PIP joint)
        isIndexActive = indexTip.y < indexPip.y;
      } else {
        indexSmootherRef.current.reset();
      }

      // Drag and Drop physics
      const currentTiles = [...tilesRef.current];
      const draggedId = draggedTileRef.current;

      if (puzzleState === 'solving') {
        if (isIndexActive && indexCursor) {
          if (draggedId === null) {
            // Find which tile was touched by the index fingertip
            for (let i = 0; i < currentTiles.length; i++) {
              const tile = currentTiles[i];
              
              // Calculate screen coordinates of the tile's current grid slot
              const slotX = startX + (tile.currentPos % gridSize) * tileW;
              const slotY = startY + Math.floor(tile.currentPos / gridSize) * tileH;

              if (
                indexCursor.x >= slotX && indexCursor.x <= slotX + tileW &&
                indexCursor.y >= slotY && indexCursor.y <= slotY + tileH
              ) {
                draggedTileRef.current = tile.id;
                playPop();
                break;
              }
            }
          } else {
            // Update dragged tile coordinate
            const idx = currentTiles.findIndex(t => t.id === draggedId);
            if (idx !== -1) {
              currentTiles[idx].isDragging = true;
              currentTiles[idx].dragX = indexCursor.x - tileW / 2;
              currentTiles[idx].dragY = indexCursor.y - tileH / 2;
              setTiles(currentTiles);
            }
          }
        } else {
          // Released finger -> Swap tiles
          if (draggedId !== null) {
            const idx = currentTiles.findIndex(t => t.id === draggedId);
            if (idx !== -1 && indexCursor) {
              currentTiles[idx].isDragging = false;
              
              // Map index coordinate relative to puzzle canvas center
              const relativeX = indexCursor.x - startX;
              const relativeY = indexCursor.y - startY;

              const targetCol = Math.max(0, Math.min(gridSize - 1, Math.floor(relativeX / tileW)));
              const targetRow = Math.max(0, Math.min(gridSize - 1, Math.floor(relativeY / tileH)));
              const targetSlot = targetRow * gridSize + targetCol;

              const swapIdx = currentTiles.findIndex(t => t.currentPos === targetSlot);
              if (swapIdx !== -1 && swapIdx !== idx) {
                const oldSlot = currentTiles[idx].currentPos;
                currentTiles[idx].currentPos = targetSlot;
                currentTiles[swapIdx].currentPos = oldSlot;
                
                setMoves(prev => prev + 1);
                playPop();
                setTiles(currentTiles);
                checkVictory(currentTiles);
              }
            }
            draggedTileRef.current = null;
          }
        }
      }

      // Draw sliced tiles with linear slide interpolation
      currentTiles.forEach((tile) => {
        const sx = (tile.id % gridSize) * tileW;
        const sy = Math.floor(tile.id / gridSize) * tileH;

        const targetX = startX + (tile.currentPos % gridSize) * tileW;
        const targetY = startY + Math.floor(tile.currentPos / gridSize) * tileH;

        if (tile.isDragging) {
          tile.currentX = tile.dragX;
          tile.currentY = tile.dragY;
        } else {
          // Slide snapping interpolation
          tile.currentX += (targetX - tile.currentX) * 0.22;
          tile.currentY += (targetY - tile.currentY) * 0.22;
        }

        ctx.save();
        if (tile.isDragging) {
          ctx.shadowBlur = 20;
          ctx.shadowColor = '#39ff14';
        }

        // Draw cropped webcam image slice
        ctx.drawImage(
          croppedImageCanvasRef.current!,
          sx, sy, tileW, tileH,
          tile.currentX, tile.currentY, tileW, tileH
        );

        // Highlight aligned tiles
        ctx.strokeStyle = tile.id === tile.currentPos ? 'rgba(57, 255, 20, 0.4)' : 'rgba(255, 255, 255, 0.15)';
        ctx.lineWidth = tile.isDragging ? 3.5 : 1.5;
        ctx.strokeRect(tile.currentX, tile.currentY, tileW, tileH);

        // Number labels
        ctx.fillStyle = tile.id === tile.currentPos ? '#39ff14' : '#ffffff';
        ctx.font = '10px Orbitron';
        ctx.fillText(`${tile.id + 1}`, tile.currentX + 8, tile.currentY + 18);
        ctx.restore();
      });

      // Draw index-finger cursor reticle
      if (indexCursor) {
        ctx.save();
        ctx.shadowBlur = 10;
        ctx.shadowColor = isIndexActive ? '#39ff14' : '#ff007f';
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2.5;
        ctx.fillStyle = isIndexActive ? 'rgba(57, 255, 20, 0.5)' : 'rgba(255, 0, 127, 0.4)';
        ctx.beginPath();
        ctx.arc(indexCursor.x, indexCursor.y, 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      }
    }
  };

  const manualCaptureBox = () => {
    // Accessibility bypass if hand tracking fails
    playSpell();
    const box = activeCropBox || { x: 120, y: 80, w: 400, h: 320 };
    const video = document.querySelector('video');
    if (video) {
      captureCropRegion(video, box);
    }
  };

  const handleDifficulty = (size: number) => {
    playClick();
    setGridSize(size);
    if (puzzleState === 'solving' && croppedImageCanvasRef.current && cropBoxRef.current) {
      initializeShuffledTiles(size, cropBoxRef.current.w, cropBoxRef.current.h);
    }
  };

  const playAgain = () => {
    playClick();
    setPuzzleState('cropping');
    setActiveCropBox(null);
    croppedImageCanvasRef.current = null;
    cropBoxRef.current = null;
  };

  const instructions = [
    "Position your hands: Raise both hands. Pinch your index finger and thumb to set the corners of the box.",
    "Capture: Hold steady for a moment (progress bar hits 100%) or click 'CAPTURE PICTURE'.",
    "Solve: Move the puzzle pieces using only your index finger.",
    "Drag: Point your index finger straight up to drag a piece, and fold it down to drop it.",
    "Solve: Put all the pieces back in order to win!"
  ];

  const gestures = [
    { gesture: "Dual Pinch (Left/Right)", action: "Sets the box corners and takes a picture" },
    { gesture: "Index Up (Solving)", action: "Drag a puzzle piece" },
    { gesture: "Index Down / Folded", action: "Drop the piece" }
  ];

  const tips = [
    "Make sure your hands are separated so the crop box is large enough.",
    "Point your index finger straight up when dragging tiles to avoid accidental drops.",
    "Click the manual capture button if the camera cannot see your fingers clearly."
  ];

  return (
    <div className="min-h-[calc(100vh-80px)] py-8 px-4 flex flex-col items-center">
      <div className="max-w-6xl w-full flex flex-col gap-6">
        {/* Header */}
        <div className="text-center md:text-left">
          <h1 className="font-orbitron font-black text-3xl md:text-4xl tracking-wider bg-gradient-to-r from-neon-blue via-neon-purple to-neon-pink bg-clip-text text-transparent glow-text-blue">
            LIVE PUZZLE
          </h1>
          <p className="text-slate-400 text-sm font-outfit mt-1">
            Capture, shuffle and solve your own puzzle.
          </p>
        </div>

        {/* Layout */}
        <div className="flex flex-col lg:flex-row gap-6 w-full items-start">
          {/* Left: Camera Grid Arena */}
          <div className="flex-1 flex flex-col gap-4 w-full">
            <CameraManager 
              modelLoading={modelLoading} 
              modelError={modelError} 
              onFrame={handleFrame}
            >
              {/* Cropping prompt overlay */}
              {puzzleState === 'cropping' && (
                <div className="absolute top-4 left-4 right-4 flex justify-between pointer-events-none select-none z-10">
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-neon-blue/10 border border-neon-blue/30 text-neon-blue text-xs font-orbitron font-bold">
                    <Crop className="w-3.5 h-3.5" />
                    Mode: Choose Photo Area
                  </div>
                </div>
              )}

              {/* Victory screen */}
              {puzzleState === 'solved' && (
                <div className="absolute inset-0 bg-black/90 flex flex-col items-center justify-center p-6 text-center select-none pointer-events-auto z-30">
                  <CheckCircle className="w-14 h-14 text-neon-green mb-3 animate-bounce shadow-glow" />
                  <h3 className="font-orbitron font-black text-2xl text-neon-green tracking-wider mb-2">
                    🏆 Puzzle Solved!
                  </h3>
                  <p className="font-orbitron text-slate-300 text-xs mb-6 uppercase">
                    Moves: {moves} | Time: {seconds}s
                  </p>
                  <button
                    onClick={playAgain}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-neon-green to-neon-blue text-black font-orbitron font-black text-xs tracking-wider hover:scale-105 active:scale-95 transition-all cursor-pointer shadow-[0_0_10px_rgba(57,255,20,0.3)] hover-target"
                  >
                    <RefreshCw className="w-4 h-4" />
                    Play Again
                  </button>
                </div>
              )}

              {/* Solving HUD */}
              {puzzleState === 'solving' && (
                <div className="absolute top-4 left-4 right-4 flex justify-between items-center pointer-events-none select-none z-10">
                  <div className="flex gap-4 p-2 rounded-xl bg-black/60 border border-white/10 backdrop-blur font-orbitron text-xs">
                    <div>
                      Moves: <span className="text-neon-pink font-bold">{moves}</span>
                    </div>
                    <div className="text-slate-500">|</div>
                    <div>
                      Time: <span className="text-neon-blue font-bold">{seconds}s</span>
                    </div>
                  </div>

                  <div className="px-3 py-1 rounded-xl bg-black/60 border border-white/10 backdrop-blur text-[10px] font-orbitron text-slate-400 capitalize">
                    Grid: {gridSize}x{gridSize}
                  </div>
                </div>
              )}
            </CameraManager>

            {/* Controls Bar */}
            <div className="glass-panel rounded-2xl p-6 border border-white/10 w-full max-w-3xl flex flex-col sm:flex-row gap-4 items-center justify-between shadow-lg">
              <div className="flex flex-col gap-1">
                <span className="text-xs font-orbitron text-slate-400">Puzzle Status</span>
                <span className="text-sm font-outfit text-slate-300">
                  {puzzleState === 'cropping'
                    ? 'Position the crop box to choose your puzzle picture.'
                    : puzzleState === 'solving'
                      ? 'Arrange the scrambled tiles into their correct order.'
                      : 'Puzzle solved. Play again!'}
                </span>
              </div>

              <div className="flex gap-3">
                {puzzleState === 'cropping' ? (
                  <button
                    onClick={manualCaptureBox}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-neon-blue to-neon-purple text-white font-orbitron font-bold text-xs tracking-wider shadow-md hover:scale-105 active:scale-95 transition-all cursor-pointer hover-target"
                  >
                    <Camera className="w-4 h-4" />
                    CAPTURE PICTURE
                  </button>
                ) : (
                  <>
                    <button
                      onClick={playAgain}
                      className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white hover:bg-white/10 font-orbitron font-bold text-xs transition-all cursor-pointer hover-target"
                    >
                      <Crop className="w-4 h-4" />
                      NEW PICTURE
                    </button>
                    <div className="flex bg-white/5 p-1 rounded-xl border border-white/5">
                      {[3, 4, 5].map((size) => (
                        <button
                          key={size}
                          onClick={() => handleDifficulty(size)}
                          className={`px-3 py-1.5 rounded-lg text-[10px] font-orbitron font-bold transition-all cursor-pointer hover-target ${
                            gridSize === size
                              ? 'bg-gradient-to-r from-neon-blue to-neon-purple text-white shadow-md'
                              : 'text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          {size}x{size}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Puzzle Leaderboard */}
            <div className="glass-panel rounded-2xl p-6 border border-white/10 w-full max-w-3xl flex flex-col gap-4 shadow-lg">
              <h4 className="font-orbitron font-bold text-sm text-neon-blue uppercase flex items-center gap-1.5 border-b border-white/5 pb-2">
                <Trophy className="w-4 h-4 text-amber-400" />
                TOP HIGH SCORES
              </h4>
              <div className="grid grid-cols-1 gap-2">
                {leaderboard.length === 0 ? (
                  <p className="text-xs text-slate-500 font-outfit italic">
                    No puzzle records registered yet. Capture a crop to set a time!
                  </p>
                ) : (
                  leaderboard.map((entry, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-2 rounded bg-white/5 border border-white/5 text-xs font-orbitron"
                    >
                      <div className="flex items-center gap-3">
                        <span className="font-black text-neon-pink">#0{idx + 1}</span>
                        <span className="text-slate-400">{entry.date} - Grid {entry.difficulty}</span>
                      </div>
                      <span className="text-neon-green font-bold glow-text-green">
                        {entry.time}S | {entry.moves} MOVES
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Right Column: Instructions */}
          <InstructionsPanel
            title="Live Puzzle"
            instructions={instructions}
            gestures={gestures}
            tips={tips}
          />
        </div>
      </div>
    </div>
  );
};
export default LivePuzzle;
