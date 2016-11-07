#!/usr/bin/env node
'use strict'

var cmd = process.argv[2]

if (!cmd) usage(1)

switch (cmd) {
  case '-u':
  case '--update':
    require('./update')
    break
  case '-v':
  case '--version':
    version()
    break
  case '-h':
  case '--help':
    usage()
    break
  default:
    require('./query')
}

function version () {
  console.log(require('./package').version)
  process.exit()
}

function usage (code) {
  var name = require('./package').name
  console.log('Usage:')
  console.log('  %s <options> | <name> [range]', name)
  console.log()
  console.log('Options:')
  console.log('  --version, -v  output version')
  console.log('  --help, -h     output this help')
  console.log('  --update, -u   update the local cache')
  console.log()
  console.log('Examples:')
  console.log('  %s --update', name)
  console.log('  %s bluebird ^2.0.0', name)
  process.exit(Number.isFinite(code) ? code : 0)
}
