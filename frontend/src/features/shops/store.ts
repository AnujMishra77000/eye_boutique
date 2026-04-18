import { getShopByKey, type ShopBrand, type ShopKey } from "@/features/shops/config";

const ACTIVE_SHOP_KEY = "eye_boutique_active_shop_key";

export function setActiveShop(shopKey: ShopKey) {
  localStorage.setItem(ACTIVE_SHOP_KEY, shopKey);
}

export function getActiveShopKey(): ShopKey | null {
  const raw = localStorage.getItem(ACTIVE_SHOP_KEY);
  const shop = getShopByKey(raw);
  return shop?.key ?? null;
}

export function getActiveShop(): ShopBrand | null {
  return getShopByKey(localStorage.getItem(ACTIVE_SHOP_KEY));
}

export function clearActiveShop() {
  localStorage.removeItem(ACTIVE_SHOP_KEY);
}
