"use client";

import { Link2, Video, Sparkles } from "lucide-react";
import { motion } from "framer-motion";
import { useInView } from "framer-motion";
import { useRef } from "react";

const features = [
  {
    icon: Link2,
    title: "链接二创",
    desc: "粘贴抖音/TikTok 链接，AI 自动下载、分析画面并生成全新视频。一键完成二创工作流。",
    tag: "URL 模式",
  },
  {
    icon: Video,
    title: "视频二创",
    desc: "上传本地参考视频，AI 深度理解画面内容后重新创作。支持自定义修改提示。",
    tag: "视频模式",
  },
  {
    icon: Sparkles,
    title: "主题生产",
    desc: "输入产品描述或创意主题，AI 从零生成完整广告视频，自动配套标题、文案和首评。",
    tag: "主题模式",
  },
];

export function FeatureCards() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-40px" });

  return (
    <motion.div
      ref={ref}
      initial="hidden"
      animate={inView ? "visible" : "hidden"}
      variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.1 } } }}
      className="grid gap-8 md:grid-cols-3"
    >
      {features.map((feature) => (
        <motion.div
          key={feature.title}
          variants={{
            hidden: { opacity: 0, y: 20 },
            visible: { opacity: 1, y: 0, transition: { duration: 0.4 } },
          }}
          className="group rounded-2xl border border-white/5 bg-[var(--vc-bg-surface)] p-8 transition-all duration-300 hover:border-[var(--vc-accent)]/30"
        >
          {/* Icon */}
          <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-[var(--vc-accent)]/10 transition-transform duration-300 group-hover:scale-110">
            <feature.icon className="h-7 w-7 text-[var(--vc-accent)]" />
          </div>

          {/* Tag */}
          <span className="mt-6 inline-block text-xs font-bold uppercase tracking-wider text-[var(--vc-accent)]">
            {feature.tag}
          </span>

          {/* Title */}
          <h3 className="mt-2 font-heading text-xl font-bold text-white">
            {feature.title}
          </h3>

          {/* Description */}
          <p className="mt-4 leading-relaxed text-slate-400">
            {feature.desc}
          </p>
        </motion.div>
      ))}
    </motion.div>
  );
}
