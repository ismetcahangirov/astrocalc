import { useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import { reverseGeocode } from '../api/geocodingApi';
import { useTranslation } from '../i18n/LocaleContext';

/** The chosen point plus what reverse-geocoding could resolve for it. */
export interface MapPickResult {
  name: string;
  lat: number;
  lng: number;
  timezone: string;
}

interface BirthPlaceMapProps {
  visible: boolean;
  initialLat: number | null;
  initialLng: number | null;
  onCancel: () => void;
  onSelect: (result: MapPickResult) => void;
}

// Fallback view when no coordinates are set yet — roughly centered on Baku.
const DEFAULT_LAT = 40.4093;
const DEFAULT_LNG = 49.8671;

/**
 * Inline Leaflet page rendered in a WebView. Uses OpenStreetMap tiles — no API
 * key, consistent with the app's Nominatim/OSM geocoding — and posts the tapped
 * coordinates back to React Native.
 */
function buildHtml(lat: number, lng: number, zoom: number, withMarker: boolean): string {
  return `<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
<style>html,body,#map{height:100%;margin:0;padding:0;background:#0E0B14;}</style>
</head>
<body>
<div id="map"></div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
  var map = L.map('map', { zoomControl: true }).setView([${lat}, ${lng}], ${zoom});
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap contributors'
  }).addTo(map);
  var marker = ${withMarker ? `L.marker([${lat}, ${lng}]).addTo(map)` : 'null'};
  function post(latlng) {
    if (window.ReactNativeWebView) {
      window.ReactNativeWebView.postMessage(JSON.stringify({ lat: latlng.lat, lng: latlng.lng }));
    }
  }
  map.on('click', function (e) {
    if (marker) { marker.setLatLng(e.latlng); } else { marker = L.marker(e.latlng).addTo(map); }
    post(e.latlng);
  });
</script>
</body>
</html>`;
}

export function BirthPlaceMap({
  visible,
  initialLat,
  initialLng,
  onCancel,
  onSelect,
}: BirthPlaceMapProps) {
  const { t } = useTranslation();
  const [picked, setPicked] = useState<{ lat: number; lng: number } | null>(null);
  const [placeName, setPlaceName] = useState<string | null>(null);
  const [timezone, setTimezone] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);

  const hasInitial = initialLat != null && initialLng != null;
  const startLat = initialLat ?? DEFAULT_LAT;
  const startLng = initialLng ?? DEFAULT_LNG;
  const startZoom = hasInitial ? 10 : 3;

  // Rebuild the page each time the modal opens so it re-centers on the current value.
  const html = useMemo(
    () => buildHtml(startLat, startLng, startZoom, hasInitial),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [visible],
  );

  const onMessage = async (event: WebViewMessageEvent) => {
    let point: { lat: number; lng: number };
    try {
      point = JSON.parse(event.nativeEvent.data);
    } catch {
      return; // ignore anything that isn't a coordinate message
    }
    setPicked(point);
    setPlaceName(null);
    setTimezone(null);
    setLocating(true);
    try {
      const result = await reverseGeocode(point.lat, point.lng);
      setPlaceName(result.name);
      setTimezone(result.timezone);
    } catch {
      // Keep the coordinates; the name/zone just stay unknown (backend still
      // derives the authoritative zone on save).
    } finally {
      setLocating(false);
    }
  };

  const coordLabel = picked ? `${picked.lat.toFixed(4)}, ${picked.lng.toFixed(4)}` : '';

  const confirm = () => {
    if (!picked) return;
    onSelect({
      name: placeName ?? coordLabel,
      lat: picked.lat,
      lng: picked.lng,
      timezone: timezone ?? '',
    });
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onCancel}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>{t('birthPlaceMap.title')}</Text>
        </View>

        <WebView
          key={visible ? 'open' : 'closed'}
          originWhitelist={['*']}
          source={{ html }}
          onMessage={onMessage}
          style={styles.web}
        />

        <View style={styles.footer}>
          {picked ? (
            locating ? (
              <View style={styles.row}>
                <ActivityIndicator color={GOLD} />
                <Text style={styles.locating}>{t('birthPlaceMap.locating')}</Text>
              </View>
            ) : (
              <>
                <Text style={styles.placeName}>{placeName ?? coordLabel}</Text>
                {timezone ? (
                  <Text style={styles.tz}>
                    {t('birthPlaceMap.timezoneLabel')}: {timezone}
                  </Text>
                ) : null}
              </>
            )
          ) : (
            <Text style={styles.hint}>{t('birthPlaceMap.tapHint')}</Text>
          )}

          <View style={styles.actions}>
            <Pressable accessibilityRole="button" onPress={onCancel} style={styles.cancelBtn}>
              <Text style={styles.cancelText}>{t('common.cancel')}</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={confirm}
              disabled={!picked || locating}
              style={({ pressed }) => [
                styles.useBtn,
                pressed && styles.useBtnPressed,
                (!picked || locating) && styles.useBtnDisabled,
              ]}
            >
              <Text style={styles.useText}>{t('birthPlaceMap.use')}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const GOLD = '#E4B95B';
const BG = '#0E0B14';
const MUTED = '#6E6A80';

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  header: { paddingHorizontal: 20, paddingTop: 48, paddingBottom: 12 },
  title: { color: GOLD, fontSize: 18, fontWeight: '700' },
  web: { flex: 1, backgroundColor: BG },
  footer: { padding: 20, borderTopWidth: 1, borderTopColor: '#2C273F', gap: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  locating: { color: '#B9B4C7', fontSize: 14 },
  hint: { color: MUTED, fontSize: 14 },
  placeName: { color: '#F4F1FA', fontSize: 15, fontWeight: '600' },
  tz: { color: '#B9B4C7', fontSize: 13 },
  actions: { flexDirection: 'row', gap: 12 },
  cancelBtn: { flex: 1, paddingVertical: 14, alignItems: 'center', justifyContent: 'center' },
  cancelText: { color: '#B9B4C7', fontSize: 15, fontWeight: '600' },
  useBtn: {
    flex: 2,
    backgroundColor: GOLD,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  useBtnPressed: { opacity: 0.85 },
  useBtnDisabled: { opacity: 0.4 },
  useText: { color: '#1a1206', fontSize: 15, fontWeight: '700' },
});
