import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { getExtractionReviews, getRecentStrsFeedback, getStrsFeedbackSummary } from '../../api/client';
import { ReviewerFeedbackPanel } from '../../components/treatment/StrsReviewerFeedback.jsx';

const STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: 'approved', label: 'Approved' },
  { value: 'needs-correction', label: 'Needs Correction' },
  { value: 'reviewed', label: 'Reviewed' },
];

function formatDate(value) {
  if (!value) return 'N/A';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'N/A';
  return date.toLocaleString();
}

function statusColor(status) {
  const normalized = String(status || '').toLowerCase();
  if (normalized === 'approved') return '#14b8a6';
  if (normalized === 'needs-correction') return '#f59e0b';
  return '#94a3b8';
}

export function ReviewQueuePage() {
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [records, setRecords] = useState([]);
  const [feedbackSummary, setFeedbackSummary] = useState(null);
  const [feedbackRecords, setFeedbackRecords] = useState([]);
  const [feedbackError, setFeedbackError] = useState('');

  const loadRecords = async () => {
    setLoading(true);
    setError('');
    try {
      const [reviewResponse, summaryResponse, recentFeedbackResponse] = await Promise.all([
        getExtractionReviews(status),
        getStrsFeedbackSummary(),
        getRecentStrsFeedback(6),
      ]);
      setRecords(Array.isArray(reviewResponse?.data) ? reviewResponse.data : []);
      setFeedbackSummary(summaryResponse?.summary || null);
      setFeedbackRecords(Array.isArray(recentFeedbackResponse?.items) ? recentFeedbackResponse.items : []);
      setFeedbackError('');
    } catch (err) {
      setError(err.message || 'Failed to load review queue.');
      setRecords([]);
      setFeedbackSummary(null);
      setFeedbackRecords([]);
      setFeedbackError(err.message || 'Failed to load STR reviewer feedback.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRecords();
  }, [status]);

  const summary = useMemo(() => {
    const counts = { approved: 0, correction: 0, reviewed: 0 };
    records.forEach((item) => {
      const current = String(item?.status || '').toLowerCase();
      if (current === 'approved') counts.approved += 1;
      else if (current === 'needs-correction') counts.correction += 1;
      else counts.reviewed += 1;
    });
    return counts;
  }, [records]);

  return (
    <section className='page-shell'>
      <header className='page-header'>
        <div>
          <div className='page-eyebrow'>Resources</div>
          <h1 className='page-title'>Review Queue</h1>
          <p className='page-copy'>
            Review persisted extraction decisions and route flagged scans back into VA decision analysis.
          </p>
        </div>
        <div className='page-badge'>{records.length} records</div>
      </header>

      <article className='rf-card' style={{ marginBottom: '1rem' }}>
        <h2 className='rf-card-title'>Queue Controls</h2>
        <div className='rf-card-body' style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: '0.75rem', alignItems: 'end' }}>
          <div>
            <label className='profile-label'>Filter by status</label>
            <select className='str-input' value={status} onChange={(event) => setStatus(event.target.value)}>
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value || 'all'} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>
          <button type='button' className='btn-primary' onClick={loadRecords} disabled={loading}>
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>
          <Link className='app-nav-link' to='/va-decision' style={{ width: 'auto', paddingInline: '1rem' }}>
            <span className='app-nav-icon'>VA</span>
            <span>Open VA Decision</span>
          </Link>
        </div>
      </article>

      <article className='rf-card' style={{ marginBottom: '1rem' }}>
        <h2 className='rf-card-title'>Queue Summary</h2>
        <div className='rf-card-body' style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', color: 'var(--rf-text-muted)' }}>
          <span><strong style={{ color: '#14b8a6' }}>{summary.approved}</strong> approved</span>
          <span><strong style={{ color: '#f59e0b' }}>{summary.correction}</strong> need correction</span>
          <span><strong style={{ color: '#94a3b8' }}>{summary.reviewed}</strong> reviewed</span>
        </div>
      </article>

      <article className='rf-card' style={{ marginBottom: '1rem' }}>
        <h2 className='rf-card-title'>STR Feedback Summary</h2>
        <div className='rf-card-body' style={{ display: 'grid', gap: '0.9rem' }}>
          {feedbackError && <div style={{ color: '#ef6f6c' }}>{feedbackError}</div>}

          {!feedbackError && feedbackSummary && (
            <div style={{ display: 'flex', gap: '1.25rem', flexWrap: 'wrap', color: 'var(--rf-text-muted)' }}>
              <span><strong style={{ color: '#cbd5e1' }}>{feedbackSummary.total}</strong> total reviews</span>
              <span><strong style={{ color: '#34d399' }}>{feedbackSummary.truePositive}</strong> true positives</span>
              <span><strong style={{ color: '#fca5a5' }}>{feedbackSummary.falsePositive}</strong> false positives</span>
            </div>
          )}

          {!feedbackError && Array.isArray(feedbackSummary?.topFalsePositiveLabels) && feedbackSummary.topFalsePositiveLabels.length > 0 && (
            <div>
              <div style={{ color: '#f6b44c', fontSize: '0.8rem', marginBottom: '0.35rem' }}>Top false-positive labels</div>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                {feedbackSummary.topFalsePositiveLabels.map((item) => (
                  <span
                    key={item.label}
                    style={{
                      padding: '0.3rem 0.55rem',
                      borderRadius: '999px',
                      border: '1px solid rgba(252, 165, 165, 0.35)',
                      color: '#fecaca',
                      fontSize: '0.74rem',
                    }}
                  >
                    {item.label} ({item.count})
                  </span>
                ))}
              </div>
            </div>
          )}

          <ReviewerFeedbackPanel recentFeedback={feedbackRecords} loading={loading && feedbackRecords.length === 0} error='' />
        </div>
      </article>

      <article className='rf-card'>
        <h2 className='rf-card-title'>Records</h2>
        <div className='rf-card-body'>
          {error && <div style={{ color: '#ef6f6c', marginBottom: '0.75rem' }}>{error}</div>}
          {!error && loading && <div>Loading review queue...</div>}
          {!error && !loading && records.length === 0 && (
            <div>No review records found for the selected filter.</div>
          )}

          {!error && !loading && records.length > 0 && (
            <div style={{ display: 'grid', gap: '0.8rem' }}>
              {records.map((record) => (
                <div
                  key={record.id}
                  style={{
                    border: '1px solid var(--rf-border)',
                    borderRadius: 'var(--rf-radius-sm)',
                    padding: '0.8rem',
                    background: 'rgba(255,255,255,0.01)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
                    <div>
                      <div style={{ color: 'var(--rf-text)', fontWeight: 700 }}>
                        {record.fileName || 'Unnamed scan'}
                      </div>
                      <div style={{ color: 'var(--rf-text-muted)', fontSize: '0.8rem' }}>
                        {record.fileFingerprint || 'No fingerprint'}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ color: statusColor(record.status), fontWeight: 700, textTransform: 'uppercase', fontSize: '0.75rem' }}>
                        {record.status || 'reviewed'}
                      </div>
                      <div style={{ color: 'var(--rf-text-muted)', fontSize: '0.75rem' }}>{formatDate(record.createdAt)}</div>
                    </div>
                  </div>

                  <div style={{ marginTop: '0.55rem', color: 'var(--rf-text-muted)', fontSize: '0.8rem' }}>
                    Parser: {record.parserProfile || 'N/A'} | Rating: {record.extraction?.rating ?? 'N/A'}% | Conditions: {record.extraction?.conditionsCount ?? 0} | Denied: {record.extraction?.deniedCount ?? 0} | SMC: {record.extraction?.smcCount ?? 0}
                  </div>

                  {record.note && (
                    <div style={{ marginTop: '0.5rem', color: 'var(--rf-text)', fontSize: '0.82rem' }}>
                      Note: {record.note}
                    </div>
                  )}

                  {Array.isArray(record.extraction?.evidenceSpans) && record.extraction.evidenceSpans.length > 0 && (
                    <div style={{ marginTop: '0.6rem' }}>
                      <div style={{ color: '#f6b44c', fontSize: '0.78rem', marginBottom: '0.3rem' }}>Evidence snippets</div>
                      <div style={{ display: 'grid', gap: '0.35rem' }}>
                        {record.extraction.evidenceSpans.slice(0, 3).map((span, index) => (
                          <div key={`${record.id}-${span.field}-${index}`} style={{ fontSize: '0.75rem', color: 'var(--rf-text-muted)', border: '1px solid #1e293b', borderRadius: '8px', padding: '0.35rem' }}>
                            {span.field} line {span.line}: {span.snippet}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div style={{ marginTop: '0.65rem', display: 'flex', justifyContent: 'flex-end' }}>
                    <Link
                      className='app-nav-link'
                      to={`/va-decision?fingerprint=${encodeURIComponent(record.fileFingerprint || '')}&reviewId=${encodeURIComponent(record.id || '')}`}
                      style={{ width: 'auto', padding: '0.4rem 0.65rem', fontSize: '0.78rem' }}
                    >
                      <span className='app-nav-icon'>GO</span>
                      <span>Open in VA Decision</span>
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </article>
    </section>
  );
}
