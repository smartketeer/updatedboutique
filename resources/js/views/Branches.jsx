import React from 'react';
import { Package, ArrowRightLeft, Lightbulb, Clock, Layers, AlertCircle, FileText, Settings } from 'lucide-react';

const Branches = () => {
    return (
        <div className="max-w-5xl mx-auto space-y-6 animate-in fade-in duration-500 pb-12 font-sans">
            {/* Header Section */}
            <div className="bg-[#EBE7DF] rounded-[32px] p-8 md:p-12 relative overflow-hidden shadow-sm">
                <div className="absolute top-1/2 -translate-y-1/2 right-[-20px] text-[#18181b] opacity-90 hidden md:block">
                    <Package size={280} strokeWidth={2.5} />
                </div>
                <div className="relative z-10 max-w-2xl">
                    <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/70 text-[#18181b] rounded-full text-[11px] font-bold tracking-widest mb-8">
                        <span className="w-2 h-2 rounded-full bg-[#a6a6a6]"></span>
                        COMING SOON
                    </div>
                    <h1 className="text-[40px] md:text-[56px] font-bold text-[#18181b] tracking-tight leading-[1.05] mb-6">
                        Master Inventory
                        <span className="block mt-1">(BODEGA)</span>
                    </h1>
                    <p className="text-[15px] text-[#3f3f46] font-medium leading-relaxed max-w-xl">
                        A complete Warehouse Management System designed to centralize logistics, streamline inbound/outbound transfers, and provide deeper insights into your global stock.
                    </p>
                </div>
            </div>

            {/* Content Outline Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* Bodega Dashboard Column */}
                <div className="bg-white rounded-[32px] p-8 shadow-sm h-full border border-[#f4f4f5]">
                    <div className="flex items-center gap-4 mb-8">
                        <div className="w-12 h-12 bg-[#F4F4F5] rounded-full flex items-center justify-center text-[#18181b]">
                            <Layers size={22} strokeWidth={2.5} />
                        </div>
                        <div>
                            <h2 className="text-[22px] font-bold text-[#18181b] tracking-tight">Bodega Dashboard</h2>
                            <p className="text-[11px] font-bold text-[#71717A] uppercase tracking-widest mt-1">Logistics & Stocks</p>
                        </div>
                    </div>

                    <ul className="space-y-6">
                        <li className="flex items-start gap-4">
                            <div className="mt-1.5 flex-shrink-0 w-6 flex justify-center">
                                <div className="w-2 h-2 rounded-full bg-[#E4E4E7]"></div>
                            </div>
                            <div>
                                <h3 className="text-[15px] font-bold text-[#18181b]">Total Capital Cost</h3>
                                <p className="text-[13px] text-[#71717A] mt-1 leading-relaxed">Track the raw investment value of all items inside the Bodega.</p>
                            </div>
                        </li>
                        <li className="flex items-start gap-4">
                            <div className="mt-1.5 flex-shrink-0 w-6 flex justify-center">
                                <div className="w-2 h-2 rounded-full bg-[#E4E4E7]"></div>
                            </div>
                            <div>
                                <h3 className="text-[15px] font-bold text-[#18181b]">Total Estimated Value</h3>
                                <p className="text-[13px] text-[#71717A] mt-1 leading-relaxed">Forecasted revenue based on current selling prices.</p>
                            </div>
                        </li>
                        <li className="flex items-start gap-4">
                            <div className="mt-1.5 flex-shrink-0 w-6 flex justify-center">
                                <div className="w-2 h-2 rounded-full bg-[#E4E4E7]"></div>
                            </div>
                            <div>
                                <h3 className="text-[15px] font-bold text-[#18181b]">Pending Branch Requests</h3>
                                <p className="text-[13px] text-[#71717A] mt-1 leading-relaxed">Quick overview of how many items are awaiting transfer approval to branches.</p>
                            </div>
                        </li>
                        <li className="flex items-start gap-4">
                            <div className="mt-1.5 flex-shrink-0 w-6 flex justify-center">
                                <div className="w-2 h-2 rounded-full bg-[#E4E4E7]"></div>
                            </div>
                            <div>
                                <h3 className="text-[15px] font-bold text-[#18181b]">Dead Stocks</h3>
                                <p className="text-[13px] text-[#71717A] mt-1 leading-relaxed">Identify items in the Bodega that haven't been transferred or moved in a long time.</p>
                            </div>
                        </li>
                    </ul>
                </div>

                {/* Internal Stock & Operations */}
                <div className="bg-white rounded-[32px] p-8 shadow-sm h-full border border-[#f4f4f5]">
                    <div className="flex items-center gap-4 mb-8">
                        <div className="w-12 h-12 bg-[#F4F4F5] rounded-full flex items-center justify-center text-[#18181b]">
                            <ArrowRightLeft size={22} strokeWidth={2.5} />
                        </div>
                        <div>
                            <h2 className="text-[22px] font-bold text-[#18181b] tracking-tight">Internal Stock</h2>
                            <p className="text-[11px] font-bold text-[#71717A] uppercase tracking-widest mt-1">Operations & Flow</p>
                        </div>
                    </div>

                    <ul className="space-y-4">
                        <li className="flex items-center gap-4 p-4 rounded-2xl bg-[#F8F8F8]">
                            <ArrowRightLeft size={18} className="text-[#18181b]" strokeWidth={2.5} />
                            <span className="text-[15px] font-bold text-[#18181b]">Transfer Outbound</span>
                        </li>
                        <li className="flex items-center gap-4 p-4 rounded-2xl bg-[#F8F8F8]">
                            <Clock size={18} className="text-[#18181b]" strokeWidth={2.5} />
                            <span className="text-[15px] font-bold text-[#18181b]">Transfer History</span>
                        </li>
                        <li className="flex items-center gap-4 p-4 rounded-2xl bg-[#F8F8F8]">
                            <FileText size={18} className="text-[#18181b]" strokeWidth={2.5} />
                            <span className="text-[15px] font-bold text-[#18181b]">Branch Requisition</span>
                        </li>
                    </ul>
                </div>

                {/* Smart Suggestions & Action Center */}
                <div className="md:col-span-2 bg-[#18181b] rounded-[32px] p-8 shadow-sm mt-2 text-white">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 mb-10 border-b border-white/10 pb-6">
                        <div className="flex items-center gap-4">
                            <div className="w-14 h-14 bg-white/10 rounded-full flex items-center justify-center text-white">
                                <Lightbulb size={24} strokeWidth={2} />
                            </div>
                            <div>
                                <h2 className="text-2xl font-bold tracking-tight">Smart Suggestion</h2>
                                <p className="text-[11px] font-bold text-white/60 uppercase tracking-widest mt-1">Intelligent Automation</p>
                            </div>
                        </div>
                        <div className="px-4 py-2 bg-white/10 rounded-full border border-white/5 text-[11px] font-bold text-white tracking-widest">
                            IN DEVELOPMENT
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="p-6 rounded-[24px] bg-white/5 hover:bg-white/10 transition-colors border border-white/5">
                            <h3 className="text-[17px] font-bold mb-3 flex items-center gap-2">
                                Automatic Restock Action Center
                            </h3>
                            <p className="text-[14px] text-white/60 leading-relaxed">
                                System will automatically suggest restocking based on individual branch targets and minimum stock thresholds. Say goodbye to manual inventory counting.
                            </p>
                        </div>

                        <div className="p-6 rounded-[24px] bg-white/5 hover:bg-white/10 transition-colors border border-white/5">
                            <h3 className="text-[17px] font-bold mb-3 flex items-center gap-2">
                                Print-Ready Reports
                            </h3>
                            <p className="text-[14px] text-white/60 leading-relaxed">
                                Dedicated printable formats for all Bodega operations, ensuring clean and professional physical copies for management review and auditing purposes.
                            </p>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
};

export default Branches;
