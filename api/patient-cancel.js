// pages/api/patient-cancel.js
import nodemailer from 'nodemailer';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { 
    patientEmail, 
    patientName, 
    appointmentDate, 
    timeSlot, 
    doctor, 
    queueNumber,
    cancelReason 
  } = req.body;

  if (!patientEmail || !patientName || !appointmentDate || !timeSlot || !doctor) {
    return res.status(400).json({ 
      success: false,
      error: 'Required fields missing: patientEmail, patientName, appointmentDate, timeSlot, doctor' 
    });
  }

  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD) {
    return res.status(500).json({ 
      success: false,
      error: 'Email service not configured' 
    });
  }

  try {
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD,
      },
    });

    const staffEmail = 'timefly.healthcare@gmail.com';
    const formattedDate = new Date(appointmentDate).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    const formattedTime = convertTo12Hour(timeSlot);

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: staffEmail,
      subject: '🚨 Patient Appointment Cancellation - TimeFly Healthcare',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px; background-color: #fff;">
          <div style="text-align: center; margin-bottom: 30px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px 10px 0 0; color: white;">
            <h1 style="color: white; margin: 0; font-size: 28px;">TimeFly Healthcare</h1>
            <p style="color: rgba(255,255,255,0.9); margin: 5px 0 0 0; font-size: 16px;">Eye Care Management System</p>
          </div>
          
          <div style="background-color: #fff3cd; padding: 20px; border-radius: 8px; border-left: 4px solid #ffc107; margin: 20px 0;">
            <h2 style="color: #856404; margin: 0; font-size: 22px;">⚠️ Appointment Cancellation Alert</h2>
          </div>
          
          <p>Dear TimeFly Staff,</p>
          
          <p>A patient has cancelled their appointment. Here are the details:</p>
          
          <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0; border: 1px solid #e9ecef;">
            <h3 style="color: #4F46E5; margin-top: 0; border-bottom: 2px solid #4F46E5; padding-bottom: 10px;">Cancelled Appointment Details:</h3>
            
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; border-bottom: 1px solid #dee2e6; font-weight: bold; width: 40%;">Patient Name:</td>
                <td style="padding: 8px 0; border-bottom: 1px solid #dee2e6;">${patientName}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; border-bottom: 1px solid #dee2e6; font-weight: bold;">Patient Email:</td>
                <td style="padding: 8px 0; border-bottom: 1px solid #dee2e6;">${patientEmail}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; border-bottom: 1px solid #dee2e6; font-weight: bold;">Appointment Date:</td>
                <td style="padding: 8px 0; border-bottom: 1px solid #dee2e6;">${formattedDate}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; border-bottom: 1px solid #dee2e6; font-weight: bold;">Time Slot:</td>
                <td style="padding: 8px 0; border-bottom: 1px solid #dee2e6;">${formattedTime}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; border-bottom: 1px solid #dee2e6; font-weight: bold;">Doctor:</td>
                <td style="padding: 8px 0; border-bottom: 1px solid #dee2e6;">Dr. ${doctor}</td>
              </tr>
              ${queueNumber ? `
              <tr>
                <td style="padding: 8px 0; border-bottom: 1px solid #dee2e6; font-weight: bold;">Queue Number:</td>
                <td style="padding: 8px 0; border-bottom: 1px solid #dee2e6;">#${queueNumber}</td>
              </tr>
              ` : ''}
              ${cancelReason ? `
              <tr>
                <td style="padding: 8px 0; border-bottom: 1px solid #dee2e6; font-weight: bold;">Cancellation Reason:</td>
                <td style="padding: 8px 0; border-bottom: 1px solid #dee2e6;">${cancelReason}</td>
              </tr>
              ` : ''}
            </table>
          </div>
          
          <div style="background-color: #e7f3ff; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #1890ff;">
            <p style="margin: 0; color: #004085;">
              <strong>Note:</strong> This time slot is now available for other patients. The booking counter has been automatically updated.
            </p>
          </div>
          
          <p style="color: #666; font-size: 14px;">
            This is an automated notification from the TimeFly Healthcare System.
          </p>
          
          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e0e0e0; color: #666; font-size: 12px; text-align: center;">
            <p>TimeFly Healthcare Management System</p>
            <p>📍 Eye Care Center | 📞 Contact: +63 912 345 6789</p>
            <p>⏰ Operating Hours: 8:00 AM - 5:00 PM, Monday to Saturday</p>
          </div>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);

    console.log('✅ Cancellation email sent to staff for:', patientName);
    
    res.status(200).json({ 
      success: true, 
      message: 'Cancellation notification sent successfully to staff' 
    });

  } catch (error) {
    console.error('❌ Error sending cancellation notification:', error);
    res.status(500).json({ 
      success: false,
      error: `Failed to send cancellation notification: ${error.message}` 
    });
  }
}

// Helper function to convert 24-hour time to 12-hour format
function convertTo12Hour(time24) {
  const [hours, minutes] = time24.split(':').map(Number);
  const period = hours >= 12 ? 'PM' : 'AM';
  const hours12 = hours % 12 || 12;
  return `${hours12}:${minutes.toString().padStart(2, '0')} ${period}`;
}