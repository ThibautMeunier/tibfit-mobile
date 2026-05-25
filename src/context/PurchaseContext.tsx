import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import Purchases, { LOG_LEVEL, PurchasesOfferings, PurchasesPackage } from 'react-native-purchases';

const RC_IOS_KEY = 'appl_RsMBwaAYrAplxrkRQmwPHmOufJN';

interface PurchaseContextValue {
  isPremium: boolean;
  offerings: PurchasesOfferings | null;
  paywallVisible: boolean;
  showPaywall: (onHide?: () => void) => void;
  hidePaywall: () => void;
  purchasePackage: (pkg: PurchasesPackage) => Promise<void>;
  restorePurchases: () => Promise<void>;
  refreshPremiumStatus: () => Promise<void>;
}

const PurchaseContext = createContext<PurchaseContextValue | null>(null);

export function PurchaseProvider({ children }: { children: React.ReactNode }) {
  const [isPremium, setIsPremium] = useState(false);
  const [offerings, setOfferings] = useState<PurchasesOfferings | null>(null);
  const [paywallVisible, setPaywallVisible] = useState(false);
  const onHideRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    Purchases.setLogLevel(LOG_LEVEL.ERROR);
    Purchases.configure({ apiKey: RC_IOS_KEY });
    _loadOfferings();
  }, []);

  async function _loadOfferings() {
    try {
      const o = await Purchases.getOfferings();
      setOfferings(o);
    } catch {}
  }

  const refreshPremiumStatus = useCallback(async () => {
    try {
      const info = await Purchases.getCustomerInfo();
      setIsPremium(typeof info.entitlements.active['pro'] !== 'undefined');
    } catch {}
  }, []);

  const purchasePackage = useCallback(async (pkg: PurchasesPackage) => {
    const { customerInfo } = await Purchases.purchasePackage(pkg);
    setIsPremium(typeof customerInfo.entitlements.active['pro'] !== 'undefined');
    setPaywallVisible(false);
  }, []);

  const restorePurchases = useCallback(async () => {
    const info = await Purchases.restorePurchases();
    setIsPremium(typeof info.entitlements.active['pro'] !== 'undefined');
    setPaywallVisible(false);
  }, []);

  return (
    <PurchaseContext.Provider value={{
      isPremium,
      offerings,
      paywallVisible,
      showPaywall: (onHide?: () => void) => {
        onHideRef.current = onHide ?? null;
        setPaywallVisible(true);
      },
      hidePaywall: () => {
        setPaywallVisible(false);
        const cb = onHideRef.current;
        onHideRef.current = null;
        cb?.();
      },
      purchasePackage,
      restorePurchases,
      refreshPremiumStatus,
    }}>
      {children}
    </PurchaseContext.Provider>
  );
}

export function usePurchase() {
  const ctx = useContext(PurchaseContext);
  if (!ctx) throw new Error('usePurchase must be used within PurchaseProvider');
  return ctx;
}

export async function identifyUserInRevenueCat(userId: number) {
  try {
    await Purchases.logIn(String(userId));
  } catch {}
}

export async function resetRevenueCatUser() {
  try {
    await Purchases.logOut();
  } catch {}
}
