const fs = require('fs');
const path = require('path');

const dir = 'c:/Users/p/OneDrive/Documents/HEHE/images';
const p1 = fs.readFileSync(path.join(dir, 'photo1.jpg')).toString('base64');
const p2 = fs.readFileSync(path.join(dir, 'photo2.jpg')).toString('base64');
const p3 = fs.readFileSync(path.join(dir, 'photo3.jpg')).toString('base64');
const p4 = fs.readFileSync(path.join(dir, 'photo4.jpg')).toString('base64');

const jsContent = `const PHOTO_DATA = {
  photo1: "data:image/jpeg;base64,${p1}",
  photo2: "data:image/jpeg;base64,${p2}",
  photo3: "data:image/jpeg;base64,${p3}",
  photo4: "data:image/jpeg;base64,${p4}"
};
`;

fs.writeFileSync('c:/Users/p/OneDrive/Documents/HEHE/images_data.js', jsContent);
console.log('Successfully generated images_data.js!');
