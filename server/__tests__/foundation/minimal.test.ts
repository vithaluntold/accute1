import { describe, test, expect } from 'vitest';
import { createOrg, createUser } from '../helpers';

describe('Minimal Test Suite', () => {
  test('Can create organization', async () => {
    const org = await createOrg({ name: 'Minimal Test Org' });
    
    expect(org).toBeDefined();
    expect(org.id).toBeDefined();
    expect(org.name).toBe('Minimal Test Org');
  }, 10000);

  test('Can create user', async () => {
    const user = await createUser({
      email: 'minimal@test.com',
      password: 'TestPass123!',
      firstName: 'Minimal',
      lastName: 'Test'
    });
    
    expect(user).toBeDefined();
    expect(user.id).toBeDefined();
    expect(user.email).toBe('minimal@test.com');
    expect(user.password).toBeDefined(); // Schema has 'password' not 'passwordHash'
    expect(user.roleId).toBeDefined(); // Schema has 'roleId' not 'role'
  }, 10000);

  test('Basic math works', () => {
    expect(2 + 2).toBe(4);
  });
});
