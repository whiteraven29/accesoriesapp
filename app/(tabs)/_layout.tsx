import { Tabs, useRouter } from 'expo-router';
import { View, TouchableOpacity, useWindowDimensions, Platform } from 'react-native';
import { Chrome as Home, Package, ShoppingCart, Users, ChartBar as BarChart3, Receipt, Languages } from 'lucide-react-native';
import { useLanguage } from '../../hooks/LanguageContext';

export default function TabLayout() {
  const { toggleLanguage, t } = useLanguage();
  const { width } = useWindowDimensions();
  const isWeb = Platform.OS === 'web';
  const isWideScreen = width > 1024; // Desktop breakpoint

  // Responsive scaling with maximum caps
  const scaleFactor = Math.min(width / 375, 2.5); // Base on iPhone 6 width, max 2.5x
  const headerFontSize = Math.min(18 * scaleFactor, 24);
  const iconSize = Math.min(24 * scaleFactor, 28);

  return (
    <View style={{ flex: 1, backgroundColor: '#F9FAFB' }}>
      <Tabs
        screenOptions={{
          headerShown: true,
          headerTitle: 'Phone Shop POS',
          headerTitleStyle: {
            fontWeight: 'bold',
            fontSize: headerFontSize,
          },
          headerRight: () => (
            <TouchableOpacity
              style={{
                padding: Math.min(12 * scaleFactor, 16),
                marginRight: Math.min(16 * scaleFactor, 24),
                backgroundColor: '#2563EB',
                borderRadius: 20,
              }}
              onPress={toggleLanguage}
            >
              <Languages size={iconSize} color="#FFFFFF" />
            </TouchableOpacity>
          ),
          headerStyle: {
            backgroundColor: '#FFFFFF',
            height: Math.min(70 * scaleFactor, 80),
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.1,
            shadowRadius: 4,
            elevation: 3,
          },
          tabBarActiveTintColor: '#2563EB',
          tabBarInactiveTintColor: '#6B7280',
          tabBarStyle: isWeb ? {
            backgroundColor: '#FFFFFF',
            borderTopWidth: 1,
            borderTopColor: '#E5E7EB',
            paddingBottom: Math.min(8 * scaleFactor, 12),
            paddingTop: Math.min(8 * scaleFactor, 12),
            height: Math.min(70 * scaleFactor, 80),
            paddingHorizontal: isWideScreen ? Math.max(width * 0.15, 150) : Math.min(width * 0.05, 50),
            position: 'relative',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: -2 },
            shadowOpacity: 0.1,
            shadowRadius: 4,
            elevation: 3,
          } : {
            backgroundColor: '#FFFFFF',
            borderTopWidth: 1,
            borderTopColor: '#E5E7EB',
            paddingBottom: 5,
            paddingTop: 5,
            height: 60,
          },
          tabBarLabelStyle: {
            fontSize: Math.min(12 * scaleFactor, 14),
            fontWeight: '500',
          },
          tabBarItemStyle: isWeb ? {
            flex: 1,
            maxWidth: isWideScreen ? 120 : undefined,
          } : undefined,
        }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ size, color }) => (
            <Home size={Math.min(size * scaleFactor, 28)} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="products"
        options={{
          title: 'Products',
          tabBarIcon: ({ size, color }) => (
            <Package size={Math.min(size * scaleFactor, 28)} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="sales"
        options={{
          title: 'POS',
          tabBarIcon: ({ size, color }) => (
            <ShoppingCart size={Math.min(size * scaleFactor, 28)} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="receipts"
        options={{
          title: 'Receipts',
          tabBarIcon: ({ size, color }) => (
            <Receipt size={Math.min(size * scaleFactor, 28)} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="customers"
        options={{
          title: 'Customers',
          tabBarIcon: ({ size, color }) => (
            <Users size={Math.min(size * scaleFactor, 28)} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="reports"
        options={{
          title: 'Reports',
          tabBarIcon: ({ size, color }) => (
            <BarChart3 size={Math.min(size * scaleFactor, 28)} color={color} />
          ),
        }}
      />
    </Tabs>
    </View>
  );
}