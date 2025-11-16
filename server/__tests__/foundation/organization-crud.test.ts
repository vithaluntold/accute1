import request from 'supertest';
import app from '../../test-app';
import { createOrg, createAuthenticatedUser } from '../helpers';
import { db } from '../../db';
import { organizations } from '@shared/schema';
import { eq } from 'drizzle-orm';

describe('Organization Creation', () => {
  let ownerToken: string;

  beforeEach(async () => {
    const { token } = await createAuthenticatedUser({ role: 'owner' });
    ownerToken = token;
  });

  // HAPPY PATH
  test('TC-ORG-001: Create organization with valid data', async () => {
    const response = await request(app)
      .post('/api/organizations')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        name: 'Test Accounting Firm',
        industry: 'accounting',
        size: '1-10'
      });

    expect(response.status).toBe(201);
    expect(response.body.id).toBeDefined();
    expect(response.body.name).toBe('Test Accounting Firm');
  });

  // VALIDATION
  test('TC-ORG-002: Reject organization with missing name', async () => {
    const response = await request(app)
      .post('/api/organizations')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ industry: 'accounting' });

    expect(response.status).toBe(400);
    expect(response.body.error).toBeDefined();
  });

  test('TC-ORG-003: Reject organization with name < 2 characters', async () => {
    const response = await request(app)
      .post('/api/organizations')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: 'A' });

    expect(response.status).toBe(400);
  });

  test('TC-ORG-004: Reject organization with name > 100 characters', async () => {
    const response = await request(app)
      .post('/api/organizations')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: 'A'.repeat(101) });

    expect(response.status).toBe(400);
  });

  test('TC-ORG-005: Accept organization with special characters in name', async () => {
    const response = await request(app)
      .post('/api/organizations')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: 'Smith & Associates, LLC' });

    expect(response.status).toBe(201);
    expect(response.body.name).toBe('Smith & Associates, LLC');
  });

  // DUPLICATE HANDLING
  test('TC-ORG-006: Allow duplicate organization names (different entities)', async () => {
    const name = 'ABC Accounting';
    
    await request(app)
      .post('/api/organizations')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name });

    const response = await request(app)
      .post('/api/organizations')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name });

    expect(response.status).toBe(201); // Should allow duplicates
  });

  // RETRIEVAL
  test('TC-ORG-007: Get organization by ID', async () => {
    const org = await createOrg({ name: 'Test Firm' });
    
    const response = await request(app)
      .get(`/api/organizations/${org.id}`)
      .set('Authorization', `Bearer ${ownerToken}`);

    expect(response.status).toBe(200);
    expect(response.body.name).toBe('Test Firm');
  });

  test('TC-ORG-008: Return 404 for non-existent organization', async () => {
    const response = await request(app)
      .get('/api/organizations/99999')
      .set('Authorization', `Bearer ${ownerToken}`);
    
    expect(response.status).toBe(404);
  });

  // UPDATE
  test('TC-ORG-009: Update organization name', async () => {
    const org = await createOrg({ name: 'Old Name' });
    
    const response = await request(app)
      .patch(`/api/organizations/${org.id}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: 'New Name' });

    expect(response.status).toBe(200);
    expect(response.body.name).toBe('New Name');
  });

  // DELETE
  test('TC-ORG-010: Delete organization', async () => {
    const org = await createOrg({ name: 'To Delete' });
    
    const response = await request(app)
      .delete(`/api/organizations/${org.id}`)
      .set('Authorization', `Bearer ${ownerToken}`);

    expect(response.status).toBe(204);
    
    // Verify deleted
    const deleted = await db.query.organizations.findFirst({
      where: eq(organizations.id, org.id)
    });
    expect(deleted).toBeUndefined();
  });

  // EDGE CASES
  test('TC-ORG-011: Handle SQL injection attempt in name', async () => {
    const response = await request(app)
      .post('/api/organizations')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: "'; DROP TABLE organizations; --" });

    expect(response.status).toBe(201); // Should sanitize and accept
    
    // Verify organizations table still exists
    const orgs = await db.query.organizations.findMany();
    expect(orgs).toBeDefined();
  });

  test('TC-ORG-012: Handle XSS attempt in name', async () => {
    const response = await request(app)
      .post('/api/organizations')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: '<script>alert("xss")</script>' });

    expect(response.status).toBe(201);
    // Verify script tags are stored safely
    expect(response.body.name).toContain('<script>');
  });

  test('TC-ORG-013: Handle emoji in organization name', async () => {
    const response = await request(app)
      .post('/api/organizations')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: 'ABC Accounting 🚀' });

    expect(response.status).toBe(201);
    expect(response.body.name).toBe('ABC Accounting 🚀');
  });

  test('TC-ORG-014: Handle Unicode characters (Chinese, Arabic, etc.)', async () => {
    const response = await request(app)
      .post('/api/organizations')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: '会计事务所' });

    expect(response.status).toBe(201);
    expect(response.body.name).toBe('会计事务所');
  });

  test('TC-ORG-015: Verify timestamps (createdAt, updatedAt)', async () => {
    const org = await createOrg({ name: 'Timestamp Test' });
    
    expect(org.createdAt).toBeDefined();
    expect(org.updatedAt).toBeDefined();
    expect(new Date(org.createdAt)).toBeInstanceOf(Date);
    expect(new Date(org.updatedAt)).toBeInstanceOf(Date);
  });
});
