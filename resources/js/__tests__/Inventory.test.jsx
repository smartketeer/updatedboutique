import React from 'react';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { fireEvent, render, screen, waitFor, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Inventory from '../views/Inventory';

const axiosGet = vi.fn();
const axiosPost = vi.fn();
const axiosPut = vi.fn();
const axiosDelete = vi.fn();

vi.mock('axios', () => ({
    default: {
        get: (...args) => axiosGet(...args),
        post: (...args) => axiosPost(...args),
        put: (...args) => axiosPut(...args),
        delete: (...args) => axiosDelete(...args),
    },
}));

function makeItems(count = 60) {
    return Array.from({ length: count }).map((_, idx) => ({
        id: idx + 1,
        name: `Item ${idx + 1}`,
        sku: `SKU${idx + 1}`,
        category_id: 1,
        category: { id: 1, name: 'Products', type: 'product' },
        price: 10,
        stock_qty: idx % 10 === 0 ? 0 : 7,
        is_service: false,
        last_restock_date: '2026-04-01',
    }));
}

beforeEach(() => {
    axiosGet.mockReset();
    axiosPost.mockReset();
    axiosPut.mockReset();
    axiosDelete.mockReset();
    localStorage.clear();
    Object.defineProperty(window, 'innerWidth', { value: 1024, writable: true, configurable: true });
});

afterEach(() => {
    cleanup();
});

describe('Inventory', () => {
    it('persists filters and page size in localStorage', async () => {
        localStorage.setItem(
            'inventory_snapshot_filters_v1',
            JSON.stringify({
                search: 'milk',
                categoryFilter: 'all',
                stockStatusFilter: 'low',
                pageSize: 50,
            }),
        );

        axiosGet.mockImplementation((url) => {
            if (url === '/api/branches') return Promise.resolve({ data: [{ id: 1, name: 'Branch', is_active: true }] });
            if (String(url).startsWith('/api/inventory')) return Promise.resolve({ data: makeItems(60) });
            if (url === '/api/categories') return Promise.resolve({ data: [{ id: 1, name: 'Products', type: 'product' }] });
            return Promise.resolve({ data: [] });
        });

        render(
            <MemoryRouter>
                <Inventory />
            </MemoryRouter>,
        );

        const searchInput = await screen.findByLabelText('Search inventory');
        expect(searchInput).toHaveValue('milk');

        fireEvent.click(await screen.findByRole('button', { name: 'More actions' }));
        const btn50 = await screen.findByRole('menuitem', { name: 'Rows per page: 50' });
        expect(btn50).toHaveAttribute('aria-pressed', 'true');

        fireEvent.change(searchInput, { target: { value: 'soap' } });
        await waitFor(() => {
            const raw = localStorage.getItem('inventory_snapshot_filters_v1');
            expect(raw).toContain('soap');
        });
    });

    it('clamps pagination and resets page on filter changes', async () => {
        axiosGet.mockImplementation((url) => {
            if (url === '/api/branches') return Promise.resolve({ data: [{ id: 1, name: 'Branch', is_active: true }] });
            if (String(url).startsWith('/api/inventory')) return Promise.resolve({ data: makeItems(60) });
            if (url === '/api/categories') return Promise.resolve({ data: [{ id: 1, name: 'Products', type: 'product' }] });
            return Promise.resolve({ data: [] });
        });

        render(
            <MemoryRouter>
                <Inventory />
            </MemoryRouter>,
        );

        await screen.findByText('Item 1');
        await waitFor(() => {
            const initialSummaries = screen.getAllByLabelText('Results summary');
            expect(initialSummaries[initialSummaries.length - 1].textContent).toContain('Showing 1\u201325 of 60');
        });

        const jump = screen.getByLabelText('Jump to page');
        fireEvent.change(jump, { target: { value: '999' } });
        fireEvent.submit(jump.closest('form'));

        await waitFor(() => {
            const summaries = screen.getAllByLabelText('Results summary');
            expect(summaries[summaries.length - 1].textContent).toContain('Showing 51\u201360 of 60');
        });

        const searchInput = screen.getByLabelText('Search inventory');
        fireEvent.change(searchInput, { target: { value: 'Item 1' } });

        await waitFor(() => {
            const summaries = screen.getAllByLabelText('Results summary');
            expect(summaries[summaries.length - 1].textContent).toContain('Showing 1\u2013');
        });
    });

    it('focuses search with Ctrl+F', async () => {
        axiosGet.mockImplementation((url) => {
            if (url === '/api/branches') return Promise.resolve({ data: [{ id: 1, name: 'Branch', is_active: true }] });
            if (String(url).startsWith('/api/inventory')) return Promise.resolve({ data: makeItems(10) });
            if (url === '/api/categories') return Promise.resolve({ data: [{ id: 1, name: 'Products', type: 'product' }] });
            return Promise.resolve({ data: [] });
        });

        render(
            <MemoryRouter>
                <Inventory />
            </MemoryRouter>,
        );

        await screen.findByLabelText('Results summary');

        fireEvent.keyDown(document, { key: 'f', ctrlKey: true });
        expect(screen.getByLabelText('Search inventory')).toHaveFocus();
    });

    it('is read-only (no stock movement actions)', async () => {
        axiosGet.mockImplementation((url) => {
            if (url === '/api/branches') return Promise.resolve({ data: [{ id: 1, name: 'Branch', is_active: true }] });
            if (String(url).startsWith('/api/inventory')) return Promise.resolve({ data: makeItems(10) });
            if (url === '/api/categories') return Promise.resolve({ data: [{ id: 1, name: 'Products', type: 'product' }] });
            return Promise.resolve({ data: [] });
        });

        render(
            <MemoryRouter>
                <Inventory />
            </MemoryRouter>,
        );

        expect(await screen.findByText('Read-only')).toBeVisible();
        expect(screen.queryByText('Stock Management')).toBeNull();
        expect(screen.queryByText('Bulk stock edit')).toBeNull();
        expect(screen.queryByText('Import inventory')).toBeNull();
    });

    it('sorts by stock level lowest-to-highest and highest-to-lowest', async () => {
        const custom = [
            { id: 1, name: 'A', sku: 'A', category_id: 1, category: { id: 1, name: 'Products', type: 'product' }, price: 10, stock_qty: 5, is_service: false },
            { id: 2, name: 'B', sku: 'B', category_id: 1, category: { id: 1, name: 'Products', type: 'product' }, price: 10, stock_qty: 0, is_service: false },
            { id: 3, name: 'C', sku: 'C', category_id: 1, category: { id: 1, name: 'Products', type: 'product' }, price: 10, stock_qty: -2, is_service: false },
            { id: 4, name: 'D', sku: 'D', category_id: 1, category: { id: 1, name: 'Products', type: 'product' }, price: 10, stock_qty: 50, is_service: false },
            { id: 5, name: 'E', sku: 'E', category_id: 1, category: { id: 1, name: 'Products', type: 'product' }, price: 10, stock_qty: null, is_service: false },
        ];

        axiosGet.mockImplementation((url) => {
            if (url === '/api/branches') return Promise.resolve({ data: [{ id: 1, name: 'Branch', is_active: true }] });
            if (String(url).startsWith('/api/inventory')) return Promise.resolve({ data: custom });
            if (url === '/api/categories') return Promise.resolve({ data: [{ id: 1, name: 'Products', type: 'product' }] });
            return Promise.resolve({ data: [] });
        });

        render(
            <MemoryRouter>
                <Inventory />
            </MemoryRouter>,
        );

        await screen.findByText('A');

        const sortGroup = screen.getByRole('group', { name: 'Sort by Stock Level' });
        const lowToHigh = screen.getByRole('button', { name: 'Sort stock: lowest to highest' });
        const highToLow = screen.getByRole('button', { name: 'Sort stock: highest to lowest' });

        expect(sortGroup).toBeInTheDocument();

        fireEvent.click(lowToHigh);
        await waitFor(() => {
            const rows = screen.getAllByRole('row').slice(1);
            const names = rows.map((r) => r.textContent || '');
            expect(names[0]).toContain('C');
            expect(names[1]).toContain('B');
            expect(names[2]).toContain('A');
            expect(names[3]).toContain('D');
            expect(names[4]).toContain('E');
        });

        fireEvent.click(highToLow);
        await waitFor(() => {
            const rows = screen.getAllByRole('row').slice(1);
            const names = rows.map((r) => r.textContent || '');
            expect(names[0]).toContain('D');
            expect(names[1]).toContain('A');
            expect(names[2]).toContain('B');
            expect(names[3]).toContain('C');
            expect(names[4]).toContain('E');
        });
    });
});
