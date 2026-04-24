export interface ProductImageAsset {
  id: string;
  url: string;
  filename?: string | null;
  createdAt?: string;
}

let cachedAssets: ProductImageAsset[] | null = null;
let cachedAssetsPromise: Promise<ProductImageAsset[]> | null = null;

export function invalidateProductImagesCache() {
  cachedAssets = null;
  cachedAssetsPromise = null;
}

export function getCachedProductImages(): ProductImageAsset[] | null {
  return cachedAssets;
}

export async function fetchProductImages(): Promise<ProductImageAsset[]> {
  if (cachedAssets) return cachedAssets;

  if (!cachedAssetsPromise) {
    cachedAssetsPromise = fetch("/api/images", { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) {
          return { assets: [] as ProductImageAsset[] };
        }
        return (await res.json()) as { assets?: ProductImageAsset[] };
      })
      .then((data) => {
        cachedAssets = data?.assets ?? [];
        return cachedAssets;
      })
      .catch(() => {
        cachedAssets = [];
        return [];
      })
      .finally(() => {
        cachedAssetsPromise = null;
      });
  }

  return cachedAssetsPromise;
}
