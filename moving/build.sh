#!/bin/sh

rm moving.zip
node main.js
zip -r moving.zip assets/ pack.*
