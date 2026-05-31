<?php

namespace App\Http\Controllers;

use App\Models\Branch;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rule;

class CashierAccountController extends Controller
{
    public function index()
    {
        return response()->json(
            User::query()
                ->where('role', 'staff')
                ->with(['branch:id,name,is_active', 'branches:id,name,is_active'])
                ->latest()
                ->get(),
        );
    }

    public function store(Request $request)
    {
        if (Branch::query()->count() === 0) {
            return response()->json(['message' => 'No branches exist yet. Please add a branch first.'], 422);
        }

        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'required|email|max:255|unique:users,email',
            'password' => 'required|string|min:8',
            'branch_ids' => 'required|array|min:1|max:20',
            'branch_ids.*' => 'integer|distinct|exists:branches,id',
        ]);

        $branchIds = array_map('intval', $validated['branch_ids']);
        $activeCount = Branch::query()->whereIn('id', $branchIds)->where('is_active', true)->count();
        if ($activeCount !== count($branchIds)) {
            return response()->json(['message' => 'One or more selected branches are not active.'], 422);
        }

        $user = User::create([
            'name' => $validated['name'],
            'email' => $validated['email'],
            'password' => Hash::make($validated['password']),
            'role' => 'staff',
            'branch_id' => (int) $branchIds[0],
        ]);

        $user->branches()->sync($branchIds);

        return response()->json($user->load(['branch:id,name,is_active', 'branches:id,name,is_active']), 201);
    }

    public function update(Request $request, User $user)
    {
        if ($user->role !== 'staff') {
            return response()->json(['message' => 'Only cashier accounts can be updated here.'], 422);
        }

        $validated = $request->validate([
            'name' => 'sometimes|required|string|max:255',
            'email' => [
                'sometimes',
                'required',
                'email',
                'max:255',
                Rule::unique('users', 'email')->ignore($user->id),
            ],
            'password' => 'nullable|string|min:8',
            'branch_ids' => 'sometimes|required|array|min:1|max:20',
            'branch_ids.*' => 'integer|distinct|exists:branches,id',
        ]);

        $data = collect($validated)->except('password')->toArray();

        if (array_key_exists('branch_ids', $validated)) {
            if (Branch::query()->count() === 0) {
                return response()->json(['message' => 'No branches exist yet. Please add a branch first.'], 422);
            }

            $branchIds = array_map('intval', $validated['branch_ids']);
            $activeCount = Branch::query()->whereIn('id', $branchIds)->where('is_active', true)->count();
            if ($activeCount !== count($branchIds)) {
                return response()->json(['message' => 'One or more selected branches are not active.'], 422);
            }

            $data['branch_id'] = (int) $branchIds[0];
        }

        if (! empty($validated['password'])) {
            $data['password'] = Hash::make($validated['password']);
        }

        $user->update($data);

        if (array_key_exists('branch_ids', $validated)) {
            $user->branches()->sync(array_map('intval', $validated['branch_ids']));
        }

        return response()->json($user->load(['branch:id,name,is_active', 'branches:id,name,is_active']));
    }

    public function destroy(User $user)
    {
        if ($user->role !== 'staff') {
            return response()->json(['message' => 'Only cashier accounts can be deleted here.'], 422);
        }

        $user->tokens()->delete();
        $user->delete();

        return response()->json(null, 204);
    }
}
