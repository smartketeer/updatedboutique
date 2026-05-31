import React from 'react';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { fireEvent, render, screen, waitFor, cleanup } from '@testing-library/react';
import StockManagement from '../views/StockManagement';

const axiosGet = vi.fn();
const axiosPost = vi.fn();

vi.mock('axios', () => ({
    default: {
        get: (...args) => axiosGet(...args),
        post: (...args) => axiosPost(...args),
    },
}));

beforeEach(() => {
    axiosGet.mockReset();
    axiosPost.mockReset();
});

afterEach(() => {
    cleanup();
});

describe('StockManagement', () => {
    it('records a stock receipt and refreshes movements', async () => {
        axiosGet.mockImplementation((url, config) => {
            if (url === '/api/branches') return Promise.resolve({ data: [{ id: 1, name: 'Branch', is_active: true }] });
            if (String(url).startsWith('/api/inventory')) return Promise.resolve({ data: [{ id: 10, name: 'Item A', sku: 'A', stock_qty: 5, is_service: false, category: { id: 1, name: 'Products', type: 'product' } }] });
            if (url === '/api/categories') return Promise.resolve({ data: [{ id: 1, name: 'Products', type: 'product' }] });
            if (url === '/api/stock-management/movements') return Promise.resolve({ data: [] });
            return Promise.resolve({ data: [] });
        });

        axiosPost.mockResolvedValue({
            data: {
                id: 1,
                item_id: 10,
                branch_id: 1,
                change_qty: 3,
                new_qty: 8,
                reason: 'receipt',
                created_at: new Date().toISOString(),
                item: { id: 10, name: 'Item A', sku: 'A', category: { id: 1, name: 'Products', type: 'product' } },
            },
        });

        render(<StockManagement />);

        expect(await screen.findByText('Stock Management')).toBeInTheDocument();

        await screen.findByRole('option', { name: /Item A/i });
        fireEvent.change(screen.getByLabelText('Item'), { target: { value: '10' } });
        fireEvent.change(screen.getByLabelText('Quantity received'), { target: { value: '3' } });
        fireEvent.click(screen.getByRole('button', { name: 'Save' }));

        await waitFor(() => {
            expect(axiosPost).toHaveBeenCalled();
        });

        const [url, payload] = axiosPost.mock.calls[0];
        expect(url).toBe('/api/stock-management/movements');
        expect(payload).toMatchObject({
            branch_id: 1,
            item_id: 10,
            reason: 'receipt',
            quantity: 3,
        });
    });
});
