import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, fireEvent } from '@testing-library/react';

// Mock the API client to avoid network calls
vi.mock('../api/client', () => ({
  getStateBenefitsByCode: vi.fn(() => Promise.resolve({ data: null })),
  getStructuredStateBenefits: vi.fn(() => Promise.resolve({ data: null })),
}));

const workspaceRef = { current: {} };

vi.mock('../context/ClaimWorkspaceContext', () => ({
  useClaimWorkspace: () => ({
    workspace: workspaceRef.current,
    workflow: {},
    updateWorkspace: vi.fn(),
    readWorkspace: vi.fn(),
    normalizeWorkspace: vi.fn((v) => v),
  }),
}));

import { StateBenefitsPage } from '../pages/benefits/StateBenefitsPage.jsx';

// ── Tab 07 — Resources: UI Binding ───────────────────────────────────────────

describe('Tab 07 — Resources: UI Binding', () => {
  beforeEach(() => {
    workspaceRef.current = {};
  });

  afterEach(() => {
    cleanup();
  });

  it('renders the State Benefits page with a heading', () => {
    render(<StateBenefitsPage />);
    // Use getAllByText because 'state benefits' appears in h1 and h2
    const matches = screen.getAllByText(/state benefits/i);
    expect(matches.length).toBeGreaterThan(0);
  });

  it('renders a state selection dropdown', () => {
    render(<StateBenefitsPage />);
    const selects = document.querySelectorAll('select');
    expect(selects.length).toBeGreaterThan(0);
  });

  it('state dropdown shows a "Select state..." placeholder option', () => {
    render(<StateBenefitsPage />);
    expect(screen.getByText(/select state/i)).toBeTruthy();
  });

  it('state dropdown contains CA as an option', () => {
    render(<StateBenefitsPage />);
    const options = document.querySelectorAll('select option');
    const values = Array.from(options).map((o) => o.value);
    expect(values).toContain('CA');
  });

  it('state dropdown contains TX as an option', () => {
    render(<StateBenefitsPage />);
    const options = document.querySelectorAll('select option');
    const values = Array.from(options).map((o) => o.value);
    expect(values).toContain('TX');
  });

  it('state dropdown contains VA as an option', () => {
    render(<StateBenefitsPage />);
    const options = document.querySelectorAll('select option');
    const values = Array.from(options).map((o) => o.value);
    expect(values).toContain('VA');
  });

  it('renders service-connected checkbox label', () => {
    render(<StateBenefitsPage />);
    expect(screen.getByText(/service.?connected/i)).toBeTruthy();
  });

  it('renders combat veteran checkbox label', () => {
    render(<StateBenefitsPage />);
    expect(screen.getByText(/combat veteran/i)).toBeTruthy();
  });

  it('renders wartime veteran checkbox label', () => {
    render(<StateBenefitsPage />);
    expect(screen.getByText(/wartime veteran/i)).toBeTruthy();
  });

  it('renders homeowner checkbox label', () => {
    render(<StateBenefitsPage />);
    expect(screen.getByText(/homeowner/i)).toBeTruthy();
  });

  it('renders combined rating input', () => {
    render(<StateBenefitsPage />);
    const inputs = document.querySelectorAll('input[type="number"]');
    expect(inputs.length).toBeGreaterThan(0);
  });

  it('selecting a state code updates the badge text', () => {
    render(<StateBenefitsPage />);
    const select = document.querySelector('select');
    fireEvent.change(select, { target: { value: 'TX' } });
    // TX appears in both the badge div and as an option; verify through the badge element
    const badge = document.querySelector('.page-badge');
    expect(badge?.textContent?.trim()).toBe('TX');
  });
});

// ── Tab 07 — Resources: Dataset Reflection ────────────────────────────────────

describe('Tab 07 — Resources: Dataset Reflection', () => {
  afterEach(() => {
    cleanup();
  });

  it('autofill line appears when workspace profile has a valid state', () => {
    workspaceRef.current = {
      profile: { state: 'FL' },
      militaryService: { records: [] },
      vaDecision: {},
    };
    render(<StateBenefitsPage />);
    // The autofill notice renders when the derived profile has state/rating/flags set
    // The state selector should be pre-populated with FL from useEffect
    const select = document.querySelector('select');
    expect(select.value).toBe('FL');
  });

  it('combatVeteran is derived from militaryService records', () => {
    workspaceRef.current = {
      profile: { state: 'TX' },
      militaryService: {
        records: [{ combatVeteran: true, startDate: '2003-01-01', endDate: '2007-01-01' }],
      },
      vaDecision: {},
    };
    render(<StateBenefitsPage />);
    // The combat veteran checkbox should be pre-checked
    const checkboxes = document.querySelectorAll('input[type="checkbox"]');
    const combatCheckbox = Array.from(checkboxes).find((cb) => {
      const label = cb.closest('label');
      return label && /combat/i.test(label.textContent);
    });
    expect(combatCheckbox?.checked).toBe(true);
  });

  it('wartimeVeteran is derived from POST-9/11 service dates', () => {
    workspaceRef.current = {
      profile: {},
      militaryService: {
        records: [{ startDate: '2001-11-01', endDate: '2005-01-01', era: '', combatVeteran: false }],
      },
      vaDecision: {},
    };
    render(<StateBenefitsPage />);
    const checkboxes = document.querySelectorAll('input[type="checkbox"]');
    const wartimeCheckbox = Array.from(checkboxes).find((cb) => {
      const label = cb.closest('label');
      return label && /wartime/i.test(label.textContent);
    });
    expect(wartimeCheckbox?.checked).toBe(true);
  });

  it('rating derives from vaDecision entitlementSnapshot', () => {
    workspaceRef.current = {
      profile: {},
      militaryService: { records: [] },
      vaDecision: { entitlementSnapshot: { rating: 70 }, selectedDecision: null, decisions: [] },
    };
    render(<StateBenefitsPage />);
    const ratingInput = document.querySelector('input[type="number"]');
    expect(Number(ratingInput?.value)).toBe(70);
  });

  it('serviceConnected is true when vaDecision entitlementSnapshot has conditionsCount > 0', () => {
    workspaceRef.current = {
      profile: {},
      militaryService: { records: [] },
      vaDecision: { entitlementSnapshot: { rating: 0, conditionsCount: 2 }, decisions: [] },
    };
    render(<StateBenefitsPage />);
    const serviceConnectedCheckbox = Array.from(document.querySelectorAll('input[type="checkbox"]')).find((cb) => {
      const label = cb.closest('label');
      return label && /service.?connected/i.test(label.textContent);
    });
    expect(serviceConnectedCheckbox?.checked).toBe(true);
  });

  it('state rejects invalid state code and defaults to empty', () => {
    workspaceRef.current = {
      profile: { state: 'XZ' }, // not a valid state code
      militaryService: { records: [] },
      vaDecision: {},
    };
    render(<StateBenefitsPage />);
    const select = document.querySelector('select');
    // Invalid state should not set a selection — remains at the placeholder
    expect(select.value).toBe('');
  });

  it('page renders the benefit research checklist section', () => {
    workspaceRef.current = {};
    render(<StateBenefitsPage />);
    expect(screen.getByText(/benefit research checklist/i)).toBeTruthy();
  });

  it('STATE_OPTIONS contains DC as a territory option', () => {
    render(<StateBenefitsPage />);
    const options = document.querySelectorAll('select option');
    const values = Array.from(options).map((o) => o.value);
    expect(values).toContain('DC');
  });
});
