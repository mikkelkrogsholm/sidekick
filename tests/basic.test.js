/**
 * Basic tests to verify the test environment is working
 */

describe('Test Environment Verification', () => {
  test('Jest is working correctly', () => {
    expect(1 + 1).toBe(2);
  });

  test('Global mocks are available', () => {
    expect(global.fetch).toBeDefined();
    expect(global.localStorage).toBeDefined();
    expect(global.TestUtils).toBeDefined();
  });

  test('DOM environment is available', () => {
    expect(document).toBeDefined();
    expect(window).toBeDefined();
  });

  test('localStorage mock works', () => {
    localStorage.setItem('test', 'value');
    expect(localStorage.getItem('test')).toBe('value');
    localStorage.removeItem('test');
    expect(localStorage.getItem('test')).toBeNull();
  });

  test('fetch mock can be configured', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ test: 'data' })
    });

    const response = await fetch('/test');
    const data = await response.json();

    expect(data.test).toBe('data');
    expect(fetch).toHaveBeenCalledWith('/test');
  });
});