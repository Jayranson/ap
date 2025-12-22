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
  const baseStyle = "px-4 py-3 rounded-xl font-bold transition-all duration-300 active:scale-95 flex items-center justify-center gap-2 shadow-lg hover:shadow-2xl transform hover:-translate-y-0.5";
  const variants = {
    primary: "bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white hover:from-slate-800 hover:via-slate-700 hover:to-slate-800 shadow-slate-400/50 hover:shadow-slate-500/50",
    secondary: "bg-gradient-to-r from-orange-500 via-orange-600 to-orange-500 text-white hover:from-orange-600 hover:via-orange-700 hover:to-orange-600 shadow-orange-400/50 hover:shadow-orange-500/60",
    outline: "border-2 border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300 shadow-slate-200/50 hover:border-orange-300",
    ghost: "text-slate-600 hover:bg-slate-100 shadow-none hover:shadow-md",
    danger: "bg-gradient-to-r from-red-500 via-red-600 to-red-500 text-white hover:from-red-600 hover:via-red-700 hover:to-red-600 shadow-red-400/50 hover:shadow-red-500/60",
    success: "bg-gradient-to-r from-green-500 via-green-600 to-green-500 text-white hover:from-green-600 hover:via-green-700 hover:to-green-600 shadow-green-400/50 hover:shadow-green-500/60",
    disabled: "bg-slate-200 text-slate-400 cursor-not-allowed shadow-none hover:translate-y-0 hover:shadow-none"
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
