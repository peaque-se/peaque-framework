import { precompressAssets } from "./precompress-assets";


console.time('Precompression Time');
const files = await precompressAssets('./dist-prod/assets')
console.timeEnd('Precompression Time');

console.log('Precompressed files:');
files.files.forEach(f => console.log(' - ' + f));
