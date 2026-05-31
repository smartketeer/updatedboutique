import React, { Fragment, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { Dialog, Transition, Menu } from '@headlessui/react';
import { ArrowDownCircle, ArrowUpCircle, Edit3, ShoppingBag, Plus, X, Package } from 'lucide-react';

const PESO = '\u20B1';
const EM_DASH = '\u2014';
const ELLIPSIS = '\u2026';
const BULLET = '\u2022';

const StockManagement = () => {
    const [branches, setBranches] = useState([]);
    const [branchId, setBranchId] = useState('');
    const [branchesLoading, setBranchesLoading] = useState(true);

    const [items, setItems] = useState([]);
    const [itemsLoading, setItemsLoading] = useState(true);

    const [tab, setTab] = useState('receipt');
    const [movements, setMovements] = useState([]);
    const [movementsLoading, setMovementsLoading] = useState(true);
    const [movementsError, setMovementsError] = useState('');

    const [itemSearch, setItemSearch] = useState('');
    const [selectedItemId, setSelectedItemId] = useState('');

    const [qty, setQty] = useState('');
    const [reference, setReference] = useState('');
    const [notes, setNotes] = useState('');

    const [supplier, setSupplier] = useState('');
    const [unitCost, setUnitCost] = useState('');
    const [receiptDate, setReceiptDate] = useState('');
    const [isStockInDetailsOpen, setIsStockInDetailsOpen] = useState(false);

    const [isAddItemOpen, setIsAddItemOpen] = useState(false);
    const [isAddCategoryOpen, setIsAddCategoryOpen] = useState(false);

    const [categories, setCategories] = useState([]);
    const categoriesForSelect = useMemo(
        () => categories.filter((c) => String(c?.name || '').trim().toLowerCase() !== 'salon services'),
        [categories],
    );

    const [newItem, setNewItem] = useState({
        name: '',
        category_id: '',
        sku: '',
        price: '',
        cost: '',
        stock: '',
        is_service: false,
    });
    const [newCategory, setNewCategory] = useState({
        name: '',
        type: 'product',
    });

    const loadBranches = async () => {
        try {
            const res = await axios.get('/api/branches');
            const rows = Array.isArray(res.data) ? res.data : [];
            setBranches(rows);
            const active = rows.find((b) => Boolean(b?.is_active)) || rows[0];
            if (!branchId && active?.id != null) setBranchId(String(active.id));
        } catch {
            setBranches([]);
        } finally {
            setBranchesLoading(false);
        }
    };

    const loadCatalog = async (bId) => {
        setItemsLoading(true);
        try {
            const [itemsRes, catRes] = await Promise.all([
                axios.get(bId ? `/api/inventory?branch_id=${encodeURIComponent(bId)}` : '/api/inventory'),
                axios.get('/api/categories'),
            ]);
            const rows = Array.isArray(itemsRes.data) ? itemsRes.data : Array.isArray(itemsRes.data?.data) ? itemsRes.data.data : [];
            setItems(rows);
            const cats = Array.isArray(catRes.data) ? catRes.data : [];
            setCategories(cats);
        } catch {
            setItems([]);
            setCategories([]);
        } finally {
            setItemsLoading(false);
        }
    };

    const loadMovements = async (bId, nextTab) => {
        setMovementsLoading(true);
        setMovementsError('');
        try {
            const reason =
                nextTab === 'receipt'
                    ? 'receipt'
                    : nextTab === 'issue'
                        ? 'issue'
                        : nextTab === 'adjustment'
                            ? 'adjustment'
                            : 'sale';
            const params = { limit: 200 };
            if (bId) params.branch_id = bId;
            params.reason = reason;
            const res = await axios.get('/api/stock-management/movements', { params });
            setMovements(Array.isArray(res.data) ? res.data : []);
        } catch (err) {
            setMovements([]);
            setMovementsError(err.response?.data?.message || 'Failed to load stock movements.');
        } finally {
            setMovementsLoading(false);
        }
    };

    useEffect(() => {
        loadBranches();
    }, []);

    useEffect(() => {
        if (!branchId) return;
        loadCatalog(branchId);
        loadMovements(branchId, tab);
    }, [branchId]);

    useEffect(() => {
        if (!branchId) return;
        loadMovements(branchId, tab);
    }, [tab]);

    const filteredItems = useMemo(() => {
        const q = String(itemSearch || '').trim().toLowerCase();
        if (!q) return items;
        return items.filter((it) => {
            const name = String(it?.name || '').toLowerCase();
            const sku = String(it?.sku || '').toLowerCase();
            return name.includes(q) || sku.includes(q);
        });
    }, [items, itemSearch]);

    const selectedItem = useMemo(() => {
        if (!selectedItemId) return null;
        return items.find((i) => String(i.id) === String(selectedItemId)) || null;
    }, [items, selectedItemId]);

    const resetEntryForm = () => {
        setQty('');
        setReference('');
        setNotes('');
        setSupplier('');
        setUnitCost('');
        setReceiptDate('');
        setIsStockInDetailsOpen(false);
    };

    const submitMovement = async () => {
        if (!branchId) {
            alert('Please select a branch first.');
            return;
        }
        if (!selectedItemId) {
            alert('Please select an item first.');
            return;
        }
        const nQty = qty === '' ? null : Number(qty);
        const payload = {
            branch_id: Number(branchId),
            item_id: Number(selectedItemId),
            reason: tab === 'sales' ? 'sale' : tab,
            quantity: nQty == null ? null : Math.trunc(nQty),
            mode: tab === 'adjustment' ? 'set' : null,
            reference: reference.trim() || null,
            notes: notes.trim() || null,
            supplier: tab === 'receipt' ? (supplier.trim() || null) : null,
            unit_cost: tab === 'receipt' && unitCost !== '' ? Number(unitCost) : null,
            receipt_date: tab === 'receipt' && receiptDate ? receiptDate : null,
        };

        try {
            const res = await axios.post('/api/stock-management/movements', payload);
            const row = res.data;
            setMovements((prev) => [row, ...prev].slice(0, 200));
            await loadCatalog(branchId);
            resetEntryForm();
        } catch (err) {
            alert(err.response?.data?.message || 'Failed to record entry.');
        }
    };

    const createItem = async (e) => {
        e.preventDefault();
        if (!branchId) {
            alert('Please select a branch first.');
            return;
        }
        try {
            const res = await axios.post('/api/stock-management/items', {
                name: newItem.name,
                category_id: Number(newItem.category_id),
                sku: newItem.sku ? String(newItem.sku) : null,
                price: Number(newItem.price || 0),
                cost: Number(newItem.cost || 0),
                stock: newItem.stock !== '' ? Number(newItem.stock) : null,
                is_service: Boolean(newItem.is_service),
                branch_id: Number(branchId),
            });
            setIsAddItemOpen(false);
            setNewItem({ name: '', category_id: '', sku: '', price: '', cost: '', stock: '', is_service: false });
            await loadCatalog(branchId);
            if (res.data?.id != null) setSelectedItemId(String(res.data.id));
        } catch (err) {
            alert(err.response?.data?.message || 'Failed to add item.');
        }
    };

    const createCategory = async (e) => {
        e.preventDefault();
        try {
            await axios.post('/api/stock-management/categories', newCategory);
            setIsAddCategoryOpen(false);
            setNewCategory({ name: '', type: 'product' });
            await loadCatalog(branchId);
        } catch (err) {
            alert(err.response?.data?.message || 'Failed to add category.');
        }
    };

    const tabConfig = [
        { key: 'receipt', label: 'Stock In', icon: ArrowDownCircle, helper: 'Record stocks bought or received from supplier.' },
        { key: 'issue', label: 'Stock Out', icon: ArrowUpCircle, helper: 'Record stock used, transferred, or dispatched.' },
    ];

    const entryTitle = tab === 'receipt' ? 'Add Stock In' : 'Add Stock Out';

    const qtyLabel = tab === 'receipt' ? 'Quantity received' : 'Quantity issued';

    const canEdit = tab !== 'sales';

    return (
        <div className="max-w-7xl mx-auto flex flex-col gap-4">
            <div className="bg-white border border-[#cbcbcb] rounded-2xl shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-[#cbcbcb]">
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                        <div className="min-w-0">
                            <div className="flex items-center gap-2">
                                <h1 className="text-2xl md:text-3xl font-semibold text-[#818181] tracking-tight">Stock Management</h1>
                                <span className="text-[10px] font-semibold uppercase tracking-widest px-2 py-1 rounded-full border border-[#cbcbcb] bg-[#dddddd] text-[#a6a6a6]">
                                    Movements
                                </span>
                            </div>
                            <p className="text-[#a6a6a6] font-medium text-sm md:text-base">
                                Record stock changes here. Inventory is read-only and shows snapshots.
                            </p>
                        </div>

                        <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
                            <select
                                value={branchId}
                                onChange={(e) => setBranchId(e.target.value)}
                                disabled={branchesLoading || branches.length === 0}
                                aria-label="Select branch"
                                className="h-11 px-4 bg-white border border-[#cbcbcb] rounded-xl hover:bg-[#dddddd] transition-all font-medium text-sm shadow-sm disabled:opacity-50"
                            >
                                {branchesLoading ? <option value="">{`Loading branches${ELLIPSIS}`}</option> : null}
                                {!branchesLoading && branches.length === 0 ? <option value="">No branches</option> : null}
                                {branches.map((b) => (
                                    <option key={b.id} value={String(b.id)} disabled={!b.is_active}>
                                        {b.name}
                                        {!b.is_active ? ' (Inactive)' : ''}
                                    </option>
                                ))}
                            </select>

                            <Menu as="div" className="relative">
                                <Menu.Button
                                    type="button"
                                    aria-label="Catalog actions"
                                    title="Catalog actions"
                                    className="h-11 inline-flex items-center justify-center gap-2 px-5 rounded-xl bg-[#818181] text-white hover:bg-[#818181] active:bg-[#818181]/90 transition-all font-semibold text-sm shadow-md shadow-black/10"
                                >
                                    <Plus size={18} /> Add
                                </Menu.Button>
                                <Transition
                                    as={Fragment}
                                    enter="transition ease-out duration-100"
                                    enterFrom="transform opacity-0 scale-95"
                                    enterTo="transform opacity-100 scale-100"
                                    leave="transition ease-in duration-75"
                                    leaveFrom="transform opacity-100 scale-100"
                                    leaveTo="transform opacity-0 scale-95"
                                >
                                    <Menu.Items className="absolute right-0 mt-2 w-64 origin-top-right rounded-2xl border border-[#cbcbcb] bg-white shadow-xl focus:outline-none overflow-hidden z-50">
                                        <div className="py-1">
                                            <Menu.Item>
                                                {({ active }) => (
                                                    <button
                                                        type="button"
                                                        onClick={() => setIsAddItemOpen(true)}
                                                        className={`w-full px-4 py-3 text-left text-sm font-semibold inline-flex items-center gap-2 ${
                                                            active ? 'bg-[#dddddd] text-[#818181]' : 'text-[#818181]'
                                                        }`}
                                                    >
                                                        <Package size={16} className="text-[#a6a6a6]" />
                                                        Add Item
                                                    </button>
                                                )}
                                            </Menu.Item>
                                            <Menu.Item>
                                                {({ active }) => (
                                                    <button
                                                        type="button"
                                                        onClick={() => setIsAddCategoryOpen(true)}
                                                        className={`w-full px-4 py-3 text-left text-sm font-semibold inline-flex items-center gap-2 ${
                                                            active ? 'bg-[#dddddd] text-[#818181]' : 'text-[#818181]'
                                                        }`}
                                                    >
                                                        <Plus size={16} className="text-[#a6a6a6]" />
                                                        Add Category
                                                    </button>
                                                )}
                                            </Menu.Item>
                                        </div>
                                    </Menu.Items>
                                </Transition>
                            </Menu>
                        </div>
                    </div>
                </div>

                <div className="px-5 py-4 border-b border-[#cbcbcb]">
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                        <div className="flex flex-wrap gap-2">
                            {tabConfig.map((t) => {
                                const active = t.key === tab;
                                return (
                                    <button
                                        key={t.key}
                                        type="button"
                                        onClick={() => setTab(t.key)}
                                        aria-pressed={active}
                                        className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-semibold transition-colors ${
                                            active ? 'border-[#818181] bg-[#818181] text-white' : 'border-[#cbcbcb] bg-white text-[#818181] hover:bg-[#dddddd]'
                                        }`}
                                    >
                                        <t.icon size={16} />
                                        {t.label}
                                    </button>
                                );
                            })}
                        </div>
                        <div className="text-xs font-medium text-[#a6a6a6]">{tabConfig.find((t) => t.key === tab)?.helper}</div>
                    </div>
                </div>

                <div className="p-5 grid grid-cols-1 lg:grid-cols-3 gap-4">
                    <div className="lg:col-span-1 rounded-2xl border border-[#cbcbcb] bg-white overflow-hidden">
                        <div className="px-4 py-3 border-b border-[#cbcbcb]">
                            <div className="text-sm font-semibold text-[#818181]">{entryTitle}</div>
                            {selectedItem ? (
                                <div className="text-[11px] font-medium text-[#a6a6a6] uppercase tracking-widest mt-1">
                                    Current stock: {selectedItem.is_service ? EM_DASH : Number(selectedItem.stock_qty || 0)}
                                </div>
                            ) : null}
                        </div>

                        <div className="p-4 space-y-3">
                            <div>
                                <label className="block text-[10px] font-semibold text-[#a6a6a6] uppercase tracking-widest mb-1" htmlFor="sm-item-search">
                                    Find item
                                </label>
                                <input
                                    id="sm-item-search"
                                    type="text"
                                    value={itemSearch}
                                    onChange={(e) => setItemSearch(e.target.value)}
                                    placeholder={`Search by name or SKU${ELLIPSIS}`}
                                    className="w-full px-3 py-2.5 border border-[#cbcbcb] rounded-xl text-sm font-medium text-[#818181] bg-white"
                                />
                            </div>

                            <div>
                                <label className="block text-[10px] font-semibold text-[#a6a6a6] uppercase tracking-widest mb-1" htmlFor="sm-item">
                                    Item
                                </label>
                                <select
                                    id="sm-item"
                                    value={selectedItemId}
                                    onChange={(e) => setSelectedItemId(e.target.value)}
                                    disabled={itemsLoading || filteredItems.length === 0}
                                    className="w-full px-3 py-2.5 border border-[#cbcbcb] rounded-xl text-sm font-semibold text-[#818181] bg-white disabled:opacity-50"
                                >
                                    <option value="">Select item</option>
                                    {filteredItems.slice(0, 500).map((it) => (
                                        <option key={it.id} value={String(it.id)}>
                                            {it.name} {it.sku ? `(${it.sku})` : ''} {it.is_service ? '[Service]' : ''}
                                        </option>
                                    ))}
                                </select>
                                {filteredItems.length > 500 ? (
                                    <div className="text-[11px] font-medium text-[#a6a6a6] mt-1">Showing first 500 matches. Refine your search.</div>
                                ) : null}
                            </div>

                            {tab !== 'sales' ? (
                                <div>
                                    <label className="block text-[10px] font-semibold text-[#a6a6a6] uppercase tracking-widest mb-1" htmlFor="sm-qty">
                                        {qtyLabel}
                                    </label>
                                    <input
                                        id="sm-qty"
                                        type="number"
                                        inputMode="numeric"
                                        value={qty}
                                        onChange={(e) => setQty(e.target.value)}
                                        className="w-full px-3 py-2.5 border border-[#cbcbcb] rounded-xl text-sm font-semibold text-[#818181] bg-white"
                                    />
                                </div>
                            ) : null}

                            {tab === 'receipt' ? (
                                <>
                                    <button
                                        type="button"
                                        onClick={() => setIsStockInDetailsOpen((v) => !v)}
                                        aria-expanded={isStockInDetailsOpen}
                                        className="w-full px-3 py-2 rounded-xl border border-[#cbcbcb] bg-white text-xs font-semibold text-[#818181] hover:bg-[#dddddd]"
                                    >
                                        {isStockInDetailsOpen ? 'Hide supplier details' : 'Add supplier details (optional)'}
                                    </button>
                                    {isStockInDetailsOpen ? (
                                        <>
                                            <div>
                                                <label className="block text-[10px] font-semibold text-[#a6a6a6] uppercase tracking-widest mb-1" htmlFor="sm-supplier">
                                                    Supplier (optional)
                                                </label>
                                                <input
                                                    id="sm-supplier"
                                                    type="text"
                                                    value={supplier}
                                                    onChange={(e) => setSupplier(e.target.value)}
                                                    className="w-full px-3 py-2.5 border border-[#cbcbcb] rounded-xl text-sm font-medium text-[#818181] bg-white"
                                                />
                                            </div>
                                            <div className="grid grid-cols-2 gap-2">
                                                <div>
                                                    <label className="block text-[10px] font-semibold text-[#a6a6a6] uppercase tracking-widest mb-1" htmlFor="sm-unit-cost">
                                                        Unit cost (optional)
                                                    </label>
                                                    <input
                                                        id="sm-unit-cost"
                                                        type="number"
                                                        value={unitCost}
                                                        onChange={(e) => setUnitCost(e.target.value)}
                                                        className="w-full px-3 py-2.5 border border-[#cbcbcb] rounded-xl text-sm font-medium text-[#818181] bg-white"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-[10px] font-semibold text-[#a6a6a6] uppercase tracking-widest mb-1" htmlFor="sm-receipt-date">
                                                        Purchase date (optional)
                                                    </label>
                                                    <input
                                                        id="sm-receipt-date"
                                                        type="date"
                                                        value={receiptDate}
                                                        onChange={(e) => setReceiptDate(e.target.value)}
                                                        className="w-full px-3 py-2.5 border border-[#cbcbcb] rounded-xl text-sm font-medium text-[#818181] bg-white"
                                                    />
                                                </div>
                                            </div>
                                        </>
                                    ) : null}
                                </>
                            ) : null}

                            <div>
                                <label className="block text-[10px] font-semibold text-[#a6a6a6] uppercase tracking-widest mb-1" htmlFor="sm-ref">
                                    Reference (optional)
                                </label>
                                <input
                                    id="sm-ref"
                                    type="text"
                                    value={reference}
                                    onChange={(e) => setReference(e.target.value)}
                                    className="w-full px-3 py-2.5 border border-[#cbcbcb] rounded-xl text-sm font-medium text-[#818181] bg-white"
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-semibold text-[#a6a6a6] uppercase tracking-widest mb-1" htmlFor="sm-notes">
                                    Notes (optional)
                                </label>
                                <input
                                    id="sm-notes"
                                    type="text"
                                    value={notes}
                                    onChange={(e) => setNotes(e.target.value)}
                                    className="w-full px-3 py-2.5 border border-[#cbcbcb] rounded-xl text-sm font-medium text-[#818181] bg-white"
                                />
                            </div>

                            {canEdit ? (
                                <div className="flex gap-2">
                                    <button
                                        type="button"
                                        onClick={submitMovement}
                                        disabled={!branchId || !selectedItemId}
                                        className="flex-1 h-11 rounded-xl bg-[#818181] text-white text-sm font-semibold hover:bg-[#818181] active:bg-[#818181]/90 disabled:opacity-50"
                                    >
                                        Save
                                    </button>
                                    <button
                                        type="button"
                                        onClick={resetEntryForm}
                                        className="h-11 px-4 rounded-xl border border-[#cbcbcb] bg-white text-sm font-semibold text-[#818181] hover:bg-[#dddddd]"
                                    >
                                        Clear
                                    </button>
                                </div>
                            ) : (
                                <div className="text-sm font-medium text-[#a6a6a6]">Sales entries are recorded automatically from POS sales.</div>
                            )}
                        </div>
                    </div>

                    <div className="lg:col-span-2 rounded-2xl border border-[#cbcbcb] bg-white overflow-hidden">
                        <div className="px-4 py-3 border-b border-[#cbcbcb] flex items-center justify-between gap-3">
                            <div className="text-sm font-semibold text-[#818181]">Recent entries</div>
                            <button
                                type="button"
                                onClick={() => loadMovements(branchId, tab)}
                                className="h-9 px-3 rounded-xl border border-[#cbcbcb] bg-white text-xs font-semibold text-[#818181] hover:bg-[#dddddd]"
                            >
                                Refresh
                            </button>
                        </div>

                        {movementsError ? (
                            <div className="p-4 text-sm font-medium text-[#818181] bg-[#dddddd] border-b border-red-100">{movementsError}</div>
                        ) : null}

                        <div className="overflow-auto" style={{maxHeight: 'calc(100vh - 26rem)'}}>
                            <table className="w-full text-left">
                                <thead className="sticky top-0 bg-white z-10">
                                    <tr className="text-[#a6a6a6] text-xs font-semibold uppercase tracking-widest border-b border-[#cbcbcb]">
                                        <th className="px-4 py-3">Time</th>
                                        <th className="px-4 py-3">Item</th>
                                        <th className="px-4 py-3">Change</th>
                                        <th className="px-4 py-3">New</th>
                                        <th className="px-4 py-3">Ref</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-[#cbcbcb]">
                                    {movementsLoading ? (
                                        Array.from({ length: 10 }).map((_, idx) => (
                                            <tr key={`mv-skel-${idx}`}>
                                                <td className="px-4 py-3"><div className="h-4 w-24 bg-zinc-200 rounded animate-pulse" /></td>
                                                <td className="px-4 py-3"><div className="h-4 w-48 bg-zinc-200 rounded animate-pulse" /></td>
                                                <td className="px-4 py-3"><div className="h-4 w-16 bg-zinc-200 rounded animate-pulse" /></td>
                                                <td className="px-4 py-3"><div className="h-4 w-12 bg-zinc-200 rounded animate-pulse" /></td>
                                                <td className="px-4 py-3"><div className="h-4 w-24 bg-zinc-200 rounded animate-pulse" /></td>
                                            </tr>
                                        ))
                                    ) : (
                                        movements.map((m) => {
                                            const delta = Number(m?.change_qty || 0);
                                            const isNeg = delta < 0;
                                            const when = m?.created_at ? new Date(m.created_at) : null;
                                            return (
                                                <tr key={m.id} className="hover:bg-[#dddddd] transition-colors">
                                                    <td className="px-4 py-3 text-xs font-medium text-[#a6a6a6] whitespace-nowrap">
                                                        {when ? when.toLocaleString() : EM_DASH}
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <div className="text-sm font-semibold text-[#818181]">{m?.item?.name || EM_DASH}</div>
                                                        <div className="text-[10px] font-medium text-[#a6a6a6] uppercase tracking-widest">
                                                            {m?.reason || EM_DASH} {m?.item?.sku ? `${BULLET} ${m.item.sku}` : ''}
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <span className={`text-sm font-semibold px-2 py-1 rounded-lg border ${isNeg ? 'bg-[#dddddd] text-[#818181] border-[#cbcbcb]' : 'bg-[#dddddd] text-[#818181] border-[#cbcbcb]'}`}>
                                                            {delta > 0 ? `+${delta}` : `${delta}`}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-3 text-sm font-semibold text-[#818181]">{m?.new_qty ?? EM_DASH}</td>
                                                    <td className="px-4 py-3 text-xs font-medium text-[#a6a6a6]">
                                                        <div className="truncate max-w-[180px]">{m?.reference || EM_DASH}</div>
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    )}
                                    {!movementsLoading && movements.length === 0 ? (
                                        <tr>
                                            <td colSpan={5} className="px-4 py-10 text-center text-sm font-medium text-[#a6a6a6]">
                                                No entries yet.
                                            </td>
                                        </tr>
                                    ) : null}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>

            <Transition appear show={isAddItemOpen} as={Fragment}>
                <Dialog as="div" className="relative z-50" onClose={() => setIsAddItemOpen(false)}>
                    <Transition.Child as={Fragment} enter="ease-out duration-300" enterFrom="opacity-0" enterTo="opacity-100" leave="ease-in duration-200" leaveFrom="opacity-100" leaveTo="opacity-0">
                        <button type="button" className="fixed inset-0 bg-[#818181]/20 backdrop-blur-sm" onClick={() => setIsAddItemOpen(false)} aria-label="Close add item modal" />
                    </Transition.Child>
                    <div className="fixed inset-0 overflow-y-auto">
                        <div className="flex min-h-full items-center justify-center p-4">
                            <Transition.Child as={Fragment} enter="ease-out duration-300" enterFrom="opacity-0 scale-95" enterTo="opacity-100 scale-100" leave="ease-in duration-200" leaveFrom="opacity-100 scale-100" leaveTo="opacity-0 scale-95">
                                <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-white p-8 shadow-2xl transition-all border border-[#19140015]">
                                    <div className="flex items-center justify-between mb-6">
                                        <Dialog.Title as="h3" className="text-xl font-semibold text-[#818181] tracking-tight">
                                            Add Item
                                        </Dialog.Title>
                                        <button onClick={() => setIsAddItemOpen(false)} className="text-[#a6a6a6] hover:text-[#818181] transition-colors" aria-label="Close">
                                            <X size={20} />
                                        </button>
                                    </div>
                                    <form onSubmit={createItem} className="space-y-4">
                                        <div>
                                            <label className="block text-xs font-semibold text-[#a6a6a6] uppercase tracking-widest mb-1">Item Name</label>
                                            <input
                                                type="text"
                                                required
                                                value={newItem.name}
                                                onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
                                                className="w-full px-4 py-2 border border-[#19140035] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#818181]/10 text-sm font-medium"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-semibold text-[#a6a6a6] uppercase tracking-widest mb-1">SKU (optional)</label>
                                            <input
                                                type="text"
                                                value={newItem.sku}
                                                onChange={(e) => setNewItem({ ...newItem, sku: e.target.value })}
                                                className="w-full px-4 py-2 border border-[#19140035] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#818181]/10 text-sm font-medium"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-semibold text-[#a6a6a6] uppercase tracking-widest mb-1">Category</label>
                                            <select
                                                required
                                                value={newItem.category_id}
                                                onChange={(e) => {
                                                    const cat = categoriesForSelect.find((c) => String(c.id) === String(e.target.value));
                                                    setNewItem({ ...newItem, category_id: e.target.value, is_service: cat?.type === 'service' });
                                                }}
                                                className="w-full px-4 py-2 border border-[#19140035] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#818181]/10 text-sm font-medium"
                                            >
                                                <option value="">Select Category</option>
                                                {categoriesForSelect.map((cat) => (
                                                    <option key={cat.id} value={String(cat.id)}>
                                                        {cat.name} ({cat.type})
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-xs font-semibold text-[#a6a6a6] uppercase tracking-widest mb-1">Price ({PESO})</label>
                                                <input
                                                    type="number"
                                                    required
                                                    value={newItem.price}
                                                    onChange={(e) => setNewItem({ ...newItem, price: e.target.value })}
                                                    className="w-full px-4 py-2 border border-[#19140035] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#818181]/10 text-sm font-medium"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-semibold text-[#a6a6a6] uppercase tracking-widest mb-1">Cost ({PESO})</label>
                                                <input
                                                    type="number"
                                                    required
                                                    value={newItem.cost}
                                                    onChange={(e) => setNewItem({ ...newItem, cost: e.target.value })}
                                                    className="w-full px-4 py-2 border border-[#19140035] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#818181]/10 text-sm font-medium"
                                                />
                                            </div>
                                            {!newItem.is_service && (
                                                <div className="col-span-2">
                                                    <label className="block text-xs font-semibold text-[#a6a6a6] uppercase tracking-widest mb-1">Initial Stocks</label>
                                                    <input
                                                        type="number"
                                                        value={newItem.stock}
                                                        onChange={(e) => setNewItem({ ...newItem, stock: e.target.value })}
                                                        className="w-full px-4 py-2 border border-[#19140035] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#818181]/10 text-sm font-medium"
                                                    />
                                                </div>
                                            )}
                                        </div>
                                        <div className="pt-4">
                                            <button type="submit" className="w-full py-3 bg-[#818181] text-white rounded-xl font-semibold text-sm uppercase tracking-widest hover:bg-[#2c2c2a] transition-all shadow-lg shadow-[#81818120]">
                                                Save Item
                                            </button>
                                        </div>
                                    </form>
                                </Dialog.Panel>
                            </Transition.Child>
                        </div>
                    </div>
                </Dialog>
            </Transition>

            <Transition appear show={isAddCategoryOpen} as={Fragment}>
                <Dialog as="div" className="relative z-50" onClose={() => setIsAddCategoryOpen(false)}>
                    <Transition.Child as={Fragment} enter="ease-out duration-300" enterFrom="opacity-0" enterTo="opacity-100" leave="ease-in duration-200" leaveFrom="opacity-100" leaveTo="opacity-0">
                        <button type="button" className="fixed inset-0 bg-[#818181]/20 backdrop-blur-sm" onClick={() => setIsAddCategoryOpen(false)} aria-label="Close add category modal" />
                    </Transition.Child>
                    <div className="fixed inset-0 overflow-y-auto">
                        <div className="flex min-h-full items-center justify-center p-4">
                            <Transition.Child as={Fragment} enter="ease-out duration-300" enterFrom="opacity-0 scale-95" enterTo="opacity-100 scale-100" leave="ease-in duration-200" leaveFrom="opacity-100 scale-100" leaveTo="opacity-0 scale-95">
                                <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-white p-8 shadow-2xl transition-all border border-[#19140015]">
                                    <div className="flex items-center justify-between mb-6">
                                        <Dialog.Title as="h3" className="text-xl font-semibold text-[#818181] tracking-tight">
                                            Add Category
                                        </Dialog.Title>
                                        <button onClick={() => setIsAddCategoryOpen(false)} className="text-[#a6a6a6] hover:text-[#818181] transition-colors" aria-label="Close">
                                            <X size={20} />
                                        </button>
                                    </div>
                                    <form onSubmit={createCategory} className="space-y-4">
                                        <div>
                                            <label className="block text-xs font-semibold text-[#a6a6a6] uppercase tracking-widest mb-1">Category Name</label>
                                            <input
                                                type="text"
                                                required
                                                value={newCategory.name}
                                                onChange={(e) => setNewCategory({ ...newCategory, name: e.target.value })}
                                                className="w-full px-4 py-2 border border-[#19140035] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#818181]/10 text-sm font-medium"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-semibold text-[#a6a6a6] uppercase tracking-widest mb-1">Type</label>
                                            <select
                                                required
                                                value={newCategory.type}
                                                onChange={(e) => setNewCategory({ ...newCategory, type: e.target.value })}
                                                className="w-full px-4 py-2 border border-[#19140035] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#818181]/10 text-sm font-medium"
                                            >
                                                <option value="product">Product</option>
                                                <option value="service">Service</option>
                                            </select>
                                        </div>
                                        <div className="pt-4">
                                            <button type="submit" className="w-full py-3 bg-[#818181] text-white rounded-xl font-semibold text-sm uppercase tracking-widest hover:bg-[#2c2c2a] transition-all shadow-lg shadow-[#81818120]">
                                                Save Category
                                            </button>
                                        </div>
                                    </form>
                                </Dialog.Panel>
                            </Transition.Child>
                        </div>
                    </div>
                </Dialog>
            </Transition>
        </div>
    );
};

export default StockManagement;
