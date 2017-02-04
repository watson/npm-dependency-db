'use strict'

var util = require('util')
var EventEmitter = require('events').EventEmitter
var hypercore = require('hypercore')
var swarm = require('hyperdrive-archive-swarm')
var DepDb = require('dependency-db')
var clean = require('normalize-registry-metadata')
var transform = require('parallel-transform')
var through = require('through2')
var pump = require('pump')
var debug = require('debug')(require('./package').name)

module.exports = Updater

function Updater (db, opts) {
  var self = this

  if (!(this instanceof Updater)) return new Updater(db, opts)
  if (!opts) opts = {}

  EventEmitter.call(this)

  this._lvlDb = db
  this._depDb = new DepDb(this._lvlDb)

  this.key = opts.key || 'accb1fdea4aa5a112e7a9cd702d0cef1ea84b4f683cd0b2dd58051059cf7da11'
  this.live = opts.live || false
  this.feed = hypercore(this._lvlDb).createFeed(this.key)

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

  swarm(this.feed)

  this._lvlDb.get('!last_block!', function (err, lastBlock) {
    if (err && !err.notFound) return self.emit('error', err)

    self.processed = lastBlock = lastBlock ? Number(lastBlock) : 0
    self.startBlock = self.currentBlock = lastBlock ? lastBlock + 1 : 0
    self.emit('init')

    self.feed.open(function (err) {
      if (err) return self.emit('error', err)

      debug('cache is open')

      self.feed.once('download', function () {
        self.feedLength = self.feed.blocks
        self.remaining = self.feed.blocksRemaining() + 1 // +1 because we already downloaded one
        self._processPackages()
      })
    })
  })
}

Updater.prototype._processPackages = function () {
  var self = this

  this.emit('running')

  debug('processing changes from block %d', this.startBlock)

  pump(
    this.feed.createReadStream({start: this.startBlock, live: this.live}),
    transform(10, processPackage),
    through.obj(recordLastBlock),
    onEnd
  )

  function processPackage (pkg, cb) {
    var block = self.currentBlock++
    pkg = JSON.parse(pkg)

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
    self._lvlDb.put('!last_block!', data.block, function (err) {
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
