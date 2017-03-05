'use strict'

var util = require('util')
var path = require('path')
var EventEmitter = require('events').EventEmitter
var hypercore = require('hypercore')
var swarm = require('hyperdrive-archive-swarm')
var DepDb = require('dependency-db')
var transform = require('parallel-transform')
var through = require('through2')
var pump = require('pump')
var sub = require('subleveldown')
var debug = require('debug')(require('./package').name)

module.exports = Updater

function Updater (db, opts) {
  var self = this

  if (!(this instanceof Updater)) return new Updater(db, opts)
  if (!opts) opts = {}
  var hypercorePath = opts.hypercorePath || path.join('.', 'npm-dependency-db.core')

  EventEmitter.call(this)

  this._metaDb = sub(db, 'meta')
  this._depDb = new DepDb(sub(db, 'depdb'))
  this._indexOnly = opts.indexOnly

  this.key = opts.key || 'f5d045813912dadbff4bdc8a43bb78da6685f965f1a88e430db49c793a5a1a01'
  this.live = opts.live || false
  this.feed = hypercore(hypercorePath, this.key, {maxRequests: 128})

  this.startBlock = 0
  this.currentBlock = 0
  this.processed = 0

  process.nextTick(function () {
    self._run()
  })
}

util.inherits(Updater, EventEmitter)

Updater.prototype.blocksRemaining = function () {
  var remaining = 0
  for (var i = 0; i < this.feed.length; i++) {
    remaining += this.feed.has(i) ? 0 : 1
  }
  return remaining
}

Updater.prototype._run = function () {
  var self = this

  this._metaDb.get('!last_block!', function (err, lastBlock) {
    if (err && !err.notFound) return self.emit('error', err)

    self.processed = lastBlock = lastBlock ? parseInt(lastBlock, 10) : 0
    self.startBlock = self.currentBlock = lastBlock ? lastBlock + 1 : 0
    self.emit('init')

    self.feed.ready(function () {
      debug('cache is ready')

      if (!self._indexOnly) swarm(self.feed)

      if (self._indexOnly || self.blocksRemaining()) {
        self._processPackages()
      } else {
        // make out-of-bounce read to make sure we are working on a new
        // hypercore snapshot
        self.feed.get(self.feed.length, function (err) {
          if (err) return self.emit('error', err)
          self._processPackages()
        })
      }
    })
  })
}

Updater.prototype._processPackages = function () {
  var self = this

  this.emit('running')

  debug('processing changes from block %d', this.startBlock)

  pump(
    this.feed.createReadStream({start: this.startBlock, live: this.live && !this._indexOnly}),
    transform(10, processPackage),
    through.obj(recordLastBlock),
    onEnd
  )

  function processPackage (pkg, cb) {
    var index = self.currentBlock++
    pkg = JSON.parse(pkg)

    if (!pkg.name || !pkg.version) {
      debug('skipping invalid package: %s@%s', pkg.name, pkg.version)
      cb()
      return
    }

    debug('storing %s@%s (%d dependencies, %d devDependencies)...',
      pkg.name,
      pkg.version,
      pkg.dependencies ? Object.keys(pkg.dependencies).length : 0,
      pkg.devDependencies ? Object.keys(pkg.devDependencies).length : 0
    )

    var shallowPkg = {name: pkg.name, version: pkg.version}
    if (pkg.dependencies) shallowPkg.dependencies = pkg.dependencies
    if (pkg.devDependencies) shallowPkg.devDependencies = pkg.devDependencies

    self._depDb.store(shallowPkg, function (err) {
      cb(err, {index: index})
    })
  }

  function recordLastBlock (data, enc, cb) {
    self._metaDb.put('!last_block!', data.index, function (err) {
      self.processed = data.index
      self.emit('processed', data.index)
      cb(err)
    })
  }

  function onEnd (err) {
    debug('pump ended %s error', err ? 'with' : 'without')
    if (err) self.emit('error', err)
    self.emit('end')
  }
}
