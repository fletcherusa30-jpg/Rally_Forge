import React from 'react';
import '../styles/theme.css';

export default function UIInput({ 
  label, 
  type = 'text', 
  className = '', 
  ...props 
}) {
  return (
    <div className="rf-field">
      {label && <label className="rf-label">{label}</label>}
      <input 
        type={type}
        className={`rf-input ${className}`} 
        {...props}
      />
    </div>
  );
}
