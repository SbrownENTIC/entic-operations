import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Construction, 
  Hammer, 
  Wrench, 
  Truck, 
  HardHat, 
  Shovel, 
  Cloud, 
  Sun,
  X
} from 'lucide-react';

const MovingCloud = ({ delay, top, duration, size }) => (
  <motion.div
    initial={{ x: '-100%', opacity: 0.8 }}
    animate={{ x: '100vw' }}
    transition={{ 
      duration: duration, 
      repeat: Infinity, 
      delay: delay, 
      ease: "linear" 
    }}
    className="absolute text-white opacity-80"
    style={{ top: `${top}%` }}
  >
    <Cloud size={size} fill="white" />
  </motion.div>
);

const Crane = () => (
  <div className="absolute bottom-0 left-10 md:left-32 h-64 w-32 pointer-events-none z-10 hidden sm:block">
    {/* Crane Base */}
    <div className="absolute bottom-0 left-0 w-16 h-4 bg-slate-800 rounded-t" />
    {/* Crane Tower */}
    <div className="absolute bottom-4 left-4 w-8 h-48 border-x-2 border-slate-700 flex flex-col justify-between bg-yellow-400/20">
      {[...Array(8)].map((_, i) => (
        <div key={i} className="w-full h-px bg-slate-700 transform -rotate-12" />
      ))}
    </div>
    {/* Crane Cab */}
    <div className="absolute bottom-44 left-2 w-12 h-10 bg-yellow-500 rounded border-2 border-slate-800 z-20" />
    {/* Crane Arm */}
    <motion.div 
      className="absolute bottom-48 left-8 w-64 h-4 bg-yellow-500 border border-slate-800 origin-left rounded"
      animate={{ rotate: [0, 5, 0] }}
      transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
    >
      {/* Cable */}
      <motion.div 
        className="absolute right-4 top-2 w-1 bg-slate-800"
        animate={{ height: [40, 100, 40] }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
      >
        {/* Hook/Load */}
        <div className="absolute -bottom-8 -left-4 w-10 h-8 bg-orange-600 border-2 border-slate-900 flex items-center justify-center text-[10px] font-bold text-white shadow-lg">
           CODE
        </div>
      </motion.div>
    </motion.div>
  </div>
);

const DumpTruck = () => (
  <motion.div 
    className="absolute bottom-0 right-0 pointer-events-none z-20 hidden sm:block"
    animate={{ x: [100, -20, 100] }}
    transition={{ duration: 15, repeat: Infinity, ease: "easeInOut", repeatDelay: 2 }}
  >
    <div className="relative w-48 h-24">
        {/* Truck Body */}
        <div className="absolute bottom-4 left-0 w-32 h-16 bg-yellow-500 border-2 border-slate-900 rounded-l-lg" />
        {/* Cab */}
        <div className="absolute bottom-8 right-0 w-16 h-20 bg-blue-600 border-2 border-slate-900 rounded-r-lg rounded-tl-lg" />
        {/* Window */}
        <div className="absolute bottom-20 right-2 w-10 h-8 bg-blue-300 border border-slate-900/50 rounded-tr-md" />
        {/* Wheels */}
        <motion.div 
            className="absolute bottom-0 left-4 w-10 h-10 bg-slate-900 rounded-full border-4 border-slate-600 flex items-center justify-center"
            animate={{ rotate: -360 }}
            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
        >
            <div className="w-2 h-2 bg-slate-400 rounded-full" />
        </motion.div>
        <motion.div 
            className="absolute bottom-0 right-4 w-10 h-10 bg-slate-900 rounded-full border-4 border-slate-600 flex items-center justify-center"
            animate={{ rotate: -360 }}
            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
        >
            <div className="w-2 h-2 bg-slate-400 rounded-full" />
        </motion.div>
        {/* Dirt */}
        <div className="absolute bottom-16 left-4 w-24 h-8 bg-amber-700 rounded-t-full" />
    </div>
  </motion.div>
);

export default function UnderConstruction({ pageName }) {
  const [isVisible, setIsVisible] = useState(true);

  if (!isVisible) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="relative w-full overflow-hidden rounded-xl shadow-2xl border-4 border-slate-900 bg-sky-300 my-6 min-h-[400px] select-none"
      >
        {/* Hazard Tape Border Overlay */}
        <div 
            className="absolute inset-0 border-[16px] border-transparent z-50 pointer-events-none"
            style={{
                borderImageSource: 'repeating-linear-gradient(45deg, #fbbf24 0, #fbbf24 20px, #1e293b 20px, #1e293b 40px)',
                borderImageSlice: 1
            }}
        />

        {/* Sky & Clouds */}
        <div className="absolute inset-0 bg-gradient-to-b from-sky-400 to-sky-200">
            <motion.div 
                className="absolute top-4 right-4 text-yellow-300"
                animate={{ rotate: 360, scale: [1, 1.1, 1] }}
                transition={{ rotate: { duration: 20, repeat: Infinity, ease: "linear" }, scale: { duration: 2, repeat: Infinity } }}
            >
                <Sun size={64} fill="#fde047" />
            </motion.div>
            <MovingCloud delay={0} top={10} duration={25} size={64} />
            <MovingCloud delay={5} top={25} duration={30} size={48} />
            <MovingCloud delay={2} top={5} duration={20} size={80} />
        </div>

        {/* Ground */}
        <div className="absolute bottom-0 w-full h-16 bg-[#5d4037] border-t-4 border-[#3e2723] z-20">
            {/* Grass/Texture */}
            <div className="w-full h-2 bg-green-600" />
        </div>

        {/* Scene Elements */}
        <Crane />
        <DumpTruck />

        {/* Main Content Card */}
        <div className="absolute inset-0 flex items-center justify-center z-40 p-4">
            <motion.div 
                className="bg-white/95 backdrop-blur-sm p-8 rounded-2xl border-4 border-slate-900 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] max-w-lg w-full text-center relative"
                initial={{ y: 20 }}
                animate={{ y: [0, -10, 0] }}
                transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
            >
                 {/* Close Button */}
                <button 
                    onClick={() => setIsVisible(false)}
                    className="absolute -top-4 -right-4 bg-red-500 text-white p-2 rounded-full border-2 border-slate-900 hover:bg-red-600 transition-colors shadow-md z-50"
                >
                    <X size={20} strokeWidth={3} />
                </button>

                <motion.div 
                    className="inline-block bg-yellow-400 p-4 rounded-full border-4 border-slate-900 mb-4 shadow-lg"
                    animate={{ rotate: [0, 10, -10, 0] }}
                    transition={{ repeat: Infinity, duration: 0.5, repeatDelay: 3 }}
                >
                    <HardHat size={48} className="text-slate-900" />
                </motion.div>

                <h2 className="text-3xl font-black text-slate-900 mb-2 uppercase tracking-tight">
                    Kids at Work!
                </h2>
                
                <div className="bg-slate-100 rounded-lg border-2 border-dashed border-slate-300 p-3 mb-4">
                    <p className="font-bold text-slate-700">
                        Building: <span className="text-blue-600 font-black text-lg">{pageName}</span>
                    </p>
                </div>

                <p className="text-slate-600 font-medium leading-relaxed">
                    Our crew is stacking blocks and hammering out the bugs! Put on your hard hat, this area is a fun zone! 🚧
                </p>

                {/* Bouncing Tools */}
                <div className="flex justify-center gap-4 mt-6">
                    {[Hammer, Wrench, Shovel, Construction].map((Icon, i) => (
                        <motion.div
                            key={i}
                            animate={{ y: [0, -15, 0] }}
                            transition={{ 
                                repeat: Infinity, 
                                duration: 0.6, 
                                delay: i * 0.1,
                                repeatDelay: 2 
                            }}
                            className="text-slate-700"
                        >
                            <Icon size={24} />
                        </motion.div>
                    ))}
                </div>
            </motion.div>
        </div>

        {/* Floating Particles/Dust */}
        {[...Array(5)].map((_, i) => (
            <motion.div
                key={i}
                className="absolute w-2 h-2 bg-amber-200 rounded-full bottom-20 left-1/2"
                animate={{ 
                    y: -100 - Math.random() * 100, 
                    x: (Math.random() - 0.5) * 200,
                    opacity: [0, 1, 0],
                    scale: [0, 2, 0]
                }}
                transition={{ 
                    duration: 2 + Math.random() * 2, 
                    repeat: Infinity, 
                    delay: Math.random() * 2 
                }}
            />
        ))}

      </motion.div>
    </AnimatePresence>
  );
}