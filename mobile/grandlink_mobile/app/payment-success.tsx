import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { supabase } from './supabaseClient';
import { useModal } from '@/hooks/useModal';

type OrderItem = {
  id: string;
  product_id?: string;
  name: string;
  qty: number;
  price: number;
  category?: string;
  material?: string;
};

export default function PaymentSuccessScreen() {
  const router = useRouter();
  const modal = useModal();
  const [loading, setLoading] = useState(true);
  const [order, setOrder] = useState<any>(null);
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);

  useEffect(() => {
    loadSuccessfulOrder();
  }, []);

  const loadSuccessfulOrder = async () => {
    try {
      setLoading(true);

      // Get authenticated user
      const { data: authData } = await supabase.auth.getUser();
      if (!authData?.user) {
        modal.showError('Error', 'User not authenticated');
        router.replace('/(tabs)/shop');
        return;
      }

      // Get the most recent pending_payment order (just completed payment)
      const { data: orders, error } = await supabase
        .from('user_items')
        .select('*')
        .eq('user_id', authData.user.id)
        .eq('status', 'pending_payment')
        .eq('item_type', 'order')
        .order('created_at', { ascending: false })
        .limit(10); // Get recent orders to find the one just paid

      if (error) {
        throw error;
      }

      if (!orders || orders.length === 0) {
        modal.showInfo('Info', 'No pending orders found');
        router.replace('/(tabs)/shop');
        return;
      }

      // Use the first one as it's the most recent
      const firstOrder = orders[0];
      setOrder(firstOrder);

      // Format order items for display
      const formatted: OrderItem[] = orders.map(item => ({
        id: item.id,
        product_id: item.product_id,
        name: item.product_id ? `Product ${item.product_id}` : 'Order Item',
        qty: item.quantity || 1,
        price: item.price || 0,
        category: item.meta?.category || '',
      }));

      setOrderItems(formatted);
    } catch (e: any) {
      console.error('Failed to load success order:', e);
      modal.showError('Error', `Failed to load order details: ${e.message}`);
      router.replace('/(tabs)/shop');
    } finally {
      setLoading(false);
    }
  };

  const calculateTotals = () => {
    let subtotal = 0;
    let addOnsTotal = 0;
    let discountAmount = 0;

    orderItems.forEach(item => {
      subtotal += item.price * item.qty;
    });

    // Check for add-ons in order meta
    if (order?.meta?.add_ons?.color_customization?.enabled) {
      addOnsTotal += order.meta.add_ons.color_customization.price || 0;
    }

    // Check for discount in order meta
    if (order?.meta?.discount) {
      discountAmount = order.meta.discount.amount || 0;
    }

    const total = subtotal + addOnsTotal - discountAmount;

    return {
      subtotal,
      addOnsTotal,
      discountAmount,
      total,
    };
  };

  const formatCurrency = (value: number) => {
    return `₱${value.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#a81d1d" />
          <Text style={styles.loadingText}>Loading order details...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!order) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Order not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  const { subtotal, addOnsTotal, discountAmount, total } = calculateTotals();

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Success Header */}
        <View style={styles.successHeader}>
          <View style={styles.successIconContainer}>
            <Ionicons name="checkmark-circle" size={80} color="#0b9f34" />
          </View>
          <Text style={styles.successTitle}>Payment Successful!</Text>
          <Text style={styles.successSubtitle}>
            Your order has been confirmed and we're processing it
          </Text>
        </View>

        {/* Order Number and Date */}
        <View style={styles.orderInfoCard}>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Order ID</Text>
            <Text style={styles.infoValue}>{order.id.substring(0, 8).toUpperCase()}</Text>
          </View>
          <View style={[styles.infoRow, { borderTopWidth: 1, borderTopColor: '#eee', paddingTop: 12 }]}>
            <Text style={styles.infoLabel}>Date & Time</Text>
            <Text style={styles.infoValue}>{formatDate(order.created_at)}</Text>
          </View>
          {order.customer_name && (
            <View style={[styles.infoRow, { borderTopWidth: 1, borderTopColor: '#eee', paddingTop: 12 }]}>
              <Text style={styles.infoLabel}>Recipient</Text>
              <Text style={styles.infoValue}>{order.customer_name}</Text>
            </View>
          )}
        </View>

        {/* Order Items */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Order Items</Text>
          <View style={styles.itemsCard}>
            {orderItems.map((item, index) => (
              <View key={item.id}>
                <View style={styles.itemRow}>
                  <View style={styles.itemDetails}>
                    <Text style={styles.itemName}>{item.name}</Text>
                    {item.category && <Text style={styles.itemCategory}>{item.category}</Text>}
                  </View>
                  <View style={styles.itemPricing}>
                    <Text style={styles.itemQty}>Qty: {item.qty}</Text>
                    <Text style={styles.itemPrice}>{formatCurrency(item.price * item.qty)}</Text>
                  </View>
                </View>
                {index < orderItems.length - 1 && <View style={styles.divider} />}
              </View>
            ))}
          </View>
        </View>

        {/* Add-ons */}
        {order.meta?.add_ons?.color_customization?.enabled && (
          <View style={styles.section}>
            <View style={styles.addonRow}>
              <Text style={styles.addonLabel}>
                Color Customization: {order.meta.add_ons.color_customization.color}
              </Text>
              <Text style={styles.addonPrice}>
                {formatCurrency(order.meta.add_ons.color_customization.price || 0)}
              </Text>
            </View>
          </View>
        )}

        {/* Price Summary */}
        <View style={styles.summaryCard}>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Subtotal</Text>
            <Text style={styles.summaryValue}>{formatCurrency(subtotal)}</Text>
          </View>

          {addOnsTotal > 0 && (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Add-ons</Text>
              <Text style={styles.summaryValue}>{formatCurrency(addOnsTotal)}</Text>
            </View>
          )}

          {discountAmount > 0 && (
            <View style={styles.summaryRow}>
              <Text style={styles.discountLabel}>Discount ({order.meta?.discount?.code})</Text>
              <Text style={styles.discountValue}>-{formatCurrency(discountAmount)}</Text>
            </View>
          )}

          <View style={[styles.summaryRow, styles.totalRow]}>
            <Text style={styles.totalLabel}>Total Amount</Text>
            <Text style={styles.totalValue}>{formatCurrency(total)}</Text>
          </View>
        </View>

        {/* Delivery Address */}
        {order.delivery_address && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Delivery Address</Text>
            <View style={styles.addressCard}>
              <Text style={styles.addressText}>{order.delivery_address}</Text>
            </View>
          </View>
        )}

        {/* Contact Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Contact Information</Text>
          <View style={styles.contactCard}>
            {order.customer_email && (
              <View style={styles.contactRow}>
                <Ionicons name="mail" size={18} color="#a81d1d" />
                <Text style={styles.contactInfo}>{order.customer_email}</Text>
              </View>
            )}
            {order.customer_phone && (
              <View style={styles.contactRow}>
                <Ionicons name="call" size={18} color="#a81d1d" />
                <Text style={styles.contactInfo}>{order.customer_phone}</Text>
              </View>
            )}
          </View>
        </View>

        {/* Order Status Note */}
        <View style={styles.noteCard}>
          <Ionicons name="information-circle" size={20} color="#0b9f34" />
          <Text style={styles.noteText}>
            You will receive an email confirmation shortly with your receipt and tracking information.
          </Text>
        </View>
      </ScrollView>

      {/* Action Buttons */}
      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={[styles.button, styles.secondaryBtn]}
          onPress={() => router.replace('/(tabs)/shop')}
        >
          <Text style={styles.secondaryBtnText}>Continue Shopping</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.primaryBtn]}
          onPress={() => router.replace('/(tabs)/orders')}
        >
          <Ionicons name="arrow-forward" size={18} color="#fff" />
          <Text style={styles.primaryBtnText}>Proceed to Orders</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  scrollContent: {
    flex: 1,
    padding: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    color: '#666',
    fontSize: 14,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    color: '#d00',
    fontSize: 16,
    fontWeight: '600',
  },

  // Success Header
  successHeader: {
    alignItems: 'center',
    marginBottom: 24,
    paddingVertical: 16,
  },
  successIconContainer: {
    marginBottom: 16,
  },
  successTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#0b9f34',
    marginBottom: 8,
    textAlign: 'center',
  },
  successSubtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
  },

  // Order Info Card
  orderInfoCard: {
    backgroundColor: '#f8f9fa',
    borderRadius: 10,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  infoLabel: {
    fontSize: 13,
    color: '#666',
    fontWeight: '600',
  },
  infoValue: {
    fontSize: 14,
    color: '#222',
    fontWeight: '700',
  },

  // Section
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#222',
    marginBottom: 12,
  },

  // Items Card
  itemsCard: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#eee',
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: 10,
  },
  itemDetails: {
    flex: 1,
  },
  itemName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#222',
    marginBottom: 4,
  },
  itemCategory: {
    fontSize: 12,
    color: '#888',
  },
  itemPricing: {
    alignItems: 'flex-end',
  },
  itemQty: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  itemPrice: {
    fontSize: 14,
    fontWeight: '700',
    color: '#a81d1d',
  },
  divider: {
    height: 1,
    backgroundColor: '#f0f0f0',
  },

  // Add-ons
  addonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  addonLabel: {
    fontSize: 13,
    color: '#333',
    fontWeight: '600',
    flex: 1,
  },
  addonPrice: {
    fontSize: 14,
    fontWeight: '700',
    color: '#a81d1d',
  },

  // Summary Card
  summaryCard: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 16,
    borderWidth: 1,
    borderColor: '#eee',
    marginBottom: 20,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  summaryLabel: {
    fontSize: 14,
    color: '#666',
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#222',
  },
  discountLabel: {
    fontSize: 14,
    color: '#0b9f34',
    fontWeight: '600',
  },
  discountValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0b9f34',
  },
  totalRow: {
    borderBottomWidth: 0,
    borderTopWidth: 2,
    borderTopColor: '#eee',
    paddingVertical: 12,
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: '#222',
  },
  totalValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#a81d1d',
  },

  // Address Card
  addressCard: {
    backgroundColor: '#f8f9fa',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  addressText: {
    fontSize: 13,
    color: '#333',
    lineHeight: 20,
  },

  // Contact Card
  contactCard: {
    backgroundColor: '#f8f9fa',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  contactInfo: {
    marginLeft: 12,
    fontSize: 13,
    color: '#333',
    flex: 1,
  },

  // Note Card
  noteCard: {
    flexDirection: 'row',
    backgroundColor: '#f0f9f4',
    borderRadius: 10,
    padding: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#c6f6d5',
  },
  noteText: {
    marginLeft: 12,
    flex: 1,
    fontSize: 13,
    color: '#2d7a4a',
    lineHeight: 18,
  },

  // Button Container
  buttonContainer: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    gap: 12,
  },
  button: {
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  primaryBtn: {
    backgroundColor: '#a81d1d',
  },
  primaryBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
  secondaryBtn: {
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  secondaryBtnText: {
    color: '#333',
    fontWeight: '700',
    fontSize: 16,
  },
});
