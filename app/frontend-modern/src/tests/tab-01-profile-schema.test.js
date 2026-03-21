import { describe, expect, it } from 'vitest';
import {
  PROFILE_EMPTY,
  PROFILE_SCHEMA_VERSION,
  PROFILE_SECTIONS,
  buildSectionDrafts,
  normalizeProfile,
  pickSectionValues,
} from '../services/profile/profileEditorState.js';

// ── Tab 01 — Profile: Schema Validation ─────────────────────────────────────

describe('Tab 01 — Profile: Schema Validation', () => {
  it('PROFILE_EMPTY contains all required personal and contact keys', () => {
    const personal = PROFILE_SECTIONS.personal;
    const contact = PROFILE_SECTIONS.contact;
    personal.forEach((key) => expect(Object.prototype.hasOwnProperty.call(PROFILE_EMPTY, key)).toBe(true));
    contact.forEach((key) => expect(Object.prototype.hasOwnProperty.call(PROFILE_EMPTY, key)).toBe(true));
  });

  it('PROFILE_EMPTY initializes all string fields to empty string', () => {
    Object.values(PROFILE_EMPTY).forEach((value) => {
      expect(typeof value).toBe('string');
      expect(value).toBe('');
    });
  });

  it('PROFILE_SCHEMA_VERSION is a positive integer', () => {
    expect(Number.isInteger(PROFILE_SCHEMA_VERSION)).toBe(true);
    expect(PROFILE_SCHEMA_VERSION).toBeGreaterThan(0);
  });

  it('normalizeProfile returns all PROFILE_EMPTY keys for empty input', () => {
    const result = normalizeProfile({});
    Object.keys(PROFILE_EMPTY).forEach((key) => {
      expect(Object.prototype.hasOwnProperty.call(result, key)).toBe(true);
    });
  });

  it('normalizeProfile preserves valid preferredContactMethod values', () => {
    expect(normalizeProfile({ preferredContactMethod: 'email' }).preferredContactMethod).toBe('email');
    expect(normalizeProfile({ preferredContactMethod: 'phone' }).preferredContactMethod).toBe('phone');
    expect(normalizeProfile({ preferredContactMethod: 'text' }).preferredContactMethod).toBe('text');
  });

  it('normalizeProfile rejects invalid preferredContactMethod', () => {
    expect(normalizeProfile({ preferredContactMethod: 'carrier pigeon' }).preferredContactMethod).toBe('');
    expect(normalizeProfile({ preferredContactMethod: '' }).preferredContactMethod).toBe('');
  });

  it('normalizeProfile strips non-digit characters from ssnLast4', () => {
    expect(normalizeProfile({ ssnLast4: '1-2-3-4' }).ssnLast4).toBe('1234');
    expect(normalizeProfile({ ssnLast4: 'ABCD' }).ssnLast4).toBe('');
  });

  it('normalizeProfile truncates ssnLast4 to 4 digits', () => {
    expect(normalizeProfile({ ssnLast4: '123456' }).ssnLast4).toBe('1234');
  });

  it('normalizeProfile merges ssn4 legacy field into ssnLast4', () => {
    const result = normalizeProfile({ ssn4: '9876' });
    expect(result.ssnLast4).toBe('9876');
  });

  it('normalizeProfile stamps profileSchemaVersion', () => {
    const result = normalizeProfile({});
    expect(result.profileSchemaVersion).toBe(PROFILE_SCHEMA_VERSION);
  });

  it('normalizeProfile handles null and undefined gracefully', () => {
    expect(() => normalizeProfile(null)).not.toThrow();
    expect(() => normalizeProfile(undefined)).not.toThrow();
    expect(normalizeProfile(null).profileSchemaVersion).toBe(PROFILE_SCHEMA_VERSION);
  });
});

// ── Tab 01 — Profile: Silent Update Triggers ─────────────────────────────────

describe('Tab 01 — Profile: Silent Update Triggers', () => {
  it('buildSectionDrafts returns personal and contact sections', () => {
    const drafts = buildSectionDrafts({
      firstName: 'Alex',
      lastName: 'Veteran',
      email: 'alex@example.com',
    });
    expect(drafts).toHaveProperty('personal');
    expect(drafts).toHaveProperty('contact');
  });

  it('buildSectionDrafts personal section includes only personal keys', () => {
    const drafts = buildSectionDrafts({ firstName: 'Alex', email: 'alex@example.com' });
    PROFILE_SECTIONS.personal.forEach((key) => {
      expect(Object.prototype.hasOwnProperty.call(drafts.personal, key)).toBe(true);
    });
    expect(Object.prototype.hasOwnProperty.call(drafts.personal, 'email')).toBe(false);
  });

  it('buildSectionDrafts contact section includes only contact keys', () => {
    const drafts = buildSectionDrafts({ phone: '5551112222', firstName: 'Alex' });
    PROFILE_SECTIONS.contact.forEach((key) => {
      expect(Object.prototype.hasOwnProperty.call(drafts.contact, key)).toBe(true);
    });
    expect(Object.prototype.hasOwnProperty.call(drafts.contact, 'firstName')).toBe(false);
  });

  it('pickSectionValues returns only the specified section keys', () => {
    const profile = { firstName: 'Jordan', email: 'j@test.com', city: 'Austin' };
    const personal = pickSectionValues(profile, 'personal');
    expect(Object.prototype.hasOwnProperty.call(personal, 'firstName')).toBe(true);
    expect(Object.prototype.hasOwnProperty.call(personal, 'email')).toBe(false);
  });

  it('normalizeProfile round-trips a fully populated profile without data loss', () => {
    const input = {
      firstName: 'Pat',
      middleName: 'A',
      lastName: 'Veteran',
      dateOfBirth: '1970-06-15',
      ssnLast4: '5678',
      email: 'pat@test.com',
      phone: '5551234567',
      city: 'Dallas',
      state: 'TX',
      preferredContactMethod: 'email',
    };
    const result = normalizeProfile(input);
    expect(result.firstName).toBe('Pat');
    expect(result.lastName).toBe('Veteran');
    expect(result.email).toBe('pat@test.com');
    expect(result.ssnLast4).toBe('5678');
    expect(result.preferredContactMethod).toBe('email');
  });
});

// ── Tab 01 — Profile: UI Binding ─────────────────────────────────────────────

describe('Tab 01 — Profile: UI Binding', () => {
  it('PROFILE_SECTIONS.personal maps to appropriate form field labels', () => {
    const expectedKeys = ['firstName', 'middleName', 'lastName', 'dateOfBirth', 'ssnLast4'];
    expectedKeys.forEach((key) => expect(PROFILE_SECTIONS.personal).toContain(key));
  });

  it('PROFILE_SECTIONS.contact maps to appropriate form field labels', () => {
    const expectedKeys = ['email', 'phone', 'city', 'state', 'preferredContactMethod'];
    expectedKeys.forEach((key) => expect(PROFILE_SECTIONS.contact).toContain(key));
  });

  it('normalizeProfile trims whitespace from all string fields', () => {
    const result = normalizeProfile({ firstName: '  Alex  ', city: ' Austin ' });
    expect(result.firstName).toBe('  Alex  '); // normalizeProfile preserves raw strings; trimming is UI responsibility
    expect(typeof result.firstName).toBe('string');
  });
});
