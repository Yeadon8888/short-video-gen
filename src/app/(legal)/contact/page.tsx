import type { Metadata } from "next";
import "../legal.css";

export const metadata: Metadata = {
  title: "联系我们 / Contact",
  description:
    "联系 VidClaw 团队：客户支持、商务合作、投诉反馈。Contact VidClaw: customer support, business inquiries, feedback.",
  alternates: { canonical: "/contact" },
};

export default function ContactPage() {
  return (
    <article className="legal-prose">
      <h1>联系我们</h1>

      <p>
        有问题或反馈？我们非常欢迎您与我们取得联系。无论是使用问题、账单问题、商务合作还是产品建议，我们团队会尽快响应。
      </p>

      <h2>客户支持</h2>
      <p>
        邮箱：<a href="mailto:support@yeadon.top">support@yeadon.top</a><br />
        响应时间：工作日 <strong>24 小时内</strong>；节假日可能延迟至 48 小时
      </p>

      <h2>账单与退款</h2>
      <p>
        关于订单、发票、退款申请，请发邮件至 <a href="mailto:support@yeadon.top">support@yeadon.top</a>，主题注明"账单"或"退款"。详见 <a href="/refund">退款政策</a>。
      </p>

      <h2>商务合作</h2>
      <p>
        对于 API、代理、品牌合作、大客户定制等商务事宜，请邮件联系 <a href="mailto:support@yeadon.top">support@yeadon.top</a>，主题注明"商务合作"。
      </p>

      <h2>侵权投诉</h2>
      <p>
        如您认为本平台上的某内容侵犯了您的版权、商标或其他合法权益，请发邮件至 <a href="mailto:support@yeadon.top">support@yeadon.top</a>，提供：
      </p>
      <ul>
        <li>您的联系方式与权利证明</li>
        <li>被指侵权的内容链接</li>
        <li>您认为构成侵权的理由</li>
        <li>一份声明，确认通知内容属实并以被侵权方身份发出</li>
      </ul>
      <p>我们将在收到有效投诉后 <strong>7 个工作日内</strong>处理并回复。</p>

      <h2>安全漏洞报告</h2>
      <p>
        如您发现本服务的安全问题，请负责任地披露。邮件联系 <a href="mailto:support@yeadon.top">support@yeadon.top</a>，主题注明 <strong>"Security"</strong>。我们感谢每一位帮助我们改进的安全研究人员。
      </p>

      <h2>法律文件</h2>
      <ul>
        <li><a href="/privacy">隐私政策</a></li>
        <li><a href="/terms">服务条款</a></li>
        <li><a href="/refund">退款政策</a></li>
      </ul>

      <div className="lang-divider">English Version</div>

      <h1>Contact Us</h1>

      <p>
        We're happy to hear from you — for support, billing questions, business partnerships, or product feedback.
      </p>

      <h2>Customer Support</h2>
      <p>
        Email: <a href="mailto:support@yeadon.top">support@yeadon.top</a><br />
        Typical response: <strong>within 24 hours</strong> on business days (up to 48 hours on weekends/holidays)
      </p>

      <h2>Billing &amp; Refunds</h2>
      <p>
        For orders, invoices, and refunds, email <a href="mailto:support@yeadon.top">support@yeadon.top</a> with subject "Billing" or "Refund". See our <a href="/refund">Refund Policy</a>.
      </p>

      <h2>Business Inquiries</h2>
      <p>
        For API access, reseller programs, brand partnerships, or enterprise deals — email <a href="mailto:support@yeadon.top">support@yeadon.top</a> with subject "Business".
      </p>

      <h2>IP / Copyright Complaints</h2>
      <p>
        If you believe content on our platform infringes your rights, email <a href="mailto:support@yeadon.top">support@yeadon.top</a> with:
      </p>
      <ul>
        <li>Your contact details and proof of rights</li>
        <li>The URL of the allegedly infringing content</li>
        <li>A description of the infringement</li>
        <li>A good-faith statement affirming the notice is accurate and sent by or on behalf of the rights holder</li>
      </ul>
      <p>We will respond to valid notices within <strong>7 business days</strong>.</p>

      <h2>Security Disclosure</h2>
      <p>
        If you discover a security vulnerability, please disclose it responsibly. Email <a href="mailto:support@yeadon.top">support@yeadon.top</a> with subject "Security".
      </p>

      <h2>Legal Documents</h2>
      <ul>
        <li><a href="/privacy">Privacy Policy</a></li>
        <li><a href="/terms">Terms of Service</a></li>
        <li><a href="/refund">Refund Policy</a></li>
      </ul>
    </article>
  );
}
