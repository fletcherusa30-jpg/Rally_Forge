import React from 'react';
import '../styles/theme.css';

export default function UIBlock({ title, description, children, className = '', ...props }) {
  return (
    <div className={`rf-block ${className}`} {...props}>
      {title && <h3 className="rf-block-title">{title}</h3>}
      {description && <p className="rf-block-description">{description}</p>}
      {children}
    </div>
  );
}
