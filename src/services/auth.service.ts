import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { User } from '../models/User';
import { BusinessSettings } from '../models/BusinessSettings';
import { config } from '../config/env';
import { SetupInput, LoginInput } from '../validation/auth.validation';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export interface SafeUser {
  id: string;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
  lastLogin?: Date;
}

function generateTokens(userId: string, email: string, role: string): TokenPair {
  const accessToken = jwt.sign({ userId, email, role }, config.jwtSecret, {
    expiresIn: config.jwtExpiresIn as jwt.SignOptions['expiresIn'],
  });
  const refreshToken = jwt.sign({ userId, email, role }, config.jwtRefreshSecret, {
    expiresIn: config.jwtRefreshExpiresIn as jwt.SignOptions['expiresIn'],
  });
  return { accessToken, refreshToken };
}

function sanitizeUser(user: {
  _id: unknown;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
  lastLogin?: Date;
}): SafeUser {
  return {
    id: String(user._id),
    name: user.name,
    email: user.email,
    role: user.role,
    isActive: user.isActive,
    lastLogin: user.lastLogin,
  };
}

export async function setupAdmin(
  data: SetupInput & { shopName?: string }
): Promise<SafeUser> {
  // Use findOneAndUpdate with upsert to atomically guard against concurrent setup calls.
  // If an admin already exists the upsert finds it and returns it without modification,
  // so we can detect the "already set up" case by checking whether the document was
  // newly inserted (upsertedId is set) or already present (upsertedId is null).
  const hashedPassword = await bcrypt.hash(data.password, 12);

  const result = await User.collection.findOneAndUpdate(
    { role: 'admin' },
    {
      $setOnInsert: {
        name: data.name,
        email: data.email,
        password: hashedPassword,
        role: 'admin',
        isActive: true,
      },
    },
    { upsert: true, returnDocument: 'before' }
  );

  // If a document was returned it means one already existed before this call.
  if (result !== null) {
    const err = Object.assign(new Error('Admin already set up'), { statusCode: 409 });
    throw err;
  }

  // Fetch the newly created user through Mongoose so we get the full document shape.
  const user = await User.findOne({ role: 'admin', email: data.email });
  if (!user) {
    throw Object.assign(new Error('Setup failed unexpectedly'), { statusCode: 500 });
  }

  // Create default business settings if none exist
  const settingsCount = await BusinessSettings.countDocuments();
  if (settingsCount === 0) {
    await BusinessSettings.create({
      shopName: data.shopName ?? 'My Shop',
    });
  }

  return sanitizeUser(user.toObject());
}

export async function loginUser(
  data: LoginInput
): Promise<{ user: SafeUser; tokens: TokenPair }> {
  // Select refreshTokenHash so we can overwrite it; password needed for comparePassword
  const user = await User.findOne({ email: data.email }).select('+password +refreshTokenHash');
  if (!user) {
    throw Object.assign(new Error('Invalid email or password'), { statusCode: 401 });
  }

  if (!user.isActive) {
    throw Object.assign(new Error('Account is deactivated'), { statusCode: 403 });
  }

  const isMatch = await user.comparePassword(data.password);
  if (!isMatch) {
    throw Object.assign(new Error('Invalid email or password'), { statusCode: 401 });
  }

  user.lastLogin = new Date();

  const tokens = generateTokens(String(user._id), user.email, user.role);

  // Store hashed refresh token for rotation/revocation
  user.refreshTokenHash = await bcrypt.hash(tokens.refreshToken, 10);
  await user.save();

  return { user: sanitizeUser(user.toObject()), tokens };
}

/**
 * Verifies the incoming refresh token, issues a new access token AND a new refresh token
 * (token rotation), and stores the new hash. The old refresh token is immediately invalidated.
 */
export async function refreshAccessToken(
  refreshToken: string
): Promise<{ accessToken: string; refreshToken: string }> {
  let decoded: { userId: string; email: string; role: string };
  try {
    decoded = jwt.verify(refreshToken, config.jwtRefreshSecret) as {
      userId: string;
      email: string;
      role: string;
    };
  } catch {
    throw Object.assign(new Error('Invalid or expired refresh token'), { statusCode: 401 });
  }

  // Fetch stored hash to validate the token hasn't been revoked
  const user = await User.findById(decoded.userId).select('+refreshTokenHash');
  if (!user || !user.isActive) {
    throw Object.assign(new Error('User not found or inactive'), { statusCode: 401 });
  }

  if (!user.refreshTokenHash) {
    throw Object.assign(new Error('No active session — please log in again'), { statusCode: 401 });
  }

  const isValid = await bcrypt.compare(refreshToken, user.refreshTokenHash);
  if (!isValid) {
    // Possible token reuse — clear stored hash to invalidate all sessions for this user
    user.refreshTokenHash = undefined;
    await user.save();
    throw Object.assign(
      new Error('Refresh token reuse detected — session invalidated'),
      { statusCode: 401 }
    );
  }

  // Rotate: generate fresh token pair and persist the new hash
  const tokens = generateTokens(String(user._id), user.email, user.role);
  user.refreshTokenHash = await bcrypt.hash(tokens.refreshToken, 10);
  await user.save();

  return tokens;
}

/**
 * Revoke the refresh token on logout by clearing the stored hash.
 */
export async function revokeRefreshToken(userId: string): Promise<void> {
  await User.findByIdAndUpdate(userId, { $unset: { refreshTokenHash: '' } });
}

export async function getMe(userId: string): Promise<SafeUser> {
  const user = await User.findById(userId);
  if (!user) {
    throw Object.assign(new Error('User not found'), { statusCode: 404 });
  }
  return sanitizeUser(user.toObject());
}
