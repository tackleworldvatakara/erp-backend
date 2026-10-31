import jwt from 'jsonwebtoken';
import { Request, Response } from 'express';
import { asyncHandler } from '../middleware/asyncHandler';
import {
  setupAdmin,
  loginUser,
  refreshAccessToken,
  revokeRefreshToken,
  getMe,
} from '../services/auth.service';
import { sendSuccess, sendError } from '../utils/response';
import { config } from '../config/env';

const REFRESH_COOKIE = 'refreshToken';
const COOKIE_SCOPE_OPTIONS = {
  httpOnly: true,
  secure: config.isProduction,
  sameSite: (config.isProduction ? 'none' : 'strict') as 'none' | 'strict',
  ...(config.cookieDomain && { domain: config.cookieDomain }),
};
const COOKIE_OPTIONS = {
  ...COOKIE_SCOPE_OPTIONS,
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
};

/**
 * @swagger
 * /auth/setup:
 *   post:
 *     summary: Initial admin setup (only available before first user exists)
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, email, password]
 *             properties:
 *               name: { type: string, minLength: 2 }
 *               email: { type: string, format: email }
 *               password: { type: string, minLength: 8 }
 *               shopName: { type: string }
 *     responses:
 *       201:
 *         description: Admin created successfully
 *       409:
 *         description: Admin already exists
 */
export const setupController = asyncHandler(async (req: Request, res: Response) => {
  const user = await setupAdmin(req.body);
  sendSuccess(res, { user }, 'Admin account created successfully', 201);
});

/**
 * @swagger
 * /auth/login:
 *   post:
 *     summary: Login with email and password
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email: { type: string, format: email }
 *               password: { type: string }
 *     responses:
 *       200:
 *         description: Login successful, returns accessToken and user
 *       401:
 *         description: Invalid credentials
 */
export const loginController = asyncHandler(async (req: Request, res: Response) => {
  const { user, tokens } = await loginUser(req.body);
  res.cookie(REFRESH_COOKIE, tokens.refreshToken, COOKIE_OPTIONS);
  sendSuccess(res, { accessToken: tokens.accessToken, user }, 'Login successful');
});

/**
 * @swagger
 * /auth/refresh:
 *   post:
 *     summary: Refresh access token using the httpOnly refresh cookie
 *     tags: [Auth]
 *     responses:
 *       200:
 *         description: New access token issued
 *       401:
 *         description: Missing or invalid refresh token
 */
export const refreshController = asyncHandler(async (req: Request, res: Response) => {
  const refreshToken = req.cookies[REFRESH_COOKIE] as string | undefined;
  if (!refreshToken) {
    return sendError(res, 'No refresh token', 401);
  }
  // refreshAccessToken now rotates the token — returns both new access + refresh tokens
  const tokens = await refreshAccessToken(refreshToken);
  // Set the rotated refresh token in the cookie
  res.cookie(REFRESH_COOKIE, tokens.refreshToken, COOKIE_OPTIONS);
  sendSuccess(res, { accessToken: tokens.accessToken }, 'Token refreshed');
});

/**
 * @swagger
 * /auth/logout:
 *   post:
 *     summary: Logout and clear refresh token cookie
 *     tags: [Auth]
 *     responses:
 *       200:
 *         description: Logged out successfully
 */
export const logoutController = asyncHandler(async (req: Request, res: Response) => {
  // Revoke the stored refresh token hash so even a stolen cookie cannot be reused.
  // The refresh token cookie is used to identify the user since the access token
  // may already be expired at logout time.
  const refreshToken = req.cookies[REFRESH_COOKIE] as string | undefined;
  if (refreshToken) {
    try {
      const decoded = jwt.decode(refreshToken) as { userId?: string } | null;
      if (decoded?.userId) {
        await revokeRefreshToken(decoded.userId);
      }
    } catch {
      // Ignore decode errors — still clear the cookie
    }
  }
  res.clearCookie(REFRESH_COOKIE, COOKIE_SCOPE_OPTIONS);
  sendSuccess(res, null, 'Logged out successfully');
});

/**
 * @swagger
 * /auth/me:
 *   get:
 *     summary: Get current authenticated user
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Current user info
 *       401:
 *         description: Not authenticated
 */
export const meController = asyncHandler(async (req: Request, res: Response) => {
  const user = await getMe(req.user!.userId);
  sendSuccess(res, { user });
});
