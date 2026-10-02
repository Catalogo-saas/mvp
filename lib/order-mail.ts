import nodemailer from "nodemailer";

import { formatMoney } from "@/lib/money";

type MailOrder = {
  code: string;
  customerName: string;
  customerEmail: string | null;
  total: number;
  items: Array<{ productName: string; quantity: number; subtotal: number }>;
};

function html(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]!);
}

function mailTransport() {
  const user = process.env.GMAIL_SMTP_USER;
  const pass = process.env.GMAIL_SMTP_APP_PASSWORD;
  if (!user || !pass) return null;
  return { user, transport: nodemailer.createTransport({ service: "gmail", auth: { user, pass } }) };
}

export function isMailConfigured() {
  return Boolean(process.env.GMAIL_SMTP_USER && process.env.GMAIL_SMTP_APP_PASSWORD);
}

async function deliver(to: string, replyTo: string | null, subject: string, body: string, text: string) {
  const sender = mailTransport();
  if (!sender) {
    console.warn("[order-mail] Gmail SMTP is not configured; notification skipped.");
    return false;
  }
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      await sender.transport.sendMail({
        from: sender.user,
        to,
        ...(replyTo ? { replyTo } : {}),
        subject,
        html: body,
        text
      });
      return true;
    } catch (error) {
      console.error(`[order-mail] Delivery attempt ${attempt + 1} failed`, error);
      if (attempt < 2) await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)));
    }
  }
  return false;
}

function frame(title: string, content: string) {
  return `<div style="background:#f6f7f9;padding:24px 12px;font-family:Arial,sans-serif;color:#172033"><div style="max-width:560px;margin:auto;background:#fff;border-radius:14px;padding:24px"><h1 style="font-size:24px;line-height:1.25;margin:0 0 16px">${html(title)}</h1>${content}</div></div>`;
}

export async function notifyNewOrder(args: { order: MailOrder; storeName: string; sellerEmail: string; trackingUrl: string; adminUrl: string }) {
  const { order, storeName, sellerEmail, trackingUrl, adminUrl } = args;
  const itemsHtml = order.items.map((item) => `<li>${html(item.productName)} × ${item.quantity} — ${html(formatMoney(item.subtotal))}</li>`).join("");
  const common = `<p>Pedido <strong>#${html(order.code)}</strong></p><ul>${itemsHtml}</ul><p><strong>Total: ${html(formatMoney(order.total))}</strong></p>`;
  if (order.customerEmail) {
    await deliver(order.customerEmail, sellerEmail, `Tu pedido #${order.code} en ${storeName}`,
      frame(`¡Recibimos tu pedido, ${order.customerName}!`, `${common}<p>Podés consultar su estado actualizado en cualquier momento:</p><p><a href="${html(trackingUrl)}" style="display:inline-block;background:#172033;color:white;padding:13px 18px;border-radius:8px;text-decoration:none">Ver estado de mi pedido</a></p><p style="overflow-wrap:anywhere">${html(trackingUrl)}</p>`),
      `Pedido #${order.code}\nTotal: ${formatMoney(order.total)}\nVer estado: ${trackingUrl}`);
  }
  await deliver(sellerEmail, order.customerEmail, `Nueva venta #${order.code} en ${storeName}`,
    frame("Nueva venta realizada", `<p>Cliente: ${html(order.customerName)}${order.customerEmail ? ` (${html(order.customerEmail)})` : ""}</p>${common}<p><a href="${html(adminUrl)}">Gestionar venta</a></p>`),
    `Nueva venta #${order.code}\nCliente: ${order.customerName}\nTotal: ${formatMoney(order.total)}\nGestionar: ${adminUrl}`);
}

export async function notifyOrderStatus(args: { order: MailOrder; storeName: string; sellerEmail: string; trackingUrl: string; label: string }) {
  if (!args.order.customerEmail) return false;
  return deliver(args.order.customerEmail, args.sellerEmail, `Actualización del pedido #${args.order.code}`,
    frame(`Tu pedido en ${args.storeName}`, `<p>Nuevo estado: <strong>${html(args.label)}</strong></p><p><a href="${html(args.trackingUrl)}">Ver estado de mi pedido</a></p><p style="overflow-wrap:anywhere">${html(args.trackingUrl)}</p>`),
    `Tu pedido #${args.order.code}: ${args.label}\nVer estado: ${args.trackingUrl}`);
}

export async function sendCustomerVerification(args: { email: string; storeName: string; verifyUrl: string; sellerEmail: string }) {
  return deliver(args.email, args.sellerEmail, `Verificá tu cuenta en ${args.storeName}`,
    frame("Verificá tu correo", `<p>Para ver tus compras en ${html(args.storeName)}, confirmá tu correo:</p><p><a href="${html(args.verifyUrl)}" style="display:inline-block;background:#172033;color:#fff;padding:13px 18px;border-radius:8px;text-decoration:none">Verificar correo</a></p><p style="overflow-wrap:anywhere">${html(args.verifyUrl)}</p>`),
    `Verificá tu correo en ${args.storeName}: ${args.verifyUrl}`);
}
