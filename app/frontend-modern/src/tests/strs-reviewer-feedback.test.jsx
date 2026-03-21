import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FindingFeedbackControls, ReviewerFeedbackPanel } from '../components/treatment/StrsReviewerFeedback.jsx';

describe('STR reviewer feedback UI', () => {
  it('renders recent feedback summary and items', () => {
    render(
      <ReviewerFeedbackPanel
        recentFeedback={[
          {
            findingLabel: 'Mortar Attack',
            classification: 'false_positive',
            findingType: 'event',
            fileName: 'ahlta-page-270.txt',
            matchedText: 'indirect fire',
            page: 270,
            reason: 'Capability statement, not combat event',
            savedAt: '2026-03-15T19:00:00.000Z',
          },
          {
            findingLabel: 'Lumbar Strain',
            classification: 'true_positive',
            findingType: 'injury',
            fileName: 'pt-encounter.txt',
            matchedText: 'lumbar strain',
            page: 8,
            reason: 'Clinical diagnosis documented',
            savedAt: '2026-03-15T19:01:00.000Z',
          },
        ]}
      />
    );

    expect(screen.getByText('Recent reviews: 2')).toBeTruthy();
    expect(screen.getByText('True positives: 1')).toBeTruthy();
    expect(screen.getByText('False positives: 1')).toBeTruthy();
    expect(screen.getByText('Mortar Attack')).toBeTruthy();
    expect(screen.getByText('Lumbar Strain')).toBeTruthy();
  });

  it('invokes the true and false positive actions from feedback controls', async () => {
    const user = userEvent.setup();
    const handleTruePositive = vi.fn();
    const handleFalsePositive = vi.fn();

    render(
      <FindingFeedbackControls
        onMarkTruePositive={handleTruePositive}
        onMarkFalsePositive={handleFalsePositive}
        isSaving={false}
        statusMessage='Ready for review.'
      />
    );

    await user.click(screen.getByRole('button', { name: 'Mark True Positive' }));
    await user.click(screen.getByRole('button', { name: 'Mark False Positive' }));

    expect(handleTruePositive).toHaveBeenCalledTimes(1);
    expect(handleFalsePositive).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Ready for review.')).toBeTruthy();
  });
});