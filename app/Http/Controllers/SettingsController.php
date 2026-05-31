<?php

namespace App\Http\Controllers;

use App\Models\Setting;
use Illuminate\Http\Request;

class SettingsController extends Controller
{
    public function index()
    {
        return response()->json([
            'daily_sales_enabled' => (bool) Setting::getValue('daily_sales_enabled', true),
            'pos_price_adjustments_enabled' => (bool) Setting::getValue('pos_price_adjustments_enabled', true),
            'pos_custom_items_enabled' => (bool) Setting::getValue('pos_custom_items_enabled', true),
        ]);
    }

    public function update(Request $request)
    {
        $validated = $request->validate([
            'daily_sales_enabled' => 'sometimes|required|boolean',
            'pos_price_adjustments_enabled' => 'sometimes|required|boolean',
            'pos_custom_items_enabled' => 'sometimes|required|boolean',
        ]);

        foreach ($validated as $key => $value) {
            Setting::setValue($key, (bool) $value);
        }

        return $this->index();
    }
}
