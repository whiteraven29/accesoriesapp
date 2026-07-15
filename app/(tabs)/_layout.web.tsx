import { Tabs } from 'expo-router';
import { useWindowDimensions, TouchableOpacity } from 'react-native';
import { Chrome as Home, Package, ShoppingCart, ChartBar as BarChart3, Languages, Menu } from 'lucide-react-native';
import { useLanguage } from '../../hooks/LanguageContext';

export default function WebTabLayout() {
  const { width } = useWindowDimensions();
  const { t, toggleLanguage } = useLanguage();
  const desktop = width >= 900;

  const screens = [
    ['index', t('home'), Home],
    ['sales', t('pointOfSale'), ShoppingCart],
    ['products', t('inventory'), Package],
    ['reports', t('reports'), BarChart3],
    ['more', t('more'), Menu],
  ] as const;

  return (
    <Tabs
      screenOptions={{
        headerShown: true,
        headerTitle: desktop ? t('workspace') : 'DukaSmart',
        headerTitleStyle: { fontWeight: '700', color: '#172033' },
        headerStyle: { backgroundColor: '#FFFFFF' },
        headerRight: () => (
          <TouchableOpacity onPress={toggleLanguage} style={{ marginRight: 20, padding: 10, borderRadius: 10, backgroundColor: '#2563EB' }}>
            <Languages size={20} color="#FFFFFF" />
          </TouchableOpacity>
        ),
        tabBarPosition: desktop ? 'left' : 'bottom',
        tabBarVariant: desktop ? 'material' : 'uikit',
        tabBarActiveTintColor: '#2563EB',
        tabBarInactiveTintColor: '#64748B',
        tabBarStyle: desktop
          ? { width: 250, paddingTop: 18, backgroundColor: '#FFFFFF', borderRightWidth: 1, borderRightColor: '#E2E8F0' }
          : { minHeight: 64, paddingTop: 6, paddingBottom: 8, backgroundColor: '#FFFFFF' },
        tabBarItemStyle: desktop ? { minHeight: 58, marginHorizontal: 10, borderRadius: 10 } : undefined,
        tabBarLabelStyle: { fontSize: desktop ? 14 : 11, fontWeight: '600' },
        sceneStyle: { backgroundColor: '#F4F7FB' },
        tabBarShowLabel: desktop || width >= 390,
      }}
    >
      {screens.map(([name, title, Icon]) => (
        <Tabs.Screen
          key={name}
          name={name}
          options={{
            title,
            tabBarIcon: ({ color, size }) => <Icon color={color} size={desktop ? 22 : size} />,
          }}
        />
      ))}
      <Tabs.Screen name="receipts" options={{ href: null }} />
      <Tabs.Screen name="customers" options={{ href: null }} />
      <Tabs.Screen name="expenses" options={{ href: null }} />
    </Tabs>
  );
}
