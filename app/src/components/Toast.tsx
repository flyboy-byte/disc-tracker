// Lightweight success/feedback toast — the app equivalent of the website's toast() (index.html),
// which acknowledges 12+ actions (disc added/updated/removed, order saved, bag cleared, CSV
// imported/exported, and error cases). A ToastProvider mounted at the app root exposes a
// `useToast()` -> show(message) that any screen can call. Auto-dismisses; non-interactive.
//
// An optional second argument adds ONE action button (UX_AUDIT.md D3's swipe undo). Deliberately
// still the same component rather than a second Snackbar vocabulary — see A1 on this app already
// having too many treatments for one job. The properties that keep it from being annoying are
// all preserved for action toasts too:
//   • absolutely positioned overlay — showing one never reflows the list underneath
//   • only ever one on screen — a new toast replaces (and re-times) the current one, no stacking
//     or queueing, so a run of quick swipes leaves one small pill rather than a growing pile
//   • nothing outside the pill captures touches, so the list stays scrollable/tappable while
//     a toast is up (`box-none` on the wrapper; only the pill itself is interactive)
//   • auto-dismisses — 1.9s plain, 4s with an action (long enough to notice and reach, short
//     enough that it isn't sitting there during a swipe spree)
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../theme';

export interface ToastAction {
  label: string;
  onPress: () => void;
}

type ShowToast = (message: string, action?: ToastAction) => void;

const PLAIN_MS = 1900;
const ACTION_MS = 4000;

const ToastContext = createContext<ShowToast>(() => {});
export const useToast = () => useContext(ToastContext);

export function ToastProvider({ children }: { children: ReactNode }) {
  // Keyed by id so the same message fired twice in a row still re-triggers the animation.
  const [toast, setToast] = useState<{ text: string; id: number; action?: ToastAction } | null>(null);
  const opacity = useRef(new Animated.Value(0)).current;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const insets = useSafeAreaInsets();

  const show = useCallback((text: string, action?: ToastAction) => setToast({ text, id: Date.now(), action }), []);

  const dismiss = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    Animated.timing(opacity, { toValue: 0, duration: 250, useNativeDriver: true }).start(({ finished }) => {
      if (finished) setToast(null);
    });
  }, [opacity]);

  useEffect(() => {
    if (!toast) return;
    Animated.timing(opacity, { toValue: 1, duration: 150, useNativeDriver: true }).start();
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      Animated.timing(opacity, { toValue: 0, duration: 250, useNativeDriver: true }).start(({ finished }) => {
        if (finished) setToast(null);
      });
    }, toast.action ? ACTION_MS : PLAIN_MS);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toast?.id]);

  const action = toast?.action;

  return (
    <ToastContext.Provider value={show}>
      {children}
      {toast && (
        <Animated.View
          // box-none: the wrapper spans the screen width, so it must never swallow touches
          // meant for the list behind it — only the pill (and, in practice, only its action
          // button) is interactive.
          pointerEvents={action ? 'box-none' : 'none'}
          style={[styles.wrap, { opacity, bottom: insets.bottom + 72 }]}
        >
          <View style={[styles.toast, action && styles.toastWithAction]} pointerEvents={action ? 'auto' : 'none'}>
            <Text style={[styles.text, action && styles.textWithAction]} numberOfLines={1}>
              {toast.text}
            </Text>
            {action && (
              <Pressable
                onPress={() => {
                  action.onPress();
                  dismiss();
                }}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel={action.label}
              >
                <Text style={styles.actionText}>{action.label}</Text>
              </Pressable>
            )}
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
  toastWithAction: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingRight: 16 },
  text: { color: colors.text, fontSize: 13, fontWeight: '600', textAlign: 'center' },
  // Left-aligned and shrinkable once there's a button beside it, so a long disc name truncates
  // instead of pushing the action off the pill.
  textWithAction: { textAlign: 'left', flexShrink: 1 },
  actionText: { color: colors.accent, fontSize: 13, fontWeight: '800', letterSpacing: 0.5 },
});
