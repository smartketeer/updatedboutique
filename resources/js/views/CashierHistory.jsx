import React from 'react';
import axios from 'axios';
import { Search, Calendar, Filter, ReceiptText } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { lunaBranch } from '../config/lunaBranch';
import { roxasBranch } from '../config/roxasBranch';

const PESO = '\u20B1';

const CashierHistory = () => {
    const [sales, setSales] = React.useState([]);
    const [loading, setLoading] = React.useState(true);
    const [date, setDate] = React.useState(() => new Date().toISOString().slice(0, 10));
    const [paymentMethod, setPaymentMethod] = React.useState('all');
    const [q, setQ] = React.useState('');
    const [voidingSaleId, setVoidingSaleId] = React.useState(null);
    const [voidReason, setVoidReason] = React.useState('');
    const [voidLoading, setVoidLoading] = React.useState(false);
    const [voidError, setVoidError] = React.useState('');
    const branchName = useAuthStore((state) => state.branchName);
    const branches = [lunaBranch, roxasBranch];
    const branding =
        branches.find((b) => b.key === String(branchName || '').toLowerCase()) ||
        branches[0];

    const fetchSales = React.useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (date) params.set('date', date);
            if (paymentMethod !== 'all') params.set('payment_method', paymentMethod);
            if (q.trim()) params.set('q', q.trim());
            const res = await axios.get(`/api/sales?${params.toString()}`);
            setSales(res.data);
        } catch (err) {
            console.error('Failed to fetch sales', err);
        } finally {
            setLoading(false);
        }
    }, [date, paymentMethod, q]);

    React.useEffect(() => {
        fetchSales();
    }, [fetchSales]);

    const submitVoid = async () => {
        if (!voidReason || voidReason.trim().length < 5) {
            setVoidError('Reason must be at least 5 characters.');
            return;
        }
        setVoidLoading(true);
        setVoidError('');
        try {
            await axios.post(`/api/sales/${voidingSaleId}/void`, { reason: voidReason.trim() });
            setVoidingSaleId(null);
            setVoidReason('');
            fetchSales(); // Refresh list to show voided status
        } catch (err) {
            setVoidError(err.response?.data?.message || 'Failed to void transaction.');
        } finally {
            setVoidLoading(false);
        }
    };

    const totalRevenue = sales.filter(s => s.status !== 'voided').reduce((sum, s) => sum + Number(s.total_amount || 0), 0);

    return (
        <div className="space-y-6 max-w-7xl mx-auto">
            <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                    <div className="flex items-center gap-3">
                        <img src={branding.logoSrc} alt={`${branding.name} logo`} className="w-10 h-10 rounded-xl object-contain bg-white border border-[#19140015]" />
                        <div>
                            <h1 className="text-2xl font-semibold text-[#818181]">{branding.name} - Daily History</h1>
                            <p className="text-[#a6a6a6] mt-1">Search, filter, and review completed transactions.</p>
                        </div>
                    </div>
                </div>
                <div className="bg-white border border-[#19140035] rounded-xl px-4 py-3 flex items-center gap-3 shadow-sm">
                    <ReceiptText size={18} className="text-[#2D4F3E]" />
                    <div>
                        <p className="text-xs text-[#a6a6a6] font-medium">Total Sales</p>
                        <p className="text-sm font-medium text-[#818181]">{PESO}{totalRevenue.toLocaleString()}</p>
                    </div>
                </div>
            </header>

            <div className="bg-white border border-[#19140035] rounded-2xl p-5 shadow-sm">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="relative">
                        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#a6a6a6]" />
                        <input
                            value={q}
                            onChange={(e) => setQ(e.target.value)}
                            placeholder="Search client, item, or SKU..."
                            className="w-full pl-10 pr-3 py-2 border border-[#19140035] rounded-lg focus:outline-none focus:ring-1 focus:ring-[#2D4F3E]"
                        />
                    </div>
                    <div className="relative">
                        <Calendar size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#a6a6a6]" />
                        <input
                            type="date"
                            value={date}
                            onChange={(e) => setDate(e.target.value)}
                            className="w-full pl-10 pr-3 py-2 border border-[#19140035] rounded-lg focus:outline-none focus:ring-1 focus:ring-[#2D4F3E]"
                        />
                    </div>
                    <div className="relative">
                        <Filter size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#a6a6a6]" />
                        <select
                            value={paymentMethod}
                            onChange={(e) => setPaymentMethod(e.target.value)}
                            className="w-full pl-10 pr-3 py-2 border border-[#19140035] rounded-lg focus:outline-none focus:ring-1 focus:ring-[#2D4F3E] bg-white"
                        >
                            <option value="all">All Payment Methods</option>
                            <option value="cash">Cash</option>
                            <option value="gcash">GCash</option>
                        </select>
                    </div>
                </div>
            </div>

            <div className="bg-white border border-[#19140035] rounded-2xl shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-[#19140015] flex items-center justify-between bg-[#F8F6F3]/50">
                    <h2 className="text-sm font-semibold text-[#818181]">Transactions</h2>
                    <button
                        onClick={fetchSales}
                        className="px-3 py-1.5 text-xs font-semibold border border-[#19140035] rounded-lg hover:bg-[#dddddd]"
                    >
                        Refresh
                    </button>
                </div>

                {loading ? (
                    <div className="p-6 text-[#a6a6a6] animate-pulse">Loading transactions...</div>
                ) : sales.length === 0 ? (
                    <div className="p-6 text-[#a6a6a6]">No transactions found.</div>
                ) : (
                    <div className="overflow-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-[#dddddd] text-[#a6a6a6] border-b border-[#19140015]">
                                <tr>
                                    <th className="text-left px-6 py-3 font-semibold">Date</th>
                                    <th className="text-left px-6 py-3 font-semibold">Client</th>
                                    <th className="text-left px-6 py-3 font-semibold">Item</th>
                                    <th className="text-left px-6 py-3 font-semibold">Payment</th>
                                    <th className="text-right px-6 py-3 font-semibold">Discount</th>
                                    <th className="text-right px-6 py-3 font-semibold">Total</th>
                                    <th className="text-center px-6 py-3 font-semibold">Status</th>
                                    <th className="text-right px-6 py-3 font-semibold">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {sales.map((sale) => {
                                    const items = sale.sale_items?.map(si => `${si.item?.name} (x${si.quantity})`) || [];
                                    const customItems = sale.custom_items?.map(ci => `${ci.name} (x${ci.quantity})`) || [];
                                    const allItems = [...items, ...customItems].join(', ') || '-';
                                    
                                    return (
                                        <tr key={sale.id} className="border-b border-[#19140010] hover:bg-[#F8F6F3]/40">
                                            <td className="px-6 py-3 text-[#818181]">
                                                {new Date(sale.created_at).toLocaleString()}
                                            </td>
                                            <td className="px-6 py-3 text-[#818181]">
                                                {sale.client?.name || (sale.customer_type === 'online' ? 'Online Customer' : 'Walk In Customer')}
                                            </td>
                                            <td className="px-6 py-3 text-[#818181] max-w-xs truncate" title={allItems}>
                                                {allItems}
                                            </td>
                                            <td className="px-6 py-3 capitalize text-[#a6a6a6] font-medium">{sale.payment_method}</td>
                                            <td className="px-6 py-3 text-right text-[#a6a6a6]">{PESO}{Number(sale.discount || 0).toLocaleString()}</td>
                                            <td className="px-6 py-3 text-right font-medium text-[#2D4F3E]">
                                                {PESO}{Number(sale.total_amount || 0).toLocaleString()}
                                            </td>
                                            <td className="px-6 py-3 text-center">
                                                {sale.status === 'voided' ? (
                                                    <span className="px-2 py-1 bg-red-100 text-red-700 text-xs font-semibold rounded-md uppercase tracking-wider">Voided</span>
                                                ) : (
                                                    <span className="px-2 py-1 bg-green-100 text-green-700 text-xs font-semibold rounded-md uppercase tracking-wider">Completed</span>
                                                )}
                                            </td>
                                            <td className="px-6 py-3 text-right">
                                                {sale.status !== 'voided' && (
                                                    <button
                                                        onClick={() => setVoidingSaleId(sale.id)}
                                                        className="text-xs font-semibold text-red-500 hover:text-red-700 underline underline-offset-2 transition-colors"
                                                    >
                                                        Void Sale
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Void Modal */}
            {voidingSaleId && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl border border-[#19140015]">
                        <h3 className="text-lg font-semibold text-[#818181] mb-2">Void Transaction</h3>
                        <p className="text-sm text-[#a6a6a6] mb-4">
                            Are you sure you want to void this sale? This will return all items to inventory and deduct the total from today's revenue.
                        </p>
                        <div className="mb-4">
                            <label className="block text-xs font-semibold text-[#a6a6a6] uppercase tracking-widest mb-1">Reason for Voiding *</label>
                            <input
                                type="text"
                                value={voidReason}
                                onChange={(e) => setVoidReason(e.target.value)}
                                placeholder="e.g. Accidental checkout, Customer changed mind..."
                                className="w-full px-3 py-2 border border-[#19140035] rounded-lg focus:outline-none focus:ring-1 focus:ring-red-500 text-sm"
                            />
                            {voidError && <p className="text-xs text-red-500 mt-1 font-medium">{voidError}</p>}
                        </div>
                        <div className="flex justify-end gap-3">
                            <button
                                onClick={() => { setVoidingSaleId(null); setVoidReason(''); setVoidError(''); }}
                                disabled={voidLoading}
                                className="px-4 py-2 text-sm font-semibold text-[#818181] hover:bg-[#dddddd] rounded-lg transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={submitVoid}
                                disabled={voidLoading}
                                className="px-4 py-2 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg shadow-sm transition-colors disabled:opacity-50"
                            >
                                {voidLoading ? 'Voiding...' : 'Confirm Void'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CashierHistory;
