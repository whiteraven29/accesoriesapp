import { useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Plus, Trash2, X } from 'lucide-react-native';
import { Badge, Button, EmptyState } from './ui';
import { MIN_TOUCH_TARGET, fontSize, fontWeight, radius, spacing } from '../constants/theme';
import { useLanguage } from '../hooks/LanguageContext';
import { isValidImei, useProductUnits } from '../hooks/useProductUnits';
import { useTheme } from '../hooks/useTheme';
import { formatCurrency } from '../utils/currency';

/**
 * Registers and lists the individual handsets behind a serialised product.
 *
 * Stock for these products is the count of in-stock units, maintained by a
 * database trigger — there is deliberately no "pieces" field to type into.
 */
export function ImeiManager({
  visible,
  onClose,
  productId,
  productName,
  defaultCost,
}: {
  visible: boolean;
  onClose: () => void;
  productId: string;
  productName: string;
  defaultCost: number;
}) {
  const { t } = useLanguage();
  const { colors } = useTheme();
  const { units, availableUnits, addUnit, deleteUnit } = useProductUnits(productId);

  const [imei, setImei] = useState('');
  const [imei2, setImei2] = useState('');
  const [cost, setCost] = useState(String(defaultCost || ''));
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    const trimmed = imei.trim();
    if (!isValidImei(trimmed)) {
      Alert.alert(t('error'), t('imeiInvalid'));
      return;
    }

    setSaving(true);
    const { unit, error } = await addUnit({
      productId,
      imei: trimmed,
      imei2: imei2.trim() || undefined,
      // Cost is captured per unit so two batches bought at different prices
      // report two different margins.
      cost: Number(cost.replace(/[^0-9]/g, '')) || defaultCost,
    });
    setSaving(false);

    if (!unit) {
      Alert.alert(t('error'), error === 'imeiAlreadyExists' ? t('imeiAlreadyExists') : error ?? t('error'));
      return;
    }

    setImei('');
    setImei2('');
  };

  const confirmDelete = (id: string, value: string) => {
    Alert.alert(t('confirmDelete'), value, [
      { text: t('cancel'), style: 'cancel' },
      { text: t('delete'), style: 'destructive', onPress: () => deleteUnit(id) },
    ]);
  };

  return (
    <Modal visible={visible} animationType="slide" transparent statusBarTranslucent onRequestClose={onClose}>
      <View style={[styles.backdrop, { backgroundColor: colors.overlay }]}>
        <View style={[styles.sheet, { backgroundColor: colors.surface }]}>
          <View style={[styles.header, { borderBottomColor: colors.border }]}>
            <View style={styles.flex}>
              <Text style={[styles.title, { color: colors.text }]}>{t('serialNumbers')}</Text>
              <Text style={[styles.subtitle, { color: colors.textMuted }]} numberOfLines={1}>
                {productName} · {availableUnits.length} {t('unitInStock').toLowerCase()}
              </Text>
            </View>
            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel={t('close')}
              style={styles.closeButton}
            >
              <X size={18} color={colors.textMuted} />
            </Pressable>
          </View>

          <View style={[styles.form, { borderBottomColor: colors.border }]}>
            <TextInput
              style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surfaceAlt }]}
              value={imei}
              onChangeText={text => setImei(text.replace(/[^0-9]/g, '').slice(0, 15))}
              placeholder="IMEI (15)"
              placeholderTextColor={colors.textSubtle}
              keyboardType="numeric"
              accessibilityLabel="IMEI"
            />
            <View style={styles.row}>
              <TextInput
                style={[styles.input, styles.flex, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surfaceAlt }]}
                value={imei2}
                onChangeText={text => setImei2(text.replace(/[^0-9]/g, '').slice(0, 15))}
                placeholder="IMEI 2"
                placeholderTextColor={colors.textSubtle}
                keyboardType="numeric"
                accessibilityLabel="IMEI 2"
              />
              <TextInput
                style={[styles.input, styles.flex, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surfaceAlt }]}
                value={cost}
                onChangeText={text => setCost(text.replace(/[^0-9]/g, ''))}
                placeholder={t('buyingPrice')}
                placeholderTextColor={colors.textSubtle}
                keyboardType="numeric"
                accessibilityLabel={t('buyingPrice')}
              />
            </View>
            <Button
              label={t('addImei')}
              onPress={submit}
              loading={saving}
              fullWidth
              icon={<Plus size={18} color={colors.textInverse} />}
            />
          </View>

          <ScrollView contentContainerStyle={styles.list}>
            {units.length === 0 ? (
              <EmptyState title={t('imeiList')} description={t('unitsRequired')} />
            ) : null}

            {units.map(unit => (
              <View
                key={unit.id}
                style={[styles.unitRow, { borderColor: colors.border, backgroundColor: colors.surfaceAlt }]}
              >
                <View style={styles.flex}>
                  <Text style={[styles.imeiText, { color: colors.text }]} selectable>
                    {unit.imei}
                  </Text>
                  <Text style={[styles.unitMeta, { color: colors.textMuted }]}>
                    {formatCurrency(unit.cost)}
                    {unit.imei2 ? ` · IMEI2 ${unit.imei2}` : ''}
                  </Text>
                </View>

                <Badge
                  label={unit.status === 'in_stock' ? t('unitInStock') : unit.status === 'sold' ? t('unitSold') : t('unitFaulty')}
                  tone={unit.status === 'in_stock' ? 'success' : unit.status === 'sold' ? 'info' : 'danger'}
                />

                {/* A sold handset stays on the record: deleting it would erase
                    the warranty and traceability trail the sale created. */}
                {unit.status === 'in_stock' ? (
                  <Pressable
                    onPress={() => confirmDelete(unit.id, unit.imei)}
                    accessibilityRole="button"
                    accessibilityLabel={`${t('delete')} ${unit.imei}`}
                    style={styles.deleteButton}
                  >
                    <Trash2 size={18} color={colors.danger} />
                  </Pressable>
                ) : null}
              </View>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    maxHeight: '90%',
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    width: '100%',
    maxWidth: 640,
    alignSelf: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  title: { fontSize: fontSize.xl, fontWeight: fontWeight.bold },
  subtitle: { fontSize: fontSize.sm, marginTop: 2 },
  closeButton: {
    width: MIN_TOUCH_TARGET,
    height: MIN_TOUCH_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
  },
  form: { padding: spacing.lg, gap: spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth },
  row: { flexDirection: 'row', gap: spacing.sm },
  input: {
    borderWidth: 1,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    minHeight: 46,
    fontSize: fontSize.md,
  },
  list: { padding: spacing.lg, gap: spacing.sm },
  unitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  imeiText: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, letterSpacing: 0.4 },
  unitMeta: { fontSize: fontSize.xs, marginTop: 2 },
  deleteButton: {
    width: MIN_TOUCH_TARGET,
    height: MIN_TOUCH_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flex: { flex: 1 },
});
