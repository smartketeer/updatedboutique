<?php

namespace App\Http\Controllers;

use App\Models\Branch;
use App\Models\User;
use App\Services\BranchResolver;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    public function login(Request $request)
    {
        $request->validate([
            'email'    => ['required', 'email'],
            'password' => 'required',
        ]);

        $email = strtolower((string) $request->email);

        $user = User::where('email', $email)->first();

        if (! $user || ! Hash::check($request->password, $user->password)) {
            \Log::warning('Login attempt failed for user: '.$request->email, [
                'ip'          => $request->ip(),
            ]);
            throw ValidationException::withMessages([
                'email' => ['The provided credentials are incorrect.'],
            ]);
        }

        try {
            $token = $user->createToken('auth_token')->plainTextToken;

            // Also log them into the web session so Bodega can share it
            \Illuminate\Support\Facades\Auth::guard('web')->login($user);
            $request->session()->regenerate();

            \Log::info('User logged in: '.$user->email, [
                'role' => $user->role,
                'ip'   => $request->ip(),
            ]);

            \App\Models\ActivityLog::create([
                'actor_user_id' => $user->id,
                'event_type'    => 'auth_login',
                'description'   => "{$user->name} logged into the POS system.",
                'metadata'      => ['ip' => $request->ip()],
                'ip_address'    => $request->ip(),
                'user_agent'    => $request->userAgent(),
            ]);

            // Load branch relationships
            $user->load(['branch:id,name,is_active', 'branches:id,name,is_active']);

            // Determine if branch selection is required (staff with multiple branches)
            $requiresBranchSelection = false;
            $activeBranches = [];

            if ($user->role === 'staff') {
                $activeBranches = $user->branches
                    ->where('is_active', true)
                    ->values();

                $requiresBranchSelection = $activeBranches->count() > 1;
            }

            $response = [
                'access_token' => $token,
                'token_type'   => 'Bearer',
                'user'         => $user,
            ];

            if ($user->role === 'staff') {
                $response['requires_branch_selection'] = $requiresBranchSelection;
                // Always include the active branches list so the frontend can render the picker
                $response['available_branches'] = $activeBranches->map(fn ($b) => [
                    'id'        => $b->id,
                    'name'      => $b->name,
                    'is_active' => (bool) $b->is_active,
                ])->values();
            }

            return response()->json($response);
        } catch (\Exception $e) {
            \Log::error('Token creation failed for user: '.$user->email, [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);

            return response()->json(['message' => 'Internal server error during authentication'], 500);
        }
    }

    public function logout(Request $request)
    {
        $user = $request->user();
        $token = $user->currentAccessToken();
        $tokenId = ($token instanceof \Laravel\Sanctum\TransientToken) ? session()->getId() : $token->id;

        // Clear any cached active branch before revoking the token
        BranchResolver::clearActiveBranch($tokenId);

        \App\Models\ActivityLog::create([
            'actor_user_id' => $user->id,
            'event_type'    => 'auth_logout',
            'description'   => "{$user->name} logged out of the POS system.",
            'metadata'      => [],
            'ip_address'    => $request->ip(),
            'user_agent'    => $request->userAgent(),
        ]);

        if (! ($token instanceof \Laravel\Sanctum\TransientToken)) {
            $token->delete();
        }

        // Also log them out of the web session
        \Illuminate\Support\Facades\Auth::guard('web')->logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return response()->json(['message' => 'Logged out successfully']);
    }

    public function me(Request $request)
    {
        $user = $request->user()?->load(['branch:id,name,is_active', 'branches:id,name,is_active']);

        if (! $user) {
            return response()->json(null);
        }

        $data = $user->toArray();

        // Resolve active branch for staff users
        if ($user->role === 'staff') {
            $token = $request->user()->currentAccessToken();
            $tokenId = ($token instanceof \Laravel\Sanctum\TransientToken) ? session()->getId() : $token->id;
            $cacheKey = BranchResolver::cacheKey($tokenId);
            $cachedBranchId = Cache::get($cacheKey);

            if ($cachedBranchId !== null) {
                $activeBranch = \App\Models\Branch::select('id', 'name', 'is_active')
                    ->find((int) $cachedBranchId);
            } else {
                $activeBranch = $user->branch;
            }

            $data['active_branch'] = $activeBranch ? [
                'id'        => $activeBranch->id,
                'name'      => $activeBranch->name,
                'is_active' => (bool) $activeBranch->is_active,
            ] : null;
        }

        return response()->json($data);
    }

    public function selectBranch(Request $request)
    {
        $request->validate([
            'branch_id' => ['required', 'integer'],
        ]);

        $user    = $request->user();
        $token = $user->currentAccessToken();
        $tokenId = ($token instanceof \Laravel\Sanctum\TransientToken) ? session()->getId() : $token->id;
        $branchId = (int) $request->branch_id;

        // Confirm the requested branch is in the user's pivot AND is active
        $branch = $user->branches()
            ->where('branches.id', $branchId)
            ->where('branches.is_active', true)
            ->first();

        if (! $branch) {
            throw ValidationException::withMessages([
                'branch_id' => ['The selected branch is not assigned to your account or is not active.'],
            ]);
        }

        // Store the selection in cache scoped to this token
        BranchResolver::setActiveBranch($tokenId, $branchId);

        return response()->json([
            'message' => 'Branch selected.',
            'branch'  => [
                'id'   => $branch->id,
                'name' => $branch->name,
            ],
        ]);
    }
}
