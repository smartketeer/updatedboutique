<?php

namespace App\Http\Controllers;

use App\Models\ActivityLog;
use App\Models\OverrideApproval;
use App\Models\Setting;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class OverrideApprovalController extends Controller
{
    public function store(Request $request)
    {
        $request->validate([
            'purpose' => 'required|string|in:sale_overrides',
            'payload' => 'required|array',
            'cashier_pin' => 'required|string',
            'admin_email' => 'required|email',
            'admin_pin' => 'required|string',
        ]);

        $this->validateOverridesPayloadOrFail((array) $request->payload);

        return DB::transaction(function () use ($request) {
            $cashier = $request->user();
            if (! $cashier) {
                throw ValidationException::withMessages(['cashier' => ['Unauthorized.']]);
            }

            $this->verifyPinOrFail($cashier, (string) $request->cashier_pin, 'cashier_pin');

            $adminEmail = strtolower((string) $request->admin_email);
            $admin = User::query()->where('email', $adminEmail)->where('role', 'admin')->lockForUpdate()->first();
            if (! $admin) {
                throw ValidationException::withMessages(['admin_email' => ['Admin account not found.']]);
            }

            $this->verifyPinOrFail($admin, (string) $request->admin_pin, 'admin_pin');

            $approvalId = (string) Str::uuid();
            $secret = Str::random(40);

            $approval = OverrideApproval::create([
                'id' => $approvalId,
                'cashier_id' => $cashier->id,
                'admin_id' => $admin->id,
                'purpose' => (string) $request->purpose,
                'payload_hash' => $this->hashPayload((array) $request->payload),
                'secret_hash' => hash('sha256', $secret),
                'expires_at' => now()->addMinutes(2),
                'used_at' => null,
                'ip_address' => $request->ip(),
                'user_agent' => $request->userAgent(),
            ]);

            ActivityLog::create([
                'actor_user_id' => $cashier->id,
                'event_type' => 'cashier_admin_access_request',
                'description' => $approval->purpose === 'sale_overrides'
                    ? 'Requested admin access for sale overrides.'
                    : 'Requested admin access.',
                'metadata' => [
                    'purpose' => $approval->purpose,
                    'approval_id' => $approval->id,
                    'admin_id' => $admin->id,
                ],
                'ip_address' => $request->ip(),
                'user_agent' => $request->userAgent(),
            ]);

            return response()->json([
                'token' => $approval->id.'.'.$secret,
                'expires_at' => $approval->expires_at,
                'admin' => [
                    'id' => $admin->id,
                    'name' => $admin->name,
                    'email' => $admin->email,
                ],
            ], 201);
        });
    }

    private function validateOverridesPayloadOrFail(array $payload): void
    {
        $priceOverrides = $payload['price_overrides'] ?? [];
        $customItems = $payload['custom_items'] ?? [];

        if (! is_array($priceOverrides) || ! is_array($customItems)) {
            throw ValidationException::withMessages(['payload' => ['Invalid payload structure.']]);
        }

        $priceAdjustmentsEnabled = (bool) Setting::getValue('pos_price_adjustments_enabled', true);
        $customItemsEnabled = (bool) Setting::getValue('pos_custom_items_enabled', true);

        if (! $priceAdjustmentsEnabled && count($priceOverrides) > 0) {
            throw ValidationException::withMessages(['payload' => ['Price adjustments are disabled in settings.']]);
        }

        if (! $customItemsEnabled && count($customItems) > 0) {
            throw ValidationException::withMessages(['payload' => ['Custom items are disabled in settings.']]);
        }

        foreach ($priceOverrides as $p) {
            $reason = trim((string) ($p['reason'] ?? ''));
            if ($reason === '') {
                throw ValidationException::withMessages(['payload' => ['Price override reason is required.']]);
            }
        }

        foreach ($customItems as $c) {
            $reason = trim((string) ($c['reason'] ?? ''));
            if ($reason === '') {
                throw ValidationException::withMessages(['payload' => ['Custom item reason is required.']]);
            }
        }
    }

    private function verifyPinOrFail(User $user, string $pin, string $field): void
    {
        $lockedUntil = $user->pin_locked_until;
        if ($lockedUntil && $lockedUntil->isFuture()) {
            throw ValidationException::withMessages([$field => ['PIN is temporarily locked.']]);
        }

        if (! $user->pin_hash) {
            throw ValidationException::withMessages([$field => ['PIN is not set for this account.']]);
        }

        if (! Hash::check($pin, $user->pin_hash)) {
            $attempts = (int) $user->pin_failed_attempts + 1;
            $lockUntil = null;
            if ($attempts >= 5) {
                $lockUntil = now()->addMinutes(5);
            }
            $user->forceFill([
                'pin_failed_attempts' => $attempts >= 5 ? 0 : $attempts,
                'pin_locked_until' => $lockUntil,
            ])->save();

            throw ValidationException::withMessages([$field => ['Invalid PIN.']]);
        }

        if ((int) $user->pin_failed_attempts !== 0 || $user->pin_locked_until) {
            $user->forceFill([
                'pin_failed_attempts' => 0,
                'pin_locked_until' => null,
            ])->save();
        }
    }

    private function hashPayload(array $payload): string
    {
        $normalized = $this->normalizePayload($payload);
        $encoded = json_encode(
            $normalized,
            JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRESERVE_ZERO_FRACTION
        );

        return hash('sha256', $encoded ?: '');
    }

    private function normalizePayload(mixed $value): mixed
    {
        if (is_array($value)) {
            $isList = array_is_list($value);
            $mapped = array_map(fn ($v) => $this->normalizePayload($v), $value);

            if ($isList) {
                usort($mapped, function ($a, $b) {
                    $aj = json_encode($a, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRESERVE_ZERO_FRACTION);
                    $bj = json_encode($b, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRESERVE_ZERO_FRACTION);

                    return strcmp((string) $aj, (string) $bj);
                });

                return $mapped;
            }

            ksort($mapped);

            return $mapped;
        }

        return $value;
    }
}
