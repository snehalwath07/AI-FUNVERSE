import React, { useRef, useState } from 'react';
import CameraManager from '../components/CameraManager';
import InstructionsPanel from '../components/InstructionsPanel';
import { useHandLandmarker } from '../hooks/useMediaPipe';
import { Undo, Redo, Trash2, Palette } from 'lucide-react';
import { playLaser, playClick } from '../utils/audio';
import { LandmarkSmoother, mapLandmark } from '../utils/tracking';

type Point = { x: number; y: number };
type Stroke = {
  points: Point[];
  color: string;
  width: number;
};

export const NeonAirDrawing: React.FC = () => {
  const { model: handLandmarker, loading: modelLoading, error: modelError } = useHandLandmarker();

  const [currentColor, setCurrentColor] = useState<string>('#ff007f'); // Neon Pink
  const [brushWidth, setBrushWidth] = useState<number>(6);
  const [gestureMode, setGestureMode] = useState<'hover' | 'draw' | 'erase' | 'pan' | 'multitouch'>('hover');
  
  // History stack
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [redoStack, setRedoStack] = useState<Stroke[]>([]);

  // Canvas offsets
  const [panOffset, setPanOffset] = useState<Point>({ x: 0, y: 0 });
  const [scale, setScale] = useState<number>(1);
  const [rotation, setRotation] = useState<number>(0); 

  // Drawing state
  const activeStrokeRef = useRef<Point[]>([]);
  const lastPanPointRef = useRef<Point | null>(null);

  // Instantiating the Landmark smoother
  const trackingSmootherRef = useRef<LandmarkSmoother>(new LandmarkSmoother(0.25));

  // Two-hand manipulation states
  const initialTwoHandDistRef = useRef<number | null>(null);
  const initialTwoHandAngleRef = useRef<number | null>(null);
  const initialScaleRef = useRef<number>(1);
  const initialRotationRef = useRef<number>(0);

  // Helper Euclidean distance
  const getDistance = (p1: any, p2: any) => {
    return Math.sqrt((p1.x - p2.x) ** 2 + (p1.y - p2.y) ** 2 + (p1.z - p2.z) ** 2);
  };

  const handleClear = () => {
    playClick();
    setStrokes([]);
    setRedoStack([]);
    setPanOffset({ x: 0, y: 0 });
    setScale(1);
    setRotation(0);
    activeStrokeRef.current = [];
    trackingSmootherRef.current.reset();
  };

  const handleUndo = () => {
    if (strokes.length === 0) return;
    playClick();
    const nextStrokes = [...strokes];
    const undone = nextStrokes.pop();
    if (undone) {
      setRedoStack([undone, ...redoStack]);
    }
    setStrokes(nextStrokes);
  };

  const handleRedo = () => {
    if (redoStack.length === 0) return;
    playClick();
    const nextRedo = [...redoStack];
    const redone = nextRedo.shift();
    if (redone) {
      setStrokes([...strokes, redone]);
    }
    setRedoStack(nextRedo);
  };

  // Render Bezier Curve Strokes helper
  const drawStrokeCurve = (ctx: CanvasRenderingContext2D, points: Point[]) => {
    if (points.length < 2) return;
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    
    for (let i = 1; i < points.length - 1; i++) {
      const xc = (points[i].x + points[i + 1].x) / 2;
      const yc = (points[i].y + points[i + 1].y) / 2;
      ctx.quadraticCurveTo(points[i].x, points[i].y, xc, yc);
    }
    // Connect final point
    ctx.lineTo(points[points.length - 1].x, points[points.length - 1].y);
    ctx.stroke();
  };

  // Core Frame Handler
  const handleFrame = (video: HTMLVideoElement, canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D) => {
    if (!handLandmarker) return;

    const results = handLandmarker.detectForVideo(video, performance.now());
    const width = canvas.width;
    const height = canvas.height;

    let detectedGesture: 'hover' | 'draw' | 'erase' | 'pan' | 'multitouch' = 'hover';
    let cursorPoint: Point | null = null;
    let hand1Pinch: Point | null = null;
    let hand2Pinch: Point | null = null;

    if (results && results.landmarks && results.landmarks.length > 0) {
      const allLandmarks = results.landmarks;

      // Extract left and right hand data
      const hand1 = allLandmarks[0];
      const hand2 = allLandmarks.length > 1 ? allLandmarks[1] : null;

      // Knuckles / Finger checks
      const indexTip = hand1[8];
      const indexPip = hand1[6];
      const middleTip = hand1[12];
      const middlePip = hand1[10];
      const ringTip = hand1[16];
      const ringPip = hand1[14];
      const thumbTip = hand1[4];

      const isIndexUp = indexTip.y < indexPip.y;
      const isMiddleUp = middleTip.y < middlePip.y;
      const isRingUp = ringTip.y < ringPip.y;

      // Map raw index coordinates using mirroring & filter out shaking jitter
      const mappedRaw = mapLandmark(indexTip, width, height, true);
      cursorPoint = trackingSmootherRef.current.smooth(mappedRaw.x, mappedRaw.y);

      const pinchDist = getDistance(thumbTip, indexTip);
      const isPinch = pinchDist < 0.045;

      // Detect two hands pinching for scale/rotate
      if (hand2) {
        const h2Index = hand2[8];
        const h2Thumb = hand2[4];
        const isH2Pinch = getDistance(h2Thumb, h2Index) < 0.045;

        if (isPinch && isH2Pinch) {
          detectedGesture = 'multitouch';
          hand1Pinch = mapLandmark(thumbTip, width, height, true);
          hand2Pinch = mapLandmark(h2Thumb, width, height, true);
        }
      }

      if (detectedGesture !== 'multitouch') {
        if (isPinch) {
          detectedGesture = 'pan';
        } else if (isIndexUp && isMiddleUp && isRingUp) {
          // Palm Rejection: If Index, Middle, AND Ring are up -> Hover only
          detectedGesture = 'hover';
        } else if (isIndexUp && isMiddleUp && !isRingUp) {
          // Peace sign -> Erase
          detectedGesture = 'erase';
        } else if (isIndexUp && !isMiddleUp) {
          // Index up only -> Draw
          detectedGesture = 'draw';
        } else {
          detectedGesture = 'hover';
        }
      }
    } else {
      trackingSmootherRef.current.reset();
    }

    setGestureMode(detectedGesture);

    ctx.save();
    
    // Scale and Rotate calculations
    if (detectedGesture === 'multitouch' && hand1Pinch && hand2Pinch) {
      const currentDist = Math.sqrt((hand1Pinch.x - hand2Pinch.x)**2 + (hand1Pinch.y - hand2Pinch.y)**2);
      const currentAngle = Math.atan2(hand2Pinch.y - hand1Pinch.y, hand2Pinch.x - hand1Pinch.x);

      if (initialTwoHandDistRef.current === null || initialTwoHandAngleRef.current === null) {
        initialTwoHandDistRef.current = currentDist;
        initialTwoHandAngleRef.current = currentAngle;
        initialScaleRef.current = scale;
        initialRotationRef.current = rotation;
      } else {
        const rawScale = (currentDist / initialTwoHandDistRef.current) * initialScaleRef.current;
        setScale(Math.max(0.3, Math.min(3.0, rawScale)));

        const angleDiff = currentAngle - initialTwoHandAngleRef.current;
        setRotation(initialRotationRef.current + angleDiff);
      }

      // Draw interactive touch boundary ring
      ctx.strokeStyle = '#00f0ff';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.moveTo(hand1Pinch.x, hand1Pinch.y);
      ctx.lineTo(hand2Pinch.x, hand2Pinch.y);
      ctx.stroke();
      ctx.setLineDash([]);
    } else {
      initialTwoHandDistRef.current = null;
      initialTwoHandAngleRef.current = null;
    }

    // Pan calculations
    if (detectedGesture === 'pan' && cursorPoint) {
      if (!lastPanPointRef.current) {
        lastPanPointRef.current = cursorPoint;
      } else {
        const dx = cursorPoint.x - lastPanPointRef.current.x;
        const dy = cursorPoint.y - lastPanPointRef.current.y;
        setPanOffset(prev => ({ x: prev.x + dx, y: prev.y + dy }));
        lastPanPointRef.current = cursorPoint;
      }
    } else {
      lastPanPointRef.current = null;
    }

    // Apply Transformation Matrix
    ctx.translate(width / 2 + panOffset.x, height / 2 + panOffset.y);
    ctx.scale(scale, scale);
    ctx.rotate(rotation);
    ctx.translate(-width / 2, -height / 2);

    // Draw all completed strokes using Bezier Curves
    strokes.forEach(stroke => {
      ctx.strokeStyle = stroke.color;
      ctx.lineWidth = stroke.width;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.shadowBlur = 12;
      ctx.shadowColor = stroke.color;
      drawStrokeCurve(ctx, stroke.points);
    });

    // Handle Draw (transformed coordinates)
    if (detectedGesture === 'draw' && cursorPoint) {
      const cosVal = Math.cos(-rotation);
      const sinVal = Math.sin(-rotation);
      
      let tx = cursorPoint.x - (width / 2 + panOffset.x);
      let ty = cursorPoint.y - (height / 2 + panOffset.y);
      
      tx /= scale;
      ty /= scale;

      const rx = tx * cosVal - ty * sinVal;
      const ry = tx * sinVal + ty * cosVal;

      const finalPt = { x: rx + width / 2, y: ry + height / 2 };

      if (activeStrokeRef.current.length === 0) {
        playLaser();
      }
      activeStrokeRef.current.push(finalPt);

      // Render active stroke
      ctx.strokeStyle = currentColor;
      ctx.lineWidth = brushWidth;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.shadowBlur = 15;
      ctx.shadowColor = currentColor;
      drawStrokeCurve(ctx, activeStrokeRef.current);
    } else if (activeStrokeRef.current.length > 0) {
      // Save active stroke
      setStrokes(prev => [...prev, {
        points: activeStrokeRef.current,
        color: currentColor,
        width: brushWidth
      }]);
      setRedoStack([]);
      activeStrokeRef.current = [];
    }

    // Handle Erase
    if (detectedGesture === 'erase' && cursorPoint) {
      const eraseRadius = 25 / scale;
      
      const cosVal = Math.cos(-rotation);
      const sinVal = Math.sin(-rotation);
      let tx = cursorPoint.x - (width / 2 + panOffset.x);
      let ty = cursorPoint.y - (height / 2 + panOffset.y);
      tx /= scale;
      ty /= scale;
      const rx = tx * cosVal - ty * sinVal;
      const ry = tx * sinVal + ty * cosVal;
      const tc = { x: rx + width / 2, y: ry + height / 2 };

      let erasedAny = false;
      const updatedStrokes = strokes.map(stroke => {
        const nextPoints = stroke.points.filter(pt => {
          const d = Math.sqrt((pt.x - tc.x) ** 2 + (pt.y - tc.y) ** 2);
          if (d < eraseRadius) {
            erasedAny = true;
            return false;
          }
          return true;
        });
        return { ...stroke, points: nextPoints };
      }).filter(s => s.points.length >= 2);

      if (erasedAny) {
        setStrokes(updatedStrokes);
        if (Math.random() < 0.15) playLaser();
      }
    }

    ctx.restore(); // Restore default coordinates

    // Draw cursor overlays
    if (cursorPoint) {
      ctx.shadowBlur = 0;
      ctx.shadowColor = 'transparent';

      if (detectedGesture === 'draw') {
        ctx.strokeStyle = currentColor;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(cursorPoint.x, cursorPoint.y, brushWidth / 2 + 2, 0, Math.PI * 2);
        ctx.stroke();
      } else if (detectedGesture === 'erase') {
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 2;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.arc(cursorPoint.x, cursorPoint.y, 25, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
        
        ctx.fillStyle = 'rgba(239, 68, 68, 0.2)';
        ctx.beginPath();
        ctx.arc(cursorPoint.x, cursorPoint.y, 25, 0, Math.PI * 2);
        ctx.fill();
      } else if (detectedGesture === 'pan') {
        ctx.strokeStyle = '#e2e8f0';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(cursorPoint.x, cursorPoint.y, 10, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = '#e2e8f0';
        ctx.font = '8px Orbitron';
        ctx.fillText("PANNING", cursorPoint.x + 15, cursorPoint.y + 3);
      } else {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.beginPath();
        ctx.arc(cursorPoint.x, cursorPoint.y, 6, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  };

  const colors = [
    { value: '#ff007f', label: 'Neon Pink' },
    { value: '#00f0ff', label: 'Neon Blue' },
    { value: '#39ff14', label: 'Neon Green' },
    { value: '#ff5f00', label: 'Neon Orange' },
    { value: '#b026ff', label: 'Neon Purple' }
  ];

  const instructions = [
    "Raise one hand in front of the camera.",
    "Raise only your INDEX finger to draw in the air with neon light.",
    "Raise both your INDEX and MIDDLE fingers (Peace Sign) to erase lines.",
    "Pinch your INDEX and THUMB together to move your drawing canvas.",
    "Pinch with BOTH hands to rotate and zoom your drawings.",
    "Use the toolbar to Undo, Redo, adjust brush width, or clear the sketch."
  ];

  const gestures = [
    { gesture: "Index Up, Others Down", action: "Draw line" },
    { gesture: "Index & Middle Up (Peace)", action: "Erase line" },
    { gesture: "Thumb + Index Pinch", action: "Move canvas" },
    { gesture: "Double-Hand Pinch", action: "Rotate & zoom canvas" }
  ];

  const tips = [
    "Keep your hand steady. Fast movements can make lines jagged.",
    "Make sure your palm faces the camera directly for precise tracking.",
    "If drawing cuts out, make sure the room has good lighting."
  ];

  return (
    <div className="min-h-[calc(100vh-80px)] py-8 px-4 flex flex-col items-center">
      <div className="max-w-6xl w-full flex flex-col gap-6">
        {/* Title */}
        <div className="text-center md:text-left">
          <h1 className="font-orbitron font-black text-3xl md:text-4xl tracking-wider bg-gradient-to-r from-neon-blue via-neon-purple to-neon-pink bg-clip-text text-transparent glow-text-blue">
            NEON AIR DRAWING
          </h1>
          <p className="text-slate-400 text-sm font-outfit mt-1">
            Draw in the air using your finger.
          </p>
        </div>

        {/* Workspace */}
        <div className="flex flex-col lg:flex-row gap-6 w-full items-start">
          {/* Left: Camera & Painting canvas */}
          <div className="flex-1 flex flex-col gap-4 w-full">
            <CameraManager 
              modelLoading={modelLoading} 
              modelError={modelError} 
              onFrame={handleFrame}
            >
              {/* Floating UI HUD inside camera */}
              <div className="absolute bottom-4 left-4 right-4 flex justify-between items-center bg-black/60 backdrop-blur border border-white/10 rounded-xl p-3 text-xs select-none">
                <div className="flex items-center gap-2">
                  <span className="font-orbitron text-slate-300">Status:</span>
                  <span className={`font-orbitron font-bold uppercase ${
                    gestureMode === 'draw' ? 'text-neon-pink glow-text-pink' :
                    gestureMode === 'erase' ? 'text-red-400' :
                    gestureMode === 'pan' ? 'text-neon-blue glow-text-blue' :
                    gestureMode === 'multitouch' ? 'text-neon-green glow-text-green' : 'text-slate-400'
                  }`}>
                    {gestureMode === 'hover' ? 'Aiming' : 
                     gestureMode === 'draw' ? 'Drawing' :
                     gestureMode === 'erase' ? 'Erasing' :
                     gestureMode === 'pan' ? 'Moving Canvas' : 'Zooming/Rotating'}
                  </span>
                </div>
                
                <div className="text-slate-400 font-orbitron">
                  Lines: <span className="text-white font-bold">{strokes.length}</span>
                </div>
              </div>
            </CameraManager>

            {/* Quick canvas control HUD */}
            <div className="glass-panel rounded-2xl p-6 border border-white/10 w-full max-w-3xl flex flex-col md:flex-row gap-6 items-center justify-between shadow-lg">
              {/* Color presets */}
              <div className="flex flex-col gap-2">
                <span className="text-xs font-orbitron text-slate-400 text-center md:text-left flex items-center gap-1">
                  <Palette className="w-3.5 h-3.5" /> BRUSH COLOR
                </span>
                <div className="flex gap-2">
                  {colors.map((c) => (
                    <button
                      key={c.value}
                      onClick={() => { playClick(); setCurrentColor(c.value); }}
                      className={`w-8 h-8 rounded-full border transition-all cursor-pointer hover-target ${
                        currentColor === c.value 
                          ? 'border-white scale-110 shadow-lg' 
                          : 'border-white/10 hover:scale-105'
                      }`}
                      style={{ 
                        backgroundColor: c.value, 
                        boxShadow: currentColor === c.value ? `0 0 10px ${c.value}` : 'none' 
                      }}
                      title={c.label}
                    />
                  ))}
                </div>
              </div>

              {/* Slider for brush size */}
              <div className="flex flex-col gap-2 w-full md:w-44">
                <div className="flex justify-between text-xs font-orbitron text-slate-400">
                  <span>BRUSH WIDTH</span>
                  <span className="text-neon-blue font-bold">{brushWidth}px</span>
                </div>
                <input
                  type="range"
                  min="2"
                  max="20"
                  value={brushWidth}
                  onChange={(e) => setBrushWidth(parseInt(e.target.value))}
                  className="accent-neon-blue cursor-pointer hover-target"
                />
              </div>

              {/* Operations */}
              <div className="flex gap-3">
                <button
                  onClick={handleUndo}
                  disabled={strokes.length === 0}
                  className="p-2.5 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 disabled:opacity-30 disabled:pointer-events-none text-slate-300 hover:text-white transition-all cursor-pointer hover-target"
                  title="Undo Stroke"
                >
                  <Undo className="w-4 h-4" />
                </button>
                <button
                  onClick={handleRedo}
                  disabled={redoStack.length === 0}
                  className="p-2.5 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 disabled:opacity-30 disabled:pointer-events-none text-slate-300 hover:text-white transition-all cursor-pointer hover-target"
                  title="Redo Stroke"
                >
                  <Redo className="w-4 h-4" />
                </button>
                <button
                  onClick={handleClear}
                  className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/25 transition-all cursor-pointer hover-target"
                  title="Clear Canvas"
                >
                  <Trash2 className="w-4 h-4" />
                  <span className="text-xs font-orbitron font-bold">CLEAR</span>
                </button>
              </div>
            </div>
          </div>

          {/* Right: Info panel */}
          <InstructionsPanel
            title="Neon Air Drawing"
            instructions={instructions}
            gestures={gestures}
            tips={tips}
          />
        </div>
      </div>
    </div>
  );
};
export default NeonAirDrawing;
