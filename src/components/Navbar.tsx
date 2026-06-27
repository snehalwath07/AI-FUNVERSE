import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Volume2, VolumeX, Home, ArrowLeft } from 'lucide-react';
import { isMuted, setMuted, playClick, initAudio } from '../utils/audio';

export const Navbar: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [muted, setMutedState] = useState(isMuted());

  useEffect(() => {
    // Sync local state with initial audio settings
    setMutedState(isMuted());
  }, []);

  const handleMuteToggle = () => {
    initAudio();
    const nextMuted = !muted;
    setMuted(nextMuted);
    setMutedState(nextMuted);
    if (!nextMuted) {
      playClick();
    }
  };

  const goHome = () => {
    initAudio();
    playClick();
    navigate('/');
  };

  const goBack = () => {
    initAudio();
    playClick();
    if (location.pathname !== '/') {
      navigate(-1);
    }
  };

  const isHome = location.pathname === '/';

  return (
    <nav className="sticky top-0 left-0 right-0 z-50 px-6 py-4 glass-panel border-b border-white/10 flex items-center justify-between">
      <div className="flex items-center gap-4">
        {!isHome && (
          <button
            onClick={goBack}
            className="p-2 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 text-neon-blue transition-all duration-300 hover:scale-105 active:scale-95 cursor-pointer"
            title="Go Back"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
        )}
        <button
          onClick={goHome}
          className="flex items-center gap-2 group cursor-pointer"
        >
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-neon-pink to-neon-purple flex items-center justify-center font-bold text-white shadow-[0_0_10px_rgba(255,0,127,0.5)] group-hover:scale-110 transition-transform">
            FV
          </div>
          <span className="font-orbitron font-black text-xl tracking-wider bg-gradient-to-r from-white via-slate-200 to-neon-blue bg-clip-text text-transparent group-hover:glow-text-blue transition-all duration-300">
            AI FUNVERSE
          </span>
        </button>
      </div>

      <div className="flex items-center gap-3">
        {!isHome && (
          <button
            onClick={goHome}
            className="p-2 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 text-white/80 hover:text-white transition-all duration-300 hover:scale-105 active:scale-95 flex items-center gap-2 cursor-pointer"
            title="Home"
          >
            <Home className="w-4 h-4" />
            <span className="text-xs font-orbitron hidden sm:inline">HOME</span>
          </button>
        )}
        <button
          onClick={handleMuteToggle}
          className={`p-2 rounded-lg border transition-all duration-300 hover:scale-105 active:scale-95 flex items-center gap-2 cursor-pointer ${
            muted
              ? 'bg-red-500/10 border-red-500/30 text-red-400 hover:bg-red-500/20'
              : 'bg-neon-green/10 border-neon-green/30 text-neon-green hover:bg-neon-green/20'
          }`}
          title={muted ? 'Unmute Audio' : 'Mute Audio'}
        >
          {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          <span className="text-xs font-orbitron hidden sm:inline">
            {muted ? 'MUTED' : 'SOUND ON'}
          </span>
        </button>
      </div>
    </nav>
  );
};
export default Navbar;
