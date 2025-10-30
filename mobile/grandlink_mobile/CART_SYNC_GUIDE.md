# Cart Synchronization Guide - Mobile & Web

## Overview
The mobile app cart is fully synchronized with the website through the Supabase `user_items` table. Any changes made on mobile will instantly appear on the website (and vice versa) when the user refreshes or navigates to their cart.

## Database Schema

### Table: `user_items`

**Columns used for cart:**
- `id` (uuid, primary key)
- `user_id` (uuid, foreign key to auth.users)
- `product_id` (uuid, foreign key to products)
- `item_type` (text) - **MUST be 'order' for cart items**
- `status` (text) - **MUST be 'active' for active cart items**
- `quantity` (integer) - quantity of items in cart
- `price` (numeric) - unit price of the product
- `total_amount` (numeric) - quantity × price
- `created_at` (timestamp)
- `updated_at` (timestamp)

## Query for Cart Items

### Mobile App Query (already implemented):
```typescript
const { data, error } = await supabase
  .from('user_items')
  .select(`
    id,
    product_id,
    quantity,
    price,
    created_at,
    products (
      name,
      image1
    )
  `)
  .eq('user_id', userId)
  .eq('item_type', 'order')
  .eq('status', 'active')
  .order('created_at', { ascending: false });
```

### Website Implementation (for your web developer):
The website should use **exactly the same query** to fetch cart items:

```javascript
// Example for Next.js/React website
const loadCartItems = async () => {
  const { data: { user } } = await supabase.auth.getUser();
  
  const { data, error } = await supabase
    .from('user_items')
    .select(`
      id,
      product_id,
      quantity,
      price,
      created_at,
      products (
        name,
        image1
      )
    `)
    .eq('user_id', user.id)
    .eq('item_type', 'order')
    .eq('status', 'active')
    .order('created_at', { ascending: false });
    
  return data;
};
```

## Adding Items to Cart

### Mobile (already implemented):
```typescript
const payload = {
  user_id: userId,
  product_id: product.id,
  item_type: 'order',
  status: 'active',
  quantity: qty,
  price: product.price,
  total_amount: product.price * qty,
};
await supabase.from('user_items').insert([payload]);
```

### Website should use the same format:
```javascript
const addToCart = async (product, quantity = 1) => {
  const { data: { user } } = await supabase.auth.getUser();
  
  // Check if item already exists
  const { data: existing } = await supabase
    .from('user_items')
    .select('*')
    .eq('user_id', user.id)
    .eq('product_id', product.id)
    .eq('item_type', 'order')
    .maybeSingle();
  
  if (existing) {
    // Update quantity
    const newQty = existing.quantity + quantity;
    await supabase
      .from('user_items')
      .update({ 
        quantity: newQty,
        total_amount: newQty * product.price,
        updated_at: new Date().toISOString()
      })
      .eq('id', existing.id);
  } else {
    // Insert new item
    await supabase.from('user_items').insert([{
      user_id: user.id,
      product_id: product.id,
      item_type: 'order',
      status: 'active',
      quantity: quantity,
      price: product.price,
      total_amount: product.price * quantity,
    }]);
  }
};
```

## Updating Quantity

### Mobile (already implemented):
```typescript
await supabase
  .from('user_items')
  .update({ 
    quantity: newQty,
    total_amount: newQty * price,
    updated_at: new Date().toISOString()
  })
  .eq('id', itemId);
```

### Website should use the same logic

## Removing Items

### Mobile (already implemented):
```typescript
await supabase.from('user_items').delete().eq('id', itemId);
```

### Website should use the same logic

## Critical Requirements for Sync

✅ **DO:**
1. Always filter by `item_type = 'order'` (to separate cart from reservations/orders)
2. Always filter by `status = 'active'` (completed orders have different statuses)
3. Always include `user_id` in queries
4. Update `updated_at` timestamp when modifying items
5. Calculate `total_amount = quantity × price` when updating
6. Join with `products` table to get product name and image

❌ **DON'T:**
1. Create separate cart tables or storage
2. Use different column names
3. Mix cart items with orders/reservations (use `item_type` properly)
4. Store cart in localStorage/cookies (user needs to see same cart across devices)

## Real-Time Updates (Optional Enhancement)

For instant synchronization without page refresh, implement Supabase Realtime:

```javascript
// Subscribe to cart changes
const channel = supabase
  .channel('cart-changes')
  .on(
    'postgres_changes',
    {
      event: '*',
      schema: 'public',
      table: 'user_items',
      filter: `user_id=eq.${userId} AND item_type=eq.order`
    },
    (payload) => {
      console.log('Cart changed!', payload);
      // Reload cart items
      loadCartItems();
    }
  )
  .subscribe();
```

## Testing Synchronization

1. **Mobile → Web:**
   - Add item to cart on mobile app
   - Open website and navigate to cart
   - Item should appear in website cart

2. **Web → Mobile:**
   - Add item to cart on website
   - Open mobile app and navigate to cart
   - Item should appear in mobile cart

3. **Quantity Updates:**
   - Update quantity on mobile
   - Refresh website cart
   - Quantity should match

4. **Remove Items:**
   - Remove item on mobile
   - Refresh website cart
   - Item should be gone

## Contact
For questions about mobile app implementation, contact the mobile developer.
For website implementation, ensure your web developer follows this exact schema.
