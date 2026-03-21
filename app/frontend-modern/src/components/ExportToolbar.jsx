import React from 'react';

export function ExportToolbar({ onExportTxt, onExportJson, onPrint }) {
  return (
    <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
      {onExportTxt && (
        <button type='button' onClick={onExportTxt} className='app-nav-link' style={{ width: 'auto' }}>
          <span className='app-nav-icon'>01</span>
          <span>Export Packet (.txt)</span>
        </button>
      )}
      {onExportJson && (
        <button type='button' onClick={onExportJson} className='app-nav-link' style={{ width: 'auto' }}>
          <span className='app-nav-icon'>02</span>
          <span>Export JSON</span>
        </button>
      )}
      {onPrint && (
        <button type='button' onClick={onPrint} className='app-nav-link' style={{ width: 'auto' }}>
          <span className='app-nav-icon'>03</span>
          <span>Print Summary</span>
        </button>
      )}
    </div>
  );
}
