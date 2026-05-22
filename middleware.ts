import { NextRequest, NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { SessionData, sessionOptions, userHasPermission, SessionUser } from '@/lib/auth';
import { ROUTE_PERMISSION_MAP, RESOURCES } from '@/lib/permissions';

function resolveRoutePermission(pathname: string, httpMethod: string) {
  for (const { prefix, permission } of ROUTE_PERMISSION_MAP) {
    if (pathname.startsWith(prefix)) {
      if (httpMethod === 'GET') return { resource: permission.resource, action: permission.read };
      if (httpMethod === 'DELETE') return { resource: permission.resource, action: permission.delete ?? 'delete' };
      return { resource: permission.resource, action: permission.write ?? 'write' };
    }
  }
  return null;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const httpMethod = request.method;

  // ----------------------------------------------------------------
  // Tenant surfaces: headers only, skip iron-session work (PRP-001 / D6).
  // /pbv-full-app and /api/t use tenant_access_token (URL-bound), not the
  // iron-session cookie, so decoding the session here is pure latency.
  // ----------------------------------------------------------------
  if (pathname.startsWith('/pbv-full-app/') || pathname.startsWith('/api/t/')) {
    const tenantResponse = NextResponse.next();
    tenantResponse.headers.set('X-Content-Type-Options', 'nosniff');
    // The application summary PDF and each generated form PDF are embedded in
    // same-origin <iframe>s on the tenant signing pages. X-Frame-Options: DENY
    // blocks ALL framing — even same-origin — so those previews render blank and
    // the tenant is asked to read/sign a document they cannot see. Serve
    // SAMEORIGIN for those PDF-preview endpoints (still blocks cross-origin
    // clickjacking); keep DENY for the rest of the tenant surface.
    const isFramedPdf =
      /\/pbv-full-app\/summary-pdf$/.test(pathname) ||
      /\/pbv-full-app\/forms\/[^/]+\/preview$/.test(pathname);
    tenantResponse.headers.set('X-Frame-Options', isFramedPdf ? 'SAMEORIGIN' : 'DENY');
    tenantResponse.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    return tenantResponse;
  }

  // Load session once for all guarded route trees
  const session = await getIronSession<SessionData>(request.cookies as any, sessionOptions);

  const isHachUser =
    session.user_type === 'hach_admin' || session.user_type === 'hach_reviewer';
  let skipPermissionEnforcement = false;

  if (pathname.startsWith('/api/admin/pbv/full-applications')) {
    console.warn('[middleware] admin PBV full-applications hit:', pathname, httpMethod);
  }
  if (pathname.startsWith('/pbv-full-app/')) {
    console.warn('[middleware] public PBV full-app hit:', pathname, httpMethod);
  }

  // ----------------------------------------------------------------
  // HACH user isolation
  // Block HACH users from /admin/* UI pages and /api/admin/* routes.
  // Exception: /api/admin/auth is the shared login endpoint.
  // ----------------------------------------------------------------
  if (isHachUser) {
    if (pathname.startsWith('/admin')) {
      return NextResponse.redirect(new URL('/hach', request.url));
    }
    if (pathname.startsWith('/api/admin/') && pathname !== '/api/admin/auth') {
      return NextResponse.json(
        { success: false, message: 'Forbidden — HACH users may not access Stanton admin resources' },
        { status: 403 }
      );
    }
  }

  // ----------------------------------------------------------------
  // HACH route guard
  // Block non-HACH (unauthenticated or Stanton staff) from /hach/* and /api/hach/*.
  // Exception: /hach/login is publicly accessible.
  // ----------------------------------------------------------------
  const isHachRoute =
    pathname.startsWith('/hach/') || pathname === '/hach' ||
    pathname.startsWith('/api/hach/');
  const isHachLoginPage = pathname === '/hach/login' || pathname.startsWith('/hach/login');
  const isHachAcceptInvite =
    pathname === '/hach/accept-invite' ||
    pathname.startsWith('/hach/accept-invite') ||
    pathname === '/api/hach/accept-invite' ||
    pathname.startsWith('/api/hach/accept-invite');

  if (isHachRoute && !isHachLoginPage && !isHachAcceptInvite) {
    if (!session.isAdmin) {
      if (pathname.startsWith('/api/')) {
        return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
      }
      return NextResponse.redirect(new URL('/hach/login', request.url));
    }
    if (!isHachUser) {
      if (pathname.startsWith('/api/')) {
        return NextResponse.json(
          { success: false, message: 'Forbidden — Stanton staff may not access HACH resources' },
          { status: 403 }
        );
      }
      return NextResponse.redirect(new URL('/admin', request.url));
    }
  }

  const lobbyDocumentPrefixes = [
    '/api/admin/compliance/attach-document',
    '/api/admin/compliance/delete-document',
  ];
  const isLobbyDocumentRoute = lobbyDocumentPrefixes.some((prefix) =>
    pathname.startsWith(prefix)
  );

  if (isLobbyDocumentRoute) {
    if (!session.isAdmin) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    if (!session.impersonating && session.userId && session.permissions && session.permissions.length > 0) {
      const user: SessionUser = {
        userId: session.userId,
        username: session.username ?? '',
        displayName: session.displayName ?? '',
        departmentId: session.departmentId ?? null,
        departmentCode: session.departmentCode ?? null,
        permissions: session.permissions ?? [],
        isSuperAdmin: session.isSuperAdmin === true,
        user_type: session.user_type ?? 'stanton_staff',
      };

      const hasLobbyAccess =
        userHasPermission(user, RESOURCES.LOBBY, 'write') ||
        userHasPermission(user, RESOURCES.COMPLIANCE, 'write');

      if (!hasLobbyAccess) {
        return NextResponse.json(
          { success: false, message: 'You do not have permission to access this resource' },
          { status: 403 }
        );
      }
    }

    skipPermissionEnforcement = true;
  }

  // ----------------------------------------------------------------
  // Admin API routes — full permission check
  // ----------------------------------------------------------------
  if (!skipPermissionEnforcement && pathname.startsWith('/api/admin/') && pathname !== '/api/admin/auth') {
    if (!session.isAdmin) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    // When impersonating, the cached session permissions belong to the real
    // (super-admin) user — not the target. Skip the middleware check and defer
    // to the route handler's requirePermission(), which goes through
    // getSessionUser() and resolves the impersonated user's live permissions.
    if (session.impersonating) {
      // allow through — route-level guard enforces the correct identity
    } else if (session.userId && session.permissions && session.permissions.length > 0) {
      // Users with a full session (new auth system) get per-permission enforcement.
      // Legacy sessions (no userId, no permissions) get basic cookie-only access
      // so the app keeps working during transition — individual routes add guards.
      const required = resolveRoutePermission(pathname, httpMethod);
      if (required) {
        const user: SessionUser = {
          userId: session.userId,
          username: session.username ?? '',
          displayName: session.displayName ?? '',
          departmentId: session.departmentId ?? null,
          departmentCode: session.departmentCode ?? null,
          permissions: session.permissions ?? [],
          isSuperAdmin: session.isSuperAdmin === true,
          user_type: session.user_type ?? 'stanton_staff',
        };
        if (!userHasPermission(user, required.resource, required.action)) {
          return NextResponse.json(
            { success: false, message: 'You do not have permission to access this resource' },
            { status: 403 }
          );
        }
      }
    }
  }

  // ----------------------------------------------------------------
  // Security headers for all admin + hach routes (tenant routes handled
  // at the top by the early-exit branch).
  // ----------------------------------------------------------------
  const response = NextResponse.next();

  if (pathname.startsWith('/admin') || pathname.startsWith('/hach')) {
    response.headers.set('X-Robots-Tag', 'noindex, nofollow');
    response.headers.set('X-Content-Type-Options', 'nosniff');
    response.headers.set('X-Frame-Options', 'DENY');
    response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  }

  return response;
}

export const config = {
  matcher: [
    '/admin/:path*',
    '/api/admin/:path*',
    '/hach/:path*',
    '/api/hach/:path*',
    '/pbv-full-app/:path*',
    '/api/t/:path*',
  ],
};
