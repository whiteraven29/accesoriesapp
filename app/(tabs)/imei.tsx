import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TextInput, View } from 'react-native';
import { ScanLine, ShieldCheck, ShieldX } from 'lucide-react-native';
import { Badge, Card, EmptyState } from '../../components/ui';
import { Screen, ScreenHeader } from '../../components/Screen';
import { fontSize, fontWeight, radius, spacing } from '../../constants/theme';
import { useLanguage } from '../../hooks/LanguageContext';
import { ProductUnit, UnitStatus, lookupImei } from '../../hooks/useProductUnits';
import { useTheme } from '../../hooks/useTheme';
import { formatCurrency } from '../../utils/currency';

const STATUS_TONE: Record<UnitStatus, 'success' | 'info' | 'warning' | 'danger' | 'neutral'> = {
  in_stock: 'success',
  sold: 'info',
  returned: 'warning',
  faulty: 'danger',
  written_off: 'neutral',
};

const STATUS_KEY: Record<UnitStatus, string> = {
  in_stock: 'unitInStock',
  sold: 'unitSold',
  returned: 'unitReturned',
  faulty: 'unitFaulty',
  written_off: 'recordLoss',
};

/**
 * IMEI lookup.
 *
 * A customer walks in holding a handset: the shop needs to know whether it sold
 * it, when, to whom, and whether it is still under warranty. The product search
 * only covered name/brand/category, so that question had no answer.
 */
export default function ImeiScreen() {
  const { t } = useLanguage();
  const { colors } = useTheme();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ProductUnit[]>([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);

  const styles = useMemo(() => createStyles(colors.border), [colors.border]);

  const runSearch = useCallback(async (term: string) => {
    if (term.trim().length < 4) {
      setResults([]);
      setSearched(false);
      return;
    }
    setSearching(true);
    const found = await lookupImei(term);
    setResults(found);
    setSearched(true);
    setSearching(false);
  }, []);

  // Debounced so a 15-digit IMEI typed at the counter is one request, not
  // fifteen — meaningful on a metered mobile connection.
  useEffect(() => {
    const timer = setTimeout(() => runSearch(query), 350);
    return () => clearTimeout(timer);
  }, [query, runSearch]);

  return (
    <Screen measure="standard" scroll>
      <ScreenHeader title={t('imeiLookup')} subtitle={t('searchByImei')} />

      <View style={[styles.searchRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <ScanLine size={18} color={colors.textSubtle} />
        <TextInput
          style={[styles.input, { color: colors.text }]}
          value={query}
          onChangeText={setQuery}
          placeholder={t('searchByImei')}
          placeholderTextColor={colors.textSubtle}
          keyboardType="numeric"
          autoCorrect={false}
          accessibilityLabel={t('imeiLookup')}
          returnKeyType="search"
        />
        {searching ? <ActivityIndicator size="small" color={colors.primary} /> : null}
      </View>

      {!searched && !searching ? (
        <EmptyState
          icon={<ScanLine size={40} color={colors.textSubtle} />}
          title={t('imeiLookup')}
          description={t('searchByImei')}
        />
      ) : null}

      {searched && results.length === 0 && !searching ? (
        <EmptyState
          icon={<ShieldX size={40} color={colors.textSubtle} />}
          title={t('imeiNotFound')}
        />
      ) : null}

      <View style={styles.list}>
        {results.map(unit => {
          // A warranty date in the past is worse than no date: it invites a
          // claim the shop will refuse at the counter.
          const underWarranty =
            Boolean(unit.warrantyUntil) && new Date(unit.warrantyUntil as string) >= new Date();

          return (
            <Card key={unit.id} style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.flex}>
                  <Text style={[styles.imei, { color: colors.text }]} selectable>
                    {unit.imei}
                  </Text>
                  <Text style={[styles.product, { color: colors.textMuted }]}>
                    {[unit.productBrand, unit.productName].filter(Boolean).join(' · ') || '—'}
                  </Text>
                </View>
                <Badge label={t(STATUS_KEY[unit.status])} tone={STATUS_TONE[unit.status]} />
              </View>

              <View style={[styles.meta, { borderTopColor: colors.border }]}>
                {unit.imei2 ? (
                  <Text style={[styles.metaText, { color: colors.textMuted }]}>
                    IMEI 2: {unit.imei2}
                  </Text>
                ) : null}
                {unit.soldAt ? (
                  <Text style={[styles.metaText, { color: colors.textMuted }]}>
                    {t('soldOn')}: {new Date(unit.soldAt).toLocaleDateString()}
                  </Text>
                ) : null}
                <Text style={[styles.metaText, { color: colors.textMuted }]}>
                  {t('cost')}: {formatCurrency(unit.cost)}
                </Text>

                {unit.warrantyUntil ? (
                  <View style={styles.warrantyRow}>
                    {underWarranty ? (
                      <ShieldCheck size={15} color={colors.success} />
                    ) : (
                      <ShieldX size={15} color={colors.danger} />
                    )}
                    <Text
                      style={[
                        styles.metaText,
                        { color: underWarranty ? colors.success : colors.danger },
                      ]}
                    >
                      {underWarranty ? t('warrantyValid') : t('warrantyExpired')} ·{' '}
                      {new Date(unit.warrantyUntil).toLocaleDateString()}
                    </Text>
                  </View>
                ) : null}
              </View>
            </Card>
          );
        })}
      </View>
    </Screen>
  );
}

const createStyles = (border: string) =>
  StyleSheet.create({
    searchRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      borderWidth: 1,
      borderColor: border,
      borderRadius: radius.md,
      paddingHorizontal: spacing.md,
      minHeight: 52,
    },
    input: { flex: 1, fontSize: fontSize.lg, letterSpacing: 1, paddingVertical: spacing.md },
    list: { gap: spacing.md, marginTop: spacing.lg },
    card: { gap: spacing.md },
    cardHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
    flex: { flex: 1 },
    imei: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, letterSpacing: 0.5 },
    product: { fontSize: fontSize.sm, marginTop: 2 },
    meta: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: spacing.md, gap: spacing.xs },
    metaText: { fontSize: fontSize.sm },
    warrantyRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  });
