import React from 'react';
import { ShieldCheck, AlertCircle } from 'lucide-react';

interface BadgeProps {
  type: 'verified' | 'trade' | 'locked' | 'distance' | 'pending';
  text: string;
  icon?: React.ComponentType<{ size: number; className?: string }>;
}

export const Badge: React.FC<BadgeProps> = ({ type, text, icon: Icon }) => {
  const styles = {
    verified: "bg-gradient-to-r from-blue-500 via-blue-600 to-blue-500 text-white border-blue-400 shadow-blue-500/40 hover:shadow-blue-600/60",
    trade: "bg-gradient-to-r from-orange-500 via-orange-600 to-orange-500 text-white border-orange-400 shadow-orange-500/40 hover:shadow-orange-600/60",
    locked: "bg-gradient-to-r from-slate-400 via-slate-500 to-slate-400 text-white border-slate-300 shadow-slate-400/40 hover:shadow-slate-500/60",
    distance: "bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white border-slate-700 shadow-slate-600/50 hover:shadow-slate-700/60",
    pending: "bg-gradient-to-r from-amber-500 via-amber-600 to-amber-500 text-white border-amber-400 shadow-amber-500/40 hover:shadow-amber-600/60 animate-pulse"
  };
  return (
    <span className={`px-3 py-1.5 rounded-full text-[10px] font-extrabold border-2 flex items-center gap-1.5 w-fit shadow-lg transition-all duration-300 hover:scale-110 backdrop-blur-sm ${styles[type] || styles.trade}`}>
      {Icon && <Icon size={12} className="transition-transform duration-300 group-hover:rotate-12" />}
      {type === 'verified' && !Icon && <ShieldCheck size={12} className="transition-transform duration-300 group-hover:rotate-12" />}
      {type === 'locked' && !Icon && <AlertCircle size={12} className="transition-transform duration-300 group-hover:rotate-12" />}
      {text}
    </span>
  );
};
