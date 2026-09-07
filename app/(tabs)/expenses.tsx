import { useState, useMemo } from 'react';
import { Alert, Modal, RefreshControl, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { Plus, Trash2, WalletCards } from 'lucide-react-native';
import { useExpenses } from '../../hooks/useExpenses';
import { Palette } from '../../constants/theme';
import { useTheme } from '../../hooks/useTheme';
import { useLanguage } from '../../hooks/LanguageContext';
import { formatCurrency } from '../../utils/currency';
import { roundMoney } from '../../utils/calculations';

export default function ExpensesScreen() {
  const { t } = useLanguage();
  const { colors: c } = useTheme();
  const { expenses, fetchExpenses, addExpense, deleteExpense } = useExpenses();
  const { width } = useWindowDimensions();
  const styles = useMemo(() => createStyles(width, c), [width, c]);
  const [open, setOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [category, setCategory] = useState('Other');
  const [amount, setAmount] = useState(0);
  const [description, setDescription] = useState('');
  const today = new Date().toISOString().slice(0, 10);

  const save = async () => {
    if (!category.trim() || amount <= 0) return Alert.alert(t('error'), t('validExpense'));
    const saved = await addExpense({ category: category.trim(), amount, description: description.trim(), expenseDate: today });
    if (!saved) return Alert.alert(t('error'), t('expenseSaveFailed'));
    setAmount(0); setDescription(''); setCategory('Other'); setOpen(false);
  };
  const refresh = async () => { setRefreshing(true); await fetchExpenses(); setRefreshing(false); };
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const monthlyTotal = expenses.filter(e => new Date(e.expenseDate) >= monthStart).reduce((sum, e) => sum + e.amount, 0);

  return <View style={styles.container}>
    <View style={styles.header}><View><Text style={styles.title}>{t('expenses')}</Text><Text style={styles.subtitle}>{t('monthlyExpenses')}: {formatCurrency(monthlyTotal)}</Text></View>
      <TouchableOpacity style={styles.add} onPress={() => setOpen(true)}><Plus color={c.textInverse} size={18}/><Text style={styles.addText}>{t('add')}</Text></TouchableOpacity></View>
    <ScrollView contentContainerStyle={styles.list} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh}/>}>
      {expenses.map(expense => <View key={expense.id} style={styles.card}>
        <View style={styles.icon}><WalletCards color={c.danger} size={18}/></View><View style={styles.details}><Text style={styles.category}>{expense.category}</Text><Text style={styles.description}>{expense.description || t('noDescription')} · {expense.expenseDate}</Text></View>
        <Text style={styles.amount}>{formatCurrency(expense.amount)}</Text><TouchableOpacity onPress={() => deleteExpense(expense.id)}><Trash2 color={c.danger} size={18}/></TouchableOpacity>
      </View>)}
      {!expenses.length && <Text style={styles.empty}>{t('noExpenses')}</Text>}
    </ScrollView>
    <Modal visible={open} transparent animationType="fade"><View style={styles.overlay}><View style={styles.modal}>
      <Text style={styles.modalTitle}>{t('addExpense')}</Text>
      <Text style={styles.label}>{t('category')}</Text><TextInput style={styles.input} value={category} onChangeText={setCategory}/>
      <Text style={styles.label}>{t('amount')}</Text><TextInput style={styles.input} value={amount ? String(amount) : ''} onChangeText={v => setAmount(roundMoney(Number(v.replace(/[^0-9]/g, ''))))} keyboardType="numeric" placeholder="0"/>
      <Text style={styles.label}>{t('description')}</Text><TextInput style={[styles.input, styles.notes]} value={description} onChangeText={setDescription} multiline/>
      <View style={styles.actions}><TouchableOpacity onPress={() => setOpen(false)}><Text style={styles.cancel}>{t('cancel')}</Text></TouchableOpacity><TouchableOpacity style={styles.save} onPress={save}><Text style={styles.saveText}>{t('save')}</Text></TouchableOpacity></View>
    </View></View></Modal>
  </View>;
}

const createStyles = (viewport: number, c: Palette) => { const mobile = viewport < 700; return StyleSheet.create({
  container:{flex:1,backgroundColor:c.background}, header:{padding:20,backgroundColor:c.surface,flexDirection:'row',justifyContent:'space-between',alignItems:'center'},title:{fontSize:26,fontWeight:'700',color:c.text},subtitle:{color:c.textMuted,marginTop:4},add:{backgroundColor:c.primary,paddingHorizontal:16,paddingVertical:11,borderRadius:10,flexDirection:'row',gap:7,alignItems:'center'},addText:{color:c.surface,fontWeight:'700'},list:{padding:mobile?14:24,maxWidth:1100,width:'100%',alignSelf:'center',gap:10},card:{backgroundColor:c.surface,padding:16,borderRadius:12,flexDirection:'row',alignItems:'center',gap:12,borderWidth:1,borderColor:c.border},icon:{width:42,height:42,borderRadius:21,backgroundColor:c.dangerTint,alignItems:'center',justifyContent:'center'},details:{flex:1},category:{fontWeight:'700',fontSize:16,color:c.text},description:{color:c.textMuted,marginTop:3},amount:{fontWeight:'700',color:c.danger,marginRight:10},empty:{textAlign:'center',color:c.textMuted,padding:50},overlay:{flex:1,backgroundColor:'#0008',justifyContent:'center',padding:20},modal:{backgroundColor:c.surface,borderRadius:16,padding:22,maxWidth:520,width:'100%',alignSelf:'center'},modalTitle:{fontSize:22,fontWeight:'700',marginBottom:18},label:{fontWeight:'600',color:c.textMuted,marginBottom:6},input:{borderWidth:1,borderColor:c.borderStrong,borderRadius:9,padding:12,marginBottom:14,color:c.text},notes:{minHeight:80,textAlignVertical:'top'},actions:{flexDirection:'row',justifyContent:'flex-end',alignItems:'center',gap:20},cancel:{color:c.textMuted,fontWeight:'600'},save:{backgroundColor:c.primary,paddingHorizontal:20,paddingVertical:11,borderRadius:9},saveText:{color:c.surface,fontWeight:'700'}
}); };
