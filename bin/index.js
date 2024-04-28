#!/usr/bin/env node

import createProject  from '../src/index.js';

const args = process.argv.slice(2);

if (args.length === 1 && args[0] === "init") {
    createProject();
} else {
    console.log("Usage: psetup init");
}