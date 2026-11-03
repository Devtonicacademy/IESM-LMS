import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

export async function POST(req: Request) {
  try {
    const { email, name } = await req.json();

    if (!email || !name) {
      return NextResponse.json({ error: 'Missing email or name' }, { status: 400 });
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

    const mailOptions = {
      from: `"Institute of Ergonomics & Safety Management" <${process.env.SMTP_USER}>`,
      to: email,
      subject: 'Welcome to IESM LMS',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
          <div style="text-align: center; padding: 20px;">
            <img src="https://iesm-lms-app-2026.web.app/iesm-logo.jpg" alt="IESM Logo" style="max-width: 150px;" />
          </div>
          <div style="background-color: #FAFAFA; padding: 30px; border-radius: 10px; margin-bottom: 20px;">
            <h2 style="color: #0A4A6B; margin-top: 0;">Welcome to IESM LMS, ${name}!</h2>
            <p>Your account has been successfully created. We are excited to have you on board.</p>
            <p>You can now access your dashboard and start your journey with the Institute of Ergonomics & Safety Management.</p>
            <div style="text-align: center; margin-top: 30px;">
              <a href="https://iesm-lms-app-2026.web.app/iesm/auth/login" style="background-color: #0A4A6B; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">Access Portal</a>
            </div>
          </div>
          <div style="text-align: center; font-size: 12px; color: #777; margin-top: 20px;">
            &copy; ${new Date().getFullYear()} Institute of Ergonomics & Safety Management. All rights reserved.
          </div>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);

    return NextResponse.json({ message: 'Email sent successfully' }, { status: 200 });
  } catch (error) {
    console.error('Error sending email:', error);
    return NextResponse.json({ error: 'Failed to send email' }, { status: 500 });
  }
}
