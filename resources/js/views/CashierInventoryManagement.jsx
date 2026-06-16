import React from 'react';
import axios from 'axios';
import { Dialog, Transition } from '@headlessui/react';
import { Plus, X, Package, ShieldCheck, Trash2, Edit2, Search, Filter, Camera, Upload, ImagePlus, Star, Loader2, RefreshCw, Zap, ArrowRightLeft, LogOut, ClipboardList, Copy, Check, Bell } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import ConfirmDeleteModal from '../components/ConfirmDeleteModal';

const PESO = '\u20B1';
const ELLIPSIS = '\u2026';
const BULLET = '\u2022';

const CashierInventoryManagement = () => {
    const navigate = useNavigate();
    const [items, setItems] = React.useState([]);
    const [page, setPage] = React.useState(1);
    const [totalPages, setTotalPages] = React.useState(1);
    const [totalItems, setTotalItems] = React.useState(0);
    const [categories, setCategories] = React.useState([]);
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState('');

    const [q, setQ] = React.useState('');
    const [debouncedQ, setDebouncedQ] = React.useState('');
    const [categoryId, setCategoryId] = React.useState('all');

    const [accessToken, setAccessToken] = React.useState(() => sessionStorage.getItem('inventory_access_token') || '');
    const [isAuthModalOpen, setIsAuthModalOpen] = React.useState(false);
    const [authError, setAuthError] = React.useState('');
    const [requestInfo, setRequestInfo] = React.useState(() => {
        const requestId = sessionStorage.getItem('inventory_access_request_id') || '';
        const expiresAt = sessionStorage.getItem('inventory_access_request_expires_at') || '';
        if (!requestId) return null;
        return { request_id: requestId, expires_at: expiresAt || null };
    });
    const [otp, setOtp] = React.useState('');
    const [requesting, setRequesting] = React.useState(false);
    const [verifying, setVerifying] = React.useState(false);
    const [resendAvailableAt, setResendAvailableAt] = React.useState(() => {
        const raw = sessionStorage.getItem('inventory_access_resend_available_at');
        const n = raw ? Number(raw) : 0;
        return Number.isFinite(n) ? n : 0;
    });
    const [nowTs, setNowTs] = React.useState(() => Date.now());

    const [isItemModalOpen, setIsItemModalOpen] = React.useState(false);
    const [editingItem, setEditingItem] = React.useState(null);
    const [itemForm, setItemForm] = React.useState({
        category_id: '',
        name: '',
        sku: '',
        price: '',
        cost: '',
        stock_qty: '',
        is_service: false,
        adjustment_reason: '',
    });

    // ── Transfer / Pull Out state ──
    const [isTransferMode, setIsTransferMode] = React.useState(false);
    const [activeBranches, setActiveBranches] = React.useState([]);
    const [isTransferModalOpen, setIsTransferModalOpen] = React.useState(false);
    const [transferItem, setTransferItem] = React.useState(null);
    const [transferForm, setTransferForm] = React.useState({ to_branch_id: '', quantity: '', reason: '' });
    const [isPullOutModalOpen, setIsPullOutModalOpen] = React.useState(false);
    const [pullOutItem, setPullOutItem] = React.useState(null);
    const [pullOutForm, setPullOutForm] = React.useState({ quantity: '', reason: '' });
    const [transferPullOutError, setTransferPullOutError] = React.useState('');

    // ── Duplicate Detection state ──
    const [isDuplicateModalOpen, setIsDuplicateModalOpen] = React.useState(false);
    const [duplicateItems, setDuplicateItems] = React.useState([]);

    // ── Request Item state ──
    const [isRequestModalOpen, setIsRequestModalOpen] = React.useState(false);
    const [requestForm, setRequestForm] = React.useState({ sku: '', item_name: '', quantity: '', reason: '' });
    const [requestStatus, setRequestStatus] = React.useState('');
    const [isSearchingSku, setIsSearchingSku] = React.useState(false);

    // ── Request Item state ──

    const isItemValid = requestForm.sku !== '' && requestForm.item_name !== '';

    const handleRequestSubmit = async (e) => {
        e.preventDefault();

        if (!requestForm.item_name) {
            setRequestStatus('Error: Please select an item to request.');
            setTimeout(() => setRequestStatus(''), 4000);
            return;
        }
        
        // Find the active branch
        const activeBranch = activeBranches.find(b => b.is_active);
        const branchId = activeBranch ? activeBranch.id : (activeBranches[0] ? activeBranches[0].id : null);

        if (!branchId) {
            setRequestStatus('Error: No active branch found.');
            return;
        }

        try {
            await axios.post('/api/requisitions', {
                branch_id: branchId,
                sku: requestForm.sku,
                item_name: requestForm.item_name,
                quantity: requestForm.quantity,
                reason: requestForm.reason
            });
            
            setRequestStatus('Item request submitted successfully!');
            setTimeout(() => {
                setIsRequestModalOpen(false);
                setRequestStatus('');
                setRequestForm({ sku: '', item_name: '', quantity: '', reason: '' });
            }, 1500);
        } catch (err) {
            setRequestStatus(err.response?.data?.message || 'Failed to submit request.');
            setTimeout(() => setRequestStatus(''), 3000);
        }
    };

    // ── Photo modal state ──
    const [isPhotoModalOpen, setIsPhotoModalOpen] = React.useState(false);
    const [photoItem, setPhotoItem] = React.useState(null);
    const [itemImages, setItemImages] = React.useState([]);
    const [imagesLoading, setImagesLoading] = React.useState(false);
    const [imagesError, setImagesError] = React.useState('');
    const [uploading, setUploading] = React.useState(false);
    const [pendingFiles, setPendingFiles] = React.useState([]);
    const [pendingPreviews, setPendingPreviews] = React.useState([]);
    const fileInputRef = React.useRef(null);
    const videoRef = React.useRef(null);
    const canvasRef = React.useRef(null);
    const streamRef = React.useRef(null);
    const [cameraOpen, setCameraOpen] = React.useState(false);
    const [cameraReady, setCameraReady] = React.useState(false);
    const [cameraError, setCameraError] = React.useState('');
    const [cameraPhase, setCameraPhase] = React.useState('live');
    const [capturedPreview, setCapturedPreview] = React.useState(null);
    const [facingMode, setFacingMode] = React.useState('environment');
    const [flashOn, setFlashOn] = React.useState(false);
    // ── end photo modal state ──



    const [settings, setSettings] = React.useState({
        priceAdjustmentsEnabled: true,
        customItemsEnabled: true,
    });

    React.useEffect(() => {
        const id = window.setTimeout(() => setDebouncedQ(q.trim()), 250);
        return () => window.clearTimeout(id);
    }, [q]);

    React.useEffect(() => {
        if (page === 1) return;
        setPage(1);
    }, [debouncedQ, categoryId]);

    const fetchData = React.useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const params = { page, per_page: 10, _t: Date.now() };
            if (debouncedQ) params.q = debouncedQ;
            if (categoryId && categoryId !== 'all') params.category_id = categoryId;
            const [itemsRes, catsRes, settingsRes, branchesRes] = await Promise.all([
                axios.get('/api/inventory', { params }),
                axios.get('/api/categories'),
                axios.get('/api/settings'),
                axios.get('/api/active-branches')
            ]);
            const rows = Array.isArray(itemsRes.data?.data) ? itemsRes.data.data : Array.isArray(itemsRes.data) ? itemsRes.data : [];
            setItems(rows);
            setPage(Number(itemsRes.data?.current_page || page) || 1);
            setTotalPages(Number(itemsRes.data?.last_page || 1) || 1);
            setTotalItems(Number(itemsRes.data?.total || rows.length) || 0);
            setCategories(catsRes.data || []);
            setActiveBranches(branchesRes.data || []);
            setSettings({
                priceAdjustmentsEnabled: Boolean(settingsRes.data?.pos_price_adjustments_enabled),
                customItemsEnabled: Boolean(settingsRes.data?.pos_custom_items_enabled),
            });
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to load inventory');
        } finally {
            setLoading(false);
        }
    }, [page, debouncedQ, categoryId]);

    React.useEffect(() => {
        fetchData();
    }, [fetchData]);

    const requestNewCode = React.useCallback(async () => {
        if (!settings.priceAdjustmentsEnabled && !settings.customItemsEnabled) {
            alert('Inventory management features are disabled by admin.');
            return;
        }

        setRequesting(true);
        setAuthError('');
        try {
            const res = await axios.post('/api/inventory-access/request', { purpose: 'inventory_management' });
            setRequestInfo(res.data);
            if (res.data?.request_id) {
                sessionStorage.setItem('inventory_access_request_id', String(res.data.request_id));
            }
            if (res.data?.expires_at) {
                sessionStorage.setItem('inventory_access_request_expires_at', String(res.data.expires_at));
            }
            const next = Date.now() + 3 * 60 * 1000;
            sessionStorage.setItem('inventory_access_resend_available_at', String(next));
            setResendAvailableAt(next);
            setOtp('');
            setIsAuthModalOpen(true);
        } catch (err) {
            const retryAfter = err.response?.data?.retry_after_seconds;
            if (err.response?.status === 429 && Number.isFinite(Number(retryAfter))) {
                const next = Date.now() + Number(retryAfter) * 1000;
                sessionStorage.setItem('inventory_access_resend_available_at', String(next));
                setResendAvailableAt(next);
            }
            setAuthError(err.response?.data?.errors?.otp?.[0] || err.response?.data?.message || 'Failed to request access');
            setIsAuthModalOpen(true);
        } finally {
            setRequesting(false);
        }
    }, [settings]);

    React.useEffect(() => {
        const id = window.setInterval(() => setNowTs(Date.now()), 1000);
        return () => window.clearInterval(id);
    }, []);

    const canResend = nowTs >= resendAvailableAt;
    const resendWaitSeconds = canResend ? 0 : Math.max(0, Math.ceil((resendAvailableAt - nowTs) / 1000));

    const clearAccess = React.useCallback(async () => {
        const token = accessToken;
        sessionStorage.removeItem('inventory_access_token');
        sessionStorage.removeItem('inventory_access_request_id');
        sessionStorage.removeItem('inventory_access_request_expires_at');
        setAccessToken('');
        setRequestInfo(null);
        setOtp('');
        setAuthError('');
        setIsAuthModalOpen(false);
        setEditingItem(null);
        setIsItemModalOpen(false);
        if (!token) return;
        try {
            await axios.post('/api/inventory-access/revoke', { token });
        } catch {
        }
    }, [accessToken]);

    const handleEndAccess = React.useCallback(async () => {
        await clearAccess();
        navigate('/cashier/pos');
    }, [clearAccess, navigate]);

    const verifyCode = async () => {
        if (!requestInfo?.request_id) return;
        setVerifying(true);
        setAuthError('');
        try {
            const res = await axios.post('/api/inventory-access/verify', {
                request_id: requestInfo.request_id,
                otp,
            });
            const token = res.data?.token;
            if (!token) {
                setAuthError('Verification failed. Please request a new code.');
                return;
            }
            sessionStorage.setItem('inventory_access_token', token);
            sessionStorage.removeItem('inventory_access_request_id');
            sessionStorage.removeItem('inventory_access_request_expires_at');
            setAccessToken(token);
            setIsAuthModalOpen(false);
            setAuthError('');
            setRequestInfo(null);
            setOtp('');
        } catch (err) {
            setAuthError(err.response?.data?.errors?.otp?.[0] || err.response?.data?.message || 'Invalid or expired code');
        } finally {
            setVerifying(false);
        }
    };

    const openAddItem = () => {
        if (!settings.customItemsEnabled) {
            alert('Adding new items is disabled by admin.');
            return;
        }
        setEditingItem(null);
        setItemForm({
            category_id: categories[0]?.id ? String(categories[0].id) : '',
            name: '',
            sku: '',
            price: '',
            cost: '',
            stock_qty: '',
            is_service: false,
            adjustment_reason: '',
        });
        setIsItemModalOpen(true);
    };

    const openEditItem = (item) => {
        if (!settings.priceAdjustmentsEnabled) {
            alert('Editing items (price/stock adjustments) is disabled by admin.');
            return;
        }
        setEditingItem(item);
        setItemForm({
            category_id: item.category_id != null ? String(item.category_id) : item.category?.id != null ? String(item.category.id) : '',
            name: item.name || '',
            sku: item.sku || '',
            price: item.price != null ? String(item.price) : '',
            cost: item.cost != null ? String(item.cost) : '',
            stock_qty: item.stock_qty != null ? String(item.stock_qty) : '',
            is_service: Boolean(item.is_service),
            adjustment_reason: '',
        });
        setIsItemModalOpen(true);
    };

    const handleSaveItem = async (e, forceCreate = false) => {
        if (e) e.preventDefault();
        setError('');

        // Frontend validation: adjustment_reason required when editing any detail
        if (editingItem) {
            const reason = (itemForm.adjustment_reason || '').trim();
            if (!reason) {
                setError('An adjustment reason is required when modifying product details.');
                return;
            }
        }

        // Duplicate check for new items
        if (!editingItem && !forceCreate) {
            try {
                const res = await axios.post('/api/inventory/check-duplicate', { name: itemForm.name });
                if (res.data.has_duplicates) {
                    setDuplicateItems(res.data.duplicates);
                    setIsDuplicateModalOpen(true);
                    return;
                }
            } catch (err) {
                // Proceed if duplicate check fails
            }
        }

        try {
            const payload = {
                category_id: Number(itemForm.category_id),
                name: itemForm.name,
                sku: itemForm.sku || null,
                price: Number(itemForm.price || 0),
                cost: Number(itemForm.cost || 0),
                stock_qty: Number(itemForm.stock_qty || 0),
                is_service: Boolean(itemForm.is_service),
                force_create: forceCreate,
            };
            if (editingItem) {
                await axios.put(
                    `/api/cashier/inventory/${editingItem.id}`,
                    { ...payload, adjustment_reason: itemForm.adjustment_reason || null },
                    { headers: { 'X-Inventory-Access-Token': accessToken } }
                );
            } else {
                await axios.post('/api/cashier/inventory', payload, { headers: { 'X-Inventory-Access-Token': accessToken } });
            }
            setIsItemModalOpen(false);
            setIsDuplicateModalOpen(false);
            setEditingItem(null);
            await fetchData();
        } catch (err) {
            const msg = err.response?.data?.message
                || err.response?.data?.errors?.adjustment_reason?.[0]
                || 'Save failed';
            if (err.response?.status === 403) {
                await clearAccess();
                setAuthError(msg);
                setIsAuthModalOpen(true);
                return;
            }
            if (err.response?.status === 422 && err.response?.data?.errors?.adjustment_reason) {
                setError(err.response.data.errors.adjustment_reason[0]);
                alert(err.response.data.errors.adjustment_reason[0]);
                return;
            }
            setError(msg);
            alert(msg);
        }
    };

    const openTransferModal = (item) => {
        setTransferItem(item);
        setTransferForm({ to_branch_id: '', quantity: '', reason: '' });
        setTransferPullOutError('');
        setIsTransferModalOpen(true);
    };

    const openPullOutModal = (item) => {
        setPullOutItem(item);
        setPullOutForm({ quantity: '', reason: '' });
        setTransferPullOutError('');
        setIsPullOutModalOpen(true);
    };

    const handleTransferSubmit = async (e) => {
        e.preventDefault();
        setTransferPullOutError('');
        if (!transferForm.reason.trim()) {
            setTransferPullOutError('A reason is required.');
            return;
        }
        try {
            await axios.post(`/api/cashier/inventory/${transferItem.id}/transfer`, transferForm, {
                headers: { 'X-Inventory-Access-Token': accessToken }
            });
            setIsTransferModalOpen(false);
            setTransferItem(null);
            await fetchData();
        } catch (err) {
            const msg = err.response?.data?.message || err.response?.data?.errors?.quantity?.[0] || err.response?.data?.errors?.reason?.[0] || 'Transfer failed';
            if (err.response?.status === 403) {
                await clearAccess();
                setAuthError(msg);
                setIsAuthModalOpen(true);
                return;
            }
            setTransferPullOutError(msg);
        }
    };

    const handlePullOutSubmit = async (e) => {
        e.preventDefault();
        setTransferPullOutError('');
        if (!pullOutForm.reason.trim()) {
            setTransferPullOutError('A reason is required.');
            return;
        }
        try {
            await axios.post(`/api/cashier/inventory/${pullOutItem.id}/pull-out`, pullOutForm, {
                headers: { 'X-Inventory-Access-Token': accessToken }
            });
            setIsPullOutModalOpen(false);
            setPullOutItem(null);
            await fetchData();
        } catch (err) {
            const msg = err.response?.data?.message || err.response?.data?.errors?.quantity?.[0] || err.response?.data?.errors?.reason?.[0] || 'Pull out failed';
            if (err.response?.status === 403) {
                await clearAccess();
                setAuthError(msg);
                setIsAuthModalOpen(true);
                return;
            }
            setTransferPullOutError(msg);
        }
    };

    // ── Delete confirmation modal state ──
    const [deleteModalOpen, setDeleteModalOpen] = React.useState(false);
    const [deleteTarget, setDeleteTarget] = React.useState(null); // { type: 'item' | 'image', item?, imgId? }
    const [deleteConfirming, setDeleteConfirming] = React.useState(false);

    const requestDeleteItem = (item) => {
        if (!settings.priceAdjustmentsEnabled) {
            alert('Deleting items is disabled by admin.');
            return;
        }
        setDeleteTarget({ type: 'item', item });
        setDeleteModalOpen(true);
    };

    const requestDeleteImage = (imgId) => {
        setDeleteTarget({ type: 'image', imgId });
        setDeleteModalOpen(true);
    };

    const executeDelete = async () => {
        if (!deleteTarget) return;
        setDeleteConfirming(true);
        try {
            if (deleteTarget.type === 'item') {
                setError('');
                await axios.delete(`/api/cashier/inventory/${deleteTarget.item.id}`, { headers: { 'X-Inventory-Access-Token': accessToken } });
                setDeleteModalOpen(false);
                setDeleteTarget(null);
                await fetchData();
            } else if (deleteTarget.type === 'image') {
                await axios.delete(`/api/items/${photoItem.id}/images/${deleteTarget.imgId}`, { headers: { 'X-Inventory-Access-Token': accessToken } });
                setDeleteModalOpen(false);
                setDeleteTarget(null);
                await reloadImages();
            }
        } catch (err) {
            const msg = err.response?.data?.message || 'Delete failed';
            if (deleteTarget.type === 'item' && err.response?.status === 403) {
                setDeleteModalOpen(false);
                setDeleteTarget(null);
                await clearAccess();
                setAuthError(msg);
                setIsAuthModalOpen(true);
            } else if (deleteTarget.type === 'item') {
                setDeleteModalOpen(false);
                setDeleteTarget(null);
                setError(msg);
            } else {
                // Image delete failed — close delete modal but keep photo modal open with error
                setDeleteModalOpen(false);
                setDeleteTarget(null);
                setImagesError(msg);
            }
        } finally {
            setDeleteConfirming(false);
        }
    };

    const handleDeleteItem = (item) => requestDeleteItem(item);

    // ── Photo handlers ──
    const setPendingFromFiles = (files) => {
        if (!files) return;
        const arr = Array.from(files);
        setPendingFiles(arr);
        setPendingPreviews(arr.map(f => ({ url: URL.createObjectURL(f), name: f.name })));
    };

    const openPhotoModal = async (item) => {
        setPhotoItem(item);
        setItemImages([]);
        setImagesError('');
        setPendingFiles([]);
        setPendingPreviews([]);
        setCapturedPreview(null);
        setCameraOpen(false);
        setIsPhotoModalOpen(true);
        setImagesLoading(true);
        try {
            const res = await axios.get(`/api/items/${item.id}/images`, { headers: { 'X-Inventory-Access-Token': accessToken } });
            setItemImages(res.data?.images || []);
            if (res.data?.item) {
                setItems(prev => prev.map(it => String(it.id) === String(item.id) ? { ...it, ...res.data.item } : it));
            }
        } catch { setImagesError('Failed to load images.'); }
        finally { setImagesLoading(false); }
    };

    const reloadImages = async () => {
        if (!photoItem) return;
        setImagesLoading(true);
        try {
            const res = await axios.get(`/api/items/${photoItem.id}/images`, { headers: { 'X-Inventory-Access-Token': accessToken } });
            setItemImages(res.data?.images || []);
            if (res.data?.item) {
                setItems(prev => prev.map(it => String(it.id) === String(photoItem.id) ? { ...it, ...res.data.item } : it));
            }
        } catch { setImagesError('Failed to refresh.'); }
        finally { setImagesLoading(false); }
    };

    const uploadImages = async () => {
        if (!photoItem || pendingFiles.length === 0) return;
        setUploading(true);
        setImagesError('');
        try {
            const fd = new FormData();
            pendingFiles.forEach(f => fd.append('images[]', f));
            await axios.post(`/api/items/${photoItem.id}/images`, fd, {
                headers: { 'Content-Type': 'multipart/form-data', 'X-Inventory-Access-Token': accessToken },
            });
            setPendingFiles([]);
            setPendingPreviews([]);
            await reloadImages();
        } catch (err) { setImagesError(err.response?.data?.message || 'Upload failed.'); }
        finally { setUploading(false); }
    };

    const setImagePrimary = async (imgId) => {
        if (!photoItem) return;
        try {
            await axios.patch(`/api/items/${photoItem.id}/images/${imgId}/primary`, {}, { headers: { 'X-Inventory-Access-Token': accessToken } });
            await reloadImages();
        } catch { setImagesError('Failed to set primary.'); }
    };

    const deleteImage = (imgId) => requestDeleteImage(imgId);

    const stopCamera = React.useCallback(() => {
        if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null; }
        setCameraOpen(false); setCameraReady(false); setCameraPhase('live'); setCameraError('');
    }, []);

    const startCamera = React.useCallback(async (mode) => {
        const fm = mode || facingMode;
        setCameraError(''); setCameraReady(false); setCameraPhase('live'); setCapturedPreview(null); setCameraOpen(true);
        try {
            if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null; }
            const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: fm }, audio: false });
            streamRef.current = stream;
            if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play(); }
            setCameraReady(true);
            setFlashOn(false);
        } catch (e) {
            if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null; }
            setCameraOpen(false);
            if (e?.name === 'NotAllowedError' || e?.name === 'PermissionDeniedError') {
                setCameraError('Camera permission denied. Please allow camera access in your browser settings.');
            } else if (e?.name === 'NotFoundError' || e?.name === 'DevicesNotFoundError') {
                setCameraError('No camera found on this device.');
            } else {
                setCameraError('Could not start camera: ' + (e?.message || 'Unknown error.'));
            }
        }
    }, [facingMode]);

    const switchCamera = () => {
        const next = facingMode === 'environment' ? 'user' : 'environment';
        setFacingMode(next); startCamera(next);
    };

    const toggleFlash = async () => {
        if (!streamRef.current) return;
        const track = streamRef.current.getVideoTracks()[0];
        if (!track) return;
        
        try {
            const capabilities = track.getCapabilities();
            if (!capabilities.torch) {
                setCameraError('Flash is not supported on this device/camera.');
                setTimeout(() => setCameraError(''), 3000);
                return;
            }
            
            const nextFlash = !flashOn;
            await track.applyConstraints({
                advanced: [{ torch: nextFlash }]
            });
            setFlashOn(nextFlash);
        } catch (e) {
            setCameraError('Failed to toggle flash.');
            setTimeout(() => setCameraError(''), 3000);
        }
    };

    const capturePhoto = () => {
        const video = videoRef.current;
        if (!video || !cameraReady) {
            setCameraError('Camera is not ready. Please wait and try again.');
            return;
        }
        const w = video.videoWidth;
        const h = video.videoHeight;
        if (!w || !h || w <= 0 || h <= 0) {
            setCameraError('Camera video dimensions are invalid. Please retry.');
            return;
        }
        const canvas = canvasRef.current || document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
            setCameraError('Canvas not supported by your browser.');
            return;
        }
        try {
            if (facingMode === 'user') {
                ctx.translate(w, 0);
                ctx.scale(-1, 1);
            }
            ctx.drawImage(video, 0, 0, w, h);
        } catch (drawErr) {
            setCameraError('Failed to capture frame: ' + (drawErr?.message || 'Unknown error.'));
            return;
        }
        canvas.toBlob(blob => {
            if (!blob) {
                setCameraError('Failed to encode captured image.');
                return;
            }
            const file = new File([blob], `capture_${Date.now()}.jpg`, { type: 'image/jpeg' });
            setCapturedPreview({ url: URL.createObjectURL(blob), file });
            setCameraPhase('preview');
        }, 'image/jpeg', 0.92);
    };

    const retakePhoto = () => { setCapturedPreview(null); setCameraPhase('live'); };

    const usePhotoCapture = () => {
        if (!capturedPreview) return;
        setPendingFiles(prev => [...prev, capturedPreview.file]);
        setPendingPreviews(prev => [...prev, { url: capturedPreview.url, name: capturedPreview.file.name }]);
        stopCamera();
    };
    // ── end photo handlers ──

    return (
        <div className="space-y-6 max-w-7xl mx-auto">

            <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-[#dddddd] text-[#818181] flex items-center justify-center shadow-sm">
                        <Package size={20} />
                    </div>
                    <div>
                        <h1 className="text-2xl font-semibold text-[#818181]">Inventory Management</h1>
                        <p className="text-[#a6a6a6] mt-1">Requires admin approval via one-time OTP.</p>
                    </div>
                </div>
                <div className="flex flex-col sm:flex-row gap-2 sm:items-center">

                    {accessToken ? (
                        <button
                            type="button"
                            onClick={handleEndAccess}
                            aria-label="End inventory access"
                            className="h-10 px-4 rounded-xl border border-[#cbcbcb] bg-white text-[12px] font-semibold text-[#818181] hover:bg-[#dddddd] transition-colors"
                        >
                            End Access
                        </button>
                    ) : (
                        <>
                            <button
                                type="button"
                                onClick={requestNewCode}
                                disabled={requesting || !canResend}
                                aria-label="Request OTP"
                                className="h-10 px-4 rounded-xl bg-[#818181] text-white text-[12px] font-semibold hover:bg-[#a6a6a6] disabled:opacity-50 transition-colors shadow-sm"
                            >
                                {canResend ? 'Request OTP' : `Resend in ${Math.floor(resendWaitSeconds / 60)}:${String(resendWaitSeconds % 60).padStart(2, '0')}`}
                            </button>
                            <button
                                type="button"
                                onClick={() => setIsAuthModalOpen(true)}
                                disabled={!requestInfo?.request_id}
                                aria-label="Enter OTP"
                                title={!requestInfo?.request_id ? 'Request an OTP first.' : 'Enter the OTP provided by the admin.'}
                                className="h-10 px-4 rounded-xl border border-[#cbcbcb] bg-white text-[#818181] text-[12px] font-semibold hover:bg-[#dddddd] disabled:opacity-50 transition-colors"
                            >
                                Enter OTP
                            </button>
                        </>
                    )}
                </div>
            </header>

            {accessToken ? (
                <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-2xl text-sm text-emerald-800 shadow-sm">
                    <div className="font-semibold">Inventory access is unlocked.</div>
                    <div className="text-emerald-700/80 mt-1">You can now add, edit, and delete items. Click "End Access" when you're done.</div>
                </div>
            ) : (
                <div className="p-4 bg-white border border-[#cbcbcb] rounded-2xl text-sm text-[#818181] shadow-sm">
                    <div className="font-semibold text-[#818181]">Inventory access is locked.</div>
                    <div className="text-[#a6a6a6] mt-1 font-medium">
                        Step 1: Click "Request OTP". Step 2: Ask the admin for the OTP and click "Enter OTP".
                    </div>
                </div>
            )}

            {error ? <div className="p-3 bg-[#dddddd] text-[#818181] border border-red-100 rounded-lg text-sm">{error}</div> : null}

            <div className="bg-white border border-[#cbcbcb] rounded-2xl shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-[#cbcbcb] bg-white/70 backdrop-blur flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                        <ShieldCheck size={18} className="text-[#818181]" />
                        <h2 className="text-sm font-semibold text-[#818181]">Items</h2>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={() => setIsTransferMode(!isTransferMode)}
                            disabled={!accessToken}
                            className={`h-9 px-3 text-xs font-semibold rounded-xl inline-flex items-center gap-2 shadow-sm transition-colors disabled:opacity-50 ${isTransferMode ? 'bg-[#818181] text-white hover:bg-[#a6a6a6]' : 'bg-white border border-[#cbcbcb] text-[#818181] hover:bg-[#dddddd]'}`}
                        >
                            <ArrowRightLeft size={14} />
                            {isTransferMode ? 'Cancel Transfer/Pull Out' : 'Transfer/Pull Out'}
                        </button>
                        <button
                            type="button"
                            onClick={() => setIsRequestModalOpen(true)}
                            className="h-9 px-3 text-xs font-semibold bg-white border border-[#cbcbcb] text-[#818181] rounded-xl hover:bg-[#dddddd] inline-flex items-center gap-2 shadow-sm transition-colors"
                        >
                            <ClipboardList size={14} />
                            Request Item
                        </button>
                        <button
                            type="button"
                            onClick={openAddItem}
                            disabled={!accessToken}
                            className="h-9 px-3 text-xs font-semibold bg-[#818181] text-white rounded-xl hover:bg-[#a6a6a6] disabled:opacity-50 inline-flex items-center gap-2 shadow-sm transition-colors"
                        >
                            <Plus size={14} />
                            Add Item
                        </button>
                    </div>
                </div>
                <div className="px-6 py-4 border-b border-[#cbcbcb] bg-white">
                    <div className="flex flex-col md:flex-row md:items-center gap-3">
                        <div className="relative flex-1 min-w-0">
                            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#a6a6a6]" aria-hidden="true" />
                            <input
                                value={q}
                                onChange={(e) => setQ(e.target.value)}
                                aria-label="Search items"
                                placeholder={`Search item name or category...`}
                                className="w-full h-10 pl-10 pr-3 rounded-xl border border-[#cbcbcb] bg-white text-[12px] font-semibold text-[#818181] focus:outline-none focus:ring-2 focus:ring-[#818181]/20 focus:border-[#818181] transition-all"
                            />
                        </div>
                        <div className="relative w-full md:w-72">
                            <Filter size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#a6a6a6]" aria-hidden="true" />
                            <select
                                value={categoryId}
                                onChange={(e) => setCategoryId(e.target.value)}
                                aria-label="Filter by category"
                                className="w-full h-10 pl-10 pr-3 rounded-xl border border-[#cbcbcb] bg-white text-[12px] font-semibold text-[#818181] focus:outline-none focus:ring-2 focus:ring-[#818181]/20 focus:border-[#818181] transition-all appearance-none"
                            >
                                <option value="all">All categories</option>
                                {categories.map((c) => (
                                    <option key={c.id} value={String(c.id)}>
                                        {c.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>
                </div>

                {loading ? (
                    <div className="p-6 text-[#a6a6a6] animate-pulse">Loading items...</div>
                ) : items.length === 0 ? (
                    <div className="p-6 text-[#a6a6a6]">No items found.</div>
                ) : (
                    <div className="flex flex-col">
                        <div className="overflow-auto">
                            <table className="w-full text-sm">
                                <thead className="bg-[#dddddd] text-[#818181] border-b border-[#cbcbcb]">
                                    <tr>
                                        <th className="text-left px-6 py-3 font-medium uppercase tracking-wider text-[11px]">Name</th>
                                        <th className="text-left px-6 py-3 font-medium uppercase tracking-wider text-[11px]">Category</th>
                                        <th className="text-right px-6 py-3 font-medium uppercase tracking-wider text-[11px]">Price</th>
                                        <th className="text-right px-6 py-3 font-medium uppercase tracking-wider text-[11px]">Stock</th>
                                        <th className="text-right px-6 py-3 font-medium uppercase tracking-wider text-[11px]">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {items.map((i) => {
                                        const primary = i?.primary_image || i?.primaryImage || null;
                                        const thumb = primary?.thumb_url || primary?.url || null;
                                        return (
                                        <tr key={i.id} className="border-b border-zinc-100 hover:bg-[#dddddd]/30 transition-colors">
                                            <td className="px-6 py-3">
                                                <div className="flex items-center gap-3">
                                                    <button
                                                        type="button"
                                                        onClick={() => openPhotoModal(i)}
                                                        disabled={!accessToken}
                                                        aria-label={`Manage images for ${i.name}`}
                                                        className="w-10 h-10 shrink-0 bg-white rounded-lg border border-[#cbcbcb] flex items-center justify-center text-[#818181] shadow-inner overflow-hidden hover:bg-[#dddddd] active:bg-[#dddddd] disabled:opacity-50 transition-colors"
                                                    >
                                                        {thumb ? (
                                                            <img src={thumb} alt="" className="w-full h-full object-cover" />
                                                        ) : (
                                                            <ImagePlus size={18} />
                                                        )}
                                                    </button>
                                                    <div>
                                                        <p className="text-xs font-medium text-[#818181] leading-none">{i.name}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-3 text-[#a6a6a6] text-xs font-medium">{i.category?.name || '-'}</td>
                                            <td className="px-6 py-3 text-right font-medium text-[#818181] text-xs">{PESO}{Number(i.price || 0).toLocaleString()}</td>
                                            <td className="px-6 py-3 text-right text-[#a6a6a6] text-xs font-medium">{i.stock_qty}</td>
                                            <td className="px-6 py-3">
                                                <div className="flex justify-end gap-2">
                                                    {isTransferMode ? (
                                                        <>
                                                            <button
                                                                type="button"
                                                                onClick={() => openTransferModal(i)}
                                                                disabled={!accessToken}
                                                                className="px-3 py-1.5 text-xs font-medium text-[#818181] border border-[#cbcbcb] rounded-lg hover:bg-[#dddddd] disabled:opacity-50 inline-flex items-center gap-2 transition-colors"
                                                            >
                                                                <ArrowRightLeft size={14} />
                                                                Transfer
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => openPullOutModal(i)}
                                                                disabled={!accessToken}
                                                                className="px-3 py-1.5 text-xs font-medium border border-[#cbcbcb] text-orange-500 rounded-lg hover:bg-orange-50 hover:border-orange-200 disabled:opacity-50 inline-flex items-center gap-2 transition-colors"
                                                            >
                                                                <LogOut size={14} />
                                                                Pull Out
                                                            </button>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <button
                                                                type="button"
                                                                onClick={() => openEditItem(i)}
                                                                disabled={!accessToken}
                                                                className="px-3 py-1.5 text-xs font-medium text-[#818181] border border-[#cbcbcb] rounded-lg hover:bg-[#dddddd] disabled:opacity-50 inline-flex items-center gap-2 transition-colors"
                                                            >
                                                                <Edit2 size={14} />
                                                                Edit
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => handleDeleteItem(i)}
                                                                disabled={!accessToken}
                                                                className="px-3 py-1.5 text-xs font-medium border border-[#cbcbcb] text-red-500 rounded-lg hover:bg-red-50 hover:border-red-200 disabled:opacity-50 inline-flex items-center gap-2 transition-colors"
                                                            >
                                                                <Trash2 size={14} />
                                                                Delete
                                                            </button>
                                                        </>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>

                        <div className="px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-[#cbcbcb] bg-white">
                            <div className="text-xs font-semibold text-[#a6a6a6]">
                                Page <span className="text-[#818181] font-semibold">{page}</span>/<span className="text-[#818181] font-semibold">{totalPages}</span> {BULLET}{' '}
                                <span className="text-[#818181] font-semibold">{totalItems}</span> total
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setPage((p) => Math.max(1, p - 1));
                                    }}
                                    disabled={page <= 1}
                                    aria-label="Previous page"
                                    className="h-9 px-3 rounded-xl border border-[#cbcbcb] bg-white text-xs font-medium text-[#818181] hover:bg-[#dddddd] disabled:opacity-50 transition-colors"
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
                                            if (p === ELLIPSIS) return <span key={`ellipsis-${idx}`} className="px-2 text-xs font-semibold text-[#a6a6a6]">{ELLIPSIS}</span>;
                                            const pageNum = Number(p);
                                            const active = pageNum === page;
                                            return (
                                                <button
                                                    key={`page-${pageNum}`}
                                                    type="button"
                                                    onClick={() => {
                                                        setPage(pageNum);
                                                    }}
                                                    aria-label={`Go to page ${pageNum}`}
                                                    aria-current={active ? 'page' : undefined}
                                                    className={`min-w-9 px-3 h-9 rounded-xl border text-xs font-semibold transition-colors ${
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
                                    disabled={page >= totalPages}
                                    aria-label="Next page"
                                    className="h-9 px-3 rounded-xl border border-[#cbcbcb] bg-white text-xs font-medium text-[#818181] hover:bg-[#dddddd] disabled:opacity-50 transition-colors"
                                >
                                    Next
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            <Transition appear show={isAuthModalOpen} as={React.Fragment}>
                <Dialog as="div" className="relative z-50" onClose={() => setIsAuthModalOpen(false)}>
                    <Transition.Child as={React.Fragment} enter="ease-out duration-200" enterFrom="opacity-0" enterTo="opacity-100" leave="ease-in duration-150" leaveFrom="opacity-100" leaveTo="opacity-0">
                        <div className="fixed inset-0 bg-[#818181]/40 backdrop-blur-sm" />
                    </Transition.Child>
                    <div className="fixed inset-0 overflow-y-auto">
                        <div className="flex min-h-full items-center justify-center p-4">
                            <Transition.Child as={React.Fragment} enter="ease-out duration-200" enterFrom="opacity-0 scale-95" enterTo="opacity-100 scale-100" leave="ease-in duration-150" leaveFrom="opacity-100 scale-100" leaveTo="opacity-0 scale-95">
                                <Dialog.Panel className="w-full max-w-sm transform overflow-hidden rounded-2xl bg-white p-6 shadow-2xl border border-[#cbcbcb]">
                                    <div className="flex items-start justify-between gap-3 mb-4">
                                        <div>
                                            <Dialog.Title className="text-lg font-medium text-[#818181]">Admin Approval Required</Dialog.Title>
                                            <p className="text-sm text-[#a6a6a6] mt-1">Ask the admin for the OTP to unlock inventory management.</p>
                                            <p className="text-xs text-[#a6a6a6] mt-2 font-medium">Code expires after 10 minutes.</p>
                                        </div>
                                        <button type="button" onClick={() => setIsAuthModalOpen(false)} className="p-2 rounded-xl hover:bg-[#dddddd] text-[#cbcbcb] hover:text-[#818181] transition-colors">
                                            <X size={18} className="text-[#a6a6a6]" />
                                        </button>
                                    </div>

                                    {authError ? <div className="p-3 mb-3 bg-[#dddddd] text-[#818181] border border-red-100 rounded-lg text-sm">{authError}</div> : null}

                                    <div className="space-y-3">
                                        {!requestInfo?.request_id ? (
                                            <div className="p-3 bg-[#dddddd] border border-[#cbcbcb] rounded-xl text-sm text-[#818181] font-medium shadow-sm">
                                                No active OTP request. Click "Request OTP" to notify the admin.
                                            </div>
                                        ) : null}
                                        <div>
                                            <label className="block text-xs font-medium text-[#a6a6a6] mb-1">OTP</label>
                                            <input
                                                type="password"
                                                inputMode="numeric"
                                                autoComplete="one-time-code"
                                                value={otp}
                                                onChange={(e) => setOtp(e.target.value)}
                                                className="w-full px-3 py-2 border border-[#cbcbcb] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#818181]/20 focus:border-[#818181] bg-white text-[#818181] font-medium transition-all"
                                            />
                                        </div>
                                        <button
                                            type="button"
                                            onClick={verifyCode}
                                            disabled={verifying || !otp.trim() || !requestInfo?.request_id}
                                            className="w-full min-h-[48px] py-3 bg-[#818181] text-white rounded-xl font-semibold text-sm hover:bg-[#a6a6a6] active:bg-[#555] transition-colors shadow-sm disabled:opacity-50 cursor-pointer touch-manipulation select-none"
                                            style={{ WebkitTapHighlightColor: 'transparent' }}
                                        >
                                            Verify OTP
                                        </button>
                                        <button
                                            type="button"
                                            onClick={requestNewCode}
                                            disabled={requesting || !canResend}
                                            className="w-full min-h-[48px] py-3 border border-[#cbcbcb] text-[#818181] rounded-xl font-semibold text-sm hover:bg-[#dddddd] active:bg-[#cbcbcb] transition-colors disabled:opacity-50 cursor-pointer touch-manipulation select-none"
                                            style={{ WebkitTapHighlightColor: 'transparent' }}
                                        >
                                            {canResend
                                                ? requestInfo?.request_id
                                                    ? 'Resend Code'
                                                    : 'Request OTP'
                                                : `Resend Code in ${Math.floor(resendWaitSeconds / 60)}:${String(resendWaitSeconds % 60).padStart(2, '0')}`}
                                        </button>
                                    </div>
                                </Dialog.Panel>
                            </Transition.Child>
                        </div>
                    </div>
                </Dialog>
            </Transition>

            <Transition appear show={isItemModalOpen} as={React.Fragment}>
                <Dialog as="div" className="relative z-50" onClose={() => setIsItemModalOpen(false)}>
                    <Transition.Child as={React.Fragment} enter="ease-out duration-200" enterFrom="opacity-0" enterTo="opacity-100" leave="ease-in duration-150" leaveFrom="opacity-100" leaveTo="opacity-0">
                        <div className="fixed inset-0 bg-[#818181]/30 backdrop-blur-sm" />
                    </Transition.Child>
                    <div className="fixed inset-0 overflow-y-auto">
                        <div className="flex min-h-full items-center justify-center p-4">
                            <Transition.Child as={React.Fragment} enter="ease-out duration-200" enterFrom="opacity-0 scale-95" enterTo="opacity-100 scale-100" leave="ease-in duration-150" leaveFrom="opacity-100 scale-100" leaveTo="opacity-0 scale-95">
                                <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-white p-6 shadow-2xl border border-[#cbcbcb]">
                                    <div className="flex items-center justify-between mb-4">
                                        <Dialog.Title className="text-lg font-medium text-[#818181]">{editingItem ? 'Edit Item' : 'Add Item'}</Dialog.Title>
                                        <button type="button" onClick={() => setIsItemModalOpen(false)} className="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl text-[#cbcbcb] hover:text-[#818181] hover:bg-[#dddddd] active:bg-[#cbcbcb] transition-colors cursor-pointer touch-manipulation">
                                            <X size={18} />
                                        </button>
                                    </div>

                                    <form onSubmit={handleSaveItem} className="space-y-3">
                                        <div>
                                            <label className="block text-xs font-semibold text-[#a6a6a6] mb-1">Category</label>
                                            <select
                                                value={itemForm.category_id}
                                                onChange={(e) => setItemForm((f) => ({ ...f, category_id: e.target.value }))}
                                                className="w-full px-3 py-2 border border-[#cbcbcb] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#818181]/20 focus:border-[#818181] bg-white text-[#818181] font-medium transition-all"
                                                required
                                            >
                                                {categories.map((c) => (
                                                    <option key={c.id} value={String(c.id)}>
                                                        {c.name}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-semibold text-[#a6a6a6] mb-1">Name</label>
                                            <input
                                                value={itemForm.name}
                                                onChange={(e) => setItemForm((f) => ({ ...f, name: e.target.value }))}
                                                className="w-full px-3 py-2 border border-[#cbcbcb] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#818181]/20 focus:border-[#818181] bg-white text-[#818181] font-medium transition-all"
                                                required
                                            />
                                        </div>
                                        <div className={`grid grid-cols-1 gap-3 ${editingItem ? 'sm:grid-cols-2 lg:grid-cols-4' : 'sm:grid-cols-3'}`}>
                                            <div>
                                                <label className="block text-xs font-semibold text-[#a6a6a6] mb-1">Price</label>
                                                <input
                                                    type="number"
                                                    min="0"
                                                    step="0.01"
                                                    value={itemForm.price}
                                                    onChange={(e) => setItemForm((f) => ({ ...f, price: e.target.value }))}
                                                    className="w-full px-3 py-2 border border-[#cbcbcb] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#818181]/20 focus:border-[#818181] bg-white text-[#818181] font-medium transition-all"
                                                    required
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-semibold text-[#a6a6a6] mb-1">Cost</label>
                                                <input
                                                    type="number"
                                                    min="0"
                                                    step="0.01"
                                                    value={itemForm.cost}
                                                    onChange={(e) => setItemForm((f) => ({ ...f, cost: e.target.value }))}
                                                    className="w-full px-3 py-2 border border-[#cbcbcb] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#818181]/20 focus:border-[#818181] bg-white text-[#818181] font-medium transition-all"
                                                    required
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-semibold text-[#a6a6a6] mb-1">Stock</label>
                                                <input
                                                    type="number"
                                                    min="0"
                                                    step="1"
                                                    value={itemForm.stock_qty}
                                                    onChange={(e) => setItemForm((f) => ({ ...f, stock_qty: e.target.value }))}
                                                    className="w-full px-3 py-2 border border-[#cbcbcb] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#818181]/20 focus:border-[#818181] bg-white text-[#818181] font-medium transition-all"
                                                />
                                            </div>
                                            {editingItem ? (
                                                <div>
                                                    <label className="block text-xs font-semibold text-[#a6a6a6] mb-1">
                                                        Adjustment Reason
                                                        <span className="text-red-500 ml-1">* Required</span>
                                                    </label>
                                                    <input
                                                        value={itemForm.adjustment_reason}
                                                        onChange={(e) => setItemForm((f) => ({ ...f, adjustment_reason: e.target.value }))}
                                                        className="w-full px-3 py-2 border border-[#cbcbcb] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#818181]/20 focus:border-[#818181] bg-white text-[#818181] font-medium transition-all"
                                                        placeholder="Required for any changes"
                                                        required
                                                    />
                                                </div>
                                            ) : null}
                                        </div>
                                        <div className="flex gap-2 pt-2">
                                            <button
                                                type="submit"
                                                disabled={!accessToken}
                                                className="flex-1 min-h-[48px] py-3 bg-[#818181] text-white rounded-xl font-semibold text-sm hover:bg-[#a6a6a6] active:bg-[#555] shadow-sm transition-colors disabled:opacity-50 cursor-pointer touch-manipulation select-none"
                                                style={{ WebkitTapHighlightColor: 'transparent' }}
                                            >
                                                Save
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setIsItemModalOpen(false)}
                                                className="px-4 min-h-[48px] py-3 border border-[#cbcbcb] text-[#818181] rounded-xl font-semibold text-sm hover:bg-[#dddddd] active:bg-[#cbcbcb] transition-colors cursor-pointer touch-manipulation select-none"
                                                style={{ WebkitTapHighlightColor: 'transparent' }}
                                            >
                                                Cancel
                                            </button>
                                        </div>
                                    </form>
                                </Dialog.Panel>
                            </Transition.Child>
                        </div>
                    </div>
                </Dialog>
            </Transition>

            {/* ── Duplicate Item Modal ── */}
            <Transition appear show={isDuplicateModalOpen} as={React.Fragment}>
                <Dialog as="div" className="relative z-[60]" onClose={() => setIsDuplicateModalOpen(false)}>
                    <Transition.Child as={React.Fragment} enter="ease-out duration-200" enterFrom="opacity-0" enterTo="opacity-100" leave="ease-in duration-150" leaveFrom="opacity-100" leaveTo="opacity-0">
                        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" />
                    </Transition.Child>
                    <div className="fixed inset-0 overflow-y-auto">
                        <div className="flex min-h-full items-center justify-center p-4">
                            <Transition.Child as={React.Fragment} enter="ease-out duration-200" enterFrom="opacity-0 scale-95" enterTo="opacity-100 scale-100" leave="ease-in duration-150" leaveFrom="opacity-100 scale-100" leaveTo="opacity-0 scale-95">
                                <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-white text-left align-middle shadow-xl transition-all border border-[#cbcbcb]">
                                    <div className="px-6 py-4 border-b border-[#cbcbcb] flex items-center justify-between">
                                        <Dialog.Title className="text-lg font-medium text-orange-600 flex items-center gap-2">
                                            <ShieldCheck className="w-5 h-5" /> Similar Items Found
                                        </Dialog.Title>
                                        <button type="button" onClick={() => setIsDuplicateModalOpen(false)} className="text-[#a6a6a6] hover:text-[#818181] transition-colors"><X size={20} /></button>
                                    </div>
                                    <div className="px-6 py-4">
                                        <p className="text-sm text-[#818181] mb-4">
                                            We found similar items already existing in the inventory. Are you sure you want to add a new item?
                                        </p>
                                        <div className="max-h-40 overflow-y-auto border border-[#cbcbcb] rounded-xl mb-4 bg-gray-50">
                                            {duplicateItems.map((dup, i) => (
                                                <div key={i} className={`p-3 flex justify-between items-center ${i !== duplicateItems.length - 1 ? 'border-b border-[#cbcbcb]' : ''}`}>
                                                    <div>
                                                        <div className="font-semibold text-sm text-[#818181]">{dup.name}</div>
                                                        <div className="text-xs text-[#a6a6a6]">SKU: {dup.sku || 'N/A'} • Price: {PESO}{Number(dup.price).toFixed(2)}</div>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setIsDuplicateModalOpen(false);
                                                            openEditItem(dup);
                                                        }}
                                                        className="px-3 py-1.5 bg-white border border-[#cbcbcb] rounded-lg text-xs font-semibold text-[#818181] hover:bg-gray-50 transition-colors"
                                                    >
                                                        Select
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                        <div className="flex gap-2 pt-2">
                                            <button
                                                type="button"
                                                onClick={(e) => handleSaveItem(e, true)}
                                                className="flex-1 min-h-[48px] py-3 border border-orange-500 text-orange-600 rounded-xl font-semibold text-sm hover:bg-orange-50 active:bg-orange-100 transition-colors cursor-pointer"
                                            >
                                                Proceed to new item
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setIsDuplicateModalOpen(false)}
                                                className="flex-1 min-h-[48px] py-3 bg-[#818181] text-white rounded-xl font-semibold text-sm hover:bg-[#a6a6a6] active:bg-[#555] shadow-sm transition-colors cursor-pointer"
                                            >
                                                Cancel
                                            </button>
                                        </div>
                                    </div>
                                </Dialog.Panel>
                            </Transition.Child>
                        </div>
                    </div>
                </Dialog>
            </Transition>

            {/* ── Photo Modal ── */}
            <Transition appear show={isPhotoModalOpen} as={React.Fragment}>
                <Dialog as="div" className="relative z-50" onClose={cameraOpen ? () => {} : () => { stopCamera(); setIsPhotoModalOpen(false); }}>
                    <Transition.Child as={React.Fragment} enter="ease-out duration-200" enterFrom="opacity-0" enterTo="opacity-100" leave="ease-in duration-150" leaveFrom="opacity-100" leaveTo="opacity-0">
                        <div className="fixed inset-0 bg-[#818181]/30 backdrop-blur-sm" />
                    </Transition.Child>
                    <div className="fixed inset-0 overflow-y-auto">
                        <div className="flex min-h-full items-center justify-center p-4">
                            <Transition.Child as={React.Fragment} enter="ease-out duration-200" enterFrom="opacity-0 scale-95" enterTo="opacity-100 scale-100" leave="ease-in duration-150" leaveFrom="opacity-100 scale-100" leaveTo="opacity-0 scale-95">
                                <Dialog.Panel className="w-full max-w-2xl transform overflow-hidden rounded-2xl bg-white shadow-2xl border border-[#cbcbcb]">
                                    <div className="px-5 py-4 border-b border-[#cbcbcb] flex items-center justify-between gap-3">
                                        <div className="min-w-0">
                                            <Dialog.Title className="text-sm font-semibold text-[#818181] truncate">Product Photos</Dialog.Title>
                                            <div className="text-[11px] font-medium text-[#a6a6a6] truncate">{photoItem?.name}</div>
                                        </div>
                                        <button type="button" onClick={() => { stopCamera(); setIsPhotoModalOpen(false); }} className="p-2 rounded-xl border border-[#cbcbcb] hover:bg-[#dddddd]"><X size={18} /></button>
                                    </div>
                                    {imagesError && <div className="px-5 py-2 bg-red-50 text-red-600 text-xs font-medium border-b border-red-100">{imagesError}</div>}
                                    <div className="p-5 grid grid-cols-1 lg:grid-cols-3 gap-4">
                                        {/* Upload Panel */}
                                        <div className="lg:col-span-1">
                                            <div className="rounded-2xl border-2 border-dashed border-[#cbcbcb] bg-[#f9f9f9] p-4">
                                                <div className="flex items-center gap-3 mb-4">
                                                    <div className="w-9 h-9 rounded-xl border border-[#cbcbcb] bg-white flex items-center justify-center"><Upload size={16} className="text-[#818181]" /></div>
                                                    <div><div className="text-sm font-semibold text-[#818181]">Add Photos</div><div className="text-[10px] text-[#a6a6a6]">JPEG, PNG, WebP · max 5MB</div></div>
                                                </div>
                                                <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={e => setPendingFromFiles(e.target.files)} className="hidden" />
                                                <div className="grid grid-cols-2 gap-2 mb-2">
                                                    <button type="button" onClick={() => fileInputRef.current?.click()} className="h-10 rounded-xl border border-[#cbcbcb] bg-white text-xs font-semibold text-[#818181] hover:bg-[#dddddd] flex items-center justify-center gap-1.5"><Upload size={13} />Browse</button>
                                                    <button type="button" onClick={() => startCamera()} className="h-10 rounded-xl border border-[#cbcbcb] bg-white text-xs font-semibold text-[#818181] hover:bg-[#dddddd] flex items-center justify-center gap-1.5"><Camera size={13} />Camera</button>
                                                </div>
                                                {pendingPreviews.length > 0 && (
                                                    <div className="grid grid-cols-3 gap-1.5 mb-2">
                                                        {pendingPreviews.map(p => <img key={p.url} src={p.url} alt="" className="w-full h-16 object-cover rounded-lg border border-[#cbcbcb]" />)}
                                                    </div>
                                                )}
                                                <button type="button" onClick={uploadImages} disabled={uploading || pendingFiles.length === 0} className="w-full h-10 rounded-xl bg-[#818181] text-white text-xs font-semibold hover:bg-[#555] disabled:opacity-50 flex items-center justify-center gap-2">
                                                    {uploading ? <Loader2 size={14} className="animate-spin" /> : null}
                                                    {uploading ? 'Uploading…' : `Upload${pendingFiles.length > 0 ? ` (${pendingFiles.length})` : ''}`}
                                                </button>
                                            </div>
                                        </div>
                                        {/* Gallery Panel */}
                                        <div className="lg:col-span-2">
                                            <div className="flex items-center justify-between mb-3">
                                                <div className="text-[10px] font-semibold text-[#a6a6a6] uppercase tracking-widest">Saved Images</div>
                                                <button type="button" onClick={reloadImages} disabled={imagesLoading} className="h-8 px-3 rounded-xl border border-[#cbcbcb] bg-white text-xs font-semibold text-[#818181] hover:bg-[#dddddd] disabled:opacity-50">Refresh</button>
                                            </div>
                                            {imagesLoading ? (
                                                <div className="text-sm text-[#a6a6a6] animate-pulse">Loading…</div>
                                            ) : itemImages.length === 0 ? (
                                                <div className="flex flex-col items-center justify-center h-40 text-[#a6a6a6] gap-2"><ImagePlus size={32} strokeWidth={1} /><p className="text-sm">No photos yet.</p></div>
                                            ) : (
                                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                                    {itemImages.map(img => {
                                                        const src = img.thumb_url || img.url;
                                                        const isPrimary = Boolean(img.is_primary);
                                                        return (
                                                            <div key={img.id} className="rounded-2xl border border-[#cbcbcb] bg-white overflow-hidden">
                                                                <div className="relative">
                                                                    <img src={src} alt="" className="w-full h-24 object-cover" />
                                                                    {isPrimary && <div className="absolute top-1.5 left-1.5 flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-white/90 border border-[#cbcbcb] text-[9px] font-semibold text-[#818181]"><Star size={10} className="text-[#d94a79]" />Primary</div>}
                                                                </div>
                                                                <div className="p-1.5 flex gap-1.5">
                                                                    <button type="button" onClick={() => setImagePrimary(img.id)} disabled={isPrimary} className="flex-1 h-8 rounded-lg border border-[#cbcbcb] bg-white text-[10px] font-semibold text-[#818181] hover:bg-[#dddddd] disabled:opacity-40">Set primary</button>
                                                                    <button type="button" onClick={() => deleteImage(img.id)} className="h-8 w-8 rounded-lg border border-[#cbcbcb] bg-white text-[#818181] hover:bg-red-50 hover:text-red-500 hover:border-red-200 flex items-center justify-center flex-shrink-0"><Trash2 size={13} /></button>
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </Dialog.Panel>
                            </Transition.Child>
                        </div>
                    </div>
                </Dialog>
            </Transition>

            {/* ── Transfer Modal ── */}
            <Transition appear show={isTransferModalOpen} as={React.Fragment}>
                <Dialog as="div" className="relative z-[100]" onClose={() => setIsTransferModalOpen(false)}>
                    <Transition.Child as={React.Fragment} enter="ease-out duration-200" enterFrom="opacity-0" enterTo="opacity-100" leave="ease-in duration-150" leaveFrom="opacity-100" leaveTo="opacity-0">
                        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" />
                    </Transition.Child>
                    <div className="fixed inset-0 overflow-y-auto">
                        <div className="flex min-h-full items-center justify-center p-4">
                            <Transition.Child as={React.Fragment} enter="ease-out duration-200" enterFrom="opacity-0 scale-95" enterTo="opacity-100 scale-100" leave="ease-in duration-150" leaveFrom="opacity-100 scale-100" leaveTo="opacity-0 scale-95">
                                <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-white text-left align-middle shadow-xl transition-all border border-[#cbcbcb]">
                                    <div className="px-6 py-4 border-b border-[#cbcbcb] flex items-center justify-between">
                                        <Dialog.Title className="text-lg font-medium text-[#818181]">Transfer Stocks</Dialog.Title>
                                        <button type="button" onClick={() => setIsTransferModalOpen(false)} className="text-[#a6a6a6] hover:text-[#818181] transition-colors"><X size={20} /></button>
                                    </div>
                                    <div className="px-6 py-4">
                                        {transferPullOutError && <div className="mb-4 p-3 bg-red-50 text-red-600 rounded-lg text-sm border border-red-100">{transferPullOutError}</div>}
                                        <div className="mb-4">
                                            <p className="text-sm font-medium text-[#818181] mb-1">Item:</p>
                                            <p className="text-sm font-semibold">{transferItem?.name}</p>
                                            <p className="text-xs text-[#a6a6a6]">Current Stock: {transferItem?.stock_qty}</p>
                                        </div>
                                        <form onSubmit={handleTransferSubmit} className="space-y-4">
                                            <div>
                                                <label className="block text-[11px] font-semibold text-[#a6a6a6] uppercase tracking-wider mb-1.5">To Branch</label>
                                                <select
                                                    required
                                                    value={transferForm.to_branch_id}
                                                    onChange={(e) => setTransferForm({ ...transferForm, to_branch_id: e.target.value })}
                                                    className="w-full h-10 px-3 rounded-xl border border-[#cbcbcb] text-sm text-[#818181] bg-white focus:outline-none focus:border-[#818181] transition-colors appearance-none"
                                                >
                                                    <option value="">Select Branch</option>
                                                    {activeBranches.map((b) => (
                                                        <option key={b.id} value={b.id}>{b.name}</option>
                                                    ))}
                                                </select>
                                            </div>
                                            <div>
                                                <label className="block text-[11px] font-semibold text-[#a6a6a6] uppercase tracking-wider mb-1.5">Quantity to Transfer</label>
                                                <input
                                                    type="number"
                                                    min="1"
                                                    required
                                                    value={transferForm.quantity}
                                                    onChange={(e) => setTransferForm({ ...transferForm, quantity: e.target.value })}
                                                    className="w-full h-10 px-3 rounded-xl border border-[#cbcbcb] text-sm text-[#818181] bg-white focus:outline-none focus:border-[#818181] transition-colors"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-[11px] font-semibold text-[#a6a6a6] uppercase tracking-wider mb-1.5">Reason</label>
                                                <textarea
                                                    required
                                                    rows="3"
                                                    value={transferForm.reason}
                                                    onChange={(e) => setTransferForm({ ...transferForm, reason: e.target.value })}
                                                    className="w-full p-3 rounded-xl border border-[#cbcbcb] text-sm text-[#818181] bg-white focus:outline-none focus:border-[#818181] transition-colors resize-none"
                                                />
                                            </div>
                                            <div className="pt-2">
                                                <button type="submit" className="w-full min-h-[48px] h-10 rounded-xl bg-[#818181] text-white text-[12px] font-semibold shadow-sm hover:bg-[#a6a6a6] active:bg-[#555] transition-colors cursor-pointer touch-manipulation select-none" style={{ WebkitTapHighlightColor: 'transparent' }}>Confirm Transfer</button>
                                            </div>
                                        </form>
                                    </div>
                                </Dialog.Panel>
                            </Transition.Child>
                        </div>
                    </div>
                </Dialog>
            </Transition>

            {/* ── Pull Out Modal ── */}
            <Transition appear show={isPullOutModalOpen} as={React.Fragment}>
                <Dialog as="div" className="relative z-[100]" onClose={() => setIsPullOutModalOpen(false)}>
                    <Transition.Child as={React.Fragment} enter="ease-out duration-200" enterFrom="opacity-0" enterTo="opacity-100" leave="ease-in duration-150" leaveFrom="opacity-100" leaveTo="opacity-0">
                        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" />
                    </Transition.Child>
                    <div className="fixed inset-0 overflow-y-auto">
                        <div className="flex min-h-full items-center justify-center p-4">
                            <Transition.Child as={React.Fragment} enter="ease-out duration-200" enterFrom="opacity-0 scale-95" enterTo="opacity-100 scale-100" leave="ease-in duration-150" leaveFrom="opacity-100 scale-100" leaveTo="opacity-0 scale-95">
                                <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-white text-left align-middle shadow-xl transition-all border border-[#cbcbcb]">
                                    <div className="px-6 py-4 border-b border-[#cbcbcb] flex items-center justify-between">
                                        <Dialog.Title className="text-lg font-medium text-[#818181]">Pull Out Stocks</Dialog.Title>
                                        <button type="button" onClick={() => setIsPullOutModalOpen(false)} className="text-[#a6a6a6] hover:text-[#818181] transition-colors"><X size={20} /></button>
                                    </div>
                                    <div className="px-6 py-4">
                                        {transferPullOutError && <div className="mb-4 p-3 bg-red-50 text-red-600 rounded-lg text-sm border border-red-100">{transferPullOutError}</div>}
                                        <div className="mb-4">
                                            <p className="text-sm font-medium text-[#818181] mb-1">Item:</p>
                                            <p className="text-sm font-semibold">{pullOutItem?.name}</p>
                                            <p className="text-xs text-[#a6a6a6]">Current Stock: {pullOutItem?.stock_qty}</p>
                                        </div>
                                        <form onSubmit={handlePullOutSubmit} className="space-y-4">
                                            <div>
                                                <label className="block text-[11px] font-semibold text-[#a6a6a6] uppercase tracking-wider mb-1.5">Quantity to Pull Out</label>
                                                <input
                                                    type="number"
                                                    min="1"
                                                    required
                                                    value={pullOutForm.quantity}
                                                    onChange={(e) => setPullOutForm({ ...pullOutForm, quantity: e.target.value })}
                                                    className="w-full h-10 px-3 rounded-xl border border-[#cbcbcb] text-sm text-[#818181] bg-white focus:outline-none focus:border-[#818181] transition-colors"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-[11px] font-semibold text-[#a6a6a6] uppercase tracking-wider mb-1.5">Reason</label>
                                                <textarea
                                                    required
                                                    rows="3"
                                                    value={pullOutForm.reason}
                                                    onChange={(e) => setPullOutForm({ ...pullOutForm, reason: e.target.value })}
                                                    className="w-full p-3 rounded-xl border border-[#cbcbcb] text-sm text-[#818181] bg-white focus:outline-none focus:border-[#818181] transition-colors resize-none"
                                                />
                                            </div>
                                            <div className="pt-2">
                                                <button type="submit" className="w-full min-h-[48px] h-10 rounded-xl border border-[#cbcbcb] text-orange-500 hover:bg-orange-50 hover:border-orange-200 active:bg-orange-100 text-[12px] font-semibold shadow-sm transition-colors cursor-pointer touch-manipulation select-none" style={{ WebkitTapHighlightColor: 'transparent' }}>Confirm Pull Out</button>
                                            </div>
                                        </form>
                                    </div>
                                </Dialog.Panel>
                            </Transition.Child>
                        </div>
                    </div>
                </Dialog>
            </Transition>

            {/* ── Camera Overlay ── */}
            <Transition show={cameraOpen} as={React.Fragment}>
                <Dialog as="div" className="relative z-[200]" onClose={stopCamera}>
                    <Transition.Child
                        as={React.Fragment}
                        enter="transition-opacity ease-out duration-200"
                        enterFrom="opacity-0"
                        enterTo="opacity-100"
                        leave="transition-opacity ease-in duration-150"
                        leaveFrom="opacity-100"
                        leaveTo="opacity-0"
                    >
                        <div
                            style={{
                                position: 'fixed',
                                inset: 0,
                                zIndex: 200,
                                background: '#000',
                                display: 'flex',
                                flexDirection: 'column',
                            }}
                        >
                            <canvas ref={canvasRef} style={{ display: 'none' }} />
                            {cameraPhase === 'live' ? (
                                <>
                                    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10, padding: 'calc(env(safe-area-inset-top, 0px) + 16px) 16px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'linear-gradient(to bottom,rgba(0,0,0,.65) 0%,transparent 100%)' }}>
                                        <button type="button" onClick={stopCamera} aria-label="Close camera" style={{ width: 40, height: 40, borderRadius: '50%', background: 'rgba(255,255,255,.15)', border: '1px solid rgba(255,255,255,.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', cursor: 'pointer' }}><X size={20} /></button>
                                        <span style={{ color: '#fff', fontWeight: 900, fontSize: 14 }}>Take Product Photo</span>
                                        <button type="button" onClick={toggleFlash} aria-label="Flash" style={{ width: 40, height: 40, borderRadius: '50%', background: flashOn ? '#fff' : 'rgba(255,255,255,.15)', border: '1px solid rgba(255,255,255,.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: flashOn ? '#1f2937' : '#fff', cursor: 'pointer', transition: 'all 0.2s' }}><Zap size={18} /></button>
                                    </div>
                                    <video ref={videoRef} autoPlay playsInline muted style={{ flex: 1, width: '100%', objectFit: 'cover', transform: facingMode === 'user' ? 'scaleX(-1)' : 'none' }} />
                                    {!cameraReady && <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Loader2 size={36} color="#fff" className="animate-spin" /></div>}
                                    {cameraError && <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', background: 'rgba(0,0,0,.85)', borderRadius: 16, padding: '20px 24px', maxWidth: 320, textAlign: 'center' }}><p style={{ color: '#fca5a5', fontWeight: 700 }}>{cameraError}</p><button type="button" onClick={stopCamera} style={{ marginTop: 12, padding: '8px 20px', borderRadius: 8, background: '#fff', fontWeight: 700, cursor: 'pointer' }}>Close</button></div>}
                                    <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 10, padding: '32px 24px calc(env(safe-area-inset-bottom, 0px) + 32px)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'linear-gradient(to top,rgba(0,0,0,.7) 0%,transparent 100%)' }}>
                                        <div style={{ width: 52 }} />
                                        <button type="button" onClick={capturePhoto} disabled={!cameraReady} aria-label="Capture" style={{ width: 76, height: 76, borderRadius: '50%', background: cameraReady ? '#fff' : 'rgba(255,255,255,.35)', border: '4px solid rgba(255,255,255,.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: cameraReady ? 'pointer' : 'not-allowed' }}><Camera size={28} color="#1f2937" /></button>
                                        <button type="button" onClick={switchCamera} aria-label="Switch camera" style={{ width: 52, height: 52, borderRadius: '50%', background: 'rgba(255,255,255,.15)', border: '1px solid rgba(255,255,255,.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', cursor: 'pointer' }}><RefreshCw size={22} /></button>
                                    </div>
                                </>
                            ) : null}
                            {cameraPhase === 'preview' && capturedPreview ? (
                                <>
                                    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10, padding: 'calc(env(safe-area-inset-top, 0px) + 16px) 16px 16px', display: 'flex', justifyContent: 'center', background: 'linear-gradient(to bottom,rgba(0,0,0,.65) 0%,transparent 100%)' }}><span style={{ color: '#fff', fontWeight: 900, fontSize: 14 }}>Preview</span></div>
                                    <img src={capturedPreview.url} alt="Captured" style={{ flex: 1, width: '100%', objectFit: 'cover' }} />
                                    <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 10, padding: '24px 24px calc(env(safe-area-inset-bottom, 0px) + 32px)', display: 'flex', gap: 16, justifyContent: 'center', background: 'linear-gradient(to top,rgba(0,0,0,.75) 0%,transparent 100%)' }}>
                                        <button type="button" onClick={retakePhoto} style={{ flex: 1, maxWidth: 160, height: 52, borderRadius: 26, background: 'rgba(255,255,255,.15)', border: '1px solid rgba(255,255,255,.3)', color: '#fff', fontWeight: 900, cursor: 'pointer' }}>Retake</button>
                                        <button type="button" onClick={usePhotoCapture} style={{ flex: 1, maxWidth: 160, height: 52, borderRadius: 26, background: '#fff', fontWeight: 900, cursor: 'pointer' }}>Use Photo</button>
                                    </div>
                                </>
                            ) : null}
                        </div>
                    </Transition.Child>
                </Dialog>
            </Transition>

            {/* ── Request Item Modal ── */}
            <Transition appear show={isRequestModalOpen} as={React.Fragment}>
                <Dialog as="div" className="relative z-[100]" onClose={() => setIsRequestModalOpen(false)}>
                    <Transition.Child as={React.Fragment} enter="ease-out duration-200" enterFrom="opacity-0" enterTo="opacity-100" leave="ease-in duration-150" leaveFrom="opacity-100" leaveTo="opacity-0">
                        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" />
                    </Transition.Child>
                    <div className="fixed inset-0 overflow-y-auto">
                        <div className="flex min-h-full items-center justify-center p-4">
                            <Transition.Child as={React.Fragment} enter="ease-out duration-200" enterFrom="opacity-0 scale-95" enterTo="opacity-100 scale-100" leave="ease-in duration-150" leaveFrom="opacity-100 scale-100" leaveTo="opacity-0 scale-95">
                                <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-white text-left align-middle shadow-xl transition-all border border-[#cbcbcb]">
                                    <div className="px-6 py-4 border-b border-[#cbcbcb] flex items-center justify-between">
                                        <Dialog.Title className="text-lg font-medium text-[#818181]">Request Item</Dialog.Title>
                                        <button type="button" onClick={() => setIsRequestModalOpen(false)} className="text-[#a6a6a6] hover:text-[#818181] transition-colors"><X size={20} /></button>
                                    </div>
                                    <div className="px-6 py-4">
                                        {requestStatus && <div className={`mb-4 p-3 rounded-lg text-sm border ${requestStatus.startsWith('Error') ? 'bg-red-50 text-red-600 border-red-100' : 'bg-[#e8f5e9] text-[#2e7d32] border-[#c8e6c9]'}`}>{requestStatus}</div>}
                                        <form onSubmit={handleRequestSubmit} className="space-y-4">
                                            <div>
                                                <label className="block text-[11px] font-semibold text-[#a6a6a6] uppercase tracking-wider mb-1.5">Select Item</label>
                                                <select
                                                    required
                                                    value={requestForm.sku}
                                                    onChange={(e) => {
                                                        const selectedItem = items.find(it => it.sku === e.target.value);
                                                        if (selectedItem) {
                                                            setRequestForm({ ...requestForm, sku: selectedItem.sku, item_name: selectedItem.name });
                                                        } else {
                                                            setRequestForm({ ...requestForm, sku: '', item_name: '' });
                                                        }
                                                    }}
                                                    className="w-full h-10 px-3 rounded-xl border border-[#cbcbcb] text-sm text-[#818181] bg-white focus:outline-none focus:border-[#818181] transition-colors appearance-none"
                                                >
                                                    <option value="" disabled>Select an item...</option>
                                                    {items.map(it => (
                                                        <option key={it.id} value={it.sku}>{it.name}</option>
                                                    ))}
                                                </select>
                                            </div>
                                            <div>
                                                <label className="block text-[11px] font-semibold text-[#a6a6a6] uppercase tracking-wider mb-1.5">Quantity</label>
                                                <input
                                                    type="number"
                                                    min="1"
                                                    required
                                                    value={requestForm.quantity}
                                                    onChange={(e) => setRequestForm({ ...requestForm, quantity: e.target.value })}
                                                    placeholder="1"
                                                    className="w-full h-10 px-3 rounded-xl border border-[#cbcbcb] text-sm text-[#818181] bg-white focus:outline-none focus:border-[#818181] transition-colors"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-[11px] font-semibold text-[#a6a6a6] uppercase tracking-wider mb-1.5">Reason for Request</label>
                                                <select
                                                    required
                                                    value={requestForm.reason}
                                                    onChange={(e) => setRequestForm({ ...requestForm, reason: e.target.value })}
                                                    className="w-full h-10 px-3 rounded-xl border border-[#cbcbcb] text-sm text-[#818181] bg-white focus:outline-none focus:border-[#818181] transition-colors appearance-none"
                                                >
                                                    <option value="" disabled>Select a reason</option>
                                                    <option value="Refill">Refill</option>
                                                    <option value="Out of Stock">Out of Stock</option>
                                                    <option value="Others">Others</option>
                                                </select>
                                            </div>
                                            <div className="pt-2">
                                                <button type="submit" disabled={!isItemValid} className="w-full min-h-[48px] h-10 rounded-xl bg-[#818181] text-white text-[12px] font-semibold shadow-sm hover:bg-[#a6a6a6] active:bg-[#555] disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer touch-manipulation select-none" style={{ WebkitTapHighlightColor: 'transparent' }}>Submit Request</button>
                                            </div>
                                        </form>
                                    </div>
                                </Dialog.Panel>
                            </Transition.Child>
                        </div>
                    </div>
                </Dialog>
            </Transition>

            {/* ── Universal Delete Confirmation ── */}
            <ConfirmDeleteModal
                open={deleteModalOpen}
                onClose={() => { setDeleteModalOpen(false); setDeleteTarget(null); }}
                onConfirm={executeDelete}
                confirming={deleteConfirming}
                requireCountdown={deleteTarget?.type !== 'image'}
                title={deleteTarget?.type === 'image' ? 'Delete Image' : 'Delete Item'}
                itemName={deleteTarget?.type === 'item' ? deleteTarget.item?.name : undefined}
                message={deleteTarget?.type === 'image' ? 'Are you sure you want to permanently delete this image? This action cannot be undone.' : undefined}
            />
        </div>
    );
};

export default CashierInventoryManagement;
