import { getIronSession } from 'iron-session';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getSessionSecret } from '@/lib/server-env';

export interface SessionData {
  isAdmin: boolean;
  userId?: string;
  username?: string;
  displayName?: string;
  role?: 'admin' | 'staff';
}

export interface SessionUser {
  userId: string;
  username: string;
  displayName: string;
  role: 'admin' | 'staff';
}

const sessionSecret = getSessionSecret();

export const sessionOptions = {
  password: sessionSecret,
  cookieName: 'admin_session',
  cookieOptions: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 60 * 60 * 24, // 24 hours
  },
};

export async function getSession() {
  const cookieStore = await cookies();
  return getIronSession<SessionData>(cookieStore, sessionOptions);
}

export async function isAuthenticated(): Promise<boolean> {
  const session = await getSession();
  return session.isAdmin === true;
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const session = await getSession();
  if (!session.isAdmin) return null;
  if (!session.userId || !session.username || !session.displayName || !session.role) {
    return null;
  }
  return {
    userId: session.userId,
    username: session.username,
    displayName: session.displayName,
    role: session.role,
  };
}

export async function requireAuth(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) {
    throw new Error('Unauthorized');
  }
  return user;
}

export async function requireRole(role: 'admin' | 'staff'): Promise<NextResponse | null> {
  const authenticated = await isAuthenticated();
  if (!authenticated) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }
  if (user.role !== role && role === 'admin') {
    return NextResponse.json({ success: false, message: 'Admin access required' }, { status: 403 });
  }
  return null; // null = authorized, proceed
}
