/**
 * Capacitor Native API Wrappers
 * Provides native functionality when running in Capacitor (Android),
 * and graceful fallbacks when running as a regular web app.
 */

let _isNative = false;
let _StatusBar = null;
let _Haptics = null;
let _SplashScreen = null;
let _Keyboard = null;

/**
 * Initialize Capacitor plugins. Call once at app startup.
 */
export async function initCapacitor() {
  try {
    const { Capacitor } = await import('@capacitor/core');
    _isNative = Capacitor.isNativePlatform();
    
    if (!_isNative) return;

    // Import plugins only on native
    const [statusBarMod, hapticsMod, splashMod, keyboardMod] = await Promise.allSettled([
      import('@capacitor/status-bar'),
      import('@capacitor/haptics'),
      import('@capacitor/splash-screen'),
      import('@capacitor/keyboard'),
    ]);

    if (statusBarMod.status === 'fulfilled') _StatusBar = statusBarMod.value.StatusBar;
    if (hapticsMod.status === 'fulfilled') _Haptics = hapticsMod.value.Haptics;
    if (splashMod.status === 'fulfilled') _SplashScreen = splashMod.value.SplashScreen;
    if (keyboardMod.status === 'fulfilled') _Keyboard = keyboardMod.value.Keyboard;

    // Setup transparent status bar
    if (_StatusBar) {
      await _StatusBar.setOverlaysWebView({ overlay: true });
      await _StatusBar.setBackgroundColor({ color: '#00000000' });
      await _StatusBar.setStyle({ style: 'DARK' });
    }

    // Hide splash screen
    if (_SplashScreen) {
      await _SplashScreen.hide();
    }

    // Add liquid-glass class to body for mobile-only CSS
    document.body.classList.add('liquid-glass');
    
    // Add safe area CSS variables
    document.documentElement.style.setProperty('--safe-area-top', 'env(safe-area-inset-top)');
    document.documentElement.style.setProperty('--safe-area-bottom', 'env(safe-area-inset-bottom)');

    console.log('[Capacitor] Native platform initialized');
  } catch (err) {
    console.log('[Capacitor] Running as web app:', err.message);
    _isNative = false;
  }
}

/** Check if running on native platform */
export function isNative() {
  return _isNative;
}

/** Trigger haptic impact feedback */
export async function hapticImpact(style = 'Medium') {
  if (!_Haptics || !_isNative) return;
  try {
    await _Haptics.impact({ style });
  } catch { /* ignore */ }
}

/** Trigger haptic notification feedback */
export async function hapticNotification(type = 'SUCCESS') {
  if (!_Haptics || !_isNative) return;
  try {
    await _Haptics.notification({ type });
  } catch { /* ignore */ }
}

/** Trigger light haptic selection feedback */
export async function hapticSelection() {
  if (!_Haptics || !_isNative) return;
  try {
    await _Haptics.selectionStart();
    await _Haptics.selectionChanged();
    await _Haptics.selectionEnd();
  } catch { /* ignore */ }
}

/** Set status bar style (DARK or LIGHT) */
export async function setStatusBarStyle(style) {
  if (!_StatusBar || !_isNative) return;
  try {
    await _StatusBar.setStyle({ style });
  } catch { /* ignore */ }
}

/** Keep screen awake (for focus timer) */
let _wakeLock = null;
export async function keepScreenAwake() {
  try {
    if ('wakeLock' in navigator) {
      _wakeLock = await navigator.wakeLock.request('screen');
    }
  } catch { /* ignore */ }
}

/** Release screen wake lock */
export async function releaseScreenAwake() {
  try {
    if (_wakeLock) {
      await _wakeLock.release();
      _wakeLock = null;
    }
  } catch { /* ignore */ }
}
