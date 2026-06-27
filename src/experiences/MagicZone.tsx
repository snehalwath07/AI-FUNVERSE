import React, { useRef, useState, useEffect } from 'react';
import CameraManager from '../components/CameraManager';
import InstructionsPanel from '../components/InstructionsPanel';
import { useHandLandmarker } from '../hooks/useMediaPipe';
import { RefreshCw, Maximize2, Minimize2, ArrowLeft, Volume2, VolumeX } from 'lucide-react';
import { playSpell, playClick } from '../utils/audio';
import { LandmarkSmoother, mapLandmark } from '../utils/tracking';
import { useNavigate } from 'react-router-dom';
import * as THREE from 'three';
import confetti from 'canvas-confetti';

type Point = { x: number; y: number };

// Web Audio API Procedural Synthesizer for Magic Sounds
class MagicAudioSynth {
  private ctx: AudioContext | null = null;
  private ambientOsc: OscillatorNode | null = null;
  private ambientGain: GainNode | null = null;
  private chargeOsc: OscillatorNode | null = null;
  private muted = false;

  constructor() {
    // Lazy initialized on first user interaction
  }

  private initContext() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  setMuted(muted: boolean) {
    this.muted = muted;
    if (muted) {
      this.stopAmbient();
      this.stopCharge();
    } else {
      this.startAmbient();
    }
  }

  startAmbient() {
    if (this.muted) return;
    try {
      this.initContext();
      if (this.ambientOsc) return;

      const ctx = this.ctx!;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const filter = ctx.createBiquadFilter();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(55, ctx.currentTime); // Low bass rumble

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(120, ctx.currentTime);

      gain.gain.setValueAtTime(0.04, ctx.currentTime);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      this.ambientOsc = osc;
      this.ambientGain = gain;
    } catch (e) {
      console.warn("Audio Context init failed:", e);
    }
  }

  stopAmbient() {
    if (this.ambientOsc) {
      try {
        this.ambientOsc.stop();
        this.ambientOsc.disconnect();
      } catch (e) {}
      this.ambientOsc = null;
      this.ambientGain = null;
    }
  }

  setAmbientPower(intensity: number) {
    if (this.muted || !this.ambientOsc || !this.ambientGain) return;
    const ctx = this.ctx!;
    // Pitch shift hum with energy intensity
    this.ambientOsc.frequency.setTargetAtTime(55 + intensity * 40, ctx.currentTime, 0.1);
    this.ambientGain.gain.setTargetAtTime(0.04 + intensity * 0.08, ctx.currentTime, 0.1);
  }

  startCharge() {
    if (this.muted) return;
    try {
      this.initContext();
      if (this.chargeOsc) return;

      const ctx = this.ctx!;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(200, ctx.currentTime); // Start low pitch

      gain.gain.setValueAtTime(0.01, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.12, ctx.currentTime + 1.5);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      this.chargeOsc = osc;
    } catch (e) {}
  }

  updateChargePitch(progress: number) {
    if (this.muted || !this.chargeOsc) return;
    const ctx = this.ctx!;
    // Ramp frequency up exponentially during pinch charging
    const pitch = 200 + progress * 600; // up to 800Hz
    this.chargeOsc.frequency.setTargetAtTime(pitch, ctx.currentTime, 0.05);
  }

  stopCharge() {
    if (this.chargeOsc) {
      try {
        this.chargeOsc.stop();
        this.chargeOsc.disconnect();
      } catch (e) {}
      this.chargeOsc = null;
    }
  }

  playExplosion() {
    if (this.muted) return;
    try {
      this.initContext();
      const ctx = this.ctx!;

      // White Noise buffer for thunder rumbling
      const bufferSize = ctx.sampleRate * 2.0; // 2 seconds
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }

      const noiseNode = ctx.createBufferSource();
      noiseNode.buffer = buffer;

      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(300, ctx.currentTime);
      filter.frequency.exponentialRampToValueAtTime(30, ctx.currentTime + 1.8);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.35, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.9);

      noiseNode.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      noiseNode.start();
    } catch (e) {}
  }

  playPinchRelease() {
    if (this.muted) return;
    try {
      this.initContext();
      const ctx = this.ctx!;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(110, ctx.currentTime + 0.5);

      gain.gain.setValueAtTime(0.18, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.45);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.5);
    } catch (e) {}
  }
}

