# Webhook Debugging Guide

## Problem Summary
Cart items are not converting to reservations after payment completion. The database shows:
- `item_type` remains `'cart'` (should become `'reservation'`)
- `status` remains `'active'` (should become `'pending_payment'`)
- `payment_status` not updating to `'completed'`

## Changes Made

### 1. Webhook Status Fixed ✅
- **PayMongo Webhook** (`/api/webhooks/paymongo/route.ts`)
  - Changed: `status: 'reserved'` → `status: 'pending_payment'`
  - Changed: `order_status: 'reserved'` → `order_status: 'pending_payment'`
  
- **PayPal Webhook** (`/api/webhooks/paypal/route.ts`)
  - Changed: `status: 'reserved'` → `status: 'pending_payment'`
  - Changed: `order_status: 'reserved'` → `order_status: 'pending_payment'`

### 2. Success Page Query Fixed ✅
- **File**: `/app/profile/cart/success/page.tsx`
- **Changes**:
  - Query now filters by `payment_status='completed'` instead of `status='reserved'`
  - Uses `updated_at` instead of `created_at` for recent items filter
  - Sorts by `updated_at` descending (most recent first)

### 3. Enhanced Debugging Logs ✅
Both webhooks now log:
- 🎯 Webhook received with timestamp
- 📦 Payload/event type
- 🔍 Processing details (item IDs, amounts)
- 🔄 Cart-to-reservation conversion attempts
- 📝 Update operations with exact data
- ✅ Success confirmations
- ❌ Error details

## Testing Checklist

### Step 1: Make a Test Payment
1. Add items to cart
2. Go to checkout (`/profile/cart/checkout`)
3. Complete payment with PayMongo or PayPal
4. Note the exact time of payment completion

### Step 2: Check Terminal Logs
Look for these webhook logs in your development terminal:

**For PayMongo:**
```
🎯 ====== PayMongo Webhook Received ======
⏰ Timestamp: [timestamp]
📦 Payload type: checkout_session.payment.paid
🔍 Processing payment for items: [item IDs]
🔄 Converting cart item [id] to reservation
📝 Updating item [id] with: { item_type: 'reservation', status: 'pending_payment', ... }
✅ Converted cart item [id] to pending_payment status
```

**For PayPal:**
```
🎯 ====== PayPal Webhook Received ======
⏰ Timestamp: [timestamp]
📦 Event type: CHECKOUT.ORDER.APPROVED
🔄 Converting cart item [id] to reservation
📝 Updating item [id] with: { item_type: 'reservation', status: 'pending_payment', ... }
✅ Converted cart item [id] to pending_payment status
```

### Step 3: Check Database (Supabase)
Query the `user_items` table:
```sql
SELECT 
  id, 
  item_type, 
  status, 
  payment_status, 
  payment_method,
  total_paid,
  updated_at
FROM user_items
WHERE user_id = '[your-user-id]'
ORDER BY updated_at DESC
LIMIT 5;
```

**Expected Results:**
- `item_type`: `'reservation'` (was `'cart'`)
- `status`: `'pending_payment'` (was `'active'`)
- `payment_status`: `'completed'`
- `payment_method`: `'paymongo'` or `'paypal'`
- `total_paid`: Should match payment amount
- `updated_at`: Recent timestamp

### Step 4: Check Success Page
Navigate to `/profile/cart/success?source=cart`

