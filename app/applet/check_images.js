const fs = require('fs');
const path = require('path');

console.log('Public files:', fs.readdirSync('public').filter(f => f.includes('badge') || f.includes('logo')));
