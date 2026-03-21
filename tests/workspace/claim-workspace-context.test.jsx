import { describe, expect, it } from 'vitest';
import { mergeWorkspaces, pickLatestSection } from '../context/ClaimWorkspaceContext.jsx';

describe('ClaimWorkspaceContext precedence', () => {
  it('pickLatestSection uses timestamp precedence', () => {
    const local = { value: 'local', updatedAt: '2026-03-01T00:00:00.000Z' };
    const remote = { value: 'remote', updatedAt: '2026-03-02T00:00:00.000Z' };

    expect(pickLatestSection(local, remote)).toEqual(remote);
  });

  it('pickLatestSection falls back when one section is missing', () => {
    const local = { value: 'local', updatedAt: '2026-03-01T00:00:00.000Z' };

    expect(pickLatestSection(local, null)).toEqual(local);
    expect(pickLatestSection(null, local)).toEqual(local);
  });

  it('pickLatestSection resolves equal timestamps deterministically to local', () => {
    const local = { value: 'local', updatedAt: '2026-03-02T00:00:00.000Z' };
    const remote = { value: 'remote', updatedAt: '2026-03-02T00:00:00.000Z' };

    expect(pickLatestSection(local, remote)).toEqual(local);
  });

  it('mergeWorkspaces keeps remote profile when remote is newer', () => {
    const local = {
      profile: { firstName: 'Local', updatedAt: '2026-03-01T00:00:00.000Z' },
      militaryService: { records: [{ branch: 'Army' }], updatedAt: '2026-03-01T00:00:00.000Z' },
    };
    const remote = {
      profile: { firstName: 'Remote', updatedAt: '2026-03-02T00:00:00.000Z' },
      militaryService: { records: [{ branch: 'Navy' }], updatedAt: '2026-03-02T00:00:00.000Z' },
    };

    const merged = mergeWorkspaces(local, remote);
    expect(merged.profile.firstName).toBe('Remote');
    expect(merged.militaryService.records[0].branch).toBe('Navy');
  });

  it('mergeWorkspaces keeps local profile when local is newer', () => {
    const local = {
      profile: { firstName: 'Local', updatedAt: '2026-03-03T00:00:00.000Z' },
      serviceTreatmentRecords: { uploadedDocuments: [{ id: 'local-doc' }], manualEntries: [], summary: null, updatedAt: '2026-03-03T00:00:00.000Z' },
    };
    const remote = {
      profile: { firstName: 'Remote', updatedAt: '2026-03-02T00:00:00.000Z' },
      serviceTreatmentRecords: { uploadedDocuments: [{ id: 'remote-doc' }], manualEntries: [], summary: null, updatedAt: '2026-03-02T00:00:00.000Z' },
    };

    const merged = mergeWorkspaces(local, remote);
    expect(merged.profile.firstName).toBe('Local');
    expect(merged.serviceTreatmentRecords.uploadedDocuments[0].id).toBe('local-doc');
  });

  it('mergeWorkspaces hydrates missing sections from the source that has them', () => {
    const local = {
      profile: { firstName: 'Local', updatedAt: '2026-03-01T00:00:00.000Z' },
      currentTreatment: { uploadedDocuments: [{ id: 'local-treatment' }], manualEntries: [], summary: null, updatedAt: '2026-03-01T00:00:00.000Z' },
    };
    const remote = {
      profile: { firstName: 'Remote', updatedAt: '2026-03-02T00:00:00.000Z' },
      currentTreatment: null,
    };

    const merged = mergeWorkspaces(local, remote);
    expect(merged.currentTreatment.uploadedDocuments[0].id).toBe('local-treatment');
    expect(merged.profile.firstName).toBe('Remote');
  });
});
