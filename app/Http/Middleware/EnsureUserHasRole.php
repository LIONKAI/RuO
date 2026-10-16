<?php

namespace App\Http\Middleware;

use App\Enums\UserRole;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureUserHasRole
{
    /**
     * Only let users with the given role through; others go to their own home screen.
     *
     * @param  Closure(Request): (Response)  $next
     */
    public function handle(Request $request, Closure $next, string $role): Response
    {
        $user = $request->user();

        if ($user === null || $user->role !== UserRole::from($role)) {
            if ($request->expectsJson()) {
                abort(403, 'No tienes acceso a esta sección.');
            }

            return redirect()->route($user?->homeRouteName() ?? 'login')
                ->with('error', 'No tienes acceso a esa sección.');
        }

        return $next($request);
    }
}
