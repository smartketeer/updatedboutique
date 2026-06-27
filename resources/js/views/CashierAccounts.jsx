import React from 'react';
import axios from 'axios';
import { Trash2, Edit2, UserRound, Clock, X, Info } from 'lucide-react';
import ConfirmDeleteModal from '../components/ConfirmDeleteModal';

const ActivityDetailsModal = ({ open, onClose, activity }) => {
    React.useEffect(() => {
        if (!open) return;
        const handler = (e) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [open, onClose]);

    if (!open || !activity) return null;

    const renderMetadata = (metadata) => {
        if (!metadata || typeof metadata !== 'object' || Object.keys(metadata).length === 0) {
            return <div className="text-sm text-[#a6a6a6]">No additional details available.</div>;
        }

        const adjustmentReason = metadata.adjustment_reason;
        const hasAdjustmentReason = adjustmentReason !== undefined && adjustmentReason !== null && String(adjustmentReason).trim() !== '';

        // Extra top-level fields to display (excluding before/after/adjustment_reason)
        const extraKeys = Object.keys(metadata).filter(k => k !== 'before' && k !== 'after' && k !== 'adjustment_reason');

        if (metadata.before && metadata.after) {
            const keys = Array.from(new Set([...Object.keys(metadata.before), ...Object.keys(metadata.after)]));
            const changedKeys = keys.filter(k => JSON.stringify(metadata.before[k]) !== JSON.stringify(metadata.after[k]));
            return (
                <div className="space-y-4">
                    {/* Adjustment Reason — always shown prominently when present */}
                    {hasAdjustmentReason && (
                        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
                            <div className="text-[11px] font-semibold text-amber-700 uppercase tracking-wider mb-1">Adjustment Reason</div>
                            <div className="text-sm font-medium text-amber-900">{String(adjustmentReason)}</div>
                        </div>
                    )}

                    {/* Extra context fields (branch_id, item_id, item_name, etc.) */}
                    {extraKeys.length > 0 && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 bg-[#f8f9fa] p-3 rounded-xl border border-[#cbcbcb]">
                            {extraKeys.map(k => {
                                const v = metadata[k];
                                return (
                                <div key={k} className={`space-y-0.5 ${Array.isArray(v) ? 'sm:col-span-2' : ''}`}>
                                    <div className="text-[10px] font-semibold text-[#a6a6a6] uppercase tracking-wider">{k.replace(/_/g, ' ')}</div>
                                    <div className="text-xs font-semibold text-[#3f3f46] break-all">
                                        {Array.isArray(v) && v.length > 0 && typeof v[0] === 'object' ? (
                                            <div className="mt-2 border border-[#cbcbcb] rounded-xl overflow-hidden bg-white">
                                                <table className="w-full text-xs text-left">
                                                    <thead className="bg-[#f1f1f1] text-[#a6a6a6] border-b border-[#cbcbcb]">
                                                        <tr>
                                                            {Object.keys(v[0]).map(col => (
                                                                <th key={col} className="px-3 py-2 font-semibold uppercase">{col.replace(/_/g, ' ')}</th>
                                                            ))}
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-[#cbcbcb]">
                                                        {v.map((row, i) => (
                                                            <tr key={i} className="hover:bg-[#f9f9f9]">
                                                                {Object.values(row).map((val, j) => (
                                                                    <td key={j} className="px-3 py-2 text-[#818181] font-medium">{String(val)}</td>
                                                                ))}
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        ) : typeof v === 'object' && v !== null ? (
                                            <pre className="text-xs bg-white p-2 rounded-lg border border-[#cbcbcb] overflow-x-auto">
                                                {JSON.stringify(v, null, 2)}
                                            </pre>
                                        ) : (
                                            String(v)
                                        )}
                                    </div>
                                </div>
                            )})}
                        </div>
                    )}

                    {changedKeys.length === 0 ? (
                        <div className="text-sm text-[#a6a6a6]">No field changes detected.</div>
                    ) : (
                        <div>
                            <div className="text-sm font-semibold text-[#818181] mb-2">Changes applied:</div>
                            <div className="border border-[#19140015] rounded-xl overflow-hidden">
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-[#dddddd] text-[#a6a6a6] border-b border-[#19140015]">
                                        <tr>
                                            <th className="px-4 py-2 font-semibold">Field</th>
                                            <th className="px-4 py-2 font-semibold">Before</th>
                                            <th className="px-4 py-2 font-semibold">After</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-[#19140010]">
                                        {changedKeys.map(k => {
                                            const b = metadata.before[k];
                                            const a = metadata.after[k];
                                            return (
                                                <tr key={k} className="bg-amber-50/50 hover:bg-amber-100/50">
                                                    <td className="px-4 py-2 font-medium text-[#818181] capitalize">{k.replace(/_/g, ' ')}</td>
                                                    <td className="px-4 py-2 text-[#a6a6a6]">{b !== undefined && b !== null ? String(b) : '-'}</td>
                                                    <td className="px-4 py-2 text-[#818181] font-medium">{a !== undefined && a !== null ? String(a) : '-'}</td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>
            );
        }

        return (
            <div className="space-y-4">
                {/* Adjustment Reason — always shown prominently when present */}
                {hasAdjustmentReason && (
                    <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
                        <div className="text-[11px] font-semibold text-amber-700 uppercase tracking-wider mb-1">Adjustment Reason</div>
                        <div className="text-sm font-medium text-amber-900">{String(adjustmentReason)}</div>
                    </div>
                )}
                <div className="text-sm font-semibold text-[#818181]">Details:</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3 bg-[#f8f9fa] p-4 rounded-xl border border-[#cbcbcb]">
                    {Object.entries(metadata)
                        .filter(([k]) => k !== 'adjustment_reason')
                        .map(([k, v]) => (
                        <div key={k} className={`space-y-1 ${Array.isArray(v) ? 'sm:col-span-2' : ''}`}>
                            <div className="text-[11px] font-semibold text-[#a6a6a6] uppercase tracking-wider">{k.replace(/_/g, ' ')}</div>
                            <div className="text-sm font-semibold text-[#3f3f46] break-all">
                                {Array.isArray(v) && v.length > 0 && typeof v[0] === 'object' ? (
                                    <div className="mt-2 border border-[#cbcbcb] rounded-xl overflow-hidden bg-white">
                                        <table className="w-full text-xs text-left">
                                            <thead className="bg-[#f1f1f1] text-[#a6a6a6] border-b border-[#cbcbcb]">
                                                <tr>
                                                    {Object.keys(v[0]).map(col => (
                                                        <th key={col} className="px-3 py-2 font-semibold uppercase">{col.replace(/_/g, ' ')}</th>
                                                    ))}
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-[#cbcbcb]">
                                                {v.map((row, i) => (
                                                    <tr key={i} className="hover:bg-[#f9f9f9]">
                                                        {Object.values(row).map((val, j) => (
                                                            <td key={j} className="px-3 py-2 text-[#818181] font-medium">{String(val)}</td>
                                                        ))}
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                ) : typeof v === 'object' && v !== null ? (
                                    <pre className="text-xs bg-white p-2 rounded-lg border border-[#cbcbcb] overflow-x-auto">
                                        {JSON.stringify(v, null, 2)}
                                    </pre>
                                ) : (
                                    String(v)
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    };

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-[fadeIn_150ms_ease-out]" onClick={onClose} />
            <div className="relative w-full max-w-2xl bg-white rounded-2xl border border-[#cbcbcb] shadow-2xl animate-[scaleIn_200ms_ease-out] flex flex-col max-h-[85vh]">
                <div className="flex items-center justify-between px-6 py-4 border-b border-[#19140015]">
                    <div>
                        <h2 className="text-base font-semibold text-[#3f3f46]">Activity Details</h2>
                        <p className="text-xs font-semibold text-[#a6a6a6] mt-0.5">{activity.description || activity.event_type}</p>
                    </div>
                    <button type="button" onClick={onClose} className="p-2 -mr-2 text-[#a6a6a6] hover:bg-[#dddddd] hover:text-[#818181] rounded-xl transition-colors">
                        <X size={18} />
                    </button>
                </div>
                <div className="p-6 overflow-y-auto">
                    {renderMetadata(activity.metadata)}
                </div>
            </div>
        </div>
    );
};

const EM_DASH = '\u2014';

const CashierAccounts = () => {
    const [cashiers, setCashiers] = React.useState([]);
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState('');
    const [activities, setActivities] = React.useState([]);
    const [activityLoading, setActivityLoading] = React.useState(true);
    const [activityError, setActivityError] = React.useState('');
    const [activityCashierId, setActivityCashierId] = React.useState('all');
    const [activityScope, setActivityScope] = React.useState('cashier');
    const [branches, setBranches] = React.useState([]);
    const [branchesLoading, setBranchesLoading] = React.useState(true);
    const [branchesError, setBranchesError] = React.useState('');
    const [branchesFetchedAt, setBranchesFetchedAt] = React.useState(0);

    const [detailsModalOpen, setDetailsModalOpen] = React.useState(false);
    const [selectedActivity, setSelectedActivity] = React.useState(null);

    const openActivityDetails = (activity) => {
        if (!activity?.metadata || Object.keys(activity.metadata).length === 0) return;
        setSelectedActivity(activity);
        setDetailsModalOpen(true);
    };

    const [form, setForm] = React.useState({
        id: null,
        name: '',
        email: '',
        password: '',
        branch_ids: [],
    });

    const resetForm = React.useCallback(() => {
        setForm({ id: null, name: '', email: '', password: '', branch_ids: [] });
    }, []);

    const fetchBranches = React.useCallback(async () => {
        setBranchesLoading(true);
        setBranchesError('');
        try {
            const res = await axios.get('/api/branches');
            setBranches(res.data || []);
            setBranchesFetchedAt(Date.now());
        } catch (err) {
            setBranchesError(err.response?.data?.message || 'Failed to load branches');
            setBranches([]);
        } finally {
            setBranchesLoading(false);
        }
    }, []);

    const fetchCashiers = React.useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const res = await axios.get('/api/cashiers');
            setCashiers(res.data);
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to load cashiers');
        } finally {
            setLoading(false);
        }
    }, []);

    React.useEffect(() => {
        fetchCashiers();
    }, [fetchCashiers]);

    React.useEffect(() => {
        fetchBranches();
    }, [fetchBranches]);

    const fetchActivities = React.useCallback(async () => {
        setActivityLoading(true);
        setActivityError('');
        try {
            const params = new URLSearchParams();
            params.set('scope', activityScope);
            params.set('limit', '20');
            // Exclude sales related events to focus mainly on inventory, login, etc
            params.set('exclude_events', 'sale_completed,sale_void_requested,sale_void_approved');
            if (activityCashierId !== 'all') {
                params.set('actor_user_id', String(activityCashierId));
            }

            const res = await axios.get(`/api/activity-logs?${params.toString()}`);
            setActivities(res.data || []);
        } catch (err) {
            setActivityError(err.response?.data?.message || 'Failed to load activity logs');
            setActivities([]);
        } finally {
            setActivityLoading(false);
        }
    }, [activityCashierId, activityScope]);

    React.useEffect(() => {
        fetchActivities();
    }, [fetchActivities]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        const atCount = (form.email.match(/@/g) || []).length;
        if (atCount > 1) {
            setError('Only one @ symbol is allowed in the email.');
            return;
        }

        if (!/^[a-z0-9\.@]+$/i.test(form.email)) {
            setError('Special characters are not allowed in the email (except . and @).');
            return;
        }

        try {
            const branchIds = (form.branch_ids || []).map((id) => Number(id)).filter((n) => Number.isFinite(n));
            if (!branchIds.length) {
                setError('Please select at least one branch.');
                return;
            }

            const payload = {
                name: form.name,
                email: form.email,
                branch_ids: branchIds,
            };

            if (form.id) {
                // Update existing cashier
                if (form.password) payload.password = form.password;
                await axios.put(`/api/cashiers/${form.id}`, payload);
            } else {
                // Create new cashier
                if (!form.password) {
                    setError('Password is required when creating a new cashier.');
                    return;
                }
                payload.password = form.password;
                await axios.post('/api/cashiers', payload);
            }

            resetForm();
            fetchCashiers();
        } catch (err) {
            setError(err.response?.data?.message || 'Save failed');
        }
    };

    const startEdit = (cashier) => {
        const selected = Array.isArray(cashier?.branches) && cashier.branches.length
            ? cashier.branches.map((b) => Number(b.id)).filter((n) => Number.isFinite(n))
            : cashier.branch_id != null
                ? [Number(cashier.branch_id)]
                : [];
        setForm({
            id: cashier.id,
            name: cashier.name || '',
            email: cashier.email || '',
            password: '',
            branch_ids: selected,
        });
    };

    const [deleteModalOpen, setDeleteModalOpen] = React.useState(false);
    const [deleteTargetCashier, setDeleteTargetCashier] = React.useState(null);
    const [deleteConfirming, setDeleteConfirming] = React.useState(false);

    const handleDelete = (cashier) => {
        setDeleteTargetCashier(cashier);
        setDeleteModalOpen(true);
    };

    const executeDelete = async () => {
        if (!deleteTargetCashier) return;
        setDeleteConfirming(true);
        setError('');
        try {
            await axios.delete(`/api/cashiers/${deleteTargetCashier.id}`);
            setDeleteModalOpen(false);
            setDeleteTargetCashier(null);
            fetchCashiers();
        } catch (err) {
            setDeleteModalOpen(false);
            setDeleteTargetCashier(null);
            setError(err.response?.data?.message || 'Delete failed');
        } finally {
            setDeleteConfirming(false);
        }
    };

    return (
        <div className="space-y-6 max-w-6xl mx-auto">
            <header className="flex items-end justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-semibold text-[#818181]">Cashiers</h1>
                    <p className="text-[#a6a6a6] mt-1">Manage cashier accounts and review their recent activity.</p>
                </div>
            </header>

            {error ? (
                <div className="p-3 bg-[#dddddd] text-[#818181] border border-red-100 rounded-lg text-sm">{error}</div>
            ) : null}

            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                <div className="lg:col-span-2 bg-gradient-to-b from-white to-[#fff7f9] border border-[#19140015] rounded-3xl shadow-sm p-6">
                    <div className="flex items-center gap-2 mb-4">
                        <UserRound size={18} className="text-[#d94a79]" />
                        <h2 className="text-sm font-semibold text-[#818181]">{form.id ? 'Edit Cashier' : 'Add Cashier'}</h2>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="block text-xs font-semibold text-[#a6a6a6] mb-1">Name</label>
                            <input
                                value={form.name}
                                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value.replace(/\b[a-z]/g, char => char.toUpperCase()) }))}
                                className="w-full px-3 py-2 border border-[#19140035] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#d94a79]/25 bg-white"
                                required
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-semibold text-[#a6a6a6] mb-1">Email</label>
                            <input
                                type="email"
                                value={form.email}
                                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                                className="w-full px-3 py-2 border border-[#19140035] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#d94a79]/25 bg-white"
                                required
                            />
                            <p className="text-[10px] text-[#a6a6a6] mt-1 ml-1">
                                Note: Special characters are not allowed, only letters, numbers, dot (.), and max one @ symbol.
                            </p>
                        </div>

                        <div>
                            <div className="flex items-center justify-between gap-2 mb-1">
                                <label className="block text-xs font-semibold text-[#a6a6a6]">Branches</label>
                                <button
                                    type="button"
                                    onClick={fetchBranches}
                                    className="text-[11px] font-semibold text-[#4a2437] underline underline-offset-2"
                                >
                                    Refresh
                                </button>
                            </div>

                            {branchesLoading ? (
                                <div className="px-3 py-2 border border-[#19140035] rounded-xl bg-white text-xs text-[#a6a6a6] animate-pulse">
                                    Loading branches...
                                </div>
                            ) : branchesError ? (
                                <div className="px-3 py-2 border border-[#cbcbcb] rounded-xl bg-[#dddddd] text-xs text-[#818181]">
                                    {branchesError}
                                </div>
                            ) : branches.length === 0 ? (
                                <div className="px-3 py-2 border border-[#cbcbcb] rounded-xl bg-[#dddddd] text-xs text-red-600">
                                    No branches exist yet. Please add a branch first.
                                </div>
                            ) : (
                                <div className="border border-[#19140015] rounded-xl bg-white/70 p-3 space-y-2">
                                    {branches.map((b) => {
                                        const checked = (form.branch_ids || []).map(Number).includes(Number(b.id));
                                        return (
                                            <label key={b.id} className="flex items-center justify-between gap-3 text-xs">
                                                <span className={`font-semibold ${b.is_active ? 'text-[#818181]' : 'text-[#a6a6a6]'}`}>
                                                    {b.name}
                                                    {!b.is_active ? ' (Inactive)' : ''}
                                                </span>
                                                <input
                                                    type="checkbox"
                                                    checked={checked}
                                                    disabled={!b.is_active}
                                                    onChange={(e) => {
                                                        const id = Number(b.id);
                                                        setForm((f) => {
                                                            const prev = Array.isArray(f.branch_ids) ? f.branch_ids.map(Number) : [];
                                                            const next = e.target.checked
                                                                ? Array.from(new Set([...prev, id]))
                                                                : prev.filter((x) => x !== id);
                                                            return { ...f, branch_ids: next };
                                                        });
                                                    }}
                                                    className="h-4 w-4"
                                                />
                                            </label>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        <div>
                            <label className="block text-xs font-semibold text-[#a6a6a6] mb-1">
                                Password {form.id ? '(leave blank to keep current)' : ''}
                            </label>
                            <input
                                type="password"
                                value={form.password}
                                onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                                className="w-full px-3 py-2 border border-[#19140035] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#d94a79]/25 bg-white"
                                required={!form.id}
                            />
                        </div>

                        <div className="flex gap-2">
                            <button
                                type="submit"
                                disabled={branchesLoading || Boolean(branchesError) || branches.length === 0 || (form.branch_ids || []).length === 0}
                                className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 bg-gradient-to-r from-[#4a2437] to-[#d94a79] text-white rounded-xl font-semibold hover:opacity-95 transition-opacity shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {form.id ? 'Save Changes' : 'Add Cashier'}
                            </button>
                            {form.id ? (
                                <button
                                    type="button"
                                    onClick={resetForm}
                                    className="px-4 py-2 border border-[#19140035] rounded-xl font-semibold hover:bg-[#fff7f9]"
                                >
                                    Cancel
                                </button>
                            ) : null}
                        </div>
                    </form>
                </div>

                <div className="lg:col-span-3 bg-white border border-[#19140015] rounded-3xl shadow-sm overflow-hidden">
                    <div className="px-6 py-4 border-b border-[#19140015] bg-white/70 backdrop-blur flex items-center justify-between">
                        <h2 className="text-sm font-semibold text-[#818181]">Cashier List</h2>
                        <div className="flex gap-2">
                            <button
                                onClick={resetForm}
                                className="px-3 py-1.5 text-xs font-semibold text-white bg-gradient-to-r from-[#4a2437] to-[#d94a79] rounded-xl hover:opacity-95 shadow-sm transition-opacity"
                            >
                                Add Cashier
                            </button>
                            <button
                                onClick={fetchCashiers}
                                className="px-3 py-1.5 text-xs font-semibold border border-[#19140035] rounded-xl hover:bg-[#fff7f9]"
                            >
                                Refresh
                            </button>
                        </div>
                    </div>

                    {loading ? (
                        <div className="p-6 text-[#a6a6a6] animate-pulse">Loading cashiers...</div>
                    ) : cashiers.length === 0 ? (
                        <div className="p-6 text-[#a6a6a6]">No cashier accounts yet.</div>
                    ) : (
                        <div className="overflow-auto">
                            <table className="w-full text-sm">
                                <thead className="bg-[#dddddd] text-[#a6a6a6] border-b border-[#19140015]">
                                    <tr>
                                        <th className="text-left px-6 py-3 font-semibold">Name</th>
                                        <th className="text-left px-6 py-3 font-semibold">Email</th>
                                        <th className="text-right px-6 py-3 font-semibold">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {cashiers.map((c) => (
                                        <tr key={c.id} className="border-b border-[#19140010] hover:bg-[#fff7f9]/70">
                                            <td className="px-6 py-3 text-[#818181] font-medium">{c.name}</td>
                                            <td className="px-6 py-3 text-[#a6a6a6]">{c.email}</td>
                                            <td className="px-6 py-3">
                                                <div className="flex justify-end gap-2">
                                                    <button
                                                        onClick={() => startEdit(c)}
                                                        className="inline-flex items-center gap-1 px-3 py-1.5 border border-[#19140035] rounded-xl hover:bg-[#fff7f9] text-xs font-semibold"
                                                    >
                                                        <Edit2 size={14} />
                                                        Edit
                                                    </button>
                                                    <button
                                                        onClick={() => handleDelete(c)}
                                                        className="inline-flex items-center gap-1 px-3 py-1.5 border border-[#cbcbcb] text-[#818181] rounded-xl hover:bg-[#dddddd] text-xs font-semibold"
                                                    >
                                                        <Trash2 size={14} />
                                                        Delete
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>

            <div id="activity" className="bg-white border border-[#19140015] rounded-3xl shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-[#19140015] bg-white/70 backdrop-blur flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div className="flex items-center gap-2">
                        <Clock size={18} className="text-[#d94a79]" />
                        <h2 className="text-sm font-semibold text-[#818181]">Cashier Activity Log</h2>
                    </div>
                    <div className="flex items-center gap-2">
                        <select
                            value={activityScope}
                            onChange={(e) => setActivityScope(e.target.value)}
                            className="h-9 px-3 text-xs font-semibold border border-[#19140035] rounded-xl bg-white hover:bg-[#fff7f9] focus:outline-none focus:ring-2 focus:ring-[#d94a79]/25"
                        >
                            <option value="cashier">Cashier only</option>
                            <option value="all">All (incl. admin approvals)</option>
                        </select>
                        <select
                            value={activityCashierId}
                            onChange={(e) => setActivityCashierId(e.target.value)}
                            className="h-9 px-3 text-xs font-semibold border border-[#19140035] rounded-xl bg-white hover:bg-[#fff7f9] focus:outline-none focus:ring-2 focus:ring-[#d94a79]/25"
                        >
                            <option value="all">All cashiers</option>
                            {cashiers.map((c) => (
                                <option key={c.id} value={String(c.id)}>
                                    {c.name}
                                </option>
                            ))}
                        </select>
                        <button
                            type="button"
                            onClick={fetchActivities}
                            className="h-9 px-3 text-xs font-semibold border border-[#19140035] rounded-xl hover:bg-[#fff7f9]"
                        >
                            Refresh
                        </button>
                    </div>
                </div>

                {activityError ? (
                    <div className="p-4 bg-[#dddddd] text-[#818181] border-b border-red-100 text-sm">{activityError}</div>
                ) : null}

                {activityLoading ? (
                    <div className="p-6 text-[#a6a6a6] animate-pulse">Loading activity...</div>
                ) : activities.length === 0 ? (
                    <div className="p-6 text-[#a6a6a6]">
                        No activity records yet. Cashier activity will appear here once they request admin access or perform tracked actions.
                    </div>
                ) : (
                    <div className="overflow-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-[#dddddd] text-[#a6a6a6] border-b border-[#19140015]">
                                <tr>
                                    <th className="text-left px-6 py-3 font-semibold">Time</th>
                                    <th className="text-left px-6 py-3 font-semibold">Cashier</th>
                                    <th className="text-left px-6 py-3 font-semibold">Activity</th>
                                    <th className="text-left px-6 py-3 font-semibold">IP</th>
                                </tr>
                            </thead>
                            <tbody>
                                {activities.map((a) => {
                                    const hasDetails = a.metadata && Object.keys(a.metadata).length > 0;
                                    return (
                                        <tr 
                                            key={a.id} 
                                            className={`border-b border-[#19140010] hover:bg-[#fff7f9]/70 transition-colors ${hasDetails ? 'cursor-pointer' : ''}`}
                                            onClick={() => hasDetails && openActivityDetails(a)}
                                        >
                                            <td className="px-6 py-3 text-[#a6a6a6] whitespace-nowrap">
                                                {a.created_at ? new Date(a.created_at).toLocaleString() : '-'}
                                            </td>
                                            <td className="px-6 py-3 text-[#818181] font-medium">
                                                {a.actor?.name || a.actor_name || EM_DASH}
                                            </td>
                                            <td className="px-6 py-3 text-[#a6a6a6]">
                                                <div className="flex flex-col gap-1">
                                                    <span className={hasDetails ? 'font-semibold text-[#818181]' : ''}>
                                                        {a.description || a.event_type || EM_DASH}
                                                    </span>
                                                    {hasDetails && (
                                                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#d94a79] uppercase tracking-wider group-hover:underline">
                                                            <Info size={12} />
                                                            Click to view changes
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-6 py-3 text-[#a6a6a6]">{a.ip_address || EM_DASH}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            <ConfirmDeleteModal
                open={deleteModalOpen}
                onClose={() => { setDeleteModalOpen(false); setDeleteTargetCashier(null); }}
                onConfirm={executeDelete}
                confirming={deleteConfirming}
                title="Delete Cashier Account"
                itemName={deleteTargetCashier?.name || deleteTargetCashier?.email}
            />

            <ActivityDetailsModal
                open={detailsModalOpen}
                onClose={() => { setDetailsModalOpen(false); setSelectedActivity(null); }}
                activity={selectedActivity}
            />
        </div>
    );
};

export default CashierAccounts;
