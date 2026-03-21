import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';

const listScannerActivitiesMock = vi.fn();
const clearScannerActivitiesMock = vi.fn();

vi.mock('../utils/scannerActivityStore', () => ({
  listScannerActivities: (...args) => listScannerActivitiesMock(...args),
  clearScannerActivities: (...args) => clearScannerActivitiesMock(...args),
}));

import { ScannerActivityPage } from '../pages/ScannerActivityPage.jsx';

describe('ScannerActivityPage destructive actions', () => {
  beforeEach(() => {
    listScannerActivitiesMock.mockReset();
    clearScannerActivitiesMock.mockReset();
    listScannerActivitiesMock.mockReturnValue([]);
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('does not clear completed records when confirmation is rejected', () => {
    listScannerActivitiesMock.mockReturnValue([
      {
        id: 'completed-1',
        status: 'completed',
        fileName: 'decision.pdf',
        scannerType: 'va-rating-decision',
        progress: 100,
      },
    ]);
    vi.spyOn(window, 'confirm').mockReturnValue(false);

    render(<ScannerActivityPage />);

    fireEvent.click(screen.getByRole('button', { name: 'Clear Completed' }));

    expect(window.confirm).toHaveBeenCalledTimes(1);
    expect(clearScannerActivitiesMock).not.toHaveBeenCalled();
  });

  it('clears all records when confirmation is accepted', () => {
    listScannerActivitiesMock.mockReturnValue([
      {
        id: 'queued-1',
        status: 'queued',
        fileName: 'upload.pdf',
        scannerType: 'scanner-hub',
        progress: 10,
      },
    ]);
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    render(<ScannerActivityPage />);

    fireEvent.click(screen.getByRole('button', { name: 'Clear All' }));

    expect(window.confirm).toHaveBeenCalledTimes(1);
    expect(clearScannerActivitiesMock).toHaveBeenCalledWith({});
  });

  it('disables clear actions when there are no activity records', () => {
    render(<ScannerActivityPage />);

    expect(screen.getByRole('button', { name: 'Clear Completed' }).disabled).toBe(true);
    expect(screen.getByRole('button', { name: 'Clear All' }).disabled).toBe(true);
  });
});
