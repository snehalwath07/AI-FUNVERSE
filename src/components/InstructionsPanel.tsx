import React from 'react';
import { Info, Sparkles } from 'lucide-react';

export interface GestureItem {
  gesture: string;
  action: string;
}

export interface InstructionsPanelProps {
  title: string;
  instructions: string[];
  gestures?: GestureItem[];
  tips?: string[];
}

export const InstructionsPanel: React.FC<InstructionsPanelProps> = ({
  title,
  instructions,
  gestures = [],
  tips = []
}) => {
  return (
    <div className="glass-panel rounded-2xl p-6 border border-white/10 hover:border-white/20 transition-all duration-300 shadow-xl max-w-full lg:max-w-md w-full flex flex-col gap-6 text-left">
      <div>
        <h3 className="font-orbitron font-bold text-lg text-neon-blue tracking-wider flex items-center gap-2">
          <Info className="w-5 h-5" />
          INSTRUCTIONS
        </h3>
        <p className="text-xs text-slate-400 font-orbitron mt-1 uppercase">
          {title} Interface Guide
        </p>
      </div>

      <div className="flex flex-col gap-4">
        <div>
          <h4 className="text-xs font-orbitron tracking-widest text-slate-300 font-bold mb-2 uppercase">
            Step-by-step
          </h4>
          <ol className="list-decimal pl-4 space-y-1.5 text-sm text-slate-400 font-outfit">
            {instructions.map((step, idx) => (
              <li key={idx} className="leading-relaxed">
                {step}
              </li>
            ))}
          </ol>
        </div>

        {gestures.length > 0 && (
          <div>
            <h4 className="text-xs font-orbitron tracking-widest text-slate-300 font-bold mb-2 uppercase flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-neon-pink" />
              GESTURE GUIDE
            </h4>
            <div className="grid grid-cols-1 gap-2">
              {gestures.map((item, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-2 rounded bg-white/5 border border-white/5 text-xs"
                >
                  <span className="font-orbitron font-medium text-neon-pink">
                    {item.gesture}
                  </span>
                  <span className="text-slate-400 text-right">{item.action}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="border-t border-white/5 pt-4 flex flex-col gap-3">
          <div className="flex items-start gap-2.5 text-xs text-slate-400 font-outfit">
            <span className="shrink-0 text-sm">💡</span>
            <div>
              <strong className="text-slate-300 font-orbitron">LIGHTING:</strong> Use a well-lit room for the best experience.
            </div>
          </div>

          <div className="flex items-start gap-2.5 text-xs text-slate-400 font-outfit">
            <span className="shrink-0 text-sm">📍</span>
            <div>
              <strong className="text-slate-300 font-orbitron">POSITIONING:</strong> Stand about 1–2 meters away from the camera.
            </div>
          </div>

          <div className="flex items-start gap-2.5 text-xs text-slate-400 font-outfit">
            <span className="shrink-0 text-sm">💻</span>
            <div>
              <strong className="text-slate-300 font-orbitron">PERFORMANCE:</strong> Works best in Chrome on a desktop or laptop.
            </div>
          </div>
        </div>

        {tips.length > 0 && (
          <div className="bg-white/5 border border-white/5 rounded-xl p-3 text-xs text-slate-400 space-y-1">
            <span className="font-bold text-slate-300 font-orbitron">PRO TIPS:</span>
            <ul className="list-disc pl-4 space-y-1 font-outfit">
              {tips.map((tip, idx) => (
                <li key={idx}>{tip}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
};
export default InstructionsPanel;
