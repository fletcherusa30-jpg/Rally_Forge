import React from 'react';

export function Card({ title, children, className = '', style }) {
  return (
    <section className={`rf-card ${className}`.trim()} style={style}>
      {title ? <h2 className='rf-card-title'>{title}</h2> : null}
      <div className='rf-card-body'>{children}</div>
    </section>
  );
}
