'use client';

import { useState } from 'react';

interface ButtonProps {
  children: React.ReactNode;
  variant?: 'primary' | 'approve' | 'reject' | 'secondary' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  onClick?: (e: React.MouseEvent) => void;
  disabled?: boolean;
  context?: 'stanton' | 'hach';
  className?: string;
}

export default function Button({ 
  children, 
  variant = 'secondary', 
  size = 'md', 
  onClick, 
  disabled, 
  context = 'stanton',
  className = ''
}: ButtonProps) {
  const [hover, setHover] = useState(false);

  if (context === 'hach') {
    const COLORS = {
      accent: '#0f4c5c',
      accentHover: '#0a3a47',
      approve: '#15803d',
      approveHover: '#166534',
      reject: '#b91c1c',
      rejectHover: '#991b1b',
      text: '#1c1917',
      textMuted: '#78716c',
      border: '#e7e5e4',
      borderStrong: '#d6d3d1',
      bgHover: '#f5f5f4',
    };
    const FONT = "'IBM Plex Sans', -apple-system, BlinkMacSystemFont, sans-serif";

    const vars = {
      primary:   { bg: COLORS.accent,  color: '#fff',          border: COLORS.accent,       hover: COLORS.accentHover },
      approve:   { bg: COLORS.approve, color: '#fff',          border: COLORS.approve,      hover: COLORS.approveHover },
      reject:    { bg: '#fff',         color: COLORS.reject,   border: COLORS.reject,       hover: COLORS.rejectHover },
      secondary: { bg: '#fff',         color: COLORS.text,     border: COLORS.borderStrong, hover: COLORS.bgHover },
      ghost:     { bg: 'transparent',  color: COLORS.textMuted, border: 'transparent',      hover: COLORS.bgHover },
    }[variant];

    const sz = { 
      sm: { padding: '5px 10px', fontSize: 12 }, 
      md: { padding: '7px 14px', fontSize: 13 }, 
      lg: { padding: '10px 18px', fontSize: 14 } 
    }[size];

    return (
      <button
        onClick={onClick} 
        disabled={disabled}
        onMouseEnter={() => setHover(true)} 
        onMouseLeave={() => setHover(false)}
        style={{
          ...sz, 
          backgroundColor: hover && !disabled ? vars.hover : vars.bg,
          color: vars.color, 
          border: `1px solid ${vars.border}`,
          borderRadius: 4, 
          fontWeight: 600, 
          fontFamily: FONT,
          cursor: disabled ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.5 : 1, 
          transition: 'background-color 0.12s ease',
        }}
      >
        {children}
      </button>
    );
  }

  // Stanton context - use Tailwind
  const baseClasses = 'font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2';
  const sizeClasses = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-sm',
    lg: 'px-6 py-3 text-base'
  }[size];

  const variantClasses = {
    primary: 'bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed',
    approve: 'bg-green-600 text-white hover:bg-green-700 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed',
    reject: 'bg-white text-red-600 border border-red-300 hover:bg-red-50 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed',
    secondary: 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 focus:ring-gray-500 disabled:opacity-50 disabled:cursor-not-allowed',
    ghost: 'text-gray-600 hover:text-gray-800 hover:bg-gray-100 focus:ring-gray-500 disabled:opacity-50 disabled:cursor-not-allowed',
  }[variant];

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`${baseClasses} ${sizeClasses} ${variantClasses} ${className}`}
    >
      {children}
    </button>
  );
}
