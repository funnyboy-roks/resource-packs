const Jimp = require('jimp');
const fs = require('fs');
const path = require('path');
const GIFEncoder = require('gifencoder');
const pngFileStream = require('png-file-stream');


const invert = (hex) => {
    hex >>= 8;
    b = 255n - BigInt(hex & 0xff);

    hex >>= 8;
    g = 255n - BigInt(hex & 0xff);

    hex >>= 8;
    r = 255n - BigInt(hex & 0xff);

    return Number(r << 24n | g << 16n | b << 8n | 255n)
}

const log = (smth) => {
    console.log(smth);
    return smth;
}

const colour = (hex) => {
    hex = BigInt(hex)
    if (hex & 0xff_00_00_00n) { // Alpha is present
        hex >>= 8n;
    }
    b = hex & 0xffn;
    hex >>= 8n;
    g = hex & 0xffn;
    hex >>= 8n;
    r = hex & 0xffn;
    return [Number(r), Number(g), Number(b)];
}

const toColour = ([r, g, b]) => {
    r = BigInt(r);
    g = BigInt(g);
    b = BigInt(b);
    return Number(r << 24n | g << 16n | b << 8n | 255n);
}

const darken = (hex, amount) => {
    let [r, g, b] = colour(hex);
    r = Math.max(0, r - amount);
    g = Math.max(0, g - amount);
    b = Math.max(0, b - amount);
    return toColour([r, g, b]);
}

const distSq = (hex) => {
    let [r, g, b] = colour(hex);
    return r * r + g * g + b * b;
}

const greyscaleDelta = (hex) => {
    hex = BigInt(hex);
    if (hex & 0xff_00_00_00n) { // Alpha is present
        hex >>= 8n;
    }
    b = hex & 0xffn;
    hex >>= 8n;
    g = hex & 0xffn;
    hex >>= 8n;
    r = hex & 0xffn;

    return [r - b, r - g, b - g].map(Number).map(Math.abs).sort((a, b) => b - a)[0];
}

const isGreyscale = (hex, tolerance) => {
    return greyscaleDelta(hex) <= tolerance;
}

const range = (min, max) => max < min ? range(max, min).reverse() : Array.from({ length: max - min }, (_, i) => i + min);
const repeat = (arr, count) => Array(count).fill(0).flatMap(f => arr);

const border = repeat([
    ...range(0, 16).map(n => ({ x: n,  y: 0  })),
    ...range(1, 16).map(n => ({ x: 15, y: n  })),
    ...range(15, 0).map(n => ({ x: n,  y: 15 })),
    ...range(15, 1).map(n => ({ x: 0,  y: n  })),
], 10);

const colourOverrides = {
    'ancient_debris': 0xaa0000ff,
    'coal': 0x313131ff,
};

const processImage = async (inPath, outPath) => {
    const img = await Jimp.read(inPath);
    const maxColour = distSq(0xcccccc);
    const minColour = distSq(0x888888);
    const matchingKey = Object.keys(colourOverrides).filter(k => inPath.includes(k))[0];
    const pixels = matchingKey
        ? [colourOverrides[matchingKey]]
        : range(0, 16)
            .flatMap(x => range(0, 16).map(y => ({x, y})))
            .map(({x, y}) => img.getPixelColour(x, y))
            .filter(c => !isGreyscale(c, 39))
            .filter(c => distSq(c) <= maxColour)
            .filter(c => distSq(c) >= minColour)
            .sort((a, b) => distSq(b) - distSq(a))
            .map(c => BigInt(c))
    pixels.unshift(pixels[Math.floor(pixels.length * .75)]);
    const height = 10; // The factor to increase the height by (true hight is that * 16)
    const out = new Jimp(img.getWidth(), img.getHeight() * height);
    const borderColour = BigInt(pixels[0]) | 0xffn
    //console.log({inPath, borderColour: (borderColour >> 8n).toString(16)});
    for(let i = 0; i < height; ++i) {
        for (let x = 0; x < img.getWidth(); x++) {
            for(let y = 0; y < img.getHeight(); ++y) {
                out.setPixelColour(img.getPixelColor(x, y), x, y + 16 * i);
            }
        }
        //const amt = Math.floor(border.length / height);
        const amt = 12;
        const start = i * (amt / 2);
        const pixels = border.slice(start, start + amt);
        const col = () => darken(Number(borderColour) | 0x01_00_00_00, Math.floor(Math.random() * 10));
        pixels.forEach(({x, y}) => {
            const dTop = 16 * i;
            if (x >= 1) {
                out.setPixelColour(col(), x - 1, y + dTop);
            }
            if (x <= 14) {
                out.setPixelColour(col(), x + 1, y + dTop);
            }
            if (y >= 1) {
                out.setPixelColour(col(), x, y - 1 + dTop);
            }
            if (y <= 14) {
                out.setPixelColour(col(), x, y + 1 + dTop);
            }
            out.setPixelColour(col(), x, y + dTop);
        });
    }

    await out.writeAsync(outPath);
}

