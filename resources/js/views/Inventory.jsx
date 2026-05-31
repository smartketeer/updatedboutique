import React, { useEffect, useMemo, useRef, useState, Fragment } from 'react';
import axios from 'axios';
import { Dialog, Transition, Menu } from '@headlessui/react';
import { Package, Search, MoreHorizontal, Upload, X, ImagePlus, Star, Trash2, Loader2, ArrowUp, ArrowDown, Camera, CameraOff, RefreshCw, Zap } from 'lucide-react';
import ConfirmDeleteModal from '../components/ConfirmDeleteModal';

const PESO = '\u20B1';
const ELLIPSIS = '\u2026';
const EM_DASH = '\u2014';

const Inventory = () => {
    const [items, setItems] = useState([]);
    const [categories, setCategories] = useState([]);
    const [branches, setBranches] = useState([]);
    const [branchId, setBranchId] = useState('');
    const [branchesLoading, setBranchesLoading] = useState(true);
    const [loading, setLoading] = useState(true);

    const [search, setSearch] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('all');
    const [stockStatusFilter, setStockStatusFilter] = useState('all');
    const [stockSort, setStockSort] = useState('asc'); // 'asc' | 'desc'

    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(25);
    const [jumpToPage, setJumpToPage] = useState('');
    const [isFiltersOpen, setIsFiltersOpen] = useState(false);
    const [isImagesOpen, setIsImagesOpen] = useState(false);
    const [selectedItem, setSelectedItem] = useState(null);
    const [itemImages, setItemImages] = useState([]);
    const [imagesLoading, setImagesLoading] = useState(false);
    const [imagesError, setImagesError] = useState('');
    const [pendingFiles, setPendingFiles] = useState([]);
    const [pendingPreviews, setPendingPreviews] = useState([]);
    const [uploading, setUploading] = useState(false);

    // Camera state
    const [cameraOpen, setCameraOpen] = useState(false);   // fullscreen overlay visible
    const [cameraPhase, setCameraPhase] = useState('live'); // 'live' | 'preview'
    const [cameraError, setCameraError] = useState('');
    const [cameraReady, setCameraReady] = useState(false);
    const [facingMode, setFacingMode] = useState('environment');
    const [capturedPreview, setCapturedPreview] = useState(null); // { url, file }
    const [flashOn, setFlashOn] = useState(false);

    const searchInputRef = useRef(null);
    const fileInputRef = useRef(null);
    const videoRef = useRef(null);
    const streamRef = useRef(null);
    const capturedBlobUrlRef = useRef(null);
    const cameraActiveRef = useRef(false); // true while a camera session should be running

    const categoriesForSelect = useMemo(
        () => categories.filter((c) => String(c?.name || '').trim().toLowerCase() !== 'salon services'),
        [categories],
    );

    const fetchBranches = async () => {
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

    const fetchData = async () => {
        try {
            const [itemsRes, catRes] = await Promise.all([
                axios.get(branchId ? `/api/inventory?branch_id=${encodeURIComponent(branchId)}` : '/api/inventory'),
                axios.get('/api/categories'),
            ]);
            setItems(Array.isArray(itemsRes.data) ? itemsRes.data : Array.isArray(itemsRes.data?.data) ? itemsRes.data.data : []);
            const cats = Array.isArray(catRes.data) ? catRes.data : [];
            setCategories(cats);
        } catch {
            setItems([]);
            setCategories([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchBranches();
    }, []);

    useEffect(() => {
        if (!branchId) return;
        setLoading(true);
        fetchData();
    }, [branchId]);

    useEffect(() => {
        if (categoryFilter === 'all') return;
        const exists = categoriesForSelect.some((c) => String(c?.id) === String(categoryFilter));
        if (!exists) setCategoryFilter('all');
    }, [categoriesForSelect, categoryFilter]);

    useEffect(() => {
        try {
            const raw = localStorage.getItem('inventory_snapshot_filters_v1');
            if (!raw) return;
            const parsed = JSON.parse(raw);
            if (parsed && typeof parsed === 'object') {
                if (typeof parsed.search === 'string') setSearch(parsed.search);
                if (typeof parsed.categoryFilter === 'string') setCategoryFilter(parsed.categoryFilter);
                if (typeof parsed.stockStatusFilter === 'string') setStockStatusFilter(parsed.stockStatusFilter);
                if (typeof parsed.stockSort === 'string') setStockSort(parsed.stockSort);
                if (typeof parsed.pageSize === 'number') setPageSize(parsed.pageSize);
            }
        } catch {}
    }, []);

    useEffect(() => {
        try {
            localStorage.setItem(
                'inventory_snapshot_filters_v1',
                JSON.stringify({
                    search,
                    categoryFilter,
                    stockStatusFilter,
                    stockSort,
                    pageSize,
                }),
            );
        } catch {}
    }, [search, categoryFilter, stockStatusFilter, stockSort, pageSize]);

    useEffect(() => {
        setPage(1);
        setJumpToPage('');
    }, [search, categoryFilter, branchId, stockStatusFilter, pageSize]);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        const onKeyDown = (e) => {
            const target = e.target;
            const tag = target && typeof target === 'object' ? target.tagName : '';
            const isTyping =
                tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target?.isContentEditable === true;
            if (isTyping) return;

            if (e.key === 'Escape') {
                setIsFiltersOpen(false);
                return;
            }

            if (e.ctrlKey && (e.key === 'f' || e.key === 'F')) {
                e.preventDefault();
                const el = searchInputRef.current;
                if (el && typeof el.focus === 'function') {
                    el.focus();
                    if (typeof el.select === 'function') el.select();
                }
            }
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, []);

    const normalizedSearch = search.trim().toLowerCase();
    const filteredItems = useMemo(() => {
        const rows = items.filter((item) => {
            const itemCategoryId = item.category_id ?? item.category?.id;
            const matchesCategory = categoryFilter === 'all' || String(itemCategoryId) === String(categoryFilter);
            if (!matchesCategory) return false;

            const qty = Number(item.stock_qty || 0);
            if (stockStatusFilter === 'low' && (item.is_service || qty <= 0 || qty > 5)) return false;
            if (stockStatusFilter === 'out' && (item.is_service || qty !== 0)) return false;

            if (!normalizedSearch) return true;
            const name = String(item.name || '').toLowerCase();
            const sku = String(item.sku || '').toLowerCase();
            const categoryName = String(item.category?.name || '').toLowerCase();
            return name.includes(normalizedSearch) || sku.includes(normalizedSearch) || categoryName.includes(normalizedSearch);
        });

        const sortDir = stockSort === 'desc' ? -1 : 1;
        const getQty = (it) => {
            if (it?.is_service) return null;
            const raw = it?.stock_qty;
            if (raw === null || raw === undefined || raw === '') return null;
            const n = Number(raw);
            return Number.isFinite(n) ? n : null;
        };

        return [...rows].sort((a, b) => {
            const qa = getQty(a);
            const qb = getQty(b);
            const ha = qa != null;
            const hb = qb != null;
            if (ha !== hb) return ha ? -1 : 1;
            if (!ha && !hb) return String(a?.name || '').localeCompare(String(b?.name || ''));
            if (qa !== qb) return (qa - qb) * sortDir;
            return String(a?.name || '').localeCompare(String(b?.name || ''));
        });
    }, [items, categoryFilter, stockStatusFilter, normalizedSearch, stockSort]);

    const totalPages = Math.max(1, Math.ceil(filteredItems.length / pageSize));
    const safePage = Math.min(page, totalPages);
    const pageStart = (safePage - 1) * pageSize;
    const pageEnd = Math.min(pageStart + pageSize, filteredItems.length);
    const pagedItems = filteredItems.slice(pageStart, pageEnd);

    const exportItemsToCsv = (rows) => {
        try {
            const safeRows = Array.isArray(rows) ? rows : [];
            const header = ['Name', 'SKU', 'Category', 'Price', 'Stock', 'Type'];
            const escape = (value) => {
                const s = value == null ? '' : String(value);
                if (/[",\n]/.test(s)) return `"${s.replaceAll('"', '""')}"`;
                return s;
            };
            const lines = [
                header.join(','),
                ...safeRows.map((r) =>
                    [
                        escape(r?.name),
                        escape(r?.sku || ''),
                        escape(r?.category?.name || ''),
                        escape(r?.price ?? ''),
                        escape(r?.is_service ? '' : r?.stock_qty ?? ''),
                        escape(r?.is_service ? 'Service' : 'Product'),
                    ].join(','),
                ),
            ];
            const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `inventory_snapshot_${branchId || 'all'}_${new Date().toISOString().slice(0, 10)}.csv`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(url);
        } catch {
            alert('Export failed.');
        }
    };

    // ─── Camera helpers ───────────────────────────────────────────────────────
    const stopCameraStream = () => {
        cameraActiveRef.current = false; // signal any pending getUserMedia to abort
        if (streamRef.current) {
            streamRef.current.getTracks().forEach((t) => { try { t.stop(); } catch {} });
            streamRef.current = null;
        }
        if (videoRef.current) {
            videoRef.current.srcObject = null;
        }
        setCameraReady(false);
    };

    const stopCamera = () => {
        stopCameraStream();
        setCameraOpen(false);
        setCameraPhase('live');
        setCameraError('');
    };

    const startCamera = async (facing) => {
        const mode = facing || facingMode;
        setCameraError('');
        setCapturedPreview(null);
        if (capturedBlobUrlRef.current) {
            try { URL.revokeObjectURL(capturedBlobUrlRef.current); } catch {}
            capturedBlobUrlRef.current = null;
        }
        // Stop any pre-existing stream
        if (streamRef.current) {
            streamRef.current.getTracks().forEach((t) => { try { t.stop(); } catch {} });
            streamRef.current = null;
        }
        // Mark this session as active BEFORE the await
        cameraActiveRef.current = true;
        setCameraOpen(true);
        setCameraPhase('live');
        setCameraReady(false);
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: { ideal: mode }, width: { ideal: 1920 }, height: { ideal: 1080 } },
                audio: false,
            });
            // If stopCamera() was called while we awaited, the flag is false — kill the orphan stream
            if (!cameraActiveRef.current) {
                stream.getTracks().forEach((t) => { try { t.stop(); } catch {} });
                return;
            }
            streamRef.current = stream;
            // By the time getUserMedia resolves, React has re-rendered and videoRef is mounted
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                videoRef.current.onloadedmetadata = () => {
                    if (cameraActiveRef.current) setCameraReady(true);
                };
            }
        } catch (err) {
            cameraActiveRef.current = false;
            streamRef.current = null;
            setCameraOpen(false);
            setCameraPhase('live');
            if (err?.name === 'NotAllowedError' || err?.name === 'PermissionDeniedError') {
                setCameraError('Camera permission denied. Please allow camera access in your browser settings.');
            } else if (err?.name === 'NotFoundError' || err?.name === 'DevicesNotFoundError') {
                setCameraError('No camera found on this device.');
            } else {
                setCameraError('Could not start camera: ' + (err?.message || 'Unknown error.'));
            }
        }
    };

    const switchCamera = () => {
        const next = facingMode === 'environment' ? 'user' : 'environment';
        setFacingMode(next);
        startCamera(next);
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

    const capturePhoto = async () => {
        if (!videoRef.current || !cameraReady) {
            setCameraError('Camera is not ready. Please wait and try again.');
            return;
        }
        const video = videoRef.current;
        const w = video.videoWidth || 1280;
        const h = video.videoHeight || 720;
        if (w <= 0 || h <= 0) {
            setCameraError('Camera video dimensions are invalid. Please retry.');
            return;
        }
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) { setCameraError('Canvas not supported by your browser.'); return; }
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
        try {
            const blob = await canvasToBlob(canvas, 'image/jpeg', 0.92);
            if (capturedBlobUrlRef.current) {
                try { URL.revokeObjectURL(capturedBlobUrlRef.current); } catch {}
            }
            const url = URL.createObjectURL(blob);
            capturedBlobUrlRef.current = url;
            const file = new File([blob], `photo_${Date.now()}.jpg`, { type: 'image/jpeg' });
            setCapturedPreview({ url, file });
            // Pause video while showing preview
            stopCameraStream();
            setCameraPhase('preview');
        } catch (e) {
            setCameraError('Failed to capture photo: ' + (e?.message || 'Unknown error.'));
        }
    };

    const usePhotoCapture = () => {
        if (!capturedPreview) return;
        const { file } = capturedPreview;
        // Revoke only the camera captured blob URL, not existing pending previews
        if (capturedBlobUrlRef.current) {
            try { URL.revokeObjectURL(capturedBlobUrlRef.current); } catch {}
            capturedBlobUrlRef.current = null;
        }
        const previewUrl = URL.createObjectURL(file);
        setPendingFiles((prev) => [...prev, file]);
        setPendingPreviews((prev) => [...prev, { name: file.name, url: previewUrl, size: file.size, type: file.type }]);
        stopCamera();
        setCapturedPreview(null);
    };

    const retakePhoto = () => {
        if (capturedBlobUrlRef.current) {
            try { URL.revokeObjectURL(capturedBlobUrlRef.current); } catch {}
            capturedBlobUrlRef.current = null;
        }
        setCapturedPreview(null);
        startCamera(facingMode);
    };
    // ─────────────────────────────────────────────────────────────────────────

    const closeImagesModal = () => {
        stopCamera();
        if (capturedBlobUrlRef.current) {
            try { URL.revokeObjectURL(capturedBlobUrlRef.current); } catch {}
            capturedBlobUrlRef.current = null;
        }
        setCapturedPreview(null);
        pendingPreviews.forEach((p) => {
            try { URL.revokeObjectURL(p.url); } catch {}
        });
        setIsImagesOpen(false);
        setSelectedItem(null);
        setItemImages([]);
        setImagesError('');
        setImagesLoading(false);
        setPendingFiles([]);
        setPendingPreviews([]);
        setUploading(false);
    };

    // Stop camera stream on component unmount (ensures LED turns off on navigation)
    useEffect(() => {
        return () => {
            if (streamRef.current) {
                streamRef.current.getTracks().forEach((t) => { try { t.stop(); } catch {} });
                streamRef.current = null;
            }
        };
    }, []);

    useEffect(() => {
        return () => {
            pendingPreviews.forEach((p) => {
                try { URL.revokeObjectURL(p.url); } catch {}
            });
        };
    }, [pendingPreviews]);

    const setPendingFromFiles = (files) => {
        const list = Array.from(files || []);
        const allowed = new Set(['image/jpeg', 'image/png', 'image/webp']);
        const maxBytes = 5 * 1024 * 1024;

        const valid = [];
        const invalidReasons = [];

        list.forEach((f) => {
            if (!allowed.has(f.type)) {
                invalidReasons.push(`${f.name}: unsupported format`);
                return;
            }
            if (f.size > maxBytes) {
                invalidReasons.push(`${f.name}: too large (max 5MB)`);
                return;
            }
            valid.push(f);
        });

        pendingPreviews.forEach((p) => {
            try { URL.revokeObjectURL(p.url); } catch {}
        });

        setPendingFiles(valid);
        setPendingPreviews(valid.map((f) => ({ name: f.name, url: URL.createObjectURL(f), size: f.size, type: f.type })));

        if (invalidReasons.length > 0) {
            setImagesError(invalidReasons.slice(0, 3).join('. ') + (invalidReasons.length > 3 ? '\u2026' : ''));
        } else {
            setImagesError('');
        }
    };

    const canvasToBlob = (canvas, type, quality) => {
        return new Promise((resolve, reject) => {
            try {
                canvas.toBlob(
                    (blob) => {
                        if (!blob) {
                            reject(new Error('Failed to encode image.'));
                            return;
                        }
                        resolve(blob);
                    },
                    type,
                    quality,
                );
            } catch (e) {
                reject(e);
            }
        });
    };

    const processImageForUpload = async (file) => {
        const maxWidth = 1600;
        const thumbSize = 320;
        const base = String(file.name || 'image').replace(/\.[^.]+$/, '');

        const url = URL.createObjectURL(file);
        try {
            const img = await new Promise((resolve, reject) => {
                const el = new Image();
                el.onload = () => resolve(el);
                el.onerror = () => reject(new Error('Failed to load image.'));
                el.src = url;
            });

            const srcW = img.naturalWidth || img.width;
            const srcH = img.naturalHeight || img.height;
            if (!srcW || !srcH) throw new Error('Invalid image.');

            const scale = srcW > maxWidth ? maxWidth / srcW : 1;
            const outW = Math.max(1, Math.round(srcW * scale));
            const outH = Math.max(1, Math.round(srcH * scale));

            const c = document.createElement('canvas');
            c.width = outW;
            c.height = outH;
            const ctx = c.getContext('2d', { alpha: true });
            if (!ctx) throw new Error('Canvas not supported.');
            ctx.drawImage(img, 0, 0, outW, outH);

            const testWebp = c.toDataURL('image/webp');
            const canWebp = typeof testWebp === 'string' && testWebp.startsWith('data:image/webp');
            const outType = canWebp ? 'image/webp' : 'image/jpeg';
            const outExt = canWebp ? 'webp' : 'jpg';

            const imageBlob = await canvasToBlob(c, outType, 0.82);

            const side = Math.min(srcW, srcH);
            const sx = Math.floor((srcW - side) / 2);
            const sy = Math.floor((srcH - side) / 2);

            const tc = document.createElement('canvas');
            tc.width = thumbSize;
            tc.height = thumbSize;
            const tctx = tc.getContext('2d', { alpha: true });
            if (!tctx) throw new Error('Canvas not supported.');
            tctx.drawImage(img, sx, sy, side, side, 0, 0, thumbSize, thumbSize);

            const thumbBlob = await canvasToBlob(tc, outType, 0.76);

            return {
                imageFile: new File([imageBlob], `${base}.${outExt}`, { type: outType }),
                thumbFile: new File([thumbBlob], `${base}.thumb.${outExt}`, { type: outType }),
            };
        } finally {
            try { URL.revokeObjectURL(url); } catch {}
        }
    };

    const loadItemImages = async (item) => {
        if (!item?.id) return;
        setImagesLoading(true);
        setImagesError('');
        try {
            const res = await axios.get(`/api/items/${item.id}/images`);
            const data = res?.data && typeof res.data === 'object' ? res.data : {};
            setSelectedItem(data.item || item);
            setItemImages(Array.isArray(data.images) ? data.images : []);
        } catch (e) {
            const msg = e?.response?.data?.message || 'Failed to load images.';
            setImagesError(String(msg));
            setItemImages([]);
        } finally {
            setImagesLoading(false);
        }
    };

    const openImagesModal = async (item) => {
        setIsImagesOpen(true);
        setSelectedItem(item);
        setItemImages([]);
        setPendingFiles([]);
        pendingPreviews.forEach((p) => {
            try { URL.revokeObjectURL(p.url); } catch {}
        });
        setPendingPreviews([]);
        await loadItemImages(item);
    };

    const uploadImages = async () => {
        if (!selectedItem?.id) return;
        if (pendingFiles.length === 0) {
            setImagesError('Please select at least one image (JPEG, PNG, WebP).');
            return;
        }
        setUploading(true);
        setImagesError('');
        try {
            const form = new FormData();
            const processed = [];
            for (const f of pendingFiles) {
                processed.push(await processImageForUpload(f));
            }

            processed.forEach((p) => {
                form.append('images[]', p.imageFile);
                form.append('thumbs[]', p.thumbFile);
            });
            const res = await axios.post(`/api/items/${selectedItem.id}/images`, form, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
            const data = res?.data && typeof res.data === 'object' ? res.data : {};
            setSelectedItem(data.item || selectedItem);
            setItemImages(Array.isArray(data.images) ? data.images : []);
            setPendingFiles([]);
            pendingPreviews.forEach((p) => {
                try { URL.revokeObjectURL(p.url); } catch {}
            });
            setPendingPreviews([]);

            if (data?.item?.id) {
                setItems((prev) => prev.map((it) => (String(it.id) === String(data.item.id) ? { ...it, ...data.item } : it)));
            }
        } catch (e) {
            const msg =
                e?.response?.data?.errors?.images?.[0] ||
                e?.response?.data?.errors?.['images.0']?.[0] ||
                e?.response?.data?.message ||
                'Upload failed.';
            setImagesError(String(msg));
        } finally {
            setUploading(false);
        }
    };

    const setPrimaryImage = async (imageId) => {
        if (!selectedItem?.id) return;
        setImagesError('');
        try {
            const res = await axios.patch(`/api/items/${selectedItem.id}/images/${imageId}/primary`);
            const data = res?.data && typeof res.data === 'object' ? res.data : {};
            setSelectedItem(data.item || selectedItem);
            setItemImages(Array.isArray(data.images) ? data.images : []);
            if (data?.item?.id) {
                setItems((prev) => prev.map((it) => (String(it.id) === String(data.item.id) ? { ...it, ...data.item } : it)));
            }
        } catch (e) {
            const msg = e?.response?.data?.message || 'Failed to set primary image.';
            setImagesError(String(msg));
        }
    };

    const [deleteImgModalOpen, setDeleteImgModalOpen] = useState(false);
    const [deleteImgId, setDeleteImgId] = useState(null);
    const [deleteImgConfirming, setDeleteImgConfirming] = useState(false);

    const requestDeleteImage = (imageId) => {
        setDeleteImgId(imageId);
        setDeleteImgModalOpen(true);
    };

    const executeDeleteImage = async () => {
        if (!selectedItem?.id || !deleteImgId) return;
        setDeleteImgConfirming(true);
        setImagesError('');
        try {
            const res = await axios.delete(`/api/items/${selectedItem.id}/images/${deleteImgId}`);
            const data = res?.data && typeof res.data === 'object' ? res.data : {};
            setSelectedItem(data.item || selectedItem);
            setItemImages(Array.isArray(data.images) ? data.images : []);
            if (data?.item?.id) {
                setItems((prev) => prev.map((it) => (String(it.id) === String(data.item.id) ? { ...it, ...data.item } : it)));
            }
            setDeleteImgModalOpen(false);
            setDeleteImgId(null);
        } catch (e) {
            // Keep the delete modal closed but surface the error in the images panel
            const msg = e?.response?.data?.message || 'Failed to delete image. Please try again.';
            setDeleteImgModalOpen(false);
            setDeleteImgId(null);
            setImagesError(String(msg));
        } finally {
            setDeleteImgConfirming(false);
        }
    };

    return (
        <div className="max-w-7xl mx-auto">
            <div className="bg-white border border-[#cbcbcb] rounded-2xl shadow-sm overflow-hidden flex flex-col">
                <div className="px-5 py-4 border-b border-[#cbcbcb] relative z-20">
                    {/* Title row — always its own line so it never truncates */}
                    <div className="flex items-center gap-3 mb-4">
                        <h1 className="text-2xl md:text-3xl font-semibold text-[#818181] tracking-tight">Inventory</h1>
                        <span className="shrink-0 text-[10px] font-semibold uppercase tracking-widest px-2 py-1 rounded-full border border-[#cbcbcb] bg-[#dddddd] text-[#a6a6a6]">
                            Read-only
                        </span>
                    </div>

                    {/* Controls row */}
                    <div className="flex flex-wrap items-center gap-3">
                            <select
                                value={branchId}
                                onChange={(e) => setBranchId(e.target.value)}
                                disabled={branchesLoading || branches.length === 0}
                                aria-label="Select branch"
                                className="h-11 px-4 w-[200px] bg-white border border-[#cbcbcb] rounded-xl hover:bg-[#dddddd] transition-all font-medium text-sm shadow-sm disabled:opacity-50"
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

                            <div className="relative flex-1 min-w-[220px] max-w-[420px]">
                                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#a6a6a6]" aria-hidden="true" />
                                <input
                                    ref={searchInputRef}
                                    type="text"
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    aria-label="Search inventory"
                                    placeholder={`Search inventory${ELLIPSIS}`}
                                    className="w-full h-11 pl-9 pr-3 bg-white border border-[#cbcbcb] rounded-xl hover:bg-[#dddddd] transition-all text-sm font-medium text-[#818181] placeholder:text-[#a1a1aa] shadow-sm"
                                />
                            </div>

                            <div className="md:hidden">
                                <label className="sr-only" htmlFor="inventory-stock-sort">
                                    Sort stock
                                </label>
                                <select
                                    id="inventory-stock-sort"
                                    value={stockSort}
                                    onChange={(e) => setStockSort(e.target.value)}
                                    aria-label="Sort stock"
                                    className="h-11 px-4 w-full bg-white border border-[#cbcbcb] rounded-xl hover:bg-[#dddddd] transition-all font-medium text-sm shadow-sm"
                                >
                                    <option value="asc">Stock: Low to High</option>
                                    <option value="desc">Stock: High to Low</option>
                                </select>
                            </div>

                            <div
                                role="group"
                                aria-label="Sort by Stock Level"
                                className="hidden md:flex w-full md:w-auto items-center h-11 rounded-xl border border-[#cbcbcb] bg-white shadow-sm overflow-hidden"
                            >
                                <span className="hidden xl:block pl-3 pr-2 text-[10px] font-semibold uppercase tracking-widest text-[#a6a6a6] whitespace-nowrap select-none">
                                    Sort by Stock Level
                                </span>
                                <div className="hidden xl:block w-px self-stretch bg-zinc-200" />
                                <button
                                    type="button"
                                    onClick={() => setStockSort('asc')}
                                    aria-pressed={stockSort === 'asc'}
                                    aria-label="Sort stock: lowest to highest"
                                    title="Lowest to Highest"
                                    className={`h-full px-3 inline-flex items-center gap-1.5 text-xs font-semibold transition-colors ${
                                        stockSort === 'asc'
                                            ? 'bg-[#818181] text-white'
                                            : 'text-[#a6a6a6] hover:bg-[#dddddd] hover:text-[#818181]'
                                    }`}
                                >
                                    <ArrowUp size={13} />
                                    <span className="hidden xl:inline">Lowest to Highest</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setStockSort('desc')}
                                    aria-pressed={stockSort === 'desc'}
                                    aria-label="Sort stock: highest to lowest"
                                    title="Highest to Lowest"
                                    className={`h-full px-3 inline-flex items-center gap-1.5 text-xs font-semibold transition-colors ${
                                        stockSort === 'desc'
                                            ? 'bg-[#818181] text-white'
                                            : 'text-[#a6a6a6] hover:bg-[#dddddd] hover:text-[#818181]'
                                    }`}
                                >
                                    <ArrowDown size={13} />
                                    <span className="hidden xl:inline">Highest to Lowest</span>
                                </button>
                            </div>

                            <Menu as="div" className="relative ml-auto">
                                <Menu.Button
                                    type="button"
                                    aria-label="More actions"
                                    title="More actions"
                                    className="h-11 w-11 inline-flex items-center justify-center rounded-xl border border-[#cbcbcb] bg-white text-[#818181] hover:bg-[#dddddd] active:bg-[#dddddd] transition-all shadow-sm"
                                >
                                    <MoreHorizontal size={18} />
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
                                    <Menu.Items className="absolute right-0 mt-2 w-72 origin-top-right rounded-2xl border border-[#cbcbcb] bg-white shadow-xl focus:outline-none overflow-hidden z-50">
                                        <div className="py-1">
                                            <Menu.Item>
                                                {({ active }) => (
                                                    <button
                                                        type="button"
                                                        onClick={() => setIsFiltersOpen(true)}
                                                        className={`w-full px-4 py-3 text-left text-sm font-semibold inline-flex items-center gap-2 ${
                                                            active ? 'bg-[#dddddd] text-[#818181]' : 'text-[#818181]'
                                                        }`}
                                                    >
                                                        <Search size={16} className="text-[#a6a6a6]" />
                                                        Filters
                                                    </button>
                                                )}
                                            </Menu.Item>
                                            <div className="px-4 py-2">
                                                <div className="text-[10px] font-semibold text-[#a6a6a6] uppercase tracking-widest mb-2">Rows per page</div>
                                                <div className="grid grid-cols-3 gap-2">
                                                    {[25, 50, 100].map((n) => (
                                                        <Menu.Item key={n}>
                                                            {({ active }) => (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => setPageSize(n)}
                                                                    aria-label={`Rows per page: ${n}`}
                                                                    aria-pressed={pageSize === n}
                                                                    className={`px-3 py-2 rounded-xl border text-xs font-semibold transition-colors ${
                                                                        pageSize === n
                                                                            ? 'border-[#818181] bg-[#818181] text-white'
                                                                            : active
                                                                                ? 'border-[#cbcbcb] bg-[#dddddd] text-[#818181]'
                                                                                : 'border-[#cbcbcb] bg-white text-[#818181] hover:bg-[#dddddd]'
                                                                    }`}
                                                                >
                                                                    {n}
                                                                </button>
                                                            )}
                                                        </Menu.Item>
                                                    ))}
                                                </div>
                                            </div>
                                            <div className="my-1 h-px bg-zinc-200" />
                                            <Menu.Item>
                                                {({ active }) => (
                                                    <button
                                                        type="button"
                                                        onClick={() => exportItemsToCsv(filteredItems)}
                                                        className={`w-full px-4 py-3 text-left text-sm font-semibold inline-flex items-center gap-2 ${
                                                            active ? 'bg-[#dddddd] text-[#818181]' : 'text-[#818181]'
                                                        }`}
                                                    >
                                                        <Upload size={16} className="text-[#a6a6a6] rotate-180" />
                                                        Export CSV
                                                    </button>
                                                )}
                                            </Menu.Item>
                                        </div>
                                    </Menu.Items>
                                </Transition>
                            </Menu>
                    </div>
                </div>

                <div className="overflow-auto" style={{maxHeight: 'calc(100vh - 20rem)'}}>
                    <table className="w-full text-left">
                        <thead className="sticky top-0 z-10">
                            <tr className="bg-white text-[#a6a6a6] text-xs font-semibold uppercase tracking-widest border-b border-[#cbcbcb]">
                                <th className="px-6 py-4">Name</th>
                                <th className="px-6 py-4">Category</th>
                                <th className="px-6 py-4">Price</th>
                                <th className="px-6 py-4">Stock</th>
                                <th className="px-6 py-4">Type</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[#cbcbcb]">
                            {loading ? (
                                Array.from({ length: 12 }).map((_, idx) => (
                                    <tr key={`sk-${idx}`} className={idx % 2 === 1 ? 'bg-[#dddddd]' : 'bg-white'}>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 bg-zinc-200 rounded-lg animate-pulse" />
                                                <div className="space-y-2">
                                                    <div className="h-3 w-44 bg-zinc-200 rounded animate-pulse" />
                                                    <div className="h-2 w-28 bg-zinc-200 rounded animate-pulse" />
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="h-6 w-24 bg-zinc-200 rounded animate-pulse" />
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="h-4 w-16 bg-zinc-200 rounded animate-pulse" />
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="h-6 w-12 bg-zinc-200 rounded animate-pulse" />
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="h-5 w-16 bg-zinc-200 rounded animate-pulse" />
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                pagedItems.map((item, idx) => {
                                    const qtyRaw = item?.stock_qty;
                                    const hasRawQty = !(qtyRaw === null || qtyRaw === undefined || qtyRaw === '');
                                    const qty = hasRawQty ? Number(qtyRaw) : NaN;
                                    const hasQty = !item.is_service && hasRawQty && Number.isFinite(qty);
                                    const isNeg = hasQty && qty < 0;
                                    const isOut = hasQty && qty === 0;
                                    const isLow = hasQty && qty > 0 && qty <= 5;
                                    const isBelowTen = hasQty && qty < 10;
                                    const isAdequate = hasQty && qty > 5;
                                    const primary = item?.primary_image || item?.primaryImage || null;
                                    const thumb = primary?.thumb_url || primary?.url || null;
                                    return (
                                        <tr key={item.id} className={`${idx % 2 === 1 ? 'bg-[#dddddd]/35' : 'bg-white'} hover:bg-[#dddddd]/60 transition-colors`}>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <button
                                                        type="button"
                                                        onClick={() => openImagesModal(item)}
                                                        aria-label={`Manage images for ${item.name}`}
                                                        className="w-10 h-10 bg-white rounded-lg border border-[#cbcbcb] flex items-center justify-center text-[#818181] shadow-inner overflow-hidden hover:bg-[#dddddd] active:bg-[#dddddd]"
                                                    >
                                                        {thumb ? (
                                                            <img src={thumb} alt="" className="w-full h-full object-cover" />
                                                        ) : (
                                                            <ImagePlus size={18} />
                                                        )}
                                                    </button>
                                                    <div>
                                                        <p className="text-sm font-semibold text-[#818181] leading-none">{item.name}</p>
                                                        <p className="text-[10px] text-[#a6a6a6] mt-1 font-medium uppercase tracking-tight">SKU: {item.sku || 'N/A'}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className="text-xs font-semibold text-[#3f3f46] px-2.5 py-1 bg-white rounded-md border border-[#cbcbcb] uppercase tracking-tighter">
                                                    {item.category?.name}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-sm font-semibold text-[#818181]">{PESO}{Number(item.price || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                            <td className="px-6 py-4">
                                                {item.is_service ? (
                                                    <span className="text-xs text-[#a6a6a6] font-medium uppercase italic tracking-tighter">{EM_DASH} Service</span>
                                                ) : (
                                                    <span
                                                        className={`text-sm font-semibold px-3 py-1 rounded-lg border ${
                                                            !hasQty
                                                                ? 'bg-[#dddddd] text-[#a6a6a6] border-[#cbcbcb]'
                                                                : isNeg || isOut
                                                                ? 'bg-[#dddddd] text-red-600 border-[#cbcbcb]'
                                                                : isLow
                                                                    ? 'bg-[#dddddd] text-red-600 border-[#cbcbcb]'
                                                                    : isBelowTen
                                                                        ? 'bg-[#dddddd] text-red-600 border-[#cbcbcb]'
                                                                        : isAdequate
                                                                            ? 'bg-[#dddddd] text-[#818181] border-[#cbcbcb]'
                                                                        : 'bg-[#dddddd] text-[#a6a6a6] border-[#cbcbcb]'
                                                        }`}
                                                    >
                                                        {hasQty ? qty : EM_DASH}
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4">
                                                <span
                                                    className={`text-[10px] font-semibold px-2 py-0.5 rounded border uppercase tracking-widest ${
                                                        item.is_service ? 'bg-[#dddddd] text-[#818181] border-[#cbcbcb]' : 'bg-[#dddddd] text-[#818181] border-[#cbcbcb]'
                                                    }`}
                                                >
                                                    {item.is_service ? 'Service' : 'Product'}
                                                </span>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                            {!loading && pagedItems.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-10 text-center text-sm font-medium text-[#a6a6a6]">
                                        No items found.
                                    </td>
                                </tr>
                            ) : null}
                        </tbody>
                    </table>
                </div>

                <div className="border-t border-[#cbcbcb] bg-white px-4 py-3 flex flex-col md:flex-row md:items-center justify-between gap-3">
                    <div className="text-xs font-medium text-[#a6a6a6]">
                        <span aria-label="Results summary">
                            Showing <span className="text-[#818181] font-semibold">{filteredItems.length === 0 ? 0 : pageStart + 1}</span>{'\u2013'}<span className="text-[#818181] font-semibold">{pageEnd}</span> of{' '}
                            <span className="text-[#818181] font-semibold">{filteredItems.length}</span>
                        </span>
                    </div>
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={() => setPage((p) => Math.max(1, p - 1))}
                                disabled={safePage <= 1}
                                aria-label="Previous page"
                                className="px-3 py-2 rounded-xl border border-[#cbcbcb] bg-white text-xs font-semibold text-[#818181] hover:bg-[#dddddd] active:bg-[#dddddd] disabled:opacity-50"
                            >
                                Prev
                            </button>
                            <button
                                type="button"
                                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                                disabled={safePage >= totalPages}
                                aria-label="Next page"
                                className="px-3 py-2 rounded-xl border border-[#cbcbcb] bg-white text-xs font-semibold text-[#818181] hover:bg-[#dddddd] active:bg-[#dddddd] disabled:opacity-50"
                            >
                                Next
                            </button>
                        </div>
                        <form
                            onSubmit={(e) => {
                                e.preventDefault();
                                const n = Number(jumpToPage);
                                if (!Number.isFinite(n)) return;
                                const target = Math.min(totalPages, Math.max(1, Math.trunc(n)));
                                setPage(target);
                            }}
                            className="flex items-center gap-2"
                        >
                            <label className="text-[10px] font-semibold text-[#a6a6a6] uppercase tracking-widest" htmlFor="jump-to-page">
                                Jump
                            </label>
                            <input
                                id="jump-to-page"
                                inputMode="numeric"
                                pattern="[0-9]*"
                                value={jumpToPage}
                                onChange={(e) => setJumpToPage(e.target.value)}
                                aria-label="Jump to page"
                                className="w-20 px-3 py-2 border border-[#cbcbcb] rounded-xl text-xs font-semibold text-[#818181] bg-white"
                                placeholder={`${safePage}`}
                            />
                            <button
                                type="submit"
                                aria-label="Go to page"
                                className="px-3 py-2 rounded-xl border border-[#cbcbcb] bg-white text-xs font-semibold text-[#818181] hover:bg-[#dddddd] active:bg-[#dddddd]"
                            >
                                Go
                            </button>
                        </form>
                        <div className="text-xs font-medium text-[#a6a6a6] hidden sm:block">
                            Page <span className="text-[#818181] font-semibold">{safePage}</span>/<span className="text-[#818181] font-semibold">{totalPages}</span>
                        </div>
                    </div>
                </div>
            </div>

            <Transition appear show={isImagesOpen} as={Fragment}>
                <Dialog as="div" className="relative z-50" onClose={cameraOpen ? () => {} : closeImagesModal}>
                    <Transition.Child as={Fragment} enter="ease-out duration-200" enterFrom="opacity-0" enterTo="opacity-100" leave="ease-in duration-150" leaveFrom="opacity-100" leaveTo="opacity-0">
                        <button type="button" className="fixed inset-0 bg-[#818181]/30" onClick={cameraOpen ? undefined : closeImagesModal} aria-label="Close images modal" />
                    </Transition.Child>
                    <div className="fixed inset-0 overflow-y-auto">
                        <div className="flex min-h-full items-center justify-center p-4">
                            <Transition.Child as={Fragment} enter="ease-out duration-200" enterFrom="opacity-0 scale-95" enterTo="opacity-100 scale-100" leave="ease-in duration-150" leaveFrom="opacity-100 scale-100" leaveTo="opacity-0 scale-95">
                                <Dialog.Panel className="w-full max-w-3xl transform overflow-hidden rounded-2xl bg-white shadow-2xl transition-all border border-[#cbcbcb]">
                                    <div className="px-5 py-4 border-b border-[#cbcbcb] flex items-center justify-between gap-3">
                                        <div className="min-w-0">
                                            <Dialog.Title className="text-sm font-semibold text-[#818181] truncate">Product Images</Dialog.Title>
                                            <div className="text-[11px] font-medium text-[#a6a6a6] truncate">{selectedItem?.name || ''}</div>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={closeImagesModal}
                                            aria-label="Close images modal"
                                            className="p-2 rounded-xl border border-[#cbcbcb] hover:bg-[#dddddd] active:bg-[#dddddd]"
                                        >
                                            <X size={18} />
                                        </button>
                                    </div>

                                    {imagesError ? (
                                        <div className="px-5 py-3 border-b border-red-100 bg-[#dddddd] text-sm font-medium text-[#818181]">{imagesError}</div>
                                    ) : null}

                                    <div className="p-5 grid grid-cols-1 lg:grid-cols-3 gap-4">
                                        <div className="lg:col-span-1">
                                            <div
                                                className="rounded-2xl border border-dashed border-[#a6a6a6] bg-[#dddddd] p-4"
                                                onDragOver={(e) => {
                                                    e.preventDefault();
                                                    e.stopPropagation();
                                                }}
                                                onDrop={(e) => {
                                                    e.preventDefault();
                                                    e.stopPropagation();
                                                    setPendingFromFiles(e.dataTransfer.files);
                                                }}
                                            >
                                                <div className="flex items-start gap-3">
                                                    <div className="w-10 h-10 rounded-xl border border-[#cbcbcb] bg-white flex items-center justify-center">
                                                        <Upload size={18} className="text-[#818181]" />
                                                    </div>
                                                    <div className="min-w-0">
                                                        <div className="text-sm font-semibold text-[#818181]">Upload images</div>
                                                        <div className="text-[11px] font-medium text-[#a6a6a6]">
                                                            Drag & drop or browse. JPEG, PNG, WebP up to 5MB.
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="mt-4 flex flex-col gap-2">
                                                    <input
                                                        ref={fileInputRef}
                                                        type="file"
                                                        accept="image/jpeg,image/png,image/webp"
                                                        multiple
                                                        onChange={(e) => setPendingFromFiles(e.target.files)}
                                                        className="hidden"
                                                    />
                                                    {/* Browse + Take Photo row */}
                                                    <div className="grid grid-cols-2 gap-2">
                                                        <button
                                                            type="button"
                                                            onClick={() => fileInputRef.current?.click()}
                                                            className="h-10 rounded-xl border border-[#cbcbcb] bg-white text-xs font-semibold text-[#818181] hover:bg-[#dddddd] active:bg-[#dddddd] flex items-center justify-center gap-1.5 whitespace-nowrap px-2"
                                                        >
                                                            <Upload size={13} className="shrink-0" />
                                                            Browse
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => startCamera()}
                                                            className="h-10 rounded-xl border border-[#cbcbcb] bg-white text-xs font-semibold text-[#818181] hover:bg-[#dddddd] active:bg-[#dddddd] flex items-center justify-center gap-1.5 whitespace-nowrap px-2"
                                                        >
                                                            <Camera size={13} className="shrink-0" />
                                                            Take Photo
                                                        </button>
                                                    </div>

                                                    {/* Camera permission error (shown when overlay fails to open) */}
                                                    {cameraError ? (
                                                        <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-[11px] font-medium text-red-600">
                                                            {cameraError}
                                                        </div>
                                                    ) : null}

                                                    <button
                                                        type="button"
                                                        onClick={uploadImages}
                                                        disabled={uploading || pendingFiles.length === 0 || !selectedItem?.id}
                                                        className="h-10 rounded-xl bg-[#818181] text-white text-xs font-semibold hover:bg-[#818181]/90 active:bg-[#818181]/80 disabled:opacity-50 flex items-center justify-center gap-2"
                                                    >
                                                        {uploading ? <Loader2 size={14} className="animate-spin shrink-0" /> : null}
                                                        Upload
                                                    </button>
                                                </div>
                                            </div>

                                            {pendingPreviews.length > 0 ? (
                                                <div className="mt-4">
                                                    <div className="text-[10px] font-semibold text-[#a6a6a6] uppercase tracking-widest mb-2">
                                                        Preview ({pendingPreviews.length})
                                                    </div>
                                                    <div className="grid grid-cols-3 gap-2">
                                                        {pendingPreviews.map((p) => (
                                                            <div key={p.url} className="rounded-xl border border-[#cbcbcb] bg-white overflow-hidden relative group">
                                                                <img src={p.url} alt="" className="w-full h-20 object-cover" />
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            ) : null}
                                        </div>

                                        <div className="lg:col-span-2">
                                            <div className="flex items-center justify-between mb-3">
                                                <div className="text-[10px] font-semibold text-[#a6a6a6] uppercase tracking-widest">Images</div>
                                                <button
                                                    type="button"
                                                    onClick={() => selectedItem && loadItemImages(selectedItem)}
                                                    disabled={imagesLoading || !selectedItem?.id}
                                                    className="h-9 px-3 rounded-xl border border-[#cbcbcb] bg-white text-xs font-semibold text-[#818181] hover:bg-[#dddddd] disabled:opacity-50"
                                                >
                                                    Refresh
                                                </button>
                                            </div>

                                            {imagesLoading ? (
                                                <div className="text-sm font-medium text-[#a6a6a6] animate-pulse">Loading images{ELLIPSIS}</div>
                                            ) : itemImages.length === 0 ? (
                                                <div className="text-sm font-medium text-[#a6a6a6]">No images yet.</div>
                                            ) : (
                                                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                                                    {itemImages.map((img) => {
                                                        const src = img.thumb_url || img.url;
                                                        return (
                                                            <div key={img.id} className="rounded-2xl border border-[#cbcbcb] bg-white overflow-hidden">
                                                                <div className="relative">
                                                                    <img src={src} alt="" className="w-full h-28 object-cover" />
                                                                    {img.is_primary ? (
                                                                        <div className="absolute top-2 left-2 inline-flex items-center gap-1 px-2 py-1 rounded-full bg-white/90 border border-[#cbcbcb] text-[10px] font-semibold text-[#818181]">
                                                                            <Star size={12} className="text-[#d94a79]" />
                                                                            Primary
                                                                        </div>
                                                                    ) : null}
                                                                </div>
                                                                <div className="p-2 flex items-center justify-between gap-2">
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => setPrimaryImage(img.id)}
                                                                        disabled={Boolean(img.is_primary)}
                                                                        className="flex-1 h-9 rounded-xl border border-[#cbcbcb] bg-white text-[11px] font-semibold text-[#818181] hover:bg-[#dddddd] disabled:opacity-50"
                                                                    >
                                                                        Set primary
                                                                    </button>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => requestDeleteImage(img.id)}
                                                                        aria-label="Delete image"
                                                                        className="h-9 w-9 rounded-xl border border-[#cbcbcb] bg-white text-[#818181] hover:bg-[#dddddd] flex items-center justify-center flex-shrink-0"
                                                                    >
                                                                        <Trash2 size={16} />
                                                                    </button>
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

            <Transition appear show={isFiltersOpen} as={Fragment}>
                <Dialog as="div" className="relative z-50" onClose={() => setIsFiltersOpen(false)}>
                    <Transition.Child as={Fragment} enter="ease-out duration-200" enterFrom="opacity-0" enterTo="opacity-100" leave="ease-in duration-150" leaveFrom="opacity-100" leaveTo="opacity-0">
                        <button type="button" className="fixed inset-0 bg-[#818181]/30" onClick={() => setIsFiltersOpen(false)} aria-label="Close filters" />
                    </Transition.Child>
                    <div className="fixed inset-0 overflow-hidden">
                        <div className="absolute inset-0 overflow-hidden">
                            <div className="pointer-events-none fixed inset-y-0 right-0 flex max-w-full pl-12">
                                <Transition.Child
                                    as={Fragment}
                                    enter="transform transition ease-out duration-200"
                                    enterFrom="translate-x-full"
                                    enterTo="translate-x-0"
                                    leave="transform transition ease-in duration-150"
                                    leaveFrom="translate-x-0"
                                    leaveTo="translate-x-full"
                                >
                                    <Dialog.Panel className="pointer-events-auto w-screen max-w-sm bg-white h-full shadow-2xl border-l border-[#cbcbcb]">
                                        <div className="p-4 border-b border-[#cbcbcb] flex items-center justify-between">
                                            <Dialog.Title className="text-sm font-semibold text-[#818181]">Filters</Dialog.Title>
                                            <button
                                                type="button"
                                                onClick={() => setIsFiltersOpen(false)}
                                                aria-label="Close filters"
                                                className="p-2 rounded-xl border border-[#cbcbcb] hover:bg-[#dddddd] active:bg-[#dddddd]"
                                            >
                                                <X size={18} />
                                            </button>
                                        </div>
                                        <div className="p-4 space-y-4 overflow-y-auto h-[calc(100%-64px)]">
                                            <div>
                                                <label className="block text-[10px] font-semibold text-[#a6a6a6] uppercase tracking-widest mb-1" htmlFor="filters-category">
                                                    Category
                                                </label>
                                                <select
                                                    id="filters-category"
                                                    value={categoryFilter}
                                                    onChange={(e) => setCategoryFilter(e.target.value)}
                                                    className="w-full px-3 py-2.5 border border-[#cbcbcb] rounded-xl text-sm font-medium text-[#818181] bg-white"
                                                >
                                                    <option value="all">All categories</option>
                                                    {[...categoriesForSelect]
                                                        .sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')))
                                                        .map((c) => (
                                                            <option key={c.id} value={String(c.id)}>
                                                                {c.name}
                                                            </option>
                                                        ))}
                                                </select>
                                            </div>
                                            <div>
                                                <div className="block text-[10px] font-semibold text-[#a6a6a6] uppercase tracking-widest mb-1">Stock status</div>
                                                <div className="grid grid-cols-3 gap-2">
                                                    {[
                                                        ['all', 'All'],
                                                        ['low', 'Low Stock'],
                                                        ['out', 'Out of Stock'],
                                                    ].map(([v, label]) => (
                                                        <button
                                                            key={v}
                                                            type="button"
                                                            onClick={() => setStockStatusFilter(v)}
                                                            aria-pressed={stockStatusFilter === v}
                                                            className={`px-3 py-2 rounded-xl border text-xs font-semibold ${
                                                                stockStatusFilter === v ? 'border-[#818181] bg-[#818181] text-white' : 'border-[#cbcbcb] bg-white text-[#818181] hover:bg-[#dddddd]'
                                                            }`}
                                                        >
                                                            {label}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                            <div>
                                                <div className="block text-[10px] font-semibold text-[#a6a6a6] uppercase tracking-widest mb-1">Rows per page</div>
                                                <div className="grid grid-cols-3 gap-2">
                                                    {[25, 50, 100].map((n) => (
                                                        <button
                                                            key={n}
                                                            type="button"
                                                            onClick={() => setPageSize(n)}
                                                            aria-pressed={pageSize === n}
                                                            className={`px-3 py-2 rounded-xl border text-xs font-semibold ${
                                                                pageSize === n ? 'border-[#818181] bg-[#818181] text-white' : 'border-[#cbcbcb] bg-white text-[#818181] hover:bg-[#dddddd]'
                                                            }`}
                                                        >
                                                            {n}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                            <div className="flex gap-2">
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setCategoryFilter('all');
                                                        setStockStatusFilter('all');
                                                    }}
                                                    className="flex-1 px-4 py-2.5 rounded-xl border border-[#cbcbcb] bg-white text-sm font-semibold text-[#818181] hover:bg-[#dddddd] active:bg-[#dddddd]"
                                                >
                                                    Reset
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setIsFiltersOpen(false)}
                                                    className="flex-1 px-4 py-2.5 rounded-xl bg-[#818181] text-white text-sm font-semibold hover:bg-[#818181] active:bg-[#818181]/90"
                                                >
                                                    Apply
                                                </button>
                                            </div>
                                        </div>
                                    </Dialog.Panel>
                                </Transition.Child>
                            </div>
                        </div>
                    </div>
                </Dialog>
            </Transition>

            {/* ─── Fullscreen Camera Overlay ──────────────────────────────────── */}
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
                            {/* Live phase */}
                            {cameraPhase === 'live' ? (
                                <>
                                    {/* Top bar */}
                                    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10, padding: 'calc(env(safe-area-inset-top, 0px) + 16px) 16px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'linear-gradient(to bottom, rgba(0,0,0,0.65) 0%, transparent 100%)' }}>
                                        <button
                                            type="button"
                                            onClick={stopCamera}
                                            aria-label="Close camera"
                                            style={{ width: 40, height: 40, borderRadius: '50%', background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', backdropFilter: 'blur(8px)', cursor: 'pointer' }}
                                        >
                                            <X size={20} />
                                        </button>
                                        <span style={{ color: '#fff', fontWeight: 900, fontSize: 14, letterSpacing: '0.05em', textShadow: '0 1px 4px rgba(0,0,0,0.5)' }}>Take Product Photo</span>
                                        <button
                                            type="button"
                                            onClick={toggleFlash}
                                            aria-label="Flash"
                                            style={{ width: 40, height: 40, borderRadius: '50%', background: flashOn ? '#fff' : 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: flashOn ? '#1f2937' : '#fff', backdropFilter: 'blur(8px)', cursor: 'pointer', transition: 'all 0.2s' }}
                                        >
                                            <Zap size={18} />
                                        </button>
                                    </div>

                                    {/* Camera feed */}
                                    <video
                                        ref={videoRef}
                                        autoPlay
                                        playsInline
                                        muted
                                        style={{ flex: 1, width: '100%', height: '100%', objectFit: 'cover', display: 'block', transform: facingMode === 'user' ? 'scaleX(-1)' : 'none' }}
                                    />

                                    {/* Loading overlay */}
                                    {!cameraReady ? (
                                        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
                                            <Loader2 size={36} color="#fff" className="animate-spin" />
                                            <span style={{ color: '#fff', fontWeight: 700, fontSize: 13, opacity: 0.8 }}>Starting camera{ELLIPSIS}</span>
                                        </div>
                                    ) : null}

                                    {/* Camera error */}
                                    {cameraError ? (
                                        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', background: 'rgba(0,0,0,0.85)', borderRadius: 16, padding: '20px 24px', maxWidth: 320, textAlign: 'center' }}>
                                            <p style={{ color: '#fca5a5', fontWeight: 700, fontSize: 13 }}>{cameraError}</p>
                                            <button type="button" onClick={stopCamera} style={{ marginTop: 12, padding: '8px 20px', borderRadius: 8, background: '#fff', color: '#374151', fontWeight: 700, fontSize: 13, border: 'none', cursor: 'pointer' }}>Close</button>
                                        </div>
                                    ) : null}

                                    {/* Bottom controls */}
                                    <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 10, padding: '32px 24px calc(env(safe-area-inset-bottom, 0px) + 32px)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'linear-gradient(to top, rgba(0,0,0,0.7) 0%, transparent 100%)' }}>
                                        {/* Spacer left */}
                                        <div style={{ width: 52 }} />

                                        {/* Capture button */}
                                        <button
                                            type="button"
                                            onClick={capturePhoto}
                                            disabled={!cameraReady}
                                            aria-label="Capture photo"
                                            style={{
                                                width: 76, height: 76, borderRadius: '50%',
                                                background: cameraReady ? '#fff' : 'rgba(255,255,255,0.35)',
                                                border: '4px solid rgba(255,255,255,0.6)',
                                                boxShadow: cameraReady ? '0 0 0 6px rgba(255,255,255,0.2)' : 'none',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                cursor: cameraReady ? 'pointer' : 'not-allowed',
                                                transition: 'all 0.2s ease',
                                            }}
                                        >
                                            <Camera size={28} color="#1f2937" />
                                        </button>

                                        {/* Switch camera */}
                                        <button
                                            type="button"
                                            onClick={switchCamera}
                                            aria-label="Switch camera"
                                            style={{ width: 52, height: 52, borderRadius: '50%', background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', backdropFilter: 'blur(8px)', cursor: 'pointer' }}
                                        >
                                            <RefreshCw size={22} />
                                        </button>
                                    </div>
                                </>
                            ) : null}

                            {/* Preview phase */}
                            {cameraPhase === 'preview' && capturedPreview ? (
                                <>
                                    {/* Top bar */}
                                    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10, padding: 'calc(env(safe-area-inset-top, 0px) + 16px) 16px 16px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(to bottom, rgba(0,0,0,0.65) 0%, transparent 100%)' }}>
                                        <span style={{ color: '#fff', fontWeight: 900, fontSize: 14, letterSpacing: '0.05em', textShadow: '0 1px 4px rgba(0,0,0,0.5)' }}>Preview</span>
                                    </div>

                                    {/* Captured image */}
                                    <img
                                        src={capturedPreview.url}
                                        alt="Captured"
                                        style={{ flex: 1, width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                                    />

                                    {/* Bottom controls */}
                                    <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 10, padding: '24px 24px calc(env(safe-area-inset-bottom, 0px) + 32px)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, background: 'linear-gradient(to top, rgba(0,0,0,0.75) 0%, transparent 100%)' }}>
                                        <button
                                            type="button"
                                            onClick={retakePhoto}
                                            style={{ flex: 1, maxWidth: 160, height: 52, borderRadius: 26, background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.3)', color: '#fff', fontWeight: 900, fontSize: 15, backdropFilter: 'blur(8px)', cursor: 'pointer', letterSpacing: '0.02em' }}
                                        >
                                            Retake
                                        </button>
                                        <button
                                            type="button"
                                            onClick={usePhotoCapture}
                                            style={{ flex: 1, maxWidth: 160, height: 52, borderRadius: 26, background: '#fff', border: 'none', color: '#1f2937', fontWeight: 900, fontSize: 15, cursor: 'pointer', letterSpacing: '0.02em', boxShadow: '0 4px 16px rgba(0,0,0,0.3)' }}
                                        >
                                            Use Photo
                                        </button>
                                    </div>
                                </>
                            ) : null}
                        </div>
                    </Transition.Child>
                </Dialog>
            </Transition>
            {/* ─────────────────────────────────────────────────────────────────── */}

            <ConfirmDeleteModal
                open={deleteImgModalOpen}
                onClose={() => { setDeleteImgModalOpen(false); setDeleteImgId(null); }}
                onConfirm={executeDeleteImage}
                confirming={deleteImgConfirming}
                requireCountdown={false}
                title="Delete Image"
                message="Are you sure you want to permanently delete this image? This action cannot be undone."
            />
        </div>
    );
};

export default Inventory;
