import fs from 'node:fs';

const roomsTsPath = 'packages/shared/src/rooms.ts';
let content = fs.readFileSync(roomsTsPath, 'utf8');

// Replace jpg with 400w.webp for thumbnails
content = content.replace(
  /imageUrl: 'assets\/images\/chambres\/(chambre-[^.]+)\.jpg'/g,
  "imageUrl: 'assets/images/chambres/$1-400w.webp'"
);
content = content.replace(
  "FALLBACK_ROOM_IMAGE = 'assets/images/chambres/chambre-fallback.jpg'",
  "FALLBACK_ROOM_IMAGE = 'assets/images/chambres/chambre-fallback.webp'"
);

fs.writeFileSync(roomsTsPath, content, 'utf8');
console.log('SEED_ROOMS updated to 400w.webp successfully');
