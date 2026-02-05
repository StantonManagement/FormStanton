import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const { password } = await request.json();
    
    const adminPassword = process.env.ADMIN_PASSWORD;
    
    if (!adminPassword) {
      return NextResponse.json(
        { success: false, message: 'Admin password not configured' },
        { status: 500 }
      );
    }
    
    if (password === adminPassword) {
      const session = await getSession();
      session.isAdmin = true;
      await session.save();
      
      return NextResponse.json({ success: true });
    }
    
    return NextResponse.json(
      { success: false, message: 'Invalid password' },
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
