import { NextResponse } from "next/server";
import nodemailer from "nodemailer";

export async function POST(req: Request) {
  try {
    const { to, studentName, courseName, status, schoolSlug } = await req.json();

    if (!to || !studentName || !courseName || !status) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Create a transporter using environment variables
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    let subject = "";
    let html = "";

    if (status === "approved") {
      subject = `🎉 Enrollment Approved – ${courseName}`;
      html = `
        <div style="font-family: Inter, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #e5e7eb;">
          <div style="background: linear-gradient(135deg, #4f46e5, #7c3aed); padding: 32px; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 24px;">🎉 You're In!</h1>
          </div>
          <div style="padding: 32px;">
            <p style="color: #111827; font-size: 16px;">Hi <strong>${studentName}</strong>,</p>
            <p style="color: #374151; font-size: 15px; line-height: 1.6;">
              Great news! Your enrollment request for <strong>${courseName}</strong> has been <span style="color: #059669; font-weight: 600;">approved</span>.
            </p>
            <p style="color: #374151; font-size: 15px; line-height: 1.6;">
              You now have full access to the course content. Log in to start learning!
            </p>
            <div style="text-align: center; margin: 24px 0;">
              <a href="${process.env.NEXT_PUBLIC_APP_URL || "https://devtonic-lms-2.web.app"}/${schoolSlug}/courses"
                 style="background: linear-gradient(135deg, #4f46e5, #7c3aed); color: white; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 15px;">
                Go to My Courses →
              </a>
            </div>
          </div>
          <div style="background: #f9fafb; padding: 16px 32px; border-top: 1px solid #e5e7eb;">
            <p style="color: #9ca3af; font-size: 12px; margin: 0; text-align: center;">This email was sent by Devtonic Academy. Do not reply.</p>
          </div>
        </div>
      `;
    } else if (status === "pending_payment") {
      subject = `Payment Confirmation Received – ${courseName}`;
      html = `
        <div style="font-family: Inter, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #e5e7eb;">
          <div style="background: linear-gradient(135deg, #fbbf24, #d97706); padding: 32px; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 24px;">Payment Received</h1>
          </div>
          <div style="padding: 32px;">
            <p style="color: #111827; font-size: 16px;">Hi <strong>${studentName}</strong>,</p>
            <p style="color: #374151; font-size: 15px; line-height: 1.6;">
              We have received your enrollment and payment confirmation for <strong>${courseName}</strong>.
            </p>
            <p style="color: #374151; font-size: 15px; line-height: 1.6;">
              Our team is currently verifying the bank transfer. This usually takes between 1-24 hours. We will send you another email as soon as your access is approved!
            </p>
          </div>
          <div style="background: #f9fafb; padding: 16px 32px; border-top: 1px solid #e5e7eb;">
            <p style="color: #9ca3af; font-size: 12px; margin: 0; text-align: center;">This email was sent by Devtonic Academy. Do not reply.</p>
          </div>
        </div>
      `;
    } else {
      subject = `Enrollment Update – ${courseName}`;
      html = `
        <div style="font-family: Inter, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #e5e7eb;">
          <div style="background: linear-gradient(135deg, #6b7280, #374151); padding: 32px; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 24px;">Enrollment Update</h1>
          </div>
          <div style="padding: 32px;">
            <p style="color: #111827; font-size: 16px;">Hi <strong>${studentName}</strong>,</p>
            <p style="color: #374151; font-size: 15px; line-height: 1.6;">
              We regret to inform you that your enrollment request for <strong>${courseName}</strong> has been <span style="color: #dc2626; font-weight: 600;">declined</span>.
            </p>
            <p style="color: #374151; font-size: 15px; line-height: 1.6;">
              If you believe this is a mistake or have any questions, please contact the school administration.
            </p>
          </div>
          <div style="background: #f9fafb; padding: 16px 32px; border-top: 1px solid #e5e7eb;">
            <p style="color: #9ca3af; font-size: 12px; margin: 0; text-align: center;">This email was sent by Devtonic Academy. Do not reply.</p>
          </div>
        </div>
      `;
    }

    // If no email config, skip sending (don't fail)
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
      console.warn("Email credentials not configured. Skipping email send.");
      return NextResponse.json({ success: true, skipped: true });
    }

    await transporter.sendMail({
      from: `"Devtonic Academy" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      html,
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Email error:", error);
    return NextResponse.json({ error: error.message || "Failed to send email" }, { status: 500 });
  }
}
