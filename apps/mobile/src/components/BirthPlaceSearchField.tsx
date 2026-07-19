import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { ApiError, searchPlaces, type PlaceResult } from '../api/geocodingApi';
import { useTranslation } from '../i18n/LocaleContext';
import { BirthPlaceMap, type MapPickResult } from './BirthPlaceMap';

const SEARCH_DEBOUNCE_MS = 350;

export interface BirthPlaceValue {
  name: string;
  lat: number | null;
  lng: number | null;
  timezone: string;
}

interface BirthPlaceSearchFieldProps {
  value: BirthPlaceValue;
  onChange: (value: BirthPlaceValue) => void;
}

/**
 * Birth-place autocomplete (#8): searches the offline AZ gazetteer + Nominatim
 * fallback (`GET /geocoding/search`) as the user types, lets them pick a
 * result (fills name/lat/lng), and offers a manual lat/lng/timezone fallback
 * for places the search doesn't find — the geocoding service's own contract
 * for an empty result set. Shared by the onboarding flow (#6) and the
 * profile-edit screen (#7).
 */
export function BirthPlaceSearchField({ value, onChange }: BirthPlaceSearchFieldProps) {
  const { t } = useTranslation();
  const [query, setQuery] = useState(value.name);
  const [results, setResults] = useState<PlaceResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [mapOpen, setMapOpen] = useState(false);
  const requestId = useRef(0);

  useEffect(() => {
    // Only search once the query diverges from the already-selected place —
    // avoids re-searching immediately after picking a result.
    if (query.trim() === '' || query === value.name) {
      setResults([]);
      setSearched(false);
      return;
    }

    const id = ++requestId.current;
    const timer = setTimeout(async () => {
      setLoading(true);
      setError(false);
      try {
        const found = await searchPlaces(query);
        if (requestId.current === id) {
          setResults(found);
          setSearched(true);
        }
      } catch (err) {
        if (requestId.current === id) {
          setResults([]);
          setSearched(true);
          setError(err instanceof ApiError);
        }
      } finally {
        if (requestId.current === id) setLoading(false);
      }
    }, SEARCH_DEBOUNCE_MS);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const selectResult = (result: PlaceResult) => {
    setQuery(result.name);
    setResults([]);
    setSearched(false);
    onChange({ ...value, name: result.name, lat: result.lat, lng: result.lng });
  };

  const onQueryChange = (text: string) => {
    setQuery(text);
    onChange({ ...value, name: text });
  };

  const onMapSelect = (result: MapPickResult) => {
    setQuery(result.name);
    setResults([]);
    setSearched(false);
    setMapOpen(false);
    onChange({
      name: result.name,
      lat: result.lat,
      lng: result.lng,
      timezone: result.timezone,
    });
  };

  return (
    <View>
      <TextInput
        style={styles.input}
        value={query}
        onChangeText={onQueryChange}
        placeholder={t('birthPlaceSearch.placeholder')}
        placeholderTextColor={MUTED}
      />

      {loading ? (
        <View style={styles.statusRow}>
          <ActivityIndicator size="small" color={GOLD} />
        </View>
      ) : null}

      {!loading && results.length > 0 ? (
        <View style={styles.results}>
          {results.map((result) => (
            <Pressable
              key={result.id}
              accessibilityRole="button"
              onPress={() => selectResult(result)}
              style={({ pressed }) => [styles.resultRow, pressed && styles.resultRowPressed]}
            >
              <Text style={styles.resultName}>{result.name}</Text>
              {result.region ? <Text style={styles.resultRegion}>{result.region}</Text> : null}
            </Pressable>
          ))}
        </View>
      ) : null}

      {!loading && searched && results.length === 0 ? (
        <Text style={styles.hint}>
          {error ? t('birthPlaceSearch.error') : t('birthPlaceSearch.noResults')}
        </Text>
      ) : null}

      <View style={styles.linkRow}>
        <Pressable accessibilityRole="button" onPress={() => setMapOpen(true)}>
          <Text style={styles.link}>{t('birthPlaceSearch.pickOnMap')}</Text>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={() => setManualOpen((open) => !open)}>
          <Text style={styles.link}>
            {t(manualOpen ? 'birthPlaceSearch.manualHide' : 'birthPlaceSearch.manualToggle')}
          </Text>
        </Pressable>
      </View>

      {manualOpen ? (
        <View style={styles.manualFields}>
          <TextInput
            style={styles.input}
            value={value.lat != null ? String(value.lat) : ''}
            onChangeText={(v) => onChange({ ...value, lat: v.trim() === '' ? null : Number(v) })}
            placeholder={t('profile.birthPlaceLat.placeholder')}
            placeholderTextColor={MUTED}
            keyboardType="numeric"
          />
          <TextInput
            style={[styles.input, styles.inputSpaced]}
            value={value.lng != null ? String(value.lng) : ''}
            onChangeText={(v) => onChange({ ...value, lng: v.trim() === '' ? null : Number(v) })}
            placeholder={t('profile.birthPlaceLng.placeholder')}
            placeholderTextColor={MUTED}
            keyboardType="numeric"
          />
        </View>
      ) : null}

      <BirthPlaceMap
        visible={mapOpen}
        initialLat={value.lat}
        initialLng={value.lng}
        onCancel={() => setMapOpen(false)}
        onSelect={onMapSelect}
      />
    </View>
  );
}

const GOLD = '#E4B95B';
const MUTED = '#6E6A80';

const styles = StyleSheet.create({
  input: {
    backgroundColor: '#181329',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2C273F',
    color: '#F4F1FA',
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
  inputSpaced: { marginTop: 10 },
  statusRow: { marginTop: 8, alignItems: 'flex-start' },
  results: {
    marginTop: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2C273F',
    overflow: 'hidden',
  },
  resultRow: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: '#181329',
    borderBottomWidth: 1,
    borderBottomColor: '#2C273F',
  },
  resultRowPressed: { opacity: 0.7 },
  resultName: { color: '#F4F1FA', fontSize: 14, fontWeight: '600' },
  resultRegion: { color: MUTED, fontSize: 12, marginTop: 2 },
  hint: { color: MUTED, fontSize: 13, marginTop: 8 },
  linkRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
    gap: 16,
  },
  link: { color: GOLD, fontSize: 13, fontWeight: '600' },
  manualFields: { marginTop: 10 },
});
