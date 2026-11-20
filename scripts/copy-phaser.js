// Copies the Phaser build from node_modules into www/js/vendor so the game works offline on the phone.
const fs = require('fs');
const path = require('path');

const src = path.join(__dirname, '..', 'node_modules', 'phaser', 'dist', 'phaser.min.js');
const destDir = path.join(__dirname, '..', 'www', 'js', 'vendor');
const dest = path.join(destDir, 'phaser.min.js');

fs.mkdirSync(destDir, { recursive: true });
fs.copyFileSync(src, dest);
console.log('Copied Phaser to', dest);
