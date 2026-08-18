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
  // render — the bundled fallback is already active synchronously, this only upgrades it.
  // Once restored, offer the first-run "want the bigger catalog?" prompt exactly once — only
  // if the user is still on the bundled default, matching "explicit, never automatic" for
  // anything that touches the network.
  useEffect(() => {
    (async () => {
      await initCatalog();
      if (getCatalogSource() !== 'bundled') return;

      const uid = await getOrCreateDefaultUser();
      const meta = await getMeta(uid);
      if (meta.catalogPromptShown) return;

      Alert.alert(
        'Bigger disc catalog available',
        'Try Discs offers an expanded catalog (1,874 discs vs. the built-in 1,660). Download and switch to it now? You can change this anytime in Settings → Disc Catalog.',
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
                // Stay on bundled — the user can retry from Settings anytime.
                await setMeta(uid, { catalogPromptShown: true });
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
