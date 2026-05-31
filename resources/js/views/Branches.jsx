import React from 'react';
import axios from 'axios';
import { Plus, Trash2, Edit2, MapPin } from 'lucide-react';
import ConfirmDeleteModal from '../components/ConfirmDeleteModal';

const Branches = () => {
    const [branches, setBranches] = React.useState([]);
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState('');
    const [success, setSuccess] = React.useState('');

    const [form, setForm] = React.useState({
        id: null,
        name: '',
        address: '',
        phone: '',
        is_active: true,
    });

    const resetForm = () => setForm({ id: null, name: '', address: '', phone: '', is_active: true });

    const fetchBranches = React.useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const res = await axios.get('/api/branches');
            setBranches(res.data);
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to load branches');
        } finally {
            setLoading(false);
        }
    }, []);

    React.useEffect(() => {
        fetchBranches();
    }, [fetchBranches]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setSuccess('');
        try {
            const payload = {
                name: form.name,
                address: form.address || null,
                phone: form.phone || null,
                is_active: Boolean(form.is_active),
            };
            if (form.id) {
                await axios.put(`/api/branches/${form.id}`, payload);
            } else {
                await axios.post('/api/branches', payload);
            }
            setSuccess(form.id ? 'Branch updated successfully.' : 'Branch created successfully.');
            resetForm();
            fetchBranches();
        } catch (err) {
            setError(err.response?.data?.message || 'Save failed');
        }
    };

    const startEdit = (branch) => {
        setForm({
            id: branch.id,
            name: branch.name || '',
            address: branch.address || '',
            phone: branch.phone || '',
            is_active: Boolean(branch.is_active),
        });
    };

    const [deleteModalOpen, setDeleteModalOpen] = React.useState(false);
    const [deleteTargetBranch, setDeleteTargetBranch] = React.useState(null);
    const [deleteConfirming, setDeleteConfirming] = React.useState(false);

    const handleDelete = (branch) => {
        setDeleteTargetBranch(branch);
        setDeleteModalOpen(true);
    };

    const executeDelete = async () => {
        if (!deleteTargetBranch) return;
        setDeleteConfirming(true);
        setError('');
        setSuccess('');
        try {
            await axios.delete(`/api/branches/${deleteTargetBranch.id}`);
            setSuccess('Branch deleted successfully.');
            setDeleteModalOpen(false);
            setDeleteTargetBranch(null);
            fetchBranches();
        } catch (err) {
            setDeleteModalOpen(false);
            setDeleteTargetBranch(null);
            setError(err.response?.data?.message || 'Delete failed');
        } finally {
            setDeleteConfirming(false);
        }
    };

    return (
        <div className="space-y-6 max-w-6xl mx-auto">
            <header className="flex items-end justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-semibold text-[#818181]">Branches</h1>
                    <p className="text-[#a6a6a6] mt-1">Configure branch locations used by the system.</p>
                </div>
            </header>

            {error ? (
                <div className="p-3 bg-[#dddddd] text-[#818181] border border-red-100 rounded-lg text-sm">{error}</div>
            ) : null}
            {success ? (
                <div className="p-3 bg-[#dddddd] text-[#818181] border border-green-100 rounded-lg text-sm">{success}</div>
            ) : null}

            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                <div className="lg:col-span-2 bg-gradient-to-b from-white to-[#fff7f9] border border-[#19140015] rounded-3xl shadow-sm p-6">
                    <div className="flex items-center gap-2 mb-4">
                        <MapPin size={18} className="text-[#d94a79]" />
                        <h2 className="text-sm font-semibold text-[#818181]">{form.id ? 'Edit Branch' : 'Add Branch'}</h2>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="block text-xs font-semibold text-[#a6a6a6] mb-1">Name</label>
                            <input
                                value={form.name}
                                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                                className="w-full px-3 py-2 border border-[#19140035] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#d94a79]/25 bg-white"
                                required
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-semibold text-[#a6a6a6] mb-1">Address</label>
                            <input
                                value={form.address}
                                onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                                className="w-full px-3 py-2 border border-[#19140035] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#d94a79]/25 bg-white"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-semibold text-[#a6a6a6] mb-1">Phone</label>
                            <input
                                value={form.phone}
                                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                                className="w-full px-3 py-2 border border-[#19140035] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#d94a79]/25 bg-white"
                            />
                        </div>

                        <div className="flex items-center justify-between border border-[#19140015] rounded-xl px-3 py-2 bg-white/70">
                            <div>
                                <p className="text-xs font-semibold text-[#818181]">Active</p>
                                <p className="text-[11px] text-[#a6a6a6]">Show this branch as available.</p>
                            </div>
                            <input
                                type="checkbox"
                                checked={form.is_active}
                                onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))}
                                className="h-4 w-4"
                            />
                        </div>

                        <div className="flex gap-2">
                            <button
                                type="submit"
                                className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 bg-gradient-to-r from-[#4a2437] to-[#d94a79] text-white rounded-xl font-semibold hover:opacity-95 transition-opacity shadow-sm"
                            >
                                <Plus size={16} />
                                {form.id ? 'Save Changes' : 'Create Branch'}
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
                        <h2 className="text-sm font-semibold text-[#818181]">Branch List</h2>
                        <button
                            onClick={fetchBranches}
                            className="px-3 py-1.5 text-xs font-semibold border border-[#19140035] rounded-xl hover:bg-[#fff7f9]"
                        >
                            Refresh
                        </button>
                    </div>

                    {loading ? (
                        <div className="p-6 text-[#a6a6a6] animate-pulse">Loading branches...</div>
                    ) : branches.length === 0 ? (
                        <div className="p-6 text-[#a6a6a6]">No branches yet.</div>
                    ) : (
                        <div className="overflow-auto">
                            <table className="w-full text-sm">
                                <thead className="bg-[#dddddd] text-[#a6a6a6] border-b border-[#19140015]">
                                    <tr>
                                        <th className="text-left px-6 py-3 font-semibold">Name</th>
                                        <th className="text-left px-6 py-3 font-semibold">Address</th>
                                        <th className="text-left px-6 py-3 font-semibold">Phone</th>
                                        <th className="text-right px-6 py-3 font-semibold">Status</th>
                                        <th className="text-right px-6 py-3 font-semibold">Actions</th>
                                    </tr>
                                </thead>
                                    <tbody>
                                    {branches.map((b) => (
                                        <tr key={b.id} className="border-b border-[#19140010] hover:bg-[#fff7f9]/70">
                                            <td className="px-6 py-3 text-[#818181] font-medium">{b.name}</td>
                                            <td className="px-6 py-3 text-[#a6a6a6]">{b.address || '-'}</td>
                                            <td className="px-6 py-3 text-[#a6a6a6]">{b.phone || '-'}</td>
                                            <td className="px-6 py-3 text-right">
                                                <span
                                                    className={`text-xs font-semibold px-2 py-1 rounded-md border ${
                                                        b.is_active
                                                            ? 'bg-[#dddddd] text-[#818181] border-green-100'
                                                            : 'bg-[#dddddd] text-[#a6a6a6] border-[#19140015]'
                                                    }`}
                                                >
                                                    {b.is_active ? 'Active' : 'Inactive'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-3">
                                                <div className="flex justify-end gap-2">
                                                    <button
                                                        onClick={() => startEdit(b)}
                                                        className="inline-flex items-center gap-1 px-3 py-1.5 border border-[#19140035] rounded-xl hover:bg-[#fff7f9] text-xs font-semibold"
                                                    >
                                                        <Edit2 size={14} />
                                                        Edit
                                                    </button>
                                                    <button
                                                        onClick={() => handleDelete(b)}
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

            <ConfirmDeleteModal
                open={deleteModalOpen}
                onClose={() => { setDeleteModalOpen(false); setDeleteTargetBranch(null); }}
                onConfirm={executeDelete}
                confirming={deleteConfirming}
                title="Delete Branch"
                itemName={deleteTargetBranch?.name}
            />
        </div>
    );
};

export default Branches;
