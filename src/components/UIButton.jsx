import React from 'react';
import '../styles/theme.css';

export default function UIButton({ 
  children, 
  variant = 'primary', 
  className = '', 
  ...props 
}) {
  const variantClass = variant === 'secondary' ? 'rf-button-secondary' : '';
  
  return (
    <button 
      className={`rf-button ${variantClass} ${className}`} 
      {...props}
    >
      {children}
    </button>
  );
}
