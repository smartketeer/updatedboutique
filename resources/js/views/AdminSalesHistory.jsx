import React from 'react';
import axios from 'axios';
import { Search, Calendar, Filter, ReceiptText, Printer } from 'lucide-react';
import { lunaBranch } from '../config/lunaBranch';
import { roxasBranch } from '../config/roxasBranch';

const PESO = '\u20B1';

const AdminSalesHistory = () => {
    const [sales, setSales] = React.useState([]);
    const [pagination, setPagination] = React.useState(null);
    const [loading, setLoading] = React.useState(true);
    const [date, setDate] = React.useState('');
    const [branchId, setBranchId] = React.useState('all');
    const [paymentMethod, setPaymentMethod] = React.useState('all');
    const [q, setQ] = React.useState('');
    const [page, setPage] = React.useState(1);
    const [branches, setBranches] = React.useState([]);

    React.useEffect(() => {
        const loadBranches = async () => {
            try {
                const res = await axios.get('/api/branches');
                setBranches(res.data || []);
            } catch (err) {
                console.error('Failed to load branches', err);
            }
        };
        loadBranches();
    }, []);

    const fetchSales = React.useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (date) params.set('date', date);
            if (branchId !== 'all') params.set('branch_id', branchId);
            if (paymentMethod !== 'all') params.set('payment_method', paymentMethod);
            if (q.trim()) params.set('q', q.trim());
            params.set('page', page);
            const res = await axios.get(`/api/sales?${params.toString()}`);
            setSales(res.data.data || []);
            setPagination({
                current_page: res.data.current_page,
                last_page: res.data.last_page,
                total: res.data.total
            });
        } catch (err) {
            console.error('Failed to fetch sales', err);
        } finally {
            setLoading(false);
        }
    }, [date, branchId, paymentMethod, q, page]);

    React.useEffect(() => {
        // Reset to page 1 when filters change
        setPage(1);
    }, [date, branchId, paymentMethod, q]);

    React.useEffect(() => {
        fetchSales();
    }, [fetchSales]);

    const handlePrint = () => {
        window.print();
    };

    const totalRevenue = sales.filter(s => s.status === 'completed').reduce((sum, s) => sum + Number(s.total_amount || 0), 0);

    return (
        <div className="space-y-6 max-w-[1600px] mx-auto print:m-0 print:space-y-4">
            <header className="flex flex-col md:flex-row md:items-end justify-between gap-4 print:hidden">
                <div>
                    <h1 className="text-3xl font-medium text-[#818181] tracking-tight">Sales History</h1>
                    <p className="text-[#a6a6a6] mt-2 font-medium">Review and analyze all past transactions.</p>
                </div>
                <div className="flex items-center gap-3">
                    <div className="bg-white border border-[#cbcbcb] rounded-xl px-4 py-3 flex items-center gap-3 shadow-sm">
                        <ReceiptText size={18} className="text-[#818181]" />
                        <div>
                            <p className="text-[10px] text-[#a6a6a6] font-semibold uppercase tracking-widest">Filtered Sales</p>
                            <p className="text-lg font-semibold text-[#818181]">{PESO}{totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                        </div>
                    </div>
                    <button
                        onClick={handlePrint}
                        className="p-3 bg-[#dddddd] text-[#818181] rounded-xl hover:bg-[#d4d4d4] transition-colors border border-[#cbcbcb] shadow-sm flex items-center justify-center gap-2"
                        title="Print Report"
                    >
                        <Printer size={18} />
                        <span className="text-sm font-semibold hidden md:block">Print</span>
                    </button>
                </div>
            </header>

            <div className="bg-white border border-[#cbcbcb] rounded-2xl p-5 shadow-sm print:hidden">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="relative">
                        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#a6a6a6]" />
                        <input
                            value={q}
                            onChange={(e) => setQ(e.target.value)}
                            placeholder="Search client, item..."
                            className="w-full pl-10 pr-3 py-2 border border-[#cbcbcb] rounded-xl text-sm font-medium text-[#818181] focus:outline-none focus:ring-1 focus:ring-[#818181]"
                        />
                    </div>
                    <div className="relative">
                        <Filter size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#a6a6a6]" />
                        <select
                            value={branchId}
                            onChange={(e) => setBranchId(e.target.value)}
                            className="w-full pl-10 pr-3 py-2 border border-[#cbcbcb] rounded-xl text-sm font-medium text-[#818181] bg-white focus:outline-none focus:ring-1 focus:ring-[#818181] appearance-none"
                        >
                            <option value="all">All Branches</option>
                            {branches.map(b => (
                                <option key={b.id} value={b.id}>{b.name}</option>
                            ))}
                        </select>
                    </div>
                    <div className="relative">
                        <Calendar size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#a6a6a6]" />
                        <input
                            type="date"
                            value={date}
                            onChange={(e) => setDate(e.target.value)}
                            className="w-full pl-10 pr-3 py-2 border border-[#cbcbcb] rounded-xl text-sm font-medium text-[#818181] focus:outline-none focus:ring-1 focus:ring-[#818181]"
                        />
                    </div>
                    <div className="relative">
                        <Filter size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#a6a6a6]" />
                        <select
                            value={paymentMethod}
                            onChange={(e) => setPaymentMethod(e.target.value)}
                            className="w-full pl-10 pr-3 py-2 border border-[#cbcbcb] rounded-xl text-sm font-medium text-[#818181] bg-white focus:outline-none focus:ring-1 focus:ring-[#818181] appearance-none"
                        >
                            <option value="all">All Payments</option>
                            <option value="cash">Cash</option>
                            <option value="gcash">GCash</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* Print Header */}
            <div className="hidden print:block mb-6 border-b border-[#cbcbcb] pb-4">
                <h1 className="text-2xl font-bold text-black mb-1">Sales History Report</h1>
                <p className="text-sm text-gray-600">
                    Generated: {new Date().toLocaleString()}
                </p>
                <div className="mt-4 flex gap-6 text-sm font-medium text-gray-700">
                    <p>Branch: {branchId === 'all' ? 'All Branches' : branches.find(b => String(b.id) === branchId)?.name}</p>
                    <p>Date: {date || 'All Dates'}</p>
                    <p>Payment: {paymentMethod === 'all' ? 'All' : paymentMethod.toUpperCase()}</p>
                    <p>Total Revenue: {PESO}{totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                </div>
            </div>

            <div className="bg-white border border-[#cbcbcb] rounded-2xl shadow-sm overflow-hidden print:border-none print:shadow-none print:rounded-none">
                <div className="px-6 py-4 border-b border-[#cbcbcb] flex items-center justify-between print:hidden">
                    <h2 className="text-sm font-semibold text-[#818181] uppercase tracking-widest">Transactions Record</h2>
                </div>

                {loading ? (
                    <div className="p-8 text-center text-[#a6a6a6] font-medium animate-pulse print:hidden">Loading transactions...</div>
                ) : sales.length === 0 ? (
                    <div className="p-8 text-center text-[#a6a6a6] font-medium">No transactions found matching your criteria.</div>
                ) : (
                    <div className="overflow-x-auto print:overflow-visible">
                        <table className="w-full text-left print:text-[11px]">
                            <thead className="bg-[#dddddd] text-[#a6a6a6] print:bg-transparent print:text-black print:border-b-2 print:border-black">
                                <tr>
                                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-widest whitespace-nowrap">Date & Time</th>
                                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-widest">Items Sold</th>
                                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-widest">Branch</th>
                                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-widest">Cashier</th>
                                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-widest whitespace-nowrap">Payment</th>
                                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-widest text-right">Price</th>
                                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-widest text-center">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[#cbcbcb] print:divide-gray-300">
                                {sales.map((sale) => {
                                    const items = sale.sale_items?.map(si => `${si.item?.name} (x${si.quantity})`) || [];
                                    const customItems = sale.custom_items?.map(ci => `${ci.name} (x${ci.quantity})`) || [];
                                    const allItems = [...items, ...customItems].join(', ') || 'Unknown Items';
                                    
                                    return (
                                        <tr key={sale.id} className="hover:bg-[#dddddd]/50 transition-colors print:break-inside-avoid">
                                            <td className="px-4 py-3 text-sm font-medium text-[#818181] whitespace-nowrap print:text-black print:p-2">
                                                {new Date(sale.created_at).toLocaleString([], { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                            </td>
                                            <td className="px-4 py-3 text-sm text-[#818181] max-w-sm truncate print:max-w-none print:whitespace-normal print:text-black print:p-2" title={allItems}>
                                                {allItems}
                                            </td>
                                            <td className="px-4 py-3 text-sm font-medium text-[#818181] print:text-black print:p-2">
                                                {sale.branch_name || 'Unknown'}
                                            </td>
                                            <td className="px-4 py-3 text-sm font-medium text-[#818181] print:text-black print:p-2">
                                                {sale.staff?.name || 'Unknown'}
                                            </td>
                                            <td className="px-4 py-3 text-sm font-medium text-[#a6a6a6] capitalize print:text-gray-600 print:p-2">
                                                {sale.payment_method}
                                            </td>
                                            <td className="px-4 py-3 text-sm font-semibold text-[#818181] text-right print:text-black print:p-2">
                                                {PESO}{Number(sale.total_amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            </td>
                                            <td className="px-4 py-3 text-center print:p-2">
                                                {sale.status === 'voided' ? (
                                                    <span className="px-2 py-1 bg-red-100 text-red-700 text-[10px] font-semibold rounded-md uppercase tracking-wider print:border print:border-red-500 print:bg-transparent">Voided</span>
                                                ) : sale.status === 'pending_void' ? (
                                                    <span className="px-2 py-1 bg-yellow-100 text-yellow-700 text-[10px] font-semibold rounded-md uppercase tracking-wider print:border print:border-yellow-500 print:bg-transparent">Pending Void</span>
                                                ) : (
                                                    <span className="px-2 py-1 bg-emerald-100 text-emerald-700 text-[10px] font-semibold rounded-md uppercase tracking-wider print:border print:border-emerald-500 print:bg-transparent">Completed</span>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
                
                {/* Pagination Controls */}
                {!loading && pagination && pagination.last_page > 1 && (
                    <div className="px-6 py-4 border-t border-[#cbcbcb] flex items-center justify-between bg-[#f9f9f9] print:hidden">
                        <span className="text-sm text-[#a6a6a6] font-medium">
                            Showing page {pagination.current_page} of {pagination.last_page} ({pagination.total} total)
                        </span>
                        <div className="flex gap-2">
                            <button 
                                onClick={() => setPage(p => Math.max(1, p - 1))} 
                                disabled={pagination.current_page === 1}
                                className="px-3 py-1.5 text-sm font-semibold border border-[#cbcbcb] rounded-lg hover:bg-[#dddddd] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                Previous
                            </button>
                            <button 
                                onClick={() => setPage(p => Math.min(pagination.last_page, p + 1))} 
                                disabled={pagination.current_page === pagination.last_page}
                                className="px-3 py-1.5 text-sm font-semibold border border-[#cbcbcb] rounded-lg hover:bg-[#dddddd] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                Next
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default AdminSalesHistory;
