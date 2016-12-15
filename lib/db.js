'use strict'

var fs = require('fs')
var path = require('path')
var level = require('level-party')
var pkg = require('../package')

module.exports = function (dbPath) {
  dbPath = dbPath || path.join(process.env.HOME, '.' + pkg.name)

  return {
    path: dbPath,

    level: function () {
      return level(dbPath)
    },

    existsSync: function () {
      return fs.existsSync(dbPath)
    }
  }
}
