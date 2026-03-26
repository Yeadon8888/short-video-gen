"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, CheckSquare, ImageIcon, Square } from "lucide-react";
import {
  fetchProductImages,
  getCachedProductImages,
  type ProductImageAsset,
} from "@/lib/assets/product-images-client";

export function ProductImagePicker({
  selectedIds,
  onChange,
  maxSelectable,
  title = "产品图片",
  description = "选择要参与这次生成的产品图。批量模式会按你勾选的顺序循环复用。",
}: {
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  maxSelectable?: number;
  title?: string;
  description?: string;
}) {
  const [assets, setAssets] = useState<ProductImageAsset[]>(() => getCachedProductImages() ?? []);
  const [loading, setLoading] = useState(() => getCachedProductImages() === null);

  useEffect(() => {
    let mounted = true;
    fetchProductImages().then((nextAssets) => {
      if (!mounted) return;
      setAssets(nextAssets);
      setLoading(false);
    });

    return () => {
      mounted = false;
    };
  }, []);

  const selectedAssets = useMemo(() => {
    const byId = new Map(assets.map((asset) => [asset.id, asset]));
    return selectedIds
      .map((id) => byId.get(id))
      .filter((asset): asset is ProductImageAsset => Boolean(asset));
  }, [assets, selectedIds]);

  function toggleAsset(assetId: string) {
    const exists = selectedIds.includes(assetId);
    if (exists) {
      onChange(selectedIds.filter((id) => id !== assetId));
      return;
    }

    if (maxSelectable === 1) {
      onChange([assetId]);
      return;
    }
    if (maxSelectable && selectedIds.length >= maxSelectable) return;
    onChange([...selectedIds, assetId]);
  }

  function moveAsset(assetId: string, direction: -1 | 1) {
    const index = selectedIds.indexOf(assetId);
    const nextIndex = index + direction;
    if (index === -1 || nextIndex < 0 || nextIndex >= selectedIds.length) return;

    const next = [...selectedIds];
    [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
    onChange(next);
  }

  return (
    <div className="space-y-4 rounded-[var(--vc-radius-xl)] border border-[var(--vc-border)] bg-[var(--vc-bg-surface)]/70 p-4">
      <div className="space-y-1">
        <h3 className="text-sm font-semibold text-white">{title}</h3>
        <p className="text-xs text-[var(--vc-text-muted)]">{description}</p>
      </div>

      {selectedAssets.length > 0 && maxSelectable !== 1 && (
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.2em] text-[var(--vc-text-dim)]">
            已选顺序
          </p>
          <div className="space-y-2">
            {selectedAssets.map((asset, index) => (
              <div
                key={asset.id}
                className="flex items-center justify-between gap-3 rounded-2xl border border-[var(--vc-border)] px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm text-white">
                    {index + 1}. {asset.filename || asset.id}
                  </p>
                  <p className="truncate text-xs text-[var(--vc-text-dim)]">{asset.url}</p>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => moveAsset(asset.id, -1)}
                    className="rounded-full border border-[var(--vc-border)] p-1 text-[var(--vc-text-muted)]"
                  >
                    <ArrowUp className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => moveAsset(asset.id, 1)}
                    className="rounded-full border border-[var(--vc-border)] p-1 text-[var(--vc-text-muted)]"
                  >
                    <ArrowDown className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-[var(--vc-text-muted)]">正在加载产品图...</p>
      ) : assets.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[var(--vc-border)] px-4 py-8 text-center">
          <ImageIcon className="mx-auto h-6 w-6 text-[var(--vc-text-dim)]" />
          <p className="mt-2 text-sm text-[var(--vc-text-muted)]">还没有产品图，请先去素材库上传。</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {assets.map((asset) => {
            const selectedIndex = selectedIds.indexOf(asset.id);
            const active = selectedIndex >= 0;

            return (
              <button
                key={asset.id}
                type="button"
                onClick={() => toggleAsset(asset.id)}
                className={`group overflow-hidden rounded-2xl border text-left transition ${
                  active
                    ? "border-[var(--vc-accent)] shadow-[var(--vc-shadow-sm)]"
                    : "border-[var(--vc-border)]"
                }`}
              >
                <div
                  className="aspect-square bg-cover bg-center"
                  style={{ backgroundImage: `url(${asset.url})` }}
                />
                <div className="flex items-center justify-between gap-2 px-3 py-2">
                  <div className="min-w-0">
                    <p className="truncate text-xs text-white">{asset.filename || asset.id}</p>
                    <p className="text-[10px] text-[var(--vc-text-dim)]">
                      {active ? `顺序 ${selectedIndex + 1}` : "未选择"}
                    </p>
                  </div>
                  {active ? (
                    <CheckSquare className="h-4 w-4 text-[var(--vc-accent)]" />
                  ) : (
                    <Square className="h-4 w-4 text-[var(--vc-text-dim)]" />
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
