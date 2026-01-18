# GrandLink Reservation System - Testing Checklist

## Overview
This document outlines comprehensive testing steps for the new reservation system features, including:
- Fixed ₱500 reservation fee
- PayPal payment option
- Per-item discount allocation
- Correct quantity display in payment gateways
- Automatic cart clearing after payment
- Admin-controlled inventory management

---

## 1. Cart to Reservation Flow Testing

### 1.1 Add Items to Cart
- [ ] Add multiple different products to cart
- [ ] Set different quantities for each item (e.g., 2, 5, 10)
- [ ] Verify quantities display correctly in cart
- [ ] Add same product multiple times (should merge quantities)

### 1.2 Cart Modifications
- [ ] Toggle color customization add-on (₱1,500) for some items
- [ ] Verify add-on total calculated correctly per quantity
- [ ] Apply voucher code for discount
- [ ] Verify discount applied proportionally across selected items
- [ ] Verify ₱500 reservation fee appears in totals
- [ ] Select subset of cart items (not all)

### 1.3 Payment Gateway - PayMongo
- [ ] Select "PayMongo (GCash/Maya/Card)" option
- [ ] Click "Proceed to Checkout"
- [ ] **CRITICAL: Verify payment screen shows:**
  - Correct quantities for each item (not "1")
  - Per-unit prices (not line totals)
  - Line item descriptions include add-ons if present
- [ ] Complete payment in sandbox/test mode
- [ ] Verify redirect to reserve page after success

### 1.4 Payment Gateway - PayPal
- [ ] Select "PayPal" option
- [ ] Click "Proceed to Checkout"
- [ ] **CRITICAL: Verify PayPal screen shows:**
  - Correct quantities for each item
  - Per-unit prices in USD
  - Item descriptions match products
- [ ] Complete payment in sandbox mode
- [ ] Verify redirect to reserve page after success

### 1.5 Post-Payment Verification
- [ ] **Cart should be empty** after successful payment
- [ ] Items appear in Reserve page with `pending_payment` status
- [ ] Each reserved item shows:
  - Correct quantity (matches cart quantity)
  - Total price including add-ons and discounts
  - Payment status: "completed"
  - Order ID
- [ ] Total amount matches payment made
- [ ] Inventory NOT yet deducted (wait for admin approval)

---

## 2. Admin Inventory Management Testing

### 2.1 Order Approval Flow
- [ ] Log in as admin
- [ ] Navigate to Order Management dashboard
- [ ] Find order with `pending_payment` status
- [ ] Change status to "Approved"
- [ ] **CRITICAL: Verify:**
  - Product inventory decreases by correct quantity
  - `meta.inventory_reserved = true` set
  - `meta.inventory_reserved_at` timestamp recorded
  - `meta.product_stock_before` shows previous inventory
  - `meta.product_stock_after` shows new inventory
- [ ] Check Products table directly in Supabase

### 2.2 Multiple Items Approval
- [ ] Approve order with multiple products
- [ ] Verify each product's inventory decreases independently
- [ ] Verify quantities match original cart quantities

### 2.3 Order Cancellation by Admin
- [ ] Find approved order with `inventory_reserved = true`
- [ ] Change status to "Cancelled"
- [ ] **CRITICAL: Verify:**
  - Inventory restored (increases by reserved quantity)
  - `meta.inventory_reserved = false`
  - `meta.inventory_restocked_at` timestamp recorded
- [ ] Check Products table for correct inventory

---

## 3. User Cancellation Testing

### 3.1 Cancel Pending Payment
- [ ] User completes payment (status: `pending_payment`)
- [ ] User clicks "Cancel Reservation" on reserve page
- [ ] Verify order status changes to "cancelled"
- [ ] Verify inventory NOT restored (was never reserved)
- [ ] Verify payment_status set to "refund_pending"

### 3.2 Cancel Reserved Order
- [ ] Admin approves order (status: `reserved`, inventory reserved)
- [ ] User clicks "Cancel Reservation"
- [ ] **CRITICAL: Verify:**
  - Order status changes to "cancelled"
  - Inventory restored to Products table
  - `meta.inventory_reserved = false`
