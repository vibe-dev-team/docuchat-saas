import { env } from '@docuchat/config';
import { createLogger } from '@docuchat/logger';

const logger = createLogger(env.apiLogLevel);

export type MailMessage = {
  to: string;
  subject: string;
  text: string;
};

export const sendMail = async (message: MailMessage) => {
  logger.info({ message }, 'Email delivery stub (configure provider for prod)');
};
