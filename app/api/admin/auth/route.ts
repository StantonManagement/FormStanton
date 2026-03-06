import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { checkRateLimit, resetRateLimit } from '@/lib/rate-limit';

export async function POST(request: NextRequest) {
  try {
    const { password } = await request.json();
    
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
    
    const adminPassword = process.env.ADMIN_PASSWORD;
    
    if (!adminPassword) {
      return NextResponse.json(
        { success: false, message: 'Admin password not configured' },
        { status: 500 }
      );
    }
    
    if (password === adminPassword) {
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
