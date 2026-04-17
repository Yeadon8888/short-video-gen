"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, CheckSquare, ChevronDown, ChevronUp, ImageIcon, Square } from "lucide-react";
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
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    let mounted = true;
    fetchProductImages().then((nextAssets) => {
      if (!mounted) return;
      setAssets(nextAssets);
      setLoading(false);
    });
    return () => { mounted = false; };
  }, []);

  // Auto-expand only when very few images (≤4). Otherwise default collapsed.
  const shouldAutoExpand = assets.length > 0 && assets.length <= 4;
  const isExpanded = expanded || shouldAutoExpand;

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
    <div className="space-y-3">
      {/* Header — always visible, clickable to toggle */}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between"
      >
        <div className="text-left">
          <h3 className="text-sm font-semibold text-white">{title}</h3>
          <p className="text-xs text-slate-500">
            {maxSelectable === 1
              ? description
              : `已选 ${selectedIds.length} 张${assets.length > 0 ? ` / 共 ${assets.length} 张` : ""}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Collapsed preview — show selected thumbnails */}
          {!isExpanded && selectedAssets.length > 0 && (
            <div className="flex -space-x-2">
              {selectedAssets.slice(0, 4).map((asset) => (
                <div
                  key={asset.id}
                  className="h-8 w-8 overflow-hidden rounded-md border-2 border-[var(--vc-bg-surface)] bg-cover bg-center"
                  style={{ backgroundImage: `url(${asset.url})` }}
                />
              ))}
              {selectedAssets.length > 4 && (
                <div className="flex h-8 w-8 items-center justify-center rounded-md border-2 border-[var(--vc-bg-surface)] bg-[var(--vc-bg-elevated)] text-[10px] text-slate-400">
                  +{selectedAssets.length - 4}
                </div>
              )}
            </div>
          )}
          {!shouldAutoExpand && (
            isExpanded
              ? <ChevronUp className="h-4 w-4 text-slate-500" />
              : <ChevronDown className="h-4 w-4 text-slate-500" />
          )}
        </div>
      </button>

      {/* Expanded content */}
      {isExpanded && (
        <>
          {/* Selected order list (multi-select only) */}
          {selectedAssets.length > 0 && maxSelectable !== 1 && (
            <div className="space-y-1.5">
              {selectedAssets.map((asset, index) => (
                <div
                  key={asset.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-[var(--vc-border)] px-3 py-1.5"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <div
                      className="h-6 w-6 flex-shrink-0 rounded bg-cover bg-center"
                      style={{ backgroundImage: `url(${asset.url})` }}
                    />
                    <p className="truncate text-xs text-white">
                      {index + 1}. {asset.filename || asset.id.slice(0, 8)}
                    </p>
                  </div>
                  <div className="flex items-center gap-0.5">
                    <button
                      onClick={(e) => { e.stopPropagation(); moveAsset(asset.id, -1); }}
                      className="rounded p-0.5 text-slate-500 hover:text-white"
                    >
                      <ArrowUp className="h-3 w-3" />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); moveAsset(asset.id, 1); }}
                      className="rounded p-0.5 text-slate-500 hover:text-white"
                    >
                      <ArrowDown className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Image grid */}
          {loading ? (
            <p className="text-xs text-slate-500">加载中...</p>
          ) : assets.length === 0 ? (
            <div className="rounded-lg border border-dashed border-[var(--vc-border)] px-4 py-6 text-center">
              <ImageIcon className="mx-auto h-5 w-5 text-slate-600" />
              <p className="mt-1.5 text-xs text-slate-500">
                还没有产品图，请先去<a href="/assets" className="text-[var(--vc-accent)]">素材库</a>上传。
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-4 gap-2 sm:grid-cols-5 md:grid-cols-6">
              {assets.map((asset) => {
                const selectedIndex = selectedIds.indexOf(asset.id);
                const active = selectedIndex >= 0;

                return (
                  <button
                    key={asset.id}
                    type="button"
                    onClick={(e) => { e.stopPropagation(); toggleAsset(asset.id); }}
                    className={`group relative aspect-square overflow-hidden rounded-lg border-2 transition-all ${
                      active
                        ? "border-[var(--vc-accent)] ring-1 ring-[var(--vc-accent)]/30"
                        : "border-transparent hover:border-white/20"
                    }`}
                  >
                    <div
                      className="h-full w-full bg-cover bg-center"
                      style={{ backgroundImage: `url(${asset.url})` }}
                    />
                    {active && (
                      <div className="absolute inset-0 flex items-center justify-center bg-[var(--vc-accent)]/10">
                        <div className="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--vc-accent)] text-[10px] font-bold text-white">
                          {selectedIndex + 1}
                        </div>
                      </div>
                    )}
                    <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/60 to-transparent px-1 py-0.5">
                      <p className="truncate text-[9px] text-white/80">
                        {asset.filename || ""}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
