import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import sgMail from "@sendgrid/mail";
import twilio from "twilio";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);

sgMail.setApiKey(process.env.SENDGRID_API_KEY || "");
const twClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

export async function POST(request: Request) {
  try {
    const body = await request.json();
    // body: { type: 'new_product'|'reservation'|'account_change', user_id?: string, title?:string, message?:string, product?:{id,name,images...} }
    const { type, user_id, title, message, product } = body;

    if (!type) return NextResponse.json({ error: "missing type" }, { status: 400 });

    // if user_id provided, fetch user metadata to know preferences
    let user: any = null;
    if (user_id) {
      // admin fetch user
      const { data: userData, error: userErr } = await supabaseAdmin.from("auth.users").select("raw_user_meta_data,email").eq('id', user_id).single();
      if (userErr) console.error("user fetch error", userErr);
      user = userData;
    }

    const titleFinal = title ?? (type === "new_product" ? `New product: ${product?.name ?? "product"}` : "Notification");
    const messageFinal = message ?? (type === "new_product" ? `Check out our newest product: ${product?.name}` : "You have an account update");

    // insert into notifications table (recipient_id optional)
    await supabaseAdmin.from("notifications").insert({
      title: titleFinal,
      message: messageFinal,
      type,
      recipient_id: user_id ?? null,
      is_read: false,
    });

    // send email/SMS based on preferences if we have user
    const prefs = (user?.user_metadata as any)?.notifications ?? (user?.raw_user_meta_data?.notifications);
    if (prefs) {
      if (prefs.emailEnabled && user?.email) {
        const msg = {
          to: user.email,
          from: process.env.SENDGRID_FROM!,
          subject: titleFinal,
          text: messageFinal,
          html: `<p>${messageFinal}</p>`,
        };
        try {
          await sgMail.send(msg);
        } catch (err) {
          console.error("sendgrid error", err);
        }
      }

      if (prefs.smsEnabled && user?.raw_user_meta_data?.phone) {
        try {
          await twClient.messages.create({
            body: messageFinal,
            from: process.env.TWILIO_FROM_NUMBER,
            to: user.raw_user_meta_data.phone,
          });
        } catch (err) {
          console.error("twilio error", err);
        }
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("notify route error", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function notifyEvent(payload: {
  type: "new_product" | "reservation" | "account_change";
  user_id?: string;
  title?: string;
  message?: string;
  product?: any;
}) {
  const res = await fetch("/api/notify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return res.json();
}