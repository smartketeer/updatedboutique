<?php

namespace App\Services;

use App\Models\User;
use Illuminate\Support\Facades\Cache;
use Illuminate\Validation\ValidationException;

class BranchResolver
{
    /**
     * The cache TTL in seconds (12 hours).
     */
    public const TTL = 43200;

    /**
     * Build the cache key for a given token ID.
     */
    public static function cacheKey(int|string $tokenId): string
    {
        return "active_branch_{$tokenId}";
    }

    /**
     * Resolve the active branch ID for a staff user.
     *
     * Resolution order:
     *  1. Cache entry keyed to the current Sanctum token.
     *  2. The user's branch_id column (fallback / default).
     *  3. Throws ValidationException if neither is set.
     *
     * @throws ValidationException
     */
    public static function getActiveBranchId(User $user, int|string $tokenId): int
    {
        $cacheKey = self::cacheKey($tokenId);
        $cached   = Cache::get($cacheKey);

        if ($cached !== null) {
            return (int) $cached;
        }

        if ($user->branch_id) {
            return (int) $user->branch_id;
        }

        throw ValidationException::withMessages([
            'branch' => ['No branch selected. Please select a branch to continue.'],
        ]);
    }

    /**
     * Store the selected branch in cache for the given token.
     */
    public static function setActiveBranch(int|string $tokenId, int $branchId): void
    {
        Cache::put(self::cacheKey($tokenId), $branchId, self::TTL);
    }

    /**
     * Clear the cached active branch for the given token (call on logout).
     */
    public static function clearActiveBranch(int|string $tokenId): void
    {
        Cache::forget(self::cacheKey($tokenId));
    }
}
