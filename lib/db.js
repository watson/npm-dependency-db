'use strict'

var fs = require('fs')
var path = require('path')
var level = require('level-party')
var pkg = require('../package')

exports.path = path.join(process.env.HOME, '.' + pkg.name)

exports.level = function () {
  return level(exports.path)
}

exports.existsSync = function () {
  return fs.existsSync(exports.path)
}
