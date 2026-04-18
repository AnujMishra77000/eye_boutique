export type ShopKey = "aadarsh-eye-boutique-center" | "adarsh-optometric-center" | "adarsh-optical-center";

export type ShopBrand = {
  key: ShopKey;
  name: string;
  phone: string;
};

export const SHOP_BRANDS: ShopBrand[] = [
  {
    key: "aadarsh-eye-boutique-center",
    name: "Aadarsh Eye Boutique Center",
    phone: "9082967356"
  },
  {
    key: "adarsh-optometric-center",
    name: "Adarsh Optometric Center",
    phone: "6124157631"
  },
  {
    key: "adarsh-optical-center",
    name: "Adarsh Optical Center",
    phone: "6124157622"
  }
];

export function normalizePhone(input: string): string {
  return input.replace(/\D/g, "");
}

export function getShopByKey(key: string | null): ShopBrand | null {
  if (!key) {
    return null;
  }
  return SHOP_BRANDS.find((shop) => shop.key === key) ?? null;
}

export function getShopByPhone(phone: string): ShopBrand | null {
  const normalized = normalizePhone(phone);
  return SHOP_BRANDS.find((shop) => normalizePhone(shop.phone) === normalized) ?? null;
}
