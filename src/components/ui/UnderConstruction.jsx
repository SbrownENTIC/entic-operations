import React, { useState } from 'react';
import { HardHat, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function UnderConstruction({ pageName }) {
  const [isVisible, setIsVisible] = useState(true);

  if (!isVisible) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        className="bg-yellow-400 text-slate-900 px-4 py-3 shadow-md relative overflow-hidden mb-4 rounded-lg border-2 border-yellow-600 mx-4 mt-4 md:mx-6 md:mt-6 max-w-7xl lg:mx-auto"
      >
        <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none" 
             style={{ 
               backgroundImage: 'linear-gradient(45deg, #000 25%, transparent 25%, transparent 50%, #000 50%, #000 75%, transparent 75%, transparent)', 
               backgroundSize: '20px 20px' 
             }} 
        />
        
        <div className="flex items-center gap-3 relative z-10">
          <div className="bg-white p-2 rounded-full border-2 border-slate-900 shadow-sm shrink-0">
            <HardHat className="w-6 h-6 text-orange-600" />
          </div>
          <div className="flex-1">
            <h3 className="font-bold text-lg leading-tight">Pardon our dust! 🚧</h3>
            <p className="text-sm font-medium text-slate-800/90">
              The {pageName} page is currently under construction. We're hammering out the details and polishing the pixels. Watch your step!
            </p>
          </div>
          <button 
            onClick={() => setIsVisible(false)}
            className="p-1 hover:bg-black/10 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}