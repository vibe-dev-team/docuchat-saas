import { SignJWT, jwtVerify } from 'jose';
import { env } from '@docuchat/config';

const accessSecret = new TextEncoder().encode(env.auth.accessTokenSecret);

export type AccessTokenPayload = {
  sub: string;
  tid: string;
  role: string;
};

export const signAccessToken = async (payload: AccessTokenPayload) => {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuer(env.auth.issuer)
    .setAudience(env.auth.audience)
    .setIssuedAt()
    .setExpirationTime(`${env.auth.accessTokenTtlSeconds}s`)
    .sign(accessSecret);
};

export const verifyAccessToken = async (token: string) => {
  const { payload } = await jwtVerify<AccessTokenPayload>(token, accessSecret, {
    issuer: env.auth.issuer,
    audience: env.auth.audience
  });
  return payload;
};
