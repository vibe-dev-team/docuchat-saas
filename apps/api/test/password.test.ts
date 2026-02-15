import { describe, expect, it } from 'vitest';
import { validatePassword } from '../src/lib/password';

const minLength = 12;

describe('validatePassword', () => {
  it('rejects short passwords', () => {
    expect(validatePassword('Short1A', minLength)).toMatch(/at least/);
  });

  it('rejects missing uppercase', () => {
    expect(validatePassword('lowercase1234', minLength)).toMatch(/uppercase/);
  });

  it('rejects missing lowercase', () => {
    expect(validatePassword('UPPERCASE1234', minLength)).toMatch(/lowercase/);
  });

  it('rejects missing number', () => {
    expect(validatePassword('NoNumbersHere', minLength)).toMatch(/number/);
  });

  it('accepts strong password', () => {
    expect(validatePassword('StrongPass123', minLength)).toBeNull();
  });
});
