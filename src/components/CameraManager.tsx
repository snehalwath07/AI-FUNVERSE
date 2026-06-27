import React, { useEffect, useRef, useState } from 'react';
import { useWebcam } from '../hooks/useWebcam';
import { Camera, RefreshCw, Maximize2, Minimize2, AlertTriangle, Cpu } from 'lucide-react';
import { playClick } from '../utils/audio';

interface CameraManagerProps {
  modelLoading?: boolean;
  modelError?: string | null;
  onFrame: (video: HTMLVideoElement, canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D) => void;
  children?: React.ReactNode;
}

export const CameraManager: React.FC<CameraManagerProps> = ({
  modelLoading = false,
  modelError = null,
  onFrame,
  children
}) => {
  const { videoRef, permissionGranted, error: webcamError, loading: webcamLoading, requestPermission } = useWebcam();
  
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const requestRef = useRef<number | null>(null);
  
  const [fps, setFps] = useState<number>(0);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [isMirror, setIsMirror] = useState<boolean>(true);
  const [dimensions, setDimensions] = useState<{ width: number; height: number }>({ width: 640, height: 480 });

  // FPS calculations
  const lastTimeRef = useRef<number>(performance.now());
  const frameCountRef = useRef<number>(0);

  const toggleFullscreen = () => {
    playClick();
    if (!containerRef.current) return;

    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().then(() => {
        setIsFullscreen(true);
      }).catch(err => {
        console.error("Error attempting to enable full-screen:", err);
      });
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  // Frame processing loop
  useEffect(() => {
    if (!permissionGranted || webcamLoading || modelLoading) {
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
        requestRef.current = null;
      }
      return;
    }

    const processFrame = () => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas) {
        requestRef.current = requestAnimationFrame(processFrame);
        return;
      }

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        requestRef.current = requestAnimationFrame(processFrame);
        return;
      }

      // Check if video is actually ready
      if (video.readyState === video.HAVE_ENOUGH_DATA) {
        // Dynamic resize check
        if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          setDimensions({ width: video.videoWidth, height: video.videoHeight });
        }

        // Draw and mirror frame
        ctx.save();
        if (isMirror) {
          ctx.translate(canvas.width, 0);
          ctx.scale(-1, 1);
        }
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        ctx.restore();

        // Run the custom frame processor (landmark and overlays)
        onFrame(video, canvas, ctx);

        // Calculate FPS
        frameCountRef.current += 1;
        const now = performance.now();
        const delta = now - lastTimeRef.current;
        if (delta >= 1000) {
          setFps(Math.round((frameCountRef.current * 1000) / delta));
          frameCountRef.current = 0;
          lastTimeRef.current = now;
        }
      }

      requestRef.current = requestAnimationFrame(processFrame);
    };

    requestRef.current = requestAnimationFrame(processFrame);

    return () => {
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
        requestRef.current = null;
      }
    };
  }, [permissionGranted, webcamLoading, modelLoading, onFrame, isMirror]);

  // Handle loading or error screens
  const isSystemLoading = webcamLoading || modelLoading;
  const systemError = webcamError || modelError;

  return (
    <div 
      ref={containerRef} 
      className={`relative flex flex-col items-center justify-center overflow-hidden rounded-2xl border border-white/10 glass-panel shadow-2xl transition-all duration-300 w-full ${
        isFullscreen ? 'h-screen w-screen rounded-none border-none z-50' : 'aspect-video max-w-3xl'
      }`}
      style={{ backgroundColor: '#020205' }}
    >
      {/* Invisible HTML5 video element for streaming */}
      <video
        ref={videoRef}
        className="hidden"
        playsInline
        muted
      />

      {/* Main rendering canvas */}
      {permissionGranted && !isSystemLoading && !systemError && (
        <canvas
          ref={canvasRef}
          className="w-full h-full object-cover canvas-interactive"
        />
      )}

      {/* Loading Overlay */}
      {isSystemLoading && !systemError && (
        <div className="absolute inset-0 bg-cyber-dark/95 flex flex-col items-center justify-center p-6 text-center z-20">
          <div className="relative mb-6">
            <div className="w-16 h-16 rounded-full border-2 border-t-neon-blue border-r-neon-pink border-b-transparent border-l-transparent animate-spin"></div>
            <Cpu className="w-6 h-6 text-neon-blue absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
          </div>
          <h3 className="font-orbitron font-bold text-xl tracking-wider glow-text-blue mb-2 animate-pulse">
            PREPARING CAMERA
          </h3>
          <p className="text-sm text-slate-400 font-outfit max-w-sm">
            {webcamLoading ? "Connecting to camera..." : "Loading visual effects..."}
          </p>
        </div>
      )}

      {/* Error Overlay */}
      {systemError && (
        <div className="absolute inset-0 bg-cyber-dark/95 flex flex-col items-center justify-center p-6 text-center z-20">
          <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-500 mb-6 shadow-[0_0_15px_rgba(239,68,68,0.2)]">
            <AlertTriangle className="w-8 h-8" />
          </div>
          <h3 className="font-orbitron font-bold text-xl tracking-wider text-red-500 mb-3 uppercase">
            Camera Issue Detected
          </h3>
          <p className="text-sm text-slate-300 font-outfit max-w-md mb-6 leading-relaxed">
            {systemError}
          </p>
          <button
            onClick={requestPermission}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-red-500 to-neon-pink text-white font-orbitron text-sm font-bold shadow-lg hover:scale-105 active:scale-95 transition-all duration-300 cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
            TRY AGAIN
          </button>
        </div>
      )}

      {/* Request Permission Screen */}
      {!permissionGranted && !isSystemLoading && !systemError && (
        <div className="absolute inset-0 bg-cyber-dark/80 flex flex-col items-center justify-center p-8 text-center z-10">
          <div className="w-16 h-16 rounded-full bg-neon-blue/10 border border-neon-blue/30 flex items-center justify-center text-neon-blue mb-6 shadow-[0_0_20px_rgba(0,240,255,0.25)] animate-pulse">
            <Camera className="w-8 h-8" />
          </div>
          <h3 className="font-orbitron font-black text-2xl tracking-wider glow-text-blue mb-2">
            CAMERA ACCESS REQUIRED
          </h3>
          <p className="text-sm text-slate-400 font-outfit max-w-sm mb-6 leading-relaxed">
            This experience requires access to your camera to show live visual effects. Your camera stream is processed privately inside your browser.
          </p>
          <button
            onClick={requestPermission}
            className="px-6 py-3 rounded-xl bg-gradient-to-r from-neon-blue to-neon-purple text-white font-orbitron text-sm font-bold tracking-widest shadow-[0_0_15px_rgba(0,240,255,0.4)] hover:scale-105 active:scale-95 transition-all duration-300 cursor-pointer"
          >
            ALLOW CAMERA
          </button>
        </div>
      )}

      {/* Camera HUD Overlays */}
      {permissionGranted && !isSystemLoading && !systemError && (
        <>
          {/* Top Left: FPS and resolution */}
          <div className="absolute top-4 left-4 flex gap-2 z-10 pointer-events-none select-none">
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-black/60 backdrop-blur border border-white/10 text-[10px] font-orbitron text-slate-300">
              <span className="font-bold">FPS:</span>
              <span className={fps > 45 ? "text-neon-green font-black" : fps > 25 ? "text-neon-orange font-black" : "text-red-500 font-black"}>
                {fps}
              </span>
            </div>
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-lg bg-black/60 backdrop-blur border border-white/10 text-[10px] font-orbitron text-slate-400">
              <span>{dimensions.width}x{dimensions.height}</span>
            </div>
          </div>

          {/* Top Right: Mirror & Fullscreen controls */}
          <div className="absolute top-4 right-4 flex gap-2 z-10">
            <button
              onClick={() => { playClick(); setIsMirror(!isMirror); }}
              className={`p-2 rounded-lg bg-black/60 backdrop-blur border text-slate-300 hover:text-white transition-all cursor-pointer ${
                isMirror ? 'border-neon-blue/30 text-neon-blue' : 'border-white/10'
              }`}
              title="Mirror Mode"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <button
              onClick={toggleFullscreen}
              className="p-2 rounded-lg bg-black/60 backdrop-blur border border-white/10 text-slate-300 hover:text-white transition-all cursor-pointer"
              title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
          </div>

          {/* Experience Specific Overlays */}
          <div className="absolute inset-0 pointer-events-none z-10">
            {children}
          </div>
        </>
      )}
    </div>
  );
};
export default CameraManager;
