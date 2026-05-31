<?php

namespace App\Http\Middleware;

use App\Models\InventoryAccessSession;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\Response;

class InventoryAccessMiddleware
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();
        if (! $user) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        $token = (string) $request->header('X-Inventory-Access-Token', '');
        if ($token === '') {
            return response()->json(['message' => 'Inventory management access required.'], 403);
        }

        $parts = explode('.', $token, 2);
        if (count($parts) !== 2) {
            return response()->json(['message' => 'Inventory access token is invalid.'], 403);
        }

        [$sessionId, $secret] = $parts;
        if (! Str::isUuid($sessionId) || $secret === '') {
            return response()->json(['message' => 'Inventory access token is invalid.'], 403);
        }

        $session = InventoryAccessSession::query()->find($sessionId);
        if (! $session) {
            return response()->json(['message' => 'Inventory access session not found.'], 403);
        }

        if ((int) $session->cashier_id !== (int) $user->id) {
            return response()->json(['message' => 'Inventory access session is not for this user.'], 403);
        }

        if ($session->revoked_at) {
            return response()->json(['message' => 'Inventory access session has been revoked.'], 403);
        }

        if ($session->expires_at && $session->expires_at->isPast()) {
            return response()->json(['message' => 'Inventory access session has expired.'], 403);
        }

        $secretHash = hash('sha256', $secret);
        if (! hash_equals((string) $session->secret_hash, $secretHash)) {
            return response()->json(['message' => 'Inventory access token is invalid.'], 403);
        }

        $request->attributes->set('inventory_access_session', $session);

        return $next($request);
    }
}
