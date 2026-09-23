import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const PUBLIC_PREFIXES = [
  '/',
  '/permissions',
  '/onboarding',
  '/login',
  '/signup',
  '/forgot-password',
  '/verify-otp',
  '/reset-password',
  '/kyc',
  '/verification',
  '/kyc-onboarding',
  '/wallet-pin-setup',
  '/storekeeper/onboarding',
  '/courier/onboarding',
  '/flipper/onboarding',
  '/service-provider/onboarding',
  '/shopper',
  '/notifications',
  '/seai-search',
  '/seai/ask',
  '/seai-lens',
  '/item-detail',
  '/store-detail',
  '/service-detail',
  '/provider-services',
  '/saved',
  '/inbox',
  '/profile',
  '/new-wanted-alert',
  '/booking-form',
  '/booking-confirmed',
  '/order-history',
  '/reservation-pick-time',
  '/reservation-confirmed',
  '/delivery-setup',
  '/delivery-confirmation',
  '/shopper/orders/receipt',
  '/settings',
];

const AUTH_ROUTES = ['/login', '/signup', '/forgot-password', '/verify-otp'];

const STATIC_PREFIXES = [
  '/_next/',
  '/icons/',
  '/fonts/',
  '/images/',
  '/assets/',
  '/videos/',
  '/audio/',
  '/media/',
];

const STATIC_FILES = [
  '/favicon.ico',
  '/apple-icon.png',
  '/manifest.webmanifest',
  '/manifest.json',
  '/robots.txt',
  '/sitemap.xml',
];

const STATIC_EXTENSIONS = [
  '.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.avif', '.bmp', '.tiff',
  '.ico',
  '.woff', '.woff2', '.ttf', '.otf', '.eot',
  '.css', '.js', '.mjs', '.cjs', '.map',
  '.json', '.webmanifest', '.xml', '.txt', '.csv',
  '.mp4', '.webm', '.mov', '.avi', '.mkv', '.m4v', '.ogv', '.mpg', '.mpeg',
  '.mp3', '.wav', '.ogg', '.m4a', '.aac', '.flac', '.opus',
  '.pdf', '.zip', '.gz',
];

function isStaticAsset(pathname: string): boolean {
  if (STATIC_PREFIXES.some((p) => pathname.startsWith(p))) return true;
  if (STATIC_FILES.includes(pathname)) return true;
  const lower = pathname.toLowerCase();
  return STATIC_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

function inferIntendedRole(location: string): string {
  if (location.startsWith('/storekeeper')) return 'storekeeper';
  if (location.startsWith('/courier')) return 'courier';
  if (location.startsWith('/flipper')) return 'flipper';
  if (location.startsWith('/service-provider')) return 'service-provider';
  if (location.startsWith('/admin')) return 'admin';
  if (
    location.startsWith('/shopper') ||
    location.startsWith('/wallet') ||
    location.startsWith('/basket') ||
    location.startsWith('/chat')
  ) {
    return 'shopper';
  }
  return 'shopper';
}

export function middleware(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;

  if (isStaticAsset(pathname)) {
    return NextResponse.next();
  }

  const token = request.cookies.get('auth_token')?.value;
  const userRole = request.cookies.get('user_role')?.value;

  // ✅ `/admin` guard (was `/_admin`, typo). Non-admins go home.
  if (pathname.startsWith('/admin') && userRole !== 'admin') {
    return NextResponse.redirect(new URL('/shopper/home', request.url));
  }

  // ✅ Legacy: `/ _admin` → `/admin`
  if (pathname.startsWith('/_admin')) {
    return NextResponse.redirect(new URL('/admin', request.url));
  }

  const isPublic = PUBLIC_PREFIXES.some((p) =>
    p === '/' ? pathname === '/' : pathname.startsWith(p)
  );
  const isAuthRoute = AUTH_ROUTES.some((p) => pathname.startsWith(p));

  if (!token && !isPublic && !isAuthRoute) {
    const intendedRole = inferIntendedRole(pathname);
    const redirect = encodeURIComponent(pathname + request.nextUrl.search);
    return NextResponse.redirect(
      new URL(
        `/login?intended_role=${intendedRole}&redirect=${redirect}`,
        request.url
      )
    );
  }

  // ✅ Authed user hitting an auth route → send them to their role's home.
  //    Middleware no longer tries to infer onboarding state from a cookie
  //    that is never set (`onboarded_roles`). That check was causing
  //    onboarded users to be bounced back into the onboarding flow every
  //    time they touched /login, /signup, etc.
  //
  //    Onboarding state is now a page-level concern — the role's home page
  //    decides whether to show onboarding UI or a normal dashboard.
  if (token && isAuthRoute) {
    const intendedRole =
      searchParams.get('intended_role') || userRole || 'shopper';
    const destination = homeForRole(intendedRole);
    return NextResponse.redirect(new URL(destination, request.url));
  }

  return NextResponse.next();
}

function homeForRole(role: string): string {
  switch (role) {
    case 'storekeeper':
      return '/storekeeper/home';
    case 'courier':
      return '/courier/home';
    case 'flipper':
      return '/flipper/home';
    case 'service-provider':
      return '/service-provider/home';
    case 'admin':
      return '/admin';
    case 'shopper':
    default:
      return '/shopper/home';
  }
}

export const config = {
  matcher: ['/((?!api|_next|favicon).*)'],
};