import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { getSession } from '@/lib/auth';
import { checkRateLimit, resetRateLimit } from '@/lib/rate-limit';
import { getAdminAuthSecrets } from '@/lib/server-env';

async function verifyAdminPassword(inputPassword: string): Promise<boolean> {
  const { adminPasswordHash, adminPasswordLegacy } = getAdminAuthSecrets();

  if (adminPasswordHash) {
    // Check if it's a bcrypt hash (starts with $2a$, $2b$, or $2y$)
    if (adminPasswordHash.startsWith('$2')) {
      return bcrypt.compare(inputPassword, adminPasswordHash);
    }
    // Otherwise, treat it as a simple string password
    return inputPassword === adminPasswordHash;
  }

  return inputPassword === adminPasswordLegacy;
}

export async function POST(request: NextRequest) {
  try {
    const { password } = await request.json();

    if (typeof password !== 'string' || password.length === 0) {
      return NextResponse.json(
        { success: false, message: 'Password is required' },
        { status: 400 }
      );
    }
    
    // Get IP address for rate limiting
    const ip = request.headers.get('x-forwarded-for') || 
                request.headers.get('x-real-ip') || 
                'unknown';
    
    // Check rate limit
    const rateLimitResult = checkRateLimit(`auth:${ip}`);
    
    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        { 
          success: false, 
          message: `Too many failed attempts. Account locked until ${rateLimitResult.lockedUntil?.toLocaleTimeString()}`,
          lockedUntil: rateLimitResult.lockedUntil
        },
        { status: 429 }
      );
    }
    
    const isValidPassword = await verifyAdminPassword(password);

    if (isValidPassword) {
      // Reset rate limit on successful login
      resetRateLimit(`auth:${ip}`);
      
      const session = await getSession();
      session.isAdmin = true;
      await session.save();
      
      return NextResponse.json({ success: true });
    }
    
    return NextResponse.json(
      { 
        success: false, 
        message: 'Invalid password',
        remainingAttempts: rateLimitResult.remainingAttempts
      },
      { status: 401 }
    );
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const session = await getSession();
    return NextResponse.json({ isAuthenticated: session.isAdmin === true });
  } catch (error: any) {
    return NextResponse.json({ isAuthenticated: false });
  }
}

export async function DELETE() {
  try {
    const session = await getSession();
    session.destroy();
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message },
      { status: 500 }
    );
  }
}
