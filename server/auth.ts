import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { db, User } from './db.ts';

const JWT_SECRET = process.env.JWT_SECRET || 'aether-super-secure-jwt-secret-key-2026';

export interface AuthRequest extends Request {
  user?: User;
}

export function generateToken(user: User): string {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      username: user.username,
      role: user.role
    },
    JWT_SECRET,
    { expiresIn: '30d' }
  );
}

export function verifyToken(token: string): { id: string; email: string; username: string; role: string } | null {
  try {
    return jwt.verify(token, JWT_SECRET) as { id: string; email: string; username: string; role: string };
  } catch {
    return null;
  }
}

export function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  const tokenFromQuery = req.query.token as string;
  let token: string | undefined;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7);
  } else if (tokenFromQuery) {
    token = tokenFromQuery;
  }

  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const payload = verifyToken(token);
  if (!payload) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  const user = db.users.find(u => u.id === payload.id);
  if (!user) {
    return res.status(401).json({ error: 'User no longer exists' });
  }

  if (user.isSuspended) {
    return res.status(403).json({ error: 'This account has been suspended by administration' });
  }

  req.user = user;
  next();
}

export function requireAdmin(req: AuthRequest, res: Response, next: NextFunction) {
  requireAuth(req, res, () => {
    if (req.user?.role !== 'admin') {
      return res.status(403).json({ error: 'Administrator access required' });
    }
    next();
  });
}
