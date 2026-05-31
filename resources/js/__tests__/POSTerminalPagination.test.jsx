import React from 'react';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { fireEvent, render, screen, waitFor, cleanup } from '@testing-library/react';
import POSTerminal from '../views/POSTerminal';

const axiosGet = vi.fn();
const axiosPost = vi.fn();

vi.mock('axios', () => ({
    default: {
        get: (...args) => axiosGet(...args),
        post: (...args) => axiosPost(...args),
    },
}));

vi.mock('react-router-dom', async () => {
    const actual = await vi.importActual('react-router-dom');
    return {
        ...actual,
        useNavigate: () => vi.fn(),
    };
});

vi.mock('../store/authStore', () => ({
    useAuthStore: (selector) => {
        const state = { user: { id: 1, role: 'staff', name: 'Cashier' }, branchName: 'luna branch' };
        if (typeof selector === 'function') return selector(state);
        return state;
    },
}));

vi.mock('../store/cartStore', () => ({
    useCartStore: () => ({
        items: [],
        addItem: vi.fn(),
        removeItem: vi.fn(),
        updateQuantity: vi.fn(),
        clearCart: vi.fn(),
        getTotal: () => 0,
        overrideApproval: null,
        checkoutPin: '',
        clearOverrideAuth: vi.fn(),
    }),
}));

function makeInventoryPage({ page, perPage, total }) {
    const start = (page - 1) * perPage;
    const len = Math.max(0, Math.min(perPage, total - start));
    const items = Array.from({ length: len }).map((_, idx) => {
        const n = start + idx + 1;
        return {
            id: n,
            name: `Item ${n}`,
            sku: `SKU${n}`,
            category_id: 1,
            category: { id: 1, name: 'Beauty Products', type: 'product' },
            price: 10,
            stock_qty: 5,
            is_service: false,
        };
    });
    return {
        data: items,
        current_page: page,
        last_page: Math.max(1, Math.ceil(total / perPage)),
        total,
    };
}

beforeEach(() => {
    axiosGet.mockReset();
    axiosPost.mockReset();
});

afterEach(() => {
    cleanup();
});

describe('POSTerminal pagination', () => {
    it('loads only 10 items per page and navigates pages', async () => {
        axiosGet.mockImplementation((url, config) => {
            if (url === '/api/categories') return Promise.resolve({ data: [{ id: 1, name: 'Beauty Products' }] });
            if (url === '/api/clients') return Promise.resolve({ data: [] });
            if (url === '/api/settings') return Promise.resolve({ data: { pos_price_adjustments_enabled: true, pos_custom_items_enabled: true } });
            if (url === '/api/inventory') {
                const page = Number(config?.params?.page || 1);
                const perPage = Number(config?.params?.per_page || 10);
                const payload = makeInventoryPage({ page, perPage, total: 963 });
                return Promise.resolve({ data: payload });
            }
            if (url === '/api/inventory/by-ids') return Promise.resolve({ data: [] });
            return Promise.resolve({ data: [] });
        });

        render(<POSTerminal />);

        expect(await screen.findByText('Item 1')).toBeInTheDocument();
        expect(screen.getByLabelText('Products summary')).toHaveTextContent('Showing 963 products');

        fireEvent.click(screen.getByLabelText('Go to page 2'));
        expect(await screen.findByText('Item 11')).toBeInTheDocument();

        await waitFor(() => {
            const calls = axiosGet.mock.calls.filter((c) => c[0] === '/api/inventory');
            const lastCall = calls[calls.length - 1];
            expect(lastCall?.[1]?.params?.page).toBe(2);
            expect(lastCall?.[1]?.params?.per_page).toBe(10);
        });
    });

    it('resets to page 1 when search changes and keeps filter across requests', async () => {
        axiosGet.mockImplementation((url, config) => {
            if (url === '/api/categories') return Promise.resolve({ data: [{ id: 1, name: 'Beauty Products' }] });
            if (url === '/api/clients') return Promise.resolve({ data: [] });
            if (url === '/api/settings') return Promise.resolve({ data: { pos_price_adjustments_enabled: true, pos_custom_items_enabled: true } });
            if (url === '/api/inventory') {
                const page = Number(config?.params?.page || 1);
                const perPage = Number(config?.params?.per_page || 10);
                const q = String(config?.params?.q || '');
                const total = q ? 50 : 100;
                const payload = makeInventoryPage({ page, perPage, total });
                return Promise.resolve({ data: payload });
            }
            if (url === '/api/inventory/by-ids') return Promise.resolve({ data: [] });
            return Promise.resolve({ data: [] });
        });

        render(<POSTerminal />);

        expect(await screen.findByText('Item 1')).toBeInTheDocument();
        fireEvent.click(screen.getByLabelText('Next page'));
        expect(await screen.findByText('Item 11')).toBeInTheDocument();
        await waitFor(() => {
            expect(screen.getByLabelText('Next page')).not.toBeDisabled();
        });
        fireEvent.click(screen.getByLabelText('Next page'));
        expect(await screen.findByText('Item 21')).toBeInTheDocument();

        fireEvent.change(screen.getByPlaceholderText('Search products...'), { target: { value: 'soap' } });

        await waitFor(() => {
            const calls = axiosGet.mock.calls.filter((c) => c[0] === '/api/inventory');
            const lastCall = calls[calls.length - 1];
            expect(lastCall?.[1]?.params?.page).toBe(1);
            expect(lastCall?.[1]?.params?.q).toBe('soap');
        });
    });

    it('disables next/prev appropriately when total is 10', async () => {
        axiosGet.mockImplementation((url, config) => {
            if (url === '/api/categories') return Promise.resolve({ data: [{ id: 1, name: 'Beauty Products' }] });
            if (url === '/api/clients') return Promise.resolve({ data: [] });
            if (url === '/api/settings') return Promise.resolve({ data: { pos_price_adjustments_enabled: true, pos_custom_items_enabled: true } });
            if (url === '/api/inventory') {
                const page = Number(config?.params?.page || 1);
                const perPage = Number(config?.params?.per_page || 10);
                const payload = makeInventoryPage({ page, perPage, total: 10 });
                return Promise.resolve({ data: payload });
            }
            if (url === '/api/inventory/by-ids') return Promise.resolve({ data: [] });
            return Promise.resolve({ data: [] });
        });

        render(<POSTerminal />);
        expect(await screen.findByText('Item 1')).toBeInTheDocument();

        expect(screen.getByLabelText('Previous page')).toBeDisabled();
        expect(screen.getByLabelText('Next page')).toBeDisabled();
    });
});
