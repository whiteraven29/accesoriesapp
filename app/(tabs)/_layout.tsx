import { Tabs, useRouter } from 'expo-router';
import { View, TouchableOpacity, useWindowDimensions, Platform } from 'react-native';
import { Chrome as Home, Package, ShoppingCart, Users, ChartBar as BarChart3, Receipt, Languages } from 'lucide-react-native';
import { useLanguage } from '../../hooks/LanguageContext';
import { useMemo } from 'react';

// Define screen size breakpoints
const BREAKPOINTS = {
  mobile: 480,
  tablet: 768,
  desktop: 1024,
  largeDesktop: 1440,
};

// Device type detection
const getDeviceType = (width: number) => {
  if (width >= BREAKPOINTS.largeDesktop) return 'largeDesktop';
  if (width >= BREAKPOINTS.desktop) return 'desktop';
  if (width >= BREAKPOINTS.tablet) return 'tablet';
  return 'mobile';
};

export default function TabLayout() {
  const { toggleLanguage, t } = useLanguage();
  const { width, height } = useWindowDimensions();
  const isWeb = Platform.OS === 'web';
  const deviceType = getDeviceType(width);
  
  // Calculate responsive values based on device type and screen size
  const responsiveStyles = useMemo(() => {
    const isLandscape = width > height;
    
    // Base scale factor with device-specific adjustments
    let baseScale = 1;
    switch (deviceType) {
      case 'mobile':
        baseScale = Math.min(width / 375, 1.2); // iPhone 6 base, max 1.2x
        break;
      case 'tablet':
        baseScale = Math.min(width / 768, 1.5); // iPad base, max 1.5x
        break;
      case 'desktop':
        baseScale = Math.min(width / 1024, 1.8); // Desktop base, max 1.8x
        break;
      case 'largeDesktop':
        baseScale = Math.min(width / 1440, 2.2); // Large desktop base, max 2.2x
        break;
    }

    // Adjust for landscape mode on mobile/tablet
    if ((deviceType === 'mobile' || deviceType === 'tablet') && isLandscape) {
      baseScale *= 0.85; // Reduce size in landscape
    }

    return {
      // Header styles
      headerHeight: Math.max(Math.min(70 * baseScale, 90), 60), // Min 60, max 90
      headerFontSize: Math.max(Math.min(18 * baseScale, 26), 16), // Min 16, max 26
      
      // Icon and button styles
      iconSize: Math.max(Math.min(24 * baseScale, 32), 20), // Min 20, max 32
      buttonPadding: Math.max(Math.min(12 * baseScale, 20), 8), // Min 8, max 20
      buttonMargin: Math.max(Math.min(16 * baseScale, 28), 12), // Min 12, max 28
      
      // Tab bar styles
      tabBarHeight: isWeb 
        ? Math.max(Math.min(70 * baseScale, 85), 65) // Web: Min 65, max 85
        : deviceType === 'mobile' && !isLandscape 
          ? Math.max(Math.min(65 * baseScale, 75), 60) // Mobile portrait: Min 60, max 75
          : Math.max(Math.min(55 * baseScale, 65), 50), // Mobile landscape/others: Min 50, max 65
      
      tabBarPaddingVertical: isWeb 
        ? Math.max(Math.min(8 * baseScale, 14), 6) // Web: Min 6, max 14
        : Math.max(Math.min(5 * baseScale, 8), 4), // Native: Min 4, max 8
      
      tabBarLabelSize: Math.max(Math.min(12 * baseScale, 16), 10), // Min 10, max 16
      
      // Horizontal padding for web
      tabBarHorizontalPadding: isWeb ? (() => {
        switch (deviceType) {
          case 'largeDesktop':
            return Math.max(width * 0.2, 200); // 20% or min 200px
          case 'desktop':
            return Math.max(width * 0.15, 150); // 15% or min 150px
          case 'tablet':
            return Math.max(width * 0.08, 80); // 8% or min 80px
          default:
            return Math.max(width * 0.05, 20); // 5% or min 20px
        }
      })() : 0,
      
      // Tab item max width for web
      tabItemMaxWidth: isWeb ? (() => {
        switch (deviceType) {
          case 'largeDesktop':
            return 140;
          case 'desktop':
            return 120;
          case 'tablet':
            return 100;
          default:
            return undefined;
        }
      })() : undefined,
    };
  }, [width, height, deviceType, isWeb]);

  return (
    <View style={{ flex: 1, backgroundColor: '#F9FAFB' }}>
      <Tabs
        screenOptions={{
          headerShown: true,
          headerTitle: 'Phone Shop POS',
          headerTitleStyle: {
            fontWeight: 'bold',
            fontSize: responsiveStyles.headerFontSize,
            color: '#1F2937',
          },
          headerRight: () => (
            <TouchableOpacity
              style={{
                padding: responsiveStyles.buttonPadding,
                marginRight: responsiveStyles.buttonMargin,
                backgroundColor: '#2563EB',
                borderRadius: Math.min(responsiveStyles.buttonPadding + 8, 24),
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.1,
                shadowRadius: 3,
                elevation: 3,
              }}
              onPress={toggleLanguage}
              activeOpacity={0.8}
            >
              <Languages size={responsiveStyles.iconSize} color="#FFFFFF" />
            </TouchableOpacity>
          ),
          headerStyle: {
            backgroundColor: '#FFFFFF',
            height: responsiveStyles.headerHeight,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.1,
            shadowRadius: 4,
            elevation: 4,
            borderBottomWidth: isWeb ? 0 : 0.5,
            borderBottomColor: '#E5E7EB',
          },
          tabBarActiveTintColor: '#2563EB',
          tabBarInactiveTintColor: '#6B7280',
          tabBarStyle: {
            backgroundColor: '#FFFFFF',
            borderTopWidth: 1,
            borderTopColor: '#E5E7EB',
            paddingBottom: responsiveStyles.tabBarPaddingVertical,
            paddingTop: responsiveStyles.tabBarPaddingVertical,
            height: responsiveStyles.tabBarHeight,
            paddingHorizontal: responsiveStyles.tabBarHorizontalPadding,
            position: 'relative',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: -2 },
            shadowOpacity: 0.1,
            shadowRadius: 4,
            elevation: isWeb ? 8 : 4,
            // Add safe area handling for mobile devices
            ...(Platform.OS === 'ios' && deviceType === 'mobile' && {
              paddingBottom: responsiveStyles.tabBarPaddingVertical + (width > height ? 0 : 20), // Add bottom padding for home indicator
            }),
          },
          tabBarLabelStyle: {
            fontSize: responsiveStyles.tabBarLabelSize,
            fontWeight: '500',
            marginTop: Platform.OS === 'ios' ? 2 : 0,
          },
          tabBarItemStyle: isWeb ? {
            flex: 1,
            maxWidth: responsiveStyles.tabItemMaxWidth,
            minWidth: deviceType === 'mobile' ? undefined : 80,
          } : {
            paddingVertical: 2,
          },
          tabBarIconStyle: {
            marginBottom: Platform.OS === 'android' ? 4 : 2,
          },
          // Add animation and interaction improvements
        }}>
        
        <Tabs.Screen
          name="index"
          options={{
            title: t?.('home') || 'Home',
            tabBarIcon: ({ size, color }) => (
              <Home 
                size={Math.min(size * (responsiveStyles.iconSize / 24), responsiveStyles.iconSize)} 
                color={color} 
              />
            ),
          }}
        />
        <Tabs.Screen
          name="products"
          options={{
            title: t?.('products') || 'Products',
            tabBarIcon: ({ size, color }) => (
              <Package 
                size={Math.min(size * (responsiveStyles.iconSize / 24), responsiveStyles.iconSize)} 
                color={color} 
              />
            ),
          }}
        />
        <Tabs.Screen
          name="sales"
          options={{
            title: t?.('pos') || 'POS',
            tabBarIcon: ({ size, color }) => (
              <ShoppingCart 
                size={Math.min(size * (responsiveStyles.iconSize / 24), responsiveStyles.iconSize)} 
                color={color} 
              />
            ),
          }}
        />
        <Tabs.Screen
          name="receipts"
          options={{
            title: t?.('receipts') || 'Receipts',
            tabBarIcon: ({ size, color }) => (
              <Receipt 
                size={Math.min(size * (responsiveStyles.iconSize / 24), responsiveStyles.iconSize)} 
                color={color} 
              />
            ),
          }}
        />
        <Tabs.Screen
          name="customers"
          options={{
            title: t?.('customers') || 'Customers',
            tabBarIcon: ({ size, color }) => (
              <Users 
                size={Math.min(size * (responsiveStyles.iconSize / 24), responsiveStyles.iconSize)} 
                color={color} 
              />
            ),
          }}
        />
        <Tabs.Screen
          name="reports"
          options={{
            title: t?.('reports') || 'Reports',
            tabBarIcon: ({ size, color }) => (
              <BarChart3 
                size={Math.min(size * (responsiveStyles.iconSize / 24), responsiveStyles.iconSize)} 
                color={color} 
              />
            ),
          }}
        />
      </Tabs>
    </View>
  );
}