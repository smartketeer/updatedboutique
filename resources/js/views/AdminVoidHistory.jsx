import React from 'react';
import axios from 'axios';
import { Search, Calendar, Filter, Ban } from 'lucide-react';

const PESO = '\u20B1';

const AdminVoidHistory = () => {
    const [sales, setSales] = React.useState([]);
    const [loading, setLoading] = React.useState(true);
    const [date, setDate] = React.useState('');
    const [q, setQ] = React.useState('');

    const fetchVoidedSales = React.useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            params.set('status', 'voided'); // Only fetch voided transactions
            if (date) params.set('date', date);
            if (q.trim()) params.set('q', q.trim());
            
            const res = await axios.get(`/api/sales?${params.toString()}`);
            setSales(res.data);
        } catch (err) {
            console.error('Failed to fetch voided sales', err);
        } finally {
            setLoading(false);
        }
    }, [date, q]);

    React.useEffect(() => {
        fetchVoidedSales();
    }, [fetchVoidedSales]);

    const totalVoidedAmount = sales.reduce((sum, s) => sum + Number(s.total_amount || 0), 0);

    return (
        <div className="space-y-6 max-w-7xl mx-auto">
            <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-red-100 text-red-600 flex items-center justify-center">
                            <Ban size={20} />
                        </div>
                        <div>
                            <h1 className="text-2xl font-semibold text-[#818181]">Void History</h1>
                            <p className="text-[#a6a6a6] mt-1">Review all voided transactions and returned stock across all branches.</p>
                        </div>
                    </div>
                </div>
                <div className="bg-white border border-[#19140035] rounded-xl px-4 py-3 flex items-center gap-3 shadow-sm">
                    <Ban size={18} className="text-red-500" />
                    <div>
                        <p className="text-xs text-[#a6a6a6] font-medium">Total Value Voided</p>
                        <p className="text-sm font-medium text-red-600">{PESO}{totalVoidedAmount.toLocaleString()}</p>
                    </div>
                </div>
            </header>

            <div className="bg-white border border-[#19140035] rounded-2xl p-5 shadow-sm">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="relative">
                        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#a6a6a6]" />
                        <input
                            value={q}
                            onChange={(e) => setQ(e.target.value)}
                            placeholder="Search cashier name, item, or SKU..."
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
                </div>
            </div>

            <div className="bg-white border border-[#19140035] rounded-2xl shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-[#19140015] flex items-center justify-between bg-[#F8F6F3]/50">
                    <h2 className="text-sm font-semibold text-[#818181]">Voided Transactions List</h2>
                    <button
                        onClick={fetchVoidedSales}
                        className="px-3 py-1.5 text-xs font-semibold border border-[#19140035] rounded-lg hover:bg-[#dddddd]"
                    >
                        Refresh
                    </button>
                </div>

                {loading ? (
                    <div className="p-6 text-[#a6a6a6] animate-pulse">Loading void history...</div>
                ) : sales.length === 0 ? (
                    <div className="p-6 text-[#a6a6a6]">No voided transactions found.</div>
                ) : (
                    <div className="overflow-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-[#dddddd] text-[#a6a6a6] border-b border-[#19140015]">
                                <tr>
                                    <th className="text-left px-6 py-3 font-semibold">Date & Time</th>
                                    <th className="text-left px-6 py-3 font-semibold">Cashier</th>
                                    <th className="text-left px-6 py-3 font-semibold">Voided Items</th>
                                    <th className="text-right px-6 py-3 font-semibold">Original Value</th>
                                    <th className="text-center px-6 py-3 font-semibold">Status</th>
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
                                                <div className="font-medium">{new Date(sale.updated_at).toLocaleDateString()}</div>
                                                <div className="text-xs text-[#a6a6a6]">{new Date(sale.updated_at).toLocaleTimeString()}</div>
                                            </td>
                                            <td className="px-6 py-3 text-[#818181] font-medium">
                                                {sale.staff?.name || 'Unknown Staff'}
                                            </td>
                                            <td className="px-6 py-3 text-[#818181] max-w-xs truncate" title={allItems}>
                                                {allItems}
                                            </td>
                                            <td className="px-6 py-3 text-right font-medium text-red-500">
                                                {PESO}{Number(sale.total_amount || 0).toLocaleString()}
                                            </td>
                                            <td className="px-6 py-3 text-center">
                                                <span className="px-2 py-1 bg-red-100 text-red-700 text-xs font-semibold rounded-md uppercase tracking-wider">Voided</span>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
};

export default AdminVoidHistory;
