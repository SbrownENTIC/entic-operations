import React, { useState, useEffect } from 'react';
import { HardHat, X, Construction, Hammer, Wrench, Cone } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const FallingItem = ({ delay, duration, left, type }) => {
  const items = ['🚧', '🔨', '🔧', '🔩', '🧱', '⚠️', '🏗️'];
  const item = items[type % items.length];
  
  return (
    <motion.div
      initial={{ y: -50, opacity: 0, rotate: 0 }}
      animate={{ 
        y: '100vh', 
        opacity: [0, 1, 1, 0],
        rotate: 360 
      }}
      transition={{ 
        duration: duration,
        repeat: Infinity,
        delay: delay,
        ease: "linear"
      }}
      style={{ left: `${left}%` }}
      className="absolute top-0 text-2xl pointer-events-none select-none z-40"
    >
      {item}
    </motion.div>
  );
};

export default function UnderConstruction({ pageName }) {
  const [isVisible, setIsVisible] = useState(true);
  const [items, setItems] = useState([]);

  useEffect(() => {
    // Generate random falling items
    const newItems = Array.from({ length: 15 }).map((_, i) => ({
      id: i,
      left: Math.random() * 90 + 5, // 5% to 95%
      delay: Math.random() * 5,
      duration: 3 + Math.random() * 4,
      type: Math.floor(Math.random() * 10)
    }));
    setItems(newItems);
  }, []);

  if (!isVisible) return null;

  return (
    <AnimatePresence>
      <>
        {/* Full Screen Hazard Border */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 pointer-events-none border-[20px] border-transparent"
          style={{
            borderImageSource: 'linear-gradient(45deg, #fbbf24 25%, #1f2937 25%, #1f2937 50%, #fbbf24 50%, #fbbf24 75%, #1f2937 75%, #1f2937)',
            borderImageSlice: 1,
            borderImageRepeat: 'round',
          }}
        >
          {/* Falling Items Container */}
          <div className="absolute inset-0 overflow-hidden">
            {items.map((item) => (
              <FallingItem key={item.id} {...item} />
            ))}
          </div>
        </motion.div>

        {/* Banner Content */}
        <motion.div
          initial={{ opacity: 0, y: -20, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -20, scale: 0.9 }}
          className="relative mx-auto max-w-4xl mt-8 mb-8 px-4 z-[51]"
        >
          <div className="bg-white border-4 border-slate-900 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] rounded-xl overflow-hidden relative">
            
            {/* Header Bar */}
            <div className="bg-yellow-400 p-3 border-b-4 border-slate-900 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-red-500 border-2 border-slate-900"></div>
                  <div className="w-3 h-3 rounded-full bg-yellow-200 border-2 border-slate-900"></div>
                  <div className="w-3 h-3 rounded-full bg-green-500 border-2 border-slate-900"></div>
                </div>
                <span className="font-black text-slate-900 uppercase tracking-wider ml-2 text-sm">System Message</span>
              </div>
              <button 
                onClick={() => setIsVisible(false)}
                className="bg-slate-900 text-white p-1 rounded hover:bg-slate-700 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 flex flex-col md:flex-row items-center gap-6 relative">
              {/* Background Pattern */}
              <div className="absolute inset-0 opacity-5" 
                style={{ 
                  backgroundImage: 'radial-gradient(#000 1px, transparent 1px)', 
                  backgroundSize: '20px 20px' 
                }} 
              />

              {/* Bouncing Icon */}
              <motion.div 
                animate={{ y: [0, -10, 0] }}
                transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
                className="w-24 h-24 bg-yellow-400 rounded-full border-4 border-slate-900 flex items-center justify-center shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] shrink-0 relative z-10"
              >
                <Construction className="w-12 h-12 text-slate-900" />
                <motion.div 
                  animate={{ rotate: [0, 15, 0, -15, 0] }}
                  transition={{ repeat: Infinity, duration: 1.5 }}
                  className="absolute -right-2 -bottom-2 bg-orange-500 p-2 rounded-full border-2 border-slate-900 text-white"
                >
                  <Wrench className="w-5 h-5" />
                </motion.div>
              </motion.div>

              <div className="flex-1 text-center md:text-left relative z-10">
                <h2 className="text-3xl font-black text-slate-900 mb-2 transform -rotate-1">
                  UNDER CONSTRUCTION!
                </h2>
                <div className="bg-slate-100 p-3 rounded-lg border-2 border-dashed border-slate-300 mb-3">
                  <p className="text-slate-700 font-bold text-lg">
                    Area: <span className="text-blue-600">{pageName}</span>
                  </p>
                </div>
                <p className="text-slate-600 font-medium leading-relaxed">
                  Our digital construction crew is hard at work! We're hammering out bugs and welding new features. 
                  Please wear your hard hat and watch your step. 🏗️
                </p>
              </div>

              {/* Decoration */}
              <div className="absolute top-4 right-4 opacity-10 transform rotate-12">
                <Cone className="w-32 h-32" />
              </div>
            </div>

            {/* Footer Tape */}
            <div className="h-4 w-full bg-yellow-400 border-t-4 border-slate-900 relative overflow-hidden">
               <motion.div 
                 animate={{ x: ["0%", "-50%"] }}
                 transition={{ repeat: Infinity, duration: 10, ease: "linear" }}
                 className="absolute inset-0 w-[200%] flex items-center"
                 style={{ 
                    backgroundImage: 'linear-gradient(45deg, #000 25%, transparent 25%, transparent 50%, #000 50%, #000 75%, transparent 75%, transparent)',
                    backgroundSize: '40px 40px'
                 }}
               />
            </div>
          </div>
        </motion.div>
      </>
    </AnimatePresence>
  );
}