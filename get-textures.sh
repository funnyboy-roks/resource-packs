#!/bin/sh
# Usage: ./get-textures.sh <minecraft-jar>
#
# It will create a `textures/` directory once run that contains all of the files needed for any resource pack. (except fonts)

mkdir unzip_TMP
cd unzip_TMP
echo "Unzipping jar..."
unzip "../$1" >> /dev/null
echo "Jar unzipped."
echo "Getting textures..."
cp -r ./assets/minecraft/textures ../
cp ./pack.png ..
cd ..
rm -r textures/font
rm -r unzip_TMP
echo "Done."
