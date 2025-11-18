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
    patientName, 
    patientEmail, 
    doctor, 
    appointmentDate, 
    timeSlot, 
    queueNumber,
    priorityLevel,
    medicalCondition 
  } = req.body;

  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD) {
    return res.status(500).json({ error: 'Email service not configured' });
  }

  try {
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD,
      },
    });

    const formatTime = (timeString) => {
      if (!timeString) return 'N/A';
      const [hours, minutes] = timeString.split(':').map(Number);
      const period = hours >= 12 ? 'PM' : 'AM';
      const hours12 = hours % 12 || 12;
      return `${hours12}:${minutes.toString().padStart(2, '0')} ${period}`;
    };

    const formatDate = (dateString) => {
      if (!dateString) return 'N/A';
      return new Date(dateString).toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      });
    };

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: 'timefly.healthcare@gmail.com', // Send to clinic email
      subject: `New Appointment Booking - ${patientName}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #4F46E5; margin: 0;">TimeFly Healthcare</h1>
            <p style="color: #666; margin: 5px 0 0 0;">Eye Care Management System</p>
          </div>

          <h2 style="color: #333; border-bottom: 2px solid #4F46E5; padding-bottom: 10px;">New Appointment Booking</h2>

          <div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0;">
            <h3 style="color: #4F46E5; margin-top: 0;">Patient Details:</h3>
            <p><strong>Name:</strong> ${patientName}</p>
            <p><strong>Email:</strong> ${patientEmail}</p>
            <p><strong>Priority Level:</strong> <span style="text-transform: capitalize;">${priorityLevel}</span></p>
            <p><strong>Medical Condition:</strong> ${medicalCondition}</p>
          </div>

          <div style="background-color: #e7f3ff; padding: 20px; border-radius: 5px; margin: 20px 0; border: 1px solid #b3d9ff;">
            <h3 style="color: #0066cc; margin-top: 0;">Appointment Details:</h3>
            <p><strong>Queue Number:</strong> #${queueNumber}</p>
            <p><strong>Doctor:</strong> ${doctor}</p>
            <p><strong>Date:</strong> ${formatDate(appointmentDate)}</p>
            <p><strong>Time:</strong> ${formatTime(timeSlot)}</p>
            <p><strong>Status:</strong> <span style="color: #059669; font-weight: bold;">Pending</span></p>
          </div>

          <div style="background-color: #fff3cd; padding: 15px; border-radius: 5px; margin: 20px 0; border: 1px solid #ffeaa7;">
            <p style="margin: 0; color: #856404;">
              <strong>Action Required:</strong> This appointment is pending confirmation. Please review and update the status in the staff dashboard.
            </p>
          </div>

          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e0e0e0; color: #666; font-size: 12px;">
            <p>This is an automated notification from TimeFly Healthcare System.</p>
            <p>Please do not reply to this email.</p>
          </div>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);
    console.log(`✅ Booking notification sent to clinic for ${patientName}`);

    res.status(200).json({ 
      success: true, 
      message: 'Booking notification sent successfully' 
    });

  } catch (error) {
    console.error('Error sending booking notification:', error);
    res.status(500).json({ 
      success: false,
      error: `Failed to send booking notification: ${error.message}`
    });
  }
}