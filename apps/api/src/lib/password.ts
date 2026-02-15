import argon2 from 'argon2';

export const hashPassword = async (password: string) => {
  return argon2.hash(password, { type: argon2.argon2id });
};

export const verifyPassword = async (hash: string, password: string) => {
  return argon2.verify(hash, password);
};

export const validatePassword = (password: string, minLength: number) => {
  if (password.length < minLength) {
    return `Password must be at least ${minLength} characters long.`;
  }
  if (!/[A-Z]/.test(password)) {
    return 'Password must include at least one uppercase letter.';
  }
  if (!/[a-z]/.test(password)) {
    return 'Password must include at least one lowercase letter.';
  }
  if (!/[0-9]/.test(password)) {
    return 'Password must include at least one number.';
  }
  return null;
};
