import React from 'react';
import { HardHat } from 'lucide-react';

interface VerifiedHardHatProps {
  style?: React.CSSProperties;
}

export const VerifiedHardHat: React.FC<VerifiedHardHatProps> = ({ style }) => (
    <div 
        className="absolute top-1.5 right-1.5 z-10 bg-gradient-to-br from-orange-500 via-orange-600 to-orange-500 rounded-full p-1.5 shadow-xl border-2 border-white flex items-center justify-center animate-pulse-slow hover:scale-110 transition-transform duration-300" 
        title="Verified Tradie"
        style={style}
    >
        <HardHat className="w-3 h-3 text-white animate-bounce-subtle" />
    </div>
);
