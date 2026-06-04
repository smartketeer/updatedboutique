import React from 'react';
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import { useAuthStore } from '../store/authStore';
import { lunaBranch } from '../config/lunaBranch';
import { roxasBranch } from '../config/roxasBranch';
import {
    LayoutDashboard,
    ShoppingCart,
    Package,
    BarChart,
    LogOut,
    User,
    Settings,
    Users,
    Menu,
    X,
    Bell,
    ChevronDown,
    ArrowLeftRight,
    Ban,
    Receipt,
} from 'lucide-react';

const LiveClock = () => {
    const [time, setTime] = React.useState(new Date());

    React.useEffect(() => {
        const timer = setInterval(() => setTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    const dateOptions = { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' };
    const timeOptions = { hour: 'numeric', minute: '2-digit', hour12: true };

    return (
        <div className="flex items-center gap-2 text-[13px] font-medium text-[#a6a6a6] bg-white border border-[#cbcbcb] px-3 py-1.5 rounded-xl shadow-sm whitespace-nowrap">
            <span>{time.toLocaleDateString('en-US', dateOptions)}</span>
            <span className="text-zinc-300">|</span>
            <span className="text-[#818181]">{time.toLocaleTimeString('en-US', timeOptions)}</span>
        </div>
    );
};

const Layout = () => {
    const { user, logout, setPosSessionActive } = useAuthStore();
    const navigate = useNavigate();
    const location = useLocation();
    const [isNavOpen, setIsNavOpen] = React.useState(false);
    const [isUserMenuOpen, setIsUserMenuOpen] = React.useState(false);
    const [isNotifOpen, setIsNotifOpen] = React.useState(false);
    const [notifLoading, setNotifLoading] = React.useState(false);
    const [notifError, setNotifError] = React.useState('');
    const [toast, setToast] = React.useState({ open: false, message: '' });
    const toastTimeoutRef = React.useRef(null);
    const lastPathRef = React.useRef(location.pathname);
    const [inventoryRequests, setInventoryRequests] = React.useState([]);
    const [inventoryEvents, setInventoryEvents] = React.useState([]);
    const [notifSeenAt, setNotifSeenAt] = React.useState(() => {
        const raw = sessionStorage.getItem('admin_inventory_notif_seen_at');
        if (!raw) return Date.now();
        const n = Number(raw);
        return Number.isFinite(n) ? n : 0;
    });
    const branchName = useAuthStore((state) => state.branchName);
    const branches = [lunaBranch, roxasBranch];
    const cashierBranding =
        branches.find((b) => b.key === String(branchName || '').toLowerCase()) ||
        branches[0];
    const isAdmin = user?.role === 'admin';
    const branding = isAdmin ? { name: 'Boutique POS' } : cashierBranding;

    const handleLogout = async () => {
        try {
            setPosSessionActive(false);
            await logout();
            navigate('/login');
        } catch (err) {
            console.error('Logout failed', err);
        }
    };

    const fetchInventoryNotifications = React.useCallback(async () => {
        if (!isAdmin) return;
        setNotifLoading(true);
        setNotifError('');
        try {
            const [requestsRes, activityRes] = await Promise.all([
                axios.get('/api/inventory-access/requests?status=open'),
                axios.get('/api/activity-logs?scope=all&limit=25'),
            ]);

            setInventoryRequests(Array.isArray(requestsRes.data) ? requestsRes.data : []);

            const rows = Array.isArray(activityRes.data) ? activityRes.data : [];
            const filtered = rows.filter((a) => {
                const t = a?.event_type;
                return t === 'inventory_access_session_granted' || t === 'inventory_access_session_revoked';
            });
            setInventoryEvents(filtered);
        } catch (err) {
            setNotifError(err.response?.data?.message || 'Failed to load notifications');
            setInventoryRequests([]);
            setInventoryEvents([]);
        } finally {
            setNotifLoading(false);
        }
    }, [isAdmin]);

    React.useEffect(() => {
        if (!isAdmin) return;
        fetchInventoryNotifications();
        const id = window.setInterval(fetchInventoryNotifications, 5000);
        return () => window.clearInterval(id);
    }, [isAdmin, fetchInventoryNotifications]);

    React.useEffect(() => {
        if (!isAdmin) return;
        if (!isNotifOpen) return;
        const ts = Date.now();
        sessionStorage.setItem('admin_inventory_notif_seen_at', String(ts));
        setNotifSeenAt(ts);
    }, [isAdmin, isNotifOpen]);

    const approveRequest = async (requestId) => {
        setNotifError('');
        try {
            const res = await axios.post(`/api/inventory-access/requests/${encodeURIComponent(requestId)}/approve`);
            const approved = res.data;
            setInventoryRequests((prev) =>
                prev.map((r) => (r.id === requestId ? { ...r, ...approved } : r))
            );
        } catch (err) {
            setNotifError(err.response?.data?.message || 'Approval failed');
        }
    };

    const pendingRequestCount = React.useMemo(
        () => inventoryRequests.filter((r) => !r?.approved_at).length,
        [inventoryRequests]
    );
    const unseenEventCount = React.useMemo(() => {
        if (!notifSeenAt) return inventoryEvents.length;
        return inventoryEvents.filter((e) => {
            const ts = e?.created_at ? new Date(e.created_at).getTime() : 0;
            return ts > notifSeenAt;
        }).length;
    }, [inventoryEvents, notifSeenAt]);
    const openCount = React.useMemo(() => pendingRequestCount + unseenEventCount, [pendingRequestCount, unseenEventCount]);

    const base = user?.role === 'admin' ? '/admin' : '/cashier';

    const navItems =
        user?.role === 'admin'
            ? [
                  { icon: LayoutDashboard, label: 'Dashboard', path: `${base}` },
                  { icon: Package, label: 'Inventory', path: `${base}/inventory` },
                  { icon: ArrowLeftRight, label: 'Stock Management', path: `${base}/stock-management` },
                  { icon: BarChart, label: 'Reports', path: `${base}/reports` },
                  { icon: Receipt, label: 'Sales', path: `${base}/sales` },
                  { icon: Ban, label: 'Void/Transfer/Pull Out', path: `${base}/voids` },
                  { icon: Users, label: 'Cashiers', path: `${base}/cashiers` },
                  { icon: Settings, label: 'Settings', path: `${base}/settings` },
              ]
            : [
                  { icon: ShoppingCart, label: 'POS', path: `${base}/pos` },
                  { icon: BarChart, label: 'History', path: `${base}/history` },
              ];

    if (user?.role === 'staff') {
        const isActive = (path) => location.pathname === path;
        const inventoryAccessPath = '/cashier/inventory-management';

        const showToast = (message) => {
            if (toastTimeoutRef.current) window.clearTimeout(toastTimeoutRef.current);
            setToast({ open: true, message });
            toastTimeoutRef.current = window.setTimeout(() => {
                setToast({ open: false, message: '' });
            }, 2500);
        };

        const blockIfInventoryAccessActive = (e, targetPath) => {
            const token = sessionStorage.getItem('inventory_access_token') || '';
            if (location.pathname === inventoryAccessPath && token && targetPath !== inventoryAccessPath) {
                if (e?.preventDefault) e.preventDefault();
                showToast('Please click "End Access" first before going to POS or History.');
                return true;
            }
            return false;
        };

        React.useEffect(() => {
            const token = sessionStorage.getItem('inventory_access_token') || '';
            const prev = lastPathRef.current;
            const next = location.pathname;
            if (prev === inventoryAccessPath && token && next !== inventoryAccessPath) {
                showToast('Please click "End Access" first before going to POS or History.');
                navigate(inventoryAccessPath, { replace: true });
                lastPathRef.current = inventoryAccessPath;
                return;
            }
            lastPathRef.current = next;
        }, [location.pathname, navigate]);

        return (
            <div className="min-h-screen bg-[#dddddd] text-[#818181] font-sans selection:bg-[#18181b] selection:text-white print:bg-transparent print:min-h-0">
                <header className="sticky top-0 z-40 bg-white border-b border-[#cbcbcb] shadow-sm print:hidden">
                    <div className="max-w-[1600px] mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-6">
                        {/* Brand */}
                        <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-2xl bg-white border border-[#cbcbcb] shadow-sm flex items-center justify-center overflow-hidden">
                                <img src={cashierBranding.logoSrc} alt="Logo" className="w-8 h-8 object-contain" />
                            </div>
                            <div className="hidden sm:block">
                                <div className="text-[15px] font-medium text-[#818181] tracking-tight">{cashierBranding.name}</div>
                                <div className="text-[11px] font-medium text-[#a6a6a6] uppercase tracking-wider">Point of Sale</div>
                            </div>
                        </div>

                        {/* Centered Navigation */}
                        <nav className="flex items-center gap-1 bg-[#dddddd]/50 p-1 rounded-full border border-[#cbcbcb]/50">
                            {navItems.map(item => (
                                <Link
                                    key={item.path}
                                    to={item.path}
                                    onClick={(e) => blockIfInventoryAccessActive(e, item.path)}
                                    className={`px-5 py-2 inline-flex items-center gap-2 rounded-full text-sm font-semibold transition-all duration-300 ${
                                        isActive(item.path)
                                            ? 'bg-white text-[#818181] shadow-sm ring-1 ring-[#cbcbcb]'
                                            : 'text-[#a6a6a6] hover:text-[#818181] hover:bg-[#dddddd]'
                                    }`}
                                >
                                    <item.icon size={16} strokeWidth={isActive(item.path) ? 2.5 : 2} />
                                    <span className="hidden md:inline">{item.label}</span>
                                </Link>
                            ))}
                        </nav>

                        {/* User Actions */}
                        <div className="flex items-center gap-3">
                            <div className="hidden xl:block">
                                <LiveClock />
                            </div>
                            <div className="relative">
                                <button
                                    type="button"
                                    onClick={() => setIsUserMenuOpen((v) => !v)}
                                    className="flex items-center gap-3 pl-2 pr-3 py-1.5 rounded-full bg-white border border-[#cbcbcb] hover:bg-[#dddddd] transition-colors shadow-sm focus:outline-none focus:ring-2 focus:ring-[#cbcbcb]"
                                >
                                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#818181] to-[#a6a6a6] text-white flex items-center justify-center font-medium text-sm shadow-inner">
                                        {user?.name?.charAt(0).toUpperCase()}
                                    </div>
                                    <div className="hidden lg:block text-left">
                                        <div className="text-[13px] font-medium text-[#818181] leading-none">{user?.name}</div>
                                        <div className="text-[10px] font-medium text-[#a6a6a6] mt-0.5">Cashier</div>
                                    </div>
                                    <ChevronDown size={14} className="text-[#cbcbcb] hidden lg:block" />
                                </button>
                                
                                {isUserMenuOpen && (
                                    <>
                                        <div className="fixed inset-0 z-40" onClick={() => setIsUserMenuOpen(false)} />
                                        <div className="absolute right-0 mt-2 w-56 rounded-2xl border border-[#cbcbcb] bg-white shadow-xl overflow-hidden z-50 animate-in fade-in slide-in-from-top-2">
                                            <div className="p-2">
                                                <button
                                                    onClick={() => {
                                                        setIsUserMenuOpen(false);
                                                        navigate('/cashier/inventory-management');
                                                    }}
                                                    className="w-full text-left px-3 py-2.5 rounded-xl text-sm font-semibold text-[#818181] hover:bg-[#dddddd] flex items-center gap-3 transition-colors"
                                                >
                                                    <Package size={16} className="text-[#a6a6a6]" />
                                                    Inventory Access
                                                </button>
                                                <div className="h-px bg-[#dddddd] my-1"></div>
                                                <button
                                                    onClick={handleLogout}
                                                    className="w-full text-left px-3 py-2.5 rounded-xl text-sm font-semibold text-[#818181] hover:bg-[#dddddd] flex items-center gap-3 transition-colors"
                                                >
                                                    <LogOut size={16} />
                                                    Sign out
                                                </button>
                                            </div>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                </header>

                <main className="max-w-[1600px] mx-auto px-4 sm:px-6 py-6 sm:py-8 print:hidden">
                    <Outlet />
                </main>

                <div
                    className={`fixed top-20 right-4 z-[100] transition-all duration-200 print:hidden ${
                        toast.open ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2 pointer-events-none'
                    }`}
                    role="status"
                    aria-live="polite"
                >
                    <div className="max-w-sm rounded-2xl border border-[#cbcbcb] bg-white shadow-xl px-4 py-3 text-sm font-semibold text-[#818181]">
                        {toast.message}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#dddddd] text-[#818181] font-sans selection:bg-[#18181b] selection:text-white flex">
            {/* Desktop Sidebar */}
            <aside className="hidden lg:flex w-[280px] bg-white border-r border-[#cbcbcb] flex-col shadow-sm h-screen sticky top-0 z-30">
                <div className="h-20 px-6 flex items-center gap-4 border-b border-zinc-100">
                    <div className="w-10 h-10 rounded-2xl bg-[#818181] text-white flex items-center justify-center shadow-md">
                        <LayoutDashboard size={20} />
                    </div>
                    <div>
                        <div className="text-base font-medium text-[#818181] tracking-tight">{branding.name}</div>
                        <div className="text-[11px] text-[#a6a6a6] font-semibold uppercase tracking-widest mt-0.5">Workspace</div>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-6">
                    <div>
                        <div className="px-3 mb-2 text-[10px] font-medium text-[#cbcbcb] uppercase tracking-wider">Main Navigation</div>
                        <nav className="space-y-1">
                            {navItems.map((item) => {
                                const active = location.pathname === item.path;
                                return (
                                    <Link
                                        key={item.path}
                                        to={item.path}
                                        className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 relative group ${
                                            active
                                                ? 'bg-[#dddddd] text-[#818181]'
                                                : 'text-[#a6a6a6] hover:bg-[#dddddd] hover:text-[#818181]'
                                        }`}
                                    >
                                        {active && (
                                            <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 bg-[#818181] rounded-r-full" />
                                        )}
                                        <item.icon size={18} strokeWidth={active ? 2.5 : 2} className={active ? 'text-[#818181]' : 'group-hover:text-[#818181]'} />
                                        {item.label}
                                    </Link>
                                );
                            })}
                        </nav>
                    </div>
                </div>

                <div className="p-4 border-t border-zinc-100 bg-[#dddddd]/50">
                    <div className="flex items-center gap-3 px-3 py-2 bg-white rounded-2xl border border-[#cbcbcb] shadow-sm mb-3">
                        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#818181] to-[#a6a6a6] text-white flex items-center justify-center font-medium text-sm shadow-inner">
                            {user?.name?.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-[13px] font-medium text-[#818181] truncate">{user?.name}</p>
                            <p className="text-[10px] font-medium text-[#a6a6a6] uppercase tracking-wide truncate">{user?.role}</p>
                        </div>
                    </div>
                    <button
                        onClick={handleLogout}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold text-[#a6a6a6] hover:bg-[#dddddd] hover:text-[#818181] rounded-xl transition-all"
                    >
                        <LogOut size={16} />
                        Sign Out
                    </button>
                </div>
            </aside>

            {/* Mobile Header */}
            <header className="lg:hidden fixed top-0 left-0 right-0 z-30 bg-white border-b border-[#cbcbcb] h-16 flex items-center justify-between px-4">
                <button
                    type="button"
                    onClick={() => setIsNavOpen(true)}
                    aria-label="Open menu"
                    className="w-10 h-10 rounded-xl border border-[#cbcbcb] flex items-center justify-center bg-white hover:bg-[#dddddd]"
                >
                    <Menu size={18} />
                </button>
                <div className="font-medium text-[15px] tracking-tight">{branding.name}</div>
                {isAdmin ? (
                    <button
                        onClick={() => setIsNotifOpen((v) => !v)}
                        className="relative w-10 h-10 rounded-xl border border-[#cbcbcb] bg-white flex items-center justify-center hover:bg-[#dddddd]"
                    >
                        <Bell size={18} className="text-[#a6a6a6]" />
                        {openCount > 0 && (
                            <span className="absolute top-2 right-2.5 w-2 h-2 rounded-full bg-red-500 ring-2 ring-white"></span>
                        )}
                    </button>
                ) : (
                    <div className="w-10" /> // Spacer
                )}
            </header>

            {/* Main Content Area */}
            <div className="flex-1 flex flex-col min-h-screen pt-16 lg:pt-0">
                {/* Desktop Topbar */}
                <header className="hidden lg:flex h-20 items-center justify-between px-8 bg-white/95 backdrop-blur-md border-b border-[#cbcbcb] shadow-sm sticky top-0 z-20">
                    <LiveClock />
                    
                    {isAdmin && (
                        <div className="flex items-center gap-4">
                            <button
                                onClick={() => setIsNotifOpen((v) => !v)}
                                className="relative p-2.5 rounded-full hover:bg-[#dddddd] transition-colors"
                            >
                                <Bell size={20} className="text-[#a6a6a6]" />
                                {openCount > 0 && (
                                    <span className="absolute top-2 right-2.5 w-2 h-2 rounded-full bg-red-500 ring-2 ring-white"></span>
                                )}
                            </button>
                        </div>
                    )}
                </header>

                <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-x-hidden">
                    <Outlet />
                </main>
            </div>

            {/* Notifications Modal */}
            {isAdmin && isNotifOpen && (
                <div className="fixed inset-0 z-50 flex justify-end">
                    <div className="absolute inset-0 bg-[#818181]/20 backdrop-blur-sm" onClick={() => setIsNotifOpen(false)} />
                    <div className="relative w-full max-w-sm h-full bg-white shadow-2xl flex flex-col animate-in slide-in-from-right-full duration-300">
                        <div className="px-6 py-5 border-b border-zinc-100 flex items-center justify-between bg-white z-10">
                            <h3 className="text-lg font-medium text-[#818181]">Notifications</h3>
                            <button
                                onClick={() => setIsNotifOpen(false)}
                                className="p-2 hover:bg-[#dddddd] rounded-full transition-colors"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-2">
                            {notifError && (
                                <div className="m-4 p-3 bg-[#dddddd] text-[#818181] text-sm font-medium rounded-xl">{notifError}</div>
                            )}

                            <div className="px-4 py-2 mt-2 mb-1 text-[11px] font-medium text-[#cbcbcb] uppercase tracking-wider">
                                Inventory Requests
                            </div>
                            
                            {notifLoading && inventoryRequests.length === 0 ? (
                                <div className="p-4 text-center text-sm text-[#a6a6a6]">Loading...</div>
                            ) : inventoryRequests.length === 0 ? (
                                <div className="p-4 text-center text-sm text-[#a6a6a6] bg-[#dddddd] rounded-xl mx-4">No pending requests</div>
                            ) : (
                                <div className="space-y-2 px-2">
                                    {inventoryRequests.map(r => {
                                        const approved = Boolean(r?.approved_at);
                                        return (
                                            <div key={r.id} className="p-4 bg-white border border-zinc-100 rounded-2xl shadow-sm">
                                                <div className="font-medium text-sm text-[#818181]">{r?.cashier?.name || 'Cashier'}</div>
                                                <div className="text-xs text-[#a6a6a6] mt-1">{r.created_at ? `${new Date(r.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}, ${new Date(r.created_at).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}` : ''}</div>
                                                <div className="mt-3 pt-3 border-t border-zinc-50 flex items-center justify-between">
                                                    {approved ? (
                                                        <span className="font-mono font-medium text-[#818181] bg-[#dddddd] px-2 py-1 rounded">{r.otp}</span>
                                                    ) : (
                                                        <button
                                                            onClick={() => approveRequest(r.id)}
                                                            className="px-4 py-1.5 bg-[#818181] text-white text-xs font-medium rounded-lg hover:bg-[#a6a6a6] transition-colors"
                                                        >
                                                            Approve
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}

                            <div className="px-4 py-2 mt-6 mb-1 text-[11px] font-medium text-[#cbcbcb] uppercase tracking-wider">
                                Recent Events
                            </div>

                            {inventoryEvents.length === 0 && !notifLoading ? (
                                <div className="p-4 text-center text-sm text-[#a6a6a6] bg-[#dddddd] rounded-xl mx-4">No recent events</div>
                            ) : (
                                <div className="px-4 pb-8">
                                    {inventoryEvents.map(e => (
                                        <div key={e.id} className="py-3 border-b border-zinc-100 last:border-0">
                                            <div className="text-sm font-semibold text-[#818181]">{e?.actor?.name || 'User'}</div>
                                            <div className="text-xs text-[#a6a6a6] mt-0.5">
                                                {e?.event_type === 'inventory_access_session_granted' ? 'Access granted' : 'Access ended'}
                                                <span className="mx-2">{'\u2022'}</span>
                                                {e.created_at ? `${new Date(e.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}, ${new Date(e.created_at).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}` : ''}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Mobile Nav Overlay */}
            {isNavOpen && (
                <div className="lg:hidden fixed inset-0 z-50">
                    <div className="absolute inset-0 bg-[#818181]/40 backdrop-blur-sm" onClick={() => setIsNavOpen(false)} />
                    <div className="absolute left-0 top-0 bottom-0 w-72 bg-white shadow-2xl flex flex-col animate-in slide-in-from-left-full">
                        <div className="h-16 px-6 flex items-center justify-between border-b border-zinc-100">
                            <div className="font-medium text-base tracking-tight">{branding.name}</div>
                            <button type="button" aria-label="Close menu" onClick={() => setIsNavOpen(false)} className="p-2 -mr-2 text-[#a6a6a6] hover:text-[#818181]">
                                <X size={20} />
                            </button>
                        </div>
                        
                        <nav className="flex-1 overflow-y-auto p-4 space-y-2">
                            {navItems.map(item => {
                                const active = location.pathname === item.path;
                                return (
                                    <Link
                                        key={item.path}
                                        to={item.path}
                                        onClick={() => setIsNavOpen(false)}
                                        className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-colors ${
                                            active ? 'bg-[#dddddd] text-[#818181]' : 'text-[#a6a6a6] hover:bg-[#dddddd]'
                                        }`}
                                    >
                                        <item.icon size={18} strokeWidth={active ? 2.5 : 2} />
                                        {item.label}
                                    </Link>
                                );
                            })}
                        </nav>
                        
                        <div className="p-4 border-t border-zinc-100">
                            <button
                                onClick={handleLogout}
                                className="w-full flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium text-white bg-[#818181] rounded-xl hover:bg-[#a6a6a6]"
                            >
                                <LogOut size={16} />
                                Sign Out
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Layout;
