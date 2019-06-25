#!/usr/bin/env node

require('ts-node').register();

const CommandLineInterface = require('../src/cli.ts').default;
const cli = new CommandLineInterface();
cli.run();
