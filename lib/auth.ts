import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { getSessionSecret } from '@/lib/server-env';

export interface SessionData {
  isAdmin: boolean;
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
