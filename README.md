# AI FunVerse V2 - Client-Side Browser AI Entertainment Platform

AI FunVerse V2 is a high-performance, futuristic AI entertainment platform built from the ground up to execute all machine learning, computer vision, and graphic models **100% inside the user's browser**. 

By replacing standard server-side computer vision libraries (such as Flask + OpenCV `cv2.VideoCapture()`) with client-side WebRTC, HTML5 Canvas, and Google MediaPipe WASM bindings, the entire project builds to a set of static files that can be **deployed to Vercel instantly without any configuration**.

---

## 🔮 Key Vision Experiences

1. **Harry Potter Invisible Cloak:** Capture an empty background, hold up a red cloth, and witness real-time wizarding invisibility using advanced canvas edge feathering and lighting metric calibration.
2. **Neon Air Drawing:** Draw glowing neon streaks in mid-air. Use pinch gesture metrics to pan, scale, and rotate your air drawing, and peace-sign gestures to erase strokes.
3. **Color Ball Hunter:** Pop falling circles using collision detection on finger tips (index/middle). Maintain combo streaks, manage hearts/lives, and compete in the local leaderboard.
4. **Rock Paper Scissors:** Engage in a hand gesture duel against a cybernetic AI. Employs neural shape checks to freeze rock, paper, and scissors states on countdown.
5. **Avengers AR Studio:** Project procedural 2D face mesh overlays (Iron Man HUD, squint-reactive Spider-Man lenses, Captain America spinning corner shield, Black Panther vibranium grid & aura).
6. **Fun Effects Lab:** Tab between a 3D WebGL Particle Sphere (3000 nodes reacting to pinch explosions in Three.js), Neon Elastic Hand Strings, and a Strange Portal expanding with finger spread.
7. **Live Webcam Puzzle:** scrambles your camera feed into M x N jigsaw shards. Pinch and drag moving video pieces into place to complete the puzzle.

---

## 🛠️ Technology Stack

* **Core:** React, Vite, TypeScript, React Router
* **Styles:** Tailwind CSS v4, Framer Motion (micro-animations), Cyberpunk glassmorphism, Neon glow overlays
* **Vision & Graphics:** Google MediaPipe (Hand Landmarker, Face Landmarker), HTML5 Canvas, WebGL, Three.js
* **Sound Effects:** Procedural Audio Synthesis via browser native **Web Audio API**
* **Persistence:** HTML5 Local Storage

---

## 🚀 Getting Started

### 1. Installation Guide

To configure the project on your local workstation:

```bash
# 1. Clone the project and navigate to the directory
cd AIFUN

# 2. Install all development & runtime dependencies
npm install
```

### 2. Development Guide

To start the Vite hot-reloading development server:

```bash
# Start local server
npm run dev
```

Open your browser and navigate to `http://localhost:5173`. Make sure to grant webcam permissions when prompted!

### 3. Production Build Guide

To compile a highly optimized static bundle ready for distribution:

```bash
# Verify TypeScript types and compile build assets
npm run build
```

The resulting assets will be created in the `dist/` directory. You can preview the production bundle locally:

```bash
# Preview build output
npm run preview
```

---

## 📦 Vercel Deployment Guide

AI FunVerse V2 is completely static, with no Python or Flask backend requirements. This makes deploying to Vercel trivial:

### Option A: Using the Vercel CLI (Recommended)

1. Install the Vercel CLI globally:
   ```bash
   npm install -g vercel
   ```
2. Log in and deploy from the project root:
   ```bash
   vercel
   ```
3. Follow the prompts (use default settings for Vite/React).
4. Run production deployment:
   ```bash
   vercel --prod
   ```

### Option B: Using GitHub Integration

1. Push your code to a GitHub repository.
2. Go to the [Vercel Dashboard](https://vercel.com).
3. Click **Add New** > **Project** and import your repository.
4. Vercel will automatically detect **Vite** as the framework.
5. Click **Deploy**. Vercel will build the React bundle and deploy it globally on their Edge network.

---

## ⚙️ Performance Tuning & Diagnostics

* **60 FPS Target:** Models are loaded lazily and cached globally. Moving between experiences will **not** reload or re-download model tasks from the CDN.
* **Lighting Calibration:** The cloner tracks relative brightness. If your surroundings are too dark, turn on ambient lights to ensure high-fidelity face/hand landmark matching.
