import { ThemedText } from '@/components/ThemedText';
import React, { useState, useEffect, useRef } from 'react';
import { View, Image, StyleSheet, TouchableOpacity, Text, ScrollView, Dimensions, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../supabaseClient'; 
import BottomNavBar from "@BottomNav/../components/BottomNav";
import { useAppContext } from "@/context/AppContext";
import TopBar from '@/components/TopBar';
import Constants from 'expo-constants';
import YoutubePlayer from 'react-native-youtube-iframe';

type HomeContent = {
  carousel?: {
    image?: string;
    image_url?: string;
    youtube_url?: string;
    title?: string;
    buttonText?: string;
    buttonLink?: string;
    link_url?: string;
  }[];
  featured_projects?: {
    image?: string;
    image_url?: string;
    youtube_url?: string;
    title?: string;
    description?: string;
    link_url?: string;
  }[];
  services?: {
    title?: string;
    description?: string;
    images?: string[];
  };
  about?: {
    logo?: string;
    title?: string;
    description?: string;
  };
  explore?: any[];
  [k: string]: any;
};

const SINGLETON_ID = '00000000-0000-0000-0000-000000000000';

const fallbackLocalCarouselImages = [
  require('@/assets/images/homeimage1.png'),
  require('@/assets/images/homeimage2.png'),
  require('@/assets/images/homeimage3.png'),
  require('@/assets/images/homeimage4.png'),
  require('@/assets/images/homeimage5.png'),
];

const QUALITY_MESSAGES = [
  'High Quality, Long Lasting Performance',
  'Expert Craftsmanship',
  'Modern Design',
  'Trusted by Professionals',
  'Innovative Solutions',
];

const SCREEN_WIDTH = Dimensions.get('window').width;

const SUPABASE_URL =
  (Constants.expoConfig?.extra as any)?.supabaseUrl ||
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  '';

const BASE_URL =
  (Constants.expoConfig?.extra as any)?.baseUrl ||
  process.env.NEXT_PUBLIC_BASE_URL ||
  '';

function encodeStoragePath(path: string) {
  return path
    .split('/')
    .filter(Boolean)
    .map((seg) => encodeURIComponent(seg))
    .join('/');
}

function resolveImageUrl(val?: string) {
  if (!val) return '';
  const v = String(val).trim();
  if (!v) return '';
  if (v.startsWith('http://') || v.startsWith('https://')) return v;

  // If it's a website public path ("/something"), try baseUrl first.
  if (v.startsWith('/') && BASE_URL) {
    return `${String(BASE_URL).replace(/\/$/, '')}${v}`;
  }

  // Otherwise treat it as a Supabase Storage key under `uploads`.
  const base = String(SUPABASE_URL || '').replace(/\/$/, '');
  const cleaned = v.replace(/^\/+/, '');
  if (!base) return cleaned;
  return `${base}/storage/v1/object/public/uploads/${encodeStoragePath(cleaned)}`;
}

function getYoutubeEmbedUrl(url?: string) {
  if (!url) return '';
  const raw = String(url).trim();
  if (!raw) return '';
  try {
    // Accept plain IDs too
    if (/^[a-zA-Z0-9_-]{11}$/.test(raw)) {
      return raw;
    }

    const u = new URL(raw);
    let id = '';
    if (u.hostname.includes('youtu.be')) {
      id = u.pathname.replace('/', '');
    } else if (u.pathname.startsWith('/shorts/')) {
      id = u.pathname.split('/shorts/')[1]?.split(/[?/]/)[0] ?? '';
    } else {
      id = u.searchParams.get('v') || '';
      if (!id && u.pathname.startsWith('/embed/')) {
        id = u.pathname.split('/embed/')[1]?.split(/[?/]/)[0] ?? '';
      }
    }
    if (!id) return '';
    return id;
  } catch {
    return '';
  }
}

function YouTubePlayer({ youtubeUrl, height }: { youtubeUrl: string; height: number }) {
  const videoId = getYoutubeEmbedUrl(youtubeUrl);
  if (!videoId) return null;

  return (
    <View style={{ width: '100%', height, backgroundColor: 'black' }}>
      <YoutubePlayer
        height={height}
        play={false}
        videoId={videoId}
        initialPlayerParams={{
          controls: true,
          modestbranding: true,
          rel: false,
          playsinline: true,
        }}
        webViewProps={{
          // These help on Android devices where YouTube is picky.
          originWhitelist: ['*'],
          javaScriptEnabled: true,
          domStorageEnabled: true,
          mediaPlaybackRequiresUserAction: false,
          allowsFullscreenVideo: true,
          thirdPartyCookiesEnabled: true,
          sharedCookiesEnabled: true,
          userAgent:
            'Mozilla/5.0 (Linux; Android 13; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
        }}
      />
    </View>
  );
}

function QualityWheel() {
  const scrollViewRef = useRef<ScrollView>(null);

  // Duplicate the array to create an infinite loop effect
  const wheelData = [...QUALITY_MESSAGES, ...QUALITY_MESSAGES];

  useEffect(() => {
    let position = 0;
    const interval = setInterval(() => {
      position += 1;
      if (position >= QUALITY_MESSAGES.length) {
        // Instantly reset to start for seamless loop
        position = 0;
        scrollViewRef.current?.scrollTo({ x: 0, animated: false });
      } else {
        scrollViewRef.current?.scrollTo({ x: position * (SCREEN_WIDTH * 0.7), animated: true });
      }
    }, 2000); // Change every 2 seconds

    return () => clearInterval(interval);
  }, []);

  return (
    <View style={styles.qualityWheelContainer}>
      <ScrollView
        ref={scrollViewRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        scrollEnabled={false}
        style={{ flexGrow: 0 }}
      >
        {wheelData.map((msg, idx) => (
          <View key={idx} style={styles.qualityWheelItem}>
            <View style={styles.qualityDot} />
            <Text style={styles.qualityText}>{msg}</Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

export default function Homescreen() {  
    const [index, setIndex] = useState(0);
    const [homeContent, setHomeContent] = useState<HomeContent | null>(null);
    const [homeLoading, setHomeLoading] = useState(true);
    const [newestProducts, setNewestProducts] = useState<any[]>([]);
    const router = useRouter();
    const { darkMode } = useAppContext();

  const carouselItems = (homeContent?.carousel && Array.isArray(homeContent.carousel) && homeContent.carousel.length)
    ? homeContent.carousel
    : [];

  const hasRemoteCarousel = carouselItems.length > 0;

  const carouselLength = hasRemoteCarousel ? carouselItems.length : fallbackLocalCarouselImages.length;

  const nextImage = () => setIndex((prev) => (prev + 1) % Math.max(1, carouselLength));
  const prevImage = () => setIndex((prev) => (prev - 1 + Math.max(1, carouselLength)) % Math.max(1, carouselLength));

  const activeCarouselItem = hasRemoteCarousel ? carouselItems[index] : null;
  const activeIsYoutube = Boolean(activeCarouselItem?.youtube_url);

  const activeCarouselImageUrl = hasRemoteCarousel
    ? resolveImageUrl(activeCarouselItem?.image_url || activeCarouselItem?.image || '')
    : '';

  useEffect(() => {
  const getUser = async () => {
    await supabase.auth.getUser();
  };
  getUser();
}, []);

  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      try {
        setHomeLoading(true);

        // Load homepage content
        const attemptSingleton = await supabase
          .from('home_content')
          .select('content, updated_at')
          .eq('id', SINGLETON_ID)
          .maybeSingle();

        let contentRow = attemptSingleton.data;

        if (!contentRow) {
          const latest = await supabase
            .from('home_content')
            .select('content, updated_at')
            .order('updated_at', { ascending: false })
            .limit(1)
            .maybeSingle();
          contentRow = latest.data;
        }

        const contentObj = (contentRow?.content ?? null) as HomeContent | null;
        if (isMounted) setHomeContent(contentObj);

        // Load newest products
        const newest = await supabase
          .from('products')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(6);
        if (isMounted) setNewestProducts(newest.data || []);

      } finally {
        if (isMounted) setHomeLoading(false);
      }
    };
    load();
    return () => {
      isMounted = false;
    };
  }, []);

  // If carousel length changes (e.g. after fetch), keep index in range.
  useEffect(() => {
    setIndex((prev) => {
      const len = Math.max(1, carouselLength);
      return prev % len;
    });
  }, [carouselLength]);

  useEffect(() => {
    // Match website behavior: pause autoplay on YouTube slides.
    if (carouselLength <= 1) return;
    if (activeIsYoutube) return;

    const timer = setInterval(() => {
      setIndex((prev) => (prev + 1) % Math.max(1, carouselLength));
    }, 5000);
    return () => clearInterval(timer);
  }, [carouselLength, activeIsYoutube]);

  return (
  <View style={[styles.whitebackground, darkMode && { backgroundColor: '#0d1117' }]}>
    <TopBar />
    <View style={{ flex: 1 }}>
      <ScrollView style={{ flex: 1 }}>

        <View style={styles.blueBox}>
          <TouchableOpacity onPress={prevImage} style={styles.arrow}>
            <Image source={require('@/assets/images/left-arrow.png')} style={styles.arrowIcon} />
          </TouchableOpacity>

          {hasRemoteCarousel ? (
            activeCarouselItem?.youtube_url ? (
              <YouTubePlayer youtubeUrl={activeCarouselItem.youtube_url} height={220} />
            ) : (
              activeCarouselImageUrl ? (
                <Image
                  source={{ uri: activeCarouselImageUrl }}
                  style={styles.slideshowImage}
                  resizeMode="cover"
                />
              ) : (
                <Image
                  source={fallbackLocalCarouselImages[index % fallbackLocalCarouselImages.length]}
                  style={styles.slideshowImage}
                  resizeMode="cover"
                />
              )
            )
          ) : (
            <Image
              source={fallbackLocalCarouselImages[index]}
              style={styles.slideshowImage}
              resizeMode="cover"
            />
          )}

          <TouchableOpacity onPress={nextImage} style={styles.arrow}>
            <Image source={require('@/assets/images/right-arrow.png')} style={styles.arrowIcon} />
          </TouchableOpacity>
          {/* Dots overlay */}
          <View style={styles.dotOverlay}>
            {Array.from({ length: carouselLength }).map((_, i) => (
              <View
                key={i}
                style={[
                  styles.dot,
                  i === index && styles.activeDot
                ]}
              />
            ))}
          </View>
        </View>
        <View style={styles.qualityWheelFullBlue}>
          <QualityWheel />
        </View>

        {/* Newest products (requested: directly below carousel) */}
        <View style={[styles.newestSection, darkMode && { backgroundColor: '#161b22' }]}>
          <View style={styles.newestHeaderRow}>
            <Text style={[styles.newestTitle, darkMode && { color: '#e6e6e6' }]}>Newest Products</Text>
            <TouchableOpacity onPress={() => router.push('../shop')}>
              <Text style={styles.newestViewAll}>View All</Text>
            </TouchableOpacity>
          </View>

          {homeLoading ? (
            <View style={{ paddingVertical: 12 }}>
              <ActivityIndicator />
            </View>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.newestRow}>
              {newestProducts.map((product) => (
                <TouchableOpacity
                  key={product.id}
                  style={styles.newestCard}
                  activeOpacity={0.85}
                  onPress={() => router.push({ pathname: '/(tabs)/product', params: { id: product.id } })}
                >
                  <Image
                    source={product.image1 ? { uri: product.image1 } : require('@/assets/images/placeholder.png')}
                    style={styles.newestImage}
                    resizeMode="cover"
                  />
                  <Text numberOfLines={2} style={[styles.newestName, darkMode && { color: '#e6e6e6' }]}>
                    {product.name}
                  </Text>
                  {typeof product.price !== 'undefined' && product.price !== null ? (
                    <Text style={styles.newestPrice}>₱{product.price}</Text>
                  ) : null}
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
        </View>

        <TouchableOpacity style={styles.imageButton} onPress={() => router.push({ pathname: '../shop', params: { filter: 'Doors' } })}>
          <Image
            source={require('@/assets/images/DoorsButton.png')}
            style={styles.imageButtonImage}
            resizeMode="cover"
          />
          <View style={styles.imageButtonOverlay}>
            <Text style={styles.imageButtonTitle}>Doors</Text>
            <View style={styles.imageButtonBox}>
              <Text style={styles.imageButtonText}>View More Products</Text>
            </View>
          </View>
        </TouchableOpacity>

        <TouchableOpacity style={styles.imageButton} onPress={() => router.push({ pathname: '../shop', params: { filter: 'Rails' } })}>
          <Image
            source={require('@/assets/images/railingsbutton.png')}
            style={styles.imageButtonImage}
            resizeMode="cover"
          />
          <View style={styles.imageButtonOverlay}>
            <Text style={styles.imageButtonTitle}>Railings</Text>
            <View style={styles.imageButtonBox}>
              <Text style={styles.imageButtonText}>View More Products</Text>
            </View>
          </View>
        </TouchableOpacity>

        <TouchableOpacity style={styles.imageButton} onPress={() => router.push({ pathname: '../shop', params: { filter: 'Enclosure' } })}>
          <Image
            source={require('@/assets/images/enclosuresbutton.png')}
            style={styles.imageButtonImage}
            resizeMode="cover"
          />
          <View style={styles.imageButtonOverlay}>
            <Text style={styles.imageButtonTitle}>Enclosures</Text>
            <View style={styles.imageButtonBox}>
              <Text style={styles.imageButtonText}>View More Products</Text>
            </View>
          </View>
        </TouchableOpacity>

        <TouchableOpacity style={styles.imageButton} onPress={() => router.push({ pathname: '../shop', params: { filter: 'Windows' } })}>
          <Image
            source={require('@/assets/images/windowsbutton.png')}
            style={styles.imageButtonImage}
            resizeMode="cover"
          />
          <View style={styles.imageButtonOverlay}>
            <Text style={styles.imageButtonTitle}>Windows</Text>
            <View style={styles.imageButtonBox}>
              <Text style={styles.imageButtonText}>View More Products</Text>
            </View>
          </View>
        </TouchableOpacity>
        
        <View style={[styles.blueBoxB, darkMode && { backgroundColor: '#161b22' }]}>

          <View style={{ flexDirection: "row", paddingLeft: 10, paddingTop: 20, alignItems: "center" }}>
            <Text style={styles.featuredText}>Featured Projects</Text>
            <TouchableOpacity
              style={styles.viewMoreProjectButton}
              onPress={() => router.push('../shop')}
            >
              <Text style={styles.viewMoreProjectButtonText}>View More Projects</Text>
            </TouchableOpacity>
          </View>
          {(homeContent?.featured_projects && Array.isArray(homeContent.featured_projects) && homeContent.featured_projects.length)
            ? homeContent.featured_projects.map((proj, projIdx) => {
                const title = proj?.title || '';
                const description = proj?.description || '';
                const imageUrl = resolveImageUrl(proj?.image_url || proj?.image || '');
                const youtubeUrl = proj?.youtube_url || '';

                return (
                  <View key={`${projIdx}-${title}`} style={{ width: '100%' }}>
                    {youtubeUrl ? (
                      <View style={{ width: '95%', alignSelf: 'center', marginVertical: 15, borderRadius: 12, overflow: 'hidden' }}>
                        <YouTubePlayer youtubeUrl={youtubeUrl} height={200} />
                      </View>
                    ) : imageUrl ? (
                      <Image
                        source={{ uri: imageUrl }}
                        style={{ width: '95%', height: 200, alignSelf: 'center', marginVertical: 15, borderRadius: 12, backgroundColor: 'black' }}
                        resizeMode="cover"
                      />
                    ) : null}

                    {title ? (
                      <ThemedText style={{ color: 'white', fontSize: 18, fontWeight: 'bold', textAlign: 'left', marginBottom: 4 }}>
                        {title}
                      </ThemedText>
                    ) : null}
                    {description ? (
                      <ThemedText style={{ color: 'white', fontSize: 10, textAlign: 'left', marginBottom: 8 }}>
                        {description}
                      </ThemedText>
                    ) : null}
                  </View>
                );
              })
            : (
              <ThemedText style={{ color: 'white', fontSize: 12, textAlign: 'center', marginVertical: 16 }}>
                No featured projects available.
              </ThemedText>
            )}
        </View>

         <View style={styles.serviceContainer}>
            <ThemedText style={styles.sectionTitle}>{homeContent?.services?.title || 'Service We Offer'}</ThemedText>
            <ThemedText style={styles.serviceText}>
              {homeContent?.services?.description ||
                'Grand East brings you top-tier aluminum and glass solutions, expertly\ncrafted for both residential and commercial spaces. From sleek\nwindows and doors to stunning facades, our services are designed to enhance\nboth style and durability. Elevate your property with the perfect blend of\ninnovation and elegance.'}
            </ThemedText>
            <View style={styles.redLineA} />
      </View>

      <View style={[styles.blueBoxB, darkMode && { backgroundColor: '#161b22' }]}>

        <View style={styles.logoTitleB}>
              {homeContent?.about?.logo ? (
                <Image
                  source={{ uri: resolveImageUrl(homeContent.about.logo) }}
                  style={styles.logo}
                  resizeMode="contain"
                />
              ) : (
                <Image
                  source={require('@/assets/images/GRANDEASTLOGO.png')}
                  style={styles.logo}
                  resizeMode="contain"
                />
              )}
          </View>
          <ThemedText style={styles.sectionTitleB}>ABOUT</ThemedText>
          <ThemedText style={styles.sectionTitleB}>{homeContent?.about?.title || 'GRAND EAST'}</ThemedText>
          <View style={styles.redLine} />
          <ThemedText style={styles.aboutGrandEast}>
            {homeContent?.about?.description ||
              'At Grand East, we specialize in creating modern, durable,\nand stylish solutions that redefine residential and\ncommercial spaces. With a passion for precision and a\ncommitment to quality, our expert team delivers exceptional\naluminum and glass installations that stand the test of time.\nWhether you\'re upgrading your home or transforming your business,\nwe provide innovative designs that combine functionality with\naesthetic appeal, ensuring your vision becomes a reality.'}
          </ThemedText>

            <View style={{ position: 'relative', width: 500, height: 200, marginTop: 20, marginBottom: 120, }}>
              <Image
                source={require('@/assets/images/inquireNOW.png')}
                style={styles.inquireNOW}
                resizeMode="contain"
              />
              <View style={{
                position: 'absolute',
                top: 30,
                left: 0,
                width: '100%',
                alignItems: 'center',
              }}>
                <Text style={{ color: '#a81d1d', fontSize: 24, fontWeight: 'bold', textAlign: 'center' }}>
                  Ready to elevate your space?
                </Text>
                <Text style={{ color: '#fff', fontSize: 18, fontStyle: 'italic', textAlign: 'center', marginTop: 2 }}>
                  Inquire now for a custom solution!
                </Text>
                <TouchableOpacity
                  style={{
                    backgroundColor: '#a81d1d',
                    borderRadius: 4,
                    paddingVertical: 12,
                    paddingHorizontal: 32,
                    marginTop: 24,
                    flexDirection: 'row',
                    alignItems: 'center',
                  }}
                  onPress={() => {
                    // TODO: Add your action here (e.g., navigation or modal)
                    alert('Inquire Now button pressed!');
                  }}
                >
                  <Text style={{ color: '#fff', fontSize: 22, fontWeight: 'bold', marginRight: 10 }}>
                    INQUIRE NOW
                  </Text>
                  <Text style={{ color: '#fff', fontSize: 22 }}>📞</Text>
                </TouchableOpacity>
              </View>
            </View>

          </View>

      </ScrollView>
   <BottomNavBar />
    </View>

    
    </View>
    
    
    
  );
}

const styles = StyleSheet.create({
whitebackground: {
    flex: 1,
    backgroundColor: '#ffffff',
},
  logo: {
    height: 60,
    width: 170,
  },
  blueBox: {
    height: 220,
    backgroundColor: '#1c202a',
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
  },
  blueBoxB: {
       backgroundColor: '#1c202aff',
        width: '100%',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
  },
  serviceContainer: {
    padding: 20,
    backgroundColor: '#fff',
    borderRadius: 14,
    margin: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 27,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
    color: '#a81d1dff',
  },
  aboutGrandEast: {
    fontSize: 18,
    lineHeight: 20,
    color: '#ffffffff',
    textAlign: 'left',
    marginTop: 20,
  },
  inquireNOW: {
    marginTop: 20,
    height: 200,
    width: 500,
  },
  redLine: {
    width: 120, 
    height: 7,
    backgroundColor: '#a02c2cff', 
    marginTop: 8,
    marginBottom: 5,
    textAlign: 'left',
    alignSelf: 'flex-start',
  },
  redLineA: {
    width: 120, 
    height: 7,
    backgroundColor: '#a02c2cff', 
    marginTop: 20,
    textAlign: 'right',
    alignSelf: 'flex-end',
  },
  logoTitleB: {
    padding: 3,
    backgroundColor: '#fff',
    borderRadius: 9,
    margin: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitleB: {
    fontSize: 25,
    fontWeight: 'bold',
    marginTop : 6,
    marginBottom: 10,
    textAlign: 'left',
    color: '#ffffffff',
    alignSelf: 'flex-start',
  },
  serviceText: {
    fontSize: 16,
    lineHeight: 18,
    fontWeight: 'bold',
    textAlign: 'center',
    color: '#3a3a3aff',
  },
  arrow: {
    padding: 10,
  },
  arrowIcon: {
    width: 30,
    height: 30,
    tintColor: '#fff',
  },
  qualityBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    padding: 10,
    backgroundColor: '#fff',
  },
  qualityDot: {
    width: 16,
    height: 16,
    backgroundColor: '#7b2323',
    marginHorizontal: 8,
    borderRadius: 3,
  },
  qualityText: {
    fontStyle: 'italic',
    fontSize: 10,
    color: '#2d3748',
    marginRight: 16,
  },
  imageButton: {
    marginTop: 7,
    marginHorizontal: 16,
    borderRadius: 10,
    overflow: 'hidden',
    height: 180,
    width: '92%', // Make it responsive and fill most of the width
    alignSelf: 'center',
    marginBottom: 16,
    backgroundColor: '#eee',
  },
  imageButtonB: {
  flex: 1, 
  width: '40%',
  height: 190,
  borderRadius: 5,
  overflow: 'hidden',
},
  imageButtonImageB: {
    width: '100%',
  height: '100%',
  },
  imageButtonImage: {
    width: '100%',
    height: '100%',
    position: 'absolute',
    top: 0,
    left: 0,
  },
  imageButtonOverlay: {
  position: 'absolute',
  top: 0,
  left: 0,
  width: '100%',
  height: '100%',
  justifyContent: 'center', // Center vertically
  alignItems: 'center',     // Center horizontally
  backgroundColor: 'rgba(0, 0, 0, 0.25)',
  paddingHorizontal: 10,
},
imageButtonTitle: {
  color: '#fff',
  fontSize: 26,
  fontWeight: 'bold',
  textAlign: 'center',
  textShadowColor: '#000',
  textShadowOffset: { width: 1, height: 1 },
  textShadowRadius: 4,
  marginBottom: 10,
},
imageButtonBox: {
  borderWidth: 1,
  borderColor: '#fff',
  borderRadius: 2,
  paddingHorizontal: 14,
  paddingVertical: 6,
  backgroundColor: 'rgba(0,0,0,0.3)',
  marginTop: 0,
},
imageButtonText: {
  color: '#fff',
  fontSize: 16,
  fontWeight: '600',
  textAlign: 'center',
},
  redLowerBar: {
    height: '9%',
    width: '100%',
    backgroundColor: '#860e0eff',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',          
    position: 'relative',
},
sideIconsContainer: {
  flex: 1,
  flexDirection: 'row',
  justifyContent: 'space-evenly',
  alignItems: 'center',
},
  sideIconButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
},
  sideIcon: {
    width: 50,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  circleButton: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: -25 }, { translateY: -25 }],
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    zIndex: 1,
},
  catalogIcon: {
    width: 32,
    height: 32,
  },
  slideshowImage: {
    width: '100%',
    height: '100%',
    borderRadius: 0, // Remove borderRadius for full fit
    backgroundColor: '#eee',
    alignSelf: 'center',
  },
featuredText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
},
viewMoreProjectButton: {
  backgroundColor: '#860e0e',
  paddingVertical: 8,
  paddingHorizontal: 16,
  borderRadius: 3,
  marginLeft: 16,
},
viewMoreProjectButtonText: {
  color: '#fff',
  fontWeight: 'bold',
  fontSize: 10,
},
    inquireTitle: {
        color: '#722727ff',
        fontSize: 30, 
        fontWeight: 'bold',
        textAlign: 'center',
        marginTop: 20,
        marginBottom: 10,
        
    },
    inquireSubText: { 
        color: '#2e2e2eff',
        fontSize: 14,
        textAlign: 'center',
        marginTop: 7,
        marginBottom: 20,   
        paddingHorizontal: 20,
    },
    inputLabel: {
    marginBottom: 5,
    fontWeight: '600',
    color: '#080808ff',
    },
    inputWrapper: {
      borderWidth: 1,
      borderColor: '#323232ff',
      borderRadius: 5,
    },
    input: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    fontSize: 13,
    },
  bottomNavBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: '#4f5f8aff',
    height: 70,
    paddingBottom: 8,
    paddingTop: 8,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 10,
  },
  navItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navIcon: {
    width: 45,
    height: 45,
    marginBottom: 2,
  },
  navLabel: {
    fontSize: 11,
    color: '#fff',
    fontWeight: '600',
  },
  fabWrapper: {
    position: 'relative',
    top: -28,
    alignItems: 'center',
    flex: 1,
  },
  fabButton: {
    width: 65,
    height: 65,
    borderRadius: 28,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    borderWidth: 3,
    borderColor: '#4c58c0ff',
  },
  fabIcon: {
    width: 32,
    height: 32,
  },
  qualityWheelContainer: {
    width: '100%',
    height: 40,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    marginBottom: 10,
  },
  qualityWheelItem: {
    flexDirection: 'row',
    alignItems: 'center',
    width: SCREEN_WIDTH * 0.3,
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  dotContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 5,
    marginHorizontal: 4,
    backgroundColor: '#776d6dff',
    opacity: 0.9,
  },
  activeDot: {
    backgroundColor: '#a14535ff',
    opacity: 1,
  },
  dotOverlay: {
    position: 'absolute',
    bottom: 12,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2,
  },
  qualityWheelBlueBox: {
    backgroundColor: '#1c202a',
    borderRadius: 10,
    marginBottom: 16,
    width: 400,
    alignSelf: 'center',
  },
  qualityWheelFullBlue: {
    width: '100%',
    backgroundColor: '#1c2c53ff', // or your preferred blue
    paddingVertical: 10,
    marginBottom: 8,
    alignSelf: 'stretch',
    borderRadius: 0,
  },
  newestSection: {
    marginHorizontal: 12,
    marginTop: 8,
    marginBottom: 12,
    padding: 14,
    backgroundColor: '#fff',
    borderRadius: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  newestHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  newestTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#111',
  },
  newestViewAll: {
    fontSize: 12,
    fontWeight: '700',
    color: '#a81d1d',
  },
  newestRow: {
    paddingRight: 6,
  },
  newestCard: {
    width: 150,
    marginRight: 12,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#f7f7f7',
  },
  newestImage: {
    width: '100%',
    height: 105,
    backgroundColor: '#e9e9e9',
  },
  newestName: {
    paddingHorizontal: 10,
    paddingTop: 8,
    paddingBottom: 2,
    fontSize: 12,
    fontWeight: '800',
    color: '#111',
  },
  newestPrice: {
    paddingHorizontal: 10,
    paddingBottom: 10,
    fontSize: 12,
    fontWeight: '700',
    color: '#a81d1d',
  },
});