import { Tabs, useRouter } from 'expo-router';
import { View, TouchableOpacity, useWindowDimensions, Platform } from 'react-native';
import { Chrome as Home, Package, ShoppingCart, Users, ChartBar as BarChart3, Receipt, Languages } from 'lucide-react-native';
import { useLanguage } from '../../hooks/LanguageContext';

export default function TabLayout() {
  const { toggleLanguage, t } = useLanguage();
  const { width } = useWindowDimensions();
  const isWeb = Platform.OS === 'web';
  const isWideScreen = width > 1024; // Desktop breakpoint

  return (
    <View style={{ flex: 1, backgroundColor: '#F9FAFB' }}>
      <Tabs
        screenOptions={{
          headerShown: true,
          headerTitle: 'Phone Shop POS',
          headerTitleStyle: {
            fontWeight: 'bold',
            fontSize: isWideScreen ? 24 : Math.min(width * 0.05, 20),
          },
          headerRight: () => (
            <TouchableOpacity
              style={{
                padding: isWideScreen ? 12 : Math.min(width * 0.025, 10),
                marginRight: isWideScreen ? 20 : Math.min(width * 0.025, 10),
                backgroundColor: '#2563EB',
                borderRadius: 20,
              }}
              onPress={toggleLanguage}
            >
              <Languages size={isWideScreen ? 28 : Math.min(width * 0.06, 24)} color="#FFFFFF" />
            </TouchableOpacity>
          ),
          headerStyle: {
            backgroundColor: '#FFFFFF',
            height: isWideScreen ? 80 : Math.min(width * 0.15, 70),
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
            paddingBottom: 8,
            paddingTop: 8,
            height: isWideScreen ? 80 : 70,
            paddingHorizontal: isWideScreen ? Math.max(width * 0.2, 200) : Math.min(width * 0.1, 100),
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
            fontSize: isWideScreen ? 14 : Math.min(width * 0.03, 12),
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
            <Home size={isWideScreen ? 32 : Math.min(size, width * 0.06)} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="products"
        options={{
          title: 'Products',
          tabBarIcon: ({ size, color }) => (
            <Package size={isWideScreen ? 32 : Math.min(size, width * 0.06)} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="sales"
        options={{
          title: 'POS',
          tabBarIcon: ({ size, color }) => (
            <ShoppingCart size={isWideScreen ? 32 : Math.min(size, width * 0.06)} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="receipts"
        options={{
          title: 'Receipts',
          tabBarIcon: ({ size, color }) => (
            <Receipt size={isWideScreen ? 32 : Math.min(size, width * 0.06)} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="customers"
        options={{
          title: 'Customers',
          tabBarIcon: ({ size, color }) => (
            <Users size={isWideScreen ? 32 : Math.min(size, width * 0.06)} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="reports"
        options={{
          title: 'Reports',
          tabBarIcon: ({ size, color }) => (
            <BarChart3 size={isWideScreen ? 32 : Math.min(size, width * 0.06)} color={color} />
          ),
        }}
      />
    </Tabs>
    </View>
  );
}