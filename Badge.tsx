import React from 'react';
import { ShieldCheck, AlertCircle } from 'lucide-react';

interface BadgeProps {
  type: 'verified' | 'trade' | 'locked' | 'distance' | 'pending';
  text: string;
  icon?: React.ComponentType<{ size: number; className?: string }>;
}

export const Badge: React.FC<BadgeProps> = ({ type, text, icon: Icon }) => {
  const styles = {
    verified: "bg-gradient-to-r from-blue-100 via-blue-50 to-blue-100 text-blue-700 border-blue-300 shadow-blue-200/50 hover:shadow-blue-300/60",
    trade: "bg-gradient-to-r from-orange-100 via-orange-50 to-orange-100 text-orange-800 border-orange-300 shadow-orange-200/50 hover:shadow-orange-300/60",
    locked: "bg-gradient-to-r from-slate-100 via-slate-50 to-slate-100 text-slate-500 border-slate-300 shadow-slate-200/50 hover:shadow-slate-300/60",
    distance: "bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white border-slate-700 shadow-slate-500/50 hover:shadow-slate-600/60",
    pending: "bg-gradient-to-r from-yellow-100 via-yellow-50 to-yellow-100 text-yellow-800 border-yellow-300 shadow-yellow-200/50 hover:shadow-yellow-300/60"
  };
  return (
    <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border-2 flex items-center gap-1 w-fit shadow-md transition-all duration-300 hover:scale-105 ${styles[type] || styles.trade}`}>
      {Icon && <Icon size={10} className="transition-transform duration-300" />}
      {type === 'verified' && !Icon && <ShieldCheck size={10} className="transition-transform duration-300" />}
      {type === 'locked' && !Icon && <AlertCircle size={10} className="transition-transform duration-300" />}
      {text}
    </span>
  );
};
