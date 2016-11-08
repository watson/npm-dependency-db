'use strict'

var fs = require('fs')
var path = require('path')
var levelup = require('level')
var pkg = require('../package')

exports.path = path.join(process.env.HOME, '.' + pkg.name)

exports.level = function () {
  return levelup(exports.path)
}

exports.existsSync = function () {
  return fs.existsSync(exports.path)
}