**Should Display:**
- ✅ Payment Status: Completed
- ✅ Order Date: [today's date]
- ✅ Number of items
- ✅ Payment Summary with correct totals
- ✅ Order details (products, quantities, prices)

## Common Issues & Solutions

### Issue 1: No Webhook Logs Appear
**Symptoms:** Terminal shows no webhook activity after payment

**Possible Causes:**
1. ❌ Webhooks not configured in PayMongo/PayPal dashboard
2. ❌ Webhook URL is incorrect
3. ❌ Using production payment gateway but webhook points to localhost
4. ❌ Server not accessible from payment gateway (firewall/ngrok needed)

**Solutions:**
- **Local Development:** Use ngrok to expose localhost
  ```bash
  ngrok http 3000
  ```
  Then use the ngrok URL in webhook configuration:
  - PayMongo: `https://[ngrok-url]/api/webhooks/paymongo`
  - PayPal: `https://[ngrok-url]/api/webhooks/paypal`

- **Production:** Verify webhook URLs in dashboards:
  - PayMongo: `https://yourdomain.com/api/webhooks/paymongo`
  - PayPal: `https://yourdomain.com/api/webhooks/paypal`

### Issue 2: Webhook Fires But Items Don't Update
**Symptoms:** Webhook logs appear but database unchanged

**Check:**
1. Are `user_item_ids` correctly passed in payment metadata?
2. Do the item IDs exist in the database?
3. Is `item_type` actually `'cart'` before payment?
4. Are there database permission issues?

**Debug:**
Look for these specific logs:
- `⚠️ Item [id] not found` - Item doesn't exist
- `❌ Failed to update item [id]: [error]` - Database update failed

### Issue 3: Success Page Shows Empty Data
**Symptoms:** Success page loads but shows 0 items, ₱0 totals

**Possible Causes:**
1. Items not converted to reservation (webhook didn't fire)
2. Time filter too restrictive (more than 5 minutes passed)
3. Wrong user logged in
4. Payment status not set to 'completed'

**Debug:**
- Check browser console for errors
- Verify user is logged in with correct account
- Check if items exist with `payment_status='completed'`

### Issue 4: Items Convert But Status Wrong
**Symptoms:** `item_type='reservation'` but `status` is not `'pending_payment'`

**Check:**
- Ensure webhooks are using the latest code (restart dev server)
- Clear any caches
- Check if multiple webhooks are firing and overwriting each other

## Webhook URL Configuration

### PayMongo Dashboard
1. Go to PayMongo Dashboard > Developers > Webhooks
2. Create new webhook or edit existing
3. Set URL: `https://yourdomain.com/api/webhooks/paymongo`
4. Enable event: `checkout_session.payment.paid`
5. Save and test

### PayPal Dashboard
1. Go to PayPal Developer Dashboard > Apps & Credentials
2. Select your app
3. Scroll to Webhooks
4. Add webhook URL: `https://yourdomain.com/api/webhooks/paypal`
5. Enable events:
   - `CHECKOUT.ORDER.APPROVED`
   - `PAYMENT.CAPTURE.COMPLETED`
6. Save

## Expected Payment Flow

```
1. User adds items to cart
   ↓ [item_type='cart', status='active']

2. User clicks "Pay Now" in cart
   ↓ Redirects to /profile/cart/checkout

3. User fills checkout form and clicks Pay
   ↓ Creates payment session with user_item_ids in metadata
   ↓ Redirects to PayMongo/PayPal

4. User completes payment
   ↓ Payment gateway processes payment
   ↓ Payment gateway sends webhook to your server

5. Webhook receives payment confirmation
   ↓ Extracts user_item_ids from metadata
   ↓ For each cart item:
       - Converts item_type to 'reservation'
       - Sets status to 'pending_payment'
       - Sets payment_status to 'completed'
       - Updates total_paid
       - Deducts inventory
   ↓ Clears remaining cart items

6. Payment gateway redirects user
   ↓ User lands on /profile/cart/success

7. Success page loads
   ↓ Queries for items with:
       - item_type='reservation'
       - payment_status='completed'
       - updated within last 5 minutes
   ↓ Displays receipt

✅ DONE
```

## Next Steps for Testing

1. **Restart your development server** to ensure webhook changes are loaded
2. **If using localhost:** Set up ngrok and configure webhooks with ngrok URL
3. **Make a test payment** and watch terminal for webhook logs
4. **Check database** immediately after payment
5. **Review this guide** if something doesn't work as expected

## Important Notes

- Webhooks require a **publicly accessible URL** (ngrok for local dev)
- PayMongo and PayPal must be configured **separately**
- Webhook logs only appear in the **server terminal** (not browser console)
- Database changes happen **during webhook processing** (not during redirect)
- Success page queries items **updated in last 5 minutes** - don't wait too long!

## Support Information

If webhooks are still not working after following this guide:

1. Check PayMongo/PayPal webhook delivery logs in their dashboards
2. Verify webhook secrets/signatures if required
3. Test webhook endpoints manually using curl or Postman
4. Check server logs for any unhandled errors
5. Verify environment variables are set correctly
