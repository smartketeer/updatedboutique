import React from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { ShieldCheck, RefreshCw, Loader2, Package, Check } from 'lucide-react';

const ToggleSwitch = ({ checked, onChange, title, description, saving }) => (
    <div className="flex items-center justify-between py-5 border-b border-zinc-100 last:border-0 gap-4">
        <div className="space-y-1.5 pr-8">
            <h3 className="font-semibold text-[#818181] text-sm">{title}</h3>
            <p className="text-xs text-[#a6a6a6] font-medium leading-relaxed max-w-xl">{description}</p>
        </div>
        <button
            type="button"
            onClick={() => onChange(!checked)}
            disabled={saving}
            className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-[#818181] focus-visible:ring-offset-2 shadow-inner disabled:opacity-50 disabled:cursor-not-allowed ${
                checked ? 'bg-emerald-500' : 'bg-zinc-200'
            }`}
            aria-pressed={checked}
        >
            <span
                aria-hidden="true"
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                    checked ? 'translate-x-5' : 'translate-x-0'
                }`}
            />
        </button>
    </div>
);

const Settings = () => {
    const [loading, setLoading] = React.useState(true);
    const [saving, setSaving] = React.useState(false);
    const [error, setError] = React.useState('');
    const [saveSuccess, setSaveSuccess] = React.useState(false);
    const [dailySalesEnabled, setDailySalesEnabled] = React.useState(true);
    const [posPriceAdjustmentsEnabled, setPosPriceAdjustmentsEnabled] = React.useState(true);
    const [posCustomItemsEnabled, setPosCustomItemsEnabled] = React.useState(true);

    const fetchSettings = React.useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const res = await axios.get('/api/settings');
            setDailySalesEnabled(Boolean(res.data.daily_sales_enabled));
            setPosPriceAdjustmentsEnabled(Boolean(res.data.pos_price_adjustments_enabled));
            setPosCustomItemsEnabled(Boolean(res.data.pos_custom_items_enabled));
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to load settings');
        } finally {
            setLoading(false);
        }
    }, []);

    React.useEffect(() => {
        fetchSettings();
    }, [fetchSettings]);

    // Auto-save helper: toggles a setting and immediately persists it
    const toggleAndSave = React.useCallback(async (key, newValue, localSetter) => {
        localSetter(newValue);
        setSaving(true);
        setError('');
        setSaveSuccess(false);
        try {
            const res = await axios.patch('/api/settings', {
                [key]: newValue,
            });
            setDailySalesEnabled(Boolean(res.data.daily_sales_enabled));
            setPosPriceAdjustmentsEnabled(Boolean(res.data.pos_price_adjustments_enabled));
            setPosCustomItemsEnabled(Boolean(res.data.pos_custom_items_enabled));
            setSaveSuccess(true);
            setTimeout(() => setSaveSuccess(false), 2000);
        } catch (err) {
            // Revert on failure
            localSetter(!newValue);
            setError(err.response?.data?.message || 'Failed to save setting');
        } finally {
            setSaving(false);
        }
    }, []);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="w-8 h-8 text-[#cbcbcb] animate-spin" />
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto">
            <div className="mb-8">
                <h1 className="text-2xl md:text-3xl font-semibold text-[#818181] tracking-tight">System Settings</h1>
                <p className="text-[#a6a6a6] font-medium text-sm md:text-base mt-2">
                    Control system-wide operations and safety rules for all branches.
                </p>
            </div>

            {error && (
                <div className="mb-6 p-4 bg-[#dddddd] text-[#818181] border border-[#cbcbcb] rounded-xl text-sm font-medium shadow-sm flex items-center gap-3">
                    <div className="w-1.5 h-1.5 rounded-full bg-red-600"></div>
                    {error}
                </div>
            )}

            {saveSuccess && (
                <div className="mb-6 p-4 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-xl text-sm font-medium shadow-sm flex items-center gap-3 animate-in fade-in duration-200">
                    <div className="w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center">
                        <Check size={14} className="text-emerald-600" />
                    </div>
                    Setting saved successfully.
                </div>
            )}

            <div className="bg-white border border-[#cbcbcb] rounded-2xl shadow-sm overflow-hidden">
                <div className="px-5 py-4 sm:px-6 sm:py-5 border-b border-[#cbcbcb] bg-[#dddddd]/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-white border border-[#cbcbcb] flex items-center justify-center shadow-sm text-[#818181]">
                            <ShieldCheck size={20} />
                        </div>
                        <div>
                            <h2 className="text-base font-semibold text-[#818181] tracking-tight">Daily Sales Operation</h2>
                            <p className="text-[10px] font-semibold text-[#a6a6a6] uppercase tracking-widest mt-0.5">Point of Sale Controls</p>
                        </div>
                    </div>
                    
                    <div className="flex items-center gap-2 self-start sm:self-auto">
                        <button
                            onClick={fetchSettings}
                            disabled={saving}
                            className="h-10 px-4 inline-flex items-center gap-2 rounded-xl border border-[#cbcbcb] bg-white text-sm font-semibold text-[#818181] hover:bg-[#dddddd] hover:border-[#a6a6a6] transition-all disabled:opacity-50 shadow-sm focus:outline-none focus:ring-2 focus:ring-[#cbcbcb]"
                        >
                            <RefreshCw size={16} className="text-[#a6a6a6]" />
                            <span className="hidden sm:inline">Refresh</span>
                        </button>
                        {saving && (
                            <div className="h-10 px-4 inline-flex items-center gap-2 rounded-xl bg-[#818181]/10 text-sm font-semibold text-[#818181]">
                                <Loader2 size={16} className="animate-spin" />
                                Saving...
                            </div>
                        )}
                    </div>
                </div>

                <div className="px-6 py-2">
                    <ToggleSwitch 
                        title="Enable Daily Sales"
                        description="When disabled, cashier POS checkout is blocked and new sales cannot be created."
                        checked={dailySalesEnabled}
                        onChange={(val) => toggleAndSave('daily_sales_enabled', val, setDailySalesEnabled)}
                        saving={saving}
                    />
                    <ToggleSwitch 
                        title="Enable POS Price Adjustments"
                        description="When disabled, cashiers cannot adjust unit prices during checkout (even with admin approval)."
                        checked={posPriceAdjustmentsEnabled}
                        onChange={(val) => toggleAndSave('pos_price_adjustments_enabled', val, setPosPriceAdjustmentsEnabled)}
                        saving={saving}
                    />
                    <ToggleSwitch 
                        title="Enable POS Custom Items"
                        description="When disabled, cashiers cannot add custom items to a sale (even with admin approval)."
                        checked={posCustomItemsEnabled}
                        onChange={(val) => toggleAndSave('pos_custom_items_enabled', val, setPosCustomItemsEnabled)}
                        saving={saving}
                    />
                </div>
            </div>

            {/* Master Inventory Link */}
            <Link
                to="/admin/branches"
                className="mt-6 block bg-white border border-[#cbcbcb] rounded-2xl shadow-sm hover:shadow-md transition-shadow overflow-hidden group"
            >
                <div className="px-5 py-4 sm:px-6 sm:py-5 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-white border border-[#cbcbcb] flex items-center justify-center shadow-sm text-[#818181] group-hover:bg-[#dddddd] transition-colors">
                            <Package size={20} />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h2 className="text-base font-semibold text-[#818181] tracking-tight">Master Inventory (BODEGA)</h2>
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-[9px] font-bold bg-[#dddddd] text-[#818181] uppercase tracking-wider">Coming Soon</span>
                            </div>
                            <p className="text-xs text-[#a6a6a6] font-medium mt-0.5">Warehouse management system.</p>
                        </div>
                    </div>
                    <span className="text-[#cbcbcb] group-hover:text-[#818181] transition-colors text-lg">&rarr;</span>
                </div>
            </Link>
        </div>
    );
};

export default Settings;
