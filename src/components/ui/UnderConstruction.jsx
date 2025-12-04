import React, { useState } from 'react';
import { HardHat, X, Construction, Cone } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const PixelRain = () => {
  const [pixels] = useState(() => Array.from({ length: 40 }).map((_, i) => ({
    id: i,
    left: Math.random() * 100,
    delay: Math.random() * 5,
    duration: 1.5 + Math.random() * 2.5,
    size: 2 + Math.random() * 4,
    color: Math.random() > 0.6 ? '#eab308' : '#1e293b' // Yellow-500 or Slate-800
  })));

  return (
    <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden">
      {pixels.map(p => (
        <div
          key={p.id}
          className="absolute opacity-20 rounded-[1px]"
          style={{
            left: `${p.left}%`,
            top: -20,
            width: p.size,
            height: p.size,
            backgroundColor: p.color,
            animation: `pixel-fall ${p.duration}s linear infinite`,
            animationDelay: `-${p.delay}s`
          }}
        />
      ))}
    </div>
  );
};

export default function UnderConstruction({ pageName }) {
  const [isVisible, setIsVisible] = useState(true);

  if (!isVisible) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -20, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -20, scale: 0.95 }}
        className="relative mx-auto max-w-7xl mt-6 mb-6 px-4 md:px-6"
      >
        <PixelRain />
        {/* Construction Tape Top */}
        <div className="h-3 w-full bg-yellow-400 border-y border-yellow-600 overflow-hidden relative">
          <div className="absolute inset-0 w-[200%] animate-slide-slow" 
               style={{ 
                 backgroundImage: 'linear-gradient(45deg, #1a1a1a 25%, #facc15 25%, #facc15 50%, #1a1a1a 50%, #1a1a1a 75%, #facc15 75%, #facc15)', 
                 backgroundSize: '40px 40px' 
               }} 
          />
        </div>

        <div className="bg-white border-x border-slate-200 shadow-lg relative overflow-hidden">
          <div className="flex flex-col md:flex-row items-center p-4 gap-4 md:gap-6">
            
            {/* Icon Box */}
            <div className="shrink-0 relative">
              <div className="w-16 h-16 bg-slate-100 rounded-lg flex items-center justify-center border-2 border-slate-200 shadow-inner">
                <Construction className="w-10 h-10 text-orange-500" />
              </div>
              <div className="absolute -bottom-2 -right-2 bg-yellow-400 text-slate-900 rounded-full p-1.5 border-2 border-white shadow-sm">
                <HardHat className="w-4 h-4" />
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 text-center md:text-left space-y-1">
              <div className="flex items-center justify-center md:justify-start gap-2">
                <h3 className="font-bold text-xl text-slate-900 tracking-tight">
                  WORK IN PROGRESS
                </h3>
                <span className="bg-yellow-100 text-yellow-800 text-[10px] font-bold px-2 py-0.5 rounded-full border border-yellow-200 uppercase tracking-wider">
                  Beta
                </span>
              </div>
              <p className="text-slate-600 font-medium">
                The <span className="font-semibold text-slate-900 underline decoration-yellow-400 decoration-2 underline-offset-2">{pageName}</span> module is currently being built.
              </p>
              <p className="text-xs text-slate-500 max-w-prose">
                We're laying the foundation for better features. Functionality may be limited while our crew works on updates.
              </p>
            </div>

            {/* Action / Close */}
            <div className="shrink-0 flex items-center gap-3">
              <button 
                onClick={() => setIsVisible(false)}
                className="group flex items-center justify-center w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-900 transition-all"
                aria-label="Dismiss"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Construction Tape Bottom */}
        <div className="h-3 w-full bg-yellow-400 border-y border-yellow-600 overflow-hidden relative">
          <div className="absolute inset-0 w-[200%] animate-slide-slow-reverse" 
               style={{ 
                 backgroundImage: 'linear-gradient(45deg, #1a1a1a 25%, #facc15 25%, #facc15 50%, #1a1a1a 50%, #1a1a1a 75%, #facc15 75%, #facc15)', 
                 backgroundSize: '40px 40px' 
               }} 
          />
        </div>

        {/* CSS Animations */}
        <style>{`
          @keyframes slide-slow {
            0% { transform: translateX(0); }
            100% { transform: translateX(-40px); }
          }
          @keyframes slide-slow-reverse {
            0% { transform: translateX(-40px); }
            100% { transform: translateX(0); }
          }
          .animate-slide-slow {
            animation: slide-slow 2s linear infinite;
          }
          .animate-slide-slow-reverse {
            animation: slide-slow-reverse 2s linear infinite;
          }
          @keyframes pixel-fall {
            0% { transform: translateY(-20px) rotate(0deg); opacity: 0; }
            10% { opacity: 0.8; }
            90% { opacity: 0.8; }
            100% { transform: translateY(200px) rotate(90deg); opacity: 0; }
          }
        `}</style>
      </motion.div>
    </AnimatePresence>
  );
}