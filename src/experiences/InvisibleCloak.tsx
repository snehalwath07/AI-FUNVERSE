import React, { useRef, useState } from 'react';
import CameraManager from '../components/CameraManager';
import InstructionsPanel from '../components/InstructionsPanel';
import { Camera, RefreshCw, Sun } from 'lucide-react';
import { playSpell, playClick } from '../utils/audio';

export const InvisibleCloak: React.FC = () => {
  const [bgCaptured, setBgCaptured] = useState<boolean>(false);
  const [selectedColor, setSelectedColor] = useState<'red' | 'green' | 'blue' | 'custom'>('red');
  
  // Custom calibration sliders
  const [tolerance, setTolerance] = useState<number>(30); // Hue tolerance angle
  const [customH, setCustomH] = useState<number>(0);       // Target Hue (0-360)
  const [customS, setCustomS] = useState<number>(45);      // Min Saturation %
  const [customV, setCustomV] = useState<number>(20);      // Min Brightness %

  // Lighting status
  const [ambientLight, setAmbientLight] = useState<'optimal' | 'low' | 'high'>('optimal');

  const backgroundFrameRef = useRef<ImageData | null>(null);
  const shouldCaptureBgRef = useRef<boolean>(false);

  const triggerBackgroundCapture = () => {
    playSpell();
    shouldCaptureBgRef.current = true;
  };

  const resetBackground = () => {
    playClick();
    backgroundFrameRef.current = null;
    setBgCaptured(false);
    shouldCaptureBgRef.current = false;
  };

  // Fast RGB to HSV conversion
  const rgbToHsv = (r: number, g: number, b: number) => {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const d = max - min;
    let h = 0;
    const s = max === 0 ? 0 : d / max;
    const v = max;

    if (max !== min) {
      switch (max) {
        case r: h = (g - b) / d + (g < b ? 6 : 0); break;
        case g: h = (b - r) / d + 2; break;
        case b: h = (r - g) / d + 4; break;
      }
      h /= 6;
    }
    return { h: h * 360, s: s * 100, v: v * 100 };
  };

  // Run pixel replacement and lighting analysis on every frame
  const handleFrame = (_video: HTMLVideoElement, canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D) => {
    const width = canvas.width;
    const height = canvas.height;

    // Get current video frame pixels
    let imgData: ImageData;
    try {
      imgData = ctx.getImageData(0, 0, width, height);
    } catch (e) {
      return; // cross-origin safety
    }

    const data = imgData.data;

    // 1. Thread-safe Background Capture directly inside frame cycle
    if (shouldCaptureBgRef.current) {
      backgroundFrameRef.current = ctx.getImageData(0, 0, width, height);
      setBgCaptured(true);
      shouldCaptureBgRef.current = false;
      return;
    }

    const bgFrame = backgroundFrameRef.current;
    
    // Sub-sample brightness analyzer for speed
    if (Math.random() < 0.1) {
      let totalLuminance = 0;
      const step = 20;
      let count = 0;
      for (let i = 0; i < data.length; i += 4 * step) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        totalLuminance += 0.299 * r + 0.587 * g + 0.114 * b;
        count++;
      }
      const avgBright = totalLuminance / count;
      if (avgBright < 45) {
        setAmbientLight('low');
      } else if (avgBright > 220) {
        setAmbientLight('high');
      } else {
        setAmbientLight('optimal');
      }
    }

    // 2. HSV-based Cloak processing
    if (bgCaptured && bgFrame && bgFrame.data.length === data.length) {
      const bgData = bgFrame.data;
      
      // Presets Target Hues
      let targetH = 0; // Red
      let minS = 45;
      let minV = 20;

      if (selectedColor === 'green') {
        targetH = 120;
        minS = 40;
      } else if (selectedColor === 'blue') {
        targetH = 220;
        minS = 40;
      } else if (selectedColor === 'custom') {
        targetH = customH;
        minS = customS;
        minV = customV;
      }

      // Process pixel coordinates
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];

        const hsv = rgbToHsv(r, g, b);

        // Circular Hue Difference
        let hueDiff = Math.abs(hsv.h - targetH);
        if (hueDiff > 180) {
          hueDiff = 360 - hueDiff;
        }

        // Mask condition (Hue is close, Saturation and Brightness are above threshold)
        if (hueDiff < tolerance && hsv.s >= minS && hsv.v >= minV) {
          data[i] = bgData[i];
          data[i + 1] = bgData[i + 1];
          data[i + 2] = bgData[i + 2];
        } else if (hueDiff < tolerance + 15 && hsv.s >= minS && hsv.v >= minV) {
          // Feathered blending boundary
          const ratio = (hueDiff - tolerance) / 15;
          const invRatio = 1 - ratio;
          data[i] = Math.round(data[i] * ratio + bgData[i] * invRatio);
          data[i + 1] = Math.round(data[i + 1] * ratio + bgData[i + 1] * invRatio);
          data[i + 2] = Math.round(data[i + 2] * ratio + bgData[i + 2] * invRatio);
        }
      }
      
      // Draw filtered frame back to Canvas
      ctx.putImageData(imgData, 0, 0);
    }
  };

  const instructions = [
    "Step out of the frame completely, then click 'CAPTURE BACKGROUND'.",
    "Bring a solid colored sheet (prefer Red, e.g. a red towel or blanket) into the frame.",
    "Cover yourself or a portion of your body with the sheet.",
    "Watch as covered sections turn completely invisible, showing the empty background instead!",
    "Use the controls to calibrate the sensitivity (tolerance) or choose other colors."
  ];

  const gestures = [
    { gesture: "Capture BG", action: "Locks the empty room image in memory." },
    { gesture: "Reset BG", action: "Clears background memory to recalibrate." },
    { gesture: "Tolerance Slider", action: "Changes color match threshold for invisibility." }
  ];

  const tips = [
    "A single-color, non-reflective cloth yields the cleanest mask.",
    "Ensure your background is still. Moving fans or lighting shifts will create 'shadow' outlines.",
    "If your environment is too dark, click retry after turning on lights."
  ];

  return (
    <div className="min-h-[calc(100vh-80px)] py-8 px-4 flex flex-col items-center">
      <div className="max-w-6xl w-full flex flex-col gap-6">
        {/* Header */}
        <div className="text-center md:text-left">
          <h1 className="font-orbitron font-black text-3xl md:text-4xl tracking-wider bg-gradient-to-r from-neon-pink via-neon-purple to-neon-blue bg-clip-text text-transparent glow-text-pink">
            HARRY POTTER INVISIBLE CLOAK
          </h1>
          <p className="text-slate-400 text-sm font-outfit mt-1">
            Become invisible using a magical cloak.
          </p>
        </div>

        {/* Content Layout */}
        <div className="flex flex-col lg:flex-row gap-6 w-full items-start">
          {/* Left Column: Webcam & Live controls */}
          <div className="flex-1 flex flex-col gap-4 w-full">
            <CameraManager onFrame={handleFrame}>
              {/* Overlay inside camera HUD */}
              <div className="absolute bottom-4 left-4 right-4 flex justify-between items-center bg-black/60 backdrop-blur border border-white/10 rounded-xl p-3 text-xs select-none">
                <div className="flex items-center gap-2">
                  <div className={`w-2.5 h-2.5 rounded-full ${bgCaptured ? 'bg-neon-green animate-pulse' : 'bg-red-500'}`} />
                  <span className="font-orbitron text-slate-300">
                    Status: {bgCaptured ? 'Cloak Active' : 'Waiting for background snapshot'}
                  </span>
                </div>
                
                {/* Lighting warning indicator */}
                <div className="flex items-center gap-1.5 text-slate-400">
                  <Sun className="w-3.5 h-3.5 text-neon-blue" />
                  <span className="font-orbitron">Lighting: </span>
                  <span className={`font-bold ${
                    ambientLight === 'optimal' ? 'text-neon-green' : 'text-neon-orange'
                  }`}>
                    {ambientLight === 'optimal' ? 'Good' : ambientLight === 'low' ? 'Too Dark' : 'Too Bright'}
                  </span>
                </div>
              </div>
            </CameraManager>

            {/* Quick calibration glass card */}
            <div className="glass-panel rounded-2xl p-6 border border-white/10 w-full max-w-3xl flex flex-col md:flex-row gap-6 items-center justify-between shadow-lg">
              <div className="flex flex-wrap gap-3 items-center justify-center md:justify-start">
                <button
                  onClick={triggerBackgroundCapture}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-neon-pink to-neon-purple text-white font-orbitron font-bold text-sm shadow-[0_0_10px_rgba(255,0,127,0.3)] hover:scale-105 active:scale-95 transition-all duration-300 cursor-pointer hover-target"
                >
                  <Camera className="w-4 h-4" />
                  CAPTURE BACKGROUND
                </button>
                <button
                  onClick={resetBackground}
                  disabled={!bgCaptured}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white/80 hover:text-white disabled:opacity-30 disabled:pointer-events-none hover:bg-white/10 font-orbitron font-bold text-sm transition-all duration-300 cursor-pointer hover-target"
                >
                  <RefreshCw className="w-4 h-4" />
                  RESET
                </button>
              </div>

              {/* Color settings */}
              <div className="flex flex-col gap-2 w-full md:w-auto">
                <span className="text-xs font-orbitron text-slate-400 text-center md:text-left">
                  CLOAK COLOR
                </span>
                <div className="flex bg-white/5 p-1 rounded-xl border border-white/5">
                  {(['red', 'green', 'blue', 'custom'] as const).map((color) => (
                    <button
                      key={color}
                      onClick={() => { playClick(); setSelectedColor(color); }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-orbitron capitalize transition-all cursor-pointer hover-target ${
                        selectedColor === color
                          ? 'bg-gradient-to-r from-neon-blue to-neon-purple text-white shadow-md'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {color}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Custom Calibration sliders */}
            {selectedColor === 'custom' && (
              <div className="glass-panel rounded-2xl p-6 border border-white/10 w-full max-w-3xl flex flex-col gap-4 shadow-lg">
                <h4 className="font-orbitron font-bold text-sm text-neon-blue uppercase">
                  Custom Color Tuning
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <span className="text-xs font-orbitron text-slate-400">Target Hue: {customH}°</span>
                    <input 
                      type="range" min="0" max="360" value={customH} 
                      onChange={(e) => setCustomH(parseInt(e.target.value))}
                      className="accent-neon-pink cursor-pointer hover-target" 
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <span className="text-xs font-orbitron text-slate-400">Min Saturation: {customS}%</span>
                    <input 
                      type="range" min="0" max="100" value={customS} 
                      onChange={(e) => setCustomS(parseInt(e.target.value))}
                      className="accent-neon-green cursor-pointer hover-target" 
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <span className="text-xs font-orbitron text-slate-400">Min Brightness: {customV}%</span>
                    <input 
                      type="range" min="0" max="100" value={customV} 
                      onChange={(e) => setCustomV(parseInt(e.target.value))}
                      className="accent-neon-blue cursor-pointer hover-target" 
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Tolerance slider */}
            <div className="glass-panel rounded-2xl p-6 border border-white/10 w-full max-w-3xl flex flex-col gap-2 shadow-lg">
              <div className="flex justify-between items-center text-xs font-orbitron text-slate-400">
                <span>CLOAK SENSITIVITY</span>
                <span className="text-neon-pink font-bold">{tolerance}°</span>
              </div>
              <input
                type="range"
                min="5"
                max="90"
                value={tolerance}
                onChange={(e) => setTolerance(parseInt(e.target.value))}
                className="w-full accent-neon-pink cursor-pointer hover-target"
              />
              <span className="text-[10px] text-slate-500 leading-normal font-outfit mt-1">
                Hint: Increase tolerance if parts of the cloak are not fully disappearing. Decrease if details of the room are matching and disappearing.
              </span>
            </div>
          </div>

          {/* Right Column: Instructions */}
          <InstructionsPanel
            title="Invisible Cloak"
            instructions={instructions}
            gestures={gestures}
            tips={tips}
          />
        </div>
      </div>
    </div>
  );
};
export default InvisibleCloak;
