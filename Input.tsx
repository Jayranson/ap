import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement | HTMLTextAreaElement> {
  label?: string;
  textarea?: boolean;
}

export const Input: React.FC<InputProps> = ({ label, textarea, ...props }) => (
  <div className="mb-4">
    {label && <label className="block text-sm font-bold text-slate-700 mb-2 transition-colors duration-200">{label}</label>}
    {textarea ? (
      <textarea className="w-full p-3 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 focus:outline-none text-slate-900 transition-all duration-300 shadow-sm hover:border-slate-300 hover:shadow-md focus:shadow-lg" {...props as React.TextareaHTMLAttributes<HTMLTextAreaElement>} />
    ) : (
      <input className="w-full p-3 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 focus:outline-none text-slate-900 transition-all duration-300 shadow-sm hover:border-slate-300 hover:shadow-md focus:shadow-lg" {...props as React.InputHTMLAttributes<HTMLInputElement>} />
    )}
  </div>
);
