import { ThemedText } from '@/components/ThemedText';
import React, { useState, useEffect, useRef } from 'react';
import { View, Image, StyleSheet, TextInput as RNTextInput, TouchableOpacity, Text, ScrollView, Button, Dimensions, Animated, Alert } from 'react-native';
import { Video, ResizeMode } from 'expo-av';
import { router, useRouter } from 'expo-router';
import { supabase } from '../supabaseClient'; 
import { blue } from 'react-native-reanimated/lib/typescript/Colors';

const images = [
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
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const router = useRouter();

  const nextImage = () => setIndex((prev) => (prev + 1) % images.length);
  const prevImage = () => setIndex((prev) => (prev - 1 + images.length) % images.length);

  useEffect(() => {
  const checkUser = async () => {
    const { data } = await supabase.auth.getUser();
    setIsLoggedIn(!!data?.user);
  };
  checkUser();
  
  // Listen for auth changes
  const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
    setIsLoggedIn(!!session);
  });
  
  return () => {
    authListener?.subscription.unsubscribe();
  };
}, []);

  const handleProfilePress = async () => {
    const { data } = await supabase.auth.getUser();
    if (data?.user) {
      router.push('../profile');
    } else {
      Alert.alert(
        'Login Required',
        'Please login to access your profile.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Login', onPress: () => router.push('/login') }
        ]
      );
    }
  };

  useEffect(() => {
    const timer = setInterval(() => {
      setIndex((prev) => (prev + 1) % images.length);
    }, 3000);
    return () => clearInterval(timer);
  }, []);

  return (
    <View style={styles.whitebackground}>
    <View style={{ flex: 1 }}>
      <ScrollView style={{ flex: 1 }}>
        <View style={styles.upperBar}>
          <Image
            source={require('@/assets/images/GRANDEASTLOGO.png')}
            style={styles.logo}
            resizeMode="contain"
          />
          <TouchableOpacity
            style={styles.profileButton}
            onPress={handleProfilePress}
          >
            <Image
              source={require('@/assets/images/profileicon.png')}
              style={styles.profileIcon}
              resizeMode="contain"
            />
          </TouchableOpacity>
        </View>
        <View style={styles.blueBox}>
          <TouchableOpacity onPress={prevImage} style={styles.arrow}>
            <Image source={require('@/assets/images/left-arrow.png')} style={styles.arrowIcon} />
          </TouchableOpacity>
          <Image
            source={images[index]}
            style={styles.slideshowImage}
            resizeMode="cover"
          />
          <TouchableOpacity onPress={nextImage} style={styles.arrow}>
            <Image source={require('@/assets/images/right-arrow.png')} style={styles.arrowIcon} />
          </TouchableOpacity>
          {/* Dots overlay */}
          <View style={styles.dotOverlay}>
            {images.map((_, i) => (
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
        
        <View style={styles.blueBoxB}>
          <View style={{ flexDirection: "row", paddingLeft: 10, paddingTop: 20, alignItems: "center" }}>
            <Text style={styles.featuredText}>Featured Projects</Text>
            <TouchableOpacity
              style={styles.viewMoreProjectButton}
              onPress={() => router.push('../shop')}
            >
              <Text style={styles.viewMoreProjectButtonText}>View More Projects</Text>
            </TouchableOpacity>
          </View>
          <Video
              source={require("@/assets/videos/testvideo.mp4")}
              useNativeControls
              resizeMode={ResizeMode.COVER}
              style={{
                width: "95%",
                height: 200,
                alignSelf: "center",
                marginVertical: 15,
                borderRadius: 12,
                backgroundColor: "black",
              }}
            />
          <ThemedText style={{ color: "white", fontSize: 18, fontWeight: 'bold', textAlign: "center", marginBottom: 4 }}>
            Mikey Bustos ft. Grand East Products
          </ThemedText>
          <ThemedText style={{ color: "white", fontSize: 10, textAlign: "left", marginBottom: 3 }}>
            Join Mikey Bustos on an exciting shopping spree vlog, where he showcases our product as his top choice for stylish
            glass, doors, and windows. Discover his tips and insights as he transform his space with these functional and aesthetic
            upgrades! Credit to: Mikey Bustos.
          </ThemedText>

          <Video
              source={require("../../assets/videos/testvideo.mp4")}
              useNativeControls
              resizeMode={ResizeMode.COVER}
              style={{
                width: "95%",
                height: 200,
                alignSelf: "center",
                marginVertical: 15,
                borderRadius: 12,
                backgroundColor: "black",
              }}
            />

          <ThemedText style={{ color: "white", fontSize: 18, fontWeight: 'bold', textAlign: "center", marginBottom: 4 }}>
            Solenn Heusaff ft. Grand East Products
          </ThemedText>
          <ThemedText style={{ color: "white", fontSize: 10, textAlign: "left", marginBottom: 3 }}>
            Solenn Heusaff invites us into her beautifully curated home, where our products seamlessly blend with her style. 
            Each piece reflects her unique taste and attention to detail, enchancing the warmth and sophistication of her living space. 
            Credit to: Solenn Heusaff.
          </ThemedText>

            <View style={{
                flexDirection: 'row',
                width: '120%',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 10, // Adds a 10px gap between items
                paddingHorizontal: 20,
                paddingBottom: 20,
                paddingTop: 20
              }}>
                <TouchableOpacity style={styles.imageButtonB}>
                  <Image
                    source={require('@/assets/images/featuredprod1.png')}
                    style={styles.imageButtonImageB}
                    resizeMode="cover"
                  />
                </TouchableOpacity>
                <TouchableOpacity style={styles.imageButtonB}>
                  <Image
                    source={require('@/assets/images/featuredprod2.png')}
                    style={styles.imageButtonImageB}
                    resizeMode="cover"
                  />
                </TouchableOpacity>
                <TouchableOpacity style={styles.imageButtonB}>
                  <Image
                    source={require('@/assets/images/featuredprod3.png')}
                    style={styles.imageButtonImageB}
                    resizeMode="cover"
                  />
                </TouchableOpacity>
              </View>
        </View>

         <View style={styles.serviceContainer}>
            <ThemedText style={styles.sectionTitle}>Service We Offer</ThemedText>
            <ThemedText style={styles.serviceText}>
              Grand East brings you top-tier aluminum and glass solutions, expertly
              crafted for both residential and commercial spaces. From sleek
              windows and doors to stunning facades, our services are designed to enhance
              both style and durability. Elevate your property with the perfect blend of
              innovation and elegance.
            </ThemedText>
            <View style={styles.redLineA} />
      </View>

      <View style={styles.blueBoxB}>
        <View style={styles.logoTitleB}>
              <Image
            source={require('@/assets/images/GRANDEASTLOGO.png')}
            style={styles.logo}
            resizeMode="contain"
          />
          </View>
          <ThemedText style={styles.sectionTitleB}>ABOUT</ThemedText>
          <ThemedText style={styles.sectionTitleB}>GRAND EAST</ThemedText>
          <View style={styles.redLine} />
          <ThemedText style={styles.aboutGrandEast}>
            At Grand East, we specialize in creating modern, durable, 
            and stylish solutions that redefine residential and 
            commercial spaces. With a passion for precision and a 
            commitment to quality, our expert team delivers exceptional 
            aluminum and glass installations that stand the test of time. 
            Whether you're upgrading your home or transforming your business, 
            we provide innovative designs that combine functionality with 
            aesthetic appeal, ensuring your vision becomes a reality. </ThemedText>

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
      <View style={styles.bottomNavBar}>
          <TouchableOpacity style={styles.navItem} onPress={() => router.push('../homepage')}>
            <Image source={require('@/assets/images/home.png')} style={styles.navIcon} resizeMode="contain" />
            <Text style={styles.navLabel}>Home</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.navItem} onPress={() => {/* Add your action */}}>
            <Image source={require('@/assets/images/inquire.png')} style={styles.navIcon} resizeMode="contain" />
            <Text style={styles.navLabel}>Inquire</Text>
          </TouchableOpacity>
          <View style={styles.fabWrapper}>
            <TouchableOpacity style={styles.fabButton} onPress={() => router.push('../shop')}>
              <Image source={require('@/assets/images/catalogbutton.png')} style={styles.fabIcon} resizeMode="contain" />
            </TouchableOpacity>
          </View>
          <TouchableOpacity style={styles.navItem} onPress={() => {/* Add your action */}}>
            <Image source={require('@/assets/images/service.png')} style={styles.navIcon} resizeMode="contain" />
            <Text style={styles.navLabel}>Service</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.navItem} onPress={() => {/* Add your action */}}>
            <Image source={require('@/assets/images/settings.png')} style={styles.navIcon} resizeMode="contain" />
            <Text style={styles.navLabel}>Settings</Text>
          </TouchableOpacity>
        </View>
    </View>

    
    </View>
    
    
    
  );
}

const styles = StyleSheet.create({
whitebackground: {
    flex: 1,
    backgroundColor: '#ffffff',
},
    upperBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 15,
    paddingTop: 15,
    paddingBottom: 10,
    backgroundColor: '#fdfdfdff',
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
  profileButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  profileIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#eee',
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
});