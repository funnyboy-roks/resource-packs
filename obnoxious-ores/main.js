const Jimp = require('jimp');
const fs = require('fs');
const GIFEncoder = require('gifencoder');
const pngFileStream = require('png-file-stream');

// Convert from int colour to array
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

// Convert from array to int colour
const toColour = ([r, g, b]) => {
    r = BigInt(r);
    g = BigInt(g);
    b = BigInt(b);
    return Number(r << 24n | g << 16n | b << 8n | 255n);
}

// Darken a hex code by some amount (Doesn't go lower than 0)
const darken = (hex, amount) => {
    let [r, g, b] = colour(hex);
    r = Math.max(0, r - amount);
    g = Math.max(0, g - amount);
    b = Math.max(0, b - amount);
    return toColour([r, g, b]);
}

// Find the "distance" of the provided hex code from black (#000000)
const distSq = (hex) => {
    let [r, g, b] = colour(hex);
    return r * r + g * g + b * b;
}

// The largest delta between r, g, or b in the provided hex
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

// Determine if a hex colour is greyscale within a certain tollerance.
const isGreyscale = (hex, tolerance) => greyscaleDelta(hex) <= tolerance;

// Basically a clone of Python's `range` function
const range = (min, max) => max < min ? range(max, min).reverse() : Array.from({ length: max - min }, (_, i) => i + min);
// Repeat an array `count` times
const repeat = (arr, count) => Array(count).fill(0).flatMap(() => arr);

const invertHex = (hex) => {
    let [r, g, b] = colour(hex);
    
    r = 255 - r;
    g = 255 - g;
    b = 255 - b;

    return toColour([r, g, b]);
};

// Represents the border of the image (order of this array dictates the order by which the outer animation moves)
// This is repeated a few times to allow the animation to loop (this may not be needed anymore but meh)
const border = repeat([
    ...range(0, 16).map(n => ({ x: n,  y: 0  })),
    ...range(1, 16).map(n => ({ x: 15, y: n  })),
    ...range(15, 0).map(n => ({ x: n,  y: 15 })),
    ...range(15, 1).map(n => ({ x: 0,  y: n  })),
], 2);

// Override the colour of certain textures (key is not checked for exact match, just partial)
// _Note: Do not include the alpha channel, it is added later_
const colourOverrides = {
    //ancient_debris: 0xaa0000,
    coal: 0x313131, // Literally just a random dark colour :P
};

const processImage = async (inPath, outPath) => {
    const img = await Jimp.read(inPath);
    const maxColour = distSq(0xcccccc); // Min/Max colour are decided by checking the distance from #000
    const minColour = distSq(0x888888); // ^
    const matchingKey = Object.keys(colourOverrides).filter(k => inPath.includes(k))[0];
    let invert = false;
    let blueify = false;
    let borderColour = 0;
    if (matchingKey) { // If an override matches, then use it
        borderColour = colourOverrides[matchingKey] << 8 | 0xff;
    } else if (inPath.includes('ancient_debris')) {
        invert = true;
    } else if (inPath.includes('sus')) {
        blueify = true;
    } else { // Otherwise, get the colours of the ore and use them
        const pixels = range(0, 16)
                .flatMap(x => range(0, 16).map(y => ({x, y})))
                .map(({x, y}) => img.getPixelColour(x, y))
                .filter(c => !isGreyscale(c, 39))
                .filter(c => distSq(c) <= maxColour)
                .filter(c => distSq(c) >= minColour)
                .sort((a, b) => distSq(b) - distSq(a))
        borderColour = pixels[Math.floor(pixels.length * .75)] | 0xff; // Find a bright colour, but not the brightest
    }
    const frames = 10; // The amount of frames that will be rendered
    const out = new Jimp(img.getWidth(), img.getHeight() * frames);
    for(let i = 0; i < frames; ++i) {
        for (let x = 0; x < img.getWidth(); x++) {
            for(let y = 0; y < img.getHeight(); ++y) {
                out.setPixelColour(img.getPixelColor(x, y), x, y + 16 * i);
            }
        }
        const amt = 12;
        const start = i * (amt / 2);
        const pixels = border.slice(start, start + amt);
        // Get a slightly randomised colour to give it some texture
        // The | 0x01... is to force it to have some red, so that the alpha checks are true. (Mainly only for Emerald where there is 0 red)
        if (invert) borderImg = img.clone().invert();
        if (blueify) borderImg = img.clone().invert().color([
            { apply: 'red', params: [0xa0] },
        ]);
        const col = ({x, y}) => invert || blueify
            ? borderImg.getPixelColour(x, y)
            : darken(Number(borderColour) | 0x01_00_00_00, Math.floor(Math.random() * 10));
        // Draw a "+" shape to give the border some width
        pixels.forEach(({x, y}) => {
            const padTop = 16 * i;
            if (x >= 1) out.setPixelColour(col({x, y}), x - 1, y + padTop);
            if (x <= 14) out.setPixelColour(col({x, y}), x + 1, y + padTop);
            if (y >= 1) out.setPixelColour(col({x, y}), x, y - 1 + padTop);
            if (y <= 14) out.setPixelColour(col({x, y}), x, y + 1 + padTop);
            out.setPixelColour(col({x, y}), x, y + padTop);
        });
    }

    await out.writeAsync(outPath);
}

