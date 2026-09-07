import jwt from 'jsonwebtoken';
import { AcWebRequest, AcWebResponse } from 'ac-web';
import { UserRole } from '../database/schema';
import { envConfig } from '../config/env';

export const JWT_SECRET = envConfig.JWT_SECRET;

export interface TokenPayload {
  userId: number;
  username: string;
  role: UserRole;
  zoneId?: string | null;
}

export function generateToken(payload: TokenPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
}

export function verifyToken(token: string): TokenPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as TokenPayload;
  } catch {
    return null;
  }
}

export function getUserFromRequest(request: AcWebRequest): TokenPayload | null {
  // Check authorization header
  const authHeader = request.headers['authorization'] || request.headers['Authorization'];
  let token = '';

  if (authHeader && typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7).trim();
  } else if (request.cookies && request.cookies['token']) {
    token = request.cookies['token'];
  }

  if (!token) return null;
  return verifyToken(token);
}

export function requireAuth(request: AcWebRequest, allowedRoles?: UserRole[]): { user: TokenPayload } | AcWebResponse {
  const user = getUserFromRequest(request);
  if (!user) {
    return AcWebResponse.json({
      data: { success: false, error: 'Unauthorized: Authentication required' },
      responseCode: 401,
    });
  }

  if (allowedRoles && allowedRoles.length > 0) {
    if (!allowedRoles.includes(user.role)) {
      return AcWebResponse.json({
        data: { success: false, error: `Forbidden: Requires role ${allowedRoles.join(' or ')}` },
        responseCode: 403,
      });
    }
  }

  return { user };
}
