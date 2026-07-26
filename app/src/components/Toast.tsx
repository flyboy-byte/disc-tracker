// Lightweight success/feedback toast — the app equivalent of the website's toast() (index.html),
// which acknowledges 12+ actions (disc added/updated/removed, order saved, bag cleared, CSV
// imported/exported, and error cases). A ToastProvider mounted at the app root exposes a
// `useToast()` -> show(message) that any screen can call. Auto-dismisses; non-interactive.
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../theme';

type ShowToast = (message: string) => void;

const ToastContext = createContext<ShowToast>(() => {});
export const useToast = () => useContext(ToastContext);

export function ToastProvider({ children }: { children: ReactNode }) {
  // Keyed by id so the same message fired twice in a row still re-triggers the animation.
  const [toast, setToast] = useState<{ text: string; id: number } | null>(null);
  const opacity = useRef(new Animated.Value(0)).current;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const insets = useSafeAreaInsets();

  const show = useCallback((text: string) => setToast({ text, id: Date.now() }), []);

  useEffect(() => {
    if (!toast) return;
    Animated.timing(opacity, { toValue: 1, duration: 150, useNativeDriver: true }).start();
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      Animated.timing(opacity, { toValue: 0, duration: 250, useNativeDriver: true }).start(({ finished }) => {
        if (finished) setToast(null);
      });
    }, 1900);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toast?.id]);

  return (
    <ToastContext.Provider value={show}>
      {children}
      {toast && (
        <Animated.View pointerEvents="none" style={[styles.wrap, { opacity, bottom: insets.bottom + 72 }]}>
          <View style={styles.toast}>
            <Text style={styles.text}>{toast.text}</Text>
          </View>
        </Animated.View>
      )}
    </ToastContext.Provider>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  toast: {
    maxWidth: '86%',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.accent,
    borderRadius: 999,
    paddingHorizontal: 18,
    paddingVertical: 10,
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 6,
  },
  text: { color: colors.text, fontSize: 13, fontWeight: '600', textAlign: 'center' },
});
