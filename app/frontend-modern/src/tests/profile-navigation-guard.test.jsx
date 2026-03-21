import { describe, expect, it } from 'vitest';
import { shouldAllowNavigation } from '../services/profile/profileNavigationGuard.js';

describe('profile navigation guard', () => {
  it('allows navigation when there are no unsaved changes', () => {
    expect(shouldAllowNavigation({
      hasUnsavedChanges: false,
      currentPath: '/profile',
      targetPath: '/military-service',
    })).toBe(true);
  });

  it('blocks navigation away when unsaved changes exist', () => {
    expect(shouldAllowNavigation({
      hasUnsavedChanges: true,
      currentPath: '/profile',
      targetPath: '/military-service',
    })).toBe(false);
  });

  it('allows same-path navigation when unsaved changes exist', () => {
    expect(shouldAllowNavigation({
      hasUnsavedChanges: true,
      currentPath: '/profile',
      targetPath: '/profile',
    })).toBe(true);
  });
});