- [ ] Verify item appears in cancelled orders page

### 3.3 Request Cancellation (Approved Orders)
- [ ] Order already `approved` by admin
- [ ] User clicks "Request Cancellation"
- [ ] Verify status changes to `pending_cancellation`
- [ ] Admin receives notification
- [ ] Admin can approve cancellation → inventory restored

---

## 4. Discount Allocation Testing

### 4.1 Single Item with Voucher
- [ ] Add one item with quantity 5
- [ ] Apply ₱500 voucher discount
- [ ] Verify payment shows:
  - Subtotal: `price * 5`
  - Discount: `-₱500`
  - Reservation fee: `+₱500`
  - Total: `(price * 5) - 500 + 500`

### 4.2 Multiple Items with Voucher
- [ ] Add 3 different products with quantities 2, 3, 5
- [ ] Subtotals: ₱1,000, ₱2,000, ₱5,000 (total ₱8,000)
- [ ] Apply ₱1,000 voucher
- [ ] **CRITICAL: Verify discounts allocated proportionally:**
  - Item 1: `-₱125` (1,000/8,000 * 1,000)
  - Item 2: `-₱250` (2,000/8,000 * 1,000)
  - Item 3: `-₱625` (5,000/8,000 * 1,000)
- [ ] Verify reservation fee ₱500 also allocated proportionally
- [ ] Check webhook creates reservations with correct `total_amount` per item

### 4.3 Add-ons with Discounts
- [ ] Add item with quantity 3, price ₱2,000 (subtotal ₱6,000)
- [ ] Enable color customization: `+₱1,500 * 3 = ₱4,500`
- [ ] Line total: ₱10,500
- [ ] Apply ₱2,000 voucher
- [ ] Verify discount allocated on combined total (product + addon)
- [ ] Verify payment shows correct per-unit price including addon

---

## 5. Edge Cases & Error Handling

### 5.1 Payment Failures
- [ ] Initiate checkout but cancel on payment gateway
- [ ] Verify cart items remain (not cleared)
- [ ] Re-attempt checkout successfully
- [ ] Verify cart clears only after successful payment

### 5.2 Concurrent Operations
- [ ] User A and User B both add same product (inventory 10)
- [ ] User A reserves 5 (pending_payment)
- [ ] User B reserves 5 (pending_payment)
- [ ] Admin approves User A → inventory = 5
- [ ] Admin approves User B → inventory = 0
- [ ] Verify no negative inventory

### 5.3 Insufficient Inventory
- [ ] Product has inventory = 3
- [ ] User adds quantity 5 to cart
- [ ] Attempt checkout
- [ ] Verify appropriate error or warning

