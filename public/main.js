(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
module.exports.ConceptNetwork = require('./lib/concept-network').ConceptNetwork;
module.exports.ConceptNetworkState = require('./lib/concept-network-state').ConceptNetworkState;

},{"./lib/concept-network":3,"./lib/concept-network-state":2}],2:[function(require,module,exports){
/*jshint node:true, maxlen:80, curly: true, eqeqeq: true, immed: true,
 latedef: true, newcap: true, noarg: true, sub: true, undef: true,
 eqnull: true, laxcomma: true, indent: 2, white:true */
 /*
 * concept-network-state
 * https://github.com/parmentf/node-concept-network
 *
 * Copyright (c) 2012 François Parmentier
 * Licensed under the MIT license.
 */
"use strict";

var debug = require('debug')('concept-network-state');
var ConceptNetwork = require('../index').ConceptNetwork;

var startsWith = require('./tools').startsWith;
var objectMax  = require('./tools').objectMax;

/**
 * ## ConceptNetworkState's constructor
 *
 * The state of a concept network is bound to a user.
 *
 * @param {ConceptNetwork} cn The concept network of which it is a state.
 **/
function ConceptNetworkState(cn) {
  if (!(this instanceof ConceptNetworkState)) {
    return new ConceptNetworkState();
  }

  this.nodeState = {}; // nodeId -> {activationValue, oldActivationValue, age}
  // this.activationValue = [];  // nodeId -> activation value
  // this.oldActivationValue = [];
  // this.age = []; // nodeId -> age
  this.cn = cn;
  if (!cn) {
    throw new Error("Parameter is required");
  }
  // else if (!(cn.name && cn.name === 'ConceptNetwork')) {
  //   throw new Error("Parameter has to be a ConceptNetwork");
  // }
  this.normalNumberComingLinks = 2;
}

// ## ConceptNetworkState's methods
ConceptNetworkState.prototype = {

  /**
   * ### activate
   *
   * Activate the value of the node, which nodeId is given
   * @param {Number} nodeId Identifier of the node to activate
   **/
  activate : function (nodeId) {
    if (typeof this.nodeState[nodeId] === 'undefined') {
      this.nodeState[nodeId] = {
        activationValue: 100,
        age: 0,
        oldActivationValue: 0
      };
    }
    else {
      this.nodeState[nodeId].activationValue = 100;
    }
  },

  /**
   * ### getActivationValue
   * @param {Number} nodeId Identifier of the node
   * @return {Number} the activation value (in [0,100])
   **/
  getActivationValue : function (nodeId) {
    if (typeof this.nodeState[nodeId] === 'undefined') {
      return 0;
    }
    else {
      return this.nodeState[nodeId].activationValue;
    }
  },

  /**
   * ### setActivationValue
   * @param {Number} nodeId Identifier of the node
   * @param {Number} value new activation value
   * @return {Number} the activation value (in [0,100])
   **/
  setActivationValue : function (nodeId, value) {
    debug('this.nodeState', this.nodeState);
    debug('nodeId', nodeId);
    debug('value', value);
    if (typeof this.nodeState[nodeId] === 'undefined') {
      this.nodeState[nodeId] = {
        activationValue: value,
        age: 0,
        oldActivationValue: 0
      };
    }
    else {
      this.nodeState[nodeId].activationValue = value;
    }
    // Reactivate non-activated nodes.
    if (!value) {
      delete this.nodeState[nodeId];
    }
  },

  /**
   * ### getOldActivationValue
   * @param {Number} nodeId Identifier of the node
   * @return {Number} the activation value (in [0,100])
   **/
  getOldActivationValue : function (nodeId) {
    if (typeof this.nodeState[nodeId] === 'undefined') {
      return 0;
    }
    else {
      return this.nodeState[nodeId].oldActivationValue;
    }
  },

  /**
   * ### getMaximumActivationValue
   * @param {string|regex} filter beginning of the node label to
   *                              take into account
   * @return {Number} the maximum activation value (in [0,100])
   **/
  getMaximumActivationValue : function (filter) {
    var max = 0;
    if (typeof filter === 'undefined') {
      var maxId = objectMax(this.nodeState, 'activationValue');
      if (typeof maxId === 'undefined') { return 0; }
      max = this.nodeState[maxId].activationValue;
    }
    else {
      for (var id in this.nodeState) {
        var node = this.cn.node[id];
        if (startsWith(node.label,filter)) {
          max = Math.max(max, this.nodeState[id].activationValue);
        }
      }
    }
    return max;
  },

  /**
   * ### getActivatedTypedNodes
   *
   * Get the activated nodes of ConceptNetwork
   * @param {string} filter beginning of the node label to
   *                        take into account
   * @param {Number} threshold (default: 90)
   * @return {Array} array of { node, activationValue }
   **/
  getActivatedTypedNodes : function (filter, threshold) {
    var array = [];
    if (typeof threshold === 'undefined') { threshold = 90; }
    if (typeof filter === 'undefined') { filter = ''; }
    for (var id in this.nodeState) {
      var node = this.cn.node[id];
      var activationValue = this.getActivationValue(id);
      if (startsWith(node.label,filter)) {
        if (activationValue > threshold) {
          array.push({node: node, activationValue: activationValue});
        }
      }
    }
    return array;
  },

  /**
   * ### propagate
   *
   * Propagate the activation values along the links.
   *
   * @param {Object} options {decay,memoryPerf}
   **/
  propagate : function (options) {
    if (options && typeof options !== 'object') {
      throw new Error("propagate() parameter should be an object");
    }
    var influenceNb = [];    // nodeId -> nb of influence number
    var influenceValue = []; // nodeId -> influence value
    for (var nodeId in this.nodeState) {
      this.nodeState[nodeId].age += 1;
      this.nodeState[nodeId].oldActivationValue =
        this.nodeState[nodeId].activationValue;
    }
    // #### Fill influence table
    // Get the nodes influenced by others
    for (nodeId in this.cn.node) {
      var ov = this.getOldActivationValue(nodeId);
      var links = this.cn.getNodeFromLinks(nodeId);
      debug('links', links);
      // for all outgoing links
      for (var linkIndex in links) {
        debug('linkIndex', linkIndex);
        var linkId = links[linkIndex];
        debug('linkId', linkId);
        var link = this.cn.getLink(linkId);
        debug('link', link);
        var nodeToId = link.toId;
        var infl = typeof influenceValue[nodeToId] !== "undefined" ?
                    influenceValue[nodeToId] : 0;
        infl += 0.5 + ov * link.coOcc;
        influenceValue[nodeToId] = infl;
        influenceNb[nodeToId] = typeof influenceNb[nodeToId] !== "undefined" ?
                              influenceNb[nodeToId] : 0;
        influenceNb[nodeToId] += 1;
      }
    }
    debug('influenceNb', influenceNb);
    debug('influenceValue', influenceValue);
    // For all the nodes in the state
    for (nodeId in this.cn.node) {
      var nodeState = this.nodeState[nodeId];
      if (typeof nodeState === 'undefined') {
        nodeState = { activationValue: 0, oldActivationValue: 0, age: 0 };
      }
      if (!options) {
        options = {
          decay      : 40,
          memoryPerf : 100
        };
      }
      var decay      = options.decay || 40;
      var memoryPerf = options.memoryPerf || 100;
      var minusAge = 200 / (1 + Math.exp(-nodeState.age / memoryPerf)) - 100;
      var newActivationValue;
      // If this node is not influenced at all
      if (typeof influenceValue[nodeId] === 'undefined' ||
          !influenceValue[nodeId]) {
        newActivationValue = nodeState.oldActivationValue -
                             decay * nodeState.oldActivationValue / 100 -
                             minusAge;
      }
      // If this node receives influence
      else {
        var influence = influenceValue[nodeId];
        var nbIncomings = influenceNb[nodeId];
        influence /= Math.log(this.normalNumberComingLinks + nbIncomings) /
                     Math.log(this.normalNumberComingLinks);
        newActivationValue = nodeState.oldActivationValue -
                             decay * nodeState.oldActivationValue / 100 +
                             influence -
                             minusAge;
      }
      newActivationValue = Math.max(newActivationValue, 0);
      newActivationValue = Math.min(newActivationValue, 100);
      this.setActivationValue(nodeId, newActivationValue);
    }
  }
};

module.exports.ConceptNetworkState = ConceptNetworkState;

},{"../index":1,"./tools":4,"debug":5}],3:[function(require,module,exports){
/*jshint node:true, maxlen:80, curly: true, eqeqeq: true, immed: true,
 latedef: true, newcap: true, noarg: true, sub: true, undef: true,
 eqnull: true, laxcomma: true, indent: 2, white:true */
 /*
 * concept-network
 * https://github.com/parmentf/node-concept-network
 *
 * Copyright (c) 2012 François Parmentier
 * Licensed under the MIT license.
 */
"use strict";

/**
 * ## ConceptNetwork's constructor
 *
 * Use it to instanciate a Concept Network.
 **/
function ConceptNetwork() {
  if (!(this instanceof ConceptNetwork)) {
    return new ConceptNetwork();
  }

  this.node = {}; // id -> id, label, occ
  this.link = {}; // linkId -> fromId, toId, coOcc
  this.nodeLastId = 0;
  this.labelIndex = {}; // label -> id
  this.fromIndex  = {}; // fromId -> linkId
  this.toIndex    = {}; // toId   -> linkId

}

// ## ConceptNetwork's methods
ConceptNetwork.prototype = {
  /**
   * ### addNode
   *
   * @this ConceptNetwork
   * @param {string} label Symbol for the node
   * @param {number} inc   Increment (Optional, 1 by default)
   * @return {Object} {id, label, occ} id = identifier, occ = occurrence
   **/
  addNode : function (label, inc) {
    var id;
    inc = inc || 1;
    // node already exists
    if (this.labelIndex.hasOwnProperty(label)) {
      id = this.labelIndex[label];
      this.node[id].occ += inc;
    } else {
      this.nodeLastId += 1;
      id = this.nodeLastId;
      this.node[id] = {
        id: id,
        label: label,
        occ: inc
      };
      this.labelIndex[label] = id;
    }
    return this.node[id];
  },

  /**
   * ### decrementNode
   *
   * Decrement the occurrence of a node. Remove it if its counts down to zero.
   * @param {string} label identifier of the node.
   * @return {Object} the modified node. Or `null` if it has been removed.
   **/
  decrementNode : function (label) {
    var id;
    // node already exists
    if (this.labelIndex.hasOwnProperty(label)) {
      id = this.labelIndex[label];
      this.node[id].occ -= 1;
      if (this.node[id].occ === 0) {
        this.removeNode(id);
        return null;
      }
    } else {
      return null;
    }
    return this.node[id];
  },

  /**
   * ### removeNode
   *
   * _Private_
   *
   * Remove the node which *id* is given from the ConceptNetwork.
   * Also remove the links from and to this node.
   * Also remove the node from the *labelIndex*.
   * @param {Number} id Identifier of the node
   **/
  removeNode : function (id) {
    var linksToRemove = [];
    var i;
    // remove links from id
    if (this.fromIndex[id]) {
      for (i = 0; i < this.fromIndex[id].length; i += 1) {
        linksToRemove.push(this.fromIndex[id][i]);
      }
    }
    // remove links to id
    if (this.toIndex[id]) {
      for (i = 0; i < this.toIndex[id].length; i += 1) {
        linksToRemove.push(this.toIndex[id][i]);
      }
    }
    for (i = 0; i < linksToRemove.length; i += 1) {
      this.removeLink(linksToRemove[i]);
    }
    // remove from the labelIndex and from the node array.
    var label = this.node[id].label;
    delete this.node[id];
    delete this.labelIndex[label];
  },

  /**
   * ### addLink
   *
   * Add a link between fromId and toId
   * @param {Number} fromId Identifier of the afferent node
   * @param {Number} toId   Identifier of the efferent node
   * @param {Number} inc    Increment (optional, 1 by default)
   * @return {Object} the added link {fromId, toId, coOcc}
   **/
  addLink : function (fromId, toId, inc) {
    inc = inc || 1;
    if (typeof fromId !== 'number') {
      return new Error('fromId should be a number');
    }
    if (typeof toId !== 'number') {
      return new Error('toId should be a number');
    }
    var linkId = fromId + '_' + toId;
    // Link does not exist yet
    if (typeof this.link[linkId] === 'undefined') {
      this.link[linkId] = {
        fromId : fromId,
        toId   : toId,
        coOcc  : inc
      };
      // fromIndex
      if (!this.fromIndex.hasOwnProperty(fromId)) {
        this.fromIndex[fromId] = [];
      }
      this.fromIndex[fromId].push(linkId);
      // toIndex
      if (!this.toIndex.hasOwnProperty(toId)) {
        this.toIndex[toId] = [];
      }
      this.toIndex[toId].push(linkId);
    } else {
      this.link[linkId].coOcc += inc;
    }
    return this.link[linkId];
  },

  /**
   * ### decrementLink
   *
   * Decrement the coOcc of a link.
   *
   * *linkId* is a string composed of fromNodeId + "_" + toNodeId
   *
   * @param {string} linkId Identifier of the link to change
   * @return {Object} the modified link
   **/
  decrementLink : function (linkId) {
    var link = this.link[linkId];
    link.coOcc -= 1;
    if (link.coOcc === 0) {
      this.removeLink(linkId);
    }
    return link;
  },

  /**
   * ### removeLink
   *
   * {Private}
   *
   * Remove the link which *linkId* is given from the ConceptNetwork.
   *
   * Also remove the *linkId* from *fromIndex* and *toIndex*.
   *
   * @param {string} linkId Identifier of the link
   **/
  removeLink : function (linkId) {
    var link = this.link[linkId];
    delete this.fromIndex[link.fromId];
    delete this.toIndex[link.toId];
    delete this.link[linkId];
  },

  /**
   * ### getNode
   *
   * Get the node from its label
   * @param {string} label Label of the node to get
   * @return {Object} the node {id, label, occ}
   **/
  getNode : function (label) {
    var id = this.labelIndex[label];
    if (typeof this.node[id] === 'undefined') {
      return null;
    }
    return (this.node[id]);
  },

  /**
   * ### getLink
   *
   * Get the link from its node ids.
   * @param {string} linkId Identifier of the link
   * @return {Object} the found link {fromId, toId, coOcc}
   **/
  getLink : function (fromId, toId) {
    var linkId = toId ? fromId + '_' + toId : fromId;
    if (typeof this.link[linkId] === 'undefined') {
      return null;
    }
    return this.link[linkId];
  },

  /**
   * ### getNodeFromLinks
   *
   * Get the array of links ids for all links going from node *id*.
   * @param {Number} id Identifier of the node.
   * @return {Array} [linkId1, linkId2] or []
   **/
  getNodeFromLinks : function (id) {
    var fromLinks = this.fromIndex[id];
    if (typeof fromLinks === 'undefined') {
      return [];
    }
    return fromLinks;
  },

  /**
   * ### getNodeToLinks
   *
   * Get the array of links ids for all links going to node *id*.
   * @param {Number} id Identifier of the node.
   * @return {Array} [linkId1, linkId2] or []
   **/
  getNodeToLinks : function (id) {
    var toLinks = this.toIndex[id];
    if (typeof toLinks === 'undefined') {
      return [];
    }
    return toLinks;
  }

};

module.exports.ConceptNetwork = ConceptNetwork;

},{}],4:[function(require,module,exports){
/*jshint node:true, maxlen:80, curly: true, eqeqeq: true, immed: true,
 latedef: true, newcap: true, noarg: true, sub: true, undef: true,
 eqnull: true, laxcomma: true, indent: 2, white:true */
 /*
 * concept-network-state
 * https://github.com/parmentf/node-concept-network
 *
 * Copyright (c) 2012 François Parmentier
 * Licensed under the MIT license.
 */
"use strict";

var debug = require('debug')('tools');

/**
 * Return true if string1 starts with string2
 * @param  {String} string1 Longest string
 * @param  {String} string2 Shortest string
 * @return {Boolean}        true if string1 starts with string2
 */
module.exports.startsWith = function startsWith(string1, string2) {
  return  string1.length >= string2.length ?
          string1.slice(0,string2.length) === string2 :
          false;
};

/**
 * Return the object key for which the property is max
 * @param  {Object} obj      Object within to find the max value and id
 * @param  {String} property Name of the property to consider
 * @return {String}          Key of obj, for which property is max
 */
module.exports.objectMax = function objectMax(obj, property) {
  var max = null;
  var maxId;
  Object.keys(obj).forEach(function (key) {
    if (max < obj[key][property]) {
      max = obj[key][property];
      maxId = key;
    }
  });
  return maxId;
};

},{"debug":5}],5:[function(require,module,exports){

/**
 * Expose `debug()` as the module.
 */

module.exports = debug;

/**
 * Create a debugger with the given `name`.
 *
 * @param {String} name
 * @return {Type}
 * @api public
 */

function debug(name) {
  if (!debug.enabled(name)) return function(){};

  return function(fmt){
    fmt = coerce(fmt);

    var curr = new Date;
    var ms = curr - (debug[name] || curr);
    debug[name] = curr;

    fmt = name
      + ' '
      + fmt
      + ' +' + debug.humanize(ms);

    // This hackery is required for IE8
    // where `console.log` doesn't have 'apply'
    window.console
      && console.log
      && Function.prototype.apply.call(console.log, console, arguments);
  }
}

/**
 * The currently active debug mode names.
 */

debug.names = [];
debug.skips = [];

/**
 * Enables a debug mode by name. This can include modes
 * separated by a colon and wildcards.
 *
 * @param {String} name
 * @api public
 */

debug.enable = function(name) {
  try {
    localStorage.debug = name;
  } catch(e){}

  var split = (name || '').split(/[\s,]+/)
    , len = split.length;

  for (var i = 0; i < len; i++) {
    name = split[i].replace('*', '.*?');
    if (name[0] === '-') {
      debug.skips.push(new RegExp('^' + name.substr(1) + '$'));
    }
    else {
      debug.names.push(new RegExp('^' + name + '$'));
    }
  }
};

/**
 * Disable debug output.
 *
 * @api public
 */

debug.disable = function(){
  debug.enable('');
};

/**
 * Humanize the given `ms`.
 *
 * @param {Number} m
 * @return {String}
 * @api private
 */

debug.humanize = function(ms) {
  var sec = 1000
    , min = 60 * 1000
    , hour = 60 * min;

  if (ms >= hour) return (ms / hour).toFixed(1) + 'h';
  if (ms >= min) return (ms / min).toFixed(1) + 'm';
  if (ms >= sec) return (ms / sec | 0) + 's';
  return ms + 'ms';
};

/**
 * Returns true if the given mode name is enabled, false otherwise.
 *
 * @param {String} name
 * @return {Boolean}
 * @api public
 */

debug.enabled = function(name) {
  for (var i = 0, len = debug.skips.length; i < len; i++) {
    if (debug.skips[i].test(name)) {
      return false;
    }
  }
  for (var i = 0, len = debug.names.length; i < len; i++) {
    if (debug.names[i].test(name)) {
      return true;
    }
  }
  return false;
};

/**
 * Coerce `val`.
 */

function coerce(val) {
  if (val instanceof Error) return val.stack || val.message;
  return val;
}

// persist

try {
  if (window.localStorage) debug.enable(localStorage.debug);
} catch(e){}

},{}],6:[function(require,module,exports){

/**
 * This is the web browser implementation of `debug()`.
 *
 * Expose `debug()` as the module.
 */

exports = module.exports = require('./debug');
exports.log = log;
exports.formatArgs = formatArgs;
exports.save = save;
exports.load = load;
exports.useColors = useColors;
exports.storage = 'undefined' != typeof chrome
               && 'undefined' != typeof chrome.storage
                  ? chrome.storage.local
                  : localstorage();

/**
 * Colors.
 */

exports.colors = [
  'lightseagreen',
  'forestgreen',
  'goldenrod',
  'dodgerblue',
  'darkorchid',
  'crimson'
];

/**
 * Currently only WebKit-based Web Inspectors, Firefox >= v31,
 * and the Firebug extension (any Firefox version) are known
 * to support "%c" CSS customizations.
 *
 * TODO: add a `localStorage` variable to explicitly enable/disable colors
 */

function useColors() {
  // is webkit? http://stackoverflow.com/a/16459606/376773
  return ('WebkitAppearance' in document.documentElement.style) ||
    // is firebug? http://stackoverflow.com/a/398120/376773
    (window.console && (console.firebug || (console.exception && console.table))) ||
    // is firefox >= v31?
    // https://developer.mozilla.org/en-US/docs/Tools/Web_Console#Styling_messages
    (navigator.userAgent.toLowerCase().match(/firefox\/(\d+)/) && parseInt(RegExp.$1, 10) >= 31);
}

/**
 * Map %j to `JSON.stringify()`, since no Web Inspectors do that by default.
 */

exports.formatters.j = function(v) {
  return JSON.stringify(v);
};


/**
 * Colorize log arguments if enabled.
 *
 * @api public
 */

function formatArgs() {
  var args = arguments;
  var useColors = this.useColors;

  args[0] = (useColors ? '%c' : '')
    + this.namespace
    + (useColors ? ' %c' : ' ')
    + args[0]
    + (useColors ? '%c ' : ' ')
    + '+' + exports.humanize(this.diff);

  if (!useColors) return args;

  var c = 'color: ' + this.color;
  args = [args[0], c, 'color: inherit'].concat(Array.prototype.slice.call(args, 1));

  // the final "%c" is somewhat tricky, because there could be other
  // arguments passed either before or after the %c, so we need to
  // figure out the correct index to insert the CSS into
  var index = 0;
  var lastC = 0;
  args[0].replace(/%[a-z%]/g, function(match) {
    if ('%%' === match) return;
    index++;
    if ('%c' === match) {
      // we only are interested in the *last* %c
      // (the user may have provided their own)
      lastC = index;
    }
  });

  args.splice(lastC, 0, c);
  return args;
}

/**
 * Invokes `console.log()` when available.
 * No-op when `console.log` is not a "function".
 *
 * @api public
 */

function log() {
  // this hackery is required for IE8/9, where
  // the `console.log` function doesn't have 'apply'
  return 'object' === typeof console
    && console.log
    && Function.prototype.apply.call(console.log, console, arguments);
}

/**
 * Save `namespaces`.
 *
 * @param {String} namespaces
 * @api private
 */

function save(namespaces) {
  try {
    if (null == namespaces) {
      exports.storage.removeItem('debug');
    } else {
      exports.storage.debug = namespaces;
    }
  } catch(e) {}
}

/**
 * Load `namespaces`.
 *
 * @return {String} returns the previously persisted debug modes
 * @api private
 */

function load() {
  var r;
  try {
    r = exports.storage.debug;
  } catch(e) {}
  return r;
}

/**
 * Enable namespaces listed in `localStorage.debug` initially.
 */

exports.enable(load());

/**
 * Localstorage attempts to return the localstorage.
 *
 * This is necessary because safari throws
 * when a user disables cookies/localstorage
 * and you attempt to access it.
 *
 * @return {LocalStorage}
 * @api private
 */

function localstorage(){
  try {
    return window.localStorage;
  } catch (e) {}
}

},{"./debug":7}],7:[function(require,module,exports){

/**
 * This is the common logic for both the Node.js and web browser
 * implementations of `debug()`.
 *
 * Expose `debug()` as the module.
 */

exports = module.exports = debug;
exports.coerce = coerce;
exports.disable = disable;
exports.enable = enable;
exports.enabled = enabled;
exports.humanize = require('ms');

/**
 * The currently active debug mode names, and names to skip.
 */

exports.names = [];
exports.skips = [];

/**
 * Map of special "%n" handling functions, for the debug "format" argument.
 *
 * Valid key names are a single, lowercased letter, i.e. "n".
 */

exports.formatters = {};

/**
 * Previously assigned color.
 */

var prevColor = 0;

/**
 * Previous log timestamp.
 */

var prevTime;

/**
 * Select a color.
 *
 * @return {Number}
 * @api private
 */

function selectColor() {
  return exports.colors[prevColor++ % exports.colors.length];
}

/**
 * Create a debugger with the given `namespace`.
 *
 * @param {String} namespace
 * @return {Function}
 * @api public
 */

function debug(namespace) {

  // define the `disabled` version
  function disabled() {
  }
  disabled.enabled = false;

  // define the `enabled` version
  function enabled() {

    var self = enabled;

    // set `diff` timestamp
    var curr = +new Date();
    var ms = curr - (prevTime || curr);
    self.diff = ms;
    self.prev = prevTime;
    self.curr = curr;
    prevTime = curr;

    // add the `color` if not set
    if (null == self.useColors) self.useColors = exports.useColors();
    if (null == self.color && self.useColors) self.color = selectColor();

    var args = Array.prototype.slice.call(arguments);

    args[0] = exports.coerce(args[0]);

    if ('string' !== typeof args[0]) {
      // anything else let's inspect with %o
      args = ['%o'].concat(args);
    }

    // apply any `formatters` transformations
    var index = 0;
    args[0] = args[0].replace(/%([a-z%])/g, function(match, format) {
      // if we encounter an escaped % then don't increase the array index
      if (match === '%%') return match;
      index++;
      var formatter = exports.formatters[format];
      if ('function' === typeof formatter) {
        var val = args[index];
        match = formatter.call(self, val);

        // now we need to remove `args[index]` since it's inlined in the `format`
        args.splice(index, 1);
        index--;
      }
      return match;
    });

    if ('function' === typeof exports.formatArgs) {
      args = exports.formatArgs.apply(self, args);
    }
    var logFn = enabled.log || exports.log || console.log.bind(console);
    logFn.apply(self, args);
  }
  enabled.enabled = true;

  var fn = exports.enabled(namespace) ? enabled : disabled;

  fn.namespace = namespace;

  return fn;
}

/**
 * Enables a debug mode by namespaces. This can include modes
 * separated by a colon and wildcards.
 *
 * @param {String} namespaces
 * @api public
 */

function enable(namespaces) {
  exports.save(namespaces);

  var split = (namespaces || '').split(/[\s,]+/);
  var len = split.length;

  for (var i = 0; i < len; i++) {
    if (!split[i]) continue; // ignore empty strings
    namespaces = split[i].replace(/\*/g, '.*?');
    if (namespaces[0] === '-') {
      exports.skips.push(new RegExp('^' + namespaces.substr(1) + '$'));
    } else {
      exports.names.push(new RegExp('^' + namespaces + '$'));
    }
  }
}

/**
 * Disable debug output.
 *
 * @api public
 */

function disable() {
  exports.enable('');
}

/**
 * Returns true if the given mode name is enabled, false otherwise.
 *
 * @param {String} name
 * @return {Boolean}
 * @api public
 */

function enabled(name) {
  var i, len;
  for (i = 0, len = exports.skips.length; i < len; i++) {
    if (exports.skips[i].test(name)) {
      return false;
    }
  }
  for (i = 0, len = exports.names.length; i < len; i++) {
    if (exports.names[i].test(name)) {
      return true;
    }
  }
  return false;
}

/**
 * Coerce `val`.
 *
 * @param {Mixed} val
 * @return {Mixed}
 * @api private
 */

function coerce(val) {
  if (val instanceof Error) return val.stack || val.message;
  return val;
}

},{"ms":11}],8:[function(require,module,exports){
/*jshint node:true, curly: true, eqeqeq: true, immed: true, latedef: true, newcap: true, noarg: true, sub: true, undef: true, eqnull: true, laxcomma: true, white: true, indent: 2 */
/*
 * ector
 * https://github.com/parmentf/node-ector
 *
 * Copyright (c) 2012 François Parmentier
 * Licensed under the MIT license.
 */
"use strict";

// ## Node modules
var debug = require('debug')('ector:lib');
var sugar = require('sugar');

var Tokenizer = require('sentence-tokenizer');
var concept_network = require('concept-network');
var ConceptNetwork = concept_network.ConceptNetwork;
var ConceptNetworkState = concept_network.ConceptNetworkState;
var rwc = require('random-weighted-choice');

/**
 * ## Ector's constructor
 * Use it to instanciate one bot.
 *
 * Warning: username and botname should be at least 3 characters long.
 *
 * @param {string} botname name of the bot (default: ECTOR)
 * @param {string} username name of the user (default: Guy)
 */
function Ector(botname, username) {

  this.name = "ECTOR";
  var name;
  if (botname) {
    name = this.setName(botname);
  }

  this.username = "Guy";
  var user;

  if (name instanceof Error) {
    debug('name', name);
  }
  if (user instanceof Error) {
    debug('user', user);
  }

  this.cn = new ConceptNetwork();
  this.cns = {}; // username -> ConceptNetworkState

  this.lastSentenceNodeId = null;

  if (username) {
    user = this.setUser(username);
  }
  else {
    user = this.setUser(this.username);
  }

}

// ## Ector's methods
Ector.prototype = {
  rwc : rwc,

  /**
   * ### setUser
   *
   * @this Ector
   * @param {string} username new user's name
   * @return {string|Error} the user's name or an Error.
   */
  setUser : function (username) {
    if (typeof username !== 'string') {
      return new Error("Username should be a string");
    }
    if (username.length === 0) {
      return new Error("Username should not be empty");
    }
    if (username.length < 3) {
      return new Error("Username should be at least 3 characters long");
    }
    this.username = username;
    if (typeof this.cns[this.username] === 'undefined') {
      this.cns[this.username] = new ConceptNetworkState(this.cn);
    }
    this.lastSentenceNodeId = null;
    return this.username;
  },

  /**
   * ### setName
   * @param {string} botname new bot's name
   * @return {string|Error} the name of the bot, or an Error.
   */
  setName : function (botname) {
    if (typeof botname !== 'string') {
      return new Error("botname should be a string");
    }
    this.name = botname;
    return this.name;
  },

  /**
   * ### addEntry
   *
   * Add an entry into the ECTOR's Concept Network
   *
   * @param {string} entry One or several sentences.
   * @param {conceptNetworkState} cns
   * @return {Array|Error} array of token nodes
   **/
  addEntry : function (entry, cns) {
    if (typeof entry !== 'string') {
      return new Error("entry should be a string");
    }
    if (entry.length === 0) {
      return new Error("entry should not be empty");
    }
    cns = cns || this.cns[this.username];
    var tokenizer = new Tokenizer(this.username, this.name);
    tokenizer.setEntry(entry);
    var sentences = tokenizer.getSentences();
    var tokens = [];
    var tokenNodes = [];
    var prevSentenceNode = null;
    var sentenceNode;
    var prevTokenNode;
    var curTokenNode;
    var curToken;
    // all sentences
    for (var sentenceIndex in sentences) {
      tokens = tokenizer.getTokens(Number(sentenceIndex));
      sentenceNode = this.cn.addNode('s' + sentences[sentenceIndex]);
      if (prevSentenceNode) {
        this.cn.addLink(prevSentenceNode.id, sentenceNode.id);
      }
      if (Number(sentenceIndex) === 0) {
        this.lastSentenceNodeId = sentenceNode.id;
      }
      cns.activate(sentenceNode.id);
      // Tokens in the sentence
      prevTokenNode = null;
      for (var tokenIndex in tokens) {
        curToken = tokens[tokenIndex];
        curTokenNode = this.cn.addNode('w' + curToken);
        // First token of a sentence
        if (Number(tokenIndex) === 0) {
          if (typeof curTokenNode.beg === 'undefined') { curTokenNode.beg = 1; }
          else { curTokenNode.beg += 1; }
        }
        // tokens in the middle of the sentence
        else if (tokenIndex > 0 && tokenIndex < tokens.length - 1) {
          if (typeof curTokenNode.mid === 'undefined') { curTokenNode.mid = 1; }
          else { curTokenNode.mid += 1; }
        }
        this.cn.addLink(sentenceNode.id, curTokenNode.id);
        tokenNodes = tokenNodes.concat(curTokenNode);
        cns.activate(curTokenNode.id);
        // Link previous token to current one
        if (prevTokenNode) {
          this.cn.addLink(prevTokenNode.id, curTokenNode.id);
        }
        prevTokenNode = curTokenNode;
      } // For all tokens in the sentence
      // Last token of a sentence
      if (typeof tokenNodes[tokenNodes.length - 1].end === 'undefined') { tokenNodes[tokenNodes.length - 1].end = 1; }
      else { tokenNodes[tokenNodes.length - 1].end += 1; }
      prevSentenceNode = sentenceNode;
    } // For all sentences
    return tokenNodes;
  },

  /**
   * ###generateForward
   *
   * Generate the end of a sentence, adding tokens to the list of token
   * nodes in phrase.
   *
   * @param {Array} phraseNodes array of token nodes
   * @param {Number} temperature
   * @return {Array} array of token nodes (end of phrase)
   **/
  generateForward : function (phraseNodes, temperature) {
    var outgoingLinks = this.cn.getNodeFromLinks(phraseNodes[phraseNodes.length - 1].id);
    var nextNodes = []; // [{id, weight}]
    for (var ol in outgoingLinks) {
      var linkId = outgoingLinks[ol];
      var link = this.cn.link[linkId];
      var toNode = this.cn.node[link.toId];
      // When toNode is a word token
      if (toNode.label.slice(0, 1) === 'w') {
        var activationValue = this.cns[this.username].getActivationValue(toNode.id);
        activationValue = Math.max(activationValue, 1);
        var repeatNb = phraseNodes.count(toNode);
        var len = toNode.label.length;
        // If the node is not present more than 3 times
        if (repeatNb * len <= 5 * 3) {
          var repetition = 1 + repeatNb * repeatNb * len;
          nextNodes.push({
            id: toNode.id,
            weight: link.coOcc * activationValue / repetition
          });
        }
      }
    }
    // Stop condition
    if (nextNodes.length === 0) {
      return phraseNodes;
    }
    // Choose one node among the tokens following the one at the end of the
    // phrase
    var chosenItem = this.rwc(nextNodes, temperature);
    var chosenTokenNode = this.cn.node[chosenItem];
    phraseNodes.push(chosenTokenNode);

    // Recursively generate the remaining of the phrase
    return this.generateForward(phraseNodes, temperature);
  },

  /**
   * ###generateBackward
   *
   * Generate the begining of a sentence, adding tokens to the list of token
   * nodes in phrase.
   *
   * @param {Array} phraseNodes array of token nodes
   * @param {Number} temperature
   * @return {Array} array of token nodes
   **/
  generateBackward : function (phraseNodes, temperature) {
    var incomingLinks = this.cn.getNodeToLinks(phraseNodes[0].id);
    var previousNodes = []; // [{id, weight}]
    for (var ol in incomingLinks) {
      var linkId = incomingLinks[ol];
      var link = this.cn.link[linkId];
      var fromNode = this.cn.node[link.fromId];
      // When fromNode is a word token
      if (fromNode.label.slice(0, 1) === 'w') {
        var activationValue = this.cns[this.username].getActivationValue(fromNode.id);
        activationValue = Math.max(activationValue, 1);
        var repeatNb = phraseNodes.count(fromNode);
        var len = fromNode.label.length;
        // If the node is not present more than 3 times
        if (repeatNb * len <= 5 * 3) {
          var repetition = 1 + repeatNb * repeatNb * len;
          previousNodes.push({
            id: fromNode.id,
            weight: link.coOcc * activationValue / repetition
          });
        }
      }
    }
    // Stop condition
    if (previousNodes.length === 0) {
      return phraseNodes;
    }
    // Choose one node among the tokens following the one at the end of the
    // phrase
    var chosenItem = this.rwc(previousNodes, temperature);
    var chosenTokenNode = this.cn.node[chosenItem];
    phraseNodes = [chosenTokenNode].concat(phraseNodes);
    // Recursively generate the remaining of the phrase
    return this.generateBackward(phraseNodes, temperature);
  },

  /**
   * ### generateResponse
   *
   * Generate a response from the Concept Network and a network state.
   * @return {Object} { response, nodes } The response is a string, and nodes is an array of nodes.
   **/
  generateResponse : function () {
    // Propagation activations through links
    var cns = this.cns[this.username];
    cns.propagate();
    // Choose a token node among the most activated ones
    var maxActivationValue = cns.getMaximumActivationValue('w');
    var tokens = cns.getActivatedTypedNodes('w', maxActivationValue - 10);
    var toChoose = [];
    for (var i in tokens) {
      toChoose.push({ weight: tokens[i].activationValue,
                      id: tokens[i].node.id });
    }
    var temperature = 60;
    var chosenItem = this.rwc(toChoose, temperature);
    var chosenTokenNode = this.cn.node[chosenItem];
    var phraseNodes = [chosenTokenNode];
    // Generate forwards
    phraseNodes = this.generateForward(phraseNodes, temperature);
    // Generate backwards
    phraseNodes = this.generateBackward(phraseNodes, temperature);
    // Generate string
    var sentence = phraseNodes.map(function (node) {
      return node.label.slice(1);
    }).join(' ');
    var nodes = phraseNodes.map(function (node) {
      return node.id;
    });
    sentence = sentence.replace(/\{yourname\}/g, this.username);
    sentence = sentence.replace(/\{myname\}/g, this.name);
    return { sentence: sentence, nodes: nodes };
  },

  /**
   * ### linkNodesToLastSentence
   *
   * Link nodes to the previous sentence node id (this is automatically set by
   * addEntry, it is the node id of the first sentence of the entry).
   *
   * Used with the nodes returned by addEntry.
   *
   * @param {Array} nodes Array of nodes ids.
   **/

  linkNodesToLastSentence : function (nodes) {
    for (var i in nodes) {
      var nodeId = nodes[i];
      this.cn.addLink(nodeId, this.lastSentenceNodeId);
    }
  },

  /**
   * ### injectConceptNetwork
   *
   * inject a new ConceptNetwork constructor.
   * Useful when one wants to use specialized ConceptNetwork (e.g.
   * FileConceptNetwork)
   *
   * WARNING: reinitialize this.cn and this.cn[this.username].cns
   * @param {ConceptNetwork} NewConceptNetwork
   */
  injectConceptNetwork : function (NewConceptNetwork) {
    if (NewConceptNetwork && NewConceptNetwork.super_ &&
      NewConceptNetwork.super_.name &&
      NewConceptNetwork.super_.name === 'ConceptNetwork') {
      this.cn = new NewConceptNetwork();
      ConceptNetwork = NewConceptNetwork;
      this.cns[this.username] = new ConceptNetworkState(this.cn);
    }
    else {
      this.cn = new ConceptNetwork();
      throw new Error('NewConceptNetwork is not a ConceptNetwork');
    }
  }

};


module.exports = Ector;

},{"concept-network":1,"debug":6,"random-weighted-choice":12,"sentence-tokenizer":13,"sugar":15}],9:[function(require,module,exports){
module.exports = require('./lib/google-search');
},{"./lib/google-search":10}],10:[function(require,module,exports){
'use strict';
const https = require('https');
const _ = require('underscore');
const url = require('url');

var GoogleSearch = function(options) {
  if (!options) options = {};
  options = _.defaults(options, {
    format: "json",
    headers: {"User-Agent": "GoogleSearch"},
    host: "www.googleapis.com",
    port: 443,
    path: "/customsearch/v1",
    alt: "json"
  });

  this.config = {
    key: options.key,
    format: options.format,
    headers: options.headers,
    host: options.host,
    port: options.port,
    path: options.path,
    cx: options.cx
  };
  return this;
};

GoogleSearch.prototype.build = function(options, callback) {
  this._doRequest(this._generateUrl(options), callback);
};

GoogleSearch.prototype._generateUrl = function(query) {
  query.key = this.config.key;
  query.cx = this.config.cx;
  var pathname = this.config.path;
  //console.log(pathname);
  var urlFormatted = url.format({
    protocol: "https",
    hostname: this.config.host,
    pathname: pathname,
    query: query
  });
  return url.parse(urlFormatted);
};

GoogleSearch.prototype._doRequest = function(requestQuery, callback) {
  https.get(requestQuery, function(res) {
    var data = [];
    for (var item in res.headers) {
      console.log(item + ":" + res.headers[item]);
    }

    res.
      on('data', function(chunk) {data.push(chunk);}).
      on('end', function() {
        var dataBuffer = data.join('').trim();
        var result;
        try {
          result = JSON.parse(dataBuffer);
        } catch(e) {
          result = {'status_code': 500, 'status_text': 'JSON parse failed'};
        }
        callback(null, result);
      }).
      on('error', function(e) {
        callback(e);
      });
  });
};

module.exports = GoogleSearch;

},{"https":27,"underscore":16,"url":60}],11:[function(require,module,exports){
/**
 * Helpers.
 */

var s = 1000;
var m = s * 60;
var h = m * 60;
var d = h * 24;
var y = d * 365.25;

/**
 * Parse or format the given `val`.
 *
 * Options:
 *
 *  - `long` verbose formatting [false]
 *
 * @param {String|Number} val
 * @param {Object} options
 * @return {String|Number}
 * @api public
 */

module.exports = function(val, options){
  options = options || {};
  if ('string' == typeof val) return parse(val);
  return options.long
    ? long(val)
    : short(val);
};

/**
 * Parse the given `str` and return milliseconds.
 *
 * @param {String} str
 * @return {Number}
 * @api private
 */

function parse(str) {
  str = '' + str;
  if (str.length > 10000) return;
  var match = /^((?:\d+)?\.?\d+) *(milliseconds?|msecs?|ms|seconds?|secs?|s|minutes?|mins?|m|hours?|hrs?|h|days?|d|years?|yrs?|y)?$/i.exec(str);
  if (!match) return;
  var n = parseFloat(match[1]);
  var type = (match[2] || 'ms').toLowerCase();
  switch (type) {
    case 'years':
    case 'year':
    case 'yrs':
    case 'yr':
    case 'y':
      return n * y;
    case 'days':
    case 'day':
    case 'd':
      return n * d;
    case 'hours':
    case 'hour':
    case 'hrs':
    case 'hr':
    case 'h':
      return n * h;
    case 'minutes':
    case 'minute':
    case 'mins':
    case 'min':
    case 'm':
      return n * m;
    case 'seconds':
    case 'second':
    case 'secs':
    case 'sec':
    case 's':
      return n * s;
    case 'milliseconds':
    case 'millisecond':
    case 'msecs':
    case 'msec':
    case 'ms':
      return n;
  }
}

/**
 * Short format for `ms`.
 *
 * @param {Number} ms
 * @return {String}
 * @api private
 */

function short(ms) {
  if (ms >= d) return Math.round(ms / d) + 'd';
  if (ms >= h) return Math.round(ms / h) + 'h';
  if (ms >= m) return Math.round(ms / m) + 'm';
  if (ms >= s) return Math.round(ms / s) + 's';
  return ms + 'ms';
}

/**
 * Long format for `ms`.
 *
 * @param {Number} ms
 * @return {String}
 * @api private
 */

function long(ms) {
  return plural(ms, d, 'day')
    || plural(ms, h, 'hour')
    || plural(ms, m, 'minute')
    || plural(ms, s, 'second')
    || ms + ' ms';
}

/**
 * Pluralization helper.
 */

function plural(ms, n, name) {
  if (ms < n) return;
  if (ms < n * 1.5) return Math.floor(ms / n) + ' ' + name;
  return Math.ceil(ms / n) + ' ' + name + 's';
}

},{}],12:[function(require,module,exports){
/*jshint node:true, laxcomma:true */
"use strict";

var debug = require('debug')('rwc');

var RandomWeightedChoice = function (table, temperature, randomFunction, influence) {
  influence = influence || 2; // Seems fine, difficult to tune
  if (typeof(temperature)=="undefined") temperature =  50; // in [0,100], 50 is neutral
  if (temperature === null) temperature = 50; // if no temperature given, 50 is neutral
  temperature = isNaN(temperature) ? 50 : temperature;
  debug('temperature', temperature);
  var T = (temperature - 50) / 50;
  if (typeof(randomFunction)=="undefined") randomFunction = Math.random;

  var nb = table.length;
  if(!nb) return null; // No item given.

  var total = 0;
  table.forEach(function(element, index) {
    total += element.weight;
  });

  var avg = total / nb;
  debug('total', total);
  debug('nb', nb);
  debug('avg', avg);

  // Compute amplified urgencies (depending on temperature)
  var ur = {};
  var urgencySum = 0;
  table.forEach(function(element, index) {
    var urgency = element.weight + T * influence * (avg - element.weight);
    if (urgency < 0) urgency = 0;
    urgencySum += urgency;
    ur[element.id] = (ur[element.id] || 0 ) + urgency;
  });

  var cumulatedUrgencies = {};
  var currentUrgency = 0;
  Object.keys(ur).forEach(function(id, index) {
    currentUrgency += ur[id];
    cumulatedUrgencies[id] = currentUrgency;
  });

  if(urgencySum < 1) return null; // No weight given

  // Choose
  var choice = randomFunction() * urgencySum;

  debug('ur', ur);
  debug('cumulatedUrgencies', cumulatedUrgencies);
  debug('urgencySum', urgencySum);
  debug('choice', choice);

  var ids = Object.keys(cumulatedUrgencies);
  for(var i=0; i<ids.length; i++) {
    var id = ids[i];
    var urgency = cumulatedUrgencies[id];
    if(choice <= urgency) {
      debug('return', id);
      return id;
    }    
  }
};

module.exports = RandomWeightedChoice;

},{"debug":6}],13:[function(require,module,exports){
/*jshint node:true, laxcomma:true */
"use strict";

var debug = require('debug')('tokenizer');

var sugar = require('sugar');

function Tokenizer(username, botname) {

  // // Maybe it is not useful
  // if (!(this instanceof Tokenizer)) {
  //   return new Tokenizer();
  // }

  this.username = username || 'Guy';
  this.entry = null;
  this.sentences = null;

  if (typeof botname == 'string') {
    this.botname = botname;
  }
  else {
    this.botname = 'ECTOR';
  }
}

Tokenizer.prototype = {
  setEntry : function (entry) {
    this.entry = entry.compact();
    this.sentences = null;
  },
  // Split the entry into sentences.
  getSentences : function () {
    // this.sentences = this.entry.split(/[\.!]\s/);
    var words = this.entry.words();
    var endingWords = words.filter(function(w) {
      return w.endsWith(/[\.!\?]/);
    });

    var self = this;
    var botnameRegExp = new RegExp("\\W?" + self.botname.normalize() + "\\W?");
    var usernameRegExp = new RegExp("\\W?" + self.username.normalize() + "\\W?");
    var lastSentence = words[0];
    self.sentences = [];
    words.reduce(function (prev, cur, index, array) {
      var curNormalized = cur.normalize();
      var curReplaced = cur;
      if (curNormalized.search(botnameRegExp) !== -1) {
        curReplaced = cur.replace(self.botname,"{yourname}");
      }
      else if (curNormalized.search(usernameRegExp) !== -1) {
        curReplaced = cur.replace(self.username,"{myname}");
      }

      if (endingWords.indexOf(prev) != -1) {
        self.sentences.push(lastSentence.compact());
        lastSentence = "";
      }
      lastSentence = lastSentence + " " + curReplaced;
      return cur;
    });
    self.sentences.push(lastSentence.compact());
    return this.sentences;
  },
  // Get the tokens of one sentence
  getTokens : function (sentenceIndex) {
    var s = 0;
    if(typeof sentenceIndex === 'number') s = sentenceIndex;
    return this.sentences[s].words();
  }
};

module.exports = Tokenizer;
},{"debug":6,"sugar":14}],14:[function(require,module,exports){
(function (global){
/*
 *  Sugar Library vedge
 *
 *  Freely distributable and licensed under the MIT-style license.
 *  Copyright (c) 2013 Andrew Plummer
 *  http://sugarjs.com/
 *
 * ---------------------------- */
(function(){
  /***
   * @package Core
   * @description Internal utility and common methods.
   ***/


  // A few optimizations for Google Closure Compiler will save us a couple kb in the release script.
  var object = Object, array = Array, regexp = RegExp, date = Date, string = String, number = Number, math = Math, Undefined;

  // Internal toString
  var internalToString = object.prototype.toString;

  // The global context
  var globalContext = typeof global !== 'undefined' ? global : this;

  // Type check methods need a way to be accessed dynamically outside global context.
  var typeChecks = {};

  // defineProperty exists in IE8 but will error when trying to define a property on
  // native objects. IE8 does not have defineProperies, however, so this check saves a try/catch block.
  var definePropertySupport = object.defineProperty && object.defineProperties;


  // Class initializers and class helpers

  var ClassNames = 'Array,Boolean,Date,Function,Number,String,RegExp'.split(',');

  var isArray    = buildClassCheck(ClassNames[0]);
  var isBoolean  = buildClassCheck(ClassNames[1]);
  var isDate     = buildClassCheck(ClassNames[2]);
  var isFunction = buildClassCheck(ClassNames[3]);
  var isNumber   = buildClassCheck(ClassNames[4]);
  var isString   = buildClassCheck(ClassNames[5]);
  var isRegExp   = buildClassCheck(ClassNames[6]);

  function buildClassCheck(name) {
    var type, fn;
    if(/String|Number|Boolean/.test(name)) {
      type = name.toLowerCase();
    }
    fn = (name === 'Array' && array.isArray) || function(obj) {
      if(type && typeof obj === type) {
        return true;
      }
      return className(obj) === '[object '+name+']';
    }
    typeChecks[name] = fn;
    return fn;
  }

  function className(obj) {
    return internalToString.call(obj);
  }

  function initializeClasses() {
    initializeClass(object);
    iterateOverObject(ClassNames, function(i,name) {
      initializeClass(globalContext[name]);
    });
  }

  function initializeClass(klass) {
    if(klass['SugarMethods']) return;
    defineProperty(klass, 'SugarMethods', {});
    extend(klass, false, false, {
      'extend': function(methods, override, instance) {
        extend(klass, instance !== false, override, methods);
      },
      'sugarRestore': function() {
        return batchMethodExecute(klass, arguments, function(target, name, m) {
          defineProperty(target, name, m.method);
        });
      },
      'sugarRevert': function() {
        return batchMethodExecute(klass, arguments, function(target, name, m) {
          if(m.existed) {
            defineProperty(target, name, m.original);
          } else {
            delete target[name];
          }
        });
      }
    });
  }

  // Class extending methods

  function extend(klass, instance, override, methods) {
    var extendee = instance ? klass.prototype : klass;
    initializeClass(klass);
    iterateOverObject(methods, function(name, method) {
      var original = extendee[name];
      var existed  = hasOwnProperty(extendee, name);
      if(typeof override === 'function') {
        method = wrapNative(extendee[name], method, override);
      }
      if(override !== false || !extendee[name]) {
        defineProperty(extendee, name, method);
      }
      // If the method is internal to Sugar, then store a reference so it can be restored later.
      klass['SugarMethods'][name] = { instance: instance, method: method, original: original, existed: existed };
    });
  }

  function extendSimilar(klass, instance, override, set, fn) {
    var methods = {};
    set = isString(set) ? set.split(',') : set;
    set.forEach(function(name, i) {
      fn(methods, name, i);
    });
    extend(klass, instance, override, methods);
  }

  function batchMethodExecute(klass, args, fn) {
    var all = args.length === 0, methods = multiArgs(args), changed = false;
    iterateOverObject(klass['SugarMethods'], function(name, m) {
      if(all || methods.indexOf(name) > -1) {
        changed = true;
        fn(m.instance ? klass.prototype : klass, name, m);
      }
    });
    return changed;
  }

  function wrapNative(nativeFn, extendedFn, condition) {
    return function() {
      var fn;
      if(nativeFn && (condition === true || !condition.apply(this, arguments))) {
        fn = nativeFn;
      } else {
        fn = extendedFn;
      }
      return fn.apply(this, arguments);
    }
  }

  function defineProperty(target, name, method) {
    if(definePropertySupport) {
      object.defineProperty(target, name, { 'value': method, 'configurable': true, 'enumerable': false, 'writable': true });
    } else {
      target[name] = method;
    }
  }


  // Argument helpers

  function multiArgs(args, fn) {
    var result = [], i, len;
    for(i = 0, len = args.length; i < len; i++) {
      result.push(args[i]);
      if(fn) fn.call(args, args[i], i);
    }
    return result;
  }

  function flattenedArgs(obj, fn, from) {
    multiArgs(array.prototype.concat.apply([], array.prototype.slice.call(obj, from || 0)), fn);
  }

  function checkCallback(fn) {
    if(!fn || !fn.call) {
      throw new TypeError('Callback is not callable');
    }
  }


  // General helpers

  function isDefined(o) {
    return o !== Undefined;
  }

  function isUndefined(o) {
    return o === Undefined;
  }


  // Object helpers

  function isObjectPrimitive(obj) {
    // Check for null
    return obj && typeof obj === 'object';
  }

  function isObject(obj) {
    // === on the constructor is not safe across iframes
    // 'hasOwnProperty' ensures that the object also inherits
    // from Object, which is false for DOMElements in IE.
    return !!obj && className(obj) === '[object Object]' && 'hasOwnProperty' in obj;
  }

  function hasOwnProperty(obj, key) {
    return object['hasOwnProperty'].call(obj, key);
  }

  function iterateOverObject(obj, fn) {
    var key;
    for(key in obj) {
      if(!hasOwnProperty(obj, key)) continue;
      if(fn.call(obj, key, obj[key], obj) === false) break;
    }
  }

  function simpleMerge(target, source) {
    iterateOverObject(source, function(key) {
      target[key] = source[key];
    });
    return target;
  }

  // Hash definition

  function Hash(obj) {
    simpleMerge(this, obj);
  };

  Hash.prototype.constructor = object;

  // Number helpers

  function getRange(start, stop, fn, step) {
    var arr = [], i = parseInt(start), down = step < 0;
    while((!down && i <= stop) || (down && i >= stop)) {
      arr.push(i);
      if(fn) fn.call(this, i);
      i += step || 1;
    }
    return arr;
  }

  function round(val, precision, method) {
    var fn = math[method || 'round'];
    var multiplier = math.pow(10, math.abs(precision || 0));
    if(precision < 0) multiplier = 1 / multiplier;
    return fn(val * multiplier) / multiplier;
  }

  function ceil(val, precision) {
    return round(val, precision, 'ceil');
  }

  function floor(val, precision) {
    return round(val, precision, 'floor');
  }

  function padNumber(num, place, sign, base) {
    var str = math.abs(num).toString(base || 10);
    str = repeatString(place - str.replace(/\.\d+/, '').length, '0') + str;
    if(sign || num < 0) {
      str = (num < 0 ? '-' : '+') + str;
    }
    return str;
  }

  function getOrdinalizedSuffix(num) {
    if(num >= 11 && num <= 13) {
      return 'th';
    } else {
      switch(num % 10) {
        case 1:  return 'st';
        case 2:  return 'nd';
        case 3:  return 'rd';
        default: return 'th';
      }
    }
  }


  // String helpers

  // WhiteSpace/LineTerminator as defined in ES5.1 plus Unicode characters in the Space, Separator category.
  function getTrimmableCharacters() {
    return '\u0009\u000A\u000B\u000C\u000D\u0020\u00A0\u1680\u180E\u2000\u2001\u2002\u2003\u2004\u2005\u2006\u2007\u2008\u2009\u200A\u202F\u205F\u2028\u2029\u3000\uFEFF';
  }

  function repeatString(times, str) {
    return array(math.max(0, isDefined(times) ? times : 1) + 1).join(str || '');
  }


  // RegExp helpers

  function getRegExpFlags(reg, add) {
    var flags = reg.toString().match(/[^/]*$/)[0];
    if(add) {
      flags = (flags + add).split('').sort().join('').replace(/([gimy])\1+/g, '$1');
    }
    return flags;
  }

  function escapeRegExp(str) {
    if(!isString(str)) str = string(str);
    return str.replace(/([\\/'*+?|()\[\]{}.^$])/g,'\\$1');
  }


  // Specialized helpers


  // Used by Array#unique and Object.equal

  function stringify(thing, stack) {
    var type = typeof thing,
        thingIsObject,
        thingIsArray,
        klass, value,
        arr, key, i, len;

    // Return quickly if string to save cycles
    if(type === 'string') return thing;

    klass         = internalToString.call(thing)
    thingIsObject = isObject(thing);
    thingIsArray  = klass === '[object Array]';

    if(thing != null && thingIsObject || thingIsArray) {
      // This method for checking for cyclic structures was egregiously stolen from
      // the ingenious method by @kitcambridge from the Underscore script:
      // https://github.com/documentcloud/underscore/issues/240
      if(!stack) stack = [];
      // Allowing a step into the structure before triggering this
      // script to save cycles on standard JSON structures and also to
      // try as hard as possible to catch basic properties that may have
      // been modified.
      if(stack.length > 1) {
        i = stack.length;
        while (i--) {
          if (stack[i] === thing) {
            return 'CYC';
          }
        }
      }
      stack.push(thing);
      value = string(thing.constructor);
      arr = thingIsArray ? thing : object.keys(thing).sort();
      for(i = 0, len = arr.length; i < len; i++) {
        key = thingIsArray ? i : arr[i];
        value += key + stringify(thing[key], stack);
      }
      stack.pop();
    } else if(1 / thing === -Infinity) {
      value = '-0';
    } else {
      value = string(thing && thing.valueOf ? thing.valueOf() : thing);
    }
    return type + klass + value;
  }

  function isEqual(a, b) {
    if(objectIsMatchedByValue(a) && objectIsMatchedByValue(b)) {
      return stringify(a) === stringify(b);
    } else {
      return a === b;
    }
  }

  function objectIsMatchedByValue(obj) {
    var klass = className(obj);
    return /^\[object Date|Array|String|Number|RegExp|Boolean|Arguments\]$/.test(klass) ||
           isObject(obj);
  }


  // Used by Array#at and String#at

  function entryAtIndex(arr, args, str) {
    var result = [], length = arr.length, loop = args[args.length - 1] !== false, r;
    multiArgs(args, function(index) {
      if(isBoolean(index)) return false;
      if(loop) {
        index = index % length;
        if(index < 0) index = length + index;
      }
      r = str ? arr.charAt(index) || '' : arr[index];
      result.push(r);
    });
    return result.length < 2 ? result[0] : result;
  }


  // Object class methods implemented as instance methods

  function buildObjectInstanceMethods(set, target) {
    extendSimilar(target, true, false, set, function(methods, name) {
      methods[name + (name === 'equal' ? 's' : '')] = function() {
        return object[name].apply(null, [this].concat(multiArgs(arguments)));
      }
    });
  }

  initializeClasses();



  /***
   * @package ES5
   * @description Shim methods that provide ES5 compatible functionality. This package can be excluded if you do not require legacy browser support (IE8 and below).
   *
   ***/


  /***
   * Object module
   *
   ***/

  extend(object, false, false, {

    'keys': function(obj) {
      var keys = [];
      if(!isObjectPrimitive(obj) && !isRegExp(obj) && !isFunction(obj)) {
        throw new TypeError('Object required');
      }
      iterateOverObject(obj, function(key, value) {
        keys.push(key);
      });
      return keys;
    }

  });


  /***
   * Array module
   *
   ***/

  // ECMA5 methods

  function arrayIndexOf(arr, search, fromIndex, increment) {
    var length = arr.length,
        fromRight = increment == -1,
        start = fromRight ? length - 1 : 0,
        index = toIntegerWithDefault(fromIndex, start);
    if(index < 0) {
      index = length + index;
    }
    if((!fromRight && index < 0) || (fromRight && index >= length)) {
      index = start;
    }
    while((fromRight && index >= 0) || (!fromRight && index < length)) {
      if(arr[index] === search) {
        return index;
      }
      index += increment;
    }
    return -1;
  }

  function arrayReduce(arr, fn, initialValue, fromRight) {
    var length = arr.length, count = 0, defined = isDefined(initialValue), result, index;
    checkCallback(fn);
    if(length == 0 && !defined) {
      throw new TypeError('Reduce called on empty array with no initial value');
    } else if(defined) {
      result = initialValue;
    } else {
      result = arr[fromRight ? length - 1 : count];
      count++;
    }
    while(count < length) {
      index = fromRight ? length - count - 1 : count;
      if(index in arr) {
        result = fn(result, arr[index], index, arr);
      }
      count++;
    }
    return result;
  }

  function toIntegerWithDefault(i, d) {
    if(isNaN(i)) {
      return d;
    } else {
      return parseInt(i >> 0);
    }
  }

  function checkFirstArgumentExists(args) {
    if(args.length === 0) {
      throw new TypeError('First argument must be defined');
    }
  }




  extend(array, false, false, {

    /***
     *
     * @method Array.isArray(<obj>)
     * @returns Boolean
     * @short Returns true if <obj> is an Array.
     * @extra This method is provided for browsers that don't support it internally.
     * @example
     *
     *   Array.isArray(3)        -> false
     *   Array.isArray(true)     -> false
     *   Array.isArray('wasabi') -> false
     *   Array.isArray([1,2,3])  -> true
     *
     ***/
    'isArray': function(obj) {
      return isArray(obj);
    }

  });


  extend(array, true, false, {

    /***
     * @method every(<f>, [scope])
     * @returns Boolean
     * @short Returns true if all elements in the array match <f>.
     * @extra [scope] is the %this% object. %all% is provided an alias. In addition to providing this method for browsers that don't support it natively, this method also implements @array_matching.
     * @example
     *
     +   ['a','a','a'].every(function(n) {
     *     return n == 'a';
     *   });
     *   ['a','a','a'].every('a')   -> true
     *   [{a:2},{a:2}].every({a:2}) -> true
     ***/
    'every': function(fn, scope) {
      var length = this.length, index = 0;
      checkFirstArgumentExists(arguments);
      while(index < length) {
        if(index in this && !fn.call(scope, this[index], index, this)) {
          return false;
        }
        index++;
      }
      return true;
    },

    /***
     * @method some(<f>, [scope])
     * @returns Boolean
     * @short Returns true if any element in the array matches <f>.
     * @extra [scope] is the %this% object. %any% is provided as an alias. In addition to providing this method for browsers that don't support it natively, this method also implements @array_matching.
     * @example
     *
     +   ['a','b','c'].some(function(n) {
     *     return n == 'a';
     *   });
     +   ['a','b','c'].some(function(n) {
     *     return n == 'd';
     *   });
     *   ['a','b','c'].some('a')   -> true
     *   [{a:2},{b:5}].some({a:2}) -> true
     ***/
    'some': function(fn, scope) {
      var length = this.length, index = 0;
      checkFirstArgumentExists(arguments);
      while(index < length) {
        if(index in this && fn.call(scope, this[index], index, this)) {
          return true;
        }
        index++;
      }
      return false;
    },

    /***
     * @method map(<map>, [scope])
     * @returns Array
     * @short Maps the array to another array containing the values that are the result of calling <map> on each element.
     * @extra [scope] is the %this% object. In addition to providing this method for browsers that don't support it natively, this enhanced method also directly accepts a string, which is a shortcut for a function that gets that property (or invokes a function) on each element.
     * @example
     *
     +   [1,2,3].map(function(n) {
     *     return n * 3;
     *   });                                  -> [3,6,9]
     *   ['one','two','three'].map(function(n) {
     *     return n.length;
     *   });                                  -> [3,3,5]
     *   ['one','two','three'].map('length')  -> [3,3,5]
     ***/
    'map': function(fn, scope) {
      var length = this.length, index = 0, result = new Array(length);
      checkFirstArgumentExists(arguments);
      while(index < length) {
        if(index in this) {
          result[index] = fn.call(scope, this[index], index, this);
        }
        index++;
      }
      return result;
    },

    /***
     * @method filter(<f>, [scope])
     * @returns Array
     * @short Returns any elements in the array that match <f>.
     * @extra [scope] is the %this% object. In addition to providing this method for browsers that don't support it natively, this method also implements @array_matching.
     * @example
     *
     +   [1,2,3].filter(function(n) {
     *     return n > 1;
     *   });
     *   [1,2,2,4].filter(2) -> 2
     *
     ***/
    'filter': function(fn, scope) {
      var length = this.length, index = 0, result = [];
      checkFirstArgumentExists(arguments);
      while(index < length) {
        if(index in this && fn.call(scope, this[index], index, this)) {
          result.push(this[index]);
        }
        index++;
      }
      return result;
    },

    /***
     * @method indexOf(<search>, [fromIndex])
     * @returns Number
     * @short Searches the array and returns the first index where <search> occurs, or -1 if the element is not found.
     * @extra [fromIndex] is the index from which to begin the search. This method performs a simple strict equality comparison on <search>. It does not support enhanced functionality such as searching the contents against a regex, callback, or deep comparison of objects. For such functionality, use the %findIndex% method instead.
     * @example
     *
     *   [1,2,3].indexOf(3)           -> 1
     *   [1,2,3].indexOf(7)           -> -1
     *
     ***/
    'indexOf': function(search, fromIndex) {
      if(isString(this)) return this.indexOf(search, fromIndex);
      return arrayIndexOf(this, search, fromIndex, 1);
    },

    /***
     * @method lastIndexOf(<search>, [fromIndex])
     * @returns Number
     * @short Searches the array and returns the last index where <search> occurs, or -1 if the element is not found.
     * @extra [fromIndex] is the index from which to begin the search. This method performs a simple strict equality comparison on <search>.
     * @example
     *
     *   [1,2,1].lastIndexOf(1)                 -> 2
     *   [1,2,1].lastIndexOf(7)                 -> -1
     *
     ***/
    'lastIndexOf': function(search, fromIndex) {
      if(isString(this)) return this.lastIndexOf(search, fromIndex);
      return arrayIndexOf(this, search, fromIndex, -1);
    },

    /***
     * @method forEach([fn], [scope])
     * @returns Nothing
     * @short Iterates over the array, calling [fn] on each loop.
     * @extra This method is only provided for those browsers that do not support it natively. [scope] becomes the %this% object.
     * @example
     *
     *   ['a','b','c'].forEach(function(a) {
     *     // Called 3 times: 'a','b','c'
     *   });
     *
     ***/
    'forEach': function(fn, scope) {
      var length = this.length, index = 0;
      checkCallback(fn);
      while(index < length) {
        if(index in this) {
          fn.call(scope, this[index], index, this);
        }
        index++;
      }
    },

    /***
     * @method reduce(<fn>, [init])
     * @returns Mixed
     * @short Reduces the array to a single result.
     * @extra If [init] is passed as a starting value, that value will be passed as the first argument to the callback. The second argument will be the first element in the array. From that point, the result of the callback will then be used as the first argument of the next iteration. This is often refered to as "accumulation", and [init] is often called an "accumulator". If [init] is not passed, then <fn> will be called n - 1 times, where n is the length of the array. In this case, on the first iteration only, the first argument will be the first element of the array, and the second argument will be the second. After that callbacks work as normal, using the result of the previous callback as the first argument of the next. This method is only provided for those browsers that do not support it natively.
     *
     * @example
     *
     +   [1,2,3,4].reduce(function(a, b) {
     *     return a - b;
     *   });
     +   [1,2,3,4].reduce(function(a, b) {
     *     return a - b;
     *   }, 100);
     *
     ***/
    'reduce': function(fn, init) {
      return arrayReduce(this, fn, init);
    },

    /***
     * @method reduceRight([fn], [init])
     * @returns Mixed
     * @short Identical to %Array#reduce%, but operates on the elements in reverse order.
     * @extra This method is only provided for those browsers that do not support it natively.
     *
     *
     *
     *
     * @example
     *
     +   [1,2,3,4].reduceRight(function(a, b) {
     *     return a - b;
     *   });
     *
     ***/
    'reduceRight': function(fn, init) {
      return arrayReduce(this, fn, init, true);
    }


  });




  /***
   * String module
   *
   ***/


  function buildTrim() {
    var support = getTrimmableCharacters().match(/^\s+$/);
    try { string.prototype.trim.call([1]); } catch(e) { support = false; }
    extend(string, true, !support, {

      /***
       * @method trim[Side]()
       * @returns String
       * @short Removes leading and/or trailing whitespace from the string.
       * @extra Whitespace is defined as line breaks, tabs, and any character in the "Space, Separator" Unicode category, conforming to the the ES5 spec. The standard %trim% method is only added when not fully supported natively.
       *
       * @set
       *   trim
       *   trimLeft
       *   trimRight
       *
       * @example
       *
       *   '   wasabi   '.trim()      -> 'wasabi'
       *   '   wasabi   '.trimLeft()  -> 'wasabi   '
       *   '   wasabi   '.trimRight() -> '   wasabi'
       *
       ***/
      'trim': function() {
        return this.toString().trimLeft().trimRight();
      },

      'trimLeft': function() {
        return this.replace(regexp('^['+getTrimmableCharacters()+']+'), '');
      },

      'trimRight': function() {
        return this.replace(regexp('['+getTrimmableCharacters()+']+$'), '');
      }
    });
  }



  /***
   * Function module
   *
   ***/


  extend(Function, true, false, {

     /***
     * @method bind(<scope>, [arg1], ...)
     * @returns Function
     * @short Binds <scope> as the %this% object for the function when it is called. Also allows currying an unlimited number of parameters.
     * @extra "currying" means setting parameters ([arg1], [arg2], etc.) ahead of time so that they are passed when the function is called later. If you pass additional parameters when the function is actually called, they will be added will be added to the end of the curried parameters. This method is provided for browsers that don't support it internally.
     * @example
     *
     +   (function() {
     *     return this;
     *   }).bind('woof')(); -> returns 'woof'; function is bound with 'woof' as the this object.
     *   (function(a) {
     *     return a;
     *   }).bind(1, 2)();   -> returns 2; function is bound with 1 as the this object and 2 curried as the first parameter
     *   (function(a, b) {
     *     return a + b;
     *   }).bind(1, 2)(3);  -> returns 5; function is bound with 1 as the this object, 2 curied as the first parameter and 3 passed as the second when calling the function
     *
     ***/
    'bind': function(scope) {
      var fn = this, args = multiArgs(arguments).slice(1), nop, bound;
      if(!isFunction(this)) {
        throw new TypeError('Function.prototype.bind called on a non-function');
      }
      bound = function() {
        return fn.apply(fn.prototype && this instanceof fn ? this : scope, args.concat(multiArgs(arguments)));
      }
      bound.prototype = this.prototype;
      return bound;
    }

  });

  /***
   * Date module
   *
   ***/

   /***
   * @method toISOString()
   * @returns String
   * @short Formats the string to ISO8601 format.
   * @extra This will always format as UTC time. Provided for browsers that do not support this method.
   * @example
   *
   *   Date.create().toISOString() -> ex. 2011-07-05 12:24:55.528Z
   *
   ***
   * @method toJSON()
   * @returns String
   * @short Returns a JSON representation of the date.
   * @extra This is effectively an alias for %toISOString%. Will always return the date in UTC time. Provided for browsers that do not support this method.
   * @example
   *
   *   Date.create().toJSON() -> ex. 2011-07-05 12:24:55.528Z
   *
   ***/

  extend(date, false, false, {

     /***
     * @method Date.now()
     * @returns String
     * @short Returns the number of milliseconds since January 1st, 1970 00:00:00 (UTC time).
     * @extra Provided for browsers that do not support this method.
     * @example
     *
     *   Date.now() -> ex. 1311938296231
     *
     ***/
    'now': function() {
      return new date().getTime();
    }

  });

   function buildISOString() {
    var d = new date(date.UTC(1999, 11, 31)), target = '1999-12-31T00:00:00.000Z';
    var support = d.toISOString && d.toISOString() === target;
    extendSimilar(date, true, !support, 'toISOString,toJSON', function(methods, name) {
      methods[name] = function() {
        return padNumber(this.getUTCFullYear(), 4) + '-' +
               padNumber(this.getUTCMonth() + 1, 2) + '-' +
               padNumber(this.getUTCDate(), 2) + 'T' +
               padNumber(this.getUTCHours(), 2) + ':' +
               padNumber(this.getUTCMinutes(), 2) + ':' +
               padNumber(this.getUTCSeconds(), 2) + '.' +
               padNumber(this.getUTCMilliseconds(), 3) + 'Z';
      }
    });
   }

  // Initialize
  buildTrim();
  buildISOString();



  /***
   * @package Array
   * @dependency core
   * @description Array manipulation and traversal, "fuzzy matching" against elements, alphanumeric sorting and collation, enumerable methods on Object.
   *
   ***/


  function multiMatch(el, match, scope, params) {
    var result = true;
    if(el === match) {
      // Match strictly equal values up front.
      return true;
    } else if(isRegExp(match) && isString(el)) {
      // Match against a regexp
      return regexp(match).test(el);
    } else if(isFunction(match)) {
      // Match against a filtering function
      return match.apply(scope, params);
    } else if(isObject(match) && isObjectPrimitive(el)) {
      // Match against a hash or array.
      iterateOverObject(match, function(key, value) {
        if(!multiMatch(el[key], match[key], scope, [el[key], el])) {
          result = false;
        }
      });
      return result;
    } else {
      return isEqual(el, match);
    }
  }

  function transformArgument(el, map, context, mapArgs) {
    if(isUndefined(map)) {
      return el;
    } else if(isFunction(map)) {
      return map.apply(context, mapArgs || []);
    } else if(isFunction(el[map])) {
      return el[map].call(el);
    } else {
      return el[map];
    }
  }

  // Basic array internal methods

  function arrayEach(arr, fn, startIndex, loop) {
    var length, index, i;
    if(startIndex < 0) startIndex = arr.length + startIndex;
    i = isNaN(startIndex) ? 0 : startIndex;
    length = loop === true ? arr.length + i : arr.length;
    while(i < length) {
      index = i % arr.length;
      if(!(index in arr)) {
        return iterateOverSparseArray(arr, fn, i, loop);
      } else if(fn.call(arr, arr[index], index, arr) === false) {
        break;
      }
      i++;
    }
  }

  function iterateOverSparseArray(arr, fn, fromIndex, loop) {
    var indexes = [], i;
    for(i in arr) {
      if(isArrayIndex(arr, i) && i >= fromIndex) {
        indexes.push(parseInt(i));
      }
    }
    indexes.sort().each(function(index) {
      return fn.call(arr, arr[index], index, arr);
    });
    return arr;
  }

  function isArrayIndex(arr, i) {
    return i in arr && toUInt32(i) == i && i != 0xffffffff;
  }

  function toUInt32(i) {
    return i >>> 0;
  }

  function arrayFind(arr, f, startIndex, loop, returnIndex) {
    var result, index;
    arrayEach(arr, function(el, i, arr) {
      if(multiMatch(el, f, arr, [el, i, arr])) {
        result = el;
        index = i;
        return false;
      }
    }, startIndex, loop);
    return returnIndex ? index : result;
  }

  function arrayUnique(arr, map) {
    var result = [], o = {}, transformed;
    arrayEach(arr, function(el, i) {
      transformed = map ? transformArgument(el, map, arr, [el, i, arr]) : el;
      if(!checkForElementInHashAndSet(o, transformed)) {
        result.push(el);
      }
    })
    return result;
  }

  function arrayIntersect(arr1, arr2, subtract) {
    var result = [], o = {};
    arr2.each(function(el) {
      checkForElementInHashAndSet(o, el);
    });
    arr1.each(function(el) {
      var stringified = stringify(el),
          isReference = !objectIsMatchedByValue(el);
      // Add the result to the array if:
      // 1. We're subtracting intersections or it doesn't already exist in the result and
      // 2. It exists in the compared array and we're adding, or it doesn't exist and we're removing.
      if(elementExistsInHash(o, stringified, el, isReference) != subtract) {
        discardElementFromHash(o, stringified, el, isReference);
        result.push(el);
      }
    });
    return result;
  }

  function arrayFlatten(arr, level, current) {
    level = level || Infinity;
    current = current || 0;
    var result = [];
    arrayEach(arr, function(el) {
      if(isArray(el) && current < level) {
        result = result.concat(arrayFlatten(el, level, current + 1));
      } else {
        result.push(el);
      }
    });
    return result;
  }

  function flatArguments(args) {
    var result = [];
    multiArgs(args, function(arg) {
      result = result.concat(arg);
    });
    return result;
  }

  function elementExistsInHash(hash, key, element, isReference) {
    var exists = key in hash;
    if(isReference) {
      if(!hash[key]) {
        hash[key] = [];
      }
      exists = hash[key].indexOf(element) !== -1;
    }
    return exists;
  }

  function checkForElementInHashAndSet(hash, element) {
    var stringified = stringify(element),
        isReference = !objectIsMatchedByValue(element),
        exists = elementExistsInHash(hash, stringified, element, isReference);
    if(isReference) {
      hash[stringified].push(element);
    } else {
      hash[stringified] = element;
    }
    return exists;
  }

  function discardElementFromHash(hash, key, element, isReference) {
    var arr, i = 0;
    if(isReference) {
      arr = hash[key];
      while(i < arr.length) {
        if(arr[i] === element) {
          arr.splice(i, 1);
        } else {
          i += 1;
        }
      }
    } else {
      delete hash[key];
    }
  }

  // Support methods

  function getMinOrMax(obj, map, which, all) {
    var edge,
        result = [],
        max = which === 'max',
        min = which === 'min',
        isArray = Array.isArray(obj);
    iterateOverObject(obj, function(key) {
      var el   = obj[key],
          test = transformArgument(el, map, obj, isArray ? [el, parseInt(key), obj] : []);
      if(isUndefined(test)) {
        throw new TypeError('Cannot compare with undefined');
      }
      if(test === edge) {
        result.push(el);
      } else if(isUndefined(edge) || (max && test > edge) || (min && test < edge)) {
        result = [el];
        edge = test;
      }
    });
    if(!isArray) result = arrayFlatten(result, 1);
    return all ? result : result[0];
  }


  // Alphanumeric collation helpers

  function collateStrings(a, b) {
    var aValue, bValue, aChar, bChar, aEquiv, bEquiv, index = 0, tiebreaker = 0;
    a = getCollationReadyString(a);
    b = getCollationReadyString(b);
    do {
      aChar  = getCollationCharacter(a, index);
      bChar  = getCollationCharacter(b, index);
      aValue = getCollationValue(aChar);
      bValue = getCollationValue(bChar);
      if(aValue === -1 || bValue === -1) {
        aValue = a.charCodeAt(index) || null;
        bValue = b.charCodeAt(index) || null;
      }
      aEquiv = aChar !== a.charAt(index);
      bEquiv = bChar !== b.charAt(index);
      if(aEquiv !== bEquiv && tiebreaker === 0) {
        tiebreaker = aEquiv - bEquiv;
      }
      index += 1;
    } while(aValue != null && bValue != null && aValue === bValue);
    if(aValue === bValue) return tiebreaker;
    return aValue < bValue ? -1 : 1;
  }

  function getCollationReadyString(str) {
    if(array[AlphanumericSortIgnoreCase]) {
      str = str.toLowerCase();
    }
    return str.replace(array[AlphanumericSortIgnore], '');
  }

  function getCollationCharacter(str, index) {
    var chr = str.charAt(index), eq = array[AlphanumericSortEquivalents] || {};
    return eq[chr] || chr;
  }

  function getCollationValue(chr) {
    var order = array[AlphanumericSortOrder];
    if(!chr) {
      return null;
    } else {
      return order.indexOf(chr);
    }
  }

  var AlphanumericSortOrder       = 'AlphanumericSortOrder';
  var AlphanumericSortIgnore      = 'AlphanumericSortIgnore';
  var AlphanumericSortIgnoreCase  = 'AlphanumericSortIgnoreCase';
  var AlphanumericSortEquivalents = 'AlphanumericSortEquivalents';



  function buildEnhancements() {
    var callbackCheck = function() { var a = arguments; return a.length > 0 && !isFunction(a[0]); };
    extendSimilar(array, true, callbackCheck, 'map,every,all,some,any,none,filter', function(methods, name) {
      methods[name] = function(f) {
        return this[name](function(el, index) {
          if(name === 'map') {
            return transformArgument(el, f, this, [el, index, this]);
          } else {
            return multiMatch(el, f, this, [el, index, this]);
          }
        });
      }
    });
  }

  function buildAlphanumericSort() {
    var order = 'AÁÀÂÃĄBCĆČÇDĎÐEÉÈĚÊËĘFGĞHıIÍÌİÎÏJKLŁMNŃŇÑOÓÒÔPQRŘSŚŠŞTŤUÚÙŮÛÜVWXYÝZŹŻŽÞÆŒØÕÅÄÖ';
    var equiv = 'AÁÀÂÃÄ,CÇ,EÉÈÊË,IÍÌİÎÏ,OÓÒÔÕÖ,Sß,UÚÙÛÜ';
    array[AlphanumericSortOrder] = order.split('').map(function(str) {
      return str + str.toLowerCase();
    }).join('');
    var equivalents = {};
    arrayEach(equiv.split(','), function(set) {
      var equivalent = set.charAt(0);
      arrayEach(set.slice(1).split(''), function(chr) {
        equivalents[chr] = equivalent;
        equivalents[chr.toLowerCase()] = equivalent.toLowerCase();
      });
    });
    array[AlphanumericSortIgnoreCase] = true;
    array[AlphanumericSortEquivalents] = equivalents;
  }

  extend(array, false, false, {

    /***
     *
     * @method Array.create(<obj1>, <obj2>, ...)
     * @returns Array
     * @short Alternate array constructor.
     * @extra This method will create a single array by calling %concat% on all arguments passed. In addition to ensuring that an unknown variable is in a single, flat array (the standard constructor will create nested arrays, this one will not), it is also a useful shorthand to convert a function's arguments object into a standard array.
     * @example
     *
     *   Array.create('one', true, 3)   -> ['one', true, 3]
     *   Array.create(['one', true, 3]) -> ['one', true, 3]
     +   Array.create(function(n) {
     *     return arguments;
     *   }('howdy', 'doody'));
     *
     ***/
    'create': function() {
      var result = [], tmp;
      multiArgs(arguments, function(a) {
        if(isObjectPrimitive(a)) {
          try {
            tmp = array.prototype.slice.call(a, 0);
            if(tmp.length > 0) {
              a = tmp;
            }
          } catch(e) {};
        }
        result = result.concat(a);
      });
      return result;
    }

  });

  extend(array, true, false, {

    /***
     * @method find(<f>, [index] = 0, [loop] = false)
     * @returns Mixed
     * @short Returns the first element that matches <f>.
     * @extra <f> will match a string, number, array, object, or alternately test against a function or regex. Starts at [index], and will continue once from index = 0 if [loop] is true. This method implements @array_matching.
     * @example
     *
     +   [{a:1,b:2},{a:1,b:3},{a:1,b:4}].find(function(n) {
     *     return n['a'] == 1;
     *   });                                     -> {a:1,b:3}
     *   ['cuba','japan','canada'].find(/^c/, 2) -> 'canada'
     *
     ***/
    'find': function(f, index, loop) {
      return arrayFind(this, f, index, loop);
    },

    /***
     * @method findAll(<f>, [index] = 0, [loop] = false)
     * @returns Array
     * @short Returns all elements that match <f>.
     * @extra <f> will match a string, number, array, object, or alternately test against a function or regex. Starts at [index], and will continue once from index = 0 if [loop] is true. This method implements @array_matching.
     * @example
     *
     +   [{a:1,b:2},{a:1,b:3},{a:2,b:4}].findAll(function(n) {
     *     return n['a'] == 1;
     *   });                                        -> [{a:1,b:3},{a:1,b:4}]
     *   ['cuba','japan','canada'].findAll(/^c/)    -> 'cuba','canada'
     *   ['cuba','japan','canada'].findAll(/^c/, 2) -> 'canada'
     *
     ***/
    'findAll': function(f, index, loop) {
      var result = [];
      arrayEach(this, function(el, i, arr) {
        if(multiMatch(el, f, arr, [el, i, arr])) {
          result.push(el);
        }
      }, index, loop);
      return result;
    },

    /***
     * @method findIndex(<f>, [startIndex] = 0, [loop] = false)
     * @returns Number
     * @short Returns the index of the first element that matches <f> or -1 if not found.
     * @extra This method has a few notable differences to native %indexOf%. Although <f> will similarly match a primitive such as a string or number, it will also match deep objects and arrays that are not equal by reference (%===%). Additionally, if a function is passed it will be run as a matching function (similar to the behavior of %Array#filter%) rather than attempting to find that function itself by reference in the array. Starts at [index], and will continue once from index = 0 if [loop] is true. This method implements @array_matching.
     * @example
     *
     +   [1,2,3,4].findIndex(3);  -> 2
     +   [1,2,3,4].findIndex(function(n) {
     *     return n % 2 == 0;
     *   }); -> 1
     +   ['one','two','three'].findIndex(/th/); -> 2
     *
     ***/
    'findIndex': function(f, startIndex, loop) {
      var index = arrayFind(this, f, startIndex, loop, true);
      return isUndefined(index) ? -1 : index;
    },

    /***
     * @method count(<f>)
     * @returns Number
     * @short Counts all elements in the array that match <f>.
     * @extra <f> will match a string, number, array, object, or alternately test against a function or regex. This method implements @array_matching.
     * @example
     *
     *   [1,2,3,1].count(1)       -> 2
     *   ['a','b','c'].count(/b/) -> 1
     +   [{a:1},{b:2}].count(function(n) {
     *     return n['a'] > 1;
     *   });                      -> 0
     *
     ***/
    'count': function(f) {
      if(isUndefined(f)) return this.length;
      return this.findAll(f).length;
    },

    /***
     * @method removeAt(<start>, [end])
     * @returns Array
     * @short Removes element at <start>. If [end] is specified, removes the range between <start> and [end]. This method will change the array! If you don't intend the array to be changed use %clone% first.
     * @example
     *
     *   ['a','b','c'].removeAt(0) -> ['b','c']
     *   [1,2,3,4].removeAt(1, 3)  -> [1]
     *
     ***/
    'removeAt': function(start, end) {
      var i, len;
      if(isUndefined(start)) return this;
      if(isUndefined(end)) end = start;
      for(i = 0, len = end - start; i <= len; i++) {
        this.splice(start, 1);
      }
      return this;
    },

    /***
     * @method include(<el>, [index])
     * @returns Array
     * @short Adds <el> to the array.
     * @extra This is a non-destructive alias for %add%. It will not change the original array.
     * @example
     *
     *   [1,2,3,4].include(5)       -> [1,2,3,4,5]
     *   [1,2,3,4].include(8, 1)    -> [1,8,2,3,4]
     *   [1,2,3,4].include([5,6,7]) -> [1,2,3,4,5,6,7]
     *
     ***/
    'include': function(el, index) {
      return this.clone().add(el, index);
    },

    /***
     * @method exclude([f1], [f2], ...)
     * @returns Array
     * @short Removes any element in the array that matches [f1], [f2], etc.
     * @extra This is a non-destructive alias for %remove%. It will not change the original array. This method implements @array_matching.
     * @example
     *
     *   [1,2,3].exclude(3)         -> [1,2]
     *   ['a','b','c'].exclude(/b/) -> ['a','c']
     +   [{a:1},{b:2}].exclude(function(n) {
     *     return n['a'] == 1;
     *   });                       -> [{b:2}]
     *
     ***/
    'exclude': function() {
      return array.prototype.remove.apply(this.clone(), arguments);
    },

    /***
     * @method clone()
     * @returns Array
     * @short Makes a shallow clone of the array.
     * @example
     *
     *   [1,2,3].clone() -> [1,2,3]
     *
     ***/
    'clone': function() {
      return simpleMerge([], this);
    },

    /***
     * @method unique([map] = null)
     * @returns Array
     * @short Removes all duplicate elements in the array.
     * @extra [map] may be a function mapping the value to be uniqued on or a string acting as a shortcut. This is most commonly used when you have a key that ensures the object's uniqueness, and don't need to check all fields. This method will also correctly operate on arrays of objects.
     * @example
     *
     *   [1,2,2,3].unique()                 -> [1,2,3]
     *   [{foo:'bar'},{foo:'bar'}].unique() -> [{foo:'bar'}]
     +   [{foo:'bar'},{foo:'bar'}].unique(function(obj){
     *     return obj.foo;
     *   }); -> [{foo:'bar'}]
     *   [{foo:'bar'},{foo:'bar'}].unique('foo') -> [{foo:'bar'}]
     *
     ***/
    'unique': function(map) {
      return arrayUnique(this, map);
    },

    /***
     * @method flatten([limit] = Infinity)
     * @returns Array
     * @short Returns a flattened, one-dimensional copy of the array.
     * @extra You can optionally specify a [limit], which will only flatten that depth.
     * @example
     *
     *   [[1], 2, [3]].flatten()      -> [1,2,3]
     *   [['a'],[],'b','c'].flatten() -> ['a','b','c']
     *
     ***/
    'flatten': function(limit) {
      return arrayFlatten(this, limit);
    },

    /***
     * @method union([a1], [a2], ...)
     * @returns Array
     * @short Returns an array containing all elements in all arrays with duplicates removed.
     * @extra This method will also correctly operate on arrays of objects.
     * @example
     *
     *   [1,3,5].union([5,7,9])     -> [1,3,5,7,9]
     *   ['a','b'].union(['b','c']) -> ['a','b','c']
     *
     ***/
    'union': function() {
      return arrayUnique(this.concat(flatArguments(arguments)));
    },

    /***
     * @method intersect([a1], [a2], ...)
     * @returns Array
     * @short Returns an array containing the elements all arrays have in common.
     * @extra This method will also correctly operate on arrays of objects.
     * @example
     *
     *   [1,3,5].intersect([5,7,9])   -> [5]
     *   ['a','b'].intersect('b','c') -> ['b']
     *
     ***/
    'intersect': function() {
      return arrayIntersect(this, flatArguments(arguments), false);
    },

    /***
     * @method subtract([a1], [a2], ...)
     * @returns Array
     * @short Subtracts from the array all elements in [a1], [a2], etc.
     * @extra This method will also correctly operate on arrays of objects.
     * @example
     *
     *   [1,3,5].subtract([5,7,9])   -> [1,3]
     *   [1,3,5].subtract([3],[5])   -> [1]
     *   ['a','b'].subtract('b','c') -> ['a']
     *
     ***/
    'subtract': function(a) {
      return arrayIntersect(this, flatArguments(arguments), true);
    },

    /***
     * @method at(<index>, [loop] = true)
     * @returns Mixed
     * @short Gets the element(s) at a given index.
     * @extra When [loop] is true, overshooting the end of the array (or the beginning) will begin counting from the other end. As an alternate syntax, passing multiple indexes will get the elements at those indexes.
     * @example
     *
     *   [1,2,3].at(0)        -> 1
     *   [1,2,3].at(2)        -> 3
     *   [1,2,3].at(4)        -> 2
     *   [1,2,3].at(4, false) -> null
     *   [1,2,3].at(-1)       -> 3
     *   [1,2,3].at(0,1)      -> [1,2]
     *
     ***/
    'at': function() {
      return entryAtIndex(this, arguments);
    },

    /***
     * @method first([num] = 1)
     * @returns Mixed
     * @short Returns the first element(s) in the array.
     * @extra When <num> is passed, returns the first <num> elements in the array.
     * @example
     *
     *   [1,2,3].first()        -> 1
     *   [1,2,3].first(2)       -> [1,2]
     *
     ***/
    'first': function(num) {
      if(isUndefined(num)) return this[0];
      if(num < 0) num = 0;
      return this.slice(0, num);
    },

    /***
     * @method last([num] = 1)
     * @returns Mixed
     * @short Returns the last element(s) in the array.
     * @extra When <num> is passed, returns the last <num> elements in the array.
     * @example
     *
     *   [1,2,3].last()        -> 3
     *   [1,2,3].last(2)       -> [2,3]
     *
     ***/
    'last': function(num) {
      if(isUndefined(num)) return this[this.length - 1];
      var start = this.length - num < 0 ? 0 : this.length - num;
      return this.slice(start);
    },

    /***
     * @method from(<index>)
     * @returns Array
     * @short Returns a slice of the array from <index>.
     * @example
     *
     *   [1,2,3].from(1)  -> [2,3]
     *   [1,2,3].from(2)  -> [3]
     *
     ***/
    'from': function(num) {
      return this.slice(num);
    },

    /***
     * @method to(<index>)
     * @returns Array
     * @short Returns a slice of the array up to <index>.
     * @example
     *
     *   [1,2,3].to(1)  -> [1]
     *   [1,2,3].to(2)  -> [1,2]
     *
     ***/
    'to': function(num) {
      if(isUndefined(num)) num = this.length;
      return this.slice(0, num);
    },

    /***
     * @method min([map], [all] = false)
     * @returns Mixed
     * @short Returns the element in the array with the lowest value.
     * @extra [map] may be a function mapping the value to be checked or a string acting as a shortcut. If [all] is true, will return all min values in an array.
     * @example
     *
     *   [1,2,3].min()                          -> 1
     *   ['fee','fo','fum'].min('length')       -> 'fo'
     *   ['fee','fo','fum'].min('length', true) -> ['fo']
     +   ['fee','fo','fum'].min(function(n) {
     *     return n.length;
     *   });                              -> ['fo']
     +   [{a:3,a:2}].min(function(n) {
     *     return n['a'];
     *   });                              -> [{a:2}]
     *
     ***/
    'min': function(map, all) {
      return getMinOrMax(this, map, 'min', all);
    },

    /***
     * @method max([map], [all] = false)
     * @returns Mixed
     * @short Returns the element in the array with the greatest value.
     * @extra [map] may be a function mapping the value to be checked or a string acting as a shortcut. If [all] is true, will return all max values in an array.
     * @example
     *
     *   [1,2,3].max()                          -> 3
     *   ['fee','fo','fum'].max('length')       -> 'fee'
     *   ['fee','fo','fum'].max('length', true) -> ['fee']
     +   [{a:3,a:2}].max(function(n) {
     *     return n['a'];
     *   });                              -> {a:3}
     *
     ***/
    'max': function(map, all) {
      return getMinOrMax(this, map, 'max', all);
    },

    /***
     * @method least([map])
     * @returns Array
     * @short Returns the elements in the array with the least commonly occuring value.
     * @extra [map] may be a function mapping the value to be checked or a string acting as a shortcut.
     * @example
     *
     *   [3,2,2].least()                   -> [3]
     *   ['fe','fo','fum'].least('length') -> ['fum']
     +   [{age:35,name:'ken'},{age:12,name:'bob'},{age:12,name:'ted'}].least(function(n) {
     *     return n.age;
     *   });                               -> [{age:35,name:'ken'}]
     *
     ***/
    'least': function(map, all) {
      return getMinOrMax(this.groupBy.apply(this, [map]), 'length', 'min', all);
    },

    /***
     * @method most([map])
     * @returns Array
     * @short Returns the elements in the array with the most commonly occuring value.
     * @extra [map] may be a function mapping the value to be checked or a string acting as a shortcut.
     * @example
     *
     *   [3,2,2].most()                   -> [2]
     *   ['fe','fo','fum'].most('length') -> ['fe','fo']
     +   [{age:35,name:'ken'},{age:12,name:'bob'},{age:12,name:'ted'}].most(function(n) {
     *     return n.age;
     *   });                              -> [{age:12,name:'bob'},{age:12,name:'ted'}]
     *
     ***/
    'most': function(map, all) {
      return getMinOrMax(this.groupBy.apply(this, [map]), 'length', 'max', all);
    },

    /***
     * @method sum([map])
     * @returns Number
     * @short Sums all values in the array.
     * @extra [map] may be a function mapping the value to be summed or a string acting as a shortcut.
     * @example
     *
     *   [1,2,2].sum()                           -> 5
     +   [{age:35},{age:12},{age:12}].sum(function(n) {
     *     return n.age;
     *   });                                     -> 59
     *   [{age:35},{age:12},{age:12}].sum('age') -> 59
     *
     ***/
    'sum': function(map) {
      var arr = map ? this.map(map) : this;
      return arr.length > 0 ? arr.reduce(function(a,b) { return a + b; }) : 0;
    },

    /***
     * @method average([map])
     * @returns Number
     * @short Averages all values in the array.
     * @extra [map] may be a function mapping the value to be averaged or a string acting as a shortcut.
     * @example
     *
     *   [1,2,3].average()                           -> 2
     +   [{age:35},{age:11},{age:11}].average(function(n) {
     *     return n.age;
     *   });                                         -> 19
     *   [{age:35},{age:11},{age:11}].average('age') -> 19
     *
     ***/
    'average': function(map) {
      var arr = map ? this.map(map) : this;
      return arr.length > 0 ? arr.sum() / arr.length : 0;
    },

    /***
     * @method inGroups(<num>, [padding])
     * @returns Array
     * @short Groups the array into <num> arrays.
     * @extra [padding] specifies a value with which to pad the last array so that they are all equal length.
     * @example
     *
     *   [1,2,3,4,5,6,7].inGroups(3)         -> [ [1,2,3], [4,5,6], [7] ]
     *   [1,2,3,4,5,6,7].inGroups(3, 'none') -> [ [1,2,3], [4,5,6], [7,'none','none'] ]
     *
     ***/
    'inGroups': function(num, padding) {
      var pad = arguments.length > 1;
      var arr = this;
      var result = [];
      var divisor = ceil(this.length / num);
      getRange(0, num - 1, function(i) {
        var index = i * divisor;
        var group = arr.slice(index, index + divisor);
        if(pad && group.length < divisor) {
          getRange(1, divisor - group.length, function() {
            group = group.add(padding);
          });
        }
        result.push(group);
      });
      return result;
    },

    /***
     * @method inGroupsOf(<num>, [padding] = null)
     * @returns Array
     * @short Groups the array into arrays of <num> elements each.
     * @extra [padding] specifies a value with which to pad the last array so that they are all equal length.
     * @example
     *
     *   [1,2,3,4,5,6,7].inGroupsOf(4)         -> [ [1,2,3,4], [5,6,7] ]
     *   [1,2,3,4,5,6,7].inGroupsOf(4, 'none') -> [ [1,2,3,4], [5,6,7,'none'] ]
     *
     ***/
    'inGroupsOf': function(num, padding) {
      var result = [], len = this.length, arr = this, group;
      if(len === 0 || num === 0) return arr;
      if(isUndefined(num)) num = 1;
      if(isUndefined(padding)) padding = null;
      getRange(0, ceil(len / num) - 1, function(i) {
        group = arr.slice(num * i, num * i + num);
        while(group.length < num) {
          group.push(padding);
        }
        result.push(group);
      });
      return result;
    },

    /***
     * @method isEmpty()
     * @returns Boolean
     * @short Returns true if the array is empty.
     * @extra This is true if the array has a length of zero, or contains only %undefined%, %null%, or %NaN%.
     * @example
     *
     *   [].isEmpty()               -> true
     *   [null,undefined].isEmpty() -> true
     *
     ***/
    'isEmpty': function() {
      return this.compact().length == 0;
    },

    /***
     * @method sortBy(<map>, [desc] = false)
     * @returns Array
     * @short Sorts the array by <map>.
     * @extra <map> may be a function, a string acting as a shortcut, or blank (direct comparison of array values). [desc] will sort the array in descending order. When the field being sorted on is a string, the resulting order will be determined by an internal collation algorithm that is optimized for major Western languages, but can be customized. For more information see @array_sorting.
     * @example
     *
     *   ['world','a','new'].sortBy('length')       -> ['a','new','world']
     *   ['world','a','new'].sortBy('length', true) -> ['world','new','a']
     +   [{age:72},{age:13},{age:18}].sortBy(function(n) {
     *     return n.age;
     *   });                                        -> [{age:13},{age:18},{age:72}]
     *
     ***/
    'sortBy': function(map, desc) {
      var arr = this.clone();
      arr.sort(function(a, b) {
        var aProperty, bProperty, comp;
        aProperty = transformArgument(a, map, arr, [a]);
        bProperty = transformArgument(b, map, arr, [b]);
        if(isString(aProperty) && isString(bProperty)) {
          comp = collateStrings(aProperty, bProperty);
        } else if(aProperty < bProperty) {
          comp = -1;
        } else if(aProperty > bProperty) {
          comp = 1;
        } else {
          comp = 0;
        }
        return comp * (desc ? -1 : 1);
      });
      return arr;
    },

    /***
     * @method randomize()
     * @returns Array
     * @short Returns a copy of the array with the elements randomized.
     * @extra Uses Fisher-Yates algorithm.
     * @example
     *
     *   [1,2,3,4].randomize()  -> [?,?,?,?]
     *
     ***/
    'randomize': function() {
      var arr = this.concat(), i = arr.length, j, x;
      while(i) {
        j = (math.random() * i) | 0;
        x = arr[--i];
        arr[i] = arr[j];
        arr[j] = x;
      }
      return arr;
    },

    /***
     * @method zip([arr1], [arr2], ...)
     * @returns Array
     * @short Merges multiple arrays together.
     * @extra This method "zips up" smaller arrays into one large whose elements are "all elements at index 0", "all elements at index 1", etc. Useful when you have associated data that is split over separated arrays. If the arrays passed have more elements than the original array, they will be discarded. If they have fewer elements, the missing elements will filled with %null%.
     * @example
     *
     *   [1,2,3].zip([4,5,6])                                       -> [[1,2], [3,4], [5,6]]
     *   ['Martin','John'].zip(['Luther','F.'], ['King','Kennedy']) -> [['Martin','Luther','King'], ['John','F.','Kennedy']]
     *
     ***/
    'zip': function() {
      var args = multiArgs(arguments);
      return this.map(function(el, i) {
        return [el].concat(args.map(function(k) {
          return (i in k) ? k[i] : null;
        }));
      });
    },

    /***
     * @method sample([num])
     * @returns Mixed
     * @short Returns a random element from the array.
     * @extra If [num] is passed, will return [num] samples from the array.
     * @example
     *
     *   [1,2,3,4,5].sample()  -> // Random element
     *   [1,2,3,4,5].sample(3) -> // Array of 3 random elements
     *
     ***/
    'sample': function(num) {
      var arr = this.randomize();
      return arguments.length > 0 ? arr.slice(0, num) : arr[0];
    },

    /***
     * @method each(<fn>, [index] = 0, [loop] = false)
     * @returns Array
     * @short Runs <fn> against each element in the array. Enhanced version of %Array#forEach%.
     * @extra Parameters passed to <fn> are identical to %forEach%, ie. the first parameter is the current element, second parameter is the current index, and third parameter is the array itself. If <fn> returns %false% at any time it will break out of the loop. Once %each% finishes, it will return the array. If [index] is passed, <fn> will begin at that index and work its way to the end. If [loop] is true, it will then start over from the beginning of the array and continue until it reaches [index] - 1.
     * @example
     *
     *   [1,2,3,4].each(function(n) {
     *     // Called 4 times: 1, 2, 3, 4
     *   });
     *   [1,2,3,4].each(function(n) {
     *     // Called 4 times: 3, 4, 1, 2
     *   }, 2, true);
     *
     ***/
    'each': function(fn, index, loop) {
      arrayEach(this, fn, index, loop);
      return this;
    },

    /***
     * @method add(<el>, [index])
     * @returns Array
     * @short Adds <el> to the array.
     * @extra If [index] is specified, it will add at [index], otherwise adds to the end of the array. %add% behaves like %concat% in that if <el> is an array it will be joined, not inserted. This method will change the array! Use %include% for a non-destructive alias. Also, %insert% is provided as an alias that reads better when using an index.
     * @example
     *
     *   [1,2,3,4].add(5)       -> [1,2,3,4,5]
     *   [1,2,3,4].add([5,6,7]) -> [1,2,3,4,5,6,7]
     *   [1,2,3,4].insert(8, 1) -> [1,8,2,3,4]
     *
     ***/
    'add': function(el, index) {
      if(!isNumber(number(index)) || isNaN(index)) index = this.length;
      array.prototype.splice.apply(this, [index, 0].concat(el));
      return this;
    },

    /***
     * @method remove([f1], [f2], ...)
     * @returns Array
     * @short Removes any element in the array that matches [f1], [f2], etc.
     * @extra Will match a string, number, array, object, or alternately test against a function or regex. This method will change the array! Use %exclude% for a non-destructive alias. This method implements @array_matching.
     * @example
     *
     *   [1,2,3].remove(3)         -> [1,2]
     *   ['a','b','c'].remove(/b/) -> ['a','c']
     +   [{a:1},{b:2}].remove(function(n) {
     *     return n['a'] == 1;
     *   });                       -> [{b:2}]
     *
     ***/
    'remove': function() {
      var i, arr = this;
      multiArgs(arguments, function(f) {
        i = 0;
        while(i < arr.length) {
          if(multiMatch(arr[i], f, arr, [arr[i], i, arr])) {
            arr.splice(i, 1);
          } else {
            i++;
          }
        }
      });
      return arr;
    },

    /***
     * @method compact([all] = false)
     * @returns Array
     * @short Removes all instances of %undefined%, %null%, and %NaN% from the array.
     * @extra If [all] is %true%, all "falsy" elements will be removed. This includes empty strings, 0, and false.
     * @example
     *
     *   [1,null,2,undefined,3].compact() -> [1,2,3]
     *   [1,'',2,false,3].compact()       -> [1,'',2,false,3]
     *   [1,'',2,false,3].compact(true)   -> [1,2,3]
     *
     ***/
    'compact': function(all) {
      var result = [];
      arrayEach(this, function(el, i) {
        if(isArray(el)) {
          result.push(el.compact());
        } else if(all && el) {
          result.push(el);
        } else if(!all && el != null && el.valueOf() === el.valueOf()) {
          result.push(el);
        }
      });
      return result;
    },

    /***
     * @method groupBy(<map>, [fn])
     * @returns Object
     * @short Groups the array by <map>.
     * @extra Will return an object with keys equal to the grouped values. <map> may be a mapping function, or a string acting as a shortcut. Optionally calls [fn] for each group.
     * @example
     *
     *   ['fee','fi','fum'].groupBy('length') -> { 2: ['fi'], 3: ['fee','fum'] }
     +   [{age:35,name:'ken'},{age:15,name:'bob'}].groupBy(function(n) {
     *     return n.age;
     *   });                                  -> { 35: [{age:35,name:'ken'}], 15: [{age:15,name:'bob'}] }
     *
     ***/
    'groupBy': function(map, fn) {
      var arr = this, result = {}, key;
      arrayEach(arr, function(el, index) {
        key = transformArgument(el, map, arr, [el, index, arr]);
        if(!result[key]) result[key] = [];
        result[key].push(el);
      });
      if(fn) {
        iterateOverObject(result, fn);
      }
      return result;
    },

    /***
     * @method none(<f>)
     * @returns Boolean
     * @short Returns true if none of the elements in the array match <f>.
     * @extra <f> will match a string, number, array, object, or alternately test against a function or regex. This method implements @array_matching.
     * @example
     *
     *   [1,2,3].none(5)         -> true
     *   ['a','b','c'].none(/b/) -> false
     +   [{a:1},{b:2}].none(function(n) {
     *     return n['a'] > 1;
     *   });                     -> true
     *
     ***/
    'none': function() {
      return !this.any.apply(this, arguments);
    }


  });

  // Aliases
  extend(array, true, false, {

    /***
     * @method all()
     * @alias every
     *
     ***/
    'all': array.prototype.every,

    /*** @method any()
     * @alias some
     *
     ***/
    'any': array.prototype.some,

    /***
     * @method insert()
     * @alias add
     *
     ***/
    'insert': array.prototype.add

  });


  /***
   * Object module
   * Enumerable methods on objects
   *
   ***/

   function keysWithCoercion(obj) {
     if(obj && obj.valueOf) {
       obj = obj.valueOf();
     }
     return object.keys(obj);
   }

  /***
   * @method [enumerable](<obj>)
   * @returns Boolean
   * @short Enumerable methods in the Array package are also available to the Object class. They will perform their normal operations for every property in <obj>.
   * @extra In cases where a callback is used, instead of %element, index%, the callback will instead be passed %key, value%. Enumerable methods are also available to extended objects as instance methods.
   *
   * @set
   *   each
   *   map
   *   any
   *   all
   *   none
   *   count
   *   find
   *   findAll
   *   reduce
   *   isEmpty
   *   sum
   *   average
   *   min
   *   max
   *   least
   *   most
   *
   * @example
   *
   *   Object.any({foo:'bar'}, 'bar')            -> true
   *   Object.extended({foo:'bar'}).any('bar')   -> true
   *   Object.isEmpty({})                        -> true
   +   Object.map({ fred: { age: 52 } }, 'age'); -> { fred: 52 }
   *
   ***/

  function buildEnumerableMethods(names, mapping) {
    extendSimilar(object, false, false, names, function(methods, name) {
      methods[name] = function(obj, arg1, arg2) {
        var result, coerced = keysWithCoercion(obj);
        result = array.prototype[name].call(coerced, function(key) {
          if(mapping) {
            return transformArgument(obj[key], arg1, obj, [key, obj[key], obj]);
          } else {
            return multiMatch(obj[key], arg1, obj, [key, obj[key], obj]);
          }
        }, arg2);
        if(isArray(result)) {
          // The method has returned an array of keys so use this array
          // to build up the resulting object in the form we want it in.
          result = result.reduce(function(o, key, i) {
            o[key] = obj[key];
            return o;
          }, {});
        }
        return result;
      };
    });
    buildObjectInstanceMethods(names, Hash);
  }

  extend(object, false, false, {

    'map': function(obj, map) {
      return keysWithCoercion(obj).reduce(function(result, key) {
        result[key] = transformArgument(obj[key], map, obj, [key, obj[key], obj]);
        return result;
      }, {});
    },

    'reduce': function(obj) {
      var values = keysWithCoercion(obj).map(function(key) {
        return obj[key];
      });
      return values.reduce.apply(values, multiArgs(arguments).slice(1));
    },

    'each': function(obj, fn) {
      checkCallback(fn);
      iterateOverObject(obj, fn);
      return obj;
    },

    /***
     * @method size(<obj>)
     * @returns Number
     * @short Returns the number of properties in <obj>.
     * @extra %size% is available as an instance method on extended objects.
     * @example
     *
     *   Object.size({ foo: 'bar' }) -> 1
     *
     ***/
    'size': function (obj) {
      return keysWithCoercion(obj).length;
    }

  });

  var EnumerableFindingMethods = 'any,all,none,count,find,findAll,isEmpty'.split(',');
  var EnumerableMappingMethods = 'sum,average,min,max,least,most'.split(',');
  var EnumerableOtherMethods   = 'map,reduce,size'.split(',');
  var EnumerableMethods        = EnumerableFindingMethods.concat(EnumerableMappingMethods).concat(EnumerableOtherMethods);

  buildEnhancements();
  buildAlphanumericSort();
  buildEnumerableMethods(EnumerableFindingMethods);
  buildEnumerableMethods(EnumerableMappingMethods, true);
  buildObjectInstanceMethods(EnumerableOtherMethods, Hash);


  /***
   * @package Date
   * @dependency core
   * @description Date parsing and formatting, relative formats like "1 minute ago", Number methods like "daysAgo", localization support with default English locale definition.
   *
   ***/

  var English;
  var CurrentLocalization;

  var TimeFormat = ['ampm','hour','minute','second','ampm','utc','offset_sign','offset_hours','offset_minutes','ampm']
  var DecimalReg = '(?:[,.]\\d+)?';
  var HoursReg   = '\\d{1,2}' + DecimalReg;
  var SixtyReg   = '[0-5]\\d' + DecimalReg;
  var RequiredTime = '({t})?\\s*('+HoursReg+')(?:{h}('+SixtyReg+')?{m}(?::?('+SixtyReg+'){s})?\\s*(?:({t})|(Z)|(?:([+-])(\\d{2,2})(?::?(\\d{2,2}))?)?)?|\\s*({t}))';

  var KanjiDigits     = '〇一二三四五六七八九十百千万';
  var FullWidthDigits = '０１２３４５６７８９';
  var AsianDigitMap = {};
  var AsianDigitReg;

  var DateArgumentUnits;
  var DateUnitsReversed;
  var CoreDateFormats = [];

  var DateOutputFormats = [
    {
      token: 'f{1,4}|ms|milliseconds',
      format: function(d) {
        return callDateGet(d, 'Milliseconds');
      }
    },
    {
      token: 'ss?|seconds',
      format: function(d, len) {
        return callDateGet(d, 'Seconds');
      }
    },
    {
      token: 'mm?|minutes',
      format: function(d, len) {
        return callDateGet(d, 'Minutes');
      }
    },
    {
      token: 'hh?|hours|12hr',
      format: function(d) {
        return getShortHour(d);
      }
    },
    {
      token: 'HH?|24hr',
      format: function(d) {
        return callDateGet(d, 'Hours');
      }
    },
    {
      token: 'dd?|date|day',
      format: function(d) {
        return callDateGet(d, 'Date');
      }
    },
    {
      token: 'dow|weekday',
      word: true,
      format: function(d, loc, n, t) {
        var dow = callDateGet(d, 'Day');
        return loc['weekdays'][dow + (n - 1) * 7];
      }
    },
    {
      token: 'MM?',
      format: function(d) {
        return callDateGet(d, 'Month') + 1;
      }
    },
    {
      token: 'mon|month',
      word: true,
      format: function(d, loc, n, len) {
        var month = callDateGet(d, 'Month');
        return loc['months'][month + (n - 1) * 12];
      }
    },
    {
      token: 'y{2,4}|year',
      format: function(d) {
        return callDateGet(d, 'FullYear');
      }
    },
    {
      token: '[Tt]{1,2}',
      format: function(d, loc, n, format) {
        if(loc['ampm'].length == 0) return '';
        var hours = callDateGet(d, 'Hours');
        var str = loc['ampm'][floor(hours / 12)];
        if(format.length === 1) str = str.slice(0,1);
        if(format.slice(0,1) === 'T') str = str.toUpperCase();
        return str;
      }
    },
    {
      token: 'z{1,4}|tz|timezone',
      text: true,
      format: function(d, loc, n, format) {
        var tz = d.getUTCOffset();
        if(format == 'z' || format == 'zz') {
          tz = tz.replace(/(\d{2})(\d{2})/, function(f,h,m) {
            return padNumber(h, format.length);
          });
        }
        return tz;
      }
    },
    {
      token: 'iso(tz|timezone)',
      format: function(d) {
        return d.getUTCOffset(true);
      }
    },
    {
      token: 'ord',
      format: function(d) {
        var date = callDateGet(d, 'Date');
        return date + getOrdinalizedSuffix(date);
      }
    }
  ];

  var DateUnits = [
    {
      unit: 'year',
      method: 'FullYear',
      ambiguous: true,
      multiplier: function(d) {
        var adjust = d ? (d.isLeapYear() ? 1 : 0) : 0.25;
        return (365 + adjust) * 24 * 60 * 60 * 1000;
      }
    },
    {
      unit: 'month',
      method: 'Month',
      ambiguous: true,
      multiplier: function(d, ms) {
        var days = 30.4375, inMonth;
        if(d) {
          inMonth = d.daysInMonth();
          if(ms <= inMonth.days()) {
            days = inMonth;
          }
        }
        return days * 24 * 60 * 60 * 1000;
      },
      error: 0.919
    },
    {
      unit: 'week',
      method: 'ISOWeek',
      multiplier: function() {
        return 7 * 24 * 60 * 60 * 1000;
      }
    },
    {
      unit: 'day',
      method: 'Date',
      ambiguous: true,
      multiplier: function() {
        return 24 * 60 * 60 * 1000;
      }
    },
    {
      unit: 'hour',
      method: 'Hours',
      multiplier: function() {
        return 60 * 60 * 1000;
      }
    },
    {
      unit: 'minute',
      method: 'Minutes',
      multiplier: function() {
        return 60 * 1000;
      }
    },
    {
      unit: 'second',
      method: 'Seconds',
      multiplier: function() {
        return 1000;
      }
    },
    {
      unit: 'millisecond',
      method: 'Milliseconds',
      multiplier: function() {
        return 1;
      }
    }
  ];




  // Date Localization

  var Localizations = {};

  // Localization object

  function Localization(l) {
    simpleMerge(this, l);
    this.compiledFormats = CoreDateFormats.concat();
  }

  Localization.prototype = {

    getMonth: function(n) {
      if(isNumber(n)) {
        return n - 1;
      } else {
        return this['months'].indexOf(n) % 12;
      }
    },

    getWeekday: function(n) {
      return this['weekdays'].indexOf(n) % 7;
    },

    getNumber: function(n) {
      var i;
      if(isNumber(n)) {
        return n;
      } else if(n && (i = this['numbers'].indexOf(n)) !== -1) {
        return (i + 1) % 10;
      } else {
        return 1;
      }
    },

    getNumericDate: function(n) {
      var self = this;
      return n.replace(regexp(this['num'], 'g'), function(d) {
        var num = self.getNumber(d);
        return num || '';
      });
    },

    getEnglishUnit: function(n) {
      return English['units'][this['units'].indexOf(n) % 8];
    },

    getRelativeFormat: function(adu) {
      return this.convertAdjustedToFormat(adu, adu[2] > 0 ? 'future' : 'past');
    },

    getDuration: function(ms) {
      return this.convertAdjustedToFormat(getAdjustedUnit(ms), 'duration');
    },

    hasVariant: function(code) {
      code = code || this.code;
      return code === 'en' || code === 'en-US' ? true : this['variant'];
    },

    matchAM: function(str) {
      return str === this['ampm'][0];
    },

    matchPM: function(str) {
      return str && str === this['ampm'][1];
    },

    convertAdjustedToFormat: function(adu, mode) {
      var sign, unit, mult,
          num    = adu[0],
          u      = adu[1],
          ms     = adu[2],
          format = this[mode] || this['relative'];
      if(isFunction(format)) {
        return format.call(this, num, u, ms, mode);
      }
      mult = this['plural'] && num > 1 ? 1 : 0;
      unit = this['units'][mult * 8 + u] || this['units'][u];
      if(this['capitalizeUnit']) unit = simpleCapitalize(unit);
      sign = this['modifiers'].filter(function(m) { return m.name == 'sign' && m.value == (ms > 0 ? 1 : -1); })[0];
      return format.replace(/\{(.*?)\}/g, function(full, match) {
        switch(match) {
          case 'num': return num;
          case 'unit': return unit;
          case 'sign': return sign.src;
        }
      });
    },

    getFormats: function() {
      return this.cachedFormat ? [this.cachedFormat].concat(this.compiledFormats) : this.compiledFormats;
    },

    addFormat: function(src, allowsTime, match, variant, iso) {
      var to = match || [], loc = this, time, timeMarkers, lastIsNumeral;

      src = src.replace(/\s+/g, '[-,. ]*');
      src = src.replace(/\{([^,]+?)\}/g, function(all, k) {
        var value, arr, result,
            opt   = k.match(/\?$/),
            nc    = k.match(/^(\d+)\??$/),
            slice = k.match(/(\d)(?:-(\d))?/),
            key   = k.replace(/[^a-z]+$/, '');
        if(nc) {
          value = loc['tokens'][nc[1]];
        } else if(loc[key]) {
          value = loc[key];
        } else if(loc[key + 's']) {
          value = loc[key + 's'];
          if(slice) {
            // Can't use filter here as Prototype hijacks the method and doesn't
            // pass an index, so use a simple loop instead!
            arr = [];
            value.forEach(function(m, i) {
              var mod = i % (loc['units'] ? 8 : value.length);
              if(mod >= slice[1] && mod <= (slice[2] || slice[1])) {
                arr.push(m);
              }
            });
            value = arr;
          }
          value = arrayToAlternates(value);
        }
        if(nc) {
          result = '(?:' + value + ')';
        } else {
          if(!match) {
            to.push(key);
          }
          result = '(' + value + ')';
        }
        if(opt) {
          result += '?';
        }
        return result;
      });
      if(allowsTime) {
        time = prepareTime(RequiredTime, loc, iso);
        timeMarkers = ['t','[\\s\\u3000]'].concat(loc['timeMarker']);
        lastIsNumeral = src.match(/\\d\{\d,\d\}\)+\??$/);
        addDateInputFormat(loc, '(?:' + time + ')[,\\s\\u3000]+?' + src, TimeFormat.concat(to), variant);
        addDateInputFormat(loc, src + '(?:[,\\s]*(?:' + timeMarkers.join('|') + (lastIsNumeral ? '+' : '*') +')' + time + ')?', to.concat(TimeFormat), variant);
      } else {
        addDateInputFormat(loc, src, to, variant);
      }
    }

  };


  // Localization helpers

  function getLocalization(localeCode, fallback) {
    var loc;
    if(!isString(localeCode)) localeCode = '';
    loc = Localizations[localeCode] || Localizations[localeCode.slice(0,2)];
    if(fallback === false && !loc) {
      throw new Error('Invalid locale.');
    }
    return loc || CurrentLocalization;
  }

  function setLocalization(localeCode, set) {
    var loc, canAbbreviate;

    function initializeField(name) {
      var val = loc[name];
      if(isString(val)) {
        loc[name] = val.split(',');
      } else if(!val) {
        loc[name] = [];
      }
    }

    function eachAlternate(str, fn) {
      str = str.split('+').map(function(split) {
        return split.replace(/(.+):(.+)$/, function(full, base, suffixes) {
          return suffixes.split('|').map(function(suffix) {
            return base + suffix;
          }).join('|');
        });
      }).join('|');
      return str.split('|').forEach(fn);
    }

    function setArray(name, abbreviate, multiple) {
      var arr = [];
      loc[name].forEach(function(full, i) {
        if(abbreviate) {
          full += '+' + full.slice(0,3);
        }
        eachAlternate(full, function(day, j) {
          arr[j * multiple + i] = day.toLowerCase();
        });
      });
      loc[name] = arr;
    }

    function getDigit(start, stop, allowNumbers) {
      var str = '\\d{' + start + ',' + stop + '}';
      if(allowNumbers) str += '|(?:' + arrayToAlternates(loc['numbers']) + ')+';
      return str;
    }

    function getNum() {
      var arr = ['\\d+'].concat(loc['articles']);
      if(loc['numbers']) arr = arr.concat(loc['numbers']);
      return arrayToAlternates(arr);
    }

    function setDefault(name, value) {
      loc[name] = loc[name] || value;
    }

    function setModifiers() {
      var arr = [];
      loc.modifiersByName = {};
      loc['modifiers'].push({ 'name': 'day', 'src': 'yesterday', 'value': -1 });
      loc['modifiers'].push({ 'name': 'day', 'src': 'today', 'value': 0 });
      loc['modifiers'].push({ 'name': 'day', 'src': 'tomorrow', 'value': 1 });
      loc['modifiers'].forEach(function(modifier) {
        var name = modifier.name;
        eachAlternate(modifier.src, function(t) {
          var locEntry = loc[name];
          loc.modifiersByName[t] = modifier;
          arr.push({ name: name, src: t, value: modifier.value });
          loc[name] = locEntry ? locEntry + '|' + t : t;
        });
      });
      loc['day'] += '|' + arrayToAlternates(loc['weekdays']);
      loc['modifiers'] = arr;
    }

    // Initialize the locale
    loc = new Localization(set);
    initializeField('modifiers');
    'months,weekdays,units,numbers,articles,tokens,timeMarker,ampm,timeSuffixes,dateParse,timeParse'.split(',').forEach(initializeField);

    canAbbreviate = !loc['monthSuffix'];

    setArray('months',   canAbbreviate, 12);
    setArray('weekdays', canAbbreviate, 7);
    setArray('units', false, 8);
    setArray('numbers', false, 10);

    setDefault('code', localeCode);
    setDefault('date', getDigit(1,2, loc['digitDate']));
    setDefault('year', "'\\d{2}|" + getDigit(4,4));
    setDefault('num', getNum());

    setModifiers();

    if(loc['monthSuffix']) {
      loc['month'] = getDigit(1,2);
      loc['months'] = getRange(1, 12).map(function(n) { return n + loc['monthSuffix']; });
    }
    loc['full_month'] = getDigit(1,2) + '|' + arrayToAlternates(loc['months']);

    // The order of these formats is very important. Order is reversed so formats that come
    // later will take precedence over formats that come before. This generally means that
    // more specific formats should come later, however, the {year} format should come before
    // {day}, as 2011 needs to be parsed as a year (2011) and not date (20) + hours (11)

    // If the locale has time suffixes then add a time only format for that locale
    // that is separate from the core English-based one.
    if(loc['timeSuffixes'].length > 0) {
      loc.addFormat(prepareTime(RequiredTime, loc), false, TimeFormat)
    }

    loc.addFormat('{day}', true);
    loc.addFormat('{month}' + (loc['monthSuffix'] || ''));
    loc.addFormat('{year}' + (loc['yearSuffix'] || ''));

    loc['timeParse'].forEach(function(src) {
      loc.addFormat(src, true);
    });

    loc['dateParse'].forEach(function(src) {
      loc.addFormat(src);
    });

    return Localizations[localeCode] = loc;
  }


  // General helpers

  function addDateInputFormat(locale, format, match, variant) {
    locale.compiledFormats.unshift({
      variant: variant,
      locale: locale,
      reg: regexp('^' + format + '$', 'i'),
      to: match
    });
  }

  function simpleCapitalize(str) {
    return str.slice(0,1).toUpperCase() + str.slice(1);
  }

  function arrayToAlternates(arr) {
    return arr.filter(function(el) {
      return !!el;
    }).join('|');
  }

  // Date argument helpers

  function collectDateArguments(args, allowDuration) {
    var obj, arr;
    if(isObject(args[0])) {
      return args;
    } else if (isNumber(args[0]) && !isNumber(args[1])) {
      return [args[0]];
    } else if (isString(args[0]) && allowDuration) {
      return [getDateParamsFromString(args[0]), args[1]];
    }
    obj = {};
    DateArgumentUnits.forEach(function(u,i) {
      obj[u.unit] = args[i];
    });
    return [obj];
  }

  function getDateParamsFromString(str, num) {
    var params = {};
    match = str.match(/^(\d+)?\s?(\w+?)s?$/i);
    if(match) {
      if(isUndefined(num)) {
        num = parseInt(match[1]) || 1;
      }
      params[match[2].toLowerCase()] = num;
    }
    return params;
  }

  // Date parsing helpers

  function getFormatMatch(match, arr) {
    var obj = {}, value, num;
    arr.forEach(function(key, i) {
      value = match[i + 1];
      if(isUndefined(value) || value === '') return;
      if(key === 'year') {
        obj.yearAsString = value.replace(/'/, '');
      }
      num = parseFloat(value.replace(/'/, '').replace(/,/, '.'));
      obj[key] = !isNaN(num) ? num : value.toLowerCase();
    });
    return obj;
  }

  function cleanDateInput(str) {
    str = str.trim().replace(/^just (?=now)|\.+$/i, '');
    return convertAsianDigits(str);
  }

  function convertAsianDigits(str) {
    return str.replace(AsianDigitReg, function(full, disallowed, match) {
      var sum = 0, place = 1, lastWasHolder, lastHolder;
      if(disallowed) return full;
      match.split('').reverse().forEach(function(letter) {
        var value = AsianDigitMap[letter], holder = value > 9;
        if(holder) {
          if(lastWasHolder) sum += place;
          place *= value / (lastHolder || 1);
          lastHolder = value;
        } else {
          if(lastWasHolder === false) {
            place *= 10;
          }
          sum += place * value;
        }
        lastWasHolder = holder;
      });
      if(lastWasHolder) sum += place;
      return sum;
    });
  }

  function getExtendedDate(f, localeCode, prefer, forceUTC) {
    var d = new date(), relative = false, baseLocalization, loc, format, set, unit, weekday, num, tmp, after;

    d.utc(forceUTC);

    if(isDate(f)) {
      // If the source here is already a date object, then the operation
      // is the same as cloning the date, which preserves the UTC flag.
      d.utc(f.isUTC()).setTime(f.getTime());
    } else if(isNumber(f)) {
      d.setTime(f);
    } else if(isObject(f)) {
      d.set(f, true);
      set = f;
    } else if(isString(f)) {

      // The act of getting the localization will pre-initialize
      // if it is missing and add the required formats.
      baseLocalization = getLocalization(localeCode);

      // Clean the input and convert Kanji based numerals if they exist.
      f = cleanDateInput(f);

      if(baseLocalization) {
        iterateOverObject(baseLocalization.getFormats(), function(i, dif) {
          var match = f.match(dif.reg);
          if(match) {
            format = dif;
            loc = format.locale;
            set = getFormatMatch(match, format.to, loc);

            if(set['utc']) {
              d.utc();
            }

            loc.cachedFormat = format;

            if(set.timestamp) {
              set = set.timestamp;
              return false;
            }

            // If there's a variant (crazy Endian American format), swap the month and day.
            if(format.variant && !isString(set['month']) && (isString(set['date']) || baseLocalization.hasVariant(localeCode))) {
              tmp = set['month'];
              set['month'] = set['date'];
              set['date']  = tmp;
            }

            // If the year is 2 digits then get the implied century.
            if(set['year'] && set.yearAsString.length === 2) {
              set['year'] = getYearFromAbbreviation(set['year']);
            }

            // Set the month which may be localized.
            if(set['month']) {
              set['month'] = loc.getMonth(set['month']);
              if(set['shift'] && !set['unit']) set['unit'] = loc['units'][7];
            }

            // If there is both a weekday and a date, the date takes precedence.
            if(set['weekday'] && set['date']) {
              delete set['weekday'];
            // Otherwise set a localized weekday.
            } else if(set['weekday']) {
              set['weekday'] = loc.getWeekday(set['weekday']);
              if(set['shift'] && !set['unit']) set['unit'] = loc['units'][5];
            }

            // Relative day localizations such as "today" and "tomorrow".
            if(set['day'] && (tmp = loc.modifiersByName[set['day']])) {
              set['day'] = tmp.value;
              d.reset();
              relative = true;
            // If the day is a weekday, then set that instead.
            } else if(set['day'] && (weekday = loc.getWeekday(set['day'])) > -1) {
              delete set['day'];
              if(set['num'] && set['month']) {
                // If we have "the 2nd tuesday of June", set the day to the beginning of the month, then
                // look ahead to set the weekday after all other properties have been set. The weekday needs
                // to be set after the actual set because it requires overriding the "prefer" argument which
                // could unintentionally send the year into the future, past, etc.
                after = function() {
                  var w = d.getWeekday();
                  d.setWeekday((7 * (set['num'] - 1)) + (w > weekday ? weekday + 7 : weekday));
                }
                set['day'] = 1;
              } else {
                set['weekday'] = weekday;
              }
            }

            if(set['date'] && !isNumber(set['date'])) {
              set['date'] = loc.getNumericDate(set['date']);
            }

            // If the time is 1pm-11pm advance the time by 12 hours.
            if(loc.matchPM(set['ampm']) && set['hour'] < 12) {
              set['hour'] += 12;
            } else if(loc.matchAM(set['ampm']) && set['hour'] === 12) {
              set['hour'] = 0;
            }

            // Adjust for timezone offset
            if('offset_hours' in set || 'offset_minutes' in set) {
              d.utc();
              set['offset_minutes'] = set['offset_minutes'] || 0;
              set['offset_minutes'] += set['offset_hours'] * 60;
              if(set['offset_sign'] === '-') {
                set['offset_minutes'] *= -1;
              }
              set['minute'] -= set['offset_minutes'];
            }

            // Date has a unit like "days", "months", etc. are all relative to the current date.
            if(set['unit']) {
              relative = true;
              num = loc.getNumber(set['num']);
              unit = loc.getEnglishUnit(set['unit']);

              // Shift and unit, ie "next month", "last week", etc.
              if(set['shift'] || set['edge']) {
                num *= (tmp = loc.modifiersByName[set['shift']]) ? tmp.value : 0;

                // Relative month and static date: "the 15th of last month"
                if(unit === 'month' && isDefined(set['date'])) {
                  d.set({ 'day': set['date'] }, true);
                  delete set['date'];
                }

                // Relative year and static month/date: "June 15th of last year"
                if(unit === 'year' && isDefined(set['month'])) {
                  d.set({ 'month': set['month'], 'day': set['date'] }, true);
                  delete set['month'];
                  delete set['date'];
                }
              }
              // Unit and sign, ie "months ago", "weeks from now", etc.
              if(set['sign'] && (tmp = loc.modifiersByName[set['sign']])) {
                num *= tmp.value;
              }

              // Units can be with non-relative dates, set here. ie "the day after monday"
              if(isDefined(set['weekday'])) {
                d.set({'weekday': set['weekday'] }, true);
                delete set['weekday'];
              }

              // Finally shift the unit.
              set[unit] = (set[unit] || 0) + num;
            }

            if(set['year_sign'] === '-') {
              set['year'] *= -1;
            }

            DateUnitsReversed.slice(1,4).forEach(function(u, i) {
              var value = set[u.unit], fraction = value % 1;
              if(fraction) {
                set[DateUnitsReversed[i].unit] = round(fraction * (u.unit === 'second' ? 1000 : 60));
                set[u.unit] = floor(value);
              }
            });
            return false;
          }
        });
      }
      if(!format) {
        // The Date constructor does something tricky like checking the number
        // of arguments so simply passing in undefined won't work.
        if(f !== 'now') {
          d = new date(f);
        }
        if(forceUTC) {
          // Falling back to system date here which cannot be parsed as UTC,
          // so if we're forcing UTC then simply add the offset.
          d.addMinutes(-d.getTimezoneOffset());
        }
      } else if(relative) {
        d.advance(set);
      } else {
        if(d._utc) {
          // UTC times can traverse into other days or even months,
          // so preemtively reset the time here to prevent this.
          d.reset();
        }
        updateDate(d, set, true, false, prefer);
      }

      // If there is an "edge" it needs to be set after the
      // other fields are set. ie "the end of February"
      if(set && set['edge']) {
        tmp = loc.modifiersByName[set['edge']];
        iterateOverObject(DateUnitsReversed.slice(4), function(i, u) {
          if(isDefined(set[u.unit])) {
            unit = u.unit;
            return false;
          }
        });
        if(unit === 'year') set.specificity = 'month';
        else if(unit === 'month' || unit === 'week') set.specificity = 'day';
        d[(tmp.value < 0 ? 'endOf' : 'beginningOf') + simpleCapitalize(unit)]();
        // This value of -2 is arbitrary but it's a nice clean way to hook into this system.
        if(tmp.value === -2) d.reset();
      }
      if(after) {
        after();
      }
      // A date created by parsing a string presumes that the format *itself* is UTC, but
      // not that the date, once created, should be manipulated as such. In other words,
      // if you are creating a date object from a server time "2012-11-15T12:00:00Z",
      // in the majority of cases you are using it to create a date that will, after creation,
      // be manipulated as local, so reset the utc flag here.
      d.utc(false);
    }
    return {
      date: d,
      set: set
    }
  }

  // If the year is two digits, add the most appropriate century prefix.
  function getYearFromAbbreviation(year) {
    return round(callDateGet(new date(), 'FullYear') / 100) * 100 - round(year / 100) * 100 + year;
  }

  function getShortHour(d) {
    var hours = callDateGet(d, 'Hours');
    return hours === 0 ? 12 : hours - (floor(hours / 13) * 12);
  }

  // weeksSince won't work here as the result needs to be floored, not rounded.
  function getWeekNumber(date) {
    date = date.clone();
    var dow = callDateGet(date, 'Day') || 7;
    date.addDays(4 - dow).reset();
    return 1 + floor(date.daysSince(date.clone().beginningOfYear()) / 7);
  }

  function getAdjustedUnit(ms) {
    var next, ams = math.abs(ms), value = ams, unit = 0;
    DateUnitsReversed.slice(1).forEach(function(u, i) {
      next = floor(round(ams / u.multiplier() * 10) / 10);
      if(next >= 1) {
        value = next;
        unit = i + 1;
      }
    });
    return [value, unit, ms];
  }

  function getAdjustedUnitWithMonthFallback(date) {
    var adu = getAdjustedUnit(date.millisecondsFromNow());
    if(adu[1] === 6) {
      // If the adjusted unit is in months, then better to use
      // the "monthsfromNow" which applies a special error margin
      // for edge cases such as Jan-09 - Mar-09 being less than
      // 2 months apart (when using a strict numeric definition).
      // The third "ms" element in the array will handle the sign
      // (past or future), so simply take the absolute value here.
      adu[0] = math.abs(date.monthsFromNow());
    }
    return adu;
  }


  // Date formatting helpers

  function formatDate(date, format, relative, localeCode) {
    var adu, loc = getLocalization(localeCode), caps = regexp(/^[A-Z]/), value, shortcut;
    if(!date.isValid()) {
      return 'Invalid Date';
    } else if(Date[format]) {
      format = Date[format];
    } else if(isFunction(format)) {
      adu = getAdjustedUnitWithMonthFallback(date);
      format = format.apply(date, adu.concat(loc));
    }
    if(!format && relative) {
      adu = adu || getAdjustedUnitWithMonthFallback(date);
      // Adjust up if time is in ms, as this doesn't
      // look very good for a standard relative date.
      if(adu[1] === 0) {
        adu[1] = 1;
        adu[0] = 1;
      }
      return loc.getRelativeFormat(adu);
    }

    format = format || 'long';
    format = loc[format] || format;

    DateOutputFormats.forEach(function(dof) {
      format = format.replace(regexp('\\{('+dof.token+')(\\d)?\\}', dof.word ? 'i' : ''), function(m,t,d) {
        var val = dof.format(date, loc, d || 1, t), l = t.length, one = t.match(/^(.)\1+$/);
        if(dof.word) {
          if(l === 3) val = val.slice(0,3);
          if(one || t.match(caps)) val = simpleCapitalize(val);
        } else if(one && !dof.text) {
          val = (isNumber(val) ? padNumber(val, l) : val.toString()).slice(-l);
        }
        return val;
      });
    });
    return format;
  }

  // Date comparison helpers

  function compareDate(d, find, buffer, forceUTC) {
    var p, t, min, max, minOffset, maxOffset, override, capitalized, accuracy = 0, loBuffer = 0, hiBuffer = 0;
    p = getExtendedDate(find, null, null, forceUTC);
    if(buffer > 0) {
      loBuffer = hiBuffer = buffer;
      override = true;
    }
    if(!p.date.isValid()) return false;
    if(p.set && p.set.specificity) {
      DateUnits.forEach(function(u, i) {
        if(u.unit === p.set.specificity) {
          accuracy = u.multiplier(p.date, d - p.date) - 1;
        }
      });
      capitalized = simpleCapitalize(p.set.specificity);
      if(p.set['edge'] || p.set['shift']) {
        p.date['beginningOf' + capitalized]();
      }
      if(p.set.specificity === 'month') {
        max = p.date.clone()['endOf' + capitalized]().getTime();
      }
      if(!override && p.set['sign'] && p.set.specificity != 'millisecond') {
        // If the time is relative, there can occasionally be an disparity between the relative date
        // and "now", which it is being compared to, so set an extra buffer to account for this.
        loBuffer = 50;
        hiBuffer = -50;
      }
    }
    t   = d.getTime();
    min = p.date.getTime();
    max = max || (min + accuracy);
    max = compensateForTimezoneTraversal(d, min, max);
    return t >= (min - loBuffer) && t <= (max + hiBuffer);
  }

  function compensateForTimezoneTraversal(d, min, max) {
    var dMin, dMax, minOffset, maxOffset;
    dMin = new Date(min);
    dMax = new Date(max).utc(d.isUTC());
    if(callDateGet(dMax, 'Hours') !== 23) {
      minOffset = dMin.getTimezoneOffset();
      maxOffset = dMax.getTimezoneOffset();
      if(minOffset !== maxOffset) {
        max += (maxOffset - minOffset).minutes();
      }
    }
    return max;
  }

  function updateDate(d, params, reset, advance, prefer) {
    var weekday, specificityIndex;

    function getParam(key) {
      return isDefined(params[key]) ? params[key] : params[key + 's'];
    }

    function paramExists(key) {
      return isDefined(getParam(key));
    }

    function uniqueParamExists(key, isDay) {
      return paramExists(key) || (isDay && paramExists('weekday'));
    }

    function canDisambiguate() {
      var now = new date;
      return (prefer === -1 && d > now) || (prefer === 1 && d < now);
    }

    if(isNumber(params) && advance) {
      // If param is a number and we're advancing, the number is presumed to be milliseconds.
      params = { 'milliseconds': params };
    } else if(isNumber(params)) {
      // Otherwise just set the timestamp and return.
      d.setTime(params);
      return d;
    }

    // "date" can also be passed for the day
    if(isDefined(params['date'])) {
      params['day'] = params['date'];
    }

    // Reset any unit lower than the least specific unit set. Do not do this for weeks
    // or for years. This needs to be performed before the acutal setting of the date
    // because the order needs to be reversed in order to get the lowest specificity,
    // also because higher order units can be overwritten by lower order units, such
    // as setting hour: 3, minute: 345, etc.
    iterateOverObject(DateUnitsReversed, function(i,u) {
      var isDay = u.unit === 'day';
      if(uniqueParamExists(u.unit, isDay)) {
        params.specificity = u.unit;
        specificityIndex = +i;
        return false;
      } else if(reset && u.unit !== 'week' && (!isDay || !paramExists('week'))) {
        // Days are relative to months, not weeks, so don't reset if a week exists.
        callDateSet(d, u.method, (isDay ? 1 : 0));
      }
    });


    // Now actually set or advance the date in order, higher units first.
    DateUnits.forEach(function(u,i) {
      var unit = u.unit, method = u.method, higherUnit = DateUnits[i - 1], value;
      value = getParam(unit)
      if(isUndefined(value)) return;
      if(advance) {
        if(unit === 'week') {
          value  = (params['day'] || 0) + (value * 7);
          method = 'Date';
        }
        value = (value * advance) + callDateGet(d, method);
      } else if(unit === 'month' && paramExists('day')) {
        // When setting the month, there is a chance that we will traverse into a new month.
        // This happens in DST shifts, for example June 1st DST jumping to January 1st
        // (non-DST) will have a shift of -1:00 which will traverse into the previous year.
        // Prevent this by proactively setting the day when we know it will be set again anyway.
        // It can also happen when there are not enough days in the target month. This second
        // situation is identical to checkMonthTraversal below, however when we are advancing
        // we want to reset the date to "the last date in the target month". In the case of
        // DST shifts, however, we want to avoid the "edges" of months as that is where this
        // unintended traversal can happen. This is the reason for the different handling of
        // two similar but slightly different situations.
        //
        // TL;DR This method avoids the edges of a month IF not advancing and the date is going
        // to be set anyway, while checkMonthTraversal resets the date to the last day if advancing.
        //
        callDateSet(d, 'Date', 15);
      }
      callDateSet(d, method, value);
      if(advance && unit === 'month') {
        checkMonthTraversal(d, value);
      }
    });


    // If a weekday is included in the params, set it ahead of time and set the params
    // to reflect the updated date so that resetting works properly.
    if(!advance && !paramExists('day') && paramExists('weekday')) {
      var weekday = getParam('weekday'), isAhead, futurePreferred;
      d.setWeekday(weekday);
    }

    if(canDisambiguate()) {
      iterateOverObject(DateUnitsReversed.slice(specificityIndex + 1), function(i,u) {
        var ambiguous = u.ambiguous || (u.unit === 'week' && paramExists('weekday'));
        if(ambiguous && !uniqueParamExists(u.unit, u.unit === 'day')) {
          d[u.addMethod](prefer);
          return false;
        }
      });
    }
    return d;
  }

  function callDateGet(d, method) {
    return d['get' + (d._utc ? 'UTC' : '') + method]();
  }

  function callDateSet(d, method, value) {
    return d['set' + (d._utc && method != 'ISOWeek' ? 'UTC' : '') + method](value);
  }

  // The ISO format allows times strung together without a demarcating ":", so make sure
  // that these markers are now optional.
  function prepareTime(format, loc, iso) {
    var timeSuffixMapping = {'h':0,'m':1,'s':2}, add;
    loc = loc || English;
    return format.replace(/{([a-z])}/g, function(full, token) {
      var separators = [],
          isHours = token === 'h',
          tokenIsRequired = isHours && !iso;
      if(token === 't') {
        return loc['ampm'].join('|');
      } else {
        if(isHours) {
          separators.push(':');
        }
        if(add = loc['timeSuffixes'][timeSuffixMapping[token]]) {
          separators.push(add + '\\s*');
        }
        return separators.length === 0 ? '' : '(?:' + separators.join('|') + ')' + (tokenIsRequired ? '' : '?');
      }
    });
  }


  // If the month is being set, then we don't want to accidentally
  // traverse into a new month just because the target month doesn't have enough
  // days. In other words, "5 months ago" from July 30th is still February, even
  // though there is no February 30th, so it will of necessity be February 28th
  // (or 29th in the case of a leap year).

  function checkMonthTraversal(date, targetMonth) {
    if(targetMonth < 0) {
      targetMonth = targetMonth % 12 + 12;
    }
    if(targetMonth % 12 != callDateGet(date, 'Month')) {
      callDateSet(date, 'Date', 0);
    }
  }

  function createDate(args, prefer, forceUTC) {
    var f, localeCode;
    if(isNumber(args[1])) {
      // If the second argument is a number, then we have an enumerated constructor type as in "new Date(2003, 2, 12);"
      f = collectDateArguments(args)[0];
    } else {
      f          = args[0];
      localeCode = args[1];
    }
    return getExtendedDate(f, localeCode, prefer, forceUTC).date;
  }

  function buildDateUnits() {
    DateUnitsReversed = DateUnits.concat().reverse();
    DateArgumentUnits = DateUnits.concat();
    DateArgumentUnits.splice(2,1);
  }


  /***
   * @method [units]Since([d], [locale] = currentLocale)
   * @returns Number
   * @short Returns the time since [d] in the appropriate unit.
   * @extra [d] will accept a date object, timestamp, or text format. If not specified, [d] is assumed to be now. [locale] can be passed to specify the locale that the date is in. %[unit]Ago% is provided as an alias to make this more readable when [d] is assumed to be the current date. For more see @date_format.
   *
   * @set
   *   millisecondsSince
   *   secondsSince
   *   minutesSince
   *   hoursSince
   *   daysSince
   *   weeksSince
   *   monthsSince
   *   yearsSince
   *
   * @example
   *
   *   Date.create().millisecondsSince('1 hour ago') -> 3,600,000
   *   Date.create().daysSince('1 week ago')         -> 7
   *   Date.create().yearsSince('15 years ago')      -> 15
   *   Date.create('15 years ago').yearsAgo()        -> 15
   *
   ***
   * @method [units]Ago()
   * @returns Number
   * @short Returns the time ago in the appropriate unit.
   *
   * @set
   *   millisecondsAgo
   *   secondsAgo
   *   minutesAgo
   *   hoursAgo
   *   daysAgo
   *   weeksAgo
   *   monthsAgo
   *   yearsAgo
   *
   * @example
   *
   *   Date.create('last year').millisecondsAgo() -> 3,600,000
   *   Date.create('last year').daysAgo()         -> 7
   *   Date.create('last year').yearsAgo()        -> 15
   *
   ***
   * @method [units]Until([d], [locale] = currentLocale)
   * @returns Number
   * @short Returns the time until [d] in the appropriate unit.
   * @extra [d] will accept a date object, timestamp, or text format. If not specified, [d] is assumed to be now. [locale] can be passed to specify the locale that the date is in. %[unit]FromNow% is provided as an alias to make this more readable when [d] is assumed to be the current date. For more see @date_format.
   *
   * @set
   *   millisecondsUntil
   *   secondsUntil
   *   minutesUntil
   *   hoursUntil
   *   daysUntil
   *   weeksUntil
   *   monthsUntil
   *   yearsUntil
   *
   * @example
   *
   *   Date.create().millisecondsUntil('1 hour from now') -> 3,600,000
   *   Date.create().daysUntil('1 week from now')         -> 7
   *   Date.create().yearsUntil('15 years from now')      -> 15
   *   Date.create('15 years from now').yearsFromNow()    -> 15
   *
   ***
   * @method [units]FromNow()
   * @returns Number
   * @short Returns the time from now in the appropriate unit.
   *
   * @set
   *   millisecondsFromNow
   *   secondsFromNow
   *   minutesFromNow
   *   hoursFromNow
   *   daysFromNow
   *   weeksFromNow
   *   monthsFromNow
   *   yearsFromNow
   *
   * @example
   *
   *   Date.create('next year').millisecondsFromNow() -> 3,600,000
   *   Date.create('next year').daysFromNow()         -> 7
   *   Date.create('next year').yearsFromNow()        -> 15
   *
   ***
   * @method add[Units](<num>, [reset] = false)
   * @returns Date
   * @short Adds <num> of the unit to the date. If [reset] is true, all lower units will be reset.
   * @extra Note that "months" is ambiguous as a unit of time. If the target date falls on a day that does not exist (ie. August 31 -> February 31), the date will be shifted to the last day of the month. Don't use %addMonths% if you need precision.
   *
   * @set
   *   addMilliseconds
   *   addSeconds
   *   addMinutes
   *   addHours
   *   addDays
   *   addWeeks
   *   addMonths
   *   addYears
   *
   * @example
   *
   *   Date.create().addMilliseconds(5) -> current time + 5 milliseconds
   *   Date.create().addDays(5)         -> current time + 5 days
   *   Date.create().addYears(5)        -> current time + 5 years
   *
   ***
   * @method isLast[Unit]()
   * @returns Boolean
   * @short Returns true if the date is last week/month/year.
   *
   * @set
   *   isLastWeek
   *   isLastMonth
   *   isLastYear
   *
   * @example
   *
   *   Date.create('yesterday').isLastWeek()  -> true or false?
   *   Date.create('yesterday').isLastMonth() -> probably not...
   *   Date.create('yesterday').isLastYear()  -> even less likely...
   *
   ***
   * @method isThis[Unit]()
   * @returns Boolean
   * @short Returns true if the date is this week/month/year.
   *
   * @set
   *   isThisWeek
   *   isThisMonth
   *   isThisYear
   *
   * @example
   *
   *   Date.create('tomorrow').isThisWeek()  -> true or false?
   *   Date.create('tomorrow').isThisMonth() -> probably...
   *   Date.create('tomorrow').isThisYear()  -> signs point to yes...
   *
   ***
   * @method isNext[Unit]()
   * @returns Boolean
   * @short Returns true if the date is next week/month/year.
   *
   * @set
   *   isNextWeek
   *   isNextMonth
   *   isNextYear
   *
   * @example
   *
   *   Date.create('tomorrow').isNextWeek()  -> true or false?
   *   Date.create('tomorrow').isNextMonth() -> probably not...
   *   Date.create('tomorrow').isNextYear()  -> even less likely...
   *
   ***
   * @method beginningOf[Unit]()
   * @returns Date
   * @short Sets the date to the beginning of the appropriate unit.
   *
   * @set
   *   beginningOfDay
   *   beginningOfWeek
   *   beginningOfMonth
   *   beginningOfYear
   *
   * @example
   *
   *   Date.create().beginningOfDay()   -> the beginning of today (resets the time)
   *   Date.create().beginningOfWeek()  -> the beginning of the week
   *   Date.create().beginningOfMonth() -> the beginning of the month
   *   Date.create().beginningOfYear()  -> the beginning of the year
   *
   ***
   * @method endOf[Unit]()
   * @returns Date
   * @short Sets the date to the end of the appropriate unit.
   *
   * @set
   *   endOfDay
   *   endOfWeek
   *   endOfMonth
   *   endOfYear
   *
   * @example
   *
   *   Date.create().endOfDay()   -> the end of today (sets the time to 23:59:59.999)
   *   Date.create().endOfWeek()  -> the end of the week
   *   Date.create().endOfMonth() -> the end of the month
   *   Date.create().endOfYear()  -> the end of the year
   *
   ***/

  function buildDateMethods() {
    extendSimilar(date, true, false, DateUnits, function(methods, u, i) {
      var unit = u.unit, caps = simpleCapitalize(unit), multiplier = u.multiplier(), since, until;
      u.addMethod = 'add' + caps + 's';
      // "since/until now" only count "past" an integer, i.e. "2 days ago" is
      // anything between 2 - 2.999 days. The default margin of error is 0.999,
      // but "months" have an inherently larger margin, as the number of days
      // in a given month may be significantly less than the number of days in
      // the average month, so for example "30 days" before March 15 may in fact
      // be 1 month ago. Years also have a margin of error due to leap years,
      // but this is roughly 0.999 anyway (365 / 365.25). Other units do not
      // technically need the error margin applied to them but this accounts
      // for discrepancies like (15).hoursAgo() which technically creates the
      // current date first, then creates a date 15 hours before and compares
      // them, the discrepancy between the creation of the 2 dates means that
      // they may actually be 15.0001 hours apart. Milliseconds don't have
      // fractions, so they won't be subject to this error margin.
      function applyErrorMargin(ms) {
        var num      = ms / multiplier,
            fraction = num % 1,
            error    = u.error || 0.999;
        if(fraction && math.abs(fraction % 1) > error) {
          num = round(num);
        }
        return parseInt(num);
      }
      since = function(f, localeCode) {
        return applyErrorMargin(this.getTime() - date.create(f, localeCode).getTime());
      };
      until = function(f, localeCode) {
        return applyErrorMargin(date.create(f, localeCode).getTime() - this.getTime());
      };
      methods[unit+'sAgo']     = until;
      methods[unit+'sUntil']   = until;
      methods[unit+'sSince']   = since;
      methods[unit+'sFromNow'] = since;
      methods[u.addMethod] = function(num, reset) {
        var set = {};
        set[unit] = num;
        return this.advance(set, reset);
      };
      buildNumberToDateAlias(u, multiplier);
      if(i < 3) {
        ['Last','This','Next'].forEach(function(shift) {
          methods['is' + shift + caps] = function() {
            return this.is(shift + ' ' + unit);
          };
        });
      }
      if(i < 4) {
        methods['beginningOf' + caps] = function() {
          var set = {};
          switch(unit) {
            case 'year':  set['year']    = callDateGet(this, 'FullYear'); break;
            case 'month': set['month']   = callDateGet(this, 'Month');    break;
            case 'day':   set['day']     = callDateGet(this, 'Date');     break;
            case 'week':  set['weekday'] = 0; break;
          }
          return this.set(set, true);
        };
        methods['endOf' + caps] = function() {
          var set = { 'hours': 23, 'minutes': 59, 'seconds': 59, 'milliseconds': 999 };
          switch(unit) {
            case 'year':  set['month']   = 11; set['day'] = 31; break;
            case 'month': set['day']     = this.daysInMonth();  break;
            case 'week':  set['weekday'] = 6;                   break;
          }
          return this.set(set, true);
        };
      }
    });
  }

  function buildCoreInputFormats() {
    English.addFormat('([+-])?(\\d{4,4})[-.]?{full_month}[-.]?(\\d{1,2})?', true, ['year_sign','year','month','date'], false, true);
    English.addFormat('(\\d{1,2})[-.\\/]{full_month}(?:[-.\\/](\\d{2,4}))?', true, ['date','month','year'], true);
    English.addFormat('{full_month}[-.](\\d{4,4})', false, ['month','year']);
    English.addFormat('\\/Date\\((\\d+(?:\\+\\d{4,4})?)\\)\\/', false, ['timestamp'])
    English.addFormat(prepareTime(RequiredTime, English), false, TimeFormat)

    // When a new locale is initialized it will have the CoreDateFormats initialized by default.
    // From there, adding new formats will push them in front of the previous ones, so the core
    // formats will be the last to be reached. However, the core formats themselves have English
    // months in them, which means that English needs to first be initialized and creates a race
    // condition. I'm getting around this here by adding these generalized formats in the order
    // specific -> general, which will mean they will be added to the English localization in
    // general -> specific order, then chopping them off the front and reversing to get the correct
    // order. Note that there are 7 formats as 2 have times which adds a front and a back format.
    CoreDateFormats = English.compiledFormats.slice(0,7).reverse();
    English.compiledFormats = English.compiledFormats.slice(7).concat(CoreDateFormats);
  }

  function buildDateOutputShortcuts() {
    extendSimilar(date, true, false, 'short,long,full', function(methods, name) {
      methods[name] = function(localeCode) {
        return formatDate(this, name, false, localeCode);
      }
    });
  }

  function buildAsianDigits() {
    KanjiDigits.split('').forEach(function(digit, value) {
      var holder;
      if(value > 9) {
        value = math.pow(10, value - 9);
      }
      AsianDigitMap[digit] = value;
    });
    FullWidthDigits.split('').forEach(function(digit, value) {
      AsianDigitMap[digit] = value;
    });
    // Kanji numerals may also be included in phrases which are text-based rather
    // than actual numbers such as Chinese weekdays (上周三), and "the day before
    // yesterday" (一昨日) in Japanese, so don't match these.
    AsianDigitReg = regexp('([期週周])?([' + KanjiDigits + FullWidthDigits + ']+)(?!昨)', 'g');
  }

   /***
   * @method is[Day]()
   * @returns Boolean
   * @short Returns true if the date falls on that day.
   * @extra Also available: %isYesterday%, %isToday%, %isTomorrow%, %isWeekday%, and %isWeekend%.
   *
   * @set
   *   isToday
   *   isYesterday
   *   isTomorrow
   *   isWeekday
   *   isWeekend
   *   isSunday
   *   isMonday
   *   isTuesday
   *   isWednesday
   *   isThursday
   *   isFriday
   *   isSaturday
   *
   * @example
   *
   *   Date.create('tomorrow').isToday() -> false
   *   Date.create('thursday').isTomorrow() -> ?
   *   Date.create('yesterday').isWednesday() -> ?
   *   Date.create('today').isWeekend() -> ?
   *
   ***
   * @method isFuture()
   * @returns Boolean
   * @short Returns true if the date is in the future.
   * @example
   *
   *   Date.create('next week').isFuture() -> true
   *   Date.create('last week').isFuture() -> false
   *
   ***
   * @method isPast()
   * @returns Boolean
   * @short Returns true if the date is in the past.
   * @example
   *
   *   Date.create('last week').isPast() -> true
   *   Date.create('next week').isPast() -> false
   *
   ***/
  function buildRelativeAliases() {
    var special  = 'today,yesterday,tomorrow,weekday,weekend,future,past'.split(',');
    var weekdays = English['weekdays'].slice(0,7);
    var months   = English['months'].slice(0,12);
    extendSimilar(date, true, false, special.concat(weekdays).concat(months), function(methods, name) {
      methods['is'+ simpleCapitalize(name)] = function(utc) {
       return this.is(name, 0, utc);
      };
    });
  }

  function buildUTCAliases() {
    date.extend({
      'utc': {

        'create': function() {
          return createDate(arguments, 0, true);
        },

        'past': function() {
          return createDate(arguments, -1, true);
        },

        'future': function() {
          return createDate(arguments, 1, true);
        }

      }
    }, false, false);
  }

  function setDateProperties() {
    date.extend({
      'RFC1123': '{Dow}, {dd} {Mon} {yyyy} {HH}:{mm}:{ss} {tz}',
      'RFC1036': '{Weekday}, {dd}-{Mon}-{yy} {HH}:{mm}:{ss} {tz}',
      'ISO8601_DATE': '{yyyy}-{MM}-{dd}',
      'ISO8601_DATETIME': '{yyyy}-{MM}-{dd}T{HH}:{mm}:{ss}.{fff}{isotz}'
    }, false, false);
  }


  date.extend({

     /***
     * @method Date.create(<d>, [locale] = currentLocale)
     * @returns Date
     * @short Alternate Date constructor which understands many different text formats, a timestamp, or another date.
     * @extra If no argument is given, date is assumed to be now. %Date.create% additionally can accept enumerated parameters as with the standard date constructor. [locale] can be passed to specify the locale that the date is in. When unspecified, the current locale (default is English) is assumed. UTC-based dates can be created through the %utc% object. For more see @date_format.
     * @set
     *   Date.utc.create
     *
     * @example
     *
     *   Date.create('July')          -> July of this year
     *   Date.create('1776')          -> 1776
     *   Date.create('today')         -> today
     *   Date.create('wednesday')     -> This wednesday
     *   Date.create('next friday')   -> Next friday
     *   Date.create('July 4, 1776')  -> July 4, 1776
     *   Date.create(-446806800000)   -> November 5, 1955
     *   Date.create(1776, 6, 4)      -> July 4, 1776
     *   Date.create('1776年07月04日', 'ja') -> July 4, 1776
     *   Date.utc.create('July 4, 1776', 'en')  -> July 4, 1776
     *
     ***/
    'create': function() {
      return createDate(arguments);
    },

     /***
     * @method Date.past(<d>, [locale] = currentLocale)
     * @returns Date
     * @short Alternate form of %Date.create% with any ambiguity assumed to be the past.
     * @extra For example %"Sunday"% can be either "the Sunday coming up" or "the Sunday last" depending on context. Note that dates explicitly in the future ("next Sunday") will remain in the future. This method simply provides a hint when ambiguity exists. UTC-based dates can be created through the %utc% object. For more, see @date_format.
     * @set
     *   Date.utc.past
     * @example
     *
     *   Date.past('July')          -> July of this year or last depending on the current month
     *   Date.past('Wednesday')     -> This wednesday or last depending on the current weekday
     *
     ***/
    'past': function() {
      return createDate(arguments, -1);
    },

     /***
     * @method Date.future(<d>, [locale] = currentLocale)
     * @returns Date
     * @short Alternate form of %Date.create% with any ambiguity assumed to be the future.
     * @extra For example %"Sunday"% can be either "the Sunday coming up" or "the Sunday last" depending on context. Note that dates explicitly in the past ("last Sunday") will remain in the past. This method simply provides a hint when ambiguity exists. UTC-based dates can be created through the %utc% object. For more, see @date_format.
     * @set
     *   Date.utc.future
     *
     * @example
     *
     *   Date.future('July')          -> July of this year or next depending on the current month
     *   Date.future('Wednesday')     -> This wednesday or next depending on the current weekday
     *
     ***/
    'future': function() {
      return createDate(arguments, 1);
    },

     /***
     * @method Date.addLocale(<code>, <set>)
     * @returns Locale
     * @short Adds a locale <set> to the locales understood by Sugar.
     * @extra For more see @date_format.
     *
     ***/
    'addLocale': function(localeCode, set) {
      return setLocalization(localeCode, set);
    },

     /***
     * @method Date.setLocale(<code>)
     * @returns Locale
     * @short Sets the current locale to be used with dates.
     * @extra Sugar has support for 13 locales that are available through the "Date Locales" package. In addition you can define a new locale with %Date.addLocale%. For more see @date_format.
     *
     ***/
    'setLocale': function(localeCode, set) {
      var loc = getLocalization(localeCode, false);
      CurrentLocalization = loc;
      // The code is allowed to be more specific than the codes which are required:
      // i.e. zh-CN or en-US. Currently this only affects US date variants such as 8/10/2000.
      if(localeCode && localeCode != loc['code']) {
        loc['code'] = localeCode;
      }
      return loc;
    },

     /***
     * @method Date.getLocale([code] = current)
     * @returns Locale
     * @short Gets the locale for the given code, or the current locale.
     * @extra The resulting locale object can be manipulated to provide more control over date localizations. For more about locales, see @date_format.
     *
     ***/
    'getLocale': function(localeCode) {
      return !localeCode ? CurrentLocalization : getLocalization(localeCode, false);
    },

     /**
     * @method Date.addFormat(<format>, <match>, [code] = null)
     * @returns Nothing
     * @short Manually adds a new date input format.
     * @extra This method allows fine grained control for alternate formats. <format> is a string that can have regex tokens inside. <match> is an array of the tokens that each regex capturing group will map to, for example %year%, %date%, etc. For more, see @date_format.
     *
     **/
    'addFormat': function(format, match, localeCode) {
      addDateInputFormat(getLocalization(localeCode), format, match);
    }

  }, false, false);

  date.extend({

     /***
     * @method set(<set>, [reset] = false)
     * @returns Date
     * @short Sets the date object.
     * @extra This method can accept multiple formats including a single number as a timestamp, an object, or enumerated parameters (as with the Date constructor). If [reset] is %true%, any units more specific than those passed will be reset.
     *
     * @example
     *
     *   new Date().set({ year: 2011, month: 11, day: 31 }) -> December 31, 2011
     *   new Date().set(2011, 11, 31)                       -> December 31, 2011
     *   new Date().set(86400000)                           -> 1 day after Jan 1, 1970
     *   new Date().set({ year: 2004, month: 6 }, true)     -> June 1, 2004, 00:00:00.000
     *
     ***/
    'set': function() {
      var args = collectDateArguments(arguments);
      return updateDate(this, args[0], args[1])
    },

     /***
     * @method setWeekday()
     * @returns Nothing
     * @short Sets the weekday of the date.
     * @extra In order to maintain a parallel with %getWeekday% (which itself is an alias for Javascript native %getDay%), Sunday is considered day %0%. This contrasts with ISO-8601 standard (used in %getISOWeek% and %setISOWeek%) which places Sunday at the end of the week (day 7). This effectively means that passing %0% to this method while in the middle of a week will rewind the date, where passing %7% will advance it.
     *
     * @example
     *
     *   d = new Date(); d.setWeekday(1); d; -> Monday of this week
     *   d = new Date(); d.setWeekday(6); d; -> Saturday of this week
     *
     ***/
    'setWeekday': function(dow) {
      if(isUndefined(dow)) return;
      return callDateSet(this, 'Date', callDateGet(this, 'Date') + dow - callDateGet(this, 'Day'));
    },

     /***
     * @method setISOWeek()
     * @returns Nothing
     * @short Sets the week (of the year) as defined by the ISO-8601 standard.
     * @extra Note that this standard places Sunday at the end of the week (day 7).
     *
     * @example
     *
     *   d = new Date(); d.setISOWeek(15); d; -> 15th week of the year
     *
     ***/
    'setISOWeek': function(week) {
      var weekday = callDateGet(this, 'Day') || 7;
      if(isUndefined(week)) return;
      this.set({ 'month': 0, 'date': 4 });
      this.set({ 'weekday': 1 });
      if(week > 1) {
        this.addWeeks(week - 1);
      }
      if(weekday !== 1) {
        this.advance({ 'days': weekday - 1 });
      }
      return this.getTime();
    },

     /***
     * @method getISOWeek()
     * @returns Number
     * @short Gets the date's week (of the year) as defined by the ISO-8601 standard.
     * @extra Note that this standard places Sunday at the end of the week (day 7). If %utc% is set on the date, the week will be according to UTC time.
     *
     * @example
     *
     *   new Date().getISOWeek()    -> today's week of the year
     *
     ***/
    'getISOWeek': function() {
      return getWeekNumber(this);
    },

     /***
     * @method getUTCOffset([iso])
     * @returns String
     * @short Returns a string representation of the offset from UTC time. If [iso] is true the offset will be in ISO8601 format.
     * @example
     *
     *   new Date().getUTCOffset()     -> "+0900"
     *   new Date().getUTCOffset(true) -> "+09:00"
     *
     ***/
    'getUTCOffset': function(iso) {
      var offset = this._utc ? 0 : this.getTimezoneOffset();
      var colon  = iso === true ? ':' : '';
      if(!offset && iso) return 'Z';
      return padNumber(floor(-offset / 60), 2, true) + colon + padNumber(math.abs(offset % 60), 2);
    },

     /***
     * @method utc([on] = true)
     * @returns Date
     * @short Sets the internal utc flag for the date. When on, UTC-based methods will be called internally.
     * @extra For more see @date_format.
     * @example
     *
     *   new Date().utc(true)
     *   new Date().utc(false)
     *
     ***/
    'utc': function(set) {
      defineProperty(this, '_utc', set === true || arguments.length === 0);
      return this;
    },

     /***
     * @method isUTC()
     * @returns Boolean
     * @short Returns true if the date has no timezone offset.
     * @extra This will also return true for utc-based dates (dates that have the %utc% method set true). Note that even if the utc flag is set, %getTimezoneOffset% will always report the same thing as Javascript always reports that based on the environment's locale.
     * @example
     *
     *   new Date().isUTC()           -> true or false?
     *   new Date().utc(true).isUTC() -> true
     *
     ***/
    'isUTC': function() {
      return !!this._utc || this.getTimezoneOffset() === 0;
    },

     /***
     * @method advance(<set>, [reset] = false)
     * @returns Date
     * @short Sets the date forward.
     * @extra This method can accept multiple formats including an object, a string in the format %3 days%, a single number as milliseconds, or enumerated parameters (as with the Date constructor). If [reset] is %true%, any units more specific than those passed will be reset. For more see @date_format.
     * @example
     *
     *   new Date().advance({ year: 2 }) -> 2 years in the future
     *   new Date().advance('2 days')    -> 2 days in the future
     *   new Date().advance(0, 2, 3)     -> 2 months 3 days in the future
     *   new Date().advance(86400000)    -> 1 day in the future
     *
     ***/
    'advance': function() {
      var args = collectDateArguments(arguments, true);
      return updateDate(this, args[0], args[1], 1);
    },

     /***
     * @method rewind(<set>, [reset] = false)
     * @returns Date
     * @short Sets the date back.
     * @extra This method can accept multiple formats including a single number as a timestamp, an object, or enumerated parameters (as with the Date constructor). If [reset] is %true%, any units more specific than those passed will be reset. For more see @date_format.
     * @example
     *
     *   new Date().rewind({ year: 2 }) -> 2 years in the past
     *   new Date().rewind(0, 2, 3)     -> 2 months 3 days in the past
     *   new Date().rewind(86400000)    -> 1 day in the past
     *
     ***/
    'rewind': function() {
      var args = collectDateArguments(arguments, true);
      return updateDate(this, args[0], args[1], -1);
    },

     /***
     * @method isValid()
     * @returns Boolean
     * @short Returns true if the date is valid.
     * @example
     *
     *   new Date().isValid()         -> true
     *   new Date('flexor').isValid() -> false
     *
     ***/
    'isValid': function() {
      return !isNaN(this.getTime());
    },

     /***
     * @method isAfter(<d>, [margin] = 0)
     * @returns Boolean
     * @short Returns true if the date is after the <d>.
     * @extra [margin] is to allow extra margin of error (in ms). <d> will accept a date object, timestamp, or text format. If not specified, <d> is assumed to be now. See @date_format for more.
     * @example
     *
     *   new Date().isAfter('tomorrow')  -> false
     *   new Date().isAfter('yesterday') -> true
     *
     ***/
    'isAfter': function(d, margin, utc) {
      return this.getTime() > date.create(d).getTime() - (margin || 0);
    },

     /***
     * @method isBefore(<d>, [margin] = 0)
     * @returns Boolean
     * @short Returns true if the date is before <d>.
     * @extra [margin] is to allow extra margin of error (in ms). <d> will accept a date object, timestamp, or text format. If not specified, <d> is assumed to be now. See @date_format for more.
     * @example
     *
     *   new Date().isBefore('tomorrow')  -> true
     *   new Date().isBefore('yesterday') -> false
     *
     ***/
    'isBefore': function(d, margin) {
      return this.getTime() < date.create(d).getTime() + (margin || 0);
    },

     /***
     * @method isBetween(<d1>, <d2>, [margin] = 0)
     * @returns Boolean
     * @short Returns true if the date falls between <d1> and <d2>.
     * @extra [margin] is to allow extra margin of error (in ms). <d1> and <d2> will accept a date object, timestamp, or text format. If not specified, they are assumed to be now. See @date_format for more.
     * @example
     *
     *   new Date().isBetween('yesterday', 'tomorrow')    -> true
     *   new Date().isBetween('last year', '2 years ago') -> false
     *
     ***/
    'isBetween': function(d1, d2, margin) {
      var t  = this.getTime();
      var t1 = date.create(d1).getTime();
      var t2 = date.create(d2).getTime();
      var lo = math.min(t1, t2);
      var hi = math.max(t1, t2);
      margin = margin || 0;
      return (lo - margin < t) && (hi + margin > t);
    },

     /***
     * @method isLeapYear()
     * @returns Boolean
     * @short Returns true if the date is a leap year.
     * @example
     *
     *   Date.create('2000').isLeapYear() -> true
     *
     ***/
    'isLeapYear': function() {
      var year = callDateGet(this, 'FullYear');
      return (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
    },

     /***
     * @method daysInMonth()
     * @returns Number
     * @short Returns the number of days in the date's month.
     * @example
     *
     *   Date.create('May').daysInMonth()            -> 31
     *   Date.create('February, 2000').daysInMonth() -> 29
     *
     ***/
    'daysInMonth': function() {
      return 32 - callDateGet(new date(callDateGet(this, 'FullYear'), callDateGet(this, 'Month'), 32), 'Date');
    },

     /***
     * @method format(<format>, [locale] = currentLocale)
     * @returns String
     * @short Formats and outputs the date.
     * @extra <format> can be a number of pre-determined formats or a string of tokens. Locale-specific formats are %short%, %long%, and %full% which have their own aliases and can be called with %date.short()%, etc. If <format> is not specified the %long% format is assumed. [locale] specifies a locale code to use (if not specified the current locale is used). See @date_format for more details.
     *
     * @set
     *   short
     *   long
     *   full
     *
     * @example
     *
     *   Date.create().format()                                   -> ex. July 4, 2003
     *   Date.create().format('{Weekday} {d} {Month}, {yyyy}')    -> ex. Monday July 4, 2003
     *   Date.create().format('{hh}:{mm}')                        -> ex. 15:57
     *   Date.create().format('{12hr}:{mm}{tt}')                  -> ex. 3:57pm
     *   Date.create().format(Date.ISO8601_DATETIME)              -> ex. 2011-07-05 12:24:55.528Z
     *   Date.create('last week').format('short', 'ja')                -> ex. 先週
     *   Date.create('yesterday').format(function(value,unit,ms,loc) {
     *     // value = 1, unit = 3, ms = -86400000, loc = [current locale object]
     *   });                                                      -> ex. 1 day ago
     *
     ***/
    'format': function(f, localeCode) {
      return formatDate(this, f, false, localeCode);
    },

     /***
     * @method relative([fn], [locale] = currentLocale)
     * @returns String
     * @short Returns a relative date string offset to the current time.
     * @extra [fn] can be passed to provide for more granular control over the resulting string. [fn] is passed 4 arguments: the adjusted value, unit, offset in milliseconds, and a localization object. As an alternate syntax, [locale] can also be passed as the first (and only) parameter. For more, see @date_format.
     * @example
     *
     *   Date.create('90 seconds ago').relative() -> 1 minute ago
     *   Date.create('January').relative()        -> ex. 5 months ago
     *   Date.create('January').relative('ja')    -> 3ヶ月前
     *   Date.create('120 minutes ago').relative(function(val,unit,ms,loc) {
     *     // value = 2, unit = 3, ms = -7200, loc = [current locale object]
     *   });                                      -> ex. 5 months ago
     *
     ***/
    'relative': function(f, localeCode) {
      if(isString(f)) {
        localeCode = f;
        f = null;
      }
      return formatDate(this, f, true, localeCode);
    },

     /***
     * @method is(<d>, [margin] = 0)
     * @returns Boolean
     * @short Returns true if the date is <d>.
     * @extra <d> will accept a date object, timestamp, or text format. %is% additionally understands more generalized expressions like month/weekday names, 'today', etc, and compares to the precision implied in <d>. [margin] allows an extra margin of error in milliseconds.  For more, see @date_format.
     * @example
     *
     *   Date.create().is('July')               -> true or false?
     *   Date.create().is('1776')               -> false
     *   Date.create().is('today')              -> true
     *   Date.create().is('weekday')            -> true or false?
     *   Date.create().is('July 4, 1776')       -> false
     *   Date.create().is(-6106093200000)       -> false
     *   Date.create().is(new Date(1776, 6, 4)) -> false
     *
     ***/
    'is': function(d, margin, utc) {
      var tmp, comp;
      if(!this.isValid()) return;
      if(isString(d)) {
        d = d.trim().toLowerCase();
        comp = this.clone().utc(utc);
        switch(true) {
          case d === 'future':  return this.getTime() > new date().getTime();
          case d === 'past':    return this.getTime() < new date().getTime();
          case d === 'weekday': return callDateGet(comp, 'Day') > 0 && callDateGet(comp, 'Day') < 6;
          case d === 'weekend': return callDateGet(comp, 'Day') === 0 || callDateGet(comp, 'Day') === 6;
          case (tmp = English['weekdays'].indexOf(d) % 7) > -1: return callDateGet(comp, 'Day') === tmp;
          case (tmp = English['months'].indexOf(d) % 12) > -1:  return callDateGet(comp, 'Month') === tmp;
        }
      }
      return compareDate(this, d, margin, utc);
    },

     /***
     * @method reset([unit] = 'hours')
     * @returns Date
     * @short Resets the unit passed and all smaller units. Default is "hours", effectively resetting the time.
     * @example
     *
     *   Date.create().reset('day')   -> Beginning of today
     *   Date.create().reset('month') -> 1st of the month
     *
     ***/
    'reset': function(unit) {
      var params = {}, recognized;
      unit = unit || 'hours';
      if(unit === 'date') unit = 'days';
      recognized = DateUnits.some(function(u) {
        return unit === u.unit || unit === u.unit + 's';
      });
      params[unit] = unit.match(/^days?/) ? 1 : 0;
      return recognized ? this.set(params, true) : this;
    },

     /***
     * @method clone()
     * @returns Date
     * @short Clones the date.
     * @example
     *
     *   Date.create().clone() -> Copy of now
     *
     ***/
    'clone': function() {
      var d = new date(this.getTime());
      d.utc(!!this._utc);
      return d;
    }

  });


  // Instance aliases
  date.extend({

     /***
     * @method iso()
     * @alias toISOString
     *
     ***/
    'iso': function() {
      return this.toISOString();
    },

     /***
     * @method getWeekday()
     * @returns Number
     * @short Alias for %getDay%.
     * @set
     *   getUTCWeekday
     *
     * @example
     *
     +   Date.create().getWeekday();    -> (ex.) 3
     +   Date.create().getUTCWeekday();    -> (ex.) 3
     *
     ***/
    'getWeekday':    date.prototype.getDay,
    'getUTCWeekday':    date.prototype.getUTCDay

  });



  /***
   * Number module
   *
   ***/

  /***
   * @method [unit]()
   * @returns Number
   * @short Takes the number as a corresponding unit of time and converts to milliseconds.
   * @extra Method names can be both singular and plural.  Note that as "a month" is ambiguous as a unit of time, %months% will be equivalent to 30.4375 days, the average number in a month. Be careful using %months% if you need exact precision.
   *
   * @set
   *   millisecond
   *   milliseconds
   *   second
   *   seconds
   *   minute
   *   minutes
   *   hour
   *   hours
   *   day
   *   days
   *   week
   *   weeks
   *   month
   *   months
   *   year
   *   years
   *
   * @example
   *
   *   (5).milliseconds() -> 5
   *   (10).hours()       -> 36000000
   *   (1).day()          -> 86400000
   *
   ***
   * @method [unit]Before([d], [locale] = currentLocale)
   * @returns Date
   * @short Returns a date that is <n> units before [d], where <n> is the number.
   * @extra [d] will accept a date object, timestamp, or text format. Note that "months" is ambiguous as a unit of time. If the target date falls on a day that does not exist (ie. August 31 -> February 31), the date will be shifted to the last day of the month. Be careful using %monthsBefore% if you need exact precision. See @date_format for more.
   *
   * @set
   *   millisecondBefore
   *   millisecondsBefore
   *   secondBefore
   *   secondsBefore
   *   minuteBefore
   *   minutesBefore
   *   hourBefore
   *   hoursBefore
   *   dayBefore
   *   daysBefore
   *   weekBefore
   *   weeksBefore
   *   monthBefore
   *   monthsBefore
   *   yearBefore
   *   yearsBefore
   *
   * @example
   *
   *   (5).daysBefore('tuesday')          -> 5 days before tuesday of this week
   *   (1).yearBefore('January 23, 1997') -> January 23, 1996
   *
   ***
   * @method [unit]Ago()
   * @returns Date
   * @short Returns a date that is <n> units ago.
   * @extra Note that "months" is ambiguous as a unit of time. If the target date falls on a day that does not exist (ie. August 31 -> February 31), the date will be shifted to the last day of the month. Be careful using %monthsAgo% if you need exact precision.
   *
   * @set
   *   millisecondAgo
   *   millisecondsAgo
   *   secondAgo
   *   secondsAgo
   *   minuteAgo
   *   minutesAgo
   *   hourAgo
   *   hoursAgo
   *   dayAgo
   *   daysAgo
   *   weekAgo
   *   weeksAgo
   *   monthAgo
   *   monthsAgo
   *   yearAgo
   *   yearsAgo
   *
   * @example
   *
   *   (5).weeksAgo() -> 5 weeks ago
   *   (1).yearAgo()  -> January 23, 1996
   *
   ***
   * @method [unit]After([d], [locale] = currentLocale)
   * @returns Date
   * @short Returns a date <n> units after [d], where <n> is the number.
   * @extra [d] will accept a date object, timestamp, or text format. Note that "months" is ambiguous as a unit of time. If the target date falls on a day that does not exist (ie. August 31 -> February 31), the date will be shifted to the last day of the month. Be careful using %monthsAfter% if you need exact precision. See @date_format for more.
   *
   * @set
   *   millisecondAfter
   *   millisecondsAfter
   *   secondAfter
   *   secondsAfter
   *   minuteAfter
   *   minutesAfter
   *   hourAfter
   *   hoursAfter
   *   dayAfter
   *   daysAfter
   *   weekAfter
   *   weeksAfter
   *   monthAfter
   *   monthsAfter
   *   yearAfter
   *   yearsAfter
   *
   * @example
   *
   *   (5).daysAfter('tuesday')          -> 5 days after tuesday of this week
   *   (1).yearAfter('January 23, 1997') -> January 23, 1998
   *
   ***
   * @method [unit]FromNow()
   * @returns Date
   * @short Returns a date <n> units from now.
   * @extra Note that "months" is ambiguous as a unit of time. If the target date falls on a day that does not exist (ie. August 31 -> February 31), the date will be shifted to the last day of the month. Be careful using %monthsFromNow% if you need exact precision.
   *
   * @set
   *   millisecondFromNow
   *   millisecondsFromNow
   *   secondFromNow
   *   secondsFromNow
   *   minuteFromNow
   *   minutesFromNow
   *   hourFromNow
   *   hoursFromNow
   *   dayFromNow
   *   daysFromNow
   *   weekFromNow
   *   weeksFromNow
   *   monthFromNow
   *   monthsFromNow
   *   yearFromNow
   *   yearsFromNow
   *
   * @example
   *
   *   (5).weeksFromNow() -> 5 weeks ago
   *   (1).yearFromNow()  -> January 23, 1998
   *
   ***/
  function buildNumberToDateAlias(u, multiplier) {
    var unit = u.unit, methods = {};
    function base() { return round(this * multiplier); }
    function after() { return createDate(arguments)[u.addMethod](this);  }
    function before() { return createDate(arguments)[u.addMethod](-this); }
    methods[unit] = base;
    methods[unit + 's'] = base;
    methods[unit + 'Before'] = before;
    methods[unit + 'sBefore'] = before;
    methods[unit + 'Ago'] = before;
    methods[unit + 'sAgo'] = before;
    methods[unit + 'After'] = after;
    methods[unit + 'sAfter'] = after;
    methods[unit + 'FromNow'] = after;
    methods[unit + 'sFromNow'] = after;
    number.extend(methods);
  }

  number.extend({

     /***
     * @method duration([locale] = currentLocale)
     * @returns String
     * @short Takes the number as milliseconds and returns a unit-adjusted localized string.
     * @extra This method is the same as %Date#relative% without the localized equivalent of "from now" or "ago". [locale] can be passed as the first (and only) parameter. Note that this method is only available when the dates package is included.
     * @example
     *
     *   (500).duration() -> '500 milliseconds'
     *   (1200).duration() -> '1 second'
     *   (75).minutes().duration() -> '1 hour'
     *   (75).minutes().duration('es') -> '1 hora'
     *
     ***/
    'duration': function(localeCode) {
      return getLocalization(localeCode).getDuration(this);
    }

  });


  English = CurrentLocalization = date.addLocale('en', {
    'plural':     true,
    'timeMarker': 'at',
    'ampm':       'am,pm',
    'months':     'January,February,March,April,May,June,July,August,September,October,November,December',
    'weekdays':   'Sunday,Monday,Tuesday,Wednesday,Thursday,Friday,Saturday',
    'units':      'millisecond:|s,second:|s,minute:|s,hour:|s,day:|s,week:|s,month:|s,year:|s',
    'numbers':    'one,two,three,four,five,six,seven,eight,nine,ten',
    'articles':   'a,an,the',
    'tokens':     'the,st|nd|rd|th,of',
    'short':      '{Month} {d}, {yyyy}',
    'long':       '{Month} {d}, {yyyy} {h}:{mm}{tt}',
    'full':       '{Weekday} {Month} {d}, {yyyy} {h}:{mm}:{ss}{tt}',
    'past':       '{num} {unit} {sign}',
    'future':     '{num} {unit} {sign}',
    'duration':   '{num} {unit}',
    'modifiers': [
      { 'name': 'sign',  'src': 'ago|before', 'value': -1 },
      { 'name': 'sign',  'src': 'from now|after|from|in|later', 'value': 1 },
      { 'name': 'edge',  'src': 'last day', 'value': -2 },
      { 'name': 'edge',  'src': 'end', 'value': -1 },
      { 'name': 'edge',  'src': 'first day|beginning', 'value': 1 },
      { 'name': 'shift', 'src': 'last', 'value': -1 },
      { 'name': 'shift', 'src': 'the|this', 'value': 0 },
      { 'name': 'shift', 'src': 'next', 'value': 1 }
    ],
    'dateParse': [
      '{num} {unit} {sign}',
      '{sign} {num} {unit}',
      '{month} {year}',
      '{shift} {unit=5-7}',
      '{0?} {date}{1}',
      '{0?} {edge} of {shift?} {unit=4-7?}{month?}{year?}'
    ],
    'timeParse': [
      '{0} {num}{1} {day} of {month} {year?}',
      '{weekday?} {month} {date}{1?} {year?}',
      '{date} {month} {year}',
      '{date} {month}',
      '{shift} {weekday}',
      '{shift} week {weekday}',
      '{weekday} {2?} {shift} week',
      '{num} {unit=4-5} {sign} {day}',
      '{0?} {date}{1} of {month}',
      '{0?}{month?} {date?}{1?} of {shift} {unit=6-7}'
    ]
  });

  buildDateUnits();
  buildDateMethods();
  buildCoreInputFormats();
  buildDateOutputShortcuts();
  buildAsianDigits();
  buildRelativeAliases();
  buildUTCAliases();
  setDateProperties();


  /***
   * @package DateRange
   * @dependency date
   * @description Date Ranges define a range of time. They can enumerate over specific points within that range, and be manipulated and compared.
   *
   ***/

  var DateRange = function(start, end) {
    this.start = date.create(start);
    this.end   = date.create(end);
  };

  // 'toString' doesn't appear in a for..in loop in IE even though
  // hasOwnProperty reports true, so extend() can't be used here.
  // Also tried simply setting the prototype = {} up front for all
  // methods but GCC very oddly started dropping properties in the
  // object randomly (maybe because of the global scope?) hence
  // the need for the split logic here.
  DateRange.prototype.toString = function() {
    /***
     * @method toString()
     * @returns String
     * @short Returns a string representation of the DateRange.
     * @example
     *
     *   Date.range('2003', '2005').toString() -> January 1, 2003..January 1, 2005
     *
     ***/
    return this.isValid() ? this.start.full() + '..' + this.end.full() : 'Invalid DateRange';
  };

  extend(DateRange, true, false, {

    /***
     * @method isValid()
     * @returns Boolean
     * @short Returns true if the DateRange is valid, false otherwise.
     * @example
     *
     *   Date.range('2003', '2005').isValid() -> true
     *   Date.range('2005', '2003').isValid() -> false
     *
     ***/
    'isValid': function() {
      return this.start < this.end;
    },

    /***
     * @method duration()
     * @returns Number
     * @short Return the duration of the DateRange in milliseconds.
     * @example
     *
     *   Date.range('2003', '2005').duration() -> 94694400000
     *
     ***/
    'duration': function() {
      return this.isValid() ? this.end.getTime() - this.start.getTime() : NaN;
    },

    /***
     * @method contains(<d>)
     * @returns Boolean
     * @short Returns true if <d> is contained inside the DateRange. <d> may be a date or another DateRange.
     * @example
     *
     *   Date.range('2003', '2005').contains(Date.create('2004')) -> true
     *
     ***/
    'contains': function(obj) {
      var self = this, arr = obj.start && obj.end ? [obj.start, obj.end] : [obj];
      return arr.every(function(d) {
        return d >= self.start && d <= self.end;
      });
    },

    /***
     * @method every(<increment>, [fn])
     * @returns Array
     * @short Iterates through the DateRange for every <increment>, calling [fn] if it is passed. Returns an array of each increment visited.
     * @extra When <increment> is a number, increments will be to the exact millisecond. <increment> can also be a string in the format %{number} {unit}s%, in which case it will increment in the unit specified. Note that a discrepancy exists in the case of months, as %(2).months()% is an approximation. Stepping through the actual months by passing %"2 months"% is usually preferable in this case.
     * @example
     *
     *   Date.range('2003-01', '2003-03').every("2 months") -> [...]
     *
     ***/
    'every': function(increment, fn) {
      var current = this.start.clone(), result = [], index = 0, params, isDay;
      if(isString(increment)) {
        current.advance(getDateParamsFromString(increment, 0), true);
        params = getDateParamsFromString(increment);
        isDay = increment.toLowerCase() === 'day';
      } else {
        params = { 'milliseconds': increment };
      }
      while(current <= this.end) {
        result.push(current);
        if(fn) fn(current, index);
        if(isDay && callDateGet(current, 'Hours') === 23) {
          // When DST traversal happens at 00:00 hours, the time is effectively
          // pushed back to 23:00, meaning 1) 00:00 for that day does not exist,
          // and 2) there is no difference between 23:00 and 00:00, as you are
          // "jumping" around in time. Hours here will be reset before the date
          // is advanced and the date will never in fact advance, so set the hours
          // directly ahead to the next day to avoid this problem.
          current = current.clone();
          callDateSet(current, 'Hours', 48);
        } else {
          current = current.clone().advance(params, true);
        }
        index++;
      }
      return result;
    },

    /***
     * @method union(<range>)
     * @returns DateRange
     * @short Returns a new DateRange with the earliest starting point as its start, and the latest ending point as its end. If the two ranges do not intersect this will effectively remove the "gap" between them.
     * @example
     *
     *   Date.range('2003=01', '2005-01').union(Date.range('2004-01', '2006-01')) -> Jan 1, 2003..Jan 1, 2006
     *
     ***/
    'union': function(range) {
      return new DateRange(
        this.start < range.start ? this.start : range.start,
        this.end   > range.end   ? this.end   : range.end
      );
    },

    /***
     * @method intersect(<range>)
     * @returns DateRange
     * @short Returns a new DateRange with the latest starting point as its start, and the earliest ending point as its end. If the two ranges do not intersect this will effectively produce an invalid range.
     * @example
     *
     *   Date.range('2003-01', '2005-01').intersect(Date.range('2004-01', '2006-01')) -> Jan 1, 2004..Jan 1, 2005
     *
     ***/
    'intersect': function(range) {
      return new DateRange(
        this.start > range.start ? this.start : range.start,
        this.end   < range.end   ? this.end   : range.end
      );
    },

    /***
     * @method clone()
     * @returns DateRange
     * @short Clones the DateRange.
     * @example
     *
     *   Date.range('2003-01', '2005-01').intersect(Date.range('2004-01', '2006-01')) -> Jan 1, 2004..Jan 1, 2005
     *
     ***/
    'clone': function(range) {
      return new DateRange(this.start, this.end);
    }

  });

  /***
   * @method each[Unit]([fn])
   * @returns Date
   * @short Increments through the date range for each [unit], calling [fn] if it is passed. Returns an array of each increment visited.
   *
   * @set
   *   eachMillisecond
   *   eachSecond
   *   eachMinute
   *   eachHour
   *   eachDay
   *   eachWeek
   *   eachMonth
   *   eachYear
   *
   * @example
   *
   *   Date.range('2003-01', '2003-02').eachMonth()     -> [...]
   *   Date.range('2003-01-15', '2003-01-16').eachDay() -> [...]
   *
   ***/
  extendSimilar(DateRange, true, false, 'Millisecond,Second,Minute,Hour,Day,Week,Month,Year', function(methods, name) {
    methods['each' + name] = function(fn) { return this.every(name, fn); }
  });


  /***
   * Date module
   ***/

  extend(date, false, false, {

     /***
     * @method Date.range([start], [end])
     * @returns DateRange
     * @short Creates a new date range.
     * @extra If either [start] or [end] are null, they will default to the current date.
     *
     ***/
    'range': function(start, end) {
      return new DateRange(start, end);
    }

  });


  /***
   * @package Function
   * @dependency core
   * @description Lazy, throttled, and memoized functions, delayed functions and handling of timers, argument currying.
   *
   ***/

  function setDelay(fn, ms, after, scope, args) {
    var index;
    // Delay of infinity is never called of course...
    if(ms === Infinity) return;
    if(!fn.timers) fn.timers = [];
    if(!isNumber(ms)) ms = 0;
    fn.timers.push(setTimeout(function(){
      fn.timers.splice(index, 1);
      after.apply(scope, args || []);
    }, ms));
    index = fn.timers.length;
  }

  extend(Function, true, false, {

     /***
     * @method lazy([ms] = 1, [limit] = Infinity)
     * @returns Function
     * @short Creates a lazy function that, when called repeatedly, will queue execution and wait [ms] milliseconds to execute again.
     * @extra Lazy functions will always execute as many times as they are called up to [limit], after which point subsequent calls will be ignored (if it is set to a finite number). Compare this to %throttle%, which will execute only once per [ms] milliseconds. %lazy% is useful when you need to be sure that every call to a function is executed, but in a non-blocking manner. Calling %cancel% on a lazy function will clear the entire queue. Note that [ms] can also be a fraction.
     * @example
     *
     *   (function() {
     *     // Executes immediately.
     *   }).lazy()();
     *   (3).times(function() {
     *     // Executes 3 times, with each execution 20ms later than the last.
     *   }.lazy(20));
     *   (100).times(function() {
     *     // Executes 50 times, with each execution 20ms later than the last.
     *   }.lazy(20, 50));
     *
     ***/
    'lazy': function(ms, limit) {
      var fn = this, queue = [], lock = false, execute, rounded, perExecution, result;
      ms = ms || 1;
      limit = limit || Infinity;
      rounded = ceil(ms);
      perExecution = round(rounded / ms) || 1;
      execute = function() {
        if(lock || queue.length == 0) return;
        // Allow fractions of a millisecond by calling
        // multiple times per actual timeout execution
        var max = math.max(queue.length - perExecution, 0);
        while(queue.length > max) {
          // Getting uber-meta here...
          result = Function.prototype.apply.apply(fn, queue.shift());
        }
        setDelay(lazy, rounded, function() {
          lock = false;
          execute();
        });
        lock = true;
      }
      function lazy() {
        // The first call is immediate, so having 1 in the queue
        // implies two calls have already taken place.
        if(!lock || queue.length < limit - 1) {
          queue.push([this, arguments]);
          execute();
        }
        // Return the memoized result
        return result;
      }
      return lazy;
    },

     /***
     * @method delay([ms] = 0, [arg1], ...)
     * @returns Function
     * @short Executes the function after <ms> milliseconds.
     * @extra Returns a reference to itself. %delay% is also a way to execute non-blocking operations that will wait until the CPU is free. Delayed functions can be canceled using the %cancel% method. Can also curry arguments passed in after <ms>.
     * @example
     *
     *   (function(arg1) {
     *     // called 1s later
     *   }).delay(1000, 'arg1');
     *
     ***/
    'delay': function(ms) {
      var fn = this;
      var args = multiArgs(arguments).slice(1);
      setDelay(fn, ms, fn, fn, args);
      return fn;
    },

     /***
     * @method throttle(<ms>)
     * @returns Function
     * @short Creates a "throttled" version of the function that will only be executed once per <ms> milliseconds.
     * @extra This is functionally equivalent to calling %lazy% with a [limit] of %1%. %throttle% is appropriate when you want to make sure a function is only executed at most once for a given duration. Compare this to %lazy%, which will queue rapid calls and execute them later.
     * @example
     *
     *   (3).times(function() {
     *     // called only once. will wait 50ms until it responds again
     *   }.throttle(50));
     *
     ***/
    'throttle': function(ms) {
      return this.lazy(ms, 1);
    },

     /***
     * @method debounce(<ms>)
     * @returns Function
     * @short Creates a "debounced" function that postpones its execution until after <ms> milliseconds have passed.
     * @extra This method is useful to execute a function after things have "settled down". A good example of this is when a user tabs quickly through form fields, execution of a heavy operation should happen after a few milliseconds when they have "settled" on a field.
     * @example
     *
     *   var fn = (function(arg1) {
     *     // called once 50ms later
     *   }).debounce(50); fn() fn() fn();
     *
     ***/
    'debounce': function(ms) {
      var fn = this;
      function debounced() {
        debounced.cancel();
        setDelay(debounced, ms, fn, this, arguments);
      };
      return debounced;
    },

     /***
     * @method cancel()
     * @returns Function
     * @short Cancels a delayed function scheduled to be run.
     * @extra %delay%, %lazy%, %throttle%, and %debounce% can all set delays.
     * @example
     *
     *   (function() {
     *     alert('hay'); // Never called
     *   }).delay(500).cancel();
     *
     ***/
    'cancel': function() {
      if(isArray(this.timers)) {
        while(this.timers.length > 0) {
          clearTimeout(this.timers.shift());
        }
      }
      return this;
    },

     /***
     * @method after([num] = 1)
     * @returns Function
     * @short Creates a function that will execute after [num] calls.
     * @extra %after% is useful for running a final callback after a series of asynchronous operations, when the order in which the operations will complete is unknown.
     * @example
     *
     *   var fn = (function() {
     *     // Will be executed once only
     *   }).after(3); fn(); fn(); fn();
     *
     ***/
    'after': function(num) {
      var fn = this, counter = 0, storedArguments = [];
      if(!isNumber(num)) {
        num = 1;
      } else if(num === 0) {
        fn.call();
        return fn;
      }
      return function() {
        var ret;
        storedArguments.push(multiArgs(arguments));
        counter++;
        if(counter == num) {
          ret = fn.call(this, storedArguments);
          counter = 0;
          storedArguments = [];
          return ret;
        }
      }
    },

     /***
     * @method once()
     * @returns Function
     * @short Creates a function that will execute only once and store the result.
     * @extra %once% is useful for creating functions that will cache the result of an expensive operation and use it on subsequent calls. Also it can be useful for creating initialization functions that only need to be run once.
     * @example
     *
     *   var fn = (function() {
     *     // Will be executed once only
     *   }).once(); fn(); fn(); fn();
     *
     ***/
    'once': function() {
      return this.throttle(Infinity);
    },

     /***
     * @method fill(<arg1>, <arg2>, ...)
     * @returns Function
     * @short Returns a new version of the function which when called will have some of its arguments pre-emptively filled in, also known as "currying".
     * @extra Arguments passed to a "filled" function are generally appended to the curried arguments. However, if %undefined% is passed as any of the arguments to %fill%, it will be replaced, when the "filled" function is executed. This allows currying of arguments even when they occur toward the end of an argument list (the example demonstrates this much more clearly).
     * @example
     *
     *   var delayOneSecond = setTimeout.fill(undefined, 1000);
     *   delayOneSecond(function() {
     *     // Will be executed 1s later
     *   });
     *
     ***/
    'fill': function() {
      var fn = this, curried = multiArgs(arguments);
      return function() {
        var args = multiArgs(arguments);
        curried.forEach(function(arg, index) {
          if(arg != null || index >= args.length) args.splice(index, 0, arg);
        });
        return fn.apply(this, args);
      }
    }


  });


  /***
   * @package Number
   * @dependency core
   * @description Number formatting, rounding (with precision), and ranges. Aliases to Math methods.
   *
   ***/


  function abbreviateNumber(num, roundTo, str, mid, limit, bytes) {
    var fixed        = num.toFixed(20),
        decimalPlace = fixed.search(/\./),
        numeralPlace = fixed.search(/[1-9]/),
        significant  = decimalPlace - numeralPlace,
        unit, i, divisor;
    if(significant > 0) {
      significant -= 1;
    }
    i = math.max(math.min((significant / 3).floor(), limit === false ? str.length : limit), -mid);
    unit = str.charAt(i + mid - 1);
    if(significant < -9) {
      i = -3;
      roundTo = significant.abs() - 9;
      unit = str.slice(0,1);
    }
    divisor = bytes ? (2).pow(10 * i) : (10).pow(i * 3);
    return (num / divisor).round(roundTo || 0).format() + unit.trim();
  }


  extend(number, false, false, {

    /***
     * @method Number.random([n1], [n2])
     * @returns Number
     * @short Returns a random integer between [n1] and [n2].
     * @extra If only 1 number is passed, the other will be 0. If none are passed, the number will be either 0 or 1.
     * @example
     *
     *   Number.random(50, 100) -> ex. 85
     *   Number.random(50)      -> ex. 27
     *   Number.random()        -> ex. 0
     *
     ***/
    'random': function(n1, n2) {
      var min, max;
      if(arguments.length == 1) n2 = n1, n1 = 0;
      min = math.min(n1 || 0, isUndefined(n2) ? 1 : n2);
      max = math.max(n1 || 0, isUndefined(n2) ? 1 : n2) + 1;
      return floor((math.random() * (max - min)) + min);
    }

  });

  extend(number, true, false, {

    /***
     * @method log(<base> = Math.E)
     * @returns Number
     * @short Returns the logarithm of the number with base <base>, or natural logarithm of the number if <base> is undefined.
     * @example
     *
     *   (64).log(2) -> 6
     *   (9).log(3)  -> 2
     *   (5).log()   -> 1.6094379124341003
     *
     ***/

    'log': function(base) {
       return math.log(this) / (base ? math.log(base) : 1);
     },

    /***
     * @method abbr([precision] = 0)
     * @returns String
     * @short Returns an abbreviated form of the number.
     * @extra [precision] will round to the given precision.
     * @example
     *
     *   (1000).abbr()    -> "1k"
     *   (1000000).abbr() -> "1m"
     *   (1280).abbr(1)   -> "1.3k"
     *
     ***/
    'abbr': function(precision) {
      return abbreviateNumber(this, precision, 'kmbt', 0, 4);
    },

    /***
     * @method metric([precision] = 0, [limit] = 1)
     * @returns String
     * @short Returns the number as a string in metric notation.
     * @extra [precision] will round to the given precision. Both very large numbers and very small numbers are supported. [limit] is the upper limit for the units. The default is %1%, which is "kilo". If [limit] is %false%, the upper limit will be "exa". The lower limit is "nano", and cannot be changed.
     * @example
     *
     *   (1000).metric()            -> "1k"
     *   (1000000).metric()         -> "1,000k"
     *   (1000000).metric(0, false) -> "1M"
     *   (1249).metric(2) + 'g'     -> "1.25kg"
     *   (0.025).metric() + 'm'     -> "25mm"
     *
     ***/
    'metric': function(precision, limit) {
      return abbreviateNumber(this, precision, 'nμm kMGTPE', 4, isUndefined(limit) ? 1 : limit);
    },

    /***
     * @method bytes([precision] = 0, [limit] = 4)
     * @returns String
     * @short Returns an abbreviated form of the number, considered to be "Bytes".
     * @extra [precision] will round to the given precision. [limit] is the upper limit for the units. The default is %4%, which is "terabytes" (TB). If [limit] is %false%, the upper limit will be "exa".
     * @example
     *
     *   (1000).bytes()                 -> "1kB"
     *   (1000).bytes(2)                -> "0.98kB"
     *   ((10).pow(20)).bytes()         -> "90,949,470TB"
     *   ((10).pow(20)).bytes(0, false) -> "87EB"
     *
     ***/
    'bytes': function(precision, limit) {
      return abbreviateNumber(this, precision, 'kMGTPE', 0, isUndefined(limit) ? 4 : limit, true) + 'B';
    },

    /***
     * @method isInteger()
     * @returns Boolean
     * @short Returns true if the number has no trailing decimal.
     * @example
     *
     *   (420).isInteger() -> true
     *   (4.5).isInteger() -> false
     *
     ***/
    'isInteger': function() {
      return this % 1 == 0;
    },

    /***
     * @method isOdd()
     * @returns Boolean
     * @short Returns true if the number is odd.
     * @example
     *
     *   (3).isOdd()  -> true
     *   (18).isOdd() -> false
     *
     ***/
    'isOdd': function() {
      return !isNaN(this) && !this.isMultipleOf(2);
    },

    /***
     * @method isEven()
     * @returns Boolean
     * @short Returns true if the number is even.
     * @example
     *
     *   (6).isEven()  -> true
     *   (17).isEven() -> false
     *
     ***/
    'isEven': function() {
      return this.isMultipleOf(2);
    },

    /***
     * @method isMultipleOf(<num>)
     * @returns Boolean
     * @short Returns true if the number is a multiple of <num>.
     * @example
     *
     *   (6).isMultipleOf(2)  -> true
     *   (17).isMultipleOf(2) -> false
     *   (32).isMultipleOf(4) -> true
     *   (34).isMultipleOf(4) -> false
     *
     ***/
    'isMultipleOf': function(num) {
      return this % num === 0;
    },


    /***
     * @method format([place] = 0, [thousands] = ',', [decimal] = '.')
     * @returns String
     * @short Formats the number to a readable string.
     * @extra If [place] is %undefined%, will automatically determine the place. [thousands] is the character used for the thousands separator. [decimal] is the character used for the decimal point.
     * @example
     *
     *   (56782).format()           -> '56,782'
     *   (56782).format(2)          -> '56,782.00'
     *   (4388.43).format(2, ' ')      -> '4 388.43'
     *   (4388.43).format(2, '.', ',') -> '4.388,43'
     *
     ***/
    'format': function(place, thousands, decimal) {
      var i, str, split, integer, fraction, result = '';
      if(isUndefined(thousands)) {
        thousands = ',';
      }
      if(isUndefined(decimal)) {
        decimal = '.';
      }
      str      = (isNumber(place) ? round(this, place || 0).toFixed(math.max(place, 0)) : this.toString()).replace(/^-/, '');
      split    = str.split('.');
      integer  = split[0];
      fraction = split[1];
      for(i = integer.length; i > 0; i -= 3) {
        if(i < integer.length) {
          result = thousands + result;
        }
        result = integer.slice(math.max(0, i - 3), i) + result;
      }
      if(fraction) {
        result += decimal + repeatString((place || 0) - fraction.length, '0') + fraction;
      }
      return (this < 0 ? '-' : '') + result;
    },

    /***
     * @method hex([pad] = 1)
     * @returns String
     * @short Converts the number to hexidecimal.
     * @extra [pad] will pad the resulting string to that many places.
     * @example
     *
     *   (255).hex()   -> 'ff';
     *   (255).hex(4)  -> '00ff';
     *   (23654).hex() -> '5c66';
     *
     ***/
    'hex': function(pad) {
      return this.pad(pad || 1, false, 16);
    },

    /***
     * @method upto(<num>, [fn], [step] = 1)
     * @returns Array
     * @short Returns an array containing numbers from the number up to <num>.
     * @extra Optionally calls [fn] callback for each number in that array. [step] allows multiples greater than 1.
     * @example
     *
     *   (2).upto(6) -> [2, 3, 4, 5, 6]
     *   (2).upto(6, function(n) {
     *     // This function is called 5 times receiving n as the value.
     *   });
     *   (2).upto(8, null, 2) -> [2, 4, 6, 8]
     *
     ***/
    'upto': function(num, fn, step) {
      return getRange(this, num, fn, step || 1);
    },

    /***
     * @method downto(<num>, [fn], [step] = 1)
     * @returns Array
     * @short Returns an array containing numbers from the number down to <num>.
     * @extra Optionally calls [fn] callback for each number in that array. [step] allows multiples greater than 1.
     * @example
     *
     *   (8).downto(3) -> [8, 7, 6, 5, 4, 3]
     *   (8).downto(3, function(n) {
     *     // This function is called 6 times receiving n as the value.
     *   });
     *   (8).downto(2, null, 2) -> [8, 6, 4, 2]
     *
     ***/
    'downto': function(num, fn, step) {
      return getRange(this, num, fn, -(step || 1));
    },

    /***
     * @method times(<fn>)
     * @returns Number
     * @short Calls <fn> a number of times equivalent to the number.
     * @example
     *
     *   (8).times(function(i) {
     *     // This function is called 8 times.
     *   });
     *
     ***/
    'times': function(fn) {
      if(fn) {
        for(var i = 0; i < this; i++) {
          fn.call(this, i);
        }
      }
      return this.toNumber();
    },

    /***
     * @method chr()
     * @returns String
     * @short Returns a string at the code point of the number.
     * @example
     *
     *   (65).chr() -> "A"
     *   (75).chr() -> "K"
     *
     ***/
    'chr': function() {
      return string.fromCharCode(this);
    },

    /***
     * @method pad(<place> = 0, [sign] = false, [base] = 10)
     * @returns String
     * @short Pads a number with "0" to <place>.
     * @extra [sign] allows you to force the sign as well (+05, etc). [base] can change the base for numeral conversion.
     * @example
     *
     *   (5).pad(2)        -> '05'
     *   (-5).pad(4)       -> '-0005'
     *   (82).pad(3, true) -> '+082'
     *
     ***/
    'pad': function(place, sign, base) {
      return padNumber(this, place, sign, base);
    },

    /***
     * @method ordinalize()
     * @returns String
     * @short Returns an ordinalized (English) string, i.e. "1st", "2nd", etc.
     * @example
     *
     *   (1).ordinalize() -> '1st';
     *   (2).ordinalize() -> '2nd';
     *   (8).ordinalize() -> '8th';
     *
     ***/
    'ordinalize': function() {
      var suffix, num = this.abs(), last = parseInt(num.toString().slice(-2));
      return this + getOrdinalizedSuffix(last);
    },

    /***
     * @method toNumber()
     * @returns Number
     * @short Returns a number. This is mostly for compatibility reasons.
     * @example
     *
     *   (420).toNumber() -> 420
     *
     ***/
    'toNumber': function() {
      return parseFloat(this, 10);
    }

  });

  /***
   * @method round(<precision> = 0)
   * @returns Number
   * @short Shortcut for %Math.round% that also allows a <precision>.
   *
   * @example
   *
   *   (3.241).round()  -> 3
   *   (-3.841).round() -> -4
   *   (3.241).round(2) -> 3.24
   *   (3748).round(-2) -> 3800
   *
   ***
   * @method ceil(<precision> = 0)
   * @returns Number
   * @short Shortcut for %Math.ceil% that also allows a <precision>.
   *
   * @example
   *
   *   (3.241).ceil()  -> 4
   *   (-3.241).ceil() -> -3
   *   (3.241).ceil(2) -> 3.25
   *   (3748).ceil(-2) -> 3800
   *
   ***
   * @method floor(<precision> = 0)
   * @returns Number
   * @short Shortcut for %Math.floor% that also allows a <precision>.
   *
   * @example
   *
   *   (3.241).floor()  -> 3
   *   (-3.841).floor() -> -4
   *   (3.241).floor(2) -> 3.24
   *   (3748).floor(-2) -> 3700
   *
   ***
   * @method [math]()
   * @returns Number
   * @short Math related functions are mapped as shortcuts to numbers and are identical. Note that %Number#log% provides some special defaults.
   *
   * @set
   *   abs
   *   sin
   *   asin
   *   cos
   *   acos
   *   tan
   *   atan
   *   sqrt
   *   exp
   *   pow
   *
   * @example
   *
   *   (3).pow(3) -> 27
   *   (-3).abs() -> 3
   *   (1024).sqrt() -> 32
   *
   ***/

  function buildNumber() {
    extendSimilar(number, true, false, 'round,floor,ceil', function(methods, name) {
      methods[name] = function(precision) {
        return round(this, precision, name);
      }
    });
    extendSimilar(number, true, false, 'abs,pow,sin,asin,cos,acos,tan,atan,exp,pow,sqrt', function(methods, name) {
      methods[name] = function(a, b) {
        return math[name](this, a, b);
      }
    });
  }

  buildNumber();

  /***
   * @package Object
   * @dependency core
   * @description Object manipulation, type checking (isNumber, isString, ...), extended objects with hash-like methods available as instance methods.
   *
   * Much thanks to kangax for his informative aricle about how problems with instanceof and constructor
   * http://perfectionkills.com/instanceof-considered-harmful-or-how-to-write-a-robust-isarray/
   *
   ***/

  var ObjectTypeMethods = 'isObject,isNaN'.split(',');
  var ObjectHashMethods = 'keys,values,select,reject,each,merge,clone,equal,watch,tap,has,toQueryString'.split(',');

  function setParamsObject(obj, param, value, deep) {
    var reg = /^(.+?)(\[.*\])$/, paramIsArray, match, allKeys, key;
    if(deep !== false && (match = param.match(reg))) {
      key = match[1];
      allKeys = match[2].replace(/^\[|\]$/g, '').split('][');
      allKeys.forEach(function(k) {
        paramIsArray = !k || k.match(/^\d+$/);
        if(!key && isArray(obj)) key = obj.length;
        if(!hasOwnProperty(obj, key)) {
          obj[key] = paramIsArray ? [] : {};
        }
        obj = obj[key];
        key = k;
      });
      if(!key && paramIsArray) key = obj.length.toString();
      setParamsObject(obj, key, value);
    } else if(value.match(/^[+-]?\d+(\.\d+)?$/)) {
      obj[param] = parseFloat(value);
    } else if(value === 'true') {
      obj[param] = true;
    } else if(value === 'false') {
      obj[param] = false;
    } else {
      obj[param] = value;
    }
  }

  function objectToQueryString(base, obj) {
    var tmp;
    // If a custom toString exists bail here and use that instead
    if(isArray(obj) || (isObject(obj) && obj.toString === internalToString)) {
      tmp = [];
      iterateOverObject(obj, function(key, value) {
        if(base) {
          key = base + '[' + key + ']';
        }
        tmp.push(objectToQueryString(key, value));
      });
      return tmp.join('&');
    } else {
      if(!base) return '';
      return sanitizeURIComponent(base) + '=' + (isDate(obj) ? obj.getTime() : sanitizeURIComponent(obj));
    }
  }

  function sanitizeURIComponent(obj) {
    // undefined, null, and NaN are represented as a blank string,
    // while false and 0 are stringified. "+" is allowed in query string
    return !obj && obj !== false && obj !== 0 ? '' : encodeURIComponent(obj).replace(/%20/g, '+');
  }

  function matchKey(key, match) {
    if(isRegExp(match)) {
      return match.test(key);
    } else if(isObjectPrimitive(match)) {
      return hasOwnProperty(match, key);
    } else {
      return key === string(match);
    }
  }

  function selectFromObject(obj, args, select) {
    var result = {}, match;
    iterateOverObject(obj, function(key, value) {
      match = false;
      flattenedArgs(args, function(arg) {
        if(matchKey(key, arg)) {
          match = true;
        }
      }, 1);
      if(match === select) {
        result[key] = value;
      }
    });
    return result;
  }


  /***
   * @method Object.is[Type](<obj>)
   * @returns Boolean
   * @short Returns true if <obj> is an object of that type.
   * @extra %isObject% will return false on anything that is not an object literal, including instances of inherited classes. Note also that %isNaN% will ONLY return true if the object IS %NaN%. It does not mean the same as browser native %isNaN%, which returns true for anything that is "not a number".
   *
   * @set
   *   isArray
   *   isObject
   *   isBoolean
   *   isDate
   *   isFunction
   *   isNaN
   *   isNumber
   *   isString
   *   isRegExp
   *
   * @example
   *
   *   Object.isArray([1,2,3])            -> true
   *   Object.isDate(3)                   -> false
   *   Object.isRegExp(/wasabi/)          -> true
   *   Object.isObject({ broken:'wear' }) -> true
   *
   ***/
  function buildTypeMethods() {
    extendSimilar(object, false, false, ClassNames, function(methods, name) {
      var method = 'is' + name;
      ObjectTypeMethods.push(method);
      methods[method] = typeChecks[name];
    });
  }

  function buildObjectExtend() {
    extend(object, false, function(){ return arguments.length === 0; }, {
      'extend': function() {
        var methods = ObjectTypeMethods.concat(ObjectHashMethods)
        if(typeof EnumerableMethods !== 'undefined') {
          methods = methods.concat(EnumerableMethods);
        }
        buildObjectInstanceMethods(methods, object);
      }
    });
  }

  extend(object, false, true, {
      /***
       * @method watch(<obj>, <prop>, <fn>)
       * @returns Nothing
       * @short Watches a property of <obj> and runs <fn> when it changes.
       * @extra <fn> is passed three arguments: the property <prop>, the old value, and the new value. The return value of [fn] will be set as the new value. This method is useful for things such as validating or cleaning the value when it is set. Warning: this method WILL NOT work in browsers that don't support %Object.defineProperty%. This notably includes IE 8 and below, and Opera. This is the only method in Sugar that is not fully compatible with all browsers. %watch% is available as an instance method on extended objects.
       * @example
       *
       *   Object.watch({ foo: 'bar' }, 'foo', function(prop, oldVal, newVal) {
       *     // Will be run when the property 'foo' is set on the object.
       *   });
       *   Object.extended().watch({ foo: 'bar' }, 'foo', function(prop, oldVal, newVal) {
       *     // Will be run when the property 'foo' is set on the object.
       *   });
       *
       ***/
    'watch': function(obj, prop, fn) {
      if(!definePropertySupport) return;
      var value = obj[prop];
      object.defineProperty(obj, prop, {
        'enumerable'  : true,
        'configurable': true,
        'get': function() {
          return value;
        },
        'set': function(to) {
          value = fn.call(obj, prop, value, to);
        }
      });
    }
  });

  extend(object, false, function(arg1, arg2) { return isFunction(arg2); }, {

    /***
     * @method keys(<obj>, [fn])
     * @returns Array
     * @short Returns an array containing the keys in <obj>. Optionally calls [fn] for each key.
     * @extra This method is provided for browsers that don't support it natively, and additionally is enhanced to accept the callback [fn]. Returned keys are in no particular order. %keys% is available as an instance method on extended objects.
     * @example
     *
     *   Object.keys({ broken: 'wear' }) -> ['broken']
     *   Object.keys({ broken: 'wear' }, function(key, value) {
     *     // Called once for each key.
     *   });
     *   Object.extended({ broken: 'wear' }).keys() -> ['broken']
     *
     ***/
    'keys': function(obj, fn) {
      var keys = object.keys(obj);
      keys.forEach(function(key) {
        fn.call(obj, key, obj[key]);
      });
      return keys;
    }

  });

  extend(object, false, false, {

    'isObject': function(obj) {
      return isObject(obj);
    },

    'isNaN': function(obj) {
      // This is only true of NaN
      return isNumber(obj) && obj.valueOf() !== obj.valueOf();
    },

    /***
     * @method equal(<a>, <b>)
     * @returns Boolean
     * @short Returns true if <a> and <b> are equal.
     * @extra %equal% in Sugar is "egal", meaning the values are equal if they are "not observably distinguishable". Note that on extended objects the name is %equals% for readability.
     * @example
     *
     *   Object.equal({a:2}, {a:2}) -> true
     *   Object.equal({a:2}, {a:3}) -> false
     *   Object.extended({a:2}).equals({a:3}) -> false
     *
     ***/
    'equal': function(a, b) {
      return isEqual(a, b);
    },

    /***
     * @method Object.extended(<obj> = {})
     * @returns Extended object
     * @short Creates a new object, equivalent to %new Object()% or %{}%, but with extended methods.
     * @extra See extended objects for more.
     * @example
     *
     *   Object.extended()
     *   Object.extended({ happy:true, pappy:false }).keys() -> ['happy','pappy']
     *   Object.extended({ happy:true, pappy:false }).values() -> [true, false]
     *
     ***/
    'extended': function(obj) {
      return new Hash(obj);
    },

    /***
     * @method merge(<target>, <source>, [deep] = false, [resolve] = true)
     * @returns Merged object
     * @short Merges all the properties of <source> into <target>.
     * @extra Merges are shallow unless [deep] is %true%. Properties of <source> will win in the case of conflicts, unless [resolve] is %false%. [resolve] can also be a function that resolves the conflict. In this case it will be passed 3 arguments, %key%, %targetVal%, and %sourceVal%, with the context set to <source>. This will allow you to solve conflict any way you want, ie. adding two numbers together, etc. %merge% is available as an instance method on extended objects.
     * @example
     *
     *   Object.merge({a:1},{b:2}) -> { a:1, b:2 }
     *   Object.merge({a:1},{a:2}, false, false) -> { a:1 }
     +   Object.merge({a:1},{a:2}, false, function(key, a, b) {
     *     return a + b;
     *   }); -> { a:3 }
     *   Object.extended({a:1}).merge({b:2}) -> { a:1, b:2 }
     *
     ***/
    'merge': function(target, source, deep, resolve) {
      var key, val;
      // Strings cannot be reliably merged thanks to
      // their properties not being enumerable in < IE8.
      if(target && typeof source != 'string') {
        for(key in source) {
          if(!hasOwnProperty(source, key) || !target) continue;
          val = source[key];
          // Conflict!
          if(isDefined(target[key])) {
            // Do not merge.
            if(resolve === false) {
              continue;
            }
            // Use the result of the callback as the result.
            if(isFunction(resolve)) {
              val = resolve.call(source, key, target[key], source[key])
            }
          }
          // Deep merging.
          if(deep === true && val && isObjectPrimitive(val)) {
            if(isDate(val)) {
              val = new date(val.getTime());
            } else if(isRegExp(val)) {
              val = new regexp(val.source, getRegExpFlags(val));
            } else {
              if(!target[key]) target[key] = array.isArray(val) ? [] : {};
              object.merge(target[key], source[key], deep, resolve);
              continue;
            }
          }
          target[key] = val;
        }
      }
      return target;
    },

    /***
     * @method values(<obj>, [fn])
     * @returns Array
     * @short Returns an array containing the values in <obj>. Optionally calls [fn] for each value.
     * @extra Returned values are in no particular order. %values% is available as an instance method on extended objects.
     * @example
     *
     *   Object.values({ broken: 'wear' }) -> ['wear']
     *   Object.values({ broken: 'wear' }, function(value) {
     *     // Called once for each value.
     *   });
     *   Object.extended({ broken: 'wear' }).values() -> ['wear']
     *
     ***/
    'values': function(obj, fn) {
      var values = [];
      iterateOverObject(obj, function(k,v) {
        values.push(v);
        if(fn) fn.call(obj,v);
      });
      return values;
    },

    /***
     * @method clone(<obj> = {}, [deep] = false)
     * @returns Cloned object
     * @short Creates a clone (copy) of <obj>.
     * @extra Default is a shallow clone, unless [deep] is true. %clone% is available as an instance method on extended objects.
     * @example
     *
     *   Object.clone({foo:'bar'})            -> { foo: 'bar' }
     *   Object.clone()                       -> {}
     *   Object.extended({foo:'bar'}).clone() -> { foo: 'bar' }
     *
     ***/
    'clone': function(obj, deep) {
      var target;
      // Preserve internal UTC flag when applicable.
      if(isDate(obj) && obj.clone) {
        return obj.clone();
      } else if(!isObjectPrimitive(obj)) {
        return obj;
      } else if (obj instanceof Hash) {
        target = new Hash;
      } else {
        target = new obj.constructor;
      }
      return object.merge(target, obj, deep);
    },

    /***
     * @method Object.fromQueryString(<str>, [deep] = true)
     * @returns Object
     * @short Converts the query string of a URL into an object.
     * @extra If [deep] is %false%, conversion will only accept shallow params (ie. no object or arrays with %[]% syntax) as these are not universally supported.
     * @example
     *
     *   Object.fromQueryString('foo=bar&broken=wear') -> { foo: 'bar', broken: 'wear' }
     *   Object.fromQueryString('foo[]=1&foo[]=2')     -> { foo: [1,2] }
     *
     ***/
    'fromQueryString': function(str, deep) {
      var result = object.extended(), split;
      str = str && str.toString ? str.toString() : '';
      str.replace(/^.*?\?/, '').split('&').forEach(function(p) {
        var split = p.split('=');
        if(split.length !== 2) return;
        setParamsObject(result, split[0], decodeURIComponent(split[1]), deep);
      });
      return result;
    },

    /***
     * @method Object.toQueryString(<obj>, [namespace] = true)
     * @returns Object
     * @short Converts the object into a query string.
     * @extra Accepts deep nested objects and arrays. If [namespace] is passed, it will be prefixed to all param names.
     * @example
     *
     *   Object.toQueryString({foo:'bar'})          -> 'foo=bar'
     *   Object.toQueryString({foo:['a','b','c']})  -> 'foo[0]=a&foo[1]=b&foo[2]=c'
     *   Object.toQueryString({name:'Bob'}, 'user') -> 'user[name]=Bob'
     *
     ***/
    'toQueryString': function(obj, namespace) {
      return objectToQueryString(namespace, obj);
    },

    /***
     * @method tap(<obj>, <fn>)
     * @returns Object
     * @short Runs <fn> and returns <obj>.
     * @extra  A string can also be used as a shortcut to a method. This method is used to run an intermediary function in the middle of method chaining. As a standalone method on the Object class it doesn't have too much use. The power of %tap% comes when using extended objects or modifying the Object prototype with Object.extend().
     * @example
     *
     *   Object.extend();
     *   [2,4,6].map(Math.exp).tap(function(arr) {
     *     arr.pop()
     *   });
     *   [2,4,6].map(Math.exp).tap('pop').map(Math.round); ->  [7,55]
     *
     ***/
    'tap': function(obj, arg) {
      var fn = arg;
      if(!isFunction(arg)) {
        fn = function() {
          if(arg) obj[arg]();
        }
      }
      fn.call(obj, obj);
      return obj;
    },

    /***
     * @method has(<obj>, <key>)
     * @returns Boolean
     * @short Checks if <obj> has <key> using hasOwnProperty from Object.prototype.
     * @extra This method is considered safer than %Object#hasOwnProperty% when using objects as hashes. See http://www.devthought.com/2012/01/18/an-object-is-not-a-hash/ for more.
     * @example
     *
     *   Object.has({ foo: 'bar' }, 'foo') -> true
     *   Object.has({ foo: 'bar' }, 'baz') -> false
     *   Object.has({ hasOwnProperty: true }, 'foo') -> false
     *
     ***/
    'has': function (obj, key) {
      return hasOwnProperty(obj, key);
    },

    /***
     * @method select(<obj>, <find>, ...)
     * @returns Object
     * @short Builds a new object containing the values specified in <find>.
     * @extra When <find> is a string, that single key will be selected. It can also be a regex, selecting any key that matches, or an object which will match if the key also exists in that object, effectively doing an "intersect" operation on that object. Multiple selections may also be passed as an array or directly as enumerated arguments. %select% is available as an instance method on extended objects.
     * @example
     *
     *   Object.select({a:1,b:2}, 'a')        -> {a:1}
     *   Object.select({a:1,b:2}, /[a-z]/)    -> {a:1,ba:2}
     *   Object.select({a:1,b:2}, {a:1})      -> {a:1}
     *   Object.select({a:1,b:2}, 'a', 'b')   -> {a:1,b:2}
     *   Object.select({a:1,b:2}, ['a', 'b']) -> {a:1,b:2}
     *
     ***/
    'select': function (obj) {
      return selectFromObject(obj, arguments, true);
    },

    /***
     * @method reject(<obj>, <find>, ...)
     * @returns Object
     * @short Builds a new object containing all values except those specified in <find>.
     * @extra When <find> is a string, that single key will be rejected. It can also be a regex, rejecting any key that matches, or an object which will match if the key also exists in that object, effectively "subtracting" that object. Multiple selections may also be passed as an array or directly as enumerated arguments. %reject% is available as an instance method on extended objects.
     * @example
     *
     *   Object.reject({a:1,b:2}, 'a')        -> {b:2}
     *   Object.reject({a:1,b:2}, /[a-z]/)    -> {}
     *   Object.reject({a:1,b:2}, {a:1})      -> {b:2}
     *   Object.reject({a:1,b:2}, 'a', 'b')   -> {}
     *   Object.reject({a:1,b:2}, ['a', 'b']) -> {}
     *
     ***/
    'reject': function (obj) {
      return selectFromObject(obj, arguments, false);
    }

  });


  buildTypeMethods();
  buildObjectExtend();
  buildObjectInstanceMethods(ObjectHashMethods, Hash);


  /***
   * @package RegExp
   * @dependency core
   * @description Escaping regexes and manipulating their flags.
   *
   * Note here that methods on the RegExp class like .exec and .test will fail in the current version of SpiderMonkey being
   * used by CouchDB when using shorthand regex notation like /foo/. This is the reason for the intermixed use of shorthand
   * and compiled regexes here. If you're using JS in CouchDB, it is safer to ALWAYS compile your regexes from a string.
   *
   ***/

  extend(regexp, false, false, {

   /***
    * @method RegExp.escape(<str> = '')
    * @returns String
    * @short Escapes all RegExp tokens in a string.
    * @example
    *
    *   RegExp.escape('really?')      -> 'really\?'
    *   RegExp.escape('yes.')         -> 'yes\.'
    *   RegExp.escape('(not really)') -> '\(not really\)'
    *
    ***/
    'escape': function(str) {
      return escapeRegExp(str);
    }

  });

  extend(regexp, true, false, {

   /***
    * @method getFlags()
    * @returns String
    * @short Returns the flags of the regex as a string.
    * @example
    *
    *   /texty/gim.getFlags('testy') -> 'gim'
    *
    ***/
    'getFlags': function() {
      return getRegExpFlags(this);
    },

   /***
    * @method setFlags(<flags>)
    * @returns RegExp
    * @short Sets the flags on a regex and retuns a copy.
    * @example
    *
    *   /texty/.setFlags('gim') -> now has global, ignoreCase, and multiline set
    *
    ***/
    'setFlags': function(flags) {
      return regexp(this.source, flags);
    },

   /***
    * @method addFlag(<flag>)
    * @returns RegExp
    * @short Adds <flag> to the regex.
    * @example
    *
    *   /texty/.addFlag('g') -> now has global flag set
    *
    ***/
    'addFlag': function(flag) {
      return this.setFlags(getRegExpFlags(this, flag));
    },

   /***
    * @method removeFlag(<flag>)
    * @returns RegExp
    * @short Removes <flag> from the regex.
    * @example
    *
    *   /texty/g.removeFlag('g') -> now has global flag removed
    *
    ***/
    'removeFlag': function(flag) {
      return this.setFlags(getRegExpFlags(this).replace(flag, ''));
    }

  });



  /***
   * @package String
   * @dependency core
   * @description String manupulation, escaping, encoding, truncation, and:conversion.
   *
   ***/

  function getAcronym(word) {
    var inflector = string.Inflector;
    var word = inflector && inflector.acronyms[word];
    if(isString(word)) {
      return word;
    }
  }

  function padString(str, p, left, right) {
    var padding = string(p);
    if(padding != p) {
      padding = '';
    }
    if(!isNumber(left))  left = 1;
    if(!isNumber(right)) right = 1;
    return padding.repeat(left) + str + padding.repeat(right);
  }

  function chr(num) {
    return string.fromCharCode(num);
  }

  var btoa, atob;

  function buildBase64(key) {
    if(this.btoa) {
      btoa = this.btoa;
      atob = this.atob;
      return;
    }
    var base64reg = /[^A-Za-z0-9\+\/\=]/g;
    btoa = function(str) {
      var output = '';
      var chr1, chr2, chr3;
      var enc1, enc2, enc3, enc4;
      var i = 0;
      do {
        chr1 = str.charCodeAt(i++);
        chr2 = str.charCodeAt(i++);
        chr3 = str.charCodeAt(i++);
        enc1 = chr1 >> 2;
        enc2 = ((chr1 & 3) << 4) | (chr2 >> 4);
        enc3 = ((chr2 & 15) << 2) | (chr3 >> 6);
        enc4 = chr3 & 63;
        if (isNaN(chr2)) {
          enc3 = enc4 = 64;
        } else if (isNaN(chr3)) {
          enc4 = 64;
        }
        output = output + key.charAt(enc1) + key.charAt(enc2) + key.charAt(enc3) + key.charAt(enc4);
        chr1 = chr2 = chr3 = '';
        enc1 = enc2 = enc3 = enc4 = '';
      } while (i < str.length);
      return output;
    }
    atob = function(input) {
      var output = '';
      var chr1, chr2, chr3;
      var enc1, enc2, enc3, enc4;
      var i = 0;
      if(input.match(base64reg)) {
        throw new Error('String contains invalid base64 characters');
      }
      input = input.replace(/[^A-Za-z0-9\+\/\=]/g, '');
      do {
        enc1 = key.indexOf(input.charAt(i++));
        enc2 = key.indexOf(input.charAt(i++));
        enc3 = key.indexOf(input.charAt(i++));
        enc4 = key.indexOf(input.charAt(i++));
        chr1 = (enc1 << 2) | (enc2 >> 4);
        chr2 = ((enc2 & 15) << 4) | (enc3 >> 2);
        chr3 = ((enc3 & 3) << 6) | enc4;
        output = output + chr(chr1);
        if (enc3 != 64) {
          output = output + chr(chr2);
        }
        if (enc4 != 64) {
          output = output + chr(chr3);
        }
        chr1 = chr2 = chr3 = '';
        enc1 = enc2 = enc3 = enc4 = '';
      } while (i < input.length);
      return output;
    }
  }


  extend(string, true, function(reg) { return isRegExp(reg) || arguments.length > 2; }, {

    /***
     * @method startsWith(<find>, [pos] = 0, [case] = true)
     * @returns Boolean
     * @short Returns true if the string starts with <find>.
     * @extra <find> may be either a string or regex. Search begins at [pos], which defaults to the entire string. Case sensitive if [case] is true.
     * @example
     *
     *   'hello'.startsWith('hell')           -> true
     *   'hello'.startsWith(/[a-h]/)          -> true
     *   'hello'.startsWith('HELL')           -> false
     *   'hello'.startsWith('ell', 1)         -> true
     *   'hello'.startsWith('HELL', 0, false) -> true
     *
     ***/
    'startsWith': function(reg, pos, c) {
      var str = this, source;
      if(pos) str = str.slice(pos);
      if(isUndefined(c)) c = true;
      source = isRegExp(reg) ? reg.source.replace('^', '') : escapeRegExp(reg);
      return regexp('^' + source, c ? '' : 'i').test(str);
    },

    /***
     * @method endsWith(<find>, [pos] = length, [case] = true)
     * @returns Boolean
     * @short Returns true if the string ends with <find>.
     * @extra <find> may be either a string or regex. Search ends at [pos], which defaults to the entire string. Case sensitive if [case] is true.
     * @example
     *
     *   'jumpy'.endsWith('py')            -> true
     *   'jumpy'.endsWith(/[q-z]/)         -> true
     *   'jumpy'.endsWith('MPY')           -> false
     *   'jumpy'.endsWith('mp', 4)         -> false
     *   'jumpy'.endsWith('MPY', 5, false) -> true
     *
     ***/
    'endsWith': function(reg, pos, c) {
      var str = this, source;
      if(isDefined(pos)) str = str.slice(0, pos);
      if(isUndefined(c)) c = true;
      source = isRegExp(reg) ? reg.source.replace('$', '') : escapeRegExp(reg);
      return regexp(source + '$', c ? '' : 'i').test(str);
    }

  });


  extend(string, true, false, {

     /***
      * @method escapeRegExp()
      * @returns String
      * @short Escapes all RegExp tokens in the string.
      * @example
      *
      *   'really?'.escapeRegExp()       -> 'really\?'
      *   'yes.'.escapeRegExp()         -> 'yes\.'
      *   '(not really)'.escapeRegExp() -> '\(not really\)'
      *
      ***/
    'escapeRegExp': function() {
      return escapeRegExp(this);
    },

     /***
      * @method escapeURL([param] = false)
      * @returns String
      * @short Escapes characters in a string to make a valid URL.
      * @extra If [param] is true, it will also escape valid URL characters for use as a URL parameter.
      * @example
      *
      *   'http://foo.com/"bar"'.escapeURL()     -> 'http://foo.com/%22bar%22'
      *   'http://foo.com/"bar"'.escapeURL(true) -> 'http%3A%2F%2Ffoo.com%2F%22bar%22'
      *
      ***/
    'escapeURL': function(param) {
      return param ? encodeURIComponent(this) : encodeURI(this);
    },

     /***
      * @method unescapeURL([partial] = false)
      * @returns String
      * @short Restores escaped characters in a URL escaped string.
      * @extra If [partial] is true, it will only unescape non-valid URL characters. [partial] is included here for completeness, but should very rarely be needed.
      * @example
      *
      *   'http%3A%2F%2Ffoo.com%2Fthe%20bar'.unescapeURL()     -> 'http://foo.com/the bar'
      *   'http%3A%2F%2Ffoo.com%2Fthe%20bar'.unescapeURL(true) -> 'http%3A%2F%2Ffoo.com%2Fthe bar'
      *
      ***/
    'unescapeURL': function(param) {
      return param ? decodeURI(this) : decodeURIComponent(this);
    },

     /***
      * @method escapeHTML()
      * @returns String
      * @short Converts HTML characters to their entity equivalents.
      * @example
      *
      *   '<p>some text</p>'.escapeHTML() -> '&lt;p&gt;some text&lt;/p&gt;'
      *   'one & two'.escapeHTML()        -> 'one &amp; two'
      *
      ***/
    'escapeHTML': function() {
      return this.replace(/&/g,  '&amp;' )
                 .replace(/</g,  '&lt;'  )
                 .replace(/>/g,  '&gt;'  )
                 .replace(/"/g,  '&quot;')
                 .replace(/'/g,  '&apos;')
                 .replace(/\//g, '&#x2f;');
    },

     /***
      * @method unescapeHTML([partial] = false)
      * @returns String
      * @short Restores escaped HTML characters.
      * @example
      *
      *   '&lt;p&gt;some text&lt;/p&gt;'.unescapeHTML() -> '<p>some text</p>'
      *   'one &amp; two'.unescapeHTML()                -> 'one & two'
      *
      ***/
    'unescapeHTML': function() {
      return this.replace(/&lt;/g,   '<')
                 .replace(/&gt;/g,   '>')
                 .replace(/&quot;/g, '"')
                 .replace(/&apos;/g, "'")
                 .replace(/&#x2f;/g, '/')
                 .replace(/&amp;/g,  '&');
    },

     /***
      * @method encodeBase64()
      * @returns String
      * @short Encodes the string into base64 encoding.
      * @extra This method wraps the browser native %btoa% when available, and uses a custom implementation when not available.
      * @example
      *
      *   'gonna get encoded!'.encodeBase64()  -> 'Z29ubmEgZ2V0IGVuY29kZWQh'
      *   'http://twitter.com/'.encodeBase64() -> 'aHR0cDovL3R3aXR0ZXIuY29tLw=='
      *
      ***/
    'encodeBase64': function() {
      return btoa(this);
    },

     /***
      * @method decodeBase64()
      * @returns String
      * @short Decodes the string from base64 encoding.
      * @extra This method wraps the browser native %atob% when available, and uses a custom implementation when not available.
      * @example
      *
      *   'aHR0cDovL3R3aXR0ZXIuY29tLw=='.decodeBase64() -> 'http://twitter.com/'
      *   'anVzdCBnb3QgZGVjb2RlZA=='.decodeBase64()     -> 'just got decoded!'
      *
      ***/
    'decodeBase64': function() {
      return atob(this);
    },

    /***
     * @method each([search] = single character, [fn])
     * @returns Array
     * @short Runs callback [fn] against each occurence of [search].
     * @extra Returns an array of matches. [search] may be either a string or regex, and defaults to every character in the string.
     * @example
     *
     *   'jumpy'.each() -> ['j','u','m','p','y']
     *   'jumpy'.each(/[r-z]/) -> ['u','y']
     *   'jumpy'.each(/[r-z]/, function(m) {
     *     // Called twice: "u", "y"
     *   });
     *
     ***/
    'each': function(search, fn) {
      var match, i, len;
      if(isFunction(search)) {
        fn = search;
        search = /[\s\S]/g;
      } else if(!search) {
        search = /[\s\S]/g
      } else if(isString(search)) {
        search = regexp(escapeRegExp(search), 'gi');
      } else if(isRegExp(search)) {
        search = regexp(search.source, getRegExpFlags(search, 'g'));
      }
      match = this.match(search) || [];
      if(fn) {
        for(i = 0, len = match.length; i < len; i++) {
          match[i] = fn.call(this, match[i], i, match) || match[i];
        }
      }
      return match;
    },

    /***
     * @method shift(<n>)
     * @returns Array
     * @short Shifts each character in the string <n> places in the character map.
     * @example
     *
     *   'a'.shift(1)  -> 'b'
     *   'ク'.shift(1) -> 'グ'
     *
     ***/
    'shift': function(n) {
      var result = '';
      n = n || 0;
      this.codes(function(c) {
        result += chr(c + n);
      });
      return result;
    },

    /***
     * @method codes([fn])
     * @returns Array
     * @short Runs callback [fn] against each character code in the string. Returns an array of character codes.
     * @example
     *
     *   'jumpy'.codes() -> [106,117,109,112,121]
     *   'jumpy'.codes(function(c) {
     *     // Called 5 times: 106, 117, 109, 112, 121
     *   });
     *
     ***/
    'codes': function(fn) {
      var codes = [], i, len;
      for(i = 0, len = this.length; i < len; i++) {
        var code = this.charCodeAt(i);
        codes.push(code);
        if(fn) fn.call(this, code, i);
      }
      return codes;
    },

    /***
     * @method chars([fn])
     * @returns Array
     * @short Runs callback [fn] against each character in the string. Returns an array of characters.
     * @example
     *
     *   'jumpy'.chars() -> ['j','u','m','p','y']
     *   'jumpy'.chars(function(c) {
     *     // Called 5 times: "j","u","m","p","y"
     *   });
     *
     ***/
    'chars': function(fn) {
      return this.each(fn);
    },

    /***
     * @method words([fn])
     * @returns Array
     * @short Runs callback [fn] against each word in the string. Returns an array of words.
     * @extra A "word" here is defined as any sequence of non-whitespace characters.
     * @example
     *
     *   'broken wear'.words() -> ['broken','wear']
     *   'broken wear'.words(function(w) {
     *     // Called twice: "broken", "wear"
     *   });
     *
     ***/
    'words': function(fn) {
      return this.trim().each(/\S+/g, fn);
    },

    /***
     * @method lines([fn])
     * @returns Array
     * @short Runs callback [fn] against each line in the string. Returns an array of lines.
     * @example
     *
     *   'broken wear\nand\njumpy jump'.lines() -> ['broken wear','and','jumpy jump']
     *   'broken wear\nand\njumpy jump'.lines(function(l) {
     *     // Called three times: "broken wear", "and", "jumpy jump"
     *   });
     *
     ***/
    'lines': function(fn) {
      return this.trim().each(/^.*$/gm, fn);
    },

    /***
     * @method paragraphs([fn])
     * @returns Array
     * @short Runs callback [fn] against each paragraph in the string. Returns an array of paragraphs.
     * @extra A paragraph here is defined as a block of text bounded by two or more line breaks.
     * @example
     *
     *   'Once upon a time.\n\nIn the land of oz...'.paragraphs() -> ['Once upon a time.','In the land of oz...']
     *   'Once upon a time.\n\nIn the land of oz...'.paragraphs(function(p) {
     *     // Called twice: "Once upon a time.", "In teh land of oz..."
     *   });
     *
     ***/
    'paragraphs': function(fn) {
      var paragraphs = this.trim().split(/[\r\n]{2,}/);
      paragraphs = paragraphs.map(function(p) {
        if(fn) var s = fn.call(p);
        return s ? s : p;
      });
      return paragraphs;
    },

    /***
     * @method isBlank()
     * @returns Boolean
     * @short Returns true if the string has a length of 0 or contains only whitespace.
     * @example
     *
     *   ''.isBlank()      -> true
     *   '   '.isBlank()   -> true
     *   'noway'.isBlank() -> false
     *
     ***/
    'isBlank': function() {
      return this.trim().length === 0;
    },

    /***
     * @method has(<find>)
     * @returns Boolean
     * @short Returns true if the string matches <find>.
     * @extra <find> may be a string or regex.
     * @example
     *
     *   'jumpy'.has('py')     -> true
     *   'broken'.has(/[a-n]/) -> true
     *   'broken'.has(/[s-z]/) -> false
     *
     ***/
    'has': function(find) {
      return this.search(isRegExp(find) ? find : escapeRegExp(find)) !== -1;
    },


    /***
     * @method add(<str>, [index] = length)
     * @returns String
     * @short Adds <str> at [index]. Negative values are also allowed.
     * @extra %insert% is provided as an alias, and is generally more readable when using an index.
     * @example
     *
     *   'schfifty'.add(' five')      -> schfifty five
     *   'dopamine'.insert('e', 3)       -> dopeamine
     *   'spelling eror'.insert('r', -3) -> spelling error
     *
     ***/
    'add': function(str, index) {
      index = isUndefined(index) ? this.length : index;
      return this.slice(0, index) + str + this.slice(index);
    },

    /***
     * @method remove(<f>)
     * @returns String
     * @short Removes any part of the string that matches <f>.
     * @extra <f> can be a string or a regex.
     * @example
     *
     *   'schfifty five'.remove('f')     -> 'schity ive'
     *   'schfifty five'.remove(/[a-f]/g) -> 'shity iv'
     *
     ***/
    'remove': function(f) {
      return this.replace(f, '');
    },

    /***
     * @method reverse()
     * @returns String
     * @short Reverses the string.
     * @example
     *
     *   'jumpy'.reverse()        -> 'ypmuj'
     *   'lucky charms'.reverse() -> 'smrahc ykcul'
     *
     ***/
    'reverse': function() {
      return this.split('').reverse().join('');
    },

    /***
     * @method compact()
     * @returns String
     * @short Compacts all white space in the string to a single space and trims the ends.
     * @example
     *
     *   'too \n much \n space'.compact() -> 'too much space'
     *   'enough \n '.compact()           -> 'enought'
     *
     ***/
    'compact': function() {
      return this.trim().replace(/([\r\n\s　])+/g, function(match, whitespace){
        return whitespace === '　' ? whitespace : ' ';
      });
    },

    /***
     * @method at(<index>, [loop] = true)
     * @returns String or Array
     * @short Gets the character(s) at a given index.
     * @extra When [loop] is true, overshooting the end of the string (or the beginning) will begin counting from the other end. As an alternate syntax, passing multiple indexes will get the characters at those indexes.
     * @example
     *
     *   'jumpy'.at(0)               -> 'j'
     *   'jumpy'.at(2)               -> 'm'
     *   'jumpy'.at(5)               -> 'j'
     *   'jumpy'.at(5, false)        -> ''
     *   'jumpy'.at(-1)              -> 'y'
     *   'lucky charms'.at(2,4,6,8) -> ['u','k','y',c']
     *
     ***/
    'at': function() {
      return entryAtIndex(this, arguments, true);
    },

    /***
     * @method from([index] = 0)
     * @returns String
     * @short Returns a section of the string starting from [index].
     * @example
     *
     *   'lucky charms'.from()   -> 'lucky charms'
     *   'lucky charms'.from(7)  -> 'harms'
     *
     ***/
    'from': function(num) {
      return this.slice(num);
    },

    /***
     * @method to([index] = end)
     * @returns String
     * @short Returns a section of the string ending at [index].
     * @example
     *
     *   'lucky charms'.to()   -> 'lucky charms'
     *   'lucky charms'.to(7)  -> 'lucky ch'
     *
     ***/
    'to': function(num) {
      if(isUndefined(num)) num = this.length;
      return this.slice(0, num);
    },

    /***
     * @method dasherize()
     * @returns String
     * @short Converts underscores and camel casing to hypens.
     * @example
     *
     *   'a_farewell_to_arms'.dasherize() -> 'a-farewell-to-arms'
     *   'capsLock'.dasherize()           -> 'caps-lock'
     *
     ***/
    'dasherize': function() {
      return this.underscore().replace(/_/g, '-');
    },

    /***
     * @method underscore()
     * @returns String
     * @short Converts hyphens and camel casing to underscores.
     * @example
     *
     *   'a-farewell-to-arms'.underscore() -> 'a_farewell_to_arms'
     *   'capsLock'.underscore()           -> 'caps_lock'
     *
     ***/
    'underscore': function() {
      return this
        .replace(/[-\s]+/g, '_')
        .replace(string.Inflector && string.Inflector.acronymRegExp, function(acronym, index) {
          return (index > 0 ? '_' : '') + acronym.toLowerCase();
        })
        .replace(/([A-Z\d]+)([A-Z][a-z])/g,'$1_$2')
        .replace(/([a-z\d])([A-Z])/g,'$1_$2')
        .toLowerCase();
    },

    /***
     * @method camelize([first] = true)
     * @returns String
     * @short Converts underscores and hyphens to camel case. If [first] is true the first letter will also be capitalized.
     * @extra If the Inflections package is included acryonyms can also be defined that will be used when camelizing.
     * @example
     *
     *   'caps_lock'.camelize()              -> 'CapsLock'
     *   'moz-border-radius'.camelize()      -> 'MozBorderRadius'
     *   'moz-border-radius'.camelize(false) -> 'mozBorderRadius'
     *
     ***/
    'camelize': function(first) {
      return this.underscore().replace(/(^|_)([^_]+)/g, function(match, pre, word, index) {
        var acronym = getAcronym(word), capitalize = first !== false || index > 0;
        if(acronym) return capitalize ? acronym : acronym.toLowerCase();
        return capitalize ? word.capitalize() : word;
      });
    },

    /***
     * @method spacify()
     * @returns String
     * @short Converts camel case, underscores, and hyphens to a properly spaced string.
     * @example
     *
     *   'camelCase'.spacify()                         -> 'camel case'
     *   'an-ugly-string'.spacify()                    -> 'an ugly string'
     *   'oh-no_youDid-not'.spacify().capitalize(true) -> 'something else'
     *
     ***/
    'spacify': function() {
      return this.underscore().replace(/_/g, ' ');
    },

    /***
     * @method stripTags([tag1], [tag2], ...)
     * @returns String
     * @short Strips all HTML tags from the string.
     * @extra Tags to strip may be enumerated in the parameters, otherwise will strip all.
     * @example
     *
     *   '<p>just <b>some</b> text</p>'.stripTags()    -> 'just some text'
     *   '<p>just <b>some</b> text</p>'.stripTags('p') -> 'just <b>some</b> text'
     *
     ***/
    'stripTags': function() {
      var str = this, args = arguments.length > 0 ? arguments : [''];
      flattenedArgs(args, function(tag) {
        str = str.replace(regexp('<\/?' + escapeRegExp(tag) + '[^<>]*>', 'gi'), '');
      });
      return str;
    },

    /***
     * @method removeTags([tag1], [tag2], ...)
     * @returns String
     * @short Removes all HTML tags and their contents from the string.
     * @extra Tags to remove may be enumerated in the parameters, otherwise will remove all.
     * @example
     *
     *   '<p>just <b>some</b> text</p>'.removeTags()    -> ''
     *   '<p>just <b>some</b> text</p>'.removeTags('b') -> '<p>just text</p>'
     *
     ***/
    'removeTags': function() {
      var str = this, args = arguments.length > 0 ? arguments : ['\\S+'];
      flattenedArgs(args, function(t) {
        var reg = regexp('<(' + t + ')[^<>]*(?:\\/>|>.*?<\\/\\1>)', 'gi');
        str = str.replace(reg, '');
      });
      return str;
    },

    /***
     * @method truncate(<length>, [split] = true, [from] = 'right', [ellipsis] = '...')
     * @returns String
     * @short Truncates a string.
     * @extra If [split] is %false%, will not split words up, and instead discard the word where the truncation occurred. [from] can also be %"middle"% or %"left"%.
     * @example
     *
     *   'just sittin on the dock of the bay'.truncate(20)                 -> 'just sittin on the do...'
     *   'just sittin on the dock of the bay'.truncate(20, false)          -> 'just sittin on the...'
     *   'just sittin on the dock of the bay'.truncate(20, true, 'middle') -> 'just sitt...of the bay'
     *   'just sittin on the dock of the bay'.truncate(20, true, 'left')   -> '...the dock of the bay'
     *
     ***/
    'truncate': function(length, split, from, ellipsis) {
      var pos,
        prepend = '',
        append = '',
        str = this.toString(),
        chars = '[' + getTrimmableCharacters() + ']+',
        space = '[^' + getTrimmableCharacters() + ']*',
        reg = regexp(chars + space + '$');
      ellipsis = isUndefined(ellipsis) ? '...' : string(ellipsis);
      if(str.length <= length) {
        return str;
      }
      switch(from) {
        case 'left':
          pos = str.length - length;
          prepend = ellipsis;
          str = str.slice(pos);
          reg = regexp('^' + space + chars);
          break;
        case 'middle':
          pos    = floor(length / 2);
          append = ellipsis + str.slice(str.length - pos).trimLeft();
          str    = str.slice(0, pos);
          break;
        default:
          pos = length;
          append = ellipsis;
          str = str.slice(0, pos);
      }
      if(split === false && this.slice(pos, pos + 1).match(/\S/)) {
        str = str.remove(reg);
      }
      return prepend + str + append;
    },

    /***
     * @method pad[Side](<padding> = '', [num] = 1)
     * @returns String
     * @short Pads either/both sides of the string.
     * @extra [num] is the number of characters on each side, and [padding] is the character to pad with.
     *
     * @set
     *   pad
     *   padLeft
     *   padRight
     *
     * @example
     *
     *   'wasabi'.pad('-')         -> '-wasabi-'
     *   'wasabi'.pad('-', 2)      -> '--wasabi--'
     *   'wasabi'.padLeft('-', 2)  -> '--wasabi'
     *   'wasabi'.padRight('-', 2) -> 'wasabi--'
     *
     ***/
    'pad': function(padding, num) {
      return repeatString(num, padding) + this + repeatString(num, padding);
    },

    'padLeft': function(padding, num) {
      return repeatString(num, padding) + this;
    },

    'padRight': function(padding, num) {
      return this + repeatString(num, padding);
    },

    /***
     * @method first([n] = 1)
     * @returns String
     * @short Returns the first [n] characters of the string.
     * @example
     *
     *   'lucky charms'.first()   -> 'l'
     *   'lucky charms'.first(3)  -> 'luc'
     *
     ***/
    'first': function(num) {
      if(isUndefined(num)) num = 1;
      return this.substr(0, num);
    },

    /***
     * @method last([n] = 1)
     * @returns String
     * @short Returns the last [n] characters of the string.
     * @example
     *
     *   'lucky charms'.last()   -> 's'
     *   'lucky charms'.last(3)  -> 'rms'
     *
     ***/
    'last': function(num) {
      if(isUndefined(num)) num = 1;
      var start = this.length - num < 0 ? 0 : this.length - num;
      return this.substr(start);
    },

    /***
     * @method repeat([num] = 0)
     * @returns String
     * @short Returns the string repeated [num] times.
     * @example
     *
     *   'jumpy'.repeat(2) -> 'jumpyjumpy'
     *   'a'.repeat(5)     -> 'aaaaa'
     *   'a'.repeat(0)     -> ''
     *
     ***/
    'repeat': function(num) {
      var result = '', str = this;
      if(!isNumber(num) || num < 1) return '';
      while (num) {
        if (num & 1) {
          result += str;
        }
        if (num >>= 1) {
          str += str;
        }
      }
      return result;
    },

    /***
     * @method toNumber([base] = 10)
     * @returns Number
     * @short Converts the string into a number.
     * @extra Any value with a "." fill be converted to a floating point value, otherwise an integer.
     * @example
     *
     *   '153'.toNumber()    -> 153
     *   '12,000'.toNumber() -> 12000
     *   '10px'.toNumber()   -> 10
     *   'ff'.toNumber(16)   -> 255
     *
     ***/
    'toNumber': function(base) {
      var str = this.replace(/,/g, '');
      return str.match(/\./) ? parseFloat(str) : parseInt(str, base || 10);
    },

    /***
     * @method capitalize([all] = false)
     * @returns String
     * @short Capitalizes the first character in the string.
     * @extra If [all] is true, all words in the string will be capitalized.
     * @example
     *
     *   'hello'.capitalize()           -> 'Hello'
     *   'hello kitty'.capitalize()     -> 'Hello kitty'
     *   'hello kitty'.capitalize(true) -> 'Hello Kitty'
     *
     *
     ***/
    'capitalize': function(all) {
      var lastResponded;
      return this.toLowerCase().replace(all ? /[\s\S]/g : /^\S/, function(lower) {
        var upper = lower.toUpperCase(), result;
        result = lastResponded ? lower : upper;
        lastResponded = upper !== lower;
        return result;
      });
    },

    /***
     * @method assign(<obj1>, <obj2>, ...)
     * @returns String
     * @short Assigns variables to tokens in a string.
     * @extra If an object is passed, it's properties can be assigned using the object's keys. If a non-object (string, number, etc.) is passed it can be accessed by the argument number beginning with 1 (as with regex tokens). Multiple objects can be passed and will be merged together (original objects are unaffected).
     * @example
     *
     *   'Welcome, Mr. {name}.'.assign({ name: 'Franklin' })   -> 'Welcome, Mr. Franklin.'
     *   'You are {1} years old today.'.assign(14)             -> 'You are 14 years old today.'
     *   '{n} and {r}'.assign({ n: 'Cheech' }, { r: 'Chong' }) -> 'Cheech and Chong'
     *
     ***/
    'assign': function() {
      var assign = {};
      multiArgs(arguments, function(a, i) {
        if(isObject(a)) {
          simpleMerge(assign, a);
        } else {
          assign[i + 1] = a;
        }
      });
      return this.replace(/\{([^{]+?)\}/g, function(m, key) {
        return hasOwnProperty(assign, key) ? assign[key] : m;
      });
    }

  });


  // Aliases

  extend(string, true, false, {

    /***
     * @method insert()
     * @alias add
     *
     ***/
    'insert': string.prototype.add
  });

  buildBase64('ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=');


  /***
   *
   * @package Inflections
   * @dependency string
   * @description Pluralization similar to ActiveSupport including uncountable words and acronyms. Humanized and URL-friendly strings.
   *
   ***/

  /***
   * String module
   *
   ***/


  var plurals      = [],
      singulars    = [],
      uncountables = [],
      humans       = [],
      acronyms     = {},
      Downcased,
      Inflector;

  function removeFromArray(arr, find) {
    var index = arr.indexOf(find);
    if(index > -1) {
      arr.splice(index, 1);
    }
  }

  function removeFromUncountablesAndAddTo(arr, rule, replacement) {
    if(isString(rule)) {
      removeFromArray(uncountables, rule);
    }
    removeFromArray(uncountables, replacement);
    arr.unshift({ rule: rule, replacement: replacement })
  }

  function paramMatchesType(param, type) {
    return param == type || param == 'all' || !param;
  }

  function isUncountable(word) {
    return uncountables.some(function(uncountable) {
      return new regexp('\\b' + uncountable + '$', 'i').test(word);
    });
  }

  function inflect(word, pluralize) {
    word = isString(word) ? word.toString() : '';
    if(word.isBlank() || isUncountable(word)) {
      return word;
    } else {
      return runReplacements(word, pluralize ? plurals : singulars);
    }
  }

  function runReplacements(word, table) {
    iterateOverObject(table, function(i, inflection) {
      if(word.match(inflection.rule)) {
        word = word.replace(inflection.rule, inflection.replacement);
        return false;
      }
    });
    return word;
  }

  function capitalize(word) {
    return word.replace(/^\W*[a-z]/, function(w){
      return w.toUpperCase();
    });
  }

  Inflector = {

    /*
     * Specifies a new acronym. An acronym must be specified as it will appear in a camelized string.  An underscore
     * string that contains the acronym will retain the acronym when passed to %camelize%, %humanize%, or %titleize%.
     * A camelized string that contains the acronym will maintain the acronym when titleized or humanized, and will
     * convert the acronym into a non-delimited single lowercase word when passed to String#underscore.
     *
     * Examples:
     *   String.Inflector.acronym('HTML')
     *   'html'.titleize()     -> 'HTML'
     *   'html'.camelize()     -> 'HTML'
     *   'MyHTML'.underscore() -> 'my_html'
     *
     * The acronym, however, must occur as a delimited unit and not be part of another word for conversions to recognize it:
     *
     *   String.Inflector.acronym('HTTP')
     *   'my_http_delimited'.camelize() -> 'MyHTTPDelimited'
     *   'https'.camelize()             -> 'Https', not 'HTTPs'
     *   'HTTPS'.underscore()           -> 'http_s', not 'https'
     *
     *   String.Inflector.acronym('HTTPS')
     *   'https'.camelize()   -> 'HTTPS'
     *   'HTTPS'.underscore() -> 'https'
     *
     * Note: Acronyms that are passed to %pluralize% will no longer be recognized, since the acronym will not occur as
     * a delimited unit in the pluralized result. To work around this, you must specify the pluralized form as an
     * acronym as well:
     *
     *    String.Inflector.acronym('API')
     *    'api'.pluralize().camelize() -> 'Apis'
     *
     *    String.Inflector.acronym('APIs')
     *    'api'.pluralize().camelize() -> 'APIs'
     *
     * %acronym% may be used to specify any word that contains an acronym or otherwise needs to maintain a non-standard
     * capitalization. The only restriction is that the word must begin with a capital letter.
     *
     * Examples:
     *   String.Inflector.acronym('RESTful')
     *   'RESTful'.underscore()           -> 'restful'
     *   'RESTfulController'.underscore() -> 'restful_controller'
     *   'RESTfulController'.titleize()   -> 'RESTful Controller'
     *   'restful'.camelize()             -> 'RESTful'
     *   'restful_controller'.camelize()  -> 'RESTfulController'
     *
     *   String.Inflector.acronym('McDonald')
     *   'McDonald'.underscore() -> 'mcdonald'
     *   'mcdonald'.camelize()   -> 'McDonald'
     */
    'acronym': function(word) {
      acronyms[word.toLowerCase()] = word;
      var all = object.keys(acronyms).map(function(key) {
        return acronyms[key];
      });
      Inflector.acronymRegExp = regexp(all.join('|'), 'g');
    },

    /*
     * Specifies a new pluralization rule and its replacement. The rule can either be a string or a regular expression.
     * The replacement should always be a string that may include references to the matched data from the rule.
     */
    'plural': function(rule, replacement) {
      removeFromUncountablesAndAddTo(plurals, rule, replacement);
    },

    /*
     * Specifies a new singularization rule and its replacement. The rule can either be a string or a regular expression.
     * The replacement should always be a string that may include references to the matched data from the rule.
     */
    'singular': function(rule, replacement) {
      removeFromUncountablesAndAddTo(singulars, rule, replacement);
    },

    /*
     * Specifies a new irregular that applies to both pluralization and singularization at the same time. This can only be used
     * for strings, not regular expressions. You simply pass the irregular in singular and plural form.
     *
     * Examples:
     *   String.Inflector.irregular('octopus', 'octopi')
     *   String.Inflector.irregular('person', 'people')
     */
    'irregular': function(singular, plural) {
      var singularFirst      = singular.first(),
          singularRest       = singular.from(1),
          pluralFirst        = plural.first(),
          pluralRest         = plural.from(1),
          pluralFirstUpper   = pluralFirst.toUpperCase(),
          pluralFirstLower   = pluralFirst.toLowerCase(),
          singularFirstUpper = singularFirst.toUpperCase(),
          singularFirstLower = singularFirst.toLowerCase();
      removeFromArray(uncountables, singular);
      removeFromArray(uncountables, plural);
      if(singularFirstUpper == pluralFirstUpper) {
        Inflector.plural(new regexp('({1}){2}$'.assign(singularFirst, singularRest), 'i'), '$1' + pluralRest);
        Inflector.plural(new regexp('({1}){2}$'.assign(pluralFirst, pluralRest), 'i'), '$1' + pluralRest);
        Inflector.singular(new regexp('({1}){2}$'.assign(pluralFirst, pluralRest), 'i'), '$1' + singularRest);
      } else {
        Inflector.plural(new regexp('{1}{2}$'.assign(singularFirstUpper, singularRest)), pluralFirstUpper + pluralRest);
        Inflector.plural(new regexp('{1}{2}$'.assign(singularFirstLower, singularRest)), pluralFirstLower + pluralRest);
        Inflector.plural(new regexp('{1}{2}$'.assign(pluralFirstUpper, pluralRest)), pluralFirstUpper + pluralRest);
        Inflector.plural(new regexp('{1}{2}$'.assign(pluralFirstLower, pluralRest)), pluralFirstLower + pluralRest);
        Inflector.singular(new regexp('{1}{2}$'.assign(pluralFirstUpper, pluralRest)), singularFirstUpper + singularRest);
        Inflector.singular(new regexp('{1}{2}$'.assign(pluralFirstLower, pluralRest)), singularFirstLower + singularRest);
      }
    },

    /*
     * Add uncountable words that shouldn't be attempted inflected.
     *
     * Examples:
     *   String.Inflector.uncountable('money')
     *   String.Inflector.uncountable('money', 'information')
     *   String.Inflector.uncountable(['money', 'information', 'rice'])
     */
    'uncountable': function(first) {
      var add = array.isArray(first) ? first : multiArgs(arguments);
      uncountables = uncountables.concat(add);
    },

    /*
     * Specifies a humanized form of a string by a regular expression rule or by a string mapping.
     * When using a regular expression based replacement, the normal humanize formatting is called after the replacement.
     * When a string is used, the human form should be specified as desired (example: 'The name', not 'the_name')
     *
     * Examples:
     *   String.Inflector.human(/_cnt$/i, '_count')
     *   String.Inflector.human('legacy_col_person_name', 'Name')
     */
    'human': function(rule, replacement) {
      humans.unshift({ rule: rule, replacement: replacement })
    },


    /*
     * Clears the loaded inflections within a given scope (default is 'all').
     * Options are: 'all', 'plurals', 'singulars', 'uncountables', 'humans'.
     *
     * Examples:
     *   String.Inflector.clear('all')
     *   String.Inflector.clear('plurals')
     */
    'clear': function(type) {
      if(paramMatchesType(type, 'singulars'))    singulars    = [];
      if(paramMatchesType(type, 'plurals'))      plurals      = [];
      if(paramMatchesType(type, 'uncountables')) uncountables = [];
      if(paramMatchesType(type, 'humans'))       humans       = [];
      if(paramMatchesType(type, 'acronyms'))     acronyms     = {};
    }

  };

  Downcased = [
    'and', 'or', 'nor', 'a', 'an', 'the', 'so', 'but', 'to', 'of', 'at',
    'by', 'from', 'into', 'on', 'onto', 'off', 'out', 'in', 'over',
    'with', 'for'
  ];

  Inflector.plural(/$/, 's');
  Inflector.plural(/s$/gi, 's');
  Inflector.plural(/(ax|test)is$/gi, '$1es');
  Inflector.plural(/(octop|vir|fung|foc|radi|alumn)(i|us)$/gi, '$1i');
  Inflector.plural(/(census|alias|status)$/gi, '$1es');
  Inflector.plural(/(bu)s$/gi, '$1ses');
  Inflector.plural(/(buffal|tomat)o$/gi, '$1oes');
  Inflector.plural(/([ti])um$/gi, '$1a');
  Inflector.plural(/([ti])a$/gi, '$1a');
  Inflector.plural(/sis$/gi, 'ses');
  Inflector.plural(/f+e?$/gi, 'ves');
  Inflector.plural(/(cuff|roof)$/gi, '$1s');
  Inflector.plural(/([ht]ive)$/gi, '$1s');
  Inflector.plural(/([^aeiouy]o)$/gi, '$1es');
  Inflector.plural(/([^aeiouy]|qu)y$/gi, '$1ies');
  Inflector.plural(/(x|ch|ss|sh)$/gi, '$1es');
  Inflector.plural(/(matr|vert|ind)(?:ix|ex)$/gi, '$1ices');
  Inflector.plural(/([ml])ouse$/gi, '$1ice');
  Inflector.plural(/([ml])ice$/gi, '$1ice');
  Inflector.plural(/^(ox)$/gi, '$1en');
  Inflector.plural(/^(oxen)$/gi, '$1');
  Inflector.plural(/(quiz)$/gi, '$1zes');
  Inflector.plural(/(phot|cant|hom|zer|pian|portic|pr|quart|kimon)o$/gi, '$1os');
  Inflector.plural(/(craft)$/gi, '$1');
  Inflector.plural(/([ft])[eo]{2}(th?)$/gi, '$1ee$2');

  Inflector.singular(/s$/gi, '');
  Inflector.singular(/([pst][aiu]s)$/gi, '$1');
  Inflector.singular(/([aeiouy])ss$/gi, '$1ss');
  Inflector.singular(/(n)ews$/gi, '$1ews');
  Inflector.singular(/([ti])a$/gi, '$1um');
  Inflector.singular(/((a)naly|(b)a|(d)iagno|(p)arenthe|(p)rogno|(s)ynop|(t)he)ses$/gi, '$1$2sis');
  Inflector.singular(/(^analy)ses$/gi, '$1sis');
  Inflector.singular(/(i)(f|ves)$/i, '$1fe');
  Inflector.singular(/([aeolr]f?)(f|ves)$/i, '$1f');
  Inflector.singular(/([ht]ive)s$/gi, '$1');
  Inflector.singular(/([^aeiouy]|qu)ies$/gi, '$1y');
  Inflector.singular(/(s)eries$/gi, '$1eries');
  Inflector.singular(/(m)ovies$/gi, '$1ovie');
  Inflector.singular(/(x|ch|ss|sh)es$/gi, '$1');
  Inflector.singular(/([ml])(ous|ic)e$/gi, '$1ouse');
  Inflector.singular(/(bus)(es)?$/gi, '$1');
  Inflector.singular(/(o)es$/gi, '$1');
  Inflector.singular(/(shoe)s?$/gi, '$1');
  Inflector.singular(/(cris|ax|test)[ie]s$/gi, '$1is');
  Inflector.singular(/(octop|vir|fung|foc|radi|alumn)(i|us)$/gi, '$1us');
  Inflector.singular(/(census|alias|status)(es)?$/gi, '$1');
  Inflector.singular(/^(ox)(en)?/gi, '$1');
  Inflector.singular(/(vert|ind)(ex|ices)$/gi, '$1ex');
  Inflector.singular(/(matr)(ix|ices)$/gi, '$1ix');
  Inflector.singular(/(quiz)(zes)?$/gi, '$1');
  Inflector.singular(/(database)s?$/gi, '$1');
  Inflector.singular(/ee(th?)$/gi, 'oo$1');

  Inflector.irregular('person', 'people');
  Inflector.irregular('man', 'men');
  Inflector.irregular('child', 'children');
  Inflector.irregular('sex', 'sexes');
  Inflector.irregular('move', 'moves');
  Inflector.irregular('save', 'saves');
  Inflector.irregular('save', 'saves');
  Inflector.irregular('cow', 'kine');
  Inflector.irregular('goose', 'geese');
  Inflector.irregular('zombie', 'zombies');

  Inflector.uncountable('equipment,information,rice,money,species,series,fish,sheep,jeans'.split(','));


  extend(string, true, false, {

    /***
     * @method pluralize()
     * @returns String
     * @short Returns the plural form of the word in the string.
     * @example
     *
     *   'post'.pluralize()         -> 'posts'
     *   'octopus'.pluralize()      -> 'octopi'
     *   'sheep'.pluralize()        -> 'sheep'
     *   'words'.pluralize()        -> 'words'
     *   'CamelOctopus'.pluralize() -> 'CamelOctopi'
     *
     ***/
    'pluralize': function() {
      return inflect(this, true);
    },

    /***
     * @method singularize()
     * @returns String
     * @short The reverse of String#pluralize. Returns the singular form of a word in a string.
     * @example
     *
     *   'posts'.singularize()       -> 'post'
     *   'octopi'.singularize()      -> 'octopus'
     *   'sheep'.singularize()       -> 'sheep'
     *   'word'.singularize()        -> 'word'
     *   'CamelOctopi'.singularize() -> 'CamelOctopus'
     *
     ***/
    'singularize': function() {
      return inflect(this, false);
    },

    /***
     * @method humanize()
     * @returns String
     * @short Creates a human readable string.
     * @extra Capitalizes the first word and turns underscores into spaces and strips a trailing '_id', if any. Like String#titleize, this is meant for creating pretty output.
     * @example
     *
     *   'employee_salary'.humanize() -> 'Employee salary'
     *   'author_id'.humanize()       -> 'Author'
     *
     ***/
    'humanize': function() {
      var str = runReplacements(this, humans), acronym;
      str = str.replace(/_id$/g, '');
      str = str.replace(/(_)?([a-z\d]*)/gi, function(match, _, word){
        acronym = hasOwnProperty(acronyms, word) ? acronyms[word] : null;
        return (_ ? ' ' : '') + (acronym || word.toLowerCase());
      });
      return capitalize(str);
    },

    /***
     * @method titleize()
     * @returns String
     * @short Creates a title version of the string.
     * @extra Capitalizes all the words and replaces some characters in the string to create a nicer looking title. String#titleize is meant for creating pretty output.
     * @example
     *
     *   'man from the boondocks'.titleize() -> 'Man from the Boondocks'
     *   'x-men: the last stand'.titleize() -> 'X Men: The Last Stand'
     *   'TheManWithoutAPast'.titleize() -> 'The Man Without a Past'
     *   'raiders_of_the_lost_ark'.titleize() -> 'Raiders of the Lost Ark'
     *
     ***/
    'titleize': function() {
      var fullStopPunctuation = /[.:;!]$/, hasPunctuation, lastHadPunctuation, isFirstOrLast;
      return this.spacify().humanize().words(function(word, index, words) {
        hasPunctuation = fullStopPunctuation.test(word);
        isFirstOrLast = index == 0 || index == words.length - 1 || hasPunctuation || lastHadPunctuation;
        lastHadPunctuation = hasPunctuation;
        if(isFirstOrLast || Downcased.indexOf(word) === -1) {
          return capitalize(word);
        } else {
          return word;
        }
      }).join(' ');
    },

    /***
     * @method parameterize()
     * @returns String
     * @short Replaces special characters in a string so that it may be used as part of a pretty URL.
     * @example
     *
     *   'hell, no!'.parameterize() -> 'hell-no'
     *
     ***/
    'parameterize': function(separator) {
      var str = this;
      if(separator === undefined) separator = '-';
      if(str.normalize) {
        str = str.normalize();
      }
      str = str.replace(/[^a-z0-9\-_]+/gi, separator)
      if(separator) {
        str = str.replace(new regexp('^{sep}+|{sep}+$|({sep}){sep}+'.assign({ 'sep': escapeRegExp(separator) }), 'g'), '$1');
      }
      return encodeURI(str.toLowerCase());
    }

  });

  string.Inflector = Inflector;
  string.Inflector.acronyms = acronyms;


  /***
   *
   * @package Language
   * @dependency string
   * @description Normalizing accented characters, character width conversion, Hiragana and Katakana conversions.
   *
   ***/

  /***
   * String module
   *
   ***/



  var NormalizeMap,
      NormalizeReg = '',
      NormalizeSource;


  /***
   * @method has[Script]()
   * @returns Boolean
   * @short Returns true if the string contains any characters in that script.
   *
   * @set
   *   hasArabic
   *   hasCyrillic
   *   hasGreek
   *   hasHangul
   *   hasHan
   *   hasKanji
   *   hasHebrew
   *   hasHiragana
   *   hasKana
   *   hasKatakana
   *   hasLatin
   *   hasThai
   *   hasDevanagari
   *
   * @example
   *
   *   'أتكلم'.hasArabic()          -> true
   *   'визит'.hasCyrillic()        -> true
   *   '잘 먹겠습니다!'.hasHangul() -> true
   *   'ミックスです'.hasKatakana() -> true
   *   "l'année".hasLatin()         -> true
   *
   ***
   * @method is[Script]()
   * @returns Boolean
   * @short Returns true if the string contains only characters in that script. Whitespace is ignored.
   *
   * @set
   *   isArabic
   *   isCyrillic
   *   isGreek
   *   isHangul
   *   isHan
   *   isKanji
   *   isHebrew
   *   isHiragana
   *   isKana
   *   isKatakana
   *   isKatakana
   *   isThai
   *   isDevanagari
   *
   * @example
   *
   *   'أتكلم'.isArabic()          -> true
   *   'визит'.isCyrillic()        -> true
   *   '잘 먹겠습니다!'.isHangul() -> true
   *   'ミックスです'.isKatakana() -> false
   *   "l'année".isLatin()         -> true
   *
   ***/
  var unicodeScripts = [
    { names: ['Arabic'],      source: '\u0600-\u06FF' },
    { names: ['Cyrillic'],    source: '\u0400-\u04FF' },
    { names: ['Devanagari'],  source: '\u0900-\u097F' },
    { names: ['Greek'],       source: '\u0370-\u03FF' },
    { names: ['Hangul'],      source: '\uAC00-\uD7AF\u1100-\u11FF' },
    { names: ['Han','Kanji'], source: '\u4E00-\u9FFF\uF900-\uFAFF' },
    { names: ['Hebrew'],      source: '\u0590-\u05FF' },
    { names: ['Hiragana'],    source: '\u3040-\u309F\u30FB-\u30FC' },
    { names: ['Kana'],        source: '\u3040-\u30FF\uFF61-\uFF9F' },
    { names: ['Katakana'],    source: '\u30A0-\u30FF\uFF61-\uFF9F' },
    { names: ['Latin'],       source: '\u0001-\u007F\u0080-\u00FF\u0100-\u017F\u0180-\u024F' },
    { names: ['Thai'],        source: '\u0E00-\u0E7F' }
  ];

  function buildUnicodeScripts() {
    unicodeScripts.forEach(function(s) {
      var is = regexp('^['+s.source+'\\s]+$');
      var has = regexp('['+s.source+']');
      s.names.forEach(function(name) {
        defineProperty(string.prototype, 'is' + name, function() { return is.test(this.trim()); });
        defineProperty(string.prototype, 'has' + name, function() { return has.test(this); });
      });
    });
  }

  // Support for converting character widths and katakana to hiragana.

  var widthConversionRanges = [
    { type: 'a', shift: 65248, start: 65,  end: 90  },
    { type: 'a', shift: 65248, start: 97,  end: 122 },
    { type: 'n', shift: 65248, start: 48,  end: 57  },
    { type: 'p', shift: 65248, start: 33,  end: 47  },
    { type: 'p', shift: 65248, start: 58,  end: 64  },
    { type: 'p', shift: 65248, start: 91,  end: 96  },
    { type: 'p', shift: 65248, start: 123, end: 126 }
  ];

  var WidthConversionTable;
  var allHankaku   = /[\u0020-\u00A5]|[\uFF61-\uFF9F][ﾞﾟ]?/g;
  var allZenkaku   = /[\u3000-\u301C]|[\u301A-\u30FC]|[\uFF01-\uFF60]|[\uFFE0-\uFFE6]/g;
  var hankakuPunctuation  = '｡､｢｣¥¢£';
  var zenkakuPunctuation  = '。、「」￥￠￡';
  var voicedKatakana      = /[カキクケコサシスセソタチツテトハヒフヘホ]/;
  var semiVoicedKatakana  = /[ハヒフヘホヲ]/;
  var hankakuKatakana     = 'ｱｲｳｴｵｧｨｩｪｫｶｷｸｹｺｻｼｽｾｿﾀﾁﾂｯﾃﾄﾅﾆﾇﾈﾉﾊﾋﾌﾍﾎﾏﾐﾑﾒﾓﾔｬﾕｭﾖｮﾗﾘﾙﾚﾛﾜｦﾝｰ･';
  var zenkakuKatakana     = 'アイウエオァィゥェォカキクケコサシスセソタチツッテトナニヌネノハヒフヘホマミムメモヤャユュヨョラリルレロワヲンー・';

  function convertCharacterWidth(str, args, reg, type) {
    if(!WidthConversionTable) {
      buildWidthConversionTables();
    }
    var mode = multiArgs(args).join(''), table = WidthConversionTable[type];
    mode = mode.replace(/all/, '').replace(/(\w)lphabet|umbers?|atakana|paces?|unctuation/g, '$1');
    return str.replace(reg, function(c) {
      if(table[c] && (!mode || mode.has(table[c].type))) {
        return table[c].to;
      } else {
        return c;
      }
    });
  }

  function buildWidthConversionTables() {
    var hankaku;
    WidthConversionTable = {
      'zenkaku': {},
      'hankaku': {}
    };
    widthConversionRanges.forEach(function(r) {
      getRange(r.start, r.end, function(n) {
        setWidthConversion(r.type, chr(n), chr(n + r.shift));
      });
    });
    zenkakuKatakana.each(function(c, i) {
      hankaku = hankakuKatakana.charAt(i);
      setWidthConversion('k', hankaku, c);
      if(c.match(voicedKatakana)) {
        setWidthConversion('k', hankaku + 'ﾞ', c.shift(1));
      }
      if(c.match(semiVoicedKatakana)) {
        setWidthConversion('k', hankaku + 'ﾟ', c.shift(2));
      }
    });
    zenkakuPunctuation.each(function(c, i) {
      setWidthConversion('p', hankakuPunctuation.charAt(i), c);
    });
    setWidthConversion('k', 'ｳﾞ', 'ヴ');
    setWidthConversion('k', 'ｦﾞ', 'ヺ');
    setWidthConversion('s', ' ', '　');
  }

  function setWidthConversion(type, half, full) {
    WidthConversionTable['zenkaku'][half] = { type: type, to: full };
    WidthConversionTable['hankaku'][full] = { type: type, to: half };
  }




  function buildNormalizeMap() {
    NormalizeMap = {};
    iterateOverObject(NormalizeSource, function(normalized, str) {
      str.split('').forEach(function(character) {
        NormalizeMap[character] = normalized;
      });
      NormalizeReg += str;
    });
    NormalizeReg = regexp('[' + NormalizeReg + ']', 'g');
  }

  NormalizeSource = {
    'A':  'AⒶＡÀÁÂẦẤẪẨÃĀĂẰẮẴẲȦǠÄǞẢÅǺǍȀȂẠẬẶḀĄȺⱯ',
    'B':  'BⒷＢḂḄḆɃƂƁ',
    'C':  'CⒸＣĆĈĊČÇḈƇȻꜾ',
    'D':  'DⒹＤḊĎḌḐḒḎĐƋƊƉꝹ',
    'E':  'EⒺＥÈÉÊỀẾỄỂẼĒḔḖĔĖËẺĚȄȆẸỆȨḜĘḘḚƐƎ',
    'F':  'FⒻＦḞƑꝻ',
    'G':  'GⒼＧǴĜḠĞĠǦĢǤƓꞠꝽꝾ',
    'H':  'HⒽＨĤḢḦȞḤḨḪĦⱧⱵꞍ',
    'I':  'IⒾＩÌÍÎĨĪĬİÏḮỈǏȈȊỊĮḬƗ',
    'J':  'JⒿＪĴɈ',
    'K':  'KⓀＫḰǨḲĶḴƘⱩꝀꝂꝄꞢ',
    'L':  'LⓁＬĿĹĽḶḸĻḼḺŁȽⱢⱠꝈꝆꞀ',
    'M':  'MⓂＭḾṀṂⱮƜ',
    'N':  'NⓃＮǸŃÑṄŇṆŅṊṈȠƝꞐꞤ',
    'O':  'OⓄＯÒÓÔỒỐỖỔÕṌȬṎŌṐṒŎȮȰÖȪỎŐǑȌȎƠỜỚỠỞỢỌỘǪǬØǾƆƟꝊꝌ',
    'P':  'PⓅＰṔṖƤⱣꝐꝒꝔ',
    'Q':  'QⓆＱꝖꝘɊ',
    'R':  'RⓇＲŔṘŘȐȒṚṜŖṞɌⱤꝚꞦꞂ',
    'S':  'SⓈＳẞŚṤŜṠŠṦṢṨȘŞⱾꞨꞄ',
    'T':  'TⓉＴṪŤṬȚŢṰṮŦƬƮȾꞆ',
    'U':  'UⓊＵÙÚÛŨṸŪṺŬÜǛǗǕǙỦŮŰǓȔȖƯỪỨỮỬỰỤṲŲṶṴɄ',
    'V':  'VⓋＶṼṾƲꝞɅ',
    'W':  'WⓌＷẀẂŴẆẄẈⱲ',
    'X':  'XⓍＸẊẌ',
    'Y':  'YⓎＹỲÝŶỸȲẎŸỶỴƳɎỾ',
    'Z':  'ZⓏＺŹẐŻŽẒẔƵȤⱿⱫꝢ',
    'a':  'aⓐａẚàáâầấẫẩãāăằắẵẳȧǡäǟảåǻǎȁȃạậặḁąⱥɐ',
    'b':  'bⓑｂḃḅḇƀƃɓ',
    'c':  'cⓒｃćĉċčçḉƈȼꜿↄ',
    'd':  'dⓓｄḋďḍḑḓḏđƌɖɗꝺ',
    'e':  'eⓔｅèéêềếễểẽēḕḗĕėëẻěȅȇẹệȩḝęḙḛɇɛǝ',
    'f':  'fⓕｆḟƒꝼ',
    'g':  'gⓖｇǵĝḡğġǧģǥɠꞡᵹꝿ',
    'h':  'hⓗｈĥḣḧȟḥḩḫẖħⱨⱶɥ',
    'i':  'iⓘｉìíîĩīĭïḯỉǐȉȋịįḭɨı',
    'j':  'jⓙｊĵǰɉ',
    'k':  'kⓚｋḱǩḳķḵƙⱪꝁꝃꝅꞣ',
    'l':  'lⓛｌŀĺľḷḹļḽḻſłƚɫⱡꝉꞁꝇ',
    'm':  'mⓜｍḿṁṃɱɯ',
    'n':  'nⓝｎǹńñṅňṇņṋṉƞɲŉꞑꞥ',
    'o':  'oⓞｏòóôồốỗổõṍȭṏōṑṓŏȯȱöȫỏőǒȍȏơờớỡởợọộǫǭøǿɔꝋꝍɵ',
    'p':  'pⓟｐṕṗƥᵽꝑꝓꝕ',
    'q':  'qⓠｑɋꝗꝙ',
    'r':  'rⓡｒŕṙřȑȓṛṝŗṟɍɽꝛꞧꞃ',
    's':  'sⓢｓśṥŝṡšṧṣṩșşȿꞩꞅẛ',
    't':  'tⓣｔṫẗťṭțţṱṯŧƭʈⱦꞇ',
    'u':  'uⓤｕùúûũṹūṻŭüǜǘǖǚủůűǔȕȗưừứữửựụṳųṷṵʉ',
    'v':  'vⓥｖṽṿʋꝟʌ',
    'w':  'wⓦｗẁẃŵẇẅẘẉⱳ',
    'x':  'xⓧｘẋẍ',
    'y':  'yⓨｙỳýŷỹȳẏÿỷẙỵƴɏỿ',
    'z':  'zⓩｚźẑżžẓẕƶȥɀⱬꝣ',
    'AA': 'Ꜳ',
    'AE': 'ÆǼǢ',
    'AO': 'Ꜵ',
    'AU': 'Ꜷ',
    'AV': 'ꜸꜺ',
    'AY': 'Ꜽ',
    'DZ': 'ǱǄ',
    'Dz': 'ǲǅ',
    'LJ': 'Ǉ',
    'Lj': 'ǈ',
    'NJ': 'Ǌ',
    'Nj': 'ǋ',
    'OI': 'Ƣ',
    'OO': 'Ꝏ',
    'OU': 'Ȣ',
    'TZ': 'Ꜩ',
    'VY': 'Ꝡ',
    'aa': 'ꜳ',
    'ae': 'æǽǣ',
    'ao': 'ꜵ',
    'au': 'ꜷ',
    'av': 'ꜹꜻ',
    'ay': 'ꜽ',
    'dz': 'ǳǆ',
    'hv': 'ƕ',
    'lj': 'ǉ',
    'nj': 'ǌ',
    'oi': 'ƣ',
    'ou': 'ȣ',
    'oo': 'ꝏ',
    'ss': 'ß',
    'tz': 'ꜩ',
    'vy': 'ꝡ'
  };

  extend(string, true, false, {
    /***
     * @method normalize()
     * @returns String
     * @short Returns the string with accented and non-standard Latin-based characters converted into ASCII approximate equivalents.
     * @example
     *
     *   'á'.normalize()                  -> 'a'
     *   'Ménage à trois'.normalize()     -> 'Menage a trois'
     *   'Volkswagen'.normalize()         -> 'Volkswagen'
     *   'ＦＵＬＬＷＩＤＴＨ'.normalize() -> 'FULLWIDTH'
     *
     ***/
    'normalize': function() {
      if(!NormalizeMap) {
        buildNormalizeMap();
      }
      return this.replace(NormalizeReg, function(character) {
        return NormalizeMap[character];
      });
    },

    /***
     * @method hankaku([mode] = 'all')
     * @returns String
     * @short Converts full-width characters (zenkaku) to half-width (hankaku).
     * @extra [mode] accepts any combination of "a" (alphabet), "n" (numbers), "k" (katakana), "s" (spaces), "p" (punctuation), or "all".
     * @example
     *
     *   'タロウ　ＹＡＭＡＤＡです！'.hankaku()                      -> 'ﾀﾛｳ YAMADAです!'
     *   'タロウ　ＹＡＭＡＤＡです！'.hankaku('a')                   -> 'タロウ　YAMADAです！'
     *   'タロウ　ＹＡＭＡＤＡです！'.hankaku('alphabet')            -> 'タロウ　YAMADAです！'
     *   'タロウです！　２５歳です！'.hankaku('katakana', 'numbers') -> 'ﾀﾛｳです！　25歳です！'
     *   'タロウです！　２５歳です！'.hankaku('k', 'n')              -> 'ﾀﾛｳです！　25歳です！'
     *   'タロウです！　２５歳です！'.hankaku('kn')                  -> 'ﾀﾛｳです！　25歳です！'
     *   'タロウです！　２５歳です！'.hankaku('sp')                  -> 'タロウです! ２５歳です!'
     *
     ***/
    'hankaku': function() {
      return convertCharacterWidth(this, arguments, allZenkaku, 'hankaku');
    },

    /***
     * @method zenkaku([mode] = 'all')
     * @returns String
     * @short Converts half-width characters (hankaku) to full-width (zenkaku).
     * @extra [mode] accepts any combination of "a" (alphabet), "n" (numbers), "k" (katakana), "s" (spaces), "p" (punctuation), or "all".
     * @example
     *
     *   'ﾀﾛｳ YAMADAです!'.zenkaku()                         -> 'タロウ　ＹＡＭＡＤＡです！'
     *   'ﾀﾛｳ YAMADAです!'.zenkaku('a')                      -> 'ﾀﾛｳ ＹＡＭＡＤＡです!'
     *   'ﾀﾛｳ YAMADAです!'.zenkaku('alphabet')               -> 'ﾀﾛｳ ＹＡＭＡＤＡです!'
     *   'ﾀﾛｳです! 25歳です!'.zenkaku('katakana', 'numbers') -> 'タロウです! ２５歳です!'
     *   'ﾀﾛｳです! 25歳です!'.zenkaku('k', 'n')              -> 'タロウです! ２５歳です!'
     *   'ﾀﾛｳです! 25歳です!'.zenkaku('kn')                  -> 'タロウです! ２５歳です!'
     *   'ﾀﾛｳです! 25歳です!'.zenkaku('sp')                  -> 'ﾀﾛｳです！　25歳です！'
     *
     ***/
    'zenkaku': function() {
      return convertCharacterWidth(this, arguments, allHankaku, 'zenkaku');
    },

    /***
     * @method hiragana([all] = true)
     * @returns String
     * @short Converts katakana into hiragana.
     * @extra If [all] is false, only full-width katakana will be converted.
     * @example
     *
     *   'カタカナ'.hiragana()   -> 'かたかな'
     *   'コンニチハ'.hiragana() -> 'こんにちは'
     *   'ｶﾀｶﾅ'.hiragana()       -> 'かたかな'
     *   'ｶﾀｶﾅ'.hiragana(false)  -> 'ｶﾀｶﾅ'
     *
     ***/
    'hiragana': function(all) {
      var str = this;
      if(all !== false) {
        str = str.zenkaku('k');
      }
      return str.replace(/[\u30A1-\u30F6]/g, function(c) {
        return c.shift(-96);
      });
    },

    /***
     * @method katakana()
     * @returns String
     * @short Converts hiragana into katakana.
     * @example
     *
     *   'かたかな'.katakana()   -> 'カタカナ'
     *   'こんにちは'.katakana() -> 'コンニチハ'
     *
     ***/
    'katakana': function() {
      return this.replace(/[\u3041-\u3096]/g, function(c) {
        return c.shift(96);
      });
    }


  });

  buildUnicodeScripts();

/*
 *
 * Date.addLocale(<code>) adds this locale to Sugar.
 * To set the locale globally, simply call:
 *
 * Date.setLocale('da');
 *
 * var locale = Date.getLocale(<code>) will return this object, which
 * can be tweaked to change the behavior of parsing/formatting in the locales.
 *
 * locale.addFormat adds a date format (see this file for examples).
 * Special tokens in the date format will be parsed out into regex tokens:
 *
 * {0} is a reference to an entry in locale.tokens. Output: (?:the)?
 * {unit} is a reference to all units. Output: (day|week|month|...)
 * {unit3} is a reference to a specific unit. Output: (hour)
 * {unit3-5} is a reference to a subset of the units array. Output: (hour|day|week)
 * {unit?} "?" makes that token optional. Output: (day|week|month)?
 *
 * {day} Any reference to tokens in the modifiers array will include all with the same name. Output: (yesterday|today|tomorrow)
 *
 * All spaces are optional and will be converted to "\s*"
 *
 * Locale arrays months, weekdays, units, numbers, as well as the "src" field for
 * all entries in the modifiers array follow a special format indicated by a colon:
 *
 * minute:|s  = minute|minutes
 * thicke:n|r = thicken|thicker
 *
 * Additionally in the months, weekdays, units, and numbers array these will be added at indexes that are multiples
 * of the relevant number for retrieval. For example having "sunday:|s" in the units array will result in:
 *
 * units: ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sundays']
 *
 * When matched, the index will be found using:
 *
 * units.indexOf(match) % 7;
 *
 * Resulting in the correct index with any number of alternates for that entry.
 *
 */

Date.addLocale('da', {
  'plural': true,
  'months': 'januar,februar,marts,april,maj,juni,juli,august,september,oktober,november,december',
  'weekdays': 'søndag|sondag,mandag,tirsdag,onsdag,torsdag,fredag,lørdag|lordag',
  'units': 'millisekund:|er,sekund:|er,minut:|ter,tim:e|er,dag:|e,ug:e|er|en,måned:|er|en+maaned:|er|en,år:||et+aar:||et',
  'numbers': 'en|et,to,tre,fire,fem,seks,syv,otte,ni,ti',
  'tokens': 'den,for',
  'articles': 'den',
  'short':'d. {d}. {month} {yyyy}',
  'long': 'den {d}. {month} {yyyy} {H}:{mm}',
  'full': '{Weekday} den {d}. {month} {yyyy} {H}:{mm}:{ss}',
  'past': '{num} {unit} {sign}',
  'future': '{sign} {num} {unit}',
  'duration': '{num} {unit}',
  'ampm': 'am,pm',
  'modifiers': [
    { 'name': 'day', 'src': 'forgårs|i forgårs|forgaars|i forgaars', 'value': -2 },
    { 'name': 'day', 'src': 'i går|igår|i gaar|igaar', 'value': -1 },
    { 'name': 'day', 'src': 'i dag|idag', 'value': 0 },
    { 'name': 'day', 'src': 'i morgen|imorgen', 'value': 1 },
    { 'name': 'day', 'src': 'over morgon|overmorgen|i over morgen|i overmorgen|iovermorgen', 'value': 2 },
    { 'name': 'sign', 'src': 'siden', 'value': -1 },
    { 'name': 'sign', 'src': 'om', 'value':  1 },
    { 'name': 'shift', 'src': 'i sidste|sidste', 'value': -1 },
    { 'name': 'shift', 'src': 'denne', 'value': 0 },
    { 'name': 'shift', 'src': 'næste|naeste', 'value': 1 }
  ],
  'dateParse': [
    '{num} {unit} {sign}',
    '{sign} {num} {unit}',
    '{1?} {num} {unit} {sign}',
    '{shift} {unit=5-7}'
  ],
  'timeParse': [
    '{0?} {weekday?} {date?} {month} {year}',
    '{date} {month}',
    '{shift} {weekday}'
  ]
});

/*
 *
 * Date.addLocale(<code>) adds this locale to Sugar.
 * To set the locale globally, simply call:
 *
 * Date.setLocale('de');
 *
 * var locale = Date.getLocale(<code>) will return this object, which
 * can be tweaked to change the behavior of parsing/formatting in the locales.
 *
 * locale.addFormat adds a date format (see this file for examples).
 * Special tokens in the date format will be parsed out into regex tokens:
 *
 * {0} is a reference to an entry in locale.tokens. Output: (?:the)?
 * {unit} is a reference to all units. Output: (day|week|month|...)
 * {unit3} is a reference to a specific unit. Output: (hour)
 * {unit3-5} is a reference to a subset of the units array. Output: (hour|day|week)
 * {unit?} "?" makes that token optional. Output: (day|week|month)?
 *
 * {day} Any reference to tokens in the modifiers array will include all with the same name. Output: (yesterday|today|tomorrow)
 *
 * All spaces are optional and will be converted to "\s*"
 *
 * Locale arrays months, weekdays, units, numbers, as well as the "src" field for
 * all entries in the modifiers array follow a special format indicated by a colon:
 *
 * minute:|s  = minute|minutes
 * thicke:n|r = thicken|thicker
 *
 * Additionally in the months, weekdays, units, and numbers array these will be added at indexes that are multiples
 * of the relevant number for retrieval. For example having "sunday:|s" in the units array will result in:
 *
 * units: ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sundays']
 *
 * When matched, the index will be found using:
 *
 * units.indexOf(match) % 7;
 *
 * Resulting in the correct index with any number of alternates for that entry.
 *
 */

Date.addLocale('de', {
  'plural': true,
   'capitalizeUnit': true,
  'months': 'Januar,Februar,März|Marz,April,Mai,Juni,Juli,August,September,Oktober,November,Dezember',
  'weekdays': 'Sonntag,Montag,Dienstag,Mittwoch,Donnerstag,Freitag,Samstag',
  'units': 'Millisekunde:|n,Sekunde:|n,Minute:|n,Stunde:|n,Tag:|en,Woche:|n,Monat:|en,Jahr:|en',
  'numbers': 'ein:|e|er|en|em,zwei,drei,vier,fuenf,sechs,sieben,acht,neun,zehn',
  'tokens': 'der',
  'short':'{d}. {Month} {yyyy}',
  'long': '{d}. {Month} {yyyy} {H}:{mm}',
  'full': '{Weekday} {d}. {Month} {yyyy} {H}:{mm}:{ss}',
  'past': '{sign} {num} {unit}',
  'future': '{sign} {num} {unit}',
  'duration': '{num} {unit}',
  'timeMarker': 'um',
  'ampm': 'am,pm',
  'modifiers': [
    { 'name': 'day', 'src': 'vorgestern', 'value': -2 },
    { 'name': 'day', 'src': 'gestern', 'value': -1 },
    { 'name': 'day', 'src': 'heute', 'value': 0 },
    { 'name': 'day', 'src': 'morgen', 'value': 1 },
    { 'name': 'day', 'src': 'übermorgen|ubermorgen|uebermorgen', 'value': 2 },
    { 'name': 'sign', 'src': 'vor:|her', 'value': -1 },
    { 'name': 'sign', 'src': 'in', 'value': 1 },
    { 'name': 'shift', 'src': 'letzte:|r|n|s', 'value': -1 },
    { 'name': 'shift', 'src': 'nächste:|r|n|s+nachste:|r|n|s+naechste:|r|n|s+kommende:n|r', 'value': 1 }
  ],
  'dateParse': [
    '{sign} {num} {unit}',
    '{num} {unit} {sign}',
    '{shift} {unit=5-7}'
  ],
  'timeParse': [
    '{weekday?} {date?} {month} {year?}',
    '{shift} {weekday}'
  ]
});

/*
 *
 * Date.addLocale(<code>) adds this locale to Sugar.
 * To set the locale globally, simply call:
 *
 * Date.setLocale('es');
 *
 * var locale = Date.getLocale(<code>) will return this object, which
 * can be tweaked to change the behavior of parsing/formatting in the locales.
 *
 * locale.addFormat adds a date format (see this file for examples).
 * Special tokens in the date format will be parsed out into regex tokens:
 *
 * {0} is a reference to an entry in locale.tokens. Output: (?:the)?
 * {unit} is a reference to all units. Output: (day|week|month|...)
 * {unit3} is a reference to a specific unit. Output: (hour)
 * {unit3-5} is a reference to a subset of the units array. Output: (hour|day|week)
 * {unit?} "?" makes that token optional. Output: (day|week|month)?
 *
 * {day} Any reference to tokens in the modifiers array will include all with the same name. Output: (yesterday|today|tomorrow)
 *
 * All spaces are optional and will be converted to "\s*"
 *
 * Locale arrays months, weekdays, units, numbers, as well as the "src" field for
 * all entries in the modifiers array follow a special format indicated by a colon:
 *
 * minute:|s  = minute|minutes
 * thicke:n|r = thicken|thicker
 *
 * Additionally in the months, weekdays, units, and numbers array these will be added at indexes that are multiples
 * of the relevant number for retrieval. For example having "sunday:|s" in the units array will result in:
 *
 * units: ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sundays']
 *
 * When matched, the index will be found using:
 *
 * units.indexOf(match) % 7;
 *
 * Resulting in the correct index with any number of alternates for that entry.
 *
 */

Date.addLocale('es', {
  'plural': true,
  'months': 'enero,febrero,marzo,abril,mayo,junio,julio,agosto,septiembre,octubre,noviembre,diciembre',
  'weekdays': 'domingo,lunes,martes,miércoles|miercoles,jueves,viernes,sábado|sabado',
  'units': 'milisegundo:|s,segundo:|s,minuto:|s,hora:|s,día|días|dia|dias,semana:|s,mes:|es,año|años|ano|anos',
  'numbers': 'uno,dos,tres,cuatro,cinco,seis,siete,ocho,nueve,diez',
  'tokens': 'el,de',
  'short':'{d} {month} {yyyy}',
  'long': '{d} {month} {yyyy} {H}:{mm}',
  'full': '{Weekday} {d} {month} {yyyy} {H}:{mm}:{ss}',
  'past': '{sign} {num} {unit}',
  'future': '{num} {unit} {sign}',
  'duration': '{num} {unit}',
  'timeMarker': 'a las',
  'ampm': 'am,pm',
  'modifiers': [
    { 'name': 'day', 'src': 'anteayer', 'value': -2 },
    { 'name': 'day', 'src': 'ayer', 'value': -1 },
    { 'name': 'day', 'src': 'hoy', 'value': 0 },
    { 'name': 'day', 'src': 'mañana|manana', 'value': 1 },
    { 'name': 'sign', 'src': 'hace', 'value': -1 },
    { 'name': 'sign', 'src': 'de ahora', 'value': 1 },
    { 'name': 'shift', 'src': 'pasad:o|a', 'value': -1 },
    { 'name': 'shift', 'src': 'próximo|próxima|proximo|proxima', 'value': 1 }
  ],
  'dateParse': [
    '{sign} {num} {unit}',
    '{num} {unit} {sign}',
    '{0?} {unit=5-7} {shift}',
    '{0?} {shift} {unit=5-7}'
  ],
  'timeParse': [
    '{shift} {weekday}',
    '{weekday} {shift}',
    '{date?} {1?} {month} {1?} {year?}'
  ]
});
Date.addLocale('fi', {
    'plural':     true,
    'timeMarker': 'kello',
    'ampm':       ',',
    'months':     'tammikuu,helmikuu,maaliskuu,huhtikuu,toukokuu,kesäkuu,heinäkuu,elokuu,syyskuu,lokakuu,marraskuu,joulukuu',
    'weekdays':   'sunnuntai,maanantai,tiistai,keskiviikko,torstai,perjantai,lauantai',
    'units':      'millisekun:ti|tia|teja|tina|nin,sekun:ti|tia|teja|tina|nin,minuut:ti|tia|teja|tina|in,tun:ti|tia|teja|tina|nin,päiv:ä|ää|iä|änä|än,viik:ko|koa|koja|on|kona,kuukau:si|sia|tta|den|tena,vuo:si|sia|tta|den|tena',
    'numbers':    'yksi|ensimmäinen,kaksi|toinen,kolm:e|as,neljä:s,vii:si|des,kuu:si|des,seitsemä:n|s,kahdeksa:n|s,yhdeksä:n|s,kymmene:n|s',
    'articles':   '',
    'optionals':  '',
    'short':      '{d}. {month}ta {yyyy}',
    'long':       '{d}. {month}ta {yyyy} kello {H}.{mm}',
    'full':       '{Weekday}na {d}. {month}ta {yyyy} kello {H}.{mm}',
    'relative':       function(num, unit, ms, format) {
      var units = this['units'];
      function numberWithUnit(mult) {
        return (num === 1 ? '' : num + ' ') + units[(8 * mult) + unit];
      }
      switch(format) {
        case 'duration':  return numberWithUnit(0);
        case 'past':      return numberWithUnit(num > 1 ? 1 : 0) + ' sitten';
        case 'future':    return numberWithUnit(4) + ' päästä';
      }
    },
    'modifiers': [
        { 'name': 'day',   'src': 'toissa päivänä|toissa päiväistä', 'value': -2 },
        { 'name': 'day',   'src': 'eilen|eilistä', 'value': -1 },
        { 'name': 'day',   'src': 'tänään', 'value': 0 },
        { 'name': 'day',   'src': 'huomenna|huomista', 'value': 1 },
        { 'name': 'day',   'src': 'ylihuomenna|ylihuomista', 'value': 2 },
        { 'name': 'sign',  'src': 'sitten|aiemmin', 'value': -1 },
        { 'name': 'sign',  'src': 'päästä|kuluttua|myöhemmin', 'value': 1 },
        { 'name': 'edge',  'src': 'viimeinen|viimeisenä', 'value': -2 },
        { 'name': 'edge',  'src': 'lopussa', 'value': -1 },
        { 'name': 'edge',  'src': 'ensimmäinen|ensimmäisenä', 'value': 1 },
        { 'name': 'shift', 'src': 'edellinen|edellisenä|edeltävä|edeltävänä|viime|toissa', 'value': -1 },
        { 'name': 'shift', 'src': 'tänä|tämän', 'value': 0 },
        { 'name': 'shift', 'src': 'seuraava|seuraavana|tuleva|tulevana|ensi', 'value': 1 }
    ],
    'dateParse': [
        '{num} {unit} {sign}',
        '{sign} {num} {unit}',
        '{num} {unit=4-5} {sign} {day}',
        '{month} {year}',
        '{shift} {unit=5-7}'
    ],
    'timeParse': [
        '{0} {num}{1} {day} of {month} {year?}',
        '{weekday?} {month} {date}{1} {year?}',
        '{date} {month} {year}',
        '{shift} {weekday}',
        '{shift} week {weekday}',
        '{weekday} {2} {shift} week',
        '{0} {date}{1} of {month}',
        '{0}{month?} {date?}{1} of {shift} {unit=6-7}'
    ]
});
/*
 *
 * Date.addLocale(<code>) adds this locale to Sugar.
 * To set the locale globally, simply call:
 *
 * Date.setLocale('fr');
 *
 * var locale = Date.getLocale(<code>) will return this object, which
 * can be tweaked to change the behavior of parsing/formatting in the locales.
 *
 * locale.addFormat adds a date format (see this file for examples).
 * Special tokens in the date format will be parsed out into regex tokens:
 *
 * {0} is a reference to an entry in locale.tokens. Output: (?:the)?
 * {unit} is a reference to all units. Output: (day|week|month|...)
 * {unit3} is a reference to a specific unit. Output: (hour)
 * {unit3-5} is a reference to a subset of the units array. Output: (hour|day|week)
 * {unit?} "?" makes that token optional. Output: (day|week|month)?
 *
 * {day} Any reference to tokens in the modifiers array will include all with the same name. Output: (yesterday|today|tomorrow)
 *
 * All spaces are optional and will be converted to "\s*"
 *
 * Locale arrays months, weekdays, units, numbers, as well as the "src" field for
 * all entries in the modifiers array follow a special format indicated by a colon:
 *
 * minute:|s  = minute|minutes
 * thicke:n|r = thicken|thicker
 *
 * Additionally in the months, weekdays, units, and numbers array these will be added at indexes that are multiples
 * of the relevant number for retrieval. For example having "sunday:|s" in the units array will result in:
 *
 * units: ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sundays']
 *
 * When matched, the index will be found using:
 *
 * units.indexOf(match) % 7;
 *
 * Resulting in the correct index with any number of alternates for that entry.
 *
 */

Date.addLocale('fr', {
  'plural': true,
  'months': 'janvier,février|fevrier,mars,avril,mai,juin,juillet,août,septembre,octobre,novembre,décembre|decembre',
  'weekdays': 'dimanche,lundi,mardi,mercredi,jeudi,vendredi,samedi',
  'units': 'milliseconde:|s,seconde:|s,minute:|s,heure:|s,jour:|s,semaine:|s,mois,an:|s|née|nee',
  'numbers': 'un:|e,deux,trois,quatre,cinq,six,sept,huit,neuf,dix',
  'tokens': ["l'|la|le"],
  'short':'{d} {month} {yyyy}',
  'long': '{d} {month} {yyyy} {H}:{mm}',
  'full': '{Weekday} {d} {month} {yyyy} {H}:{mm}:{ss}',
  'past': '{sign} {num} {unit}',
  'future': '{sign} {num} {unit}',
  'duration': '{num} {unit}',
  'timeMarker': 'à',
  'ampm': 'am,pm',
  'modifiers': [
    { 'name': 'day', 'src': 'hier', 'value': -1 },
    { 'name': 'day', 'src': "aujourd'hui", 'value': 0 },
    { 'name': 'day', 'src': 'demain', 'value': 1 },
    { 'name': 'sign', 'src': 'il y a', 'value': -1 },
    { 'name': 'sign', 'src': "dans|d'ici", 'value': 1 },
    { 'name': 'shift', 'src': 'derni:èr|er|ère|ere', 'value': -1 },
    { 'name': 'shift', 'src': 'prochain:|e', 'value': 1 }
  ],
  'dateParse': [
    '{sign} {num} {unit}',
    '{sign} {num} {unit}',
    '{0?} {unit=5-7} {shift}'
  ],
  'timeParse': [
    '{weekday?} {0?} {date?} {month} {year?}',
    '{0?} {weekday} {shift}'
  ]
});

/*
 *
 * Date.addLocale(<code>) adds this locale to Sugar.
 * To set the locale globally, simply call:
 *
 * Date.setLocale('it');
 *
 * var locale = Date.getLocale(<code>) will return this object, which
 * can be tweaked to change the behavior of parsing/formatting in the locales.
 *
 * locale.addFormat adds a date format (see this file for examples).
 * Special tokens in the date format will be parsed out into regex tokens:
 *
 * {0} is a reference to an entry in locale.tokens. Output: (?:the)?
 * {unit} is a reference to all units. Output: (day|week|month|...)
 * {unit3} is a reference to a specific unit. Output: (hour)
 * {unit3-5} is a reference to a subset of the units array. Output: (hour|day|week)
 * {unit?} "?" makes that token optional. Output: (day|week|month)?
 *
 * {day} Any reference to tokens in the modifiers array will include all with the same name. Output: (yesterday|today|tomorrow)
 *
 * All spaces are optional and will be converted to "\s*"
 *
 * Locale arrays months, weekdays, units, numbers, as well as the "src" field for
 * all entries in the modifiers array follow a special format indicated by a colon:
 *
 * minute:|s  = minute|minutes
 * thicke:n|r = thicken|thicker
 *
 * Additionally in the months, weekdays, units, and numbers array these will be added at indexes that are multiples
 * of the relevant number for retrieval. For example having "sunday:|s" in the units array will result in:
 *
 * units: ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sundays']
 *
 * When matched, the index will be found using:
 *
 * units.indexOf(match) % 7;
 *
 * Resulting in the correct index with any number of alternates for that entry.
 *
 */

Date.addLocale('it', {
  'plural': true,
  'months': 'Gennaio,Febbraio,Marzo,Aprile,Maggio,Giugno,Luglio,Agosto,Settembre,Ottobre,Novembre,Dicembre',
  'weekdays': 'Domenica,Luned:ì|i,Marted:ì|i,Mercoled:ì|i,Gioved:ì|i,Venerd:ì|i,Sabato',
  'units': 'millisecond:o|i,second:o|i,minut:o|i,or:a|e,giorn:o|i,settiman:a|e,mes:e|i,ann:o|i',
  'numbers': "un:|a|o|',due,tre,quattro,cinque,sei,sette,otto,nove,dieci",
  'tokens': "l'|la|il",
  'short':'{d} {Month} {yyyy}',
  'long': '{d} {Month} {yyyy} {H}:{mm}',
  'full': '{Weekday} {d} {Month} {yyyy} {H}:{mm}:{ss}',
  'past': '{num} {unit} {sign}',
  'future': '{num} {unit} {sign}',
  'duration': '{num} {unit}',
  'timeMarker': 'alle',
  'ampm': 'am,pm',
  'modifiers': [
    { 'name': 'day', 'src': 'ieri', 'value': -1 },
    { 'name': 'day', 'src': 'oggi', 'value': 0 },
    { 'name': 'day', 'src': 'domani', 'value': 1 },
    { 'name': 'day', 'src': 'dopodomani', 'value': 2 },
    { 'name': 'sign', 'src': 'fa', 'value': -1 },
    { 'name': 'sign', 'src': 'da adesso', 'value': 1 },
    { 'name': 'shift', 'src': 'scors:o|a', 'value': -1 },
    { 'name': 'shift', 'src': 'prossim:o|a', 'value': 1 }
  ],
  'dateParse': [
    '{num} {unit} {sign}',
    '{0?} {unit=5-7} {shift}',
    '{0?} {shift} {unit=5-7}'
  ],
  'timeParse': [
    '{weekday?} {date?} {month} {year?}',
    '{shift} {weekday}'
  ]
});

/*
 *
 * Date.addLocale(<code>) adds this locale to Sugar.
 * To set the locale globally, simply call:
 *
 * Date.setLocale('ja');
 *
 * var locale = Date.getLocale(<code>) will return this object, which
 * can be tweaked to change the behavior of parsing/formatting in the locales.
 *
 * locale.addFormat adds a date format (see this file for examples).
 * Special tokens in the date format will be parsed out into regex tokens:
 *
 * {0} is a reference to an entry in locale.tokens. Output: (?:the)?
 * {unit} is a reference to all units. Output: (day|week|month|...)
 * {unit3} is a reference to a specific unit. Output: (hour)
 * {unit3-5} is a reference to a subset of the units array. Output: (hour|day|week)
 * {unit?} "?" makes that token optional. Output: (day|week|month)?
 *
 * {day} Any reference to tokens in the modifiers array will include all with the same name. Output: (yesterday|today|tomorrow)
 *
 * All spaces are optional and will be converted to "\s*"
 *
 * Locale arrays months, weekdays, units, numbers, as well as the "src" field for
 * all entries in the modifiers array follow a special format indicated by a colon:
 *
 * minute:|s  = minute|minutes
 * thicke:n|r = thicken|thicker
 *
 * Additionally in the months, weekdays, units, and numbers array these will be added at indexes that are multiples
 * of the relevant number for retrieval. For example having "sunday:|s" in the units array will result in:
 *
 * units: ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sundays']
 *
 * When matched, the index will be found using:
 *
 * units.indexOf(match) % 7;
 *
 * Resulting in the correct index with any number of alternates for that entry.
 *
 */

Date.addLocale('ja', {
  'monthSuffix': '月',
  'weekdays': '日曜日,月曜日,火曜日,水曜日,木曜日,金曜日,土曜日',
  'units': 'ミリ秒,秒,分,時間,日,週間|週,ヶ月|ヵ月|月,年',
  'short': '{yyyy}年{M}月{d}日',
  'long': '{yyyy}年{M}月{d}日 {H}時{mm}分',
  'full': '{yyyy}年{M}月{d}日 {Weekday} {H}時{mm}分{ss}秒',
  'past': '{num}{unit}{sign}',
  'future': '{num}{unit}{sign}',
  'duration': '{num}{unit}',
  'timeSuffixes': '時,分,秒',
  'ampm': '午前,午後',
  'modifiers': [
    { 'name': 'day', 'src': '一昨日', 'value': -2 },
    { 'name': 'day', 'src': '昨日', 'value': -1 },
    { 'name': 'day', 'src': '今日', 'value': 0 },
    { 'name': 'day', 'src': '明日', 'value': 1 },
    { 'name': 'day', 'src': '明後日', 'value': 2 },
    { 'name': 'sign', 'src': '前', 'value': -1 },
    { 'name': 'sign', 'src': '後', 'value':  1 },
    { 'name': 'shift', 'src': '去|先', 'value': -1 },
    { 'name': 'shift', 'src': '来', 'value':  1 }
  ],
  'dateParse': [
    '{num}{unit}{sign}'
  ],
  'timeParse': [
    '{shift}{unit=5-7}{weekday?}',
    '{year}年{month?}月?{date?}日?',
    '{month}月{date?}日?',
    '{date}日'
  ]
});

/*
 *
 * Date.addLocale(<code>) adds this locale to Sugar.
 * To set the locale globally, simply call:
 *
 * Date.setLocale('ko');
 *
 * var locale = Date.getLocale(<code>) will return this object, which
 * can be tweaked to change the behavior of parsing/formatting in the locales.
 *
 * locale.addFormat adds a date format (see this file for examples).
 * Special tokens in the date format will be parsed out into regex tokens:
 *
 * {0} is a reference to an entry in locale.tokens. Output: (?:the)?
 * {unit} is a reference to all units. Output: (day|week|month|...)
 * {unit3} is a reference to a specific unit. Output: (hour)
 * {unit3-5} is a reference to a subset of the units array. Output: (hour|day|week)
 * {unit?} "?" makes that token optional. Output: (day|week|month)?
 *
 * {day} Any reference to tokens in the modifiers array will include all with the same name. Output: (yesterday|today|tomorrow)
 *
 * All spaces are optional and will be converted to "\s*"
 *
 * Locale arrays months, weekdays, units, numbers, as well as the "src" field for
 * all entries in the modifiers array follow a special format indicated by a colon:
 *
 * minute:|s  = minute|minutes
 * thicke:n|r = thicken|thicker
 *
 * Additionally in the months, weekdays, units, and numbers array these will be added at indexes that are multiples
 * of the relevant number for retrieval. For example having "sunday:|s" in the units array will result in:
 *
 * units: ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sundays']
 *
 * When matched, the index will be found using:
 *
 * units.indexOf(match) % 7;
 *
 * Resulting in the correct index with any number of alternates for that entry.
 *
 */

Date.addLocale('ko', {
  'digitDate': true,
  'monthSuffix': '월',
  'weekdays': '일요일,월요일,화요일,수요일,목요일,금요일,토요일',
  'units': '밀리초,초,분,시간,일,주,개월|달,년',
  'numbers': '일|한,이,삼,사,오,육,칠,팔,구,십',
  'short': '{yyyy}년{M}월{d}일',
  'long': '{yyyy}년{M}월{d}일 {H}시{mm}분',
  'full': '{yyyy}년{M}월{d}일 {Weekday} {H}시{mm}분{ss}초',
  'past': '{num}{unit} {sign}',
  'future': '{num}{unit} {sign}',
  'duration': '{num}{unit}',
  'timeSuffixes': '시,분,초',
  'ampm': '오전,오후',
  'modifiers': [
    { 'name': 'day', 'src': '그저께', 'value': -2 },
    { 'name': 'day', 'src': '어제', 'value': -1 },
    { 'name': 'day', 'src': '오늘', 'value': 0 },
    { 'name': 'day', 'src': '내일', 'value': 1 },
    { 'name': 'day', 'src': '모레', 'value': 2 },
    { 'name': 'sign', 'src': '전', 'value': -1 },
    { 'name': 'sign', 'src': '후', 'value':  1 },
    { 'name': 'shift', 'src': '지난|작', 'value': -1 },
    { 'name': 'shift', 'src': '이번', 'value': 0 },
    { 'name': 'shift', 'src': '다음|내', 'value': 1 }
  ],
  'dateParse': [
    '{num}{unit} {sign}',
    '{shift?} {unit=5-7}'
  ],
  'timeParse': [
    '{shift} {unit=5?} {weekday}',
    '{year}년{month?}월?{date?}일?',
    '{month}월{date?}일?',
    '{date}일'
  ]
});

/*
 *
 * Date.addLocale(<code>) adds this locale to Sugar.
 * To set the locale globally, simply call:
 *
 * Date.setLocale('nl');
 *
 * var locale = Date.getLocale(<code>) will return this object, which
 * can be tweaked to change the behavior of parsing/formatting in the locales.
 *
 * locale.addFormat adds a date format (see this file for examples).
 * Special tokens in the date format will be parsed out into regex tokens:
 *
 * {0} is a reference to an entry in locale.tokens. Output: (?:the)?
 * {unit} is a reference to all units. Output: (day|week|month|...)
 * {unit3} is a reference to a specific unit. Output: (hour)
 * {unit3-5} is a reference to a subset of the units array. Output: (hour|day|week)
 * {unit?} "?" makes that token optional. Output: (day|week|month)?
 *
 * {day} Any reference to tokens in the modifiers array will include all with the same name. Output: (yesterday|today|tomorrow)
 *
 * All spaces are optional and will be converted to "\s*"
 *
 * Locale arrays months, weekdays, units, numbers, as well as the "src" field for
 * all entries in the modifiers array follow a special format indicated by a colon:
 *
 * minute:|s  = minute|minutes
 * thicke:n|r = thicken|thicker
 *
 * Additionally in the months, weekdays, units, and numbers array these will be added at indexes that are multiples
 * of the relevant number for retrieval. For example having "sunday:|s" in the units array will result in:
 *
 * units: ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sundays']
 *
 * When matched, the index will be found using:
 *
 * units.indexOf(match) % 7;
 *
 * Resulting in the correct index with any number of alternates for that entry.
 *
 */

Date.addLocale('nl', {
  'plural': true,
  'months': 'januari,februari,maart,april,mei,juni,juli,augustus,september,oktober,november,december',
  'weekdays': 'zondag|zo,maandag|ma,dinsdag|di,woensdag|woe|wo,donderdag|do,vrijdag|vrij|vr,zaterdag|za',
  'units': 'milliseconde:|n,seconde:|n,minu:ut|ten,uur,dag:|en,we:ek|ken,maand:|en,jaar',
  'numbers': 'een,twee,drie,vier,vijf,zes,zeven,acht,negen',
  'tokens': '',
  'short':'{d} {Month} {yyyy}',
  'long': '{d} {Month} {yyyy} {H}:{mm}',
  'full': '{Weekday} {d} {Month} {yyyy} {H}:{mm}:{ss}',
  'past': '{num} {unit} {sign}',
  'future': '{num} {unit} {sign}',
  'duration': '{num} {unit}',
  'timeMarker': "'s|om",
  'modifiers': [
    { 'name': 'day', 'src': 'gisteren', 'value': -1 },
    { 'name': 'day', 'src': 'vandaag', 'value': 0 },
    { 'name': 'day', 'src': 'morgen', 'value': 1 },
    { 'name': 'day', 'src': 'overmorgen', 'value': 2 },
    { 'name': 'sign', 'src': 'geleden', 'value': -1 },
    { 'name': 'sign', 'src': 'vanaf nu', 'value': 1 },
    { 'name': 'shift', 'src': 'laatste|vorige|afgelopen', 'value': -1 },
    { 'name': 'shift', 'src': 'volgend:|e', 'value': 1 }
  ],
  'dateParse': [
    '{num} {unit} {sign}',
    '{0?} {unit=5-7} {shift}',
    '{0?} {shift} {unit=5-7}'
  ],
  'timeParse': [
    '{weekday?} {date?} {month} {year?}',
    '{shift} {weekday}'
  ]
});
/*
 *
 * Date.addLocale(<code>) adds this locale to Sugar.
 * To set the locale globally, simply call:
 *
 * Date.setLocale('pl');
 *
 * var locale = Date.getLocale(<code>) will return this object, which
 * can be tweaked to change the behavior of parsing/formatting in the locales.
 *
 * locale.addFormat adds a date format (see this file for examples).
 * Special tokens in the date format will be parsed out into regex tokens:
 *
 * {0} is a reference to an entry in locale.optionals. Output: (?:the)?
 * {unit} is a reference to all units. Output: (day|week|month|...)
 * {unit3} is a reference to a specific unit. Output: (hour)
 * {unit3-5} is a reference to a subset of the units array. Output: (hour|day|week)
 * {unit?} "?" makes that token optional. Output: (day|week|month)?
 *
 * {day} Any reference to tokens in the modifiers array will include all with the same name. Output: (yesterday|today|tomorrow)
 *
 * All spaces are optional and will be converted to "\s*"
 *
 * Locale arrays months, weekdays, units, numbers, as well as the "src" field for
 * all entries in the modifiers array follow a special format indicated by a colon:
 *
 * minute:|s  = minute|minutes
 * thicke:n|r = thicken|thicker
 *
 * Additionally in the months, weekdays, units, and numbers array these will be added at indexes that are multiples
 * of the relevant number for retrieval. For example having "sunday:|s" in the units array will result in:
 *
 * units: ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sundays']
 *
 * When matched, the index will be found using:
 *
 * units.indexOf(match) % 7;
 *
 * Resulting in the correct index with any number of alternates for that entry.
 *
 */

Date.addLocale('pl', {
  'plural':    true,
  'months':    'Styczeń|Stycznia,Luty|Lutego,Marzec|Marca,Kwiecień|Kwietnia,Maj|Maja,Czerwiec|Czerwca,Lipiec|Lipca,Sierpień|Sierpnia,Wrzesień|Września,Październik|Października,Listopad|Listopada,Grudzień|Grudnia',
  'weekdays':  'Niedziela|Niedzielę,Poniedziałek,Wtorek,Środ:a|ę,Czwartek,Piątek,Sobota|Sobotę',
  'units':     'milisekund:a|y|,sekund:a|y|,minut:a|y|,godzin:a|y|,dzień|dni,tydzień|tygodnie|tygodni,miesiące|miesiące|miesięcy,rok|lata|lat',
  'numbers':   'jeden|jedną,dwa|dwie,trzy,cztery,pięć,sześć,siedem,osiem,dziewięć,dziesięć',
  'optionals': 'w|we,roku',
  'short':     '{d} {Month} {yyyy}',
  'long':      '{d} {Month} {yyyy} {H}:{mm}',
  'full' :     '{Weekday}, {d} {Month} {yyyy} {H}:{mm}:{ss}',
  'past':      '{num} {unit} {sign}',
  'future':    '{sign} {num} {unit}',
  'duration':  '{num} {unit}',
  'timeMarker':'o',
  'ampm':      'am,pm',
  'modifiers': [
    { 'name': 'day', 'src': 'przedwczoraj', 'value': -2 },
    { 'name': 'day', 'src': 'wczoraj', 'value': -1 },
    { 'name': 'day', 'src': 'dzisiaj|dziś', 'value': 0 },
    { 'name': 'day', 'src': 'jutro', 'value': 1 },
    { 'name': 'day', 'src': 'pojutrze', 'value': 2 },
    { 'name': 'sign', 'src': 'temu|przed', 'value': -1 },
    { 'name': 'sign', 'src': 'za', 'value': 1 },
    { 'name': 'shift', 'src': 'zeszły|zeszła|ostatni|ostatnia', 'value': -1 },
    { 'name': 'shift', 'src': 'następny|następna|następnego|przyszły|przyszła|przyszłego', 'value': 1 }
  ],
  'dateParse': [
    '{num} {unit} {sign}',
    '{sign} {num} {unit}',
    '{month} {year}',
    '{shift} {unit=5-7}',
    '{0} {shift?} {weekday}'
  ],
  'timeParse': [
    '{date} {month} {year?} {1}',
    '{0} {shift?} {weekday}'
  ]
});

/*
 *
 * Date.addLocale(<code>) adds this locale to Sugar.
 * To set the locale globally, simply call:
 *
 * Date.setLocale('pt');
 *
 * var locale = Date.getLocale(<code>) will return this object, which
 * can be tweaked to change the behavior of parsing/formatting in the locales.
 *
 * locale.addFormat adds a date format (see this file for examples).
 * Special tokens in the date format will be parsed out into regex tokens:
 *
 * {0} is a reference to an entry in locale.tokens. Output: (?:the)?
 * {unit} is a reference to all units. Output: (day|week|month|...)
 * {unit3} is a reference to a specific unit. Output: (hour)
 * {unit3-5} is a reference to a subset of the units array. Output: (hour|day|week)
 * {unit?} "?" makes that token optional. Output: (day|week|month)?
 *
 * {day} Any reference to tokens in the modifiers array will include all with the same name. Output: (yesterday|today|tomorrow)
 *
 * All spaces are optional and will be converted to "\s*"
 *
 * Locale arrays months, weekdays, units, numbers, as well as the "src" field for
 * all entries in the modifiers array follow a special format indicated by a colon:
 *
 * minute:|s  = minute|minutes
 * thicke:n|r = thicken|thicker
 *
 * Additionally in the months, weekdays, units, and numbers array these will be added at indexes that are multiples
 * of the relevant number for retrieval. For example having "sunday:|s" in the units array will result in:
 *
 * units: ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sundays']
 *
 * When matched, the index will be found using:
 *
 * units.indexOf(match) % 7;
 *
 * Resulting in the correct index with any number of alternates for that entry.
 *
 */

Date.addLocale('pt', {
  'plural': true,
  'months': 'janeiro,fevereiro,março,abril,maio,junho,julho,agosto,setembro,outubro,novembro,dezembro',
  'weekdays': 'domingo,segunda-feira,terça-feira,quarta-feira,quinta-feira,sexta-feira,sábado|sabado',
  'units': 'milisegundo:|s,segundo:|s,minuto:|s,hora:|s,dia:|s,semana:|s,mês|mêses|mes|meses,ano:|s',
  'numbers': 'um,dois,três|tres,quatro,cinco,seis,sete,oito,nove,dez,uma,duas',
  'tokens': 'a,de',
  'short':'{d} de {month} de {yyyy}',
  'long': '{d} de {month} de {yyyy} {H}:{mm}',
  'full': '{Weekday}, {d} de {month} de {yyyy} {H}:{mm}:{ss}',
  'past': '{num} {unit} {sign}',
  'future': '{sign} {num} {unit}',
  'duration': '{num} {unit}',
  'timeMarker': 'às',
  'ampm': 'am,pm',
  'modifiers': [
    { 'name': 'day', 'src': 'anteontem', 'value': -2 },
    { 'name': 'day', 'src': 'ontem', 'value': -1 },
    { 'name': 'day', 'src': 'hoje', 'value': 0 },
    { 'name': 'day', 'src': 'amanh:ã|a', 'value': 1 },
    { 'name': 'sign', 'src': 'atrás|atras|há|ha', 'value': -1 },
    { 'name': 'sign', 'src': 'daqui a', 'value': 1 },
    { 'name': 'shift', 'src': 'passad:o|a', 'value': -1 },
    { 'name': 'shift', 'src': 'próximo|próxima|proximo|proxima', 'value': 1 }
  ],
  'dateParse': [
    '{num} {unit} {sign}',
    '{sign} {num} {unit}',
    '{0?} {unit=5-7} {shift}',
    '{0?} {shift} {unit=5-7}'
  ],
  'timeParse': [
    '{date?} {1?} {month} {1?} {year?}',
    '{0?} {shift} {weekday}'
  ]
});

/*
 *
 * Date.addLocale(<code>) adds this locale to Sugar.
 * To set the locale globally, simply call:
 *
 * Date.setLocale('ru');
 *
 * var locale = Date.getLocale(<code>) will return this object, which
 * can be tweaked to change the behavior of parsing/formatting in the locales.
 *
 * locale.addFormat adds a date format (see this file for examples).
 * Special tokens in the date format will be parsed out into regex tokens:
 *
 * {0} is a reference to an entry in locale.tokens. Output: (?:the)?
 * {unit} is a reference to all units. Output: (day|week|month|...)
 * {unit3} is a reference to a specific unit. Output: (hour)
 * {unit3-5} is a reference to a subset of the units array. Output: (hour|day|week)
 * {unit?} "?" makes that token optional. Output: (day|week|month)?
 *
 * {day} Any reference to tokens in the modifiers array will include all with the same name. Output: (yesterday|today|tomorrow)
 *
 * All spaces are optional and will be converted to "\s*"
 *
 * Locale arrays months, weekdays, units, numbers, as well as the "src" field for
 * all entries in the modifiers array follow a special format indicated by a colon:
 *
 * minute:|s  = minute|minutes
 * thicke:n|r = thicken|thicker
 *
 * Additionally in the months, weekdays, units, and numbers array these will be added at indexes that are multiples
 * of the relevant number for retrieval. For example having "sunday:|s" in the units array will result in:
 *
 * units: ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sundays']
 *
 * When matched, the index will be found using:
 *
 * units.indexOf(match) % 7;
 *
 * Resulting in the correct index with any number of alternates for that entry.
 *
 */

Date.addLocale('ru', {
  'months': 'Январ:я|ь,Феврал:я|ь,Март:а|,Апрел:я|ь,Ма:я|й,Июн:я|ь,Июл:я|ь,Август:а|,Сентябр:я|ь,Октябр:я|ь,Ноябр:я|ь,Декабр:я|ь',
  'weekdays': 'Воскресенье,Понедельник,Вторник,Среда,Четверг,Пятница,Суббота',
  'units': 'миллисекунд:а|у|ы|,секунд:а|у|ы|,минут:а|у|ы|,час:||а|ов,день|день|дня|дней,недел:я|ю|и|ь|е,месяц:||а|ев|е,год|год|года|лет|году',
  'numbers': 'од:ин|ну,дв:а|е,три,четыре,пять,шесть,семь,восемь,девять,десять',
  'tokens': 'в|на,года',
  'short':'{d} {month} {yyyy} года',
  'long': '{d} {month} {yyyy} года {H}:{mm}',
  'full': '{Weekday} {d} {month} {yyyy} года {H}:{mm}:{ss}',
  'relative': function(num, unit, ms, format) {
    var numberWithUnit, last = num.toString().slice(-1);
    switch(true) {
      case num >= 11 && num <= 15: mult = 3; break;
      case last == 1: mult = 1; break;
      case last >= 2 && last <= 4: mult = 2; break;
      default: mult = 3;
    }
    numberWithUnit = num + ' ' + this['units'][(mult * 8) + unit];
    switch(format) {
      case 'duration':  return numberWithUnit;
      case 'past':      return numberWithUnit + ' назад';
      case 'future':    return 'через ' + numberWithUnit;
    }
  },
  'timeMarker': 'в',
  'ampm': ' утра, вечера',
  'modifiers': [
    { 'name': 'day', 'src': 'позавчера', 'value': -2 },
    { 'name': 'day', 'src': 'вчера', 'value': -1 },
    { 'name': 'day', 'src': 'сегодня', 'value': 0 },
    { 'name': 'day', 'src': 'завтра', 'value': 1 },
    { 'name': 'day', 'src': 'послезавтра', 'value': 2 },
    { 'name': 'sign', 'src': 'назад', 'value': -1 },
    { 'name': 'sign', 'src': 'через', 'value': 1 },
    { 'name': 'shift', 'src': 'прошл:ый|ой|ом', 'value': -1 },
    { 'name': 'shift', 'src': 'следующ:ий|ей|ем', 'value': 1 }
  ],
  'dateParse': [
    '{num} {unit} {sign}',
    '{sign} {num} {unit}',
    '{month} {year}',
    '{0?} {shift} {unit=5-7}'
  ],
  'timeParse': [
    '{date} {month} {year?} {1?}',
    '{0?} {shift} {weekday}'
  ]
});

/*
 *
 * Date.addLocale(<code>) adds this locale to Sugar.
 * To set the locale globally, simply call:
 *
 * Date.setLocale('sv');
 *
 * var locale = Date.getLocale(<code>) will return this object, which
 * can be tweaked to change the behavior of parsing/formatting in the locales.
 *
 * locale.addFormat adds a date format (see this file for examples).
 * Special tokens in the date format will be parsed out into regex tokens:
 *
 * {0} is a reference to an entry in locale.tokens. Output: (?:the)?
 * {unit} is a reference to all units. Output: (day|week|month|...)
 * {unit3} is a reference to a specific unit. Output: (hour)
 * {unit3-5} is a reference to a subset of the units array. Output: (hour|day|week)
 * {unit?} "?" makes that token optional. Output: (day|week|month)?
 *
 * {day} Any reference to tokens in the modifiers array will include all with the same name. Output: (yesterday|today|tomorrow)
 *
 * All spaces are optional and will be converted to "\s*"
 *
 * Locale arrays months, weekdays, units, numbers, as well as the "src" field for
 * all entries in the modifiers array follow a special format indicated by a colon:
 *
 * minute:|s  = minute|minutes
 * thicke:n|r = thicken|thicker
 *
 * Additionally in the months, weekdays, units, and numbers array these will be added at indexes that are multiples
 * of the relevant number for retrieval. For example having "sunday:|s" in the units array will result in:
 *
 * units: ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sundays']
 *
 * When matched, the index will be found using:
 *
 * units.indexOf(match) % 7;
 *
 * Resulting in the correct index with any number of alternates for that entry.
 *
 */

Date.addLocale('sv', {
  'plural': true,
  'months': 'januari,februari,mars,april,maj,juni,juli,augusti,september,oktober,november,december',
  'weekdays': 'söndag|sondag,måndag:|en+mandag:|en,tisdag,onsdag,torsdag,fredag,lördag|lordag',
  'units': 'millisekund:|er,sekund:|er,minut:|er,timm:e|ar,dag:|ar,veck:a|or|an,månad:|er|en+manad:|er|en,år:||et+ar:||et',
  'numbers': 'en|ett,två|tva,tre,fyra,fem,sex,sju,åtta|atta,nio,tio',
  'tokens': 'den,för|for',
  'articles': 'den',
  'short':'den {d} {month} {yyyy}',
  'long': 'den {d} {month} {yyyy} {H}:{mm}',
  'full': '{Weekday} den {d} {month} {yyyy} {H}:{mm}:{ss}',
  'past': '{num} {unit} {sign}',
  'future': '{sign} {num} {unit}',
  'duration': '{num} {unit}',
  'ampm': 'am,pm',
  'modifiers': [
    { 'name': 'day', 'src': 'förrgår|i förrgår|iförrgår|forrgar|i forrgar|iforrgar', 'value': -2 },
    { 'name': 'day', 'src': 'går|i går|igår|gar|i gar|igar', 'value': -1 },
    { 'name': 'day', 'src': 'dag|i dag|idag', 'value': 0 },
    { 'name': 'day', 'src': 'morgon|i morgon|imorgon', 'value': 1 },
    { 'name': 'day', 'src': 'över morgon|övermorgon|i över morgon|i övermorgon|iövermorgon|over morgon|overmorgon|i over morgon|i overmorgon|iovermorgon', 'value': 2 },
    { 'name': 'sign', 'src': 'sedan|sen', 'value': -1 },
    { 'name': 'sign', 'src': 'om', 'value':  1 },
    { 'name': 'shift', 'src': 'i förra|förra|i forra|forra', 'value': -1 },
    { 'name': 'shift', 'src': 'denna', 'value': 0 },
    { 'name': 'shift', 'src': 'nästa|nasta', 'value': 1 }
  ],
  'dateParse': [
    '{num} {unit} {sign}',
    '{sign} {num} {unit}',
    '{1?} {num} {unit} {sign}',
    '{shift} {unit=5-7}'
  ],
  'timeParse': [
    '{0?} {weekday?} {date?} {month} {year}',
    '{date} {month}',
    '{shift} {weekday}'
  ]
});

/*
 *
 * Date.addLocale(<code>) adds this locale to Sugar.
 * To set the locale globally, simply call:
 *
 * Date.setLocale('zh-CN');
 *
 * var locale = Date.getLocale(<code>) will return this object, which
 * can be tweaked to change the behavior of parsing/formatting in the locales.
 *
 * locale.addFormat adds a date format (see this file for examples).
 * Special tokens in the date format will be parsed out into regex tokens:
 *
 * {0} is a reference to an entry in locale.tokens. Output: (?:the)?
 * {unit} is a reference to all units. Output: (day|week|month|...)
 * {unit3} is a reference to a specific unit. Output: (hour)
 * {unit3-5} is a reference to a subset of the units array. Output: (hour|day|week)
 * {unit?} "?" makes that token optional. Output: (day|week|month)?
 *
 * {day} Any reference to tokens in the modifiers array will include all with the same name. Output: (yesterday|today|tomorrow)
 *
 * All spaces are optional and will be converted to "\s*"
 *
 * Locale arrays months, weekdays, units, numbers, as well as the "src" field for
 * all entries in the modifiers array follow a special format indicated by a colon:
 *
 * minute:|s  = minute|minutes
 * thicke:n|r = thicken|thicker
 *
 * Additionally in the months, weekdays, units, and numbers array these will be added at indexes that are multiples
 * of the relevant number for retrieval. For example having "sunday:|s" in the units array will result in:
 *
 * units: ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sundays']
 *
 * When matched, the index will be found using:
 *
 * units.indexOf(match) % 7;
 *
 * Resulting in the correct index with any number of alternates for that entry.
 *
 */

Date.addLocale('zh-CN', {
  'variant': true,
  'monthSuffix': '月',
  'weekdays': '星期日|周日,星期一|周一,星期二|周二,星期三|周三,星期四|周四,星期五|周五,星期六|周六',
  'units': '毫秒,秒钟,分钟,小时,天,个星期|周,个月,年',
  'tokens': '日|号',
  'short':'{yyyy}年{M}月{d}日',
  'long': '{yyyy}年{M}月{d}日 {tt}{h}:{mm}',
  'full': '{yyyy}年{M}月{d}日 {weekday} {tt}{h}:{mm}:{ss}',
  'past': '{num}{unit}{sign}',
  'future': '{num}{unit}{sign}',
  'duration': '{num}{unit}',
  'timeSuffixes': '点|时,分钟?,秒',
  'ampm': '上午,下午',
  'modifiers': [
    { 'name': 'day', 'src': '前天', 'value': -2 },
    { 'name': 'day', 'src': '昨天', 'value': -1 },
    { 'name': 'day', 'src': '今天', 'value': 0 },
    { 'name': 'day', 'src': '明天', 'value': 1 },
    { 'name': 'day', 'src': '后天', 'value': 2 },
    { 'name': 'sign', 'src': '前', 'value': -1 },
    { 'name': 'sign', 'src': '后', 'value':  1 },
    { 'name': 'shift', 'src': '上|去', 'value': -1 },
    { 'name': 'shift', 'src': '这', 'value':  0 },
    { 'name': 'shift', 'src': '下|明', 'value':  1 }
  ],
  'dateParse': [
    '{num}{unit}{sign}',
    '{shift}{unit=5-7}'
  ],
  'timeParse': [
    '{shift}{weekday}',
    '{year}年{month?}月?{date?}{0?}',
    '{month}月{date?}{0?}',
    '{date}[日号]'
  ]
});

/*
 *
 * Date.addLocale(<code>) adds this locale to Sugar.
 * To set the locale globally, simply call:
 *
 * Date.setLocale('zh-TW');
 *
 * var locale = Date.getLocale(<code>) will return this object, which
 * can be tweaked to change the behavior of parsing/formatting in the locales.
 *
 * locale.addFormat adds a date format (see this file for examples).
 * Special tokens in the date format will be parsed out into regex tokens:
 *
 * {0} is a reference to an entry in locale.tokens. Output: (?:the)?
 * {unit} is a reference to all units. Output: (day|week|month|...)
 * {unit3} is a reference to a specific unit. Output: (hour)
 * {unit3-5} is a reference to a subset of the units array. Output: (hour|day|week)
 * {unit?} "?" makes that token optional. Output: (day|week|month)?
 *
 * {day} Any reference to tokens in the modifiers array will include all with the same name. Output: (yesterday|today|tomorrow)
 *
 * All spaces are optional and will be converted to "\s*"
 *
 * Locale arrays months, weekdays, units, numbers, as well as the "src" field for
 * all entries in the modifiers array follow a special format indicated by a colon:
 *
 * minute:|s  = minute|minutes
 * thicke:n|r = thicken|thicker
 *
 * Additionally in the months, weekdays, units, and numbers array these will be added at indexes that are multiples
 * of the relevant number for retrieval. For example having "sunday:|s" in the units array will result in:
 *
 * units: ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sundays']
 *
 * When matched, the index will be found using:
 *
 * units.indexOf(match) % 7;
 *
 * Resulting in the correct index with any number of alternates for that entry.
 *
 */

  //'zh-TW': '1;月;年;;星期日|週日,星期一|週一,星期二|週二,星期三|週三,星期四|週四,星期五|週五,星期六|週六;毫秒,秒鐘,分鐘,小時,天,個星期|週,個月,年;;;日|號;;上午,下午;點|時,分鐘?,秒;{num}{unit}{sign},{shift}{unit=5-7};{shift}{weekday},{year}年{month?}月?{date?}{0},{month}月{date?}{0},{date}{0};{yyyy}年{M}月{d}日 {Weekday};{tt}{h}:{mm}:{ss};前天,昨天,今天,明天,後天;,前,,後;,上|去,這,下|明',

Date.addLocale('zh-TW', {
  'monthSuffix': '月',
  'weekdays': '星期日|週日,星期一|週一,星期二|週二,星期三|週三,星期四|週四,星期五|週五,星期六|週六',
  'units': '毫秒,秒鐘,分鐘,小時,天,個星期|週,個月,年',
  'tokens': '日|號',
  'short':'{yyyy}年{M}月{d}日',
  'long': '{yyyy}年{M}月{d}日 {tt}{h}:{mm}',
  'full': '{yyyy}年{M}月{d}日 {Weekday} {tt}{h}:{mm}:{ss}',
  'past': '{num}{unit}{sign}',
  'future': '{num}{unit}{sign}',
  'duration': '{num}{unit}',
  'timeSuffixes': '點|時,分鐘?,秒',
  'ampm': '上午,下午',
  'modifiers': [
    { 'name': 'day', 'src': '前天', 'value': -2 },
    { 'name': 'day', 'src': '昨天', 'value': -1 },
    { 'name': 'day', 'src': '今天', 'value': 0 },
    { 'name': 'day', 'src': '明天', 'value': 1 },
    { 'name': 'day', 'src': '後天', 'value': 2 },
    { 'name': 'sign', 'src': '前', 'value': -1 },
    { 'name': 'sign', 'src': '後', 'value': 1 },
    { 'name': 'shift', 'src': '上|去', 'value': -1 },
    { 'name': 'shift', 'src': '這', 'value':  0 },
    { 'name': 'shift', 'src': '下|明', 'value':  1 }
  ],
  'dateParse': [
    '{num}{unit}{sign}',
    '{shift}{unit=5-7}'
  ],
  'timeParse': [
    '{shift}{weekday}',
    '{year}年{month?}月?{date?}{0?}',
    '{month}月{date?}{0?}',
    '{date}[日號]'
  ]
});

})();
}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{}],15:[function(require,module,exports){
(function (global,Buffer){
/*
 *  Sugar v1.5.0
 *
 *  Freely distributable and licensed under the MIT-style license.
 *  Copyright (c) Andrew Plummer
 *  https://sugarjs.com/
 *
 * ---------------------------- */
(function() {
  'use strict';

    /***
     * @module Core
     * @description Core method extension and restoration.
     ***/

    // The global context
    var globalContext = typeof global !== 'undefined' && global.Object ? global : this;

    // Internal hasOwnProperty
    var internalHasOwnProperty = Object.prototype.hasOwnProperty;

    // Property descriptors exist in IE8 but will error when trying to define a property on
    // native objects. IE8 does not have defineProperies, however, so this check saves a try/catch block.
    var propertyDescriptorSupport = !!(Object.defineProperty && Object.defineProperties);

    // Natives by name.
    var natives = 'Boolean,Number,String,Array,Date,RegExp,Function'.split(',');

    // A hash of all methods by Native class
    var SugarMethods = {};

    // Class extending methods

    function initializeClasses() {
      initializeClass(Object);
      iterateOverObject(natives, function(i, name) {
        initializeClass(globalContext[name]);
      });
    }

    function initializeClass(klass) {
      extend(klass, {
        'extend': function(methods, instance) {
          extend(klass, methods, instance !== false);
        },
        'sugarRestore': function(methods) {
          restore(klass, methods);
        },
        'sugarRevert': function(methods) {
          revert(klass, methods);
        }
      }, false);
    }

    function extend(klass, methods, instance, polyfill) {
      var extendee;
      instance = instance !== false;
      extendee = instance ? klass.prototype : klass;
      iterateOverObject(methods, function(name, prop) {
        var existing = extendee[name],
            original = checkOriginalMethod(klass, name);
        if (typeof polyfill === 'function' && existing) {
          prop = wrapExisting(existing, prop, polyfill);
        }
        storeMethod(klass, name, instance, existing, prop, polyfill);
        if (polyfill !== true || !existing) {
          setProperty(extendee, name, prop);
        }
      });
    }

    function alias(klass, target, source) {
      var method = SugarMethods[klass][source];
      var obj = {};
      obj[target] = method.fn;
      extend(klass, obj, method.instance);
    }

    function restore(klass, methods) {
      return batchMethodExecute(klass, methods, function(target, name, m) {
        setProperty(target, name, m.fn);
      });
    }

    function revert(klass, methods) {
      return batchMethodExecute(klass, methods, function(target, name, m) {
        var original = checkOriginalMethod(klass, name);
        if (m.original) {
          setProperty(target, name, m.original);
        } else {
          delete target[name];
        }
      });
    }

    function batchMethodExecute(klass, methods, fn) {
      var all = !methods, changed = false;
      if (typeof methods === 'string') methods = [methods];
      iterateOverObject(SugarMethods[klass], function(name, m) {
        if (all || methods.indexOf(name) !== -1) {
          changed = true;
          fn(m.instance ? klass.prototype : klass, name, m);
        }
      });
      return changed;
    }

    function checkOriginalMethod(klass, name) {
      var methods = SugarMethods[klass];
      var method = methods && methods[name];
      return method && method.original;
    }

    function wrapExisting(originalFn, extendedFn, condition) {
      return function(a) {
        return condition.apply(this, arguments) ?
               extendedFn.apply(this, arguments) :
               originalFn.apply(this, arguments);
      }
    }

    function wrapInstanceMethod(fn) {
      return function(obj) {
        var args = arguments, newArgs = [], i;
        for(i = 1;i < args.length;i++) {
          newArgs.push(args[i]);
        }
        return fn.apply(obj, newArgs);
      };
    }

    function storeMethod(klass, name, instance, existing, prop, polyfill) {
      var result = instance ? wrapInstanceMethod(prop) : prop;
      var methods = SugarMethods[klass];
      if (!methods) {
        methods = SugarMethods[klass] = {};
      }
      setProperty(methods, name, result, true);
      if (typeof prop === 'function') {
        setProperty(result, 'fn', prop);
        setProperty(result, 'original', existing);
        setProperty(result, 'instance', instance);
        setProperty(result, 'polyfill', polyfill);
      }
    }

    function setProperty(target, name, property, enumerable) {
      if (propertyDescriptorSupport) {
        Object.defineProperty(target, name, {
          value: property,
          enumerable: !!enumerable,
          configurable: true,
          writable: true
        });
      } else {
        target[name] = property;
      }
    }

    function iterateOverObject(obj, fn) {
      var key;
      for(key in obj) {
        if (!hasOwnProperty(obj, key)) continue;
        if (fn.call(obj, key, obj[key], obj) === false) break;
      }
    }

    function hasOwnProperty(obj, prop) {
      return !!obj && internalHasOwnProperty.call(obj, prop);
    }

    initializeClasses();


    /***
     * @module Common
     * @description Internal utility and common methods.
     ***/


    // Internal toString
    var internalToString = Object.prototype.toString;

    // Are regexes type function?
    var regexIsFunction = typeof RegExp() === 'function';

    // Do strings have no keys?
    var noKeysInStringObjects = !('0' in new String('a'));

    // Type check methods need a way to be accessed dynamically.
    var typeChecks = {};

    // Classes that can be matched by value
    var matchedByValueReg = /^\[object Date|Array|String|Number|RegExp|Boolean|Arguments\]$/;

    var isBoolean  = buildPrimitiveClassCheck('boolean', natives[0]);
    var isNumber   = buildPrimitiveClassCheck('number',  natives[1]);
    var isString   = buildPrimitiveClassCheck('string',  natives[2]);

    var isArray    = buildClassCheck(natives[3]);
    var isDate     = buildClassCheck(natives[4]);
    var isRegExp   = buildClassCheck(natives[5]);


    // Wanted to enhance performance here by using simply "typeof"
    // but Firefox has two major issues that make this impossible,
    // one fixed, the other not. Despite being typeof "function"
    // the objects below still report in as [object Function], so
    // we need to perform a full class check here.
    //
    // 1. Regexes can be typeof "function" in FF < 3
    //    https://bugzilla.mozilla.org/show_bug.cgi?id=61911 (fixed)
    //
    // 2. HTMLEmbedElement and HTMLObjectElement are be typeof "function"
    //    https://bugzilla.mozilla.org/show_bug.cgi?id=268945 (won't fix)
    //
    var isFunction = buildClassCheck(natives[6]);

    function isClass(obj, klass, cached) {
      var k = cached || className(obj);
      return k === '[object '+klass+']';
    }

    function buildClassCheck(klass) {
      var fn = (klass === 'Array' && Array.isArray) || function(obj, cached) {
        return isClass(obj, klass, cached);
      };
      typeChecks[klass] = fn;
      return fn;
    }

    function buildPrimitiveClassCheck(type, klass) {
      var fn = function(obj) {
        if (isObjectType(obj)) {
          return isClass(obj, klass);
        }
        return typeof obj === type;
      }
      typeChecks[klass] = fn;
      return fn;
    }

    function className(obj) {
      return internalToString.call(obj);
    }

    function extendSimilar(klass, set, fn, instance, polyfill, override) {
      var methods = {};
      set = isString(set) ? set.split(',') : set;
      set.forEach(function(name, i) {
        fn(methods, name, i);
      });
      extend(klass, methods, instance, polyfill, override);
    }

    // Argument helpers

    function isArgumentsObject(obj, klass) {
      klass = klass || className(obj);
      // .callee exists on Arguments objects in < IE8
      return hasProperty(obj, 'length') && (klass === '[object Arguments]' || !!obj.callee);
    }

    function checkCallback(fn) {
      if (!fn || !fn.call) {
        throw new TypeError('Callback is not callable');
      }
    }

    // Coerces an object to a positive integer.
    // Does not allow NaN, or Infinity.
    function coercePositiveInteger(n) {
      n = +n || 0;
      if (n < 0 || !isNumber(n) || !isFinite(n)) {
        throw new RangeError('Invalid number');
      }
      return trunc(n);
    }


    // General helpers

    function isDefined(o) {
      return o !== undefined;
    }

    function isUndefined(o) {
      return o === undefined;
    }


    // Object helpers

    function hasProperty(obj, prop) {
      return !isPrimitiveType(obj) && prop in obj;
    }

    function isObjectType(obj) {
      // 1. Check for null
      // 2. Check for regexes in environments where they are "functions".
      return !!obj && (typeof obj === 'object' || (regexIsFunction && isRegExp(obj)));
    }

    function isPrimitiveType(obj) {
      var type = typeof obj;
      return obj == null || type === 'string' || type === 'number' || type === 'boolean';
    }

    function isPlainObject(obj, klass) {
      klass = klass || className(obj);
      try {
        // Not own constructor property must be Object
        // This code was borrowed from jQuery.isPlainObject
        if (obj && obj.constructor &&
              !hasOwnProperty(obj, 'constructor') &&
              !hasOwnProperty(obj.constructor.prototype, 'isPrototypeOf')) {
          return false;
        }
      } catch (e) {
        // IE8,9 Will throw exceptions on certain host objects.
        return false;
      }
      // === on the constructor is not safe across iframes
      // 'hasOwnProperty' ensures that the object also inherits
      // from Object, which is false for DOMElements in IE.
      return !!obj && klass === '[object Object]' && 'hasOwnProperty' in obj;
    }

    function simpleRepeat(n, fn) {
      for(var i = 0; i < n; i++) {
        fn(i);
      }
    }

    function simpleMerge(target, source) {
      iterateOverObject(source, function(key) {
        target[key] = source[key];
      });
      return target;
    }

     // Make primtives types like strings into objects.
     function coercePrimitiveToObject(obj) {
       if (isPrimitiveType(obj)) {
         obj = Object(obj);
       }
       if (noKeysInStringObjects && isString(obj)) {
         forceStringCoercion(obj);
       }
       return obj;
     }

     // Force strings to have their indexes set in
     // environments that don't do this automatically.
     function forceStringCoercion(obj) {
       var i = 0, chr;
       while(chr = obj.charAt(i)) {
         obj[i++] = chr;
       }
     }

    // Hash definition

    function Hash(obj) {
      simpleMerge(this, coercePrimitiveToObject(obj));
    };

    Hash.prototype.constructor = Object;

    // Math helpers

    var abs   = Math.abs;
    var pow   = Math.pow;
    var ceil  = Math.ceil;
    var floor = Math.floor;
    var round = Math.round;
    var min   = Math.min;
    var max   = Math.max;

    function withPrecision(val, precision, fn) {
      var multiplier = pow(10, abs(precision || 0));
      fn = fn || round;
      if (precision < 0) multiplier = 1 / multiplier;
      return fn(val * multiplier) / multiplier;
    }

    // Full width number helpers

    var HalfWidthZeroCode = 0x30;
    var HalfWidthNineCode = 0x39;
    var FullWidthZeroCode = 0xff10;
    var FullWidthNineCode = 0xff19;

    var HalfWidthPeriod = '.';
    var FullWidthPeriod = '．';
    var HalfWidthComma  = ',';

    // Used here and later in the Date package.
    var FullWidthDigits   = '';

    var NumberNormalizeMap = {};
    var NumberNormalizeReg;

    function codeIsNumeral(code) {
      return (code >= HalfWidthZeroCode && code <= HalfWidthNineCode) ||
             (code >= FullWidthZeroCode && code <= FullWidthNineCode);
    }

    function buildNumberHelpers() {
      var digit, i;
      for(i = 0; i <= 9; i++) {
        digit = chr(i + FullWidthZeroCode);
        FullWidthDigits += digit;
        NumberNormalizeMap[digit] = chr(i + HalfWidthZeroCode);
      }
      NumberNormalizeMap[HalfWidthComma] = '';
      NumberNormalizeMap[FullWidthPeriod] = HalfWidthPeriod;
      // Mapping this to itself to easily be able to easily
      // capture it in stringToNumber to detect decimals later.
      NumberNormalizeMap[HalfWidthPeriod] = HalfWidthPeriod;
      NumberNormalizeReg = RegExp('[' + FullWidthDigits + FullWidthPeriod + HalfWidthComma + HalfWidthPeriod + ']', 'g');
    }

    // String helpers

    function chr(num) {
      return String.fromCharCode(num);
    }

    // WhiteSpace/LineTerminator as defined in ES5.1 plus Unicode characters in the Space, Separator category.
    function getTrimmableCharacters() {
      return '\u0009\u000A\u000B\u000C\u000D\u0020\u00A0\u1680\u180E\u2000\u2001\u2002\u2003\u2004\u2005\u2006\u2007\u2008\u2009\u200A\u202F\u205F\u2028\u2029\u3000\uFEFF';
    }

    function repeatString(str, num) {
      var result = '';
      str = str.toString();
      while (num > 0) {
        if (num & 1) {
          result += str;
        }
        if (num >>= 1) {
          str += str;
        }
      }
      return result;
    }

    // Returns taking into account full-width characters, commas, and decimals.
    function stringToNumber(str, base) {
      var sanitized, isDecimal;
      sanitized = str.replace(NumberNormalizeReg, function(chr) {
        var replacement = NumberNormalizeMap[chr];
        if (replacement === HalfWidthPeriod) {
          isDecimal = true;
        }
        return replacement;
      });
      return isDecimal ? parseFloat(sanitized) : parseInt(sanitized, base || 10);
    }


    // Used by Number and Date

    var trunc = Math.trunc || function(n) {
      if (n === 0 || !isFinite(n)) return n;
      return n < 0 ? ceil(n) : floor(n);
    }

    function padNumber(num, place, sign, base) {
      var str = abs(num).toString(base || 10);
      str = repeatString('0', place - str.replace(/\.\d+/, '').length) + str;
      if (sign || num < 0) {
        str = (num < 0 ? '-' : '+') + str;
      }
      return str;
    }

    function getOrdinalizedSuffix(num) {
      if (num >= 11 && num <= 13) {
        return 'th';
      } else {
        switch(num % 10) {
          case 1:  return 'st';
          case 2:  return 'nd';
          case 3:  return 'rd';
          default: return 'th';
        }
      }
    }


    // RegExp helpers

    function getRegExpFlags(reg, add) {
      var flags = '';
      add = add || '';
      function checkFlag(prop, flag) {
        if (prop || add.indexOf(flag) > -1) {
          flags += flag;
        }
      }
      checkFlag(reg.multiline, 'm');
      checkFlag(reg.ignoreCase, 'i');
      checkFlag(reg.global, 'g');
      checkFlag(reg.sticky, 'y');
      return flags;
    }

    function escapeRegExp(str) {
      if (!isString(str)) str = String(str);
      return str.replace(/([\\\/\'*+?|()\[\]{}.^$-])/g,'\\$1');
    }


    // Date helpers

    function callDateGet(d, method) {
      return d['get' + (d._utc ? 'UTC' : '') + method]();
    }

    function callDateSet(d, method, value) {
      return d['set' + (d._utc ? 'UTC' : '') + method](value);
    }

    // Used by Array#unique and Object.equal

    function stringify(thing, stack) {
      var type = typeof thing, isObject, isArrayLike, klass, value, arr, key, i, len;

      // Return quickly if string to save cycles
      if (type === 'string') return thing;

      klass       = internalToString.call(thing);
      isObject    = isPlainObject(thing, klass);
      isArrayLike = isArray(thing, klass) || isArgumentsObject(thing, klass);

      if (thing != null && isObject || isArrayLike) {
        // This method for checking for cyclic structures was egregiously stolen from
        // the ingenious method by @kitcambridge from the Underscore script:
        // https://github.com/documentcloud/underscore/issues/240
        if (!stack) stack = [];
        // Allowing a step into the structure before triggering this
        // script to save cycles on standard JSON structures and also to
        // try as hard as possible to catch basic properties that may have
        // been modified.
        if (stack.length > 1) {
          i = stack.length;
          while (i--) {
            if (stack[i] === thing) {
              return 'CYC';
            }
          }
        }
        stack.push(thing);
        value = thing.valueOf() + String(thing.constructor);
        arr = isArrayLike ? thing : Object.keys(thing).sort();
        for(i = 0, len = arr.length; i < len; i++) {
          key = isArrayLike ? i : arr[i];
          value += key + stringify(thing[key], stack);
        }
        stack.pop();
      } else if (1 / thing === -Infinity) {
        value = '-0';
      } else {
        value = String(thing && thing.valueOf ? thing.valueOf() : thing);
      }
      return type + klass + value;
    }

    function isEqual(a, b) {
      if (a === b) {
        // Return quickly up front when matching by reference,
        // but be careful about 0 !== -0.
        return a !== 0 || 1 / a === 1 / b;
      } else if (objectIsMatchedByValue(a) && objectIsMatchedByValue(b)) {
        return stringify(a) === stringify(b);
      }
      return false;
    }

    function objectIsMatchedByValue(obj) {
      // Only known objects are matched by value. This is notably excluding functions, DOM Elements, and instances of
      // user-created classes. The latter can arguably be matched by value, but distinguishing between these and
      // host objects -- which should never be compared by value -- is very tricky so not dealing with it here.
      var klass = className(obj);
      return matchedByValueReg.test(klass) || isPlainObject(obj, klass);
    }


    // Used by Array#at and String#at

    function getEntriesForIndexes(obj, args, isString) {
      var result,
          length    = obj.length,
          argsLen   = args.length,
          overshoot = args[argsLen - 1] !== false,
          multiple  = argsLen > (overshoot ? 1 : 2);
      if (!multiple) {
        return entryAtIndex(obj, length, args[0], overshoot, isString);
      }
      result = [];
      for (var i = 0; i < args.length; i++) {
        var index = args[i];
        if (!isBoolean(index)) {
          result.push(entryAtIndex(obj, length, index, overshoot, isString));
        }
      }
      return result;
    }

    function entryAtIndex(obj, length, index, overshoot, isString) {
      if (overshoot && index) {
        index = index % length;
        if (index < 0) index = length + index;
      }
      return isString ? obj.charAt(index) : obj[index];
    }

    // Used by the Array and Object packages.

    function transformArgument(el, map, context, mapArgs) {
      if (!map) {
        return el;
      } else if (map.apply) {
        return map.apply(context, mapArgs || []);
      } else if (isFunction(el[map])) {
        return el[map].call(el);
      } else {
        return el[map];
      }
    }

    function keysWithObjectCoercion(obj) {
      return Object.keys(coercePrimitiveToObject(obj));
    }

    // Object class methods implemented as instance methods. This method
    // is being called only on Hash and Object itself, so we don't want
    // to go through extend() here as it will create proxies that already
    // exist, which we want to avoid.

    function buildObjectInstanceMethods(set, target) {
      set.forEach(function(name) {
        var key = name === 'equals' ? 'equal' : name;
        // Polyfill methods like Object.keys may not be defined
        // on the Sugar global object so check the main namespace.
        var classFn = Object[key];
        var fn = function() {
          var args = arguments, newArgs = [this], i;
          for(i = 0;i < args.length;i++) {
            newArgs.push(args[i]);
          }
          return classFn.apply(null, newArgs);
        }
        setProperty(target.prototype, name, fn);
      });
    }

    buildNumberHelpers();

    /***
     * @module ES5
     * @description Shim methods that provide ES5 compatible functionality. This package can be excluded if you do not require legacy browser support (IE8 and below).
     *
     ***/


    /***
     * @namespace Object
     *
     ***/

    extend(Object, {

      'keys': function(obj) {
        var keys = [];
        if (!isObjectType(obj) && !isRegExp(obj) && !isFunction(obj)) {
          throw new TypeError('Object required');
        }
        iterateOverObject(obj, function(key, value) {
          keys.push(key);
        });
        return keys;
      }

    }, false, true);


    /***
     * @namespace Array
     *
     ***/

    // ECMA5 methods

    function arrayIndexOf(arr, search, fromIndex, increment) {
      var length = arr.length,
          fromRight = increment == -1,
          start = fromRight ? length - 1 : 0,
          index = toIntegerWithDefault(fromIndex, start);
      if (index < 0) {
        index = length + index;
      }
      if ((!fromRight && index < 0) || (fromRight && index >= length)) {
        index = start;
      }
      while((fromRight && index >= 0) || (!fromRight && index < length)) {
        if (arr[index] === search) {
          return index;
        }
        index += increment;
      }
      return -1;
    }

    function arrayReduce(arr, fn, initialValue, fromRight) {
      var length = arr.length, count = 0, defined = isDefined(initialValue), result, index;
      checkCallback(fn);
      if (length == 0 && !defined) {
        throw new TypeError('Reduce called on empty array with no initial value');
      } else if (defined) {
        result = initialValue;
      } else {
        result = arr[fromRight ? length - 1 : count];
        count++;
      }
      while(count < length) {
        index = fromRight ? length - count - 1 : count;
        if (index in arr) {
          result = fn(result, arr[index], index, arr);
        }
        count++;
      }
      return result;
    }

    function toIntegerWithDefault(i, d) {
      if (isNaN(i)) {
        return d;
      } else {
        return parseInt(i >> 0);
      }
    }

    function checkFirstArgumentExists(args) {
      if (args.length === 0) {
        throw new TypeError('First argument must be defined');
      }
    }


    extend(Array, {

      /***
       *
       * @method Array.isArray(<obj>)
       * @returns Boolean
       * @short Returns true if <obj> is an Array.
       * @extra This method is provided for browsers that don't support it internally.
       * @example
       *
       *   Array.isArray(3)        -> false
       *   Array.isArray(true)     -> false
       *   Array.isArray('wasabi') -> false
       *   Array.isArray([1,2,3])  -> true
       *
       ***/
      'isArray': function(obj) {
        return isArray(obj);
      }

    }, false, true);


    extend(Array, {

      /***
       * @method every(<f>, [scope])
       * @returns Boolean
       * @short Returns true if all elements in the array match <f>.
       * @extra [scope] is the %this% object. %all% is provided an alias. In addition to providing this method for browsers that don't support it natively, this method also implements %array_matching%.
       * @example
       *
       +   ['a','a','a'].every(function(n) {
       *     return n == 'a';
       *   });
       *   ['a','a','a'].every('a')   -> true
       *   [{a:2},{a:2}].every({a:2}) -> true
       ***/
      'every': function(fn, scope) {
        var length = this.length, index = 0;
        checkFirstArgumentExists(arguments);
        while(index < length) {
          if (index in this && !fn.call(scope, this[index], index, this)) {
            return false;
          }
          index++;
        }
        return true;
      },

      /***
       * @method some(<f>, [scope])
       * @returns Boolean
       * @short Returns true if any element in the array matches <f>.
       * @extra [scope] is the %this% object. %any% is provided as an alias. In addition to providing this method for browsers that don't support it natively, this method also implements %array_matching%.
       * @example
       *
       +   ['a','b','c'].some(function(n) {
       *     return n == 'a';
       *   });
       +   ['a','b','c'].some(function(n) {
       *     return n == 'd';
       *   });
       *   ['a','b','c'].some('a')   -> true
       *   [{a:2},{b:5}].some({a:2}) -> true
       ***/
      'some': function(fn, scope) {
        var length = this.length, index = 0;
        checkFirstArgumentExists(arguments);
        while(index < length) {
          if (index in this && fn.call(scope, this[index], index, this)) {
            return true;
          }
          index++;
        }
        return false;
      },

      /***
       * @method map(<map>, [scope])
       * @returns Array
       * @short Maps the array to another array containing the values that are the result of calling <map> on each element.
       * @extra [scope] is the %this% object. When <map> is a function, it receives three arguments: the current element, the current index, and a reference to the array. In addition to providing this method for browsers that don't support it natively, this enhanced method also directly accepts a string, which is a shortcut for a function that gets that property (or invokes a function) on each element.
       * @example
       *
       *   [1,2,3].map(function(n) {
       *     return n * 3;
       *   });                                  -> [3,6,9]
       *   ['one','two','three'].map(function(n) {
       *     return n.length;
       *   });                                  -> [3,3,5]
       *   ['one','two','three'].map('length')  -> [3,3,5]
       *
       ***/
      'map': function(fn, scope) {
        var scope = arguments[1], length = this.length, index = 0, result = new Array(length);
        checkFirstArgumentExists(arguments);
        while(index < length) {
          if (index in this) {
            result[index] = fn.call(scope, this[index], index, this);
          }
          index++;
        }
        return result;
      },

      /***
       * @method filter(<f>, [scope])
       * @returns Array
       * @short Returns any elements in the array that match <f>.
       * @extra [scope] is the %this% object. In addition to providing this method for browsers that don't support it natively, this method also implements %array_matching%.
       * @example
       *
       +   [1,2,3].filter(function(n) {
       *     return n > 1;
       *   });
       *   [1,2,2,4].filter(2) -> 2
       *
       ***/
      'filter': function(fn) {
        var scope = arguments[1];
        var length = this.length, index = 0, result = [];
        checkFirstArgumentExists(arguments);
        while(index < length) {
          if (index in this && fn.call(scope, this[index], index, this)) {
            result.push(this[index]);
          }
          index++;
        }
        return result;
      },

      /***
       * @method indexOf(<search>, [fromIndex])
       * @returns Number
       * @short Searches the array and returns the first index where <search> occurs, or -1 if the element is not found.
       * @extra [fromIndex] is the index from which to begin the search. This method performs a simple strict equality comparison on <search>. It does not support enhanced functionality such as searching the contents against a regex, callback, or deep comparison of objects. For such functionality, use the %findIndex% method instead.
       * @example
       *
       *   [1,2,3].indexOf(3)           -> 1
       *   [1,2,3].indexOf(7)           -> -1
       *
       ***/
      'indexOf': function(search) {
        var fromIndex = arguments[1];
        if (isString(this)) return this.indexOf(search, fromIndex);
        return arrayIndexOf(this, search, fromIndex, 1);
      },

      /***
       * @method lastIndexOf(<search>, [fromIndex])
       * @returns Number
       * @short Searches the array and returns the last index where <search> occurs, or -1 if the element is not found.
       * @extra [fromIndex] is the index from which to begin the search. This method performs a simple strict equality comparison on <search>.
       * @example
       *
       *   [1,2,1].lastIndexOf(1)                 -> 2
       *   [1,2,1].lastIndexOf(7)                 -> -1
       *
       ***/
      'lastIndexOf': function(search) {
        var fromIndex = arguments[1];
        if (isString(this)) return this.lastIndexOf(search, fromIndex);
        return arrayIndexOf(this, search, fromIndex, -1);
      },

      /***
       * @method forEach([fn], [scope])
       * @returns Nothing
       * @short Iterates over the array, calling [fn] on each loop.
       * @extra This method is only provided for those browsers that do not support it natively. [scope] becomes the %this% object.
       * @example
       *
       *   ['a','b','c'].forEach(function(a) {
       *     // Called 3 times: 'a','b','c'
       *   });
       *
       ***/
      'forEach': function(fn) {
        var length = this.length, index = 0, scope = arguments[1];
        checkCallback(fn);
        while(index < length) {
          if (index in this) {
            fn.call(scope, this[index], index, this);
          }
          index++;
        }
      },

      /***
       * @method reduce(<fn>, [init])
       * @returns Mixed
       * @short Reduces the array to a single result.
       * @extra If [init] is passed as a starting value, that value will be passed as the first argument to the callback. The second argument will be the first element in the array. From that point, the result of the callback will then be used as the first argument of the next iteration. This is often refered to as "accumulation", and [init] is often called an "accumulator". If [init] is not passed, then <fn> will be called n - 1 times, where n is the length of the array. In this case, on the first iteration only, the first argument will be the first element of the array, and the second argument will be the second. After that callbacks work as normal, using the result of the previous callback as the first argument of the next. This method is only provided for those browsers that do not support it natively.
       *
       * @example
       *
       +   [1,2,3,4].reduce(function(a, b) {
       *     return a - b;
       *   });
       +   [1,2,3,4].reduce(function(a, b) {
       *     return a - b;
       *   }, 100);
       *
       ***/
      'reduce': function(fn) {
        return arrayReduce(this, fn, arguments[1]);
      },

      /***
       * @method reduceRight([fn], [init])
       * @returns Mixed
       * @short Identical to %Array#reduce%, but operates on the elements in reverse order.
       * @extra This method is only provided for those browsers that do not support it natively.
       *
       *
       *
       *
       * @example
       *
       +   [1,2,3,4].reduceRight(function(a, b) {
       *     return a - b;
       *   });
       *
       ***/
      'reduceRight': function(fn) {
        return arrayReduce(this, fn, arguments[1], true);
      }


    }, true, true);




    /***
     * @namespace String
     *
     ***/

    var TrimRegExp = RegExp('^[' + getTrimmableCharacters() + ']+|['+getTrimmableCharacters()+']+$', 'g')

    extend(String, {
      /***
       * @method trim()
       * @returns String
       * @short Removes leading and trailing whitespace from the string.
       * @extra Whitespace is defined as line breaks, tabs, and any character in the "Space, Separator" Unicode category, conforming to the the ES5 spec. The standard %trim% method is only added when not fully supported natively.
       *
       * @example
       *
       *   '   wasabi   '.trim()      -> 'wasabi'
       *   '   wasabi   '.trimLeft()  -> 'wasabi   '
       *   '   wasabi   '.trimRight() -> '   wasabi'
       *
       ***/
      'trim': function() {
        return this.toString().replace(TrimRegExp, '');
      }
    }, true, true);



    /***
     * @namespace Function
     *
     ***/


    extend(Function, {

       /***
       * @method bind(<scope>, [arg1], ...)
       * @returns Function
       * @short Binds <scope> as the %this% object for the function when it is called. Also allows currying an unlimited number of parameters.
       * @extra "currying" means setting parameters ([arg1], [arg2], etc.) ahead of time so that they are passed when the function is called later. If you pass additional parameters when the function is actually called, they will be added will be added to the end of the curried parameters. This method is provided for browsers that don't support it internally.
       * @example
       *
       +   (function() {
       *     return this;
       *   }).bind('woof')(); -> returns 'woof'; function is bound with 'woof' as the this object.
       *   (function(a) {
       *     return a;
       *   }).bind(1, 2)();   -> returns 2; function is bound with 1 as the this object and 2 curried as the first parameter
       *   (function(a, b) {
       *     return a + b;
       *   }).bind(1, 2)(3);  -> returns 5; function is bound with 1 as the this object, 2 curied as the first parameter and 3 passed as the second when calling the function
       *
       ***/
      'bind': function(scope) {
        // Optimized: no leaking arguments
        var boundArgs = [], $i; for($i = 1; $i < arguments.length; $i++) boundArgs.push(arguments[$i]);
        var fn = this, bound;
        if (!isFunction(this)) {
          throw new TypeError('Function.prototype.bind called on a non-function');
        }
        bound = function() {
          // Optimized: no leaking arguments
          var args = [], $i; for($i = 0; $i < arguments.length; $i++) args.push(arguments[$i]);
          return fn.apply(fn.prototype && this instanceof fn ? this : scope, boundArgs.concat(args));
        }
        bound.prototype = this.prototype;
        return bound;
      }

    }, true, true);

    /***
     * @namespace Date
     *
     ***/

    function hasISOStringSupport() {
      var d = new Date(Date.UTC(2000, 0)), expected = '2000-01-01T00:00:00.000Z';
      return !!d.toISOString && d.toISOString() === expected;
    }

    extend(Date, {

       /***
       * @method Date.now()
       * @returns String
       * @short Returns the number of milliseconds since January 1st, 1970 00:00:00 (UTC time).
       * @extra Provided for browsers that do not support this method.
       * @example
       *
       *   Date.now() -> ex. 1311938296231
       *
       ***/
      'now': function() {
        return new Date().getTime();
      }

    }, false, true);


     /***
     * @method toISOString()
     * @returns String
     * @short Formats the string to ISO8601 format.
     * @extra This will always format as UTC time. Provided for browsers that do not support this method.
     * @example
     *
     *   Date.create().toISOString() -> ex. 2011-07-05 12:24:55.528Z
     *
     ***
     * @method toJSON()
     * @returns String
     * @short Returns a JSON representation of the date.
     * @extra This is effectively an alias for %toISOString%. Will always return the date in UTC time. Provided for browsers that do not support this method.
     * @example
     *
     *   Date.create().toJSON() -> ex. 2011-07-05 12:24:55.528Z
     *
     ***/
    extendSimilar(Date, 'toISOString,toJSON', function(methods, name) {
      methods[name] = function() {
        return padNumber(this.getUTCFullYear(), 4) + '-' +
               padNumber(this.getUTCMonth() + 1, 2) + '-' +
               padNumber(this.getUTCDate(), 2) + 'T' +
               padNumber(this.getUTCHours(), 2) + ':' +
               padNumber(this.getUTCMinutes(), 2) + ':' +
               padNumber(this.getUTCSeconds(), 2) + '.' +
               padNumber(this.getUTCMilliseconds(), 3) + 'Z';
      }
    }, true, hasISOStringSupport());

    /***
     * @module Array
     * @dependency core
     * @description Array manipulation and traversal, "fuzzy matching" against elements, alphanumeric sorting and collation, enumerable methods on Object.
     *
     ***/

    // Undefined array elements in < IE8 will not be visited by concat
    // and so will not be copied. This means that non-sparse arrays will
    // become sparse, so detect for this here.
    var HAS_CONCAT_BUG = !('0' in [].concat(undefined).concat());

    function regexMatcher(reg) {
      reg = RegExp(reg);
      return function (el) {
        return reg.test(el);
      }
    }

    function dateMatcher(d) {
      var ms = d.getTime();
      return function (el) {
        return !!(el && el.getTime) && el.getTime() === ms;
      }
    }

    function functionMatcher(fn) {
      return function (el, i, arr) {
        // Return true up front if match by reference
        return el === fn || fn.call(this, el, i, arr);
      }
    }

    function invertedArgsFunctionMatcher(fn) {
      return function (value, key, obj) {
        // Return true up front if match by reference
        return value === fn || fn.call(obj, key, value, obj);
      }
    }

    function fuzzyMatcher(obj, isObject) {
      var matchers = {};
      return function (el, i, arr) {
        var key;
        if (!isObjectType(el)) {
          return false;
        }
        for(key in obj) {
          matchers[key] = matchers[key] || getMatcher(obj[key], isObject);
          if (matchers[key].call(arr, el[key], i, arr) === false) {
            return false;
          }
        }
        return true;
      }
    }

    function defaultMatcher(f) {
      return function (el) {
        return el === f || isEqual(el, f);
      }
    }

    function getMatcher(f, isObject) {
      if (isPrimitiveType(f)) {
        // Do nothing and fall through to the
        // default matcher below.
      } else if (isRegExp(f)) {
        // Match against a regexp
        return regexMatcher(f);
      } else if (isDate(f)) {
        // Match against a date. isEqual below should also
        // catch this but matching directly up front for speed.
        return dateMatcher(f);
      } else if (isFunction(f)) {
        // Match against a filtering function
        if (isObject) {
          return invertedArgsFunctionMatcher(f);
        } else {
          return functionMatcher(f);
        }
      } else if (isPlainObject(f)) {
        // Match against a fuzzy hash or array.
        return fuzzyMatcher(f, isObject);
      }
      // Default is standard isEqual
      return defaultMatcher(f);
    }

    function transformArgument(el, map, context, mapArgs) {
      if (!map) {
        return el;
      } else if (map.apply) {
        return map.apply(context, mapArgs || []);
      } else if (isArray(map)) {
        return map.map(function(m) {
          return transformArgument(el, m, context, mapArgs);
        });
      } else if (isFunction(el[map])) {
        return el[map].call(el);
      } else {
        return el[map];
      }
    }

    function compareValue(aVal, bVal) {
      var cmp, i;
      if (isString(aVal) && isString(bVal)) {
        return collateStrings(aVal, bVal);
      } else if (isArray(aVal) && isArray(bVal)) {
        if (aVal.length < bVal.length) {
          return -1;
        } else if (aVal.length > bVal.length) {
          return 1;
        } else {
          for(i = 0; i < aVal.length; i++) {
            cmp = compareValue(aVal[i], bVal[i]);
            if (cmp !== 0) {
              return cmp;
            }
          }
          return 0;
        }
      } else if (aVal < bVal) {
        return -1;
      } else if (aVal > bVal) {
        return 1;
      } else {
        return 0;
      }

    }

    // Basic array internal methods

    function arrayEach(arr, fn, startIndex, loop) {
      var index, i, length = +arr.length;
      if (startIndex < 0) startIndex = arr.length + startIndex;
      i = isNaN(startIndex) ? 0 : startIndex;
      if (loop === true) {
        length += i;
      }
      while(i < length) {
        index = i % arr.length;
        if (!(index in arr)) {
          return iterateOverSparseArray(arr, fn, i, loop);
        } else if (fn.call(arr, arr[index], index, arr) === false) {
          break;
        }
        i++;
      }
    }

    function iterateOverSparseArray(arr, fn, fromIndex, loop) {
      var indexes = [], i;
      for(i in arr) {
        if (isArrayIndex(arr, i) && i >= fromIndex) {
          indexes.push(parseInt(i));
        }
      }
      arrayEach(indexes.sort(), function(index) {
        return fn.call(arr, arr[index], index, arr);
      });
      return arr;
    }

    function isArrayIndex(arr, i) {
      return i in arr && toUInt32(i) == i && i != 0xffffffff;
    }

    function toUInt32(i) {
      return i >>> 0;
    }

    function arrayFind(arr, f, startIndex, loop, returnIndex, context) {
      var result, index, matcher;
      if (arr.length > 0) {
        matcher = getMatcher(f);
        arrayEach(arr, function(el, i) {
          if (matcher.call(context, el, i, arr)) {
            result = el;
            index = i;
            return false;
          }
        }, startIndex, loop);
      }
      return returnIndex ? index : result;
    }

    function arrayFindAll(arr, f, index, loop) {
      var result = [], matcher;
      if (arr.length > 0) {
        matcher = getMatcher(f);
        arrayEach(arr, function(el, i, arr) {
          if (matcher(el, i, arr)) {
            result.push(el);
          }
        }, index, loop);
      }
      return result;
    }

    function arrayAdd(arr, el, index) {
      if (!isNumber(+index) || isNaN(index)) index = arr.length;
      Array.prototype.splice.apply(arr, [index, 0].concat(el));
      return arr;
    }

    function arrayRemoveElement(arr, f) {
      var i = 0, matcher = getMatcher(f);
      while(i < arr.length) {
        if (matcher(arr[i], i, arr)) {
          arr.splice(i, 1);
        } else {
          i++;
        }
      }
    }

    function arrayUnique(arr, map) {
      var result = [], o = {}, transformed;
      arrayEach(arr, function(el, i) {
        transformed = map ? transformArgument(el, map, arr, [el, i, arr]) : el;
        if (!checkForElementInHashAndSet(o, transformed)) {
          result.push(el);
        }
      })
      return result;
    }

    function arrayIntersect(arr1, arr2, subtract) {
      var result = [], o = {};
      arrayEach(arr2, function(el) {
        checkForElementInHashAndSet(o, el);
      });
      arrayEach(arr1, function(el) {
        var stringified = stringify(el),
            isReference = !objectIsMatchedByValue(el);
        // Add the result to the array if:
        // 1. We're subtracting intersections or it doesn't already exist in the result and
        // 2. It exists in the compared array and we're adding, or it doesn't exist and we're removing.
        if (elementExistsInHash(o, stringified, el, isReference) !== subtract) {
          discardElementFromHash(o, stringified, el, isReference);
          result.push(el);
        }
      });
      return result;
    }

    function arrayFlatten(arr, level, current) {
      level = level || Infinity;
      current = current || 0;
      var result = [];
      arrayEach(arr, function(el) {
        if (isArray(el) && current < level) {
          result = arrayConcat(result, arrayFlatten(el, level, current + 1));
        } else {
          result.push(el);
        }
      });
      return result;
    }

    function arrayGroupBy(arr, map, fn) {
      var result = {}, key;
      arrayEach(arr, function(el, index) {
        key = transformArgument(el, map, arr, [el, index, arr]);
        if (!result[key]) result[key] = [];
        result[key].push(el);
      });
      if (fn) {
        iterateOverObject(result, fn);
      }
      return result;
    }

    function arraySum(arr, map) {
      if (map) {
        arr = arr.map.apply(arr, [map]);
      }
      return arr.length > 0 ? arr.reduce(function(a,b) { return a + b; }) : 0;
    }

    function arrayCompact(arr, all) {
      var result = [];
      arrayEach(arr, function(el, i) {
        if (all && el) {
          result.push(el);
        } else if (!all && el != null && el.valueOf() === el.valueOf()) {
          result.push(el);
        }
      });
      return result;
    }

    function arrayRandomize(arr) {
      arr = arrayClone(arr);
      var i = arr.length, j, x;
      while(i) {
        j = (Math.random() * i) | 0;
        x = arr[--i];
        arr[i] = arr[j];
        arr[j] = x;
      }
      return arr;
    }

    function arrayClone(arr) {
      var len = arr.length, clone = new Array(len);
      for (var i = 0; i < len; i++) {
        clone[i] = arr[i];
      }
      return clone;
    }

    function arrayConcat(arr1, arr2) {
      if (HAS_CONCAT_BUG) {
        return arraySafeConcat(arr1, arr2);
      }
      return arr1.concat(arr2);
    }

    // Avoids issues with concat in < IE8
    function arraySafeConcat(arr, arg) {
      var result = arrayClone(arr), len = result.length, arr2;
      arr2 = isArray(arg) ? arg : [arg];
      result.length += arr2.length;
      for (var i = 0, len2 = arr2.length; i < len2; i++) {
        result[len + i] = arr2[i];
      }
      return result;
    }

    function isArrayLike(obj) {
      return hasProperty(obj, 'length') && !isString(obj) && !isPlainObject(obj);
    }

    function elementExistsInHash(hash, key, element, isReference) {
      var exists = hasOwnProperty(hash, key);
      if (isReference) {
        if (!hash[key]) {
          hash[key] = [];
        }
        exists = hash[key].indexOf(element) !== -1;
      }
      return exists;
    }

    function checkForElementInHashAndSet(hash, element) {
      var stringified = stringify(element),
          isReference = !objectIsMatchedByValue(element),
          exists      = elementExistsInHash(hash, stringified, element, isReference);
      if (isReference) {
        hash[stringified].push(element);
      } else {
        hash[stringified] = element;
      }
      return exists;
    }

    function discardElementFromHash(hash, key, element, isReference) {
      var arr, i = 0;
      if (isReference) {
        arr = hash[key];
        while(i < arr.length) {
          if (arr[i] === element) {
            arr.splice(i, 1);
          } else {
            i += 1;
          }
        }
      } else {
        delete hash[key];
      }
    }

    // Support methods

    function getMinOrMax(obj, map, which, all) {
      var el,
          key,
          edge,
          test,
          result = [],
          max = which === 'max',
          min = which === 'min',
          isArray = Array.isArray(obj);
      for(key in obj) {
        if (!obj.hasOwnProperty(key)) continue;
        el   = obj[key];
        test = transformArgument(el, map, obj, isArray ? [el, parseInt(key), obj] : []);
        if (isUndefined(test)) {
          throw new TypeError('Cannot compare with undefined');
        }
        if (test === edge) {
          result.push(el);
        } else if (isUndefined(edge) || (max && test > edge) || (min && test < edge)) {
          result = [el];
          edge = test;
        }
      }
      if (!isArray) result = arrayFlatten(result, 1);
      return all ? result : result[0];
    }

    // Alphanumeric collation helpers

    function collateStrings(a, b) {
      var aValue, bValue, aChar, bChar, aEquiv, bEquiv, index = 0, tiebreaker = 0;

      var sortIgnore      = Array[AlphanumericSortIgnore];
      var sortIgnoreCase  = Array[AlphanumericSortIgnoreCase];
      var sortEquivalents = Array[AlphanumericSortEquivalents];
      var sortOrder       = Array[AlphanumericSortOrder];
      var naturalSort     = Array[AlphanumericSortNatural];

      a = getCollationReadyString(a, sortIgnore, sortIgnoreCase);
      b = getCollationReadyString(b, sortIgnore, sortIgnoreCase);

      do {

        aChar  = getCollationCharacter(a, index, sortEquivalents);
        bChar  = getCollationCharacter(b, index, sortEquivalents);
        aValue = getSortOrderIndex(aChar, sortOrder);
        bValue = getSortOrderIndex(bChar, sortOrder);

        if (aValue === -1 || bValue === -1) {
          aValue = a.charCodeAt(index) || null;
          bValue = b.charCodeAt(index) || null;
          if (naturalSort && codeIsNumeral(aValue) && codeIsNumeral(bValue)) {
            aValue = stringToNumber(a.slice(index));
            bValue = stringToNumber(b.slice(index));
          }
        } else {
          aEquiv = aChar !== a.charAt(index);
          bEquiv = bChar !== b.charAt(index);
          if (aEquiv !== bEquiv && tiebreaker === 0) {
            tiebreaker = aEquiv - bEquiv;
          }
        }
        index += 1;
      } while(aValue != null && bValue != null && aValue === bValue);
      if (aValue === bValue) return tiebreaker;
      return aValue - bValue;
    }

    function getCollationReadyString(str, sortIgnore, sortIgnoreCase) {
      if (!isString(str)) str = string(str);
      if (sortIgnoreCase) {
        str = str.toLowerCase();
      }
      if (sortIgnore) {
        str = str.replace(sortIgnore, '');
      }
      return str;
    }

    function getCollationCharacter(str, index, sortEquivalents) {
      var chr = str.charAt(index);
      return sortEquivalents[chr] || chr;
    }

    function getSortOrderIndex(chr, sortOrder) {
      if (!chr) {
        return null;
      } else {
        return sortOrder.indexOf(chr);
      }
    }

    var AlphanumericSort            = 'AlphanumericSort';
    var AlphanumericSortOrder       = 'AlphanumericSortOrder';
    var AlphanumericSortIgnore      = 'AlphanumericSortIgnore';
    var AlphanumericSortIgnoreCase  = 'AlphanumericSortIgnoreCase';
    var AlphanumericSortEquivalents = 'AlphanumericSortEquivalents';
    var AlphanumericSortNatural     = 'AlphanumericSortNatural';



    function buildEnhancements() {
      var nativeMap = Array.prototype.map;
      var callbackCheck = function() {
        return arguments.length > 0 && !isFunction(arguments[0]);
      };
      extendSimilar(Array, 'every,some,filter,find,findIndex', function(methods, name) {
        var nativeFn = Array.prototype[name]
        methods[name] = function(f) {
          var matcher = getMatcher(f);
          return nativeFn.call(this, function(el, index, arr) {
            return matcher(el, index, arr);
          });
        }
      }, true, callbackCheck);
      extend(Array, {
        'map': function(map, context) {
          var arr = this;
          if (arguments.length < 2) {
            context = arr;
          }
          return nativeMap.call(arr, function(el, index) {
            return transformArgument(el, map, context, [el, index, arr]);
          });
        }
      }, true, callbackCheck);
    }

    function buildAlphanumericSort() {
      var order = 'AÁÀÂÃĄBCĆČÇDĎÐEÉÈĚÊËĘFGĞHıIÍÌİÎÏJKLŁMNŃŇÑOÓÒÔPQRŘSŚŠŞTŤUÚÙŮÛÜVWXYÝZŹŻŽÞÆŒØÕÅÄÖ';
      var equiv = 'AÁÀÂÃÄ,CÇ,EÉÈÊË,IÍÌİÎÏ,OÓÒÔÕÖ,Sß,UÚÙÛÜ';
      Array[AlphanumericSortOrder] = order.split('').map(function(str) {
        return str + str.toLowerCase();
      }).join('');
      var equivalents = {};
      arrayEach(equiv.split(','), function(set) {
        var equivalent = set.charAt(0);
        arrayEach(set.slice(1).split(''), function(chr) {
          equivalents[chr] = equivalent;
          equivalents[chr.toLowerCase()] = equivalent.toLowerCase();
        });
      });
      Array[AlphanumericSortNatural] = true;
      Array[AlphanumericSortIgnoreCase] = true;
      Array[AlphanumericSortEquivalents] = equivalents;
    }

    extend(Array, {

      /***
       *
       * @method Array.create(<obj1>, <obj2>, ...)
       * @returns Array
       * @short Alternate array constructor.
       * @extra This method will create a single array by calling %concat% on all arguments passed. In addition to ensuring that an unknown variable is in a single, flat array (the standard constructor will create nested arrays, this one will not), it is also a useful shorthand to convert a function's arguments object into a standard array.
       * @example
       *
       *   Array.create('one', true, 3)   -> ['one', true, 3]
       *   Array.create(['one', true, 3]) -> ['one', true, 3]
       *   Array.create(function(n) {
       *     return arguments;
       *   }('howdy', 'doody'));
       *
       ***/
      'create': function() {
        // Optimized: no leaking arguments
        var result = [];
        for (var i = 0; i < arguments.length; i++) {
          var a = arguments[i];
          if (isArgumentsObject(a) || isArrayLike(a)) {
            for (var j = 0; j < a.length; j++) {
              result.push(a[j]);
            }
            continue;
          }
          result = arrayConcat(result, a);
        }
        return result;
      }

    }, false);

    extend(Array, {

      /***
       * @method find(<f>, [context])
       * @returns Mixed
       * @short Returns the first element that matches <f>.
       * @extra [context] is the %this% object if passed. When <f> is a function, will use native implementation if it exists. <f> will also match a string, number, array, object, or alternately test against a function or regex. This method implements %array_matching%.
       * @example
       *
       *   [{a:1,b:2},{a:1,b:3},{a:1,b:4}].find(function(n) {
       *     return n['a'] == 1;
       *   });                                  -> {a:1,b:3}
       *   ['cuba','japan','canada'].find(/^c/) -> 'cuba'
       *
       ***/
      'find': function(f) {
        var context = arguments[1];
        checkCallback(f);
        for (var i = 0, len = this.length; i < len; i++) {
          if (f.call(context, this[i], i, this)) {
            return this[i];
          }
        }
      },

      /***
       * @method findIndex(<f>, [context])
       * @returns Number
       * @short Returns the index of the first element that matches <f> or -1 if not found.
       * @extra [context] is the %this% object if passed. When <f> is a function, will use native implementation if it exists. <f> will also match a string, number, array, object, or alternately test against a function or regex. This method implements %array_matching%.
       *
       * @example
       *
       *   [1,2,3,4].findIndex(function(n) {
       *     return n % 2 == 0;
       *   }); -> 1
       *   [1,2,3,4].findIndex(3);               -> 2
       *   ['one','two','three'].findIndex(/t/); -> 1
       *
       ***/
      'findIndex': function(f) {
        var index, context = arguments[1];
        checkCallback(f);
        for (var i = 0, len = this.length; i < len; i++) {
          if (f.call(context, this[i], i, this)) {
            return i;
          }
        }
        return -1;
      }

    }, true, true);

    extend(Array, {

      /***
       * @method findFrom(<f>, [index] = 0, [loop] = false)
       * @returns Array
       * @short Returns any element that matches <f>, beginning from [index].
       * @extra <f> will match a string, number, array, object, or alternately test against a function or regex. Will continue from index = 0 if [loop] is true. This method implements %array_matching%.
       * @example
       *
       *   ['cuba','japan','canada'].findFrom(/^c/, 2) -> 'canada'
       *
       ***/
      'findFrom': function(f, index, loop) {
        return arrayFind(this, f, index, loop);
      },

      /***
       * @method findIndexFrom(<f>, [index] = 0, [loop] = false)
       * @returns Array
       * @short Returns the index of any element that matches <f>, beginning from [index].
       * @extra <f> will match a string, number, array, object, or alternately test against a function or regex. Will continue from index = 0 if [loop] is true. This method implements %array_matching%.
       * @example
       *
       *   ['cuba','japan','canada'].findIndexFrom(/^c/, 2) -> 2
       *
       ***/
      'findIndexFrom': function(f, index, loop) {
        var index = arrayFind(this, f, index, loop, true);
        return isUndefined(index) ? -1 : index;
      },

      /***
       * @method findAll(<f>, [index] = 0, [loop] = false)
       * @returns Array
       * @short Returns all elements that match <f>.
       * @extra <f> will match a string, number, array, object, or alternately test against a function or regex. Starts at [index], and will continue once from index = 0 if [loop] is true. This method implements %array_matching%.
       * @example
       *
       *   [{a:1,b:2},{a:1,b:3},{a:2,b:4}].findAll(function(n) {
       *     return n['a'] == 1;
       *   });                                        -> [{a:1,b:3},{a:1,b:4}]
       *   ['cuba','japan','canada'].findAll(/^c/)    -> 'cuba','canada'
       *   ['cuba','japan','canada'].findAll(/^c/, 2) -> 'canada'
       *
       ***/
      'findAll': function(f, index, loop) {
        return arrayFindAll(this, f, index, loop);
      },

      /***
       * @method count(<f>)
       * @returns Number
       * @short Counts all elements in the array that match <f>.
       * @extra <f> will match a string, number, array, object, or alternately test against a function or regex. This method implements %array_matching%.
       * @example
       *
       *   [1,2,3,1].count(1)       -> 2
       *   ['a','b','c'].count(/b/) -> 1
       *   [{a:1},{b:2}].count(function(n) {
       *     return n['a'] > 1;
       *   });                      -> 0
       *
       ***/
      'count': function(f) {
        if (isUndefined(f)) return this.length;
        return arrayFindAll(this, f).length;
      },

      /***
       * @method removeAt(<start>, [end])
       * @returns Array
       * @short Removes element at <start>. If [end] is specified, removes the range between <start> and [end]. This method will change the array! If you don't intend the array to be changed use %clone% first.
       * @example
       *
       *   ['a','b','c'].removeAt(0) -> ['b','c']
       *   [1,2,3,4].removeAt(1, 3)  -> [1]
       *
       ***/
      'removeAt': function(start, end) {
        if (isUndefined(start)) return this;
        if (isUndefined(end))   end = start;
        this.splice(start, end - start + 1);
        return this;
      },

      /***
       * @method include(<el>, [index])
       * @returns Array
       * @short Adds <el> to the array.
       * @extra This is a non-destructive alias for %add%. It will not change the original array.
       * @example
       *
       *   [1,2,3,4].include(5)       -> [1,2,3,4,5]
       *   [1,2,3,4].include(8, 1)    -> [1,8,2,3,4]
       *   [1,2,3,4].include([5,6,7]) -> [1,2,3,4,5,6,7]
       *
       ***/
      'include': function(el, index) {
        return arrayAdd(arrayClone(this), el, index);
      },

      /***
       * @method exclude([f1], [f2], ...)
       * @returns Array
       * @short Removes any element in the array that matches [f1], [f2], etc.
       * @extra This is a non-destructive alias for %remove%. It will not change the original array. This method implements %array_matching%.
       * @example
       *
       *   [1,2,3].exclude(3)         -> [1,2]
       *   ['a','b','c'].exclude(/b/) -> ['a','c']
       *   [{a:1},{b:2}].exclude(function(n) {
       *     return n['a'] == 1;
       *   });                       -> [{b:2}]
       *
       ***/
      'exclude': function() {
        var arr = arrayClone(this);
        for (var i = 0; i < arguments.length; i++) {
          arrayRemoveElement(arr, arguments[i]);
        }
        return arr;
      },

      /***
       * @method clone()
       * @returns Array
       * @short Makes a shallow clone of the array.
       * @example
       *
       *   [1,2,3].clone() -> [1,2,3]
       *
       ***/
      'clone': function() {
        return arrayClone(this);
      },

      /***
       * @method unique([map] = null)
       * @returns Array
       * @short Removes all duplicate elements in the array.
       * @extra [map] may be a function mapping the value to be uniqued on or a string acting as a shortcut. This is most commonly used when you have a key that ensures the object's uniqueness, and don't need to check all fields. This method will also correctly operate on arrays of objects.
       * @example
       *
       *   [1,2,2,3].unique()                 -> [1,2,3]
       *   [{foo:'bar'},{foo:'bar'}].unique() -> [{foo:'bar'}]
       *   [{foo:'bar'},{foo:'bar'}].unique(function(obj){
       *     return obj.foo;
       *   }); -> [{foo:'bar'}]
       *   [{foo:'bar'},{foo:'bar'}].unique('foo') -> [{foo:'bar'}]
       *
       ***/
      'unique': function(map) {
        return arrayUnique(this, map);
      },

      /***
       * @method flatten([limit] = Infinity)
       * @returns Array
       * @short Returns a flattened, one-dimensional copy of the array.
       * @extra You can optionally specify a [limit], which will only flatten that depth.
       * @example
       *
       *   [[1], 2, [3]].flatten()      -> [1,2,3]
       *   [['a'],[],'b','c'].flatten() -> ['a','b','c']
       *
       ***/
      'flatten': function(limit) {
        return arrayFlatten(this, limit);
      },

      /***
       * @method union([a1], [a2], ...)
       * @returns Array
       * @short Returns an array containing all elements in all arrays with duplicates removed.
       * @extra This method will also correctly operate on arrays of objects.
       * @example
       *
       *   [1,3,5].union([5,7,9])     -> [1,3,5,7,9]
       *   ['a','b'].union(['b','c']) -> ['a','b','c']
       *
       ***/
      'union': function() {
        // Optimized: no leaking arguments (flat)
        var args = [], $i; for($i = 0; $i < arguments.length; $i++) args = args.concat(arguments[$i]);
        return arrayUnique(arrayConcat(this, args));
      },

      /***
       * @method intersect([a1], [a2], ...)
       * @returns Array
       * @short Returns an array containing the elements all arrays have in common.
       * @extra This method will also correctly operate on arrays of objects.
       * @example
       *
       *   [1,3,5].intersect([5,7,9])   -> [5]
       *   ['a','b'].intersect('b','c') -> ['b']
       *
       ***/
      'intersect': function() {
        // Optimized: no leaking arguments (flat)
        var args = [], $i; for($i = 0; $i < arguments.length; $i++) args = args.concat(arguments[$i]);
        return arrayIntersect(this, args, false);
      },

      /***
       * @method subtract([a1], [a2], ...)
       * @returns Array
       * @short Subtracts from the array all elements in [a1], [a2], etc.
       * @extra This method will also correctly operate on arrays of objects.
       * @example
       *
       *   [1,3,5].subtract([5,7,9])   -> [1,3]
       *   [1,3,5].subtract([3],[5])   -> [1]
       *   ['a','b'].subtract('b','c') -> ['a']
       *
       ***/
      'subtract': function(a) {
        // Optimized: no leaking arguments (flat)
        var args = [], $i; for($i = 0; $i < arguments.length; $i++) args = args.concat(arguments[$i]);
        return arrayIntersect(this, args, true);
      },

      /***
       * @method at(<index>, [loop] = true)
       * @returns Mixed
       * @short Gets the element(s) at a given index.
       * @extra When [loop] is true, overshooting the end of the array (or the beginning) will begin counting from the other end. As an alternate syntax, passing multiple indexes will get the elements at those indexes.
       * @example
       *
       *   [1,2,3].at(0)        -> 1
       *   [1,2,3].at(2)        -> 3
       *   [1,2,3].at(4)        -> 2
       *   [1,2,3].at(4, false) -> null
       *   [1,2,3].at(-1)       -> 3
       *   [1,2,3].at(0,1)      -> [1,2]
       *
       ***/
      'at': function() {
        // Optimized: no leaking arguments
        var args = [], $i; for($i = 0; $i < arguments.length; $i++) args.push(arguments[$i]);
        return getEntriesForIndexes(this, args);
      },

      /***
       * @method first([num] = 1)
       * @returns Mixed
       * @short Returns the first element(s) in the array.
       * @extra When <num> is passed, returns the first <num> elements in the array.
       * @example
       *
       *   [1,2,3].first()        -> 1
       *   [1,2,3].first(2)       -> [1,2]
       *
       ***/
      'first': function(num) {
        if (isUndefined(num)) return this[0];
        if (num < 0) num = 0;
        return this.slice(0, num);
      },

      /***
       * @method last([num] = 1)
       * @returns Mixed
       * @short Returns the last element(s) in the array.
       * @extra When <num> is passed, returns the last <num> elements in the array.
       * @example
       *
       *   [1,2,3].last()        -> 3
       *   [1,2,3].last(2)       -> [2,3]
       *
       ***/
      'last': function(num) {
        if (isUndefined(num)) return this[this.length - 1];
        var start = this.length - num < 0 ? 0 : this.length - num;
        return this.slice(start);
      },

      /***
       * @method from(<index>)
       * @returns Array
       * @short Returns a slice of the array from <index>.
       * @example
       *
       *   [1,2,3].from(1)  -> [2,3]
       *   [1,2,3].from(2)  -> [3]
       *
       ***/
      'from': function(num) {
        return this.slice(num);
      },

      /***
       * @method to(<index>)
       * @returns Array
       * @short Returns a slice of the array up to <index>.
       * @example
       *
       *   [1,3,5].to(1)  -> [1]
       *   [1,3,5].to(2)  -> [1,3]
       *
       ***/
      'to': function(num) {
        if (isUndefined(num)) num = this.length;
        return this.slice(0, num);
      },

      /***
       * @method min([map], [all] = false)
       * @returns Mixed
       * @short Returns the element in the array with the lowest value.
       * @extra [map] may be a function mapping the value to be checked or a string acting as a shortcut. If [all] is true, will return all min values in an array.
       * @example
       *
       *   [1,2,3].min()                          -> 1
       *   ['fee','fo','fum'].min('length')       -> 'fo'
       *   ['fee','fo','fum'].min('length', true) -> ['fo']
       *   ['fee','fo','fum'].min(function(n) {
       *     return n.length;
       *   });                              -> ['fo']
       *   [{a:3,a:2}].min(function(n) {
       *     return n['a'];
       *   });                              -> [{a:2}]
       *
       ***/
      'min': function(map, all) {
        return getMinOrMax(this, map, 'min', all);
      },

      /***
       * @method max([map], [all] = false)
       * @returns Mixed
       * @short Returns the element in the array with the greatest value.
       * @extra [map] may be a function mapping the value to be checked or a string acting as a shortcut. If [all] is true, will return all max values in an array.
       * @example
       *
       *   [1,2,3].max()                          -> 3
       *   ['fee','fo','fum'].max('length')       -> 'fee'
       *   ['fee','fo','fum'].max('length', true) -> ['fee']
       *   [{a:3,a:2}].max(function(n) {
       *     return n['a'];
       *   });                              -> {a:3}
       *
       ***/
      'max': function(map, all) {
        return getMinOrMax(this, map, 'max', all);
      },

      /***
       * @method least([map])
       * @returns Array
       * @short Returns the elements in the array with the least commonly occuring value.
       * @extra [map] may be a function mapping the value to be checked or a string acting as a shortcut.
       * @example
       *
       *   [3,2,2].least()                   -> [3]
       *   ['fe','fo','fum'].least('length') -> ['fum']
       *   [{age:35,name:'ken'},{age:12,name:'bob'},{age:12,name:'ted'}].least(function(n) {
       *     return n.age;
       *   });                               -> [{age:35,name:'ken'}]
       *
       ***/
      'least': function(map, all) {
        return getMinOrMax(arrayGroupBy(this, map), 'length', 'min', all);
      },

      /***
       * @method most([map])
       * @returns Array
       * @short Returns the elements in the array with the most commonly occuring value.
       * @extra [map] may be a function mapping the value to be checked or a string acting as a shortcut.
       * @example
       *
       *   [3,2,2].most()                   -> [2]
       *   ['fe','fo','fum'].most('length') -> ['fe','fo']
       *   [{age:35,name:'ken'},{age:12,name:'bob'},{age:12,name:'ted'}].most(function(n) {
       *     return n.age;
       *   });                              -> [{age:12,name:'bob'},{age:12,name:'ted'}]
       *
       ***/
      'most': function(map, all) {
        return getMinOrMax(arrayGroupBy(this, map), 'length', 'max', all);
      },

      /***
       * @method sum([map])
       * @returns Number
       * @short Sums all values in the array.
       * @extra [map] may be a function mapping the value to be summed or a string acting as a shortcut.
       * @example
       *
       *   [1,2,2].sum()                           -> 5
       *   [{age:35},{age:12},{age:12}].sum(function(n) {
       *     return n.age;
       *   });                                     -> 59
       *   [{age:35},{age:12},{age:12}].sum('age') -> 59
       *
       ***/
      'sum': function(map) {
        return arraySum(this, map);
      },

      /***
       * @method average([map])
       * @returns Number
       * @short Gets the mean average for all values in the array.
       * @extra [map] may be a function mapping the value to be averaged or a string acting as a shortcut.
       * @example
       *
       *   [1,2,3].average()                           -> 2
       *   [{age:35},{age:11},{age:11}].average(function(n) {
       *     return n.age;
       *   });                                         -> 19
       *   [{age:35},{age:11},{age:11}].average('age') -> 19
       *
       ***/
      'average': function(map) {
        return this.length > 0 ? arraySum(this, map) / this.length : 0;
      },

      /***
       * @method inGroups(<num>, [padding])
       * @returns Array
       * @short Groups the array into <num> arrays.
       * @extra [padding] specifies a value with which to pad the last array so that they are all equal length.
       * @example
       *
       *   [1,2,3,4,5,6,7].inGroups(3)         -> [ [1,2,3], [4,5,6], [7] ]
       *   [1,2,3,4,5,6,7].inGroups(3, 'none') -> [ [1,2,3], [4,5,6], [7,'none','none'] ]
       *
       ***/
      'inGroups': function(num, padding) {
        var pad = arguments.length > 1;
        var arr = this;
        var result = [];
        var divisor = ceil(this.length / num);
        simpleRepeat(num, function(i) {
          var index = i * divisor;
          var group = arr.slice(index, index + divisor);
          if (pad && group.length < divisor) {
            simpleRepeat(divisor - group.length, function() {
              group.push(padding);
            });
          }
          result.push(group);
        });
        return result;
      },

      /***
       * @method inGroupsOf(<num>, [padding] = null)
       * @returns Array
       * @short Groups the array into arrays of <num> elements each.
       * @extra [padding] specifies a value with which to pad the last array so that they are all equal length.
       * @example
       *
       *   [1,2,3,4,5,6,7].inGroupsOf(4)         -> [ [1,2,3,4], [5,6,7] ]
       *   [1,2,3,4,5,6,7].inGroupsOf(4, 'none') -> [ [1,2,3,4], [5,6,7,'none'] ]
       *
       ***/
      'inGroupsOf': function(num, padding) {
        var result = [], len = this.length, arr = this, group;
        if (len === 0 || num === 0) return arr;
        if (isUndefined(num)) num = 1;
        if (isUndefined(padding)) padding = null;
        simpleRepeat(ceil(len / num), function(i) {
          group = arr.slice(num * i, num * i + num);
          while(group.length < num) {
            group.push(padding);
          }
          result.push(group);
        });
        return result;
      },

      /***
       * @method isEmpty()
       * @returns Boolean
       * @short Returns true if the array is empty.
       * @extra This is true if the array has a length of zero, or contains only %undefined%, %null%, or %NaN%.
       * @example
       *
       *   [].isEmpty()               -> true
       *   [null,undefined].isEmpty() -> true
       *
       ***/
      'isEmpty': function() {
        return arrayCompact(this).length == 0;
      },

      /***
       * @method sortBy(<map>, [desc] = false)
       * @returns Array
       * @short Returns a copy of the array sorted by <map>.
       * @extra <map> may be a function, a string acting as a shortcut, an array (comparison by multiple values), or blank (direct comparison of array values). [desc] will sort the array in descending order. When the field being sorted on is a string, the resulting order will be determined by an internal collation algorithm that is optimized for major Western languages, but can be customized. For more information see %array_sorting%.
       * @example
       *
       *   ['world','a','new'].sortBy('length')       -> ['a','new','world']
       *   ['world','a','new'].sortBy('length', true) -> ['world','new','a']
       *   [{age:72},{age:13},{age:18}].sortBy(function(n) {
       *     return n.age;
       *   });                                        -> [{age:13},{age:18},{age:72}]
       *
       ***/
      'sortBy': function(map, desc) {
        var arr = arrayClone(this);
        arr.sort(function(a, b) {
          var aProperty = transformArgument(a, map, arr, [a]);
          var bProperty = transformArgument(b, map, arr, [b]);
          return compareValue(aProperty, bProperty) * (desc ? -1 : 1);
        });
        return arr;
      },

      /***
       * @method randomize()
       * @returns Array
       * @short Returns a copy of the array with the elements randomized.
       * @extra Uses Fisher-Yates algorithm.
       * @example
       *
       *   [1,2,3,4].randomize()  -> [?,?,?,?]
       *
       ***/
      'randomize': function() {
        return arrayRandomize(this);
      },

      /***
       * @method zip([arr1], [arr2], ...)
       * @returns Array
       * @short Merges multiple arrays together.
       * @extra This method "zips up" smaller arrays into one large whose elements are "all elements at index 0", "all elements at index 1", etc. Useful when you have associated data that is split over separated arrays. If the arrays passed have more elements than the original array, they will be discarded. If they have fewer elements, the missing elements will filled with %null%.
       * @example
       *
       *   [1,2,3].zip([4,5,6])                                       -> [[1,2], [3,4], [5,6]]
       *   ['Martin','John'].zip(['Luther','F.'], ['King','Kennedy']) -> [['Martin','Luther','King'], ['John','F.','Kennedy']]
       *
       ***/
      'zip': function() {
        // Optimized: no leaking arguments
        var args = [], $i; for($i = 0; $i < arguments.length; $i++) args.push(arguments[$i]);
        return this.map(function(el, i) {
          return arrayConcat([el], args.map(function(k) {
            return (i in k) ? k[i] : null;
          }));
        });
      },

      /***
       * @method sample([num])
       * @returns Mixed
       * @short Returns a random element from the array.
       * @extra If [num] is passed, will return [num] samples from the array.
       * @example
       *
       *   [1,2,3,4,5].sample()  -> // Random element
       *   [1,2,3,4,5].sample(3) -> // Array of 3 random elements
       *
       ***/
      'sample': function(num) {
        var arr = arrayRandomize(this);
        return arguments.length > 0 ? arr.slice(0, num) : arr[0];
      },

      /***
       * @method each(<fn>, [index] = 0, [loop] = false)
       * @returns Array
       * @short Runs <fn> against each element in the array. Enhanced version of %Array#forEach%.
       * @extra Parameters passed to <fn> are identical to %forEach%, ie. the first parameter is the current element, second parameter is the current index, and third parameter is the array itself. If <fn> returns %false% at any time it will break out of the loop. Once %each% finishes, it will return the array. If [index] is passed, <fn> will begin at that index and work its way to the end. If [loop] is true, it will then start over from the beginning of the array and continue until it reaches [index] - 1.
       * @example
       *
       *   [1,2,3,4].each(function(n) {
       *     // Called 4 times: 1, 2, 3, 4
       *   });
       *   [1,2,3,4].each(function(n) {
       *     // Called 4 times: 3, 4, 1, 2
       *   }, 2, true);
       *
       ***/
      'each': function(fn, index, loop) {
        arrayEach(this, fn, index, loop);
        return this;
      },

      /***
       * @method add(<el>, [index])
       * @returns Array
       * @short Adds <el> to the array.
       * @extra If [index] is specified, it will add at [index], otherwise adds to the end of the array. %add% behaves like %concat% in that if <el> is an array it will be joined, not inserted. This method will change the array! Use %include% for a non-destructive alias. Also, %insert% is provided as an alias that reads better when using an index.
       * @example
       *
       *   [1,2,3,4].add(5)       -> [1,2,3,4,5]
       *   [1,2,3,4].add([5,6,7]) -> [1,2,3,4,5,6,7]
       *   [1,2,3,4].insert(8, 1) -> [1,8,2,3,4]
       *
       ***/
      'add': function(el, index) {
        return arrayAdd(this, el, index);
      },

      /***
       * @method remove([f1], [f2], ...)
       * @returns Array
       * @short Removes any element in the array that matches [f1], [f2], etc.
       * @extra Will match a string, number, array, object, or alternately test against a function or regex. This method will change the array! Use %exclude% for a non-destructive alias. This method implements %array_matching%.
       * @example
       *
       *   [1,2,3].remove(3)         -> [1,2]
       *   ['a','b','c'].remove(/b/) -> ['a','c']
       *   [{a:1},{b:2}].remove(function(n) {
       *     return n['a'] == 1;
       *   });                       -> [{b:2}]
       *
       ***/
      'remove': function() {
        for (var i = 0; i < arguments.length; i++) {
          arrayRemoveElement(this, arguments[i]);
        }
        return this;
      },

      /***
       * @method compact([all] = false)
       * @returns Array
       * @short Removes all instances of %undefined%, %null%, and %NaN% from the array.
       * @extra If [all] is %true%, all "falsy" elements will be removed. This includes empty strings, 0, and false.
       * @example
       *
       *   [1,null,2,undefined,3].compact() -> [1,2,3]
       *   [1,'',2,false,3].compact()       -> [1,'',2,false,3]
       *   [1,'',2,false,3].compact(true)   -> [1,2,3]
       *   [null, [null, 'bye']].compact()  -> ['hi', [null, 'bye']]
       *
       ***/
      'compact': function(all) {
        return arrayCompact(this, all);
      },

      /***
       * @method groupBy(<map>, [fn])
       * @returns Object
       * @short Groups the array by <map>.
       * @extra Will return an object with keys equal to the grouped values. <map> may be a mapping function, or a string acting as a shortcut. Optionally calls [fn] for each group.
       * @example
       *
       *   ['fee','fi','fum'].groupBy('length') -> { 2: ['fi'], 3: ['fee','fum'] }
       *   [{age:35,name:'ken'},{age:15,name:'bob'}].groupBy(function(n) {
       *     return n.age;
       *   });                                  -> { 35: [{age:35,name:'ken'}], 15: [{age:15,name:'bob'}] }
       *
       ***/
      'groupBy': function(map, fn) {
        return arrayGroupBy(this, map, fn);
      },

      /***
       * @method none(<f>)
       * @returns Boolean
       * @short Returns true if none of the elements in the array match <f>.
       * @extra <f> will match a string, number, array, object, or alternately test against a function or regex. This method implements %array_matching%.
       * @example
       *
       *   [1,2,3].none(5)         -> true
       *   ['a','b','c'].none(/b/) -> false
       *   [{a:1},{b:2}].none(function(n) {
       *     return n['a'] > 1;
       *   });                     -> true
       *
       ***/
      'none': function(f) {
        // Optimized: no leaking arguments
        var args = [], $i; for($i = 0; $i < arguments.length; $i++) args.push(arguments[$i]);
        return !Array.prototype.some.apply(this, args);
      }


    });


    function buildAliases() {
      /***
       * @method all()
       * @alias every
       *
       ***/
      alias(Array, 'all', 'every');

      /*** @method any()
       * @alias some
       *
       ***/
      alias(Array, 'any', 'some');

      /***
       * @method insert()
       * @alias add
       *
       ***/
      alias(Array, 'insert', 'add');
    }


    /***
     * @namespace Object
     *
     ***/

    /***
     * @method [enumerable](<obj>)
     * @returns Boolean
     * @short Enumerable methods in the Array package are also available to the Object class. They will perform their normal operations for every property in <obj>.
     * @extra In cases where a callback is used, instead of %element, index%, the callback will instead be passed %key, value%. Enumerable methods are also available to %extended objects% as instance methods.
     *
     * @set
     *   any
     *   all
     *   none
     *   count
     *   find
     *   findAll
     *   isEmpty
     *   sum
     *   average
     *   min
     *   max
     *   least
     *   most
     *
     * @example
     *
     *   Object.any({foo:'bar'}, 'bar')            -> true
     *   Object.extended({foo:'bar'}).any('bar')   -> true
     *   Object.isEmpty({})                        -> true
     *   Object.map({ fred: { age: 52 } }, 'age'); -> { fred: 52 }
     *
     ***/

    function buildEnumerableMethods(names, mapping) {
      extendSimilar(Object, names, function(methods, name) {
        var unwrapped = SugarMethods[Array][name].fn;
        methods[name] = function(obj, arg1, arg2) {
          var result, coerced = keysWithObjectCoercion(obj), matcher;
          if (!mapping) {
            matcher = getMatcher(arg1, true);
          }
          result = unwrapped.call(coerced, function(key) {
            var value = obj[key];
            if (mapping) {
              return transformArgument(value, arg1, obj, [key, value, obj]);
            } else {
              return matcher(value, key, obj);
            }
          }, arg2);
          if (isArray(result)) {
            // The method has returned an array of keys so use this array
            // to build up the resulting object in the form we want it in.
            result = result.reduce(function(o, key, i) {
              o[key] = obj[key];
              return o;
            }, {});
          }
          return result;
        };
      }, false);
      buildObjectInstanceMethods(names, Hash);
    }

    function exportSortAlgorithm() {
      Array[AlphanumericSort] = collateStrings;
    }

    var EnumerableFindingMethods = 'any,all,none,count,find,findAll,isEmpty'.split(',');
    var EnumerableMappingMethods = 'sum,average,min,max,least,most'.split(',');

    buildEnhancements();
    buildAliases();
    buildAlphanumericSort();
    buildEnumerableMethods(EnumerableFindingMethods);
    buildEnumerableMethods(EnumerableMappingMethods, true);
    exportSortAlgorithm();

    /***
     * @module Date
     * @dependency core
     * @description Date parsing and formatting, relative formats like "1 minute ago", Number methods like "daysAgo", localization support with default English locale definition.
     *
     ***/

    var English;
    var CurrentLocalization;

    var TimeFormat = ['ampm','hour','minute','second','ampm','utc','offsetSign','offsetHours','offsetMinutes','ampm'];
    var DecimalReg = '(?:[,.]\\d+)?';
    var HoursReg   = '\\d{1,2}' + DecimalReg;
    var SixtyReg   = '[0-5]\\d' + DecimalReg;
    var RequiredTime = '({t})?\\s*('+HoursReg+')(?:{h}('+SixtyReg+')?{m}(?::?('+SixtyReg+'){s})?\\s*(?:({t})|(Z)|(?:([+-])(\\d{2,2})(?::?(\\d{2,2}))?)?)?|\\s*({t}))';

    var KanjiDigits = '〇一二三四五六七八九十百千万';
    var AsianDigitMap = {};
    var AsianDigitReg;

    var DateArgumentUnits;
    var DateUnitsReversed;
    var CoreDateFormats = [];
    var CompiledOutputFormats = {};

    var DateFormatTokens = {

      'yyyy': function(d) {
        return callDateGet(d, 'FullYear');
      },

      'yy': function(d) {
        return callDateGet(d, 'FullYear').toString().slice(-2);
      },

      'ord': function(d) {
        var date = callDateGet(d, 'Date');
        return date + getOrdinalizedSuffix(date);
      },

      'tz': function(d) {
        return getUTCOffset(d);
      },

      'isotz': function(d) {
        return getUTCOffset(d, true);
      },

      'Z': function(d) {
        return getUTCOffset(d);
      },

      'ZZ': function(d) {
        return getUTCOffset(d).replace(/(\d{2})$/, ':$1');
      }

    };

    var DateUnits = [
      {
        name: 'year',
        method: 'FullYear',
        ambiguous: true,
        multiplier: 365.25 * 24 * 60 * 60 * 1000
      },
      {
        name: 'month',
        method: 'Month',
        ambiguous: true,
        multiplier: 30.4375 * 24 * 60 * 60 * 1000
      },
      {
        name: 'week',
        method: 'ISOWeek',
        multiplier: 7 * 24 * 60 * 60 * 1000
      },
      {
        name: 'day',
        method: 'Date',
        ambiguous: true,
        multiplier: 24 * 60 * 60 * 1000
      },
      {
        name: 'hour',
        method: 'Hours',
        multiplier: 60 * 60 * 1000
      },
      {
        name: 'minute',
        method: 'Minutes',
        multiplier: 60 * 1000
      },
      {
        name: 'second',
        method: 'Seconds',
        multiplier: 1000
      },
      {
        name: 'millisecond',
        method: 'Milliseconds',
        multiplier: 1
      }
    ];




    // Date Localization

    var Localizations = {};

    // Localization object

    function Localization(l) {
      simpleMerge(this, l);
      this.compiledFormats = CoreDateFormats.concat();
    }

    Localization.prototype = {

      get: function(prop) {
        return this[prop] || '';
      },

      getMonth: function(n) {
        if (isNumber(n)) {
          return n - 1;
        } else {
          return this.months.indexOf(n) % 12;
        }
      },

      getWeekday: function(n) {
        return this.weekdays.indexOf(n) % 7;
      },

      getNumber: function(n, digit) {
        var mapped = this.ordinalNumberMap[n];
        if (mapped) {
          if (digit) {
            mapped = mapped % 10;
          }
          return mapped;
        }
        return isNumber(n) ? n : 1;
      },

      getNumericDate: function(n) {
        var self = this;
        return n.replace(RegExp(this.num, 'g'), function(d) {
          var num = self.getNumber(d, true);
          return num || '';
        });
      },

      getUnitIndex: function(n) {
        return this.units.indexOf(n) % 8;
      },

      getRelativeFormat: function(adu) {
        return this.convertAdjustedToFormat(adu, adu[2] > 0 ? 'future' : 'past');
      },

      getDuration: function(ms) {
        return this.convertAdjustedToFormat(getAdjustedUnitForNumber(ms), 'duration');
      },

      hasVariant: function(code) {
        code = code || this.code;
        return code === 'en' || code === 'en-US' ? true : this.variant;
      },

      matchAM: function(str) {
        return str === this.get('ampm')[0];
      },

      matchPM: function(str) {
        return str && str === this.get('ampm')[1];
      },

      convertAdjustedToFormat: function(adu, mode) {
        var sign, unit, mult,
            num    = adu[0],
            u      = adu[1],
            ms     = adu[2],
            format = this[mode] || this.relative;
        if (isFunction(format)) {
          return format.call(this, num, u, ms, mode);
        }
        mult = !this.plural || num === 1 ? 0 : 1;
        unit = this.units[mult * 8 + u] || this.units[u];
        if (this.capitalizeUnit) unit = simpleCapitalize(unit);
        sign = this.modifiers.filter(function(m) { return m.name == 'sign' && m.value == (ms > 0 ? 1 : -1); })[0];
        return format.replace(/\{(.*?)\}/g, function(full, match) {
          switch(match) {
            case 'num': return num;
            case 'unit': return unit;
            case 'sign': return sign.src;
          }
        });
      },

      getFormats: function() {
        return this.cachedFormat ? [this.cachedFormat].concat(this.compiledFormats) : this.compiledFormats;
      },

      addFormat: function(src, allowsTime, match, variant, iso) {
        var to = match || [], loc = this, time, timeMarkers, lastIsNumeral;

        src = src.replace(/\s+/g, '[,. ]*');
        src = src.replace(/\{([^,]+?)\}/g, function(all, k) {
          var value, arr, result,
              opt   = k.match(/\?$/),
              nc    = k.match(/^(\d+)\??$/),
              slice = k.match(/(\d)(?:-(\d))?/),
              key   = k.replace(/[^a-z]+$/, '');
          if (nc) {
            value = loc.get('tokens')[nc[1]];
          } else if (loc[key]) {
            value = loc[key];
          } else if (loc[key + 's']) {
            value = loc[key + 's'];
            if (slice) {
              value = value.filter(function(m, i) {
                var mod = i % (loc.units ? 8 : value.length);
                return mod >= slice[1] && mod <= (slice[2] || slice[1]);
              });
            }
            value = arrayToAlternates(value);
          }
          if (!value) {
            return '';
          }
          if (nc) {
            result = '(?:' + value + ')';
          } else {
            if (!match) {
              to.push(key);
            }
            result = '(' + value + ')';
          }
          if (opt) {
            result += '?';
          }
          return result;
        });
        if (allowsTime) {
          time = prepareTime(RequiredTime, loc, iso);
          timeMarkers = ['t','[\\s\\u3000]'].concat(loc.get('timeMarker'));
          lastIsNumeral = src.match(/\\d\{\d,\d\}\)+\??$/);
          addDateInputFormat(loc, '(?:' + time + ')[,\\s\\u3000]+?' + src, TimeFormat.concat(to), variant);
          addDateInputFormat(loc, src + '(?:[,\\s]*(?:' + timeMarkers.join('|') + (lastIsNumeral ? '+' : '*') +')' + time + ')?', to.concat(TimeFormat), variant);
        } else {
          addDateInputFormat(loc, src, to, variant);
        }
      }

    };


    // Localization helpers

    function getLocalization(localeCode, fallback) {
      var loc;
      if (!isString(localeCode)) localeCode = '';
      loc = Localizations[localeCode] || Localizations[localeCode.slice(0,2)];
      if (fallback === false && !loc) {
        throw new TypeError('Invalid locale.');
      }
      return loc || CurrentLocalization;
    }

    function setLocalization(localeCode, set) {
      var loc;

      function initializeField(name) {
        var val = loc[name];
        if (isString(val)) {
          loc[name] = val.split(',');
        } else if (!val) {
          loc[name] = [];
        }
      }

      function eachAlternate(str, fn) {
        str = str.split('+').map(function(split) {
          return split.replace(/(.+):(.+)$/, function(full, base, suffixes) {
            return suffixes.split('|').map(function(suffix) {
              return base + suffix;
            }).join('|');
          });
        }).join('|');
        return str.split('|').forEach(fn);
      }

      function setArray(name, abbreviationSize, multiple) {
        var arr = [];
        loc[name].forEach(function(full, i) {
          if (abbreviationSize) {
            full += '+' + full.slice(0, abbreviationSize);
          }
          eachAlternate(full, function(alt, j) {
            arr[j * multiple + i] = alt.toLowerCase();
          });
        });
        loc[name] = arr;
      }

      function getDigit(start, stop, allowNumbers) {
        var str = '\\d{' + start + ',' + stop + '}';
        if (allowNumbers) str += '|(?:' + arrayToAlternates(loc.get('numbers')) + ')+';
        return str;
      }

      function getNum() {
        var numbers = loc.get('numbers');
        var arr = ['-?\\d+'].concat(loc.get('articles'));
        if (numbers) {
          arr = arr.concat(numbers);
        }
        return arrayToAlternates(arr);
      }

      function getAbbreviationSize(type) {
        // Month suffixes like those found in Asian languages
        // serve as a good proxy to detect month/weekday abbreviations.
        var hasMonthSuffix = !!loc.monthSuffix;
        return loc[type + 'Abbreviate'] || (hasMonthSuffix ? null : 3);
      }

      function setDefault(name, value) {
        loc[name] = loc[name] || value;
      }

      function buildNumbers() {
        var map = loc.ordinalNumberMap = {}, all = [];
        loc.numbers.forEach(function(full, i) {
          eachAlternate(full, function(alt) {
            all.push(alt);
            map[alt] = i + 1;
          });
        });
        loc.numbers = all;
      }

      function buildModifiers() {
        var arr = [];
        loc.modifiersByName = {};
        loc.modifiers.push({ name: 'day', src: 'yesterday', value:-1 });
        loc.modifiers.push({ name: 'day', src: 'today',     value: 0 });
        loc.modifiers.push({ name: 'day', src: 'tomorrow',  value: 1 });
        loc.modifiers.forEach(function(modifier) {
          var name = modifier.name;
          eachAlternate(modifier.src, function(t) {
            var locEntry = loc[name];
            loc.modifiersByName[t] = modifier;
            arr.push({ name: name, src: t, value: modifier.value });
            loc[name] = locEntry ? locEntry + '|' + t : t;
          });
        });
        loc.day += '|' + arrayToAlternates(loc.weekdays);
        loc.modifiers = arr;
      }

      // Initialize the locale
      loc = new Localization(set);
      initializeField('modifiers');
      'months,weekdays,units,numbers,articles,tokens,timeMarker,ampm,timeSuffixes,dateParse,timeParse'.split(',').forEach(initializeField);

      buildNumbers();

      setArray('months', getAbbreviationSize('month'), 12);
      setArray('weekdays', getAbbreviationSize('weekday'), 7);
      setArray('units', false, 8);

      setDefault('code', localeCode);
      setDefault('date', getDigit(1,2, loc.digitDate));
      setDefault('year', "'\\d{2}|" + getDigit(4,4));
      setDefault('num', getNum());

      buildModifiers();

      if (loc.monthSuffix) {
        loc.month = getDigit(1,2);
        loc.months = '1,2,3,4,5,6,7,8,9,10,11,12'.split(',').map(function(n) { return n + loc.monthSuffix; });
      }
      loc.fullMonth = getDigit(1,2) + '|' + arrayToAlternates(loc.months);

      // The order of these formats is very important. Order is reversed so formats that come
      // later will take precedence over formats that come before. This generally means that
      // more specific formats should come later, however, the {year} format should come before
      // {day}, as 2011 needs to be parsed as a year (2011) and not date (20) + hours (11)

      // If the locale has time suffixes then add a time only format for that locale
      // that is separate from the core English-based one.
      if (loc.timeSuffixes.length > 0) {
        loc.addFormat(prepareTime(RequiredTime, loc), false, TimeFormat);
      }

      loc.addFormat('{day}', true);
      loc.addFormat('{month}' + (loc.monthSuffix || ''));
      loc.addFormat('{year}' + (loc.yearSuffix || ''));

      loc.timeParse.forEach(function(src) {
        loc.addFormat(src, true);
      });

      loc.dateParse.forEach(function(src) {
        loc.addFormat(src);
      });

      return Localizations[localeCode] = loc;
    }


    // General helpers

    function addDateInputFormat(locale, format, match, variant) {
      locale.compiledFormats.unshift({
        variant: !!variant,
        locale: locale,
        reg: RegExp('^' + format + '$', 'i'),
        to: match
      });
    }

    function simpleCapitalize(str) {
      return str.slice(0,1).toUpperCase() + str.slice(1);
    }

    function arrayToAlternates(arr) {
      return arr.filter(function(el) {
        return !!el;
      }).join('|');
    }

    function getNewDate() {
      var fn = Date.SugarNewDate;
      return fn ? fn() : new Date;
    }

    function cloneDate(d) {
      var cloned = new Date(d.getTime());
      setUTC(cloned, !!d._utc);
      return cloned;
    }

    // Normal callDateSet method with ability
    // to handle ISOWeek setting as well.
    function callDateSetWithWeek(d, method, value) {
      if (method === 'ISOWeek') {
        return setWeekNumber(d, value);
      } else {
        return callDateSet(d, method, value);
      }
    }

    function isValid(d) {
      return !isNaN(d.getTime());
    }

    function isLeapYear(d) {
      var year = callDateGet(d, 'FullYear');
      return (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
    }

    // UTC helpers

    function setUTC(d, force) {
      setProperty(d, '_utc', !!force);
      return d;
    }

    function isUTC(d) {
      return !!d._utc || d.getTimezoneOffset() === 0;
    }

    function getUTCOffset(d, iso) {
      var offset = d._utc ? 0 : d.getTimezoneOffset();
      var colon  = iso === true ? ':' : '';
      if (!offset && iso) return 'Z';
      return padNumber(floor(-offset / 60), 2, true) + colon + padNumber(abs(offset % 60), 2);
    }

    // Date argument helpers

    function collectDateArguments(args, allowDuration) {
      var obj;
      if (isObjectType(args[0])) {
        return args;
      } else if (isNumber(args[0]) && !isNumber(args[1])) {
        return [args[0]];
      } else if (isString(args[0]) && allowDuration) {
        return [getDateParamsFromString(args[0]), args[1]];
      }
      obj = {};
      DateArgumentUnits.forEach(function(u,i) {
        obj[u.name] = args[i];
      });
      return [obj];
    }

    function getDateParamsFromString(str, num) {
      var match, num, params = {};
      match = str.match(/^(-?\d+)?\s?(\w+?)s?$/i);
      if (match) {
        if (isUndefined(num)) {
          num = parseInt(match[1]);
          if (isNaN(num)) {
            num = 1;
          }
        }
        params[match[2].toLowerCase()] = num;
      }
      return params;
    }

    // Date iteration helpers

    function iterateOverDateUnits(fn, from, to) {
      var i, unit;
      if (isUndefined(to)) to = DateUnitsReversed.length;
      for(i = from || 0; i < to; i++) {
        unit = DateUnitsReversed[i];
        if (fn(unit.name, unit, i) === false) {
          break;
        }
      }
    }

    // Date shifting helpers

    function advanceDate(d, args) {
      var set = collectDateArguments(args, true);
      return updateDate(d, set[0], set[1], 1);
    }

    function setDate(d, args) {
      var set = collectDateArguments(args);
      return updateDate(d, set[0], set[1])
    }

    function resetDate(d, unit) {
      var params = {}, recognized;
      unit = unit || 'hours';
      if (unit === 'date') unit = 'days';
      recognized = DateUnits.some(function(u) {
        return unit === u.name || unit === u.name + 's';
      });
      params[unit] = unit.match(/^days?/) ? 1 : 0;
      return recognized ? setDate(d, [params, true]) : d;
    }

    function setWeekday(d, dow, forward) {
      if (!isNumber(dow)) return;
      // Dates like "the 2nd Tuesday of June" need to be set forward
      // so make sure that the day of the week reflects that here.
      if (forward && dow % 7 < d.getDay()) {
        dow += 7;
      }
      return callDateSet(d, 'Date', callDateGet(d, 'Date') + dow - callDateGet(d, 'Day'));
    }

    function moveToBeginningOfUnit(d, unit) {
      var set = {};
      switch(unit) {
        case 'year':  set.year    = callDateGet(d, 'FullYear'); break;
        case 'month': set.month   = callDateGet(d, 'Month');    break;
        case 'day':   set.day     = callDateGet(d, 'Date');     break;
        case 'week':  set.weekday = 0; break;
      }
      return setDate(d, [set, true]);
    }

    function moveToEndOfUnit(d, unit) {
      var set = { hours: 23, minutes: 59, seconds: 59, milliseconds: 999 };
      switch(unit) {
        case 'year':  set.month   = 11; set.day = 31;  break;
        case 'month': set.day     = getDaysInMonth(d); break;
        case 'week':  set.weekday = 6;                 break;
      }
      return setDate(d, [set, true]);
    }

    // Date parsing helpers

    function getFormatMatch(match, arr) {
      var obj = {}, value, num;
      arr.forEach(function(key, i) {
        value = match[i + 1];
        if (isUndefined(value) || value === '') return;
        if (key === 'year') {
          obj.yearAsString = value.replace(/'/, '');
        }
        num = parseFloat(value.replace(/'/, '').replace(/,/, '.'));
        obj[key] = !isNaN(num) ? num : value.toLowerCase();
      });
      return obj;
    }

    function cleanDateInput(str) {
      str = str.trim().replace(/^just (?=now)|\.+$/i, '');
      return convertAsianDigits(str);
    }

    function convertAsianDigits(str) {
      return str.replace(AsianDigitReg, function(full, disallowed, match) {
        var sum = 0, place = 1, lastWasHolder, lastHolder;
        if (disallowed) return full;
        match.split('').reverse().forEach(function(letter) {
          var value = AsianDigitMap[letter], holder = value > 9;
          if (holder) {
            if (lastWasHolder) sum += place;
            place *= value / (lastHolder || 1);
            lastHolder = value;
          } else {
            if (lastWasHolder === false) {
              place *= 10;
            }
            sum += place * value;
          }
          lastWasHolder = holder;
        });
        if (lastWasHolder) sum += place;
        return sum;
      });
    }

    function getExtendedDate(contextDate, f, localeCode, prefer, forceUTC) {
      // TODO can we split this up into smaller methods?
      var d, relative, baseLocalization, afterCallbacks, loc, set, unit, unitIndex, weekday, num, tmp, weekdayForward;

      afterCallbacks = [];

      function afterDateSet(fn) {
        afterCallbacks.push(fn);
      }

      function fireCallbacks() {
        afterCallbacks.forEach(function(fn) {
          fn.call();
        });
      }

      function getWeekdayWithMultiplier(w) {
        var num = set.num && !set.unit ? set.num : 1;
        return (7 * (num - 1)) + w;
      }

      function setWeekdayOfMonth() {
        setWeekday(d, set.weekday, true);
      }

      function setUnitEdge() {
        var modifier = loc.modifiersByName[set.edge];
        iterateOverDateUnits(function(name) {
          if (isDefined(set[name])) {
            unit = name;
            return false;
          }
        }, 4);
        if (unit === 'year') {
          set.specificity = 'month';
        } else if (unit === 'month' || unit === 'week') {
          set.specificity = 'day';
        }
        if (modifier.value < 0) {
          moveToEndOfUnit(d, unit);
        } else {
          moveToBeginningOfUnit(d, unit);
        }
        // This value of -2 is arbitrary but it's a nice clean way to hook into this system.
        if (modifier.value === -2) resetDate(d);
      }

      function separateAbsoluteUnits() {
        var params;
        iterateOverDateUnits(function(name, u, i) {
          if (name === 'day') name = 'date';
          if (isDefined(set[name])) {
            // If there is a time unit set that is more specific than
            // the matched unit we have a string like "5:30am in 2 minutes",
            // which is meaningless, so invalidate the date...
            if (i >= unitIndex) {
              invalidateDate(d);
              return false;
            }
            // ...otherwise set the params to set the absolute date
            // as a callback after the relative date has been set.
            params = params || {};
            params[name] = set[name];
            delete set[name];
          }
        });
        if (params) {
          afterDateSet(function() {
            setDate(d, [params, true]);
          });
        }
      }

      if (contextDate && f) {
        // If a context date is passed, (in the case of "get"
        // and "[unit]FromNow") then use it as the starting point.
        d = cloneDate(contextDate);
      } else {
        d = getNewDate();
      }

      setUTC(d, forceUTC);

      if (isDate(f)) {
        // If the source here is already a date object, then the operation
        // is the same as cloning the date, which preserves the UTC flag.
        setUTC(d, isUTC(f)).setTime(f.getTime());
      } else if (isNumber(f) || f === null) {
        d.setTime(f);
      } else if (isObjectType(f)) {
        setDate(d, [f, true]);
        set = f;
      } else if (isString(f)) {

        // The act of getting the localization will pre-initialize
        // if it is missing and add the required formats.
        baseLocalization = getLocalization(localeCode);

        // Clean the input and convert Kanji based numerals if they exist.
        f = cleanDateInput(f);

        if (baseLocalization) {
          iterateOverObject(baseLocalization.getFormats(), function(i, dif) {
            var match = f.match(dif.reg);
            if (match) {

              loc = dif.locale;
              set = getFormatMatch(match, dif.to, loc);
              loc.cachedFormat = dif;

              if (set.utc) {
                setUTC(d, true);
              }

              if (set.timestamp) {
                set = set.timestamp;
                return false;
              }

              if (dif.variant && !isString(set.month) && (isString(set.date) || baseLocalization.hasVariant(localeCode))) {
                // If there's a variant (crazy Endian American format), swap the month and day.
                tmp = set.month;
                set.month = set.date;
                set.date  = tmp;
              }

              if (hasAbbreviatedYear(set)) {
                // If the year is 2 digits then get the implied century.
                set.year = getYearFromAbbreviation(set.year);
              }

              if (set.month) {
                // Set the month which may be localized.
                set.month = loc.getMonth(set.month);
                if (set.shift && !set.unit) set.unit = loc.units[7];
              }

              if (set.weekday && set.date) {
                // If there is both a weekday and a date, the date takes precedence.
                delete set.weekday;
              } else if (set.weekday) {
                // Otherwise set a localized weekday.
                set.weekday = loc.getWeekday(set.weekday);
                if (set.shift && !set.unit) {
                  set.unit = loc.units[5];
                }
              }

              if (set.day && (tmp = loc.modifiersByName[set.day])) {
                // Relative day localizations such as "today" and "tomorrow".
                set.day = tmp.value;
                resetDate(d);
                relative = true;
              } else if (set.day && (weekday = loc.getWeekday(set.day)) > -1) {
                // If the day is a weekday, then set that instead.
                delete set.day;
                set.weekday = getWeekdayWithMultiplier(weekday);
                if (set.num && set.month) {
                  // If we have "the 2nd Tuesday of June", then pass the "weekdayForward" flag
                  // along to updateDate so that the date does not accidentally traverse into
                  // the previous month. This needs to be independent of the "prefer" flag because
                  // we are only ensuring that the weekday is in the future, not the entire date.
                  weekdayForward = true;
                }
              }

              if (set.date && !isNumber(set.date)) {
                set.date = loc.getNumericDate(set.date);
              }

              if (loc.matchPM(set.ampm) && set.hour < 12) {
                // If the time is 1pm-11pm advance the time by 12 hours.
                set.hour += 12;
              } else if (loc.matchAM(set.ampm) && set.hour === 12) {
                // If it is 12:00am then set the hour to 0.
                set.hour = 0;
              }

              if (isNumber(set.offsetHours) || isNumber(set.offsetMinutes)) {
                // Adjust for timezone offset
                setUTC(d, true);
                set.offsetMinutes = set.offsetMinutes || 0;
                set.offsetMinutes += set.offsetHours * 60;
                if (set.offsetSign === '-') {
                  set.offsetMinutes *= -1;
                }
                set.minute -= set.offsetMinutes;
              }

              if (set.unit) {
                // Date has a unit like "days", "months", etc. are all relative to the current date.
                relative  = true;
                num       = loc.getNumber(set.num);
                unitIndex = loc.getUnitIndex(set.unit);
                unit      = English.units[unitIndex];

                // Formats like "the 15th of last month" or "6:30pm of next week"
                // contain absolute units in addition to relative ones, so separate
                // them here, remove them from the params, and set up a callback to
                // set them after the relative ones have been set.
                separateAbsoluteUnits();

                if (set.shift) {
                  // Shift and unit, ie "next month", "last week", etc.
                  num *= (tmp = loc.modifiersByName[set.shift]) ? tmp.value : 0;
                }

                if (set.sign && (tmp = loc.modifiersByName[set.sign])) {
                  // Unit and sign, ie "months ago", "weeks from now", etc.
                  num *= tmp.value;
                }

                if (isDefined(set.weekday)) {
                  // Units can be with non-relative dates, set here. ie "the day after monday"
                  setDate(d, [{ weekday: set.weekday }, true]);
                  delete set.weekday;
                }

                // Finally shift the unit.
                set[unit] = (set[unit] || 0) + num;
              }

              if (set.edge) {
                // If there is an "edge" it needs to be set after the
                // other fields are set. ie "the end of February"
                afterDateSet(setUnitEdge);
              }

              if (set.yearSign === '-') {
                set.year *= -1;
              }

              iterateOverDateUnits(function(name, unit, i) {
                var value = set[name] || 0, fraction = value % 1;
                if (fraction) {
                  set[DateUnitsReversed[i - 1].name] = round(fraction * (name === 'second' ? 1000 : 60));
                  set[name] = floor(value);
                }
              }, 1, 4);
              return false;
            }
          });
        }
        if (!set) {
          // The Date constructor does something tricky like checking the number
          // of arguments so simply passing in undefined won't work.
          if (!/^now$/i.test(f)) {
            d = new Date(f);
          }
          if (forceUTC) {
            // Falling back to system date here which cannot be parsed as UTC,
            // so if we're forcing UTC then simply add the offset.
            d.addMinutes(-d.getTimezoneOffset());
          }
        } else if (relative) {
          advanceDate(d, [set]);
        } else {
          if (d._utc) {
            // UTC times can traverse into other days or even months,
            // so preemtively reset the time here to prevent this.
            resetDate(d);
          }
          updateDate(d, set, true, false, prefer, weekdayForward);
        }
        fireCallbacks();
        // A date created by parsing a string presumes that the format *itself* is UTC, but
        // not that the date, once created, should be manipulated as such. In other words,
        // if you are creating a date object from a server time "2012-11-15T12:00:00Z",
        // in the majority of cases you are using it to create a date that will, after creation,
        // be manipulated as local, so reset the utc flag here.
        setUTC(d, false);
      }
      return {
        date: d,
        set: set
      }
    }

    function hasAbbreviatedYear(obj) {
      return obj.yearAsString && obj.yearAsString.length === 2;
    }

    // If the year is two digits, add the most appropriate century prefix.
    function getYearFromAbbreviation(year) {
      return round(callDateGet(getNewDate(), 'FullYear') / 100) * 100 - round(year / 100) * 100 + year;
    }

    function getShortHour(d) {
      var hours = callDateGet(d, 'Hours');
      return hours === 0 ? 12 : hours - (floor(hours / 13) * 12);
    }

    // weeksSince won't work here as the result needs to be floored, not rounded.
    function getWeekNumber(date) {
      date = cloneDate(date);
      var dow = callDateGet(date, 'Day') || 7;
      resetDate(advanceDate(date, [(4 - dow) + ' days']));
      return 1 + floor(date.daysSince(moveToBeginningOfUnit(cloneDate(date), 'year')) / 7);
    }

    function setWeekNumber(date, num) {
      var weekday = callDateGet(date, 'Day') || 7;
      if (isUndefined(num)) return;
      setDate(date, [{ month: 0, date: 4 }]);
      setDate(date, [{ weekday: 1 }]);
      if (num > 1) {
        advanceDate(date, [{ weeks: num - 1 }]);
      }
      if (weekday !== 1) {
        advanceDate(date, [{ days: weekday - 1 }]);
      }
      return date.getTime();
    }

    function getDaysInMonth(d) {
      return 32 - callDateGet(new Date(callDateGet(d, 'FullYear'), callDateGet(d, 'Month'), 32), 'Date');
    }

    // Gets an "adjusted date unit" which is a way of representing
    // the largest possible meaningful unit. In other words, if passed
    // 3600000, this will return an array which represents "1 hour".
    function getAdjustedUnit(ms, fn) {
      var unitIndex = 0, value = 0;
      iterateOverObject(DateUnits, function(i, unit) {
        value = abs(fn(unit));
        if (value >= 1) {
          unitIndex = 7 - i;
          return false;
        }
      });
      return [value, unitIndex, ms];
    }

    // Gets the adjusted unit based on simple division by
    // date unit multiplier.
    function getAdjustedUnitForNumber(ms) {
      return getAdjustedUnit(ms, function(unit) {
        return floor(withPrecision(ms / unit.multiplier, 1));
      });
    }

    // Gets the adjusted unit using the [unit]FromNow methods,
    // which use internal date methods that neatly avoid vaguely
    // defined units of time (days in month, leap years, etc).
    function getAdjustedUnitForDate(d) {
      var ms = d - new Date();
      if (d.getTime() > Date.now()) {

        // This adjustment is solely to allow
        // Date.create('1 year from now').relative() to remain
        // "1 year from now" instead of "11 months from now",
        // as it would be due to the fact that the internal
        // "now" date in "relative" is created slightly after
        // that in "create".
        d = new Date(d.getTime() + 10);
      }
      return getAdjustedUnit(ms, function(unit) {
        return abs(d[unit.name + 'sFromNow']());
      });
    }

    // Date format token helpers

    function createMeridianTokens(slice, caps) {
      var fn = function(d, localeCode) {
        var hours = callDateGet(d, 'Hours');
        return getLocalization(localeCode).get('ampm')[floor(hours / 12)] || '';
      }
      createFormatToken('t', fn, 1);
      createFormatToken('tt', fn);
      createFormatToken('T', fn, 1, 1);
      createFormatToken('TT', fn, null, 2);
    }

    function createWeekdayTokens(slice, caps) {
      var fn = function(d, localeCode) {
        var dow = callDateGet(d, 'Day');
        return getLocalization(localeCode).weekdays[dow];
      }
      createFormatToken('do', fn, 2);
      createFormatToken('Do', fn, 2, 1);
      createFormatToken('dow', fn, 3);
      createFormatToken('Dow', fn, 3, 1);
      createFormatToken('weekday', fn);
      createFormatToken('Weekday', fn, null, 1);
    }

    function createMonthTokens(slice, caps) {
      createMonthToken('mon', 0, 3);
      createMonthToken('month', 0);

      // For inflected month forms, namely Russian.
      createMonthToken('month2', 1);
      createMonthToken('month3', 2);
    }

    function createMonthToken(token, multiplier, slice) {
      var fn = function(d, localeCode) {
        var month = callDateGet(d, 'Month');
        return getLocalization(localeCode).months[month + (multiplier * 12)];
      };
      createFormatToken(token, fn, slice);
      createFormatToken(simpleCapitalize(token), fn, slice, 1);
    }

    function createFormatToken(t, fn, slice, caps) {
      DateFormatTokens[t] = function(d, localeCode) {
        var str = fn(d, localeCode);
        if (slice) str = str.slice(0, slice);
        if (caps)  str = str.slice(0, caps).toUpperCase() + str.slice(caps);
        return str;
      }
    }

    function createPaddedToken(t, fn, ms) {
      DateFormatTokens[t] = fn;
      DateFormatTokens[t + t] = function (d, localeCode) {
        return padNumber(fn(d, localeCode), 2);
      };
      if (ms) {
        DateFormatTokens[t + t + t] = function (d, localeCode) {
          return padNumber(fn(d, localeCode), 3);
        };
        DateFormatTokens[t + t + t + t] = function (d, localeCode) {
          return padNumber(fn(d, localeCode), 4);
        };
      }
    }


    // Date formatting helpers

    function buildCompiledOutputFormat(format) {
      var match = format.match(/(\{\w+\})|[^{}]+/g);
      CompiledOutputFormats[format] = match.map(function(p) {
        p.replace(/\{(\w+)\}/, function(full, token) {
          p = DateFormatTokens[token] || token;
          return token;
        });
        return p;
      });
    }

    function executeCompiledOutputFormat(date, format, localeCode) {
      var compiledFormat, length, i, t, result = '';
      compiledFormat = CompiledOutputFormats[format];
      for(i = 0, length = compiledFormat.length; i < length; i++) {
        t = compiledFormat[i];
        result += isFunction(t) ? t(date, localeCode) : t;
      }
      return result;
    }

    function formatDate(date, format, relative, localeCode) {
      var adu;
      if (!isValid(date)) {
        return 'Invalid Date';
      } else if (isString(Date[format])) {
        format = Date[format];
      } else if (isFunction(format)) {
        adu = getAdjustedUnitForDate(date);
        format = format.apply(date, adu.concat(getLocalization(localeCode)));
      }
      if (!format && relative) {
        adu = adu || getAdjustedUnitForDate(date);
        // Adjust up if time is in ms, as this doesn't
        // look very good for a standard relative date.
        if (adu[1] === 0) {
          adu[1] = 1;
          adu[0] = 1;
        }
        return getLocalization(localeCode).getRelativeFormat(adu);
      }
      format = format || 'long';
      if (format === 'short' || format === 'long' || format === 'full') {
        format = getLocalization(localeCode)[format];
      }

      if (!CompiledOutputFormats[format]) {
        buildCompiledOutputFormat(format);
      }

      return executeCompiledOutputFormat(date, format, localeCode);
    }

    // Date comparison helpers

    function fullCompareDate(d, f, margin, utc) {
      var tmp, comp;
      if (!isValid(d)) return;
      if (isString(f)) {
        f = f.trim().toLowerCase();
        comp = setUTC(cloneDate(d), utc);
        switch(true) {
          case f === 'future':  return d.getTime() > getNewDate().getTime();
          case f === 'past':    return d.getTime() < getNewDate().getTime();
          case f === 'weekday': return callDateGet(comp, 'Day') > 0 && callDateGet(comp, 'Day') < 6;
          case f === 'weekend': return callDateGet(comp, 'Day') === 0 || callDateGet(comp, 'Day') === 6;
          case (tmp = English.weekdays.indexOf(f) % 7) > -1: return callDateGet(comp, 'Day') === tmp;
          case (tmp = English.months.indexOf(f) % 12) > -1:  return callDateGet(comp, 'Month') === tmp;
        }
      }
      return compareDate(d, f, null, margin, utc);
    }

    function compareDate(d, find, localeCode, buffer, forceUTC) {
      var p, t, min, max, override, accuracy = 0, loBuffer = 0, hiBuffer = 0;
      p = getExtendedDate(null, find, localeCode, null, forceUTC);
      if (buffer > 0) {
        loBuffer = hiBuffer = buffer;
        override = true;
      }
      if (!isValid(p.date)) return false;
      if (p.set && p.set.specificity) {
        if (p.set.edge || p.set.shift) {
          moveToBeginningOfUnit(p.date, p.set.specificity);
        }
        if (p.set.specificity === 'month') {
          max = moveToEndOfUnit(cloneDate(p.date), p.set.specificity).getTime();
        } else {
          max = advanceDate(cloneDate(p.date), ['1 ' + p.set.specificity]).getTime() - 1;
        }
        if (!override && p.set.sign && p.set.specificity !== 'millisecond') {
          // If the time is relative, there can occasionally be an disparity between the relative date
          // and "now", which it is being compared to, so set an extra buffer to account for this.
          loBuffer = 50;
          hiBuffer = -50;
        }
      }
      t   = d.getTime();
      min = p.date.getTime();
      max = max || (min + accuracy);
      max = compensateForTimezoneTraversal(d, min, max);
      return t >= (min - loBuffer) && t <= (max + hiBuffer);
    }

    function compensateForTimezoneTraversal(d, min, max) {
      var dMin, dMax, minOffset, maxOffset;
      dMin = new Date(min);
      dMax = setUTC(new Date(max), isUTC(d));
      if (callDateGet(dMax, 'Hours') !== 23) {
        minOffset = dMin.getTimezoneOffset();
        maxOffset = dMax.getTimezoneOffset();
        if (minOffset !== maxOffset) {
          max += (maxOffset - minOffset).minutes();
        }
      }
      return max;
    }

    function updateDate(d, params, reset, advance, prefer, weekdayForward) {
      var specificityIndex, noop = true;

      function getParam(key) {
        return isDefined(params[key]) ? params[key] : params[key + 's'];
      }

      function paramExists(key) {
        return isDefined(getParam(key));
      }

      function uniqueParamExists(key, isDay) {
        return paramExists(key) || (isDay && paramExists('weekday') && !paramExists('month'));
      }

      function canDisambiguate() {
        switch(prefer) {
          case -1: return d > getNewDate();
          case  1: return d < getNewDate();
        }
      }

      if (isNumber(params) && advance) {
        // If param is a number and we're advancing, the number is presumed to be milliseconds.
        params = { milliseconds: params };
      } else if (isNumber(params)) {
        // Otherwise just set the timestamp and return.
        d.setTime(params);
        return d;
      }

      // "date" can also be passed for the day
      if (isDefined(params.date)) {
        params.day = params.date;
      }

      // Reset any unit lower than the least specific unit set. Do not do this for
      // weeks or for years. This needs to be performed before the acutal setting
      // of the date because the order needs to be reversed in order to get the
      // lowest specificity, also because higher order units can be overridden by
      // lower order units, such as setting hour: 3, minute: 345, etc.
      iterateOverDateUnits(function(name, unit, i) {
        var isDay = name === 'day';
        if (uniqueParamExists(name, isDay)) {
          params.specificity = name;
          specificityIndex = +i;
          return false;
        } else if (reset && name !== 'week' && (!isDay || !paramExists('week'))) {
          // Days are relative to months, not weeks, so don't reset if a week exists.
          callDateSet(d, unit.method, (isDay ? 1 : 0));
        }
      });

      // Now actually set or advance the date in order, higher units first.
      DateUnits.forEach(function(u, i) {
        var name = u.name, method = u.method, value, checkMonth;
        value = getParam(name)
        if (isUndefined(value)) return;

        noop = false;
        checkMonth = name === 'month' && callDateGet(d, 'Date') > 28;

        // If we are advancing or rewinding, then we need we need to set the
        // absolute time if the unit is "hours" or less. This is due to the fact
        // that setting by method is ambiguous during DST shifts. For example,
        // 1:00am on November 1st 2015 occurs twice in North American timezones
        // with DST, the second time being after the clocks are rolled back at
        // 2:00am. When springing forward this is automatically handled as there
        // is no 2:00am so the date automatically jumps to 3:00am. However, when
        // rolling back, a date at 1:00am that has setHours(2) called on it will
        // jump forward and extra hour as the period between 1:00am and 1:59am
        // occurs twice. This ambiguity is unavoidable when setting dates as the
        // notation is ambiguous. However, when advancing we clearly want the
        // resulting date to be an acutal hour ahead, which can only accomplished
        // by setting the absolute time. Conversely, any unit higher than "hours"
        // MUST use the internal set methods, as they are ambiguous as absolute
        // units of time. Years may be 365 or 366 days depending on leap years,
        // months are all over the place, and even days may be 23-25 hours
        // depending on DST shifts.
        if (advance && i > 3) {
          d.setTime(d.getTime() + (value * advance * u.multiplier));
          return;
        } else if (advance) {
          if (name === 'week') {
            value *= 7;
            method = 'Date';
          }
          value = (value * advance) + callDateGet(d, method);
        }
        callDateSetWithWeek(d, method, value);
        if (checkMonth && monthHasShifted(d, value)) {
          // As we are setting the units in reverse order, there is a chance that
          // our date may accidentally traverse into a new month, such as setting
          // { month: 1, date 15 } on January 31st. Check for this here and reset
          // the date to the last day of the previous month if this has happened.
          callDateSet(d, 'Date', 0);
        }
      });

      // If a weekday is included in the params and no 'date' parameter is
      // overriding, set it here after all other units have been set. Note that
      // the date has to be perfectly set before disambiguation so that a proper
      // comparison can be made.
      if (!advance && !paramExists('day') && paramExists('weekday')) {
        setWeekday(d, getParam('weekday'), weekdayForward);
      }

      // If no action has been taken on the date
      // then it should be considered invalid.
      if (noop && !params.specificity) {
        invalidateDate(d);
        return d;
      }

      // If past or future is preferred, then the process of "disambiguation" will
      // ensure that an ambiguous time/date ("4pm", "thursday", "June", etc.) will
      // be in the past or future.
      if (canDisambiguate()) {
        iterateOverDateUnits(function(name, u) {
          var ambiguous = u.ambiguous || (name === 'week' && paramExists('weekday'));
          if (ambiguous && !uniqueParamExists(name, name === 'day')) {
            d[u.addMethod](prefer);
            return false;
          } else if (name === 'year' && hasAbbreviatedYear(params)) {
            updateDate(d, { years: 100 * prefer }, false, 1);
          }
        }, specificityIndex + 1);
      }
      return d;
    }

    function monthHasShifted(d, targetMonth) {
      if (targetMonth < 0) {
        targetMonth = targetMonth % 12 + 12;
      }
      return targetMonth % 12 !== callDateGet(d, 'Month');
    }

    // The ISO format allows times strung together without a demarcating ":", so make sure
    // that these markers are now optional.
    function prepareTime(format, loc, iso) {
      var timeSuffixMapping = {'h':0,'m':1,'s':2}, add;
      loc = loc || English;
      return format.replace(/{([a-z])}/g, function(full, token) {
        var separators = [],
            isHours = token === 'h',
            tokenIsRequired = isHours && !iso;
        if (token === 't') {
          return loc.get('ampm').join('|');
        } else {
          if (isHours) {
            separators.push(':');
          }
          if (add = loc.timeSuffixes[timeSuffixMapping[token]]) {
            separators.push(add + '\\s*');
          }
          return separators.length === 0 ? '' : '(?:' + separators.join('|') + ')' + (tokenIsRequired ? '' : '?');
        }
      });
    }

    // If the month is being set, then we don't want to accidentally
    // traverse into a new month just because the target month doesn't have enough
    // days. In other words, "5 months ago" from July 30th is still February, even
    // though there is no February 30th, so it will of necessity be February 28th
    // (or 29th in the case of a leap year).
    function checkMonthTraversal(date, targetMonth) {
      if (targetMonth < 0) {
        targetMonth = targetMonth % 12 + 12;
      }
      if (targetMonth % 12 !== callDateGet(date, 'Month')) {
        callDateSet(date, 'Date', 0);
      }
    }

    function createDateFromArgs(contextDate, args, prefer, forceUTC) {
      var f, localeCode;
      if (isNumber(args[1])) {
        // If the second argument is a number, then we have an
        // enumerated constructor type as in "new Date(2003, 2, 12);"
        f = collectDateArguments(args)[0];
      } else {
        f = args[0];
        localeCode = args[1];
      }
      return createDate(contextDate, f, localeCode, prefer, forceUTC);
    }

    function createDate(contextDate, f, localeCode, prefer, forceUTC) {
      return getExtendedDate(contextDate, f, localeCode, prefer, forceUTC).date;
    }

    function invalidateDate(d) {
      d.setTime(NaN);
    }

    function buildDateUnits() {
      DateUnitsReversed = DateUnits.concat().reverse();
      DateArgumentUnits = DateUnits.concat();
      DateArgumentUnits.splice(2,1);
    }


    /***
     * @method [units]Since([d], [locale] = currentLocale)
     * @returns Number
     * @short Returns the time since [d] in the appropriate unit.
     * @extra [d] will accept a date object, timestamp, or text format. If not specified, [d] is assumed to be now. [locale] can be passed to specify the locale that the date is in. %[unit]Ago% is provided as an alias to make this more readable when [d] is assumed to be the current date. For more see %date_format%.
     *
     * @set
     *   millisecondsSince
     *   secondsSince
     *   minutesSince
     *   hoursSince
     *   daysSince
     *   weeksSince
     *   monthsSince
     *   yearsSince
     *
     * @example
     *
     *   Date.create().millisecondsSince('1 hour ago') -> 3,600,000
     *   Date.create().daysSince('1 week ago')         -> 7
     *   Date.create().yearsSince('15 years ago')      -> 15
     *   Date.create('15 years ago').yearsAgo()        -> 15
     *
     ***
     * @method [units]Ago()
     * @returns Number
     * @short Returns the time ago in the appropriate unit.
     *
     * @set
     *   millisecondsAgo
     *   secondsAgo
     *   minutesAgo
     *   hoursAgo
     *   daysAgo
     *   weeksAgo
     *   monthsAgo
     *   yearsAgo
     *
     * @example
     *
     *   Date.create('last year').millisecondsAgo() -> 3,600,000
     *   Date.create('last year').daysAgo()         -> 7
     *   Date.create('last year').yearsAgo()        -> 15
     *
     ***
     * @method [units]Until([d], [locale] = currentLocale)
     * @returns Number
     * @short Returns the time until [d] in the appropriate unit.
     * @extra [d] will accept a date object, timestamp, or text format. If not specified, [d] is assumed to be now. [locale] can be passed to specify the locale that the date is in. %[unit]FromNow% is provided as an alias to make this more readable when [d] is assumed to be the current date. For more see %date_format%.
     *
     * @set
     *   millisecondsUntil
     *   secondsUntil
     *   minutesUntil
     *   hoursUntil
     *   daysUntil
     *   weeksUntil
     *   monthsUntil
     *   yearsUntil
     *
     * @example
     *
     *   Date.create().millisecondsUntil('1 hour from now') -> 3,600,000
     *   Date.create().daysUntil('1 week from now')         -> 7
     *   Date.create().yearsUntil('15 years from now')      -> 15
     *   Date.create('15 years from now').yearsFromNow()    -> 15
     *
     ***
     * @method [units]FromNow()
     * @returns Number
     * @short Returns the time from now in the appropriate unit.
     *
     * @set
     *   millisecondsFromNow
     *   secondsFromNow
     *   minutesFromNow
     *   hoursFromNow
     *   daysFromNow
     *   weeksFromNow
     *   monthsFromNow
     *   yearsFromNow
     *
     * @example
     *
     *   Date.create('next year').millisecondsFromNow() -> 3,600,000
     *   Date.create('next year').daysFromNow()         -> 7
     *   Date.create('next year').yearsFromNow()        -> 15
     *
     ***
     * @method add[Units](<num>, [reset] = false)
     * @returns Date
     * @short Adds <num> of the unit to the date. If [reset] is true, all lower units will be reset.
     * @extra Note that "months" is ambiguous as a unit of time. If the target date falls on a day that does not exist (ie. August 31 -> February 31), the date will be shifted to the last day of the month. Don't use %addMonths% if you need precision.
     *
     * @set
     *   addMilliseconds
     *   addSeconds
     *   addMinutes
     *   addHours
     *   addDays
     *   addWeeks
     *   addMonths
     *   addYears
     *
     * @example
     *
     *   Date.create().addMilliseconds(5) -> current time + 5 milliseconds
     *   Date.create().addDays(5)         -> current time + 5 days
     *   Date.create().addYears(5)        -> current time + 5 years
     *
     ***
     * @method isLast[Unit]()
     * @returns Boolean
     * @short Returns true if the date is last week/month/year.
     *
     * @set
     *   isLastWeek
     *   isLastMonth
     *   isLastYear
     *
     * @example
     *
     *   Date.create('yesterday').isLastWeek()  -> true or false?
     *   Date.create('yesterday').isLastMonth() -> probably not...
     *   Date.create('yesterday').isLastYear()  -> even less likely...
     *
     ***
     * @method isThis[Unit]()
     * @returns Boolean
     * @short Returns true if the date is this week/month/year.
     *
     * @set
     *   isThisWeek
     *   isThisMonth
     *   isThisYear
     *
     * @example
     *
     *   Date.create('tomorrow').isThisWeek()  -> true or false?
     *   Date.create('tomorrow').isThisMonth() -> probably...
     *   Date.create('tomorrow').isThisYear()  -> signs point to yes...
     *
     ***
     * @method isNext[Unit]()
     * @returns Boolean
     * @short Returns true if the date is next week/month/year.
     *
     * @set
     *   isNextWeek
     *   isNextMonth
     *   isNextYear
     *
     * @example
     *
     *   Date.create('tomorrow').isNextWeek()  -> true or false?
     *   Date.create('tomorrow').isNextMonth() -> probably not...
     *   Date.create('tomorrow').isNextYear()  -> even less likely...
     *
     ***
     * @method beginningOf[Unit]()
     * @returns Date
     * @short Sets the date to the beginning of the appropriate unit.
     *
     * @set
     *   beginningOfDay
     *   beginningOfWeek
     *   beginningOfMonth
     *   beginningOfYear
     *
     * @example
     *
     *   Date.create().beginningOfDay()   -> the beginning of today (resets the time)
     *   Date.create().beginningOfWeek()  -> the beginning of the week
     *   Date.create().beginningOfMonth() -> the beginning of the month
     *   Date.create().beginningOfYear()  -> the beginning of the year
     *
     ***
     * @method endOf[Unit]()
     * @returns Date
     * @short Sets the date to the end of the appropriate unit.
     *
     * @set
     *   endOfDay
     *   endOfWeek
     *   endOfMonth
     *   endOfYear
     *
     * @example
     *
     *   Date.create().endOfDay()   -> the end of today (sets the time to 23:59:59.999)
     *   Date.create().endOfWeek()  -> the end of the week
     *   Date.create().endOfMonth() -> the end of the month
     *   Date.create().endOfYear()  -> the end of the year
     *
     ***/

    function buildDateMethods() {
      extendSimilar(Date, DateUnits, function(methods, u, i) {
        var name = u.name, caps = simpleCapitalize(name), since, until;
        u.addMethod = 'add' + caps + 's';

        function add(num, reset) {
          var set = {};
          set[name] = num;
          return advanceDate(this, [set, reset]);
        }

        function timeDistanceNumeric(d1, d2) {
          var n = (d1.getTime() - d2.getTime()) / u.multiplier;
          return n < 0 ? ceil(n) : floor(n);
        }

        function addUnit(d, n, dsc) {
          var d2;
          add.call(d, n);
          // "dsc" = "date shift compensation"
          // This number should only be passed when traversing months to
          // compensate for date shifting. For example, calling "1 month ago"
          // on March 30th will result in February 28th, as there are not enough
          // days. This is not an issue when creating new dates, as "2 months ago"
          // gives an exact target to set, and the date shift is expected. However,
          // when counting months using unit traversal, the date needs to stay the
          // same if possible. To compensate for this, we need to try to reset the
          // date after every iteration, and use the result if possible.
          if (dsc && callDateGet(d, 'Date') !== dsc) {
            d2 = cloneDate(d);
            callDateSet(d2, 'Date', dsc);
            if (callDateGet(d2, 'Date') === dsc) {
              return d2;
            }
          }
          return d;
        }

        function timeDistanceTraversal(d1, d2) {
          var d, inc, n, dsc, count = 0;
          d = cloneDate(d1);
          inc = d1 < d2;
          n = inc ? 1 : -1
          dsc = name === 'month' && callDateGet(d, 'Date');
          d = addUnit(d, n, dsc);
          while (inc ? d <= d2 : d >= d2) {
            count += -n;
            d = addUnit(d, n, dsc);
          }
          return count;
        }

        function compareSince(fn, d, args) {
          return fn(d, createDateFromArgs(d, args, 0, false));
        }

        function compareUntil(fn, d, args) {
          return fn(createDateFromArgs(d, args, 0, false), d);
        }

        if (i < 3) {
          ['Last','This','Next'].forEach(function(shift) {
            methods['is' + shift + caps] = function() {
              return compareDate(this, shift + ' ' + name, 'en');
            };
          });
        }
        if (i < 4) {
          methods['beginningOf' + caps] = function() {
            return moveToBeginningOfUnit(this, name);
          };
          methods['endOf' + caps] = function() {
            return moveToEndOfUnit(this, name);
          };
          since = function() {
            // Optimized: no leaking arguments
            var args = [], $i; for($i = 0; $i < arguments.length; $i++) args.push(arguments[$i]);
            return compareSince(timeDistanceTraversal, this, args);
          };
          until = function() {
            // Optimized: no leaking arguments
            var args = [], $i; for($i = 0; $i < arguments.length; $i++) args.push(arguments[$i]);
            return compareUntil(timeDistanceTraversal, this, args);
          };
        } else {
          since = function() {
            // Optimized: no leaking arguments
            var args = [], $i; for($i = 0; $i < arguments.length; $i++) args.push(arguments[$i]);
            return compareSince(timeDistanceNumeric, this, args);
          };
          until = function() {
            // Optimized: no leaking arguments
            var args = [], $i; for($i = 0; $i < arguments.length; $i++) args.push(arguments[$i]);
            return compareUntil(timeDistanceNumeric, this, args);
          };
        }
        methods[name + 'sAgo']     = until;
        methods[name + 'sUntil']   = until;
        methods[name + 'sSince']   = since;
        methods[name + 'sFromNow'] = since;

        methods[u.addMethod] = add;
        buildNumberToDateAlias(u, u.multiplier);
      });
    }

    function buildCoreInputFormats() {
      English.addFormat('([+-])?(\\d{4,4})[-.\\/]?{fullMonth}[-.]?(\\d{1,2})?', true, ['yearSign','year','month','date'], false, true);
      English.addFormat('(\\d{1,2})[-.\\/]{fullMonth}(?:[-.\\/](\\d{2,4}))?', true, ['date','month','year'], true);
      English.addFormat('{fullMonth}[-.](\\d{4,4})', false, ['month','year']);
      English.addFormat('\\/Date\\((\\d+(?:[+-]\\d{4,4})?)\\)\\/', false, ['timestamp'])
      English.addFormat(prepareTime(RequiredTime, English), false, TimeFormat)

      // When a new locale is initialized it will have the CoreDateFormats initialized by default.
      // From there, adding new formats will push them in front of the previous ones, so the core
      // formats will be the last to be reached. However, the core formats themselves have English
      // months in them, which means that English needs to first be initialized and creates a race
      // condition. I'm getting around this here by adding these generalized formats in the order
      // specific -> general, which will mean they will be added to the English localization in
      // general -> specific order, then chopping them off the front and reversing to get the correct
      // order. Note that there are 7 formats as 2 have times which adds a front and a back format.
      CoreDateFormats = English.compiledFormats.slice(0,7).reverse();
      English.compiledFormats = English.compiledFormats.slice(7).concat(CoreDateFormats);
    }

    function buildFormatTokens() {

      createPaddedToken('f', function(d) {
        return callDateGet(d, 'Milliseconds');
      }, true);

      createPaddedToken('s', function(d) {
        return callDateGet(d, 'Seconds');
      });

      createPaddedToken('m', function(d) {
        return callDateGet(d, 'Minutes');
      });

      createPaddedToken('h', function(d) {
        return callDateGet(d, 'Hours') % 12 || 12;
      });

      createPaddedToken('H', function(d) {
        return callDateGet(d, 'Hours');
      });

      createPaddedToken('d', function(d) {
        return callDateGet(d, 'Date');
      });

      createPaddedToken('M', function(d) {
        return callDateGet(d, 'Month') + 1;
      });

      createMeridianTokens();
      createWeekdayTokens();
      createMonthTokens();

      // Aliases
      DateFormatTokens['ms']           = DateFormatTokens['f'];
      DateFormatTokens['milliseconds'] = DateFormatTokens['f'];
      DateFormatTokens['seconds']      = DateFormatTokens['s'];
      DateFormatTokens['minutes']      = DateFormatTokens['m'];
      DateFormatTokens['hours']        = DateFormatTokens['h'];
      DateFormatTokens['24hr']         = DateFormatTokens['H'];
      DateFormatTokens['12hr']         = DateFormatTokens['h'];
      DateFormatTokens['date']         = DateFormatTokens['d'];
      DateFormatTokens['day']          = DateFormatTokens['d'];
      DateFormatTokens['year']         = DateFormatTokens['yyyy'];

    }

    function buildFormatShortcuts() {
      extendSimilar(Date, 'short,long,full', function(methods, name) {
        methods[name] = function(localeCode) {
          return formatDate(this, name, false, localeCode);
        }
      });
    }

    function buildAsianDigits() {
      KanjiDigits.split('').forEach(function(digit, value) {
        var holder;
        if (value > 9) {
          value = pow(10, value - 9);
        }
        AsianDigitMap[digit] = value;
      });
      simpleMerge(AsianDigitMap, NumberNormalizeMap);
      // Kanji numerals may also be included in phrases which are text-based rather
      // than actual numbers such as Chinese weekdays (上周三), and "the day before
      // yesterday" (一昨日) in Japanese, so don't match these.
      AsianDigitReg = RegExp('([期週周])?([' + KanjiDigits + FullWidthDigits + ']+)(?!昨)', 'g');
    }

     /***
     * @method is[Day]()
     * @returns Boolean
     * @short Returns true if the date falls on that day.
     * @extra Also available: %isYesterday%, %isToday%, %isTomorrow%, %isWeekday%, and %isWeekend%.
     *
     * @set
     *   isToday
     *   isYesterday
     *   isTomorrow
     *   isWeekday
     *   isWeekend
     *   isSunday
     *   isMonday
     *   isTuesday
     *   isWednesday
     *   isThursday
     *   isFriday
     *   isSaturday
     *
     * @example
     *
     *   Date.create('tomorrow').isToday() -> false
     *   Date.create('thursday').isTomorrow() -> ?
     *   Date.create('yesterday').isWednesday() -> ?
     *   Date.create('today').isWeekend() -> ?
     *
     ***
     * @method isFuture()
     * @returns Boolean
     * @short Returns true if the date is in the future.
     * @example
     *
     *   Date.create('next week').isFuture() -> true
     *   Date.create('last week').isFuture() -> false
     *
     ***
     * @method isPast()
     * @returns Boolean
     * @short Returns true if the date is in the past.
     * @example
     *
     *   Date.create('last week').isPast() -> true
     *   Date.create('next week').isPast() -> false
     *
     ***/
    function buildRelativeAliases() {
      var special  = 'today,yesterday,tomorrow,weekday,weekend,future,past'.split(',');
      var weekdays = English.weekdays.slice(0,7);
      var months   = English.months.slice(0,12);
      extendSimilar(Date, special.concat(weekdays).concat(months), function(methods, name) {
        methods['is'+ simpleCapitalize(name)] = function(utc) {
          return fullCompareDate(this, name, 0, utc);
        };
      });
    }

    function buildUTCAliases() {
      extend(Date, {
        'utc': {
          'create': function() {
            // Optimized: no leaking arguments
            var args = [], $i; for($i = 0; $i < arguments.length; $i++) args.push(arguments[$i]);
            return createDateFromArgs(null, args, 0, true);
          },

          'past': function() {
            // Optimized: no leaking arguments
            var args = [], $i; for($i = 0; $i < arguments.length; $i++) args.push(arguments[$i]);
            return createDateFromArgs(null, args, -1, true);
          },

          'future': function() {
            // Optimized: no leaking arguments
            var args = [], $i; for($i = 0; $i < arguments.length; $i++) args.push(arguments[$i]);
            return createDateFromArgs(null, args, 1, true);
          }
        }
      }, false);
    }

    function setDateProperties() {
      extend(Date, {
        'RFC1123': '{Dow}, {dd} {Mon} {yyyy} {HH}:{mm}:{ss} {tz}',
        'RFC1036': '{Weekday}, {dd}-{Mon}-{yy} {HH}:{mm}:{ss} {tz}',
        'ISO8601_DATE': '{yyyy}-{MM}-{dd}',
        'ISO8601_DATETIME': '{yyyy}-{MM}-{dd}T{HH}:{mm}:{ss}.{fff}{isotz}'
      }, false);
    }


    extend(Date, {

       /***
       * @method Date.create(<d>, [locale] = currentLocale)
       * @returns Date
       * @short Alternate Date constructor which understands many different text formats, a timestamp, or another date.
       * @extra If no argument is given, date is assumed to be now. %Date.create% additionally can accept enumerated parameters as with the standard date constructor. [locale] can be passed to specify the locale that the date is in. When unspecified, the current locale (default is English) is assumed. UTC-based dates can be created through the %utc% object. For more see %date_format%.
       * @set
       *   Date.utc.create
       *
       * @example
       *
       *   Date.create('July')          -> July of this year
       *   Date.create('1776')          -> 1776
       *   Date.create('today')         -> today
       *   Date.create('wednesday')     -> This wednesday
       *   Date.create('next friday')   -> Next friday
       *   Date.create('July 4, 1776')  -> July 4, 1776
       *   Date.create(-446806800000)   -> November 5, 1955
       *   Date.create(1776, 6, 4)      -> July 4, 1776
       *   Date.create('1776年07月04日', 'ja') -> July 4, 1776
       *   Date.utc.create('July 4, 1776', 'en')  -> July 4, 1776
       *
       ***/
      'create': function() {
        // Optimized: no leaking arguments
        var args = [], $i; for($i = 0; $i < arguments.length; $i++) args.push(arguments[$i]);
        return createDateFromArgs(null, args);
      },

       /***
       * @method Date.past(<d>, [locale] = currentLocale)
       * @returns Date
       * @short Alternate form of %Date.create% with any ambiguity assumed to be the past.
       * @extra For example %"Sunday"% can be either "the Sunday coming up" or "the Sunday last" depending on context. Note that dates explicitly in the future ("next Sunday") will remain in the future. This method simply provides a hint when ambiguity exists. UTC-based dates can be created through the %utc% object. For more, see %date_format%.
       * @set
       *   Date.utc.past
       *
       * @example
       *
       *   Date.past('July')          -> July of this year or last depending on the current month
       *   Date.past('Wednesday')     -> This wednesday or last depending on the current weekday
       *
       ***/
      'past': function() {
        // Optimized: no leaking arguments
        var args = [], $i; for($i = 0; $i < arguments.length; $i++) args.push(arguments[$i]);
        return createDateFromArgs(null, args, -1);
      },

       /***
       * @method Date.future(<d>, [locale] = currentLocale)
       * @returns Date
       * @short Alternate form of %Date.create% with any ambiguity assumed to be the future.
       * @extra For example %"Sunday"% can be either "the Sunday coming up" or "the Sunday last" depending on context. Note that dates explicitly in the past ("last Sunday") will remain in the past. This method simply provides a hint when ambiguity exists. UTC-based dates can be created through the %utc% object. For more, see %date_format%.
       * @set
       *   Date.utc.future
       *
       * @example
       *
       *   Date.future('July')          -> July of this year or next depending on the current month
       *   Date.future('Wednesday')     -> This wednesday or next depending on the current weekday
       *
       ***/
      'future': function() {
        // Optimized: no leaking arguments
        var args = [], $i; for($i = 0; $i < arguments.length; $i++) args.push(arguments[$i]);
        return createDateFromArgs(null, args, 1);
      },

       /***
       * @method Date.addLocale(<code>, <set>)
       * @returns Locale
       * @short Adds a locale <set> to the locales understood by Sugar.
       * @extra For more see %date_format%.
       *
       ***/
      'addLocale': function(localeCode, set) {
        return setLocalization(localeCode, set);
      },

       /***
       * @method Date.setLocale(<code>)
       * @returns Locale
       * @short Sets the current locale to be used with dates.
       * @extra Sugar has support for 13 locales that are available through the "Date Locales" package. In addition you can define a new locale with %Date.addLocale%. For more see %date_format%.
       *
       ***/
      'setLocale': function(localeCode, set) {
        var loc = getLocalization(localeCode, false);
        CurrentLocalization = loc;
        // The code is allowed to be more specific than the codes which are required:
        // i.e. zh-CN or en-US. Currently this only affects US date variants such as 8/10/2000.
        if (localeCode && localeCode !== loc.code) {
          loc.code = localeCode;
        }
        return loc;
      },

       /***
       * @method Date.getLocale([code] = current)
       * @returns Locale
       * @short Gets the locale for the given code, or the current locale.
       * @extra The resulting locale object can be manipulated to provide more control over date localizations. For more about locales, see %date_format%.
       *
       ***/
      'getLocale': function(localeCode) {
        return !localeCode ? CurrentLocalization : getLocalization(localeCode, false);
      },

       /**
       * @method Date.addFormat(<format>, <match>, [code] = null)
       * @returns Nothing
       * @short Manually adds a new date input format.
       * @extra This method allows fine grained control for alternate formats. <format> is a string that can have regex tokens inside. <match> is an array of the tokens that each regex capturing group will map to, for example %year%, %date%, etc. For more, see %date_format%.
       *
       **/
      'addFormat': function(format, match, localeCode) {
        addDateInputFormat(getLocalization(localeCode), format, match);
      }

    }, false);

    extend(Date, {

       /***
       * @method get(<d>, [locale] = currentLocale)
       * @returns Date
       * @short Gets a new date using the current one as a starting point.
       * @extra For most purposes, this method is identical to %Date.create%, except that if a relative format such as "next week" is passed, it will be relative to the instance rather than the current time.
       *
       * @example
       *
       *   new Date(2010, 0).get('next week') -> 1 week after 2010-01-01
       *   new Date(2004, 4).get('2 years before') -> 2 years before May, 2004
       *
       ***/
      'get': function(s) {
        // Optimized: no leaking arguments
        var args = [], $i; for($i = 0; $i < arguments.length; $i++) args.push(arguments[$i]);
        return createDateFromArgs(this, args);
      },

       /***
       * @method set(<set>, [reset] = false)
       * @returns Date
       * @short Sets the date object.
       * @extra This method can accept multiple formats including a single number as a timestamp, an object, or enumerated parameters (as with the Date constructor). If [reset] is %true%, any units more specific than those passed will be reset.
       *
       * @example
       *
       *   new Date().set({ year: 2011, month: 11, day: 31 }) -> December 31, 2011
       *   new Date().set(2011, 11, 31)                       -> December 31, 2011
       *   new Date().set(86400000)                           -> 1 day after Jan 1, 1970
       *   new Date().set({ year: 2004, month: 6 }, true)     -> June 1, 2004, 00:00:00.000
       *
       ***/
      'set': function() {
        // Optimized: no leaking arguments
        var args = [], $i; for($i = 0; $i < arguments.length; $i++) args.push(arguments[$i]);
        return setDate(this, args);
      },

       /***
       * @method setWeekday()
       * @returns Nothing
       * @short Sets the weekday of the date.
       * @extra In order to maintain a parallel with %getWeekday% (which itself is an alias for Javascript native %getDay%), Sunday is considered day %0%. This contrasts with ISO-8601 standard (used in %getISOWeek% and %setISOWeek%) which places Sunday at the end of the week (day 7). This effectively means that passing %0% to this method while in the middle of a week will rewind the date, where passing %7% will advance it.
       *
       * @example
       *
       *   d = new Date(); d.setWeekday(1); d; -> Monday of this week
       *   d = new Date(); d.setWeekday(6); d; -> Saturday of this week
       *
       ***/
      'setWeekday': function(dow) {
        return setWeekday(this, dow);
      },

       /***
       * @method setISOWeek(<num>)
       * @returns Nothing
       * @short Sets the week (of the year) as defined by the ISO-8601 standard.
       * @extra Note that this standard places Sunday at the end of the week (day 7).
       *
       * @example
       *
       *   d = new Date(); d.setISOWeek(15); d; -> 15th week of the year
       *
       ***/
      'setISOWeek': function(num) {
        return setWeekNumber(this, num);
      },

       /***
       * @method getISOWeek()
       * @returns Number
       * @short Gets the date's week (of the year) as defined by the ISO-8601 standard.
       * @extra Note that this standard places Sunday at the end of the week (day 7). If %utc% is set on the date, the week will be according to UTC time.
       *
       * @example
       *
       *   new Date().getISOWeek()    -> today's week of the year
       *
       ***/
      'getISOWeek': function() {
        return getWeekNumber(this);
      },

       /***
       * @method beginningOfISOWeek()
       * @returns Date
       * @short Set the date to the beginning of week as defined by this ISO-8601 standard.
       * @extra Note that this standard places Monday at the start of the week.
       * @example
       *
       *   Date.create().beginningOfISOWeek() -> Monday
       *
       ***/
      'beginningOfISOWeek': function() {
        var day = this.getDay();
        if (day === 0) {
          day = -6;
        } else if (day !== 1) {
          day = 1;
        }
        setWeekday(this, day);
        return resetDate(this);
      },

       /***
       * @method endOfISOWeek()
       * @returns Date
       * @short Set the date to the end of week as defined by this ISO-8601 standard.
       * @extra Note that this standard places Sunday at the end of the week.
       * @example
       *
       *   Date.create().endOfISOWeek() -> Sunday
       *
       ***/
      'endOfISOWeek': function() {
        if (this.getDay() !== 0) {
          setWeekday(this, 7);
        }
        return moveToEndOfUnit(this, 'day');
      },

       /***
       * @method getUTCOffset([iso])
       * @returns String
       * @short Returns a string representation of the offset from UTC time. If [iso] is true the offset will be in ISO8601 format.
       * @example
       *
       *   new Date().getUTCOffset()     -> "+0900"
       *   new Date().getUTCOffset(true) -> "+09:00"
       *
       ***/
      'getUTCOffset': function(iso) {
        return getUTCOffset(this, iso);
      },

       /***
       * @method utc([on] = true)
       * @returns Date
       * @short Sets the internal utc flag for the date. When on, UTC-based methods will be called internally.
       * @extra For more see %date_format%.
       * @example
       *
       *   new Date().utc(true)
       *   new Date().utc(false)
       *
       ***/
      'utc': function(set) {
        return setUTC(this, set !== false);
      },

       /***
       * @method isUTC()
       * @returns Boolean
       * @short Returns true if the date has no timezone offset.
       * @extra This will also return true for utc-based dates (dates that have the %utc% method set true). Note that even if the utc flag is set, %getTimezoneOffset% will always report the same thing as Javascript always reports that based on the environment's locale.
       * @example
       *
       *   new Date().isUTC()           -> true or false?
       *   new Date().utc(true).isUTC() -> true
       *
       ***/
      'isUTC': function() {
        return isUTC(this);
      },

       /***
       * @method advance(<set>, [reset] = false)
       * @returns Date
       * @short Sets the date forward.
       * @extra This method can accept multiple formats including an object, a string in the format %3 days%, a single number as milliseconds, or enumerated parameters (as with the Date constructor). If [reset] is %true%, any units more specific than those passed will be reset. For more see %date_format%.
       * @example
       *
       *   new Date().advance({ year: 2 }) -> 2 years in the future
       *   new Date().advance('2 days')    -> 2 days in the future
       *   new Date().advance(0, 2, 3)     -> 2 months 3 days in the future
       *   new Date().advance(86400000)    -> 1 day in the future
       *
       ***/
      'advance': function() {
        // Optimized: no leaking arguments
        var args = [], $i; for($i = 0; $i < arguments.length; $i++) args.push(arguments[$i]);
        return advanceDate(this, args);
      },

       /***
       * @method rewind(<set>, [reset] = false)
       * @returns Date
       * @short Sets the date back.
       * @extra This method can accept multiple formats including a single number as a timestamp, an object, or enumerated parameters (as with the Date constructor). If [reset] is %true%, any units more specific than those passed will be reset. For more see %date_format%.
       * @example
       *
       *   new Date().rewind({ year: 2 }) -> 2 years in the past
       *   new Date().rewind(0, 2, 3)     -> 2 months 3 days in the past
       *   new Date().rewind(86400000)    -> 1 day in the past
       *
       ***/
      'rewind': function() {
        // Optimized: no leaking arguments
        var args = [], $i; for($i = 0; $i < arguments.length; $i++) args.push(arguments[$i]);
        var a = collectDateArguments(args, true);
        return updateDate(this, a[0], a[1], -1);
      },

       /***
       * @method isValid()
       * @returns Boolean
       * @short Returns true if the date is valid.
       * @example
       *
       *   new Date().isValid()         -> true
       *   new Date('flexor').isValid() -> false
       *
       ***/
      'isValid': function() {
        return isValid(this);
      },

       /***
       * @method isAfter(<d>, [margin] = 0)
       * @returns Boolean
       * @short Returns true if the date is after the <d>.
       * @extra [margin] is to allow extra margin of error (in ms). <d> will accept a date object, timestamp, or text format. If not specified, <d> is assumed to be now. See %date_format% for more.
       * @example
       *
       *   new Date().isAfter('tomorrow')  -> false
       *   new Date().isAfter('yesterday') -> true
       *
       ***/
      'isAfter': function(d, margin, utc) {
        return this.getTime() > createDate(null, d).getTime() - (margin || 0);
      },

       /***
       * @method isBefore(<d>, [margin] = 0)
       * @returns Boolean
       * @short Returns true if the date is before <d>.
       * @extra [margin] is to allow extra margin of error (in ms). <d> will accept a date object, timestamp, or text format. If not specified, <d> is assumed to be now. See %date_format% for more.
       * @example
       *
       *   new Date().isBefore('tomorrow')  -> true
       *   new Date().isBefore('yesterday') -> false
       *
       ***/
      'isBefore': function(d, margin) {
        return this.getTime() < createDate(null, d).getTime() + (margin || 0);
      },

       /***
       * @method isBetween(<d1>, <d2>, [margin] = 0)
       * @returns Boolean
       * @short Returns true if the date is later or equal to <d1> and before or equal to <d2>.
       * @extra [margin] is to allow extra margin of error (in ms). <d1> and <d2> will accept a date object, timestamp, or text format. If not specified, they are assumed to be now. See %date_format% for more.
       * @example
       *
       *   new Date().isBetween('yesterday', 'tomorrow')    -> true
       *   new Date().isBetween('last year', '2 years ago') -> false
       *
       ***/
      'isBetween': function(d1, d2, margin) {
        var t  = this.getTime();
        var t1 = createDate(null, d1).getTime();
        var t2 = createDate(null, d2).getTime();
        var lo = min(t1, t2);
        var hi = max(t1, t2);
        margin = margin || 0;
        return (lo - margin <= t) && (hi + margin >= t);
      },

       /***
       * @method isLeapYear()
       * @returns Boolean
       * @short Returns true if the date is a leap year.
       * @example
       *
       *   Date.create('2000').isLeapYear() -> true
       *
       ***/
      'isLeapYear': function() {
        return isLeapYear(this);
      },

       /***
       * @method daysInMonth()
       * @returns Number
       * @short Returns the number of days in the date's month.
       * @example
       *
       *   Date.create('May').daysInMonth()            -> 31
       *   Date.create('February, 2000').daysInMonth() -> 29
       *
       ***/
      'daysInMonth': function() {
        return getDaysInMonth(this);
      },

       /***
       * @method format(<format>, [locale] = currentLocale)
       * @returns String
       * @short Formats and outputs the date.
       * @extra <format> can be a number of pre-determined formats or a string of tokens. Locale-specific formats are %short%, %long%, and %full% which have their own aliases and can be called with %date.short()%, etc. If <format> is not specified the %long% format is assumed. [locale] specifies a locale code to use (if not specified the current locale is used). See %date_format% for more details.
       *
       * @set
       *   short
       *   long
       *   full
       *
       * @example
       *
       *   Date.create().format()                                   -> ex. July 4, 2003
       *   Date.create().format('{Weekday} {d} {Month}, {yyyy}')    -> ex. Monday July 4, 2003
       *   Date.create().format('{hh}:{mm}')                        -> ex. 15:57
       *   Date.create().format('{12hr}:{mm}{tt}')                  -> ex. 3:57pm
       *   Date.create().format(Date.ISO8601_DATETIME)              -> ex. 2011-07-05 12:24:55.528Z
       *   Date.create('last week').format('short', 'ja')                -> ex. 先週
       *   Date.create('yesterday').format(function(value,unit,ms,loc) {
       *     // value = 1, unit = 3, ms = -86400000, loc = [current locale object]
       *   });                                                      -> ex. 1 day ago
       *
       ***/
      'format': function(f, localeCode) {
        return formatDate(this, f, false, localeCode);
      },

       /***
       * @method relative([fn], [locale] = currentLocale)
       * @returns String
       * @short Returns a relative date string offset to the current time.
       * @extra [fn] can be passed to provide for more granular control over the resulting string. [fn] is passed 4 arguments: the adjusted value, unit, offset in milliseconds, and a localization object. As an alternate syntax, [locale] can also be passed as the first (and only) parameter. For more, see %date_format%.
       * @example
       *
       *   Date.create('90 seconds ago').relative() -> 1 minute ago
       *   Date.create('January').relative()        -> ex. 5 months ago
       *   Date.create('January').relative('ja')    -> 3ヶ月前
       *   Date.create('120 minutes ago').relative(function(val,unit,ms,loc) {
       *     // value = 2, unit = 3, ms = -7200, loc = [current locale object]
       *   });                                      -> ex. 5 months ago
       *
       ***/
      'relative': function(fn, localeCode) {
        if (isString(fn)) {
          localeCode = fn;
          fn = null;
        }
        return formatDate(this, fn, true, localeCode);
      },

       /***
       * @method is(<f>, [margin] = 0, [utc] = false)
       * @returns Boolean
       * @short Returns true if the date is <f>.
       * @extra <f> will accept a date object, timestamp, or text format. %is% additionally understands more generalized expressions like month/weekday names, 'today', etc, and compares to the precision implied in <f>. [margin] allows an extra margin of error in milliseconds. [utc] will treat the compared date as UTC. For more, see %date_format%.
       * @example
       *
       *   Date.create().is('July')               -> true or false?
       *   Date.create().is('1776')               -> false
       *   Date.create().is('today')              -> true
       *   Date.create().is('weekday')            -> true or false?
       *   Date.create().is('July 4, 1776')       -> false
       *   Date.create().is(-6106093200000)       -> false
       *   Date.create().is(new Date(1776, 6, 4)) -> false
       *
       ***/
      'is': function(f, margin, utc) {
        return fullCompareDate(this, f, margin, utc);
      },

       /***
       * @method reset([unit] = 'hours')
       * @returns Date
       * @short Resets the unit passed and all smaller units. Default is "hours", effectively resetting the time.
       * @example
       *
       *   Date.create().reset('day')   -> Beginning of today
       *   Date.create().reset('month') -> 1st of the month
       *
       ***/
      'reset': function(unit) {
        return resetDate(this, unit);
      },

       /***
       * @method clone()
       * @returns Date
       * @short Clones the date.
       * @example
       *
       *   Date.create().clone() -> Copy of now
       *
       ***/
      'clone': function() {
        return cloneDate(this);
      },

       /***
       * @method iso()
       * @alias toISOString
       *
       ***/
      'iso': function() {
        return this.toISOString();
      },

       /***
       * @method getWeekday()
       * @returns Number
       * @short Alias for %getDay%.
       * @set
       *   getUTCWeekday
       *
       * @example
       *
       +   Date.create().getWeekday();    -> (ex.) 3
       +   Date.create().getUTCWeekday();    -> (ex.) 3
       *
       ***/
      'getWeekday': function() {
        return this.getDay();
      },

      'getUTCWeekday': function() {
        return this.getUTCDay();
      }

    });


    /***
     * @namespace Number
     *
     ***/

    /***
     * @method [unit]()
     * @returns Number
     * @short Takes the number as a corresponding unit of time and converts to milliseconds.
     * @extra Method names can be singular or plural.  Note that as "a month" is ambiguous as a unit of time, %months% will be equivalent to 30.4375 days, the average number in a month. Be careful using %months% if you need exact precision.
     *
     * @set
     *   millisecond
     *   milliseconds
     *   second
     *   seconds
     *   minute
     *   minutes
     *   hour
     *   hours
     *   day
     *   days
     *   week
     *   weeks
     *   month
     *   months
     *   year
     *   years
     *
     * @example
     *
     *   (5).milliseconds() -> 5
     *   (10).hours()       -> 36000000
     *   (1).day()          -> 86400000
     *
     ***
     * @method [unit]Before([d], [locale] = currentLocale)
     * @returns Date
     * @short Returns a date that is <n> units before [d], where <n> is the number.
     * @extra [d] will accept a date object, timestamp, or text format. Note that "months" is ambiguous as a unit of time. If the target date falls on a day that does not exist (ie. August 31 -> February 31), the date will be shifted to the last day of the month. Be careful using %monthsBefore% if you need exact precision. See %date_format% for more.
     *
     * @set
     *   millisecondBefore
     *   millisecondsBefore
     *   secondBefore
     *   secondsBefore
     *   minuteBefore
     *   minutesBefore
     *   hourBefore
     *   hoursBefore
     *   dayBefore
     *   daysBefore
     *   weekBefore
     *   weeksBefore
     *   monthBefore
     *   monthsBefore
     *   yearBefore
     *   yearsBefore
     *
     * @example
     *
     *   (5).daysBefore('tuesday')          -> 5 days before tuesday of this week
     *   (1).yearBefore('January 23, 1997') -> January 23, 1996
     *
     ***
     * @method [unit]Ago()
     * @returns Date
     * @short Returns a date that is <n> units ago.
     * @extra Note that "months" is ambiguous as a unit of time. If the target date falls on a day that does not exist (ie. August 31 -> February 31), the date will be shifted to the last day of the month. Be careful using %monthsAgo% if you need exact precision.
     *
     * @set
     *   millisecondAgo
     *   millisecondsAgo
     *   secondAgo
     *   secondsAgo
     *   minuteAgo
     *   minutesAgo
     *   hourAgo
     *   hoursAgo
     *   dayAgo
     *   daysAgo
     *   weekAgo
     *   weeksAgo
     *   monthAgo
     *   monthsAgo
     *   yearAgo
     *   yearsAgo
     *
     * @example
     *
     *   (5).weeksAgo() -> 5 weeks ago
     *   (1).yearAgo()  -> January 23, 1996
     *
     ***
     * @method [unit]After([d], [locale] = currentLocale)
     * @returns Date
     * @short Returns a date <n> units after [d], where <n> is the number.
     * @extra [d] will accept a date object, timestamp, or text format. Note that "months" is ambiguous as a unit of time. If the target date falls on a day that does not exist (ie. August 31 -> February 31), the date will be shifted to the last day of the month. Be careful using %monthsAfter% if you need exact precision. See %date_format% for more.
     *
     * @set
     *   millisecondAfter
     *   millisecondsAfter
     *   secondAfter
     *   secondsAfter
     *   minuteAfter
     *   minutesAfter
     *   hourAfter
     *   hoursAfter
     *   dayAfter
     *   daysAfter
     *   weekAfter
     *   weeksAfter
     *   monthAfter
     *   monthsAfter
     *   yearAfter
     *   yearsAfter
     *
     * @example
     *
     *   (5).daysAfter('tuesday')          -> 5 days after tuesday of this week
     *   (1).yearAfter('January 23, 1997') -> January 23, 1998
     *
     ***
     * @method [unit]FromNow()
     * @returns Date
     * @short Returns a date <n> units from now.
     * @extra Note that "months" is ambiguous as a unit of time. If the target date falls on a day that does not exist (ie. August 31 -> February 31), the date will be shifted to the last day of the month. Be careful using %monthsFromNow% if you need exact precision.
     *
     * @set
     *   millisecondFromNow
     *   millisecondsFromNow
     *   secondFromNow
     *   secondsFromNow
     *   minuteFromNow
     *   minutesFromNow
     *   hourFromNow
     *   hoursFromNow
     *   dayFromNow
     *   daysFromNow
     *   weekFromNow
     *   weeksFromNow
     *   monthFromNow
     *   monthsFromNow
     *   yearFromNow
     *   yearsFromNow
     *
     * @example
     *
     *   (5).weeksFromNow() -> 5 weeks ago
     *   (1).yearFromNow()  -> January 23, 1998
     *
     ***/
    function buildNumberToDateAlias(u, multiplier) {
      var name = u.name, methods = {};
      function base() {
        return round(this * multiplier);
      }
      function after() {
        // Optimized: no leaking arguments
        var args = [], $i; for($i = 0; $i < arguments.length; $i++) args.push(arguments[$i]);
        return createDateFromArgs(null, args)[u.addMethod](this);
      }
      function before() {
        // Optimized: no leaking arguments
        var args = [], $i; for($i = 0; $i < arguments.length; $i++) args.push(arguments[$i]);
        return createDateFromArgs(null, args)[u.addMethod](-this);
      }
      methods[name] = base;
      methods[name + 's'] = base;
      methods[name + 'Before'] = before;
      methods[name + 'sBefore'] = before;
      methods[name + 'Ago'] = before;
      methods[name + 'sAgo'] = before;
      methods[name + 'After'] = after;
      methods[name + 'sAfter'] = after;
      methods[name + 'FromNow'] = after;
      methods[name + 'sFromNow'] = after;
      extend(Number, methods);
    }

    extend(Number, {

       /***
       * @method duration([locale] = currentLocale)
       * @returns String
       * @short Takes the number as milliseconds and returns a unit-adjusted localized string.
       * @extra This method is the same as %Date#relative% without the localized equivalent of "from now" or "ago". [locale] can be passed as the first (and only) parameter. Note that this method is only available when the dates package is included.
       * @example
       *
       *   (500).duration() -> '500 milliseconds'
       *   (1200).duration() -> '1 second'
       *   (75).minutes().duration() -> '1 hour'
       *   (75).minutes().duration('es') -> '1 hora'
       *
       ***/
      'duration': function(localeCode) {
        return getLocalization(localeCode).getDuration(this);
      }

    });

    English = CurrentLocalization = Date.addLocale('en', {
      'plural':     true,
      'timeMarker': 'at',
      'ampm':       'am,pm',
      'months':     'January,February,March,April,May,June,July,August,September,October,November,December',
      'weekdays':   'Sunday,Monday,Tuesday,Wednesday,Thursday,Friday,Saturday',
      'units':      'millisecond:|s,second:|s,minute:|s,hour:|s,day:|s,week:|s,month:|s,year:|s',
      'numbers':    'one,two,three,four,five,six,seven,eight,nine,ten',
      'articles':   'a,an,the',
      'tokens':     'the,st|nd|rd|th,of',
      'short':      '{Month} {d}, {yyyy}',
      'long':       '{Month} {d}, {yyyy} {h}:{mm}{tt}',
      'full':       '{Weekday} {Month} {d}, {yyyy} {h}:{mm}:{ss}{tt}',
      'past':       '{num} {unit} {sign}',
      'future':     '{num} {unit} {sign}',
      'duration':   '{num} {unit}',
      'modifiers': [
        { 'name': 'sign',  'src': 'ago|before', 'value': -1 },
        { 'name': 'sign',  'src': 'from now|after|from|in|later', 'value': 1 },
        { 'name': 'edge',  'src': 'last day', 'value': -2 },
        { 'name': 'edge',  'src': 'end', 'value': -1 },
        { 'name': 'edge',  'src': 'first day|beginning', 'value': 1 },
        { 'name': 'shift', 'src': 'last', 'value': -1 },
        { 'name': 'shift', 'src': 'the|this', 'value': 0 },
        { 'name': 'shift', 'src': 'next', 'value': 1 }
      ],
      'dateParse': [
        '{month} {year}',
        '{shift} {unit=5-7}',
        '{0?} {date}{1}',
        '{0?} {edge} of {shift?} {unit=4-7?} {month?} {year?}'
      ],
      'timeParse': [
        '{num} {unit} {sign}',
        '{sign} {num} {unit}',
        '{0} {num}{1} {day} of {month} {year?}',
        '{weekday?} {month} {date}{1?} {year?}',
        '{date} {month} {year}',
        '{date} {month}',
        '{shift} {weekday}',
        '{shift} week {weekday}',
        '{weekday} {2?} {shift} week',
        '{num} {unit=4-5} {sign} {day}',
        '{0?} {date}{1} of {month}',
        '{0?}{month?} {date?}{1?} of {shift} {unit=6-7}',
        '{edge} of {day}'
      ]
    });

    buildDateUnits();
    buildDateMethods();
    buildCoreInputFormats();
    buildFormatTokens();
    buildFormatShortcuts();
    buildAsianDigits();
    buildRelativeAliases();
    buildUTCAliases();
    setDateProperties();

    /***
     * @module Function
     * @dependency core
     * @description Lazy, throttled, and memoized functions, delayed functions and handling of timers, argument currying.
     *
     ***/

    function setDelay(fn, ms, after, scope, args) {
      // Delay of infinity is never called of course...
      ms = coercePositiveInteger(ms || 0);
      if (!fn.timers) fn.timers = [];
      // This is a workaround for <= IE8, which apparently has the
      // ability to call timeouts in the queue on the same tick (ms?)
      // even if functionally they have already been cleared.
      fn._canceled = false;
      fn.timers.push(setTimeout(function() {
        if (!fn._canceled) {
          after.apply(scope, args || []);
        }
      }, ms));
    }

    function cancelFunction(fn) {
      var timers = fn.timers, timer;
      if (isArray(timers)) {
        while(timer = timers.shift()) {
          clearTimeout(timer);
        }
      }
      fn._canceled = true;
      return fn;
    }

    function createLazyFunction(fn, ms, immediate, limit) {
      var queue = [], locked = false, execute, rounded, perExecution, result;
      ms = ms || 1;
      limit = limit || Infinity;
      rounded = ceil(ms);
      perExecution = round(rounded / ms) || 1;
      execute = function() {
        var queueLength = queue.length, maxPerRound;
        if (queueLength == 0) return;
        // Allow fractions of a millisecond by calling
        // multiple times per actual timeout execution
        maxPerRound = max(queueLength - perExecution, 0);
        while(queueLength > maxPerRound) {
          // Getting uber-meta here...
          result = Function.prototype.apply.apply(fn, queue.shift());
          queueLength--;
        }
        setDelay(lazy, rounded, function() {
          locked = false;
          execute();
        });
      }
      function lazy() {
        // If the execution has locked and it's immediate, then
        // allow 1 less in the queue as 1 call has already taken place.
        if (queue.length < limit - (locked && immediate ? 1 : 0)) {
          // Optimized: no leaking arguments
          var args = [], $i; for($i = 0; $i < arguments.length; $i++) args.push(arguments[$i]);
          queue.push([this, args]);
        }
        if (!locked) {
          locked = true;
          if (immediate) {
            execute();
          } else {
            setDelay(lazy, rounded, execute);
          }
        }
        // Return the memoized result
        return result;
      }
      return lazy;
    }

    function stringifyArguments() {
      var str = '';
      for (var i = 0; i < arguments.length; i++) {
        str += stringify(arguments[i]);
      }
      return str;
    }

    function createMemoizedFunction(fn, hashFn) {
      var cache = {};
      if (!hashFn) {
        hashFn = stringifyArguments;
      }
      return function memoized() {
        var key = hashFn.apply(this, arguments);
        if (hasOwnProperty(cache, key)) {
          return cache[key];
        }
        return cache[key] = fn.apply(this, arguments);
      }
    }

    extend(Function, {

       /***
       * @method lazy([ms] = 1, [immediate] = false, [limit] = Infinity)
       * @returns Function
       * @short Creates a lazy function that, when called repeatedly, will queue execution and wait [ms] milliseconds to execute.
       * @extra If [immediate] is %true%, first execution will happen immediately, then lock. If [limit] is a fininte number, calls past [limit] will be ignored while execution is locked. Compare this to %throttle%, which will execute only once per [ms] milliseconds. Note that [ms] can also be a fraction. Calling %cancel% on a lazy function will clear the entire queue. For more see %functions%.
       * @example
       *
       *   (function() {
       *     // Executes immediately.
       *   }).lazy()();
       *   (3).times(function() {
       *     // Executes 3 times, with each execution 20ms later than the last.
       *   }.lazy(20));
       *   (100).times(function() {
       *     // Executes 50 times, with each execution 20ms later than the last.
       *   }.lazy(20, false, 50));
       *
       ***/
      'lazy': function(ms, immediate, limit) {
        return createLazyFunction(this, ms, immediate, limit);
      },

       /***
       * @method throttle([ms] = 1)
       * @returns Function
       * @short Creates a "throttled" version of the function that will only be executed once per <ms> milliseconds.
       * @extra This is functionally equivalent to calling %lazy% with a [limit] of %1% and [immediate] as %true%. %throttle% is appropriate when you want to make sure a function is only executed at most once for a given duration. For more see %functions%.
       * @example
       *
       *   (3).times(function() {
       *     // called only once. will wait 50ms until it responds again
       *   }.throttle(50));
       *
       ***/
      'throttle': function(ms) {
        return createLazyFunction(this, ms, true, 1);
      },

       /***
       * @method debounce([ms] = 1)
       * @returns Function
       * @short Creates a "debounced" function that postpones its execution until after <ms> milliseconds have passed.
       * @extra This method is useful to execute a function after things have "settled down". A good example of this is when a user tabs quickly through form fields, execution of a heavy operation should happen after a few milliseconds when they have "settled" on a field. For more see %functions%.
       * @example
       *
       *   var fn = (function(arg1) {
       *     // called once 50ms later
       *   }).debounce(50); fn(); fn(); fn();
       *
       ***/
      'debounce': function(ms) {
        var fn = this;
        function debounced() {
          // Optimized: no leaking arguments
          var args = [], $i; for($i = 0; $i < arguments.length; $i++) args.push(arguments[$i]);
          cancelFunction(debounced);
          setDelay(debounced, ms, fn, this, args);
        };
        return debounced;
      },

       /***
       * @method delay([ms] = 1, [arg1], ...)
       * @returns Function
       * @short Executes the function after <ms> milliseconds.
       * @extra Returns a reference to itself. %delay% is also a way to execute non-blocking operations that will wait until the CPU is free. Delayed functions can be canceled using the %cancel% method. Can also curry arguments passed in after <ms>.
       * @example
       *
       *   (function(arg1) {
       *     // called 1s later
       *   }).delay(1000, 'arg1');
       *
       ***/
      'delay': function(ms) {
        var fn = this;
        // Optimized: no leaking arguments
        var args = [], $i; for($i = 1; $i < arguments.length; $i++) args.push(arguments[$i]);
        setDelay(fn, ms, fn, fn, args);
        return fn;
      },

       /***
       * @method every([ms] = 1, [arg1], ...)
       * @returns Function
       * @short Executes the function every <ms> milliseconds.
       * @extra Returns a reference to itself. %every% uses %setTimeout%, which means that you are guaranteed a period of idle time equal to [ms] after execution has finished. Compare this to %setInterval% which will try to run a function every [ms], even when execution itself takes up a portion of that time. In most cases avoiding %setInterval% is better as calls won't "back up" when the CPU is under strain, however this also means that calls are less likely to happen at exact intervals of [ms], so the use case here should be considered. Additionally, %every% can curry arguments passed in after [ms], and also be canceled with %cancel%.
       * @example
       *
       *   (function(arg1) {
       *     // called every 1s
       *   }).every(1000, 'arg1');
       *
       ***/
      'every': function(ms) {
        // Optimized: no leaking arguments
        var args = [], $i; for($i = 1; $i < arguments.length; $i++) args.push(arguments[$i]);
        var fn = this;
        function execute () {
          // Set the delay first here, so that cancel
          // can be called within the executing function.
          setDelay(fn, ms, execute);
          fn.apply(fn, args);
        }
        setDelay(fn, ms, execute);
        return fn;
      },

       /***
       * @method cancel()
       * @returns Function
       * @short Cancels a delayed function scheduled to be run.
       * @extra %delay%, %lazy%, %throttle%, and %debounce% can all set delays.
       * @example
       *
       *   (function() {
       *     alert('hay'); -> Never called
       *   }).delay(500).cancel();
       *
       ***/
      'cancel': function() {
        return cancelFunction(this);
      },

       /***
       * @method after(<num>, [mult] = true)
       * @returns Function
       * @short Creates a function that will execute after [num] calls.
       * @extra %after% is useful for running a final callback after a series of asynchronous operations, when the order in which the operations will complete is unknown. If [mult] is %true%, the function will continue to fire multiple times. The created function will be passed an array of the arguments that it has collected from each call so far.
       * @example
       *
       *   var fn = (function() {
       *     // Will be executed once only
       *   }).after(3); fn(); fn(); fn();
       *
       ***/
      'after': function(num) {
        var fn = this, count = 0, collectedArgs = [];
        num = coercePositiveInteger(num);
        return function() {
          // Optimized: no leaking arguments
          var args = []; for(var $i = 0, $len = arguments.length; $i < $len; $i++) args.push(arguments[$i]);
          collectedArgs.push(args);
          count++;
          if (count >= num) {
            return fn.call(this, collectedArgs);
          }
        }
      },

       /***
       * @method once()
       * @returns Function
       * @short Creates a function that will execute only once and store the result.
       * @extra %once% is useful for creating functions that will cache the result of an expensive operation and use it on subsequent calls. Also it can be useful for creating initialization functions that only need to be run once.
       * @example
       *
       *   var fn = (function() {
       *     // Will be executed once only
       *   }).once(); fn(); fn(); fn();
       *
       ***/
      'once': function() {
        // noop always returns "undefined" as the cache key.
        return createMemoizedFunction(this, function() {});
      },

       /***
       * @method memoize([fn])
       * @returns Function
       * @short Creates a function that will cache results for unique calls.
       * @extra %memoize% can be thought of as a more power %once%. Where %once% will only call a function once ever, memoized functions will be called once per unique call. A "unique call" is determined by the result of [fn], which is a hashing function. If empty, [fn] will stringify all arguments, such that any different argument signature will result in a unique call. This includes objects passed as arguments, which will be deep inspected to produce the cache key.
       * @example
       *
       *   var fn = (function() {
       *     // Will be executed twice, returning the memoized
       *     // result of the first call again on the last.
       *   }).memoize(); fn(1); fn(2); fn(1);
       *
       ***/
      'memoize': function(fn) {
        return createMemoizedFunction(this, fn);
      },

       /***
       * @method fill(<arg1>, <arg2>, ...)
       * @returns Function
       * @short Returns a new version of the function which when called will have some of its arguments pre-emptively filled in, also known as "currying".
       * @extra Arguments passed to a "filled" function are generally appended to the curried arguments. However, if %undefined% is passed as any of the arguments to %fill%, it will be replaced, when the "filled" function is executed. This allows currying of arguments even when they occur toward the end of an argument list (the example demonstrates this much more clearly).
       * @example
       *
       *   var delayOneSecond = setTimeout.fill(undefined, 1000);
       *   delayOneSecond(function() {
       *     // Will be executed 1s later
       *   });
       *
       ***/
      'fill': function() {
        // Optimized: no leaking arguments
        var curried = [], $i; for($i = 0; $i < arguments.length; $i++) curried.push(arguments[$i]);
        var fn = this;
        return function() {
          var argIndex = 0, result = [];
          for (var i = 0; i < curried.length; i++) {
            if (curried[i] != null) {
              result[i] = curried[i];
            } else {
              result[i] = arguments[i];
              argIndex++;
            }
          }
          for (var i = argIndex; i < arguments.length; i++) {
            result.push(arguments[i]);
          }
          return fn.apply(this, result);
        }
      }


    });

    /***
     * @module Inflections
     * @dependency string
     * @description Pluralization similar to ActiveSupport including uncountable words and acronyms. Humanized and URL-friendly strings.
     *
     ***/

    /***
     * @namespace String
     *
     ***/


    var plurals      = [],
        singulars    = [],
        uncountables = [],
        humans       = [],
        acronyms     = {},
        Downcased,
        Inflector,
        NormalizeMap = {},
        NormalizeReg,
        NormalizeSource;

    function removeFromArray(arr, find) {
      var index = arr.indexOf(find);
      if (index > -1) {
        arr.splice(index, 1);
      }
    }

    function removeFromUncountablesAndAddTo(arr, rule, replacement) {
      if (isString(rule)) {
        removeFromArray(uncountables, rule);
      }
      removeFromArray(uncountables, replacement);
      arr.unshift({ rule: rule, replacement: replacement })
    }

    function paramMatchesType(param, type) {
      return param == type || param == 'all' || !param;
    }

    function isUncountable(word) {
      return uncountables.some(function(uncountable) {
        return new RegExp('\\b' + uncountable + '$', 'i').test(word);
      });
    }

    function inflect(word, pluralize) {
      word = isString(word) ? word.toString() : '';
      if (isBlank(word) || isUncountable(word)) {
        return word;
      } else {
        return runReplacements(word, pluralize ? plurals : singulars);
      }
    }

    function runReplacements(word, table) {
      iterateOverObject(table, function(i, inflection) {
        if (word.match(inflection.rule)) {
          word = word.replace(inflection.rule, inflection.replacement);
          return false;
        }
      });
      return word;
    }

    function capitalizeWithoutDowncasing(word) {
      return word.replace(/^\W*[a-z]/, function(w){
        return w.toUpperCase();
      });
    }

    function humanize(str) {
      var str = runReplacements(str, humans), acronym;
      str = str.replace(/_id$/g, '');
      str = str.replace(/(_)?([a-z\d]*)/gi, function(match, _, word){
        var lower = word.toLowerCase();
        acronym = hasOwnProperty(acronyms, lower) ? acronyms[lower] : null;
        return (_ ? ' ' : '') + (acronym || lower);
      });
      return capitalizeWithoutDowncasing(str);
    }

    function toAscii(str) {
      return str.replace(NormalizeReg, function(character) {
        return NormalizeMap[character];
      });
    }

    function buildNormalizeMap() {
      var normalized, str, all = '';
      for(normalized in NormalizeSource) {
        if (!NormalizeSource.hasOwnProperty(normalized)) continue;
        str = NormalizeSource[normalized];
        str.split('').forEach(function(character) {
          NormalizeMap[character] = normalized;
        });
        all += str;
      }
      NormalizeReg = RegExp('[' + all + ']', 'g');
    }


    Inflector = {

      /*
       * Specifies a new acronym. An acronym must be specified as it will appear in a camelized string.  An underscore
       * string that contains the acronym will retain the acronym when passed to %camelize%, %humanize%, or %titleize%.
       * A camelized string that contains the acronym will maintain the acronym when titleized or humanized, and will
       * convert the acronym into a non-delimited single lowercase word when passed to String#underscore.
       *
       * Examples:
       *   String.Inflector.acronym('HTML')
       *   'html'.titleize()     -> 'HTML'
       *   'html'.camelize()     -> 'HTML'
       *   'MyHTML'.underscore() -> 'my_html'
       *
       * The acronym, however, must occur as a delimited unit and not be part of another word for conversions to recognize it:
       *
       *   String.Inflector.acronym('HTTP')
       *   'my_http_delimited'.camelize() -> 'MyHTTPDelimited'
       *   'https'.camelize()             -> 'Https', not 'HTTPs'
       *   'HTTPS'.underscore()           -> 'http_s', not 'https'
       *
       *   String.Inflector.acronym('HTTPS')
       *   'https'.camelize()   -> 'HTTPS'
       *   'HTTPS'.underscore() -> 'https'
       *
       * Note: Acronyms that are passed to %pluralize% will no longer be recognized, since the acronym will not occur as
       * a delimited unit in the pluralized result. To work around this, you must specify the pluralized form as an
       * acronym as well:
       *
       *    String.Inflector.acronym('API')
       *    'api'.pluralize().camelize() -> 'Apis'
       *
       *    String.Inflector.acronym('APIs')
       *    'api'.pluralize().camelize() -> 'APIs'
       *
       * %acronym% may be used to specify any word that contains an acronym or otherwise needs to maintain a non-standard
       * capitalization. The only restriction is that the word must begin with a capital letter.
       *
       * Examples:
       *   String.Inflector.acronym('RESTful')
       *   'RESTful'.underscore()           -> 'restful'
       *   'RESTfulController'.underscore() -> 'restful_controller'
       *   'RESTfulController'.titleize()   -> 'RESTful Controller'
       *   'restful'.camelize()             -> 'RESTful'
       *   'restful_controller'.camelize()  -> 'RESTfulController'
       *
       *   String.Inflector.acronym('McDonald')
       *   'McDonald'.underscore() -> 'mcdonald'
       *   'mcdonald'.camelize()   -> 'McDonald'
       */
      'acronym': function(word) {
        acronyms[word.toLowerCase()] = word;
        var all = Object.keys(acronyms).map(function(key) {
          return acronyms[key];
        });
        Inflector.acronymRegExp = RegExp(all.join('|'), 'g');
      },

      /*
       * Specifies a new pluralization rule and its replacement. The rule can either be a string or a regular expression.
       * The replacement should always be a string that may include references to the matched data from the rule.
       */
      'plural': function(rule, replacement) {
        removeFromUncountablesAndAddTo(plurals, rule, replacement);
      },

      /*
       * Specifies a new singularization rule and its replacement. The rule can either be a string or a regular expression.
       * The replacement should always be a string that may include references to the matched data from the rule.
       */
      'singular': function(rule, replacement) {
        removeFromUncountablesAndAddTo(singulars, rule, replacement);
      },

      /*
       * Specifies a new irregular that applies to both pluralization and singularization at the same time. This can only be used
       * for strings, not regular expressions. You simply pass the irregular in singular and plural form.
       *
       * Examples:
       *   String.Inflector.irregular('octopus', 'octopi')
       *   String.Inflector.irregular('person', 'people')
       */
      'irregular': function(singular, plural) {
        var singularFirst      = stringFirst(singular),
            singularRest       = stringFrom(singular, 1),
            pluralFirst        = stringFirst(plural),
            pluralRest         = stringFrom(plural, 1),
            pluralFirstUpper   = pluralFirst.toUpperCase(),
            pluralFirstLower   = pluralFirst.toLowerCase(),
            singularFirstUpper = singularFirst.toUpperCase(),
            singularFirstLower = singularFirst.toLowerCase();
        removeFromArray(uncountables, singular);
        removeFromArray(uncountables, plural);
        if (singularFirstUpper == pluralFirstUpper) {
          Inflector.plural(new RegExp(stringAssign('({1}){2}$', [singularFirst, singularRest]), 'i'), '$1' + pluralRest);
          Inflector.plural(new RegExp(stringAssign('({1}){2}$', [pluralFirst, pluralRest]), 'i'), '$1' + pluralRest);
          Inflector.singular(new RegExp(stringAssign('({1}){2}$', [pluralFirst, pluralRest]), 'i'), '$1' + singularRest);
        } else {
          Inflector.plural(new RegExp(stringAssign('{1}{2}$', [singularFirstUpper, singularRest])), pluralFirstUpper + pluralRest);
          Inflector.plural(new RegExp(stringAssign('{1}{2}$', [singularFirstLower, singularRest])), pluralFirstLower + pluralRest);
          Inflector.plural(new RegExp(stringAssign('{1}{2}$', [pluralFirstUpper, pluralRest])), pluralFirstUpper + pluralRest);
          Inflector.plural(new RegExp(stringAssign('{1}{2}$', [pluralFirstLower, pluralRest])), pluralFirstLower + pluralRest);
          Inflector.singular(new RegExp(stringAssign('{1}{2}$', [pluralFirstUpper, pluralRest])), singularFirstUpper + singularRest);
          Inflector.singular(new RegExp(stringAssign('{1}{2}$', [pluralFirstLower, pluralRest])), singularFirstLower + singularRest);
        }
      },

      /*
       * Add uncountable words that shouldn't be attempted inflected.
       *
       * Examples:
       *   String.Inflector.uncountable('money')
       *   String.Inflector.uncountable('money', 'information')
       *   String.Inflector.uncountable(['money', 'information', 'rice'])
       */
      'uncountable': function(first) {
        var add;
        if (Array.isArray(first)) {
          add = first;
        } else {
          // Optimized: no leaking arguments
          var args = [], $i; for($i = 0; $i < arguments.length; $i++) args.push(arguments[$i]);
          add = args;
        }
        uncountables = uncountables.concat(add);
      },

      /*
       * Specifies a humanized form of a string by a regular expression rule or by a string mapping.
       * When using a regular expression based replacement, the normal humanize formatting is called after the replacement.
       * When a string is used, the human form should be specified as desired (example: 'The name', not 'the_name')
       *
       * Examples:
       *   String.Inflector.human(/_cnt$/i, '_count')
       *   String.Inflector.human('legacy_col_person_name', 'Name')
       */
      'human': function(rule, replacement) {
        humans.unshift({ rule: rule, replacement: replacement })
      },


      /*
       * Clears the loaded inflections within a given scope (default is 'all').
       * Options are: 'all', 'plurals', 'singulars', 'uncountables', 'humans'.
       *
       * Examples:
       *   String.Inflector.clear('all')
       *   String.Inflector.clear('plurals')
       */
      'clear': function(type) {
        if (paramMatchesType(type, 'singulars'))    singulars    = [];
        if (paramMatchesType(type, 'plurals'))      plurals      = [];
        if (paramMatchesType(type, 'uncountables')) uncountables = [];
        if (paramMatchesType(type, 'humans'))       humans       = [];
        if (paramMatchesType(type, 'acronyms'))     acronyms     = {};
      }

    };

    Downcased = [
      'and', 'or', 'nor', 'a', 'an', 'the', 'so', 'but', 'to', 'of', 'at',
      'by', 'from', 'into', 'on', 'onto', 'off', 'out', 'in', 'over',
      'with', 'for'
    ];

    Inflector.plural(/$/, 's');
    Inflector.plural(/s$/gi, 's');
    Inflector.plural(/(ax|test)is$/gi, '$1es');
    Inflector.plural(/(octop|fung|foc|radi|alumn|cact)(i|us)$/gi, '$1i');
    Inflector.plural(/(census|alias|status|fetus|genius|virus)$/gi, '$1es');
    Inflector.plural(/(bu)s$/gi, '$1ses');
    Inflector.plural(/(buffal|tomat)o$/gi, '$1oes');
    Inflector.plural(/([ti])um$/gi, '$1a');
    Inflector.plural(/([ti])a$/gi, '$1a');
    Inflector.plural(/sis$/gi, 'ses');
    Inflector.plural(/f+e?$/gi, 'ves');
    Inflector.plural(/(cuff|roof)$/gi, '$1s');
    Inflector.plural(/([ht]ive)$/gi, '$1s');
    Inflector.plural(/([^aeiouy]o)$/gi, '$1es');
    Inflector.plural(/([^aeiouy]|qu)y$/gi, '$1ies');
    Inflector.plural(/(x|ch|ss|sh)$/gi, '$1es');
    Inflector.plural(/(tr|vert)(?:ix|ex)$/gi, '$1ices');
    Inflector.plural(/([ml])ouse$/gi, '$1ice');
    Inflector.plural(/([ml])ice$/gi, '$1ice');
    Inflector.plural(/^(ox)$/gi, '$1en');
    Inflector.plural(/^(oxen)$/gi, '$1');
    Inflector.plural(/(quiz)$/gi, '$1zes');
    Inflector.plural(/(phot|cant|hom|zer|pian|portic|pr|quart|kimon)o$/gi, '$1os');
    Inflector.plural(/(craft)$/gi, '$1');
    Inflector.plural(/([ft])[eo]{2}(th?)$/gi, '$1ee$2');

    Inflector.singular(/s$/gi, '');
    Inflector.singular(/([pst][aiu]s)$/gi, '$1');
    Inflector.singular(/([aeiouy])ss$/gi, '$1ss');
    Inflector.singular(/(n)ews$/gi, '$1ews');
    Inflector.singular(/([ti])a$/gi, '$1um');
    Inflector.singular(/((a)naly|(b)a|(d)iagno|(p)arenthe|(p)rogno|(s)ynop|(t)he)ses$/gi, '$1$2sis');
    Inflector.singular(/(^analy)ses$/gi, '$1sis');
    Inflector.singular(/(i)(f|ves)$/i, '$1fe');
    Inflector.singular(/([aeolr]f?)(f|ves)$/i, '$1f');
    Inflector.singular(/([ht]ive)s$/gi, '$1');
    Inflector.singular(/([^aeiouy]|qu)ies$/gi, '$1y');
    Inflector.singular(/(s)eries$/gi, '$1eries');
    Inflector.singular(/(m)ovies$/gi, '$1ovie');
    Inflector.singular(/(x|ch|ss|sh)es$/gi, '$1');
    Inflector.singular(/([ml])(ous|ic)e$/gi, '$1ouse');
    Inflector.singular(/(bus)(es)?$/gi, '$1');
    Inflector.singular(/(o)es$/gi, '$1');
    Inflector.singular(/(shoe)s?$/gi, '$1');
    Inflector.singular(/(cris|ax|test)[ie]s$/gi, '$1is');
    Inflector.singular(/(octop|fung|foc|radi|alumn|cact)(i|us)$/gi, '$1us');
    Inflector.singular(/(census|alias|status|fetus|genius|virus)(es)?$/gi, '$1');
    Inflector.singular(/^(ox)(en)?/gi, '$1');
    Inflector.singular(/(vert)(ex|ices)$/gi, '$1ex');
    Inflector.singular(/tr(ix|ices)$/gi, 'trix');
    Inflector.singular(/(quiz)(zes)?$/gi, '$1');
    Inflector.singular(/(database)s?$/gi, '$1');
    Inflector.singular(/ee(th?)$/gi, 'oo$1');

    Inflector.irregular('person', 'people');
    Inflector.irregular('man', 'men');
    Inflector.irregular('deer', 'deer');
    Inflector.irregular('human', 'humans');
    Inflector.irregular('child', 'children');
    Inflector.irregular('sex', 'sexes');
    Inflector.irregular('move', 'moves');
    Inflector.irregular('save', 'saves');
    Inflector.irregular('goose', 'geese');
    Inflector.irregular('zombie', 'zombies');

    Inflector.uncountable('equipment,information,rice,money,species,series,fish,sheep,jeans'.split(','));

    NormalizeSource = {
      'A':  'AⒶＡÀÁÂẦẤẪẨÃĀĂẰẮẴẲȦǠÄǞẢÅǺǍȀȂẠẬẶḀĄȺⱯ',
      'B':  'BⒷＢḂḄḆɃƂƁ',
      'C':  'CⒸＣĆĈĊČÇḈƇȻꜾ',
      'D':  'DⒹＤḊĎḌḐḒḎĐƋƊƉꝹ',
      'E':  'EⒺＥÈÉÊỀẾỄỂẼĒḔḖĔĖËẺĚȄȆẸỆȨḜĘḘḚƐƎ',
      'F':  'FⒻＦḞƑꝻ',
      'G':  'GⒼＧǴĜḠĞĠǦĢǤƓꞠꝽꝾ',
      'H':  'HⒽＨĤḢḦȞḤḨḪĦⱧⱵꞍ',
      'I':  'IⒾＩÌÍÎĨĪĬİÏḮỈǏȈȊỊĮḬƗ',
      'J':  'JⒿＪĴɈ',
      'K':  'KⓀＫḰǨḲĶḴƘⱩꝀꝂꝄꞢ',
      'L':  'LⓁＬĿĹĽḶḸĻḼḺŁȽⱢⱠꝈꝆꞀ',
      'M':  'MⓂＭḾṀṂⱮƜ',
      'N':  'NⓃＮǸŃÑṄŇṆŅṊṈȠƝꞐꞤ',
      'O':  'OⓄＯÒÓÔỒỐỖỔÕṌȬṎŌṐṒŎȮȰÖȪỎŐǑȌȎƠỜỚỠỞỢỌỘǪǬØǾƆƟꝊꝌ',
      'P':  'PⓅＰṔṖƤⱣꝐꝒꝔ',
      'Q':  'QⓆＱꝖꝘɊ',
      'R':  'RⓇＲŔṘŘȐȒṚṜŖṞɌⱤꝚꞦꞂ',
      'S':  'SⓈＳẞŚṤŜṠŠṦṢṨȘŞⱾꞨꞄ',
      'T':  'TⓉＴṪŤṬȚŢṰṮŦƬƮȾꞆ',
      'U':  'UⓊＵÙÚÛŨṸŪṺŬÜǛǗǕǙỦŮŰǓȔȖƯỪỨỮỬỰỤṲŲṶṴɄ',
      'V':  'VⓋＶṼṾƲꝞɅ',
      'W':  'WⓌＷẀẂŴẆẄẈⱲ',
      'X':  'XⓍＸẊẌ',
      'Y':  'YⓎＹỲÝŶỸȲẎŸỶỴƳɎỾ',
      'Z':  'ZⓏＺŹẐŻŽẒẔƵȤⱿⱫꝢ',
      'a':  'aⓐａẚàáâầấẫẩãāăằắẵẳȧǡäǟảåǻǎȁȃạậặḁąⱥɐ',
      'b':  'bⓑｂḃḅḇƀƃɓ',
      'c':  'cⓒｃćĉċčçḉƈȼꜿↄ',
      'd':  'dⓓｄḋďḍḑḓḏđƌɖɗꝺ',
      'e':  'eⓔｅèéêềếễểẽēḕḗĕėëẻěȅȇẹệȩḝęḙḛɇɛǝ',
      'f':  'fⓕｆḟƒꝼ',
      'g':  'gⓖｇǵĝḡğġǧģǥɠꞡᵹꝿ',
      'h':  'hⓗｈĥḣḧȟḥḩḫẖħⱨⱶɥ',
      'i':  'iⓘｉìíîĩīĭïḯỉǐȉȋịįḭɨı',
      'j':  'jⓙｊĵǰɉ',
      'k':  'kⓚｋḱǩḳķḵƙⱪꝁꝃꝅꞣ',
      'l':  'lⓛｌŀĺľḷḹļḽḻſłƚɫⱡꝉꞁꝇ',
      'm':  'mⓜｍḿṁṃɱɯ',
      'n':  'nⓝｎǹńñṅňṇņṋṉƞɲŉꞑꞥ',
      'o':  'oⓞｏòóôồốỗổõṍȭṏōṑṓŏȯȱöȫỏőǒȍȏơờớỡởợọộǫǭøǿɔꝋꝍɵ',
      'p':  'pⓟｐṕṗƥᵽꝑꝓꝕ',
      'q':  'qⓠｑɋꝗꝙ',
      'r':  'rⓡｒŕṙřȑȓṛṝŗṟɍɽꝛꞧꞃ',
      's':  'sⓢｓśṥŝṡšṧṣṩșşȿꞩꞅẛ',
      't':  'tⓣｔṫẗťṭțţṱṯŧƭʈⱦꞇ',
      'u':  'uⓤｕùúûũṹūṻŭüǜǘǖǚủůűǔȕȗưừứữửựụṳųṷṵʉ',
      'v':  'vⓥｖṽṿʋꝟʌ',
      'w':  'wⓦｗẁẃŵẇẅẘẉⱳ',
      'x':  'xⓧｘẋẍ',
      'y':  'yⓨｙỳýŷỹȳẏÿỷẙỵƴɏỿ',
      'z':  'zⓩｚźẑżžẓẕƶȥɀⱬꝣ',
      'AA': 'Ꜳ',
      'AE': 'ÆǼǢ',
      'AO': 'Ꜵ',
      'AU': 'Ꜷ',
      'AV': 'ꜸꜺ',
      'AY': 'Ꜽ',
      'DZ': 'ǱǄ',
      'Dz': 'ǲǅ',
      'LJ': 'Ǉ',
      'Lj': 'ǈ',
      'NJ': 'Ǌ',
      'Nj': 'ǋ',
      'OI': 'Ƣ',
      'OO': 'Ꝏ',
      'OU': 'Ȣ',
      'TZ': 'Ꜩ',
      'VY': 'Ꝡ',
      'aa': 'ꜳ',
      'ae': 'æǽǣ',
      'ao': 'ꜵ',
      'au': 'ꜷ',
      'av': 'ꜹꜻ',
      'ay': 'ꜽ',
      'dz': 'ǳǆ',
      'hv': 'ƕ',
      'lj': 'ǉ',
      'nj': 'ǌ',
      'oi': 'ƣ',
      'ou': 'ȣ',
      'oo': 'ꝏ',
      'ss': 'ß',
      'tz': 'ꜩ',
      'vy': 'ꝡ'
    };



    extend(String, {

      /***
       * @method pluralize()
       * @returns String
       * @short Returns the plural form of the word in the string.
       * @example
       *
       *   'post'.pluralize()         -> 'posts'
       *   'octopus'.pluralize()      -> 'octopi'
       *   'sheep'.pluralize()        -> 'sheep'
       *   'words'.pluralize()        -> 'words'
       *   'CamelOctopus'.pluralize() -> 'CamelOctopi'
       *
       ***/
      'pluralize': function() {
        return inflect(this, true);
      },

      /***
       * @method singularize()
       * @returns String
       * @short The reverse of String#pluralize. Returns the singular form of a word in a string.
       * @example
       *
       *   'posts'.singularize()       -> 'post'
       *   'octopi'.singularize()      -> 'octopus'
       *   'sheep'.singularize()       -> 'sheep'
       *   'word'.singularize()        -> 'word'
       *   'CamelOctopi'.singularize() -> 'CamelOctopus'
       *
       ***/
      'singularize': function() {
        return inflect(this, false);
      },

      /***
       * @method humanize()
       * @returns String
       * @short Creates a human readable string.
       * @extra Capitalizes the first word and turns underscores into spaces and strips a trailing '_id', if any. Like String#titleize, this is meant for creating pretty output.
       * @example
       *
       *   'employee_salary'.humanize() -> 'Employee salary'
       *   'author_id'.humanize()       -> 'Author'
       *
       ***/
      'humanize': function() {
        return humanize(this);
      },

      /***
       * @method titleize()
       * @returns String
       * @short Creates a title version of the string.
       * @extra Capitalizes all the words and replaces some characters in the string to create a nicer looking title. String#titleize is meant for creating pretty output.
       * @example
       *
       *   'man from the boondocks'.titleize() -> 'Man from the Boondocks'
       *   'x-men: the last stand'.titleize() -> 'X Men: The Last Stand'
       *   'TheManWithoutAPast'.titleize() -> 'The Man Without a Past'
       *   'raiders_of_the_lost_ark'.titleize() -> 'Raiders of the Lost Ark'
       *
       ***/
      'titleize': function() {
        var fullStopPunctuation = /[.:;!]$/, hasPunctuation, lastHadPunctuation, isFirstOrLast;
        var str = humanize(spacify(this));
        return eachWord(str, function(word, index, words) {
          hasPunctuation = fullStopPunctuation.test(word);
          isFirstOrLast = index == 0 || index == words.length - 1 || hasPunctuation || lastHadPunctuation;
          lastHadPunctuation = hasPunctuation;
          if (isFirstOrLast || Downcased.indexOf(word) === -1) {
            return capitalizeWithoutDowncasing(word, true);
          } else {
            return word;
          }
        }).join(' ');
      },

      /***
       * @method parameterize()
       * @returns String
       * @short Replaces special characters in a string so that it may be used as part of a pretty URL.
       * @example
       *
       *   'hell, no!'.parameterize() -> 'hell-no'
       *
       ***/
      'parameterize': function(separator) {
        var str = toAscii(this);
        if (separator === undefined) separator = '-';
        str = str.replace(/[^a-z0-9\-_]+/gi, separator)
        if (separator) {
          str = str.replace(new RegExp(stringAssign('^{sep}+|{sep}+$|({sep}){sep}+', [{ 'sep': escapeRegExp(separator) }]), 'g'), '$1');
        }
        return encodeURI(str.toLowerCase());
      },

      /***
       * @method toAscii()
       * @returns String
       * @short Returns the string with accented and non-standard Latin-based characters converted into ASCII approximate equivalents.
       * @example
       *
       *   'á'.toAscii()                  -> 'a'
       *   'Ménage à trois'.toAscii()     -> 'Menage a trois'
       *   'Volkswagen'.toAscii()         -> 'Volkswagen'
       *   'ＦＵＬＬＷＩＤＴＨ'.toAscii() -> 'FULLWIDTH'
       *
       ***/
      'toAscii': function() {
        return toAscii(this);
      }

    });

    String.Inflector = Inflector;
    String.Inflector.acronyms = acronyms;

    buildNormalizeMap();

    /***
     * @module Language
     * @dependency string
     * @description Detecting language by character block. Full-width <-> half-width character conversion. Hiragana and Katakana conversions.
     *
     ***/

    /***
     * @namespace String
     *
     ***/


    /***
     * @method has[Script]()
     * @returns Boolean
     * @short Returns true if the string contains any characters in that script.
     *
     * @set
     *   hasArabic
     *   hasCyrillic
     *   hasGreek
     *   hasHangul
     *   hasHan
     *   hasKanji
     *   hasHebrew
     *   hasHiragana
     *   hasKana
     *   hasKatakana
     *   hasLatin
     *   hasThai
     *   hasDevanagari
     *
     * @example
     *
     *   'أتكلم'.hasArabic()          -> true
     *   'визит'.hasCyrillic()        -> true
     *   '잘 먹겠습니다!'.hasHangul() -> true
     *   'ミックスです'.hasKatakana() -> true
     *   "l'année".hasLatin()         -> true
     *
     ***
     * @method is[Script]()
     * @returns Boolean
     * @short Returns true if the string contains only characters in that script. Whitespace is ignored.
     *
     * @set
     *   isArabic
     *   isCyrillic
     *   isGreek
     *   isHangul
     *   isHan
     *   isKanji
     *   isHebrew
     *   isHiragana
     *   isKana
     *   isKatakana
     *   isThai
     *   isDevanagari
     *
     * @example
     *
     *   'أتكلم'.isArabic()          -> true
     *   'визит'.isCyrillic()        -> true
     *   '잘 먹겠습니다!'.isHangul() -> true
     *   'ミックスです'.isKatakana() -> false
     *   "l'année".isLatin()         -> true
     *
     ***/
    var unicodeScripts = [
      { names: ['Arabic'],      source: '\u0600-\u06FF' },
      { names: ['Cyrillic'],    source: '\u0400-\u04FF' },
      { names: ['Devanagari'],  source: '\u0900-\u097F' },
      { names: ['Greek'],       source: '\u0370-\u03FF' },
      { names: ['Hangul'],      source: '\uAC00-\uD7AF\u1100-\u11FF' },
      { names: ['Han','Kanji'], source: '\u4E00-\u9FFF\uF900-\uFAFF' },
      { names: ['Hebrew'],      source: '\u0590-\u05FF' },
      { names: ['Hiragana'],    source: '\u3040-\u309F\u30FB-\u30FC' },
      { names: ['Kana'],        source: '\u3040-\u30FF\uFF61-\uFF9F' },
      { names: ['Katakana'],    source: '\u30A0-\u30FF\uFF61-\uFF9F' },
      { names: ['Latin'],       source: '\u0001-\u007F\u0080-\u00FF\u0100-\u017F\u0180-\u024F' },
      { names: ['Thai'],        source: '\u0E00-\u0E7F' }
    ];

    function buildUnicodeScripts() {
      extendSimilar(String, unicodeScripts, function(methods, script) {
        var is = RegExp('^['+ script.source +'\\s]+$');
        var has = RegExp('['+ script.source +']');
        script.names.forEach(function(name) {
          methods['is' + name] = function() {
            return is.test(this.trim());
          }
          methods['has' + name] = function() {
            return has.test(this.trim());
          }
        });
      });
    }

    // Support for converting character widths and katakana to hiragana.

    var HALF_WIDTH_TO_FULL_WIDTH_TRAVERSAL = 65248;

    var widthConversionRanges = [
      { type: 'a', start: 65,  end: 90  },
      { type: 'a', start: 97,  end: 122 },
      { type: 'n', start: 48,  end: 57  },
      { type: 'p', start: 33,  end: 47  },
      { type: 'p', start: 58,  end: 64  },
      { type: 'p', start: 91,  end: 96  },
      { type: 'p', start: 123, end: 126 }
    ];

    var WidthConversionTable;
    var allHankaku   = /[\u0020-\u00A5]|[\uFF61-\uFF9F][ﾞﾟ]?/g;
    var allZenkaku   = /[\u2212\u3000-\u301C\u301A-\u30FC\uFF01-\uFF60\uFFE0-\uFFE6]/g;
    var hankakuPunctuation  = '｡､｢｣¥¢£';
    var zenkakuPunctuation  = '。、「」￥￠￡';
    var voicedKatakana      = /[カキクケコサシスセソタチツテトハヒフヘホ]/;
    var semiVoicedKatakana  = /[ハヒフヘホヲ]/;
    var hankakuKatakana     = 'ｱｲｳｴｵｧｨｩｪｫｶｷｸｹｺｻｼｽｾｿﾀﾁﾂｯﾃﾄﾅﾆﾇﾈﾉﾊﾋﾌﾍﾎﾏﾐﾑﾒﾓﾔｬﾕｭﾖｮﾗﾘﾙﾚﾛﾜｦﾝｰ･';
    var zenkakuKatakana     = 'アイウエオァィゥェォカキクケコサシスセソタチツッテトナニヌネノハヒフヘホマミムメモヤャユュヨョラリルレロワヲンー・';

    function convertCharacterWidth(str, args, reg, type) {
      if (!WidthConversionTable) {
        buildWidthConversionTables();
      }
      var mode = args.join(''), table = WidthConversionTable[type];
      mode = mode.replace(/all/, '').replace(/(\w)lphabet|umbers?|atakana|paces?|unctuation/g, '$1');
      return str.replace(reg, function(c) {
        var entry = table[c], to;
        if (entry) {
          if (mode === '' && entry.all) {
            return entry.all;
          } else {
            for (var i = 0, len = mode.length; i < len; i++) {
              to = entry[mode.charAt(i)];
              if (to) {
                return to;
              }
            }
          }
        }
        return c;
      });
    }

    function buildWidthConversionTables() {
      var hankaku;
      WidthConversionTable = {
        'zenkaku': {},
        'hankaku': {}
      };
      widthConversionRanges.forEach(function(r) {
        simpleRepeat(r.end - r.start + 1, function(n) {
          n += r.start;
          setWidthConversion(r.type, chr(n), chr(n + HALF_WIDTH_TO_FULL_WIDTH_TRAVERSAL));
        });
      });
      stringEach(zenkakuKatakana, function(c, i) {
        hankaku = hankakuKatakana.charAt(i);
        setWidthConversion('k', hankaku, c);
        if (c.match(voicedKatakana)) {
          setWidthConversion('k', hankaku + 'ﾞ', shiftChar(c, 1));
        }
        if (c.match(semiVoicedKatakana)) {
          setWidthConversion('k', hankaku + 'ﾟ', shiftChar(c, 2));
        }
      });
      stringEach(zenkakuPunctuation, function(c, i) {
        setWidthConversion('p', hankakuPunctuation.charAt(i), c);
      });
      setWidthConversion('s', ' ', '　');
      setWidthConversion('k', 'ｳﾞ', 'ヴ');
      setWidthConversion('k', 'ｦﾞ', 'ヺ');
      setConversionTableEntry('hankaku', 'n', '−', '-');
      setConversionTableEntry('hankaku', 'n', 'ー', '-', false);
      setConversionTableEntry('zenkaku', 'n', '-', '－', false);
    }

    function setWidthConversion(type, half, full) {
      setConversionTableEntry('zenkaku', type, half, full);
      setConversionTableEntry('hankaku', type, full, half);
    }

    function setConversionTableEntry(width, type, from, to, all) {
      var obj = WidthConversionTable[width][from] || {};
      if (all !== false) {
        obj.all = to;
      }
      obj[type]  = to;
      WidthConversionTable[width][from] = obj;
    }

    function hankaku(str, args) {
      return convertCharacterWidth(str, args, allZenkaku, 'hankaku');
    }

    function zenkaku(str, args) {
      return convertCharacterWidth(str, args, allHankaku, 'zenkaku');
    }


    extend(String, {

      /***
       * @method hankaku([mode] = 'all')
       * @returns String
       * @short Converts full-width characters (zenkaku) to half-width (hankaku).
       * @extra [mode] accepts any combination of "a" (alphabet), "n" (numbers), "k" (katakana), "s" (spaces), "p" (punctuation), or "all".
       * @example
       *
       *   'タロウ　ＹＡＭＡＤＡです！'.hankaku()                      -> 'ﾀﾛｳ YAMADAです!'
       *   'タロウ　ＹＡＭＡＤＡです！'.hankaku('a')                   -> 'タロウ　YAMADAです！'
       *   'タロウ　ＹＡＭＡＤＡです！'.hankaku('alphabet')            -> 'タロウ　YAMADAです！'
       *   'タロウです！　２５歳です！'.hankaku('katakana', 'numbers') -> 'ﾀﾛｳです！　25歳です！'
       *   'タロウです！　２５歳です！'.hankaku('k', 'n')              -> 'ﾀﾛｳです！　25歳です！'
       *   'タロウです！　２５歳です！'.hankaku('kn')                  -> 'ﾀﾛｳです！　25歳です！'
       *   'タロウです！　２５歳です！'.hankaku('sp')                  -> 'タロウです! ２５歳です!'
       *
       ***/
      'hankaku': function() {
        // Optimized: no leaking arguments
        var args = [], $i; for($i = 0; $i < arguments.length; $i++) args.push(arguments[$i]);
        return hankaku(this, args);
      },

      /***
       * @method zenkaku([mode] = 'all')
       * @returns String
       * @short Converts half-width characters (hankaku) to full-width (zenkaku).
       * @extra [mode] accepts any combination of "a" (alphabet), "n" (numbers), "k" (katakana), "s" (spaces), "p" (punctuation), or "all".
       * @example
       *
       *   'ﾀﾛｳ YAMADAです!'.zenkaku()                         -> 'タロウ　ＹＡＭＡＤＡです！'
       *   'ﾀﾛｳ YAMADAです!'.zenkaku('a')                      -> 'ﾀﾛｳ ＹＡＭＡＤＡです!'
       *   'ﾀﾛｳ YAMADAです!'.zenkaku('alphabet')               -> 'ﾀﾛｳ ＹＡＭＡＤＡです!'
       *   'ﾀﾛｳです! 25歳です!'.zenkaku('katakana', 'numbers') -> 'タロウです! ２５歳です!'
       *   'ﾀﾛｳです! 25歳です!'.zenkaku('k', 'n')              -> 'タロウです! ２５歳です!'
       *   'ﾀﾛｳです! 25歳です!'.zenkaku('kn')                  -> 'タロウです! ２５歳です!'
       *   'ﾀﾛｳです! 25歳です!'.zenkaku('sp')                  -> 'ﾀﾛｳです！　25歳です！'
       *
       ***/
      'zenkaku': function() {
        // Optimized: no leaking arguments
        var args = [], $i; for($i = 0; $i < arguments.length; $i++) args.push(arguments[$i]);
        return zenkaku(this, args);
      },

      /***
       * @method hiragana([all] = true)
       * @returns String
       * @short Converts katakana into hiragana.
       * @extra If [all] is false, only full-width katakana will be converted.
       * @example
       *
       *   'カタカナ'.hiragana()   -> 'かたかな'
       *   'コンニチハ'.hiragana() -> 'こんにちは'
       *   'ｶﾀｶﾅ'.hiragana()       -> 'かたかな'
       *   'ｶﾀｶﾅ'.hiragana(false)  -> 'ｶﾀｶﾅ'
       *
       ***/
      'hiragana': function(all) {
        var str = this;
        if (all !== false) {
          str = zenkaku(str, ['k']);
        }
        return str.replace(/[\u30A1-\u30F6]/g, function(c) {
          return shiftChar(c, -96);
        });
      },

      /***
       * @method katakana()
       * @returns String
       * @short Converts hiragana into katakana.
       * @example
       *
       *   'かたかな'.katakana()   -> 'カタカナ'
       *   'こんにちは'.katakana() -> 'コンニチハ'
       *
       ***/
      'katakana': function() {
        return this.replace(/[\u3041-\u3096]/g, function(c) {
          return shiftChar(c, 96);
        });
      }


    });

    buildUnicodeScripts();

    /***
     * @module Number
     * @dependency core
     * @description Number formatting, rounding (with precision), and ranges. Aliases to Math methods.
     *
     ***/

    function getThousands() {
      var str = Number.thousands;
      return isString(str) ? str : ',';
    }

    function getDecimal() {
      var str = Number.decimal;
      return isString(str) ? str : '.';
    }

    function abbreviateNumber(num, roundTo, str, mid, limit, bytes) {
      var fixed        = num.toFixed(20),
          decimalPlace = fixed.search(/\./),
          numeralPlace = fixed.search(/[1-9]/),
          significant  = decimalPlace - numeralPlace,
          unit, i, divisor;
      if (significant > 0) {
        significant -= 1;
      }
      i = max(min(floor(significant / 3), limit === false ? str.length : limit), -mid);
      unit = str.charAt(i + mid - 1);
      if (significant < -9) {
        i = -3;
        roundTo = abs(significant) - 9;
        unit = str.slice(0,1);
      }
      divisor = bytes ? pow(2, 10 * i) : pow(10, i * 3);
      return formatNumber(withPrecision(num / divisor, roundTo || 0)) + unit.trim();
    }

    function formatNumber(num, place, thousands, decimal) {
      var i, str, split, integer, fraction, result = '';
      thousands = thousands || getThousands();
      decimal   = decimal || getDecimal();
      str      = (isNumber(place) ? withPrecision(num, place || 0).toFixed(max(place, 0)) : num.toString()).replace(/^-/, '');
      split    = str.split('.');
      integer  = split[0];
      fraction = split[1];
      for(i = integer.length; i > 0; i -= 3) {
        if (i < integer.length) {
          result = thousands + result;
        }
        result = integer.slice(max(0, i - 3), i) + result;
      }
      if (fraction) {
        result += decimal + repeatString('0', (place || 0) - fraction.length) + fraction;
      }
      return (num < 0 ? '-' : '') + result;
    }

    function isInteger(n) {
      return n % 1 === 0;
    }

    function isMultiple(n1, n2) {
      return n1 % n2 === 0;
    }


    extend(Number, {

      /***
       * @method Number.random([n1], [n2])
       * @returns Number
       * @short Returns a random integer between [n1] and [n2].
       * @extra If only 1 number is passed, the other will be 0. If none are passed, the number will be either 0 or 1.
       * @example
       *
       *   Number.random(50, 100) -> ex. 85
       *   Number.random(50)      -> ex. 27
       *   Number.random()        -> ex. 0
       *
       ***/
      'random': function(n1, n2) {
        var minNum, maxNum;
        if (arguments.length == 1) n2 = n1, n1 = 0;
        minNum = min(n1 || 0, isUndefined(n2) ? 1 : n2);
        maxNum = max(n1 || 0, isUndefined(n2) ? 1 : n2) + 1;
        return floor((Math.random() * (maxNum - minNum)) + minNum);
      }

    }, false);

    extend(Number, {

      /***
       * @method Number.isNaN(<value>)
       * @returns Boolean
       * @short Returns true only if the number is %NaN%.
       * @extra This is differs from the global %isNaN%, which returns true for anything that is not a number.
       * @example
       *
       *   Number.isNaN(NaN) -> true
       *   Number.isNaN('n') -> false
       *
       ***/
      'isNaN': function(value) {
        return value !== value;
      }

    }, false, true);

    extend(Number, {

      /***
       * @method log(<base> = Math.E)
       * @returns Number
       * @short Returns the logarithm of the number with base <base>, or natural logarithm of the number if <base> is undefined.
       * @example
       *
       *   (64).log(2) -> 6
       *   (9).log(3)  -> 2
       *   (5).log()   -> 1.6094379124341003
       *
       ***/

      'log': function(base) {
         return Math.log(this) / (base ? Math.log(base) : 1);
       },

      /***
       * @method abbr([precision] = 0)
       * @returns String
       * @short Returns an abbreviated form of the number.
       * @extra [precision] will round to the given precision. %Number.thousands% and %Number.decimal% allow custom markers to be used.
       * @example
       *
       *   (1000).abbr()    -> "1k"
       *   (1000000).abbr() -> "1m"
       *   (1280).abbr(1)   -> "1.3k"
       *
       ***/
      'abbr': function(precision) {
        return abbreviateNumber(this, precision, 'kmbt', 0, 4);
      },

      /***
       * @method metric([precision] = 0, [limit] = 1)
       * @returns String
       * @short Returns the number as a string in metric notation.
       * @extra [precision] will round to the given precision. Both very large numbers and very small numbers are supported. [limit] is the upper limit for the units. The default is %1%, which is "kilo". If [limit] is %false%, the upper limit will be "exa". The lower limit is "nano", and cannot be changed. %Number.thousands% and %Number.decimal% allow custom markers to be used.
       * @example
       *
       *   (1000).metric()            -> "1k"
       *   (1000000).metric()         -> "1,000k"
       *   (1000000).metric(0, false) -> "1M"
       *   (1249).metric(2) + 'g'     -> "1.25kg"
       *   (0.025).metric() + 'm'     -> "25mm"
       *
       ***/
      'metric': function(precision, limit) {
        return abbreviateNumber(this, precision, 'nμm kMGTPE', 4, isUndefined(limit) ? 1 : limit);
      },

      /***
       * @method bytes([precision] = 0, [limit] = 4, [si] = false)
       * @returns String
       * @short Returns an abbreviated form of the number, considered to be "Bytes".
       * @extra [precision] will round to the given precision. [limit] is the upper limit for the units. The default is %4%, which is "terabytes" (TB). If [limit] is %false%, the upper limit will be "exa". If [si] is %true%, the standard SI units of 1000 will be used instead of 1024. %Number.thousands% and %Number.decimal% allow custom markers to be used.
       * @example
       *
       *   (1000).bytes()                 -> "1kB"
       *   (1000).bytes(2)                -> "0.98kB"
       *   ((10).pow(20)).bytes()         -> "90,949,470TB"
       *   ((10).pow(20)).bytes(0, false) -> "87EB"
       *
       ***/
      'bytes': function(precision, limit, si) {
        return abbreviateNumber(this, precision, 'kMGTPE', 0, isUndefined(limit) ? 4 : limit, si !== true) + 'B';
      },

      /***
       * @method isInteger()
       * @returns Boolean
       * @short Returns true if the number has no trailing decimal.
       * @example
       *
       *   (420).isInteger() -> true
       *   (4.5).isInteger() -> false
       *
       ***/
      'isInteger': function() {
        return isInteger(this);
      },

      /***
       * @method isOdd()
       * @returns Boolean
       * @short Returns true if the number is odd.
       * @example
       *
       *   (3).isOdd()  -> true
       *   (18).isOdd() -> false
       *
       ***/
      'isOdd': function() {
        return isInteger(this) && !isMultiple(this, 2);
      },

      /***
       * @method isEven()
       * @returns Boolean
       * @short Returns true if the number is even.
       * @example
       *
       *   (6).isEven()  -> true
       *   (17).isEven() -> false
       *
       ***/
      'isEven': function() {
        return isMultiple(this, 2);
      },

      /***
       * @method isMultipleOf(<num>)
       * @returns Boolean
       * @short Returns true if the number is a multiple of <num>.
       * @example
       *
       *   (6).isMultipleOf(2)  -> true
       *   (17).isMultipleOf(2) -> false
       *   (32).isMultipleOf(4) -> true
       *   (34).isMultipleOf(4) -> false
       *
       ***/
      'isMultipleOf': function(num) {
        return isMultiple(this, num);
      },


      /***
       * @method format([place] = 0, [thousands] = ',', [decimal] = '.')
       * @extra If [place] is %undefined%, will automatically determine the place. [thousands] is the character used for the thousands separator. [decimal] is the character used for the decimal point.xtra If [place] is %undefined%, the place will automatically be determined. %Number.thousands% and %Number.decimal% allow custom markers to be used.
       * @returns String
       * @short Formats the number to a readable string.
       * @extra If [place] is %undefined%, the place will automatically be determined. %Number.thousands% and %Number.decimal% allow custom markers to be used.
       * @example
       *
       *   (56782).format()              -> '56,782'
       *   (56782).format(2)             -> '56,782.00'
       *   (4388.43).format(2, ' ')      -> '4 388.43'
       *   (4388.43).format(2, '.', ',') -> '4.388,43'
       *
       ***/
      'format': function(place, thousands, decimal) {
        return formatNumber(this, place, thousands, decimal);
      },

      /***
       * @method hex([pad] = 1)
       * @returns String
       * @short Converts the number to hexidecimal.
       * @extra [pad] will pad the resulting string to that many places.
       * @example
       *
       *   (255).hex()   -> 'ff';
       *   (255).hex(4)  -> '00ff';
       *   (23654).hex() -> '5c66';
       *
       ***/
      'hex': function(pad) {
        return padNumber(this, pad || 1, false, 16);
      },

      /***
       * @method times(<fn>)
       * @returns Number
       * @short Calls <fn> a number of times equivalent to the number.
       * @example
       *
       *   (8).times(function(i) {
       *     // This function is called 8 times.
       *   });
       *
       ***/
      'times': function(fn) {
        if (fn) {
          for(var i = 0; i < this; i++) {
            fn.call(this, i);
          }
        }
        return +this;
      },

      /***
       * @method chr()
       * @returns String
       * @short Returns a string at the code point of the number.
       * @example
       *
       *   (65).chr() -> "A"
       *   (75).chr() -> "K"
       *
       ***/
      'chr': function() {
        return String.fromCharCode(this);
      },

      /***
       * @method pad(<place> = 0, [sign] = false, [base] = 10)
       * @returns String
       * @short Pads a number with "0" to <place>.
       * @extra [sign] allows you to force the sign as well (+05, etc). [base] can change the base for numeral conversion.
       * @example
       *
       *   (5).pad(2)        -> '05'
       *   (-5).pad(4)       -> '-0005'
       *   (82).pad(3, true) -> '+082'
       *
       ***/
      'pad': function(place, sign, base) {
        return padNumber(this, place, sign, base);
      },

      /***
       * @method ordinalize()
       * @returns String
       * @short Returns an ordinalized (English) string, i.e. "1st", "2nd", etc.
       * @example
       *
       *   (1).ordinalize() -> '1st';
       *   (2).ordinalize() -> '2nd';
       *   (8).ordinalize() -> '8th';
       *
       ***/
      'ordinalize': function() {
        var suffix, num = abs(this), last = parseInt(num.toString().slice(-2));
        return this + getOrdinalizedSuffix(last);
      },

      /***
       * @method toNumber()
       * @returns Number
       * @short Returns a number. This is mostly for compatibility reasons.
       * @example
       *
       *   (420).toNumber() -> 420
       *
       ***/
      'toNumber': function() {
        return parseFloat(this, 10);
      }

    });

    /***
     * @method round(<precision> = 0)
     * @returns Number
     * @short Shortcut for %Math.round% that also allows a <precision>.
     *
     * @example
     *
     *   (3.241).round()  -> 3
     *   (-3.841).round() -> -4
     *   (3.241).round(2) -> 3.24
     *   (3748).round(-2) -> 3800
     *
     ***
     * @method ceil(<precision> = 0)
     * @returns Number
     * @short Shortcut for %Math.ceil% that also allows a <precision>.
     *
     * @example
     *
     *   (3.241).ceil()  -> 4
     *   (-3.241).ceil() -> -3
     *   (3.241).ceil(2) -> 3.25
     *   (3748).ceil(-2) -> 3800
     *
     ***
     * @method floor(<precision> = 0)
     * @returns Number
     * @short Shortcut for %Math.floor% that also allows a <precision>.
     *
     * @example
     *
     *   (3.241).floor()  -> 3
     *   (-3.841).floor() -> -4
     *   (3.241).floor(2) -> 3.24
     *   (3748).floor(-2) -> 3700
     *
     ***
     * @method [math]()
     * @returns Number
     * @short Math related functions are mapped as shortcuts to numbers and are identical. Note that %Number#log% provides some special defaults.
     *
     * @set
     *   abs
     *   sin
     *   asin
     *   cos
     *   acos
     *   tan
     *   atan
     *   sqrt
     *   exp
     *   pow
     *
     * @example
     *
     *   (3).pow(3) -> 27
     *   (-3).abs() -> 3
     *   (1024).sqrt() -> 32
     *
     ***/

    function buildNumber() {
      function createRoundingFunction(fn) {
        return function (precision) {
          return precision ? withPrecision(this, precision, fn) : fn(this);
        }
      }
      extend(Number, {
        'ceil':   createRoundingFunction(ceil),
        'round':  createRoundingFunction(round),
        'floor':  createRoundingFunction(floor)
      });
      extendSimilar(Number, 'abs,pow,sin,asin,cos,acos,tan,atan,exp,pow,sqrt', function(methods, name) {
        methods[name] = function(a, b) {
          // Note that .valueOf() here is only required due to a
          // very strange bug in iOS7 that only occurs occasionally
          // in which Math.abs() called on non-primitive numbers
          // returns a completely different number (Issue #400)
          return Math[name](this.valueOf(), a, b);
        }
      });
    }

    buildNumber();

    /***
     * @module Object
     * @dependency core
     * @description Object manipulation, type checking (isNumber, isString, ...), %extended objects% with hash-like methods available as instance methods.
     *
     * Much thanks to kangax for his informative aricle about how problems with instanceof and constructor
     * http://perfectionkills.com/instanceof-considered-harmful-or-how-to-write-a-robust-isarray/
     *
     ***/

    var ObjectTypeMethods = 'isObject,isNaN'.split(',');
    var ObjectHashMethods = 'equals,keys,values,select,reject,each,map,reduce,size,merge,clone,watch,tap,has,toQueryString'.split(',');

    function setParamsObject(obj, param, value, castBoolean) {
      var reg = /^(.+?)(\[.*\])$/, paramIsArray, match, allKeys, key;
      if (match = param.match(reg)) {
        key = match[1];
        allKeys = match[2].replace(/^\[|\]$/g, '').split('][');
        allKeys.forEach(function(k) {
          paramIsArray = !k || k.match(/^\d+$/);
          if (!key && isArray(obj)) key = obj.length;
          if (!hasOwnProperty(obj, key)) {
            obj[key] = paramIsArray ? [] : {};
          }
          obj = obj[key];
          key = k;
        });
        if (!key && paramIsArray) key = obj.length.toString();
        setParamsObject(obj, key, value, castBoolean);
      } else if (castBoolean && value === 'true') {
        obj[param] = true;
      } else if (castBoolean && value === 'false') {
        obj[param] = false;
      } else {
        obj[param] = value;
      }
    }

    function objectToQueryString(base, obj) {
      var tmp;
      // If a custom toString exists bail here and use that instead
      if (isArray(obj) || (isObjectType(obj) && obj.toString === internalToString)) {
        tmp = [];
        iterateOverObject(obj, function(key, value) {
          if (base) {
            key = base + '[' + key + ']';
          }
          tmp.push(objectToQueryString(key, value));
        });
        return tmp.join('&');
      } else {
        if (!base) return '';
        return sanitizeURIComponent(base) + '=' + (isDate(obj) ? obj.getTime() : sanitizeURIComponent(obj));
      }
    }

    function sanitizeURIComponent(obj) {
      // undefined, null, and NaN are represented as a blank string,
      // while false and 0 are stringified. "+" is allowed in query string
      return !obj && obj !== false && obj !== 0 ? '' : encodeURIComponent(obj).replace(/%20/g, '+');
    }

    function matchInObject(match, key, value) {
      if (isRegExp(match)) {
        return match.test(key);
      } else if (isObjectType(match)) {
        return match[key] === value;
      } else {
        return key === String(match);
      }
    }

    function selectFromObject(obj, args, select) {
      var match, result = obj instanceof Hash ? new Hash : {};
      iterateOverObject(obj, function(key, value) {
        match = false;
        for (var i = 0; i < args.length; i++) {
          if (matchInObject(args[i], key, value)) {
            match = true;
          }
        }
        if (match === select) {
          result[key] = value;
        }
      });
      return result;
    }

    // Object merging

    var getOwnPropertyNames      = Object.getOwnPropertyNames;
    var defineProperty           = propertyDescriptorSupport ? Object.defineProperty : definePropertyShim;
    var getOwnPropertyDescriptor = propertyDescriptorSupport ? Object.getOwnPropertyDescriptor : getOwnPropertyDescriptorShim;

    function iterateOverProperties(obj, hidden, fn) {
      if (hidden && propertyDescriptorSupport) {
        iterateOverPropertyNames(obj, fn);
      } else {
        iterateOverObject(obj, fn);
      }
    }

    function iterateOverPropertyNames(obj, fn) {
      getOwnPropertyNames(obj).forEach(fn);
    }

    function getOwnPropertyDescriptorShim(obj, prop) {
      return obj.hasOwnProperty(prop) ? { value: obj[prop] } : Undefined;
    }

    function definePropertyShim(obj, prop, descriptor) {
      obj[prop] = descriptor.value;
    }

    function mergeObject(target, source, deep, resolve, isClone) {
      var key, sourceIsObject, targetIsObject, sourceVal, targetVal, conflict, result;
      // Strings cannot be reliably merged thanks to
      // their properties not being enumerable in < IE8.
      if(target && typeof source !== 'string') {
        iterateOverProperties(source, isClone, function (key) {
          sourceVal      = source[key];
          targetVal      = target[key];
          conflict       = isDefined(targetVal);
          sourceIsObject = isObjectType(sourceVal);
          targetIsObject = isObjectType(targetVal);
          result         = conflict && resolve === false ? targetVal : sourceVal;

          if(conflict) {
            if(isFunction(resolve)) {
              // Use the result of the callback as the result.
              result = resolve.call(source, key, targetVal, sourceVal)
            }
          }

          // Going deep
          if(deep && (sourceIsObject || targetIsObject)) {
            if(isDate(sourceVal)) {
              result = new Date(sourceVal.getTime());
            } else if(isRegExp(sourceVal)) {
              result = new RegExp(sourceVal.source, getRegExpFlags(sourceVal));
            } else {
              if(!targetIsObject) target[key] = Array.isArray(sourceVal) ? [] : {};
              mergeObject(target[key], sourceVal, deep, resolve, isClone);
              return;
            }
          }

          if (isClone && propertyDescriptorSupport) {
            mergeByPropertyDescriptor(target, source, key, result);
          } else {
            target[key] = result;
          }
        });
      }
      return target;
    }

    function mergeByPropertyDescriptor(target, source, prop, sourceVal) {
      var descriptor = getOwnPropertyDescriptor(source, prop);
      if (isDefined(descriptor.value)) {
        descriptor.value = sourceVal;
      }
      defineProperty(target, prop, descriptor);
    }


    // Extending all

    function mapAllObject() {
      buildObjectInstanceMethods(getObjectInstanceMethods(), Object);
    }

    function unmapAllObject() {
      var objProto = Object.prototype, methods = getObjectInstanceMethods();
      methods.forEach(function(name) {
        if (objProto[name]) {
          delete objProto[name];
        }
      });
    }

    function getObjectInstanceMethods() {
      return ObjectTypeMethods.concat(ObjectHashMethods);
    }

    /***
     * @method Object.is[Type](<obj>)
     * @returns Boolean
     * @short Returns true if <obj> is an object of that type.
     * @extra %isObject% will return false on anything that is not an object literal, including instances of inherited classes. Note also that %isNaN% will ONLY return true if the object IS %NaN%. It does not mean the same as browser native %isNaN%, which returns true for anything that is "not a number".
     *
     * @set
     *   isArray
     *   isArguments
     *   isObject
     *   isBoolean
     *   isDate
     *   isFunction
     *   isNaN
     *   isNumber
     *   isString
     *   isRegExp
     *
     * @example
     *
     *   Object.isArray([1,2,3])            -> true
     *   Object.isDate(3)                   -> false
     *   Object.isRegExp(/wasabi/)          -> true
     *   Object.isObject({ broken:'wear' }) -> true
     *
     ***/
    function buildTypeMethods() {
      extendSimilar(Object, natives, function(methods, name) {
        var method = 'is' + name;
        ObjectTypeMethods.push(method);
        methods[method] = typeChecks[name];
      }, false);
    }

    extend(Object, {
        /***
         * @method watch(<obj>, <prop>, <fn>)
         * @returns Boolean
         * @short Watches property <prop> of <obj> and runs <fn> when it changes.
         * @extra <fn> is passed three arguments: the property <prop>, the old value, and the new value. The return value of [fn] will be set as the new value. Properties that are non-configurable or already have getters or setters cannot be watched. Return value is whether or not the watch operation succeeded. This method is useful for things such as validating or cleaning the value when it is set. Warning: this method WILL NOT work in browsers that don't support %Object.defineProperty% (IE 8 and below). This is the only method in Sugar that is not fully compatible with all browsers. %watch% is available as an instance method on %extended objects%.
         * @example
         *
         *   Object.watch({ foo: 'bar' }, 'foo', function(prop, oldVal, newVal) {
         *     // Will be run when the property 'foo' is set on the object.
         *   });
         *   Object.extended().watch({ foo: 'bar' }, 'foo', function(prop, oldVal, newVal) {
         *     // Will be run when the property 'foo' is set on the object.
         *   });
         *
         ***/
      'watch': function(obj, prop, fn) {
        var value, descriptor;
        if (!propertyDescriptorSupport) return false;
        descriptor = getOwnPropertyDescriptor(obj, prop);
        if (descriptor && (!descriptor.configurable || descriptor.get || descriptor.set)) {
          return false;
        }
        value = obj[prop];
        defineProperty(obj, prop, {
          configurable: true,
          enumerable  : !descriptor || descriptor.enumerable,
          get: function() {
            return value;
          },
          set: function(to) {
            value = fn.call(obj, prop, value, to);
          }
        });
        return true;
      },

        /***
         * @method unwatch(<obj>, <prop>)
         * @returns Nothing.
         * @short Removes a watcher previously set.
         * @extra Return value is whether or not the watch operation succeeded. %unwatch% is available as an instance method on %extended objects%.
         ***/
      'unwatch': function(obj, prop) {
        var descriptor;
        if (!propertyDescriptorSupport) return false;
        descriptor = getOwnPropertyDescriptor(obj, prop);
        if (!descriptor || !descriptor.configurable || !descriptor.get || !descriptor.set) {
          return false;
        }
        defineProperty(obj, prop, {
          writable: true,
          configurable: true,
          enumerable: descriptor.enumerable,
          value: obj[prop]
        });
        return true;
      }
    }, false, false);

    extend(Object, {

      /***
       * @method keys(<obj>, [fn])
       * @returns Array
       * @short Returns an array containing the keys in <obj>. Optionally calls [fn] for each key.
       * @extra This method is provided for browsers that don't support it natively, and additionally is enhanced to accept the callback [fn]. Returned keys are in no particular order. %keys% is available as an instance method on %extended objects%.
       * @example
       *
       *   Object.keys({ broken: 'wear' }) -> ['broken']
       *   Object.keys({ broken: 'wear' }, function(key, value) {
       *     // Called once for each key.
       *   });
       *   Object.extended({ broken: 'wear' }).keys() -> ['broken']
       *
       ***/
      'keys': function(obj, fn) {
        var keys = Object.keys(obj);
        keys.forEach(function(key) {
          fn.call(obj, key, obj[key]);
        });
        return keys;
      }

    }, false, function() { return isFunction(arguments[1]); });

    extend(Object, {

      'isArguments': function(obj) {
        return isArgumentsObject(obj);
      },

      'isObject': function(obj) {
        return isPlainObject(obj);
      },

      'isNaN': function(obj) {
        // This is only true of NaN
        return isNumber(obj) && obj.valueOf() !== obj.valueOf();
      },

      /***
       * @method equal(<a>, <b>)
       * @returns Boolean
       * @short Returns true if <a> and <b> are equal.
       * @extra %equal% in Sugar is "egal", meaning the values are equal if they are "not observably distinguishable". Note that on %extended objects% the name is %equals% for readability.
       * @example
       *
       *   Object.equal({a:2}, {a:2}) -> true
       *   Object.equal({a:2}, {a:3}) -> false
       *   Object.extended({a:2}).equals({a:3}) -> false
       *
       ***/
      'equal': function(a, b) {
        return isEqual(a, b);
      },

      /***
       * @method Object.extended(<obj> = {})
       * @returns Extended object
       * @short Creates a new object, equivalent to %new Object()% or %{}%, but with extended methods.
       * @extra See %extended objects% for more.
       * @example
       *
       *   Object.extended()
       *   Object.extended({ happy:true, pappy:false }).keys() -> ['happy','pappy']
       *   Object.extended({ happy:true, pappy:false }).values() -> [true, false]
       *
       ***/
      'extended': function(obj) {
        return new Hash(obj);
      },

      /***
       * @method merge(<target>, <source>, [deep] = false, [resolve] = true)
       * @returns Merged object
       * @short Merges all the properties of <source> into <target>.
       * @extra Merges are shallow unless [deep] is %true%. Properties of <target> that are either null or undefined will be treated as if they don't exist. Properties of <source> will win in the case of conflicts, unless [resolve] is %false%. [resolve] can also be a function that resolves the conflict. In this case it will be passed 3 arguments, %key%, %targetVal%, and %sourceVal%. %merge% is available as an instance method on %extended objects%. For more, see %object_merging%.
       * @example
       *
       *   Object.merge({a:1},{b:2}) -> { a:1, b:2 }
       *   Object.merge({a:1},{a:2}, false, false) -> { a:1 }
       +   Object.merge({a:1},{a:2}, false, function(key, a, b) {
       *     return a + b;
       *   }); -> { a:3 }
       *   Object.extended({a:1}).merge({b:2}) -> { a:1, b:2 }
       *
       ***/
      'merge': function(target, source, deep, resolve) {
        return mergeObject(target, source, deep, resolve);
      },

      /***
       * @method values(<obj>, [fn])
       * @returns Array
       * @short Returns an array containing the values in <obj>. Optionally calls [fn] for each value.
       * @extra Returned values are in no particular order. %values% is available as an instance method on %extended objects%.
       * @example
       *
       *   Object.values({ broken: 'wear' }) -> ['wear']
       *   Object.values({ broken: 'wear' }, function(value) {
       *     // Called once for each value.
       *   });
       *   Object.extended({ broken: 'wear' }).values() -> ['wear']
       *
       ***/
      'values': function(obj, fn) {
        var values = [];
        iterateOverObject(obj, function(k,v) {
          values.push(v);
          if (isFunction(fn)) {
            fn.call(obj,v);
          }
        });
        return values;
      },

      /***
       * @method clone(<obj> = {}, [deep] = false)
       * @returns Cloned object
       * @short Creates a clone (copy) of <obj>.
       * @extra Default is a shallow clone, unless [deep] is true. %clone% is available as an instance method on %extended objects%.
       * @example
       *
       *   Object.clone({foo:'bar'})            -> { foo: 'bar' }
       *   Object.clone()                       -> {}
       *   Object.extended({foo:'bar'}).clone() -> { foo: 'bar' }
       *
       ***/
      'clone': function(obj, deep) {
        var target, klass;
        if (!isObjectType(obj)) {
          return obj;
        }
        klass = className(obj);
        if (isDate(obj, klass) && obj.clone) {
          // Preserve internal UTC flag when possible.
          return obj.clone(obj);
        } else if (isDate(obj, klass) || isRegExp(obj, klass)) {
          return new obj.constructor(obj);
        } else if (obj instanceof Hash) {
          target = new Hash;
        } else if (isArray(obj, klass)) {
          target = [];
        } else if (isPlainObject(obj, klass)) {
          target = {};
        } else {
          throw new TypeError('Clone must be a basic data type.');
        }

        return mergeObject(target, obj, deep, true, true);
      },

      /***
       * @method Object.fromQueryString(<str>, [booleans] = false)
       * @returns Object
       * @short Converts the query string of a URL into an object.
       * @extra If [booleans] is true, then %"true"% and %"false"% will be cast into booleans. All other values, including numbers will remain their string values.
       * @example
       *
       *   Object.fromQueryString('foo=bar&broken=wear') -> { foo: 'bar', broken: 'wear' }
       *   Object.fromQueryString('foo[]=1&foo[]=2')     -> { foo: ['1','2'] }
       *   Object.fromQueryString('foo=true', true)      -> { foo: true }
       *
       ***/
      'fromQueryString': function(str, castBoolean) {
        var result = new Hash, split;
        if (!str) {
          return result;
        }
        str = str && str.toString ? str.toString() : '';
        str.replace(/^.*?\?/, '').split('&').forEach(function(p) {
          var split = p.split('=');
          setParamsObject(result, split[0], decodeURIComponent(split[1] || ''), castBoolean);
        });
        return result;
      },

      /***
       * @method Object.toQueryString(<obj>, [namespace] = null)
       * @returns Object
       * @short Converts the object into a query string.
       * @extra Accepts deep nested objects and arrays. If [namespace] is passed, it will be prefixed to all param names.
       * @example
       *
       *   Object.toQueryString({foo:'bar'})          -> 'foo=bar'
       *   Object.toQueryString({foo:['a','b','c']})  -> 'foo[0]=a&foo[1]=b&foo[2]=c'
       *   Object.toQueryString({name:'Bob'}, 'user') -> 'user[name]=Bob'
       *
       ***/
      'toQueryString': function(obj, namespace) {
        return objectToQueryString(namespace, obj);
      },

      /***
       * @method tap(<obj>, <fn>)
       * @returns Object
       * @short Runs <fn> and returns <obj>.
       * @extra  A string can also be used as a shortcut to a method. This method is used to run an intermediary function in the middle of method chaining. As a standalone method on the Object class it doesn't have too much use. The power of %tap% comes when using %extended objects% or modifying the Object prototype with %Object.extend()%.
       * @example
       *
       *   Object.extend();
       *   [2,4,6].map(Math.exp).tap(function(arr) {
       *     arr.pop()
       *   });
       *   [2,4,6].map(Math.exp).tap('pop').map(Math.round); ->  [7,55]
       *
       ***/
      'tap': function(obj, arg) {
        var fn = arg;
        if (!isFunction(arg)) {
          fn = function() {
            if (arg) obj[arg]();
          }
        }
        fn.call(obj, obj);
        return obj;
      },

      /***
       * @method has(<obj>, <key>)
       * @returns Boolean
       * @short Checks if <obj> has <key> using hasOwnProperty from Object.prototype.
       * @extra This method is considered safer than %Object#hasOwnProperty% when using objects as hashes. See http://www.devthought.com/2012/01/18/an-object-is-not-a-hash/ for more.
       * @example
       *
       *   Object.has({ foo: 'bar' }, 'foo') -> true
       *   Object.has({ foo: 'bar' }, 'baz') -> false
       *   Object.has({ hasOwnProperty: true }, 'foo') -> false
       *
       ***/
      'has': function (obj, key) {
        return hasOwnProperty(obj, key);
      },

      /***
       * @method select(<obj>, <find>, ...)
       * @returns Object
       * @short Builds a new object containing the values specified in <find>.
       * @extra When <find> is a string, that single key will be selected. It can also be a regex, selecting any key that matches, or an object which will effectively do an "intersect" operation on that object. Multiple selections may also be passed as an array or directly as enumerated arguments. %select% is available as an instance method on %extended objects%.
       * @example
       *
       *   Object.select({a:1,b:2}, 'a')        -> {a:1}
       *   Object.select({a:1,b:2}, /[a-z]/)    -> {a:1,ba:2}
       *   Object.select({a:1,b:2}, {a:1})      -> {a:1}
       *   Object.select({a:1,b:2}, 'a', 'b')   -> {a:1,b:2}
       *   Object.select({a:1,b:2}, ['a', 'b']) -> {a:1,b:2}
       *
       ***/
      'select': function (obj) {
        // Optimized: no leaking arguments (flat)
        var args = [], $i; for($i = 1; $i < arguments.length; $i++) args = args.concat(arguments[$i]);
        return selectFromObject(obj, args, true);
      },

      /***
       * @method reject(<obj>, <find>, ...)
       * @returns Object
       * @short Builds a new object containing all values except those specified in <find>.
       * @extra When <find> is a string, that single key will be rejected. It can also be a regex, rejecting any key that matches, or an object which will match if the key also exists in that object, effectively "subtracting" that object. Multiple selections may also be passed as an array or directly as enumerated arguments. %reject% is available as an instance method on %extended objects%.
       * @example
       *
       *   Object.reject({a:1,b:2}, 'a')        -> {b:2}
       *   Object.reject({a:1,b:2}, /[a-z]/)    -> {}
       *   Object.reject({a:1,b:2}, {a:1})      -> {b:2}
       *   Object.reject({a:1,b:2}, 'a', 'b')   -> {}
       *   Object.reject({a:1,b:2}, ['a', 'b']) -> {}
       *
       ***/
      'reject': function (obj) {
        // Optimized: no leaking arguments (flat)
        var args = [], $i; for($i = 1; $i < arguments.length; $i++) args = args.concat(arguments[$i]);
        return selectFromObject(obj, args, false);
      },

      /***
       * @method map(<obj>, <map>)
       * @returns Object
       * @short Maps the object to another object.
       * @extra When <map> is a function, the first argument will be the object's key and the second will be its value. The third argument will be the object itself. The resulting object values will be those which were returned from <map>.
       *
       * @example
       *
       *   Object.map({ foo: 'bar' }, function(lhs, rhs) {
       *     return 'ha';
       *   }); -> Returns { foo: 'ha' }
       *
       ***/
      'map': function(obj, map) {
        var result = {}, key, value;
        for(key in obj) {
          if (!hasOwnProperty(obj, key)) continue;
          value = obj[key];
          result[key] = transformArgument(value, map, obj, [key, value, obj]);
        }
        return result;
      },

      'reduce': function(obj) {
        var args = [], values;
        values = keysWithObjectCoercion(obj).map(function(key) {
          return obj[key];
        });
        for(var i = 1, len = arguments.length; i < len; i++) {
          args.push(arguments[i]);
        }
        return values.reduce.apply(values, args);
      },

      /***
       * @method each(<obj>, <fn>)
       * @returns Object
       * @short Runs <fn> against each property in the object, passing in the key as the first argument, and the value as the second.
       * @extra If <fn> returns %false% at any time it will break out of the loop. Returns <obj>.
       * @example
       *
       *   Object.each({ foo: 'bar' }, function(k, v) {
       *     console.log('key is ', k, ' and value is ', v);
       *   });
       *
       ***/
      'each': function(obj, fn) {
        checkCallback(fn);
        iterateOverObject(obj, fn);
        return obj;
      },

      /***
       * @method size(<obj>)
       * @returns Number
       * @short Returns the number of properties in <obj>.
       * @extra %size% is available as an instance method on %extended objects%.
       * @example
       *
       *   Object.size({ foo: 'bar' }) -> 1
       *
       ***/
      'size': function (obj) {
        return keysWithObjectCoercion(obj).length;
      }

    }, false);

    extend(Object, {

      'extend': function(on) {
        if (on !== false) {
          mapAllObject();
        } else {
          unmapAllObject();
        }
        return true;
      }

    }, false, function(arg) { return typeof arg !== 'object'; });


    buildTypeMethods();
    buildObjectInstanceMethods(ObjectHashMethods, Hash);

    /***
     * @module Range
     * @dependency core
     * @description Ranges allow creating spans of numbers, strings, or dates. They can enumerate over specific points within that range, and be manipulated and compared.
     *
     ***/

    var DATE_UNITS               = 'year|month|week|day|hour|minute|(?:milli)?second';
    var FULL_CAPTURED_DURATION   = '((?:\\d+)?\\s*(?:' + DATE_UNITS + '))s?';
    var RANGE_REG                = /(?:from)?\s*(.+)\s+(?:to|until)\s+(.+)$/i;
    var DURATION_REG             = RegExp('(\\d+)?\\s*('+ DATE_UNITS +')s?', 'i');
    var RANGE_REG_FRONT_DURATION = RegExp('(?:for)?\\s*'+ FULL_CAPTURED_DURATION +'\\s*(?:starting)?\\s*at\\s*(.+)', 'i');
    var RANGE_REG_REAR_DURATION  = RegExp('(.+)\\s*for\\s*' + FULL_CAPTURED_DURATION, 'i');

    var MULTIPLIERS = {
      'Hours': 60 * 60 * 1000,
      'Minutes': 60 * 1000,
      'Seconds': 1000,
      'Milliseconds': 1
    };

    function Range(start, end) {
      this.start = cloneRangeMember(start);
      this.end   = cloneRangeMember(end);
    };

    function getRangeMemberNumericValue(m) {
      return isString(m) ? m.charCodeAt(0) : m;
    }

    function getRangeMemberPrimitiveValue(m) {
      if (m == null) return m;
      return isDate(m) ? m.getTime() : m.valueOf();
    }

    function getPrecision(n) {
      var split = n.toString().split('.');
      return split[1] ? split[1].length : 0;
    }

    function getGreaterPrecision(n1, n2) {
      return max(getPrecision(n1), getPrecision(n2));
    }

    function getSimpleDate(str) {
      // Needed as argument numbers are checked internally here.
      return str == null ? new Date() : new Date(str);
    }

    function getSugarExtendedDate(d) {
      return Date.create(d);
    }

    function dateConstructorIsExtended() {
      return !!Date.create;
    }

    function createDateRangeFromString(str) {
      var match, datetime, duration, dio, start, end;
      if (match = str.match(RANGE_REG)) {
        return DateRangeConstructor(match[1], match[2]);
      }
      if (match = str.match(RANGE_REG_FRONT_DURATION)) {
        duration = match[1];
        datetime = match[2];
      }
      if (match = str.match(RANGE_REG_REAR_DURATION)) {
        datetime = match[1];
        duration = match[2];
      }
      if (datetime && duration) {
        start = getSugarExtendedDate(datetime);
        dio = getDateIncrementObject(duration);
        end = incrementDate(start, dio[0], dio[1]);
      }
      return DateRangeConstructor(start, end);
    }

    function cloneRangeMember(m) {
      if (isDate(m)) {
        return new Date(m.getTime());
      } else {
        return getRangeMemberPrimitiveValue(m);
      }
    }

    function isValidRangeMember(m) {
      var val = getRangeMemberPrimitiveValue(m);
      return (!!val || val === 0) && valueIsNotInfinite(m);
    }

    function valueIsNotInfinite(m) {
      return m !== -Infinity && m !== Infinity;
    }

    function getDateIncrementObject(amt) {
      var match, val, unit;
      if (isNumber(amt)) {
        return [amt, 'Milliseconds'];
      }
      match = amt.match(DURATION_REG);
      val = parseInt(match[1]) || 1;
      unit = match[2].slice(0,1).toUpperCase() + match[2].slice(1).toLowerCase();
      if (unit.match(/hour|minute|second/i)) {
        unit += 's';
      } else if (unit === 'Year') {
        unit = 'FullYear';
      } else if (unit === 'Day') {
        unit = 'Date';
      }
      return [val, unit];
    }

    function incrementDate(src, amount, unit) {
      var mult = MULTIPLIERS[unit], d;
      if (mult) {
        d = new Date(src.getTime() + (amount * mult));
      } else {
        d = new Date(src);
        callDateSet(d, unit, callDateGet(src, unit) + amount);
      }
      return d;
    }


    function incrementString(current, amount) {
      return String.fromCharCode(current.charCodeAt(0) + amount);
    }

    function incrementNumber(current, amount, precision) {
      return withPrecision(current + amount, precision);
    }

    /***
     * @method toString()
     * @returns String
     * @short Returns a string representation of the range.
     * @example
     *
     *   Number.range(1, 5).toString()                               -> 1..5
     *   Date.range(new Date(2003, 0), new Date(2005, 0)).toString() -> January 1, 2003..January 1, 2005
     *
     ***/

    // Note: 'toString' doesn't appear in a for..in loop in IE even though
    // hasOwnProperty reports true, so extend() can't be used here.
    // Also tried simply setting the prototype = {} up front for all
    // methods but GCC very oddly started dropping properties in the
    // object randomly (maybe because of the global scope?) hence
    // the need for the split logic here.
    Range.prototype.toString = function() {
      return this.isValid() ? this.start + ".." + this.end : 'Invalid Range';
    };

    extend(Range, {

      /***
       * @method isValid()
       * @returns Boolean
       * @short Returns true if the range is valid, false otherwise.
       * @example
       *
       *   Date.range(new Date(2003, 0), new Date(2005, 0)).isValid() -> true
       *   Number.range(NaN, NaN).isValid()                           -> false
       *
       ***/
      'isValid': function() {
        return isValidRangeMember(this.start) && isValidRangeMember(this.end) && typeof this.start === typeof this.end;
      },

      /***
       * @method span()
       * @returns Number
       * @short Returns the span of the range. If the range is a date range, the value is in milliseconds.
       * @extra The span includes both the start and the end.
       * @example
       *
       *   Number.range(5, 10).span()                              -> 6
       *   Date.range(new Date(2003, 0), new Date(2005, 0)).span() -> 94694400000
       *
       ***/
      'span': function() {
        return this.isValid() ? abs(
          getRangeMemberNumericValue(this.end) - getRangeMemberNumericValue(this.start)
        ) + 1 : NaN;
      },

      /***
       * @method contains(<obj>)
       * @returns Boolean
       * @short Returns true if <obj> is contained inside the range. <obj> may be a value or another range.
       * @example
       *
       *   Number.range(5, 10).contains(7)                                              -> true
       *   Date.range(new Date(2003, 0), new Date(2005, 0)).contains(new Date(2004, 0)) -> true
       *
       ***/
      'contains': function(obj) {
        var self = this, arr;
        if (obj == null) return false;
        if (obj.start && obj.end) {
          return obj.start >= this.start && obj.start <= this.end &&
                 obj.end   >= this.start && obj.end   <= this.end;
        } else {
          return obj >= this.start && obj <= this.end;
        }
      },

      /***
       * @method every(<amount>, [fn])
       * @returns Array
       * @short Iterates through the range for every <amount>, calling [fn] if it is passed. Returns an array of each increment visited.
       * @extra In the case of date ranges, <amount> can also be a string, in which case it will increment a number of  units. Note that %(2).months()% first resolves to a number, which will be interpreted as milliseconds and is an approximation, so stepping through the actual months by passing %"2 months"% is usually preferable.
       * @example
       *
       *   Number.range(2, 8).every(2)                                       -> [2,4,6,8]
       *   Date.range(new Date(2003, 1), new Date(2003,3)).every("2 months") -> [...]
       *
       ***/
      'every': function(amount, fn) {
        var increment,
            precision,
            dio,
            unit,
            start   = this.start,
            end     = this.end,
            inverse = end < start,
            current = start,
            index   = 0,
            result  = [];

        if (!this.isValid()) {
          return [];
        }
        if (isFunction(amount)) {
          fn = amount;
          amount = null;
        }
        amount = amount || 1;
        if (isNumber(start)) {
          precision = getGreaterPrecision(start, amount);
          increment = function() {
            return incrementNumber(current, amount, precision);
          };
        } else if (isString(start)) {
          increment = function() {
            return incrementString(current, amount);
          };
        } else if (isDate(start)) {
          dio = getDateIncrementObject(amount);
          amount = dio[0];
          unit = dio[1];
          increment = function() {
            return incrementDate(current, amount, unit);
          };
        }
        // Avoiding infinite loops
        if (inverse && amount > 0) {
          amount *= -1;
        }
        while(inverse ? current >= end : current <= end) {
          result.push(current);
          if (fn) {
            fn(current, index);
          }
          current = increment();
          index++;
        }
        return result;
      },

      /***
       * @method union(<range>)
       * @returns Range
       * @short Returns a new range with the earliest starting point as its start, and the latest ending point as its end. If the two ranges do not intersect this will effectively remove the "gap" between them.
       * @example
       *
       *   Number.range(1, 3).union(Number.range(2, 5)) -> 1..5
       *   Date.range(new Date(2003, 1), new Date(2005, 1)).union(Date.range(new Date(2004, 1), new Date(2006, 1))) -> Jan 1, 2003..Jan 1, 2006
       *
       ***/
      'union': function(range) {
        return new Range(
          this.start < range.start ? this.start : range.start,
          this.end   > range.end   ? this.end   : range.end
        );
      },

      /***
       * @method intersect(<range>)
       * @returns Range
       * @short Returns a new range with the latest starting point as its start, and the earliest ending point as its end. If the two ranges do not intersect this will effectively produce an invalid range.
       * @example
       *
       *   Number.range(1, 5).intersect(Number.range(4, 8)) -> 4..5
       *   Date.range(new Date(2003, 1), new Date(2005, 1)).intersect(Date.range(new Date(2004, 1), new Date(2006, 1))) -> Jan 1, 2004..Jan 1, 2005
       *
       ***/
      'intersect': function(range) {
        if (range.start > this.end || range.end < this.start) {
          return new Range(NaN, NaN);
        }
        return new Range(
          this.start > range.start ? this.start : range.start,
          this.end   < range.end   ? this.end   : range.end
        );
      },

      /***
       * @method clone()
       * @returns Range
       * @short Clones the range.
       * @extra Members of the range will also be cloned.
       * @example
       *
       *   Number.range(1, 5).clone() -> Returns a copy of the range.
       *
       ***/
      'clone': function(range) {
        return new Range(this.start, this.end);
      },

      /***
       * @method clamp(<obj>)
       * @returns Mixed
       * @short Clamps <obj> to be within the range if it falls outside.
       * @example
       *
       *   Number.range(1, 5).clamp(8) -> 5
       *   Date.range(new Date(2010, 0), new Date(2012, 0)).clamp(new Date(2013, 0)) -> 2012-01
       *
       ***/
      'clamp': function(obj) {
        var clamped,
            start = this.start,
            end = this.end,
            min = end < start ? end : start,
            max = start > end ? start : end;
        if (obj < min) {
          clamped = min;
        } else if (obj > max) {
          clamped = max;
        } else {
          clamped = obj;
        }
        return cloneRangeMember(clamped);
      }

    });


    /***
     * @namespace Number
     * @method Number.range([start], [end])
     * @returns Range
     * @short Creates a new range between [start] and [end]. See %ranges% for more.
     * @example
     *
     *   Number.range(5, 10)
     *
     ***
     * @namespace String
     * @method String.range([start], [end])
     * @returns Range
     * @short Creates a new range between [start] and [end]. See %ranges% for more.
     * @example
     *
     *   String.range('a', 'z')
     *
     ***
     * @namespace Date
     * @method Date.range([start], [end])
     * @returns Range
     * @short Creates a new range between [start] and [end].
     * @extra If either [start] or [end] are null, they will default to the current date. See %ranges% for more.
     * @example
     *
     *   Date.range('today', 'tomorrow')
     *
     ***/

     function extendRangeConstructor(klass, constructor) {
       extend(klass, { 'range': constructor }, false);
     }

     var PrimitiveRangeConstructor = function(start, end) {
       return new Range(start, end);
     };

     var DateRangeConstructor = function(start, end) {
       if (dateConstructorIsExtended()) {
         if (arguments.length === 1 && isString(start)) {
           return createDateRangeFromString(start);
         }
         start = getSugarExtendedDate(start);
         end   = getSugarExtendedDate(end);
       } else {
         start = getSimpleDate(start);
         end   = getSimpleDate(end);
       }
       return new Range(start, end);
     };

     extendRangeConstructor(Number, PrimitiveRangeConstructor);
     extendRangeConstructor(String, PrimitiveRangeConstructor);
     extendRangeConstructor(Date, DateRangeConstructor);

    /***
     * @namespace Number
     *
     ***/

    extend(Number, {

      /***
       * @method upto(<num>, [fn], [step] = 1)
       * @returns Array
       * @short Returns an array containing numbers from the number up to <num>.
       * @extra Optionally calls [fn] callback for each number in that array. [step] allows multiples greater than 1.
       * @example
       *
       *   (2).upto(6) -> [2, 3, 4, 5, 6]
       *   (2).upto(6, function(n) {
       *     // This function is called 5 times receiving n as the value.
       *   });
       *   (2).upto(8, null, 2) -> [2, 4, 6, 8]
       *
       ***/
      'upto': function(num, fn, step) {
        return new Range(this, num).every(step, fn);
      },

       /***
       * @method clamp([start] = Infinity, [end] = Infinity)
       * @returns Number
       * @short Constrains the number so that it is between [start] and [end].
       * @extra This will build a range object that has an equivalent %clamp% method.
       * @example
       *
       *   (3).clamp(50, 100)  -> 50
       *   (85).clamp(50, 100) -> 85
       *
       ***/
      'clamp': function(start, end) {
        return new Range(start, end).clamp(this);
      },

       /***
       * @method cap([max] = Infinity)
       * @returns Number
       * @short Constrains the number so that it is no greater than [max].
       * @extra This will build a range object that has an equivalent %cap% method.
       * @example
       *
       *   (100).cap(80) -> 80
       *
       ***/
      'cap': function(max) {
        return new Range(Undefined, max).clamp(this);
      }

    });

    /***
     * @method downto(<num>, [fn], [step] = 1)
     * @returns Array
     * @short Returns an array containing numbers from the number down to <num>.
     * @extra Optionally calls [fn] callback for each number in that array. [step] allows multiples greater than 1.
     * @example
     *
     *   (8).downto(3) -> [8, 7, 6, 5, 4, 3]
     *   (8).downto(3, function(n) {
     *     // This function is called 6 times receiving n as the value.
     *   });
     *   (8).downto(2, null, 2) -> [8, 6, 4, 2]
     *
     ***/
    alias(Number, 'downto', 'upto');


    /***
     * @namespace Array
     *
     ***/

    extend(Array, {

      'create': function(range) {
        return range.every();
      }

    }, false, function(a) { return a instanceof Range; });

    /***
     * @module RegExp
     * @dependency core
     * @description Escaping regexes and manipulating their flags.
     *
     * Note here that methods on the RegExp class like .exec and .test will fail in the current version of SpiderMonkey being
     * used by CouchDB when using shorthand regex notation like /foo/. This is the reason for the intermixed use of shorthand
     * and compiled regexes here. If you're using JS in CouchDB, it is safer to ALWAYS compile your regexes from a string.
     *
     ***/

    extend(RegExp, {

     /***
      * @method RegExp.escape(<str> = '')
      * @returns String
      * @short Escapes all RegExp tokens in a string.
      * @example
      *
      *   RegExp.escape('really?')      -> 'really\?'
      *   RegExp.escape('yes.')         -> 'yes\.'
      *   RegExp.escape('(not really)') -> '\(not really\)'
      *
      ***/
      'escape': function(str) {
        return escapeRegExp(str);
      }

    }, false);

    extend(RegExp, {

     /***
      * @method getFlags()
      * @returns String
      * @short Returns the flags of the regex as a string.
      * @example
      *
      *   /texty/gim.getFlags('testy') -> 'gim'
      *
      ***/
      'getFlags': function() {
        return getRegExpFlags(this);
      },

     /***
      * @method setFlags(<flags>)
      * @returns RegExp
      * @short Sets the flags on a regex and retuns a copy.
      * @example
      *
      *   /texty/.setFlags('gim') -> now has global, ignoreCase, and multiline set
      *
      ***/
      'setFlags': function(flags) {
        return RegExp(this.source, flags);
      },

     /***
      * @method addFlag(<flag>)
      * @returns RegExp
      * @short Adds <flag> to the regex.
      * @example
      *
      *   /texty/.addFlag('g') -> now has global flag set
      *
      ***/
      'addFlag': function(flag) {
        return RegExp(this.source, getRegExpFlags(this, flag));
      },

     /***
      * @method removeFlag(<flag>)
      * @returns RegExp
      * @short Removes <flag> from the regex.
      * @example
      *
      *   /texty/g.removeFlag('g') -> now has global flag removed
      *
      ***/
      'removeFlag': function(flag) {
        return RegExp(this.source, getRegExpFlags(this).replace(flag, ''));
      }

    });

    /***
     * @module String
     * @dependency core
     * @description String manupulation, escaping, encoding, truncation, and:conversion.
     *
     ***/

    var HTML_CODE_MATCH = /&#(x)?([\w\d]{0,5});/i;

    var HTML_VOID_ELEMENTS = [
      'area','base','br','col','command','embed','hr','img',
      'input','keygen','link','meta','param','source','track','wbr'
    ];

    function getInflector() {
      return String.Inflector;
    }

    function getAcronym(word) {
      var inflector = getInflector();
      var word = inflector && inflector.acronyms[word];
      if (isString(word)) {
        return word;
      }
    }

    function checkRepeatRange(num) {
      num = +num;
      if (num < 0 || num === Infinity) {
        throw new RangeError('Invalid number');
      }
      return num;
    }

    function padString(num, padding) {
      return repeatString(isDefined(padding) ? padding : ' ', num);
    }

    function truncateString(str, length, from, ellipsis, split) {
      var str1, str2, len1, len2;
      if (str.length <= length) {
        return str.toString();
      }
      ellipsis = isUndefined(ellipsis) ? '...' : ellipsis;
      switch(from) {
        case 'left':
          str2 = split ? truncateOnWord(str, length, true) : str.slice(str.length - length);
          return ellipsis + str2;
        case 'middle':
          len1 = ceil(length / 2);
          len2 = floor(length / 2);
          str1 = split ? truncateOnWord(str, len1) : str.slice(0, len1);
          str2 = split ? truncateOnWord(str, len2, true) : str.slice(str.length - len2);
          return str1 + ellipsis + str2;
        default:
          str1 = split ? truncateOnWord(str, length) : str.slice(0, length);
          return str1 + ellipsis;
      }
    }

    function stringEach(str, search, fn) {
      var chunks, chunk, reg, result = [];
      if (isFunction(search)) {
        fn = search;
        reg = /[\s\S]/g;
      } else if (!search) {
        reg = /[\s\S]/g;
      } else if (isString(search)) {
        reg = RegExp(escapeRegExp(search), 'gi');
      } else if (isRegExp(search)) {
        reg = RegExp(search.source, getRegExpFlags(search, 'g'));
      }
      // Getting the entire array of chunks up front as we need to
      // pass this into the callback function as an argument.
      chunks = runGlobalMatch(str, reg);

      if (chunks) {
        for(var i = 0, len = chunks.length, r; i < len; i++) {
          chunk = chunks[i];
          result[i] = chunk;
          if (fn) {
            r = fn.call(str, chunk, i, chunks);
            if (r === false) {
              break;
            } else if (isDefined(r)) {
              result[i] = r;
            }
          }
        }
      }
      return result;
    }

    // "match" in < IE9 has enumable properties that will confuse for..in
    // loops, so ensure that the match is a normal array by manually running
    // "exec". Note that this method is also slightly more performant.
    function runGlobalMatch(str, reg) {
      var result = [], match, lastLastIndex;
      while ((match = reg.exec(str)) != null) {
        if (reg.lastIndex === lastLastIndex) {
          reg.lastIndex += 1;
        } else {
          result.push(match[0]);
        }
        lastLastIndex = reg.lastIndex;
      }
      return result;
    }

    function eachWord(str, fn) {
      return stringEach(str.trim(), /\S+/g, fn);
    }

    function stringCodes(str, fn) {
      var codes = [], i, len;
      for(i = 0, len = str.length; i < len; i++) {
        var code = str.charCodeAt(i);
        codes.push(code);
        if (fn) fn.call(str, code, i);
      }
      return codes;
    }

    function shiftChar(str, n) {
      var result = '';
      n = n || 0;
      stringCodes(str, function(c) {
        result += chr(c + n);
      });
      return result;
    }

    function underscore(str) {
      var inflector = getInflector();
      return str
        .replace(/[-\s]+/g, '_')
        .replace(inflector && inflector.acronymRegExp, function(acronym, index) {
          return (index > 0 ? '_' : '') + acronym.toLowerCase();
        })
        .replace(/([A-Z\d]+)([A-Z][a-z])/g,'$1_$2')
        .replace(/([a-z\d])([A-Z])/g,'$1_$2')
        .toLowerCase();
    }

    function spacify(str) {
      return underscore(str).replace(/_/g, ' ');
    }

    function capitalize(str, all) {
      var lastResponded;
      return str.toLowerCase().replace(all ? /[^']/g : /^\S/, function(lower) {
        var upper = lower.toUpperCase(), result;
        result = lastResponded ? lower : upper;
        lastResponded = upper !== lower;
        return result;
      });
    }

    function reverseString(str) {
      return str.split('').reverse().join('');
    }

    function stringFirst(str, num) {
      if (isUndefined(num)) num = 1;
      return str.substr(0, num);
    }

    function stringLast(str, num) {
      if (isUndefined(num)) num = 1;
      var start = str.length - num < 0 ? 0 : str.length - num;
      return str.substr(start);
    }

    function stringFrom(str, from) {
      return str.slice(numberOrIndex(str, from, true));
    }

    function stringTo(str, to) {
      if (isUndefined(to)) to = str.length;
      return str.slice(0, numberOrIndex(str, to));
    }

    function stringAssign(str, args) {
      var obj = {};
      for (var i = 0; i < args.length; i++) {
        var a = args[i];
        if (isObjectType(a)) {
          simpleMerge(obj, a);
        } else {
          obj[i + 1] = a;
        }
      }
      return str.replace(/\{([^{]+?)\}/g, function(m, key) {
        return hasOwnProperty(obj, key) ? obj[key] : m;
      });
    }

    function isBlank(str) {
      return str.trim().length === 0;
    }

    function truncateOnWord(str, limit, fromLeft) {
      if (fromLeft) {
        return reverseString(truncateOnWord(reverseString(str), limit));
      }
      var reg = RegExp('(?=[' + getTrimmableCharacters() + '])');
      var words = str.split(reg);
      var count = 0;
      return words.filter(function(word) {
        count += word.length;
        return count <= limit;
      }).join('');
    }

    function convertHTMLCodes(str) {
      return str.replace(HTML_CODE_MATCH, function(full, hex, code) {
        return String.fromCharCode(parseInt(code, hex ? 16 : 10));
      });
    }

    function tagIsVoid(tag) {
      return HTML_VOID_ELEMENTS.indexOf(tag.toLowerCase()) !== -1;
    }

    function replaceTags(str, args, strip) {
      var lastIndex = args.length - 1, lastArg = args[lastIndex], replacementFn, tags, src, reg;
      if (isFunction(lastArg)) {
        replacementFn = lastArg;
        args.length = lastIndex;
      }
      tags = args.map(function(tag) {
        return escapeRegExp(tag);
      }).join('|');
      src = tags.replace('all', '') || '[^\\s>]+';
      src = '<(\\/)?(' + src + ')(\\s+[^<>]*?)?\\s*(\\/)?>';
      reg = RegExp(src, 'gi');
      return runTagReplacements(str.toString(), reg, strip, replacementFn);
    }

    function runTagReplacements(str, reg, strip, replacementFn, fullString) {

      var match;
      var result = '';
      var currentIndex = 0;
      var currentlyOpenTagName;
      var currentlyOpenTagAttributes;
      var currentlyOpenTagCount = 0;

      function processTag(index, tagName, attributes, tagLength) {
        var content = str.slice(currentIndex, index), replacement;
        if (replacementFn) {
          replacement = replacementFn.call(fullString, tagName, content, attributes, fullString);
          if (isDefined(replacement)) {
            content = replacement;
          } else if (!strip) {
            content = '';
          }
        } else if (!strip) {
          content = '';
        }
        result += runTagReplacements(content, reg, strip, replacementFn, fullString);
        currentIndex = index + (tagLength || 0);
      }

      fullString = fullString || str;
      reg = RegExp(reg.source, 'gi');

      while(match = reg.exec(str)) {

        var tagName         = match[2];
        var attributes      = (match[3]|| '').slice(1);
        var isClosingTag    = !!match[1];
        var isSelfClosing   = !!match[4];
        var tagLength       = match[0].length;
        var isOpeningTag    = !isClosingTag && !isSelfClosing && !tagIsVoid(tagName);
        var isSameAsCurrent = tagName === currentlyOpenTagName;

        if (!currentlyOpenTagName) {
          result += str.slice(currentIndex, match.index);
          currentIndex = match.index;
        }

        if (isOpeningTag) {
          if (!currentlyOpenTagName) {
            currentlyOpenTagName = tagName;
            currentlyOpenTagAttributes = attributes;
            currentlyOpenTagCount++;
            currentIndex += tagLength;
          } else if (isSameAsCurrent) {
            currentlyOpenTagCount++;
          }
        } else if (isClosingTag && isSameAsCurrent) {
          currentlyOpenTagCount--;
          if (currentlyOpenTagCount === 0) {
            processTag(match.index, currentlyOpenTagName, currentlyOpenTagAttributes, tagLength);
            currentlyOpenTagName       = null;
            currentlyOpenTagAttributes = null;
          }
        } else if (!currentlyOpenTagName) {
          processTag(match.index, tagName, attributes, tagLength);
        }
      }
      if (currentlyOpenTagName) {
        processTag(str.length, currentlyOpenTagName, currentlyOpenTagAttributes);
      }
      result += str.slice(currentIndex);
      return result;
    }

    function numberOrIndex(str, n, from) {
      if (isString(n)) {
        n = str.indexOf(n);
        if (n === -1) {
          n = from ? str.length : 0;
        }
      }
      return n;
    }

    var encodeBase64, decodeBase64;

    function buildBase64(key) {
      var encodeAscii, decodeAscii;

      function catchEncodingError(fn) {
        return function(str) {
          try {
            return fn(str);
          } catch(e) {
            return '';
          }
        }
      }

      if (typeof Buffer !== 'undefined') {
        encodeBase64 = function(str) {
          return new Buffer(str).toString('base64');
        }
        decodeBase64 = function(str) {
          return new Buffer(str, 'base64').toString('utf8');
        }
        return;
      }
      if (typeof btoa !== 'undefined') {
        encodeAscii = catchEncodingError(btoa);
        decodeAscii = catchEncodingError(atob);
      } else {
        var base64reg = /[^A-Za-z0-9\+\/\=]/g;
        encodeAscii = function(str) {
          var output = '';
          var chr1, chr2, chr3;
          var enc1, enc2, enc3, enc4;
          var i = 0;
          do {
            chr1 = str.charCodeAt(i++);
            chr2 = str.charCodeAt(i++);
            chr3 = str.charCodeAt(i++);
            enc1 = chr1 >> 2;
            enc2 = ((chr1 & 3) << 4) | (chr2 >> 4);
            enc3 = ((chr2 & 15) << 2) | (chr3 >> 6);
            enc4 = chr3 & 63;
            if (isNaN(chr2)) {
              enc3 = enc4 = 64;
            } else if (isNaN(chr3)) {
              enc4 = 64;
            }
            output = output + key.charAt(enc1) + key.charAt(enc2) + key.charAt(enc3) + key.charAt(enc4);
            chr1 = chr2 = chr3 = '';
            enc1 = enc2 = enc3 = enc4 = '';
          } while (i < str.length);
          return output;
        }
        decodeAscii = function(input) {
          var output = '';
          var chr1, chr2, chr3;
          var enc1, enc2, enc3, enc4;
          var i = 0;
          if (input.match(base64reg)) {
            return '';
          }
          input = input.replace(/[^A-Za-z0-9\+\/\=]/g, '');
          do {
            enc1 = key.indexOf(input.charAt(i++));
            enc2 = key.indexOf(input.charAt(i++));
            enc3 = key.indexOf(input.charAt(i++));
            enc4 = key.indexOf(input.charAt(i++));
            chr1 = (enc1 << 2) | (enc2 >> 4);
            chr2 = ((enc2 & 15) << 4) | (enc3 >> 2);
            chr3 = ((enc3 & 3) << 6) | enc4;
            output = output + chr(chr1);
            if (enc3 != 64) {
              output = output + chr(chr2);
            }
            if (enc4 != 64) {
              output = output + chr(chr3);
            }
            chr1 = chr2 = chr3 = '';
            enc1 = enc2 = enc3 = enc4 = '';
          } while (i < input.length);
          return output;
        }
      }
      encodeBase64 = function(str) {
        return encodeAscii(unescape(encodeURIComponent(str)));
      }
      decodeBase64 = function(str) {
        return decodeURIComponent(escape(decodeAscii(str)));
      }
    }

    function buildStartEndsWith() {
      var override = true;
      try {
        // If String#startsWith does not exist or alternately if it exists but
        // correctly throws an error here, then there is no need to flag the
        // method to override the existing implementation.
        ''.startsWith(/./);
      } catch(e) {
        override = false;
      }
      extend(String, {


        /***
         * @method startsWith(<find>, [pos] = 0, [case] = true)
         * @returns Boolean
         * @short Returns true if the string starts with <find>.
         * @extra <find> may be either a string or regex. Search begins at [pos], which defaults to the entire string. Case sensitive if [case] is true.
         * @example
         *
         *   'hello'.startsWith('hell')           -> true
         *   'hello'.startsWith(/[a-h]/)          -> true
         *   'hello'.startsWith('HELL')           -> false
         *   'hello'.startsWith('ell', 1)         -> true
         *   'hello'.startsWith('HELL', 0, false) -> true
         *
         ***/
        'startsWith': function(reg) {
          var args = arguments, pos = args[1], c = args[2], str = this, source;
          if(pos) str = str.slice(pos);
          if(isUndefined(c)) c = true;
          source = isRegExp(reg) ? reg.source.replace('^', '') : escapeRegExp(reg);
          return RegExp('^' + source, c ? '' : 'i').test(str);
        },

        /***
         * @method endsWith(<find>, [pos] = length, [case] = true)
         * @returns Boolean
         * @short Returns true if the string ends with <find>.
         * @extra <find> may be either a string or regex. Search ends at [pos], which defaults to the entire string. Case sensitive if [case] is true.
         * @example
         *
         *   'jumpy'.endsWith('py')            -> true
         *   'jumpy'.endsWith(/[q-z]/)         -> true
         *   'jumpy'.endsWith('MPY')           -> false
         *   'jumpy'.endsWith('mp', 4)         -> false
         *   'jumpy'.endsWith('MPY', 5, false) -> true
         *
         ***/
        'endsWith': function(reg) {
          var args = arguments, pos = args[1], c = args[2], str = this, source;
          if(isDefined(pos)) str = str.slice(0, pos);
          if(isUndefined(c)) c = true;
          source = isRegExp(reg) ? reg.source.replace('$', '') : escapeRegExp(reg);
          return RegExp(source + '$', c ? '' : 'i').test(str);
        }
      }, true, function(reg) { return isRegExp(reg) || arguments.length > 2; });
    }

    extend(String, {

      /***
       * @method has(<find>)
       * @returns Boolean
       * @short Returns true if the string matches <find>.
       * @extra <find> may be a string or regex.
       * @example
       *
       *   'jumpy'.has('py')     -> true
       *   'broken'.has(/[a-n]/) -> true
       *   'broken'.has(/[s-z]/) -> false
       *
       ***/
      'has': function(find) {
        return this.search(isRegExp(find) ? find : escapeRegExp(find)) !== -1;
      },

      /***
       * @method repeat([num] = 0)
       * @returns String
       * @short Returns the string repeated [num] times.
       * @example
       *
       *   'jumpy'.repeat(2) -> 'jumpyjumpy'
       *   'a'.repeat(5)     -> 'aaaaa'
       *   'a'.repeat(0)     -> ''
       *
       ***/
      'repeat': function(num) {
        num = checkRepeatRange(num);
        return repeatString(this, num);
      }

    }, true, true);

    extend(String, {

      /***
         * @method escapeRegExp()
         * @returns String
         * @short Escapes all RegExp tokens in the string.
         * @example
         *
         *   'really?'.escapeRegExp()       -> 'really\?'
         *   'yes.'.escapeRegExp()         -> 'yes\.'
         *   '(not really)'.escapeRegExp() -> '\(not really\)'
         *
         ***/
       'escapeRegExp': function() {
         return escapeRegExp(this);
       },

       /***
        * @method escapeURL([param] = false)
        * @returns String
        * @short Escapes characters in a string to make a valid URL.
        * @extra If [param] is true, it will also escape valid URL characters for use as a URL parameter.
        * @example
        *
        *   'http://foo.com/"bar"'.escapeURL()     -> 'http://foo.com/%22bar%22'
        *   'http://foo.com/"bar"'.escapeURL(true) -> 'http%3A%2F%2Ffoo.com%2F%22bar%22'
        *
        ***/
      'escapeURL': function(param) {
        return param ? encodeURIComponent(this) : encodeURI(this);
      },

       /***
        * @method unescapeURL([partial] = false)
        * @returns String
        * @short Restores escaped characters in a URL escaped string.
        * @extra If [partial] is true, it will only unescape non-valid URL characters. [partial] is included here for completeness, but should very rarely be needed.
        * @example
        *
        *   'http%3A%2F%2Ffoo.com%2Fthe%20bar'.unescapeURL()     -> 'http://foo.com/the bar'
        *   'http%3A%2F%2Ffoo.com%2Fthe%20bar'.unescapeURL(true) -> 'http%3A%2F%2Ffoo.com%2Fthe bar'
        *
        ***/
      'unescapeURL': function(param) {
        return param ? decodeURI(this) : decodeURIComponent(this);
      },

       /***
        * @method escapeHTML()
        * @returns String
        * @short Converts HTML characters to their entity equivalents.
        * @example
        *
        *   '<p>some text</p>'.escapeHTML() -> '&lt;p&gt;some text&lt;/p&gt;'
        *   'one & two'.escapeHTML()        -> 'one &amp; two'
        *
        ***/
      'escapeHTML': function() {
        return this.replace(/&/g,  '&amp;' )
                   .replace(/</g,  '&lt;'  )
                   .replace(/>/g,  '&gt;'  )
                   .replace(/"/g,  '&quot;')
                   .replace(/'/g,  '&apos;')
                   .replace(/\//g, '&#x2f;');
      },

       /***
        * @method unescapeHTML([partial] = false)
        * @returns String
        * @short Restores escaped HTML characters.
        * @example
        *
        *   '&lt;p&gt;some text&lt;/p&gt;'.unescapeHTML() -> '<p>some text</p>'
        *   'one &amp; two'.unescapeHTML()                -> 'one & two'
        *
        ***/
      'unescapeHTML': function() {
        return convertHTMLCodes(this)
                   .replace(/&lt;/g,   '<')
                   .replace(/&gt;/g,   '>')
                   .replace(/&nbsp;/g, ' ')
                   .replace(/&quot;/g, '"')
                   .replace(/&apos;/g, "'")
                   .replace(/&amp;/g,  '&');
      },

       /***
        * @method encodeBase64()
        * @returns String
        * @short Encodes the string into base64 encoding.
        * @extra This method wraps native methods when available, and uses a custom implementation when not available. It can also handle Unicode string encodings.
        * @example
        *
        *   'gonna get encoded!'.encodeBase64()  -> 'Z29ubmEgZ2V0IGVuY29kZWQh'
        *   'http://twitter.com/'.encodeBase64() -> 'aHR0cDovL3R3aXR0ZXIuY29tLw=='
        *
        ***/
      'encodeBase64': function() {
        return encodeBase64(this);
      },

       /***
        * @method decodeBase64()
        * @returns String
        * @short Decodes the string from base64 encoding.
        * @extra This method wraps native methods when available, and uses a custom implementation when not available. It can also handle Unicode string encodings.
        * @example
        *
        *   'aHR0cDovL3R3aXR0ZXIuY29tLw=='.decodeBase64() -> 'http://twitter.com/'
        *   'anVzdCBnb3QgZGVjb2RlZA=='.decodeBase64()     -> 'just got decoded!'
        *
        ***/
      'decodeBase64': function() {
        return decodeBase64(this);
      },

      /***
       * @method each([search], [fn])
       * @returns Array
       * @short Runs callback [fn] against each occurence of [search] or each character if [search] is not provided.
       * @extra Returns an array of matches. [search] may be either a string or regex, and defaults to every character in the string. If [fn] returns false at any time it will break out of the loop.
       * @example
       *
       *   'jumpy'.each() -> ['j','u','m','p','y']
       *   'jumpy'.each(/[r-z]/) -> ['u','y']
       *   'jumpy'.each(/[r-z]/, function(m) {
       *     // Called twice: "u", "y"
       *   });
       *
       ***/
      'each': function(search, fn) {
        return stringEach(this, search, fn);
      },

      /***
       * @method map(<fn>, [scope])
       * @returns String
       * @short Maps the string to another string containing the values that are the result of calling <fn> on each element.
       * @extra [scope] is the %this% object. <fn> is a function, it receives three arguments: the current character, the current index, and a reference to the string.
       * @example
       *
       *   'jumpy'.map(function(l) {
       *     return String.fromCharCode(l.charCodeAt(0) + 1);
       *
       *   }); -> Returns the string with each character shifted one code point down.
       *
       ***/
      'map': function(map, scope) {
        var str = this.toString();
        if (isFunction(map)) {
          var fn = map;
          map = function(letter, i, arr) {
            return fn.call(scope, letter, i, str);
          }
        }
        return str.split('').map(map, scope).join('');
      },

      /***
       * @method shift(<n>)
       * @returns Array
       * @short Shifts each character in the string <n> places in the character map.
       * @example
       *
       *   'a'.shift(1)  -> 'b'
       *   'ク'.shift(1) -> 'グ'
       *
       ***/
      'shift': function(n) {
        return shiftChar(this, n);
      },

      /***
       * @method codes([fn])
       * @returns Array
       * @short Runs callback [fn] against each character code in the string. Returns an array of character codes.
       * @example
       *
       *   'jumpy'.codes() -> [106,117,109,112,121]
       *   'jumpy'.codes(function(c) {
       *     // Called 5 times: 106, 117, 109, 112, 121
       *   });
       *
       ***/
      'codes': function(fn) {
        return stringCodes(this, fn);
      },

      /***
       * @method chars([fn])
       * @returns Array
       * @short Runs callback [fn] against each character in the string. Returns an array of characters.
       * @example
       *
       *   'jumpy'.chars() -> ['j','u','m','p','y']
       *   'jumpy'.chars(function(c) {
       *     // Called 5 times: "j","u","m","p","y"
       *   });
       *
       ***/
      'chars': function(fn) {
        return stringEach(this, fn);
      },

      /***
       * @method words([fn])
       * @returns Array
       * @short Runs callback [fn] against each word in the string. Returns an array of words.
       * @extra A "word" here is defined as any sequence of non-whitespace characters.
       * @example
       *
       *   'broken wear'.words() -> ['broken','wear']
       *   'broken wear'.words(function(w) {
       *     // Called twice: "broken", "wear"
       *   });
       *
       ***/
      'words': function(fn) {
        return eachWord(this, fn);
      },

      /***
       * @method lines([fn])
       * @returns Array
       * @short Runs callback [fn] against each line in the string. Returns an array of lines.
       * @example
       *
       *   'broken wear\nand\njumpy jump'.lines() -> ['broken wear','and','jumpy jump']
       *   'broken wear\nand\njumpy jump'.lines(function(l) {
       *     // Called three times: "broken wear", "and", "jumpy jump"
       *   });
       *
       ***/
      'lines': function(fn) {
        return stringEach(this.trim(), /^.*$/gm, fn);
      },

      /***
       * @method paragraphs([fn])
       * @returns Array
       * @short Runs callback [fn] against each paragraph in the string. Returns an array of paragraphs.
       * @extra A paragraph here is defined as a block of text bounded by two or more line breaks.
       * @example
       *
       *   'Once upon a time.\n\nIn the land of oz...'.paragraphs() -> ['Once upon a time.','In the land of oz...']
       *   'Once upon a time.\n\nIn the land of oz...'.paragraphs(function(p) {
       *     // Called twice: "Once upon a time.", "In teh land of oz..."
       *   });
       *
       ***/
      'paragraphs': function(fn) {
        var paragraphs = this.trim().split(/[\r\n]{2,}/);
        paragraphs = paragraphs.map(function(p) {
          if (fn) var s = fn.call(p);
          return s ? s : p;
        });
        return paragraphs;
      },

      /***
       * @method isBlank()
       * @returns Boolean
       * @short Returns true if the string has a length of 0 or contains only whitespace.
       * @example
       *
       *   ''.isBlank()      -> true
       *   '   '.isBlank()   -> true
       *   'noway'.isBlank() -> false
       *
       ***/
      'isBlank': function() {
        return isBlank(this);
      },

      /***
       * @method add(<str>, [index] = length)
       * @returns String
       * @short Adds <str> at [index]. Negative values are also allowed.
       * @extra %insert% is provided as an alias, and is generally more readable when using an index.
       * @example
       *
       *   'schfifty'.add(' five')      -> schfifty five
       *   'dopamine'.insert('e', 3)       -> dopeamine
       *   'spelling eror'.insert('r', -3) -> spelling error
       *
       ***/
      'add': function(str, index) {
        index = isUndefined(index) ? this.length : index;
        return this.slice(0, index) + str + this.slice(index);
      },

      /***
       * @method remove(<f>)
       * @returns String
       * @short Removes any part of the string that matches <f>.
       * @extra <f> can be a stringuor a regex. When it is a string only the first match will be removed.
       * @example
       *
       *   'schfifty five'.remove('f')      -> 'schifty five'
       *   'schfifty five'.remove(/f/g)     -> 'schity ive'
       *   'schfifty five'.remove(/[a-f]/g) -> 'shity iv'
       *
       ***/
      'remove': function(f) {
        return this.replace(f, '');
      },

      /***
       * @method reverse()
       * @returns String
       * @short Reverses the string.
       * @example
       *
       *   'jumpy'.reverse()        -> 'ypmuj'
       *   'lucky charms'.reverse() -> 'smrahc ykcul'
       *
       ***/
      'reverse': function() {
        return reverseString(this);
      },

      /***
       * @method compact()
       * @returns String
       * @short Compacts all white space in the string to a single space and trims the ends.
       * @example
       *
       *   'too \n much \n space'.compact() -> 'too much space'
       *   'enough \n '.compact()           -> 'enought'
       *
       ***/
      'compact': function() {
        return this.trim().replace(/([\r\n\s　])+/g, function(match, whitespace){
          return whitespace === '　' ? whitespace : ' ';
        });
      },

      /***
       * @method at(<index>, [loop] = true)
       * @returns String or Array
       * @short Gets the character(s) at a given index.
       * @extra When [loop] is true, overshooting the end of the string (or the beginning) will begin counting from the other end. As an alternate syntax, passing multiple indexes will get the characters at those indexes.
       * @example
       *
       *   'jumpy'.at(0)               -> 'j'
       *   'jumpy'.at(2)               -> 'm'
       *   'jumpy'.at(5)               -> 'j'
       *   'jumpy'.at(5, false)        -> ''
       *   'jumpy'.at(-1)              -> 'y'
       *   'lucky charms'.at(2,4,6,8) -> ['u','k','y',c']
       *
       ***/
      'at': function() {
        // Optimized: no leaking arguments
        var args = [], $i; for($i = 0; $i < arguments.length; $i++) args.push(arguments[$i]);
        return getEntriesForIndexes(this, args, true);
      },

      /***
       * @method from([index] = 0)
       * @returns String
       * @short Returns a section of the string starting from [index].
       * @example
       *
       *   'lucky charms'.from()   -> 'lucky charms'
       *   'lucky charms'.from(7)  -> 'harms'
       *
       ***/
      'from': function(from) {
        return stringFrom(this, from);
      },

      /***
       * @method to([index] = end)
       * @returns String
       * @short Returns a section of the string ending at [index].
       * @example
       *
       *   'lucky charms'.to()   -> 'lucky charms'
       *   'lucky charms'.to(7)  -> 'lucky ch'
       *
       ***/
      'to': function(to) {
        return stringTo(this, to);
      },

      /***
       * @method dasherize()
       * @returns String
       * @short Converts underscores and camel casing to hypens.
       * @example
       *
       *   'a_farewell_to_arms'.dasherize() -> 'a-farewell-to-arms'
       *   'capsLock'.dasherize()           -> 'caps-lock'
       *
       ***/
      'dasherize': function() {
        return underscore(this).replace(/_/g, '-');
      },

      /***
       * @method underscore()
       * @returns String
       * @short Converts hyphens and camel casing to underscores.
       * @example
       *
       *   'a-farewell-to-arms'.underscore() -> 'a_farewell_to_arms'
       *   'capsLock'.underscore()           -> 'caps_lock'
       *
       ***/
      'underscore': function() {
        return underscore(this);
      },

      /***
       * @method camelize([first] = true)
       * @returns String
       * @short Converts underscores and hyphens to camel case. If [first] is true the first letter will also be capitalized.
       * @extra If the Inflections package is included acryonyms can also be defined that will be used when camelizing.
       * @example
       *
       *   'caps_lock'.camelize()              -> 'CapsLock'
       *   'moz-border-radius'.camelize()      -> 'MozBorderRadius'
       *   'moz-border-radius'.camelize(false) -> 'mozBorderRadius'
       *
       ***/
      'camelize': function(first) {
        return underscore(this).replace(/(^|_)([^_]+)/g, function(match, pre, word, index) {
          var acronym = getAcronym(word), cap = first !== false || index > 0;
          if (acronym) return cap ? acronym : acronym.toLowerCase();
          return cap ? capitalize(word) : word;
        });
      },

      /***
       * @method spacify()
       * @returns String
       * @short Converts camel case, underscores, and hyphens to a properly spaced string.
       * @example
       *
       *   'camelCase'.spacify()                         -> 'camel case'
       *   'an-ugly-string'.spacify()                    -> 'an ugly string'
       *   'oh-no_youDid-not'.spacify().capitalize(true) -> 'something else'
       *
       ***/
      'spacify': function() {
        return spacify(this);
      },

      /***
       * @method stripTags([tag1], [tag2], ...)
       * @returns String
       * @short Strips HTML tags from the string.
       * @extra Tags to strip may be enumerated in the parameters, otherwise will strip all. A single function may be passed to this method as the final argument which will allow case by case replacements. This function arguments are the tag name, tag content, tag attributes, and the string itself. If this function returns a string, then it will be used for the replacement. If it returns %undefined%, the tags will be stripped normally.
       * @example
       *
       *   '<p>just <b>some</b> text</p>'.stripTags()    -> 'just some text'
       *   '<p>just <b>some</b> text</p>'.stripTags('p') -> 'just <b>some</b> text'
       *   '<p>hi!</p>'.stripTags('p', function(tag, content) {
       *     return '|' + content + '|';
       *   }); -> '|hi!|'
       *
       ***/
      'stripTags': function() {
        // Optimized: no leaking arguments (flat)
        var args = [], $i; for($i = 0; $i < arguments.length; $i++) args = args.concat(arguments[$i]);
        return replaceTags(this, args, true);
      },

      /***
       * @method removeTags([tag1], [tag2], ...)
       * @returns String
       * @short Removes HTML tags and their contents from the string.
       * @extra Tags to remove may be enumerated in the parameters, otherwise will remove all. A single function may be passed to this method as the final argument which will allow case by case replacements. This function arguments are the tag name, tag content, tag attributes, and the string itself. If this function returns a string, then it will be used for the replacement. If it returns %undefined%, the tags will be removed normally.
       * @example
       *
       *   '<p>just <b>some</b> text</p>'.removeTags()    -> ''
       *   '<p>just <b>some</b> text</p>'.removeTags('b') -> '<p>just text</p>'
       *   '<p>hi!</p>'.removeTags('p', function(tag, content) {
       *     return 'bye!';
       *   }); -> 'bye!'
       *
       ***/
      'removeTags': function() {
        // Optimized: no leaking arguments (flat)
        var args = [], $i; for($i = 0; $i < arguments.length; $i++) args = args.concat(arguments[$i]);
        return replaceTags(this, args, false);
      },

      /***
       * @method truncate(<length>, [from] = 'right', [ellipsis] = '...')
       * @returns String
       * @short Truncates a string.
       * @extra [from] can be %'right'%, %'left'%, or %'middle'%. If the string is shorter than <length>, [ellipsis] will not be added.
       * @example
       *
       *   'sittin on the dock of the bay'.truncate(18)           -> 'just sittin on the do...'
       *   'sittin on the dock of the bay'.truncate(18, 'left')   -> '...the dock of the bay'
       *   'sittin on the dock of the bay'.truncate(18, 'middle') -> 'just sitt...of the bay'
       *
       ***/
      'truncate': function(length, from, ellipsis) {
        return truncateString(this, length, from, ellipsis);
      },

      /***
       * @method truncateOnWord(<length>, [from] = 'right', [ellipsis] = '...')
       * @returns String
       * @short Truncates a string without splitting up words.
       * @extra [from] can be %'right'%, %'left'%, or %'middle'%. If the string is shorter than <length>, [ellipsis] will not be added.
       * @example
       *
       *   'here we go'.truncateOnWord(5)               -> 'here...'
       *   'here we go'.truncateOnWord(5, 'left')       -> '...we go'
       *
       ***/
      'truncateOnWord': function(length, from, ellipsis) {
        return truncateString(this, length, from, ellipsis, true);
      },

      /***
       * @method pad[Side](<num> = null, [padding] = ' ')
       * @returns String
       * @short Pads the string out with [padding] to be exactly <num> characters.
       *
       * @set
       *   pad
       *   padLeft
       *   padRight
       *
       * @example
       *
       *   'wasabi'.pad(8)           -> ' wasabi '
       *   'wasabi'.padLeft(8)       -> '  wasabi'
       *   'wasabi'.padRight(8)      -> 'wasabi  '
       *   'wasabi'.padRight(8, '-') -> 'wasabi--'
       *
       ***/
      'pad': function(num, padding) {
        var str = this, half, front, back;
        num   = coercePositiveInteger(num);
        half  = max(0, num - str.length) / 2;
        front = floor(half);
        back  = ceil(half);
        return padString(front, padding) + str + padString(back, padding);
      },

      'padLeft': function(num, padding) {
        var str = this, num = coercePositiveInteger(num);
        return padString(max(0, num - str.length), padding) + str;
      },

      'padRight': function(num, padding) {
        var str = this, num = coercePositiveInteger(num);
        return str + padString(max(0, num - str.length), padding);
      },

      /***
       * @method first([n] = 1)
       * @returns String
       * @short Returns the first [n] characters of the string.
       * @example
       *
       *   'lucky charms'.first()   -> 'l'
       *   'lucky charms'.first(3)  -> 'luc'
       *
       ***/
      'first': function(num) {
        return stringFirst(this, num);
      },

      /***
       * @method last([n] = 1)
       * @returns String
       * @short Returns the last [n] characters of the string.
       * @example
       *
       *   'lucky charms'.last()   -> 's'
       *   'lucky charms'.last(3)  -> 'rms'
       *
       ***/
      'last': function(num) {
        return stringLast(this, num);
      },

      /***
       * @method toNumber([base] = 10)
       * @returns Number
       * @short Converts the string into a number.
       * @extra Any value with a "." fill be converted to a floating point value, otherwise an integer.
       * @example
       *
       *   '153'.toNumber()    -> 153
       *   '12,000'.toNumber() -> 12000
       *   '10px'.toNumber()   -> 10
       *   'ff'.toNumber(16)   -> 255
       *
       ***/
      'toNumber': function(base) {
        return stringToNumber(this, base);
      },

      /***
       * @method capitalize([all] = false)
       * @returns String
       * @short Capitalizes the first character in the string and downcases all other letters.
       * @extra If [all] is true, all words in the string will be capitalized.
       * @example
       *
       *   'hello'.capitalize()           -> 'Hello'
       *   'hello kitty'.capitalize()     -> 'Hello kitty'
       *   'hello kitty'.capitalize(true) -> 'Hello Kitty'
       *
       *
       ***/
      'capitalize': function(all) {
        return capitalize(this, all);
      },

      /***
       * @method assign(<obj1>, <obj2>, ...)
       * @returns String
       * @short Assigns variables to tokens in a string, demarcated with `{}`.
       * @extra If an object is passed, it's properties can be assigned using the object's keys (i.e. {name}). If a non-object (string, number, etc.) is passed it can be accessed by the argument number beginning with {1} (as with regex tokens). Multiple objects can be passed and will be merged together (original objects are unaffected).
       * @example
       *
       *   'Welcome, Mr. {name}.'.assign({ name: 'Franklin' })   -> 'Welcome, Mr. Franklin.'
       *   'You are {1} years old today.'.assign(14)             -> 'You are 14 years old today.'
       *   '{n} and {r}'.assign({ n: 'Cheech' }, { r: 'Chong' }) -> 'Cheech and Chong'
       *
       ***/
      'assign': function() {
        // Optimized: no leaking arguments (flat)
        var args = [], $i; for($i = 0; $i < arguments.length; $i++) args = args.concat(arguments[$i]);
        return stringAssign(this, args);
      },

      /***
       * @method trim[Side]()
       * @returns String
       * @short Removes leading or trailing whitespace from the string.
       * @extra Whitespace is defined as line breaks, tabs, and any character in the "Space, Separator" Unicode category, conforming to the the ES5 spec.
       *
       * @set
       *   trimLeft
       *   trimRight
       *
       * @example
       *
       *   '   wasabi   '.trimLeft()  -> 'wasabi   '
       *   '   wasabi   '.trimRight() -> '   wasabi'
       *
       ***/

      'trimLeft': function() {
        return this.replace(RegExp('^['+getTrimmableCharacters()+']+'), '');
      },

      'trimRight': function() {
        return this.replace(RegExp('['+getTrimmableCharacters()+']+$'), '');
      }

    });

    /***
     * @method insert()
     * @alias add
     *
     ***/
    alias(String, 'insert', 'add');

    buildStartEndsWith();
    buildBase64('ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=');

  /*
   *
   * Date.addLocale(<code>) adds this locale to Sugar.
   * To set the locale globally, simply call:
   *
   * Date.setLocale('da');
   *
   * var locale = Date.getLocale(<code>) will return this object, which
   * can be tweaked to change the behavior of parsing/formatting in the locales.
   *
   * locale.addFormat adds a date format (see this file for examples).
   * Special tokens in the date format will be parsed out into regex tokens:
   *
   * {0} is a reference to an entry in locale.tokens. Output: (?:the)?
   * {unit} is a reference to all units. Output: (day|week|month|...)
   * {unit3} is a reference to a specific unit. Output: (hour)
   * {unit3-5} is a reference to a subset of the units array. Output: (hour|day|week)
   * {unit?} "?" makes that token optional. Output: (day|week|month)?
   *
   * {day} Any reference to tokens in the modifiers array will include all with the same name. Output: (yesterday|today|tomorrow)
   *
   * All spaces are optional and will be converted to "\s*"
   *
   * Locale arrays months, weekdays, units, numbers, as well as the "src" field for
   * all entries in the modifiers array follow a special format indicated by a colon:
   *
   * minute:|s  = minute|minutes
   * thicke:n|r = thicken|thicker
   *
   * Additionally in the months, weekdays, units, and numbers array these will be added at indexes that are multiples
   * of the relevant number for retrieval. For example having "sunday:|s" in the units array will result in:
   *
   * units: ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sundays']
   *
   * When matched, the index will be found using:
   *
   * units.indexOf(match) % 7;
   *
   * Resulting in the correct index with any number of alternates for that entry.
   *
   */

  Date.addLocale('da', {
    'plural': true,
    'months': 'januar,februar,marts,april,maj,juni,juli,august,september,oktober,november,december',
    'weekdays': 'søndag|sondag,mandag,tirsdag,onsdag,torsdag,fredag,lørdag|lordag',
    'units': 'millisekund:|er,sekund:|er,minut:|ter,tim:e|er,dag:|e,ug:e|er|en,måned:|er|en+maaned:|er|en,år:||et+aar:||et',
    'numbers': 'en|et,to,tre,fire,fem,seks,syv,otte,ni,ti',
    'tokens': 'den,for',
    'articles': 'den',
    'short':'d. {d}. {month} {yyyy}',
    'long': 'den {d}. {month} {yyyy} {H}:{mm}',
    'full': '{Weekday} den {d}. {month} {yyyy} {H}:{mm}:{ss}',
    'past': '{num} {unit} {sign}',
    'future': '{sign} {num} {unit}',
    'duration': '{num} {unit}',
    'ampm': 'am,pm',
    'modifiers': [
      { 'name': 'day', 'src': 'forgårs|i forgårs|forgaars|i forgaars', 'value': -2 },
      { 'name': 'day', 'src': 'i går|igår|i gaar|igaar', 'value': -1 },
      { 'name': 'day', 'src': 'i dag|idag', 'value': 0 },
      { 'name': 'day', 'src': 'i morgen|imorgen', 'value': 1 },
      { 'name': 'day', 'src': 'over morgon|overmorgen|i over morgen|i overmorgen|iovermorgen', 'value': 2 },
      { 'name': 'sign', 'src': 'siden', 'value': -1 },
      { 'name': 'sign', 'src': 'om', 'value':  1 },
      { 'name': 'shift', 'src': 'i sidste|sidste', 'value': -1 },
      { 'name': 'shift', 'src': 'denne', 'value': 0 },
      { 'name': 'shift', 'src': 'næste|naeste', 'value': 1 }
    ],
    'dateParse': [
      '{num} {unit} {sign}',
      '{sign} {num} {unit}',
      '{1?} {num} {unit} {sign}',
      '{shift} {unit=5-7}'
    ],
    'timeParse': [
      '{0?} {weekday?} {date?} {month} {year}',
      '{date} {month}',
      '{shift} {weekday}'
    ]
  });

  /*
   *
   * Date.addLocale(<code>) adds this locale to Sugar.
   * To set the locale globally, simply call:
   *
   * Date.setLocale('de');
   *
   * var locale = Date.getLocale(<code>) will return this object, which
   * can be tweaked to change the behavior of parsing/formatting in the locales.
   *
   * locale.addFormat adds a date format (see this file for examples).
   * Special tokens in the date format will be parsed out into regex tokens:
   *
   * {0} is a reference to an entry in locale.tokens. Output: (?:the)?
   * {unit} is a reference to all units. Output: (day|week|month|...)
   * {unit3} is a reference to a specific unit. Output: (hour)
   * {unit3-5} is a reference to a subset of the units array. Output: (hour|day|week)
   * {unit?} "?" makes that token optional. Output: (day|week|month)?
   *
   * {day} Any reference to tokens in the modifiers array will include all with the same name. Output: (yesterday|today|tomorrow)
   *
   * All spaces are optional and will be converted to "\s*"
   *
   * Locale arrays months, weekdays, units, numbers, as well as the "src" field for
   * all entries in the modifiers array follow a special format indicated by a colon:
   *
   * minute:|s  = minute|minutes
   * thicke:n|r = thicken|thicker
   *
   * Additionally in the months, weekdays, units, and numbers array these will be added at indexes that are multiples
   * of the relevant number for retrieval. For example having "sunday:|s" in the units array will result in:
   *
   * units: ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sundays']
   *
   * When matched, the index will be found using:
   *
   * units.indexOf(match) % 7;
   *
   * Resulting in the correct index with any number of alternates for that entry.
   *
   */

  Date.addLocale('de', {
    'plural': true,
    'capitalizeUnit': true,
    'weekdayAbbreviate': 2,
    'months': 'Januar,Februar,März|Marz,April,Mai,Juni,Juli,August,September,Oktober,November,Dezember',
    'weekdays': 'Sonntag,Montag,Dienstag,Mittwoch,Donnerstag,Freitag,Samstag',
    'units': 'Millisekunde:|n,Sekunde:|n,Minute:|n,Stunde:|n,Tag:|en,Woche:|n,Monat:|en,Jahr:|en',
    'numbers': 'ein:|e|er|en|em,zwei,drei,vier,fuenf,sechs,sieben,acht,neun,zehn',
    'tokens': 'der',
    'short':'{d}. {Month} {yyyy}',
    'long': '{d}. {Month} {yyyy} {H}:{mm}',
    'full': '{Weekday} {d}. {Month} {yyyy} {H}:{mm}:{ss}',
    'past': '{sign} {num} {unit}',
    'future': '{sign} {num} {unit}',
    'duration': '{num} {unit}',
    'timeMarker': 'um',
    'ampm': 'am,pm',
    'modifiers': [
      { 'name': 'day', 'src': 'vorgestern', 'value': -2 },
      { 'name': 'day', 'src': 'gestern', 'value': -1 },
      { 'name': 'day', 'src': 'heute', 'value': 0 },
      { 'name': 'day', 'src': 'morgen', 'value': 1 },
      { 'name': 'day', 'src': 'übermorgen|ubermorgen|uebermorgen', 'value': 2 },
      { 'name': 'sign', 'src': 'vor:|her', 'value': -1 },
      { 'name': 'sign', 'src': 'in', 'value': 1 },
      { 'name': 'shift', 'src': 'letzte:|r|n|s', 'value': -1 },
      { 'name': 'shift', 'src': 'nächste:|r|n|s+nachste:|r|n|s+naechste:|r|n|s+kommende:n|r', 'value': 1 }
    ],
    'dateParse': [
      '{sign} {num} {unit}',
      '{num} {unit} {sign}',
      '{shift} {unit=5-7}'
    ],
    'timeParse': [
      '{weekday?} {date?} {month} {year?}',
      '{shift} {weekday}'
    ]
  });

  /*
   *
   * Date.addLocale(<code>) adds this locale to Sugar.
   * To set the locale globally, simply call:
   *
   * Date.setLocale('es');
   *
   * var locale = Date.getLocale(<code>) will return this object, which
   * can be tweaked to change the behavior of parsing/formatting in the locales.
   *
   * locale.addFormat adds a date format (see this file for examples).
   * Special tokens in the date format will be parsed out into regex tokens:
   *
   * {0} is a reference to an entry in locale.tokens. Output: (?:the)?
   * {unit} is a reference to all units. Output: (day|week|month|...)
   * {unit3} is a reference to a specific unit. Output: (hour)
   * {unit3-5} is a reference to a subset of the units array. Output: (hour|day|week)
   * {unit?} "?" makes that token optional. Output: (day|week|month)?
   *
   * {day} Any reference to tokens in the modifiers array will include all with the same name. Output: (yesterday|today|tomorrow)
   *
   * All spaces are optional and will be converted to "\s*"
   *
   * Locale arrays months, weekdays, units, numbers, as well as the "src" field for
   * all entries in the modifiers array follow a special format indicated by a colon:
   *
   * minute:|s  = minute|minutes
   * thicke:n|r = thicken|thicker
   *
   * Additionally in the months, weekdays, units, and numbers array these will be added at indexes that are multiples
   * of the relevant number for retrieval. For example having "sunday:|s" in the units array will result in:
   *
   * units: ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sundays']
   *
   * When matched, the index will be found using:
   *
   * units.indexOf(match) % 7;
   *
   * Resulting in the correct index with any number of alternates for that entry.
   *
   */

  Date.addLocale('es', {
    'plural': true,
    'months': 'enero,febrero,marzo,abril,mayo,junio,julio,agosto,septiembre,octubre,noviembre,diciembre',
    'weekdays': 'domingo,lunes,martes,miércoles|miercoles,jueves,viernes,sábado|sabado',
    'units': 'milisegundo:|s,segundo:|s,minuto:|s,hora:|s,día|días|dia|dias,semana:|s,mes:|es,año|años|ano|anos',
    'numbers': 'uno,dos,tres,cuatro,cinco,seis,siete,ocho,nueve,diez',
    'tokens': 'el,la,de',
    'short':'{d} {month} {yyyy}',
    'long': '{d} {month} {yyyy} {H}:{mm}',
    'full': '{Weekday} {d} {month} {yyyy} {H}:{mm}:{ss}',
    'past': '{sign} {num} {unit}',
    'future': '{sign} {num} {unit}',
    'duration': '{num} {unit}',
    'timeMarker': 'a las',
    'ampm': 'am,pm',
    'modifiers': [
      { 'name': 'day', 'src': 'anteayer', 'value': -2 },
      { 'name': 'day', 'src': 'ayer', 'value': -1 },
      { 'name': 'day', 'src': 'hoy', 'value': 0 },
      { 'name': 'day', 'src': 'mañana|manana', 'value': 1 },
      { 'name': 'sign', 'src': 'hace', 'value': -1 },
      { 'name': 'sign', 'src': 'dentro de', 'value': 1 },
      { 'name': 'shift', 'src': 'pasad:o|a', 'value': -1 },
      { 'name': 'shift', 'src': 'próximo|próxima|proximo|proxima', 'value': 1 }
    ],
    'dateParse': [
      '{sign} {num} {unit}',
      '{num} {unit} {sign}',
      '{0?}{1?} {unit=5-7} {shift}',
      '{0?}{1?} {shift} {unit=5-7}'
    ],
    'timeParse': [
      '{shift} {weekday}',
      '{weekday} {shift}',
      '{date?} {2?} {month} {2?} {year?}'
    ]
  });
  /*
   *
   * Date.addLocale(<code>) adds this locale to Sugar.
   * To set the locale globally, simply call:
   *
   * Date.setLocale('ja');
   *
   * var locale = Date.getLocale(<code>) will return this object, which
   * can be tweaked to change the behavior of parsing/formatting in the locales.
   *
   * locale.addFormat adds a date format (see this file for examples).
   * Special tokens in the date format will be parsed out into regex tokens:
   *
   * {0} is a reference to an entry in locale.tokens. Output: (?:the)?
   * {unit} is a reference to all units. Output: (day|week|month|...)
   * {unit3} is a reference to a specific unit. Output: (hour)
   * {unit3-5} is a reference to a subset of the units array. Output: (hour|day|week)
   * {unit?} "?" makes that token optional. Output: (day|week|month)?
   *
   * {day} Any reference to tokens in the modifiers array will include all with the same name. Output: (yesterday|today|tomorrow)
   *
   * All spaces are optional and will be converted to "\s*"
   *
   * Locale arrays months, weekdays, units, numbers, as well as the "src" field for
   * all entries in the modifiers array follow a special format indicated by a colon:
   *
   * minute:|s  = minute|minutes
   * thicke:n|r = thicken|thicker
   *
   * Additionally in the months, weekdays, units, and numbers array these will be added at indexes that are multiples
   * of the relevant number for retrieval. For example having "sunday:|s" in the units array will result in:
   *
   * units: ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sundays']
   *
   * When matched, the index will be found using:
   *
   * units.indexOf(match) % 7;
   *
   * Resulting in the correct index with any number of alternates for that entry.
   *
   */

  Date.addLocale('fi', {
      'plural':     true,
      'timeMarker': 'kello',
      'ampm':       ',',
      'months':     'tammikuu,helmikuu,maaliskuu,huhtikuu,toukokuu,kesäkuu,heinäkuu,elokuu,syyskuu,lokakuu,marraskuu,joulukuu',
      'weekdays':   'sunnuntai,maanantai,tiistai,keskiviikko,torstai,perjantai,lauantai',
      'units':         'millisekun:ti|tia|nin|teja|tina,sekun:ti|tia|nin|teja|tina,minuut:ti|tia|in|teja|tina,tun:ti|tia|nin|teja|tina,päiv:ä|ää|än|iä|änä,viik:ko|koa|on|olla|koja|kona,kuukau:si|tta|den+kuussa,vuo:si|tta|den|sia|tena|nna',
      'numbers':    'yksi|ensimmäinen,kaksi|toinen,kolm:e|as,neljä:s,vii:si|des,kuu:si|des,seitsemä:n|s,kahdeksa:n|s,yhdeksä:n|s,kymmene:n|s',
      'articles':   '',
      'optionals':  '',
      'short':      '{d}. {month}ta {yyyy}',
      'long':       '{d}. {month}ta {yyyy} kello {H}.{mm}',
      'full':       '{Weekday}na {d}. {month}ta {yyyy} kello {H}.{mm}',
      'relative':       function(num, unit, ms, format) {
        var units = this['units'];
        function numberWithUnit(mult) {
          return num + ' ' + units[(8 * mult) + unit];
        }
        function baseUnit() {
          return numberWithUnit(num === 1 ? 0 : 1);
        }
        switch(format) {
          case 'duration':  return baseUnit();
          case 'past':      return baseUnit() + ' sitten';
          case 'future':    return numberWithUnit(2) + ' kuluttua';
        }
      },
      'modifiers': [
          { 'name': 'day',   'src': 'toissa päivänä|toissa päiväistä', 'value': -2 },
          { 'name': 'day',   'src': 'eilen|eilistä', 'value': -1 },
          { 'name': 'day',   'src': 'tänään', 'value': 0 },
          { 'name': 'day',   'src': 'huomenna|huomista', 'value': 1 },
          { 'name': 'day',   'src': 'ylihuomenna|ylihuomista', 'value': 2 },
          { 'name': 'sign',  'src': 'sitten|aiemmin', 'value': -1 },
          { 'name': 'sign',  'src': 'päästä|kuluttua|myöhemmin', 'value': 1 },
          { 'name': 'edge',  'src': 'viimeinen|viimeisenä', 'value': -2 },
          { 'name': 'edge',  'src': 'lopussa', 'value': -1 },
          { 'name': 'edge',  'src': 'ensimmäinen|ensimmäisenä', 'value': 1 },
          { 'name': 'shift', 'src': 'edellinen|edellisenä|edeltävä|edeltävänä|viime|toissa', 'value': -1 },
          { 'name': 'shift', 'src': 'tänä|tämän', 'value': 0 },
          { 'name': 'shift', 'src': 'seuraava|seuraavana|tuleva|tulevana|ensi', 'value': 1 }
      ],
      'dateParse': [
          '{num} {unit} {sign}',
          '{sign} {num} {unit}',
          '{num} {unit=4-5} {sign} {day}',
          '{month} {year}',
          '{shift} {unit=5-7}'
      ],
      'timeParse': [
          '{0} {num}{1} {day} of {month} {year?}',
          '{weekday?} {month} {date}{1} {year?}',
          '{date} {month} {year}',
          '{shift} {weekday}',
          '{shift} week {weekday}',
          '{weekday} {2} {shift} week',
          '{0} {date}{1} of {month}',
          '{0}{month?} {date?}{1} of {shift} {unit=6-7}'
      ]
  });
  /*
   *
   * Date.addLocale(<code>) adds this locale to Sugar.
   * To set the locale globally, simply call:
   *
   * Date.setLocale('fr');
   *
   * var locale = Date.getLocale(<code>) will return this object, which
   * can be tweaked to change the behavior of parsing/formatting in the locales.
   *
   * locale.addFormat adds a date format (see this file for examples).
   * Special tokens in the date format will be parsed out into regex tokens:
   *
   * {0} is a reference to an entry in locale.tokens. Output: (?:the)?
   * {unit} is a reference to all units. Output: (day|week|month|...)
   * {unit3} is a reference to a specific unit. Output: (hour)
   * {unit3-5} is a reference to a subset of the units array. Output: (hour|day|week)
   * {unit?} "?" makes that token optional. Output: (day|week|month)?
   *
   * {day} Any reference to tokens in the modifiers array will include all with the same name. Output: (yesterday|today|tomorrow)
   *
   * All spaces are optional and will be converted to "\s*"
   *
   * Locale arrays months, weekdays, units, numbers, as well as the "src" field for
   * all entries in the modifiers array follow a special format indicated by a colon:
   *
   * minute:|s  = minute|minutes
   * thicke:n|r = thicken|thicker
   *
   * Additionally in the months, weekdays, units, and numbers array these will be added at indexes that are multiples
   * of the relevant number for retrieval. For example having "sunday:|s" in the units array will result in:
   *
   * units: ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sundays']
   *
   * When matched, the index will be found using:
   *
   * units.indexOf(match) % 7;
   *
   * Resulting in the correct index with any number of alternates for that entry.
   *
   */

  Date.addLocale('fr', {
    'plural': true,
    'months': 'janvier,février|fevrier,mars,avril,mai,juin,juillet,août,septembre,octobre,novembre,décembre|decembre',
    'weekdays': 'dimanche,lundi,mardi,mercredi,jeudi,vendredi,samedi',
    'units': 'milliseconde:|s,seconde:|s,minute:|s,heure:|s,jour:|s,semaine:|s,mois,an:|s|née|nee',
    'numbers': 'un:|e,deux,trois,quatre,cinq,six,sept,huit,neuf,dix',
    'tokens': "l'|la|le",
    'short':'{d} {month} {yyyy}',
    'long': '{d} {month} {yyyy} {H}:{mm}',
    'full': '{Weekday} {d} {month} {yyyy} {H}:{mm}:{ss}',
    'past': '{sign} {num} {unit}',
    'future': '{sign} {num} {unit}',
    'duration': '{num} {unit}',
    'timeMarker': 'à',
    'ampm': 'am,pm',
    'modifiers': [
      { 'name': 'day', 'src': 'hier', 'value': -1 },
      { 'name': 'day', 'src': "aujourd'hui", 'value': 0 },
      { 'name': 'day', 'src': 'demain', 'value': 1 },
      { 'name': 'sign', 'src': 'il y a', 'value': -1 },
      { 'name': 'sign', 'src': "dans|d'ici", 'value': 1 },
      { 'name': 'shift', 'src': 'derni:èr|er|ère|ere', 'value': -1 },
      { 'name': 'shift', 'src': 'prochain:|e', 'value': 1 }
    ],
    'dateParse': [
      '{sign} {num} {unit}',
      '{sign} {num} {unit}',
      '{0?} {unit=5-7} {shift}'
    ],
    'timeParse': [
      '{weekday?} {0?} {date?} {month} {year?}',
      '{0?} {weekday} {shift}'
    ]
  });

  /*
   *
   * Date.addLocale(<code>) adds this locale to Sugar.
   * To set the locale globally, simply call:
   *
   * Date.setLocale('it');
   *
   * var locale = Date.getLocale(<code>) will return this object, which
   * can be tweaked to change the behavior of parsing/formatting in the locales.
   *
   * locale.addFormat adds a date format (see this file for examples).
   * Special tokens in the date format will be parsed out into regex tokens:
   *
   * {0} is a reference to an entry in locale.tokens. Output: (?:the)?
   * {unit} is a reference to all units. Output: (day|week|month|...)
   * {unit3} is a reference to a specific unit. Output: (hour)
   * {unit3-5} is a reference to a subset of the units array. Output: (hour|day|week)
   * {unit?} "?" makes that token optional. Output: (day|week|month)?
   *
   * {day} Any reference to tokens in the modifiers array will include all with the same name. Output: (yesterday|today|tomorrow)
   *
   * All spaces are optional and will be converted to "\s*"
   *
   * Locale arrays months, weekdays, units, numbers, as well as the "src" field for
   * all entries in the modifiers array follow a special format indicated by a colon:
   *
   * minute:|s  = minute|minutes
   * thicke:n|r = thicken|thicker
   *
   * Additionally in the months, weekdays, units, and numbers array these will be added at indexes that are multiples
   * of the relevant number for retrieval. For example having "sunday:|s" in the units array will result in:
   *
   * units: ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sundays']
   *
   * When matched, the index will be found using:
   *
   * units.indexOf(match) % 7;
   *
   * Resulting in the correct index with any number of alternates for that entry.
   *
   */

  Date.addLocale('it', {
    'plural': true,
    'months': 'Gennaio,Febbraio,Marzo,Aprile,Maggio,Giugno,Luglio,Agosto,Settembre,Ottobre,Novembre,Dicembre',
    'weekdays': 'Domenica,Luned:ì|i,Marted:ì|i,Mercoled:ì|i,Gioved:ì|i,Venerd:ì|i,Sabato',
    'units': 'millisecond:o|i,second:o|i,minut:o|i,or:a|e,giorn:o|i,settiman:a|e,mes:e|i,ann:o|i',
    'numbers': "un:|a|o|',due,tre,quattro,cinque,sei,sette,otto,nove,dieci",
    'tokens': "l'|la|il",
    'short':'{d} {Month} {yyyy}',
    'long': '{d} {Month} {yyyy} {H}:{mm}',
    'full': '{Weekday} {d} {Month} {yyyy} {H}:{mm}:{ss}',
    'past': '{num} {unit} {sign}',
    'future': '{num} {unit} {sign}',
    'duration': '{num} {unit}',
    'timeMarker': 'alle',
    'ampm': 'am,pm',
    'modifiers': [
      { 'name': 'day', 'src': 'ieri', 'value': -1 },
      { 'name': 'day', 'src': 'oggi', 'value': 0 },
      { 'name': 'day', 'src': 'domani', 'value': 1 },
      { 'name': 'day', 'src': 'dopodomani', 'value': 2 },
      { 'name': 'sign', 'src': 'fa', 'value': -1 },
      { 'name': 'sign', 'src': 'da adesso', 'value': 1 },
      { 'name': 'shift', 'src': 'scors:o|a', 'value': -1 },
      { 'name': 'shift', 'src': 'prossim:o|a', 'value': 1 }
    ],
    'dateParse': [
      '{num} {unit} {sign}',
      '{0?} {unit=5-7} {shift}',
      '{0?} {shift} {unit=5-7}'
    ],
    'timeParse': [
      '{weekday?} {date?} {month} {year?}',
      '{shift} {weekday}'
    ]
  });

  /*
   *
   * Date.addLocale(<code>) adds this locale to Sugar.
   * To set the locale globally, simply call:
   *
   * Date.setLocale('ja');
   *
   * var locale = Date.getLocale(<code>) will return this object, which
   * can be tweaked to change the behavior of parsing/formatting in the locales.
   *
   * locale.addFormat adds a date format (see this file for examples).
   * Special tokens in the date format will be parsed out into regex tokens:
   *
   * {0} is a reference to an entry in locale.tokens. Output: (?:the)?
   * {unit} is a reference to all units. Output: (day|week|month|...)
   * {unit3} is a reference to a specific unit. Output: (hour)
   * {unit3-5} is a reference to a subset of the units array. Output: (hour|day|week)
   * {unit?} "?" makes that token optional. Output: (day|week|month)?
   *
   * {day} Any reference to tokens in the modifiers array will include all with the same name. Output: (yesterday|today|tomorrow)
   *
   * All spaces are optional and will be converted to "\s*"
   *
   * Locale arrays months, weekdays, units, numbers, as well as the "src" field for
   * all entries in the modifiers array follow a special format indicated by a colon:
   *
   * minute:|s  = minute|minutes
   * thicke:n|r = thicken|thicker
   *
   * Additionally in the months, weekdays, units, and numbers array these will be added at indexes that are multiples
   * of the relevant number for retrieval. For example having "sunday:|s" in the units array will result in:
   *
   * units: ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sundays']
   *
   * When matched, the index will be found using:
   *
   * units.indexOf(match) % 7;
   *
   * Resulting in the correct index with any number of alternates for that entry.
   *
   */

  Date.addLocale('ja', { 'monthSuffix': '月',
    'weekdays': '日曜日,月曜日,火曜日,水曜日,木曜日,金曜日,土曜日',
    'units': 'ミリ秒,秒,分,時間,日,週間|週,ヶ月|ヵ月|月,年',
    'short': '{yyyy}年{M}月{d}日',
    'long': '{yyyy}年{M}月{d}日 {H}時{mm}分',
    'full': '{yyyy}年{M}月{d}日 {Weekday} {H}時{mm}分{ss}秒',
    'past': '{num}{unit}{sign}',
    'future': '{num}{unit}{sign}',
    'duration': '{num}{unit}',
    'timeSuffixes': '時,分,秒',
    'ampm': '午前,午後',
    'modifiers': [
      { 'name': 'day', 'src': '一昨日', 'value': -2 },
      { 'name': 'day', 'src': '昨日', 'value': -1 },
      { 'name': 'day', 'src': '今日', 'value': 0 },
      { 'name': 'day', 'src': '明日', 'value': 1 },
      { 'name': 'day', 'src': '明後日', 'value': 2 },
      { 'name': 'sign', 'src': '前', 'value': -1 },
      { 'name': 'sign', 'src': '後', 'value':  1 },
      { 'name': 'shift', 'src': '去|先', 'value': -1 },
      { 'name': 'shift', 'src': '来', 'value':  1 }
    ],
    'dateParse': [
      '{num}{unit}{sign}'
    ],
    'timeParse': [
      '{shift}{unit=5-7}{weekday?}',
      '{year}年{month?}月?{date?}日?',
      '{month}月{date?}日?',
      '{date}日'
    ]
  });

  /*
   *
   * Date.addLocale(<code>) adds this locale to Sugar.
   * To set the locale globally, simply call:
   *
   * Date.setLocale('ko');
   *
   * var locale = Date.getLocale(<code>) will return this object, which
   * can be tweaked to change the behavior of parsing/formatting in the locales.
   *
   * locale.addFormat adds a date format (see this file for examples).
   * Special tokens in the date format will be parsed out into regex tokens:
   *
   * {0} is a reference to an entry in locale.tokens. Output: (?:the)?
   * {unit} is a reference to all units. Output: (day|week|month|...)
   * {unit3} is a reference to a specific unit. Output: (hour)
   * {unit3-5} is a reference to a subset of the units array. Output: (hour|day|week)
   * {unit?} "?" makes that token optional. Output: (day|week|month)?
   *
   * {day} Any reference to tokens in the modifiers array will include all with the same name. Output: (yesterday|today|tomorrow)
   *
   * All spaces are optional and will be converted to "\s*"
   *
   * Locale arrays months, weekdays, units, numbers, as well as the "src" field for
   * all entries in the modifiers array follow a special format indicated by a colon:
   *
   * minute:|s  = minute|minutes
   * thicke:n|r = thicken|thicker
   *
   * Additionally in the months, weekdays, units, and numbers array these will be added at indexes that are multiples
   * of the relevant number for retrieval. For example having "sunday:|s" in the units array will result in:
   *
   * units: ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sundays']
   *
   * When matched, the index will be found using:
   *
   * units.indexOf(match) % 7;
   *
   * Resulting in the correct index with any number of alternates for that entry.
   *
   */

  Date.addLocale('ko', {
    'digitDate': true,
    'monthSuffix': '월',
    'weekdays': '일요일,월요일,화요일,수요일,목요일,금요일,토요일',
    'units': '밀리초,초,분,시간,일,주,개월|달,년|해',
    'numbers': '일|한,이,삼,사,오,육,칠,팔,구,십',
    'short': '{yyyy}년{M}월{d}일',
    'long': '{yyyy}년{M}월{d}일 {H}시{mm}분',
    'full': '{yyyy}년{M}월{d}일 {Weekday} {H}시{mm}분{ss}초',
    'past': '{num}{unit} {sign}',
    'future': '{num}{unit} {sign}',
    'duration': '{num}{unit}',
    'timeSuffixes': '시,분,초',
    'ampm': '오전,오후',
    'modifiers': [
      { 'name': 'day', 'src': '그저께', 'value': -2 },
      { 'name': 'day', 'src': '어제', 'value': -1 },
      { 'name': 'day', 'src': '오늘', 'value': 0 },
      { 'name': 'day', 'src': '내일', 'value': 1 },
      { 'name': 'day', 'src': '모레', 'value': 2 },
      { 'name': 'sign', 'src': '전', 'value': -1 },
      { 'name': 'sign', 'src': '후', 'value':  1 },
      { 'name': 'shift', 'src': '지난|작', 'value': -1 },
      { 'name': 'shift', 'src': '이번|올', 'value': 0 },
      { 'name': 'shift', 'src': '다음|내', 'value': 1 }
    ],
    'dateParse': [
      '{num}{unit} {sign}',
      '{shift?} {unit=5-7}'
    ],
    'timeParse': [
      '{shift} {unit=5?} {weekday}',
      '{year}년 {month?}월? {date?}일? {weekday?}',
      '{month}월 {date?}일?',
      '{date}일'
    ]
  });

  /*
   *
   * Date.addLocale(<code>) adds this locale to Sugar.
   * To set the locale globally, simply call:
   *
   * Date.setLocale('nl');
   *
   * var locale = Date.getLocale(<code>) will return this object, which
   * can be tweaked to change the behavior of parsing/formatting in the locales.
   *
   * locale.addFormat adds a date format (see this file for examples).
   * Special tokens in the date format will be parsed out into regex tokens:
   *
   * {0} is a reference to an entry in locale.tokens. Output: (?:the)?
   * {unit} is a reference to all units. Output: (day|week|month|...)
   * {unit3} is a reference to a specific unit. Output: (hour)
   * {unit3-5} is a reference to a subset of the units array. Output: (hour|day|week)
   * {unit?} "?" makes that token optional. Output: (day|week|month)?
   *
   * {day} Any reference to tokens in the modifiers array will include all with the same name. Output: (yesterday|today|tomorrow)
   *
   * All spaces are optional and will be converted to "\s*"
   *
   * Locale arrays months, weekdays, units, numbers, as well as the "src" field for
   * all entries in the modifiers array follow a special format indicated by a colon:
   *
   * minute:|s  = minute|minutes
   * thicke:n|r = thicken|thicker
   *
   * Additionally in the months, weekdays, units, and numbers array these will be added at indexes that are multiples
   * of the relevant number for retrieval. For example having "sunday:|s" in the units array will result in:
   *
   * units: ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sundays']
   *
   * When matched, the index will be found using:
   *
   * units.indexOf(match) % 7;
   *
   * Resulting in the correct index with any number of alternates for that entry.
   *
   */

  Date.addLocale('nl', {
    'plural': true,
    'months': 'januari,februari,maart,april,mei,juni,juli,augustus,september,oktober,november,december',
    'weekdays': 'zondag|zo,maandag|ma,dinsdag|di,woensdag|woe|wo,donderdag|do,vrijdag|vrij|vr,zaterdag|za',
    'units': 'milliseconde:|n,seconde:|n,minu:ut|ten,uur,dag:|en,we:ek|ken,maand:|en,jaar',
    'numbers': 'een,twee,drie,vier,vijf,zes,zeven,acht,negen',
    'tokens': '',
    'short':'{d} {Month} {yyyy}',
    'long': '{d} {Month} {yyyy} {H}:{mm}',
    'full': '{Weekday} {d} {Month} {yyyy} {H}:{mm}:{ss}',
    'past': '{num} {unit} {sign}',
    'future': '{num} {unit} {sign}',
    'duration': '{num} {unit}',
    'timeMarker': "'s|om",
    'modifiers': [
      { 'name': 'day', 'src': 'gisteren', 'value': -1 },
      { 'name': 'day', 'src': 'vandaag', 'value': 0 },
      { 'name': 'day', 'src': 'morgen', 'value': 1 },
      { 'name': 'day', 'src': 'overmorgen', 'value': 2 },
      { 'name': 'sign', 'src': 'geleden', 'value': -1 },
      { 'name': 'sign', 'src': 'vanaf nu', 'value': 1 },
      { 'name': 'shift', 'src': 'laatste|vorige|afgelopen', 'value': -1 },
      { 'name': 'shift', 'src': 'volgend:|e', 'value': 1 }
    ],
    'dateParse': [
      '{num} {unit} {sign}',
      '{0?} {unit=5-7} {shift}',
      '{0?} {shift} {unit=5-7}'
    ],
    'timeParse': [
      '{weekday?} {date?} {month} {year?}',
      '{shift} {weekday}'
    ]
  });

  /*
   *
   * Date.addLocale(<code>) adds this locale to Sugar.
   * To set the locale globally, simply call:
   *
   * Date.setLocale('no');
   *
   * var locale = Date.getLocale(<code>) will return this object, which
   * can be tweaked to change the behavior of parsing/formatting in the locales.
   *
   * locale.addFormat adds a date format (see this file for examples).
   * Special tokens in the date format will be parsed out into regex tokens:
   *
   * {0} is a reference to an entry in locale.tokens. Output: (?:the)?
   * {unit} is a reference to all units. Output: (day|week|month|...)
   * {unit3} is a reference to a specific unit. Output: (hour)
   * {unit3-5} is a reference to a subset of the units array. Output: (hour|day|week)
   * {unit?} "?" makes that token optional. Output: (day|week|month)?
   *
   * {day} Any reference to tokens in the modifiers array will include all with the same name. Output: (yesterday|today|tomorrow)
   *
   * All spaces are optional and will be converted to "\s*"
   *
   * Locale arrays months, weekdays, units, numbers, as well as the "src" field for
   * all entries in the modifiers array follow a special format indicated by a colon:
   *
   * minute:|s  = minute|minutes
   * thicke:n|r = thicken|thicker
   *
   * Additionally in the months, weekdays, units, and numbers array these will be added at indexes that are multiples
   * of the relevant number for retrieval. For example having "sunday:|s" in the units array will result in:
   *
   * units: ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sundays']
   *
   * When matched, the index will be found using:
   *
   * units.indexOf(match) % 7;
   *
   * Resulting in the correct index with any number of alternates for that entry.
   *
   */

  Date.addLocale('no', {
    'plural': true,
    'months': 'januar,februar,mars,april,mai,juni,juli,august,september,oktober,november,desember',
    'weekdays': 'søndag|sondag,mandag,tirsdag,onsdag,torsdag,fredag,lørdag|lordag',
    'units': 'millisekund:|er,sekund:|er,minutt:|er,tim:e|er,dag:|er,uk:e|er|en,måned:|er|en+maaned:|er|en,år:||et+aar:||et',
    'numbers': 'en|et,to,tre,fire,fem,seks,sju|syv,åtte,ni,ti',
    'tokens': 'den,for',
    'articles': 'den',
    'short':'d. {d}. {month} {yyyy}',
    'long': 'den {d}. {month} {yyyy} {H}:{mm}',
    'full': '{Weekday} den {d}. {month} {yyyy} {H}:{mm}:{ss}',
    'past': '{num} {unit} {sign}',
    'future': '{sign} {num} {unit}',
    'duration': '{num} {unit}',
    'ampm': 'am,pm',
    'modifiers': [
      { 'name': 'day', 'src': 'forgårs|i forgårs|forgaars|i forgaars', 'value': -2 },
      { 'name': 'day', 'src': 'i går|igår|i gaar|igaar', 'value': -1 },
      { 'name': 'day', 'src': 'i dag|idag', 'value': 0 },
      { 'name': 'day', 'src': 'i morgen|imorgen', 'value': 1 },
      { 'name': 'day', 'src': 'overimorgen|overmorgen|over i morgen', 'value': 2 },
      { 'name': 'sign', 'src': 'siden', 'value': -1 },
      { 'name': 'sign', 'src': 'om', 'value':  1 },
      { 'name': 'shift', 'src': 'i siste|siste', 'value': -1 },
      { 'name': 'shift', 'src': 'denne', 'value': 0 },
      { 'name': 'shift', 'src': 'neste', 'value': 1 }
    ],
    'dateParse': [
      '{num} {unit} {sign}',
      '{sign} {num} {unit}',
      '{1?} {num} {unit} {sign}',
      '{shift} {unit=5-7}'
    ],
    'timeParse': [
      '{0?} {weekday?} {date?} {month} {year}',
      '{date} {month}',
      '{shift} {weekday}'
    ]
  });
  /*
   *
   * Date.addLocale(<code>) adds this locale to Sugar.
   * To set the locale globally, simply call:
   *
   * Date.setLocale('pl');
   *
   * var locale = Date.getLocale(<code>) will return this object, which
   * can be tweaked to change the behavior of parsing/formatting in the locales.
   *
   * locale.addFormat adds a date format (see this file for examples).
   * Special tokens in the date format will be parsed out into regex tokens:
   *
   * {0} is a reference to an entry in locale.optionals. Output: (?:the)?
   * {unit} is a reference to all units. Output: (day|week|month|...)
   * {unit3} is a reference to a specific unit. Output: (hour)
   * {unit3-5} is a reference to a subset of the units array. Output: (hour|day|week)
   * {unit?} "?" makes that token optional. Output: (day|week|month)?
   *
   * {day} Any reference to tokens in the modifiers array will include all with the same name. Output: (yesterday|today|tomorrow)
   *
   * All spaces are optional and will be converted to "\s*"
   *
   * Locale arrays months, weekdays, units, numbers, as well as the "src" field for
   * all entries in the modifiers array follow a special format indicated by a colon:
   *
   * minute:|s  = minute|minutes
   * thicke:n|r = thicken|thicker
   *
   * Additionally in the months, weekdays, units, and numbers array these will be added at indexes that are multiples
   * of the relevant number for retrieval. For example having "sunday:|s" in the units array will result in:
   *
   * units: ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sundays']
   *
   * When matched, the index will be found using:
   *
   * units.indexOf(match) % 7;
   *
   * Resulting in the correct index with any number of alternates for that entry.
   *
   */

  Date.addLocale('pl', {
    'plural':    true,
    'months':    'Styczeń|Stycznia,Luty|Lutego,Marzec|Marca,Kwiecień|Kwietnia,Maj|Maja,Czerwiec|Czerwca,Lipiec|Lipca,Sierpień|Sierpnia,Wrzesień|Września,Październik|Października,Listopad|Listopada,Grudzień|Grudnia',
    'weekdays':  'Niedziela|Niedzielę,Poniedziałek,Wtorek,Środ:a|ę,Czwartek,Piątek,Sobota|Sobotę',
    'units':     'milisekund:a|y|,sekund:a|y|,minut:a|y|,godzin:a|y|,dzień|dni,tydzień|tygodnie|tygodni,miesiące|miesiące|miesięcy,rok|lata|lat',
    'numbers':   'jeden|jedną,dwa|dwie,trzy,cztery,pięć,sześć,siedem,osiem,dziewięć,dziesięć',
    'optionals': 'w|we,roku',
    'short':     '{d} {Month} {yyyy}',
    'long':      '{d} {Month} {yyyy} {H}:{mm}',
    'full' :     '{Weekday}, {d} {Month} {yyyy} {H}:{mm}:{ss}',
    'past':      '{num} {unit} {sign}',
    'future':    '{sign} {num} {unit}',
    'duration':  '{num} {unit}',
    'timeMarker':'o',
    'ampm':      'am,pm',
    'modifiers': [
      { 'name': 'day', 'src': 'przedwczoraj', 'value': -2 },
      { 'name': 'day', 'src': 'wczoraj', 'value': -1 },
      { 'name': 'day', 'src': 'dzisiaj|dziś', 'value': 0 },
      { 'name': 'day', 'src': 'jutro', 'value': 1 },
      { 'name': 'day', 'src': 'pojutrze', 'value': 2 },
      { 'name': 'sign', 'src': 'temu|przed', 'value': -1 },
      { 'name': 'sign', 'src': 'za', 'value': 1 },
      { 'name': 'shift', 'src': 'zeszły|zeszła|ostatni|ostatnia', 'value': -1 },
      { 'name': 'shift', 'src': 'następny|następna|następnego|przyszły|przyszła|przyszłego', 'value': 1 }
    ],
    'dateParse': [
      '{num} {unit} {sign}',
      '{sign} {num} {unit}',
      '{month} {year}',
      '{shift} {unit=5-7}',
      '{0} {shift?} {weekday}'
    ],
    'timeParse': [
      '{date} {month} {year?} {1}',
      '{0} {shift?} {weekday}'
    ]
  });

  /*
   *
   * Date.addLocale(<code>) adds this locale to Sugar.
   * To set the locale globally, simply call:
   *
   * Date.setLocale('pt');
   *
   * var locale = Date.getLocale(<code>) will return this object, which
   * can be tweaked to change the behavior of parsing/formatting in the locales.
   *
   * locale.addFormat adds a date format (see this file for examples).
   * Special tokens in the date format will be parsed out into regex tokens:
   *
   * {0} is a reference to an entry in locale.tokens. Output: (?:the)?
   * {unit} is a reference to all units. Output: (day|week|month|...)
   * {unit3} is a reference to a specific unit. Output: (hour)
   * {unit3-5} is a reference to a subset of the units array. Output: (hour|day|week)
   * {unit?} "?" makes that token optional. Output: (day|week|month)?
   *
   * {day} Any reference to tokens in the modifiers array will include all with the same name. Output: (yesterday|today|tomorrow)
   *
   * All spaces are optional and will be converted to "\s*"
   *
   * Locale arrays months, weekdays, units, numbers, as well as the "src" field for
   * all entries in the modifiers array follow a special format indicated by a colon:
   *
   * minute:|s  = minute|minutes
   * thicke:n|r = thicken|thicker
   *
   * Additionally in the months, weekdays, units, and numbers array these will be added at indexes that are multiples
   * of the relevant number for retrieval. For example having "sunday:|s" in the units array will result in:
   *
   * units: ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sundays']
   *
   * When matched, the index will be found using:
   *
   * units.indexOf(match) % 7;
   *
   * Resulting in the correct index with any number of alternates for that entry.
   *
   */

  Date.addLocale('pt', {
    'plural': true,
    'months': 'janeiro,fevereiro,março,abril,maio,junho,julho,agosto,setembro,outubro,novembro,dezembro',
    'weekdays': 'domingo,segunda-feira,terça-feira,quarta-feira,quinta-feira,sexta-feira,sábado|sabado',
    'units': 'milisegundo:|s,segundo:|s,minuto:|s,hora:|s,dia:|s,semana:|s,mês|mêses|mes|meses,ano:|s',
    'numbers': 'um:|a,dois|duas,três|tres,quatro,cinco,seis,sete,oito,nove,dez',
    'tokens': 'a,de',
    'short':'{d} de {month} de {yyyy}',
    'long': '{d} de {month} de {yyyy} {H}:{mm}',
    'full': '{Weekday}, {d} de {month} de {yyyy} {H}:{mm}:{ss}',
    'past': '{num} {unit} {sign}',
    'future': '{sign} {num} {unit}',
    'duration': '{num} {unit}',
    'timeMarker': 'às',
    'ampm': 'am,pm',
    'modifiers': [
      { 'name': 'day', 'src': 'anteontem', 'value': -2 },
      { 'name': 'day', 'src': 'ontem', 'value': -1 },
      { 'name': 'day', 'src': 'hoje', 'value': 0 },
      { 'name': 'day', 'src': 'amanh:ã|a', 'value': 1 },
      { 'name': 'sign', 'src': 'atrás|atras|há|ha', 'value': -1 },
      { 'name': 'sign', 'src': 'daqui a', 'value': 1 },
      { 'name': 'shift', 'src': 'passad:o|a', 'value': -1 },
      { 'name': 'shift', 'src': 'próximo|próxima|proximo|proxima', 'value': 1 }
    ],
    'dateParse': [
      '{num} {unit} {sign}',
      '{sign} {num} {unit}',
      '{0?} {unit=5-7} {shift}',
      '{0?} {shift} {unit=5-7}'
    ],
    'timeParse': [
      '{date?} {1?} {month} {1?} {year?}',
      '{0?} {shift} {weekday}'
    ]
  });

  /*
   *
   * Date.addLocale(<code>) adds this locale to Sugar.
   * To set the locale globally, simply call:
   *
   * Date.setLocale('ru');
   *
   * var locale = Date.getLocale(<code>) will return this object, which
   * can be tweaked to change the behavior of parsing/formatting in the locales.
   *
   * locale.addFormat adds a date format (see this file for examples).
   * Special tokens in the date format will be parsed out into regex tokens:
   *
   * {0} is a reference to an entry in locale.tokens. Output: (?:the)?
   * {unit} is a reference to all units. Output: (day|week|month|...)
   * {unit3} is a reference to a specific unit. Output: (hour)
   * {unit3-5} is a reference to a subset of the units array. Output: (hour|day|week)
   * {unit?} "?" makes that token optional. Output: (day|week|month)?
   *
   * {day} Any reference to tokens in the modifiers array will include all with the same name. Output: (yesterday|today|tomorrow)
   *
   * All spaces are optional and will be converted to "\s*"
   *
   * Locale arrays months, weekdays, units, numbers, as well as the "src" field for
   * all entries in the modifiers array follow a special format indicated by a colon:
   *
   * minute:|s  = minute|minutes
   * thicke:n|r = thicken|thicker
   *
   * Additionally in the months, weekdays, units, and numbers array these will be added at indexes that are multiples
   * of the relevant number for retrieval. For example having "sunday:|s" in the units array will result in:
   *
   * units: ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sundays']
   *
   * When matched, the index will be found using:
   *
   * units.indexOf(match) % 7;
   *
   * Resulting in the correct index with any number of alternates for that entry.
   *
   */

  Date.addLocale('ru', {
    'months': 'Январ:я|ь,Феврал:я|ь,Март:а|,Апрел:я|ь,Ма:я|й,Июн:я|ь,Июл:я|ь,Август:а|,Сентябр:я|ь,Октябр:я|ь,Ноябр:я|ь,Декабр:я|ь',
    'weekdays': 'Воскресенье,Понедельник,Вторник,Среда,Четверг,Пятница,Суббота',
    'units': 'миллисекунд:а|у|ы|,секунд:а|у|ы|,минут:а|у|ы|,час:||а|ов,день|день|дня|дней,недел:я|ю|и|ь|е,месяц:||а|ев|е,год|год|года|лет|году',
    'numbers': 'од:ин|ну,дв:а|е,три,четыре,пять,шесть,семь,восемь,девять,десять',
    'tokens': 'в|на,г\\.?(?:ода)?',
    'short':'{d} {month} {yyyy} года',
    'long': '{d} {month} {yyyy} года {H}:{mm}',
    'full': '{Weekday} {d} {month} {yyyy} года {H}:{mm}:{ss}',
    'relative': function(num, unit, ms, format) {
      var numberWithUnit, last = num.toString().slice(-1), mult;
      switch(true) {
        case num >= 11 && num <= 15: mult = 3; break;
        case last == 1: mult = 1; break;
        case last >= 2 && last <= 4: mult = 2; break;
        default: mult = 3;
      }
      numberWithUnit = num + ' ' + this['units'][(mult * 8) + unit];
      switch(format) {
        case 'duration':  return numberWithUnit;
        case 'past':      return numberWithUnit + ' назад';
        case 'future':    return 'через ' + numberWithUnit;
      }
    },
    'timeMarker': 'в',
    'ampm': ' утра, вечера',
    'modifiers': [
      { 'name': 'day', 'src': 'позавчера', 'value': -2 },
      { 'name': 'day', 'src': 'вчера', 'value': -1 },
      { 'name': 'day', 'src': 'сегодня', 'value': 0 },
      { 'name': 'day', 'src': 'завтра', 'value': 1 },
      { 'name': 'day', 'src': 'послезавтра', 'value': 2 },
      { 'name': 'sign', 'src': 'назад', 'value': -1 },
      { 'name': 'sign', 'src': 'через', 'value': 1 },
      { 'name': 'shift', 'src': 'прошл:ый|ой|ом', 'value': -1 },
      { 'name': 'shift', 'src': 'следующ:ий|ей|ем', 'value': 1 }
    ],
    'dateParse': [
      '{num} {unit} {sign}',
      '{sign} {num} {unit}',
      '{month} {year}',
      '{0?} {shift} {unit=5-7}'
    ],
    'timeParse': [
      '{date} {month} {year?} {1?}',
      '{0?} {shift} {weekday}'
    ]
  });

  /*
   *
   * Date.addLocale(<code>) adds this locale to Sugar.
   * To set the locale globally, simply call:
   *
   * Date.setLocale('sv');
   *
   * var locale = Date.getLocale(<code>) will return this object, which
   * can be tweaked to change the behavior of parsing/formatting in the locales.
   *
   * locale.addFormat adds a date format (see this file for examples).
   * Special tokens in the date format will be parsed out into regex tokens:
   *
   * {0} is a reference to an entry in locale.tokens. Output: (?:the)?
   * {unit} is a reference to all units. Output: (day|week|month|...)
   * {unit3} is a reference to a specific unit. Output: (hour)
   * {unit3-5} is a reference to a subset of the units array. Output: (hour|day|week)
   * {unit?} "?" makes that token optional. Output: (day|week|month)?
   *
   * {day} Any reference to tokens in the modifiers array will include all with the same name. Output: (yesterday|today|tomorrow)
   *
   * All spaces are optional and will be converted to "\s*"
   *
   * Locale arrays months, weekdays, units, numbers, as well as the "src" field for
   * all entries in the modifiers array follow a special format indicated by a colon:
   *
   * minute:|s  = minute|minutes
   * thicke:n|r = thicken|thicker
   *
   * Additionally in the months, weekdays, units, and numbers array these will be added at indexes that are multiples
   * of the relevant number for retrieval. For example having "sunday:|s" in the units array will result in:
   *
   * units: ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sundays']
   *
   * When matched, the index will be found using:
   *
   * units.indexOf(match) % 7;
   *
   * Resulting in the correct index with any number of alternates for that entry.
   *
   */

  Date.addLocale('sv', {
    'plural': true,
    'months': 'januari,februari,mars,april,maj,juni,juli,augusti,september,oktober,november,december',
    'weekdays': 'söndag|sondag,måndag:|en+mandag:|en,tisdag,onsdag,torsdag,fredag,lördag|lordag',
    'units': 'millisekund:|er,sekund:|er,minut:|er,timm:e|ar,dag:|ar,veck:a|or|an,månad:|er|en+manad:|er|en,år:||et+ar:||et',
    'numbers': 'en|ett,två|tva,tre,fyra,fem,sex,sju,åtta|atta,nio,tio',
    'tokens': 'den,för|for',
    'articles': 'den',
    'short':'den {d} {month} {yyyy}',
    'long': 'den {d} {month} {yyyy} {H}:{mm}',
    'full': '{Weekday} den {d} {month} {yyyy} {H}:{mm}:{ss}',
    'past': '{num} {unit} {sign}',
    'future': '{sign} {num} {unit}',
    'duration': '{num} {unit}',
    'ampm': 'am,pm',
    'modifiers': [
      { 'name': 'day', 'src': 'förrgår|i förrgår|iförrgår|forrgar|i forrgar|iforrgar', 'value': -2 },
      { 'name': 'day', 'src': 'går|i går|igår|gar|i gar|igar', 'value': -1 },
      { 'name': 'day', 'src': 'dag|i dag|idag', 'value': 0 },
      { 'name': 'day', 'src': 'morgon|i morgon|imorgon', 'value': 1 },
      { 'name': 'day', 'src': 'över morgon|övermorgon|i över morgon|i övermorgon|iövermorgon|over morgon|overmorgon|i over morgon|i overmorgon|iovermorgon', 'value': 2 },
      { 'name': 'sign', 'src': 'sedan|sen', 'value': -1 },
      { 'name': 'sign', 'src': 'om', 'value':  1 },
      { 'name': 'shift', 'src': 'i förra|förra|i forra|forra', 'value': -1 },
      { 'name': 'shift', 'src': 'denna', 'value': 0 },
      { 'name': 'shift', 'src': 'nästa|nasta', 'value': 1 }
    ],
    'dateParse': [
      '{num} {unit} {sign}',
      '{sign} {num} {unit}',
      '{1?} {num} {unit} {sign}',
      '{shift} {unit=5-7}'
    ],
    'timeParse': [
      '{0?} {weekday?} {date?} {month} {year}',
      '{date} {month}',
      '{shift} {weekday}'
    ]
  });

  /*
   *
   * Date.addLocale(<code>) adds this locale to Sugar.
   * To set the locale globally, simply call:
   *
   * Date.setLocale('zh-CN');
   *
   * var locale = Date.getLocale(<code>) will return this object, which
   * can be tweaked to change the behavior of parsing/formatting in the locales.
   *
   * locale.addFormat adds a date format (see this file for examples).
   * Special tokens in the date format will be parsed out into regex tokens:
   *
   * {0} is a reference to an entry in locale.tokens. Output: (?:the)?
   * {unit} is a reference to all units. Output: (day|week|month|...)
   * {unit3} is a reference to a specific unit. Output: (hour)
   * {unit3-5} is a reference to a subset of the units array. Output: (hour|day|week)
   * {unit?} "?" makes that token optional. Output: (day|week|month)?
   *
   * {day} Any reference to tokens in the modifiers array will include all with the same name. Output: (yesterday|today|tomorrow)
   *
   * All spaces are optional and will be converted to "\s*"
   *
   * Locale arrays months, weekdays, units, numbers, as well as the "src" field for
   * all entries in the modifiers array follow a special format indicated by a colon:
   *
   * minute:|s  = minute|minutes
   * thicke:n|r = thicken|thicker
   *
   * Additionally in the months, weekdays, units, and numbers array these will be added at indexes that are multiples
   * of the relevant number for retrieval. For example having "sunday:|s" in the units array will result in:
   *
   * units: ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sundays']
   *
   * When matched, the index will be found using:
   *
   * units.indexOf(match) % 7;
   *
   * Resulting in the correct index with any number of alternates for that entry.
   *
   */

  Date.addLocale('zh-CN', {
    'variant': true,
    'monthSuffix': '月',
    'weekdays': '星期日|周日|星期天,星期一|周一,星期二|周二,星期三|周三,星期四|周四,星期五|周五,星期六|周六',
    'units': '毫秒,秒钟,分钟,小时,天,个星期|周,个月,年',
    'tokens': '日|号',
    'short':'{yyyy}年{M}月{d}日',
    'long': '{yyyy}年{M}月{d}日 {tt}{h}:{mm}',
    'full': '{yyyy}年{M}月{d}日 {weekday} {tt}{h}:{mm}:{ss}',
    'past': '{num}{unit}{sign}',
    'future': '{num}{unit}{sign}',
    'duration': '{num}{unit}',
    'timeSuffixes': '点|时,分钟?,秒',
    'ampm': '上午,下午',
    'modifiers': [
      { 'name': 'day', 'src': '大前天', 'value': -3 },
      { 'name': 'day', 'src': '前天', 'value': -2 },
      { 'name': 'day', 'src': '昨天', 'value': -1 },
      { 'name': 'day', 'src': '今天', 'value': 0 },
      { 'name': 'day', 'src': '明天', 'value': 1 },
      { 'name': 'day', 'src': '后天', 'value': 2 },
      { 'name': 'day', 'src': '大后天', 'value': 3 },
      { 'name': 'sign', 'src': '前', 'value': -1 },
      { 'name': 'sign', 'src': '后', 'value':  1 },
      { 'name': 'shift', 'src': '上|去', 'value': -1 },
      { 'name': 'shift', 'src': '这', 'value':  0 },
      { 'name': 'shift', 'src': '下|明', 'value':  1 }
    ],
    'dateParse': [
      '{num}{unit}{sign}',
      '{shift}{unit=5-7}'
    ],
    'timeParse': [
      '{shift}{weekday}',
      '{year}年{month?}月?{date?}{0?}',
      '{month}月{date?}{0?}',
      '{date}[日号]'
    ]
  });

  /*
   *
   * Date.addLocale(<code>) adds this locale to Sugar.
   * To set the locale globally, simply call:
   *
   * Date.setLocale('zh-TW');
   *
   * var locale = Date.getLocale(<code>) will return this object, which
   * can be tweaked to change the behavior of parsing/formatting in the locales.
   *
   * locale.addFormat adds a date format (see this file for examples).
   * Special tokens in the date format will be parsed out into regex tokens:
   *
   * {0} is a reference to an entry in locale.tokens. Output: (?:the)?
   * {unit} is a reference to all units. Output: (day|week|month|...)
   * {unit3} is a reference to a specific unit. Output: (hour)
   * {unit3-5} is a reference to a subset of the units array. Output: (hour|day|week)
   * {unit?} "?" makes that token optional. Output: (day|week|month)?
   *
   * {day} Any reference to tokens in the modifiers array will include all with the same name. Output: (yesterday|today|tomorrow)
   *
   * All spaces are optional and will be converted to "\s*"
   *
   * Locale arrays months, weekdays, units, numbers, as well as the "src" field for
   * all entries in the modifiers array follow a special format indicated by a colon:
   *
   * minute:|s  = minute|minutes
   * thicke:n|r = thicken|thicker
   *
   * Additionally in the months, weekdays, units, and numbers array these will be added at indexes that are multiples
   * of the relevant number for retrieval. For example having "sunday:|s" in the units array will result in:
   *
   * units: ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sundays']
   *
   * When matched, the index will be found using:
   *
   * units.indexOf(match) % 7;
   *
   * Resulting in the correct index with any number of alternates for that entry.
   *
   */

  Date.addLocale('zh-TW', {
    'monthSuffix': '月',
    'weekdays': '星期日|週日|星期天,星期一|週一,星期二|週二,星期三|週三,星期四|週四,星期五|週五,星期六|週六',
    'units': '毫秒,秒鐘,分鐘,小時,天,個星期|週,個月,年',
    'tokens': '日|號',
    'short':'{yyyy}年{M}月{d}日',
    'long': '{yyyy}年{M}月{d}日 {tt}{h}:{mm}',
    'full': '{yyyy}年{M}月{d}日 {Weekday} {tt}{h}:{mm}:{ss}',
    'past': '{num}{unit}{sign}',
    'future': '{num}{unit}{sign}',
    'duration': '{num}{unit}',
    'timeSuffixes': '點|時,分鐘?,秒',
    'ampm': '上午,下午',
    'modifiers': [
      { 'name': 'day', 'src': '大前天', 'value': -3 },
      { 'name': 'day', 'src': '前天', 'value': -2 },
      { 'name': 'day', 'src': '昨天', 'value': -1 },
      { 'name': 'day', 'src': '今天', 'value': 0 },
      { 'name': 'day', 'src': '明天', 'value': 1 },
      { 'name': 'day', 'src': '後天', 'value': 2 },
      { 'name': 'day', 'src': '大後天', 'value': 3 },
      { 'name': 'sign', 'src': '前', 'value': -1 },
      { 'name': 'sign', 'src': '後', 'value': 1 },
      { 'name': 'shift', 'src': '上|去', 'value': -1 },
      { 'name': 'shift', 'src': '這', 'value':  0 },
      { 'name': 'shift', 'src': '下|明', 'value':  1 }
    ],
    'dateParse': [
      '{num}{unit}{sign}',
      '{shift}{unit=5-7}'
    ],
    'timeParse': [
      '{shift}{weekday}',
      '{year}年{month?}月?{date?}{0?}',
      '{month}月{date?}{0?}',
      '{date}[日號]'
    ]
  });


}).call(this);
}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer)
},{"buffer":21}],16:[function(require,module,exports){
//     Underscore.js 1.3.3
//     (c) 2009-2012 Jeremy Ashkenas, DocumentCloud Inc.
//     Underscore is freely distributable under the MIT license.
//     Portions of Underscore are inspired or borrowed from Prototype,
//     Oliver Steele's Functional, and John Resig's Micro-Templating.
//     For all details and documentation:
//     http://documentcloud.github.com/underscore

(function() {

  // Baseline setup
  // --------------

  // Establish the root object, `window` in the browser, or `global` on the server.
  var root = this;

  // Save the previous value of the `_` variable.
  var previousUnderscore = root._;

  // Establish the object that gets returned to break out of a loop iteration.
  var breaker = {};

  // Save bytes in the minified (but not gzipped) version:
  var ArrayProto = Array.prototype, ObjProto = Object.prototype, FuncProto = Function.prototype;

  // Create quick reference variables for speed access to core prototypes.
  var slice            = ArrayProto.slice,
      unshift          = ArrayProto.unshift,
      toString         = ObjProto.toString,
      hasOwnProperty   = ObjProto.hasOwnProperty;

  // All **ECMAScript 5** native function implementations that we hope to use
  // are declared here.
  var
    nativeForEach      = ArrayProto.forEach,
    nativeMap          = ArrayProto.map,
    nativeReduce       = ArrayProto.reduce,
    nativeReduceRight  = ArrayProto.reduceRight,
    nativeFilter       = ArrayProto.filter,
    nativeEvery        = ArrayProto.every,
    nativeSome         = ArrayProto.some,
    nativeIndexOf      = ArrayProto.indexOf,
    nativeLastIndexOf  = ArrayProto.lastIndexOf,
    nativeIsArray      = Array.isArray,
    nativeKeys         = Object.keys,
    nativeBind         = FuncProto.bind;

  // Create a safe reference to the Underscore object for use below.
  var _ = function(obj) { return new wrapper(obj); };

  // Export the Underscore object for **Node.js**, with
  // backwards-compatibility for the old `require()` API. If we're in
  // the browser, add `_` as a global object via a string identifier,
  // for Closure Compiler "advanced" mode.
  if (typeof exports !== 'undefined') {
    if (typeof module !== 'undefined' && module.exports) {
      exports = module.exports = _;
    }
    exports._ = _;
  } else {
    root['_'] = _;
  }

  // Current version.
  _.VERSION = '1.3.3';

  // Collection Functions
  // --------------------

  // The cornerstone, an `each` implementation, aka `forEach`.
  // Handles objects with the built-in `forEach`, arrays, and raw objects.
  // Delegates to **ECMAScript 5**'s native `forEach` if available.
  var each = _.each = _.forEach = function(obj, iterator, context) {
    if (obj == null) return;
    if (nativeForEach && obj.forEach === nativeForEach) {
      obj.forEach(iterator, context);
    } else if (obj.length === +obj.length) {
      for (var i = 0, l = obj.length; i < l; i++) {
        if (i in obj && iterator.call(context, obj[i], i, obj) === breaker) return;
      }
    } else {
      for (var key in obj) {
        if (_.has(obj, key)) {
          if (iterator.call(context, obj[key], key, obj) === breaker) return;
        }
      }
    }
  };

  // Return the results of applying the iterator to each element.
  // Delegates to **ECMAScript 5**'s native `map` if available.
  _.map = _.collect = function(obj, iterator, context) {
    var results = [];
    if (obj == null) return results;
    if (nativeMap && obj.map === nativeMap) return obj.map(iterator, context);
    each(obj, function(value, index, list) {
      results[results.length] = iterator.call(context, value, index, list);
    });
    if (obj.length === +obj.length) results.length = obj.length;
    return results;
  };

  // **Reduce** builds up a single result from a list of values, aka `inject`,
  // or `foldl`. Delegates to **ECMAScript 5**'s native `reduce` if available.
  _.reduce = _.foldl = _.inject = function(obj, iterator, memo, context) {
    var initial = arguments.length > 2;
    if (obj == null) obj = [];
    if (nativeReduce && obj.reduce === nativeReduce) {
      if (context) iterator = _.bind(iterator, context);
      return initial ? obj.reduce(iterator, memo) : obj.reduce(iterator);
    }
    each(obj, function(value, index, list) {
      if (!initial) {
        memo = value;
        initial = true;
      } else {
        memo = iterator.call(context, memo, value, index, list);
      }
    });
    if (!initial) throw new TypeError('Reduce of empty array with no initial value');
    return memo;
  };

  // The right-associative version of reduce, also known as `foldr`.
  // Delegates to **ECMAScript 5**'s native `reduceRight` if available.
  _.reduceRight = _.foldr = function(obj, iterator, memo, context) {
    var initial = arguments.length > 2;
    if (obj == null) obj = [];
    if (nativeReduceRight && obj.reduceRight === nativeReduceRight) {
      if (context) iterator = _.bind(iterator, context);
      return initial ? obj.reduceRight(iterator, memo) : obj.reduceRight(iterator);
    }
    var reversed = _.toArray(obj).reverse();
    if (context && !initial) iterator = _.bind(iterator, context);
    return initial ? _.reduce(reversed, iterator, memo, context) : _.reduce(reversed, iterator);
  };

  // Return the first value which passes a truth test. Aliased as `detect`.
  _.find = _.detect = function(obj, iterator, context) {
    var result;
    any(obj, function(value, index, list) {
      if (iterator.call(context, value, index, list)) {
        result = value;
        return true;
      }
    });
    return result;
  };

  // Return all the elements that pass a truth test.
  // Delegates to **ECMAScript 5**'s native `filter` if available.
  // Aliased as `select`.
  _.filter = _.select = function(obj, iterator, context) {
    var results = [];
    if (obj == null) return results;
    if (nativeFilter && obj.filter === nativeFilter) return obj.filter(iterator, context);
    each(obj, function(value, index, list) {
      if (iterator.call(context, value, index, list)) results[results.length] = value;
    });
    return results;
  };

  // Return all the elements for which a truth test fails.
  _.reject = function(obj, iterator, context) {
    var results = [];
    if (obj == null) return results;
    each(obj, function(value, index, list) {
      if (!iterator.call(context, value, index, list)) results[results.length] = value;
    });
    return results;
  };

  // Determine whether all of the elements match a truth test.
  // Delegates to **ECMAScript 5**'s native `every` if available.
  // Aliased as `all`.
  _.every = _.all = function(obj, iterator, context) {
    var result = true;
    if (obj == null) return result;
    if (nativeEvery && obj.every === nativeEvery) return obj.every(iterator, context);
    each(obj, function(value, index, list) {
      if (!(result = result && iterator.call(context, value, index, list))) return breaker;
    });
    return !!result;
  };

  // Determine if at least one element in the object matches a truth test.
  // Delegates to **ECMAScript 5**'s native `some` if available.
  // Aliased as `any`.
  var any = _.some = _.any = function(obj, iterator, context) {
    iterator || (iterator = _.identity);
    var result = false;
    if (obj == null) return result;
    if (nativeSome && obj.some === nativeSome) return obj.some(iterator, context);
    each(obj, function(value, index, list) {
      if (result || (result = iterator.call(context, value, index, list))) return breaker;
    });
    return !!result;
  };

  // Determine if a given value is included in the array or object using `===`.
  // Aliased as `contains`.
  _.include = _.contains = function(obj, target) {
    var found = false;
    if (obj == null) return found;
    if (nativeIndexOf && obj.indexOf === nativeIndexOf) return obj.indexOf(target) != -1;
    found = any(obj, function(value) {
      return value === target;
    });
    return found;
  };

  // Invoke a method (with arguments) on every item in a collection.
  _.invoke = function(obj, method) {
    var args = slice.call(arguments, 2);
    return _.map(obj, function(value) {
      return (_.isFunction(method) ? method || value : value[method]).apply(value, args);
    });
  };

  // Convenience version of a common use case of `map`: fetching a property.
  _.pluck = function(obj, key) {
    return _.map(obj, function(value){ return value[key]; });
  };

  // Return the maximum element or (element-based computation).
  _.max = function(obj, iterator, context) {
    if (!iterator && _.isArray(obj) && obj[0] === +obj[0]) return Math.max.apply(Math, obj);
    if (!iterator && _.isEmpty(obj)) return -Infinity;
    var result = {computed : -Infinity};
    each(obj, function(value, index, list) {
      var computed = iterator ? iterator.call(context, value, index, list) : value;
      computed >= result.computed && (result = {value : value, computed : computed});
    });
    return result.value;
  };

  // Return the minimum element (or element-based computation).
  _.min = function(obj, iterator, context) {
    if (!iterator && _.isArray(obj) && obj[0] === +obj[0]) return Math.min.apply(Math, obj);
    if (!iterator && _.isEmpty(obj)) return Infinity;
    var result = {computed : Infinity};
    each(obj, function(value, index, list) {
      var computed = iterator ? iterator.call(context, value, index, list) : value;
      computed < result.computed && (result = {value : value, computed : computed});
    });
    return result.value;
  };

  // Shuffle an array.
  _.shuffle = function(obj) {
    var shuffled = [], rand;
    each(obj, function(value, index, list) {
      rand = Math.floor(Math.random() * (index + 1));
      shuffled[index] = shuffled[rand];
      shuffled[rand] = value;
    });
    return shuffled;
  };

  // Sort the object's values by a criterion produced by an iterator.
  _.sortBy = function(obj, val, context) {
    var iterator = _.isFunction(val) ? val : function(obj) { return obj[val]; };
    return _.pluck(_.map(obj, function(value, index, list) {
      return {
        value : value,
        criteria : iterator.call(context, value, index, list)
      };
    }).sort(function(left, right) {
      var a = left.criteria, b = right.criteria;
      if (a === void 0) return 1;
      if (b === void 0) return -1;
      return a < b ? -1 : a > b ? 1 : 0;
    }), 'value');
  };

  // Groups the object's values by a criterion. Pass either a string attribute
  // to group by, or a function that returns the criterion.
  _.groupBy = function(obj, val) {
    var result = {};
    var iterator = _.isFunction(val) ? val : function(obj) { return obj[val]; };
    each(obj, function(value, index) {
      var key = iterator(value, index);
      (result[key] || (result[key] = [])).push(value);
    });
    return result;
  };

  // Use a comparator function to figure out at what index an object should
  // be inserted so as to maintain order. Uses binary search.
  _.sortedIndex = function(array, obj, iterator) {
    iterator || (iterator = _.identity);
    var low = 0, high = array.length;
    while (low < high) {
      var mid = (low + high) >> 1;
      iterator(array[mid]) < iterator(obj) ? low = mid + 1 : high = mid;
    }
    return low;
  };

  // Safely convert anything iterable into a real, live array.
  _.toArray = function(obj) {
    if (!obj)                                     return [];
    if (_.isArray(obj))                           return slice.call(obj);
    if (_.isArguments(obj))                       return slice.call(obj);
    if (obj.toArray && _.isFunction(obj.toArray)) return obj.toArray();
    return _.values(obj);
  };

  // Return the number of elements in an object.
  _.size = function(obj) {
    return _.isArray(obj) ? obj.length : _.keys(obj).length;
  };

  // Array Functions
  // ---------------

  // Get the first element of an array. Passing **n** will return the first N
  // values in the array. Aliased as `head` and `take`. The **guard** check
  // allows it to work with `_.map`.
  _.first = _.head = _.take = function(array, n, guard) {
    return (n != null) && !guard ? slice.call(array, 0, n) : array[0];
  };

  // Returns everything but the last entry of the array. Especcialy useful on
  // the arguments object. Passing **n** will return all the values in
  // the array, excluding the last N. The **guard** check allows it to work with
  // `_.map`.
  _.initial = function(array, n, guard) {
    return slice.call(array, 0, array.length - ((n == null) || guard ? 1 : n));
  };

  // Get the last element of an array. Passing **n** will return the last N
  // values in the array. The **guard** check allows it to work with `_.map`.
  _.last = function(array, n, guard) {
    if ((n != null) && !guard) {
      return slice.call(array, Math.max(array.length - n, 0));
    } else {
      return array[array.length - 1];
    }
  };

  // Returns everything but the first entry of the array. Aliased as `tail`.
  // Especially useful on the arguments object. Passing an **index** will return
  // the rest of the values in the array from that index onward. The **guard**
  // check allows it to work with `_.map`.
  _.rest = _.tail = function(array, index, guard) {
    return slice.call(array, (index == null) || guard ? 1 : index);
  };

  // Trim out all falsy values from an array.
  _.compact = function(array) {
    return _.filter(array, function(value){ return !!value; });
  };

  // Return a completely flattened version of an array.
  _.flatten = function(array, shallow) {
    return _.reduce(array, function(memo, value) {
      if (_.isArray(value)) return memo.concat(shallow ? value : _.flatten(value));
      memo[memo.length] = value;
      return memo;
    }, []);
  };

  // Return a version of the array that does not contain the specified value(s).
  _.without = function(array) {
    return _.difference(array, slice.call(arguments, 1));
  };

  // Produce a duplicate-free version of the array. If the array has already
  // been sorted, you have the option of using a faster algorithm.
  // Aliased as `unique`.
  _.uniq = _.unique = function(array, isSorted, iterator) {
    var initial = iterator ? _.map(array, iterator) : array;
    var results = [];
    // The `isSorted` flag is irrelevant if the array only contains two elements.
    if (array.length < 3) isSorted = true;
    _.reduce(initial, function (memo, value, index) {
      if (isSorted ? _.last(memo) !== value || !memo.length : !_.include(memo, value)) {
        memo.push(value);
        results.push(array[index]);
      }
      return memo;
    }, []);
    return results;
  };

  // Produce an array that contains the union: each distinct element from all of
  // the passed-in arrays.
  _.union = function() {
    return _.uniq(_.flatten(arguments, true));
  };

  // Produce an array that contains every item shared between all the
  // passed-in arrays. (Aliased as "intersect" for back-compat.)
  _.intersection = _.intersect = function(array) {
    var rest = slice.call(arguments, 1);
    return _.filter(_.uniq(array), function(item) {
      return _.every(rest, function(other) {
        return _.indexOf(other, item) >= 0;
      });
    });
  };

  // Take the difference between one array and a number of other arrays.
  // Only the elements present in just the first array will remain.
  _.difference = function(array) {
    var rest = _.flatten(slice.call(arguments, 1), true);
    return _.filter(array, function(value){ return !_.include(rest, value); });
  };

  // Zip together multiple lists into a single array -- elements that share
  // an index go together.
  _.zip = function() {
    var args = slice.call(arguments);
    var length = _.max(_.pluck(args, 'length'));
    var results = new Array(length);
    for (var i = 0; i < length; i++) results[i] = _.pluck(args, "" + i);
    return results;
  };

  // If the browser doesn't supply us with indexOf (I'm looking at you, **MSIE**),
  // we need this function. Return the position of the first occurrence of an
  // item in an array, or -1 if the item is not included in the array.
  // Delegates to **ECMAScript 5**'s native `indexOf` if available.
  // If the array is large and already in sort order, pass `true`
  // for **isSorted** to use binary search.
  _.indexOf = function(array, item, isSorted) {
    if (array == null) return -1;
    var i, l;
    if (isSorted) {
      i = _.sortedIndex(array, item);
      return array[i] === item ? i : -1;
    }
    if (nativeIndexOf && array.indexOf === nativeIndexOf) return array.indexOf(item);
    for (i = 0, l = array.length; i < l; i++) if (i in array && array[i] === item) return i;
    return -1;
  };

  // Delegates to **ECMAScript 5**'s native `lastIndexOf` if available.
  _.lastIndexOf = function(array, item) {
    if (array == null) return -1;
    if (nativeLastIndexOf && array.lastIndexOf === nativeLastIndexOf) return array.lastIndexOf(item);
    var i = array.length;
    while (i--) if (i in array && array[i] === item) return i;
    return -1;
  };

  // Generate an integer Array containing an arithmetic progression. A port of
  // the native Python `range()` function. See
  // [the Python documentation](http://docs.python.org/library/functions.html#range).
  _.range = function(start, stop, step) {
    if (arguments.length <= 1) {
      stop = start || 0;
      start = 0;
    }
    step = arguments[2] || 1;

    var len = Math.max(Math.ceil((stop - start) / step), 0);
    var idx = 0;
    var range = new Array(len);

    while(idx < len) {
      range[idx++] = start;
      start += step;
    }

    return range;
  };

  // Function (ahem) Functions
  // ------------------

  // Reusable constructor function for prototype setting.
  var ctor = function(){};

  // Create a function bound to a given object (assigning `this`, and arguments,
  // optionally). Binding with arguments is also known as `curry`.
  // Delegates to **ECMAScript 5**'s native `Function.bind` if available.
  // We check for `func.bind` first, to fail fast when `func` is undefined.
  _.bind = function bind(func, context) {
    var bound, args;
    if (func.bind === nativeBind && nativeBind) return nativeBind.apply(func, slice.call(arguments, 1));
    if (!_.isFunction(func)) throw new TypeError;
    args = slice.call(arguments, 2);
    return bound = function() {
      if (!(this instanceof bound)) return func.apply(context, args.concat(slice.call(arguments)));
      ctor.prototype = func.prototype;
      var self = new ctor;
      var result = func.apply(self, args.concat(slice.call(arguments)));
      if (Object(result) === result) return result;
      return self;
    };
  };

  // Bind all of an object's methods to that object. Useful for ensuring that
  // all callbacks defined on an object belong to it.
  _.bindAll = function(obj) {
    var funcs = slice.call(arguments, 1);
    if (funcs.length == 0) funcs = _.functions(obj);
    each(funcs, function(f) { obj[f] = _.bind(obj[f], obj); });
    return obj;
  };

  // Memoize an expensive function by storing its results.
  _.memoize = function(func, hasher) {
    var memo = {};
    hasher || (hasher = _.identity);
    return function() {
      var key = hasher.apply(this, arguments);
      return _.has(memo, key) ? memo[key] : (memo[key] = func.apply(this, arguments));
    };
  };

  // Delays a function for the given number of milliseconds, and then calls
  // it with the arguments supplied.
  _.delay = function(func, wait) {
    var args = slice.call(arguments, 2);
    return setTimeout(function(){ return func.apply(null, args); }, wait);
  };

  // Defers a function, scheduling it to run after the current call stack has
  // cleared.
  _.defer = function(func) {
    return _.delay.apply(_, [func, 1].concat(slice.call(arguments, 1)));
  };

  // Returns a function, that, when invoked, will only be triggered at most once
  // during a given window of time.
  _.throttle = function(func, wait) {
    var context, args, timeout, throttling, more, result;
    var whenDone = _.debounce(function(){ more = throttling = false; }, wait);
    return function() {
      context = this; args = arguments;
      var later = function() {
        timeout = null;
        if (more) func.apply(context, args);
        whenDone();
      };
      if (!timeout) timeout = setTimeout(later, wait);
      if (throttling) {
        more = true;
      } else {
        result = func.apply(context, args);
      }
      whenDone();
      throttling = true;
      return result;
    };
  };

  // Returns a function, that, as long as it continues to be invoked, will not
  // be triggered. The function will be called after it stops being called for
  // N milliseconds. If `immediate` is passed, trigger the function on the
  // leading edge, instead of the trailing.
  _.debounce = function(func, wait, immediate) {
    var timeout;
    return function() {
      var context = this, args = arguments;
      var later = function() {
        timeout = null;
        if (!immediate) func.apply(context, args);
      };
      if (immediate && !timeout) func.apply(context, args);
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  };

  // Returns a function that will be executed at most one time, no matter how
  // often you call it. Useful for lazy initialization.
  _.once = function(func) {
    var ran = false, memo;
    return function() {
      if (ran) return memo;
      ran = true;
      return memo = func.apply(this, arguments);
    };
  };

  // Returns the first function passed as an argument to the second,
  // allowing you to adjust arguments, run code before and after, and
  // conditionally execute the original function.
  _.wrap = function(func, wrapper) {
    return function() {
      var args = [func].concat(slice.call(arguments, 0));
      return wrapper.apply(this, args);
    };
  };

  // Returns a function that is the composition of a list of functions, each
  // consuming the return value of the function that follows.
  _.compose = function() {
    var funcs = arguments;
    return function() {
      var args = arguments;
      for (var i = funcs.length - 1; i >= 0; i--) {
        args = [funcs[i].apply(this, args)];
      }
      return args[0];
    };
  };

  // Returns a function that will only be executed after being called N times.
  _.after = function(times, func) {
    if (times <= 0) return func();
    return function() {
      if (--times < 1) { return func.apply(this, arguments); }
    };
  };

  // Object Functions
  // ----------------

  // Retrieve the names of an object's properties.
  // Delegates to **ECMAScript 5**'s native `Object.keys`
  _.keys = nativeKeys || function(obj) {
    if (obj !== Object(obj)) throw new TypeError('Invalid object');
    var keys = [];
    for (var key in obj) if (_.has(obj, key)) keys[keys.length] = key;
    return keys;
  };

  // Retrieve the values of an object's properties.
  _.values = function(obj) {
    return _.map(obj, _.identity);
  };

  // Return a sorted list of the function names available on the object.
  // Aliased as `methods`
  _.functions = _.methods = function(obj) {
    var names = [];
    for (var key in obj) {
      if (_.isFunction(obj[key])) names.push(key);
    }
    return names.sort();
  };

  // Extend a given object with all the properties in passed-in object(s).
  _.extend = function(obj) {
    each(slice.call(arguments, 1), function(source) {
      for (var prop in source) {
        obj[prop] = source[prop];
      }
    });
    return obj;
  };

  // Return a copy of the object only containing the whitelisted properties.
  _.pick = function(obj) {
    var result = {};
    each(_.flatten(slice.call(arguments, 1)), function(key) {
      if (key in obj) result[key] = obj[key];
    });
    return result;
  };

  // Fill in a given object with default properties.
  _.defaults = function(obj) {
    each(slice.call(arguments, 1), function(source) {
      for (var prop in source) {
        if (obj[prop] == null) obj[prop] = source[prop];
      }
    });
    return obj;
  };

  // Create a (shallow-cloned) duplicate of an object.
  _.clone = function(obj) {
    if (!_.isObject(obj)) return obj;
    return _.isArray(obj) ? obj.slice() : _.extend({}, obj);
  };

  // Invokes interceptor with the obj, and then returns obj.
  // The primary purpose of this method is to "tap into" a method chain, in
  // order to perform operations on intermediate results within the chain.
  _.tap = function(obj, interceptor) {
    interceptor(obj);
    return obj;
  };

  // Internal recursive comparison function.
  function eq(a, b, stack) {
    // Identical objects are equal. `0 === -0`, but they aren't identical.
    // See the Harmony `egal` proposal: http://wiki.ecmascript.org/doku.php?id=harmony:egal.
    if (a === b) return a !== 0 || 1 / a == 1 / b;
    // A strict comparison is necessary because `null == undefined`.
    if (a == null || b == null) return a === b;
    // Unwrap any wrapped objects.
    if (a._chain) a = a._wrapped;
    if (b._chain) b = b._wrapped;
    // Invoke a custom `isEqual` method if one is provided.
    if (a.isEqual && _.isFunction(a.isEqual)) return a.isEqual(b);
    if (b.isEqual && _.isFunction(b.isEqual)) return b.isEqual(a);
    // Compare `[[Class]]` names.
    var className = toString.call(a);
    if (className != toString.call(b)) return false;
    switch (className) {
      // Strings, numbers, dates, and booleans are compared by value.
      case '[object String]':
        // Primitives and their corresponding object wrappers are equivalent; thus, `"5"` is
        // equivalent to `new String("5")`.
        return a == String(b);
      case '[object Number]':
        // `NaN`s are equivalent, but non-reflexive. An `egal` comparison is performed for
        // other numeric values.
        return a != +a ? b != +b : (a == 0 ? 1 / a == 1 / b : a == +b);
      case '[object Date]':
      case '[object Boolean]':
        // Coerce dates and booleans to numeric primitive values. Dates are compared by their
        // millisecond representations. Note that invalid dates with millisecond representations
        // of `NaN` are not equivalent.
        return +a == +b;
      // RegExps are compared by their source patterns and flags.
      case '[object RegExp]':
        return a.source == b.source &&
               a.global == b.global &&
               a.multiline == b.multiline &&
               a.ignoreCase == b.ignoreCase;
    }
    if (typeof a != 'object' || typeof b != 'object') return false;
    // Assume equality for cyclic structures. The algorithm for detecting cyclic
    // structures is adapted from ES 5.1 section 15.12.3, abstract operation `JO`.
    var length = stack.length;
    while (length--) {
      // Linear search. Performance is inversely proportional to the number of
      // unique nested structures.
      if (stack[length] == a) return true;
    }
    // Add the first object to the stack of traversed objects.
    stack.push(a);
    var size = 0, result = true;
    // Recursively compare objects and arrays.
    if (className == '[object Array]') {
      // Compare array lengths to determine if a deep comparison is necessary.
      size = a.length;
      result = size == b.length;
      if (result) {
        // Deep compare the contents, ignoring non-numeric properties.
        while (size--) {
          // Ensure commutative equality for sparse arrays.
          if (!(result = size in a == size in b && eq(a[size], b[size], stack))) break;
        }
      }
    } else {
      // Objects with different constructors are not equivalent.
      if ('constructor' in a != 'constructor' in b || a.constructor != b.constructor) return false;
      // Deep compare objects.
      for (var key in a) {
        if (_.has(a, key)) {
          // Count the expected number of properties.
          size++;
          // Deep compare each member.
          if (!(result = _.has(b, key) && eq(a[key], b[key], stack))) break;
        }
      }
      // Ensure that both objects contain the same number of properties.
      if (result) {
        for (key in b) {
          if (_.has(b, key) && !(size--)) break;
        }
        result = !size;
      }
    }
    // Remove the first object from the stack of traversed objects.
    stack.pop();
    return result;
  }

  // Perform a deep comparison to check if two objects are equal.
  _.isEqual = function(a, b) {
    return eq(a, b, []);
  };

  // Is a given array, string, or object empty?
  // An "empty" object has no enumerable own-properties.
  _.isEmpty = function(obj) {
    if (obj == null) return true;
    if (_.isArray(obj) || _.isString(obj)) return obj.length === 0;
    for (var key in obj) if (_.has(obj, key)) return false;
    return true;
  };

  // Is a given value a DOM element?
  _.isElement = function(obj) {
    return !!(obj && obj.nodeType == 1);
  };

  // Is a given value an array?
  // Delegates to ECMA5's native Array.isArray
  _.isArray = nativeIsArray || function(obj) {
    return toString.call(obj) == '[object Array]';
  };

  // Is a given variable an object?
  _.isObject = function(obj) {
    return obj === Object(obj);
  };

  // Is a given variable an arguments object?
  _.isArguments = function(obj) {
    return toString.call(obj) == '[object Arguments]';
  };
  if (!_.isArguments(arguments)) {
    _.isArguments = function(obj) {
      return !!(obj && _.has(obj, 'callee'));
    };
  }

  // Is a given value a function?
  _.isFunction = function(obj) {
    return toString.call(obj) == '[object Function]';
  };

  // Is a given value a string?
  _.isString = function(obj) {
    return toString.call(obj) == '[object String]';
  };

  // Is a given value a number?
  _.isNumber = function(obj) {
    return toString.call(obj) == '[object Number]';
  };

  // Is a given object a finite number?
  _.isFinite = function(obj) {
    return _.isNumber(obj) && isFinite(obj);
  };

  // Is the given value `NaN`?
  _.isNaN = function(obj) {
    // `NaN` is the only value for which `===` is not reflexive.
    return obj !== obj;
  };

  // Is a given value a boolean?
  _.isBoolean = function(obj) {
    return obj === true || obj === false || toString.call(obj) == '[object Boolean]';
  };

  // Is a given value a date?
  _.isDate = function(obj) {
    return toString.call(obj) == '[object Date]';
  };

  // Is the given value a regular expression?
  _.isRegExp = function(obj) {
    return toString.call(obj) == '[object RegExp]';
  };

  // Is a given value equal to null?
  _.isNull = function(obj) {
    return obj === null;
  };

  // Is a given variable undefined?
  _.isUndefined = function(obj) {
    return obj === void 0;
  };

  // Has own property?
  _.has = function(obj, key) {
    return hasOwnProperty.call(obj, key);
  };

  // Utility Functions
  // -----------------

  // Run Underscore.js in *noConflict* mode, returning the `_` variable to its
  // previous owner. Returns a reference to the Underscore object.
  _.noConflict = function() {
    root._ = previousUnderscore;
    return this;
  };

  // Keep the identity function around for default iterators.
  _.identity = function(value) {
    return value;
  };

  // Run a function **n** times.
  _.times = function (n, iterator, context) {
    for (var i = 0; i < n; i++) iterator.call(context, i);
  };

  // Escape a string for HTML interpolation.
  _.escape = function(string) {
    return (''+string).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#x27;').replace(/\//g,'&#x2F;');
  };

  // If the value of the named property is a function then invoke it;
  // otherwise, return it.
  _.result = function(object, property) {
    if (object == null) return null;
    var value = object[property];
    return _.isFunction(value) ? value.call(object) : value;
  };

  // Add your own custom functions to the Underscore object, ensuring that
  // they're correctly added to the OOP wrapper as well.
  _.mixin = function(obj) {
    each(_.functions(obj), function(name){
      addToWrapper(name, _[name] = obj[name]);
    });
  };

  // Generate a unique integer id (unique within the entire client session).
  // Useful for temporary DOM ids.
  var idCounter = 0;
  _.uniqueId = function(prefix) {
    var id = idCounter++;
    return prefix ? prefix + id : id;
  };

  // By default, Underscore uses ERB-style template delimiters, change the
  // following template settings to use alternative delimiters.
  _.templateSettings = {
    evaluate    : /<%([\s\S]+?)%>/g,
    interpolate : /<%=([\s\S]+?)%>/g,
    escape      : /<%-([\s\S]+?)%>/g
  };

  // When customizing `templateSettings`, if you don't want to define an
  // interpolation, evaluation or escaping regex, we need one that is
  // guaranteed not to match.
  var noMatch = /.^/;

  // Certain characters need to be escaped so that they can be put into a
  // string literal.
  var escapes = {
    '\\': '\\',
    "'": "'",
    'r': '\r',
    'n': '\n',
    't': '\t',
    'u2028': '\u2028',
    'u2029': '\u2029'
  };

  for (var p in escapes) escapes[escapes[p]] = p;
  var escaper = /\\|'|\r|\n|\t|\u2028|\u2029/g;
  var unescaper = /\\(\\|'|r|n|t|u2028|u2029)/g;

  // Within an interpolation, evaluation, or escaping, remove HTML escaping
  // that had been previously added.
  var unescape = function(code) {
    return code.replace(unescaper, function(match, escape) {
      return escapes[escape];
    });
  };

  // JavaScript micro-templating, similar to John Resig's implementation.
  // Underscore templating handles arbitrary delimiters, preserves whitespace,
  // and correctly escapes quotes within interpolated code.
  _.template = function(text, data, settings) {
    settings = _.defaults(settings || {}, _.templateSettings);

    // Compile the template source, taking care to escape characters that
    // cannot be included in a string literal and then unescape them in code
    // blocks.
    var source = "__p+='" + text
      .replace(escaper, function(match) {
        return '\\' + escapes[match];
      })
      .replace(settings.escape || noMatch, function(match, code) {
        return "'+\n_.escape(" + unescape(code) + ")+\n'";
      })
      .replace(settings.interpolate || noMatch, function(match, code) {
        return "'+\n(" + unescape(code) + ")+\n'";
      })
      .replace(settings.evaluate || noMatch, function(match, code) {
        return "';\n" + unescape(code) + "\n;__p+='";
      }) + "';\n";

    // If a variable is not specified, place data values in local scope.
    if (!settings.variable) source = 'with(obj||{}){\n' + source + '}\n';

    source = "var __p='';" +
      "var print=function(){__p+=Array.prototype.join.call(arguments, '')};\n" +
      source + "return __p;\n";

    var render = new Function(settings.variable || 'obj', '_', source);
    if (data) return render(data, _);
    var template = function(data) {
      return render.call(this, data, _);
    };

    // Provide the compiled function source as a convenience for build time
    // precompilation.
    template.source = 'function(' + (settings.variable || 'obj') + '){\n' +
      source + '}';

    return template;
  };

  // Add a "chain" function, which will delegate to the wrapper.
  _.chain = function(obj) {
    return _(obj).chain();
  };

  // The OOP Wrapper
  // ---------------

  // If Underscore is called as a function, it returns a wrapped object that
  // can be used OO-style. This wrapper holds altered versions of all the
  // underscore functions. Wrapped objects may be chained.
  var wrapper = function(obj) { this._wrapped = obj; };

  // Expose `wrapper.prototype` as `_.prototype`
  _.prototype = wrapper.prototype;

  // Helper function to continue chaining intermediate results.
  var result = function(obj, chain) {
    return chain ? _(obj).chain() : obj;
  };

  // A method to easily add functions to the OOP wrapper.
  var addToWrapper = function(name, func) {
    wrapper.prototype[name] = function() {
      var args = slice.call(arguments);
      unshift.call(args, this._wrapped);
      return result(func.apply(_, args), this._chain);
    };
  };

  // Add all of the Underscore functions to the wrapper object.
  _.mixin(_);

  // Add all mutator Array functions to the wrapper.
  each(['pop', 'push', 'reverse', 'shift', 'sort', 'splice', 'unshift'], function(name) {
    var method = ArrayProto[name];
    wrapper.prototype[name] = function() {
      var wrapped = this._wrapped;
      method.apply(wrapped, arguments);
      var length = wrapped.length;
      if ((name == 'shift' || name == 'splice') && length === 0) delete wrapped[0];
      return result(wrapped, this._chain);
    };
  });

  // Add all accessor Array functions to the wrapper.
  each(['concat', 'join', 'slice'], function(name) {
    var method = ArrayProto[name];
    wrapper.prototype[name] = function() {
      return result(method.apply(this._wrapped, arguments), this._chain);
    };
  });

  // Start chaining a wrapped Underscore object.
  wrapper.prototype.chain = function() {
    this._chain = true;
    return this;
  };

  // Extracts the result from a wrapped and chained object.
  wrapper.prototype.value = function() {
    return this._wrapped;
  };

}).call(this);

},{}],17:[function(require,module,exports){
'use strict';

var botname = "Bobby";
var username = "Stranger";

var annyang = require('./libs/annyang');
var synth = require('./libs/text-to-speech');
var Ector = require('ector');

var GoogleSearch = require('google-search');
var googleSearch = new GoogleSearch({
    key: 'AIzaSyDlW-v-95FixjfVysJWlnquMaGJCoOERzY',
    cx: '009559986388052249737:4vu6h-gj9oe'
});

var ector = new Ector(botname, username);
var botController = require('./bot-helper')(ector);
botController.load();


var speaker = new synth("Google US English");

speaker.onBefore(function(){
    if (annyang.isListening())
        annyang.pause();
});

speaker.onAfter(function(){
    if (!annyang.isListening())
        annyang.resume();
});


var anything = {
    "*anything": function(convo){
        speaker.speak(botController.replyTo(convo));
    }
};

function search(term) {
    botController.replyTo('tell me about'+ term);

    googleSearch.build({
            q: term,
            num: 10 // Number of search results to return between 1 and 10, inclusive
        }, function(error, response) {

            var snippet = "";
            if (response.items) {
                for(var i in response.items) {
                    snippet = response.items[i].snippet;
                    botController.replyTo(snippet);
                }
            } else {
                botController.replyTo("I don't know anything about, "+thing);
            }

            speaker.speak(snippet);
        });
}


var commands = {
    "(no) my name is :name": function(name){
        botController.changeUsername(name);
        speaker.speak(botController.replyTo("My name is "+name));
    },
    "hey :name" : function(botname) {
        if(botname == ector.name) {
            annyang.addCommands(anything);
            speaker.speak(botController.replyTo("hey "+botname));
        }
    },
    '(okay) shut up': function() {
        annyang.removeCommands(["*anything"]);
        speaker.speak(botController.replyTo("Okay, shut up!"));
        botController.save();
    },
    '(okay) I\'m done': function() {
        annyang.removeCommands(["*anything"]);
        speaker.speak(botController.replyTo("I'm done."));
        botController.save();
    },
    'tell me about *thing': search
};

// Add our commands to annyang
annyang.addCommands(commands);

annyang.debug(true);
try {
    // Start listening. You can call this here, or attach this call to an event, button, etc.
    annyang.start();
} catch (e) {
    console.log(e);
}






},{"./bot-helper":18,"./libs/annyang":19,"./libs/text-to-speech":20,"ector":8,"google-search":9}],18:[function(require,module,exports){
module.exports = function(ector) {


    var previousResponseNodes = null;

    var commands = {
        load: function(){
            var cn = window.cn = localStorage.ector?localStorage.ector: {};
            ector.cns = {};
            var newCN = Object.create(require('concept-network').ConceptNetwork.prototype);
            Object.merge(newCN, JSON.parse(cn));
            ector.cn = newCN;
            ector.setUser(ector.username);
            return false;
        },
        save:function(){
            localStorage.setItem('ector', JSON.stringify(ector.cn));
        },
        replyTo: function(convo){
            ector.addEntry(convo);
            ector.linkNodesToLastSentence(previousResponseNodes);
            var response = ector.generateResponse();
            console.log('%s: %s', ector.name, response.sentence);
            previousResponseNodes = response.nodes;

            return response.sentence;
        },
        changeUsername: function(username) {
            ector.setUser(username);
        },
        changeBotName: function(botname){
            ector.setName(botname);
        },
        selfAwareness: function(response){

            var name = response.match(/my name is (\w+)/i)[1];
            if (name) {
                this.changeBotName(name);
                return ;
            }

            var search = response.match(/ok let me google (\w+[\s|\w]*)*/i)[1];




        }

    };



    return commands;


};




},{"concept-network":1}],19:[function(require,module,exports){
//! annyang
//! version : 2.5.0
//! author  : Tal Ater @TalAter
//! license : MIT
//! https://www.TalAter.com/annyang/
(function (root, factory) {
    "use strict";
    if (typeof define === 'function' && define.amd) { // AMD + global
        define([], function () {
            return (root.annyang = factory(root));
        });
    } else if (typeof module === 'object' && module.exports) { // CommonJS
        module.exports = factory(root);
    } else { // Browser globals
        root.annyang = factory(root);
    }
}(typeof window !== 'undefined' ? window : this, function (root, undefined) {
    "use strict";

    /**
     * # Quick Tutorial, Intro and Demos
     *
     * The quickest way to get started is to visit the [annyang homepage](https://www.talater.com/annyang/).
     *
     * For a more in-depth look at annyang, read on.
     *
     * # API Reference
     */

    var annyang;

    // Get the SpeechRecognition object, while handling browser prefixes
    var SpeechRecognition = root.SpeechRecognition ||
        root.webkitSpeechRecognition ||
        root.mozSpeechRecognition ||
        root.msSpeechRecognition ||
        root.oSpeechRecognition;

    // Check browser support
    // This is done as early as possible, to make it as fast as possible for unsupported browsers
    if (!SpeechRecognition) {
        return null;
    }

    var commandsList = [];
    var recognition;
    var callbacks = { start: [], error: [], end: [], result: [], resultMatch: [], resultNoMatch: [], errorNetwork: [], errorPermissionBlocked: [], errorPermissionDenied: [] };
    var autoRestart;
    var lastStartedAt = 0;
    var autoRestartCount = 0;
    var debugState = false;
    var debugStyle = 'font-weight: bold; color: #00f;';
    var pauseListening = false;
    var isListening = false;

    // The command matching code is a modified version of Backbone.Router by Jeremy Ashkenas, under the MIT license.
    var optionalParam = /\s*\((.*?)\)\s*/g;
    var optionalRegex = /(\(\?:[^)]+\))\?/g;
    var namedParam    = /(\(\?)?:\w+/g;
    var splatParam    = /\*\w+/g;
    var escapeRegExp  = /[\-{}\[\]+?.,\\\^$|#]/g;
    var commandToRegExp = function(command) {
        command = command.replace(escapeRegExp, '\\$&')
            .replace(optionalParam, '(?:$1)?')
            .replace(namedParam, function(match, optional) {
                return optional ? match : '([^\\s]+)';
            })
            .replace(splatParam, '(.*?)')
            .replace(optionalRegex, '\\s*$1?\\s*');
        return new RegExp('^' + command + '$', 'i');
    };

    // This method receives an array of callbacks to iterate over, and invokes each of them
    var invokeCallbacks = function(callbacks) {
        var args = Array.prototype.slice.call(arguments, 1);
        callbacks.forEach(function(callback) {
            callback.callback.apply(callback.context, args);
        });
    };

    var isInitialized = function() {
        return recognition !== undefined;
    };

    // method for logging in developer console when debug mode is on
    var logMessage = function(text, extraParameters) {
        if (text.indexOf('%c') === -1 && !extraParameters) {
            console.log(text);
        } else {
            extraParameters = extraParameters || debugStyle;
            console.log(text, extraParameters);
        }
    };

    var initIfNeeded = function() {
        if (!isInitialized()) {
            annyang.init({}, false);
        }
    };

    var registerCommand = function(command, cb, phrase) {
        commandsList.push({ command: command, callback: cb, originalPhrase: phrase });
        if (debugState) {
            logMessage('Command successfully loaded: %c'+phrase, debugStyle);
        }
    };

    var parseResults = function(results) {
        invokeCallbacks(callbacks.result, results);
        var commandText;
        // go over each of the 5 results and alternative results received (we've set maxAlternatives to 5 above)
        for (var i = 0; i<results.length; i++) {
            // the text recognized
            commandText = results[i].trim();
            if (debugState) {
                logMessage('Speech recognized: %c'+commandText, debugStyle);
            }

            // try and match recognized text to one of the commands on the list
            for (var j = 0, l = commandsList.length; j < l; j++) {
                var currentCommand = commandsList[j];
                var result = currentCommand.command.exec(commandText);
                if (result) {
                    var parameters = result.slice(1);
                    if (debugState) {
                        logMessage('command matched: %c'+currentCommand.originalPhrase, debugStyle);
                        if (parameters.length) {
                            logMessage('with parameters', parameters);
                        }
                    }
                    // execute the matched command
                    currentCommand.callback.apply(this, parameters);
                    invokeCallbacks(callbacks.resultMatch, commandText, currentCommand.originalPhrase, results);
                    return;
                }
            }
        }
        invokeCallbacks(callbacks.resultNoMatch, results);
    };

    annyang = {

        /**
         * Initialize annyang with a list of commands to recognize.
         *
         * #### Examples:
         * ````javascript
         * var commands = {'hello :name': helloFunction};
         * var commands2 = {'hi': helloFunction};
         *
         * // initialize annyang, overwriting any previously added commands
         * annyang.init(commands, true);
         * // adds an additional command without removing the previous commands
         * annyang.init(commands2, false);
         * ````
         * As of v1.1.0 it is no longer required to call init(). Just start() listening whenever you want, and addCommands() whenever, and as often as you like.
         *
         * @param {Object} commands - Commands that annyang should listen to
         * @param {boolean} [resetCommands=true] - Remove all commands before initializing?
         * @method init
         * @deprecated
         * @see [Commands Object](#commands-object)
         */
        init: function(commands, resetCommands) {

            // resetCommands defaults to true
            if (resetCommands === undefined) {
                resetCommands = true;
            } else {
                resetCommands = !!resetCommands;
            }

            // Abort previous instances of recognition already running
            if (recognition && recognition.abort) {
                recognition.abort();
            }

            // initiate SpeechRecognition
            recognition = new SpeechRecognition();

            // Set the max number of alternative transcripts to try and match with a command
            recognition.maxAlternatives = 5;

            // In HTTPS, turn off continuous mode for faster results.
            // In HTTP,  turn on  continuous mode for much slower results, but no repeating security notices
            recognition.continuous = root.location.protocol === 'http:';

            // Sets the language to the default 'en-US'. This can be changed with annyang.setLanguage()
            recognition.lang = 'en-US';

            recognition.onstart = function() {
                isListening = true;
                invokeCallbacks(callbacks.start);
            };

            recognition.onerror = function(event) {
                invokeCallbacks(callbacks.error, event);
                switch (event.error) {
                    case 'network':
                        invokeCallbacks(callbacks.errorNetwork, event);
                        break;
                    case 'not-allowed':
                    case 'service-not-allowed':
                        // if permission to use the mic is denied, turn off auto-restart
                        autoRestart = false;
                        // determine if permission was denied by user or automatically.
                        if (new Date().getTime()-lastStartedAt < 200) {
                            invokeCallbacks(callbacks.errorPermissionBlocked, event);
                        } else {
                            invokeCallbacks(callbacks.errorPermissionDenied, event);
                        }
                        break;
                }
            };

            recognition.onend = function() {
                isListening = false;
                invokeCallbacks(callbacks.end);
                // annyang will auto restart if it is closed automatically and not by user action.
                if (autoRestart) {
                    // play nicely with the browser, and never restart annyang automatically more than once per second
                    var timeSinceLastStart = new Date().getTime()-lastStartedAt;
                    autoRestartCount += 1;
                    if (autoRestartCount % 10 === 0) {
                        if (debugState) {
                            logMessage('Speech Recognition is repeatedly stopping and starting. See http://is.gd/annyang_restarts for tips.');
                        }
                    }
                    if (timeSinceLastStart < 1000) {
                        setTimeout(function() {
                            annyang.start({ paused: pauseListening });
                        }, 1000-timeSinceLastStart);
                    } else {
                        annyang.start({ paused: pauseListening });
                    }
                }
            };

            recognition.onresult = function(event) {
                if(pauseListening) {
                    if (debugState) {
                        logMessage('Speech heard, but annyang is paused');
                    }
                    return false;
                }

                // Map the results to an array
                var SpeechRecognitionResult = event.results[event.resultIndex];
                var results = [];
                for (var k = 0; k<SpeechRecognitionResult.length; k++) {
                    results[k] = SpeechRecognitionResult[k].transcript;
                }

                parseResults(results);
            };

            // build commands list
            if (resetCommands) {
                commandsList = [];
            }
            if (commands.length) {
                this.addCommands(commands);
            }
        },

        /**
         * Start listening.
         * It's a good idea to call this after adding some commands first, but not mandatory.
         *
         * Receives an optional options object which supports the following options:
         *
         * - `autoRestart`  (boolean, default: true) Should annyang restart itself if it is closed indirectly, because of silence or window conflicts?
         * - `continuous`   (boolean) Allow forcing continuous mode on or off. Annyang is pretty smart about this, so only set this if you know what you're doing.
         * - `paused`       (boolean, default: true) Start annyang in paused mode.
         *
         * #### Examples:
         * ````javascript
         * // Start listening, don't restart automatically
         * annyang.start({ autoRestart: false });
         * // Start listening, don't restart automatically, stop recognition after first phrase recognized
         * annyang.start({ autoRestart: false, continuous: false });
         * ````
         * @param {Object} [options] - Optional options.
         * @method start
         */
        start: function(options) {
            initIfNeeded();
            options = options || {};
            if (options.paused !== undefined) {
                pauseListening = !!options.paused;
            } else {
                pauseListening = false;
            }
            if (options.autoRestart !== undefined) {
                autoRestart = !!options.autoRestart;
            } else {
                autoRestart = true;
            }
            if (options.continuous !== undefined) {
                recognition.continuous = !!options.continuous;
            }

            lastStartedAt = new Date().getTime();
            try {
                recognition.start();
            } catch(e) {
                if (debugState) {
                    logMessage(e.message);
                }
            }
        },

        /**
         * Stop listening, and turn off mic.
         *
         * Alternatively, to only temporarily pause annyang responding to commands without stopping the SpeechRecognition engine or closing the mic, use pause() instead.
         * @see [pause()](#pause)
         *
         * @method abort
         */
        abort: function() {
            autoRestart = false;
            autoRestartCount = 0;
            if (isInitialized()) {
                recognition.abort();
            }
        },

        /**
         * Pause listening. annyang will stop responding to commands (until the resume or start methods are called), without turning off the browser's SpeechRecognition engine or the mic.
         *
         * Alternatively, to stop the SpeechRecognition engine and close the mic, use abort() instead.
         * @see [abort()](#abort)
         *
         * @method pause
         */
        pause: function() {
            pauseListening = true;
        },

        /**
         * Resumes listening and restores command callback execution when a result matches.
         * If SpeechRecognition was aborted (stopped), start it.
         *
         * @method resume
         */
        resume: function() {
            annyang.start();
        },

        /**
         * Turn on output of debug messages to the console. Ugly, but super-handy!
         *
         * @param {boolean} [newState=true] - Turn on/off debug messages
         * @method debug
         */
        debug: function(newState) {
            if (arguments.length > 0) {
                debugState = !!newState;
            } else {
                debugState = true;
            }
        },

        /**
         * Set the language the user will speak in. If this method is not called, defaults to 'en-US'.
         *
         * @param {String} language - The language (locale)
         * @method setLanguage
         * @see [Languages](https://github.com/TalAter/annyang/blob/master/docs/FAQ.md#what-languages-are-supported)
         */
        setLanguage: function(language) {
            initIfNeeded();
            recognition.lang = language;
        },

        /**
         * Add commands that annyang will respond to. Similar in syntax to init(), but doesn't remove existing commands.
         *
         * #### Examples:
         * ````javascript
         * var commands = {'hello :name': helloFunction, 'howdy': helloFunction};
         * var commands2 = {'hi': helloFunction};
         *
         * annyang.addCommands(commands);
         * annyang.addCommands(commands2);
         * // annyang will now listen to all three commands
         * ````
         *
         * @param {Object} commands - Commands that annyang should listen to
         * @method addCommands
         * @see [Commands Object](#commands-object)
         */
        addCommands: function(commands) {
            var cb;

            initIfNeeded();

            for (var phrase in commands) {
                if (commands.hasOwnProperty(phrase)) {
                    cb = root[commands[phrase]] || commands[phrase];
                    if (typeof cb === 'function') {
                        // convert command to regex then register the command
                        registerCommand(commandToRegExp(phrase), cb, phrase);
                    } else if (typeof cb === 'object' && cb.regexp instanceof RegExp) {
                        // register the command
                        registerCommand(new RegExp(cb.regexp.source, 'i'), cb.callback, phrase);
                    } else {
                        if (debugState) {
                            logMessage('Can not register command: %c'+phrase, debugStyle);
                        }
                        continue;
                    }
                }
            }
        },

        /**
         * Remove existing commands. Called with a single phrase, array of phrases, or methodically. Pass no params to remove all commands.
         *
         * #### Examples:
         * ````javascript
         * var commands = {'hello': helloFunction, 'howdy': helloFunction, 'hi': helloFunction};
         *
         * // Remove all existing commands
         * annyang.removeCommands();
         *
         * // Add some commands
         * annyang.addCommands(commands);
         *
         * // Don't respond to hello
         * annyang.removeCommands('hello');
         *
         * // Don't respond to howdy or hi
         * annyang.removeCommands(['howdy', 'hi']);
         * ````
         * @param {String|Array|Undefined} [commandsToRemove] - Commands to remove
         * @method removeCommands
         */
        removeCommands: function(commandsToRemove) {
            if (commandsToRemove === undefined) {
                commandsList = [];
                return;
            }
            commandsToRemove = Array.isArray(commandsToRemove) ? commandsToRemove : [commandsToRemove];
            commandsList = commandsList.filter(function(command) {
                for (var i = 0; i<commandsToRemove.length; i++) {
                    if (commandsToRemove[i] === command.originalPhrase) {
                        return false;
                    }
                }
                return true;
            });
        },

        /**
         * Add a callback function to be called in case one of the following events happens:
         *
         * * `start` - Fired as soon as the browser's Speech Recognition engine starts listening
         * * `error` - Fired when the browser's Speech Recogntion engine returns an error, this generic error callback will be followed by more accurate error callbacks (both will fire if both are defined)
         *     Callback function will be called with the error event as the first argument
         * * `errorNetwork` - Fired when Speech Recognition fails because of a network error
         *     Callback function will be called with the error event as the first argument
         * * `errorPermissionBlocked` - Fired when the browser blocks the permission request to use Speech Recognition.
         *     Callback function will be called with the error event as the first argument
         * * `errorPermissionDenied` - Fired when the user blocks the permission request to use Speech Recognition.
         *     Callback function will be called with the error event as the first argument
         * * `end` - Fired when the browser's Speech Recognition engine stops
         * * `result` - Fired as soon as some speech was identified. This generic callback will be followed by either the `resultMatch` or `resultNoMatch` callbacks.
         *     Callback functions for to this event will be called with an array of possible phrases the user said as the first argument
         * * `resultMatch` - Fired when annyang was able to match between what the user said and a registered command
         *     Callback functions for this event will be called with three arguments in the following order:
         *       * The phrase the user said that matched a command
         *       * The command that was matched
         *       * An array of possible alternative phrases the user might have said
         * * `resultNoMatch` - Fired when what the user said didn't match any of the registered commands.
         *     Callback functions for this event will be called with an array of possible phrases the user might've said as the first argument
         *
         * #### Examples:
         * ````javascript
         * annyang.addCallback('error', function() {
     *   $('.myErrorText').text('There was an error!');
     * });
         *
         * annyang.addCallback('resultMatch', function(userSaid, commandText, phrases) {
     *   console.log(userSaid); // sample output: 'hello'
     *   console.log(commandText); // sample output: 'hello (there)'
     *   console.log(phrases); // sample output: ['hello', 'halo', 'yellow', 'polo', 'hello kitty']
     * });
         *
         * // pass local context to a global function called notConnected
         * annyang.addCallback('errorNetwork', notConnected, this);
         * ````
         * @param {String} type - Name of event that will trigger this callback
         * @param {Function} callback - The function to call when event is triggered
         * @param {Object} [context] - Optional context for the callback function
         * @method addCallback
         */
        addCallback: function(type, callback, context) {
            if (callbacks[type]  === undefined) {
                return;
            }
            var cb = root[callback] || callback;
            if (typeof cb !== 'function') {
                return;
            }
            callbacks[type].push({callback: cb, context: context || this});
        },

        /**
         * Remove callbacks from events.
         *
         * - Pass an event name and a callback command to remove that callback command from that event type.
         * - Pass just an event name to remove all callback commands from that event type.
         * - Pass undefined as event name and a callback command to remove that callback command from all event types.
         * - Pass no params to remove all callback commands from all event types.
         *
         * #### Examples:
         * ````javascript
         * annyang.addCallback('start', myFunction1);
         * annyang.addCallback('start', myFunction2);
         * annyang.addCallback('end', myFunction1);
         * annyang.addCallback('end', myFunction2);
         *
         * // Remove all callbacks from all events:
         * annyang.removeCallback();
         *
         * // Remove all callbacks attached to end event:
         * annyang.removeCallback('end');
         *
         * // Remove myFunction2 from being called on start:
         * annyang.removeCallback('start', myFunction2);
         *
         * // Remove myFunction1 from being called on all events:
         * annyang.removeCallback(undefined, myFunction1);
         * ````
         *
         * @param type Name of event type to remove callback from
         * @param callback The callback function to remove
         * @returns undefined
         * @method removeCallback
         */
        removeCallback: function(type, callback) {
            var compareWithCallbackParameter = function(cb) {
                return cb.callback !== callback;
            };
            // Go over each callback type in callbacks store object
            for (var callbackType in callbacks) {
                if (callbacks.hasOwnProperty(callbackType)) {
                    // if this is the type user asked to delete, or he asked to delete all, go ahead.
                    if (type === undefined || type === callbackType) {
                        // If user asked to delete all callbacks in this type or all types
                        if (callback === undefined) {
                            callbacks[callbackType] = [];
                        } else {
                            // Remove all matching callbacks
                            callbacks[callbackType] = callbacks[callbackType].filter(compareWithCallbackParameter);
                        }
                    }
                }
            }
        },

        /**
         * Returns true if speech recognition is currently on.
         * Returns false if speech recognition is off or annyang is paused.
         *
         * @return boolean true = SpeechRecognition is on and annyang is listening
         * @method isListening
         */
        isListening: function() {
            return isListening && !pauseListening;
        },

        /**
         * Returns the instance of the browser's SpeechRecognition object used by annyang.
         * Useful in case you want direct access to the browser's Speech Recognition engine.
         *
         * @returns SpeechRecognition The browser's Speech Recognizer currently used by annyang
         * @method getSpeechRecognizer
         */
        getSpeechRecognizer: function() {
            return recognition;
        },

        /**
         * Simulate speech being recognized. This will trigger the same events and behavior as when the Speech Recognition
         * detects speech.
         *
         * Can accept either a string containing a single sentence, or an array containing multiple sentences to be checked
         * in order until one of them matches a command (similar to the way Speech Recognition Alternatives are parsed)
         *
         * #### Examples:
         * ````javascript
         * annyang.trigger('Time for some thrilling heroics');
         * annyang.trigger(
         *     ['Time for some thrilling heroics', 'Time for some thrilling aerobics']
         *   );
         * ````
         *
         * @param string|array sentences A sentence as a string or an array of strings of possible sentences
         * @returns undefined
         * @method trigger
         */
        trigger: function(sentences) {
            if(!annyang.isListening()) {
                if (debugState) {
                    if (!isListening) {
                        logMessage('Cannot trigger while annyang is aborted');
                    } else {
                        logMessage('Speech heard, but annyang is paused');
                    }
                }
                return;
            }

            if (!Array.isArray(sentences)) {
                sentences = [sentences];
            }

            parseResults(sentences);
        }
    };

    return annyang;

}));

/**
 * # Good to Know
 *
 * ## Commands Object
 *
 * Both the [init()]() and addCommands() methods receive a `commands` object.
 *
 * annyang understands commands with `named variables`, `splats`, and `optional words`.
 *
 * * Use `named variables` for one word arguments in your command.
 * * Use `splats` to capture multi-word text at the end of your command (greedy).
 * * Use `optional words` or phrases to define a part of the command as optional.
 *
 * #### Examples:
 * ````html
 * <script>
 * var commands = {
 *   // annyang will capture anything after a splat (*) and pass it to the function.
 *   // e.g. saying "Show me Batman and Robin" will call showFlickr('Batman and Robin');
 *   'show me *tag': showFlickr,
 *
 *   // A named variable is a one word variable, that can fit anywhere in your command.
 *   // e.g. saying "calculate October stats" will call calculateStats('October');
 *   'calculate :month stats': calculateStats,
 *
 *   // By defining a part of the following command as optional, annyang will respond
 *   // to both: "say hello to my little friend" as well as "say hello friend"
 *   'say hello (to my little) friend': greeting
 * };
 *
 * var showFlickr = function(tag) {
 *   var url = 'http://api.flickr.com/services/rest/?tags='+tag;
 *   $.getJSON(url);
 * }
 *
 * var calculateStats = function(month) {
 *   $('#stats').text('Statistics for '+month);
 * }
 *
 * var greeting = function() {
 *   $('#greeting').text('Hello!');
 * }
 * </script>
 * ````
 *
 * ### Using Regular Expressions in commands
 * For advanced commands, you can pass a regular expression object, instead of
 * a simple string command.
 *
 * This is done by passing an object containing two properties: `regexp`, and
 * `callback` instead of the function.
 *
 * #### Examples:
 * ````javascript
 * var calculateFunction = function(month) { console.log(month); }
 * var commands = {
 *   // This example will accept any word as the "month"
 *   'calculate :month stats': calculateFunction,
 *   // This example will only accept months which are at the start of a quarter
 *   'calculate :quarter stats': {'regexp': /^calculate (January|April|July|October) stats$/, 'callback': calculateFunction}
 * }
 ````
 *
 */

},{}],20:[function(require,module,exports){
// Create a new utterance for the specified text and add it to
// the queue.

var synth = function(voiceName) {
    // Create a new instance of SpeechSynthesisUtterance.
    this.msg = new SpeechSynthesisUtterance();
    var self = this;

    this.loadVoices = function() {
        // Fetch the available voices.
        this.voices = speechSynthesis.getVoices();

    };
    window.speechSynthesis.onvoiceschanged = function(e) {
        self.loadVoices();
        self.changeVoice(self.voiceName);
    };

    this.construct = function(voiceName) {


        // Set the text.
        // Set the attributes.
        this.msg.volume = parseFloat(1);
        this.msg.rate = parseFloat(1);
        this.msg.pitch = parseFloat(1);
        this.before = null;
        this.voiceName = voiceName;

        this.changeVoice(voiceName);


    };

    this.loadVoices();

    return this.construct(voiceName);

};

synth.prototype.changeVoice = function(voiceName) {
    if(!this.voices) {
        return;
    }

    if (!voiceName) {
        this.msg.voice = this.voices[0][0];
    }
    this.msg.voice = this.voices.filter(function (voice) {
        return voice.name == voiceName;
    })[0];

};

synth.prototype.onBefore = function(callback) {
    this.before = callback;
};

synth.prototype.onAfter = function(callback) {
    this.msg.onend = callback;
};

synth.prototype.speak = function(message) {
    this.msg.text = message;

    if (typeof this.before == "function") {
        this.before();
    }

    window.speechSynthesis.speak(this.msg);

};

module.exports = synth;


},{}],21:[function(require,module,exports){

},{}],22:[function(require,module,exports){
(function (global){
/*!
 * The buffer module from node.js, for the browser.
 *
 * @author   Feross Aboukhadijeh <feross@feross.org> <http://feross.org>
 * @license  MIT
 */
/* eslint-disable no-proto */

var base64 = require('base64-js')
var ieee754 = require('ieee754')
var isArray = require('is-array')

exports.Buffer = Buffer
exports.SlowBuffer = SlowBuffer
exports.INSPECT_MAX_BYTES = 50
Buffer.poolSize = 8192 // not used by this implementation

var rootParent = {}

/**
 * If `Buffer.TYPED_ARRAY_SUPPORT`:
 *   === true    Use Uint8Array implementation (fastest)
 *   === false   Use Object implementation (most compatible, even IE6)
 *
 * Browsers that support typed arrays are IE 10+, Firefox 4+, Chrome 7+, Safari 5.1+,
 * Opera 11.6+, iOS 4.2+.
 *
 * Due to various browser bugs, sometimes the Object implementation will be used even
 * when the browser supports typed arrays.
 *
 * Note:
 *
 *   - Firefox 4-29 lacks support for adding new properties to `Uint8Array` instances,
 *     See: https://bugzilla.mozilla.org/show_bug.cgi?id=695438.
 *
 *   - Safari 5-7 lacks support for changing the `Object.prototype.constructor` property
 *     on objects.
 *
 *   - Chrome 9-10 is missing the `TypedArray.prototype.subarray` function.
 *
 *   - IE10 has a broken `TypedArray.prototype.subarray` function which returns arrays of
 *     incorrect length in some situations.

 * We detect these buggy browsers and set `Buffer.TYPED_ARRAY_SUPPORT` to `false` so they
 * get the Object implementation, which is slower but behaves correctly.
 */
Buffer.TYPED_ARRAY_SUPPORT = global.TYPED_ARRAY_SUPPORT !== undefined
  ? global.TYPED_ARRAY_SUPPORT
  : typedArraySupport()

function typedArraySupport () {
  function Bar () {}
  try {
    var arr = new Uint8Array(1)
    arr.foo = function () { return 42 }
    arr.constructor = Bar
    return arr.foo() === 42 && // typed array instances can be augmented
        arr.constructor === Bar && // constructor can be set
        typeof arr.subarray === 'function' && // chrome 9-10 lack `subarray`
        arr.subarray(1, 1).byteLength === 0 // ie10 has broken `subarray`
  } catch (e) {
    return false
  }
}

function kMaxLength () {
  return Buffer.TYPED_ARRAY_SUPPORT
    ? 0x7fffffff
    : 0x3fffffff
}

/**
 * Class: Buffer
 * =============
 *
 * The Buffer constructor returns instances of `Uint8Array` that are augmented
 * with function properties for all the node `Buffer` API functions. We use
 * `Uint8Array` so that square bracket notation works as expected -- it returns
 * a single octet.
 *
 * By augmenting the instances, we can avoid modifying the `Uint8Array`
 * prototype.
 */
function Buffer (arg) {
  if (!(this instanceof Buffer)) {
    // Avoid going through an ArgumentsAdaptorTrampoline in the common case.
    if (arguments.length > 1) return new Buffer(arg, arguments[1])
    return new Buffer(arg)
  }

  this.length = 0
  this.parent = undefined

  // Common case.
  if (typeof arg === 'number') {
    return fromNumber(this, arg)
  }

  // Slightly less common case.
  if (typeof arg === 'string') {
    return fromString(this, arg, arguments.length > 1 ? arguments[1] : 'utf8')
  }

  // Unusual.
  return fromObject(this, arg)
}

function fromNumber (that, length) {
  that = allocate(that, length < 0 ? 0 : checked(length) | 0)
  if (!Buffer.TYPED_ARRAY_SUPPORT) {
    for (var i = 0; i < length; i++) {
      that[i] = 0
    }
  }
  return that
}

function fromString (that, string, encoding) {
  if (typeof encoding !== 'string' || encoding === '') encoding = 'utf8'

  // Assumption: byteLength() return value is always < kMaxLength.
  var length = byteLength(string, encoding) | 0
  that = allocate(that, length)

  that.write(string, encoding)
  return that
}

function fromObject (that, object) {
  if (Buffer.isBuffer(object)) return fromBuffer(that, object)

  if (isArray(object)) return fromArray(that, object)

  if (object == null) {
    throw new TypeError('must start with number, buffer, array or string')
  }

  if (typeof ArrayBuffer !== 'undefined') {
    if (object.buffer instanceof ArrayBuffer) {
      return fromTypedArray(that, object)
    }
    if (object instanceof ArrayBuffer) {
      return fromArrayBuffer(that, object)
    }
  }

  if (object.length) return fromArrayLike(that, object)

  return fromJsonObject(that, object)
}

function fromBuffer (that, buffer) {
  var length = checked(buffer.length) | 0
  that = allocate(that, length)
  buffer.copy(that, 0, 0, length)
  return that
}

function fromArray (that, array) {
  var length = checked(array.length) | 0
  that = allocate(that, length)
  for (var i = 0; i < length; i += 1) {
    that[i] = array[i] & 255
  }
  return that
}

// Duplicate of fromArray() to keep fromArray() monomorphic.
function fromTypedArray (that, array) {
  var length = checked(array.length) | 0
  that = allocate(that, length)
  // Truncating the elements is probably not what people expect from typed
  // arrays with BYTES_PER_ELEMENT > 1 but it's compatible with the behavior
  // of the old Buffer constructor.
  for (var i = 0; i < length; i += 1) {
    that[i] = array[i] & 255
  }
  return that
}

function fromArrayBuffer (that, array) {
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    // Return an augmented `Uint8Array` instance, for best performance
    array.byteLength
    that = Buffer._augment(new Uint8Array(array))
  } else {
    // Fallback: Return an object instance of the Buffer class
    that = fromTypedArray(that, new Uint8Array(array))
  }
  return that
}

function fromArrayLike (that, array) {
  var length = checked(array.length) | 0
  that = allocate(that, length)
  for (var i = 0; i < length; i += 1) {
    that[i] = array[i] & 255
  }
  return that
}

// Deserialize { type: 'Buffer', data: [1,2,3,...] } into a Buffer object.
// Returns a zero-length buffer for inputs that don't conform to the spec.
function fromJsonObject (that, object) {
  var array
  var length = 0

  if (object.type === 'Buffer' && isArray(object.data)) {
    array = object.data
    length = checked(array.length) | 0
  }
  that = allocate(that, length)

  for (var i = 0; i < length; i += 1) {
    that[i] = array[i] & 255
  }
  return that
}

if (Buffer.TYPED_ARRAY_SUPPORT) {
  Buffer.prototype.__proto__ = Uint8Array.prototype
  Buffer.__proto__ = Uint8Array
}

function allocate (that, length) {
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    // Return an augmented `Uint8Array` instance, for best performance
    that = Buffer._augment(new Uint8Array(length))
    that.__proto__ = Buffer.prototype
  } else {
    // Fallback: Return an object instance of the Buffer class
    that.length = length
    that._isBuffer = true
  }

  var fromPool = length !== 0 && length <= Buffer.poolSize >>> 1
  if (fromPool) that.parent = rootParent

  return that
}

function checked (length) {
  // Note: cannot use `length < kMaxLength` here because that fails when
  // length is NaN (which is otherwise coerced to zero.)
  if (length >= kMaxLength()) {
    throw new RangeError('Attempt to allocate Buffer larger than maximum ' +
                         'size: 0x' + kMaxLength().toString(16) + ' bytes')
  }
  return length | 0
}

function SlowBuffer (subject, encoding) {
  if (!(this instanceof SlowBuffer)) return new SlowBuffer(subject, encoding)

  var buf = new Buffer(subject, encoding)
  delete buf.parent
  return buf
}

Buffer.isBuffer = function isBuffer (b) {
  return !!(b != null && b._isBuffer)
}

Buffer.compare = function compare (a, b) {
  if (!Buffer.isBuffer(a) || !Buffer.isBuffer(b)) {
    throw new TypeError('Arguments must be Buffers')
  }

  if (a === b) return 0

  var x = a.length
  var y = b.length

  var i = 0
  var len = Math.min(x, y)
  while (i < len) {
    if (a[i] !== b[i]) break

    ++i
  }

  if (i !== len) {
    x = a[i]
    y = b[i]
  }

  if (x < y) return -1
  if (y < x) return 1
  return 0
}

Buffer.isEncoding = function isEncoding (encoding) {
  switch (String(encoding).toLowerCase()) {
    case 'hex':
    case 'utf8':
    case 'utf-8':
    case 'ascii':
    case 'binary':
    case 'base64':
    case 'raw':
    case 'ucs2':
    case 'ucs-2':
    case 'utf16le':
    case 'utf-16le':
      return true
    default:
      return false
  }
}

Buffer.concat = function concat (list, length) {
  if (!isArray(list)) throw new TypeError('list argument must be an Array of Buffers.')

  if (list.length === 0) {
    return new Buffer(0)
  }

  var i
  if (length === undefined) {
    length = 0
    for (i = 0; i < list.length; i++) {
      length += list[i].length
    }
  }

  var buf = new Buffer(length)
  var pos = 0
  for (i = 0; i < list.length; i++) {
    var item = list[i]
    item.copy(buf, pos)
    pos += item.length
  }
  return buf
}

function byteLength (string, encoding) {
  if (typeof string !== 'string') string = '' + string

  var len = string.length
  if (len === 0) return 0

  // Use a for loop to avoid recursion
  var loweredCase = false
  for (;;) {
    switch (encoding) {
      case 'ascii':
      case 'binary':
      // Deprecated
      case 'raw':
      case 'raws':
        return len
      case 'utf8':
      case 'utf-8':
        return utf8ToBytes(string).length
      case 'ucs2':
      case 'ucs-2':
      case 'utf16le':
      case 'utf-16le':
        return len * 2
      case 'hex':
        return len >>> 1
      case 'base64':
        return base64ToBytes(string).length
      default:
        if (loweredCase) return utf8ToBytes(string).length // assume utf8
        encoding = ('' + encoding).toLowerCase()
        loweredCase = true
    }
  }
}
Buffer.byteLength = byteLength

// pre-set for values that may exist in the future
Buffer.prototype.length = undefined
Buffer.prototype.parent = undefined

function slowToString (encoding, start, end) {
  var loweredCase = false

  start = start | 0
  end = end === undefined || end === Infinity ? this.length : end | 0

  if (!encoding) encoding = 'utf8'
  if (start < 0) start = 0
  if (end > this.length) end = this.length
  if (end <= start) return ''

  while (true) {
    switch (encoding) {
      case 'hex':
        return hexSlice(this, start, end)

      case 'utf8':
      case 'utf-8':
        return utf8Slice(this, start, end)

      case 'ascii':
        return asciiSlice(this, start, end)

      case 'binary':
        return binarySlice(this, start, end)

      case 'base64':
        return base64Slice(this, start, end)

      case 'ucs2':
      case 'ucs-2':
      case 'utf16le':
      case 'utf-16le':
        return utf16leSlice(this, start, end)

      default:
        if (loweredCase) throw new TypeError('Unknown encoding: ' + encoding)
        encoding = (encoding + '').toLowerCase()
        loweredCase = true
    }
  }
}

Buffer.prototype.toString = function toString () {
  var length = this.length | 0
  if (length === 0) return ''
  if (arguments.length === 0) return utf8Slice(this, 0, length)
  return slowToString.apply(this, arguments)
}

Buffer.prototype.equals = function equals (b) {
  if (!Buffer.isBuffer(b)) throw new TypeError('Argument must be a Buffer')
  if (this === b) return true
  return Buffer.compare(this, b) === 0
}

Buffer.prototype.inspect = function inspect () {
  var str = ''
  var max = exports.INSPECT_MAX_BYTES
  if (this.length > 0) {
    str = this.toString('hex', 0, max).match(/.{2}/g).join(' ')
    if (this.length > max) str += ' ... '
  }
  return '<Buffer ' + str + '>'
}

Buffer.prototype.compare = function compare (b) {
  if (!Buffer.isBuffer(b)) throw new TypeError('Argument must be a Buffer')
  if (this === b) return 0
  return Buffer.compare(this, b)
}

Buffer.prototype.indexOf = function indexOf (val, byteOffset) {
  if (byteOffset > 0x7fffffff) byteOffset = 0x7fffffff
  else if (byteOffset < -0x80000000) byteOffset = -0x80000000
  byteOffset >>= 0

  if (this.length === 0) return -1
  if (byteOffset >= this.length) return -1

  // Negative offsets start from the end of the buffer
  if (byteOffset < 0) byteOffset = Math.max(this.length + byteOffset, 0)

  if (typeof val === 'string') {
    if (val.length === 0) return -1 // special case: looking for empty string always fails
    return String.prototype.indexOf.call(this, val, byteOffset)
  }
  if (Buffer.isBuffer(val)) {
    return arrayIndexOf(this, val, byteOffset)
  }
  if (typeof val === 'number') {
    if (Buffer.TYPED_ARRAY_SUPPORT && Uint8Array.prototype.indexOf === 'function') {
      return Uint8Array.prototype.indexOf.call(this, val, byteOffset)
    }
    return arrayIndexOf(this, [ val ], byteOffset)
  }

  function arrayIndexOf (arr, val, byteOffset) {
    var foundIndex = -1
    for (var i = 0; byteOffset + i < arr.length; i++) {
      if (arr[byteOffset + i] === val[foundIndex === -1 ? 0 : i - foundIndex]) {
        if (foundIndex === -1) foundIndex = i
        if (i - foundIndex + 1 === val.length) return byteOffset + foundIndex
      } else {
        foundIndex = -1
      }
    }
    return -1
  }

  throw new TypeError('val must be string, number or Buffer')
}

// `get` is deprecated
Buffer.prototype.get = function get (offset) {
  console.log('.get() is deprecated. Access using array indexes instead.')
  return this.readUInt8(offset)
}

// `set` is deprecated
Buffer.prototype.set = function set (v, offset) {
  console.log('.set() is deprecated. Access using array indexes instead.')
  return this.writeUInt8(v, offset)
}

function hexWrite (buf, string, offset, length) {
  offset = Number(offset) || 0
  var remaining = buf.length - offset
  if (!length) {
    length = remaining
  } else {
    length = Number(length)
    if (length > remaining) {
      length = remaining
    }
  }

  // must be an even number of digits
  var strLen = string.length
  if (strLen % 2 !== 0) throw new Error('Invalid hex string')

  if (length > strLen / 2) {
    length = strLen / 2
  }
  for (var i = 0; i < length; i++) {
    var parsed = parseInt(string.substr(i * 2, 2), 16)
    if (isNaN(parsed)) throw new Error('Invalid hex string')
    buf[offset + i] = parsed
  }
  return i
}

function utf8Write (buf, string, offset, length) {
  return blitBuffer(utf8ToBytes(string, buf.length - offset), buf, offset, length)
}

function asciiWrite (buf, string, offset, length) {
  return blitBuffer(asciiToBytes(string), buf, offset, length)
}

function binaryWrite (buf, string, offset, length) {
  return asciiWrite(buf, string, offset, length)
}

function base64Write (buf, string, offset, length) {
  return blitBuffer(base64ToBytes(string), buf, offset, length)
}

function ucs2Write (buf, string, offset, length) {
  return blitBuffer(utf16leToBytes(string, buf.length - offset), buf, offset, length)
}

Buffer.prototype.write = function write (string, offset, length, encoding) {
  // Buffer#write(string)
  if (offset === undefined) {
    encoding = 'utf8'
    length = this.length
    offset = 0
  // Buffer#write(string, encoding)
  } else if (length === undefined && typeof offset === 'string') {
    encoding = offset
    length = this.length
    offset = 0
  // Buffer#write(string, offset[, length][, encoding])
  } else if (isFinite(offset)) {
    offset = offset | 0
    if (isFinite(length)) {
      length = length | 0
      if (encoding === undefined) encoding = 'utf8'
    } else {
      encoding = length
      length = undefined
    }
  // legacy write(string, encoding, offset, length) - remove in v0.13
  } else {
    var swap = encoding
    encoding = offset
    offset = length | 0
    length = swap
  }

  var remaining = this.length - offset
  if (length === undefined || length > remaining) length = remaining

  if ((string.length > 0 && (length < 0 || offset < 0)) || offset > this.length) {
    throw new RangeError('attempt to write outside buffer bounds')
  }

  if (!encoding) encoding = 'utf8'

  var loweredCase = false
  for (;;) {
    switch (encoding) {
      case 'hex':
        return hexWrite(this, string, offset, length)

      case 'utf8':
      case 'utf-8':
        return utf8Write(this, string, offset, length)

      case 'ascii':
        return asciiWrite(this, string, offset, length)

      case 'binary':
        return binaryWrite(this, string, offset, length)

      case 'base64':
        // Warning: maxLength not taken into account in base64Write
        return base64Write(this, string, offset, length)

      case 'ucs2':
      case 'ucs-2':
      case 'utf16le':
      case 'utf-16le':
        return ucs2Write(this, string, offset, length)

      default:
        if (loweredCase) throw new TypeError('Unknown encoding: ' + encoding)
        encoding = ('' + encoding).toLowerCase()
        loweredCase = true
    }
  }
}

Buffer.prototype.toJSON = function toJSON () {
  return {
    type: 'Buffer',
    data: Array.prototype.slice.call(this._arr || this, 0)
  }
}

function base64Slice (buf, start, end) {
  if (start === 0 && end === buf.length) {
    return base64.fromByteArray(buf)
  } else {
    return base64.fromByteArray(buf.slice(start, end))
  }
}

function utf8Slice (buf, start, end) {
  end = Math.min(buf.length, end)
  var res = []

  var i = start
  while (i < end) {
    var firstByte = buf[i]
    var codePoint = null
    var bytesPerSequence = (firstByte > 0xEF) ? 4
      : (firstByte > 0xDF) ? 3
      : (firstByte > 0xBF) ? 2
      : 1

    if (i + bytesPerSequence <= end) {
      var secondByte, thirdByte, fourthByte, tempCodePoint

      switch (bytesPerSequence) {
        case 1:
          if (firstByte < 0x80) {
            codePoint = firstByte
          }
          break
        case 2:
          secondByte = buf[i + 1]
          if ((secondByte & 0xC0) === 0x80) {
            tempCodePoint = (firstByte & 0x1F) << 0x6 | (secondByte & 0x3F)
            if (tempCodePoint > 0x7F) {
              codePoint = tempCodePoint
            }
          }
          break
        case 3:
          secondByte = buf[i + 1]
          thirdByte = buf[i + 2]
          if ((secondByte & 0xC0) === 0x80 && (thirdByte & 0xC0) === 0x80) {
            tempCodePoint = (firstByte & 0xF) << 0xC | (secondByte & 0x3F) << 0x6 | (thirdByte & 0x3F)
            if (tempCodePoint > 0x7FF && (tempCodePoint < 0xD800 || tempCodePoint > 0xDFFF)) {
              codePoint = tempCodePoint
            }
          }
          break
        case 4:
          secondByte = buf[i + 1]
          thirdByte = buf[i + 2]
          fourthByte = buf[i + 3]
          if ((secondByte & 0xC0) === 0x80 && (thirdByte & 0xC0) === 0x80 && (fourthByte & 0xC0) === 0x80) {
            tempCodePoint = (firstByte & 0xF) << 0x12 | (secondByte & 0x3F) << 0xC | (thirdByte & 0x3F) << 0x6 | (fourthByte & 0x3F)
            if (tempCodePoint > 0xFFFF && tempCodePoint < 0x110000) {
              codePoint = tempCodePoint
            }
          }
      }
    }

    if (codePoint === null) {
      // we did not generate a valid codePoint so insert a
      // replacement char (U+FFFD) and advance only 1 byte
      codePoint = 0xFFFD
      bytesPerSequence = 1
    } else if (codePoint > 0xFFFF) {
      // encode to utf16 (surrogate pair dance)
      codePoint -= 0x10000
      res.push(codePoint >>> 10 & 0x3FF | 0xD800)
      codePoint = 0xDC00 | codePoint & 0x3FF
    }

    res.push(codePoint)
    i += bytesPerSequence
  }

  return decodeCodePointsArray(res)
}

// Based on http://stackoverflow.com/a/22747272/680742, the browser with
// the lowest limit is Chrome, with 0x10000 args.
// We go 1 magnitude less, for safety
var MAX_ARGUMENTS_LENGTH = 0x1000

function decodeCodePointsArray (codePoints) {
  var len = codePoints.length
  if (len <= MAX_ARGUMENTS_LENGTH) {
    return String.fromCharCode.apply(String, codePoints) // avoid extra slice()
  }

  // Decode in chunks to avoid "call stack size exceeded".
  var res = ''
  var i = 0
  while (i < len) {
    res += String.fromCharCode.apply(
      String,
      codePoints.slice(i, i += MAX_ARGUMENTS_LENGTH)
    )
  }
  return res
}

function asciiSlice (buf, start, end) {
  var ret = ''
  end = Math.min(buf.length, end)

  for (var i = start; i < end; i++) {
    ret += String.fromCharCode(buf[i] & 0x7F)
  }
  return ret
}

function binarySlice (buf, start, end) {
  var ret = ''
  end = Math.min(buf.length, end)

  for (var i = start; i < end; i++) {
    ret += String.fromCharCode(buf[i])
  }
  return ret
}

function hexSlice (buf, start, end) {
  var len = buf.length

  if (!start || start < 0) start = 0
  if (!end || end < 0 || end > len) end = len

  var out = ''
  for (var i = start; i < end; i++) {
    out += toHex(buf[i])
  }
  return out
}

function utf16leSlice (buf, start, end) {
  var bytes = buf.slice(start, end)
  var res = ''
  for (var i = 0; i < bytes.length; i += 2) {
    res += String.fromCharCode(bytes[i] + bytes[i + 1] * 256)
  }
  return res
}

Buffer.prototype.slice = function slice (start, end) {
  var len = this.length
  start = ~~start
  end = end === undefined ? len : ~~end

  if (start < 0) {
    start += len
    if (start < 0) start = 0
  } else if (start > len) {
    start = len
  }

  if (end < 0) {
    end += len
    if (end < 0) end = 0
  } else if (end > len) {
    end = len
  }

  if (end < start) end = start

  var newBuf
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    newBuf = Buffer._augment(this.subarray(start, end))
  } else {
    var sliceLen = end - start
    newBuf = new Buffer(sliceLen, undefined)
    for (var i = 0; i < sliceLen; i++) {
      newBuf[i] = this[i + start]
    }
  }

  if (newBuf.length) newBuf.parent = this.parent || this

  return newBuf
}

/*
 * Need to make sure that buffer isn't trying to write out of bounds.
 */
function checkOffset (offset, ext, length) {
  if ((offset % 1) !== 0 || offset < 0) throw new RangeError('offset is not uint')
  if (offset + ext > length) throw new RangeError('Trying to access beyond buffer length')
}

Buffer.prototype.readUIntLE = function readUIntLE (offset, byteLength, noAssert) {
  offset = offset | 0
  byteLength = byteLength | 0
  if (!noAssert) checkOffset(offset, byteLength, this.length)

  var val = this[offset]
  var mul = 1
  var i = 0
  while (++i < byteLength && (mul *= 0x100)) {
    val += this[offset + i] * mul
  }

  return val
}

Buffer.prototype.readUIntBE = function readUIntBE (offset, byteLength, noAssert) {
  offset = offset | 0
  byteLength = byteLength | 0
  if (!noAssert) {
    checkOffset(offset, byteLength, this.length)
  }

  var val = this[offset + --byteLength]
  var mul = 1
  while (byteLength > 0 && (mul *= 0x100)) {
    val += this[offset + --byteLength] * mul
  }

  return val
}

Buffer.prototype.readUInt8 = function readUInt8 (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 1, this.length)
  return this[offset]
}

Buffer.prototype.readUInt16LE = function readUInt16LE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 2, this.length)
  return this[offset] | (this[offset + 1] << 8)
}

Buffer.prototype.readUInt16BE = function readUInt16BE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 2, this.length)
  return (this[offset] << 8) | this[offset + 1]
}

Buffer.prototype.readUInt32LE = function readUInt32LE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 4, this.length)

  return ((this[offset]) |
      (this[offset + 1] << 8) |
      (this[offset + 2] << 16)) +
      (this[offset + 3] * 0x1000000)
}

Buffer.prototype.readUInt32BE = function readUInt32BE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 4, this.length)

  return (this[offset] * 0x1000000) +
    ((this[offset + 1] << 16) |
    (this[offset + 2] << 8) |
    this[offset + 3])
}

Buffer.prototype.readIntLE = function readIntLE (offset, byteLength, noAssert) {
  offset = offset | 0
  byteLength = byteLength | 0
  if (!noAssert) checkOffset(offset, byteLength, this.length)

  var val = this[offset]
  var mul = 1
  var i = 0
  while (++i < byteLength && (mul *= 0x100)) {
    val += this[offset + i] * mul
  }
  mul *= 0x80

  if (val >= mul) val -= Math.pow(2, 8 * byteLength)

  return val
}

Buffer.prototype.readIntBE = function readIntBE (offset, byteLength, noAssert) {
  offset = offset | 0
  byteLength = byteLength | 0
  if (!noAssert) checkOffset(offset, byteLength, this.length)

  var i = byteLength
  var mul = 1
  var val = this[offset + --i]
  while (i > 0 && (mul *= 0x100)) {
    val += this[offset + --i] * mul
  }
  mul *= 0x80

  if (val >= mul) val -= Math.pow(2, 8 * byteLength)

  return val
}

Buffer.prototype.readInt8 = function readInt8 (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 1, this.length)
  if (!(this[offset] & 0x80)) return (this[offset])
  return ((0xff - this[offset] + 1) * -1)
}

Buffer.prototype.readInt16LE = function readInt16LE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 2, this.length)
  var val = this[offset] | (this[offset + 1] << 8)
  return (val & 0x8000) ? val | 0xFFFF0000 : val
}

Buffer.prototype.readInt16BE = function readInt16BE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 2, this.length)
  var val = this[offset + 1] | (this[offset] << 8)
  return (val & 0x8000) ? val | 0xFFFF0000 : val
}

Buffer.prototype.readInt32LE = function readInt32LE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 4, this.length)

  return (this[offset]) |
    (this[offset + 1] << 8) |
    (this[offset + 2] << 16) |
    (this[offset + 3] << 24)
}

Buffer.prototype.readInt32BE = function readInt32BE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 4, this.length)

  return (this[offset] << 24) |
    (this[offset + 1] << 16) |
    (this[offset + 2] << 8) |
    (this[offset + 3])
}

Buffer.prototype.readFloatLE = function readFloatLE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 4, this.length)
  return ieee754.read(this, offset, true, 23, 4)
}

Buffer.prototype.readFloatBE = function readFloatBE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 4, this.length)
  return ieee754.read(this, offset, false, 23, 4)
}

Buffer.prototype.readDoubleLE = function readDoubleLE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 8, this.length)
  return ieee754.read(this, offset, true, 52, 8)
}

Buffer.prototype.readDoubleBE = function readDoubleBE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 8, this.length)
  return ieee754.read(this, offset, false, 52, 8)
}

function checkInt (buf, value, offset, ext, max, min) {
  if (!Buffer.isBuffer(buf)) throw new TypeError('buffer must be a Buffer instance')
  if (value > max || value < min) throw new RangeError('value is out of bounds')
  if (offset + ext > buf.length) throw new RangeError('index out of range')
}

Buffer.prototype.writeUIntLE = function writeUIntLE (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset | 0
  byteLength = byteLength | 0
  if (!noAssert) checkInt(this, value, offset, byteLength, Math.pow(2, 8 * byteLength), 0)

  var mul = 1
  var i = 0
  this[offset] = value & 0xFF
  while (++i < byteLength && (mul *= 0x100)) {
    this[offset + i] = (value / mul) & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeUIntBE = function writeUIntBE (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset | 0
  byteLength = byteLength | 0
  if (!noAssert) checkInt(this, value, offset, byteLength, Math.pow(2, 8 * byteLength), 0)

  var i = byteLength - 1
  var mul = 1
  this[offset + i] = value & 0xFF
  while (--i >= 0 && (mul *= 0x100)) {
    this[offset + i] = (value / mul) & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeUInt8 = function writeUInt8 (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 1, 0xff, 0)
  if (!Buffer.TYPED_ARRAY_SUPPORT) value = Math.floor(value)
  this[offset] = (value & 0xff)
  return offset + 1
}

function objectWriteUInt16 (buf, value, offset, littleEndian) {
  if (value < 0) value = 0xffff + value + 1
  for (var i = 0, j = Math.min(buf.length - offset, 2); i < j; i++) {
    buf[offset + i] = (value & (0xff << (8 * (littleEndian ? i : 1 - i)))) >>>
      (littleEndian ? i : 1 - i) * 8
  }
}

Buffer.prototype.writeUInt16LE = function writeUInt16LE (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 2, 0xffff, 0)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value & 0xff)
    this[offset + 1] = (value >>> 8)
  } else {
    objectWriteUInt16(this, value, offset, true)
  }
  return offset + 2
}

Buffer.prototype.writeUInt16BE = function writeUInt16BE (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 2, 0xffff, 0)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value >>> 8)
    this[offset + 1] = (value & 0xff)
  } else {
    objectWriteUInt16(this, value, offset, false)
  }
  return offset + 2
}

function objectWriteUInt32 (buf, value, offset, littleEndian) {
  if (value < 0) value = 0xffffffff + value + 1
  for (var i = 0, j = Math.min(buf.length - offset, 4); i < j; i++) {
    buf[offset + i] = (value >>> (littleEndian ? i : 3 - i) * 8) & 0xff
  }
}

Buffer.prototype.writeUInt32LE = function writeUInt32LE (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 4, 0xffffffff, 0)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset + 3] = (value >>> 24)
    this[offset + 2] = (value >>> 16)
    this[offset + 1] = (value >>> 8)
    this[offset] = (value & 0xff)
  } else {
    objectWriteUInt32(this, value, offset, true)
  }
  return offset + 4
}

Buffer.prototype.writeUInt32BE = function writeUInt32BE (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 4, 0xffffffff, 0)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value >>> 24)
    this[offset + 1] = (value >>> 16)
    this[offset + 2] = (value >>> 8)
    this[offset + 3] = (value & 0xff)
  } else {
    objectWriteUInt32(this, value, offset, false)
  }
  return offset + 4
}

Buffer.prototype.writeIntLE = function writeIntLE (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) {
    var limit = Math.pow(2, 8 * byteLength - 1)

    checkInt(this, value, offset, byteLength, limit - 1, -limit)
  }

  var i = 0
  var mul = 1
  var sub = value < 0 ? 1 : 0
  this[offset] = value & 0xFF
  while (++i < byteLength && (mul *= 0x100)) {
    this[offset + i] = ((value / mul) >> 0) - sub & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeIntBE = function writeIntBE (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) {
    var limit = Math.pow(2, 8 * byteLength - 1)

    checkInt(this, value, offset, byteLength, limit - 1, -limit)
  }

  var i = byteLength - 1
  var mul = 1
  var sub = value < 0 ? 1 : 0
  this[offset + i] = value & 0xFF
  while (--i >= 0 && (mul *= 0x100)) {
    this[offset + i] = ((value / mul) >> 0) - sub & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeInt8 = function writeInt8 (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 1, 0x7f, -0x80)
  if (!Buffer.TYPED_ARRAY_SUPPORT) value = Math.floor(value)
  if (value < 0) value = 0xff + value + 1
  this[offset] = (value & 0xff)
  return offset + 1
}

Buffer.prototype.writeInt16LE = function writeInt16LE (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 2, 0x7fff, -0x8000)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value & 0xff)
    this[offset + 1] = (value >>> 8)
  } else {
    objectWriteUInt16(this, value, offset, true)
  }
  return offset + 2
}

Buffer.prototype.writeInt16BE = function writeInt16BE (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 2, 0x7fff, -0x8000)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value >>> 8)
    this[offset + 1] = (value & 0xff)
  } else {
    objectWriteUInt16(this, value, offset, false)
  }
  return offset + 2
}

Buffer.prototype.writeInt32LE = function writeInt32LE (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 4, 0x7fffffff, -0x80000000)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value & 0xff)
    this[offset + 1] = (value >>> 8)
    this[offset + 2] = (value >>> 16)
    this[offset + 3] = (value >>> 24)
  } else {
    objectWriteUInt32(this, value, offset, true)
  }
  return offset + 4
}

Buffer.prototype.writeInt32BE = function writeInt32BE (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 4, 0x7fffffff, -0x80000000)
  if (value < 0) value = 0xffffffff + value + 1
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value >>> 24)
    this[offset + 1] = (value >>> 16)
    this[offset + 2] = (value >>> 8)
    this[offset + 3] = (value & 0xff)
  } else {
    objectWriteUInt32(this, value, offset, false)
  }
  return offset + 4
}

function checkIEEE754 (buf, value, offset, ext, max, min) {
  if (value > max || value < min) throw new RangeError('value is out of bounds')
  if (offset + ext > buf.length) throw new RangeError('index out of range')
  if (offset < 0) throw new RangeError('index out of range')
}

function writeFloat (buf, value, offset, littleEndian, noAssert) {
  if (!noAssert) {
    checkIEEE754(buf, value, offset, 4, 3.4028234663852886e+38, -3.4028234663852886e+38)
  }
  ieee754.write(buf, value, offset, littleEndian, 23, 4)
  return offset + 4
}

Buffer.prototype.writeFloatLE = function writeFloatLE (value, offset, noAssert) {
  return writeFloat(this, value, offset, true, noAssert)
}

Buffer.prototype.writeFloatBE = function writeFloatBE (value, offset, noAssert) {
  return writeFloat(this, value, offset, false, noAssert)
}

function writeDouble (buf, value, offset, littleEndian, noAssert) {
  if (!noAssert) {
    checkIEEE754(buf, value, offset, 8, 1.7976931348623157E+308, -1.7976931348623157E+308)
  }
  ieee754.write(buf, value, offset, littleEndian, 52, 8)
  return offset + 8
}

Buffer.prototype.writeDoubleLE = function writeDoubleLE (value, offset, noAssert) {
  return writeDouble(this, value, offset, true, noAssert)
}

Buffer.prototype.writeDoubleBE = function writeDoubleBE (value, offset, noAssert) {
  return writeDouble(this, value, offset, false, noAssert)
}

// copy(targetBuffer, targetStart=0, sourceStart=0, sourceEnd=buffer.length)
Buffer.prototype.copy = function copy (target, targetStart, start, end) {
  if (!start) start = 0
  if (!end && end !== 0) end = this.length
  if (targetStart >= target.length) targetStart = target.length
  if (!targetStart) targetStart = 0
  if (end > 0 && end < start) end = start

  // Copy 0 bytes; we're done
  if (end === start) return 0
  if (target.length === 0 || this.length === 0) return 0

  // Fatal error conditions
  if (targetStart < 0) {
    throw new RangeError('targetStart out of bounds')
  }
  if (start < 0 || start >= this.length) throw new RangeError('sourceStart out of bounds')
  if (end < 0) throw new RangeError('sourceEnd out of bounds')

  // Are we oob?
  if (end > this.length) end = this.length
  if (target.length - targetStart < end - start) {
    end = target.length - targetStart + start
  }

  var len = end - start
  var i

  if (this === target && start < targetStart && targetStart < end) {
    // descending copy from end
    for (i = len - 1; i >= 0; i--) {
      target[i + targetStart] = this[i + start]
    }
  } else if (len < 1000 || !Buffer.TYPED_ARRAY_SUPPORT) {
    // ascending copy from start
    for (i = 0; i < len; i++) {
      target[i + targetStart] = this[i + start]
    }
  } else {
    target._set(this.subarray(start, start + len), targetStart)
  }

  return len
}

// fill(value, start=0, end=buffer.length)
Buffer.prototype.fill = function fill (value, start, end) {
  if (!value) value = 0
  if (!start) start = 0
  if (!end) end = this.length

  if (end < start) throw new RangeError('end < start')

  // Fill 0 bytes; we're done
  if (end === start) return
  if (this.length === 0) return

  if (start < 0 || start >= this.length) throw new RangeError('start out of bounds')
  if (end < 0 || end > this.length) throw new RangeError('end out of bounds')

  var i
  if (typeof value === 'number') {
    for (i = start; i < end; i++) {
      this[i] = value
    }
  } else {
    var bytes = utf8ToBytes(value.toString())
    var len = bytes.length
    for (i = start; i < end; i++) {
      this[i] = bytes[i % len]
    }
  }

  return this
}

/**
 * Creates a new `ArrayBuffer` with the *copied* memory of the buffer instance.
 * Added in Node 0.12. Only available in browsers that support ArrayBuffer.
 */
Buffer.prototype.toArrayBuffer = function toArrayBuffer () {
  if (typeof Uint8Array !== 'undefined') {
    if (Buffer.TYPED_ARRAY_SUPPORT) {
      return (new Buffer(this)).buffer
    } else {
      var buf = new Uint8Array(this.length)
      for (var i = 0, len = buf.length; i < len; i += 1) {
        buf[i] = this[i]
      }
      return buf.buffer
    }
  } else {
    throw new TypeError('Buffer.toArrayBuffer not supported in this browser')
  }
}

// HELPER FUNCTIONS
// ================

var BP = Buffer.prototype

/**
 * Augment a Uint8Array *instance* (not the Uint8Array class!) with Buffer methods
 */
Buffer._augment = function _augment (arr) {
  arr.constructor = Buffer
  arr._isBuffer = true

  // save reference to original Uint8Array set method before overwriting
  arr._set = arr.set

  // deprecated
  arr.get = BP.get
  arr.set = BP.set

  arr.write = BP.write
  arr.toString = BP.toString
  arr.toLocaleString = BP.toString
  arr.toJSON = BP.toJSON
  arr.equals = BP.equals
  arr.compare = BP.compare
  arr.indexOf = BP.indexOf
  arr.copy = BP.copy
  arr.slice = BP.slice
  arr.readUIntLE = BP.readUIntLE
  arr.readUIntBE = BP.readUIntBE
  arr.readUInt8 = BP.readUInt8
  arr.readUInt16LE = BP.readUInt16LE
  arr.readUInt16BE = BP.readUInt16BE
  arr.readUInt32LE = BP.readUInt32LE
  arr.readUInt32BE = BP.readUInt32BE
  arr.readIntLE = BP.readIntLE
  arr.readIntBE = BP.readIntBE
  arr.readInt8 = BP.readInt8
  arr.readInt16LE = BP.readInt16LE
  arr.readInt16BE = BP.readInt16BE
  arr.readInt32LE = BP.readInt32LE
  arr.readInt32BE = BP.readInt32BE
  arr.readFloatLE = BP.readFloatLE
  arr.readFloatBE = BP.readFloatBE
  arr.readDoubleLE = BP.readDoubleLE
  arr.readDoubleBE = BP.readDoubleBE
  arr.writeUInt8 = BP.writeUInt8
  arr.writeUIntLE = BP.writeUIntLE
  arr.writeUIntBE = BP.writeUIntBE
  arr.writeUInt16LE = BP.writeUInt16LE
  arr.writeUInt16BE = BP.writeUInt16BE
  arr.writeUInt32LE = BP.writeUInt32LE
  arr.writeUInt32BE = BP.writeUInt32BE
  arr.writeIntLE = BP.writeIntLE
  arr.writeIntBE = BP.writeIntBE
  arr.writeInt8 = BP.writeInt8
  arr.writeInt16LE = BP.writeInt16LE
  arr.writeInt16BE = BP.writeInt16BE
  arr.writeInt32LE = BP.writeInt32LE
  arr.writeInt32BE = BP.writeInt32BE
  arr.writeFloatLE = BP.writeFloatLE
  arr.writeFloatBE = BP.writeFloatBE
  arr.writeDoubleLE = BP.writeDoubleLE
  arr.writeDoubleBE = BP.writeDoubleBE
  arr.fill = BP.fill
  arr.inspect = BP.inspect
  arr.toArrayBuffer = BP.toArrayBuffer

  return arr
}

var INVALID_BASE64_RE = /[^+\/0-9A-Za-z-_]/g

function base64clean (str) {
  // Node strips out invalid characters like \n and \t from the string, base64-js does not
  str = stringtrim(str).replace(INVALID_BASE64_RE, '')
  // Node converts strings with length < 2 to ''
  if (str.length < 2) return ''
  // Node allows for non-padded base64 strings (missing trailing ===), base64-js does not
  while (str.length % 4 !== 0) {
    str = str + '='
  }
  return str
}

function stringtrim (str) {
  if (str.trim) return str.trim()
  return str.replace(/^\s+|\s+$/g, '')
}

function toHex (n) {
  if (n < 16) return '0' + n.toString(16)
  return n.toString(16)
}

function utf8ToBytes (string, units) {
  units = units || Infinity
  var codePoint
  var length = string.length
  var leadSurrogate = null
  var bytes = []

  for (var i = 0; i < length; i++) {
    codePoint = string.charCodeAt(i)

    // is surrogate component
    if (codePoint > 0xD7FF && codePoint < 0xE000) {
      // last char was a lead
      if (!leadSurrogate) {
        // no lead yet
        if (codePoint > 0xDBFF) {
          // unexpected trail
          if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
          continue
        } else if (i + 1 === length) {
          // unpaired lead
          if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
          continue
        }

        // valid lead
        leadSurrogate = codePoint

        continue
      }

      // 2 leads in a row
      if (codePoint < 0xDC00) {
        if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
        leadSurrogate = codePoint
        continue
      }

      // valid surrogate pair
      codePoint = leadSurrogate - 0xD800 << 10 | codePoint - 0xDC00 | 0x10000
    } else if (leadSurrogate) {
      // valid bmp char, but last char was a lead
      if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
    }

    leadSurrogate = null

    // encode utf8
    if (codePoint < 0x80) {
      if ((units -= 1) < 0) break
      bytes.push(codePoint)
    } else if (codePoint < 0x800) {
      if ((units -= 2) < 0) break
      bytes.push(
        codePoint >> 0x6 | 0xC0,
        codePoint & 0x3F | 0x80
      )
    } else if (codePoint < 0x10000) {
      if ((units -= 3) < 0) break
      bytes.push(
        codePoint >> 0xC | 0xE0,
        codePoint >> 0x6 & 0x3F | 0x80,
        codePoint & 0x3F | 0x80
      )
    } else if (codePoint < 0x110000) {
      if ((units -= 4) < 0) break
      bytes.push(
        codePoint >> 0x12 | 0xF0,
        codePoint >> 0xC & 0x3F | 0x80,
        codePoint >> 0x6 & 0x3F | 0x80,
        codePoint & 0x3F | 0x80
      )
    } else {
      throw new Error('Invalid code point')
    }
  }

  return bytes
}

function asciiToBytes (str) {
  var byteArray = []
  for (var i = 0; i < str.length; i++) {
    // Node's code seems to be doing this and not & 0x7F..
    byteArray.push(str.charCodeAt(i) & 0xFF)
  }
  return byteArray
}

function utf16leToBytes (str, units) {
  var c, hi, lo
  var byteArray = []
  for (var i = 0; i < str.length; i++) {
    if ((units -= 2) < 0) break

    c = str.charCodeAt(i)
    hi = c >> 8
    lo = c % 256
    byteArray.push(lo)
    byteArray.push(hi)
  }

  return byteArray
}

function base64ToBytes (str) {
  return base64.toByteArray(base64clean(str))
}

function blitBuffer (src, dst, offset, length) {
  for (var i = 0; i < length; i++) {
    if ((i + offset >= dst.length) || (i >= src.length)) break
    dst[i + offset] = src[i]
  }
  return i
}

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"base64-js":23,"ieee754":24,"is-array":25}],23:[function(require,module,exports){
var lookup = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

;(function (exports) {
	'use strict';

  var Arr = (typeof Uint8Array !== 'undefined')
    ? Uint8Array
    : Array

	var PLUS   = '+'.charCodeAt(0)
	var SLASH  = '/'.charCodeAt(0)
	var NUMBER = '0'.charCodeAt(0)
	var LOWER  = 'a'.charCodeAt(0)
	var UPPER  = 'A'.charCodeAt(0)
	var PLUS_URL_SAFE = '-'.charCodeAt(0)
	var SLASH_URL_SAFE = '_'.charCodeAt(0)

	function decode (elt) {
		var code = elt.charCodeAt(0)
		if (code === PLUS ||
		    code === PLUS_URL_SAFE)
			return 62 // '+'
		if (code === SLASH ||
		    code === SLASH_URL_SAFE)
			return 63 // '/'
		if (code < NUMBER)
			return -1 //no match
		if (code < NUMBER + 10)
			return code - NUMBER + 26 + 26
		if (code < UPPER + 26)
			return code - UPPER
		if (code < LOWER + 26)
			return code - LOWER + 26
	}

	function b64ToByteArray (b64) {
		var i, j, l, tmp, placeHolders, arr

		if (b64.length % 4 > 0) {
			throw new Error('Invalid string. Length must be a multiple of 4')
		}

		// the number of equal signs (place holders)
		// if there are two placeholders, than the two characters before it
		// represent one byte
		// if there is only one, then the three characters before it represent 2 bytes
		// this is just a cheap hack to not do indexOf twice
		var len = b64.length
		placeHolders = '=' === b64.charAt(len - 2) ? 2 : '=' === b64.charAt(len - 1) ? 1 : 0

		// base64 is 4/3 + up to two characters of the original data
		arr = new Arr(b64.length * 3 / 4 - placeHolders)

		// if there are placeholders, only get up to the last complete 4 chars
		l = placeHolders > 0 ? b64.length - 4 : b64.length

		var L = 0

		function push (v) {
			arr[L++] = v
		}

		for (i = 0, j = 0; i < l; i += 4, j += 3) {
			tmp = (decode(b64.charAt(i)) << 18) | (decode(b64.charAt(i + 1)) << 12) | (decode(b64.charAt(i + 2)) << 6) | decode(b64.charAt(i + 3))
			push((tmp & 0xFF0000) >> 16)
			push((tmp & 0xFF00) >> 8)
			push(tmp & 0xFF)
		}

		if (placeHolders === 2) {
			tmp = (decode(b64.charAt(i)) << 2) | (decode(b64.charAt(i + 1)) >> 4)
			push(tmp & 0xFF)
		} else if (placeHolders === 1) {
			tmp = (decode(b64.charAt(i)) << 10) | (decode(b64.charAt(i + 1)) << 4) | (decode(b64.charAt(i + 2)) >> 2)
			push((tmp >> 8) & 0xFF)
			push(tmp & 0xFF)
		}

		return arr
	}

	function uint8ToBase64 (uint8) {
		var i,
			extraBytes = uint8.length % 3, // if we have 1 byte left, pad 2 bytes
			output = "",
			temp, length

		function encode (num) {
			return lookup.charAt(num)
		}

		function tripletToBase64 (num) {
			return encode(num >> 18 & 0x3F) + encode(num >> 12 & 0x3F) + encode(num >> 6 & 0x3F) + encode(num & 0x3F)
		}

		// go through the array every three bytes, we'll deal with trailing stuff later
		for (i = 0, length = uint8.length - extraBytes; i < length; i += 3) {
			temp = (uint8[i] << 16) + (uint8[i + 1] << 8) + (uint8[i + 2])
			output += tripletToBase64(temp)
		}

		// pad the end with zeros, but make sure to not forget the extra bytes
		switch (extraBytes) {
			case 1:
				temp = uint8[uint8.length - 1]
				output += encode(temp >> 2)
				output += encode((temp << 4) & 0x3F)
				output += '=='
				break
			case 2:
				temp = (uint8[uint8.length - 2] << 8) + (uint8[uint8.length - 1])
				output += encode(temp >> 10)
				output += encode((temp >> 4) & 0x3F)
				output += encode((temp << 2) & 0x3F)
				output += '='
				break
		}

		return output
	}

	exports.toByteArray = b64ToByteArray
	exports.fromByteArray = uint8ToBase64
}(typeof exports === 'undefined' ? (this.base64js = {}) : exports))

},{}],24:[function(require,module,exports){
exports.read = function (buffer, offset, isLE, mLen, nBytes) {
  var e, m
  var eLen = nBytes * 8 - mLen - 1
  var eMax = (1 << eLen) - 1
  var eBias = eMax >> 1
  var nBits = -7
  var i = isLE ? (nBytes - 1) : 0
  var d = isLE ? -1 : 1
  var s = buffer[offset + i]

  i += d

  e = s & ((1 << (-nBits)) - 1)
  s >>= (-nBits)
  nBits += eLen
  for (; nBits > 0; e = e * 256 + buffer[offset + i], i += d, nBits -= 8) {}

  m = e & ((1 << (-nBits)) - 1)
  e >>= (-nBits)
  nBits += mLen
  for (; nBits > 0; m = m * 256 + buffer[offset + i], i += d, nBits -= 8) {}

  if (e === 0) {
    e = 1 - eBias
  } else if (e === eMax) {
    return m ? NaN : ((s ? -1 : 1) * Infinity)
  } else {
    m = m + Math.pow(2, mLen)
    e = e - eBias
  }
  return (s ? -1 : 1) * m * Math.pow(2, e - mLen)
}

exports.write = function (buffer, value, offset, isLE, mLen, nBytes) {
  var e, m, c
  var eLen = nBytes * 8 - mLen - 1
  var eMax = (1 << eLen) - 1
  var eBias = eMax >> 1
  var rt = (mLen === 23 ? Math.pow(2, -24) - Math.pow(2, -77) : 0)
  var i = isLE ? 0 : (nBytes - 1)
  var d = isLE ? 1 : -1
  var s = value < 0 || (value === 0 && 1 / value < 0) ? 1 : 0

  value = Math.abs(value)

  if (isNaN(value) || value === Infinity) {
    m = isNaN(value) ? 1 : 0
    e = eMax
  } else {
    e = Math.floor(Math.log(value) / Math.LN2)
    if (value * (c = Math.pow(2, -e)) < 1) {
      e--
      c *= 2
    }
    if (e + eBias >= 1) {
      value += rt / c
    } else {
      value += rt * Math.pow(2, 1 - eBias)
    }
    if (value * c >= 2) {
      e++
      c /= 2
    }

    if (e + eBias >= eMax) {
      m = 0
      e = eMax
    } else if (e + eBias >= 1) {
      m = (value * c - 1) * Math.pow(2, mLen)
      e = e + eBias
    } else {
      m = value * Math.pow(2, eBias - 1) * Math.pow(2, mLen)
      e = 0
    }
  }

  for (; mLen >= 8; buffer[offset + i] = m & 0xff, i += d, m /= 256, mLen -= 8) {}

  e = (e << mLen) | m
  eLen += mLen
  for (; eLen > 0; buffer[offset + i] = e & 0xff, i += d, e /= 256, eLen -= 8) {}

  buffer[offset + i - d] |= s * 128
}

},{}],25:[function(require,module,exports){

/**
 * isArray
 */

var isArray = Array.isArray;

/**
 * toString
 */

var str = Object.prototype.toString;

/**
 * Whether or not the given `val`
 * is an array.
 *
 * example:
 *
 *        isArray([]);
 *        // > true
 *        isArray(arguments);
 *        // > false
 *        isArray('');
 *        // > false
 *
 * @param {mixed} val
 * @return {bool}
 */

module.exports = isArray || function (val) {
  return !! val && '[object Array]' == str.call(val);
};

},{}],26:[function(require,module,exports){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

function EventEmitter() {
  this._events = this._events || {};
  this._maxListeners = this._maxListeners || undefined;
}
module.exports = EventEmitter;

// Backwards-compat with node 0.10.x
EventEmitter.EventEmitter = EventEmitter;

EventEmitter.prototype._events = undefined;
EventEmitter.prototype._maxListeners = undefined;

// By default EventEmitters will print a warning if more than 10 listeners are
// added to it. This is a useful default which helps finding memory leaks.
EventEmitter.defaultMaxListeners = 10;

// Obviously not all Emitters should be limited to 10. This function allows
// that to be increased. Set to zero for unlimited.
EventEmitter.prototype.setMaxListeners = function(n) {
  if (!isNumber(n) || n < 0 || isNaN(n))
    throw TypeError('n must be a positive number');
  this._maxListeners = n;
  return this;
};

EventEmitter.prototype.emit = function(type) {
  var er, handler, len, args, i, listeners;

  if (!this._events)
    this._events = {};

  // If there is no 'error' event listener then throw.
  if (type === 'error') {
    if (!this._events.error ||
        (isObject(this._events.error) && !this._events.error.length)) {
      er = arguments[1];
      if (er instanceof Error) {
        throw er; // Unhandled 'error' event
      }
      throw TypeError('Uncaught, unspecified "error" event.');
    }
  }

  handler = this._events[type];

  if (isUndefined(handler))
    return false;

  if (isFunction(handler)) {
    switch (arguments.length) {
      // fast cases
      case 1:
        handler.call(this);
        break;
      case 2:
        handler.call(this, arguments[1]);
        break;
      case 3:
        handler.call(this, arguments[1], arguments[2]);
        break;
      // slower
      default:
        len = arguments.length;
        args = new Array(len - 1);
        for (i = 1; i < len; i++)
          args[i - 1] = arguments[i];
        handler.apply(this, args);
    }
  } else if (isObject(handler)) {
    len = arguments.length;
    args = new Array(len - 1);
    for (i = 1; i < len; i++)
      args[i - 1] = arguments[i];

    listeners = handler.slice();
    len = listeners.length;
    for (i = 0; i < len; i++)
      listeners[i].apply(this, args);
  }

  return true;
};

EventEmitter.prototype.addListener = function(type, listener) {
  var m;

  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  if (!this._events)
    this._events = {};

  // To avoid recursion in the case that type === "newListener"! Before
  // adding it to the listeners, first emit "newListener".
  if (this._events.newListener)
    this.emit('newListener', type,
              isFunction(listener.listener) ?
              listener.listener : listener);

  if (!this._events[type])
    // Optimize the case of one listener. Don't need the extra array object.
    this._events[type] = listener;
  else if (isObject(this._events[type]))
    // If we've already got an array, just append.
    this._events[type].push(listener);
  else
    // Adding the second element, need to change to array.
    this._events[type] = [this._events[type], listener];

  // Check for listener leak
  if (isObject(this._events[type]) && !this._events[type].warned) {
    var m;
    if (!isUndefined(this._maxListeners)) {
      m = this._maxListeners;
    } else {
      m = EventEmitter.defaultMaxListeners;
    }

    if (m && m > 0 && this._events[type].length > m) {
      this._events[type].warned = true;
      console.error('(node) warning: possible EventEmitter memory ' +
                    'leak detected. %d listeners added. ' +
                    'Use emitter.setMaxListeners() to increase limit.',
                    this._events[type].length);
      if (typeof console.trace === 'function') {
        // not supported in IE 10
        console.trace();
      }
    }
  }

  return this;
};

EventEmitter.prototype.on = EventEmitter.prototype.addListener;

EventEmitter.prototype.once = function(type, listener) {
  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  var fired = false;

  function g() {
    this.removeListener(type, g);

    if (!fired) {
      fired = true;
      listener.apply(this, arguments);
    }
  }

  g.listener = listener;
  this.on(type, g);

  return this;
};

// emits a 'removeListener' event iff the listener was removed
EventEmitter.prototype.removeListener = function(type, listener) {
  var list, position, length, i;

  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  if (!this._events || !this._events[type])
    return this;

  list = this._events[type];
  length = list.length;
  position = -1;

  if (list === listener ||
      (isFunction(list.listener) && list.listener === listener)) {
    delete this._events[type];
    if (this._events.removeListener)
      this.emit('removeListener', type, listener);

  } else if (isObject(list)) {
    for (i = length; i-- > 0;) {
      if (list[i] === listener ||
          (list[i].listener && list[i].listener === listener)) {
        position = i;
        break;
      }
    }

    if (position < 0)
      return this;

    if (list.length === 1) {
      list.length = 0;
      delete this._events[type];
    } else {
      list.splice(position, 1);
    }

    if (this._events.removeListener)
      this.emit('removeListener', type, listener);
  }

  return this;
};

EventEmitter.prototype.removeAllListeners = function(type) {
  var key, listeners;

  if (!this._events)
    return this;

  // not listening for removeListener, no need to emit
  if (!this._events.removeListener) {
    if (arguments.length === 0)
      this._events = {};
    else if (this._events[type])
      delete this._events[type];
    return this;
  }

  // emit removeListener for all listeners on all events
  if (arguments.length === 0) {
    for (key in this._events) {
      if (key === 'removeListener') continue;
      this.removeAllListeners(key);
    }
    this.removeAllListeners('removeListener');
    this._events = {};
    return this;
  }

  listeners = this._events[type];

  if (isFunction(listeners)) {
    this.removeListener(type, listeners);
  } else {
    // LIFO order
    while (listeners.length)
      this.removeListener(type, listeners[listeners.length - 1]);
  }
  delete this._events[type];

  return this;
};

EventEmitter.prototype.listeners = function(type) {
  var ret;
  if (!this._events || !this._events[type])
    ret = [];
  else if (isFunction(this._events[type]))
    ret = [this._events[type]];
  else
    ret = this._events[type].slice();
  return ret;
};

EventEmitter.listenerCount = function(emitter, type) {
  var ret;
  if (!emitter._events || !emitter._events[type])
    ret = 0;
  else if (isFunction(emitter._events[type]))
    ret = 1;
  else
    ret = emitter._events[type].length;
  return ret;
};

function isFunction(arg) {
  return typeof arg === 'function';
}

function isNumber(arg) {
  return typeof arg === 'number';
}

function isObject(arg) {
  return typeof arg === 'object' && arg !== null;
}

function isUndefined(arg) {
  return arg === void 0;
}

},{}],27:[function(require,module,exports){
var http = require('http');

var https = module.exports;

for (var key in http) {
    if (http.hasOwnProperty(key)) https[key] = http[key];
};

https.request = function (params, cb) {
    if (!params) params = {};
    params.scheme = 'https';
    params.protocol = 'https:';
    return http.request.call(this, params, cb);
}

},{"http":50}],28:[function(require,module,exports){
if (typeof Object.create === 'function') {
  // implementation from standard node.js 'util' module
  module.exports = function inherits(ctor, superCtor) {
    ctor.super_ = superCtor
    ctor.prototype = Object.create(superCtor.prototype, {
      constructor: {
        value: ctor,
        enumerable: false,
        writable: true,
        configurable: true
      }
    });
  };
} else {
  // old school shim for old browsers
  module.exports = function inherits(ctor, superCtor) {
    ctor.super_ = superCtor
    var TempCtor = function () {}
    TempCtor.prototype = superCtor.prototype
    ctor.prototype = new TempCtor()
    ctor.prototype.constructor = ctor
  }
}

},{}],29:[function(require,module,exports){
/**
 * Determine if an object is Buffer
 *
 * Author:   Feross Aboukhadijeh <feross@feross.org> <http://feross.org>
 * License:  MIT
 *
 * `npm install is-buffer`
 */

module.exports = function (obj) {
  return !!(obj != null &&
    (obj._isBuffer || // For Safari 5-7 (missing Object.prototype.constructor)
      (obj.constructor &&
      typeof obj.constructor.isBuffer === 'function' &&
      obj.constructor.isBuffer(obj))
    ))
}

},{}],30:[function(require,module,exports){
module.exports = Array.isArray || function (arr) {
  return Object.prototype.toString.call(arr) == '[object Array]';
};

},{}],31:[function(require,module,exports){
// shim for using process in browser

var process = module.exports = {};
var queue = [];
var draining = false;
var currentQueue;
var queueIndex = -1;

function cleanUpNextTick() {
    draining = false;
    if (currentQueue.length) {
        queue = currentQueue.concat(queue);
    } else {
        queueIndex = -1;
    }
    if (queue.length) {
        drainQueue();
    }
}

function drainQueue() {
    if (draining) {
        return;
    }
    var timeout = setTimeout(cleanUpNextTick);
    draining = true;

    var len = queue.length;
    while(len) {
        currentQueue = queue;
        queue = [];
        while (++queueIndex < len) {
            if (currentQueue) {
                currentQueue[queueIndex].run();
            }
        }
        queueIndex = -1;
        len = queue.length;
    }
    currentQueue = null;
    draining = false;
    clearTimeout(timeout);
}

process.nextTick = function (fun) {
    var args = new Array(arguments.length - 1);
    if (arguments.length > 1) {
        for (var i = 1; i < arguments.length; i++) {
            args[i - 1] = arguments[i];
        }
    }
    queue.push(new Item(fun, args));
    if (queue.length === 1 && !draining) {
        setTimeout(drainQueue, 0);
    }
};

// v8 likes predictible objects
function Item(fun, array) {
    this.fun = fun;
    this.array = array;
}
Item.prototype.run = function () {
    this.fun.apply(null, this.array);
};
process.title = 'browser';
process.browser = true;
process.env = {};
process.argv = [];
process.version = ''; // empty string to avoid regexp issues
process.versions = {};

function noop() {}

process.on = noop;
process.addListener = noop;
process.once = noop;
process.off = noop;
process.removeListener = noop;
process.removeAllListeners = noop;
process.emit = noop;

process.binding = function (name) {
    throw new Error('process.binding is not supported');
};

process.cwd = function () { return '/' };
process.chdir = function (dir) {
    throw new Error('process.chdir is not supported');
};
process.umask = function() { return 0; };

},{}],32:[function(require,module,exports){
(function (global){
/*! https://mths.be/punycode v1.3.2 by @mathias */
;(function(root) {

	/** Detect free variables */
	var freeExports = typeof exports == 'object' && exports &&
		!exports.nodeType && exports;
	var freeModule = typeof module == 'object' && module &&
		!module.nodeType && module;
	var freeGlobal = typeof global == 'object' && global;
	if (
		freeGlobal.global === freeGlobal ||
		freeGlobal.window === freeGlobal ||
		freeGlobal.self === freeGlobal
	) {
		root = freeGlobal;
	}

	/**
	 * The `punycode` object.
	 * @name punycode
	 * @type Object
	 */
	var punycode,

	/** Highest positive signed 32-bit float value */
	maxInt = 2147483647, // aka. 0x7FFFFFFF or 2^31-1

	/** Bootstring parameters */
	base = 36,
	tMin = 1,
	tMax = 26,
	skew = 38,
	damp = 700,
	initialBias = 72,
	initialN = 128, // 0x80
	delimiter = '-', // '\x2D'

	/** Regular expressions */
	regexPunycode = /^xn--/,
	regexNonASCII = /[^\x20-\x7E]/, // unprintable ASCII chars + non-ASCII chars
	regexSeparators = /[\x2E\u3002\uFF0E\uFF61]/g, // RFC 3490 separators

	/** Error messages */
	errors = {
		'overflow': 'Overflow: input needs wider integers to process',
		'not-basic': 'Illegal input >= 0x80 (not a basic code point)',
		'invalid-input': 'Invalid input'
	},

	/** Convenience shortcuts */
	baseMinusTMin = base - tMin,
	floor = Math.floor,
	stringFromCharCode = String.fromCharCode,

	/** Temporary variable */
	key;

	/*--------------------------------------------------------------------------*/

	/**
	 * A generic error utility function.
	 * @private
	 * @param {String} type The error type.
	 * @returns {Error} Throws a `RangeError` with the applicable error message.
	 */
	function error(type) {
		throw RangeError(errors[type]);
	}

	/**
	 * A generic `Array#map` utility function.
	 * @private
	 * @param {Array} array The array to iterate over.
	 * @param {Function} callback The function that gets called for every array
	 * item.
	 * @returns {Array} A new array of values returned by the callback function.
	 */
	function map(array, fn) {
		var length = array.length;
		var result = [];
		while (length--) {
			result[length] = fn(array[length]);
		}
		return result;
	}

	/**
	 * A simple `Array#map`-like wrapper to work with domain name strings or email
	 * addresses.
	 * @private
	 * @param {String} domain The domain name or email address.
	 * @param {Function} callback The function that gets called for every
	 * character.
	 * @returns {Array} A new string of characters returned by the callback
	 * function.
	 */
	function mapDomain(string, fn) {
		var parts = string.split('@');
		var result = '';
		if (parts.length > 1) {
			// In email addresses, only the domain name should be punycoded. Leave
			// the local part (i.e. everything up to `@`) intact.
			result = parts[0] + '@';
			string = parts[1];
		}
		// Avoid `split(regex)` for IE8 compatibility. See #17.
		string = string.replace(regexSeparators, '\x2E');
		var labels = string.split('.');
		var encoded = map(labels, fn).join('.');
		return result + encoded;
	}

	/**
	 * Creates an array containing the numeric code points of each Unicode
	 * character in the string. While JavaScript uses UCS-2 internally,
	 * this function will convert a pair of surrogate halves (each of which
	 * UCS-2 exposes as separate characters) into a single code point,
	 * matching UTF-16.
	 * @see `punycode.ucs2.encode`
	 * @see <https://mathiasbynens.be/notes/javascript-encoding>
	 * @memberOf punycode.ucs2
	 * @name decode
	 * @param {String} string The Unicode input string (UCS-2).
	 * @returns {Array} The new array of code points.
	 */
	function ucs2decode(string) {
		var output = [],
		    counter = 0,
		    length = string.length,
		    value,
		    extra;
		while (counter < length) {
			value = string.charCodeAt(counter++);
			if (value >= 0xD800 && value <= 0xDBFF && counter < length) {
				// high surrogate, and there is a next character
				extra = string.charCodeAt(counter++);
				if ((extra & 0xFC00) == 0xDC00) { // low surrogate
					output.push(((value & 0x3FF) << 10) + (extra & 0x3FF) + 0x10000);
				} else {
					// unmatched surrogate; only append this code unit, in case the next
					// code unit is the high surrogate of a surrogate pair
					output.push(value);
					counter--;
				}
			} else {
				output.push(value);
			}
		}
		return output;
	}

	/**
	 * Creates a string based on an array of numeric code points.
	 * @see `punycode.ucs2.decode`
	 * @memberOf punycode.ucs2
	 * @name encode
	 * @param {Array} codePoints The array of numeric code points.
	 * @returns {String} The new Unicode string (UCS-2).
	 */
	function ucs2encode(array) {
		return map(array, function(value) {
			var output = '';
			if (value > 0xFFFF) {
				value -= 0x10000;
				output += stringFromCharCode(value >>> 10 & 0x3FF | 0xD800);
				value = 0xDC00 | value & 0x3FF;
			}
			output += stringFromCharCode(value);
			return output;
		}).join('');
	}

	/**
	 * Converts a basic code point into a digit/integer.
	 * @see `digitToBasic()`
	 * @private
	 * @param {Number} codePoint The basic numeric code point value.
	 * @returns {Number} The numeric value of a basic code point (for use in
	 * representing integers) in the range `0` to `base - 1`, or `base` if
	 * the code point does not represent a value.
	 */
	function basicToDigit(codePoint) {
		if (codePoint - 48 < 10) {
			return codePoint - 22;
		}
		if (codePoint - 65 < 26) {
			return codePoint - 65;
		}
		if (codePoint - 97 < 26) {
			return codePoint - 97;
		}
		return base;
	}

	/**
	 * Converts a digit/integer into a basic code point.
	 * @see `basicToDigit()`
	 * @private
	 * @param {Number} digit The numeric value of a basic code point.
	 * @returns {Number} The basic code point whose value (when used for
	 * representing integers) is `digit`, which needs to be in the range
	 * `0` to `base - 1`. If `flag` is non-zero, the uppercase form is
	 * used; else, the lowercase form is used. The behavior is undefined
	 * if `flag` is non-zero and `digit` has no uppercase form.
	 */
	function digitToBasic(digit, flag) {
		//  0..25 map to ASCII a..z or A..Z
		// 26..35 map to ASCII 0..9
		return digit + 22 + 75 * (digit < 26) - ((flag != 0) << 5);
	}

	/**
	 * Bias adaptation function as per section 3.4 of RFC 3492.
	 * http://tools.ietf.org/html/rfc3492#section-3.4
	 * @private
	 */
	function adapt(delta, numPoints, firstTime) {
		var k = 0;
		delta = firstTime ? floor(delta / damp) : delta >> 1;
		delta += floor(delta / numPoints);
		for (/* no initialization */; delta > baseMinusTMin * tMax >> 1; k += base) {
			delta = floor(delta / baseMinusTMin);
		}
		return floor(k + (baseMinusTMin + 1) * delta / (delta + skew));
	}

	/**
	 * Converts a Punycode string of ASCII-only symbols to a string of Unicode
	 * symbols.
	 * @memberOf punycode
	 * @param {String} input The Punycode string of ASCII-only symbols.
	 * @returns {String} The resulting string of Unicode symbols.
	 */
	function decode(input) {
		// Don't use UCS-2
		var output = [],
		    inputLength = input.length,
		    out,
		    i = 0,
		    n = initialN,
		    bias = initialBias,
		    basic,
		    j,
		    index,
		    oldi,
		    w,
		    k,
		    digit,
		    t,
		    /** Cached calculation results */
		    baseMinusT;

		// Handle the basic code points: let `basic` be the number of input code
		// points before the last delimiter, or `0` if there is none, then copy
		// the first basic code points to the output.

		basic = input.lastIndexOf(delimiter);
		if (basic < 0) {
			basic = 0;
		}

		for (j = 0; j < basic; ++j) {
			// if it's not a basic code point
			if (input.charCodeAt(j) >= 0x80) {
				error('not-basic');
			}
			output.push(input.charCodeAt(j));
		}

		// Main decoding loop: start just after the last delimiter if any basic code
		// points were copied; start at the beginning otherwise.

		for (index = basic > 0 ? basic + 1 : 0; index < inputLength; /* no final expression */) {

			// `index` is the index of the next character to be consumed.
			// Decode a generalized variable-length integer into `delta`,
			// which gets added to `i`. The overflow checking is easier
			// if we increase `i` as we go, then subtract off its starting
			// value at the end to obtain `delta`.
			for (oldi = i, w = 1, k = base; /* no condition */; k += base) {

				if (index >= inputLength) {
					error('invalid-input');
				}

				digit = basicToDigit(input.charCodeAt(index++));

				if (digit >= base || digit > floor((maxInt - i) / w)) {
					error('overflow');
				}

				i += digit * w;
				t = k <= bias ? tMin : (k >= bias + tMax ? tMax : k - bias);

				if (digit < t) {
					break;
				}

				baseMinusT = base - t;
				if (w > floor(maxInt / baseMinusT)) {
					error('overflow');
				}

				w *= baseMinusT;

			}

			out = output.length + 1;
			bias = adapt(i - oldi, out, oldi == 0);

			// `i` was supposed to wrap around from `out` to `0`,
			// incrementing `n` each time, so we'll fix that now:
			if (floor(i / out) > maxInt - n) {
				error('overflow');
			}

			n += floor(i / out);
			i %= out;

			// Insert `n` at position `i` of the output
			output.splice(i++, 0, n);

		}

		return ucs2encode(output);
	}

	/**
	 * Converts a string of Unicode symbols (e.g. a domain name label) to a
	 * Punycode string of ASCII-only symbols.
	 * @memberOf punycode
	 * @param {String} input The string of Unicode symbols.
	 * @returns {String} The resulting Punycode string of ASCII-only symbols.
	 */
	function encode(input) {
		var n,
		    delta,
		    handledCPCount,
		    basicLength,
		    bias,
		    j,
		    m,
		    q,
		    k,
		    t,
		    currentValue,
		    output = [],
		    /** `inputLength` will hold the number of code points in `input`. */
		    inputLength,
		    /** Cached calculation results */
		    handledCPCountPlusOne,
		    baseMinusT,
		    qMinusT;

		// Convert the input in UCS-2 to Unicode
		input = ucs2decode(input);

		// Cache the length
		inputLength = input.length;

		// Initialize the state
		n = initialN;
		delta = 0;
		bias = initialBias;

		// Handle the basic code points
		for (j = 0; j < inputLength; ++j) {
			currentValue = input[j];
			if (currentValue < 0x80) {
				output.push(stringFromCharCode(currentValue));
			}
		}

		handledCPCount = basicLength = output.length;

		// `handledCPCount` is the number of code points that have been handled;
		// `basicLength` is the number of basic code points.

		// Finish the basic string - if it is not empty - with a delimiter
		if (basicLength) {
			output.push(delimiter);
		}

		// Main encoding loop:
		while (handledCPCount < inputLength) {

			// All non-basic code points < n have been handled already. Find the next
			// larger one:
			for (m = maxInt, j = 0; j < inputLength; ++j) {
				currentValue = input[j];
				if (currentValue >= n && currentValue < m) {
					m = currentValue;
				}
			}

			// Increase `delta` enough to advance the decoder's <n,i> state to <m,0>,
			// but guard against overflow
			handledCPCountPlusOne = handledCPCount + 1;
			if (m - n > floor((maxInt - delta) / handledCPCountPlusOne)) {
				error('overflow');
			}

			delta += (m - n) * handledCPCountPlusOne;
			n = m;

			for (j = 0; j < inputLength; ++j) {
				currentValue = input[j];

				if (currentValue < n && ++delta > maxInt) {
					error('overflow');
				}

				if (currentValue == n) {
					// Represent delta as a generalized variable-length integer
					for (q = delta, k = base; /* no condition */; k += base) {
						t = k <= bias ? tMin : (k >= bias + tMax ? tMax : k - bias);
						if (q < t) {
							break;
						}
						qMinusT = q - t;
						baseMinusT = base - t;
						output.push(
							stringFromCharCode(digitToBasic(t + qMinusT % baseMinusT, 0))
						);
						q = floor(qMinusT / baseMinusT);
					}

					output.push(stringFromCharCode(digitToBasic(q, 0)));
					bias = adapt(delta, handledCPCountPlusOne, handledCPCount == basicLength);
					delta = 0;
					++handledCPCount;
				}
			}

			++delta;
			++n;

		}
		return output.join('');
	}

	/**
	 * Converts a Punycode string representing a domain name or an email address
	 * to Unicode. Only the Punycoded parts of the input will be converted, i.e.
	 * it doesn't matter if you call it on a string that has already been
	 * converted to Unicode.
	 * @memberOf punycode
	 * @param {String} input The Punycoded domain name or email address to
	 * convert to Unicode.
	 * @returns {String} The Unicode representation of the given Punycode
	 * string.
	 */
	function toUnicode(input) {
		return mapDomain(input, function(string) {
			return regexPunycode.test(string)
				? decode(string.slice(4).toLowerCase())
				: string;
		});
	}

	/**
	 * Converts a Unicode string representing a domain name or an email address to
	 * Punycode. Only the non-ASCII parts of the domain name will be converted,
	 * i.e. it doesn't matter if you call it with a domain that's already in
	 * ASCII.
	 * @memberOf punycode
	 * @param {String} input The domain name or email address to convert, as a
	 * Unicode string.
	 * @returns {String} The Punycode representation of the given domain name or
	 * email address.
	 */
	function toASCII(input) {
		return mapDomain(input, function(string) {
			return regexNonASCII.test(string)
				? 'xn--' + encode(string)
				: string;
		});
	}

	/*--------------------------------------------------------------------------*/

	/** Define the public API */
	punycode = {
		/**
		 * A string representing the current Punycode.js version number.
		 * @memberOf punycode
		 * @type String
		 */
		'version': '1.3.2',
		/**
		 * An object of methods to convert from JavaScript's internal character
		 * representation (UCS-2) to Unicode code points, and back.
		 * @see <https://mathiasbynens.be/notes/javascript-encoding>
		 * @memberOf punycode
		 * @type Object
		 */
		'ucs2': {
			'decode': ucs2decode,
			'encode': ucs2encode
		},
		'decode': decode,
		'encode': encode,
		'toASCII': toASCII,
		'toUnicode': toUnicode
	};

	/** Expose `punycode` */
	// Some AMD build optimizers, like r.js, check for specific condition patterns
	// like the following:
	if (
		typeof define == 'function' &&
		typeof define.amd == 'object' &&
		define.amd
	) {
		define('punycode', function() {
			return punycode;
		});
	} else if (freeExports && freeModule) {
		if (module.exports == freeExports) { // in Node.js or RingoJS v0.8.0+
			freeModule.exports = punycode;
		} else { // in Narwhal or RingoJS v0.7.0-
			for (key in punycode) {
				punycode.hasOwnProperty(key) && (freeExports[key] = punycode[key]);
			}
		}
	} else { // in Rhino or a web browser
		root.punycode = punycode;
	}

}(this));

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{}],33:[function(require,module,exports){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

'use strict';

// If obj.hasOwnProperty has been overridden, then calling
// obj.hasOwnProperty(prop) will break.
// See: https://github.com/joyent/node/issues/1707
function hasOwnProperty(obj, prop) {
  return Object.prototype.hasOwnProperty.call(obj, prop);
}

module.exports = function(qs, sep, eq, options) {
  sep = sep || '&';
  eq = eq || '=';
  var obj = {};

  if (typeof qs !== 'string' || qs.length === 0) {
    return obj;
  }

  var regexp = /\+/g;
  qs = qs.split(sep);

  var maxKeys = 1000;
  if (options && typeof options.maxKeys === 'number') {
    maxKeys = options.maxKeys;
  }

  var len = qs.length;
  // maxKeys <= 0 means that we should not limit keys count
  if (maxKeys > 0 && len > maxKeys) {
    len = maxKeys;
  }

  for (var i = 0; i < len; ++i) {
    var x = qs[i].replace(regexp, '%20'),
        idx = x.indexOf(eq),
        kstr, vstr, k, v;

    if (idx >= 0) {
      kstr = x.substr(0, idx);
      vstr = x.substr(idx + 1);
    } else {
      kstr = x;
      vstr = '';
    }

    k = decodeURIComponent(kstr);
    v = decodeURIComponent(vstr);

    if (!hasOwnProperty(obj, k)) {
      obj[k] = v;
    } else if (isArray(obj[k])) {
      obj[k].push(v);
    } else {
      obj[k] = [obj[k], v];
    }
  }

  return obj;
};

var isArray = Array.isArray || function (xs) {
  return Object.prototype.toString.call(xs) === '[object Array]';
};

},{}],34:[function(require,module,exports){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

'use strict';

var stringifyPrimitive = function(v) {
  switch (typeof v) {
    case 'string':
      return v;

    case 'boolean':
      return v ? 'true' : 'false';

    case 'number':
      return isFinite(v) ? v : '';

    default:
      return '';
  }
};

module.exports = function(obj, sep, eq, name) {
  sep = sep || '&';
  eq = eq || '=';
  if (obj === null) {
    obj = undefined;
  }

  if (typeof obj === 'object') {
    return map(objectKeys(obj), function(k) {
      var ks = encodeURIComponent(stringifyPrimitive(k)) + eq;
      if (isArray(obj[k])) {
        return map(obj[k], function(v) {
          return ks + encodeURIComponent(stringifyPrimitive(v));
        }).join(sep);
      } else {
        return ks + encodeURIComponent(stringifyPrimitive(obj[k]));
      }
    }).join(sep);

  }

  if (!name) return '';
  return encodeURIComponent(stringifyPrimitive(name)) + eq +
         encodeURIComponent(stringifyPrimitive(obj));
};

var isArray = Array.isArray || function (xs) {
  return Object.prototype.toString.call(xs) === '[object Array]';
};

function map (xs, f) {
  if (xs.map) return xs.map(f);
  var res = [];
  for (var i = 0; i < xs.length; i++) {
    res.push(f(xs[i], i));
  }
  return res;
}

var objectKeys = Object.keys || function (obj) {
  var res = [];
  for (var key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) res.push(key);
  }
  return res;
};

},{}],35:[function(require,module,exports){
'use strict';

exports.decode = exports.parse = require('./decode');
exports.encode = exports.stringify = require('./encode');

},{"./decode":33,"./encode":34}],36:[function(require,module,exports){
module.exports = require("./lib/_stream_duplex.js")

},{"./lib/_stream_duplex.js":37}],37:[function(require,module,exports){
// a duplex stream is just a stream that is both readable and writable.
// Since JS doesn't have multiple prototypal inheritance, this class
// prototypally inherits from Readable, and then parasitically from
// Writable.

'use strict';

/*<replacement>*/
var objectKeys = Object.keys || function (obj) {
  var keys = [];
  for (var key in obj) keys.push(key);
  return keys;
}
/*</replacement>*/


module.exports = Duplex;

/*<replacement>*/
var processNextTick = require('process-nextick-args');
/*</replacement>*/



/*<replacement>*/
var util = require('core-util-is');
util.inherits = require('inherits');
/*</replacement>*/

var Readable = require('./_stream_readable');
var Writable = require('./_stream_writable');

util.inherits(Duplex, Readable);

var keys = objectKeys(Writable.prototype);
for (var v = 0; v < keys.length; v++) {
  var method = keys[v];
  if (!Duplex.prototype[method])
    Duplex.prototype[method] = Writable.prototype[method];
}

function Duplex(options) {
  if (!(this instanceof Duplex))
    return new Duplex(options);

  Readable.call(this, options);
  Writable.call(this, options);

  if (options && options.readable === false)
    this.readable = false;

  if (options && options.writable === false)
    this.writable = false;

  this.allowHalfOpen = true;
  if (options && options.allowHalfOpen === false)
    this.allowHalfOpen = false;

  this.once('end', onend);
}

// the no-half-open enforcer
function onend() {
  // if we allow half-open state, or if the writable side ended,
  // then we're ok.
  if (this.allowHalfOpen || this._writableState.ended)
    return;

  // no more data can be written.
  // But allow more writes to happen in this tick.
  processNextTick(onEndNT, this);
}

function onEndNT(self) {
  self.end();
}

function forEach (xs, f) {
  for (var i = 0, l = xs.length; i < l; i++) {
    f(xs[i], i);
  }
}

},{"./_stream_readable":39,"./_stream_writable":41,"core-util-is":42,"inherits":28,"process-nextick-args":43}],38:[function(require,module,exports){
// a passthrough stream.
// basically just the most minimal sort of Transform stream.
// Every written chunk gets output as-is.

'use strict';

module.exports = PassThrough;

var Transform = require('./_stream_transform');

/*<replacement>*/
var util = require('core-util-is');
util.inherits = require('inherits');
/*</replacement>*/

util.inherits(PassThrough, Transform);

function PassThrough(options) {
  if (!(this instanceof PassThrough))
    return new PassThrough(options);

  Transform.call(this, options);
}

PassThrough.prototype._transform = function(chunk, encoding, cb) {
  cb(null, chunk);
};

},{"./_stream_transform":40,"core-util-is":42,"inherits":28}],39:[function(require,module,exports){
(function (process){
'use strict';

module.exports = Readable;

/*<replacement>*/
var processNextTick = require('process-nextick-args');
/*</replacement>*/


/*<replacement>*/
var isArray = require('isarray');
/*</replacement>*/


/*<replacement>*/
var Buffer = require('buffer').Buffer;
/*</replacement>*/

Readable.ReadableState = ReadableState;

var EE = require('events');

/*<replacement>*/
var EElistenerCount = function(emitter, type) {
  return emitter.listeners(type).length;
};
/*</replacement>*/



/*<replacement>*/
var Stream;
(function (){try{
  Stream = require('st' + 'ream');
}catch(_){}finally{
  if (!Stream)
    Stream = require('events').EventEmitter;
}}())
/*</replacement>*/

var Buffer = require('buffer').Buffer;

/*<replacement>*/
var util = require('core-util-is');
util.inherits = require('inherits');
/*</replacement>*/



/*<replacement>*/
var debugUtil = require('util');
var debug;
if (debugUtil && debugUtil.debuglog) {
  debug = debugUtil.debuglog('stream');
} else {
  debug = function () {};
}
/*</replacement>*/

var StringDecoder;

util.inherits(Readable, Stream);

function ReadableState(options, stream) {
  var Duplex = require('./_stream_duplex');

  options = options || {};

  // object stream flag. Used to make read(n) ignore n and to
  // make all the buffer merging and length checks go away
  this.objectMode = !!options.objectMode;

  if (stream instanceof Duplex)
    this.objectMode = this.objectMode || !!options.readableObjectMode;

  // the point at which it stops calling _read() to fill the buffer
  // Note: 0 is a valid value, means "don't call _read preemptively ever"
  var hwm = options.highWaterMark;
  var defaultHwm = this.objectMode ? 16 : 16 * 1024;
  this.highWaterMark = (hwm || hwm === 0) ? hwm : defaultHwm;

  // cast to ints.
  this.highWaterMark = ~~this.highWaterMark;

  this.buffer = [];
  this.length = 0;
  this.pipes = null;
  this.pipesCount = 0;
  this.flowing = null;
  this.ended = false;
  this.endEmitted = false;
  this.reading = false;

  // a flag to be able to tell if the onwrite cb is called immediately,
  // or on a later tick.  We set this to true at first, because any
  // actions that shouldn't happen until "later" should generally also
  // not happen before the first write call.
  this.sync = true;

  // whenever we return null, then we set a flag to say
  // that we're awaiting a 'readable' event emission.
  this.needReadable = false;
  this.emittedReadable = false;
  this.readableListening = false;

  // Crypto is kind of old and crusty.  Historically, its default string
  // encoding is 'binary' so we have to make this configurable.
  // Everything else in the universe uses 'utf8', though.
  this.defaultEncoding = options.defaultEncoding || 'utf8';

  // when piping, we only care about 'readable' events that happen
  // after read()ing all the bytes and not getting any pushback.
  this.ranOut = false;

  // the number of writers that are awaiting a drain event in .pipe()s
  this.awaitDrain = 0;

  // if true, a maybeReadMore has been scheduled
  this.readingMore = false;

  this.decoder = null;
  this.encoding = null;
  if (options.encoding) {
    if (!StringDecoder)
      StringDecoder = require('string_decoder/').StringDecoder;
    this.decoder = new StringDecoder(options.encoding);
    this.encoding = options.encoding;
  }
}

function Readable(options) {
  var Duplex = require('./_stream_duplex');

  if (!(this instanceof Readable))
    return new Readable(options);

  this._readableState = new ReadableState(options, this);

  // legacy
  this.readable = true;

  if (options && typeof options.read === 'function')
    this._read = options.read;

  Stream.call(this);
}

// Manually shove something into the read() buffer.
// This returns true if the highWaterMark has not been hit yet,
// similar to how Writable.write() returns true if you should
// write() some more.
Readable.prototype.push = function(chunk, encoding) {
  var state = this._readableState;

  if (!state.objectMode && typeof chunk === 'string') {
    encoding = encoding || state.defaultEncoding;
    if (encoding !== state.encoding) {
      chunk = new Buffer(chunk, encoding);
      encoding = '';
    }
  }

  return readableAddChunk(this, state, chunk, encoding, false);
};

// Unshift should *always* be something directly out of read()
Readable.prototype.unshift = function(chunk) {
  var state = this._readableState;
  return readableAddChunk(this, state, chunk, '', true);
};

Readable.prototype.isPaused = function() {
  return this._readableState.flowing === false;
};

function readableAddChunk(stream, state, chunk, encoding, addToFront) {
  var er = chunkInvalid(state, chunk);
  if (er) {
    stream.emit('error', er);
  } else if (chunk === null) {
    state.reading = false;
    onEofChunk(stream, state);
  } else if (state.objectMode || chunk && chunk.length > 0) {
    if (state.ended && !addToFront) {
      var e = new Error('stream.push() after EOF');
      stream.emit('error', e);
    } else if (state.endEmitted && addToFront) {
      var e = new Error('stream.unshift() after end event');
      stream.emit('error', e);
    } else {
      if (state.decoder && !addToFront && !encoding)
        chunk = state.decoder.write(chunk);

      if (!addToFront)
        state.reading = false;

      // if we want the data now, just emit it.
      if (state.flowing && state.length === 0 && !state.sync) {
        stream.emit('data', chunk);
        stream.read(0);
      } else {
        // update the buffer info.
        state.length += state.objectMode ? 1 : chunk.length;
        if (addToFront)
          state.buffer.unshift(chunk);
        else
          state.buffer.push(chunk);

        if (state.needReadable)
          emitReadable(stream);
      }

      maybeReadMore(stream, state);
    }
  } else if (!addToFront) {
    state.reading = false;
  }

  return needMoreData(state);
}


// if it's past the high water mark, we can push in some more.
// Also, if we have no data yet, we can stand some
// more bytes.  This is to work around cases where hwm=0,
// such as the repl.  Also, if the push() triggered a
// readable event, and the user called read(largeNumber) such that
// needReadable was set, then we ought to push more, so that another
// 'readable' event will be triggered.
function needMoreData(state) {
  return !state.ended &&
         (state.needReadable ||
          state.length < state.highWaterMark ||
          state.length === 0);
}

// backwards compatibility.
Readable.prototype.setEncoding = function(enc) {
  if (!StringDecoder)
    StringDecoder = require('string_decoder/').StringDecoder;
  this._readableState.decoder = new StringDecoder(enc);
  this._readableState.encoding = enc;
  return this;
};

// Don't raise the hwm > 8MB
var MAX_HWM = 0x800000;
function computeNewHighWaterMark(n) {
  if (n >= MAX_HWM) {
    n = MAX_HWM;
  } else {
    // Get the next highest power of 2
    n--;
    n |= n >>> 1;
    n |= n >>> 2;
    n |= n >>> 4;
    n |= n >>> 8;
    n |= n >>> 16;
    n++;
  }
  return n;
}

function howMuchToRead(n, state) {
  if (state.length === 0 && state.ended)
    return 0;

  if (state.objectMode)
    return n === 0 ? 0 : 1;

  if (n === null || isNaN(n)) {
    // only flow one buffer at a time
    if (state.flowing && state.buffer.length)
      return state.buffer[0].length;
    else
      return state.length;
  }

  if (n <= 0)
    return 0;

  // If we're asking for more than the target buffer level,
  // then raise the water mark.  Bump up to the next highest
  // power of 2, to prevent increasing it excessively in tiny
  // amounts.
  if (n > state.highWaterMark)
    state.highWaterMark = computeNewHighWaterMark(n);

  // don't have that much.  return null, unless we've ended.
  if (n > state.length) {
    if (!state.ended) {
      state.needReadable = true;
      return 0;
    } else {
      return state.length;
    }
  }

  return n;
}

// you can override either this method, or the async _read(n) below.
Readable.prototype.read = function(n) {
  debug('read', n);
  var state = this._readableState;
  var nOrig = n;

  if (typeof n !== 'number' || n > 0)
    state.emittedReadable = false;

  // if we're doing read(0) to trigger a readable event, but we
  // already have a bunch of data in the buffer, then just trigger
  // the 'readable' event and move on.
  if (n === 0 &&
      state.needReadable &&
      (state.length >= state.highWaterMark || state.ended)) {
    debug('read: emitReadable', state.length, state.ended);
    if (state.length === 0 && state.ended)
      endReadable(this);
    else
      emitReadable(this);
    return null;
  }

  n = howMuchToRead(n, state);

  // if we've ended, and we're now clear, then finish it up.
  if (n === 0 && state.ended) {
    if (state.length === 0)
      endReadable(this);
    return null;
  }

  // All the actual chunk generation logic needs to be
  // *below* the call to _read.  The reason is that in certain
  // synthetic stream cases, such as passthrough streams, _read
  // may be a completely synchronous operation which may change
  // the state of the read buffer, providing enough data when
  // before there was *not* enough.
  //
  // So, the steps are:
  // 1. Figure out what the state of things will be after we do
  // a read from the buffer.
  //
  // 2. If that resulting state will trigger a _read, then call _read.
  // Note that this may be asynchronous, or synchronous.  Yes, it is
  // deeply ugly to write APIs this way, but that still doesn't mean
  // that the Readable class should behave improperly, as streams are
  // designed to be sync/async agnostic.
  // Take note if the _read call is sync or async (ie, if the read call
  // has returned yet), so that we know whether or not it's safe to emit
  // 'readable' etc.
  //
  // 3. Actually pull the requested chunks out of the buffer and return.

  // if we need a readable event, then we need to do some reading.
  var doRead = state.needReadable;
  debug('need readable', doRead);

  // if we currently have less than the highWaterMark, then also read some
  if (state.length === 0 || state.length - n < state.highWaterMark) {
    doRead = true;
    debug('length less than watermark', doRead);
  }

  // however, if we've ended, then there's no point, and if we're already
  // reading, then it's unnecessary.
  if (state.ended || state.reading) {
    doRead = false;
    debug('reading or ended', doRead);
  }

  if (doRead) {
    debug('do read');
    state.reading = true;
    state.sync = true;
    // if the length is currently zero, then we *need* a readable event.
    if (state.length === 0)
      state.needReadable = true;
    // call internal read method
    this._read(state.highWaterMark);
    state.sync = false;
  }

  // If _read pushed data synchronously, then `reading` will be false,
  // and we need to re-evaluate how much data we can return to the user.
  if (doRead && !state.reading)
    n = howMuchToRead(nOrig, state);

  var ret;
  if (n > 0)
    ret = fromList(n, state);
  else
    ret = null;

  if (ret === null) {
    state.needReadable = true;
    n = 0;
  }

  state.length -= n;

  // If we have nothing in the buffer, then we want to know
  // as soon as we *do* get something into the buffer.
  if (state.length === 0 && !state.ended)
    state.needReadable = true;

  // If we tried to read() past the EOF, then emit end on the next tick.
  if (nOrig !== n && state.ended && state.length === 0)
    endReadable(this);

  if (ret !== null)
    this.emit('data', ret);

  return ret;
};

function chunkInvalid(state, chunk) {
  var er = null;
  if (!(Buffer.isBuffer(chunk)) &&
      typeof chunk !== 'string' &&
      chunk !== null &&
      chunk !== undefined &&
      !state.objectMode) {
    er = new TypeError('Invalid non-string/buffer chunk');
  }
  return er;
}


function onEofChunk(stream, state) {
  if (state.ended) return;
  if (state.decoder) {
    var chunk = state.decoder.end();
    if (chunk && chunk.length) {
      state.buffer.push(chunk);
      state.length += state.objectMode ? 1 : chunk.length;
    }
  }
  state.ended = true;

  // emit 'readable' now to make sure it gets picked up.
  emitReadable(stream);
}

// Don't emit readable right away in sync mode, because this can trigger
// another read() call => stack overflow.  This way, it might trigger
// a nextTick recursion warning, but that's not so bad.
function emitReadable(stream) {
  var state = stream._readableState;
  state.needReadable = false;
  if (!state.emittedReadable) {
    debug('emitReadable', state.flowing);
    state.emittedReadable = true;
    if (state.sync)
      processNextTick(emitReadable_, stream);
    else
      emitReadable_(stream);
  }
}

function emitReadable_(stream) {
  debug('emit readable');
  stream.emit('readable');
  flow(stream);
}


// at this point, the user has presumably seen the 'readable' event,
// and called read() to consume some data.  that may have triggered
// in turn another _read(n) call, in which case reading = true if
// it's in progress.
// However, if we're not ended, or reading, and the length < hwm,
// then go ahead and try to read some more preemptively.
function maybeReadMore(stream, state) {
  if (!state.readingMore) {
    state.readingMore = true;
    processNextTick(maybeReadMore_, stream, state);
  }
}

function maybeReadMore_(stream, state) {
  var len = state.length;
  while (!state.reading && !state.flowing && !state.ended &&
         state.length < state.highWaterMark) {
    debug('maybeReadMore read 0');
    stream.read(0);
    if (len === state.length)
      // didn't get any data, stop spinning.
      break;
    else
      len = state.length;
  }
  state.readingMore = false;
}

// abstract method.  to be overridden in specific implementation classes.
// call cb(er, data) where data is <= n in length.
// for virtual (non-string, non-buffer) streams, "length" is somewhat
// arbitrary, and perhaps not very meaningful.
Readable.prototype._read = function(n) {
  this.emit('error', new Error('not implemented'));
};

Readable.prototype.pipe = function(dest, pipeOpts) {
  var src = this;
  var state = this._readableState;

  switch (state.pipesCount) {
    case 0:
      state.pipes = dest;
      break;
    case 1:
      state.pipes = [state.pipes, dest];
      break;
    default:
      state.pipes.push(dest);
      break;
  }
  state.pipesCount += 1;
  debug('pipe count=%d opts=%j', state.pipesCount, pipeOpts);

  var doEnd = (!pipeOpts || pipeOpts.end !== false) &&
              dest !== process.stdout &&
              dest !== process.stderr;

  var endFn = doEnd ? onend : cleanup;
  if (state.endEmitted)
    processNextTick(endFn);
  else
    src.once('end', endFn);

  dest.on('unpipe', onunpipe);
  function onunpipe(readable) {
    debug('onunpipe');
    if (readable === src) {
      cleanup();
    }
  }

  function onend() {
    debug('onend');
    dest.end();
  }

  // when the dest drains, it reduces the awaitDrain counter
  // on the source.  This would be more elegant with a .once()
  // handler in flow(), but adding and removing repeatedly is
  // too slow.
  var ondrain = pipeOnDrain(src);
  dest.on('drain', ondrain);

  function cleanup() {
    debug('cleanup');
    // cleanup event handlers once the pipe is broken
    dest.removeListener('close', onclose);
    dest.removeListener('finish', onfinish);
    dest.removeListener('drain', ondrain);
    dest.removeListener('error', onerror);
    dest.removeListener('unpipe', onunpipe);
    src.removeListener('end', onend);
    src.removeListener('end', cleanup);
    src.removeListener('data', ondata);

    // if the reader is waiting for a drain event from this
    // specific writer, then it would cause it to never start
    // flowing again.
    // So, if this is awaiting a drain, then we just call it now.
    // If we don't know, then assume that we are waiting for one.
    if (state.awaitDrain &&
        (!dest._writableState || dest._writableState.needDrain))
      ondrain();
  }

  src.on('data', ondata);
  function ondata(chunk) {
    debug('ondata');
    var ret = dest.write(chunk);
    if (false === ret) {
      debug('false write response, pause',
            src._readableState.awaitDrain);
      src._readableState.awaitDrain++;
      src.pause();
    }
  }

  // if the dest has an error, then stop piping into it.
  // however, don't suppress the throwing behavior for this.
  function onerror(er) {
    debug('onerror', er);
    unpipe();
    dest.removeListener('error', onerror);
    if (EElistenerCount(dest, 'error') === 0)
      dest.emit('error', er);
  }
  // This is a brutally ugly hack to make sure that our error handler
  // is attached before any userland ones.  NEVER DO THIS.
  if (!dest._events || !dest._events.error)
    dest.on('error', onerror);
  else if (isArray(dest._events.error))
    dest._events.error.unshift(onerror);
  else
    dest._events.error = [onerror, dest._events.error];


  // Both close and finish should trigger unpipe, but only once.
  function onclose() {
    dest.removeListener('finish', onfinish);
    unpipe();
  }
  dest.once('close', onclose);
  function onfinish() {
    debug('onfinish');
    dest.removeListener('close', onclose);
    unpipe();
  }
  dest.once('finish', onfinish);

  function unpipe() {
    debug('unpipe');
    src.unpipe(dest);
  }

  // tell the dest that it's being piped to
  dest.emit('pipe', src);

  // start the flow if it hasn't been started already.
  if (!state.flowing) {
    debug('pipe resume');
    src.resume();
  }

  return dest;
};

function pipeOnDrain(src) {
  return function() {
    var state = src._readableState;
    debug('pipeOnDrain', state.awaitDrain);
    if (state.awaitDrain)
      state.awaitDrain--;
    if (state.awaitDrain === 0 && EElistenerCount(src, 'data')) {
      state.flowing = true;
      flow(src);
    }
  };
}


Readable.prototype.unpipe = function(dest) {
  var state = this._readableState;

  // if we're not piping anywhere, then do nothing.
  if (state.pipesCount === 0)
    return this;

  // just one destination.  most common case.
  if (state.pipesCount === 1) {
    // passed in one, but it's not the right one.
    if (dest && dest !== state.pipes)
      return this;

    if (!dest)
      dest = state.pipes;

    // got a match.
    state.pipes = null;
    state.pipesCount = 0;
    state.flowing = false;
    if (dest)
      dest.emit('unpipe', this);
    return this;
  }

  // slow case. multiple pipe destinations.

  if (!dest) {
    // remove all.
    var dests = state.pipes;
    var len = state.pipesCount;
    state.pipes = null;
    state.pipesCount = 0;
    state.flowing = false;

    for (var i = 0; i < len; i++)
      dests[i].emit('unpipe', this);
    return this;
  }

  // try to find the right one.
  var i = indexOf(state.pipes, dest);
  if (i === -1)
    return this;

  state.pipes.splice(i, 1);
  state.pipesCount -= 1;
  if (state.pipesCount === 1)
    state.pipes = state.pipes[0];

  dest.emit('unpipe', this);

  return this;
};

// set up data events if they are asked for
// Ensure readable listeners eventually get something
Readable.prototype.on = function(ev, fn) {
  var res = Stream.prototype.on.call(this, ev, fn);

  // If listening to data, and it has not explicitly been paused,
  // then call resume to start the flow of data on the next tick.
  if (ev === 'data' && false !== this._readableState.flowing) {
    this.resume();
  }

  if (ev === 'readable' && this.readable) {
    var state = this._readableState;
    if (!state.readableListening) {
      state.readableListening = true;
      state.emittedReadable = false;
      state.needReadable = true;
      if (!state.reading) {
        processNextTick(nReadingNextTick, this);
      } else if (state.length) {
        emitReadable(this, state);
      }
    }
  }

  return res;
};
Readable.prototype.addListener = Readable.prototype.on;

function nReadingNextTick(self) {
  debug('readable nexttick read 0');
  self.read(0);
}

// pause() and resume() are remnants of the legacy readable stream API
// If the user uses them, then switch into old mode.
Readable.prototype.resume = function() {
  var state = this._readableState;
  if (!state.flowing) {
    debug('resume');
    state.flowing = true;
    resume(this, state);
  }
  return this;
};

function resume(stream, state) {
  if (!state.resumeScheduled) {
    state.resumeScheduled = true;
    processNextTick(resume_, stream, state);
  }
}

function resume_(stream, state) {
  if (!state.reading) {
    debug('resume read 0');
    stream.read(0);
  }

  state.resumeScheduled = false;
  stream.emit('resume');
  flow(stream);
  if (state.flowing && !state.reading)
    stream.read(0);
}

Readable.prototype.pause = function() {
  debug('call pause flowing=%j', this._readableState.flowing);
  if (false !== this._readableState.flowing) {
    debug('pause');
    this._readableState.flowing = false;
    this.emit('pause');
  }
  return this;
};

function flow(stream) {
  var state = stream._readableState;
  debug('flow', state.flowing);
  if (state.flowing) {
    do {
      var chunk = stream.read();
    } while (null !== chunk && state.flowing);
  }
}

// wrap an old-style stream as the async data source.
// This is *not* part of the readable stream interface.
// It is an ugly unfortunate mess of history.
Readable.prototype.wrap = function(stream) {
  var state = this._readableState;
  var paused = false;

  var self = this;
  stream.on('end', function() {
    debug('wrapped end');
    if (state.decoder && !state.ended) {
      var chunk = state.decoder.end();
      if (chunk && chunk.length)
        self.push(chunk);
    }

    self.push(null);
  });

  stream.on('data', function(chunk) {
    debug('wrapped data');
    if (state.decoder)
      chunk = state.decoder.write(chunk);

    // don't skip over falsy values in objectMode
    if (state.objectMode && (chunk === null || chunk === undefined))
      return;
    else if (!state.objectMode && (!chunk || !chunk.length))
      return;

    var ret = self.push(chunk);
    if (!ret) {
      paused = true;
      stream.pause();
    }
  });

  // proxy all the other methods.
  // important when wrapping filters and duplexes.
  for (var i in stream) {
    if (this[i] === undefined && typeof stream[i] === 'function') {
      this[i] = function(method) { return function() {
        return stream[method].apply(stream, arguments);
      }; }(i);
    }
  }

  // proxy certain important events.
  var events = ['error', 'close', 'destroy', 'pause', 'resume'];
  forEach(events, function(ev) {
    stream.on(ev, self.emit.bind(self, ev));
  });

  // when we try to consume some more bytes, simply unpause the
  // underlying stream.
  self._read = function(n) {
    debug('wrapped _read', n);
    if (paused) {
      paused = false;
      stream.resume();
    }
  };

  return self;
};


// exposed for testing purposes only.
Readable._fromList = fromList;

// Pluck off n bytes from an array of buffers.
// Length is the combined lengths of all the buffers in the list.
function fromList(n, state) {
  var list = state.buffer;
  var length = state.length;
  var stringMode = !!state.decoder;
  var objectMode = !!state.objectMode;
  var ret;

  // nothing in the list, definitely empty.
  if (list.length === 0)
    return null;

  if (length === 0)
    ret = null;
  else if (objectMode)
    ret = list.shift();
  else if (!n || n >= length) {
    // read it all, truncate the array.
    if (stringMode)
      ret = list.join('');
    else
      ret = Buffer.concat(list, length);
    list.length = 0;
  } else {
    // read just some of it.
    if (n < list[0].length) {
      // just take a part of the first list item.
      // slice is the same for buffers and strings.
      var buf = list[0];
      ret = buf.slice(0, n);
      list[0] = buf.slice(n);
    } else if (n === list[0].length) {
      // first list is a perfect match
      ret = list.shift();
    } else {
      // complex case.
      // we have enough to cover it, but it spans past the first buffer.
      if (stringMode)
        ret = '';
      else
        ret = new Buffer(n);

      var c = 0;
      for (var i = 0, l = list.length; i < l && c < n; i++) {
        var buf = list[0];
        var cpy = Math.min(n - c, buf.length);

        if (stringMode)
          ret += buf.slice(0, cpy);
        else
          buf.copy(ret, c, 0, cpy);

        if (cpy < buf.length)
          list[0] = buf.slice(cpy);
        else
          list.shift();

        c += cpy;
      }
    }
  }

  return ret;
}

function endReadable(stream) {
  var state = stream._readableState;

  // If we get here before consuming all the bytes, then that is a
  // bug in node.  Should never happen.
  if (state.length > 0)
    throw new Error('endReadable called on non-empty stream');

  if (!state.endEmitted) {
    state.ended = true;
    processNextTick(endReadableNT, state, stream);
  }
}

function endReadableNT(state, stream) {
  // Check that we didn't get one last unshift.
  if (!state.endEmitted && state.length === 0) {
    state.endEmitted = true;
    stream.readable = false;
    stream.emit('end');
  }
}

function forEach (xs, f) {
  for (var i = 0, l = xs.length; i < l; i++) {
    f(xs[i], i);
  }
}

function indexOf (xs, x) {
  for (var i = 0, l = xs.length; i < l; i++) {
    if (xs[i] === x) return i;
  }
  return -1;
}

}).call(this,require('_process'))
},{"./_stream_duplex":37,"_process":31,"buffer":22,"core-util-is":42,"events":26,"inherits":28,"isarray":30,"process-nextick-args":43,"string_decoder/":59,"util":21}],40:[function(require,module,exports){
// a transform stream is a readable/writable stream where you do
// something with the data.  Sometimes it's called a "filter",
// but that's not a great name for it, since that implies a thing where
// some bits pass through, and others are simply ignored.  (That would
// be a valid example of a transform, of course.)
//
// While the output is causally related to the input, it's not a
// necessarily symmetric or synchronous transformation.  For example,
// a zlib stream might take multiple plain-text writes(), and then
// emit a single compressed chunk some time in the future.
//
// Here's how this works:
//
// The Transform stream has all the aspects of the readable and writable
// stream classes.  When you write(chunk), that calls _write(chunk,cb)
// internally, and returns false if there's a lot of pending writes
// buffered up.  When you call read(), that calls _read(n) until
// there's enough pending readable data buffered up.
//
// In a transform stream, the written data is placed in a buffer.  When
// _read(n) is called, it transforms the queued up data, calling the
// buffered _write cb's as it consumes chunks.  If consuming a single
// written chunk would result in multiple output chunks, then the first
// outputted bit calls the readcb, and subsequent chunks just go into
// the read buffer, and will cause it to emit 'readable' if necessary.
//
// This way, back-pressure is actually determined by the reading side,
// since _read has to be called to start processing a new chunk.  However,
// a pathological inflate type of transform can cause excessive buffering
// here.  For example, imagine a stream where every byte of input is
// interpreted as an integer from 0-255, and then results in that many
// bytes of output.  Writing the 4 bytes {ff,ff,ff,ff} would result in
// 1kb of data being output.  In this case, you could write a very small
// amount of input, and end up with a very large amount of output.  In
// such a pathological inflating mechanism, there'd be no way to tell
// the system to stop doing the transform.  A single 4MB write could
// cause the system to run out of memory.
//
// However, even in such a pathological case, only a single written chunk
// would be consumed, and then the rest would wait (un-transformed) until
// the results of the previous transformed chunk were consumed.

'use strict';

module.exports = Transform;

var Duplex = require('./_stream_duplex');

/*<replacement>*/
var util = require('core-util-is');
util.inherits = require('inherits');
/*</replacement>*/

util.inherits(Transform, Duplex);


function TransformState(stream) {
  this.afterTransform = function(er, data) {
    return afterTransform(stream, er, data);
  };

  this.needTransform = false;
  this.transforming = false;
  this.writecb = null;
  this.writechunk = null;
}

function afterTransform(stream, er, data) {
  var ts = stream._transformState;
  ts.transforming = false;

  var cb = ts.writecb;

  if (!cb)
    return stream.emit('error', new Error('no writecb in Transform class'));

  ts.writechunk = null;
  ts.writecb = null;

  if (data !== null && data !== undefined)
    stream.push(data);

  if (cb)
    cb(er);

  var rs = stream._readableState;
  rs.reading = false;
  if (rs.needReadable || rs.length < rs.highWaterMark) {
    stream._read(rs.highWaterMark);
  }
}


function Transform(options) {
  if (!(this instanceof Transform))
    return new Transform(options);

  Duplex.call(this, options);

  this._transformState = new TransformState(this);

  // when the writable side finishes, then flush out anything remaining.
  var stream = this;

  // start out asking for a readable event once data is transformed.
  this._readableState.needReadable = true;

  // we have implemented the _read method, and done the other things
  // that Readable wants before the first _read call, so unset the
  // sync guard flag.
  this._readableState.sync = false;

  if (options) {
    if (typeof options.transform === 'function')
      this._transform = options.transform;

    if (typeof options.flush === 'function')
      this._flush = options.flush;
  }

  this.once('prefinish', function() {
    if (typeof this._flush === 'function')
      this._flush(function(er) {
        done(stream, er);
      });
    else
      done(stream);
  });
}

Transform.prototype.push = function(chunk, encoding) {
  this._transformState.needTransform = false;
  return Duplex.prototype.push.call(this, chunk, encoding);
};

// This is the part where you do stuff!
// override this function in implementation classes.
// 'chunk' is an input chunk.
//
// Call `push(newChunk)` to pass along transformed output
// to the readable side.  You may call 'push' zero or more times.
//
// Call `cb(err)` when you are done with this chunk.  If you pass
// an error, then that'll put the hurt on the whole operation.  If you
// never call cb(), then you'll never get another chunk.
Transform.prototype._transform = function(chunk, encoding, cb) {
  throw new Error('not implemented');
};

Transform.prototype._write = function(chunk, encoding, cb) {
  var ts = this._transformState;
  ts.writecb = cb;
  ts.writechunk = chunk;
  ts.writeencoding = encoding;
  if (!ts.transforming) {
    var rs = this._readableState;
    if (ts.needTransform ||
        rs.needReadable ||
        rs.length < rs.highWaterMark)
      this._read(rs.highWaterMark);
  }
};

// Doesn't matter what the args are here.
// _transform does all the work.
// That we got here means that the readable side wants more data.
Transform.prototype._read = function(n) {
  var ts = this._transformState;

  if (ts.writechunk !== null && ts.writecb && !ts.transforming) {
    ts.transforming = true;
    this._transform(ts.writechunk, ts.writeencoding, ts.afterTransform);
  } else {
    // mark that we need a transform, so that any data that comes in
    // will get processed, now that we've asked for it.
    ts.needTransform = true;
  }
};


function done(stream, er) {
  if (er)
    return stream.emit('error', er);

  // if there's nothing in the write buffer, then that means
  // that nothing more will ever be provided
  var ws = stream._writableState;
  var ts = stream._transformState;

  if (ws.length)
    throw new Error('calling transform done when ws.length != 0');

  if (ts.transforming)
    throw new Error('calling transform done when still transforming');

  return stream.push(null);
}

},{"./_stream_duplex":37,"core-util-is":42,"inherits":28}],41:[function(require,module,exports){
// A bit simpler than readable streams.
// Implement an async ._write(chunk, cb), and it'll handle all
// the drain event emission and buffering.

'use strict';

module.exports = Writable;

/*<replacement>*/
var processNextTick = require('process-nextick-args');
/*</replacement>*/


/*<replacement>*/
var Buffer = require('buffer').Buffer;
/*</replacement>*/

Writable.WritableState = WritableState;


/*<replacement>*/
var util = require('core-util-is');
util.inherits = require('inherits');
/*</replacement>*/


/*<replacement>*/
var internalUtil = {
  deprecate: require('util-deprecate')
};
/*</replacement>*/



/*<replacement>*/
var Stream;
(function (){try{
  Stream = require('st' + 'ream');
}catch(_){}finally{
  if (!Stream)
    Stream = require('events').EventEmitter;
}}())
/*</replacement>*/

var Buffer = require('buffer').Buffer;

util.inherits(Writable, Stream);

function nop() {}

function WriteReq(chunk, encoding, cb) {
  this.chunk = chunk;
  this.encoding = encoding;
  this.callback = cb;
  this.next = null;
}

function WritableState(options, stream) {
  var Duplex = require('./_stream_duplex');

  options = options || {};

  // object stream flag to indicate whether or not this stream
  // contains buffers or objects.
  this.objectMode = !!options.objectMode;

  if (stream instanceof Duplex)
    this.objectMode = this.objectMode || !!options.writableObjectMode;

  // the point at which write() starts returning false
  // Note: 0 is a valid value, means that we always return false if
  // the entire buffer is not flushed immediately on write()
  var hwm = options.highWaterMark;
  var defaultHwm = this.objectMode ? 16 : 16 * 1024;
  this.highWaterMark = (hwm || hwm === 0) ? hwm : defaultHwm;

  // cast to ints.
  this.highWaterMark = ~~this.highWaterMark;

  this.needDrain = false;
  // at the start of calling end()
  this.ending = false;
  // when end() has been called, and returned
  this.ended = false;
  // when 'finish' is emitted
  this.finished = false;

  // should we decode strings into buffers before passing to _write?
  // this is here so that some node-core streams can optimize string
  // handling at a lower level.
  var noDecode = options.decodeStrings === false;
  this.decodeStrings = !noDecode;

  // Crypto is kind of old and crusty.  Historically, its default string
  // encoding is 'binary' so we have to make this configurable.
  // Everything else in the universe uses 'utf8', though.
  this.defaultEncoding = options.defaultEncoding || 'utf8';

  // not an actual buffer we keep track of, but a measurement
  // of how much we're waiting to get pushed to some underlying
  // socket or file.
  this.length = 0;

  // a flag to see when we're in the middle of a write.
  this.writing = false;

  // when true all writes will be buffered until .uncork() call
  this.corked = 0;

  // a flag to be able to tell if the onwrite cb is called immediately,
  // or on a later tick.  We set this to true at first, because any
  // actions that shouldn't happen until "later" should generally also
  // not happen before the first write call.
  this.sync = true;

  // a flag to know if we're processing previously buffered items, which
  // may call the _write() callback in the same tick, so that we don't
  // end up in an overlapped onwrite situation.
  this.bufferProcessing = false;

  // the callback that's passed to _write(chunk,cb)
  this.onwrite = function(er) {
    onwrite(stream, er);
  };

  // the callback that the user supplies to write(chunk,encoding,cb)
  this.writecb = null;

  // the amount that is being written when _write is called.
  this.writelen = 0;

  this.bufferedRequest = null;
  this.lastBufferedRequest = null;

  // number of pending user-supplied write callbacks
  // this must be 0 before 'finish' can be emitted
  this.pendingcb = 0;

  // emit prefinish if the only thing we're waiting for is _write cbs
  // This is relevant for synchronous Transform streams
  this.prefinished = false;

  // True if the error was already emitted and should not be thrown again
  this.errorEmitted = false;
}

WritableState.prototype.getBuffer = function writableStateGetBuffer() {
  var current = this.bufferedRequest;
  var out = [];
  while (current) {
    out.push(current);
    current = current.next;
  }
  return out;
};

(function (){try {
Object.defineProperty(WritableState.prototype, 'buffer', {
  get: internalUtil.deprecate(function() {
    return this.getBuffer();
  }, '_writableState.buffer is deprecated. Use _writableState.getBuffer ' +
     'instead.')
});
}catch(_){}}());


function Writable(options) {
  var Duplex = require('./_stream_duplex');

  // Writable ctor is applied to Duplexes, though they're not
  // instanceof Writable, they're instanceof Readable.
  if (!(this instanceof Writable) && !(this instanceof Duplex))
    return new Writable(options);

  this._writableState = new WritableState(options, this);

  // legacy.
  this.writable = true;

  if (options) {
    if (typeof options.write === 'function')
      this._write = options.write;

    if (typeof options.writev === 'function')
      this._writev = options.writev;
  }

  Stream.call(this);
}

// Otherwise people can pipe Writable streams, which is just wrong.
Writable.prototype.pipe = function() {
  this.emit('error', new Error('Cannot pipe. Not readable.'));
};


function writeAfterEnd(stream, cb) {
  var er = new Error('write after end');
  // TODO: defer error events consistently everywhere, not just the cb
  stream.emit('error', er);
  processNextTick(cb, er);
}

// If we get something that is not a buffer, string, null, or undefined,
// and we're not in objectMode, then that's an error.
// Otherwise stream chunks are all considered to be of length=1, and the
// watermarks determine how many objects to keep in the buffer, rather than
// how many bytes or characters.
function validChunk(stream, state, chunk, cb) {
  var valid = true;

  if (!(Buffer.isBuffer(chunk)) &&
      typeof chunk !== 'string' &&
      chunk !== null &&
      chunk !== undefined &&
      !state.objectMode) {
    var er = new TypeError('Invalid non-string/buffer chunk');
    stream.emit('error', er);
    processNextTick(cb, er);
    valid = false;
  }
  return valid;
}

Writable.prototype.write = function(chunk, encoding, cb) {
  var state = this._writableState;
  var ret = false;

  if (typeof encoding === 'function') {
    cb = encoding;
    encoding = null;
  }

  if (Buffer.isBuffer(chunk))
    encoding = 'buffer';
  else if (!encoding)
    encoding = state.defaultEncoding;

  if (typeof cb !== 'function')
    cb = nop;

  if (state.ended)
    writeAfterEnd(this, cb);
  else if (validChunk(this, state, chunk, cb)) {
    state.pendingcb++;
    ret = writeOrBuffer(this, state, chunk, encoding, cb);
  }

  return ret;
};

Writable.prototype.cork = function() {
  var state = this._writableState;

  state.corked++;
};

Writable.prototype.uncork = function() {
  var state = this._writableState;

  if (state.corked) {
    state.corked--;

    if (!state.writing &&
        !state.corked &&
        !state.finished &&
        !state.bufferProcessing &&
        state.bufferedRequest)
      clearBuffer(this, state);
  }
};

Writable.prototype.setDefaultEncoding = function setDefaultEncoding(encoding) {
  // node::ParseEncoding() requires lower case.
  if (typeof encoding === 'string')
    encoding = encoding.toLowerCase();
  if (!(['hex', 'utf8', 'utf-8', 'ascii', 'binary', 'base64',
'ucs2', 'ucs-2','utf16le', 'utf-16le', 'raw']
.indexOf((encoding + '').toLowerCase()) > -1))
    throw new TypeError('Unknown encoding: ' + encoding);
  this._writableState.defaultEncoding = encoding;
};

function decodeChunk(state, chunk, encoding) {
  if (!state.objectMode &&
      state.decodeStrings !== false &&
      typeof chunk === 'string') {
    chunk = new Buffer(chunk, encoding);
  }
  return chunk;
}

// if we're already writing something, then just put this
// in the queue, and wait our turn.  Otherwise, call _write
// If we return false, then we need a drain event, so set that flag.
function writeOrBuffer(stream, state, chunk, encoding, cb) {
  chunk = decodeChunk(state, chunk, encoding);

  if (Buffer.isBuffer(chunk))
    encoding = 'buffer';
  var len = state.objectMode ? 1 : chunk.length;

  state.length += len;

  var ret = state.length < state.highWaterMark;
  // we must ensure that previous needDrain will not be reset to false.
  if (!ret)
    state.needDrain = true;

  if (state.writing || state.corked) {
    var last = state.lastBufferedRequest;
    state.lastBufferedRequest = new WriteReq(chunk, encoding, cb);
    if (last) {
      last.next = state.lastBufferedRequest;
    } else {
      state.bufferedRequest = state.lastBufferedRequest;
    }
  } else {
    doWrite(stream, state, false, len, chunk, encoding, cb);
  }

  return ret;
}

function doWrite(stream, state, writev, len, chunk, encoding, cb) {
  state.writelen = len;
  state.writecb = cb;
  state.writing = true;
  state.sync = true;
  if (writev)
    stream._writev(chunk, state.onwrite);
  else
    stream._write(chunk, encoding, state.onwrite);
  state.sync = false;
}

function onwriteError(stream, state, sync, er, cb) {
  --state.pendingcb;
  if (sync)
    processNextTick(cb, er);
  else
    cb(er);

  stream._writableState.errorEmitted = true;
  stream.emit('error', er);
}

function onwriteStateUpdate(state) {
  state.writing = false;
  state.writecb = null;
  state.length -= state.writelen;
  state.writelen = 0;
}

function onwrite(stream, er) {
  var state = stream._writableState;
  var sync = state.sync;
  var cb = state.writecb;

  onwriteStateUpdate(state);

  if (er)
    onwriteError(stream, state, sync, er, cb);
  else {
    // Check if we're actually ready to finish, but don't emit yet
    var finished = needFinish(state);

    if (!finished &&
        !state.corked &&
        !state.bufferProcessing &&
        state.bufferedRequest) {
      clearBuffer(stream, state);
    }

    if (sync) {
      processNextTick(afterWrite, stream, state, finished, cb);
    } else {
      afterWrite(stream, state, finished, cb);
    }
  }
}

function afterWrite(stream, state, finished, cb) {
  if (!finished)
    onwriteDrain(stream, state);
  state.pendingcb--;
  cb();
  finishMaybe(stream, state);
}

// Must force callback to be called on nextTick, so that we don't
// emit 'drain' before the write() consumer gets the 'false' return
// value, and has a chance to attach a 'drain' listener.
function onwriteDrain(stream, state) {
  if (state.length === 0 && state.needDrain) {
    state.needDrain = false;
    stream.emit('drain');
  }
}


// if there's something in the buffer waiting, then process it
function clearBuffer(stream, state) {
  state.bufferProcessing = true;
  var entry = state.bufferedRequest;

  if (stream._writev && entry && entry.next) {
    // Fast case, write everything using _writev()
    var buffer = [];
    var cbs = [];
    while (entry) {
      cbs.push(entry.callback);
      buffer.push(entry);
      entry = entry.next;
    }

    // count the one we are adding, as well.
    // TODO(isaacs) clean this up
    state.pendingcb++;
    state.lastBufferedRequest = null;
    doWrite(stream, state, true, state.length, buffer, '', function(err) {
      for (var i = 0; i < cbs.length; i++) {
        state.pendingcb--;
        cbs[i](err);
      }
    });

    // Clear buffer
  } else {
    // Slow case, write chunks one-by-one
    while (entry) {
      var chunk = entry.chunk;
      var encoding = entry.encoding;
      var cb = entry.callback;
      var len = state.objectMode ? 1 : chunk.length;

      doWrite(stream, state, false, len, chunk, encoding, cb);
      entry = entry.next;
      // if we didn't call the onwrite immediately, then
      // it means that we need to wait until it does.
      // also, that means that the chunk and cb are currently
      // being processed, so move the buffer counter past them.
      if (state.writing) {
        break;
      }
    }

    if (entry === null)
      state.lastBufferedRequest = null;
  }
  state.bufferedRequest = entry;
  state.bufferProcessing = false;
}

Writable.prototype._write = function(chunk, encoding, cb) {
  cb(new Error('not implemented'));
};

Writable.prototype._writev = null;

Writable.prototype.end = function(chunk, encoding, cb) {
  var state = this._writableState;

  if (typeof chunk === 'function') {
    cb = chunk;
    chunk = null;
    encoding = null;
  } else if (typeof encoding === 'function') {
    cb = encoding;
    encoding = null;
  }

  if (chunk !== null && chunk !== undefined)
    this.write(chunk, encoding);

  // .end() fully uncorks
  if (state.corked) {
    state.corked = 1;
    this.uncork();
  }

  // ignore unnecessary end() calls.
  if (!state.ending && !state.finished)
    endWritable(this, state, cb);
};


function needFinish(state) {
  return (state.ending &&
          state.length === 0 &&
          state.bufferedRequest === null &&
          !state.finished &&
          !state.writing);
}

function prefinish(stream, state) {
  if (!state.prefinished) {
    state.prefinished = true;
    stream.emit('prefinish');
  }
}

function finishMaybe(stream, state) {
  var need = needFinish(state);
  if (need) {
    if (state.pendingcb === 0) {
      prefinish(stream, state);
      state.finished = true;
      stream.emit('finish');
    } else {
      prefinish(stream, state);
    }
  }
  return need;
}

function endWritable(stream, state, cb) {
  state.ending = true;
  finishMaybe(stream, state);
  if (cb) {
    if (state.finished)
      processNextTick(cb);
    else
      stream.once('finish', cb);
  }
  state.ended = true;
}

},{"./_stream_duplex":37,"buffer":22,"core-util-is":42,"events":26,"inherits":28,"process-nextick-args":43,"util-deprecate":44}],42:[function(require,module,exports){
(function (Buffer){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

// NOTE: These type checking functions intentionally don't use `instanceof`
// because it is fragile and can be easily faked with `Object.create()`.
function isArray(ar) {
  return Array.isArray(ar);
}
exports.isArray = isArray;

function isBoolean(arg) {
  return typeof arg === 'boolean';
}
exports.isBoolean = isBoolean;

function isNull(arg) {
  return arg === null;
}
exports.isNull = isNull;

function isNullOrUndefined(arg) {
  return arg == null;
}
exports.isNullOrUndefined = isNullOrUndefined;

function isNumber(arg) {
  return typeof arg === 'number';
}
exports.isNumber = isNumber;

function isString(arg) {
  return typeof arg === 'string';
}
exports.isString = isString;

function isSymbol(arg) {
  return typeof arg === 'symbol';
}
exports.isSymbol = isSymbol;

function isUndefined(arg) {
  return arg === void 0;
}
exports.isUndefined = isUndefined;

function isRegExp(re) {
  return isObject(re) && objectToString(re) === '[object RegExp]';
}
exports.isRegExp = isRegExp;

function isObject(arg) {
  return typeof arg === 'object' && arg !== null;
}
exports.isObject = isObject;

function isDate(d) {
  return isObject(d) && objectToString(d) === '[object Date]';
}
exports.isDate = isDate;

function isError(e) {
  return isObject(e) &&
      (objectToString(e) === '[object Error]' || e instanceof Error);
}
exports.isError = isError;

function isFunction(arg) {
  return typeof arg === 'function';
}
exports.isFunction = isFunction;

function isPrimitive(arg) {
  return arg === null ||
         typeof arg === 'boolean' ||
         typeof arg === 'number' ||
         typeof arg === 'string' ||
         typeof arg === 'symbol' ||  // ES6 symbol
         typeof arg === 'undefined';
}
exports.isPrimitive = isPrimitive;

function isBuffer(arg) {
  return Buffer.isBuffer(arg);
}
exports.isBuffer = isBuffer;

function objectToString(o) {
  return Object.prototype.toString.call(o);
}
}).call(this,{"isBuffer":require("../../../../insert-module-globals/node_modules/is-buffer/index.js")})
},{"../../../../insert-module-globals/node_modules/is-buffer/index.js":29}],43:[function(require,module,exports){
(function (process){
'use strict';
module.exports = nextTick;

function nextTick(fn) {
  var args = new Array(arguments.length - 1);
  var i = 0;
  while (i < args.length) {
    args[i++] = arguments[i];
  }
  process.nextTick(function afterTick() {
    fn.apply(null, args);
  });
}

}).call(this,require('_process'))
},{"_process":31}],44:[function(require,module,exports){
(function (global){

/**
 * Module exports.
 */

module.exports = deprecate;

/**
 * Mark that a method should not be used.
 * Returns a modified function which warns once by default.
 *
 * If `localStorage.noDeprecation = true` is set, then it is a no-op.
 *
 * If `localStorage.throwDeprecation = true` is set, then deprecated functions
 * will throw an Error when invoked.
 *
 * If `localStorage.traceDeprecation = true` is set, then deprecated functions
 * will invoke `console.trace()` instead of `console.error()`.
 *
 * @param {Function} fn - the function to deprecate
 * @param {String} msg - the string to print to the console when `fn` is invoked
 * @returns {Function} a new "deprecated" version of `fn`
 * @api public
 */

function deprecate (fn, msg) {
  if (config('noDeprecation')) {
    return fn;
  }

  var warned = false;
  function deprecated() {
    if (!warned) {
      if (config('throwDeprecation')) {
        throw new Error(msg);
      } else if (config('traceDeprecation')) {
        console.trace(msg);
      } else {
        console.warn(msg);
      }
      warned = true;
    }
    return fn.apply(this, arguments);
  }

  return deprecated;
}

/**
 * Checks `localStorage` for boolean values for the given `name`.
 *
 * @param {String} name
 * @returns {Boolean}
 * @api private
 */

function config (name) {
  // accessing global.localStorage can trigger a DOMException in sandboxed iframes
  try {
    if (!global.localStorage) return false;
  } catch (_) {
    return false;
  }
  var val = global.localStorage[name];
  if (null == val) return false;
  return String(val).toLowerCase() === 'true';
}

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{}],45:[function(require,module,exports){
module.exports = require("./lib/_stream_passthrough.js")

},{"./lib/_stream_passthrough.js":38}],46:[function(require,module,exports){
var Stream = (function (){
  try {
    return require('st' + 'ream'); // hack to fix a circular dependency issue when used with browserify
  } catch(_){}
}());
exports = module.exports = require('./lib/_stream_readable.js');
exports.Stream = Stream || exports;
exports.Readable = exports;
exports.Writable = require('./lib/_stream_writable.js');
exports.Duplex = require('./lib/_stream_duplex.js');
exports.Transform = require('./lib/_stream_transform.js');
exports.PassThrough = require('./lib/_stream_passthrough.js');

},{"./lib/_stream_duplex.js":37,"./lib/_stream_passthrough.js":38,"./lib/_stream_readable.js":39,"./lib/_stream_transform.js":40,"./lib/_stream_writable.js":41}],47:[function(require,module,exports){
module.exports = require("./lib/_stream_transform.js")

},{"./lib/_stream_transform.js":40}],48:[function(require,module,exports){
module.exports = require("./lib/_stream_writable.js")

},{"./lib/_stream_writable.js":41}],49:[function(require,module,exports){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

module.exports = Stream;

var EE = require('events').EventEmitter;
var inherits = require('inherits');

inherits(Stream, EE);
Stream.Readable = require('readable-stream/readable.js');
Stream.Writable = require('readable-stream/writable.js');
Stream.Duplex = require('readable-stream/duplex.js');
Stream.Transform = require('readable-stream/transform.js');
Stream.PassThrough = require('readable-stream/passthrough.js');

// Backwards-compat with node 0.4.x
Stream.Stream = Stream;



// old-style streams.  Note that the pipe method (the only relevant
// part of this class) is overridden in the Readable class.

function Stream() {
  EE.call(this);
}

Stream.prototype.pipe = function(dest, options) {
  var source = this;

  function ondata(chunk) {
    if (dest.writable) {
      if (false === dest.write(chunk) && source.pause) {
        source.pause();
      }
    }
  }

  source.on('data', ondata);

  function ondrain() {
    if (source.readable && source.resume) {
      source.resume();
    }
  }

  dest.on('drain', ondrain);

  // If the 'end' option is not supplied, dest.end() will be called when
  // source gets the 'end' or 'close' events.  Only dest.end() once.
  if (!dest._isStdio && (!options || options.end !== false)) {
    source.on('end', onend);
    source.on('close', onclose);
  }

  var didOnEnd = false;
  function onend() {
    if (didOnEnd) return;
    didOnEnd = true;

    dest.end();
  }


  function onclose() {
    if (didOnEnd) return;
    didOnEnd = true;

    if (typeof dest.destroy === 'function') dest.destroy();
  }

  // don't leave dangling pipes when there are errors.
  function onerror(er) {
    cleanup();
    if (EE.listenerCount(this, 'error') === 0) {
      throw er; // Unhandled stream error in pipe.
    }
  }

  source.on('error', onerror);
  dest.on('error', onerror);

  // remove all the event listeners that were added.
  function cleanup() {
    source.removeListener('data', ondata);
    dest.removeListener('drain', ondrain);

    source.removeListener('end', onend);
    source.removeListener('close', onclose);

    source.removeListener('error', onerror);
    dest.removeListener('error', onerror);

    source.removeListener('end', cleanup);
    source.removeListener('close', cleanup);

    dest.removeListener('close', cleanup);
  }

  source.on('end', cleanup);
  source.on('close', cleanup);

  dest.on('close', cleanup);

  dest.emit('pipe', source);

  // Allow for unix-like usage: A.pipe(B).pipe(C)
  return dest;
};

},{"events":26,"inherits":28,"readable-stream/duplex.js":36,"readable-stream/passthrough.js":45,"readable-stream/readable.js":46,"readable-stream/transform.js":47,"readable-stream/writable.js":48}],50:[function(require,module,exports){
var ClientRequest = require('./lib/request')
var extend = require('xtend')
var statusCodes = require('builtin-status-codes')
var url = require('url')

var http = exports

http.request = function (opts, cb) {
	if (typeof opts === 'string')
		opts = url.parse(opts)
	else
		opts = extend(opts)

	var protocol = opts.protocol || ''
	var host = opts.hostname || opts.host
	var port = opts.port
	var path = opts.path || '/'

	// Necessary for IPv6 addresses
	if (host && host.indexOf(':') !== -1)
		host = '[' + host + ']'

	// This may be a relative url. The browser should always be able to interpret it correctly.
	opts.url = (host ? (protocol + '//' + host) : '') + (port ? ':' + port : '') + path
	opts.method = (opts.method || 'GET').toUpperCase()
	opts.headers = opts.headers || {}

	// Also valid opts.auth, opts.mode

	var req = new ClientRequest(opts)
	if (cb)
		req.on('response', cb)
	return req
}

http.get = function get (opts, cb) {
	var req = http.request(opts, cb)
	req.end()
	return req
}

http.Agent = function () {}
http.Agent.defaultMaxSockets = 4

http.STATUS_CODES = statusCodes

http.METHODS = [
	'CHECKOUT',
	'CONNECT',
	'COPY',
	'DELETE',
	'GET',
	'HEAD',
	'LOCK',
	'M-SEARCH',
	'MERGE',
	'MKACTIVITY',
	'MKCOL',
	'MOVE',
	'NOTIFY',
	'OPTIONS',
	'PATCH',
	'POST',
	'PROPFIND',
	'PROPPATCH',
	'PURGE',
	'PUT',
	'REPORT',
	'SEARCH',
	'SUBSCRIBE',
	'TRACE',
	'UNLOCK',
	'UNSUBSCRIBE'
]
},{"./lib/request":52,"builtin-status-codes":54,"url":60,"xtend":61}],51:[function(require,module,exports){
(function (global){
exports.fetch = isFunction(global.fetch) && isFunction(global.ReadableByteStream)

exports.blobConstructor = false
try {
	new Blob([new ArrayBuffer(1)])
	exports.blobConstructor = true
} catch (e) {}

var xhr = new global.XMLHttpRequest()
// If location.host is empty, e.g. if this page/worker was loaded
// from a Blob, then use example.com to avoid an error
xhr.open('GET', global.location.host ? '/' : 'https://example.com')

function checkTypeSupport (type) {
	try {
		xhr.responseType = type
		return xhr.responseType === type
	} catch (e) {}
	return false
}

// For some strange reason, Safari 7.0 reports typeof global.ArrayBuffer === 'object'.
// Safari 7.1 appears to have fixed this bug.
var haveArrayBuffer = typeof global.ArrayBuffer !== 'undefined'
var haveSlice = haveArrayBuffer && isFunction(global.ArrayBuffer.prototype.slice)

exports.arraybuffer = haveArrayBuffer && checkTypeSupport('arraybuffer')
// These next two tests unavoidably show warnings in Chrome. Since fetch will always
// be used if it's available, just return false for these to avoid the warnings.
exports.msstream = !exports.fetch && haveSlice && checkTypeSupport('ms-stream')
exports.mozchunkedarraybuffer = !exports.fetch && haveArrayBuffer &&
	checkTypeSupport('moz-chunked-arraybuffer')
exports.overrideMimeType = isFunction(xhr.overrideMimeType)
exports.vbArray = isFunction(global.VBArray)

function isFunction (value) {
  return typeof value === 'function'
}

xhr = null // Help gc

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{}],52:[function(require,module,exports){
(function (process,global,Buffer){
// var Base64 = require('Base64')
var capability = require('./capability')
var foreach = require('foreach')
var indexOf = require('indexof')
var inherits = require('inherits')
var keys = require('object-keys')
var response = require('./response')
var stream = require('stream')

var IncomingMessage = response.IncomingMessage
var rStates = response.readyStates

function decideMode (preferBinary) {
	if (capability.fetch) {
		return 'fetch'
	} else if (capability.mozchunkedarraybuffer) {
		return 'moz-chunked-arraybuffer'
	} else if (capability.msstream) {
		return 'ms-stream'
	} else if (capability.arraybuffer && preferBinary) {
		return 'arraybuffer'
	} else if (capability.vbArray && preferBinary) {
		return 'text:vbarray'
	} else {
		return 'text'
	}
}

var ClientRequest = module.exports = function (opts) {
	var self = this
	stream.Writable.call(self)

	self._opts = opts
	self._body = []
	self._headers = {}
	if (opts.auth)
		self.setHeader('Authorization', 'Basic ' + new Buffer(opts.auth).toString('base64'))
	foreach(keys(opts.headers), function (name) {
		self.setHeader(name, opts.headers[name])
	})

	var preferBinary
	if (opts.mode === 'prefer-streaming') {
		// If streaming is a high priority but binary compatibility and
		// the accuracy of the 'content-type' header aren't
		preferBinary = false
	} else if (opts.mode === 'allow-wrong-content-type') {
		// If streaming is more important than preserving the 'content-type' header
		preferBinary = !capability.overrideMimeType
	} else if (!opts.mode || opts.mode === 'default' || opts.mode === 'prefer-fast') {
		// Use binary if text streaming may corrupt data or the content-type header, or for speed
		preferBinary = true
	} else {
		throw new Error('Invalid value for opts.mode')
	}
	self._mode = decideMode(preferBinary)

	self.on('finish', function () {
		self._onFinish()
	})
}

inherits(ClientRequest, stream.Writable)

ClientRequest.prototype.setHeader = function (name, value) {
	var self = this
	var lowerName = name.toLowerCase()
	// This check is not necessary, but it prevents warnings from browsers about setting unsafe
	// headers. To be honest I'm not entirely sure hiding these warnings is a good thing, but
	// http-browserify did it, so I will too.
	if (indexOf(unsafeHeaders, lowerName) !== -1)
		return

	self._headers[lowerName] = {
		name: name,
		value: value
	}
}

ClientRequest.prototype.getHeader = function (name) {
	var self = this
	return self._headers[name.toLowerCase()].value
}

ClientRequest.prototype.removeHeader = function (name) {
	var self = this
	delete self._headers[name.toLowerCase()]
}

ClientRequest.prototype._onFinish = function () {
	var self = this

	if (self._destroyed)
		return
	var opts = self._opts

	var headersObj = self._headers
	var body
	if (opts.method === 'POST' || opts.method === 'PUT') {
		if (capability.blobConstructor) {
			body = new global.Blob(self._body.map(function (buffer) {
				return buffer.toArrayBuffer()
			}), {
				type: (headersObj['content-type'] || {}).value || ''
			})
		} else {
			// get utf8 string
			body = Buffer.concat(self._body).toString()
		}
	}

	if (self._mode === 'fetch') {
		var headers = keys(headersObj).map(function (name) {
			return [headersObj[name].name, headersObj[name].value]
		})

		global.fetch(self._opts.url, {
			method: self._opts.method,
			headers: headers,
			body: body,
			mode: 'cors',
			credentials: opts.withCredentials ? 'include' : 'same-origin'
		}).then(function (response) {
			self._fetchResponse = response
			self._connect()
		}).then(undefined, function (reason) {
			self.emit('error', reason)
		})
	} else {
		var xhr = self._xhr = new global.XMLHttpRequest()
		try {
			xhr.open(self._opts.method, self._opts.url, true)
		} catch (err) {
			process.nextTick(function () {
				self.emit('error', err)
			})
			return
		}

		// Can't set responseType on really old browsers
		if ('responseType' in xhr)
			xhr.responseType = self._mode.split(':')[0]

		if ('withCredentials' in xhr)
			xhr.withCredentials = !!opts.withCredentials

		if (self._mode === 'text' && 'overrideMimeType' in xhr)
			xhr.overrideMimeType('text/plain; charset=x-user-defined')

		foreach(keys(headersObj), function (name) {
			xhr.setRequestHeader(headersObj[name].name, headersObj[name].value)
		})

		self._response = null
		xhr.onreadystatechange = function () {
			switch (xhr.readyState) {
				case rStates.LOADING:
				case rStates.DONE:
					self._onXHRProgress()
					break
			}
		}
		// Necessary for streaming in Firefox, since xhr.response is ONLY defined
		// in onprogress, not in onreadystatechange with xhr.readyState = 3
		if (self._mode === 'moz-chunked-arraybuffer') {
			xhr.onprogress = function () {
				self._onXHRProgress()
			}
		}

		xhr.onerror = function () {
			if (self._destroyed)
				return
			self.emit('error', new Error('XHR error'))
		}

		try {
			xhr.send(body)
		} catch (err) {
			process.nextTick(function () {
				self.emit('error', err)
			})
			return
		}
	}
}

/**
 * Checks if xhr.status is readable. Even though the spec says it should
 * be available in readyState 3, accessing it throws an exception in IE8
 */
function statusValid (xhr) {
	try {
		return (xhr.status !== null)
	} catch (e) {
		return false
	}
}

ClientRequest.prototype._onXHRProgress = function () {
	var self = this

	if (!statusValid(self._xhr) || self._destroyed)
		return

	if (!self._response)
		self._connect()

	self._response._onXHRProgress()
}

ClientRequest.prototype._connect = function () {
	var self = this

	if (self._destroyed)
		return

	self._response = new IncomingMessage(self._xhr, self._fetchResponse, self._mode)
	self.emit('response', self._response)
}

ClientRequest.prototype._write = function (chunk, encoding, cb) {
	var self = this

	self._body.push(chunk)
	cb()
}

ClientRequest.prototype.abort = ClientRequest.prototype.destroy = function () {
	var self = this
	self._destroyed = true
	if (self._response)
		self._response._destroyed = true
	if (self._xhr)
		self._xhr.abort()
	// Currently, there isn't a way to truly abort a fetch.
	// If you like bikeshedding, see https://github.com/whatwg/fetch/issues/27
}

ClientRequest.prototype.end = function (data, encoding, cb) {
	var self = this
	if (typeof data === 'function') {
		cb = data
		data = undefined
	}

	stream.Writable.prototype.end.call(self, data, encoding, cb)
}

ClientRequest.prototype.flushHeaders = function () {}
ClientRequest.prototype.setTimeout = function () {}
ClientRequest.prototype.setNoDelay = function () {}
ClientRequest.prototype.setSocketKeepAlive = function () {}

// Taken from http://www.w3.org/TR/XMLHttpRequest/#the-setrequestheader%28%29-method
var unsafeHeaders = [
	'accept-charset',
	'accept-encoding',
	'access-control-request-headers',
	'access-control-request-method',
	'connection',
	'content-length',
	'cookie',
	'cookie2',
	'date',
	'dnt',
	'expect',
	'host',
	'keep-alive',
	'origin',
	'referer',
	'te',
	'trailer',
	'transfer-encoding',
	'upgrade',
	'user-agent',
	'via'
]

}).call(this,require('_process'),typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer)
},{"./capability":51,"./response":53,"_process":31,"buffer":22,"foreach":55,"indexof":56,"inherits":28,"object-keys":57,"stream":49}],53:[function(require,module,exports){
(function (process,global,Buffer){
var capability = require('./capability')
var foreach = require('foreach')
var inherits = require('inherits')
var stream = require('stream')

var rStates = exports.readyStates = {
	UNSENT: 0,
	OPENED: 1,
	HEADERS_RECEIVED: 2,
	LOADING: 3,
	DONE: 4
}

var IncomingMessage = exports.IncomingMessage = function (xhr, response, mode) {
	var self = this
	stream.Readable.call(self)

	self._mode = mode
	self.headers = {}
	self.rawHeaders = []
	self.trailers = {}
	self.rawTrailers = []

	// Fake the 'close' event, but only once 'end' fires
	self.on('end', function () {
		// The nextTick is necessary to prevent the 'request' module from causing an infinite loop
		process.nextTick(function () {
			self.emit('close')
		})
	})

	if (mode === 'fetch') {
		self._fetchResponse = response

		self.statusCode = response.status
		self.statusMessage = response.statusText
		// backwards compatible version of for (<item> of <iterable>):
		// for (var <item>,_i,_it = <iterable>[Symbol.iterator](); <item> = (_i = _it.next()).value,!_i.done;)
		for (var header, _i, _it = response.headers[Symbol.iterator](); header = (_i = _it.next()).value, !_i.done;) {
			self.headers[header[0].toLowerCase()] = header[1]
			self.rawHeaders.push(header[0], header[1])
		}

		// TODO: this doesn't respect backpressure. Once WritableStream is available, this can be fixed
		var reader = response.body.getReader()
		function read () {
			reader.read().then(function (result) {
				if (self._destroyed)
					return
				if (result.done) {
					self.push(null)
					return
				}
				self.push(new Buffer(result.value))
				read()
			})
		}
		read()

	} else {
		self._xhr = xhr
		self._pos = 0

		self.statusCode = xhr.status
		self.statusMessage = xhr.statusText
		var headers = xhr.getAllResponseHeaders().split(/\r?\n/)
		foreach(headers, function (header) {
			var matches = header.match(/^([^:]+):\s*(.*)/)
			if (matches) {
				var key = matches[1].toLowerCase()
				if (self.headers[key] !== undefined)
					self.headers[key] += ', ' + matches[2]
				else
					self.headers[key] = matches[2]
				self.rawHeaders.push(matches[1], matches[2])
			}
		})

		self._charset = 'x-user-defined'
		if (!capability.overrideMimeType) {
			var mimeType = self.rawHeaders['mime-type']
			if (mimeType) {
				var charsetMatch = mimeType.match(/;\s*charset=([^;])(;|$)/)
				if (charsetMatch) {
					self._charset = charsetMatch[1].toLowerCase()
				}
			}
			if (!self._charset)
				self._charset = 'utf-8' // best guess
		}
	}
}

inherits(IncomingMessage, stream.Readable)

IncomingMessage.prototype._read = function () {}

IncomingMessage.prototype._onXHRProgress = function () {
	var self = this

	var xhr = self._xhr

	var response = null
	switch (self._mode) {
		case 'text:vbarray': // For IE9
			if (xhr.readyState !== rStates.DONE)
				break
			try {
				// This fails in IE8
				response = new global.VBArray(xhr.responseBody).toArray()
			} catch (e) {}
			if (response !== null) {
				self.push(new Buffer(response))
				break
			}
			// Falls through in IE8	
		case 'text':
			try { // This will fail when readyState = 3 in IE9. Switch mode and wait for readyState = 4
				response = xhr.responseText
			} catch (e) {
				self._mode = 'text:vbarray'
				break
			}
			if (response.length > self._pos) {
				var newData = response.substr(self._pos)
				if (self._charset === 'x-user-defined') {
					var buffer = new Buffer(newData.length)
					for (var i = 0; i < newData.length; i++)
						buffer[i] = newData.charCodeAt(i) & 0xff

					self.push(buffer)
				} else {
					self.push(newData, self._charset)
				}
				self._pos = response.length
			}
			break
		case 'arraybuffer':
			if (xhr.readyState !== rStates.DONE)
				break
			response = xhr.response
			self.push(new Buffer(new Uint8Array(response)))
			break
		case 'moz-chunked-arraybuffer': // take whole
			response = xhr.response
			if (xhr.readyState !== rStates.LOADING || !response)
				break
			self.push(new Buffer(new Uint8Array(response)))
			break
		case 'ms-stream':
			response = xhr.response
			if (xhr.readyState !== rStates.LOADING)
				break
			var reader = new global.MSStreamReader()
			reader.onprogress = function () {
				if (reader.result.byteLength > self._pos) {
					self.push(new Buffer(new Uint8Array(reader.result.slice(self._pos))))
					self._pos = reader.result.byteLength
				}
			}
			reader.onload = function () {
				self.push(null)
			}
			// reader.onerror = ??? // TODO: this
			reader.readAsArrayBuffer(response)
			break
	}

	// The ms-stream case handles end separately in reader.onload()
	if (self._xhr.readyState === rStates.DONE && self._mode !== 'ms-stream') {
		self.push(null)
	}
}

}).call(this,require('_process'),typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer)
},{"./capability":51,"_process":31,"buffer":22,"foreach":55,"inherits":28,"stream":49}],54:[function(require,module,exports){
module.exports = {
  "100": "Continue",
  "101": "Switching Protocols",
  "102": "Processing",
  "200": "OK",
  "201": "Created",
  "202": "Accepted",
  "203": "Non-Authoritative Information",
  "204": "No Content",
  "205": "Reset Content",
  "206": "Partial Content",
  "207": "Multi-Status",
  "300": "Multiple Choices",
  "301": "Moved Permanently",
  "302": "Moved Temporarily",
  "303": "See Other",
  "304": "Not Modified",
  "305": "Use Proxy",
  "307": "Temporary Redirect",
  "308": "Permanent Redirect",
  "400": "Bad Request",
  "401": "Unauthorized",
  "402": "Payment Required",
  "403": "Forbidden",
  "404": "Not Found",
  "405": "Method Not Allowed",
  "406": "Not Acceptable",
  "407": "Proxy Authentication Required",
  "408": "Request Time-out",
  "409": "Conflict",
  "410": "Gone",
  "411": "Length Required",
  "412": "Precondition Failed",
  "413": "Request Entity Too Large",
  "414": "Request-URI Too Large",
  "415": "Unsupported Media Type",
  "416": "Requested Range Not Satisfiable",
  "417": "Expectation Failed",
  "418": "I'm a teapot",
  "422": "Unprocessable Entity",
  "423": "Locked",
  "424": "Failed Dependency",
  "425": "Unordered Collection",
  "426": "Upgrade Required",
  "428": "Precondition Required",
  "429": "Too Many Requests",
  "431": "Request Header Fields Too Large",
  "500": "Internal Server Error",
  "501": "Not Implemented",
  "502": "Bad Gateway",
  "503": "Service Unavailable",
  "504": "Gateway Time-out",
  "505": "HTTP Version Not Supported",
  "506": "Variant Also Negotiates",
  "507": "Insufficient Storage",
  "509": "Bandwidth Limit Exceeded",
  "510": "Not Extended",
  "511": "Network Authentication Required"
}

},{}],55:[function(require,module,exports){

var hasOwn = Object.prototype.hasOwnProperty;
var toString = Object.prototype.toString;

module.exports = function forEach (obj, fn, ctx) {
    if (toString.call(fn) !== '[object Function]') {
        throw new TypeError('iterator must be a function');
    }
    var l = obj.length;
    if (l === +l) {
        for (var i = 0; i < l; i++) {
            fn.call(ctx, obj[i], i, obj);
        }
    } else {
        for (var k in obj) {
            if (hasOwn.call(obj, k)) {
                fn.call(ctx, obj[k], k, obj);
            }
        }
    }
};


},{}],56:[function(require,module,exports){

var indexOf = [].indexOf;

module.exports = function(arr, obj){
  if (indexOf) return arr.indexOf(obj);
  for (var i = 0; i < arr.length; ++i) {
    if (arr[i] === obj) return i;
  }
  return -1;
};
},{}],57:[function(require,module,exports){
'use strict';

// modified from https://github.com/es-shims/es5-shim
var has = Object.prototype.hasOwnProperty;
var toStr = Object.prototype.toString;
var slice = Array.prototype.slice;
var isArgs = require('./isArguments');
var hasDontEnumBug = !({ toString: null }).propertyIsEnumerable('toString');
var hasProtoEnumBug = function () {}.propertyIsEnumerable('prototype');
var dontEnums = [
	'toString',
	'toLocaleString',
	'valueOf',
	'hasOwnProperty',
	'isPrototypeOf',
	'propertyIsEnumerable',
	'constructor'
];
var equalsConstructorPrototype = function (o) {
	var ctor = o.constructor;
	return ctor && ctor.prototype === o;
};
var blacklistedKeys = {
	$console: true,
	$frame: true,
	$frameElement: true,
	$frames: true,
	$parent: true,
	$self: true,
	$webkitIndexedDB: true,
	$webkitStorageInfo: true,
	$window: true
};
var hasAutomationEqualityBug = (function () {
	/* global window */
	if (typeof window === 'undefined') { return false; }
	for (var k in window) {
		try {
			if (!blacklistedKeys['$' + k] && has.call(window, k) && window[k] !== null && typeof window[k] === 'object') {
				try {
					equalsConstructorPrototype(window[k]);
				} catch (e) {
					return true;
				}
			}
		} catch (e) {
			return true;
		}
	}
	return false;
}());
var equalsConstructorPrototypeIfNotBuggy = function (o) {
	/* global window */
	if (typeof window === 'undefined' || !hasAutomationEqualityBug) {
		return equalsConstructorPrototype(o);
	}
	try {
		return equalsConstructorPrototype(o);
	} catch (e) {
		return false;
	}
};

var keysShim = function keys(object) {
	var isObject = object !== null && typeof object === 'object';
	var isFunction = toStr.call(object) === '[object Function]';
	var isArguments = isArgs(object);
	var isString = isObject && toStr.call(object) === '[object String]';
	var theKeys = [];

	if (!isObject && !isFunction && !isArguments) {
		throw new TypeError('Object.keys called on a non-object');
	}

	var skipProto = hasProtoEnumBug && isFunction;
	if (isString && object.length > 0 && !has.call(object, 0)) {
		for (var i = 0; i < object.length; ++i) {
			theKeys.push(String(i));
		}
	}

	if (isArguments && object.length > 0) {
		for (var j = 0; j < object.length; ++j) {
			theKeys.push(String(j));
		}
	} else {
		for (var name in object) {
			if (!(skipProto && name === 'prototype') && has.call(object, name)) {
				theKeys.push(String(name));
			}
		}
	}

	if (hasDontEnumBug) {
		var skipConstructor = equalsConstructorPrototypeIfNotBuggy(object);

		for (var k = 0; k < dontEnums.length; ++k) {
			if (!(skipConstructor && dontEnums[k] === 'constructor') && has.call(object, dontEnums[k])) {
				theKeys.push(dontEnums[k]);
			}
		}
	}
	return theKeys;
};

keysShim.shim = function shimObjectKeys() {
	if (Object.keys) {
		var keysWorksWithArguments = (function () {
			// Safari 5.0 bug
			return (Object.keys(arguments) || '').length === 2;
		}(1, 2));
		if (!keysWorksWithArguments) {
			var originalKeys = Object.keys;
			Object.keys = function keys(object) {
				if (isArgs(object)) {
					return originalKeys(slice.call(object));
				} else {
					return originalKeys(object);
				}
			};
		}
	} else {
		Object.keys = keysShim;
	}
	return Object.keys || keysShim;
};

module.exports = keysShim;

},{"./isArguments":58}],58:[function(require,module,exports){
'use strict';

var toStr = Object.prototype.toString;

module.exports = function isArguments(value) {
	var str = toStr.call(value);
	var isArgs = str === '[object Arguments]';
	if (!isArgs) {
		isArgs = str !== '[object Array]' &&
			value !== null &&
			typeof value === 'object' &&
			typeof value.length === 'number' &&
			value.length >= 0 &&
			toStr.call(value.callee) === '[object Function]';
	}
	return isArgs;
};

},{}],59:[function(require,module,exports){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

var Buffer = require('buffer').Buffer;

var isBufferEncoding = Buffer.isEncoding
  || function(encoding) {
       switch (encoding && encoding.toLowerCase()) {
         case 'hex': case 'utf8': case 'utf-8': case 'ascii': case 'binary': case 'base64': case 'ucs2': case 'ucs-2': case 'utf16le': case 'utf-16le': case 'raw': return true;
         default: return false;
       }
     }


function assertEncoding(encoding) {
  if (encoding && !isBufferEncoding(encoding)) {
    throw new Error('Unknown encoding: ' + encoding);
  }
}

// StringDecoder provides an interface for efficiently splitting a series of
// buffers into a series of JS strings without breaking apart multi-byte
// characters. CESU-8 is handled as part of the UTF-8 encoding.
//
// @TODO Handling all encodings inside a single object makes it very difficult
// to reason about this code, so it should be split up in the future.
// @TODO There should be a utf8-strict encoding that rejects invalid UTF-8 code
// points as used by CESU-8.
var StringDecoder = exports.StringDecoder = function(encoding) {
  this.encoding = (encoding || 'utf8').toLowerCase().replace(/[-_]/, '');
  assertEncoding(encoding);
  switch (this.encoding) {
    case 'utf8':
      // CESU-8 represents each of Surrogate Pair by 3-bytes
      this.surrogateSize = 3;
      break;
    case 'ucs2':
    case 'utf16le':
      // UTF-16 represents each of Surrogate Pair by 2-bytes
      this.surrogateSize = 2;
      this.detectIncompleteChar = utf16DetectIncompleteChar;
      break;
    case 'base64':
      // Base-64 stores 3 bytes in 4 chars, and pads the remainder.
      this.surrogateSize = 3;
      this.detectIncompleteChar = base64DetectIncompleteChar;
      break;
    default:
      this.write = passThroughWrite;
      return;
  }

  // Enough space to store all bytes of a single character. UTF-8 needs 4
  // bytes, but CESU-8 may require up to 6 (3 bytes per surrogate).
  this.charBuffer = new Buffer(6);
  // Number of bytes received for the current incomplete multi-byte character.
  this.charReceived = 0;
  // Number of bytes expected for the current incomplete multi-byte character.
  this.charLength = 0;
};


// write decodes the given buffer and returns it as JS string that is
// guaranteed to not contain any partial multi-byte characters. Any partial
// character found at the end of the buffer is buffered up, and will be
// returned when calling write again with the remaining bytes.
//
// Note: Converting a Buffer containing an orphan surrogate to a String
// currently works, but converting a String to a Buffer (via `new Buffer`, or
// Buffer#write) will replace incomplete surrogates with the unicode
// replacement character. See https://codereview.chromium.org/121173009/ .
StringDecoder.prototype.write = function(buffer) {
  var charStr = '';
  // if our last write ended with an incomplete multibyte character
  while (this.charLength) {
    // determine how many remaining bytes this buffer has to offer for this char
    var available = (buffer.length >= this.charLength - this.charReceived) ?
        this.charLength - this.charReceived :
        buffer.length;

    // add the new bytes to the char buffer
    buffer.copy(this.charBuffer, this.charReceived, 0, available);
    this.charReceived += available;

    if (this.charReceived < this.charLength) {
      // still not enough chars in this buffer? wait for more ...
      return '';
    }

    // remove bytes belonging to the current character from the buffer
    buffer = buffer.slice(available, buffer.length);

    // get the character that was split
    charStr = this.charBuffer.slice(0, this.charLength).toString(this.encoding);

    // CESU-8: lead surrogate (D800-DBFF) is also the incomplete character
    var charCode = charStr.charCodeAt(charStr.length - 1);
    if (charCode >= 0xD800 && charCode <= 0xDBFF) {
      this.charLength += this.surrogateSize;
      charStr = '';
      continue;
    }
    this.charReceived = this.charLength = 0;

    // if there are no more bytes in this buffer, just emit our char
    if (buffer.length === 0) {
      return charStr;
    }
    break;
  }

  // determine and set charLength / charReceived
  this.detectIncompleteChar(buffer);

  var end = buffer.length;
  if (this.charLength) {
    // buffer the incomplete character bytes we got
    buffer.copy(this.charBuffer, 0, buffer.length - this.charReceived, end);
    end -= this.charReceived;
  }

  charStr += buffer.toString(this.encoding, 0, end);

  var end = charStr.length - 1;
  var charCode = charStr.charCodeAt(end);
  // CESU-8: lead surrogate (D800-DBFF) is also the incomplete character
  if (charCode >= 0xD800 && charCode <= 0xDBFF) {
    var size = this.surrogateSize;
    this.charLength += size;
    this.charReceived += size;
    this.charBuffer.copy(this.charBuffer, size, 0, size);
    buffer.copy(this.charBuffer, 0, 0, size);
    return charStr.substring(0, end);
  }

  // or just emit the charStr
  return charStr;
};

// detectIncompleteChar determines if there is an incomplete UTF-8 character at
// the end of the given buffer. If so, it sets this.charLength to the byte
// length that character, and sets this.charReceived to the number of bytes
// that are available for this character.
StringDecoder.prototype.detectIncompleteChar = function(buffer) {
  // determine how many bytes we have to check at the end of this buffer
  var i = (buffer.length >= 3) ? 3 : buffer.length;

  // Figure out if one of the last i bytes of our buffer announces an
  // incomplete char.
  for (; i > 0; i--) {
    var c = buffer[buffer.length - i];

    // See http://en.wikipedia.org/wiki/UTF-8#Description

    // 110XXXXX
    if (i == 1 && c >> 5 == 0x06) {
      this.charLength = 2;
      break;
    }

    // 1110XXXX
    if (i <= 2 && c >> 4 == 0x0E) {
      this.charLength = 3;
      break;
    }

    // 11110XXX
    if (i <= 3 && c >> 3 == 0x1E) {
      this.charLength = 4;
      break;
    }
  }
  this.charReceived = i;
};

StringDecoder.prototype.end = function(buffer) {
  var res = '';
  if (buffer && buffer.length)
    res = this.write(buffer);

  if (this.charReceived) {
    var cr = this.charReceived;
    var buf = this.charBuffer;
    var enc = this.encoding;
    res += buf.slice(0, cr).toString(enc);
  }

  return res;
};

function passThroughWrite(buffer) {
  return buffer.toString(this.encoding);
}

function utf16DetectIncompleteChar(buffer) {
  this.charReceived = buffer.length % 2;
  this.charLength = this.charReceived ? 2 : 0;
}

function base64DetectIncompleteChar(buffer) {
  this.charReceived = buffer.length % 3;
  this.charLength = this.charReceived ? 3 : 0;
}

},{"buffer":22}],60:[function(require,module,exports){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

var punycode = require('punycode');

exports.parse = urlParse;
exports.resolve = urlResolve;
exports.resolveObject = urlResolveObject;
exports.format = urlFormat;

exports.Url = Url;

function Url() {
  this.protocol = null;
  this.slashes = null;
  this.auth = null;
  this.host = null;
  this.port = null;
  this.hostname = null;
  this.hash = null;
  this.search = null;
  this.query = null;
  this.pathname = null;
  this.path = null;
  this.href = null;
}

// Reference: RFC 3986, RFC 1808, RFC 2396

// define these here so at least they only have to be
// compiled once on the first module load.
var protocolPattern = /^([a-z0-9.+-]+:)/i,
    portPattern = /:[0-9]*$/,

    // RFC 2396: characters reserved for delimiting URLs.
    // We actually just auto-escape these.
    delims = ['<', '>', '"', '`', ' ', '\r', '\n', '\t'],

    // RFC 2396: characters not allowed for various reasons.
    unwise = ['{', '}', '|', '\\', '^', '`'].concat(delims),

    // Allowed by RFCs, but cause of XSS attacks.  Always escape these.
    autoEscape = ['\''].concat(unwise),
    // Characters that are never ever allowed in a hostname.
    // Note that any invalid chars are also handled, but these
    // are the ones that are *expected* to be seen, so we fast-path
    // them.
    nonHostChars = ['%', '/', '?', ';', '#'].concat(autoEscape),
    hostEndingChars = ['/', '?', '#'],
    hostnameMaxLen = 255,
    hostnamePartPattern = /^[a-z0-9A-Z_-]{0,63}$/,
    hostnamePartStart = /^([a-z0-9A-Z_-]{0,63})(.*)$/,
    // protocols that can allow "unsafe" and "unwise" chars.
    unsafeProtocol = {
      'javascript': true,
      'javascript:': true
    },
    // protocols that never have a hostname.
    hostlessProtocol = {
      'javascript': true,
      'javascript:': true
    },
    // protocols that always contain a // bit.
    slashedProtocol = {
      'http': true,
      'https': true,
      'ftp': true,
      'gopher': true,
      'file': true,
      'http:': true,
      'https:': true,
      'ftp:': true,
      'gopher:': true,
      'file:': true
    },
    querystring = require('querystring');

function urlParse(url, parseQueryString, slashesDenoteHost) {
  if (url && isObject(url) && url instanceof Url) return url;

  var u = new Url;
  u.parse(url, parseQueryString, slashesDenoteHost);
  return u;
}

Url.prototype.parse = function(url, parseQueryString, slashesDenoteHost) {
  if (!isString(url)) {
    throw new TypeError("Parameter 'url' must be a string, not " + typeof url);
  }

  var rest = url;

  // trim before proceeding.
  // This is to support parse stuff like "  http://foo.com  \n"
  rest = rest.trim();

  var proto = protocolPattern.exec(rest);
  if (proto) {
    proto = proto[0];
    var lowerProto = proto.toLowerCase();
    this.protocol = lowerProto;
    rest = rest.substr(proto.length);
  }

  // figure out if it's got a host
  // user@server is *always* interpreted as a hostname, and url
  // resolution will treat //foo/bar as host=foo,path=bar because that's
  // how the browser resolves relative URLs.
  if (slashesDenoteHost || proto || rest.match(/^\/\/[^@\/]+@[^@\/]+/)) {
    var slashes = rest.substr(0, 2) === '//';
    if (slashes && !(proto && hostlessProtocol[proto])) {
      rest = rest.substr(2);
      this.slashes = true;
    }
  }

  if (!hostlessProtocol[proto] &&
      (slashes || (proto && !slashedProtocol[proto]))) {

    // there's a hostname.
    // the first instance of /, ?, ;, or # ends the host.
    //
    // If there is an @ in the hostname, then non-host chars *are* allowed
    // to the left of the last @ sign, unless some host-ending character
    // comes *before* the @-sign.
    // URLs are obnoxious.
    //
    // ex:
    // http://a@b@c/ => user:a@b host:c
    // http://a@b?@c => user:a host:c path:/?@c

    // v0.12 TODO(isaacs): This is not quite how Chrome does things.
    // Review our test case against browsers more comprehensively.

    // find the first instance of any hostEndingChars
    var hostEnd = -1;
    for (var i = 0; i < hostEndingChars.length; i++) {
      var hec = rest.indexOf(hostEndingChars[i]);
      if (hec !== -1 && (hostEnd === -1 || hec < hostEnd))
        hostEnd = hec;
    }

    // at this point, either we have an explicit point where the
    // auth portion cannot go past, or the last @ char is the decider.
    var auth, atSign;
    if (hostEnd === -1) {
      // atSign can be anywhere.
      atSign = rest.lastIndexOf('@');
    } else {
      // atSign must be in auth portion.
      // http://a@b/c@d => host:b auth:a path:/c@d
      atSign = rest.lastIndexOf('@', hostEnd);
    }

    // Now we have a portion which is definitely the auth.
    // Pull that off.
    if (atSign !== -1) {
      auth = rest.slice(0, atSign);
      rest = rest.slice(atSign + 1);
      this.auth = decodeURIComponent(auth);
    }

    // the host is the remaining to the left of the first non-host char
    hostEnd = -1;
    for (var i = 0; i < nonHostChars.length; i++) {
      var hec = rest.indexOf(nonHostChars[i]);
      if (hec !== -1 && (hostEnd === -1 || hec < hostEnd))
        hostEnd = hec;
    }
    // if we still have not hit it, then the entire thing is a host.
    if (hostEnd === -1)
      hostEnd = rest.length;

    this.host = rest.slice(0, hostEnd);
    rest = rest.slice(hostEnd);

    // pull out port.
    this.parseHost();

    // we've indicated that there is a hostname,
    // so even if it's empty, it has to be present.
    this.hostname = this.hostname || '';

    // if hostname begins with [ and ends with ]
    // assume that it's an IPv6 address.
    var ipv6Hostname = this.hostname[0] === '[' &&
        this.hostname[this.hostname.length - 1] === ']';

    // validate a little.
    if (!ipv6Hostname) {
      var hostparts = this.hostname.split(/\./);
      for (var i = 0, l = hostparts.length; i < l; i++) {
        var part = hostparts[i];
        if (!part) continue;
        if (!part.match(hostnamePartPattern)) {
          var newpart = '';
          for (var j = 0, k = part.length; j < k; j++) {
            if (part.charCodeAt(j) > 127) {
              // we replace non-ASCII char with a temporary placeholder
              // we need this to make sure size of hostname is not
              // broken by replacing non-ASCII by nothing
              newpart += 'x';
            } else {
              newpart += part[j];
            }
          }
          // we test again with ASCII char only
          if (!newpart.match(hostnamePartPattern)) {
            var validParts = hostparts.slice(0, i);
            var notHost = hostparts.slice(i + 1);
            var bit = part.match(hostnamePartStart);
            if (bit) {
              validParts.push(bit[1]);
              notHost.unshift(bit[2]);
            }
            if (notHost.length) {
              rest = '/' + notHost.join('.') + rest;
            }
            this.hostname = validParts.join('.');
            break;
          }
        }
      }
    }

    if (this.hostname.length > hostnameMaxLen) {
      this.hostname = '';
    } else {
      // hostnames are always lower case.
      this.hostname = this.hostname.toLowerCase();
    }

    if (!ipv6Hostname) {
      // IDNA Support: Returns a puny coded representation of "domain".
      // It only converts the part of the domain name that
      // has non ASCII characters. I.e. it dosent matter if
      // you call it with a domain that already is in ASCII.
      var domainArray = this.hostname.split('.');
      var newOut = [];
      for (var i = 0; i < domainArray.length; ++i) {
        var s = domainArray[i];
        newOut.push(s.match(/[^A-Za-z0-9_-]/) ?
            'xn--' + punycode.encode(s) : s);
      }
      this.hostname = newOut.join('.');
    }

    var p = this.port ? ':' + this.port : '';
    var h = this.hostname || '';
    this.host = h + p;
    this.href += this.host;

    // strip [ and ] from the hostname
    // the host field still retains them, though
    if (ipv6Hostname) {
      this.hostname = this.hostname.substr(1, this.hostname.length - 2);
      if (rest[0] !== '/') {
        rest = '/' + rest;
      }
    }
  }

  // now rest is set to the post-host stuff.
  // chop off any delim chars.
  if (!unsafeProtocol[lowerProto]) {

    // First, make 100% sure that any "autoEscape" chars get
    // escaped, even if encodeURIComponent doesn't think they
    // need to be.
    for (var i = 0, l = autoEscape.length; i < l; i++) {
      var ae = autoEscape[i];
      var esc = encodeURIComponent(ae);
      if (esc === ae) {
        esc = escape(ae);
      }
      rest = rest.split(ae).join(esc);
    }
  }


  // chop off from the tail first.
  var hash = rest.indexOf('#');
  if (hash !== -1) {
    // got a fragment string.
    this.hash = rest.substr(hash);
    rest = rest.slice(0, hash);
  }
  var qm = rest.indexOf('?');
  if (qm !== -1) {
    this.search = rest.substr(qm);
    this.query = rest.substr(qm + 1);
    if (parseQueryString) {
      this.query = querystring.parse(this.query);
    }
    rest = rest.slice(0, qm);
  } else if (parseQueryString) {
    // no query string, but parseQueryString still requested
    this.search = '';
    this.query = {};
  }
  if (rest) this.pathname = rest;
  if (slashedProtocol[lowerProto] &&
      this.hostname && !this.pathname) {
    this.pathname = '/';
  }

  //to support http.request
  if (this.pathname || this.search) {
    var p = this.pathname || '';
    var s = this.search || '';
    this.path = p + s;
  }

  // finally, reconstruct the href based on what has been validated.
  this.href = this.format();
  return this;
};

// format a parsed object into a url string
function urlFormat(obj) {
  // ensure it's an object, and not a string url.
  // If it's an obj, this is a no-op.
  // this way, you can call url_format() on strings
  // to clean up potentially wonky urls.
  if (isString(obj)) obj = urlParse(obj);
  if (!(obj instanceof Url)) return Url.prototype.format.call(obj);
  return obj.format();
}

Url.prototype.format = function() {
  var auth = this.auth || '';
  if (auth) {
    auth = encodeURIComponent(auth);
    auth = auth.replace(/%3A/i, ':');
    auth += '@';
  }

  var protocol = this.protocol || '',
      pathname = this.pathname || '',
      hash = this.hash || '',
      host = false,
      query = '';

  if (this.host) {
    host = auth + this.host;
  } else if (this.hostname) {
    host = auth + (this.hostname.indexOf(':') === -1 ?
        this.hostname :
        '[' + this.hostname + ']');
    if (this.port) {
      host += ':' + this.port;
    }
  }

  if (this.query &&
      isObject(this.query) &&
      Object.keys(this.query).length) {
    query = querystring.stringify(this.query);
  }

  var search = this.search || (query && ('?' + query)) || '';

  if (protocol && protocol.substr(-1) !== ':') protocol += ':';

  // only the slashedProtocols get the //.  Not mailto:, xmpp:, etc.
  // unless they had them to begin with.
  if (this.slashes ||
      (!protocol || slashedProtocol[protocol]) && host !== false) {
    host = '//' + (host || '');
    if (pathname && pathname.charAt(0) !== '/') pathname = '/' + pathname;
  } else if (!host) {
    host = '';
  }

  if (hash && hash.charAt(0) !== '#') hash = '#' + hash;
  if (search && search.charAt(0) !== '?') search = '?' + search;

  pathname = pathname.replace(/[?#]/g, function(match) {
    return encodeURIComponent(match);
  });
  search = search.replace('#', '%23');

  return protocol + host + pathname + search + hash;
};

function urlResolve(source, relative) {
  return urlParse(source, false, true).resolve(relative);
}

Url.prototype.resolve = function(relative) {
  return this.resolveObject(urlParse(relative, false, true)).format();
};

function urlResolveObject(source, relative) {
  if (!source) return relative;
  return urlParse(source, false, true).resolveObject(relative);
}

Url.prototype.resolveObject = function(relative) {
  if (isString(relative)) {
    var rel = new Url();
    rel.parse(relative, false, true);
    relative = rel;
  }

  var result = new Url();
  Object.keys(this).forEach(function(k) {
    result[k] = this[k];
  }, this);

  // hash is always overridden, no matter what.
  // even href="" will remove it.
  result.hash = relative.hash;

  // if the relative url is empty, then there's nothing left to do here.
  if (relative.href === '') {
    result.href = result.format();
    return result;
  }

  // hrefs like //foo/bar always cut to the protocol.
  if (relative.slashes && !relative.protocol) {
    // take everything except the protocol from relative
    Object.keys(relative).forEach(function(k) {
      if (k !== 'protocol')
        result[k] = relative[k];
    });

    //urlParse appends trailing / to urls like http://www.example.com
    if (slashedProtocol[result.protocol] &&
        result.hostname && !result.pathname) {
      result.path = result.pathname = '/';
    }

    result.href = result.format();
    return result;
  }

  if (relative.protocol && relative.protocol !== result.protocol) {
    // if it's a known url protocol, then changing
    // the protocol does weird things
    // first, if it's not file:, then we MUST have a host,
    // and if there was a path
    // to begin with, then we MUST have a path.
    // if it is file:, then the host is dropped,
    // because that's known to be hostless.
    // anything else is assumed to be absolute.
    if (!slashedProtocol[relative.protocol]) {
      Object.keys(relative).forEach(function(k) {
        result[k] = relative[k];
      });
      result.href = result.format();
      return result;
    }

    result.protocol = relative.protocol;
    if (!relative.host && !hostlessProtocol[relative.protocol]) {
      var relPath = (relative.pathname || '').split('/');
      while (relPath.length && !(relative.host = relPath.shift()));
      if (!relative.host) relative.host = '';
      if (!relative.hostname) relative.hostname = '';
      if (relPath[0] !== '') relPath.unshift('');
      if (relPath.length < 2) relPath.unshift('');
      result.pathname = relPath.join('/');
    } else {
      result.pathname = relative.pathname;
    }
    result.search = relative.search;
    result.query = relative.query;
    result.host = relative.host || '';
    result.auth = relative.auth;
    result.hostname = relative.hostname || relative.host;
    result.port = relative.port;
    // to support http.request
    if (result.pathname || result.search) {
      var p = result.pathname || '';
      var s = result.search || '';
      result.path = p + s;
    }
    result.slashes = result.slashes || relative.slashes;
    result.href = result.format();
    return result;
  }

  var isSourceAbs = (result.pathname && result.pathname.charAt(0) === '/'),
      isRelAbs = (
          relative.host ||
          relative.pathname && relative.pathname.charAt(0) === '/'
      ),
      mustEndAbs = (isRelAbs || isSourceAbs ||
                    (result.host && relative.pathname)),
      removeAllDots = mustEndAbs,
      srcPath = result.pathname && result.pathname.split('/') || [],
      relPath = relative.pathname && relative.pathname.split('/') || [],
      psychotic = result.protocol && !slashedProtocol[result.protocol];

  // if the url is a non-slashed url, then relative
  // links like ../.. should be able
  // to crawl up to the hostname, as well.  This is strange.
  // result.protocol has already been set by now.
  // Later on, put the first path part into the host field.
  if (psychotic) {
    result.hostname = '';
    result.port = null;
    if (result.host) {
      if (srcPath[0] === '') srcPath[0] = result.host;
      else srcPath.unshift(result.host);
    }
    result.host = '';
    if (relative.protocol) {
      relative.hostname = null;
      relative.port = null;
      if (relative.host) {
        if (relPath[0] === '') relPath[0] = relative.host;
        else relPath.unshift(relative.host);
      }
      relative.host = null;
    }
    mustEndAbs = mustEndAbs && (relPath[0] === '' || srcPath[0] === '');
  }

  if (isRelAbs) {
    // it's absolute.
    result.host = (relative.host || relative.host === '') ?
                  relative.host : result.host;
    result.hostname = (relative.hostname || relative.hostname === '') ?
                      relative.hostname : result.hostname;
    result.search = relative.search;
    result.query = relative.query;
    srcPath = relPath;
    // fall through to the dot-handling below.
  } else if (relPath.length) {
    // it's relative
    // throw away the existing file, and take the new path instead.
    if (!srcPath) srcPath = [];
    srcPath.pop();
    srcPath = srcPath.concat(relPath);
    result.search = relative.search;
    result.query = relative.query;
  } else if (!isNullOrUndefined(relative.search)) {
    // just pull out the search.
    // like href='?foo'.
    // Put this after the other two cases because it simplifies the booleans
    if (psychotic) {
      result.hostname = result.host = srcPath.shift();
      //occationaly the auth can get stuck only in host
      //this especialy happens in cases like
      //url.resolveObject('mailto:local1@domain1', 'local2@domain2')
      var authInHost = result.host && result.host.indexOf('@') > 0 ?
                       result.host.split('@') : false;
      if (authInHost) {
        result.auth = authInHost.shift();
        result.host = result.hostname = authInHost.shift();
      }
    }
    result.search = relative.search;
    result.query = relative.query;
    //to support http.request
    if (!isNull(result.pathname) || !isNull(result.search)) {
      result.path = (result.pathname ? result.pathname : '') +
                    (result.search ? result.search : '');
    }
    result.href = result.format();
    return result;
  }

  if (!srcPath.length) {
    // no path at all.  easy.
    // we've already handled the other stuff above.
    result.pathname = null;
    //to support http.request
    if (result.search) {
      result.path = '/' + result.search;
    } else {
      result.path = null;
    }
    result.href = result.format();
    return result;
  }

  // if a url ENDs in . or .., then it must get a trailing slash.
  // however, if it ends in anything else non-slashy,
  // then it must NOT get a trailing slash.
  var last = srcPath.slice(-1)[0];
  var hasTrailingSlash = (
      (result.host || relative.host) && (last === '.' || last === '..') ||
      last === '');

  // strip single dots, resolve double dots to parent dir
  // if the path tries to go above the root, `up` ends up > 0
  var up = 0;
  for (var i = srcPath.length; i >= 0; i--) {
    last = srcPath[i];
    if (last == '.') {
      srcPath.splice(i, 1);
    } else if (last === '..') {
      srcPath.splice(i, 1);
      up++;
    } else if (up) {
      srcPath.splice(i, 1);
      up--;
    }
  }

  // if the path is allowed to go above the root, restore leading ..s
  if (!mustEndAbs && !removeAllDots) {
    for (; up--; up) {
      srcPath.unshift('..');
    }
  }

  if (mustEndAbs && srcPath[0] !== '' &&
      (!srcPath[0] || srcPath[0].charAt(0) !== '/')) {
    srcPath.unshift('');
  }

  if (hasTrailingSlash && (srcPath.join('/').substr(-1) !== '/')) {
    srcPath.push('');
  }

  var isAbsolute = srcPath[0] === '' ||
      (srcPath[0] && srcPath[0].charAt(0) === '/');

  // put the host back
  if (psychotic) {
    result.hostname = result.host = isAbsolute ? '' :
                                    srcPath.length ? srcPath.shift() : '';
    //occationaly the auth can get stuck only in host
    //this especialy happens in cases like
    //url.resolveObject('mailto:local1@domain1', 'local2@domain2')
    var authInHost = result.host && result.host.indexOf('@') > 0 ?
                     result.host.split('@') : false;
    if (authInHost) {
      result.auth = authInHost.shift();
      result.host = result.hostname = authInHost.shift();
    }
  }

  mustEndAbs = mustEndAbs || (result.host && srcPath.length);

  if (mustEndAbs && !isAbsolute) {
    srcPath.unshift('');
  }

  if (!srcPath.length) {
    result.pathname = null;
    result.path = null;
  } else {
    result.pathname = srcPath.join('/');
  }

  //to support request.http
  if (!isNull(result.pathname) || !isNull(result.search)) {
    result.path = (result.pathname ? result.pathname : '') +
                  (result.search ? result.search : '');
  }
  result.auth = relative.auth || result.auth;
  result.slashes = result.slashes || relative.slashes;
  result.href = result.format();
  return result;
};

Url.prototype.parseHost = function() {
  var host = this.host;
  var port = portPattern.exec(host);
  if (port) {
    port = port[0];
    if (port !== ':') {
      this.port = port.substr(1);
    }
    host = host.substr(0, host.length - port.length);
  }
  if (host) this.hostname = host;
};

function isString(arg) {
  return typeof arg === "string";
}

function isObject(arg) {
  return typeof arg === 'object' && arg !== null;
}

function isNull(arg) {
  return arg === null;
}
function isNullOrUndefined(arg) {
  return  arg == null;
}

},{"punycode":32,"querystring":35}],61:[function(require,module,exports){
module.exports = extend

function extend() {
    var target = {}

    for (var i = 0; i < arguments.length; i++) {
        var source = arguments[i]

        for (var key in source) {
            if (source.hasOwnProperty(key)) {
                target[key] = source[key]
            }
        }
    }

    return target
}

},{}]},{},[17]);
