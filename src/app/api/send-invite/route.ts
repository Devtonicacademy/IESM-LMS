import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

export async function POST(req: Request) {
  try {
    const { email, name, schoolSlug, token } = await req.json();

    if (!email || !name || !schoolSlug || !token) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const origin = req.headers.get("origin") || req.headers.get("referer");
    const host = req.headers.get("host");
    const protocol = host && (host.includes("localhost") || host.includes("127.0.0.1")) ? "http" : "https";

    let baseUrl = process.env.NEXT_PUBLIC_BASE_URL;
    if (!baseUrl && origin) {
      try {
        baseUrl = new URL(origin).origin;
      } catch (_) {}
    }
    if (!baseUrl && host) {
      baseUrl = `${protocol}://${host}`;
    }
    if (!baseUrl) {
      baseUrl = 'https://devtonic-lms.web.app';
    }

    const inviteUrl = `${baseUrl}/${schoolSlug}/auth/instructor-signup/${token}`;

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: Number(process.env.SMTP_PORT) || 465,
      secure: true,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS?.replace(/['"]/g, '').trim(),
      },
    });

    await transporter.sendMail({
      from: `"Institute of Ergonomics & Safety Management" <${process.env.SMTP_USER}>`,
      to: email,
      subject: "You've been invited as an Instructor – IESM LMS",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
          <div style="text-align: center; padding: 24px 20px 12px;">
            <img src="https://iesm-lms-app-2026.web.app/iesm-logo.jpg" alt="IESM Logo" style="max-width: 120px;" />
          </div>

          <div style="background-color: #FAFAFA; padding: 32px; border-radius: 12px; margin-bottom: 20px; border: 1px solid #eee;">
            <h2 style="color: #0A4A6B; margin-top: 0; font-size: 22px;">
              Hello ${name}, you've been invited!
            </h2>
            <p style="line-height: 1.6; color: #555;">
              You have been added as an <strong>Instructor</strong> on the
              <strong>Institute of Ergonomics &amp; Safety Management LMS</strong>.
              Please click the button below to complete your account setup.
            </p>
            <p style="line-height: 1.6; color: #555;">
              You'll be asked to confirm your full name and create a password.
              Your email address (<strong>${email}</strong>) is already registered and cannot be changed.
            </p>

            <div style="text-align: center; margin: 32px 0;">
              <a href="${inviteUrl}"
                style="background-color: #0A4A6B; color: white; padding: 14px 32px;
                       text-decoration: none; border-radius: 8px; font-weight: bold;
                       display: inline-block; font-size: 15px; letter-spacing: 0.3px;">
                Complete Your Account Setup
              </a>
            </div>

            <p style="font-size: 12px; color: #999; text-align: center; margin-bottom: 0;">
              This invitation link will expire in <strong>7 days</strong>.
              If you did not expect this email, you can safely ignore it.
            </p>
          </div>

          <div style="text-align: center; font-size: 12px; color: #aaa; padding-bottom: 24px;">
            &copy; ${new Date().getFullYear()} Institute of Ergonomics &amp; Safety Management. All rights reserved.
          </div>
        </div>
      `,
    });

    return NextResponse.json({ message: 'Invite email sent' }, { status: 200 });
  } catch (error) {
    console.error('Error sending invite email:', error);
    return NextResponse.json({ error: 'Failed to send invite email' }, { status: 500 });
  }
}

