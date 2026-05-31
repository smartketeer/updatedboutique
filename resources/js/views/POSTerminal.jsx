import React, { useState, useEffect, useRef, Fragment } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import {
    Search,
    ShoppingCart,
    Trash2,
    Plus,
    Minus,
    CreditCard,
    Receipt,
    X,
    User,
    Tag,
    Package,
    SlidersHorizontal,
    AlertOctagon,
} from 'lucide-react';
import { Dialog, Transition } from '@headlessui/react';
import { useCartStore } from '../store/cartStore';
import { useAuthStore } from '../store/authStore';
import { lunaBranch } from '../config/lunaBranch';
import { roxasBranch } from '../config/roxasBranch';

const PESO = '\u20B1';
const ELLIPSIS = '\u2026';
const BULLET = '\u2022';
const ARROW = '\u2192';

const CartPanel = ({
    onClose,
    scrollTestId = 'cart-scroll',
    cartItems,
    standardCartItems,
    getLineStockStatus,
    customerType,
    setCustomerType,
    discount,
    setDiscount,
    total,
    finalTotal,
    paymentMethod,
    setPaymentMethod,
    handleCheckout,
    hasInsufficientStock,
    removeItem,
    updateQuantity,
    handleIncreaseQty,
    clearCart,
    clearOverrideAuth,
    formatAmount,
}) => {
    const listRef = useRef(null);
    const canCheckout = cartItems.length > 0;
    const stockIssues = standardCartItems
        .map((i) => ({ id: i.id, ...getLineStockStatus(i) }))
        .filter((s) => s.insufficient);
    const issueCount = stockIssues.length;

    return (
        <div className="rounded-3xl border border-[#cbcbcb] bg-white overflow-hidden shadow-xl flex flex-col h-[calc(100vh-96px)]">
            <div className="px-4 py-3 border-b border-zinc-100 flex items-center justify-between bg-white z-10 shrink-0">
                <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-full bg-[#dddddd] text-[#818181] flex items-center justify-center">
                        <ShoppingCart size={16} />
                    </div>
                    <div className="text-[15px] font-medium text-[#818181] tracking-tight">Current Order</div>
                    <span className="ml-1 inline-flex items-center justify-center px-2 py-0.5 rounded-full bg-[#818181] text-white text-[11px] font-medium shadow-sm">
                        {cartItems.length}
                    </span>
                </div>
                <div className="flex items-center gap-2">
                    {onClose ? (
                        <button
                            type="button"
                            onClick={onClose}
                            className="w-9 h-9 rounded-full hover:bg-[#dddddd] flex items-center justify-center transition-colors text-[#a6a6a6]"
                            aria-label="Close cart"
                        >
                            <X size={18} />
                        </button>
                    ) : null}
                </div>
            </div>

            <div className="px-4 py-2 border-b border-zinc-100 bg-[#dddddd]/50 shrink-0">
                <div className="relative">
                    <User className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#cbcbcb]" size={16} />
                    <select
                        value={customerType}
                        onChange={(e) => setCustomerType(e.target.value)}
                        aria-label="Customer type"
                        className="w-full h-10 pl-10 pr-4 rounded-xl border border-[#cbcbcb] bg-white text-[13px] font-medium text-[#818181] focus:outline-none focus:ring-2 focus:ring-[#818181]/20 focus:border-[#818181] shadow-sm transition-all appearance-none"
                    >
                        <option value="walk_in">Walk In Customer</option>
                        <option value="online">Online Customer</option>
                    </select>
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-[#cbcbcb]">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                    </div>
                </div>
            </div>

            <div ref={listRef} data-testid={scrollTestId} className="flex-1 overflow-y-auto px-4 py-3 scrollbar-thin scrollbar-thumb-[#cbcbcb]">
                {issueCount > 0 ? (
                    <div className="mb-4 rounded-2xl border border-[#cbcbcb] bg-[#dddddd] p-4 shadow-sm">
                        <div className="flex items-start gap-3">
                            <AlertOctagon size={18} className="text-[#818181] mt-0.5" />
                            <div className="min-w-0">
                                <div className="text-[13px] font-medium text-[#818181]">Insufficient Stock</div>
                                <div className="mt-1 text-[12px] font-medium text-[#818181]">
                                    {issueCount} item{issueCount > 1 ? 's' : ''} exceed available stock. Adjust quantity or remove to continue.
                                </div>
                            </div>
                        </div>
                    </div>
                ) : null}

                {cartItems.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-[#cbcbcb] py-10">
                        <div className="w-16 h-16 mb-4 rounded-full bg-[#dddddd] flex items-center justify-center">
                            <ShoppingCart size={24} className="text-zinc-300" />
                        </div>
                        <div className="text-[14px] font-medium text-[#818181]">Your cart is empty</div>
                        <div className="text-[12px] mt-1 text-[#a6a6a6] text-center px-4">Scan a barcode or select items from the grid to add them.</div>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {cartItems.map((item) => {
                            const status = getLineStockStatus(item);
                            const borderCls = status.insufficient ? 'border-[#cbcbcb] bg-[#dddddd]' : 'border-zinc-100 bg-white hover:border-[#a6a6a6]';
                            return (
                                <div
                                    key={item.id}
                                    data-cart-item-id={String(item.id)}
                                    className={`rounded-2xl border shadow-sm p-3 transition-all ${borderCls}`}
                                >
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0 flex-1">
                                            <div className="text-[14px] font-medium text-[#818181] truncate">{item.name}</div>
                                            <div className="mt-1 flex flex-wrap items-center gap-2 text-[12px] font-medium text-[#a6a6a6]">
                                                <span className="font-semibold">{PESO}{formatAmount(item.price)}</span>
                                                {item.is_custom ? (
                                                    <span className="px-2 py-0.5 rounded-md bg-[#dddddd] text-indigo-700 text-[10px] font-medium uppercase tracking-wider">
                                                        Custom
                                                    </span>
                                                ) : null}
                                                {item.is_custom ? null : item.is_service ? (
                                                    <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 text-[10px] font-medium uppercase tracking-wider">
                                                        Service
                                                    </span>
                                                ) : null}
                                            </div>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => removeItem(item.id)}
                                            className="w-8 h-8 rounded-full flex items-center justify-center text-[#cbcbcb] hover:text-red-500 hover:bg-[#dddddd] transition-colors"
                                            aria-label="Remove item"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>

                                    <div className="mt-3 flex items-center justify-between gap-3">
                                        <div className="inline-flex items-center rounded-xl border border-[#cbcbcb] bg-white shadow-sm p-1">
                                            <button
                                                type="button"
                                                onClick={() => updateQuantity(item.id, item.quantity - 1)}
                                                aria-label="Decrease quantity"
                                                className="w-7 h-7 rounded-lg flex items-center justify-center text-[#818181] hover:bg-[#dddddd] transition-colors"
                                            >
                                                <Minus size={14} strokeWidth={2.5} />
                                            </button>
                                            <div className="w-10 text-center text-[13px] font-medium text-[#818181]">{item.quantity}</div>
                                            <button
                                                type="button"
                                                onClick={() => handleIncreaseQty(item)}
                                                aria-label="Increase quantity"
                                                className="w-7 h-7 rounded-lg flex items-center justify-center text-[#818181] hover:bg-[#dddddd] transition-colors"
                                            >
                                                <Plus size={14} strokeWidth={2.5} />
                                            </button>
                                        </div>
                                        <div className="text-[15px] font-semibold text-[#818181] tracking-tight">
                                            {PESO}{Number(item.price * item.quantity).toLocaleString()}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            <div className="px-4 py-3 border-t border-[#cbcbcb] bg-white shrink-0 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.02)]">
                <div className="space-y-1 mb-3">
                    <div className="flex justify-between text-[13px] font-semibold text-[#a6a6a6]">
                        <span>Subtotal</span>
                        <span className="text-[#818181]">{PESO}{total.toLocaleString()}</span>
                    </div>
                    <div className="flex items-center justify-between gap-4 py-1">
                        <div className="flex items-center gap-2 text-[13px] font-medium text-[#a6a6a6]">
                            <div className="w-6 h-6 rounded-md bg-[#dddddd] flex items-center justify-center">
                                <Tag size={12} className="text-[#a6a6a6]" />
                            </div>
                            <span>Discount</span>
                        </div>
                        <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#cbcbcb] font-medium text-sm">{PESO}</span>
                            <input
                                type="number"
                                value={discount}
                                onChange={(e) => setDiscount(Math.max(0, parseFloat(e.target.value) || 0))}
                                className="w-28 h-8 pl-7 pr-3 rounded-xl border border-[#cbcbcb] bg-[#dddddd] text-[13px] font-medium text-right text-[#818181] focus:outline-none focus:bg-white focus:ring-2 focus:ring-[#818181]/20 focus:border-[#818181] transition-all"
                            />
                        </div>
                    </div>
                    <div className="flex justify-between items-end pt-2 border-t border-dashed border-[#cbcbcb] mt-2">
                        <span className="text-[13px] font-medium text-[#a6a6a6] uppercase tracking-wider">Total</span>
                        <span className="text-[24px] font-semibold text-[#818181] tracking-tight leading-none">{PESO}{finalTotal.toLocaleString()}</span>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-2 mb-3">
                    {[
                        { key: 'cash', label: 'Cash', icon: Receipt },
                        { key: 'gcash', label: 'GCash', icon: CreditCard },
                    ].map((m) => {
                        const Icon = m.icon;
                        const active = paymentMethod === m.key;
                        const isCash = m.key === 'cash';
                        const isGcash = m.key === 'gcash';
                        return (
                            <button
                                key={m.key}
                                type="button"
                                onClick={() => setPaymentMethod(m.key)}
                                className={`group h-10 rounded-xl text-[12px] font-medium inline-flex items-center justify-center gap-2 transition-all border-2 ${
                                    active
                                        ? isCash
                                            ? 'bg-white border-green-600 text-green-600 shadow-sm'
                                            : 'bg-white border-blue-600 text-blue-600 shadow-sm'
                                        : isCash
                                            ? 'bg-white border-zinc-100 text-[#a6a6a6] hover:border-green-300 hover:text-green-600 hover:bg-green-50/50'
                                            : 'bg-white border-zinc-100 text-[#a6a6a6] hover:border-blue-300 hover:text-blue-600 hover:bg-blue-50/50'
                                }`}
                            >
                                <Icon size={14} className={active ? (isCash ? 'text-green-600' : 'text-blue-600') : (isCash ? 'text-[#cbcbcb] group-hover:text-green-500' : 'text-[#cbcbcb] group-hover:text-blue-500')} />
                                {m.label}
                            </button>
                        );
                    })}
                </div>

                <div className="grid grid-cols-[1fr_2fr] gap-2">
                    <button
                        type="button"
                        onClick={() => {
                            clearCart();
                            setCustomerType('walk_in');
                            setDiscount(0);
                            clearOverrideAuth();
                        }}
                        disabled={!canCheckout}
                        className="h-11 rounded-xl border border-[#cbcbcb] bg-white text-[13px] font-medium text-[#818181] hover:bg-[#dddddd] hover:border-red-100 transition-colors disabled:opacity-50 disabled:hover:bg-white disabled:hover:border-[#cbcbcb]"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={() => handleCheckout(paymentMethod)}
                        disabled={!canCheckout || hasInsufficientStock}
                        className="h-11 rounded-xl bg-white border-2 border-green-600 text-green-600 text-[13px] font-semibold hover:bg-green-50 transition-all disabled:opacity-50 disabled:hover:bg-white shadow-sm hover:shadow hover:-translate-y-0.5 active:translate-y-0"
                    >
                        Complete Order
                    </button>
                </div>
            </div>
        </div>
    );
};

const POSTerminal = () => {
    const navigate = useNavigate();
    const [items, setItems] = useState([]);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalItems, setTotalItems] = useState(0);
    const [search, setSearch] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [category, setCategory] = useState('all');
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(true);
    const [itemsLoading, setItemsLoading] = useState(true);
    const [itemsError, setItemsError] = useState('');
    const [posSettings, setPosSettings] = useState({
        dailySalesEnabled: true,
        priceAdjustmentsEnabled: true,
        customItemsEnabled: true,
    });
    const [dailySalesModalOpen, setDailySalesModalOpen] = useState(false);
    
    const [customerType, setCustomerType] = useState('walk_in');
    const [discount, setDiscount] = useState(0);
    const [isQRModalOpen, setIsQRModalOpen] = useState(false);
    const [qrCodeUrl, setQrCodeUrl] = useState('');
    const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
    const [lastSale, setLastSale] = useState(null);
    const [skuSearch, setSkuSearch] = useState('');
    const [isCartOpen, setIsCartOpen] = useState(false);
    const [isFilterOpen, setIsFilterOpen] = useState(false);
    const [paymentMethod, setPaymentMethod] = useState('cash');
    const [stockNotice, setStockNotice] = useState('');
    const [mockupOverlayUrl, setMockupOverlayUrl] = useState('');
    const [mockupOpacity, setMockupOpacity] = useState(0.55);
    const [stockById, setStockById] = useState({});
    const itemsRequestSeqRef = useRef(0);

    useEffect(() => {
        const id = window.setTimeout(() => setDebouncedSearch(search), 250);
        return () => window.clearTimeout(id);
    }, [search]);
    
    const { user } = useAuthStore();
    const branchName = useAuthStore((state) => state.branchName);
    const branches = [lunaBranch, roxasBranch];
    const branding =
        branches.find((b) => b.key === String(branchName || '').toLowerCase()) ||
        branches[0];
    const {
        items: cartItems,
        addItem,
        removeItem,
        updateQuantity,
        clearCart,
        getTotal,
        overrideApproval,
        checkoutPin,
        clearOverrideAuth,
    } = useCartStore();

    const compareMode = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('compare') === '1';

    const stableStringify = (value) => {
        const normalize = (v) => {
            if (Array.isArray(v)) {
                const mapped = v.map(normalize);
                return mapped.sort((a, b) => stableStringify(a).localeCompare(stableStringify(b)));
            }
            if (v && typeof v === 'object') {
                const keys = Object.keys(v).sort();
                const out = {};
                for (const k of keys) out[k] = normalize(v[k]);
                return out;
            }
            return v;
        };
        return JSON.stringify(normalize(value));
    };

    const standardCartItems = cartItems.filter((i) => !i.is_custom);
    const customCartItems = cartItems.filter((i) => i.is_custom);
    const priceOverrides = standardCartItems
        .map((i) => ({
            item_id: i.id,
            quantity: i.quantity,
            unit_price: Number(i.price || 0),
            original_price: i.original_price == null ? Number(i.price || 0) : Number(i.original_price || 0),
            reason: i.price_override_reason || null,
        }))
        .filter((i) => Math.abs(i.unit_price - i.original_price) > 0.0001);

    const overridesPayload = {
        price_overrides: priceOverrides.map((i) => ({
            item_id: i.item_id,
            quantity: i.quantity,
            unit_price: Number(i.unit_price.toFixed(2)),
            reason: i.reason,
        })),
        custom_items: customCartItems.map((i) => ({
            name: i.name,
            quantity: i.quantity,
            unit_price: Number(Number(i.price || 0).toFixed(2)),
            reason: i.custom_reason || null,
        })),
    };

    const overridesPayloadKey = stableStringify(overridesPayload);
    const requiresOverride = overridesPayload.price_overrides.length > 0 || overridesPayload.custom_items.length > 0;
    const hasMissingOverrideReasons =
        overridesPayload.price_overrides.some((p) => !String(p.reason || '').trim()) ||
        overridesPayload.custom_items.some((c) => !String(c.reason || '').trim());
    const overridesDisabled =
        (!posSettings.priceAdjustmentsEnabled && priceOverrides.length > 0) ||
        (!posSettings.customItemsEnabled && customCartItems.length > 0);
    const isApprovalValid =
        !!overrideApproval &&
        overrideApproval.payloadKey === overridesPayloadKey &&
        new Date(overrideApproval.expiresAt).getTime() > Date.now();

    useEffect(() => {
        if (!overrideApproval) return;
        const expires = new Date(overrideApproval.expiresAt).getTime();
        if (overrideApproval.payloadKey !== overridesPayloadKey || expires <= Date.now()) {
            clearOverrideAuth();
        }
    }, [clearOverrideAuth, overrideApproval, overridesPayloadKey]);

    const ITEMS_PER_PAGE = 10;
    const cartIdsRef = useRef([]);

    useEffect(() => {
        cartIdsRef.current = standardCartItems.map((i) => i.id).filter((id) => id != null);
    }, [standardCartItems]);

    const handleSkuScan = async (e) => {
        e.preventDefault();
        const sku = String(skuSearch || '').trim();
        if (!sku) return;
        try {
            const res = await axios.get('/api/inventory/lookup', { params: { sku } });
            if (res?.data) {
                handleAddToCart(res.data);
                setSkuSearch('');
                setSearch('');
                return;
            }
            if (/^[a-zA-Z0-9_-]{5,}$/.test(sku)) {
                setStockNotice('Barcode not found: ' + sku);
            }
        } catch {
            if (/^[a-zA-Z0-9_-]{5,}$/.test(sku)) {
                setStockNotice('Barcode not found: ' + sku);
            }
        }
    };

    const loadItemsPage = React.useCallback(
        async (targetPage, opts = {}) => {
            const requestSeq = ++itemsRequestSeqRef.current;
            const nextPage = Math.max(1, Number(targetPage || 1));
            if (!opts.silent) {
                setItemsLoading(true);
            }
            setItemsError('');
            try {
                const params = { page: nextPage, per_page: ITEMS_PER_PAGE };
                const q = String(debouncedSearch || '').trim();
                if (q) params.q = q;
                if (category !== 'all') params.category_id = category;

                const res = await axios.get('/api/inventory', { params });
                const rows = Array.isArray(res.data?.data) ? res.data.data : Array.isArray(res.data) ? res.data : [];
                if (requestSeq !== itemsRequestSeqRef.current) return;

                setItems(rows);
                setPage(Number(res.data?.current_page || nextPage) || nextPage);
                setTotalPages(Number(res.data?.last_page || 1) || 1);
                setTotalItems(Number(res.data?.total || rows.length) || rows.length);
                setStockById((prev) => {
                    const patch = {};
                    for (const r of rows) {
                        if (r?.id == null) continue;
                        patch[r.id] = Number.isFinite(Number(r.stock_qty)) ? Number(r.stock_qty) : 0;
                    }
                    return { ...prev, ...patch };
                });
            } catch (err) {
                if (requestSeq !== itemsRequestSeqRef.current) return;
                setItemsError(err.response?.data?.message || 'Failed to load products.');
                setItems([]);
                setTotalPages(1);
                setTotalItems(0);
            } finally {
                if (requestSeq !== itemsRequestSeqRef.current) return;
                if (!opts.silent) {
                    setItemsLoading(false);
                }
            }
        },
        [ITEMS_PER_PAGE, category, debouncedSearch],
    );

    const refreshStocksForIds = React.useCallback(async (ids) => {
        const list = Array.from(new Set((ids || []).map((n) => Number(n)).filter((n) => Number.isFinite(n) && n > 0)));
        if (list.length === 0) return;
        try {
            const res = await axios.get('/api/inventory/by-ids', { params: { ids: list.join(',') } });
            const rows = Array.isArray(res.data) ? res.data : [];
            setStockById((prev) => {
                const patch = {};
                for (const r of rows) {
                    if (r?.id == null) continue;
                    patch[r.id] = Number.isFinite(Number(r.stock_qty)) ? Number(r.stock_qty) : 0;
                }
                return { ...prev, ...patch };
            });
        } catch {
        }
    }, []);

    useEffect(() => {
        let alive = true;
        const fetchData = async () => {
            try {
                const [catRes, settingsRes] = await Promise.all([axios.get('/api/categories'), axios.get('/api/settings')]);
                if (!alive) return;
                setCategories(catRes.data || []);
                setPosSettings({
                    dailySalesEnabled: Boolean(settingsRes.data?.daily_sales_enabled),
                    priceAdjustmentsEnabled: Boolean(settingsRes.data?.pos_price_adjustments_enabled),
                    customItemsEnabled: Boolean(settingsRes.data?.pos_custom_items_enabled),
                });
            } catch (err) {
                console.error('Failed to fetch data', err);
            } finally {
                if (alive) setLoading(false);
            }
        };
        fetchData();
        return () => {
            alive = false;
        };
    }, []);

    // Poll settings every 30s to catch admin changes in real-time
    useEffect(() => {
        if (loading) return;
        let alive = true;
        const refreshSettings = async () => {
            try {
                const res = await axios.get('/api/settings');
                if (!alive) return;
                setPosSettings({
                    dailySalesEnabled: Boolean(res.data?.daily_sales_enabled),
                    priceAdjustmentsEnabled: Boolean(res.data?.pos_price_adjustments_enabled),
                    customItemsEnabled: Boolean(res.data?.pos_custom_items_enabled),
                });
            } catch {}
        };
        const id = window.setInterval(refreshSettings, 30000);
        return () => { alive = false; window.clearInterval(id); };
    }, [loading]);

    useEffect(() => {
        if (loading) return;
        loadItemsPage(page);
    }, [loading, page, loadItemsPage]);

    useEffect(() => {
        if (loading) return;
        let alive = true;
        const tick = async () => {
            try {
                if (!alive) return;
                const ids = [
                    ...cartIdsRef.current,
                    ...items.map((i) => i?.id).filter((id) => id != null),
                ];
                await refreshStocksForIds(ids);
            } catch {
            }
        };
        const id = window.setInterval(tick, 5000);
        const onFocus = () => tick();
        window.addEventListener('focus', onFocus);
        return () => {
            alive = false;
            window.clearInterval(id);
            window.removeEventListener('focus', onFocus);
        };
    }, [cartIdsRef, items, loading, refreshStocksForIds]);

    useEffect(() => {
        if (!stockNotice) return;
        const id = window.setTimeout(() => setStockNotice(''), 2800);
        return () => window.clearTimeout(id);
    }, [stockNotice]);

    const getAvailableQty = (item) => {
        if (!item) return 0;
        if (item.is_custom || item.is_service) return Number.POSITIVE_INFINITY;
        return Number.isFinite(Number(stockById[item.id])) ? Number(stockById[item.id]) : 0;
    };

    const getLineStockStatus = (cartItem) => {
        const available = getAvailableQty(cartItem);
        const requested = Number(cartItem?.quantity || 0);
        const insufficient = Number.isFinite(available) && available !== Number.POSITIVE_INFINITY ? requested > available : false;
        const shortfall = insufficient ? requested - available : 0;
        return { available, requested, insufficient, shortfall };
    };

    const insufficientIssues = React.useMemo(() => {
        return standardCartItems
            .map((i) => {
                const status = getLineStockStatus(i);
                if (!status.insufficient) return null;
                return {
                    item_id: i.id,
                    requested_qty: status.requested,
                    available_qty: Math.max(0, Number.isFinite(status.available) ? status.available : 0),
                    shortfall: status.shortfall,
                };
            })
            .filter(Boolean);
    }, [standardCartItems, stockById]);

    const lastWarningKeyRef = React.useRef('');
    useEffect(() => {
        if (insufficientIssues.length === 0) {
            lastWarningKeyRef.current = '';
            return;
        }

        const key = insufficientIssues
            .slice()
            .sort((a, b) => Number(a.item_id) - Number(b.item_id))
            .map((i) => `${i.item_id}:${i.requested_qty}:${i.available_qty}:${i.shortfall}`)
            .join('|');

        if (key === lastWarningKeyRef.current) return;
        lastWarningKeyRef.current = key;

        axios.post('/api/stock-warnings', { issues: insufficientIssues }).catch(() => {});
    }, [insufficientIssues]);

    const handleAddToCart = (item) => {
        const available = getAvailableQty(item);
        if (available !== Number.POSITIVE_INFINITY && available <= 0) {
            setStockNotice(`Insufficient Stock: "${item.name}" is out of stock.`);
            return;
        }
        const existing = cartItems.find((i) => i.id === item.id);
        const nextQty = (existing ? Number(existing.quantity || 0) : 0) + 1;
        if (available !== Number.POSITIVE_INFINITY && nextQty > available) {
            const shortfall = nextQty - available;
            setStockNotice(`Insufficient Stock: "${item.name}" short by ${shortfall}.`);
            return;
        }
        addItem(item);
    };

    const handleIncreaseQty = (cartItem) => {
        const available = getAvailableQty(cartItem);
        const nextQty = Number(cartItem.quantity || 0) + 1;
        if (available !== Number.POSITIVE_INFINITY && nextQty > available) {
            const shortfall = nextQty - available;
            setStockNotice(`Insufficient Stock: "${cartItem.name}" short by ${shortfall}.`);
            return;
        }
        updateQuantity(cartItem.id, nextQty);
    };

    const hasInsufficientStock = React.useMemo(() => {
        return standardCartItems.some((i) => getLineStockStatus(i).insufficient);
    }, [standardCartItems, stockById]);

    const filteredItems = items;

    const handleCheckout = async (method) => {
        if (cartItems.length === 0) return;
        if (!posSettings.dailySalesEnabled) {
            setDailySalesModalOpen(true);
            return;
        }
        if (hasInsufficientStock) {
            setStockNotice('Insufficient Stock: adjust quantities or remove items to continue.');
            return;
        }
        if (overridesDisabled) {
            setStockNotice('Price adjustments or custom items are currently disabled by admin settings. Please remove those changes.');
            return;
        }
        if (requiresOverride && hasMissingOverrideReasons) {
            alert('Approval requires a reason for every price adjustment and custom item.');
            return;
        }
        if (requiresOverride && (!isApprovalValid || !checkoutPin)) {
            alert('Manager approval is required for price adjustments or custom items.');
            return;
        }
        try {
            const res = await axios.post('/api/sales', {
                customer_type: customerType,
                items: standardCartItems.map((i) => {
                    const base = { id: i.id, quantity: i.quantity };
                    const original = i.original_price == null ? Number(i.price || 0) : Number(i.original_price || 0);
                    const current = Number(i.price || 0);
                    if (Math.abs(current - original) <= 0.0001) return base;
                    return {
                        ...base,
                        unit_price: current,
                        price_override_reason: i.price_override_reason || null,
                    };
                }),
                custom_items: customCartItems.map((i) => ({
                    name: i.name,
                    quantity: i.quantity,
                    unit_price: Number(i.price || 0),
                    reason: i.custom_reason || null,
                })),
                payment_method: method,
                discount: discount,
                cashier_pin: requiresOverride ? checkoutPin : null,
                override_approval_token: requiresOverride ? overrideApproval?.token : null,
            });

            setLastSale(res.data.sale);
            if (method === 'gcash' && res.data.qr_code_url) {
                setQrCodeUrl(res.data.qr_code_url);
                setIsQRModalOpen(true);
            } else {
                setIsReceiptModalOpen(true);
            }
            clearCart();
            setCustomerType('walk_in');
            setDiscount(0);
            setIsCartOpen(false);
            clearOverrideAuth();
            try {
                await loadItemsPage(page, { silent: true });
            } catch {
            }
        } catch (err) {
            const msg = err.response?.data?.message || err.response?.data?.errors?.items?.[0] || 'Checkout failed';
            alert(msg);
        }
    };

    const total = getTotal();
    const finalTotal = Math.max(0, total - discount);
    const formatAmount = (value) =>
        Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const receiptSubtotal = [...(lastSale?.sale_items || []), ...(lastSale?.custom_items || [])].reduce(
        (sum, item) => sum + Number(item.subtotal || 0),
        0
    );
    const receiptDiscount = Number(lastSale?.discount || 0);
    const receiptTotal = Number(lastSale?.total_amount || 0);

    if (loading) return (
        <div className="h-[80vh] flex flex-col items-center justify-center">
            <div className="w-10 h-10 border-4 border-[#cbcbcb] border-t-[#818181] rounded-full animate-spin"></div>
            <div className="mt-4 text-[#a6a6a6] font-medium tracking-wide">Initializing POS...</div>
        </div>
    );

    return (
        <div className="relative font-sans text-[#818181] print:hidden">
            {stockNotice ? (
                <div className="fixed z-[90] top-6 left-1/2 -translate-x-1/2 w-[min(520px,calc(100vw-32px))] animate-in slide-in-from-top-4 fade-in duration-300">
                    <div className="rounded-2xl border border-[#cbcbcb] bg-white p-4 shadow-2xl flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-[#dddddd] flex items-center justify-center shrink-0">
                            <AlertOctagon size={20} className="text-red-500" />
                        </div>
                        <div className="text-[14px] font-medium text-[#818181]">{stockNotice}</div>
                    </div>
                </div>
            ) : null}

            {/* Persistent banner when daily sales is disabled */}
            {!posSettings.dailySalesEnabled ? (
                <div className="mb-4 rounded-2xl border border-[#cbcbcb] bg-gradient-to-r from-zinc-100 via-white to-zinc-100 p-4 shadow-sm flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-[#dddddd] border border-[#cbcbcb] flex items-center justify-center shrink-0 shadow-inner">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#818181" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="10" />
                            <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
                        </svg>
                    </div>
                    <div>
                        <div className="text-sm font-semibold text-[#818181]">Daily Sales Currently Disabled</div>
                        <div className="text-xs text-[#a6a6a6] font-medium mt-0.5">Checkout is blocked. Contact an administrator to re-enable.</div>
                    </div>
                </div>
            ) : null}

            {compareMode && mockupOverlayUrl ? (
                <div className="fixed inset-0 z-[60] pointer-events-none">
                    <img
                        src={mockupOverlayUrl}
                        alt="Design overlay"
                        className="w-full h-full object-contain"
                        style={{ opacity: mockupOpacity }}
                    />
                </div>
            ) : null}

            {compareMode ? (
                <div className="fixed z-[70] right-4 bottom-4 w-[320px] rounded-2xl border border-[#cbcbcb] bg-white shadow-xl p-4">
                    <div className="flex items-center justify-between mb-3">
                        <div className="text-sm font-medium text-[#818181]">Compare Mode</div>
                        <a
                            href="/cashier/pos"
                            className="text-[12px] font-medium text-[#818181] hover:text-indigo-800"
                        >
                            Exit
                        </a>
                    </div>
                    <label className="block text-[11px] font-medium text-[#a6a6a6] mb-2 uppercase tracking-wider">Upload screenshot</label>
                    <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            setMockupOverlayUrl(URL.createObjectURL(file));
                        }}
                        className="block w-full text-[12px] file:mr-3 file:px-4 file:py-2 file:rounded-lg file:border-0 file:bg-[#dddddd] file:text-[#818181] file:font-medium hover:file:bg-zinc-200 transition-colors"
                    />
                    <div className="mt-4">
                        <div className="flex items-center justify-between text-[11px] font-medium text-[#a6a6a6] mb-2 uppercase tracking-wider">
                            <span>Overlay opacity</span>
                            <span>{Math.round(mockupOpacity * 100)}%</span>
                        </div>
                        <input
                            type="range"
                            min="0"
                            max="1"
                            step="0.01"
                            value={mockupOpacity}
                            onChange={(e) => setMockupOpacity(parseFloat(e.target.value))}
                            className="w-full accent-[#818181]"
                        />
                    </div>
                </div>
            ) : null}

            <div className="w-full max-w-[1600px] mx-auto pb-8">
                {/* Mobile-only sticky bar */}
                <div className="lg:hidden sticky top-16 z-30 bg-[#dddddd] pt-2 pb-3 mb-4 -mt-2">
                    <div className="flex flex-col gap-3 px-1">
                        <form onSubmit={handleSkuScan} className="relative">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[#cbcbcb]" size={18} />
                            <input
                                type="text"
                                aria-label="Search products"
                                placeholder="Scan barcode or search products..."
                                value={skuSearch || search}
                                onChange={(e) => {
                                    const v = e.target.value;
                                    setSkuSearch(v);
                                    setSearch(v);
                                    setPage(1);
                                }}
                                className="w-full h-12 pl-12 pr-4 rounded-2xl border border-[#cbcbcb] bg-white text-[14px] font-semibold text-[#818181] placeholder:text-[#cbcbcb] placeholder:font-medium focus:outline-none focus:ring-2 focus:ring-[#818181]/20 focus:border-[#818181] shadow-sm transition-all"
                            />
                            <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none">
                                <div className="px-2 py-1 bg-[#dddddd] rounded-lg text-[10px] font-medium text-[#a6a6a6] tracking-wider">SKU</div>
                            </div>
                        </form>
                        <div className="flex items-center gap-3">
                            <button
                                type="button"
                                onClick={() => setIsFilterOpen(true)}
                                className="flex-1 inline-flex items-center justify-center gap-2 h-12 px-5 rounded-2xl border border-[#cbcbcb] bg-white text-[14px] font-medium hover:bg-[#dddddd] transition-colors shadow-sm"
                            >
                                <SlidersHorizontal size={16} className="text-[#a6a6a6]" />
                                Categories
                            </button>
                            <button
                                type="button"
                                onClick={() => setIsCartOpen(true)}
                                aria-label="Open cart"
                                className="flex-1 inline-flex items-center justify-center gap-2 h-12 px-5 rounded-2xl bg-[#818181] text-white text-[14px] font-medium hover:bg-[#a6a6a6] transition-all shadow-md"
                            >
                                <ShoppingCart size={16} />
                                View Cart
                                {cartItems.length > 0 && (
                                    <span className="ml-1 inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-white text-[#818181] text-[11px] font-semibold">
                                        {cartItems.length}
                                    </span>
                                )}
                            </button>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-12 gap-6 lg:gap-8">
                    {/* Desktop: Search + Categories all sticky in the left sidebar */}
                    <aside className="hidden lg:block col-span-3 xl:col-span-2 min-w-0">
                        <div className="sticky top-[80px]">
                            <form onSubmit={handleSkuScan} className="relative mb-5">
                                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#cbcbcb]" size={16} />
                                <input
                                    type="text"
                                    aria-label="Search products"
                                    placeholder="Search products..."
                                    value={skuSearch || search}
                                    onChange={(e) => {
                                        const v = e.target.value;
                                        setSkuSearch(v);
                                        setSearch(v);
                                        setPage(1);
                                    }}
                                    className="w-full h-10 pl-10 pr-3 rounded-xl border border-[#cbcbcb] bg-white text-[13px] font-semibold text-[#818181] placeholder:text-[#cbcbcb] placeholder:font-medium focus:outline-none focus:ring-2 focus:ring-[#818181]/20 focus:border-[#818181] shadow-sm transition-all"
                                />
                            </form>
                            <h2 className="text-[12px] font-semibold text-[#cbcbcb] uppercase tracking-widest mb-4 px-2">Categories</h2>
                            <div className="space-y-1 text-[14px] font-medium">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setCategory('all');
                                        setPage(1);
                                    }}
                                    className={`w-full text-left px-4 py-3 rounded-2xl transition-all flex items-center justify-between ${
                                        category === 'all'
                                            ? 'bg-white shadow-sm border border-[#cbcbcb] text-[#818181]'
                                            : 'text-[#a6a6a6] hover:text-[#818181] hover:bg-white/50 border border-transparent'
                                    }`}
                                >
                                    <span>All Products</span>
                                    {category === 'all' && <div className="w-1.5 h-1.5 rounded-full bg-[#818181]"></div>}
                                </button>
                                {categories.map((cat) => (
                                    <button
                                        key={cat.id}
                                        type="button"
                                        onClick={() => {
                                            setCategory(String(cat.id));
                                            setPage(1);
                                        }}
                                        className={`w-full text-left px-4 py-3 rounded-2xl transition-all flex items-center justify-between ${
                                            String(cat.id) === category
                                                ? 'bg-white shadow-sm border border-[#cbcbcb] text-[#818181]'
                                                : 'text-[#a6a6a6] hover:text-[#818181] hover:bg-white/50 border border-transparent'
                                        }`}
                                    >
                                        <span className="truncate">{cat.name}</span>
                                        {String(cat.id) === category && <div className="w-1.5 h-1.5 rounded-full bg-[#818181]"></div>}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </aside>

                    {/* Products Grid */}
                    <section className="col-span-12 lg:col-span-5 xl:col-span-6 min-w-0">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4 px-1">
                            <div className="text-[14px] font-medium text-[#a6a6a6]" aria-label="Products summary">
                                {itemsLoading ? (
                                    `Loading${ELLIPSIS}`
                                ) : (
                                    <>
                                        Showing <span className="text-[#818181]">{totalItems}</span> products {BULLET} Page{' '}
                                        <span className="text-[#818181]">{page}</span>/<span className="text-[#818181]">{totalPages}</span>
                                    </>
                                )}
                            </div>

                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setPage((p) => Math.max(1, p - 1));
                                    }}
                                    disabled={page <= 1 || itemsLoading}
                                    aria-label="Previous page"
                                    className="h-10 px-3 rounded-2xl border border-[#cbcbcb] bg-white text-[12px] font-medium text-[#818181] hover:bg-[#dddddd] disabled:opacity-50"
                                >
                                    Prev
                                </button>
                                <div className="hidden md:flex items-center gap-1" aria-label="Page numbers">
                                    {(() => {
                                        const pages = [];
                                        const add = (v) => pages.push(v);
                                        add(1);
                                        if (totalPages > 1) {
                                            const start = Math.max(2, page - 1);
                                            const end = Math.min(totalPages - 1, page + 1);
                                            if (start > 2) add(ELLIPSIS);
                                            for (let p = start; p <= end; p++) add(p);
                                            if (end < totalPages - 1) add(ELLIPSIS);
                                            add(totalPages);
                                        }
                                        return pages.map((p, idx) => {
                                            if (p === ELLIPSIS) {
                                                return (
                                                    <span key={`pos-ellipsis-${idx}`} className="px-2 text-[12px] font-semibold text-[#cbcbcb]">
                                                        {ELLIPSIS}
                                                    </span>
                                                );
                                            }
                                            const pageNum = Number(p);
                                            const active = pageNum === page;
                                            return (
                                                <button
                                                    key={`pos-page-${pageNum}`}
                                                    type="button"
                                                    onClick={() => {
                                                        setPage(pageNum);
                                                    }}
                                                    disabled={itemsLoading}
                                                    aria-label={`Go to page ${pageNum}`}
                                                    aria-current={active ? 'page' : undefined}
                                                    className={`min-w-10 h-10 px-3 rounded-2xl border text-[12px] font-semibold transition-colors ${
                                                        active
                                                            ? 'border-[#818181] bg-[#818181] text-white'
                                                            : 'border-[#cbcbcb] bg-white text-[#818181] hover:bg-[#dddddd]'
                                                    }`}
                                                >
                                                    {pageNum}
                                                </button>
                                            );
                                        });
                                    })()}
                                </div>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setPage((p) => Math.min(totalPages, p + 1));
                                    }}
                                    disabled={page >= totalPages || itemsLoading}
                                    aria-label="Next page"
                                    className="h-10 px-3 rounded-2xl border border-[#cbcbcb] bg-white text-[12px] font-medium text-[#818181] hover:bg-[#dddddd] disabled:opacity-50"
                                >
                                    Next
                                </button>
                            </div>
                        </div>

                        {itemsError ? (
                            <div className="mb-4 px-4 py-3 rounded-2xl border border-[#cbcbcb] bg-[#dddddd] text-[#818181] text-sm font-semibold flex items-center justify-between gap-3">
                                <div className="min-w-0 truncate">{itemsError}</div>
                                <button
                                    type="button"
                                    onClick={() => loadItemsPage(page)}
                                    className="shrink-0 h-9 px-3 rounded-xl border border-[#cbcbcb] bg-white text-xs font-semibold text-[#818181] hover:bg-[#dddddd]"
                                >
                                    Retry
                                </button>
                            </div>
                        ) : null}

                        {itemsLoading ? (
                            <div className="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(200px,1fr))]" aria-label="Loading products">
                                {Array.from({ length: 10 }).map((_, idx) => (
                                    <div key={`pos-skel-${idx}`} className="rounded-[1.5rem] border border-[#cbcbcb] bg-white p-4">
                                        <div className="aspect-square w-full rounded-2xl bg-[#dddddd] animate-pulse" />
                                        <div className="mt-4 h-3 w-24 bg-[#dddddd] rounded animate-pulse" />
                                        <div className="mt-2 h-4 w-40 bg-[#dddddd] rounded animate-pulse" />
                                        <div className="mt-4 flex items-end justify-between gap-2">
                                            <div className="h-5 w-20 bg-[#dddddd] rounded animate-pulse" />
                                            <div className="h-10 w-10 bg-[#dddddd] rounded-xl animate-pulse" />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : filteredItems.length === 0 ? (
                            <div className="text-center py-20 bg-white rounded-3xl border border-zinc-100 shadow-sm">
                                <div className="w-16 h-16 bg-[#dddddd] rounded-full flex items-center justify-center mx-auto mb-4">
                                    <Package size={24} className="text-zinc-300" />
                                </div>
                                <h3 className="text-lg font-medium text-[#818181]">No products found</h3>
                                <p className="text-[#a6a6a6] font-medium mt-1">Try adjusting your search or category filter.</p>
                            </div>
                        ) : (
                            <div className="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(200px,1fr))]">
                                {filteredItems.map((item) => (
                                    (() => {
                                        const available = getAvailableQty(item);
                                        const out = available !== Number.POSITIVE_INFINITY && available <= 0;
                                        const low = available !== Number.POSITIVE_INFINITY && available > 0 && available <= 3;
                                        const primary = item?.primary_image || item?.primaryImage || null;
                                        const thumb = primary?.thumb_url || primary?.url || null;
                                        return (
                                            <div
                                                key={item.id}
                                                data-testid={`product-card-${item.id}`}
                                                onClick={() => !out && handleAddToCart(item)}
                                                className={`group flex flex-col rounded-[1.5rem] border bg-white p-4 transition-all cursor-pointer select-none ${
                                                    out ? 'border-zinc-100 opacity-60' : 'border-[#cbcbcb] hover:border-[#a6a6a6] hover:shadow-xl hover:-translate-y-1'
                                                }`}
                                            >
                                                <div className="relative mb-4">
                                                    <div className="aspect-square w-full rounded-2xl bg-[#dddddd] flex items-center justify-center border border-zinc-100 transition-colors group-hover:bg-[#dddddd]">
                                                        {thumb ? (
                                                            <img src={thumb} alt="" className="w-full h-full object-cover rounded-2xl" />
                                                        ) : (
                                                            <Package size={40} strokeWidth={1} className={out ? 'text-zinc-300' : 'text-[#cbcbcb]'} />
                                                        )}
                                                    </div>
                                                    {Boolean(item.is_service) && (
                                                        <div className="absolute top-2 right-2 px-2 py-1 rounded-lg bg-white/90 backdrop-blur-sm shadow-sm border border-zinc-100 text-[10px] font-semibold uppercase tracking-widest text-emerald-600">
                                                            Service
                                                        </div>
                                                    )}
                                                </div>
                                                
                                                <div className="flex-1 flex flex-col">
                                                    <div className="text-[11px] font-medium text-[#cbcbcb] uppercase tracking-widest truncate mb-1">
                                                        {item.category?.name || 'Uncategorized'}
                                                    </div>
                                                    <div className="text-[14px] font-medium text-[#818181] leading-tight mb-2 line-clamp-2">
                                                        {item.name}
                                                    </div>
                                                    
                                                    <div className="mt-auto pt-3 flex items-end justify-between gap-2">
                                                        <div>
                                                            <div className="text-[18px] font-semibold text-[#818181] tracking-tight">
                                                                {PESO}{Number(item.price).toLocaleString()}
                                                            </div>
                                                            {!item.is_service && (
                                                                <div className={`text-[11px] font-medium mt-0.5 ${out ? 'text-red-500' : low ? 'text-red-600' : 'text-[#a6a6a6]'}`}>
                                                                    {out ? 'Out of stock' : `${Math.max(0, available)} in stock`}
                                                                </div>
                                                            )}
                                                        </div>
                                                        <button
                                                            type="button"
                                                            disabled={out}
                                                            className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
                                                                out ? 'bg-[#dddddd] text-[#cbcbcb]' : 'bg-[#818181] text-white group-hover:scale-110 shadow-md'
                                                            }`}
                                                        >
                                                            <Plus size={18} strokeWidth={2.5} />
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })()
                                ))}
                            </div>
                        )}
                    </section>

                    {/* Desktop Cart Sidebar */}
                    <aside className="hidden lg:block col-span-4 min-w-0">
                        <div className="sticky top-[88px]">
                            <CartPanel
                                scrollTestId="cart-scroll-desktop"
                                cartItems={cartItems}
                                standardCartItems={standardCartItems}
                                getLineStockStatus={getLineStockStatus}
                                customerType={customerType}
                                setCustomerType={setCustomerType}
                                discount={discount}
                                setDiscount={setDiscount}
                                total={total}
                                finalTotal={finalTotal}
                                paymentMethod={paymentMethod}
                                setPaymentMethod={setPaymentMethod}
                                handleCheckout={handleCheckout}
                                hasInsufficientStock={hasInsufficientStock}
                                removeItem={removeItem}
                                updateQuantity={updateQuantity}
                                handleIncreaseQty={handleIncreaseQty}
                                clearCart={clearCart}
                                clearOverrideAuth={clearOverrideAuth}
                                formatAmount={formatAmount}
                            />
                        </div>
                    </aside>
                </div>
            </div>

            <Transition appear show={isFilterOpen} as={Fragment}>
                <Dialog as="div" className="relative z-[80]" onClose={() => setIsFilterOpen(false)}>
                    <Transition.Child
                        as={Fragment}
                        enter="ease-out duration-200"
                        enterFrom="opacity-0"
                        enterTo="opacity-100"
                        leave="ease-in duration-150"
                        leaveFrom="opacity-100"
                        leaveTo="opacity-0"
                    >
                        <button
                            type="button"
                            className="fixed inset-0 bg-[#818181]/30"
                            onClick={() => setIsFilterOpen(false)}
                            aria-label="Close filter overlay"
                        />
                    </Transition.Child>
                    <div className="fixed inset-0 overflow-y-auto">
                        <div className="min-h-full flex justify-end">
                            <Transition.Child
                                as={Fragment}
                                enter="ease-out duration-200"
                                enterFrom="translate-x-full"
                                enterTo="translate-x-0"
                                leave="ease-in duration-150"
                                leaveFrom="translate-x-0"
                                leaveTo="translate-x-full"
                            >
                                <Dialog.Panel className="w-full max-w-sm bg-white shadow-2xl p-5">
                                    <div className="flex items-center justify-between mb-4">
                                        <Dialog.Title className="text-[14px] font-semibold text-[#818181]">Filter Options</Dialog.Title>
                                        <button
                                            type="button"
                                            onClick={() => setIsFilterOpen(false)}
                                            className="w-10 h-10 rounded-full border border-[#19140015] flex items-center justify-center hover:bg-[#fff7f9] transition-colors"
                                            aria-label="Close filter"
                                        >
                                            <X size={18} />
                                        </button>
                                    </div>
                                    <div className="space-y-6 text-[13px]">
                                        <div>
                                            <div className="text-[12px] font-semibold text-[#818181] mb-3">By Categories</div>
                                            <div className="space-y-1">
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setCategory('all');
                                                        setPage(1);
                                                        setIsFilterOpen(false);
                                                    }}
                                                    className={`w-full text-left px-2 py-1.5 rounded-md transition-colors ${
                                                        category === 'all'
                                                            ? 'text-[#4a2437] font-semibold'
                                                            : 'text-[#a6a6a6] hover:text-[#818181]'
                                                    }`}
                                                >
                                                    All
                                                </button>
                                                {categories.map((cat) => (
                                                    <button
                                                        key={cat.id}
                                                        type="button"
                                                        onClick={() => {
                                                            setCategory(String(cat.id));
                                                            setPage(1);
                                                            setIsFilterOpen(false);
                                                        }}
                                                        className={`w-full text-left px-2 py-1.5 rounded-md transition-colors ${
                                                            String(cat.id) === category
                                                                ? 'text-[#4a2437] font-semibold'
                                                                : 'text-[#a6a6a6] hover:text-[#818181]'
                                                        }`}
                                                    >
                                                        {cat.name}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </Dialog.Panel>
                            </Transition.Child>
                        </div>
                    </div>
                </Dialog>
            </Transition>

            <Transition appear show={isCartOpen} as={Fragment}>
                <Dialog as="div" className="relative z-[90]" onClose={() => setIsCartOpen(false)}>
                    <Transition.Child
                        as={Fragment}
                        enter="ease-out duration-200"
                        enterFrom="opacity-0"
                        enterTo="opacity-100"
                        leave="ease-in duration-150"
                        leaveFrom="opacity-100"
                        leaveTo="opacity-0"
                    >
                        <button
                            type="button"
                            className="fixed inset-0 bg-[#818181]/30"
                            onClick={() => setIsCartOpen(false)}
                            aria-label="Close cart overlay"
                        />
                    </Transition.Child>

                    <div className="fixed inset-0 overflow-y-auto">
                        <div className="min-h-full flex justify-end">
                            <Transition.Child
                                as={Fragment}
                                enter="ease-out duration-200"
                                enterFrom="translate-x-full"
                                enterTo="translate-x-0"
                                leave="ease-in duration-150"
                                leaveFrom="translate-x-0"
                                leaveTo="translate-x-full"
                            >
                                <Dialog.Panel className="w-full max-w-md bg-white shadow-2xl p-4">
                                    <CartPanel
                                        onClose={() => setIsCartOpen(false)}
                                        scrollTestId="cart-scroll-overlay"
                                        cartItems={cartItems}
                                        standardCartItems={standardCartItems}
                                        getLineStockStatus={getLineStockStatus}
                                        customerType={customerType}
                                        setCustomerType={setCustomerType}
                                        discount={discount}
                                        setDiscount={setDiscount}
                                        total={total}
                                        finalTotal={finalTotal}
                                        paymentMethod={paymentMethod}
                                        setPaymentMethod={setPaymentMethod}
                                        handleCheckout={handleCheckout}
                                        hasInsufficientStock={hasInsufficientStock}
                                        removeItem={removeItem}
                                        updateQuantity={updateQuantity}
                                        handleIncreaseQty={handleIncreaseQty}
                                        clearCart={clearCart}
                                        clearOverrideAuth={clearOverrideAuth}
                                        formatAmount={formatAmount}
                                    />
                                </Dialog.Panel>
                            </Transition.Child>
                        </div>
                    </div>
                </Dialog>
            </Transition>

            {/* GCash QR Modal */}
            <Transition appear show={isQRModalOpen} as={Fragment}>
                <Dialog as="div" className="relative z-[100]" onClose={() => setIsQRModalOpen(false)}>
                    <Transition.Child as={Fragment} enter="ease-out duration-300" enterFrom="opacity-0" enterTo="opacity-100" leave="ease-in duration-200" leaveFrom="opacity-100" leaveTo="opacity-0">
                        <button
                            type="button"
                            className="fixed inset-0 bg-[#818181]/40 backdrop-blur-md"
                            onClick={() => setIsQRModalOpen(false)}
                            aria-label="Close GCash modal"
                        />
                    </Transition.Child>
                    <div className="fixed inset-0 overflow-y-auto">
                        <div className="flex min-h-full items-center justify-center p-4">
                            <Transition.Child as={Fragment} enter="ease-out duration-300" enterFrom="opacity-0 scale-95" enterTo="opacity-100 scale-100" leave="ease-in duration-200" leaveFrom="opacity-100 scale-100" leaveTo="opacity-0 scale-95">
                                <Dialog.Panel className="w-full max-w-sm transform overflow-hidden rounded-3xl bg-white p-8 shadow-2xl transition-all border border-zinc-100 text-center">
                                    <div className="flex justify-between items-center mb-6">
                                        <div className="text-left">
                                            <Dialog.Title as="h3" className="text-2xl font-semibold text-[#818181] tracking-tight">GCash Payment</Dialog.Title>
                                            <p className="text-[#a6a6a6] text-sm font-medium">Scan to pay now</p>
                                        </div>
                                        <button onClick={() => setIsQRModalOpen(false)} className="p-2 hover:bg-[#dddddd] rounded-full transition-colors text-[#a6a6a6]"><X size={20} /></button>
                                    </div>
                                    
                                    <div className="bg-[#007DFE]/5 p-6 rounded-3xl border-2 border-dashed border-[#007DFE]/20 inline-block mb-6 shadow-sm">
                                        <img src={qrCodeUrl} alt="GCash QR Code" className="w-48 h-48 mx-auto mix-blend-multiply" />
                                    </div>

                                    <div className="space-y-4">
                                        <div className="bg-[#dddddd] border border-zinc-100 p-4 rounded-2xl shadow-sm">
                                            <p className="text-[11px] font-semibold text-[#cbcbcb] uppercase tracking-widest mb-1">Total Amount</p>
                                            <p className="text-3xl font-semibold text-[#818181] tracking-tight">{PESO}{finalTotal.toLocaleString()}</p>
                                        </div>
                                        <button 
                                            onClick={() => {
                                                setIsQRModalOpen(false);
                                                setIsReceiptModalOpen(true);
                                            }}
                                            className="w-full py-4 bg-[#007DFE] text-white rounded-2xl font-semibold text-[13px] uppercase tracking-wider hover:bg-[#0069cc] transition-all shadow-lg shadow-[#007DFE20] hover:-translate-y-0.5"
                                        >
                                            Payment Received
                                        </button>
                                    </div>
                                </Dialog.Panel>
                            </Transition.Child>
                        </div>
                    </div>
                </Dialog>
            </Transition>

            {/* Receipt Modal */}
            <Transition appear show={isReceiptModalOpen} as={Fragment}>
                <Dialog as="div" className="relative z-[100]" onClose={() => setIsReceiptModalOpen(false)}>
                    <Transition.Child as={Fragment} enter="ease-out duration-300" enterFrom="opacity-0" enterTo="opacity-100" leave="ease-in duration-200" leaveFrom="opacity-100" leaveTo="opacity-0">
                        <button
                            type="button"
                            className="fixed inset-0 bg-[#818181]/40 backdrop-blur-md print:hidden"
                            onClick={() => setIsReceiptModalOpen(false)}
                            aria-label="Close receipt modal"
                        />
                    </Transition.Child>
                    <div className="fixed inset-0 overflow-y-auto print:static print:inset-auto print:overflow-visible">
                        <div className="flex min-h-full items-center justify-center p-4 print:p-0 print:block print:min-h-0">
                            <Transition.Child as={Fragment} enter="ease-out duration-300" enterFrom="opacity-0 scale-95" enterTo="opacity-100 scale-100" leave="ease-in duration-200" leaveFrom="opacity-100 scale-100" leaveTo="opacity-0 scale-95">
                                <Dialog.Panel className="w-full max-w-sm transform overflow-hidden rounded-3xl bg-white p-8 shadow-2xl transition-all border border-zinc-100 print:shadow-none print:border-none print:rounded-none print:p-0 print:max-w-none print:w-auto">
                                    <div className="text-center mb-6">
                                        <div className="flex items-center justify-center gap-3 mb-2">
                                            <div className="w-12 h-12 rounded-xl bg-[#dddddd] border border-zinc-100 p-1 flex items-center justify-center shadow-sm">
                                                <img
                                                    src={branding.logoSrc}
                                                    alt={`${branding.name} logo`}
                                                    className="w-full h-full object-contain mix-blend-multiply"
                                                />
                                            </div>
                                        </div>
                                        <h2 className="text-[18px] font-semibold text-[#818181] tracking-tight">{branding.name}</h2>
                                        <p className="text-[12px] text-[#a6a6a6] font-medium uppercase tracking-wider">Boutique Shop POS</p>
                                        <p className="text-[10px] text-[#cbcbcb] font-medium uppercase tracking-wider mt-2">
                                            Cashier: {lastSale?.staff?.name ? `${lastSale.staff.name} (${lastSale.staff.email})` : lastSale?.staff?.email || 'Unknown'}
                                        </p>
                                        <div className="flex justify-between items-center mt-6 text-[10px] font-medium text-[#cbcbcb] uppercase tracking-widest border-b border-[#cbcbcb] pb-3">
                                            <span>#{lastSale?.id || '---'}</span>
                                            <span>{lastSale?.created_at ? new Date(lastSale.created_at).toLocaleString() : 'Just now'}</span>
                                        </div>
                                    </div>

                                    <div className="space-y-3 border-b border-dashed border-[#cbcbcb] py-4 mb-4">
                                        {lastSale?.sale_items?.map((item) => {
                                            const mod = (lastSale?.modifications || []).find(
                                                (m) => m.type === 'price_override' && Number(m.item_id) === Number(item.item_id)
                                            );
                                            const adminLabel = mod?.admin
                                                ? `${mod.admin.name}`
                                                : mod?.admin_id
                                                  ? `Admin #${mod.admin_id}`
                                                  : null;
                                            return (
                                                <div key={item.id}>
                                                    <div className="flex justify-between text-[13px] font-medium text-[#818181]">
                                                        <span className="flex-1 truncate pr-2">
                                                            <span className="font-semibold text-[#a6a6a6] mr-1">{item.quantity}x</span> {item.item?.name}
                                                        </span>
                                                        <span className="font-semibold">{PESO}{formatAmount(item.subtotal)}</span>
                                                    </div>
                                                    {mod ? (
                                                        <div className="mt-1 text-[10px] font-medium text-red-600 uppercase tracking-wider">
                                                            {PESO}{formatAmount(mod.unit_price_before)} {ARROW} {PESO}{formatAmount(mod.unit_price_after)} {BULLET} Appr: {adminLabel}
                                                        </div>
                                                    ) : null}
                                                </div>
                                            );
                                        })}
                                        {lastSale?.custom_items?.map((item) => {
                                            const mod = (lastSale?.modifications || []).find(
                                                (m) => m.type === 'custom_item_add' && String(m.label || '').trim() === String(item.name || '').trim()
                                            );
                                            const adminLabel = mod?.admin
                                                ? `${mod.admin.name}`
                                                : mod?.admin_id
                                                  ? `Admin #${mod.admin_id}`
                                                  : null;
                                            return (
                                                <div key={`c_${item.id}`}>
                                                    <div className="flex justify-between text-[13px] font-medium text-[#818181]">
                                                        <span className="flex-1 truncate pr-2">
                                                            <span className="font-semibold text-[#818181] mr-1">{item.quantity}x</span> {item.name}
                                                        </span>
                                                        <span className="font-semibold">{PESO}{formatAmount(item.subtotal)}</span>
                                                    </div>
                                                    {mod ? (
                                                        <div className="mt-1 text-[10px] font-medium text-[#818181] uppercase tracking-wider">
                                                            Custom item {BULLET} Appr: {adminLabel}
                                                        </div>
                                                    ) : null}
                                                </div>
                                            );
                                        })}

                                        {lastSale?.modifications?.length ? (
                                            <div className="pt-3 border-t border-zinc-100 mt-2">
                                                <div className="text-[10px] font-semibold text-[#cbcbcb] uppercase tracking-widest mb-2">
                                                    Audit Log
                                                </div>
                                                <div className="space-y-2">
                                                    {lastSale.modifications.map((m) => (
                                                        <div key={m.id} className="rounded-xl border border-zinc-100 bg-[#dddddd] px-3 py-2">
                                                            <div className="text-[10px] font-semibold text-[#818181] uppercase tracking-wider flex justify-between gap-3">
                                                                <span className="min-w-0 truncate">{m.type}: {m.label}</span>
                                                                <span className="text-[#cbcbcb] font-mono">{m.approval_id}</span>
                                                            </div>
                                                            <div className="mt-1 text-[9px] font-medium text-[#a6a6a6] uppercase tracking-wider">
                                                                {m.reason ? `Reason: ${m.reason}` : null}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        ) : null}
                                    </div>

                                    <div className="space-y-2 text-right mb-8">
                                        <div className="flex justify-between text-[11px] text-[#a6a6a6] font-medium uppercase tracking-widest">
                                            <span>Subtotal</span>
                                            <span>{PESO}{formatAmount(receiptSubtotal)}</span>
                                        </div>
                                        <div className="flex justify-between text-[11px] text-emerald-600 font-semibold uppercase tracking-widest">
                                            <span>Discount</span>
                                            <span>-{PESO}{formatAmount(receiptDiscount)}</span>
                                        </div>
                                        <div className="flex justify-between text-2xl font-semibold text-[#818181] pt-4 border-t border-[#cbcbcb] mt-2 tracking-tight">
                                            <span>Total Paid</span>
                                            <span>{PESO}{formatAmount(receiptTotal)}</span>
                                        </div>
                                        <p className="text-[10px] text-[#a6a6a6] font-medium uppercase tracking-widest mt-4 bg-[#dddddd] py-2 rounded-xl text-center">Paid via {lastSale?.payment_method || paymentMethod}</p>
                                    </div>

                                    <div className="text-center space-y-4">
                                        <p className="text-[11px] font-semibold text-[#cbcbcb] uppercase tracking-widest">Thank you for your visit!</p>
                                        <div className="flex gap-3 print:hidden">
                                            <button 
                                                onClick={() => window.print()}
                                                className="flex-1 py-4 border-2 border-[#cbcbcb] text-[#a6a6a6] rounded-2xl font-semibold text-[12px] uppercase tracking-wider hover:bg-[#dddddd] hover:border-[#a6a6a6] transition-all shadow-sm"
                                            >
                                                Print
                                            </button>
                                            <button 
                                                onClick={() => setIsReceiptModalOpen(false)}
                                                className="flex-1 py-4 bg-[#818181] text-white rounded-2xl font-semibold text-[12px] uppercase tracking-wider hover:bg-[#a6a6a6] transition-all shadow-lg hover:-translate-y-0.5"
                                            >
                                                Done
                                            </button>
                                        </div>
                                    </div>
                                </Dialog.Panel>
                            </Transition.Child>
                        </div>
                    </div>
                </Dialog>
            </Transition>

            {/* ─── Daily Sales Disabled Modal ─────────────────────────────── */}
            <Transition appear show={dailySalesModalOpen} as={Fragment}>
                <Dialog as="div" className="relative z-[60]" onClose={() => setDailySalesModalOpen(false)}>
                    <Transition.Child
                        as={Fragment}
                        enter="ease-out duration-200"
                        enterFrom="opacity-0"
                        enterTo="opacity-100"
                        leave="ease-in duration-150"
                        leaveFrom="opacity-100"
                        leaveTo="opacity-0"
                    >
                        <div className="fixed inset-0 bg-[#818181]/40 backdrop-blur-sm" />
                    </Transition.Child>

                    <div className="fixed inset-0 overflow-y-auto">
                        <div className="flex min-h-full items-center justify-center p-4">
                            <Transition.Child
                                as={Fragment}
                                enter="ease-out duration-200"
                                enterFrom="opacity-0 scale-95"
                                enterTo="opacity-100 scale-100"
                                leave="ease-in duration-150"
                                leaveFrom="opacity-100 scale-100"
                                leaveTo="opacity-0 scale-95"
                            >
                                <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-white border border-[#cbcbcb] shadow-2xl text-center">
                                    {/* Header accent bar */}
                                    <div className="h-1.5 w-full bg-gradient-to-r from-zinc-300 via-zinc-400 to-zinc-300" />

                                    <div className="p-8 space-y-5">
                                        {/* Icon */}
                                        <div className="mx-auto w-16 h-16 rounded-2xl bg-[#dddddd] border border-[#cbcbcb] flex items-center justify-center shadow-inner">
                                            <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#818181" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                <circle cx="12" cy="12" r="10" />
                                                <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
                                            </svg>
                                        </div>

                                        <div className="space-y-2">
                                            <Dialog.Title className="text-xl font-semibold text-[#818181] tracking-tight">
                                                Daily Sales Disabled
                                            </Dialog.Title>
                                            <p className="text-sm text-[#a6a6a6] font-medium leading-relaxed max-w-xs mx-auto">
                                                An administrator has temporarily disabled daily sales. New transactions cannot be processed at this time.
                                            </p>
                                        </div>

                                        <div className="p-4 bg-[#dddddd]/60 border border-[#cbcbcb] rounded-xl">
                                            <p className="text-xs text-[#818181] font-medium">
                                                Please contact your admin to re-enable daily sales operations.
                                            </p>
                                        </div>

                                        <button
                                            type="button"
                                            onClick={() => setDailySalesModalOpen(false)}
                                            className="w-full py-3.5 bg-[#818181] text-white rounded-xl font-semibold text-sm uppercase tracking-wider hover:bg-[#a6a6a6] transition-all shadow-lg"
                                        >
                                            Understood
                                        </button>
                                    </div>
                                </Dialog.Panel>
                            </Transition.Child>
                        </div>
                    </div>
                </Dialog>
            </Transition>
        </div>
    );
};

export default POSTerminal;
