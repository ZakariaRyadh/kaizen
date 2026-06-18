import { SafeAreaView } from 'react-native-safe-area-context';
import { Text, View } from 'react-native';

import { colors, fonts } from '../theme/colors';

// temporary placeholder until each screen is built
export function Stub({ title }: { title: string }) {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.canvas }} edges={['top']}>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: colors.text, fontFamily: fonts.uiBold, fontSize: 26 }}>
          {title}
        </Text>
        <Text style={{ color: colors.textDim, fontFamily: fonts.ui, marginTop: 6 }}>
          coming next
        </Text>
      </View>
    </SafeAreaView>
  );
}
