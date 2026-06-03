<?php

namespace App\Http\Controllers;

use App\Models\ActivityLog;
use App\Models\InventoryAccessRequest;
use App\Models\InventoryAccessSession;
use App\Models\User;
use Illuminate\Database\QueryException;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class InventoryAccessController extends Controller
{
    private int $otpExpiresMinutes = 10;
    private int $otpResendCooldownMinutes = 3;

    private function inventoryAccessNotReadyResponse()
    {
        return response()->json([
            'message' => 'Inventory access system is not ready. Run `php artisan migrate` to create required tables.',
        ], 503);
    }

    public function requestAccess(Request $request)
    {
        $request->validate([
            'purpose' => 'nullable|string|in:inventory_management',
        ]);

        $cashier = $request->user();
        if (! $cashier) {
            throw ValidationException::withMessages(['cashier' => ['Unauthorized.']]);
        }

        if ($cashier->inventory_access_locked_until && $cashier->inventory_access_locked_until->isFuture()) {
            throw ValidationException::withMessages(['otp' => ['Too many failed attempts. Please try again later.']]);
        }

        $purpose = (string) ($request->input('purpose') ?: 'inventory_management');

        try {
            $latest = InventoryAccessRequest::query()
                ->where('cashier_id', $cashier->id)
                ->where('purpose', $purpose)
                ->orderByDesc('created_at')
                ->first();
        } catch (QueryException $e) {
            if (str_contains((string) $e->getMessage(), 'inventory_access_requests')) {
                return $this->inventoryAccessNotReadyResponse();
            }
            throw $e;
        }

        if ($latest && $latest->created_at) {
            $availableAt = $latest->created_at->copy()->addMinutes($this->otpResendCooldownMinutes);
            if ($availableAt->isFuture()) {
                $retryAfter = now()->diffInSeconds($availableAt);
                return response()->json([
                    'message' => 'Please wait before requesting a new code.',
                    'retry_after_seconds' => $retryAfter,
                ], 429);
            }
        }

        try {
            $result = DB::transaction(function () use ($request, $cashier, $purpose) {
                InventoryAccessRequest::query()
                    ->where('cashier_id', $cashier->id)
                    ->where('purpose', $purpose)
                    ->whereNull('revoked_at')
                    ->whereNull('used_at')
                    ->where('expires_at', '>=', now())
                    ->update(['revoked_at' => now()]);

                InventoryAccessSession::query()
                    ->where('cashier_id', $cashier->id)
                    ->whereNull('revoked_at')
                    ->where('expires_at', '>=', now())
                    ->update(['revoked_at' => now()]);

                $otp = str_pad((string) random_int(0, 999999), 6, '0', STR_PAD_LEFT);
                $id = (string) Str::uuid();

                $accessRequest = InventoryAccessRequest::create([
                    'id' => $id,
                    'cashier_id' => $cashier->id,
                    'approved_by_admin_id' => null,
                    'purpose' => $purpose,
                    'otp_encrypted' => Crypt::encryptString($otp),
                    'otp_hash' => hash('sha256', $otp),
                    'expires_at' => now()->addMinutes($this->otpExpiresMinutes),
                    'approved_at' => null,
                    'used_at' => null,
                    'revoked_at' => null,
                    'ip_address' => $request->ip(),
                    'user_agent' => $request->userAgent(),
                ]);

                ActivityLog::create([
                    'actor_user_id' => $cashier->id,
                    'event_type' => 'inventory_access_request_created',
                    'description' => 'Requested admin approval for inventory management access.',
                    'metadata' => [
                        'purpose' => $purpose,
                        'request_id' => $accessRequest->id,
                    ],
                    'ip_address' => $request->ip(),
                    'user_agent' => $request->userAgent(),
                ]);

                return [
                    'request' => $accessRequest,
                    'otp' => $otp,
                ];
            });
        } catch (QueryException $e) {
            if (str_contains((string) $e->getMessage(), 'inventory_access_requests')) {
                return $this->inventoryAccessNotReadyResponse();
            }
            throw $e;
        }

        $admins = User::query()->where('role', 'admin')->get();
        foreach ($admins as $admin) {
            try {
                Mail::raw(
                    implode("\n", [
                        'Inventory Management Access Request',
                        '',
                        'Cashier: '.($cashier->name ?: 'Cashier').' ('.$cashier->email.')',
                        'Requested at: '.now()->toDateTimeString(),
                        'Purpose: '.$purpose,
                        'OTP (expires in '.$this->otpExpiresMinutes.' minutes, single-use): '.$result['otp'],
                        '',
                        'Approve in the admin dashboard to activate the OTP.',
                    ]),
                    function ($message) use ($admin) {
                        $message->to($admin->email)->subject('Inventory Access Request');
                    }
                );
            } catch (\Throwable $e) {
            }
        }

        return response()->json([
            'request_id' => $result['request']->id,
            'expires_at' => $result['request']->expires_at,
        ], 201);
    }

    public function listRequests(Request $request)
    {
        $user = $request->user();
        if (! $user || $user->role !== 'admin') {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $status = (string) $request->query('status', 'open');

        $query = InventoryAccessRequest::query()
            ->with(['cashier:id,name,email', 'approvedBy:id,name,email'])
            ->orderByDesc('created_at');

        if ($status === 'open') {
            $query->whereNull('revoked_at')
                ->whereNull('used_at')
                ->where('expires_at', '>=', now());
        }

        try {
            $rows = $query->limit(30)->get();
        } catch (QueryException $e) {
            if (str_contains((string) $e->getMessage(), 'inventory_access_requests')) {
                return $this->inventoryAccessNotReadyResponse();
            }
            throw $e;
        }

        $out = $rows->map(function (InventoryAccessRequest $r) {
            $otp = null;
            try {
                $otp = Crypt::decryptString((string) $r->otp_encrypted);
            } catch (\Throwable $e) {
                $otp = null;
            }

            return [
                'id' => $r->id,
                'purpose' => $r->purpose,
                'expires_at' => $r->expires_at,
                'approved_at' => $r->approved_at,
                'used_at' => $r->used_at,
                'revoked_at' => $r->revoked_at,
                'created_at' => $r->created_at,
                'cashier' => $r->cashier ? [
                    'id' => $r->cashier->id,
                    'name' => $r->cashier->name,
                    'email' => $r->cashier->email,
                ] : null,
                'approved_by' => $r->approvedBy ? [
                    'id' => $r->approvedBy->id,
                    'name' => $r->approvedBy->name,
                    'email' => $r->approvedBy->email,
                ] : null,
                'otp' => $otp,
            ];
        });

        return response()->json($out);
    }

    public function approve(Request $request, string $id)
    {
        $admin = $request->user();
        if (! $admin || $admin->role !== 'admin') {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        try {
            $approved = DB::transaction(function () use ($request, $admin, $id) {
                $accessRequest = InventoryAccessRequest::query()->lockForUpdate()->find($id);
                if (! $accessRequest) {
                    throw ValidationException::withMessages(['request' => ['Request not found.']]);
                }

                if ($accessRequest->revoked_at) {
                    throw ValidationException::withMessages(['request' => ['Request has been revoked.']]);
                }

                if ($accessRequest->used_at) {
                    throw ValidationException::withMessages(['request' => ['Request has already been used.']]);
                }

                if ($accessRequest->expires_at && $accessRequest->expires_at->isPast()) {
                    throw ValidationException::withMessages(['request' => ['Request has expired.']]);
                }

                if (! $accessRequest->approved_at) {
                    $accessRequest->forceFill([
                        'approved_by_admin_id' => $admin->id,
                        'approved_at' => now(),
                    ])->save();

                    ActivityLog::create([
                        'actor_user_id' => $admin->id,
                        'event_type' => 'inventory_access_request_approved',
                        'description' => 'Approved inventory management access request.',
                        'metadata' => [
                            'request_id' => $accessRequest->id,
                            'cashier_id' => $accessRequest->cashier_id,
                            'purpose' => $accessRequest->purpose,
                        ],
                        'ip_address' => $request->ip(),
                        'user_agent' => $request->userAgent(),
                    ]);
                }

                return $accessRequest->fresh(['cashier:id,name,email', 'approvedBy:id,name,email']);
            });
        } catch (QueryException $e) {
            if (str_contains((string) $e->getMessage(), 'inventory_access_requests')) {
                return $this->inventoryAccessNotReadyResponse();
            }
            throw $e;
        }

        $otp = null;
        try {
            $otp = Crypt::decryptString((string) $approved->otp_encrypted);
        } catch (\Throwable $e) {
            $otp = null;
        }

        return response()->json([
            'id' => $approved->id,
            'purpose' => $approved->purpose,
            'expires_at' => $approved->expires_at,
            'approved_at' => $approved->approved_at,
            'created_at' => $approved->created_at,
            'cashier' => $approved->cashier ? [
                'id' => $approved->cashier->id,
                'name' => $approved->cashier->name,
                'email' => $approved->cashier->email,
            ] : null,
            'approved_by' => $approved->approvedBy ? [
                'id' => $approved->approvedBy->id,
                'name' => $approved->approvedBy->name,
                'email' => $approved->approvedBy->email,
            ] : null,
            'otp' => $otp,
        ]);
    }

    public function verify(Request $request)
    {
        $request->validate([
            'request_id' => 'required|string',
            'otp' => 'required|string|min:4|max:12',
        ]);

        $cashier = $request->user();
        if (! $cashier) {
            throw ValidationException::withMessages(['cashier' => ['Unauthorized.']]);
        }

        if ($cashier->inventory_access_locked_until && $cashier->inventory_access_locked_until->isFuture()) {
            throw ValidationException::withMessages(['otp' => ['Too many failed attempts. Please try again later.']]);
        }

        $requestId = (string) $request->input('request_id');
        if (! Str::isUuid($requestId)) {
            throw ValidationException::withMessages(['request_id' => ['Invalid request id.']]);
        }

        $otp = trim((string) $request->input('otp'));

        try {
            $session = DB::transaction(function () use ($request, $cashier, $requestId, $otp) {
                $accessRequest = InventoryAccessRequest::query()->lockForUpdate()->find($requestId);
            if (! $accessRequest) {
                throw ValidationException::withMessages(['otp' => ['Request not found.']]);
            }

            if ((int) $accessRequest->cashier_id !== (int) $cashier->id) {
                throw ValidationException::withMessages(['otp' => ['Request is not for this cashier.']]);
            }

            if ($accessRequest->revoked_at) {
                throw ValidationException::withMessages(['otp' => ['Request has been revoked.']]);
            }

            if ($accessRequest->used_at) {
                throw ValidationException::withMessages(['otp' => ['Code has already been used. Please request a new code.']]);
            }

            if ($accessRequest->expires_at && $accessRequest->expires_at->isPast()) {
                throw ValidationException::withMessages(['otp' => ['Code has expired. Please request a new code.']]);
            }

            if (! $accessRequest->approved_at) {
                throw ValidationException::withMessages(['otp' => ['Awaiting admin approval.']]);
            }

            $expectedHash = (string) $accessRequest->otp_hash;
            $actualHash = hash('sha256', $otp);
            if (! hash_equals($expectedHash, $actualHash)) {
                $attempts = (int) $cashier->inventory_access_failed_attempts + 1;
                $lockUntil = null;
                if ($attempts >= 3) {
                    $lockUntil = now()->addMinutes(5);
                }
                $cashier->forceFill([
                    'inventory_access_failed_attempts' => $attempts >= 3 ? 0 : $attempts,
                    'inventory_access_locked_until' => $lockUntil,
                ])->save();

                ActivityLog::create([
                    'actor_user_id' => $cashier->id,
                    'event_type' => 'inventory_access_otp_failed',
                    'description' => 'Inventory management access OTP verification failed.',
                    'metadata' => [
                        'request_id' => $accessRequest->id,
                        'attempts' => $attempts,
                        'locked_until' => $lockUntil,
                    ],
                    'ip_address' => $request->ip(),
                    'user_agent' => $request->userAgent(),
                ]);

                if ($lockUntil) {
                    throw ValidationException::withMessages(['otp' => ['Too many failed attempts. Please try again later.']]);
                }

                throw ValidationException::withMessages(['otp' => ['Invalid code.']]);
            }

            if ((int) $cashier->inventory_access_failed_attempts !== 0 || $cashier->inventory_access_locked_until) {
                $cashier->forceFill([
                    'inventory_access_failed_attempts' => 0,
                    'inventory_access_locked_until' => null,
                ])->save();
            }

            InventoryAccessSession::query()
                ->where('cashier_id', $cashier->id)
                ->whereNull('revoked_at')
                ->where('expires_at', '>=', now())
                ->update(['revoked_at' => now()]);

            $accessRequest->forceFill(['used_at' => now()])->save();

            $sessionId = (string) Str::uuid();
            $secret = Str::random(40);
            $session = InventoryAccessSession::create([
                'id' => $sessionId,
                'cashier_id' => $cashier->id,
                'request_id' => $accessRequest->id,
                'secret_hash' => hash('sha256', $secret),
                'expires_at' => now()->addMinutes(60),
                'revoked_at' => null,
                'ip_address' => $request->ip(),
                'user_agent' => $request->userAgent(),
            ]);

            ActivityLog::create([
                'actor_user_id' => $cashier->id,
                'event_type' => 'inventory_access_session_granted',
                'description' => 'Inventory management access granted.',
                'metadata' => [
                    'request_id' => $accessRequest->id,
                    'session_id' => $session->id,
                    'approved_by_admin_id' => $accessRequest->approved_by_admin_id,
                ],
                'ip_address' => $request->ip(),
                'user_agent' => $request->userAgent(),
            ]);

            return [
                'token' => $sessionId.'.'.$secret,
                'expires_at' => $session->expires_at,
            ];
            });
        } catch (QueryException $e) {
            if (str_contains((string) $e->getMessage(), 'inventory_access_requests') || str_contains((string) $e->getMessage(), 'inventory_access_sessions')) {
                return $this->inventoryAccessNotReadyResponse();
            }
            throw $e;
        }

        return response()->json($session);
    }

    public function revoke(Request $request)
    {
        $request->validate([
            'token' => 'required|string',
        ]);

        $cashier = $request->user();
        if (! $cashier) {
            throw ValidationException::withMessages(['cashier' => ['Unauthorized.']]);
        }

        $token = (string) $request->input('token');
        $parts = explode('.', $token, 2);
        if (count($parts) !== 2) {
            throw ValidationException::withMessages(['token' => ['Invalid token.']]);
        }
        [$sessionId, $secret] = $parts;
        if (! Str::isUuid($sessionId) || $secret === '') {
            throw ValidationException::withMessages(['token' => ['Invalid token.']]);
        }

        try {
            DB::transaction(function () use ($request, $cashier, $sessionId, $secret) {
                $session = InventoryAccessSession::query()->lockForUpdate()->find($sessionId);
            if (! $session) {
                throw ValidationException::withMessages(['token' => ['Session not found.']]);
            }
            if ((int) $session->cashier_id !== (int) $cashier->id) {
                throw ValidationException::withMessages(['token' => ['Session is not for this cashier.']]);
            }
            if ($session->revoked_at) {
                return;
            }
            $secretHash = hash('sha256', $secret);
            if (! hash_equals((string) $session->secret_hash, $secretHash)) {
                throw ValidationException::withMessages(['token' => ['Invalid token.']]);
            }

            $session->forceFill(['revoked_at' => now()])->save();

            ActivityLog::create([
                'actor_user_id' => $cashier->id,
                'event_type' => 'inventory_access_session_revoked',
                'description' => 'Inventory management access ended.',
                'metadata' => [
                    'session_id' => $session->id,
                    'request_id' => $session->request_id,
                ],
                'ip_address' => $request->ip(),
                'user_agent' => $request->userAgent(),
            ]);
            });
        } catch (QueryException $e) {
            if (str_contains((string) $e->getMessage(), 'inventory_access_sessions')) {
                return $this->inventoryAccessNotReadyResponse();
            }
            throw $e;
        }

        return response()->json(['message' => 'Access ended.']);
    }
}
