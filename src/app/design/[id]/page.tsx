import { notFound } from "next/navigation";

import { getLandingSamples } from "@/lib/landing/samples";

import Variant1 from "../variants/v1";
import Variant2 from "../variants/v2";
import Variant3 from "../variants/v3";
import Variant4 from "../variants/v4";
import Variant5 from "../variants/v5";
import Variant6 from "../variants/v6";
import Variant7 from "../variants/v7";
import Variant8 from "../variants/v8";
import Variant9 from "../variants/v9";
import Variant10 from "../variants/v10";

export function generateStaticParams() {
  return Array.from({ length: 10 }, (_, i) => ({ id: String(i + 1) }));
}

export default async function DesignVariantPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const n = Number(id);
  if (!Number.isInteger(n) || n < 1 || n > 10) notFound();

  let samples: Awaited<ReturnType<typeof getLandingSamples>>;
  try {
    samples = await getLandingSamples();
  } catch {
    samples = { hero: null, modelSamples: [] };
  }

  const variants: React.ReactNode[] = [
    <Variant1 key="1" samples={samples} />,
    <Variant2 key="2" samples={samples} />,
    <Variant3 key="3" samples={samples} />,
    <Variant4 key="4" samples={samples} />,
    <Variant5 key="5" samples={samples} />,
    <Variant6 key="6" samples={samples} />,
    <Variant7 key="7" samples={samples} />,
    <Variant8 key="8" samples={samples} />,
    <Variant9 key="9" samples={samples} />,
    <Variant10 key="10" samples={samples} />,
  ];

  return variants[n - 1];
}
