import nodemailer from 'nodemailer';

export interface CommentNotificationData {
  videoTitle: string;
  videoId: string;
  commenterName?: string;
  commenterEmail?: string;
  commentText: string;
  commentTimestamp: string;
  videoUrl: string;
  ownerEmail: string;
  ownerName?: string;
}

class EmailService {
  private transporter: nodemailer.Transporter | null = null;

  private async initializeTransporter() {
    if (this.transporter) return this.transporter;

    // Note: This will be used on the server side only
    const gmailUser = process.env.GMAIL_USER;
    const gmailPassword = process.env.GMAIL_APP_PASSWORD;

    if (!gmailUser || !gmailPassword) {
      throw new Error('Gmail credentials not configured');
    }

    this.transporter = nodemailer.createTransporter({
      service: 'gmail',
      auth: {
        user: gmailUser,
        pass: gmailPassword,
      },
    });

    return this.transporter;
  }

  async sendCommentNotification(data: CommentNotificationData): Promise<boolean> {
    try {
      const transporter = await this.initializeTransporter();

      const htmlTemplate = this.generateCommentEmailTemplate(data);

      const mailOptions = {
        from: `"Previu" <${process.env.GMAIL_USER}>`,
        to: data.ownerEmail,
        subject: `New comment on your video: ${data.videoTitle}`,
        html: htmlTemplate,
        text: this.generatePlainTextEmail(data),
      };

      const result = await transporter.sendMail(mailOptions);
      console.log('Email sent successfully:', result.messageId);
      return true;
    } catch (error) {
      console.error('Error sending email:', error);
      return false;
    }
  }

  private generateCommentEmailTemplate(data: CommentNotificationData): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>New Comment Notification</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f8f9fa; padding: 30px 20px; border-radius: 0 0 8px 8px; }
          .comment-box { background: white; padding: 20px; border-left: 4px solid #667eea; margin: 20px 0; border-radius: 4px; }
          .button { display: inline-block; background: #667eea; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
          .footer { text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; color: #666; font-size: 14px; }
          .logo { font-size: 24px; font-weight: bold; margin-bottom: 10px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="logo">Previu</div>
            <h1>New Comment on Your Video</h1>
          </div>
          
          <div class="content">
            <p>Hello ${data.ownerName || 'there'},</p>
            
            <p>Someone has left a comment on your video <strong>"${data.videoTitle}"</strong>.</p>
            
            <div class="comment-box">
              <h3>💬 Comment Details:</h3>
              <p><strong>Comment:</strong> "${data.commentText}"</p>
              <p><strong>From:</strong> ${data.commenterName || data.commenterEmail || 'Anonymous viewer'}</p>
              <p><strong>Time:</strong> ${data.commentTimestamp}</p>
            </div>
            
            <p>You can view the full video and respond to comments by clicking the button below:</p>
            
            <a href="${data.videoUrl}" class="button">View Video & Comments</a>
            
            <p>Thank you for using Previu for your video sharing needs!</p>
          </div>
          
          <div class="footer">
            <p>This email was sent by Previu - Professional Video Sharing Platform</p>
            <p>If you no longer wish to receive these notifications, please contact support.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  private generatePlainTextEmail(data: CommentNotificationData): string {
    return `
New Comment on Your Video - Previu

Hello ${data.ownerName || 'there'},

Someone has left a comment on your video "${data.videoTitle}".

Comment Details:
- Comment: "${data.commentText}"
- From: ${data.commenterName || data.commenterEmail || 'Anonymous viewer'}
- Time: ${data.commentTimestamp}

View your video and respond to comments: ${data.videoUrl}

Thank you for using Previu!

---
This email was sent by Previu - Professional Video Sharing Platform
    `.trim();
  }

  async testConnection(): Promise<boolean> {
    try {
      const transporter = await this.initializeTransporter();
      await transporter.verify();
      console.log('Email service connection verified');
      return true;
    } catch (error) {
      console.error('Email service connection failed:', error);
      return false;
    }
  }
}

export const emailService = new EmailService();