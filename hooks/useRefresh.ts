import { useState } from 'react';

/**
 * Pull-to-refresh helper. Pass the store load() calls to re-run on pull.
 * Returns { refreshing, onRefresh } for a <RefreshControl />.
 */
export function useRefresh(loaders: (() => Promise<any>)[]) {
  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all(loaders.map((l) => l().catch(() => {})));
    } finally {
      setRefreshing(false);
    }
  };
  return { refreshing, onRefresh };
}
