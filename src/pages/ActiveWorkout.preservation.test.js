import fs from 'fs';
import path from 'path';

describe('active workout preserved completion affordances', () => {
  test('completed exercises render the established green check indicator', () => {
    const source = fs.readFileSync(
      path.join(__dirname, 'ActiveWorkout.js'),
      'utf8'
    );

    expect(source).toMatch(/done\s*\?\s*\(\s*<span className="aw-check"[^>]*>✓<\/span>/s);
  });
});
