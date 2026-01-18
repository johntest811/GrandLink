import React from 'react';
import { View, TouchableOpacity, Image, Text, StyleSheet } from 'react-native';
import { useRouter, usePathname } from 'expo-router';

export default function BottomNavBar() {
  const router = useRouter();
  const pathname = usePathname();

  const isActive = (path: string) => pathname.includes(path);

  return (
    <View style={styles.bottomNavBar}>
      <TouchableOpacity
        style={styles.navItem}
        onPress={() => router.push('../homepage')}
      >
        <Image
          source={require('@/assets/images/home.png')}
          style={[styles.navIcon, isActive('homepage') && styles.activeIcon]}
          resizeMode="contain"
        />
        <Text style={styles.navLabel}>Home</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.navItem}
        onPress={() => router.push('../inquire')}
      >
        <Image
          source={require('@/assets/images/inquire.png')}
          style={[styles.navIcon, isActive('inquire') && styles.activeIcon]}
          resizeMode="contain"
        />
        <Text style={styles.navLabel}>Inquire</Text>
      </TouchableOpacity>

      <View style={styles.fabWrapper}>
        <TouchableOpacity
          style={styles.fabButton}
          onPress={() => router.push('../shop')}
        >
          <Image
            source={require('@/assets/images/catalogbutton.png')}
            style={styles.fabIcon}
            resizeMode="contain"
          />
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={styles.navItem}
        onPress={() => router.push('../services')}
      >
        <Image
          source={require('@/assets/images/service.png')}
          style={[styles.navIcon, isActive('service') && styles.activeIcon]}
          resizeMode="contain"
        />
        <Text style={styles.navLabel}>Service</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.navItem}
        onPress={() => router.push('../setting')}
      >
        <Image
          source={require('@/assets/images/settings.png')}
          style={[styles.navIcon, isActive('setting') && styles.activeIcon]}
          resizeMode="contain"
        />
        <Text style={styles.navLabel}>Settings</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  bottomNavBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: '#4f5f8aff', // fixed color, unaffected by dark mode
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
    tintColor: '#fff', // always white
  },
  activeIcon: {
    tintColor: '#ffcc00',
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
});