// Swirling Noise GLSL Vertex & Fragment Shaders
const PortalVertexShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const PortalFragmentShader = `
  uniform float time;
  uniform float energy;
  varying vec2 vUv;

  // GLSL 2D Noise
  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
  }
  
  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f*f*(3.0-2.0*f);
    return mix(mix(hash(i + vec2(0.0,0.0)), hash(i + vec2(1.0,0.0)), u.x),
               mix(hash(i + vec2(0.0,1.0)), hash(i + vec2(1.0,1.0)), u.x), u.y);
  }

  void main() {
    vec2 uv = vUv - vec2(0.5);
    float r = length(uv);
    float angle = atan(uv.y, uv.x);

    if (r > 0.5) discard;

    // Swirling coordinates
    float swirl = angle + r * 16.0 - time * 3.5;
    vec2 coord = vec2(cos(swirl), sin(swirl)) * r * 9.0;
    float n = noise(coord + vec2(time * 0.5));

    // Swirl opacity masking
    float alpha = smoothstep(0.5, 0.42, r) * (0.35 + n * 0.65);

    // Glowing amber to gold gradient colors
    vec3 innerColor = vec3(1.0, 0.82, 0.25); // Golden-gold
    vec3 outerColor = vec3(1.0, 0.38, 0.0);  // Dark orange
    vec3 finalColor = mix(outerColor, innerColor, n * (1.0 - r * 2.0));

    // Pinch energy charge boost overlay
    finalColor += vec3(0.5, 0.15, 0.0) * energy;

    gl_FragColor = vec4(finalColor, alpha);
  }
`;

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  alpha: number;
  life: number;
  maxLife: number;
};

