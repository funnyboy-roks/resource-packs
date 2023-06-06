const Jimp = require('jimp');
const fs = require('fs');

let range = (min, max) => max < min ? range(max, min).reverse() : Array.from({length: max - min}, (_, i) => i + min);

// Note this is kind of really messy and even I do not understand it.
const processImage = async (inPath, outPath, {animation}) => {
    const img = await Jimp.read(inPath)
    const frameCount = animation ? img.getHeight() / (animation.height || img.getWidth()) : 1;
    let height = img.getHeight() / frameCount;
    let width = img.getWidth();

    animation ??= {}; // Hacky way to allow `animation.frames` because I'm too lazy to do it correctly.
    animation.frames ||= range(0, frameCount);
    srcFrameCount = animation.frames?.length || frameCount

    const newFrameCount = animation.frames.length % width === 0
        ? animation.frames.length
        : width * animation.frames.length;
    const out = new Jimp(width, newFrameCount * height);

    const getPixel = (x, y, frame) => img.getPixelColour(x, frame * height + y)
    for (let frame = 0; frame < newFrameCount; ++frame) {
        for (let y = 0; y < height; ++y) {
            for (let x = 0; x < width; ++x) {
                let c = getPixel(
                    ((x - frame) + width * 100) % width, // Magic to get the pixel with wrapping (100 * width to remove negative nums)
                    y,
                    animation.frames.at(frame % animation.frames.length) // Get the frame at the given index (_Much_ easier than storing the frames and adding that to the mcmeta)
                );
                out.setPixelColour(c, x, y + frame * height);
            }
        }
    }
    await out.writeAsync(outPath);
    return { height, width };
}

const createPackPng = async (inPath, outPath) => {
    const img = await Jimp.read(inPath)
    const width = img.getWidth();
    const height = img.getHeight();
    const scaleX = 5;
    const scaleY = 5;
    const out = new Jimp(width * scaleX, height * scaleY);
    if (out.getWidth() !== out.getHeight()) throw 'pack.png output image should be a square.'

    for (let ox = -1; ox < scaleX; ++ox) {
        for (let oy = -1; oy < scaleY; ++oy) {

            for (let x = 0; x < width; ++x) {
                for (let y = 0; y < height; ++y) {
                    let outX = ox * width + x + 4 * oy;
                    let outY = oy * height + y;

                    let px = img.getPixelColour(x, y);
                    if (outX >= 0 && outY >= 0 && outX < out.getWidth() && outY < out.getHeight())
                        out.setPixelColour(px, outX, outY);
                }
            }

        }
    }
    await out.writeAsync(outPath);

}

const run = async () => {
    // These are the only directories which support animations: https://minecraft.fandom.com/wiki/Resource_pack#Animation
    const dirs = ['block', 'item', 'particle', 'painting', 'mob_effect'];
    let totalTextures = 0;
    for (const d of dirs) {
        console.log('Processing dir:', d);
        const dir = '../textures/' + d + '/';
        const files = fs.readdirSync(dir);
        const dest = `./assets/minecraft/textures/${d}/`;
        const mcmetas = files.filter(f => f.endsWith('.mcmeta'));
        fs.mkdirSync(dest, {recursive: true});

        let animationData = {
            interpolate: true,
            frametime: 1,
        };

        let mcmeta16x16 = JSON.stringify({ // Use this in an effort to improve speed since JSON.stringify is _slow_.
            animation: {
                ...animationData,
                height: 16,
                width: 16,
            }
        });
        
        // Some stats, bc why not
        let texturesCount = 0;
        let animatedCount = 0; // Theoretically animatedCount === mcmetas.length, but :shrug:
        for(const f of files) {
            if (!f.endsWith('.png')) continue;
            ++texturesCount;
            const hasMeta = mcmetas.includes(f + '.mcmeta')
            const meta = hasMeta ? JSON.parse(fs.readFileSync(dir + f + '.mcmeta', 'utf-8')) : {};
            hasMeta ? animatedCount++ : 0;
            let newAnimationData = await processImage(dir + f, dest + f, meta);
            
            fs.writeFileSync(`${dest}${f}.mcmeta`,
                newAnimationData.height === 16 && newAnimationData.width === 16
                ? mcmeta16x16
                : JSON.stringify({ animation: { ...animationData, ...newAnimationData } }),
                'utf-8'
            );
        }
        console.log(`  Textures: ${texturesCount}`);
        console.log(`  Animated: ${animatedCount}`);
        totalTextures += texturesCount;
    }
    console.log('Creating pack.png');
    createPackPng('../textures/block/diamond_block.png', './pack.png');
    console.log('Writing pack.mcmeta...');
    fs.writeFileSync('./pack.mcmeta', JSON.stringify({
        pack: {
            pack_format: 15,
            description: '§6All textures are moving!\n§3By funnyboy_roks',
        }
    }, null, 4), 'utf-8');
    console.log('Done!');
    console.log(`Created ${totalTextures} images`);
};


run();
