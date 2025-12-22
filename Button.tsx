import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'success' | 'disabled';
  className?: string;
  disabled?: boolean;
}

export const Button: React.FC<ButtonProps> = ({ 
  children, 
  onClick, 
  variant = 'primary', 
  className = '', 
  disabled = false, 
  ...props 
}) => {
  const baseStyle = "px-5 py-3.5 rounded-2xl font-bold transition-all duration-300 active:scale-95 flex items-center justify-center gap-2.5 shadow-lg hover:shadow-2xl transform hover:-translate-y-1 backdrop-blur-sm relative overflow-hidden group";
  const variants = {
    primary: "bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white hover:from-slate-800 hover:via-slate-700 hover:to-slate-800 shadow-slate-500/40 hover:shadow-slate-600/60 before:absolute before:inset-0 before:bg-gradient-to-r before:from-transparent before:via-white/10 before:to-transparent before:translate-x-[-200%] hover:before:translate-x-[200%] before:transition-transform before:duration-700",
    secondary: "bg-gradient-to-r from-orange-500 via-orange-600 to-orange-500 text-white hover:from-orange-600 hover:via-orange-700 hover:to-orange-600 shadow-orange-500/40 hover:shadow-orange-600/60 before:absolute before:inset-0 before:bg-gradient-to-r before:from-transparent before:via-white/20 before:to-transparent before:translate-x-[-200%] hover:before:translate-x-[200%] before:transition-transform before:duration-700",
    outline: "border-2 border-slate-300 text-slate-700 hover:bg-gradient-to-r hover:from-slate-50 hover:to-white hover:border-orange-400 shadow-slate-200/50 hover:shadow-orange-300/50 backdrop-blur-md",
    ghost: "text-slate-600 hover:bg-gradient-to-r hover:from-slate-100 hover:to-slate-50 shadow-none hover:shadow-lg hover:text-slate-800",
    danger: "bg-gradient-to-r from-red-500 via-red-600 to-red-500 text-white hover:from-red-600 hover:via-red-700 hover:to-red-600 shadow-red-500/40 hover:shadow-red-600/60 before:absolute before:inset-0 before:bg-gradient-to-r before:from-transparent before:via-white/20 before:to-transparent before:translate-x-[-200%] hover:before:translate-x-[200%] before:transition-transform before:duration-700",
    success: "bg-gradient-to-r from-green-500 via-green-600 to-green-500 text-white hover:from-green-600 hover:via-green-700 hover:to-green-600 shadow-green-500/40 hover:shadow-green-600/60 before:absolute before:inset-0 before:bg-gradient-to-r before:from-transparent before:via-white/20 before:to-transparent before:translate-x-[-200%] hover:before:translate-x-[200%] before:transition-transform before:duration-700",
    disabled: "bg-gradient-to-r from-slate-200 to-slate-300 text-slate-400 cursor-not-allowed shadow-none hover:translate-y-0 hover:shadow-none"
  };
  const variantStyle = disabled ? variants.disabled : variants[variant];
  return (
    <button 
      className={`${baseStyle} ${variantStyle} ${className}`} 
      onClick={disabled ? undefined : onClick} 
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  );
};
