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
  '/kyc',
  '/verification',
  '/kyc-onboarding',
  '/wallet-pin-setup',
  '/storekeeper/onboarding',
  '/courier/onboarding',
  '/flipper/onboarding',
  '/service-provider/onboarding',
  '/shopper',                  // covers most /shopper/* routes
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
  const token = request.cookies.get('auth_token')?.value;
  const userRole = request.cookies.get('user_role')?.value;

  // Admin guard
  if (pathname.startsWith('/_admin') && userRole !== 'admin') {
    return NextResponse.redirect(new URL('/_admin', request.url));
  }

  const isPublic = PUBLIC_PREFIXES.some((p) => pathname.startsWith(p));
  const isAuthRoute = AUTH_ROUTES.some((p) => pathname.startsWith(p));

  // Protected route without token → redirect to login
  if (!token && !isPublic && !isAuthRoute) {
    const intendedRole = inferIntendedRole(pathname);
    const redirect = encodeURIComponent(pathname + request.nextUrl.search);
    return NextResponse.redirect(
      new URL(`/login?intended_role=${intendedRole}&redirect=${redirect}`, request.url)
    );
  }

  // Logged in but on an auth route → redirect to appropriate dashboard
  if (token && isAuthRoute) {
    const intendedRole = searchParams.get('intended_role') || userRole || 'shopper';
    const onboardedRoles = request.cookies.get('onboarded_roles')?.value?.split(',') ?? [];
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
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};