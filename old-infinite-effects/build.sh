#!/bin/sh

rm old-infinite-effect.zip
node gen-langs.js
zip -r old-infinite-effect.zip assets/ pack.{mcmeta,png}
