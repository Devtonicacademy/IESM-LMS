import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

export async function POST(req: Request) {
  try {
    const { courseName, sessionTitle, startDateTime, endDateTime, location, recipients, schoolSlug } = await req.json();

    if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
      return NextResponse.json({ message: 'No recipients provided' }, { status: 200 });
    }

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: Number(process.env.SMTP_PORT) || 465,
      secure: true,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS?.replace(/['"]/g, '').trim(),
      },
    });

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://iesm-lms-app-2026.web.app';
    const courseUrl = `${baseUrl}/${schoolSlug}/courses`;

    // Send emails in parallel
    const emailPromises = recipients.map(async (recipient: { email: string; name: string }) => {
      const subject = `📅 New Session Scheduled: ${sessionTitle} – ${courseName}`;
      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
          <div style="text-align: center; padding: 24px 20px 12px;">
            <img src="https://iesm-lms-app-2026.web.app/iesm-logo.jpg" alt="IESM Logo" style="max-width: 120px;" />
          </div>

          <div style="background-color: #FAFAFA; padding: 32px; border-radius: 12px; margin-bottom: 20px; border: 1px solid #eee;">
            <h2 style="color: #0A4A6B; margin-top: 0; font-size: 22px;">
              New Session Scheduled
            </h2>
            <p style="line-height: 1.6; color: #555;">
              Hi <strong>${recipient.name}</strong>,
            </p>
            <p style="line-height: 1.6; color: #555;">
              A new session has been scheduled for your course <strong>${courseName}</strong>. Here are the details:
            </p>
            
            <div style="background-color: #fff; padding: 20px; border-radius: 8px; border: 1px solid #e2e8f0; margin: 20px 0;">
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 6px 0; font-weight: bold; color: #4a5568; width: 120px;">Session:</td>
                  <td style="padding: 6px 0; color: #2d3748;">${sessionTitle}</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; font-weight: bold; color: #4a5568;">Starts:</td>
                  <td style="padding: 6px 0; color: #2d3748;">${startDateTime}</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; font-weight: bold; color: #4a5568;">Ends:</td>
                  <td style="padding: 6px 0; color: #2d3748;">${endDateTime}</td>
                </tr>
                ${location ? `
                <tr>
                  <td style="padding: 6px 0; font-weight: bold; color: #4a5568;">Location:</td>
                  <td style="padding: 6px 0; color: #2d3748;">${location}</td>
                </tr>` : ''}
              </table>
            </div>

            <div style="text-align: center; margin: 32px 0;">
              <a href="${courseUrl}"
                style="background-color: #0A4A6B; color: white; padding: 14px 32px;
                       text-decoration: none; border-radius: 8px; font-weight: bold;
                       display: inline-block; font-size: 15px; letter-spacing: 0.3px;">
                View Course Schedule
              </a>
            </div>

            <p style="font-size: 12px; color: #999; text-align: center; margin-bottom: 0;">
              Please make sure to add this session to your calendar. See you there!
            </p>
          </div>

          <div style="text-align: center; font-size: 12px; color: #aaa; padding-bottom: 24px;">
            &copy; ${new Date().getFullYear()} Institute of Ergonomics &amp; Safety Management. All rights reserved.
          </div>
        </div>
      `;

      return transporter.sendMail({
        from: `"Institute of Ergonomics & Safety Management" <${process.env.SMTP_USER}>`,
        to: recipient.email,
        subject,
        html,
      });
    });

    await Promise.all(emailPromises);

    return NextResponse.json({ message: 'Session notification emails sent' }, { status: 200 });
  } catch (error) {
    console.error('Error sending session notification emails:', error);
    return NextResponse.json({ error: 'Failed to send session notification emails' }, { status: 500 });
  }
}
