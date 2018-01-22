const Rubik = require('rubik-main');
const RedboneLib = require('redbone');
const codes = require('http').STATUS_CODES;
const ERROR_TYPE = '@@server/ERROR';

const isFunction = require('lodash/isFunction');

/**
 * A Kubik of the Rubik for implement Redbone app
 * @class Rubik.Redbone
 * @prop {Array<Object>} typesVolumes volumes with types
 * @prop {Array<String>} watchersVolumes volumes with watchers
 * @prop {Array<Object>} extensions extensions of a kubik
 * @param {Array} watchersVolumes
 * @param {Array} typesVolumes
 */
class Redbone extends Rubik.Kubik {
  constructor(watchersVolumes, typesVolumes) {
    super();
    this.name = 'http/socket/redbone';
    this.dependencies = ['http/socket'];
    this._attachAppMiddleware = this._attachAppMiddleware.bind(this);
    this._defaultCatcher = this._defaultCatcher.bind(this);
    this.extensions = [];
    this.typesVolumes = [];
    this.watchersVolumes = [];
    this.addTypesVolumes(typesVolumes);
    this.addWatchersVolumes(watchersVolumes);
  }

  /**
   * add volumes with types
   * @param {Array} volumes
   */
  addTypesVolumes(volumes) {
    if (!Array.isArray(volumes)) return;
    for (const volume of volumes) {
      if (!volume) return;
      if (typeof volume === 'string') {
        this.typesVolumes.push({ path: volumes });
        continue;
      }
      if (volume.path) {
        this.typesVolumes.push(volume);
        continue;
      }
    }
  }

  /**
   * add volumes with watchers
   * @param {Array} volumes
   */
  addWatchersVolumes(volumes) {
    if (!Array.isArray(volumes)) return;
    for (const volume of volumes) {
      if (!volume) return;
      if (typeof volume === 'string') {
        this.watchersVolumes.push(volume);
        continue;
      }
    }
  }

  /**
   * apply volumes into redbone
   * @return {Promise}
   */
  async _applyVolumes() {
    let promisses = [];
    for (const volume of this.typesVolumes) {
      promisses.push(this.redbone.readTypes(volume.path, volume.prefix));
    }
    await Promise.all(promisses);
    promisses = [];
    for (const volume of this.watchersVolumes) {
      promisses.push(this.redbone.readWatchers(volume));
    }
    return Promise.all(promisses);
  }

  /**
   * apply extensions
   */
  _applyExtensions() {
    for (const extension of this.extensions) {
      if (isFunction(extension)) {
        this.redbone.use(extension);
        continue;
      }
      if (Array.isArray(extension.watchers)) {
        this.redbone.processWatchers(extension.watchers);
      }
      if (Array.isArray(extension.middlewares)) {
        for (const middleware of extension.middlewares) {
          this.redbone.use(middleware);
        }
      }
      if (Array.isArray(extension.watchersVolumes)) {
        this.addWatchersVolumes(extension.watchersVolumes);
      }
      if (Array.isArray(extension.typesVolumes)) {
        this.addTypesVolumes(extension.watchersVolumes);
      }
      if (extension.pubsubModels) {
        if (extension.pubsubModels.models.set && extension.pubsubModels.models) {
          this.redbone.pubsub.addSetOfModels(
            extension.pubsubModels.set,
            extension.pubsubModels.models
          )
        } else {
          this.redbone.pubsub.addSetOfModels(extension.pubsubModels);
        }
      }
    }
  }

  /**
   * init redbone and extends it with extensions
   * @return {Promise}
   */
  async _init() {
    this.redbone = new RedboneLib(this.io);
    this.redbone.use(this._attachAppMiddleware);
    this.redbone.initPubsub();
    this._applyExtensions();
    await this._applyVolumes();
    if (!this._catchIsSet) {
      this.catch(this._defaultCatcher);
    }
  }

  /**
   * up kubik
   * @param  {Object   dependencies
   * @return {Promise}
   */
  async up(dependencies) {
    this.socket = dependencies['http/socket'];
    this.io = this.socket.io;
    this.config = this.socket.config.redbone || {};
    this.log = this.socket.log;
    await this._init();
  }

  after() {
    this.extensions = [];
    this.typesVolumes = [];
    this.watchersVolumes = [];
    this.log.info('The redbone attached to the socket 🍖');
  }

  /**
   * middleware for attach this.app as rubik
   * @param  {Redbone.SynteticSocket} socket
   * @param  {Object} action
   * @return {Boolean} true
   */
  _attachAppMiddleware(socket, action) {
    if (this.config && this.config.logTypes) {
      this.log.info(action.type);
    }
    if (this.config && this.config.dirTypes) {
      this.log.dir(action, { colors: true, depth: 10 });
    }
    socket.rubik = this.app;
    return true;
  }

  /**
   * _defaultCatcher for redbone errors
   * @param  {Redbone.SynteticSocket} socket
   * @param  {Object} action
   * @param  {Error} err
   */
  _defaultCatcher(socket, action, err) {
    if (err.constructor.name === 'HttpError') {
      socket.dispatch({
        type: ERROR_TYPE,
        error: err.message,
        code: err.code,
        message: err.statusMessage
      });
    } else if (err.constructor.name === 'SystemError') {
      socket.dispatch({
        type: ERROR_TYPE,
        error: err.message,
        code: err.code,
        message: codes[err.code] || 'Strange code'
      });
    } else {
      this.log.error('Internal error', err.message);
      this.log.error(err.stack);
      socket.dispatch({
        type: ERROR_TYPE,
        error: err.message,
        code: 500,
        message: 'Internal server error'
      });
    }
  }

  /**
   * use extension for the Redbone's instance
   * @param  {Object|Function} dependency
   */
  use(extension) {
    if (!extension) return;
    this.extensions.push(extension);
  }

  /**
   * add custom catcher function for redbone
   * @param  {Function} catcher
   */
  catch(catcher) {
    this._catchIsSet = true;
    this.redbone.catch(catcher);
  }
}

module.exports = Redbone;
