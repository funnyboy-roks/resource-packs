const fs = require('fs');

const targetJson = JSON.stringify({
  'effect.duration.infinite': '**:**',
});

(async () => {
    // This URL is achieved by digging through the assets files: https://blog.funnyboyroks.com/getting-mc-lang-files
    // Since the actual hashes in the JSON file don't matter, we can likely keep using this for a while
    // (until the structure of the resource pack changes or a new language is added)
    let data = await fetch('https://piston-meta.mojang.com/v1/packages/c492375ded5da34b646b8c5c0842a0028bc69cec/2.json');
    data = await data.json();
    // Get the keys that contain a path to a lang file
    let keys = Object.keys(data.objects).filter(k => k.includes('/lang/'));
    // Write the json to each of them
    keys.forEach(path => {
      fs.writeFileSync('./assets/' + path, targetJson);
    });
})();
