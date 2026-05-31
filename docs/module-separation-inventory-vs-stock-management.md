# Inventory vs Stock Management (Admin)

## What changed

The system is now split into two clear modules:

## Inventory (Read-only)

Inventory is a catalog snapshot. It lets you:

- View products/services and their category, price, and current stock quantity (snapshot)
- Search and filter (category, low stock, out of stock)
- Export the snapshot to CSV

Inventory does **not** allow stock changes.

## Stock Management (Where stock changes happen)

Stock Management is where you record all stock movements. Use it to:

- Stock In: record deliveries/received items
- Stock Out: record usage, dispatches, transfers, and other removals
- Adjust: correct the system quantity (set or delta)
- Supply Entry: record supplier deliveries with optional cost details
- Sales: view stock changes recorded automatically by POS sales

## Common workflows

### 1) Receiving a delivery (Stock In)

1. Go to Admin → Stock Management → Stock In
2. Select branch
3. Search and select item
4. Enter quantity received
5. (Optional) add reference and notes
6. Save

Result:
- Branch stock increases
- A stock movement record is created
- Inventory snapshot updates automatically

### 2) Issuing/using stock (Stock Out)

1. Go to Stock Management → Stock Out
2. Select item and quantity issued
3. Save

Result:
- Branch stock decreases
- A stock movement record is created

### 3) Fixing incorrect stock (Adjust)

Use Adjust when the system stock doesn’t match reality.

- Set mode: set stock to an exact number (e.g., set to 20)
- Delta mode: adjust by a positive/negative number (e.g., -2 for damaged items)

### 4) Recording supplier details (Supply Entry)

Supply Entry is like Stock In but can include supplier name, unit cost, and receipt date.

### 5) Tracking stock deducted by sales (Sales)

Sales deductions are automatically recorded when sales are completed in POS.
Use Stock Management → Sales to review the movement history.

## Data integrity rules

- Stock movements are blocked for services (services do not have stock quantity)
- Stock Out cannot exceed current stock
- Optional Reference can be used to prevent duplicates:
  - The system blocks duplicate references per branch and entry type

