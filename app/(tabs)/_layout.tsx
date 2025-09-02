import { Tabs, useRouter } from 'expo-router';
import { View, TouchableOpacity } from 'react-native';
import { Chrome as Home, Package, ShoppingCart, Users, ChartBar as BarChart3, Languages } from 'lucide-react-native';
import { useLanguage } from '../../hooks/LanguageContext';

export default function TabLayout() {
  const { toggleLanguage, t } = useLanguage();
  
  return (
    <Tabs
      screenOptions={{
        headerShown: true,
        headerTitle: 'Phone Shop POS',
        headerTitleStyle: {
          fontWeight: 'bold',
        },
        headerRight: () => (
          <TouchableOpacity
            style={{
              padding: 10,
              marginRight: 10,
              backgroundColor: '#2563EB',
              borderRadius: 20,
            }}
            onPress={toggleLanguage}
          >
            <Languages size={24} color="#FFFFFF" />
          </TouchableOpacity>
        ),
        headerStyle: {
          backgroundColor: '#FFFFFF',
        },
        tabBarActiveTintColor: '#2563EB',
        tabBarInactiveTintColor: '#6B7280',
        tabBarStyle: {
          backgroundColor: '#FFFFFF',
          borderTopWidth: 1,
          borderTopColor: '#E5E7EB',
          paddingBottom: 5,
          paddingTop: 5,
          height: 60,
        },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ size, color }) => (
            <Home size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="products"
        options={{
          title: 'Products',
          tabBarIcon: ({ size, color }) => (
            <Package size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="sales"
        options={{
          title: 'POS',
          tabBarIcon: ({ size, color }) => (
            <ShoppingCart size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="customers"
        options={{
          title: 'Customers',
          tabBarIcon: ({ size, color }) => (
            <Users size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="reports"
        options={{
          title: 'Reports',
          tabBarIcon: ({ size, color }) => (
            <BarChart3 size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}