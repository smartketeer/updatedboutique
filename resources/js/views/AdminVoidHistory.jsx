import React from 'react';
import axios from 'axios';
import { Search, Calendar, Filter, Ban, ArrowRightLeft, LogOut, ArrowRight, ArrowLeft } from 'lucide-react';

const PESO = '\u20B1';

const AdminVoidHistory = () => {
    const [sales, setSales] = React.useState([]);
    const [loading, setLoading] = React.useState(true);
    const [date, setDate] = React.useState('');
    const [q, setQ] = React.useState('');
    const [page, setPage] = React.useState(1);
    const [pagination, setPagination] = React.useState(null);
    const [totalVoidedAmount, setTotalVoidedAmount] = React.useState(0);
    const [viewReasonSaleId, setViewReasonSaleId] = React.useState(null);
    const [viewReasonText, setViewReasonText] = React.useState('');
    const [reasonLoading, setReasonLoading] = React.useState(false);
    const [approvingSaleId, setApprovingSaleId] = React.useState(null);

    const [activeTab, setActiveTab] = React.useState('voids'); // 'voids' | 'transfers'
    const [transfers, setTransfers] = React.useState([]);
    const [loadingTransfers, setLoadingTransfers] = React.useState(false);
    const [transfersPage, setTransfersPage] = React.useState(1);
    const [transfersQ, setTransfersQ] = React.useState('');
    const [transfersDate, setTransfersDate] = React.useState('');

    const fetchTransfers = React.useCallback(async () => {
        setLoadingTransfers(true);
        try {
            const params = new URLSearchParams();
            params.set('reason', 'cashier_transfer_out,cashier_transfer_in,cashier_pull_out');
            params.set('limit', '500'); // Load a lot, then filter in frontend for simplicity since stock management doesn't have strict pagination yet
            if (transfersDate) params.set('from', transfersDate); // Assuming single date filters 'from' for simplicity or 'date'
            
            const res = await axios.get(`/api/stock-management/movements?${params.toString()}`);
            let data = res.data || [];
            
            if (transfersQ.trim()) {
                const query = transfersQ.toLowerCase().trim();
                data = data.filter(log => 
                    (log.item?.name || '').toLowerCase().includes(query) ||
                    (log.item?.sku || '').toLowerCase().includes(query) ||
                    (log.actor?.name || '').toLowerCase().includes(query)
                );
            }
            
            setTransfers(data);
        } catch (err) {
            console.error('Failed to fetch transfers', err);
        } finally {
            setLoadingTransfers(false);
        }
    }, [transfersDate, transfersQ]);

    React.useEffect(() => {
        if (activeTab === 'transfers') {
            fetchTransfers();
        }
    }, [fetchTransfers, activeTab]);

    const handleViewReason = async (saleId) => {
        setViewReasonSaleId(saleId);
        setReasonLoading(true);
        setViewReasonText('');
        try {
            const res = await axios.get(`/api/sales/${saleId}/void-reason`);
            setViewReasonText(res.data.reason || 'No reason found.');
        } catch (err) {
            setViewReasonText('Failed to load reason.');
        } finally {
            setReasonLoading(false);
        }
    };

    const fetchVoidedSales = React.useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            params.set('status', 'voids_and_pending'); // Fetch both voided and pending
            if (date) params.set('date', date);
            if (q.trim()) params.set('q', q.trim());
            params.set('page', page);
            
            const res = await axios.get(`/api/sales?${params.toString()}`);
            // Failsafe: only keep genuinely voided or pending sales
            const dataArray = Array.isArray(res.data?.data) ? res.data.data : (Array.isArray(res.data) ? res.data : []);
            const trulyVoided = dataArray.filter(s => s.status === 'voided' || s.status === 'pending_void');
            
            setSales(trulyVoided);
            setTotalVoidedAmount(res.data.total_voided_revenue || 0);
            
            if (res.data.current_page) {
                setPagination({
                    current_page: res.data.current_page,
                    last_page: res.data.last_page,
                    total: res.data.total
                });
            }
        } catch (err) {
            console.error('Failed to fetch voided sales', err);
        } finally {
            setLoading(false);
        }
    }, [date, q, page]);

    React.useEffect(() => {
        setPage(1);
    }, [date, q]);

    React.useEffect(() => {
        fetchVoidedSales();
    }, [fetchVoidedSales]);

    const handleApproveVoid = async (saleId) => {
        if (!window.confirm('Are you sure you want to approve this void? Stock will be returned.')) return;
        setApprovingSaleId(saleId);
        try {
            await axios.post(`/api/sales/${saleId}/approve-void`);
            fetchVoidedSales();
        } catch (err) {
            alert(err.response?.data?.message || 'Failed to approve void.');
        } finally {
            setApprovingSaleId(null);
        }
    };

    return (
        <div className="space-y-6 max-w-7xl mx-auto">
            <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-red-100 text-red-600 flex items-center justify-center">
                            <Ban size={20} />
                        </div>
                        <div>
                            <h1 className="text-2xl font-semibold text-[#818181]">Void / Transfer / Pull Out History</h1>
                            <p className="text-[#a6a6a6] mt-1">Review all voided transactions, pulled out stock, and stock transfers.</p>
                        </div>
                    </div>
                </div>
                {activeTab === 'voids' && (
                    <div className="bg-white border border-[#19140035] rounded-xl px-4 py-3 flex items-center gap-3 shadow-sm">
                        <Ban size={18} className="text-red-500" />
                        <div>
                            <p className="text-xs text-[#a6a6a6] font-medium">Total Value Voided</p>
                            <p className="text-sm font-medium text-red-600">{PESO}{totalVoidedAmount.toLocaleString()}</p>
                        </div>
                    </div>
                )}
            </header>

            {/* Tabs */}
            <div className="flex border-b border-[#19140035]">
                <button
                    className={`py-3 px-6 font-semibold text-sm border-b-2 transition-colors ${activeTab === 'voids' ? 'border-[#2D4F3E] text-[#2D4F3E]' : 'border-transparent text-[#a6a6a6] hover:text-[#818181]'}`}
                    onClick={() => setActiveTab('voids')}
                >
                    Void History
                </button>
                <button
                    className={`py-3 px-6 font-semibold text-sm border-b-2 transition-colors ${activeTab === 'transfers' ? 'border-[#2D4F3E] text-[#2D4F3E]' : 'border-transparent text-[#a6a6a6] hover:text-[#818181]'}`}
                    onClick={() => setActiveTab('transfers')}
                >
                    Transfer / Pull Out History
                </button>
            </div>

            {activeTab === 'voids' && (
                <>

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
                                                {sale.status === 'voided' ? (
                                                    <span className="px-2 py-1 bg-red-100 text-red-700 text-xs font-semibold rounded-md uppercase tracking-wider">Voided</span>
                                                ) : sale.status === 'pending_void' ? (
                                                    <span className="px-2 py-1 bg-yellow-100 text-yellow-700 text-xs font-semibold rounded-md uppercase tracking-wider">Pending</span>
                                                ) : null}
                                            </td>
                                            <td className="px-6 py-3 text-right">
                                                <div className="flex items-center justify-end gap-3">
                                                    {sale.status === 'pending_void' && (
                                                        <button
                                                            onClick={() => handleApproveVoid(sale.id)}
                                                            disabled={approvingSaleId === sale.id}
                                                            className="px-3 py-1 bg-[#2D4F3E] text-white text-xs font-semibold rounded-lg hover:bg-[#1f382a] disabled:opacity-50 transition-colors"
                                                        >
                                                            {approvingSaleId === sale.id ? 'Approving...' : 'Approve'}
                                                        </button>
                                                    )}
                                                    <button
                                                        onClick={() => handleViewReason(sale.id)}
                                                        className="text-xs font-semibold text-[#818181] hover:text-[#2D4F3E] underline underline-offset-2 transition-colors"
                                                    >
                                                        View Reason
                                                    </button>
                                                </div>
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
                    <div className="px-6 py-4 border-t border-[#19140015] flex items-center justify-between bg-[#F8F6F3]/50">
                        <span className="text-sm text-[#a6a6a6] font-medium">
                            Showing page {pagination.current_page} of {pagination.last_page} ({pagination.total} total)
                        </span>
                        <div className="flex gap-2">
                            <button 
                                onClick={() => setPage(p => Math.max(1, p - 1))} 
                                disabled={pagination.current_page === 1}
                                className="px-3 py-1.5 text-sm font-semibold border border-[#19140035] rounded-lg hover:bg-[#dddddd] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                Previous
                            </button>
                            <button 
                                onClick={() => setPage(p => Math.min(pagination.last_page, p + 1))} 
                                disabled={pagination.current_page === pagination.last_page}
                                className="px-3 py-1.5 text-sm font-semibold border border-[#19140035] rounded-lg hover:bg-[#dddddd] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                Next
                            </button>
                        </div>
                    </div>
                )}
            </div>
            </>
            )}

            {activeTab === 'transfers' && (
                <>
                <div className="bg-white border border-[#19140035] rounded-2xl p-5 shadow-sm">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="relative">
                            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#a6a6a6]" />
                            <input
                                value={transfersQ}
                                onChange={(e) => setTransfersQ(e.target.value)}
                                placeholder="Search cashier name, item, or SKU..."
                                className="w-full pl-10 pr-3 py-2 border border-[#19140035] rounded-lg focus:outline-none focus:ring-1 focus:ring-[#2D4F3E]"
                            />
                        </div>
                        <div className="relative">
                            <Calendar size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#a6a6a6]" />
                            <input
                                type="date"
                                value={transfersDate}
                                onChange={(e) => setTransfersDate(e.target.value)}
                                className="w-full pl-10 pr-3 py-2 border border-[#19140035] rounded-lg focus:outline-none focus:ring-1 focus:ring-[#2D4F3E]"
                            />
                        </div>
                    </div>
                </div>

                <div className="bg-white border border-[#19140035] rounded-2xl shadow-sm overflow-hidden">
                    <div className="px-6 py-4 border-b border-[#19140015] flex items-center justify-between bg-[#F8F6F3]/50">
                        <h2 className="text-sm font-semibold text-[#818181]">Transfer and Pull Out Transactions</h2>
                        <button
                            onClick={fetchTransfers}
                            className="px-3 py-1.5 text-xs font-semibold border border-[#19140035] rounded-lg hover:bg-[#dddddd]"
                        >
                            Refresh
                        </button>
                    </div>

                    {loadingTransfers ? (
                        <div className="p-6 text-[#a6a6a6] animate-pulse">Loading history...</div>
                    ) : transfers.length === 0 ? (
                        <div className="p-6 text-[#a6a6a6]">No transactions found.</div>
                    ) : (
                        <div className="overflow-auto">
                            <table className="w-full text-sm">
                                <thead className="bg-[#dddddd] text-[#a6a6a6] border-b border-[#19140015]">
                                    <tr>
                                        <th className="text-left px-6 py-3 font-semibold">Date & Time</th>
                                        <th className="text-left px-6 py-3 font-semibold">Actor (Cashier)</th>
                                        <th className="text-left px-6 py-3 font-semibold">Branch</th>
                                        <th className="text-left px-6 py-3 font-semibold">Item</th>
                                        <th className="text-left px-6 py-3 font-semibold">Type</th>
                                        <th className="text-right px-6 py-3 font-semibold">Quantity</th>
                                        <th className="text-left px-6 py-3 font-semibold">Reason / Notes</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {transfers.slice((transfersPage - 1) * 10, transfersPage * 10).map((log) => {
                                        return (
                                            <tr key={log.id} className="border-b border-[#19140010] hover:bg-[#F8F6F3]/40">
                                                <td className="px-6 py-3 text-[#818181]">
                                                    <div className="font-medium">{new Date(log.created_at).toLocaleDateString()}</div>
                                                    <div className="text-xs text-[#a6a6a6]">{new Date(log.created_at).toLocaleTimeString()}</div>
                                                </td>
                                                <td className="px-6 py-3 text-[#818181] font-medium">
                                                    {log.actor?.name || 'Unknown'}
                                                </td>
                                                <td className="px-6 py-3 text-[#818181] font-medium">
                                                    {log.branch?.name || '-'}
                                                </td>
                                                <td className="px-6 py-3 text-[#818181]">
                                                    {log.item?.name || 'Unknown Item'}
                                                </td>
                                                <td className="px-6 py-3 text-left">
                                                    {log.reason === 'cashier_transfer_out' ? (
                                                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 text-[10px] font-semibold rounded-md uppercase tracking-wider">
                                                            <ArrowRight size={12} /> Transfer Out
                                                        </span>
                                                    ) : log.reason === 'cashier_transfer_in' ? (
                                                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-emerald-100 text-emerald-700 text-[10px] font-semibold rounded-md uppercase tracking-wider">
                                                            <ArrowLeft size={12} /> Transfer In
                                                        </span>
                                                    ) : log.reason === 'cashier_pull_out' ? (
                                                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-orange-100 text-orange-700 text-[10px] font-semibold rounded-md uppercase tracking-wider">
                                                            <LogOut size={12} /> Pull Out
                                                        </span>
                                                    ) : (
                                                        <span className="px-2 py-1 bg-gray-100 text-gray-700 text-[10px] font-semibold rounded-md uppercase tracking-wider">
                                                            {log.reason}
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="px-6 py-3 text-right font-medium text-[#818181]">
                                                    {log.change_qty > 0 ? `+${log.change_qty}` : log.change_qty}
                                                </td>
                                                <td className="px-6 py-3 text-[#818181] max-w-[200px] truncate" title={log.notes}>
                                                    {log.notes || '-'}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                    
                    {/* Simple Pagination Controls for Transfers */}
                    {!loadingTransfers && transfers.length > 10 && (
                        <div className="px-6 py-4 border-t border-[#19140015] flex items-center justify-between bg-[#F8F6F3]/50">
                            <span className="text-sm text-[#a6a6a6] font-medium">
                                Showing page {transfersPage} of {Math.ceil(transfers.length / 10)} ({transfers.length} total)
                            </span>
                            <div className="flex gap-2">
                                <button 
                                    onClick={() => setTransfersPage(p => Math.max(1, p - 1))} 
                                    disabled={transfersPage === 1}
                                    className="px-3 py-1.5 text-sm font-semibold border border-[#19140035] rounded-lg hover:bg-[#dddddd] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                >
                                    Previous
                                </button>
                                <button 
                                    onClick={() => setTransfersPage(p => Math.min(Math.ceil(transfers.length / 10), p + 1))} 
                                    disabled={transfersPage === Math.ceil(transfers.length / 10)}
                                    className="px-3 py-1.5 text-sm font-semibold border border-[#19140035] rounded-lg hover:bg-[#dddddd] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                >
                                    Next
                                </button>
                            </div>
                        </div>
                    )}
                </div>
                </>
            )}

            {/* View Reason Modal */}
            {viewReasonSaleId && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl border border-[#19140015]">
                        <h3 className="text-lg font-semibold text-[#818181] mb-4">Reason for Voiding</h3>
                        
                        <div className="mb-6 p-4 bg-[#F8F6F3] border border-[#19140015] rounded-xl text-sm text-[#818181]">
                            {reasonLoading ? (
                                <span className="animate-pulse">Loading reason...</span>
                            ) : (
                                <span>{viewReasonText}</span>
                            )}
                        </div>

                        <div className="flex justify-end">
                            <button
                                onClick={() => { setViewReasonSaleId(null); setViewReasonText(''); }}
                                className="px-5 py-2 text-sm font-semibold text-white bg-[#818181] hover:bg-[#a6a6a6] rounded-lg shadow-sm transition-colors"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminVoidHistory;
