import { useEffect, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

import { SwipeSheet } from './SwipeSheet';
import { useAccent } from '../theme/AccentContext';
import { colors, fonts } from '../theme/colors';

export function WeightSheet({
  visible,
  suggested,
  onClose,
  onSave,
}: {
  visible: boolean;
  suggested?: number;
  onClose: () => void;
  onSave: (kg: number) => void;
}) {
  const { accent } = useAccent();
  const [value, setValue] = useState('');

  useEffect(() => {
    if (visible) setValue(suggested ? String(suggested) : '');
  }, [visible, suggested]);

  const save = () => {
    const kg = parseFloat(value.replace(',', '.'));
    if (!kg || kg <= 0) return;
    onSave(Math.round(kg * 10) / 10);
    onClose();
  };

  return (
    <SwipeSheet visible={visible} onClose={onClose}>
      <Text style={{ fontSize: 19, color: colors.text, fontFamily: fonts.uiBold }}>Log body weight</Text>
      <Text style={{ fontSize: 13, color: colors.textDim, fontFamily: fonts.ui, marginTop: 4, marginBottom: 18 }}>
        Today’s measurement
      </Text>

      <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, borderWidth: 1, borderColor: colors.borderSoft, borderRadius: 16, paddingHorizontal: 16 }}>
        <TextInput
          value={value}
          onChangeText={setValue}
          placeholder="00.0"
          placeholderTextColor={colors.textFaint}
          keyboardType="decimal-pad"
          style={{ flex: 1, color: colors.text, fontFamily: fonts.monoSemi, fontSize: 30, paddingVertical: 16 }}
        />
        <Text style={{ color: colors.textMuted, fontFamily: fonts.uiSemi, fontSize: 18 }}>kg</Text>
      </View>

      <Pressable onPress={save} style={{ backgroundColor: accent, borderRadius: 14, paddingVertical: 15, alignItems: 'center', marginTop: 18 }}>
        <Text style={{ color: '#fff', fontFamily: fonts.uiBold, fontSize: 15 }}>Save</Text>
      </Pressable>
    </SwipeSheet>
  );
}
