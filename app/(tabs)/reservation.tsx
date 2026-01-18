import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, Image, TouchableOpacity, StyleSheet, RefreshControl, Alert, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../supabaseClient';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';

interface ReservationItem {
  id: string;
  product_id: string;
  quantity: number;
  price: number;
  total_amount: number;
  status: string;
  order_status?: string;
  created_at: string;
  updated_at: string;
  address?: string;
  branch?: string;
  notes?: string;
  admin_notes?: string;
  product?: {
    name: string;
    image1?: string;
    category?: string;
    material?: string;
  };
}

export default function ReservationScreen() {
  const [reservations, setReservations] = useState<ReservationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const router = useRouter();

  useEffect(() => {
    loadReservations();
  }, []);

  const loadReservations = async () => {
    try {
      setLoading(true);
      const { data: authData } = await supabase.auth.getUser();
      if (!authData?.user) {
        Alert.alert('Login Required', 'Please login to view your reservations.');
        router.replace('/login');
        return;
      }

      // Fetch reservations (items that are paid but pending admin approval)
      const { data, error } = await supabase
        .from('user_items')
        .select(`
          *,
          product:products (
            name,
            image1,
            category,
            material
          )
        `)
        .eq('user_id', authData.user.id)
        .eq('item_type', 'reservation')
        .order('created_at', { ascending: false });

      if (error) throw error;

      setReservations(data || []);
    } catch (error: any) {
      console.error('Failed to load reservations:', error);
      Alert.alert('Error', 'Failed to load reservations. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadReservations();
  };

  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'pending':
      case 'pending_approval':
        return '#f59e0b'; // orange
      case 'approved':
      case 'accepted':
        return '#10b981'; // green
      case 'rejected':
      case 'cancelled':
        return '#ef4444'; // red
      case 'processing':
        return '#3b82f6'; // blue
      default:
        return '#6b7280'; // gray
    }
  };

  const getStatusText = (status?: string) => {
    switch (status) {
      case 'pending':
      case 'pending_approval':
        return 'Pending Approval';
      case 'approved':
      case 'accepted':
        return 'Approved';
      case 'rejected':
        return 'Rejected';
      case 'cancelled':
        return 'Cancelled';
      case 'processing':
        return 'Processing';
      default:
        return status || 'Pending';
    }
  };

  const formatCurrency = (amount?: number | null) => {
    const value = typeof amount === 'number' && isFinite(amount) ? amount : Number(amount ?? 0) || 0;
    try {
      return `₱${value.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    } catch {
      return '₱0.00';
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-PH', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handleCancelReservation = (reservationId: string) => {
    Alert.alert(
      'Cancel Reservation',
      'Are you sure you want to cancel this reservation? This cannot be undone.',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Yes, Cancel',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('user_items')
                .update({ 
                  status: 'cancelled',
                  order_status: 'cancelled',
                  updated_at: new Date().toISOString()
                })
                .eq('id', reservationId);

              if (error) throw error;

              Alert.alert('Success', 'Reservation cancelled successfully.');
              loadReservations();
            } catch (error: any) {
              console.error('Failed to cancel reservation:', error);
              Alert.alert('Error', 'Failed to cancel reservation. Please try again.');
            }
          }
        }
      ]
    );
  };

  const renderReservationCard = (item: ReservationItem) => {
    const productName = item.product?.name || 'Product';
    const productImage = item.product?.image1;
    const status = item.order_status || item.status;
    const isPending = status === 'pending' || status === 'pending_approval' || status === 'active';
    const isRejected = status === 'rejected';
    const isApproved = status === 'approved' || status === 'accepted';

    return (
      <View key={item.id} style={styles.reservationCard}>
        <View style={styles.cardHeader}>
          <View style={styles.statusBadgeContainer}>
            <View style={[styles.statusBadge, { backgroundColor: getStatusColor(status) }]}>
              <Text style={styles.statusText}>{getStatusText(status)}</Text>
            </View>
          </View>
          <Text style={styles.dateText}>{formatDate(item.created_at)}</Text>
        </View>

        <View style={styles.cardContent}>
          {productImage && (
            <Image 
              source={{ uri: productImage }} 
              style={styles.productImage}
              resizeMode="cover"
            />
          )}
          <View style={styles.productInfo}>
            <Text style={styles.productName} numberOfLines={2}>{productName}</Text>
            {item.product?.category && (
              <Text style={styles.productDetail}>Category: {item.product.category}</Text>
            )}
            {item.product?.material && (
              <Text style={styles.productDetail}>Material: {item.product.material}</Text>
            )}
            <Text style={styles.quantityText}>Qty: {item.quantity}</Text>
            <Text style={styles.priceText}>{formatCurrency(item.total_amount ?? item.price)}</Text>
          </View>
        </View>

        {item.branch && (
          <View style={styles.infoRow}>
            <Ionicons name="location" size={16} color="#666" />
            <Text style={styles.infoText}>Branch: {item.branch}</Text>
          </View>
        )}

        {item.address && (
          <View style={styles.infoRow}>
            <Ionicons name="home" size={16} color="#666" />
            <Text style={styles.infoText} numberOfLines={2}>{item.address}</Text>
          </View>
        )}

        {item.notes && (
          <View style={styles.infoRow}>
            <Ionicons name="document-text" size={16} color="#666" />
            <Text style={styles.infoText}>Note: {item.notes}</Text>
          </View>
        )}

        {item.admin_notes && (
          <View style={[styles.infoRow, styles.adminNotesRow]}>
            <MaterialIcons name="admin-panel-settings" size={16} color="#a81d1d" />
            <Text style={[styles.infoText, styles.adminNotesText]}>Admin: {item.admin_notes}</Text>
          </View>
        )}

        <View style={styles.cardActions}>
          {isPending && (
            <TouchableOpacity 
              style={[styles.actionButton, styles.cancelButton]}
              onPress={() => handleCancelReservation(item.id)}
            >
              <Text style={styles.cancelButtonText}>Cancel Reservation</Text>
            </TouchableOpacity>
          )}
          {isRejected && (
            <TouchableOpacity 
              style={[styles.actionButton, styles.reorderButton]}
              onPress={() => Alert.alert('Order Again', 'Add this item back to cart? (Feature coming soon)')}
            >
              <Text style={styles.reorderButtonText}>Order Again</Text>
            </TouchableOpacity>
          )}
          {isApproved && (
            <View style={styles.approvedMessage}>
              <Ionicons name="checkmark-circle" size={20} color="#10b981" />
              <Text style={styles.approvedText}>Approved! You can now proceed with full payment.</Text>
            </View>
          )}
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Reservations</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading && !refreshing ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#a81d1d" />
          <Text style={styles.loadingText}>Loading reservations...</Text>
        </View>
      ) : reservations.length === 0 ? (
        <ScrollView
          contentContainerStyle={styles.emptyContainer}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#a81d1d']} />}
        >
          <MaterialIcons name="event-note" size={80} color="#ccc" />
          <Text style={styles.emptyTitle}>No Reservations Yet</Text>
          <Text style={styles.emptyText}>
            After paying the reservation fee, your items will appear here pending admin approval.
          </Text>
          <TouchableOpacity style={styles.shopButton} onPress={() => router.push('../shop')}>
            <Text style={styles.shopButtonText}>Start Shopping</Text>
          </TouchableOpacity>
        </ScrollView>
      ) : (
        <ScrollView
          style={styles.scrollView}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#a81d1d']} />}
        >
          <View style={styles.listContainer}>
            <Text style={styles.subtitle}>
              {reservations.length} reservation{reservations.length !== 1 ? 's' : ''}
            </Text>
            {reservations.map(renderReservationCard)}
          </View>
        </ScrollView>
      )}

      {/* Info Banner */}
      {reservations.length > 0 && (
        <View style={styles.infoBanner}>
          <Ionicons name="information-circle" size={20} color="#3b82f6" />
          <Text style={styles.infoBannerText}>
            Reservations are pending admin approval. You&apos;ll be notified once approved.
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#a81d1d',
    paddingTop: 48,
    paddingBottom: 16,
    paddingHorizontal: 16,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#fff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 15,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },
  shopButton: {
    backgroundColor: '#a81d1d',
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 8,
  },
  shopButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  scrollView: {
    flex: 1,
  },
  listContainer: {
    padding: 16,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 12,
  },
  reservationCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  statusBadgeContainer: {
    flex: 1,
  },
  statusBadge: {
    alignSelf: 'flex-start',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  statusText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  dateText: {
    fontSize: 12,
    color: '#999',
  },
  cardContent: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  productImage: {
    width: 80,
    height: 80,
    borderRadius: 8,
    backgroundColor: '#eee',
  },
  productInfo: {
    flex: 1,
    marginLeft: 12,
  },
  productName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#222',
    marginBottom: 4,
  },
  productDetail: {
    fontSize: 13,
    color: '#666',
    marginBottom: 2,
  },
  quantityText: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  priceText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#a81d1d',
    marginTop: 4,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    paddingLeft: 4,
  },
  infoText: {
    fontSize: 13,
    color: '#666',
    marginLeft: 8,
    flex: 1,
  },
  adminNotesRow: {
    backgroundColor: '#fef2f2',
    padding: 8,
    borderRadius: 6,
    marginTop: 4,
  },
  adminNotesText: {
    color: '#a81d1d',
    fontWeight: '600',
  },
  cardActions: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  actionButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#fee',
    borderWidth: 1,
    borderColor: '#ef4444',
  },
  cancelButtonText: {
    color: '#ef4444',
    fontSize: 14,
    fontWeight: 'bold',
  },
  reorderButton: {
    backgroundColor: '#a81d1d',
  },
  reorderButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  approvedMessage: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0fdf4',
    padding: 10,
    borderRadius: 8,
  },
  approvedText: {
    color: '#10b981',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
    flex: 1,
  },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#eff6ff',
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: '#dbeafe',
  },
  infoBannerText: {
    flex: 1,
    fontSize: 13,
    color: '#3b82f6',
    marginLeft: 8,
    lineHeight: 18,
  },
});
