import React from 'react';

export function ProfileSectionCard({
  title,
  description,
  summaryItems,
  machineState,
  isEditing,
  isDirty,
  isSaving,
  statusMessage,
  errorMessage,
  onStartEdit,
  onFieldChange,
  onCancel,
  onSave,
  children,
}) {
  void onFieldChange;
  const hasSummary = Array.isArray(summaryItems) && summaryItems.length > 0;

  return (
    <article className='rf-card profile-section-card' data-machine-state={machineState || 'idle'}>
      <div className='profile-section-header'>
        <div className='profile-section-title-row'>
          <h2 className='rf-card-title'>{title}</h2>
          {!isEditing && (
            <button type='button' className='btn-subtle' onClick={onStartEdit} aria-label={`Edit ${title}`}>
              Edit
            </button>
          )}
          {isEditing && (
            <div className='profile-section-actions'>
              <button type='button' className='btn-primary btn-sm' onClick={onSave} disabled={isSaving || !isDirty} aria-label={`Save ${title}`}>
                {isSaving ? 'Saving…' : 'Save'}
              </button>
              <button type='button' className='btn-ghost-danger btn-sm' onClick={onCancel} disabled={isSaving} aria-label={`Cancel ${title}`}>
                Cancel
              </button>
            </div>
          )}
        </div>
        {isEditing && description && (
          <p className='profile-section-hint'>{description}</p>
        )}
      </div>

      {!isEditing && hasSummary && (
        <div className='profile-summary-row' aria-label={`${title} summary`}>
          {summaryItems.map((item) => (
            <div key={item.label} className='profile-summary-item'>
              <span className='profile-summary-label'>{item.label}</span>
              <span className='profile-summary-value'>{item.value || '—'}</span>
            </div>
          ))}
        </div>
      )}

      {isEditing && <div className='profile-section-body'>{children}</div>}

      {(statusMessage || errorMessage) && (
        <div aria-live='polite' className='profile-section-status'>
          {statusMessage && <span className='profile-status-ok'>{statusMessage}</span>}
          {errorMessage && <span className='profile-status-err'>{errorMessage}</span>}
        </div>
      )}
    </article>
  );
}
