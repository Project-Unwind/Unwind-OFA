interface SendBrevoEmailParams {
  toEmail: string;
  toName: string;
  subject: string;
  htmlContent: string;
  textContent: string;
}

async function sendBrevoEmail({
  toEmail,
  toName,
  subject,
  htmlContent,
  textContent,
}: SendBrevoEmailParams): Promise<unknown> {
  const apiKey = process.env.BREVO_API_KEY;
  const senderEmail = process.env.BREVO_SENDER_EMAIL;
  const senderName =
    process.env.BREVO_SENDER_NAME || 'Unwind OFA';

  if (!apiKey || !senderEmail) {
    throw new Error('Brevo email configuration is missing.');
  }

  const response = await fetch(
    'https://api.brevo.com/v3/smtp/email',
    {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'api-key': apiKey,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        sender: {
          name: senderName,
          email: senderEmail,
        },
        to: [
          {
            email: toEmail,
            name: toName,
          },
        ],
        subject,
        htmlContent,
        textContent,
      }),
    }
  );

  if (!response.ok) {
    const errorDetails = await response.text();

    console.error(
      'Brevo email delivery failed:',
      response.status,
      errorDetails
    );

    throw new Error('Unable to send the email.');
  }

  return response.json();
}

export { sendBrevoEmail };