/**
 * Supabase Middleware
 * 
 * Handles session refresh and route protection.
 * Runs on every request to maintain auth state.
 * 
 * CRITICAL: This middleware ensures session cookies are properly
 * synced between client and server for SSR auth.
 * 
 * @module lib/supabase/middleware
 */

import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// Public routes that don't require authentication
const PUBLIC_ROUTES = [
  '/',
  '/auth/callback',
  '/auth/reset-password',
]

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          // Update request cookies for downstream handling
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          
          // Create new response with updated cookies
          supabaseResponse = NextResponse.next({
            request,
          })
          
          // Set cookies on the response
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // IMPORTANT: Avoid writing any logic between createServerClient and
  // supabase.auth.getUser(). A simple mistake could make it very hard to debug
  // issues with users being randomly logged out.

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const pathname = request.nextUrl.pathname

  // Check if route is public
  const isPublicRoute = PUBLIC_ROUTES.some(route => 
    route === '/' ? pathname === '/' : pathname.startsWith(route)
  )
  
  // Check if it's an API route or static asset - these handle their own auth
  const isApiRoute = pathname.startsWith('/api/')
  const isStaticAsset = pathname.startsWith('/_next/') || 
                        pathname.includes('.') // files with extensions
  
  // For API routes, just pass through with refreshed session
  // API routes handle their own authentication
  if (isApiRoute || isStaticAsset) {
    return supabaseResponse
  }

  // Redirect authenticated users away from auth-only pages if needed
  // (currently we don't have dedicated login/signup pages, everything is on /)

  // For protected routes (not public, not API, not static), require auth
  if (!user && !isPublicRoute) {
    const url = request.nextUrl.clone()
    url.pathname = '/'
    // Store the attempted URL for redirect after login
    url.searchParams.set('redirect', pathname)
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}
