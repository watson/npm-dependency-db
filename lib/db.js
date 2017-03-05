'use strict'

var fs = require('fs')
var path = require('path')
var level = require('level-party')
var pkg = require('../package')

module.exports = function (root) {
  root = root || path.join(process.env.HOME, '.' + pkg.name)

  return {
    root: root,

    hypercore: function () {
      return level(path.join(root, 'hypercore'))
    },

    depdb: function () {
      return level(path.join(root, 'dependency-db'))
    },

    existsSync: function () {
      return fs.existsSync(root)
    }
  }
}
