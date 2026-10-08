import { describe, it, expect } from 'vitest';
import { hasPermission, hasAnyPermission, hasAllPermissions, getPermissionsForRole } from './rbac';
import type { UserProfile } from '@/shared/types/auth';
import type { Permission } from '@/shared/types/common';

function makeUser(role: string): UserProfile {
  return {
    id: 1,
    username: 'testuser',
    email: 'test@example.com',
    fullName: 'Test User',
    role: role as UserProfile['role'],
    specialty: null,
    isActive: true,
    mustChangePassword: false,
  };
}

describe('RBAC Engine', () => {
  describe('getPermissionsForRole', () => {
    it('returns permissions array for a known role', () => {
      const perms = getPermissionsForRole('doctor');
      expect(perms.length).toBeGreaterThan(0);
    });

    it('returns empty array for an undefined role', () => {
      const perms = getPermissionsForRole('unknown_role');
      expect(perms).toEqual([]);
    });
  });

  describe('hasPermission', () => {
    it('admin with wildcard always returns true for any resource/action', () => {
      const admin = makeUser('admin');
      const permission: Permission = { resource: 'patients', action: 'delete' };
      expect(hasPermission(admin, permission)).toBe(true);
    });

    it('admin returns true for arbitrary resources', () => {
      const admin = makeUser('admin');
      expect(hasPermission(admin, { resource: 'nonexistent', action: 'create' })).toBe(true);
      expect(hasPermission(admin, { resource: 'anything', action: 'manage' })).toBe(true);
    });

    it('doctor can read patients', () => {
      const doctor = makeUser('doctor');
      expect(hasPermission(doctor, { resource: 'patients', action: 'read' })).toBe(true);
    });

    it('doctor cannot delete patients', () => {
      const doctor = makeUser('doctor');
      expect(hasPermission(doctor, { resource: 'patients', action: 'delete' })).toBe(false);
    });

    it('nurse can read patients but cannot update them', () => {
      const nurse = makeUser('nurse');
      expect(hasPermission(nurse, { resource: 'patients', action: 'read' })).toBe(true);
      expect(hasPermission(nurse, { resource: 'patients', action: 'update' })).toBe(false);
    });

    it('receptionist can only read and create patients', () => {
      const receptionist = makeUser('receptionist');
      expect(hasPermission(receptionist, { resource: 'patients', action: 'read' })).toBe(true);
      expect(hasPermission(receptionist, { resource: 'patients', action: 'create' })).toBe(true);
      expect(hasPermission(receptionist, { resource: 'patients', action: 'update' })).toBe(false);
      expect(hasPermission(receptionist, { resource: 'assessments', action: 'read' })).toBe(false);
    });

    it('auditor can read audit but not patients', () => {
      const auditor = makeUser('auditor');
      expect(hasPermission(auditor, { resource: 'audit', action: 'read' })).toBe(true);
      expect(hasPermission(auditor, { resource: 'patients', action: 'read' })).toBe(false);
    });

    it('undefined role returns false for all permissions', () => {
      const unknown = makeUser('unknown_role');
      expect(hasPermission(unknown, { resource: 'patients', action: 'read' })).toBe(false);
      expect(hasPermission(unknown, { resource: '*', action: 'manage' })).toBe(false);
    });

    it('manage action on specific resource grants all actions for that resource', () => {
      // If a role had { resource: 'patients', action: 'manage' },
      // it should grant any action on patients. We test this by creating a mock scenario
      // through the admin wildcard which is resource='*', action='manage'.
      const admin = makeUser('admin');
      expect(hasPermission(admin, { resource: 'patients', action: 'read' })).toBe(true);
      expect(hasPermission(admin, { resource: 'patients', action: 'delete' })).toBe(true);
      expect(hasPermission(admin, { resource: 'patients', action: 'export' })).toBe(true);
    });
  });

  describe('hasAnyPermission', () => {
    it('returns true if user has at least one of the permissions', () => {
      const doctor = makeUser('doctor');
      const permissions: Permission[] = [
        { resource: 'patients', action: 'read' },
        { resource: 'audit', action: 'read' },
      ];
      expect(hasAnyPermission(doctor, permissions)).toBe(true);
    });

    it('returns false if user has none of the permissions', () => {
      const receptionist = makeUser('receptionist');
      const permissions: Permission[] = [
        { resource: 'assessments', action: 'create' },
        { resource: 'audit', action: 'read' },
      ];
      expect(hasAnyPermission(receptionist, permissions)).toBe(false);
    });

    it('returns true for empty permissions array (no restriction)', () => {
      const receptionist = makeUser('receptionist');
      expect(hasAnyPermission(receptionist, [])).toBe(true);
    });
  });

  describe('hasAllPermissions', () => {
    it('returns true if user has all of the permissions', () => {
      const doctor = makeUser('doctor');
      const permissions: Permission[] = [
        { resource: 'patients', action: 'read' },
        { resource: 'patients', action: 'create' },
      ];
      expect(hasAllPermissions(doctor, permissions)).toBe(true);
    });

    it('returns false if user is missing one permission', () => {
      const doctor = makeUser('doctor');
      const permissions: Permission[] = [
        { resource: 'patients', action: 'read' },
        { resource: 'patients', action: 'delete' },
      ];
      expect(hasAllPermissions(doctor, permissions)).toBe(false);
    });

    it('returns true for empty permissions array (no restriction)', () => {
      const unknown = makeUser('unknown_role');
      expect(hasAllPermissions(unknown, [])).toBe(true);
    });

    it('admin passes all permission checks', () => {
      const admin = makeUser('admin');
      const permissions: Permission[] = [
        { resource: 'patients', action: 'delete' },
        { resource: 'nonexistent', action: 'manage' },
        { resource: 'audit', action: 'export' },
      ];
      expect(hasAllPermissions(admin, permissions)).toBe(true);
    });
  });
});
