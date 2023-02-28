#!/bin/sh

rm obnoxious-ores.zip
node main.js
zip -r obnoxious-ores.zip assets/ pack.*
rm -r *-frames