const generatePackPng = async (srcPath) => {
    const img = await Jimp.read(srcPath);
    const out = new Jimp(img.getWidth(), img.getWidth());
    for (let x = 0; x < img.getWidth(); x++) {
        for (let y = 0; y < img.getWidth(); y++) {
            out.setPixelColour(img.getPixelColour(x, y + 1 * img.getWidth()), x, y);
        }
    }
    await out.writeAsync('./pack.png');
    console.log('pack.png generated');

    console.log('Generating icon.gif');
    try {
        fs.rmSync('./icon-frames/', {recursive: true});
        fs.mkdirSync('./icon-frames/');
    } catch (e) {}
    const frames = img.getHeight() / img.getWidth();
    for (let i = 0; i < frames; ++i) {
        const out = new Jimp(img.getWidth() * 30, img.getWidth() * 30); // 480x480
        for (let x = 0; x < out.getWidth(); x++) {
            for (let y = 0; y < out.getHeight(); y++) {
                out.setPixelColour(img.getPixelColour(Math.floor(x / 30), Math.floor(y / 30) + i * img.getWidth()), x, y);
            }
        }
        await out.writeAsync('./icon-frames/frame' + i.toString().padStart(2, '0') + '.png');
    }
    const encoder = new GIFEncoder(img.getWidth() * 30, img.getWidth() * 30); // 480x480
    await pngFileStream('./icon-frames/frame*.png')
        .pipe(encoder.createWriteStream({ repeat: 0, delay: 100, quality: 10 }))
        .pipe(fs.createWriteStream('icon.gif'));
}

const generateGalleryImage = async (imagePaths) => {
    console.log('Generating Gallery Image');
    const images = imagePaths.map(p => p);
    for (const i in images) { // Better than map b/c promises
        images[i] = await Jimp.read(images[i]);
    }

    const framedir = './gallery-img-frames/';
    try {
        fs.rmSync(framedir, { recursive: true });
        fs.mkdirSync(framedir);
    } catch (e) {}
    const frameCount = images[0].getHeight() / images[0].getWidth(); // Each image should have the same # of frames, so only calc image 0
    const width = 6;
    const height = Math.ceil(images.length / width);

    const pixelScale = 16;
    const frameWidth = width * images[0].getWidth() * pixelScale;
    const frameHeight = height * images[0].getWidth() * pixelScale;
    for (let i = 0; i < frameCount; ++i) {
        const frame = new Jimp(frameWidth, frameHeight);
        for (let y = 0; y < frame.getHeight(); ++y) {
            for (let x = 0; x < frame.getWidth(); ++x) {
                let trueX = Math.floor(x / pixelScale);
                let trueY = Math.floor(y / pixelScale);
                let imgX = Math.floor(trueX / 16);
                let imgY = Math.floor(trueY / 16);
                const srcImg = images[imgX + imgY * width];
                if (!srcImg) continue;
                const offsetY = srcImg.getHeight() === srcImg.getWidth() ? 0 : i * 16; // For the stone/netherrack
                frame.setPixelColour(srcImg.getPixelColour(trueX % 16, trueY % 16 + offsetY), x, y);
            }
        }
        await frame.writeAsync(framedir + 'frame' + i.toString().padStart(2, '0') + '.png');
    }
    const encoder = new GIFEncoder(frameWidth, frameHeight);
    await pngFileStream(framedir + 'frame*.png')
        .pipe(encoder.createWriteStream({ repeat: 0, delay: 100, quality: 10 }))
        .pipe(fs.createWriteStream('./img/gallery-image.gif'));
    console.log('Generated Gallery Image');
}

const files = [
    'coal_ore.png',
    'deepslate_coal_ore.png',

    'copper_ore.png',
    'deepslate_copper_ore.png',

    'gold_ore.png',
    'deepslate_gold_ore.png',

    'iron_ore.png',
    'deepslate_iron_ore.png',

    'lapis_ore.png',
    'deepslate_lapis_ore.png',

    'redstone_ore.png',
    'deepslate_redstone_ore.png',

    '-stone.png',

    'diamond_ore.png',
    'deepslate_diamond_ore.png',

    'emerald_ore.png',
    'deepslate_emerald_ore.png',

    '-stone.png',
    '-netherrack.png',

    'nether_gold_ore.png',
    'nether_quartz_ore.png',

    'ancient_debris_top.png',
    'ancient_debris_side.png',

    '-netherrack.png',
];
fs.mkdirSync('./assets/minecraft/textures/block', {recursive: true});
for (const file of files.filter(f => !f.startsWith('-'))) {
    const srcPath = `../textures/block/${file}`;
    processImage(srcPath, `./assets/minecraft/textures/block/${file}`);
    const mcmeta = JSON.stringify({
        animation: {
            interpolate: true,
            frametime: 2,
        },
    }, null, 4);
    fs.writeFileSync(`./assets/minecraft/textures/block/${file}.mcmeta`, mcmeta);
}
generatePackPng('./assets/minecraft/textures/block/diamond_ore.png');
generateGalleryImage(files.map(f => {
    if(!f.startsWith('-'))
        return './assets/minecraft/textures/block/' + f;
    return '../textures/block/' + f.substring(1);
}));
fs.writeFileSync('./pack.mcmeta', JSON.stringify({
    pack: {
        pack_format: 12,
        description: '§6Make ores stand out!\n§3By: funnyboy_roks',
    },
}, null, 4), 'utf-8');
