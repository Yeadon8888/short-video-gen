import crypto from "node:crypto";
import { buildAbsoluteUrl, type AlipayConfig } from "@/lib/payments/config";

const CHARSET = "utf-8";
const SIGN_TYPE = "RSA2";
const VERSION = "1.0";

export interface CreateAlipayPageParams {
  config: AlipayConfig;
  method: "alipay.trade.page.pay" | "alipay.trade.wap.pay";
  outTradeNo: string;
  amountFen: number;
  subject: string;
  body?: string;
  returnParams?: Record<string, string>;
}

function formatTimestamp(input = new Date()) {
  const year = input.getFullYear();
  const month = String(input.getMonth() + 1).padStart(2, "0");
  const day = String(input.getDate()).padStart(2, "0");
  const hours = String(input.getHours()).padStart(2, "0");
  const minutes = String(input.getMinutes()).padStart(2, "0");
  const seconds = String(input.getSeconds()).padStart(2, "0");
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

function toAmountYuan(amountFen: number) {
  return (amountFen / 100).toFixed(2);
}

function normalizePem(raw: string) {
  return raw.replace(/\\n/g, "\n").trim();
}

function buildSignContent(params: Record<string, string>) {
  return Object.keys(params)
    .filter((key) => key !== "sign" && key !== "sign_type" && params[key] !== "" && params[key] !== undefined)
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join("&");
}

function signRsa2(content: string, privateKey: string) {
  const signer = crypto.createSign("RSA-SHA256");
  signer.update(content, CHARSET);
  signer.end();
  return signer.sign(normalizePem(privateKey), "base64");
}

export function verifyAlipaySignature(params: Record<string, string>, alipayPublicKey: string) {
  const sign = params.sign;
  if (!sign) return false;
  const verifier = crypto.createVerify("RSA-SHA256");
  verifier.update(buildSignContent(params), CHARSET);
  verifier.end();
  return verifier.verify(normalizePem(alipayPublicKey), sign, "base64");
}

export function createAlipayPageUrl(params: CreateAlipayPageParams) {
  const returnUrl = buildAbsoluteUrl(
    params.config.siteUrl,
    params.config.returnPath,
    params.returnParams,
  );
  const notifyUrl = buildAbsoluteUrl(params.config.siteUrl, params.config.notifyPath);
  const bizContent: Record<string, string> = {
    out_trade_no: params.outTradeNo,
    total_amount: toAmountYuan(params.amountFen),
    subject: params.subject,
  };

  if (params.method === "alipay.trade.page.pay") {
    bizContent.product_code = "FAST_INSTANT_TRADE_PAY";
  } else {
    bizContent.product_code = "QUICK_WAP_WAY";
    bizContent.quit_url = returnUrl;
  }

  if (params.body) {
    bizContent.body = params.body;
  }

  const requestParams: Record<string, string> = {
    app_id: params.config.appId,
    method: params.method,
    format: "JSON",
    charset: CHARSET,
    sign_type: SIGN_TYPE,
    timestamp: formatTimestamp(),
    version: VERSION,
    notify_url: notifyUrl,
    return_url: returnUrl,
    biz_content: JSON.stringify(bizContent),
  };

  requestParams.sign = signRsa2(buildSignContent(requestParams), params.config.privateKey);
  const url = new URL(params.config.gateway);
  for (const [key, value] of Object.entries(requestParams)) {
    url.searchParams.set(key, value);
  }
  return {
    url: url.toString(),
    requestParams,
    notifyUrl,
    returnUrl,
  };
}

export async function queryAlipayTrade(params: {
  config: AlipayConfig;
  outTradeNo: string;
}) {
  const requestParams: Record<string, string> = {
    app_id: params.config.appId,
    method: "alipay.trade.query",
    format: "JSON",
    charset: CHARSET,
    sign_type: SIGN_TYPE,
    timestamp: formatTimestamp(),
    version: VERSION,
    biz_content: JSON.stringify({
      out_trade_no: params.outTradeNo,
    }),
  };
  requestParams.sign = signRsa2(buildSignContent(requestParams), params.config.privateKey);

  const url = new URL(params.config.gateway);
  for (const [key, value] of Object.entries(requestParams)) {
    url.searchParams.set(key, value);
  }

  const response = await fetch(url.toString(), {
    method: "POST",
  });

  if (!response.ok) {
    throw new Error(`支付宝查询失败: HTTP ${response.status}`);
  }

  return response.json() as Promise<Record<string, unknown>>;
}
