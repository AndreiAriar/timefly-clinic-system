export default async function handler(req, res) {
  // Enable CORS
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

  const { email, code } = req.body;

  if (!email || !code) {
    return res.status(400).json({ error: 'Email and code are required' });
  }

  try {
    // Access the global verification codes
    const verificationCodes = global.verificationCodes || new Map();
    const storedData = verificationCodes.get(email);

    if (!storedData) {
      return res.status(400).json({ 
        success: false,
        error: 'No verification code found for this email' 
      });
    }

    if (Date.now() > storedData.expiresAt) {
      verificationCodes.delete(email);
      return res.status(400).json({ 
        success: false,
        error: 'Verification code has expired' 
      });
    }

    if (storedData.code !== code) {
      return res.status(400).json({ 
        success: false,
        error: 'Invalid verification code' 
      });
    }

    // Code is valid - remove it
    verificationCodes.delete(email);

    res.status(200).json({ 
      success: true,
      message: 'Email verified successfully' 
    });
  } catch (error) {
    console.error('❌ Error verifying code:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to verify code' 
    });
  }
}