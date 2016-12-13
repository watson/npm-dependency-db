'use strict'

var util = require('util')
var EventEmitter = require('events').EventEmitter
var hypercore = require('hypercore')
var swarm = require('hyperdrive-archive-swarm')
var DepDb = require('dependency-db')
var clean = require('normalize-registry-metadata')
var transform = require('parallel-transform')
var through = require('through2')
var afterAll = require('after-all')
var pump = require('pump')
var debug = require('debug')(require('./package').name)

module.exports = Updater

function Updater (db, opts) {
  var self = this

  if (!(this instanceof Updater)) return new Updater(db, opts)
  if (!opts) opts = {}

  EventEmitter.call(this)

  this._lvlDb = db.level()
  this._depDb = new DepDb(this._lvlDb)

  this.key = opts.key || '503cf9e12d8ae49a07568d90f04bbdbfa3f1998ab97ed2b5143c1f3f69ec052f'
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
        self._processChanges()
      })
    })
  })
}

Updater.prototype._processChanges = function () {
  var self = this

  this.emit('running')

  debug('processing changes from block %d', this.startBlock)

  pump(
    this.feed.createReadStream({start: this.startBlock, live: this.live}),
    transform(10, processChange),
    through.obj(recordLastBlock),
    onEnd
  )

  function processChange (data, cb) {
    var block = self.currentBlock++
    self.emit('downloaded', data.length)
    var change = JSON.parse(data)
    var doc = change.doc
    clean(doc)

    var next = afterAll(function (err) {
      cb(err, {block: block})
    })

    if (!doc.versions || doc.versions.length === 0) {
      debug('skipping %s - no versions detected', change.id)
      return
    }

    Object.keys(doc.versions).forEach(function (version) {
      var pkg = doc.versions[version]
      debug('storing %s@%s (%d dependencies)...', pkg.name, pkg.version, pkg.dependencies ? Object.keys(pkg.dependencies).length : 0)
      self._depDb.store(pkg, next())
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
