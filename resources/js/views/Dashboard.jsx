import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { TrendingUp, AlertTriangle, Users, Package, UserPlus, Clock, Activity, CheckCircle2, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';

const PESO = '\u20B1';
const EM_DASH = '\u2014';
const BULLET = '\u2022';
const ARROW = '\u2192';

const Dashboard = () => {
    const navigate = useNavigate();
    const { user } = useAuthStore();
    const [stats, setStats] = useState({
        revenue: 0,
        transactions: 0,
        lowStockCount: 0,
        valuationBranches: [],
    });
    const [loading, setLoading] = useState(true);
    const [recentActivity, setRecentActivity] = useState([]);
    const [activityLoading, setActivityLoading] = useState(false);
    const [stockHistoryEvents, setStockHistoryEvents] = useState([]);
    const [stockHistoryLoading, setStockHistoryLoading] = useState(false);
    const [inventoryRequests, setInventoryRequests] = useState([]);
    const [inventoryRequestsError, setInventoryRequestsError] = useState('');
    const [inventoryRequestsLoading, setInventoryRequestsLoading] = useState(false);
    const [inventoryRequestAlert, setInventoryRequestAlert] = useState('');
    const [activeTab, setActiveTab] = useState('activity'); // 'activity' | 'stock'

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const isStaff = user?.role === 'staff';
                const requests = [
                    isStaff ? Promise.resolve({ data: { total_revenue: 0, total_transactions: 0 } }) : axios.get('/api/reports/daily-summary'),
                    axios.get('/api/inventory/low-stock'),
                    isStaff ? Promise.resolve({ data: { branches: [] } }) : axios.get('/api/reports/inventory-valuation'),
                ];
                const [dailyRes, lowStockRes, valRes] = await Promise.all(requests);
                setStats({
                    revenue: dailyRes.data.total_revenue || 0,
                    transactions: dailyRes.data.total_transactions || 0,
                    lowStockCount: lowStockRes.data.length || 0,
                    valuationBranches: valRes.data.branches || [],
                });
            } catch (err) {
                console.error('Failed to fetch stats', err);
            } finally {
                setLoading(false);
            }
        };
        fetchStats();
    }, [user]);

    useEffect(() => {
        const fetchActivity = async () => {
            if (user?.role !== 'admin') return;
            setActivityLoading(true);
            try {
                const res = await axios.get('/api/activity-logs?scope=cashier&limit=10');
                setRecentActivity(res.data || []);
            } catch {
                setRecentActivity([]);
            } finally {
                setActivityLoading(false);
            }
        };
        fetchActivity();
    }, [user]);

    useEffect(() => {
        const fetchStockHistory = async () => {
            if (user?.role !== 'admin') return;
            setStockHistoryLoading(true);
            try {
                const res = await axios.get('/api/stock-management/movements', { params: { limit: 30 } });
                const rows = Array.isArray(res.data) ? res.data : [];
                const filtered = rows.filter((r) => r?.reason === 'receipt' || r?.reason === 'issue');
                setStockHistoryEvents(filtered.slice(0, 10));
            } catch {
                setStockHistoryEvents([]);
            } finally {
                setStockHistoryLoading(false);
            }
        };
        fetchStockHistory();
    }, [user]);

    useEffect(() => {
        if (user?.role !== 'admin') return;
        let cancelled = false;
        const seen = new Set();

        const fetchRequests = async () => {
            if (cancelled) return;
            setInventoryRequestsLoading(true);
            setInventoryRequestsError('');
            try {
                const res = await axios.get('/api/inventory-access/requests?status=open');
                const rows = Array.isArray(res.data) ? res.data : [];
                if (!cancelled) {
                    const newOnes = rows.filter((r) => r?.id && !seen.has(r.id));
                    rows.forEach((r) => { if (r?.id) seen.add(r.id); });
                    if (newOnes.length > 0) {
                        const latest = newOnes[0];
                        const who = latest?.cashier?.name || latest?.cashier?.email || 'Cashier';
                        setInventoryRequestAlert(`New inventory access request from ${who}.`);
                        window.setTimeout(() => setInventoryRequestAlert(''), 5000);
                    }
                    setInventoryRequests(rows);
                }
            } catch (err) {
                if (!cancelled) {
                    setInventoryRequestsError(err.response?.data?.message || 'Failed to load inventory access requests');
                    setInventoryRequests([]);
                }
            } finally {
                if (!cancelled) setInventoryRequestsLoading(false);
            }
        };

        fetchRequests();
        const id = window.setInterval(fetchRequests, 5000);
        return () => {
            cancelled = true;
            window.clearInterval(id);
        };
    }, [user]);

    const approveInventoryRequest = async (requestId) => {
        setInventoryRequestsError('');
        try {
            await axios.post(`/api/inventory-access/requests/${encodeURIComponent(requestId)}/approve`);
            const res = await axios.get('/api/inventory-access/requests?status=open');
            setInventoryRequests(Array.isArray(res.data) ? res.data : []);
        } catch (err) {
            setInventoryRequestsError(err.response?.data?.message || 'Approval failed');
        }
    };

    const valuationCards = (stats.valuationBranches || []).map(b => ({
        title: `${b.name} Est. Retail Value`,
        value: `${PESO}${b.estimated_value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        icon: Package,
        color: 'text-[#d94a79]',
        bg: 'bg-[#d94a79]/10',
        blob: 'bg-[#d94a79]/20',
    }));

    const cards = [
        ...(user?.role === 'admin'
            ? [
                  {
                      title: "Today's Revenue",
                      value: `${PESO}${stats.revenue.toLocaleString()}`,
                      icon: TrendingUp,
                      color: 'text-[#818181]',
                      bg: 'bg-[#dddddd]',
                      blob: 'bg-[#dddddd]/10',
                  },
                  {
                      title: 'Total Transactions',
                      value: stats.transactions,
                      icon: Activity,
                      color: 'text-emerald-600',
                      bg: 'bg-emerald-50',
                      blob: 'bg-emerald-500/10',
                  },
                  ...valuationCards,
              ]
            : []),
        { title: 'Low Stock Alerts', value: stats.lowStockCount, icon: AlertTriangle, color: 'text-red-600', bg: 'bg-[#dddddd]', blob: 'bg-[#dddddd]/10' },
    ];

    if (loading) return <div className="text-[#a6a6a6] animate-pulse flex items-center justify-center h-64 font-medium">Loading dashboard...</div>;

    return (
        <div className="space-y-8 max-w-[1600px] mx-auto">
            <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-medium text-[#818181] tracking-tight">
                        Welcome back, {user?.name}!
                    </h1>
                    <p className="text-[#a6a6a6] mt-2 font-medium">
                        {user?.role === 'admin'
                            ? "Here's what's happening with your operations today."
                            : "Quick access to daily tasks and inventory status."}
                    </p>
                </div>
            </header>

            {stats.lowStockCount > 0 && user?.role === 'admin' && (
                <div className="flex items-center justify-between p-5 bg-gradient-to-r from-amber-50 to-amber-100/50 border border-[#cbcbcb]/60 rounded-2xl shadow-sm animate-in fade-in slide-in-from-top-4 duration-500">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center text-red-600 shadow-inner">
                            <AlertTriangle size={24} strokeWidth={1.5} />
                        </div>
                        <div>
                            <h3 className="text-red-600 font-medium text-sm">Inventory Attention Required</h3>
                            <p className="text-red-600 text-sm mt-0.5">{stats.lowStockCount} items have fallen below their minimum stock threshold.</p>
                        </div>
                    </div>
                    <button
                        onClick={() => navigate('/admin/inventory')}
                        className="px-5 py-2.5 bg-white text-red-600 hover:bg-[#dddddd] text-sm font-medium rounded-xl shadow-sm transition-all hover:shadow border border-[#cbcbcb]"
                    >
                        Review Inventory
                    </button>
                </div>
            )}

            <div className={`grid grid-cols-1 md:grid-cols-2 ${user?.role === 'admin' ? 'lg:grid-cols-4' : 'lg:grid-cols-1'} gap-6`}>
                {cards.map((card, i) => {
                    const Icon = card.icon;
                    return (
                        <div
                            key={i}
                            className="relative overflow-hidden bg-white border border-[#cbcbcb] p-6 rounded-2xl shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 group"
                        >
                            <div className="flex items-center justify-between mb-5 relative z-10">
                                <span className={`p-3.5 rounded-2xl ${card.bg} ${card.color} border border-white/50 shadow-sm group-hover:scale-110 transition-transform duration-300`}>
                                    <Icon size={24} strokeWidth={1.5} />
                                </span>
                            </div>
                            <h3 className="text-xs font-medium text-[#a6a6a6] uppercase tracking-widest relative z-10">{card.title}</h3>
                            <p className="text-3xl font-semibold text-[#818181] mt-2 tracking-tight relative z-10">{card.value}</p>

                            {/* Decorative background blob */}
                            <div className={`absolute -right-8 -bottom-8 w-40 h-40 rounded-full ${card.blob} blur-3xl pointer-events-none group-hover:scale-125 transition-transform duration-700`}></div>
                        </div>
                    );
                })}
            </div>

            {user?.role === 'admin' && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                    {/* ── Left (wide): Activity Stream ── */}
                    <div className="lg:col-span-2 bg-white border border-[#cbcbcb] rounded-2xl shadow-sm flex flex-col h-[600px] overflow-hidden">
                        <div className="px-6 py-5 border-b border-[#19140005] bg-white sticky top-0 z-10">
                            <h2 className="text-base font-medium text-[#818181] mb-4">Activity Stream</h2>
                            <div className="flex gap-2 p-1 bg-[#f8f6f3] rounded-xl border border-[#19140005]">
                                <button
                                    onClick={() => setActiveTab('activity')}
                                    className={`flex-1 py-2 text-xs font-medium rounded-lg transition-all ${activeTab === 'activity' ? 'bg-white text-[#818181] shadow-sm' : 'text-[#a6a6a6] hover:text-[#818181]'}`}
                                >
                                    Cashiers
                                </button>
                                <button
                                    onClick={() => setActiveTab('stock')}
                                    className={`flex-1 py-2 text-xs font-medium rounded-lg transition-all ${activeTab === 'stock' ? 'bg-white text-[#818181] shadow-sm' : 'text-[#a6a6a6] hover:text-[#818181]'}`}
                                >
                                    Stock Out/In History
                                </button>
                            </div>
                        </div>

                        <div className="flex-1 overflow-auto p-6">
                            {/* Cashier Activity */}
                            {activeTab === 'activity' && (
                                <div className="space-y-3">
                                    {activityLoading && recentActivity.length === 0 ? (
                                        <div className="text-center text-[#a6a6a6] text-sm animate-pulse mt-4">Loading activity...</div>
                                    ) : recentActivity.length === 0 ? (
                                        <div className="text-center text-[#a6a6a6] text-sm mt-4">No recent activity.</div>
                                    ) : (
                                        recentActivity.map((a) => {
                                            const isSale = a.event_type === 'sale_completed';
                                            const branchName = a.metadata?.branch_name;
                                            const items = a.metadata?.items || [];
                                            const total = a.metadata?.total_amount;
                                            const method = a.metadata?.payment_method;
                                            return (
                                                <div
                                                    key={a.id}
                                                    className={`flex items-start gap-4 p-4 rounded-xl border transition-shadow hover:shadow-sm ${isSale ? 'bg-emerald-50/60 border-emerald-100' : 'bg-[#f9f9f9] border-[#ebebeb]'}`}
                                                >
                                                    {/* Status dot */}
                                                    <div className={`mt-1.5 flex-shrink-0 w-2.5 h-2.5 rounded-full ${isSale ? 'bg-emerald-400' : 'bg-[#cbcbcb]'}`} />

                                                    <div className="flex-1 min-w-0">
                                                        {/* Header row: name + badges */}
                                                        <div className="flex flex-wrap items-center gap-2 mb-1">
                                                            <span className="text-sm font-medium text-[#818181]">
                                                                {a.actor?.name || 'Cashier'}
                                                            </span>
                                                            {branchName && (
                                                                <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-[#4a2437]/10 text-[#4a2437]">
                                                                    {branchName}
                                                                </span>
                                                            )}
                                                            {isSale && (
                                                                <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                                                                    Sale
                                                                </span>
                                                            )}
                                                        </div>

                                                        {/* Body: rich sale info OR plain description */}
                                                        {isSale && items.length > 0 ? (
                                                            <>
                                                                <p className="text-xs text-[#818181] font-medium leading-relaxed">
                                                                    Sold: {items.join(' · ')}
                                                                </p>
                                                                <p className="text-xs text-[#a6a6a6] mt-1">
                                                                    Total:{' '}
                                                                    <span className="font-medium text-emerald-600">
                                                                        {PESO}{Number(total || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                                                    </span>
                                                                    {method && <> {BULLET} <span className="capitalize">{method}</span></>}
                                                                </p>
                                                            </>
                                                        ) : a.event_type === 'inventory_item_updated' ? (
                                                            <>
                                                                <p className="text-xs text-[#818181] font-medium leading-relaxed">
                                                                    Updated: {a.metadata?.item_name || 'Item'}
                                                                </p>
                                                                <p className="text-xs text-[#a6a6a6] mt-1">
                                                                    Reason: <span className="font-medium text-[#818181]">{a.metadata?.adjustment_reason || EM_DASH}</span>
                                                                </p>
                                                            </>
                                                        ) : (
                                                            <p className="text-xs text-[#a6a6a6] leading-relaxed">{a.description || a.event_type}</p>
                                                        )}
                                                    </div>

                                                    {/* Timestamp */}
                                                    <div className="text-[10px] font-medium text-[#cbcbcb] whitespace-nowrap flex-shrink-0">
                                                        {a.created_at ? new Date(a.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                                                    </div>
                                                </div>
                                            );
                                        })
                                    )}
                                </div>
                            )}

                            {/* Stock In/Out History */}
                            {activeTab === 'stock' && (
                                <div className="space-y-6 relative before:absolute before:inset-0 before:ml-2 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-[#cbcbcb] before:to-transparent">
                                    {stockHistoryLoading && stockHistoryEvents.length === 0 ? (
                                        <div className="text-center text-[#a6a6a6] text-sm animate-pulse mt-4">Loading updates...</div>
                                    ) : stockHistoryEvents.length === 0 ? (
                                        <div className="text-center text-[#a6a6a6] text-sm mt-4">No recent stock movements.</div>
                                    ) : (
                                        stockHistoryEvents.map((e) => {
                                            const itemName = e?.item?.name || 'Item';
                                            const branchName = e?.branch?.name || '';
                                            const changeQty = Number(e?.change_qty || 0);
                                            const newQty = Number(e?.new_qty || 0);
                                            const isIn = e?.reason === 'receipt' || changeQty > 0;
                                            const actionColor = isIn ? 'bg-emerald-100' : 'bg-red-100';
                                            const directionLabel = isIn ? 'Stock In' : 'Stock Out';
                                            const qtyLabel = isIn ? `+${Math.abs(changeQty)}` : `-${Math.abs(changeQty)}`;
                                            const line = `${directionLabel}: ${qtyLabel} ${ARROW} ${newQty}${branchName ? ` ${BULLET} ${branchName}` : ''}`;

                                            return (
                                                <div key={e.id} className="relative flex items-start justify-between gap-4">
                                                    <div className={`absolute left-0 w-4 h-4 rounded-full ${actionColor} border-2 border-white flex-shrink-0 mt-1 z-10`} />
                                                    <div className="pl-6 flex-1 min-w-0">
                                                        <div className="text-sm font-medium text-[#818181] truncate">{itemName}</div>
                                                        <div className="text-xs text-[#a6a6a6] mt-1">{line}</div>
                                                    </div>
                                                    <div className="text-[10px] font-medium text-[#cbcbcb] whitespace-nowrap">
                                                        {e.created_at ? new Date(e.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                                                    </div>
                                                </div>
                                            );
                                        })
                                    )}
                                </div>
                            )}

                            <div className="mt-6 pt-6 border-t border-zinc-100 flex justify-center">
                                <button
                                    onClick={() => navigate(activeTab === 'activity' ? '/admin/cashiers' : '/admin/stock-management')}
                                    className="text-xs font-medium text-[#818181] hover:text-[#d94a79] flex items-center gap-1 transition-colors"
                                >
                                    View Full History <ChevronRight size={14} />
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* ── Right (narrow): Inventory Access Requests ── */}
                    <div className="lg:col-span-1 bg-white border border-[#cbcbcb] rounded-2xl shadow-sm flex flex-col h-[600px] overflow-hidden relative">
                        <div className="px-6 py-5 border-b border-[#19140005] bg-white/80 backdrop-blur-xl sticky top-0 z-10 flex justify-between items-center">
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 bg-[#4a2437]/5 rounded-xl text-[#4a2437]">
                                    <Package size={20} strokeWidth={1.5} />
                                </div>
                                <div>
                                    <h2 className="text-base font-medium text-[#818181]">Access Requests</h2>
                                    <p className="text-xs text-[#a6a6a6] font-medium mt-0.5">Inventory overrides</p>
                                </div>
                            </div>
                            {inventoryRequests.length > 0 && (
                                <div className="bg-[#d94a79]/10 text-[#d94a79] px-3.5 py-1.5 rounded-full text-xs font-medium border border-[#d94a79]/20 flex items-center gap-1.5">
                                    <span className="w-1.5 h-1.5 rounded-full bg-[#d94a79] animate-pulse"></span>
                                    {inventoryRequests.length}
                                </div>
                            )}
                        </div>

                        {inventoryRequestAlert && (
                            <div className="px-6 py-3 bg-[#d94a79]/5 text-[#d94a79] text-sm font-semibold border-b border-[#d94a79]/10 animate-in slide-in-from-top-2">
                                {inventoryRequestAlert}
                            </div>
                        )}

                        <div className="flex-1 overflow-auto bg-[#dddddd]/30 p-4">
                            {inventoryRequestsLoading && inventoryRequests.length === 0 ? (
                                <div className="h-full flex flex-col items-center justify-center text-[#a6a6a6] opacity-50 space-y-4">
                                    <div className="w-8 h-8 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                                    <span className="text-sm font-medium">Loading...</span>
                                </div>
                            ) : inventoryRequests.length === 0 ? (
                                <div className="h-full flex flex-col items-center justify-center text-[#a6a6a6] opacity-60">
                                    <CheckCircle2 size={48} strokeWidth={1} className="mb-4 text-[#4a2437]/40" />
                                    <p className="text-sm font-medium">No pending requests.</p>
                                    <p className="text-xs mt-1">You're all caught up!</p>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {inventoryRequests.map((r) => {
                                        const cashierName = r?.cashier?.name || 'Cashier';
                                        const cashierEmail = r?.cashier?.email || '';
                                        const approved = Boolean(r?.approved_at);
                                        return (
                                            <div key={r.id} className="bg-white border border-[#19140010] rounded-2xl p-4 hover:shadow-md transition-shadow">
                                                <div className="flex items-center gap-3 mb-3">
                                                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-zinc-100 to-zinc-200 flex items-center justify-center text-[#a6a6a6] font-medium text-sm shadow-inner flex-shrink-0">
                                                        {cashierName.charAt(0).toUpperCase()}
                                                    </div>
                                                    <div className="min-w-0">
                                                        <h4 className="text-sm font-medium text-[#818181] truncate">{cashierName}</h4>
                                                        <p className="text-xs text-[#a6a6a6] truncate">{cashierEmail}</p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2 mb-3 text-[11px] text-[#a6a6a6] font-medium bg-[#dddddd] px-2 py-1 rounded-md">
                                                    <Clock size={12} />
                                                    <span>{r.created_at ? new Date(r.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : EM_DASH}</span>
                                                </div>
                                                {approved ? (
                                                    <div className="flex flex-col items-center">
                                                        <span className="text-[10px] uppercase font-medium text-[#a6a6a6] tracking-wider mb-1">OTP Code</span>
                                                        <span className="font-mono text-lg font-medium text-[#818181] tracking-widest bg-[#dddddd] px-3 py-1 rounded-lg border border-[#cbcbcb]">{r.otp}</span>
                                                    </div>
                                                ) : (
                                                    <button
                                                        type="button"
                                                        onClick={() => approveInventoryRequest(r.id)}
                                                        className="w-full px-4 py-2 text-sm font-medium rounded-xl bg-[#818181] text-white hover:bg-[#333] transition-colors shadow-sm"
                                                    >
                                                        Approve
                                                    </button>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>

                </div>
            )}
        </div>
    );
};

export default Dashboard;
