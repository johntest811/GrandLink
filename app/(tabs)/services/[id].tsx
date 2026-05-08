import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Image,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { FontAwesome5, Ionicons } from '@expo/vector-icons';
import BottomNavBar from '@/components/BottomNav';
import { useAppContext } from '@/context/AppContext';
import { supabase } from '../../supabaseClient';

type ServiceRow = {
  id: number;
  name: string;
  short_description: string | null;
  long_description: string | null;
  icon: string | null;
  icon_url: string | null;
};

const FALLBACK_ICON = 'cogs';

const toFontAwesomeName = (iconName?: string | null) => {
  if (!iconName) return FALLBACK_ICON;

  let normalized = iconName.trim();
  if (!normalized) return FALLBACK_ICON;

  if (normalized.startsWith('Fa') && normalized.length > 2) {
    normalized = normalized.slice(2);
  }

  normalized = normalized
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/_/g, '-')
    .toLowerCase();

  return normalized || FALLBACK_ICON;
};

export default function ServiceDetailScreen() {
  const { darkMode } = useAppContext();
  const router = useRouter();
  const params = useLocalSearchParams();

  const idParam = Array.isArray(params.id) ? params.id[0] : params.id;
  const serviceId = Number(idParam);

  const [service, setService] = useState<ServiceRow | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchService = async () => {
      if (!Number.isFinite(serviceId)) {
        setService(null);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const { data, error } = await supabase
          .from('services')
          .select('id, name, short_description, long_description, icon, icon_url')
          .eq('id', serviceId)
          .maybeSingle();

        if (error) throw error;
        setService((data as ServiceRow) || null);
      } catch (err) {
        console.error('Failed to load service details:', err);
        setService(null);
      } finally {
        setLoading(false);
      }
    };

    fetchService();
  }, [serviceId]);

  const description = useMemo(() => {
    const shortText = String(service?.short_description || '').trim();
    const longText = String(service?.long_description || '').trim();

    if (shortText && longText) {
      if (longText.toLowerCase().startsWith(shortText.toLowerCase())) {
        return longText;
      }
      return `${shortText}\n\n${longText}`;
    }
    return longText || shortText;
  }, [service]);

  if (loading) {
    return (
      <View style={[styles.screen, { backgroundColor: darkMode ? '#101010' : '#fff' }]}>
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color="#e63946" />
          <Text style={[styles.loadingText, { color: darkMode ? '#b8b8b8' : '#666' }]}>Loading service...</Text>
        </View>
        <BottomNavBar />
      </View>
    );
  }

  if (!service) {
    return (
      <View style={[styles.screen, { backgroundColor: darkMode ? '#101010' : '#fff' }]}>
        <View style={styles.loadingWrap}>
          <Text style={{ color: darkMode ? '#d0d0d0' : '#222', fontSize: 16, marginBottom: 12 }}>Service not found.</Text>
          <TouchableOpacity style={styles.inquiryButton} onPress={() => router.back()}>
            <Text style={styles.inquiryButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
        <BottomNavBar />
      </View>
    );
  }

  return (
    <View style={[styles.screen, { backgroundColor: darkMode ? '#101010' : '#fff' }]}>
      <ScrollView contentContainerStyle={{ paddingBottom: 120 }}>
        <View style={styles.heroSection}>
          <Image source={require('@/assets/images/homeimage1.png')} style={styles.heroImage} resizeMode="cover" />
          <View style={styles.overlay}>
            <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
              <Ionicons name="arrow-back" size={20} color="#fff" />
              <Text style={styles.backBtnText}>Back</Text>
            </TouchableOpacity>

            <View style={styles.heroIconWrap}>
              {service.icon_url ? (
                <Image source={{ uri: service.icon_url }} style={styles.remoteIcon} resizeMode="contain" />
              ) : (
                <FontAwesome5
                  name={toFontAwesomeName(service.icon) as any}
                  size={26}
                  color="#fff"
                  solid
                />
              )}
            </View>

            <Text style={styles.heroTitle}>{service.name}</Text>
            <View style={styles.redLine} />
          </View>
        </View>

        <View style={styles.descriptionContainer}>
          <Text style={[styles.description, { color: darkMode ? '#d0d0d0' : '#111' }]}>
            {description || 'No service description available yet.'}
          </Text>
        </View>

        <View style={[styles.inquirySection, { backgroundColor: darkMode ? '#1a1a1a' : '#f5f5f5' }]}>
          <Text style={styles.inquiryHeading}>Ready to elevate your space?</Text>
          <Text style={[styles.inquirySubText, { color: darkMode ? '#c0c0c0' : '#444' }]}>Inquire now for a custom solution!</Text>
          <TouchableOpacity style={styles.inquiryButton} onPress={() => router.push('/(tabs)/inquire')}>
            <Text style={styles.inquiryButtonText}>INQUIRE NOW</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <BottomNavBar />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  loadingWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
  },
  heroSection: {
    position: 'relative',
    height: 245,
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  overlay: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 18,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(0,0,0,0.35)',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: 14,
  },
  backBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
    marginLeft: 6,
  },
  heroIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  remoteIcon: {
    width: 26,
    height: 26,
  },
  heroTitle: {
    fontSize: 31,
    fontWeight: '800',
    color: '#fff',
  },
  redLine: {
    width: 88,
    height: 4,
    backgroundColor: '#e63946',
    marginTop: 5,
    borderRadius: 3,
  },
  descriptionContainer: {
    paddingHorizontal: 18,
    paddingTop: 18,
  },
  description: {
    fontSize: 21,
    lineHeight: 32,
    textAlign: 'left',
    fontWeight: '500',
  },
  inquirySection: {
    marginHorizontal: 14,
    marginTop: 20,
    borderRadius: 12,
    paddingVertical: 24,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  inquiryHeading: {
    fontSize: 18,
    fontWeight: '800',
    color: '#b71c1c',
    textAlign: 'center',
    marginBottom: 6,
  },
  inquirySubText: {
    fontSize: 15,
    marginBottom: 14,
    textAlign: 'center',
  },
  inquiryButton: {
    backgroundColor: '#b71c1c',
    borderRadius: 8,
    paddingHorizontal: 28,
    paddingVertical: 12,
  },
  inquiryButtonText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 14,
  },
});
