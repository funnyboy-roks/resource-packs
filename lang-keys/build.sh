#!/bin/sh

rm lang-keys.zip
node gen-langs.js
zip -r lang-keys.zip assets/ pack.{mcmeta,png}
