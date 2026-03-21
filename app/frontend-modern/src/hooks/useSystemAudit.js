import { useCallback, useEffect, useMemo, useState } from 'react';
import { getAuditMetadata, getHealthStatus } from '../api/client';

export function useSystemAudit({ refreshMs = 10000 } = {}) {
  const [health, setHealth] = useState(null);
  const [audit, setAudit] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [healthResult, auditResult] = await Promise.allSettled([
      getHealthStatus(),
      getAuditMetadata(),
    ]);

    const hasHealth = healthResult.status === 'fulfilled';
    const hasAudit = auditResult.status === 'fulfilled';
    const newHealth = hasHealth ? healthResult.value : null;
    const newAudit = hasAudit ? (auditResult.value?.data || null) : null;

    const errors = [];
    if (healthResult.status === 'rejected') {
      errors.push(healthResult.reason?.message || 'Health check failed');
    }
    if (auditResult.status === 'rejected') {
      errors.push(auditResult.reason?.message || 'Audit metadata unavailable');
    }

    if (hasHealth) {
      setHealth(newHealth);
    }
    if (hasAudit) {
      setAudit(newAudit);
    }

    const uniqueErrors = [...new Set(errors.filter(Boolean))];
    setError(uniqueErrors.join(' | '));
    if (newHealth || newAudit) setLastUpdated(new Date().toISOString());
    setLoading(false);
  }, []);

  useEffect(() => {
    const initialLoadId = setTimeout(() => {
      void load();
    }, 0);
    const id = setInterval(load, refreshMs);
    return () => {
      clearTimeout(initialLoadId);
      clearInterval(id);
    };
  }, [load, refreshMs]);

  const summary = useMemo(() => {
    if (loading) return { text: 'Loading Status', className: 'warn' };
    if (error && !health && !audit) return { text: 'Status Unavailable', className: 'fail' };
    if (!health || !audit) return { text: 'Waiting For Audit Data', className: 'warn' };

    const statuses = Object.values(health);
    if (statuses.some((value) => value === 'fail')) {
      return { text: 'System Critical', className: 'fail' };
    }
    if (audit.health?.status === 'fail') {
      return { text: 'Audit Failing', className: 'fail' };
    }
    if (statuses.some((value) => value === 'warn')) {
      return { text: 'System Degraded', className: 'warn' };
    }
    if (audit.health?.status === 'warn') {
      return { text: 'Audit Degraded', className: 'warn' };
    }
    return { text: 'System Healthy', className: 'ok' };
  }, [loading, error, health, audit]);

  return {
    health,
    audit,
    error,
    loading,
    lastUpdated,
    summary,
    reload: load,
  };
}
