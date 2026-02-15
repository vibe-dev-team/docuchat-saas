import crypto from 'node:crypto';

export const generateToken = (bytes = 48) => {
  return crypto.randomBytes(bytes).toString('base64url');
};

export const hashToken = (token: string) => {
  return crypto.createHash('sha256').update(token).digest('hex');
};

export const hashTokenWithSecret = (token: string, secret: string) => {
  return crypto.createHmac('sha256', secret).update(token).digest('hex');
};
