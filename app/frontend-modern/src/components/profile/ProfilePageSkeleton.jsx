import React from 'react';

function SkeletonRow({ width = '100%' }) {
  return <div className='rf-skeleton' style={{ height: '2.2rem', width }} />;
}

export function ProfilePageSkeleton() {
  return (
    <div className='page-shell'>
      <section className='page-header'>
        <div style={{ width: '100%' }}>
          <div className='rf-skeleton' style={{ width: '120px', height: '0.8rem', marginBottom: '0.65rem' }} />
          <div className='rf-skeleton' style={{ width: '260px', height: '2.2rem', marginBottom: '0.65rem' }} />
          <div className='rf-skeleton' style={{ width: '70%', height: '1rem' }} />
        </div>
      </section>

      <article className='rf-card'>
        <div className='rf-card-title'>Loading profile</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(220px, 1fr))', gap: '0.75rem', marginTop: '0.75rem' }}>
          <SkeletonRow />
          <SkeletonRow />
          <SkeletonRow />
          <SkeletonRow />
        </div>
      </article>

      <article className='rf-card'>
        <div className='rf-card-title'>Loading contact</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(220px, 1fr))', gap: '0.75rem', marginTop: '0.75rem' }}>
          <SkeletonRow />
          <SkeletonRow />
          <SkeletonRow />
          <SkeletonRow />
        </div>
      </article>

    </div>
  );
}
