import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';

import { WorkspaceUpdatesPage } from '../pages/WorkspaceUpdatesPage.jsx';

describe('WorkspaceUpdatesPage', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('renders metadata health details from API response', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          health: {
            status: 'warn',
            warnings: ['Current benefits snapshot unavailable'],
            errors: [],
          },
          freshness: {
            staleSources: ['resources/state-benefits.json'],
          },
        },
      }),
    });

    render(<WorkspaceUpdatesPage />);

    expect(await screen.findByText(/Health status:/)).toBeTruthy();
    expect(await screen.findByText((content, element) => {
      if (!element) return false;
      return element.tagName === 'STRONG' && /warn/i.test(content);
    })).toBeTruthy();
    expect(await screen.findByText('Current benefits snapshot unavailable')).toBeTruthy();
    expect(await screen.findByText(/Stale sources:/)).toBeTruthy();
  });

  it('renders an error when metadata request fails', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      status: 503,
      json: async () => ({}),
    });

    render(<WorkspaceUpdatesPage />);

    expect(await screen.findByText('Failed to load audit metadata (503)')).toBeTruthy();
  });

  it('normalizes top-level metadata payloads without a data wrapper', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        healthStatus: 'fail',
        warnings: ['Knowledge manifest integrity check not fully healthy'],
        errors: ['Benefits audit metadata unavailable'],
        staleSources: ['watchdog_now.json'],
      }),
    });

    render(<WorkspaceUpdatesPage />);

    expect(await screen.findByText((content, element) => {
      if (!element) return false;
      return element.tagName === 'STRONG' && /fail/i.test(content);
    })).toBeTruthy();
    expect(await screen.findByText('Knowledge manifest integrity check not fully healthy')).toBeTruthy();
    expect(await screen.findByText('Benefits audit metadata unavailable')).toBeTruthy();
    expect(await screen.findByText(/watchdog_now.json/)).toBeTruthy();
  });
});
