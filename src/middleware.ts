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

  // ✅ FIX: was `/_admin` (typo). Real prefix is `/admin`.
  //    Non-admins now redirect to /shopper/home instead of looping back
  //    to /admin.
  if (pathname.startsWith('/admin') && userRole !== 'admin') {
    return NextResponse.redirect(new URL('/shopper/home', request.url));
  }

  // ✅ Legacy: if someone hits /_admin, send them to /admin (real route).
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

  if (token && isAuthRoute) {
    const intendedRole =
      searchParams.get('intended_role') || userRole || 'shopper';
    const onboardedRoles =
      request.cookies.get('onboarded_roles')?.value?.split(',') ?? [];
    const destination = getPostLoginRedirect(intendedRole, onboardedRoles);
    return NextResponse.redirect(new URL(destination, request.url));
  }

  return NextResponse.next();
}

function getPostLoginRedirect(role: string, onboardedRoles: string[]): string {
  switch (role) {
    case 'shopper':
      return '/shopper/home';
    case 'storekeeper':
      return onboardedRoles.includes('storekeeper')
        ? '/storekeeper/home'
        : '/storekeeper/onboarding/personal-info';
    case 'courier':
      return onboardedRoles.includes('courier')
        ? '/courier/home'
        : '/courier/onboarding';
    case 'flipper':
      return onboardedRoles.includes('flipper')
        ? '/flipper/home'
        : '/flipper/onboarding';
    case 'service-provider':
      return onboardedRoles.includes('service-provider')
        ? '/service-provider/home'
        : '/service-provider/onboarding';
    default:
      return '/shopper/home';
  }
}

export const config = {
  matcher: ['/((?!api|_next|favicon).*)'],
};