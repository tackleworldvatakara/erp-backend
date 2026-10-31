/**
 * Unit tests for auth.service.ts
 *
 * Mongoose models and jsonwebtoken are mocked so the tests run without a
 * real MongoDB connection or valid JWT secrets.
 *
 * vi.mock() calls are hoisted to the top of the file by Vitest, so all
 * variables referenced inside their factory functions must be created with
 * vi.hoisted() to ensure they are initialized before the factory runs.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// 1. Provide env vars BEFORE env.ts parses process.env
//    (vi.hoisted runs before imports in the transformed file)
// ---------------------------------------------------------------------------
const { mockUserModel, mockBusinessSettings, mockBcrypt, mockJwt } = vi.hoisted(() => {
  // Set the minimum env vars required by config/env.ts
  process.env['NODE_ENV'] = 'test';
  process.env['MONGODB_URI'] = 'mongodb://localhost:27017/erp_test';
  process.env['JWT_SECRET'] = 'test_jwt_secret_at_least_32_characters_long';
  process.env['JWT_REFRESH_SECRET'] = 'test_refresh_secret_at_least_32_chars_x';
  process.env['CLIENT_URL'] = 'http://localhost:5173';

  // Prevent env.ts from calling process.exit if validation fails in test mode
  vi.spyOn(process, 'exit').mockImplementation(() => {
    throw new Error('process.exit called during test');
  });

  const mockUserSave = vi.fn().mockResolvedValue(undefined);

  const baseUserDoc = {
    _id: 'user-id-123',
    name: 'Test Admin',
    email: 'admin@test.com',
    role: 'admin',
    isActive: true,
    lastLogin: undefined as Date | undefined,
    refreshTokenHash: undefined as string | undefined,
    comparePassword: vi.fn(),
    save: mockUserSave,
    toObject: vi.fn(() => ({
      _id: 'user-id-123',
      name: 'Test Admin',
      email: 'admin@test.com',
      role: 'admin',
      isActive: true,
      lastLogin: undefined,
    })),
  };

  const mockCollection = {
    findOneAndUpdate: vi.fn(),
  };

  const mockUserModel = {
    countDocuments: vi.fn(),
    create: vi.fn(),
    findOne: vi.fn(),
    findById: vi.fn(),
    findByIdAndUpdate: vi.fn(),
    collection: mockCollection,
    _save: mockUserSave,
    _base: baseUserDoc,
    _collection: mockCollection,
  };

  const mockBusinessSettings = {
    countDocuments: vi.fn().mockResolvedValue(0),
    create: vi.fn().mockResolvedValue({}),
  };

  const mockBcrypt = {
    hash: vi.fn().mockResolvedValue('hashed-refresh-token'),
    compare: vi.fn(),
  };

  const mockJwt = {
    sign: vi.fn().mockReturnValue('mock-token'),
    verify: vi.fn(),
  };

  return { mockUserModel, mockBusinessSettings, mockBcrypt, mockJwt };
});

// ---------------------------------------------------------------------------
// 2. Mock modules (factories run after vi.hoisted, before imports)
// ---------------------------------------------------------------------------
vi.mock('../../models/User', () => ({ User: mockUserModel }));
vi.mock('../../models/BusinessSettings', () => ({ BusinessSettings: mockBusinessSettings }));
vi.mock('bcryptjs', () => ({ default: mockBcrypt }));
vi.mock('jsonwebtoken', () => ({ default: mockJwt }));

// ---------------------------------------------------------------------------
// 3. Import service under test (after mocks are registered)
// ---------------------------------------------------------------------------
import { setupAdmin, loginUser, refreshAccessToken, revokeRefreshToken } from '../auth.service';

// ---------------------------------------------------------------------------
// Helper: create a fresh user document for each test
// ---------------------------------------------------------------------------
function makeUserDoc(overrides: Record<string, unknown> = {}) {
  return {
    ...mockUserModel._base,
    save: mockUserModel._save,
    comparePassword: vi.fn(),
    toObject: vi.fn(() => ({
      _id: 'user-id-123',
      name: 'Test Admin',
      email: 'admin@test.com',
      role: 'admin',
      isActive: true,
      lastLogin: undefined,
      ...overrides,
    })),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('setupAdmin', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockBusinessSettings.countDocuments.mockResolvedValue(0);
    mockBusinessSettings.create.mockResolvedValue({});
  });

  it('creates an admin user when no admin exists (atomic upsert path)', async () => {
    // collection.findOneAndUpdate returns null when the document was newly inserted
    // (returnDocument: 'before' + no prior match → null)
    mockUserModel._collection.findOneAndUpdate.mockResolvedValueOnce(null);
    const created = makeUserDoc();
    // After the upsert, the service does User.findOne to get the full Mongoose doc
    mockUserModel.findOne.mockResolvedValueOnce(created);

    const result = await setupAdmin({
      name: 'Test Admin',
      email: 'admin@test.com',
      password: 'Password123',
    });

    expect(mockUserModel._collection.findOneAndUpdate).toHaveBeenCalledOnce();
    expect(result.email).toBe('admin@test.com');
    expect(result.role).toBe('admin');
    // Password must not appear in the sanitized return value
    expect((result as unknown as Record<string, unknown>)['password']).toBeUndefined();
  });

  it('throws 409 when an admin already exists (one-admin guard)', async () => {
    // collection.findOneAndUpdate returns the existing document when upsert found a match
    const existingDoc = { _id: 'existing-admin', role: 'admin' };
    mockUserModel._collection.findOneAndUpdate.mockResolvedValueOnce(existingDoc);

    await expect(
      setupAdmin({ name: 'Another', email: 'other@test.com', password: 'Password123' })
    ).rejects.toMatchObject({ statusCode: 409 });

    // findOne (the post-upsert fetch) must NOT have been called
    expect(mockUserModel.findOne).not.toHaveBeenCalled();
  });
});

describe('loginUser', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUserModel._save.mockResolvedValue(undefined);
    mockBcrypt.hash.mockResolvedValue('hashed-refresh-token');
    mockJwt.sign.mockReturnValue('mock-token');
  });

  it('returns tokens on successful login', async () => {
    const userDoc = makeUserDoc({ isActive: true });
    userDoc.comparePassword = vi.fn().mockResolvedValue(true);
    mockUserModel.findOne.mockReturnValueOnce({
      select: vi.fn().mockResolvedValueOnce(userDoc),
    });

    const result = await loginUser({ email: 'admin@test.com', password: 'Password123' });

    expect(result.tokens.accessToken).toBe('mock-token');
    expect(result.tokens.refreshToken).toBe('mock-token');
    expect(result.user.email).toBe('admin@test.com');
  });

  it('throws 401 for unknown email', async () => {
    mockUserModel.findOne.mockReturnValueOnce({
      select: vi.fn().mockResolvedValueOnce(null),
    });

    await expect(
      loginUser({ email: 'nobody@test.com', password: 'Password123' })
    ).rejects.toMatchObject({ statusCode: 401 });
  });

  it('throws 401 for wrong password', async () => {
    const userDoc = makeUserDoc({ isActive: true });
    userDoc.comparePassword = vi.fn().mockResolvedValue(false);
    mockUserModel.findOne.mockReturnValueOnce({
      select: vi.fn().mockResolvedValueOnce(userDoc),
    });

    await expect(
      loginUser({ email: 'admin@test.com', password: 'wrong' })
    ).rejects.toMatchObject({ statusCode: 401 });
  });

  it('throws 403 for deactivated account', async () => {
    const userDoc = makeUserDoc({ isActive: false });
    mockUserModel.findOne.mockReturnValueOnce({
      select: vi.fn().mockResolvedValueOnce(userDoc),
    });

    await expect(
      loginUser({ email: 'admin@test.com', password: 'Password123' })
    ).rejects.toMatchObject({ statusCode: 403 });
  });
});

describe('refreshAccessToken — token rotation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUserModel._save.mockResolvedValue(undefined);
    mockBcrypt.hash.mockResolvedValue('new-hashed-refresh-token');
    mockJwt.sign.mockReturnValue('mock-token');
  });

  it('issues new token pair and rotates the stored hash', async () => {
    mockJwt.verify.mockReturnValueOnce({
      userId: 'user-id-123',
      email: 'admin@test.com',
      role: 'admin',
    });

    const userDoc = makeUserDoc({ isActive: true, refreshTokenHash: 'stored-hash' });
    mockUserModel.findById.mockReturnValueOnce({
      select: vi.fn().mockResolvedValueOnce(userDoc),
    });
    mockBcrypt.compare.mockResolvedValueOnce(true);

    const result = await refreshAccessToken('old-refresh-token');

    expect(result.accessToken).toBe('mock-token');
    expect(result.refreshToken).toBe('mock-token');
    // New hash should have been persisted
    expect(mockUserModel._save).toHaveBeenCalledOnce();
    expect(mockBcrypt.hash).toHaveBeenCalledOnce();
  });

  it('throws 401 for an invalid/expired refresh token', async () => {
    mockJwt.verify.mockImplementationOnce(() => {
      throw new Error('jwt expired');
    });

    await expect(refreshAccessToken('bad-token')).rejects.toMatchObject({ statusCode: 401 });
  });

  it('detects token reuse: clears hash and throws 401', async () => {
    mockJwt.verify.mockReturnValueOnce({
      userId: 'user-id-123',
      email: 'admin@test.com',
      role: 'admin',
    });

    const userDoc = makeUserDoc({ isActive: true, refreshTokenHash: 'stored-hash' });
    mockUserModel.findById.mockReturnValueOnce({
      select: vi.fn().mockResolvedValueOnce(userDoc),
    });
    // bcrypt.compare returns false → presented token doesn't match stored hash → reuse detected
    mockBcrypt.compare.mockResolvedValueOnce(false);

    await expect(refreshAccessToken('reused-token')).rejects.toMatchObject({ statusCode: 401 });

    // The stored hash must have been cleared to invalidate all sessions
    expect((userDoc as Record<string, unknown>)['refreshTokenHash']).toBeUndefined();
    expect(mockUserModel._save).toHaveBeenCalledOnce();
  });

  it('throws 401 when no refresh hash is stored (no active session)', async () => {
    mockJwt.verify.mockReturnValueOnce({
      userId: 'user-id-123',
      email: 'admin@test.com',
      role: 'admin',
    });

    const userDoc = makeUserDoc({ isActive: true, refreshTokenHash: undefined });
    mockUserModel.findById.mockReturnValueOnce({
      select: vi.fn().mockResolvedValueOnce(userDoc),
    });

    await expect(refreshAccessToken('any-token')).rejects.toMatchObject({ statusCode: 401 });
  });
});

describe('revokeRefreshToken', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('calls findByIdAndUpdate to clear the stored hash', async () => {
    mockUserModel.findByIdAndUpdate.mockResolvedValueOnce(null);
    await revokeRefreshToken('user-id-123');
    expect(mockUserModel.findByIdAndUpdate).toHaveBeenCalledWith(
      'user-id-123',
      { $unset: { refreshTokenHash: '' } }
    );
  });
});
