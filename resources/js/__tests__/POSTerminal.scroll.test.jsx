import React from 'react';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { fireEvent, render, screen, waitFor, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import POSTerminal from '../views/POSTerminal';

const axiosGet = vi.fn();
const axiosPost = vi.fn();

vi.mock('axios', () => ({
    default: {
        get: (...args) => axiosGet(...args),
        post: (...args) => axiosPost(...args),
    },
}));

const authState = {
    user: { id: 1, name: 'Cashier', role: 'staff' },
    branchName: 'luna branch',
};

vi.mock('../store/authStore', () => ({
    useAuthStore: (selector) => (typeof selector === 'function' ? selector(authState) : authState),
}));

const cartStoreState = {
    items: [],
    addItem: vi.fn(),
    removeItem: vi.fn(),
    updateQuantity: vi.fn(),
    clearCart: vi.fn(),
    getTotal: () => 0,
    overrideApproval: null,
    checkoutPin: '',
    clearOverrideAuth: vi.fn(),
};

vi.mock('../store/cartStore', () => ({
    useCartStore: () => cartStoreState,
}));

beforeEach(() => {
    axiosGet.mockReset();
    axiosPost.mockReset();
    cartStoreState.addItem.mockReset();
    cartStoreState.removeItem.mockReset();
    cartStoreState.updateQuantity.mockReset();
    cartStoreState.clearCart.mockReset();
    cartStoreState.clearOverrideAuth.mockReset();
});

afterEach(() => {
    cleanup();
});

describe('POSTerminal scroll behavior', () => {
    it('never triggers programmatic scrolling during normal interactions', async () => {
        if (!Element.prototype.scrollIntoView) {
            Element.prototype.scrollIntoView = () => {};
        }

        const scrollToSpy = vi.spyOn(window, 'scrollTo');
        const scrollIntoViewSpy = vi.spyOn(Element.prototype, 'scrollIntoView');

        axiosGet.mockImplementation((url) => {
            if (url === '/api/categories') {
                return Promise.resolve({ data: [{ id: 1, name: 'Products' }] });
            }
            if (url === '/api/settings') {
                return Promise.resolve({
                    data: { pos_price_adjustments_enabled: true, pos_custom_items_enabled: true },
                });
            }
            if (String(url).startsWith('/api/inventory')) {
                return Promise.resolve({
                    data: {
                        data: [
                            {
                                id: 1,
                                name: 'Item 1',
                                sku: 'SKU1',
                                price: 10,
                                stock_qty: 10,
                                is_service: false,
                                category: { id: 1, name: 'Products' },
                            },
                            {
                                id: 2,
                                name: 'Item 2',
                                sku: 'SKU2',
                                price: 15,
                                stock_qty: 10,
                                is_service: false,
                                category: { id: 1, name: 'Products' },
                            },
                        ],
                        current_page: 1,
                        last_page: 1,
                        total: 2,
                    },
                });
            }
            if (String(url).startsWith('/api/inventory/by-ids')) {
                return Promise.resolve({ data: [] });
            }
            return Promise.resolve({ data: [] });
        });

        render(
            <MemoryRouter>
                <POSTerminal />
            </MemoryRouter>,
        );

        const card = await screen.findByTestId('product-card-1');
        fireEvent.click(card);

        await waitFor(() => {
            expect(cartStoreState.addItem).toHaveBeenCalled();
        });

        expect(scrollToSpy).not.toHaveBeenCalled();
        expect(scrollIntoViewSpy).not.toHaveBeenCalled();
    });
});

