import React from 'react';
import { Package, ArrowRightLeft, Lightbulb, Clock, Layers, AlertCircle, FileText, Settings } from 'lucide-react';

const Branches = () => {
    return (
        <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in duration-500 pb-12">
            {/* Header Section */}
            <div className="bg-gradient-to-r from-[#F8F6F3] to-[#E9E1D3] rounded-3xl p-8 border border-[#19140015] relative overflow-hidden shadow-sm">
                <div className="absolute top-0 right-0 -mt-8 -mr-8 text-[#19140005]">
                    <Package size={200} />
                </div>
                <div className="relative z-10 max-w-2xl">
                    <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/60 text-[#818181] rounded-full text-xs font-bold tracking-wider mb-6 border border-[#19140010] shadow-sm">
                        <span className="w-2 h-2 rounded-full bg-[#d94a79] animate-pulse"></span>
                        COMING SOON
                    </div>
                    <h1 className="text-4xl md:text-5xl font-extrabold text-[#3f3f46] tracking-tight mb-4">
                        Master Inventory
                        <span className="block text-[#d94a79] mt-2">(BODEGA)</span>
                    </h1>
                    <p className="text-lg text-[#818181] font-medium leading-relaxed">
                        A complete Warehouse Management System designed to centralize logistics, streamline inbound/outbound transfers, and provide deeper insights into your global stock.
                    </p>
                </div>
            </div>

            {/* Content Outline Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* Bodega Dashboard Column */}
                <div className="space-y-6">
                    <div className="bg-white border border-[#19140015] rounded-3xl p-6 shadow-sm hover:shadow-md transition-shadow h-full">
                        <div className="flex items-center gap-3 mb-6 border-b border-[#19140010] pb-4">
                            <div className="w-12 h-12 bg-[#F8F6F3] rounded-2xl flex items-center justify-center text-[#d94a79]">
                                <Layers size={24} />
                            </div>
                            <div>
                                <h2 className="text-xl font-bold text-[#3f3f46]">Bodega Dashboard</h2>
                                <p className="text-sm font-semibold text-[#a6a6a6] uppercase tracking-widest">Logistics & Stocks</p>
                            </div>
                        </div>

                        <ul className="space-y-4">
                            <li className="flex items-start gap-3">
                                <div className="mt-1 flex-shrink-0 w-6 h-6 rounded-full bg-[#F8F6F3] flex items-center justify-center text-[#818181]">
                                    <span className="w-1.5 h-1.5 rounded-full bg-[#818181]"></span>
                                </div>
                                <div>
                                    <h3 className="text-sm font-bold text-[#3f3f46]">Total Capital Cost</h3>
                                    <p className="text-xs text-[#818181] mt-0.5">Track the raw investment value of all items inside the Bodega.</p>
                                </div>
                            </li>
                            <li className="flex items-start gap-3">
                                <div className="mt-1 flex-shrink-0 w-6 h-6 rounded-full bg-[#F8F6F3] flex items-center justify-center text-[#818181]">
                                    <span className="w-1.5 h-1.5 rounded-full bg-[#818181]"></span>
                                </div>
                                <div>
                                    <h3 className="text-sm font-bold text-[#3f3f46]">Total Estimated Value</h3>
                                    <p className="text-xs text-[#818181] mt-0.5">Forecasted revenue based on current selling prices.</p>
                                </div>
                            </li>
                            <li className="flex items-start gap-3">
                                <div className="mt-1 flex-shrink-0 w-6 h-6 rounded-full bg-orange-50 flex items-center justify-center text-orange-500">
                                    <Clock size={12} />
                                </div>
                                <div>
                                    <h3 className="text-sm font-bold text-[#3f3f46]">Pending Branch Requests</h3>
                                    <p className="text-xs text-[#818181] mt-0.5">Quick overview of how many items are awaiting transfer approval to branches.</p>
                                </div>
                            </li>
                            <li className="flex items-start gap-3">
                                <div className="mt-1 flex-shrink-0 w-6 h-6 rounded-full bg-red-50 flex items-center justify-center text-red-500">
                                    <AlertCircle size={12} />
                                </div>
                                <div>
                                    <h3 className="text-sm font-bold text-[#3f3f46]">Dead Stocks</h3>
                                    <p className="text-xs text-[#818181] mt-0.5">Identify items in the Bodega that haven't been transferred or moved in a long time.</p>
                                </div>
                            </li>
                        </ul>
                    </div>
                </div>

                {/* Internal Stock & Operations */}
                <div className="space-y-6">
                    <div className="bg-white border border-[#19140015] rounded-3xl p-6 shadow-sm hover:shadow-md transition-shadow h-full">
                        <div className="flex items-center gap-3 mb-6 border-b border-[#19140010] pb-4">
                            <div className="w-12 h-12 bg-[#F8F6F3] rounded-2xl flex items-center justify-center text-[#d94a79]">
                                <ArrowRightLeft size={24} />
                            </div>
                            <div>
                                <h2 className="text-xl font-bold text-[#3f3f46]">Internal Stock</h2>
                                <p className="text-sm font-semibold text-[#a6a6a6] uppercase tracking-widest">Operations & Flow</p>
                            </div>
                        </div>

                        <ul className="space-y-4">
                            <li className="flex items-center gap-3 p-3 rounded-xl bg-[#F8F6F3]/50 border border-[#19140005]">
                                <div className="w-8 h-8 bg-white rounded-lg shadow-sm flex items-center justify-center text-[#818181]">
                                    <ArrowRightLeft size={16} />
                                </div>
                                <span className="text-sm font-bold text-[#3f3f46]">Transfer Outbound</span>
                            </li>
                            <li className="flex items-center gap-3 p-3 rounded-xl bg-[#F8F6F3]/50 border border-[#19140005]">
                                <div className="w-8 h-8 bg-white rounded-lg shadow-sm flex items-center justify-center text-[#818181]">
                                    <Clock size={16} />
                                </div>
                                <span className="text-sm font-bold text-[#3f3f46]">Transfer History</span>
                            </li>
                            <li className="flex items-center gap-3 p-3 rounded-xl bg-[#F8F6F3]/50 border border-[#19140005]">
                                <div className="w-8 h-8 bg-white rounded-lg shadow-sm flex items-center justify-center text-[#818181]">
                                    <FileText size={16} />
                                </div>
                                <span className="text-sm font-bold text-[#3f3f46]">Branch Requisition</span>
                            </li>
                        </ul>
                    </div>
                </div>

                {/* Smart Suggestions & Action Center */}
                <div className="md:col-span-2 bg-gradient-to-br from-[#3f3f46] to-[#27272a] rounded-3xl p-1 shadow-lg mt-2">
                    <div className="bg-white rounded-[22px] p-6 sm:p-8 h-full">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 mb-8 border-b border-[#19140010] pb-6">
                            <div className="flex items-center gap-4">
                                <div className="w-14 h-14 bg-gradient-to-br from-yellow-100 to-orange-100 rounded-2xl flex items-center justify-center text-orange-500 shadow-inner">
                                    <Lightbulb size={28} />
                                </div>
                                <div>
                                    <h2 className="text-2xl font-bold text-[#3f3f46]">Smart Suggestion</h2>
                                    <p className="text-sm font-semibold text-[#a6a6a6] uppercase tracking-widest mt-1">Intelligent Automation</p>
                                </div>
                            </div>
                            <div className="px-4 py-2 bg-[#F8F6F3] rounded-xl border border-[#19140015] text-xs font-bold text-[#818181] flex items-center gap-2">
                                <Settings size={14} className="animate-spin-slow" />
                                IN DEVELOPMENT
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="p-5 rounded-2xl bg-[#F8F6F3]/50 border border-[#19140010] hover:bg-[#F8F6F3] transition-colors group">
                                <h3 className="text-lg font-bold text-[#3f3f46] mb-2 flex items-center gap-2">
                                    <span className="text-[#d94a79]">✨</span> Automatic Restock Action Center
                                </h3>
                                <p className="text-sm text-[#818181] leading-relaxed">
                                    System will automatically suggest restocking based on individual branch targets and minimum stock thresholds. Say goodbye to manual inventory counting.
                                </p>
                            </div>

                            <div className="p-5 rounded-2xl bg-[#F8F6F3]/50 border border-[#19140010] hover:bg-[#F8F6F3] transition-colors group">
                                <h3 className="text-lg font-bold text-[#3f3f46] mb-2 flex items-center gap-2">
                                    <span className="text-[#d94a79]">🖨️</span> Print-Ready Reports
                                </h3>
                                <p className="text-sm text-[#818181] leading-relaxed">
                                    Dedicated printable formats for all Bodega operations, ensuring clean and professional physical copies for management review and auditing purposes.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
};

export default Branches;
