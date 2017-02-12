'use strict'

var util = require('util')
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

  EventEmitter.call(this)

  this._metaDb = sub(db, 'meta')
  this._depDb = new DepDb(sub(db, 'depdb'))
  this._indexOnly = opts.indexOnly

  this.key = opts.key || 'accb1fdea4aa5a112e7a9cd702d0cef1ea84b4f683cd0b2dd58051059cf7da11'
  this.live = opts.live || false
  this.feed = hypercore(sub(opts.npmDb || db, 'core')).createFeed(this.key, {sparse: true})

  this.startBlock = 0
  this.currentBlock = 0
  this.feedLength = 0
  this.remaining = 0
  this.processed = 0

  process.nextTick(function () {
    self._run()
  })
}

util.inherits(Updater, EventEmitter)

Updater.prototype._run = function () {
  var self = this

  if (!this._indexOnly) swarm(this.feed)

  this._metaDb.get('!last_block!', function (err, lastBlock) {
    if (err && !err.notFound) return self.emit('error', err)

    self.processed = lastBlock = lastBlock ? parseInt(lastBlock, 10) : 0
    self.startBlock = self.currentBlock = lastBlock ? lastBlock + 1 : 0
    self.emit('init')

    self.feed.open(function (err) {
      if (err) return self.emit('error', err)

      debug('cache is open')

      if (self._indexOnly || self.feed.blocksRemaining()) {
        start()
      } else {
        // make out-of-bounce read to make sure we are working on a new
        // hypercore snapshot
        self.feed.get(self.feed.blocks, function (err) {
          if (err) return self.emit('error', err)
          start()
        })
      }

      function start () {
        self.feedLength = self.feed.blocks
        self.remaining = self.feed.blocksRemaining()
        self._processPackages()
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
    var block = self.currentBlock++
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
      cb(err, {block: block})
    })
  }

  function recordLastBlock (data, enc, cb) {
    self._metaDb.put('!last_block!', data.block, function (err) {
      self.processed = data.block
      self.emit('processed', data.block)
      cb(err)
    })
  }

  function onEnd (err) {
    if (err) self.emit('error', err)
    self.emit('end')
  }
}
