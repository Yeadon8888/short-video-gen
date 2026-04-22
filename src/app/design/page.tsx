import Link from "next/link";
import { ArrowRight } from "lucide-react";

const VARIANTS: { id: number; title: string; desc: string }[] = [
  { id: 1, title: "Luna · 安全溢价", desc: "浮动导航 + 插画 Hero + Bento + 定价 + 证言 + CTA box + 5 栏页脚" },
  { id: 2, title: "Neptune · 数据驱动", desc: "居中大 Hero + 数据墙 + Logo 条 + 粘性特性 + 三档定价" },
  { id: 3, title: "Pluto · 发光深空", desc: "Top glow Hero + 2 栏 Bento + FAQ 2-cols + 简约 CTA" },
  { id: 4, title: "Saturn · 图层叙事", desc: "Layers Hero + 轮播案例 + 垂直时间线 + 品牌 Logo 墙" },
  { id: 5, title: "Jupiter · 选项卡秀", desc: "Barebone Hero + 顶部 tabs 切换功能 + 画廊网格 + 极简页脚" },
  { id: 6, title: "影院级全屏视频", desc: "16:9 自动播放视频大屏，文字压在左下角；极简导航" },
  { id: 7, title: "瀑布流作品优先", desc: "极简导航 + 12 格 Pinterest 样片网格，一行大标题在顶" },
  { id: 8, title: "手机 App 质感", desc: "手机 Mockup Hero + 堆叠卡片，强调“手机也能出片”" },
  { id: 9, title: "企业极简 B2B", desc: "静态导航 + 纯文本 Hero + 单条证言 + 三档定价" },
  { id: 10, title: "左右分屏视频流", desc: "左粘性文案 + 右侧滚动样片（类 Instagram Feed） + FAQ" },
];

export default function DesignIndexPage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-6xl px-6 py-16">
        <header className="mb-12">
          <p className="text-brand text-sm font-medium uppercase tracking-widest">
            VidClaw · Design exploration
          </p>
          <h1 className="mt-3 text-4xl font-semibold sm:text-5xl">
            10 个落地页视觉方向
          </h1>
          <p className="text-muted-foreground mt-4 max-w-2xl">
            同一份产品内容，10 种完全不同的视觉叙事。点击任意一个预览对应的完整页面，
            决定我们要投入哪个方向继续打磨。
          </p>
        </header>

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {VARIANTS.map((v) => (
            <Link
              key={v.id}
              href={`/design/${v.id}`}
              className="group bg-card hover:border-brand/60 relative flex flex-col justify-between overflow-hidden rounded-xl border border-border p-6 transition"
            >
              <div>
                <span className="text-muted-foreground text-xs font-mono">
                  v{v.id.toString().padStart(2, "0")}
                </span>
                <h2 className="mt-2 text-xl font-semibold">{v.title}</h2>
                <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
                  {v.desc}
                </p>
              </div>
              <div className="text-brand mt-6 flex items-center gap-1 text-sm font-medium">
                Preview
                <ArrowRight className="size-4 transition group-hover:translate-x-0.5" />
              </div>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
