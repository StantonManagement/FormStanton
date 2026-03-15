import { NextRequest, NextResponse } from 'next/server';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Protect admin API routes (except auth endpoint)
  if (pathname.startsWith('/api/admin/') && pathname !== '/api/admin/auth') {
    // Check for the admin session cookie
    const sessionCookie = request.cookies.get('admin_session')?.value;
    
    if (!sessionCookie) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized' },
        { status: 401 }
      );
    }
  }

  // Add security headers for admin routes
  const response = NextResponse.next();
  
  if (pathname.startsWith('/admin')) {
    // Prevent search engine indexing
    response.headers.set('X-Robots-Tag', 'noindex, nofollow');
    
    // Additional security headers
    response.headers.set('X-Content-Type-Options', 'nosniff');
    response.headers.set('X-Frame-Options', 'DENY');
    response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  }

  return response;
}

export const config = {
  matcher: ['/admin/:path*', '/api/admin/:path*']
};
