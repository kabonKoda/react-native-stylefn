/**
 * Tests for babel-plugin-react-native-stylefn.
 */

const plugin = require('../index');

describe('babel-plugin-react-native-stylefn', () => {
  it('exports a valid babel plugin', () => {
    expect(typeof plugin).toBe('function');
    const result = plugin({ types: {} });
    expect(result).toHaveProperty('name', 'react-native-stylefn');
    expect(result).toHaveProperty('visitor');
  });

  it('has a Program visitor for auto-injection', () => {
    const result = plugin({ types: {} });
    expect(result.visitor).toHaveProperty('Program');
  });
});
