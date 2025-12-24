import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement | HTMLTextAreaElement> {
  label?: string;
  textarea?: boolean;
}

export const Input: React.FC<InputProps> = ({ label, textarea, ...props }) => (
  <div className="mb-4 group">
    {label && <label className="block text-sm font-bold text-slate-700 mb-2.5 transition-all duration-200 group-focus-within:text-orange-600">{label}</label>}
    {textarea ? (
      <textarea className="w-full p-4 border-2 border-slate-300 rounded-2xl focus:ring-4 focus:ring-orange-500/20 focus:border-orange-500 focus:outline-none text-slate-900 transition-all duration-300 shadow-md hover:border-orange-400 hover:shadow-lg focus:shadow-xl bg-white/80 backdrop-blur-sm placeholder:text-slate-400" {...props as React.TextareaHTMLAttributes<HTMLTextAreaElement>} />
    ) : (
      <input className="w-full p-4 border-2 border-slate-300 rounded-2xl focus:ring-4 focus:ring-orange-500/20 focus:border-orange-500 focus:outline-none text-slate-900 transition-all duration-300 shadow-md hover:border-orange-400 hover:shadow-lg focus:shadow-xl bg-white/80 backdrop-blur-sm placeholder:text-slate-400" {...props as React.InputHTMLAttributes<HTMLInputElement>} />
    )}
  </div>
);
