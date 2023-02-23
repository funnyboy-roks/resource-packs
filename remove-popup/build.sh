#!/bin/sh

rm remove-popup.zip
node gen-langs.js
zip -r remove-popup.zip assets/ pack.*
