import 'react-native-gesture-handler';
import { useEffect } from 'react';
import { Alert } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ToastProvider } from '../src/components/Toast';
import { initCatalog, getCatalogSource, switchToSource } from '../src/catalog/catalogLoader';
import { syncTryDiscsCatalog } from '../src/catalog/catalogSync';
import { TRYDISCS_MANIFEST_URL } from '../src/catalog/constants';
import { getOrCreateDefaultUser, getMeta, setMeta } from '../src/db/db';

export default function RootLayout() {
  // Swap in a previously-selected catalog if one exists (catalog-v2-scope.md). Never blocks
  // render. Once restored, offer the first-run catalog download exactly once, only if no catalog
  // is selected ('bundled' is the internal name for that; the app ships no disc data). Matches
  // "explicit, never automatic" for anything that touches the network.
  useEffect(() => {
    (async () => {
      await initCatalog();
      if (getCatalogSource() !== 'bundled') return;

      const uid = await getOrCreateDefaultUser();
      const meta = await getMeta(uid);
      if (meta.catalogPromptShown) return;

      Alert.alert(
        'No disc list yet',
        "Disc Tracker doesn't come with a disc list. Download the Try Discs catalog to autofill flight numbers and get library suggestions? It's a one-time download. You can change this in Settings → Disc catalog.",
        [
          { text: 'Not now', style: 'cancel', onPress: () => setMeta(uid, { catalogPromptShown: true }) },
          {
            text: 'Download',
            onPress: async () => {
              try {
                const { manifest } = await syncTryDiscsCatalog(TRYDISCS_MANIFEST_URL);
                await switchToSource('trydiscs');
                await setMeta(uid, {
                  catalogPromptShown: true,
                  catalogVersion: manifest.catalogVersion,
                  catalogDatasetVersion: manifest.datasetVersion,
                  catalogHash: manifest.sha256,
                });
              } catch {
                // No catalog stays selected. Alert, not toast: this effect sits outside ToastProvider.
                await setMeta(uid, { catalogPromptShown: true });
                Alert.alert('Download failed', 'You can try again in Settings → Disc catalog.');
              }
            },
          },
        ]
      );
    })();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar style="light" />
        <ToastProvider>
          <Stack screenOptions={{ headerShown: false }} />
        </ToastProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