### 5.4 Webhook Delays
- [ ] Complete payment but webhook delayed
- [ ] Verify user doesn't see reservation until webhook processes
- [ ] Manually trigger webhook (Supabase edge function logs)
- [ ] Verify idempotency (duplicate webhook doesn't create duplicate reservations)

### 5.5 Multiple Cart Sessions
- [ ] User adds items to cart on desktop
- [ ] User adds different items on mobile
- [ ] Checkout from desktop
- [ ] Verify both desktop and mobile cart items cleared after payment

---

## 6. Display & UI Testing

### 6.1 Reserve Page Display
- [ ] Verify columns shown:
  - Product name and image
  - **Quantity** (not just price * quantity)
  - Total Price (including discounts and add-ons)
  - Order ID
  - Created date
  - Payment status
  - Order status badge
- [ ] Verify status colors correct:
  - Yellow: pending_payment
  - Blue: reserved
  - Green: approved
  - Red: cancelled

### 6.2 Order History Display
- [ ] Navigate to "Orders" page (completed/delivered)
- [ ] Verify shows `total_amount` column (not `price`)
- [ ] Verify quantities display correctly

### 6.3 Cancelled Orders Display
- [ ] Navigate to cancelled orders page
- [ ] Verify cancelled reservations appear
- [ ] Verify shows reason if provided

---

## 7. Integration Testing

### 7.1 PayMongo Webhook
- [ ] Monitor webhook endpoint: `POST /api/webhooks/paymongo`
- [ ] Verify signature validation passes
- [ ] Verify event type: `checkout_session.payment.paid`
- [ ] Verify metadata extracted correctly:
  - `user_item_ids`
  - `final_total_per_item`
  - `reservation_fee_share`
  - `addons_total_per_item`
  - `line_total_after_discount`
- [ ] Verify cart clearing executes
- [ ] Verify admin notification sent

### 7.2 PayPal Webhook
- [ ] Monitor webhook endpoint: `POST /api/webhooks/paypal`
- [ ] Verify event types handled:
  - `CHECKOUT.ORDER.APPROVED`
  - `PAYMENT.CAPTURE.COMPLETED`
- [ ] Verify PayPal order fetched via API
- [ ] Verify `custom_id` parsed for user_item_ids
- [ ] Verify cart clearing executes
- [ ] Verify admin notification sent

---

## 8. Database Verification

### 8.1 user_items Table
After successful payment:
```sql
SELECT 
  id, 
  product_id, 
  quantity, 
  item_type, 
  status, 
  order_status,
  payment_status,
  total_amount,
  meta->'inventory_reserved' as inventory_reserved,
  meta->'final_total_per_item' as final_total,
  meta->'reservation_fee_share' as reservation_fee
FROM user_items
WHERE user_id = 'test-user-id'
ORDER BY created_at DESC;
```
- [ ] Verify `item_type = 'reservation'`
- [ ] Verify `status = 'pending_payment'`
- [ ] Verify `total_amount` matches discounted price
- [ ] Verify `quantity` preserved from cart

### 8.2 products Table
After admin approval:
```sql
SELECT 
  id,
  name,
  inventory
FROM products
WHERE id IN (SELECT product_id FROM user_items WHERE status = 'approved')
```
- [ ] Verify inventory decremented correctly

### 8.3 Cart Clearing Verification
After webhook:
```sql
SELECT COUNT(*) 
FROM user_items 
WHERE user_id = 'test-user-id'
  AND item_type = 'order'
  AND order_status = 'cart';
```
- [ ] **Should return 0** (cart empty)

---

## 9. Performance Testing

### 9.1 Large Cart
- [ ] Add 50+ items to cart
- [ ] Verify checkout creates payment session
- [ ] Verify webhook processes all items
- [ ] Verify cart clearing completes
- [ ] Check response times (< 5 seconds ideal)

### 9.2 High Concurrency
- [ ] Simulate 10 users checking out simultaneously
- [ ] Verify no race conditions
- [ ] Verify inventory management remains consistent

---

## 10. Regression Testing

### 10.1 Direct Reservation (Not from Cart)
- [ ] Navigate to product page
- [ ] Click "Reserve Now"
- [ ] Fill quantity and address
- [ ] Select payment method
- [ ] Complete payment
- [ ] Verify appears in reserve page
- [ ] Verify NO cart clearing (because no cart involved)

### 10.2 Admin Features
- [ ] Admin dashboard still loads correctly
- [ ] Admin can view all orders
- [ ] Admin can update statuses
- [ ] Admin notifications work

---

## Success Criteria

✅ All checklist items pass
✅ No console errors during flows
✅ Quantities display correctly in PayMongo and PayPal
✅ Cart automatically clears after successful payment
✅ Inventory management works via admin approval/cancellation
✅ ₱500 reservation fee applied consistently
✅ Discounts allocated proportionally per item
✅ Webhook processing idempotent
✅ Database constraints respected (no negative inventory)

---

## Testing Tools

- **Payment Sandbox**: PayMongo test mode, PayPal sandbox accounts
- **Database**: Supabase SQL Editor for direct queries
- **API Testing**: Postman/Insomnia for webhook testing
- **Browser**: Chrome DevTools Network tab for payment redirects
- **Logging**: Console logs in webhook files for debugging

---

## Notes

- Test in **staging environment** before production
- Use **test credit cards** for PayMongo
- Use **sandbox accounts** for PayPal
- Document any failures with screenshots and console logs
- Verify TypeScript compilation has no errors before testing
