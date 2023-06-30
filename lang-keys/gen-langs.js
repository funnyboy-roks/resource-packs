const fs = require('fs');

const mapEntry = ([k, v]) => {
    let key = k;

    const vars = v.match(/%[sd\d](\$[sd])?/g); // matches %s, %d, %1$s, etc.

    if (vars) {
        key += ' {';
        for (let i = 0; i < vars.length; ++i) {
            key += `${vars[i].replace(/%/gi, '%%')}=${vars[i]}`;
            if (i < vars.length - 1) {
                key += ', ';
            }
        }
        key += '}';
    }

    return [k, key];
};

const targetJson = Object.fromEntries(Object.keys(JSON.parse(fs.readFileSync('../lang/en_us.json'))).map(k => [k, k]));
const targetJsonVars = Object.fromEntries(Object.entries(JSON.parse(fs.readFileSync('../lang/en_us.json'))).map(mapEntry));

fs.mkdirSync('./assets/lang_keys/lang/', { recursive: true });
fs.writeFileSync('./assets/lang_keys/lang/lang_keys.json', JSON.stringify(targetJson, null, 4));
fs.writeFileSync('./assets/lang_keys/lang/lang_keys_vars.json', JSON.stringify(targetJsonVars, null, 4));
