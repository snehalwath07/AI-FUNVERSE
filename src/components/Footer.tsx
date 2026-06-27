import React from 'react';

export const Footer: React.FC = () => {
  return (
    <footer className="w-full mt-auto py-8 px-6 glass-panel border-t border-white/10">
      <div className="max-w-6xl mx-auto flex flex-col items-center justify-center text-center gap-2">
        <p className="text-xs text-slate-500 font-outfit">
          &copy; 2026 AI FunVerse
        </p>
        <p className="text-xs text-slate-400 font-outfit">
          Made with ❤️ for fun, creativity and interactive experiences.
        </p>
      </div>
    </footer>
  );
};
export default Footer;
