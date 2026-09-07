import { useMemo, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { PackageX, Plus, X } from 'lucide-react-native';
import { Badge, Button, Card, EmptyState, SegmentedControl } from '../../components/ui';
import { Screen, ScreenHeader } from '../../components/Screen';
import { MIN_TOUCH_TARGET, fontSize, fontWeight, radius, spacing } from '../../constants/theme';
import { useLanguage } from '../../hooks/LanguageContext';
import { useLosses } from '../../hooks/useLosses';
import { useProducts } from '../../hooks/useProducts';
import { useProductUnits } from '../../hooks/useProductUnits';
import { useTheme } from '../../hooks/useTheme';
import { formatCurrency } from '../../utils/currency';

type Reason = 'damaged' | 'stolen' | 'defective' | 'lost';

/**
 * Write-offs.
 *
 * The losses table, its RLS policies and the hook all existed but nothing in the
 * app could reach them — and the old client-side insert never reduced stock, so
 * a stolen handset hit the P&L and stayed sellable. This screen drives the
 * `record_loss` RPC, which moves stock and writes the loss in one transaction.
 */
export default function LossesScreen() {
  const { t } = useLanguage();
  const { colors: c } = useTheme();
  const { products } = useProducts();
  const { losses, addLoss, getTotalLossValue } = useLosses();

  const [open, setOpen] = useState(false);
  const [productId, setProductId] = useState<string | null>(null);
  const [quantity, setQuantity] = useState('1');
  const [reason, setReason] = useState<Reason>('damaged');
  const [description, setDescription] = useState('');
  const [selectedUnits, setSelectedUnits] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const product = products.find(p => p.id === productId);
  const { availableUnits } = useProductUnits(product?.isSerialized ? product.id : undefined);
  const styles = useMemo(() => createStyles(), []);

  const reset = () => {
    setProductId(null);
    setQuantity('1');
    setReason('damaged');
    setDescription('');
    setSelectedUnits([]);
    setOpen(false);
  };

  const toggleUnit = (id: string) =>
    setSelectedUnits(prev => (prev.includes(id) ? prev.filter(u => u !== id) : [...prev, id]));

  const submit = async () => {
    if (!product) {
      Alert.alert(t('error'), t('fillAllFields'));
      return;
    }

    const qty = product.isSerialized ? selectedUnits.length : Number(quantity);
    if (!Number.isInteger(qty) || qty <= 0) {
      Alert.alert(t('error'), product.isSerialized ? t('selectUnit') : t('fillAllFields'));
      return;
    }

    setSaving(true);
    const { id, error } = await addLoss({
      productId: product.id,
      quantity: qty,
      reason,
      description: description.trim() || undefined,
      unitIds: product.isSerialized ? selectedUnits : undefined,
    });
    setSaving(false);

    if (!id) {
      Alert.alert(t('error'), error ?? t('error'));
      return;
    }
    reset();
  };

  return (
    <Screen measure="standard" scroll>
      <ScreenHeader
        title={t('recordLoss')}
        subtitle={`${t('lossInformation')}: ${formatCurrency(getTotalLossValue())}`}
        actions={
          <Button
            label={t('add')}
            onPress={() => setOpen(true)}
            icon={<Plus size={18} color={c.textInverse} />}
          />
        }
      />

      {losses.length === 0 ? (
        <EmptyState
          icon={<PackageX size={40} color={c.textSubtle} />}
          title={t('lossInformation')}
          description={t('recordLoss')}
        />
      ) : null}

      <View style={styles.list}>
        {losses.map(loss => (
          <Card key={loss.id} style={styles.row}>
            <View style={styles.flex}>
              <Text style={[styles.name, { color: c.text }]}>
                {loss.product?.name ?? '—'}
              </Text>
              <Text style={[styles.meta, { color: c.textMuted }]}>
                {loss.quantity} × · {new Date(loss.created_at).toLocaleDateString()}
                {loss.description ? ` · ${loss.description}` : ''}
              </Text>
            </View>
            <View style={styles.rowEnd}>
              <Badge label={t(loss.reason) === loss.reason ? loss.reason : t(loss.reason)} tone="warning" />
              <Text style={[styles.value, { color: c.danger }]}>
                −{formatCurrency(loss.lossValue)}
              </Text>
            </View>
          </Card>
        ))}
      </View>

      <Modal visible={open} transparent animationType="slide" statusBarTranslucent onRequestClose={reset}>
        <View style={[styles.backdrop, { backgroundColor: c.overlay }]}>
          <View style={[styles.sheet, { backgroundColor: c.surface }]}>
            <View style={[styles.sheetHeader, { borderBottomColor: c.border }]}>
              <Text style={[styles.sheetTitle, { color: c.text }]}>{t('recordLoss')}</Text>
              <Pressable onPress={reset} accessibilityRole="button" accessibilityLabel={t('close')} style={styles.close}>
                <X size={18} color={c.textMuted} />
              </Pressable>
            </View>

            <ScrollView contentContainerStyle={styles.form}>
              <Text style={[styles.label, { color: c.textMuted }]}>{t('products')}</Text>
              <View style={styles.chips}>
                {products.map(item => {
                  const selected = item.id === productId;
                  return (
                    <Pressable
                      key={item.id}
                      onPress={() => {
                        setProductId(item.id);
                        setSelectedUnits([]);
                      }}
                      accessibilityRole="radio"
                      accessibilityState={{ selected }}
                      accessibilityLabel={item.name}
                      style={[
                        styles.chip,
                        { borderColor: c.border, backgroundColor: selected ? c.primary : c.surfaceAlt },
                      ]}
                    >
                      <Text style={{ color: selected ? c.textInverse : c.text, fontWeight: fontWeight.medium }}>
                        {item.name}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <Text style={[styles.label, { color: c.textMuted }]}>{t('lossReason')}</Text>
              <SegmentedControl
                value={reason}
                onChange={setReason}
                accessibilityLabel={t('lossReason')}
                options={[
                  { value: 'damaged', label: t('damaged') },
                  { value: 'stolen', label: t('stolen') },
                  { value: 'defective', label: t('defective') },
                  { value: 'lost', label: t('lostItem') },
                ]}
              />

              {/* A serialised write-off names the exact handsets leaving stock. */}
              {product?.isSerialized ? (
                <>
                  <Text style={[styles.label, { color: c.textMuted }]}>{t('selectUnit')}</Text>
                  {availableUnits.length === 0 ? (
                    <Text style={{ color: c.textSubtle }}>{t('unitsRequired')}</Text>
                  ) : null}
                  <View style={styles.chips}>
                    {availableUnits.map(unit => {
                      const selected = selectedUnits.includes(unit.id);
                      return (
                        <Pressable
                          key={unit.id}
                          onPress={() => toggleUnit(unit.id)}
                          accessibilityRole="checkbox"
                          accessibilityState={{ checked: selected }}
                          accessibilityLabel={unit.imei}
                          style={[
                            styles.chip,
                            { borderColor: c.border, backgroundColor: selected ? c.danger : c.surfaceAlt },
                          ]}
                        >
                          <Text style={{ color: selected ? c.textInverse : c.text, fontSize: fontSize.sm }}>
                            {unit.imei}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </>
              ) : (
                <>
                  <Text style={[styles.label, { color: c.textMuted }]}>{t('pieces')}</Text>
                  <TextInput
                    style={[styles.input, { color: c.text, borderColor: c.border, backgroundColor: c.surfaceAlt }]}
                    value={quantity}
                    onChangeText={text => setQuantity(text.replace(/[^0-9]/g, ''))}
                    keyboardType="numeric"
                    accessibilityLabel={t('pieces')}
                  />
                </>
              )}

              <Text style={[styles.label, { color: c.textMuted }]}>{t('description')}</Text>
              <TextInput
                style={[styles.input, styles.notes, { color: c.text, borderColor: c.border, backgroundColor: c.surfaceAlt }]}
                value={description}
                onChangeText={setDescription}
                multiline
                accessibilityLabel={t('description')}
              />

              <Button label={t('save')} onPress={submit} loading={saving} tone="danger" fullWidth />
            </ScrollView>
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

const createStyles = () =>
  StyleSheet.create({
    list: { gap: spacing.sm, marginTop: spacing.md },
    row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
    rowEnd: { alignItems: 'flex-end', gap: spacing.xs },
    flex: { flex: 1 },
    name: { fontSize: fontSize.md, fontWeight: fontWeight.semibold },
    meta: { fontSize: fontSize.sm, marginTop: 2 },
    value: { fontSize: fontSize.md, fontWeight: fontWeight.bold },
    backdrop: { flex: 1, justifyContent: 'flex-end' },
    sheet: {
      maxHeight: '92%',
      borderTopLeftRadius: radius.xl,
      borderTopRightRadius: radius.xl,
      width: '100%',
      maxWidth: 640,
      alignSelf: 'center',
    },
    sheetHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: spacing.lg,
      borderBottomWidth: StyleSheet.hairlineWidth,
    },
    sheetTitle: { fontSize: fontSize.xl, fontWeight: fontWeight.bold },
    close: { width: MIN_TOUCH_TARGET, height: MIN_TOUCH_TARGET, alignItems: 'center', justifyContent: 'center' },
    form: { padding: spacing.lg, gap: spacing.md },
    label: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, marginTop: spacing.xs },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
    chip: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderRadius: radius.pill,
      borderWidth: 1,
      minHeight: MIN_TOUCH_TARGET - 6,
      justifyContent: 'center',
    },
    input: {
      borderWidth: 1,
      borderRadius: radius.sm,
      paddingHorizontal: spacing.md,
      minHeight: 46,
      fontSize: fontSize.md,
    },
    notes: { minHeight: 90, textAlignVertical: 'top', paddingTop: spacing.md },
  });
