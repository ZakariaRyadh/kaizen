import { createMaterialTopTabNavigator } from '@react-navigation/material-top-tabs';
import type {
  MaterialTopTabNavigationEventMap,
  MaterialTopTabNavigationOptions,
} from '@react-navigation/material-top-tabs';
import type { ParamListBase, TabNavigationState } from '@react-navigation/native';
import { withLayoutContext } from 'expo-router';
import { useEffect } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon, IconName } from '../../components/Icon';
import { useEvents } from '../../store/events';
import { useGym } from '../../store/gym';
import { useNotes } from '../../store/notes';
import { useSettings } from '../../store/settings';
import { useTasks } from '../../store/tasks';
import { useAccent, withAlpha } from '../../theme/AccentContext';
import { colors, fonts } from '../../theme/colors';

// Wrap the material-top-tab navigator so expo-router's file routing drives it.
// Bottom position + swipeEnabled = swipe left/right between screens.
const { Navigator } = createMaterialTopTabNavigator();
const SwipeTabs = withLayoutContext<
  MaterialTopTabNavigationOptions,
  typeof Navigator,
  TabNavigationState<ParamListBase>,
  MaterialTopTabNavigationEventMap
>(Navigator);

const TABS: { name: string; label: string; icon: IconName }[] = [
  { name: 'index', label: 'Home', icon: 'home' },
  { name: 'gym', label: 'Gym', icon: 'gym' },
  { name: 'calendar', label: 'Calendar', icon: 'calendar' },
  { name: 'notes', label: 'Notes', icon: 'notes' },
  { name: 'settings', label: 'Settings', icon: 'settings' },
];

// Custom bottom bar drawn to match the design (icon pill + tiny label).
function BottomBar({ state, navigation }: any) {
  const { accent } = useAccent();
  const insets = useSafeAreaInsets();
  return (
    <View
      style={{
        flexDirection: 'row',
        paddingTop: 8,
        paddingBottom: 12 + insets.bottom,
        backgroundColor: 'rgba(14,14,19,0.96)',
        borderTopColor: colors.border,
        borderTopWidth: 1,
      }}
    >
      {state.routes.map((route: any, i: number) => {
        const focused = state.index === i;
        const tab = TABS.find((t) => t.name === route.name)!;
        const color = focused ? accent : colors.textDim;
        return (
          <Pressable
            key={route.key}
            onPress={() => navigation.navigate(route.name)}
            style={{ flex: 1, alignItems: 'center', gap: 5, paddingVertical: 4 }}
          >
            <View
              style={{
                width: 46,
                height: 30,
                borderRadius: 11,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: focused ? withAlpha(accent, 16) : 'transparent',
              }}
            >
              <Icon name={tab.icon} size={22} color={color} />
            </View>
            <Text style={{ fontSize: 10, fontWeight: '600', color, fontFamily: fonts.uiSemi }}>
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export default function TabsLayout() {
  const { setAccent } = useAccent();

  // load all of this account's data once when the app opens
  useEffect(() => {
    useTasks.getState().load().catch(() => {});
    useNotes.getState().load().catch(() => {});
    useEvents.getState().load().catch(() => {});
    useGym.getState().load().catch(() => {});
    useSettings
      .getState()
      .load()
      .then(({ accent }) => {
        if (accent) setAccent(accent); // apply saved accent app-wide
      })
      .catch(() => {});
  }, []);

  return (
    <SwipeTabs
      tabBarPosition="bottom"
      tabBar={(props) => <BottomBar {...props} />}
      screenOptions={{ swipeEnabled: true, lazy: true }}
    >
      <SwipeTabs.Screen name="index" />
      <SwipeTabs.Screen name="gym" />
      <SwipeTabs.Screen name="calendar" />
      <SwipeTabs.Screen name="notes" />
      <SwipeTabs.Screen name="settings" />
    </SwipeTabs>
  );
}