export const MagicZone: React.FC = () => {
  const navigate = useNavigate();
  const { model: handLandmarker, loading: modelLoading, error: modelError } = useHandLandmarker();

  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [energyMeter, setEnergyMeter] = useState<number>(0);
  const [gestureStatus, setGestureStatus] = useState<string>('AWAITING HANDS...');

  // Audio Synthesizer
  const audioSynthRef = useRef<MagicAudioSynth>(new MagicAudioSynth());

  // Three.js containers
  const containerRef = useRef<HTMLDivElement | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  
  // Three.js objects
  const portalMeshRef = useRef<THREE.Mesh | null>(null);
  const ringMeshRef1 = useRef<THREE.Mesh | null>(null);
  const ringMeshRef2 = useRef<THREE.Mesh | null>(null);
  const sparksPointsRef = useRef<THREE.Points | null>(null);

  // Particle positions & velocities refs
  const sparkParticlesRef = useRef<{
    pos: THREE.Vector3;
    vel: THREE.Vector3;
    originalAngle: number;
    orbitRadius: number;
    orbitSpeed: number;
  }[]>([]);

  // Canvas particle overlay
  const particlesRef = useRef<Particle[]>([]);

  // Interactive Refs
  const portalTargetPosRef = useRef<THREE.Vector3>(new THREE.Vector3(0, 0, 0));
  const portalCurrentPosRef = useRef<THREE.Vector3>(new THREE.Vector3(0, 0, 0));
  const portalTargetScaleRef = useRef<number>(1.0);
  const portalCurrentScaleRef = useRef<number>(0.0);
  const portalTargetRotationRef = useRef<number>(0.0);
  const portalCurrentRotationRef = useRef<number>(0.0);



  // States
  const portalExplodedRef = useRef<boolean>(false);
  const explosionTimerRef = useRef<number>(0);
  const energyLevelRef = useRef<number>(0); // 0 to 1
  const isPinchingRef = useRef<boolean>(false);
  const lastClapTimeRef = useRef<number>(0);

  // Landmark smoothers
  const leftSmoother = useRef<LandmarkSmoother>(new LandmarkSmoother(0.20));
  const rightSmoother = useRef<LandmarkSmoother>(new LandmarkSmoother(0.20));

  // Particle explosion speed controller
  const handSpeedRef = useRef<number>(0);

  const toggleFullscreen = () => {
    playClick();
    const elem = document.getElementById('camera-view-container');
    if (!elem) return;

    if (!isFullscreen) {
      if (elem.requestFullscreen) elem.requestFullscreen();
      setIsFullscreen(true);
    } else {
      if (document.exitFullscreen) document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  const resetPortal = () => {
    playClick();
    setEnergyMeter(0);
    energyLevelRef.current = 0;
    portalExplodedRef.current = false;
    explosionTimerRef.current = 0;
    portalCurrentScaleRef.current = 0.0;
    portalTargetScaleRef.current = 0.0;
    particlesRef.current = [];
    confetti({ particleCount: 20 });
  };

  // Clean elements on mount/unmount
  useEffect(() => {
    audioSynthRef.current.setMuted(isMuted);
    return () => {
      audioSynthRef.current.stopAmbient();
      audioSynthRef.current.stopCharge();
    };
  }, [isMuted]);

  // --- PROCEDURAL RUNIC CIRCLE TEXTURE GENERATION ---
  const generateRunicTexture = (isOuter: boolean): THREE.CanvasTexture => {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d')!;

    const cx = 256;
    const cy = 256;

    // Glowing parameters
    ctx.shadowBlur = 10;
    ctx.shadowColor = '#ff5f00';
    ctx.strokeStyle = '#ff5f00';
    ctx.fillStyle = '#ff5f00';

    if (isOuter) {
      // Outer Concentric lines
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(cx, cy, 230, 0, Math.PI * 2);
      ctx.stroke();

      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(cx, cy, 218, 0, Math.PI * 2);
      ctx.stroke();

      // Write fantasy procedural runes around perimeter
      ctx.font = 'bold 20px Courier New';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const runes = ["🎴", "🀄", "🌀", "🔮", "⚜️", "✴️", "❂", "✦", "⚔️", "⚙️", "⚒️", "⚓", "⚡", "🔥", "❄️", "🌪️"];
      for (let i = 0; i < 16; i++) {
        const angle = (i * Math.PI * 2) / 16;
        const rx = cx + Math.cos(angle) * 196;
        const ry = cy + Math.sin(angle) * 196;

        ctx.save();
        ctx.translate(rx, ry);
        ctx.rotate(angle + Math.PI/2);
        ctx.fillText(runes[i % runes.length], 0, 0);
        ctx.restore();
      }
    } else {
      // Inner dashed lines
      ctx.lineWidth = 2.5;
      ctx.setLineDash([8, 12]);
      ctx.beginPath();
      ctx.arc(cx, cy, 140, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);

      // Inner thin circles
      ctx.lineWidth = 1.0;
      ctx.beginPath();
      ctx.arc(cx, cy, 130, 0, Math.PI * 2);
      ctx.stroke();
    }

    const texture = new THREE.CanvasTexture(canvas);
    return texture;
  };

  // --- THREE.JS INITIALIZATION ---
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // 1. Scene & Camera setup
    const scene = new THREE.Scene();
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(50, container.clientWidth / container.clientHeight, 0.1, 1000);
    camera.position.z = 240;
    cameraRef.current = camera;

    // 2. WebGL Renderer
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // 3. GLSL Portal Swirl Vortex
    const vortexGeo = new THREE.PlaneGeometry(160, 160);
    const vortexMat = new THREE.ShaderMaterial({
      vertexShader: PortalVertexShader,
      fragmentShader: PortalFragmentShader,
      uniforms: {
        time: { value: 0.0 },
        energy: { value: 0.0 }
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });
    const portalMesh = new THREE.Mesh(vortexGeo, vortexMat);
    scene.add(portalMesh);
    portalMeshRef.current = portalMesh;

    // 4. Concentric Runic Rings
    const ringGeo1 = new THREE.PlaneGeometry(200, 200);
    const ringMat1 = new THREE.MeshBasicMaterial({
      map: generateRunicTexture(true),
      transparent: true,
      opacity: 0.75,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    const ringMesh1 = new THREE.Mesh(ringGeo1, ringMat1);
    scene.add(ringMesh1);
    ringMeshRef1.current = ringMesh1;

    const ringGeo2 = new THREE.PlaneGeometry(125, 125);
    const ringMat2 = new THREE.MeshBasicMaterial({
      map: generateRunicTexture(false),
      transparent: true,
      opacity: 0.80,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    const ringMesh2 = new THREE.Mesh(ringGeo2, ringMat2);
    scene.add(ringMesh2);
    ringMeshRef2.current = ringMesh2;

    // 5. 5000-Spark Particle System setup
    const particleCount = 5000;
    const sparkGeo = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);

    // Dynamic shapes texture for points
    const sparkCanvas = document.createElement('canvas');
    sparkCanvas.width = 16;
    sparkCanvas.height = 16;
    const ctxTex = sparkCanvas.getContext('2d')!;
    const grad = ctxTex.createRadialGradient(8, 8, 0, 8, 8, 8);
    grad.addColorStop(0, 'rgba(255, 255, 255, 1.0)');
    grad.addColorStop(0.3, 'rgba(255, 120, 0, 0.8)');
    grad.addColorStop(1.0, 'rgba(0, 0, 0, 0.0)');
    ctxTex.fillStyle = grad;
    ctxTex.beginPath();
    ctxTex.arc(8, 8, 8, 0, Math.PI * 2);
    ctxTex.fill();
    const pointTexture = new THREE.CanvasTexture(sparkCanvas);

    const sparkMat = new THREE.PointsMaterial({
      size: 4.2,
      map: pointTexture,
      transparent: true,
      blending: THREE.AdditiveBlending,
      vertexColors: true,
      depthWrite: false
    });

    const particlesList: any[] = [];

    for (let i = 0; i < particleCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const orbitR = 50 + Math.random() * 45;
      
      const x = Math.cos(angle) * orbitR;
      const y = Math.sin(angle) * orbitR;
      const z = (Math.random() - 0.5) * 10;

      positions[i * 3] = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = z;

      // Color orange/gold
      const colorHSL = new THREE.Color();
      colorHSL.setHSL(0.04 + Math.random() * 0.08, 1.0, 0.55);
      colors[i * 3] = colorHSL.r;
      colors[i * 3 + 1] = colorHSL.g;
      colors[i * 3 + 2] = colorHSL.b;

      particlesList.push({
        pos: new THREE.Vector3(x, y, z),
        vel: new THREE.Vector3(0, 0, 0),
        originalAngle: angle,
        orbitRadius: orbitR,
        orbitSpeed: 0.02 + Math.random() * 0.035
      });
    }

    sparkGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    sparkGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const sparksPoints = new THREE.Points(sparkGeo, sparkMat);
    scene.add(sparksPoints);
    
    sparksPointsRef.current = sparksPoints;
    sparkParticlesRef.current = particlesList;

    // Animation Loop
    let animId: number;
    let clock = new THREE.Clock();

    const tick = () => {
      animId = requestAnimationFrame(tick);
      
      clock.getDelta();
      const time = clock.getElapsedTime();

      // Update GLSL shader clock
      vortexMat.uniforms.time.value = time;
      vortexMat.uniforms.energy.value = energyLevelRef.current;

      // Rotate runic meshes
      if (ringMesh1) ringMesh1.rotation.z = -time * 0.15;
      if (ringMesh2) ringMesh2.rotation.z = time * 0.35;

      // Rotate portal mesh slowly
      if (portalMesh) portalMesh.rotation.z = time * 0.06;

      // Interpolate portal scale and coords
      portalCurrentScaleRef.current += (portalTargetScaleRef.current - portalCurrentScaleRef.current) * 0.08;
      portalCurrentRotationRef.current += (portalTargetRotationRef.current - portalCurrentRotationRef.current) * 0.08;
      
      const nextPos = portalCurrentPosRef.current.lerp(portalTargetPosRef.current, 0.08);

      // Apply transforms to portal and rings
      const activeScale = portalCurrentScaleRef.current;
      [portalMesh, ringMesh1, ringMesh2].forEach(mesh => {
        if (mesh) {
          mesh.position.copy(nextPos);
          mesh.scale.setScalar(activeScale);
          mesh.rotation.z += portalCurrentRotationRef.current * 0.01;
        }
      });

      // Update 5000 Particles Physics (orbiting/exploding)
      const sparkGeom = sparksPoints.geometry;
      const positionsArr = sparkGeom.attributes.position.array as Float32Array;
      const colorsArr = sparkGeom.attributes.color.array as Float32Array;

      const isExploded = portalExplodedRef.current;
      
      if (isExploded) {
        explosionTimerRef.current += 1.0;
        if (explosionTimerRef.current > 160) {
          // Slowly reform portal after 3 seconds
          portalExplodedRef.current = false;
          explosionTimerRef.current = 0;
          confetti({ particleCount: 50, spread: 40 }); // celebratory reform pop
        }
      }

      for (let i = 0; i < particleCount; i++) {
        const p = particlesList[i];
        
        if (isExploded) {
          // Outward explosion drift
          p.pos.add(p.vel);
          p.vel.multiplyScalar(0.965); // air resistance friction
          
          positionsArr[i * 3] = p.pos.x;
          positionsArr[i * 3 + 1] = p.pos.y;
          positionsArr[i * 3 + 2] = p.pos.z;
        } else {
          // Standard circular orbit (following portal coordinates)
          p.originalAngle += p.orbitSpeed * (1.0 + energyLevelRef.current * 2.0 + handSpeedRef.current * 0.05);
          
          // Orbital center position (maps to portal center)
          const targetOrbitX = nextPos.x + Math.cos(p.originalAngle) * p.orbitRadius * activeScale;
          const targetOrbitY = nextPos.y + Math.sin(p.originalAngle) * p.orbitRadius * activeScale;

          // Spring physics pull particles back home
          p.pos.x += (targetOrbitX - p.pos.x) * 0.12;
          p.pos.y += (targetOrbitY - p.pos.y) * 0.12;
          p.pos.z += (nextPos.z - p.pos.z) * 0.12;

          positionsArr[i * 3] = p.pos.x;
          positionsArr[i * 3 + 1] = p.pos.y;
          positionsArr[i * 3 + 2] = p.pos.z;

          // Velocity is initialized here for claps
          p.vel.set(
            Math.cos(p.originalAngle) * (3.5 + Math.random() * 4.5),
            Math.sin(p.originalAngle) * (3.5 + Math.random() * 4.5),
            (Math.random() - 0.5) * 2
          );
        }

        // Color shifts: particle glows brighter and shifts golden on energy charge
        const colVal = 0.04 + energyLevelRef.current * 0.05;
        const colorHSL = new THREE.Color().setHSL(colVal, 1.0, 0.55 + energyLevelRef.current * 0.25);
        colorsArr[i * 3] = colorHSL.r;
        colorsArr[i * 3 + 1] = colorHSL.g;
        colorsArr[i * 3 + 2] = colorHSL.b;
      }

      sparkGeom.attributes.position.needsUpdate = true;
      sparkGeom.attributes.color.needsUpdate = true;

      // Render scene
      renderer.render(scene, camera);
    };
    tick();

    // Resize Handler
    const handleResize = () => {
      if (!container || !renderer || !camera) return;
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
      if (renderer.domElement && container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
      vortexGeo.dispose();
      vortexMat.dispose();
      ringGeo1.dispose();
      ringMat1.dispose();
      ringGeo2.dispose();
      ringMat2.dispose();
      sparkGeo.dispose();
      sparkMat.dispose();
      pointTexture.dispose();
    };
  }, []);

  // --- TRIGGER PORTAL EXPLOSION (ON CLAP) ---
  const explodePortal = () => {
    const now = performance.now();
    if (now - lastClapTimeRef.current < 2000) return; // Prevent double clap triggers
    lastClapTimeRef.current = now;

    playSpell(); // pop sound
    audioSynthRef.current.playExplosion();
    portalExplodedRef.current = true;
    explosionTimerRef.current = 0;
    portalCurrentScaleRef.current = 0.05; // shrink vortex
    setEnergyMeter(0);
    energyLevelRef.current = 0;

    // Confetti blast
    confetti({
      particleCount: 150,
      spread: 90,
      origin: { y: 0.6 }
    });
  };

  // --- CORE FRAME PROCESSING ---
  const handleFrame = (video: HTMLVideoElement, canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D) => {
    const width = canvas.width;
    const height = canvas.height;

    // Retrieve hand landmarks
    let allLandmarks: any[] = [];
    if (handLandmarker) {
      const results = handLandmarker.detectForVideo(video, performance.now());
      if (results && results.landmarks && results.landmarks.length > 0) {
        allLandmarks = results.landmarks;
      }
    }

    // Process Hand Cursors
    let hand1: Point | null = null;
    let hand2: Point | null = null;
    
    let hand1Raw: any = null;
    let hand2Raw: any = null;

    let leftPinch = false;
    let rightPinch = false;

    if (allLandmarks.length > 0) {
      hand1Raw = allLandmarks[0];
      const mapped1 = mapLandmark(hand1Raw[9], width, height, true); // track palm center (landmark 9)
      hand1 = leftSmoother.current.smooth(mapped1.x, mapped1.y);

      // Check pinch
      const d1 = Math.sqrt((hand1Raw[8].x - hand1Raw[4].x)**2 + (hand1Raw[8].y - hand1Raw[4].y)**2);
      leftPinch = d1 < 0.045;

      if (allLandmarks.length > 1) {
        hand2Raw = allLandmarks[1];
        const mapped2 = mapLandmark(hand2Raw[9], width, height, true);
        hand2 = rightSmoother.current.smooth(mapped2.x, mapped2.y);
        
        const d2 = Math.sqrt((hand2Raw[8].x - hand2Raw[4].x)**2 + (hand2Raw[8].y - hand2Raw[4].y)**2);
        rightPinch = d2 < 0.045;
      }
    } else {
      leftSmoother.current.reset();
      rightSmoother.current.reset();
    }

    // Hand tracking diagnostics
    audioSynthRef.current.startAmbient();

    // Map 2D Coordinates into WebGL Scene space (-100 to 100 range)
    const mapToWebGL = (pt: Point) => {
      const glX = ((pt.x / width) * 2 - 1) * 110;
      const glY = -((pt.y / height) * 2 - 1) * 80;
      return new THREE.Vector3(glX, glY, 0);
    };

    if (hand1 && hand2) {
      setGestureStatus('PORTAL INITIALIZED');
      
      // Calculate mid point
      const midPoint2D = {
        x: (hand1.x + hand2.x) / 2,
        y: (hand1.y + hand2.y) / 2
      };
      
      // Target position
      portalTargetPosRef.current.copy(mapToWebGL(midPoint2D));

      // Hands distance adjusts target scale
      const dist = Math.sqrt((hand1.x - hand2.x)**2 + (hand1.y - hand2.y)**2);
      const targetScale = Math.max(0.2, Math.min(2.0, dist / 190));
      portalTargetScaleRef.current = targetScale;

      // Hands slope angle adjusts portal rotation orientation
      const angle = Math.atan2(hand2.y - hand1.y, hand2.x - hand1.x);
      portalTargetRotationRef.current = angle;

      // Clap detection check
      // A clap triggers if hands get very close and approach velocity is fast
      const clapDist = dist;
      if (clapDist < 58 && !portalExplodedRef.current) {
        explodePortal();
        return;
      }

      // Pinch Energy Charging Checks
      const pinching = leftPinch || rightPinch;
      if (pinching && !portalExplodedRef.current) {
        isPinchingRef.current = true;
        setGestureStatus('CHARGING MAGICAL ENERGY');
        audioSynthRef.current.startCharge();

        // Increment Energy Meter
        const nextEnergy = Math.min(100, energyMeter + 1.2);
        setEnergyMeter(nextEnergy);
        energyLevelRef.current = nextEnergy / 100;
        audioSynthRef.current.updateChargePitch(nextEnergy / 100);

        // Draw electrical energy arcs on canvas connecting fingers to portal center
        ctx.save();
        ctx.shadowBlur = 15;
        ctx.strokeStyle = '#facc15';
        ctx.shadowColor = '#facc15';
        ctx.lineWidth = 2.0;

        const drawArc = (fPt: Point) => {
          ctx.beginPath();
          ctx.moveTo(fPt.x, fPt.y);
          let cx = fPt.x;
          let cy = fPt.y;
          const segments = 4;
          const dx = (midPoint2D.x - fPt.x) / segments;
          const dy = (midPoint2D.y - fPt.y) / segments;

          for (let i = 0; i < segments; i++) {
            cx += dx + (Math.random() - 0.5) * 22;
            cy += dy + (Math.random() - 0.5) * 22;
            ctx.lineTo(cx, cy);
          }
          ctx.lineTo(midPoint2D.x, midPoint2D.y);
          ctx.stroke();
        };

        if (leftPinch && hand1Raw) {
          const thumbMapped = mapLandmark(hand1Raw[4], width, height, true);
          drawArc(thumbMapped);
        }
        if (rightPinch && hand2Raw) {
          const thumbMapped2 = mapLandmark(hand2Raw[4], width, height, true);
          drawArc(thumbMapped2);
        }
        ctx.restore();

      } else {
        // Released pinch -> Trigger shockwave blast!
        if (isPinchingRef.current) {
          isPinchingRef.current = false;
          audioSynthRef.current.stopCharge();
          audioSynthRef.current.playPinchRelease();
          setGestureStatus('ENERGY BLAST!');

          // Temporarily expand portal size and create radial blast particles
          portalCurrentScaleRef.current = portalTargetScaleRef.current * 1.5;
          
          // Spawn shockwave ring particles
          const cx = midPoint2D.x;
          const cy = midPoint2D.y;
          for (let i = 0; i < 25; i++) {
            const rot = (i * Math.PI * 2) / 25;
            particlesRef.current.push({
              x: cx,
              y: cy,
              vx: Math.cos(rot) * 6,
              vy: Math.sin(rot) * 6,
              size: 3 + Math.random() * 4,
              color: '#facc15',
              alpha: 1,
              life: 0,
              maxLife: 35
            });
          }

          // Slowly decay Energy Meter
          const decayTimer = setInterval(() => {
            setEnergyMeter(prev => {
              const next = Math.max(0, prev - 10);
              energyLevelRef.current = next / 100;
              if (next <= 0) clearInterval(decayTimer);
              return next;
            });
          }, 80);
        }
      }

      // Sync intensity of sound hum
      audioSynthRef.current.setAmbientPower(energyLevelRef.current);

    } else if (hand1) {
      setGestureStatus('RAISE BOTH HANDS');
      
      // If only one hand, portal slowly drifts to hand center and shrinks
      portalTargetPosRef.current.copy(mapToWebGL(hand1));
      portalTargetScaleRef.current = 0.05; // close/shrink portal
      audioSynthRef.current.setAmbientPower(0);
    } else {
      setGestureStatus('WAITING FOR HANDS...');
      portalTargetScaleRef.current = 0.0;
      audioSynthRef.current.setAmbientPower(0);
    }

    // Render Canvas overlay particles (for shockwaves)
    const activeCanvasParticles: Particle[] = [];
    particlesRef.current.forEach((p) => {
      p.x += p.vx;
      p.y += p.vy;
      p.life++;
      p.alpha = 1.0 - (p.life / p.maxLife);

      if (p.alpha > 0) {
        ctx.save();
        ctx.globalAlpha = p.alpha;
        ctx.fillStyle = p.color;
        ctx.shadowBlur = 12;
        ctx.shadowColor = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        activeCanvasParticles.push(p);
      }
    });
    particlesRef.current = activeCanvasParticles;

    // Draw fingertip pointers for alignment HUD
    if (hand1) {
      ctx.fillStyle = '#ff007f';
      ctx.beginPath();
      ctx.arc(hand1.x, hand1.y, 4, 0, Math.PI*2);
      ctx.fill();
    }
    if (hand2) {
      ctx.fillStyle = '#00f0ff';
      ctx.beginPath();
      ctx.arc(hand2.x, hand2.y, 4, 0, Math.PI*2);
      ctx.fill();
    }
  };

  const toggleMute = () => {
    playClick();
    setIsMuted(prev => !prev);
  };

  const instructions = [
    "Summon: Raise both hands. The portal forms between your palms.",
    "Size: Spread hands apart to make the portal grow, and bring them together to shrink it.",
    "Rotate: Tilt your hands to spin the runic rings.",
    "Charge: Pinch your thumb and index finger to charge magical energy.",
    "Release: Let go of the pinch to create an energy blast.",
    "Clap: Clap your hands together to explode the portal into sparks!"
  ];

  const gestures = [
    { gesture: "Raise Both Hands", action: "Summon the portal" },
    { gesture: "Move Hands Apart", action: "Change portal size" },
    { gesture: "Pinch Fingers", action: "Charge energy" },
    { gesture: "Clap Hands", action: "Explode portal" }
  ];

  const tips = [
    "Keep your palms flat facing the camera for the best tracking.",
    "Click the audio volume button to toggle procedural magic sound rumbles.",
    "Click Fullscreen mode for an immersive sorcerer playground experience."
  ];

  return (
    <div className="min-h-[calc(100vh-80px)] py-8 px-4 flex flex-col items-center">
      <div className="max-w-6xl w-full flex flex-col gap-6">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="text-center md:text-left">
            <h1 className="font-orbitron font-black text-3xl md:text-4xl tracking-wider bg-gradient-to-r from-neon-orange via-neon-pink to-neon-purple bg-clip-text text-transparent glow-text-orange">
              MAGIC ZONE
            </h1>
            <p className="text-slate-400 text-sm font-outfit mt-1">
              Create magical portals with your hands.
            </p>
          </div>

          <button
            onClick={() => { playClick(); navigate('/'); }}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-white/80 hover:text-white hover:bg-white/10 font-orbitron text-xs transition-all cursor-pointer hover-target"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Home
          </button>
        </div>

        {/* Workspace */}
        <div className="flex flex-col lg:flex-row gap-6 w-full items-start">
          {/* Left Column: Camera and WebGL canvas */}
          <div className="flex-1 flex flex-col gap-4 w-full">
            <div id="camera-view-container" className="relative rounded-2xl overflow-hidden border border-white/10">
              
              {/* Three.js Container Layer */}
              <div 
                ref={containerRef}
                className="absolute inset-0 z-20 pointer-events-none"
                style={{ width: '100%', height: '100%' }}
              />

              <CameraManager modelLoading={modelLoading} modelError={modelError} onFrame={handleFrame}>
                {/* HUD Overlay inside camera */}
                <div className="absolute top-4 left-4 right-4 flex justify-end items-center pointer-events-none select-none z-10">
                  <div className="px-3 py-1.5 rounded-xl bg-black/60 border border-white/10 backdrop-blur text-[10px] font-orbitron text-neon-orange font-bold uppercase tracking-wider">
                    {gestureStatus}
                  </div>
                </div>

                {/* Energy Meter in bottom center */}
                <div className="absolute bottom-4 left-4 right-4 bg-black/60 backdrop-blur border border-white/10 rounded-xl px-4 py-2.5 flex flex-col gap-1.5 pointer-events-none select-none z-10 max-w-sm mx-auto">
                  <div className="flex justify-between items-center text-[10px] font-orbitron text-slate-400">
                    <span>PORTAL ENERGY</span>
                    <span className="text-neon-orange font-bold">{Math.round(energyMeter)}%</span>
                  </div>
                  <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-neon-orange to-neon-pink transition-all duration-75"
                      style={{ width: `${energyMeter}%` }}
                    />
                  </div>
                </div>
              </CameraManager>
            </div>

            {/* Controls panel */}
            <div className="glass-panel rounded-2xl p-6 border border-white/10 w-full max-w-3xl flex flex-col sm:flex-row gap-4 items-center justify-between shadow-lg">
              <div className="flex flex-col gap-1">
                <span className="text-xs font-orbitron text-slate-400">Portal Status</span>
                <span className="text-sm font-outfit text-slate-300">
                  {portalExplodedRef.current ? 'Portal exploded! Re-forming...' : 'Portal active. Control it with your hands.'}
                </span>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={toggleMute}
                  className="flex items-center justify-center p-2.5 rounded-xl bg-white/5 border border-white/10 text-white/80 hover:text-white hover:bg-white/10 font-orbitron text-xs transition-all cursor-pointer hover-target"
                  title={isMuted ? "Unmute portal" : "Mute portal"}
                >
                  {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                </button>
                <button
                  onClick={resetPortal}
                  className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white/80 hover:text-white hover:bg-white/10 font-orbitron text-xs transition-all cursor-pointer hover-target"
                >
                  <RefreshCw className="w-4 h-4" />
                  Reset
                </button>
                <button
                  onClick={toggleFullscreen}
                  className="flex items-center gap-1.5 px-4 py-2.5 bg-gradient-to-r from-neon-orange to-neon-pink text-white font-orbitron text-xs font-bold rounded-xl hover:scale-105 active:scale-95 transition-all cursor-pointer shadow-md hover-target"
                >
                  {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                  {isFullscreen ? 'Exit' : 'Fullscreen'}
                </button>
              </div>
            </div>
          </div>

          {/* Right Column: Instructions */}
          <InstructionsPanel
            title="Mystic Portal"
            instructions={instructions}
            gestures={gestures}
            tips={tips}
          />
        </div>
      </div>
    </div>
  );
};
export default MagicZone;
