import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const updateWorkspaceMock = vi.fn();
const readWorkspaceMock = vi.fn();
const normalizeWorkspaceMock = vi.fn((value) => value);
const workspaceRef = { current: {} };

vi.mock('../context/ClaimWorkspaceContext', () => ({
  useClaimWorkspace: () => ({
    workspace: workspaceRef.current,
    workflow: {},
    updateWorkspace: updateWorkspaceMock,
    readWorkspace: readWorkspaceMock,
    normalizeWorkspace: normalizeWorkspaceMock,
  }),
}));

// eslint-disable-next-line no-unused-vars
import { ProfilePage } from '../components/profile/ProfilePage.jsx';

function applyLastWorkspaceUpdate(base = {}) {
  for (let index = updateWorkspaceMock.mock.calls.length - 1; index >= 0; index -= 1) {
    const [updater] = updateWorkspaceMock.mock.calls[index] || [];
    if (typeof updater !== 'function') {
      continue;
    }

    const next = updater(base);
    if (next?.profile) {
      return next;
    }
  }

  return base;
}

describe('ProfilePage interactions', () => {
  beforeEach(() => {
    localStorage.clear();
    updateWorkspaceMock.mockClear();
    readWorkspaceMock.mockClear();
    normalizeWorkspaceMock.mockClear();
    workspaceRef.current = { workspaceVersion: 1, profile: null };
    readWorkspaceMock.mockReturnValue({ workspaceVersion: 1, profile: null });
  });

  afterEach(() => {
    cleanup();
  });

  it('renders all finalized fields in read and edit mode', async () => {
    const user = userEvent.setup();
    render(<ProfilePage />);

    await screen.findByRole('button', { name: 'Edit Personal Information' });
    expect(screen.getByText('Personal Information')).toBeTruthy();
    expect(screen.getByText('Contact Information')).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Edit Personal Information' }));
    expect(screen.getByLabelText('First Name')).toBeTruthy();
    expect(screen.getByLabelText('Middle Name')).toBeTruthy();
    expect(screen.getByLabelText('Last Name')).toBeTruthy();
    expect(screen.getByLabelText('Date of Birth')).toBeTruthy();
    expect(screen.getByLabelText('Last 4 of SSN')).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Edit Contact Information' }));
    expect(screen.getByLabelText('Email')).toBeTruthy();
    expect(screen.getByLabelText('Phone')).toBeTruthy();
    expect(screen.getByLabelText('City')).toBeTruthy();
    expect(screen.getByLabelText('State')).toBeTruthy();
    expect(screen.getByLabelText('Preferred Contact Method')).toBeTruthy();
  });

  it('saves and restores preferredContactMethod', async () => {
    const user = userEvent.setup();
    render(<ProfilePage />);

    await user.click(await screen.findByRole('button', { name: 'Edit Contact Information' }));
    await user.type(screen.getByLabelText('Email'), 'vet@example.com');
    await user.type(screen.getByLabelText('Phone'), '5551234567');
    await user.type(screen.getByLabelText('City'), 'Austin');
    await user.selectOptions(screen.getByLabelText('State'), 'TX');
    await user.selectOptions(screen.getByLabelText('Preferred Contact Method'), 'text');

    await user.click(screen.getByRole('button', { name: 'Save Contact Information' }));

    const nextWorkspace = applyLastWorkspaceUpdate({ workspaceVersion: 1 });
    expect(nextWorkspace.profile.preferredContactMethod).toBe('text');

    cleanup();
    readWorkspaceMock.mockReturnValue(nextWorkspace);
    render(<ProfilePage />);
    await user.click(await screen.findByRole('button', { name: 'Edit Contact Information' }));
    expect(screen.getByLabelText('Preferred Contact Method').value).toBe('text');
  });

  it('shows sticky save bar only when dirty', async () => {
    const user = userEvent.setup();
    render(<ProfilePage />);

    expect(screen.queryByLabelText('Save all profile changes')).toBeNull();

    await user.click(await screen.findByRole('button', { name: 'Edit Personal Information' }));
    await user.type(screen.getByLabelText('First Name'), 'Jordan');
    await user.type(screen.getByLabelText('Last Name'), 'Smith');
    await user.type(screen.getByLabelText('Date of Birth'), '1980-01-01');
    await user.type(screen.getByLabelText('Last 4 of SSN'), '1234');
    expect(screen.getByLabelText('Save all profile changes')).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Save Personal Information' }));
    expect(screen.queryByLabelText('Save all profile changes')).toBeNull();
  });

  it('prevents browser unload with unsaved changes', async () => {
    const user = userEvent.setup();
    render(<ProfilePage />);

    await user.click(await screen.findByRole('button', { name: 'Edit Personal Information' }));
    await user.type(screen.getByLabelText('First Name'), 'J');

    const unloadEvent = new Event('beforeunload', { cancelable: true });
    fireEvent(window, unloadEvent);

    expect(unloadEvent.defaultPrevented).toBe(true);
  });
});
