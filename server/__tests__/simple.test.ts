describe('Simple Test', () => {
  it('should pass', () => {
    expect(1 + 1).toBe(2);
  });
  
  it('should have NODE_ENV set to test', () => {
    expect(process.env.NODE_ENV).toBe('test');
  });
});
