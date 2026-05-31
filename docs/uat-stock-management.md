# User Acceptance Testing (UAT) — Stock Management Separation

## Goal

Verify that:

- Inventory shows catalog + stock snapshots (read-only)
- All stock changes are recorded in Stock Management
- Inventory snapshots reflect real movements
- Admin-only permissions are enforced

## Test data setup

- At least 1 active branch exists
- At least 1 product exists (non-service)
- At least 1 service exists (service type)

## Inventory (Read-only) checks

1. Navigate to Admin → Inventory
   - Expected: Page shows “Read-only”
   - Expected: No buttons to add/edit/delete items or adjust stock
2. Search inventory
   - Expected: Results update correctly
3. Filter by Low Stock / Out of Stock
   - Expected: Products filter correctly
   - Expected: Services are not included in stock status filters
4. Export CSV
   - Expected: Downloaded file contains snapshot values

## Stock In (Receipt) checks

1. Navigate to Admin → Stock Management → Stock In
2. Select a product and record +5 quantity
   - Expected: A new movement entry appears in “Recent entries”
   - Expected: Inventory stock snapshot increases by 5
3. Enter the same Reference again and save
   - Expected: Entry is rejected as a duplicate reference

## Stock Out (Issue) checks

1. Navigate to Stock Out
2. Try issuing more than available stock
   - Expected: Validation error (cannot issue more than current stock)
3. Issue a valid quantity (e.g., -2)
   - Expected: Movement entry created
   - Expected: Inventory snapshot decreases accordingly

## Adjust checks

1. Navigate to Adjust
2. Set mode: set stock to 20
   - Expected: Movement created
   - Expected: Inventory snapshot becomes 20
3. Delta mode: adjust by -3
   - Expected: Movement created
   - Expected: Inventory snapshot becomes 17

## Supply Entry checks

1. Navigate to Supply Entry
2. Record a supply entry with:
   - Quantity
   - Supplier name
   - Unit cost
   - Receipt date
   - Expected: Movement created and displayed
   - Expected: Inventory snapshot updated

## Sales Tracking checks

1. Complete a sale in POS for a product quantity > 0
2. Navigate to Admin → Stock Management → Sales
   - Expected: Movement record exists for the sold item (negative change)
   - Expected: Inventory snapshot matches the post-sale stock

## Permissions checks

1. Login as staff
   - Expected: Cannot access /admin routes
2. Login as admin
   - Expected: Can access Stock Management and create movements

