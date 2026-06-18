import AsyncStorage from '@react-native-async-storage/async-storage';

const ACCESS = 'access_token';
const REFRESH = 'refresh_token';

export async function saveTokens(access: string, refresh: string) {
  await AsyncStorage.multiSet([[ACCESS, access], [REFRESH, refresh]]);
}
export const getAccessToken = () => AsyncStorage.getItem(ACCESS);
export const getRefreshToken = () => AsyncStorage.getItem(REFRESH);
export async function clearTokens() {
  await AsyncStorage.multiRemove([ACCESS, REFRESH]);
}
