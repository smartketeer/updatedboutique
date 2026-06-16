import { create } from 'zustand';

export const useCartStore = create((set, get) => ({
    items: [],
    overrideApproval: null,
    checkoutPin: '',
    addItem: (item) => {
        const items = get().items;
        const existingItem = items.find((i) => i.id === item.id);
        if (existingItem) {
            set({
                items: items.map((i) =>
                    i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i
                ),
            });
        } else {
            const basePrice = Number(item.price || 0);
            set({
                items: [
                    ...items,
                    {
                        ...item,
                        quantity: 1,
                        original_price: basePrice,
                        price_override_reason: null,
                        is_custom: false,
                        custom_reason: null,
                    },
                ],
            });
        }
    },
    addCustomItem: ({ id, name, quantity, unit_price, reason }) => {
        const qty = Math.max(1, Number(quantity || 1));
        const unitPrice = Math.max(0, Number(unit_price || 0));
        const items = get().items;
        set({
            items: [
                ...items,
                {
                    id,
                    name,
                    sku: null,
                    quantity: qty,
                    price: unitPrice,
                    original_price: null,
                    price_override_reason: null,
                    is_custom: true,
                    custom_reason: reason || null,
                },
            ],
        });
    },
    removeItem: (itemId) => {
        set({ items: get().items.filter((i) => i.id !== itemId) });
    },
    updateQuantity: (itemId, quantity) => {
        if (quantity < 1) {
            // Remove the item when quantity reaches 0
            set({ items: get().items.filter((i) => i.id !== itemId) });
            return;
        }
        set({
            items: get().items.map((i) =>
                i.id === itemId ? { ...i, quantity } : i
            ),
        });
    },
    updateUnitPrice: (itemId, unitPrice, reason) => {
        const next = Math.max(0, Number(unitPrice || 0));
        set({
            items: get().items.map((i) => {
                if (i.id !== itemId) return i;
                if (i.is_custom) return { ...i, price: next, custom_reason: reason || null };
                return {
                    ...i,
                    price: next,
                    price_override_reason: reason || null,
                };
            }),
        });
    },
    setOverrideApproval: (overrideApproval) => set({ overrideApproval }),
    setCheckoutPin: (checkoutPin) => set({ checkoutPin: String(checkoutPin || '') }),
    clearOverrideAuth: () => set({ overrideApproval: null, checkoutPin: '' }),
    clearCart: () => set({ items: [] }),
    getTotal: () => {
        return get().items.reduce((total, item) => total + item.price * item.quantity, 0);
    },
}));
