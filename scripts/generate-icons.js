// Simple icon generation script
// In a real production app, you'd use sharp or jimp to generate multiple sizes
// For now, we'll create a simple SVG that can be used as a placeholder

const fs = require('fs');
const path = require('path');

const iconSizes = [72, 96, 128, 144, 152, 192, 384, 512];

const iconsDir = path.join(__dirname, '../client/public/icons');

// Create icons directory if it doesn't exist
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

// Create a simple SVG icon for each size
const createIcon = (size) => {
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#e91e63;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#9c27b0;stop-opacity:1" />
    </linearGradient>
  </defs>
  <rect width="${size}" height="${size}" rx="${size * 0.2}" fill="url(#gradient)"/>
  <text x="50%" y="50%" text-anchor="middle" dominant-baseline="central" 
        font-family="Arial, sans-serif" font-size="${size * 0.5}" font-weight="bold" fill="white">A</text>
</svg>`;

  const filename = path.join(iconsDir, `icon-${size}x${size}.png`);
  const svgFilename = path.join(iconsDir, `icon-${size}x${size}.svg`);
  
  // Save as SVG (browsers can handle SVG as PNG in manifests)
  fs.writeFileSync(svgFilename, svg);
  console.log(`Created ${svgFilename}`);
};

// Generate all icon sizes
iconSizes.forEach(size => createIcon(size));

console.log('Icon generation complete!');
console.log('Note: For production, use a real icon and convert to PNG using sharp or similar tool.');
