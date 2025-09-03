import React, { useState, useEffect } from 'react';
import { View, Image, StyleSheet, TouchableOpacity, Text, ScrollView } from 'react-native';

const images = [
  require('@/assets/images/homeimage1.png'),
  require('@/assets/images/homeimage2.png'),
  require('@/assets/images/homeimage3.png'),
  require('@/assets/images/homeimage4.png'),
  require('@/assets/images/homeimage5.png'),
];

export default function Homescreen() {
  const [index, setIndex] = useState(0);

  const nextImage = () => setIndex((prev) => (prev + 1) % images.length);
  const prevImage = () => setIndex((prev) => (prev - 1 + images.length) % images.length);

  useEffect(() => {
    const interval = setInterval(() => {
      setIndex((prev) => (prev + 1) % images.length);
    }, 3000); 
    return () => clearInterval(interval);
  }, []);

  return (
    <View style={{ flex: 1 }}>
      <ScrollView style={{ flex: 1 }}>
        <View style={styles.upperBar}>
          <Image
            source={require('@/assets/images/grandeastlogo.png')}
            style={styles.logo}
            resizeMode="contain"
          />
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
            resizeMode="cover"
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
            resizeMode="cover"
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
            resizeMode="cover"
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
            resizeMode="cover"
          />
          <View style={styles.imageButtonOverlay}>
            <Text style={styles.imageButtonTitle}>Windows</Text>
            <View style={styles.imageButtonBox}>
              <Text style={styles.imageButtonText}>View More Products</Text>
            </View>
          </View>
        </TouchableOpacity>
        <View style={styles.blueBox}>
            <View style={{ flexDirection: 'row', width: '100%', paddingLeft: 30, paddingTop: 20 }}>
            <Text style={styles.featuredText}>Featured Projects</Text>
            <TouchableOpacity style={styles.viewMoreProjectButton}>
                <Text style={styles.viewMoreProjectButtonText}>View More Projects</Text>
            </TouchableOpacity>
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
        <TouchableOpacity style={styles.circleButton}>
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
    
    
  );
}

const styles = StyleSheet.create({
    upperBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 15,
    backgroundColor: '#fff',
  },
  logo: {
    height: 70,
    width: 200,
  },
  blueBox: {
    height: '20%',
    backgroundColor: '#1c202aff',
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
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
    borderRadius: 8,
    overflow: 'hidden',
    height: 180,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
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
    backgroundColor: 'rgba(0,0,0,0.25)',
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

});