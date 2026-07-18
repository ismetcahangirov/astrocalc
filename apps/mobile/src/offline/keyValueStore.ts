import * as SecureStore from 'expo-secure-store';

/**
 * A minimal async string key/value store — the surface the offline chart cache
 * needs. Abstracted so the cache logic is pure and unit-testable with an
 * in-memory store, and so the concrete backing store can be swapped without
 * touching callers.
 */
export interface KeyValueStore {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

/**
 * {@link KeyValueStore} backed by `expo-secure-store` — already a dependency of
 * the app (it stores the auth tokens), so it needs no new native module and no
 * extra polyfills, in keeping with issue #20's constraint.
 *
 * Note: SecureStore warns for values larger than 2 KB on Android. A serialized
 * chart is usually a few KB, so if that limit ever bites, swap this adapter for
 * an `AsyncStorage`-backed one — the {@link KeyValueStore} contract is all the
 * cache depends on.
 */
export const secureKeyValueStore: KeyValueStore = {
  getItem: (key) => SecureStore.getItemAsync(key),
  setItem: (key, value) => SecureStore.setItemAsync(key, value),
  removeItem: (key) => SecureStore.deleteItemAsync(key),
};
