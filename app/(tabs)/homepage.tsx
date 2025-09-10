import { ThemedText } from '@/components/ThemedText';
import React, { useState, useEffect, useRef } from 'react';
import { View, Image, StyleSheet, TextInput as RNTextInput, TouchableOpacity, Text, ScrollView, Button} from 'react-native';
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

export default function Homescreen() {  
    const [index, setIndex] = useState(0);
    const router = useRouter();

  const nextImage = () => setIndex((prev) => (prev + 1) % images.length);
  const prevImage = () => setIndex((prev) => (prev - 1 + images.length) % images.length);

  useEffect(() => {
  const getUser = async () => {
    const { data } = await supabase.auth.getUser();
  };
  getUser();
}, []);

  return (
    <View style={styles.whitebackground}>
    <View style={{ flex: 1 }}>
      <ScrollView style={{ flex: 1 }}>
        <View style={styles.upperBar}>
          <Image
            source={require('@/assets/images/grandeastlogo.png')}
            style={styles.logo}
            resizeMode="contain"
          />
          <TouchableOpacity
            style={styles.profileButton}
            onPress={() => router.push('../profile')}
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
            resizeMode="contain"
          />
          <TouchableOpacity onPress={nextImage} style={styles.arrow}>
            <Image source={require('@/assets/images/right-arrow.png')} style={styles.arrowIcon} />
          </TouchableOpacity>
        </View>
        <View style={styles.qualityBar}>
          <View style={styles.qualityDot} />
          <Text style={styles.qualityText}>High Quality, Long Lasting Performance</Text>
          <View style={styles.qualityDot} />
          <Text style={styles.qualityText}>High Quality, Long Lasting Performance</Text>
        </View>


        <TouchableOpacity style={styles.imageButton}>
          <Image
            source={require('@/assets/images/DoorsButton.png')}
            style={styles.imageButtonImage}
            resizeMode="contain"
          />
          <View style={styles.imageButtonOverlay}>
            <Text style={styles.imageButtonTitle}>Doors</Text>
            <View style={styles.imageButtonBox}>
              <Text style={styles.imageButtonText}>View More Products</Text>
            </View>
          </View>
        </TouchableOpacity>

        <TouchableOpacity style={styles.imageButton}>
          <Image
            source={require('@/assets/images/railingsbutton.png')}
            style={styles.imageButtonImage}
            resizeMode="contain"
          />
          <View style={styles.imageButtonOverlay}>
            <Text style={styles.imageButtonTitle}>Railings</Text>
            <View style={styles.imageButtonBox}>
              <Text style={styles.imageButtonText}>View More Products</Text>
            </View>
          </View>
        </TouchableOpacity>

        <TouchableOpacity style={styles.imageButton}>
          <Image
            source={require('@/assets/images/enclosuresbutton.png')}
            style={styles.imageButtonImage}
            resizeMode="contain"
          />
          <View style={styles.imageButtonOverlay}>
            <Text style={styles.imageButtonTitle}>Enclosures</Text>
            <View style={styles.imageButtonBox}>
              <Text style={styles.imageButtonText}>View More Products</Text>
            </View>
          </View>
        </TouchableOpacity>

        <TouchableOpacity style={styles.imageButton}>
          <Image
            source={require('@/assets/images/windowsbutton.png')}
            style={styles.imageButtonImage}
            resizeMode="contain"
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
            <TouchableOpacity style={styles.viewMoreProjectButton}>
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
            source={require('@/assets/images/grandeastlogo.png')}
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

            <View style={{ position: 'relative', width: 500, height: 200, marginTop: 20 }}>
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
            <View style={{
               backgroundColor: '#2c3848',
                flexDirection: 'row',
                alignItems: 'center',
                marginTop: 30,
                borderRadius: 0,
                width: '100%',
                alignSelf: 'stretch'
              }}>
                <Text style={{ fontSize: 22, color: '#fff', marginRight: 8 }}>📞</Text>
                <Text style={{ fontSize: 18, color: '#fff' }}>
                  Smart || 09082810586  Globe | (Viber) || 09277640475
                </Text>
              </View>
          </View>

        

      </ScrollView>
      <View style={styles.redLowerBar}>
        <View style={styles.sideIconsContainer}>
          <TouchableOpacity style={styles.sideIconButton}>
            <Image
              source={require('@/assets/images/home.png')}
              style={styles.sideIcon}
              resizeMode="contain"
            />
          </TouchableOpacity>
          <TouchableOpacity style={styles.sideIconButton}>
            <Image
              source={require('@/assets/images/inquire.png')}
              style={styles.sideIcon}
              resizeMode="contain"
            />
          </TouchableOpacity>
        </View>
        <TouchableOpacity
            style={styles.circleButton}
            onPress={() => router.push('../shop')}
          >
            <Image
              source={require('@/assets/images/catalogbutton.png')}
              style={styles.catalogIcon}
              resizeMode="contain"
            />
          </TouchableOpacity>
        <View style={styles.sideIconsContainer}>
          <TouchableOpacity style={styles.sideIconButton}>
            <Image
              source={require('@/assets/images/service.png')}
              style={styles.sideIcon}
              resizeMode="contain"
            />
          </TouchableOpacity>
          <TouchableOpacity style={styles.sideIconButton}>
            <Image
              source={require('@/assets/images/settings.png')}
              style={styles.sideIcon}
              resizeMode="contain"
            />
          </TouchableOpacity>
        </View>
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
    padding: 15,
    backgroundColor: '#fdfdfdff',
  },
  logo: {
    height: 70,
    width: 200,
  },
  blueBox: {
    height: '8%',
    backgroundColor: '#1c202aff',
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
  position: 'absolute',
  right: 15,
  top: '50%',
  transform: [{ translateY: -20 }],
  width: 40,
  height: 40,
  justifyContent: 'center',
  alignItems: 'center',
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
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    color: '#fff',
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
  },
  imageButtonOverlay: {
    flex: 1,
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
  },
  imageButtonTitle: {
    color: '#fff',
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 16,
    textShadowColor: '#000',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 4,
  },
  imageButtonBox: {
    borderWidth: 1,
    borderColor: '#fff',
    borderRadius: 2,
    paddingHorizontal: 18,
    paddingVertical: 8,
    marginTop: 4,
  },
  imageButtonText: {
    color: '#fff',
    fontSize: 20,
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
  width: 250,
  height: 200,
  borderRadius: 8, 
  backgroundColor: '#eee', 
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
});