const generatePackPng = async (srcPath) => {
    const img = await Jimp.read(srcPath);
    const out = new Jimp(img.getWidth(), img.getWidth());
    // Copy a frame from the provided `srcPath` image
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
    // Using the provided `srcPath` image, generate a GIF of it moving as it would ingame
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
    pngFileStream('./icon-frames/frame*.png')
        .pipe(encoder.createWriteStream({ repeat: 0, delay: 100, quality: 10 }))
        .pipe(fs.createWriteStream('icon.gif'));
}

// Generate an image for the modrinth galery that is animated
// imagePaths should be an array of paths to the images
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
    pngFileStream(framedir + 'frame*.png')
        .pipe(encoder.createWriteStream({ repeat: 0, delay: 100, quality: 10 }))
        .pipe(fs.createWriteStream('./img/gallery-image.gif'));
    console.log('Generated Gallery Image');
}

// The order of this array controls the order in which the ores in the gallery image appear
// Anything that starts with `-` is ignored by the actual image generation, but put into the gallery image,
// this is used for the stone/netherrack fillers.
// Anything that starts with `=` is ignored by the gallery image generation, but not by the image generator
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

    'suspicious_sand_0.png',
    '=suspicious_sand_1.png',
    '=suspicious_sand_2.png',
    '=suspicious_sand_3.png',

    'diamond_ore.png',
    'deepslate_diamond_ore.png',

    'emerald_ore.png',
    'deepslate_emerald_ore.png',

    'suspicious_gravel_0.png',
    '=suspicious_gravel_1.png',
    '=suspicious_gravel_2.png',
    '=suspicious_gravel_3.png',
    '-netherrack.png',

    'nether_gold_ore.png',
    'nether_quartz_ore.png',

    'ancient_debris_top.png',
    'ancient_debris_side.png',

    '-netherrack.png',
];
fs.mkdirSync('./assets/minecraft/textures/block', {recursive: true});
// The mcmeta to use for each animation - outside of function due to slowness of `JSON.stringify`.
const mcmeta = JSON.stringify({
    animation: {
        interpolate: true,
        frametime: 2,
    },
}, null, 4);
for (let file of files.filter(f => !f.startsWith('-'))) {
    if (file.startsWith('=')) file = file.substring(1);
    const srcPath = `../textures/block/${file}`;
    processImage(srcPath, `./assets/minecraft/textures/block/${file}`);
    fs.writeFileSync(`./assets/minecraft/textures/block/${file}.mcmeta`, mcmeta);
}
generatePackPng('./assets/minecraft/textures/block/diamond_ore.png');
generateGalleryImage(files
    .filter(f => !f.startsWith('='))
    .map(f => !f.startsWith('-') ? './assets/minecraft/textures/block/' + f : '../textures/block/' + f.substring(1))
);
fs.writeFileSync('./pack.mcmeta', JSON.stringify({
    pack: {
        pack_format: 15,
        description: '§6Make ores stand out!\n§3By: funnyboy_roks',
    },
}, null, 4), 'utf-8');
