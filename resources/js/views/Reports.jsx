import React, { useState, useEffect, Fragment, useMemo } from 'react';
import axios from 'axios';
import { BarChart, TrendingUp, Users, Package, ArrowUpRight, ArrowDownRight, Printer, Download, Filter, X } from 'lucide-react';
import { Dialog, Transition } from '@headlessui/react';
import { useAuthStore } from '../store/authStore';

const PESO = '\u20B1';
const EM_DASH = '\u2014';

const Reports = () => {
    const { user } = useAuthStore();
    const [dailySummary, setDailySummary] = useState(null);
    const [staffPerformance, setStaffPerformance] = useState([]);
    const [staffRange, setStaffRange] = useState('month');
    const [inventoryValuation, setInventoryValuation] = useState(null);
    const [revenueRange, setRevenueRange] = useState('week');
    const [revenueTrend, setRevenueTrend] = useState(null);
    const [hoveredRevenueIndex, setHoveredRevenueIndex] = useState(null);
    const [hoveredRevenuePos, setHoveredRevenuePos] = useState({ x: 0, y: 0 });
    const [summaryLoading, setSummaryLoading] = useState(true);
    const [staffLoading, setStaffLoading] = useState(true);
    const [valuationLoading, setValuationLoading] = useState(true);
    const [revenueLoading, setRevenueLoading] = useState(true);
    const [error, setError] = useState('');

    const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
    const [printPeriod, setPrintPeriod] = useState('daily');
    const [salesDataForPrint, setSalesDataForPrint] = useState(null);
    const [isFetchingPrintData, setIsFetchingPrintData] = useState(false);

    const isAdmin = user?.role === 'admin';

    const toNumber = (value) => {
        const n = Number(value);
        return Number.isFinite(n) ? n : 0;
    };

    const formatPeso = (value) =>
        toNumber(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    const staffRangeLabel =
        staffRange === 'today' ? 'Today' : staffRange === 'week' ? 'Weekly' : staffRange === 'month' ? 'Monthly' : 'Yearly';
    const revenueRangeLabel = revenueRange === 'month' ? 'Monthly' : revenueRange === 'year' ? 'Yearly' : 'Weekly';

    useEffect(() => {
        if (!isAdmin) return;
        let cancelled = false;
        const fetchSummary = async () => {
            setSummaryLoading(true);
            setValuationLoading(true);
            setError('');
            try {
                const [dailyRes, invRes] = await Promise.all([axios.get('/api/reports/daily-summary'), axios.get('/api/reports/inventory-valuation')]);
                if (!cancelled) {
                    setDailySummary(dailyRes.data);
                    setInventoryValuation(invRes.data);
                }
            } catch (err) {
                if (!cancelled) setError(err.response?.data?.message || 'Failed to fetch reports');
            } finally {
                if (!cancelled) {
                    setSummaryLoading(false);
                    setValuationLoading(false);
                }
            }
        };
        fetchSummary();
        return () => {
            cancelled = true;
        };
    }, [isAdmin]);

    useEffect(() => {
        if (!isAdmin) return;
        let cancelled = false;
        const fetchRevenue = async () => {
            setRevenueLoading(true);
            setError('');
            try {
                const revenueUrl = revenueRange === 'year' ? '/api/reports/yearly-revenue' : revenueRange === 'month' ? '/api/reports/monthly-revenue' : '/api/reports/weekly-revenue';
                const res = await axios.get(revenueUrl);
                if (!cancelled) setRevenueTrend(res.data);
            } catch (err) {
                if (!cancelled) setError(err.response?.data?.message || 'Failed to fetch reports');
            } finally {
                if (!cancelled) setRevenueLoading(false);
            }
        };
        fetchRevenue();
        return () => {
            cancelled = true;
        };
    }, [isAdmin, revenueRange]);

    useEffect(() => {
        if (!isAdmin) return;
        let cancelled = false;
        const fetchStaff = async () => {
            setStaffLoading(true);
            setError('');
            try {
                const res = await axios.get(`/api/reports/staff-performance?range=${encodeURIComponent(staffRange)}`);
                if (!cancelled) setStaffPerformance(res.data);
            } catch (err) {
                if (!cancelled) setError(err.response?.data?.message || 'Failed to fetch reports');
            } finally {
                if (!cancelled) setStaffLoading(false);
            }
        };
        fetchStaff();
        return () => {
            cancelled = true;
        };
    }, [isAdmin, staffRange]);

    const handlePrintClick = () => {
        setIsPrintModalOpen(true);
    };

    const executePrint = async () => {
        setIsFetchingPrintData(true);
        try {
            const today = new Date();
            let startDate, endDate;
            if (printPeriod === 'daily') {
                startDate = today.toISOString().split('T')[0];
                endDate = startDate;
            } else if (printPeriod === 'weekly') {
                const start = new Date(today);
                start.setDate(today.getDate() - 6);
                startDate = start.toISOString().split('T')[0];
                endDate = today.toISOString().split('T')[0];
            } else if (printPeriod === 'monthly') {
                const start = new Date(today);
                start.setMonth(today.getMonth() - 1);
                startDate = start.toISOString().split('T')[0];
                endDate = today.toISOString().split('T')[0];
            } else if (printPeriod === 'yearly') {
                const start = new Date(today);
                start.setFullYear(today.getFullYear() - 1);
                startDate = start.toISOString().split('T')[0];
                endDate = today.toISOString().split('T')[0];
            }

            const res = await axios.get(`/api/sales?start_date=${startDate}&end_date=${endDate}`);
            setSalesDataForPrint(res.data);
            setIsPrintModalOpen(false);
            setTimeout(() => {
                window.print();
            }, 500);
        } catch (err) {
            setError('Failed to fetch sales data for printing.');
            setIsPrintModalOpen(false);
        } finally {
            setIsFetchingPrintData(false);
        }
    };

    const printSalesItems = useMemo(() => {
        if (!salesDataForPrint) return [];
        const items = [];
        salesDataForPrint.forEach((sale) => {
            const date = new Date(sale.created_at).toLocaleDateString();
            const cashier = sale.staff?.name || 'Unknown';
            sale.sale_items?.forEach((si) => {
                items.push({
                    date,
                    productName: si.item?.name || 'Unknown Item',
                    quantity: si.quantity,
                    unitPrice: si.price_at_time,
                    totalSales: si.quantity * si.price_at_time,
                    cashier,
                });
            });
            sale.custom_items?.forEach((ci) => {
                items.push({
                    date,
                    productName: ci.name || 'Custom Item',
                    quantity: ci.quantity,
                    unitPrice: ci.price,
                    totalSales: ci.quantity * ci.price,
                    cashier,
                });
            });
        });
        return items;
    }, [salesDataForPrint]);

    const handleExportCsv = () => {
        const escape = (v) => {
            const s = String(v ?? '');
            if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
            return s;
        };

        const rows = [];
        rows.push(['Report Generated At', new Date().toISOString()]);
        rows.push([]);
        rows.push(['Daily Summary']);
        rows.push(['Date', dailySummary?.date || '']);
        rows.push(['Total Revenue', formatPeso(dailySummary?.total_revenue)]);
        rows.push(['Total Transactions', toNumber(dailySummary?.total_transactions)]);
        rows.push(['Total Discount', formatPeso(dailySummary?.total_discount)]);
        rows.push([]);
        rows.push([`${revenueRangeLabel} Revenue Trend`]);
        rows.push(['Start Date', revenueTrend?.start_date || '']);
        rows.push(['End Date', revenueTrend?.end_date || '']);
        rows.push(['Date', 'Total Revenue', 'Total Transactions']);
        (revenueTrend?.days || []).forEach((d) => {
            rows.push([d.date, formatPeso(d.total_revenue), toNumber(d.total_transactions)]);
        });
        rows.push([]);
        rows.push([`Staff Performance (${staffRangeLabel})`]);
        rows.push(['Staff Name', 'Sales Count', 'Total Revenue']);
        staffPerformance.forEach((s) => {
            rows.push([s.name || '', toNumber(s.sales_count), formatPeso(s.sales_sum_total_amount)]);
        });
        rows.push([]);
        rows.push(['Inventory Valuation']);
        rows.push(['Total Valuation', formatPeso(inventoryValuation?.total_valuation)]);

        const csv = rows.map((r) => r.map(escape).join(',')).join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `reports_${new Date().toISOString().slice(0, 10)}.csv`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
    };

    const toggleStaffRange = () => {
        setStaffRange((prev) => (prev === 'year' ? 'month' : prev === 'month' ? 'week' : prev === 'week' ? 'today' : 'year'));
    };

    if (!isAdmin) {
        return <div className="text-red-500 font-medium p-8 bg-[#dddddd] rounded-xl border border-red-100">Access Denied: Admin privileges required.</div>;
    }

    return (
        <Fragment>
            <div className="space-y-8 max-w-7xl mx-auto pb-12 print:hidden">
                <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                    <div className="space-y-1">
                        <h1 className="text-3xl font-semibold text-[#818181] tracking-tight">Admin Management Suite</h1>
                        <p className="text-[#a6a6a6] font-medium">Comprehensive business analytics and staff performance metrics.</p>
                    </div>
                    <div className="flex gap-3">
                        <button
                            onClick={handlePrintClick}
                        className="flex items-center gap-2 px-5 py-2.5 bg-white border border-[#cbcbcb] text-[#818181] rounded-xl hover:bg-[#dddddd] transition-all font-medium text-sm shadow-sm"
                    >
                        <Printer size={18} /> Print Report
                    </button>
                    <button
                        onClick={handleExportCsv}
                        className="flex items-center gap-2 px-5 py-2.5 bg-[#818181] text-white rounded-xl hover:bg-[#3f3f46] transition-colors font-medium text-sm shadow-sm"
                    >
                        <Download size={18} /> Export CSV
                    </button>
                </div>
            </header>

            {error ? (
                <div className="p-3 bg-[#dddddd] text-[#818181] border border-red-100 rounded-lg text-sm">{error}</div>
            ) : null}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white border border-[#cbcbcb] p-6 rounded-2xl shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                        <span className="p-2 bg-[#dddddd] text-green-600 rounded-lg"><TrendingUp size={20} /></span>
                        <span className="flex items-center gap-1 text-green-600 text-xs font-semibold uppercase tracking-tighter"><ArrowUpRight size={14} /> +12.5%</span>
                    </div>
                    <h3 className="text-sm font-semibold text-[#a6a6a6] uppercase tracking-widest">Today's Revenue</h3>
                    <p className={`text-3xl font-semibold mt-1 tracking-tighter ${summaryLoading && !dailySummary ? 'text-[#a6a6a6] animate-pulse' : 'text-[#818181]'}`}>
                        {PESO}{summaryLoading && !dailySummary ? EM_DASH : formatPeso(dailySummary?.total_revenue)}
                    </p>
                </div>

                <div className="bg-white border border-[#cbcbcb] p-6 rounded-2xl shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                        <span className="p-2 bg-[#dddddd] text-blue-600 rounded-lg"><Users size={20} /></span>
                        <span className="flex items-center gap-1 text-red-400 text-xs font-semibold uppercase tracking-tighter"><ArrowDownRight size={14} /> -2.4%</span>
                    </div>
                    <h3 className="text-sm font-semibold text-[#a6a6a6] uppercase tracking-widest">Total Transactions</h3>
                    <p className={`text-3xl font-semibold mt-1 tracking-tighter ${summaryLoading && !dailySummary ? 'text-[#a6a6a6] animate-pulse' : 'text-[#818181]'}`}>
                        {summaryLoading && !dailySummary ? EM_DASH : toNumber(dailySummary?.total_transactions).toLocaleString()}
                    </p>
                </div>

                <div className="bg-white border border-[#cbcbcb] p-6 rounded-2xl shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                        <span className="p-2 bg-[#dddddd] text-purple-600 rounded-lg"><Package size={20} /></span>
                    </div>
                    <h3 className="text-sm font-semibold text-[#a6a6a6] uppercase tracking-widest">Inventory Valuation</h3>
                    <p className={`text-3xl font-semibold mt-1 tracking-tighter ${valuationLoading && !inventoryValuation ? 'text-[#a6a6a6] animate-pulse' : 'text-[#818181]'}`}>
                        {PESO}{valuationLoading && !inventoryValuation ? EM_DASH : formatPeso(inventoryValuation?.total_valuation)}
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Staff Performance */}
                <div className="bg-white border border-[#cbcbcb] rounded-2xl shadow-sm overflow-hidden">
                    <header className="p-6 border-b border-[#19140015] flex items-center justify-between bg-white/70 backdrop-blur">
                        <div className="flex items-center gap-2">
                            <Users size={18} className="text-[#818181]" />
                            <h2 className="text-sm font-semibold text-[#818181] uppercase tracking-widest">Top Performing Staff</h2>
                        </div>
                        <button
                            type="button"
                            onClick={toggleStaffRange}
                            className="text-xs font-semibold text-[#a6a6a6] hover:text-[#818181] transition-all uppercase tracking-widest flex items-center gap-1 underline underline-offset-4 decoration-[#19140015]"
                        >
                            {staffRangeLabel} <Filter size={12} />
                        </button>
                    </header>
                    <div className="p-6">
                        {staffLoading ? (
                            <div className="text-[#a6a6a6] animate-pulse font-medium">Loading staff performance...</div>
                        ) : staffPerformance.length === 0 ? (
                            <div className="text-[#a6a6a6] font-medium">No staff data for this period.</div>
                        ) : (
                            <div className="space-y-6">
                                {staffPerformance.map((staff, i) => (
                                    <div key={staff.id} className="flex items-center gap-4 group">
                                        <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center text-[#4a2437] font-semibold text-xs border border-[#19140015] group-hover:bg-gradient-to-r group-hover:from-[#4a2437] group-hover:to-[#d94a79] group-hover:text-white transition-all shadow-sm">#{i + 1}</div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-semibold text-[#818181] truncate">{staff.name}</p>
                                            <p className="text-xs text-[#a6a6a6] font-medium italic">{staff.sales_count} sales processed</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-sm font-semibold text-[#818181]">{PESO}{formatPeso(staff.sales_sum_total_amount)}</p>
                                            <div className="w-24 h-1.5 bg-[#dddddd] rounded-full mt-2 overflow-hidden border border-[#1914000d]">
                                                <div
                                                    className="h-full bg-gradient-to-r from-[#4a2437] to-[#d94a79] rounded-full transition-all duration-1000"
                                                    style={{ width: `${(toNumber(staff.sales_sum_total_amount) / (toNumber(staffPerformance[0]?.sales_sum_total_amount) || 1)) * 100}%` }}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Revenue Trend */}
                <div className="bg-white border border-[#cbcbcb] rounded-2xl shadow-sm overflow-hidden flex flex-col">
                    <header className="p-6 border-b border-[#19140015] flex items-center justify-between bg-white/70 backdrop-blur">
                        <div className="flex items-center gap-2">
                            <BarChart size={18} className="text-[#818181]" />
                            <h2 className="text-sm font-semibold text-[#818181] uppercase tracking-widest">{revenueRangeLabel} Revenue Trend</h2>
                        </div>
                        <div className="flex items-center gap-1 p-1 bg-white border border-[#19140015] rounded-2xl shadow-sm">
                            <button
                                type="button"
                                onClick={() => setRevenueRange('week')}
                                className={`h-8 px-3 rounded-xl text-[11px] font-semibold uppercase tracking-widest transition-all ${
                                    revenueRange === 'week' ? 'bg-[#818181] text-white' : 'text-[#a6a6a6] hover:text-[#818181] hover:bg-[#fff7f9]'
                                }`}
                            >
                                Weekly
                            </button>
                            <button
                                type="button"
                                onClick={() => setRevenueRange('month')}
                                className={`h-8 px-3 rounded-xl text-[11px] font-semibold uppercase tracking-widest transition-all ${
                                    revenueRange === 'month' ? 'bg-[#818181] text-white' : 'text-[#a6a6a6] hover:text-[#818181] hover:bg-[#fff7f9]'
                                }`}
                            >
                                Monthly
                            </button>
                            <button
                                type="button"
                                onClick={() => setRevenueRange('year')}
                                className={`h-8 px-3 rounded-xl text-[11px] font-semibold uppercase tracking-widest transition-all ${
                                    revenueRange === 'year' ? 'bg-[#818181] text-white' : 'text-[#a6a6a6] hover:text-[#818181] hover:bg-[#fff7f9]'
                                }`}
                            >
                                Yearly
                            </button>
                        </div>
                    </header>
                    <div className="flex-1 p-8 overflow-x-auto">
                        {revenueLoading ? (
                            <div className="text-[#a6a6a6] animate-pulse font-medium min-h-[300px] flex items-center">
                                Loading revenue trend...
                            </div>
                        ) : (revenueTrend?.days || []).length === 0 ? (
                            <div className="text-[#a6a6a6] font-medium min-h-[300px] flex items-center">
                                No revenue data for this period.
                            </div>
                        ) : (
                            (() => {
                                const days = revenueTrend?.days || [];
                                const max = Math.max(...days.map((x) => toNumber(x.total_revenue)), 1);
                                const width = Math.max(7, days.length) * 44;
                                const height = 300;
                                const pad = { left: 52, right: 16, top: 18, bottom: 38 };
                                const chartW = Math.max(1, width - pad.left - pad.right);
                                const chartH = Math.max(1, height - pad.top - pad.bottom);
                                const points = days.map((d, idx) => {
                                    const val = toNumber(d.total_revenue);
                                    const t = days.length <= 1 ? 0 : idx / (days.length - 1);
                                    const x = pad.left + t * chartW;
                                    const y = pad.top + (1 - val / max) * chartH;
                                    return { x, y, val, date: d.date };
                                });
                                const dAttr = points
                                    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`)
                                    .join(' ');

                                const ticks = 4;
                                const yTicks = Array.from({ length: ticks + 1 }).map((_, i) => {
                                    const t = i / ticks;
                                    const value = (1 - t) * max;
                                    const y = pad.top + t * chartH;
                                    return { t, y, value };
                                });

                                const hovered = hoveredRevenueIndex != null ? points[hoveredRevenueIndex] : null;
                                const hoveredDateObj = hovered ? new Date(`${hovered.date}T00:00:00`) : null;
                                const hoveredLabel = hoveredDateObj
                                    ? revenueRange === 'month'
                                        ? hoveredDateObj.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
                                        : hoveredDateObj.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })
                                    : '';

                                return (
                                    <div
                                        className="relative"
                                        style={{ minWidth: `${width}px`, height: `${height}px` }}
                                        onMouseLeave={() => setHoveredRevenueIndex(null)}
                                    >
                                        {hovered ? (
                                            <div
                                                className="absolute z-10 pointer-events-none"
                                                style={{
                                                    left: hoveredRevenuePos.x,
                                                    top: hoveredRevenuePos.y,
                                                    transform: 'translate(-50%, -110%)',
                                                }}
                                            >
                                                <div className="rounded-2xl border border-[#19140015] bg-white shadow-xl px-3 py-2">
                                                    <div className="text-[10px] font-semibold text-[#a6a6a6] uppercase tracking-widest">{hoveredLabel}</div>
                                                    <div className="text-[13px] font-semibold text-[#818181]">{PESO}{formatPeso(hovered.val)}</div>
                                                </div>
                                            </div>
                                        ) : null}

                                        <svg width={width} height={height} role="img" aria-label={`${revenueRangeLabel} revenue line chart`}>
                                            <defs>
                                                <linearGradient id="revenueLine" x1="0" x2="1" y1="0" y2="0">
                                                    <stop offset="0%" stopColor="#818181" />
                                                    <stop offset="100%" stopColor="#a6a6a6" />
                                                </linearGradient>
                                            </defs>

                                            {yTicks.map((t, i) => (
                                                <g key={`y-${i}`}>
                                                    <line
                                                        x1={pad.left}
                                                        x2={width - pad.right}
                                                        y1={t.y}
                                                        y2={t.y}
                                                        stroke="rgba(25,20,0,0.08)"
                                                    />
                                                    <text
                                                        x={pad.left - 10}
                                                        y={t.y + 4}
                                                        textAnchor="end"
                                                        fontSize="10"
                                                        fontWeight="800"
                                                        fill="#000000"
                                                    >
                                                        {PESO}{formatPeso(t.value)}
                                                    </text>
                                                </g>
                                            ))}

                                            <path d={dAttr} fill="none" stroke="url(#revenueLine)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />

                                            {points.map((p, idx) => {
                                                const dateObj = new Date(`${p.date}T00:00:00`);
                                                const xLabel =
                                                    revenueRange === 'month'
                                                        ? dateObj.toLocaleDateString(undefined, { month: 'short' })
                                                        : dateObj.toLocaleDateString(undefined, { weekday: 'short' });
                                                const active = hoveredRevenueIndex === idx;
                                                return (
                                                    <g key={`p-${idx}`}>
                                                        <circle
                                                            cx={p.x}
                                                            cy={p.y}
                                                            r={active ? 6 : 4}
                                                            fill={active ? '#818181' : '#ffffff'}
                                                            stroke="#818181"
                                                            strokeWidth={active ? 3 : 2}
                                                            onMouseEnter={(e) => {
                                                                setHoveredRevenueIndex(idx);
                                                                const rect = e.currentTarget.ownerSVGElement?.getBoundingClientRect();
                                                                if (!rect) return;
                                                                setHoveredRevenuePos({
                                                                    x: e.clientX - rect.left,
                                                                    y: e.clientY - rect.top,
                                                                });
                                                            }}
                                                            onMouseMove={(e) => {
                                                                const rect = e.currentTarget.ownerSVGElement?.getBoundingClientRect();
                                                                if (!rect) return;
                                                                setHoveredRevenuePos({
                                                                    x: e.clientX - rect.left,
                                                                    y: e.clientY - rect.top,
                                                                });
                                                            }}
                                                            onClick={(e) => {
                                                                setHoveredRevenueIndex((prev) => (prev === idx ? null : idx));
                                                                const rect = e.currentTarget.ownerSVGElement?.getBoundingClientRect();
                                                                if (!rect) return;
                                                                setHoveredRevenuePos({
                                                                    x: e.clientX - rect.left,
                                                                    y: e.clientY - rect.top,
                                                                });
                                                            }}
                                                            style={{ cursor: 'pointer' }}
                                                        />
                                                        <text
                                                            x={p.x}
                                                            y={height - 14}
                                                            textAnchor="middle"
                                                            fontSize="10"
                                                            fontWeight="900"
                                                            fill="#000000"
                                                        >
                                                            {xLabel.toUpperCase()}
                                                        </text>
                                                    </g>
                                                );
                                            })}

                                            <text
                                                x={pad.left}
                                                y={pad.top - 6}
                                                textAnchor="start"
                                                fontSize="10"
                                                fontWeight="900"
                                                fill="#000000"
                                            >
                                                REVENUE
                                            </text>
                                        </svg>
                                    </div>
                                );
                            })()
                        )}
                    </div>
                </div>
            </div>
        </div>

        {/* Print Modal */}
            <Transition appear show={isPrintModalOpen} as={Fragment}>
                <Dialog as="div" className="relative z-50 print:hidden" onClose={() => setIsPrintModalOpen(false)}>
                    <Transition.Child as={Fragment} enter="ease-out duration-300" enterFrom="opacity-0" enterTo="opacity-100" leave="ease-in duration-200" leaveFrom="opacity-100" leaveTo="opacity-0">
                        <div className="fixed inset-0 bg-[#818181]/20 backdrop-blur-sm" />
                    </Transition.Child>
                    <div className="fixed inset-0 overflow-y-auto">
                        <div className="flex min-h-full items-center justify-center p-4">
                            <Transition.Child as={Fragment} enter="ease-out duration-300" enterFrom="opacity-0 scale-95" enterTo="opacity-100 scale-100" leave="ease-in duration-200" leaveFrom="opacity-100 scale-100" leaveTo="opacity-0 scale-95">
                                <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-white p-8 shadow-2xl transition-all border border-[#19140015]">
                                    <div className="flex items-center justify-between mb-6">
                                        <Dialog.Title as="h3" className="text-xl font-semibold text-[#818181] tracking-tight">
                                            Print Sales Report
                                        </Dialog.Title>
                                        <button onClick={() => setIsPrintModalOpen(false)} className="text-[#a6a6a6] hover:text-[#818181] transition-colors">
                                            <X size={20} />
                                        </button>
                                    </div>
                                    <div className="space-y-4">
                                        <div>
                                            <label className="block text-xs font-semibold text-[#a6a6a6] uppercase tracking-widest mb-1">Select Period</label>
                                            <select
                                                value={printPeriod}
                                                onChange={(e) => setPrintPeriod(e.target.value)}
                                                className="w-full px-4 py-2 border border-[#19140035] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#818181]/10 text-sm font-medium"
                                            >
                                                <option value="daily">Daily</option>
                                                <option value="weekly">Weekly</option>
                                                <option value="monthly">Monthly</option>
                                                <option value="yearly">Yearly</option>
                                            </select>
                                        </div>
                                        <div className="pt-4">
                                            <button
                                                onClick={executePrint}
                                                disabled={isFetchingPrintData}
                                                className="w-full py-3 bg-[#818181] text-white rounded-xl font-semibold text-sm uppercase tracking-widest hover:bg-[#2c2c2a] transition-all shadow-lg shadow-[#81818120] disabled:opacity-50"
                                            >
                                                {isFetchingPrintData ? 'Preparing...' : 'Generate & Print'}
                                            </button>
                                        </div>
                                    </div>
                                </Dialog.Panel>
                            </Transition.Child>
                        </div>
                    </div>
                </Dialog>
            </Transition>

            {/* Printable Report Container */}
            {salesDataForPrint && (
                <div className="hidden print:block text-black p-8 bg-white min-h-screen">
                    <div className="text-center mb-8">
                        <h1 className="text-3xl font-bold uppercase tracking-widest text-[#42b883]">{printPeriod} Sales Report</h1>
                        <p className="text-sm font-medium text-gray-500 mt-2">Generated on {new Date().toLocaleDateString()}</p>
                    </div>
                    <table className="w-full border-collapse border border-gray-300 text-sm">
                        <thead className="bg-[#42b883] text-white">
                            <tr>
                                <th className="border border-gray-300 px-4 py-2 font-semibold">Date</th>
                                <th className="border border-gray-300 px-4 py-2 font-semibold">Product Name</th>
                                <th className="border border-gray-300 px-4 py-2 font-semibold">Quantity Sold</th>
                                <th className="border border-gray-300 px-4 py-2 font-semibold text-right">Unit Price ({PESO})</th>
                                <th className="border border-gray-300 px-4 py-2 font-semibold text-right">Total Sales ({PESO})</th>
                                <th className="border border-gray-300 px-4 py-2 font-semibold">Cashier</th>
                            </tr>
                        </thead>
                        <tbody>
                            {printSalesItems.length > 0 ? (
                                printSalesItems.map((item, idx) => (
                                    <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                                        <td className="border border-gray-300 px-4 py-2 text-center">{item.date}</td>
                                        <td className="border border-gray-300 px-4 py-2">{item.productName}</td>
                                        <td className="border border-gray-300 px-4 py-2 text-center">{item.quantity}</td>
                                        <td className="border border-gray-300 px-4 py-2 text-right">{formatPeso(item.unitPrice)}</td>
                                        <td className="border border-gray-300 px-4 py-2 text-right">{formatPeso(item.totalSales)}</td>
                                        <td className="border border-gray-300 px-4 py-2 text-center">{item.cashier}</td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan="6" className="border border-gray-300 px-4 py-4 text-center font-medium text-gray-500">
                                        No sales data found for the selected period.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                        {printSalesItems.length > 0 && (
                            <tfoot>
                                <tr className="bg-gray-100 font-bold">
                                    <td colSpan="4" className="border border-gray-300 px-4 py-2 text-right">Grand Total</td>
                                    <td className="border border-gray-300 px-4 py-2 text-right">
                                        {formatPeso(printSalesItems.reduce((acc, curr) => acc + curr.totalSales, 0))}
                                    </td>
                                    <td className="border border-gray-300 px-4 py-2"></td>
                                </tr>
                            </tfoot>
                        )}
                    </table>
                </div>
            )}
        </Fragment>
    );
};

export default Reports;
