import logger from '../../utils/logger';

/**
 * Email send job.
 *
 * Refactored from the synchronous emailService path. The job payload is the
 * fully-rendered email (to, subject, html). The actual transport is left to
 * the existing nodemailer setup — this job just decouples sending from the
 * request that triggered it (e.g. order confirmation emails no longer block
 * the checkout response).
 *
 * Note: the emailService is intentionally not imported here to avoid a
 * circular dependency; the transport is constructed lazily inside the job.
 */
export async function runEmailSend(data: {
  to: string;
  subject: string;
  html: string;
}): Promise<void> {
  if (!data?.to || !data?.subject) {
    logger.warn({ msg: '[job] Email send skipped — missing required fields' });
    return;
  }

  // Lazy import to avoid loading nodemailer when the queue isn't used.
  const { default: emailService } = await import('../../services/emailService');
  await emailService.sendEmail({
    to: data.to,
    subject: data.subject,
    html: data.html,
  });
}
