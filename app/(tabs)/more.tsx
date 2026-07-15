import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { ChevronRight, Receipt, Users, WalletCards } from 'lucide-react-native';
import { useLanguage } from '../../hooks/LanguageContext';

export default function MoreScreen() {
  const router = useRouter();
  const { t } = useLanguage();
  const { width } = useWindowDimensions();
  const desktop = width >= 800;
  const tools = [
    { route: '/(tabs)/receipts', title: t('receipts'), description: t('receiptsHistory'), icon: Receipt, color: '#2563EB', background: '#DBEAFE' },
    { route: '/(tabs)/customers', title: t('customers'), description: t('customerManagement'), icon: Users, color: '#16A34A', background: '#DCFCE7' },
    { route: '/(tabs)/expenses', title: t('expenses'), description: t('expenseManagement'), icon: WalletCards, color: '#DC2626', background: '#FEE2E2' },
  ] as const;

  return <View style={styles.container}>
    <View style={styles.header}><Text style={styles.title}>{t('more')}</Text><Text style={styles.subtitle}>{t('businessTools')}</Text></View>
    <ScrollView contentContainerStyle={[styles.grid, desktop && styles.desktopGrid]}>
      {tools.map(({ route, title, description, icon: Icon, color, background }) => (
        <TouchableOpacity key={route} style={[styles.card, desktop && styles.desktopCard]} onPress={() => router.push(route)} activeOpacity={0.75}>
          <View style={[styles.icon, { backgroundColor: background }]}><Icon color={color} size={26}/></View>
          <View style={styles.copy}><Text style={styles.cardTitle}>{title}</Text><Text style={styles.description}>{description}</Text></View>
          <ChevronRight color="#94A3B8" size={22}/>
        </TouchableOpacity>
      ))}
    </ScrollView>
  </View>;
}

const styles = StyleSheet.create({
  container:{flex:1,backgroundColor:'#F4F7FB'},header:{backgroundColor:'#fff',padding:22,borderBottomWidth:1,borderBottomColor:'#E2E8F0'},title:{fontSize:27,fontWeight:'700',color:'#172033'},subtitle:{marginTop:5,color:'#64748B'},grid:{padding:16,gap:12,maxWidth:1100,width:'100%',alignSelf:'center'},desktopGrid:{flexDirection:'row',flexWrap:'wrap',padding:28,gap:18},card:{backgroundColor:'#fff',padding:17,borderRadius:14,borderWidth:1,borderColor:'#E2E8F0',flexDirection:'row',alignItems:'center',gap:14},desktopCard:{width:'48%',minHeight:105},icon:{width:52,height:52,borderRadius:14,alignItems:'center',justifyContent:'center'},copy:{flex:1},cardTitle:{fontSize:17,fontWeight:'700',color:'#172033'},description:{fontSize:13,color:'#64748B',marginTop:4},
});
