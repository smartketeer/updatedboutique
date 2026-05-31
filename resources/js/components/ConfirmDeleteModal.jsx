import React from 'react';
import { AlertTriangle, X } from 'lucide-react';

const COUNTDOWN_SECONDS = 5;

/**
 * Universal confirmation modal for delete operations.
 *
 * Props:
 *   open        – boolean, whether the modal is visible
 *   onClose     – () => void, called when the user cancels
 *   onConfirm   – () => void, called when the user confirms deletion
 *   title       – optional string, e.g. "Delete Item"
 *   message     – optional string/JSX shown as the body
 *   itemName    – optional string, name of the thing being deleted (shown bolded)
 *   confirming  – optional boolean, true while the async delete is in progress
 */
const ConfirmDeleteModal = ({
    open = false,
    onClose,
    onConfirm,
    title = 'Confirm Deletion',
    message,
    itemName,
    confirming = false,
    requireCountdown = true,
}) => {
    const [countdown, setCountdown] = React.useState(requireCountdown ? COUNTDOWN_SECONDS : 0);
    const intervalRef = React.useRef(null);

    // Reset & start countdown each time the modal opens
    React.useEffect(() => {
        if (open) {
            if (requireCountdown) {
                setCountdown(COUNTDOWN_SECONDS);
                intervalRef.current = setInterval(() => {
                    setCountdown((prev) => {
                        if (prev <= 1) {
                            clearInterval(intervalRef.current);
                            intervalRef.current = null;
                            return 0;
                        }
                        return prev - 1;
                    });
                }, 1000);
            } else {
                setCountdown(0);
            }
        } else {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
            }
        }
        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
            }
        };
    }, [open, requireCountdown]);

    // Close on Escape key
    React.useEffect(() => {
        if (!open) return;
        const handler = (e) => {
            if (e.key === 'Escape') onClose?.();
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [open, onClose]);

    if (!open) return null;

    const canConfirm = countdown === 0 && !confirming;

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-[fadeIn_150ms_ease-out]"
                onClick={onClose}
            />

            {/* Card */}
            <div
                className="relative w-full max-w-md bg-white rounded-2xl border border-[#cbcbcb] shadow-2xl animate-[scaleIn_200ms_ease-out]"
                role="alertdialog"
                aria-modal="true"
                aria-labelledby="confirm-delete-title"
                aria-describedby="confirm-delete-desc"
            >
                {/* Header */}
                <div className="flex items-start justify-between gap-3 px-6 pt-6 pb-0">
                    <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-xl bg-red-50 border border-red-100 flex items-center justify-center flex-shrink-0">
                            <AlertTriangle size={22} className="text-red-500" />
                        </div>
                        <h2
                            id="confirm-delete-title"
                            className="text-base font-semibold text-[#3f3f46]"
                        >
                            {title}
                        </h2>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label="Cancel deletion"
                        className="p-2 -mr-2 -mt-1 rounded-xl text-[#a6a6a6] hover:bg-[#dddddd] hover:text-[#818181] transition-colors"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Body */}
                <div id="confirm-delete-desc" className="px-6 pt-4 pb-2 space-y-3">
                    {message ? (
                        <p className="text-sm text-[#818181] leading-relaxed">{message}</p>
                    ) : (
                        <p className="text-sm text-[#818181] leading-relaxed">
                            Are you sure you want to permanently delete
                            {itemName ? (
                                <>
                                    {' '}
                                    <span className="font-semibold text-[#3f3f46]">
                                        &ldquo;{itemName}&rdquo;
                                    </span>
                                </>
                            ) : (
                                ' this item'
                            )}
                            ? This action cannot be undone.
                        </p>
                    )}

                    {countdown > 0 && (
                        <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-amber-50 border border-amber-200">
                            <div className="relative w-7 h-7 flex-shrink-0">
                                <svg className="w-7 h-7 -rotate-90" viewBox="0 0 36 36">
                                    <circle
                                        cx="18"
                                        cy="18"
                                        r="15"
                                        fill="none"
                                        stroke="#fde68a"
                                        strokeWidth="3"
                                    />
                                    <circle
                                        cx="18"
                                        cy="18"
                                        r="15"
                                        fill="none"
                                        stroke="#f59e0b"
                                        strokeWidth="3"
                                        strokeLinecap="round"
                                        strokeDasharray={`${(countdown / COUNTDOWN_SECONDS) * 94.25} 94.25`}
                                        style={{ transition: 'stroke-dasharray 1s linear' }}
                                    />
                                </svg>
                                <span className="absolute inset-0 flex items-center justify-center text-[10px] font-semibold text-amber-700">
                                    {countdown}
                                </span>
                            </div>
                            <p className="text-xs font-medium text-amber-700">
                                Please wait {countdown} second{countdown !== 1 ? 's' : ''} before confirming...
                            </p>
                        </div>
                    )}
                </div>

                {/* Actions */}
                <div className="flex items-center justify-end gap-3 px-6 pt-3 pb-6">
                    <button
                        type="button"
                        onClick={onClose}
                        className="h-10 px-5 rounded-xl border border-[#cbcbcb] bg-white text-sm font-medium text-[#818181] hover:bg-[#dddddd] active:bg-[#cbcbcb] transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={() => {
                            if (canConfirm && onConfirm) {
                                onConfirm();
                            }
                        }}
                        disabled={!canConfirm}
                        className={`h-10 px-5 rounded-xl text-sm font-medium transition-all duration-200 flex items-center gap-2 ${
                            canConfirm
                                ? 'bg-red-500 text-white hover:bg-red-600 active:bg-red-700 shadow-sm'
                                : 'bg-red-200 text-red-400 cursor-not-allowed'
                        }`}
                    >
                        {confirming ? (
                            <>
                                <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeDasharray="32 32" />
                                </svg>
                                Deleting...
                            </>
                        ) : countdown > 0 ? (
                            `Delete (${countdown}s)`
                        ) : (
                            'Delete'
                        )}
                    </button>
                </div>
            </div>

            <style>{`
                @keyframes fadeIn {
                    from { opacity: 0; }
                    to   { opacity: 1; }
                }
                @keyframes scaleIn {
                    from { opacity: 0; transform: scale(0.95) translateY(8px); }
                    to   { opacity: 1; transform: scale(1) translateY(0); }
                }
            `}</style>
        </div>
    );
};

export default ConfirmDeleteModal;
