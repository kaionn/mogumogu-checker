import { useState, useCallback } from 'react'
import type { BabyProfile } from '../types'

const STORAGE_KEY = 'mogumogu-checker:profile'

const DEFAULT_PROFILE: BabyProfile = {
  months: 7,
  weight: 8.5,
  milkPerDay: 5,
  mealsPerDay: 2,
}

function loadProfile(): BabyProfile {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...DEFAULT_PROFILE }
    return { ...DEFAULT_PROFILE, ...JSON.parse(raw) }
  } catch {
    return { ...DEFAULT_PROFILE }
  }
}

export function useProfile() {
  const [profile, setProfileState] = useState<BabyProfile>(loadProfile)

  const setProfile = useCallback((p: BabyProfile) => {
    setProfileState(p)
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(p))
    } catch {}
  }, [])

  return { profile, setProfile }
}
