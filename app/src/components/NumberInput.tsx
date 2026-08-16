// Controlled numeric TextInput that tolerates in-progress text ("-", "", "-.", ".").
//
// A naive `parseFloat(text) || 0` on a *controlled* numeric input swallows a leading
// minus: parseFloat("-") is NaN -> 0, so the field snaps straight back to "0" and you can
// never type a negative turn (the common case for understable discs). We hold the raw
// string locally, only push a parsed number up once the text is a valid number, and coerce
// to a number on blur. Fixes punch-list P0-1; used by DiscFormModal and Flight Shaper.
import { useEffect, useRef, useState } from 'react';
import { type StyleProp, TextInput, type TextStyle } from 'react-native';
import { colors } from '../theme';
import { coerceNumber, isIncompleteNumber } from '../utils/numberField';

interface Props {
  value: number;
  onChangeValue: (n: number) => void;
  style?: StyleProp<TextStyle>;
  testID?: string;
}

export default function NumberInput({ value, onChangeValue, style, testID }: Props) {
  const [text, setText] = useState(() => String(value));
  // Tracks the numeric value we last reconciled, so we can tell an external change
  // (library autofill, disc swap) apart from our own keystroke echo and only re-seed the
  // text on the former.
  const last = useRef(value);

  useEffect(() => {
    if (value !== last.current) {
      last.current = value;
      setText(String(value));
    }
  }, [value]);

  const handle = (t: string) => {
    setText(t);
    if (isIncompleteNumber(t)) return; // mid-entry — let the user keep typing before coercing
    const n = parseFloat(t);
    if (!Number.isNaN(n)) {
      last.current = n;
      onChangeValue(n);
    }
  };

  const blur = () => {
    const final = coerceNumber(text);
    last.current = final;
    setText(String(final));
    onChangeValue(final);
  };

  return (
    <TextInput
      testID={testID}
      style={style}
      value={text}
      onChangeText={handle}
      onBlur={blur}
      keyboardType="numeric"
      placeholderTextColor={colors.muted}
    />
  );
}
