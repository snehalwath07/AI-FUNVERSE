import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import Home from './pages/Home';
import InvisibleCloak from './experiences/InvisibleCloak';
import NeonAirDrawing from './experiences/NeonAirDrawing';
import ColorBallHunter from './experiences/ColorBallHunter';
import RockPaperScissors from './experiences/RockPaperScissors';
import MagicZone from './experiences/MagicZone';
import LivePuzzle from './experiences/LivePuzzle';
import CustomCursor from './components/CustomCursor';

export const AppContent: React.FC = () => {
  return (
    <div className="relative min-h-screen bg-cyber-dark text-slate-100 flex flex-col font-outfit scanline">
      {/* Global Custom Cursor */}
      <CustomCursor />
      
      {/* Animated Neon Backdrop Orbs */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-neon-pink/5 rounded-full blur-[120px] pointer-events-none z-0"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-neon-blue/5 rounded-full blur-[120px] pointer-events-none z-0"></div>

      {/* Global Navigation */}
      <Navbar />

      {/* App Content Area */}
      <main className="flex-1 flex flex-col z-10 w-full max-w-7xl mx-auto px-4 sm:px-6">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/invisible-cloak" element={<InvisibleCloak />} />
          <Route path="/neon-drawing" element={<NeonAirDrawing />} />
          <Route path="/ball-hunter" element={<ColorBallHunter />} />
          <Route path="/rps-game" element={<RockPaperScissors />} />
          <Route path="/magic-zone" element={<MagicZone />} />
          <Route path="/live-puzzle" element={<LivePuzzle />} />
        </Routes>
      </main>

      {/* Global Footer */}
      <Footer />
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <Router>
      <AppContent />
    </Router>
  );
};

export default App;
