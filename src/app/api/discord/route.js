import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file'); // PDF Blob
    const dataEntry = formData.get('data');

    if (!file || !dataEntry) {
      return NextResponse.json({ error: 'Missing file or data' }, { status: 400 });
    }

    const dataStr = typeof dataEntry.text === 'function' ? await dataEntry.text() : String(dataEntry);
    const data = JSON.parse(dataStr);
    const { companyName, website, applicantName, applicantEmail, channelId, token } = data;

    if (!token || !channelId) {
      return NextResponse.json({ error: 'Discord config missing' }, { status: 400 });
    }

    // Clean token and channelId
    let cleanToken = String(token).trim().replace(/^["']|["']$/g, '');
    if (cleanToken.startsWith('Bot ')) {
      cleanToken = cleanToken.slice(4).trim();
    }
    const cleanChannelId = String(channelId).trim().replace(/^["']|["']$/g, '');

    // Convert file Blob to Buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Sanitize filename to strict ASCII to prevent ByteString HTTP Header errors
    const safeCompanyName = String(companyName || 'company')
      .replace(/[^\x00-\x7F]/g, '') // remove non-ASCII
      .replace(/[^\w\s-]/g, '')     // remove special chars
      .trim()
      .replace(/\s+/g, '_') || 'Company';

    const fileName = `${safeCompanyName}_Report.pdf`;

    const messageContent = `**New Company Research Report Generated!**\n\n` +
      `**Applicant Details:**\n` +
      `- Name: ${applicantName || 'Not Provided'}\n` +
      `- Email: ${applicantEmail || 'Not Provided'}\n\n` +
      `**Research Details:**\n` +
      `- Company: ${companyName}\n` +
      `- Website: ${website}\n\n` +
      `Please find the generated PDF report attached below.`;

    const safeMessageContent = messageContent.replace(/[^\x00-\x7F]/g, '');

    // Official Discord API v10 Multipart Format
    const discordPayload = new FormData();
    discordPayload.append('payload_json', JSON.stringify({
      content: safeMessageContent
    }));

    const pdfBlob = new Blob([buffer], { type: 'application/pdf' });
    discordPayload.append('files[0]', pdfBlob, fileName);

    const discordResponse = await fetch(`https://discord.com/api/v10/channels/${cleanChannelId}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bot ${cleanToken}`
      },
      body: discordPayload
    });

    if (!discordResponse.ok) {
      const errText = await discordResponse.text();
      console.error('Discord API Error Response:', errText);
      return NextResponse.json({ 
        error: discordResponse.status === 401 
          ? 'Invalid Discord Bot Token. Please check your Bot Token in Settings.' 
          : `Discord API Error: ${discordResponse.status}` 
      }, { status: discordResponse.status });
    }

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Discord API Internal Error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
