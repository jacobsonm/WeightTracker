import { isValidTimezone } from '../lambda/shared/timezone';

describe('isValidTimezone', () => {
  it('accepts valid IANA timezones', () => {
    expect(isValidTimezone('America/New_York')).toBe(true);
    expect(isValidTimezone('UTC')).toBe(true);
  });

  it('rejects invalid timezones', () => {
    expect(isValidTimezone('')).toBe(false);
    expect(isValidTimezone('Not/A_Zone')).toBe(false);
  });
});
