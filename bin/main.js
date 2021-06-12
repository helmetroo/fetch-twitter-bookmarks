#!/usr/bin/env node

require('ts-node').register();

const CommandLineFrontend = require('../src/frontends/cli.ts').default;
const cli = new CommandLineFrontend();
cli.run();
