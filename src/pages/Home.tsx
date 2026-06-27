import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Play, Sparkles, Wand2, Palette, Scissors, Gamepad2, Info, Grid, Rocket } from 'lucide-react';
import { playClick } from '../utils/audio';

type CardDetails = {
  id: string;
  title: string;
  path: string;
  desc: string;
  icon: React.ReactNode;
  colorClass: string;
  glowClass: string;
  previewText: string;
  playLabel: string;
  instructions: string[];
};

export const Home: React.FC = () => {
  const navigate = useNavigate();
  const [activeModalId, setActiveModalId] = useState<string | null>(null);

  const handleLaunch = (path: string) => {
    playClick();
    navigate(path);
  };

  const handleOpenInfo = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    playClick();
    setActiveModalId(id);
  };

  const stats = [
    { value: '6', label: 'EXPERIENCES' },
    { value: 'LIVE', label: 'CAMERA GAMES' },
    { value: 'AI', label: 'POWERED' },
    { value: '100%', label: 'FREE TO PLAY' }
  ];

  const experiences: CardDetails[] = [
    {
      id: 'cloak',
      title: 'Harry Potter',
      path: '/invisible-cloak',
      desc: 'Become invisible using a magical cloak.',
      icon: <Wand2 className="w-8 h-8 text-neon-pink" />,
      colorClass: 'border-neon-pink/20 hover:border-neon-pink/60 text-neon-pink',
      glowClass: 'shadow-[0_0_15px_rgba(255,0,127,0.15)] group-hover:shadow-[0_0_25px_rgba(255,0,127,0.4)]',
      previewText: 'Invisible Cloak',
      playLabel: 'Play Harry Potter',
      instructions: [
        "Capture a clean image of your empty room first.",
        "Hold up a solid red cloth (e.g. blanket or shirt).",
        "Step behind the cloth to make yourself disappear!"
      ]
    },
    {
      id: 'drawing',
      title: '🔮 Neon Air Drawing',
      path: '/neon-drawing',
      desc: 'Draw glowing lines in the air using your finger.',
      icon: <Palette className="w-8 h-8 text-neon-blue" />,
      colorClass: 'border-neon-blue/20 hover:border-neon-blue/60 text-neon-blue',
      glowClass: 'shadow-[0_0_15px_rgba(0,240,255,0.15)] group-hover:shadow-[0_0_25px_rgba(0,240,255,0.4)]',
      previewText: 'Draw in the air using your finger',
      playLabel: 'Play Air Drawing',
      instructions: [
        "Raise your index finger to draw glowing lines in space.",
        "Show index + middle fingers (peace sign) to erase lines.",
        "Pinch thumb and index to pan and move the canvas.",
        "Pinch with both hands to scale and rotate the drawing."
      ]
    },
    {
      id: 'hunter',
      title: '⚡ Color Ball Hunter',
      path: '/ball-hunter',
      desc: 'Pop glowing targets with your fingertip.',
      icon: <Gamepad2 className="w-8 h-8 text-neon-green" />,
      colorClass: 'border-neon-green/20 hover:border-neon-green/60 text-neon-green',
      glowClass: 'shadow-[0_0_15px_rgba(57,255,20,0.15)] group-hover:shadow-[0_0_25px_rgba(57,255,20,0.4)]',
      previewText: 'Pop glowing targets with your fingertip',
      playLabel: 'Play Color Ball Hunter',
      instructions: [
        "Sweep your index finger tip over falling balls.",
        "Pop green spheres for points, blue stars for combo boosts.",
        "Avoid pink bomb spheres! Popping bombs resets combo and costs 1 life."
      ]
    },
    {
      id: 'rps',
      title: '🤖 Rock Paper Scissors',
      path: '/rps-game',
      desc: 'Beat the AI in a five-round match.',
      icon: <Scissors className="w-8 h-8 text-neon-pink" />,
      colorClass: 'border-neon-pink/20 hover:border-neon-pink/60 text-neon-pink',
      glowClass: 'shadow-[0_0_15px_rgba(255,0,127,0.15)] group-hover:shadow-[0_0_25px_rgba(255,0,127,0.4)]',
      previewText: 'Beat the AI in a five-round match',
      playLabel: 'Play Rock Paper Scissors',
      instructions: [
        "Click Start Round to initiate the countdown.",
        "At GO!, show Rock (fist), Paper (flat hand), or Scissors (peace sign).",
        "Play 5 rounds to beat the AI and claim victory!"
      ]
    },
    {
      id: 'effects',
      title: '🌀 Magic Zone',
      path: '/magic-zone',
      desc: 'Create magical portals with your hands.',
      icon: <Sparkles className="w-8 h-8 text-neon-orange" />,
      colorClass: 'border-neon-orange/20 hover:border-neon-orange/60 text-neon-orange',
      glowClass: 'shadow-[0_0_15px_rgba(255,95,0,0.15)] group-hover:shadow-[0_0_25px_rgba(255,95,0,0.4)]',
      previewText: 'Create magical portals with your hands',
      playLabel: 'Play Magic Zone',
      instructions: [
        "Raise both hands to summon the portal between your palms.",
        "Spread hands apart to grow the portal, close them to shrink it.",
        "Rotate your hands relative to each other to rotate the rings.",
        "Pinch to charge magical energy, and release for an energy blast.",
        "Clap hands together to explode the portal into sparks!"
      ]
    },
    {
      id: 'puzzle',
      title: '🧩 Live Puzzle',
      path: '/live-puzzle',
      desc: 'Capture, shuffle and solve your own puzzle.',
      icon: <Grid className="w-8 h-8 text-neon-blue" />,
      colorClass: 'border-neon-blue/20 hover:border-neon-blue/60 text-neon-blue',
      glowClass: 'shadow-[0_0_15px_rgba(0,240,255,0.15)] group-hover:shadow-[0_0_25px_rgba(0,240,255,0.4)]',
      previewText: 'Capture, shuffle and solve your own puzzle',
      playLabel: 'Play Live Puzzle',
      instructions: [
        "Use Left and Right pinches to define a crop selection box.",
        "Hold pinch steady for 1.2s or click Capture to snap.",
        "Drag the scrambled tiles using only your index finger.",
        "Fit all the tiles back into order to win!"
      ]
    }
  ];

  const featured = experiences[0];

  // Grouping experiences by Zones
  const magicZone = experiences.filter(e => e.id === 'cloak' || e.id === 'effects');
  const creativeZone = experiences.filter(e => e.id === 'drawing');
  const gamesZone = experiences.filter(e => e.id === 'hunter' || e.id === 'rps' || e.id === 'puzzle');

  return (
    <div className="relative min-h-[calc(100vh-80px)] py-12 px-6 flex flex-col items-center z-10 grid-bg animate-grid-move overflow-hidden">
      
      {/* Floating System Icons Background */}
      <div className="absolute inset-0 pointer-events-none select-none overflow-hidden z-0">
        <Rocket className="absolute text-slate-700/20 w-12 h-12 left-[10%] top-[20%] animate-bounce duration-5000" />
        <Wand2 className="absolute text-slate-700/20 w-10 h-10 right-[15%] top-[15%] rotate-12 animate-pulse" />
        <Gamepad2 className="absolute text-slate-700/20 w-14 h-14 left-[8%] bottom-[25%] rotate-[-12deg]" />
        <Sparkles className="absolute text-slate-700/20 w-8 h-8 right-[12%] bottom-[20%] animate-pulse" />
      </div>

      {/* Hero Section */}
      <section className="max-w-4xl text-center flex flex-col items-center gap-6 mb-16 mt-4 z-10">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs font-orbitron tracking-widest text-slate-400 select-none">
          <span className="w-2 h-2 rounded-full bg-neon-pink animate-ping"></span>
          PLAY INSTANTLY IN YOUR BROWSER
        </div>
        
        <h1 className="font-orbitron font-black text-4xl sm:text-6xl tracking-tight leading-none text-white select-none">
          ENTER THE
          <span className="block mt-2 bg-gradient-to-r from-neon-pink via-neon-purple to-neon-blue bg-clip-text text-transparent glow-text-pink">
            AI FUNVERSE
          </span>
        </h1>

        <p className="font-outfit text-slate-400 text-sm sm:text-base max-w-xl leading-relaxed">
          Discover fun camera games, magical effects and interactive experiences powered by AI. Play instantly in your browser.
        </p>

        <button
          onClick={() => {
            playClick();
            document.getElementById('explore-arena')?.scrollIntoView({ behavior: 'smooth' });
          }}
          className="px-8 py-3.5 mt-2 rounded-xl bg-gradient-to-r from-neon-blue via-neon-purple to-neon-pink text-white font-orbitron font-bold text-sm tracking-widest hover:scale-105 active:scale-95 hover:shadow-[0_0_20px_rgba(0,240,255,0.5)] transition-all cursor-pointer shadow-lg hover-target"
        >
          EXPLORE EXPERIENCES
        </button>
      </section>

      {/* Stats Section */}
      <section className="max-w-4xl w-full grid grid-cols-2 md:grid-cols-4 gap-4 mb-20 select-none z-10">
        {stats.map((stat, idx) => (
          <div
            key={idx}
            className="glass-panel p-5 rounded-2xl border border-white/5 text-center flex flex-col items-center justify-center hover:border-white/10 transition-colors"
          >
            <span className="font-orbitron font-black text-2xl sm:text-3xl bg-gradient-to-br from-white to-slate-400 bg-clip-text text-transparent">
              {stat.value}
            </span>
            <span className="text-[10px] font-orbitron tracking-widest text-slate-500 mt-1">
              {stat.label}
            </span>
          </div>
        ))}
      </section>

      {/* Featured Experience Banner */}
      <section className="max-w-5xl w-full mb-20 z-10">
        <h2 className="font-orbitron font-bold text-xs tracking-widest text-slate-500 mb-4 text-center md:text-left">
          FEATURED EXPERIENCE
        </h2>
        <div 
          onClick={() => handleLaunch(featured.path)}
          className="relative overflow-hidden rounded-2xl border border-neon-pink/30 bg-cyber-card backdrop-blur-md p-8 md:p-12 flex flex-col md:flex-row items-center gap-8 group cursor-pointer shadow-[0_0_20px_rgba(255,0,127,0.1)] hover:border-neon-pink/70 hover:shadow-[0_0_30px_rgba(255,0,127,0.25)] transition-all duration-500"
        >
          <div className="absolute top-0 right-0 w-64 h-64 bg-neon-pink/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none group-hover:bg-neon-pink/20 transition-all"></div>
          
          <div className="w-16 h-16 md:w-20 md:h-20 rounded-2xl bg-neon-pink/10 border border-neon-pink/30 flex items-center justify-center text-neon-pink shadow-lg shrink-0 group-hover:scale-110 transition-transform duration-500">
            {featured.icon}
          </div>

          <div className="flex-1 text-center md:text-left">
            <span className="text-[10px] font-orbitron font-bold text-neon-pink tracking-widest block mb-1">
              {featured.previewText}
            </span>
            <h3 className="font-orbitron font-black text-2xl md:text-3xl text-white tracking-wide mb-3">
              {featured.title}
            </h3>
            <p className="font-outfit text-slate-400 text-sm md:text-base leading-relaxed max-w-xl">
              {featured.desc}
            </p>
          </div>

          <div className="flex gap-3 shrink-0 w-full md:w-auto flex-col sm:flex-row justify-center z-20">
            <button
              onClick={(e) => handleOpenInfo(featured.id, e)}
              className="flex items-center justify-center gap-1.5 px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white/80 hover:text-white hover:bg-white/10 font-orbitron text-xs font-bold transition-all hover-target"
            >
              <Info className="w-4 h-4" />
              GUIDE
            </button>
            <button
              onClick={() => handleLaunch(featured.path)}
              className="flex items-center justify-center gap-1.5 px-5 py-3 rounded-xl bg-gradient-to-r from-neon-pink to-neon-purple text-white font-orbitron text-xs font-bold tracking-widest shadow-md hover:scale-105 transition-all hover-target"
            >
              <Play className="w-4 h-4 fill-white" />
              {featured.playLabel}
            </button>
          </div>
        </div>
      </section>

      {/* Categorized Experience Sections */}
      <section id="explore-arena" className="max-w-5xl w-full scroll-mt-24 z-10 flex flex-col gap-12">
        
        {/* Category 1: Magic Zone */}
        <div>
          <h2 className="font-orbitron font-black text-sm tracking-widest text-neon-pink glow-text-pink border-b border-white/5 pb-2 mb-6 uppercase flex items-center gap-2">
            <Wand2 className="w-4 h-4" /> THE MAGIC ZONE
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {magicZone.map((exp) => (
              <ExperienceCard key={exp.id} exp={exp} onLaunch={handleLaunch} onOpenInfo={handleOpenInfo} />
            ))}
          </div>
        </div>

        {/* Category 2: Creative Vision Studio */}
        <div>
          <h2 className="font-orbitron font-black text-sm tracking-widest text-neon-blue glow-text-blue border-b border-white/5 pb-2 mb-6 uppercase flex items-center gap-2">
            <Palette className="w-4 h-4" /> CREATIVE VISION STUDIO
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {creativeZone.map((exp) => (
              <ExperienceCard key={exp.id} exp={exp} onLaunch={handleLaunch} onOpenInfo={handleOpenInfo} />
            ))}
          </div>
        </div>

        {/* Category 3: Vision Arcade */}
        <div>
          <h2 className="font-orbitron font-black text-sm tracking-widest text-neon-green glow-text-green border-b border-white/5 pb-2 mb-6 uppercase flex items-center gap-2">
            <Gamepad2 className="w-4 h-4" /> THE VISION ARCADE
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {gamesZone.map((exp) => (
              <ExperienceCard key={exp.id} exp={exp} onLaunch={handleLaunch} onOpenInfo={handleOpenInfo} />
            ))}
          </div>
        </div>



      </section>

      {/* Guide Modals */}
      {activeModalId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm select-none pointer-events-auto">
          {(() => {
            const exp = experiences.find(e => e.id === activeModalId);
            if (!exp) return null;
            return (
              <div className="glass-panel-heavy rounded-2xl border border-white/10 max-w-md w-full p-6 flex flex-col gap-5 shadow-2xl relative">
                <div>
                  <h3 className="font-orbitron font-black text-lg text-white uppercase tracking-wider">
                    {exp.title} Guide
                  </h3>
                  <p className="text-[10px] text-slate-500 font-orbitron tracking-widest mt-1 uppercase">
                    Setup instructions
                  </p>
                </div>

                <div className="space-y-3 font-outfit text-slate-300 text-sm">
                  {exp.instructions.map((ins, idx) => (
                    <div key={idx} className="flex gap-3 items-start leading-relaxed">
                      <span className="w-5 h-5 rounded-full bg-white/5 border border-white/10 flex items-center justify-center font-orbitron text-[10px] text-neon-blue font-bold shrink-0 mt-0.5">
                        {idx + 1}
                      </span>
                      <span>{ins}</span>
                    </div>
                  ))}
                </div>

                <div className="flex gap-3 border-t border-white/5 pt-4 mt-2">
                  <button
                    onClick={() => { playClick(); setActiveModalId(null); }}
                    className="flex-1 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white/80 hover:text-white hover:bg-white/10 font-orbitron text-xs font-bold transition-all cursor-pointer hover-target"
                  >
                    CLOSE
                  </button>
                  <button
                    onClick={() => { setActiveModalId(null); handleLaunch(exp.path); }}
                    className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-neon-blue to-neon-purple text-white font-orbitron text-xs font-bold tracking-widest shadow-md hover:scale-105 transition-all cursor-pointer hover-target"
                  >
                    {exp.playLabel.toUpperCase()}
                  </button>
                </div>
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
};

// Internal reusable card wrapper for readability
interface ExperienceCardProps {
  exp: CardDetails;
  onLaunch: (path: string) => void;
  onOpenInfo: (id: string, e: React.MouseEvent) => void;
}

const ExperienceCard: React.FC<ExperienceCardProps> = ({ exp, onLaunch, onOpenInfo }) => {
  return (
    <div
      onClick={() => onLaunch(exp.path)}
      className={`group flex flex-col justify-between p-6 rounded-2xl border bg-cyber-card/60 backdrop-blur-sm cursor-pointer transition-all duration-300 hover:-translate-y-1 ${exp.colorClass} ${exp.glowClass}`}
    >
      <div className="mb-4">
        <span className="text-[9px] font-orbitron font-bold tracking-widest block mb-1 text-slate-400">
          {exp.previewText}
        </span>
        <h3 className="font-orbitron font-black text-lg text-white tracking-wide mb-2 group-hover:text-inherit">
          {exp.title}
        </h3>
        <p className="font-outfit text-slate-400 text-xs leading-relaxed">
          {exp.desc}
        </p>
      </div>

      <div className="flex gap-2 mt-4 pt-4 border-t border-white/5 z-20">
        <button
          onClick={(e) => onOpenInfo(exp.id, e)}
          className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white/80 hover:text-white hover:bg-white/10 font-orbitron text-[10px] font-bold transition-all hover-target"
        >
          <Info className="w-3.5 h-3.5" />
          GUIDE
        </button>
        <button
          onClick={() => onLaunch(exp.path)}
          className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg bg-white/10 text-white font-orbitron text-[10px] font-bold tracking-widest hover:bg-white/20 transition-all hover-target"
        >
          <Play className="w-3 h-3 fill-white" />
          {exp.playLabel}
        </button>
      </div>
    </div>
  );
};

export default Home;
