const fs = require('fs');
const path = require('path');

const publicDir = path.join(__dirname, '..', 'public');

function pngDimensions(fileName) {
  const buffer = fs.readFileSync(path.join(publicDir, fileName));
  expect(buffer.subarray(1, 4).toString()).toBe('PNG');
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

describe('RepTrack PWA identity contract', () => {
  test('manifest uses the RepTrack identity and installable icon set', () => {
    const manifest = JSON.parse(fs.readFileSync(path.join(publicDir, 'manifest.json'), 'utf8'));

    expect(manifest.name).toBe('RepTrack');
    expect(manifest.short_name).toBe('RepTrack');
    expect(manifest.description).toMatch(/workout/i);
    expect(manifest.start_url).toBe('/reptrack/');
    expect(manifest.scope).toBe('/reptrack/');
    expect(manifest.display).toBe('standalone');
    expect(manifest.theme_color).toBe('#0F1216');
    expect(manifest.background_color).toBe('#0F1216');
    expect(manifest.icons).toEqual(expect.arrayContaining([
      expect.objectContaining({ src: 'reptrack-192.png', sizes: '192x192', type: 'image/png' }),
      expect.objectContaining({ src: 'reptrack-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' }),
    ]));
    expect(pngDimensions('reptrack-192.png')).toEqual({ width: 192, height: 192 });
    expect(pngDimensions('reptrack-512.png')).toEqual({ width: 512, height: 512 });
  });

  test('HTML metadata names RepTrack and links the correct touch icon', () => {
    const html = fs.readFileSync(path.join(publicDir, 'index.html'), 'utf8');

    expect(html).toContain('<title>RepTrack</title>');
    expect(html).toContain('content="#0F1216"');
    expect(html).toMatch(/name="description"[\s\S]*RepTrack/);
    expect(html).toContain('apple-mobile-web-app-capable');
    expect(html).toContain('%PUBLIC_URL%/reptrack-192.png');
  });

  test('service worker uses a GitHub Pages safe cache policy', () => {
    const source = fs.readFileSync(path.join(publicDir, 'service-worker.js'), 'utf8');

    expect(source).toMatch(/reptrack-static-v/);
    expect(source).toMatch(/reptrack-pages-v/);
    expect(source).toMatch(/isHashedAssetRequest/);
    expect(source).toMatch(/cacheFirst/);
    expect(source).toMatch(/networkFirst/);
    expect(source).toMatch(/build-info\.json/);
    expect(source).toMatch(/event\.request\.mode === ['"]navigate['"]/);
    expect(source).toMatch(/Content-Type[\s\S]*text\/html/);
    expect(source).toMatch(/deleteOldCaches/);
    expect(source).toMatch(/REPTRACK_SW_KILL_SWITCH/);
    expect(source).toMatch(/registration\.unregister\(\)/);
    expect(source).toMatch(/isApiRequest/);
    expect(source).toMatch(/supabase/);
    expect(source).toMatch(/\/auth\/v1\//);
    expect(source).toMatch(/\/rest\/v1\//);
    expect(source).toMatch(/\/functions\/v1\//);
  });
});
