'use client';

import { useEffect } from 'react';
import { useAppStore } from '@/store/appStore';

/** Loads persisted contacts/settings from localStorage after the first client render. */
export default function StoreHydration() {
  useEffect(() => {
    try {
      useAppStore.persist.rehydrate();
    } catch (err) {
      console.warn('Could not restore saved settings:', err);
    }
  }, []);
  return null;
}
