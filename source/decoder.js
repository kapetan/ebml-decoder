var stream = require('stream');
var util = require('util');
var ebmlVarint = require('ebml-varint');

var ebmlHeader = require('./ebml-header');
var ebmlTypes = require('./ebml-types');
var ebmlPath  = require('./ebml-path');

var EBML_MAX_ID_LENGTH = 4;
var EBML_MAX_SIZE_LENGTH = 8;
var OPTIONS = {};

var createUnknownElement = function(id) {
  var element = {
    name: 'Unknown',
    path: '*((1*\\)\\Unknown)',
    id: ('0x' + id),
    type: 'binary'
  };

  element.encoding = ebmlTypes.binary;
  element.context = ebmlPath(element.path);
  return element;
};

var Decoder = function(options) {
  if(!(this instanceof Decoder)) return new Decoder(options);
  stream.Writable.call(this);

  options = options || {};

  this._offset = 0;
  this._buffer = [];
  this._length = 0;
  this._missing = 0;
  this._ignore = false;
  this._onread = null;
  this._destroyed = false;
  this._totalOffset = 0;
  this._decodeCbs = [];

  var schema = options.schema || [];
  if(options.header !== false) schema = ebmlHeader.concat(schema);

  schema = schema.reduce(function(acc, element) {
    var id = element.id;
    if(typeof id === 'number') id = id.toString(16);
    id = id.toLowerCase().replace(/^0x/, '');

    var context = element.path ?
      ebmlPath(element.path) :
      { level: element.level };

    acc[id] = {
      id: ('0x' + id),
      name: element.name,
      type: element.type,
      context: context,
      encoding: ebmlTypes(element.type)
    };

    return acc;
  }, {});

  var self = this;
  var vintMax = 0;
  var vintCb = null;
  var vintWidth = 0;
  var vintLength = 0;
  var stack = [];
  var definition = null;
  var element = null;
  var dataSize = 0;
  var headerSize = 0;
  var elementOffset = 0;
  var strict = options.strict !== false;
  var maxIDLength = options.maxIDLength || EBML_MAX_ID_LENGTH;
  var maxSizeLength = options.maxSizeLength || EBML_MAX_SIZE_LENGTH;

  this.on('element', function(element) {
    if(!options.maxIDLength && element.id === '0x42f2') {
      this.decode(function(value) {
        maxIDLength = value;
      });
    } else if(!options.maxSizeLength && element.id === '0x42f3') {
      this.decode(function(value) {
        maxSizeLength = value;
      });
    }
  });

  var readvint = function(max, cb) {
    vintMax = max;
    vintCb = cb;
    vintWidth = 1;
    self._readlength(vintWidth, onvintwidth);
  };

  var onvintwidth = function(buffer, offset) {
    var b = buffer[offset + vintWidth - 1];

    if(vintWidth >= vintMax) return self._error('varint length greater than allowed max');
    if(!b) return self._readlength(++vintWidth, onvintwidth);

    vintLength = ebmlVarint.decodingLength(buffer, offset, offset + vintWidth);

    if(vintLength === 1) onvintdata(buffer, offset);
    else self._readlength(vintLength, onvintdata);
  };

  var onvintdata = function(buffer, offset) {
    self._consume(vintLength);
    vintCb(buffer, offset, vintLength);
  };

  var endUnknown = function() {
    var parent = stack[stack.length - 1];

    while(parent && parent.dataSize === -1) {
      if(definition.context.level > parent.definition.context.level ||
        definition.context.variable) return;

      stack.pop();
      parent = stack[stack.length - 1];
    }
  };

  var endElement = function(consumed) {
    var parent = stack[stack.length - 1];

    while(parent && parent.dataSize !== -1) {
      parent.dataSize -= consumed;
      if(parent.dataSize < 0) self._warning('child elements exceeding parent length', strict);
      if(parent.dataSize > 0 || self._destroyed) return;

      stack.pop();
      consumed = parent.totalSize;
      parent = stack[stack.length - 1];
    }
  };

  var createElement = function() {
    var element = {
      id: definition.id,
      size: dataSize,
      type: definition.type,
      name: definition.name,
      position: {
        offset: elementOffset,
        length: dataSize === -1 ? -1 : (headerSize + dataSize)
      },
      path: stack.map(function(i) {
        return i.element;
      })
    };

    element.path.push(element);
    return element;
  };

  var onid = function(buffer, offset, length) {
    var elementId = buffer.toString('hex', offset, offset + length);

    headerSize = length;
    elementOffset = self._totalOffset + offset;
    definition = schema[elementId];

    if(!definition) self._warning('unknown element with id ' + elementId, strict);
    if(!definition) definition = createUnknownElement(elementId);
    if(self._destroyed) return;

    endUnknown();
    readvint(maxSizeLength, onsize);
  };

  var onsize = function(buffer, offset, length) {
    dataSize = ebmlVarint.decode(buffer, offset, offset + length);
    headerSize += length;
    element = createElement();

    if(definition.type === 'master' || dataSize === -1) {
      var stackElement = {
        definition: definition,
        element: element,
        dataSize: dataSize,
        totalSize: headerSize + dataSize
      };

      stack.push(stackElement);
      self.emit('element', element);

      for(var i = 0; i < self._decodeCbs.length; i++) {
        var decodeCb = self._decodeCbs[i];
        if(typeof decodeCb !== 'function') decodeCb = decodeCb[1];
        decodeCb();
      }

      self._decodeCbs = [];
      if(!dataSize) endElement(0);
      readvint(maxIDLength, onid);
    } else {
      self.emit('element', element);
      if(dataSize) self._readlength(dataSize, !self._decodeCbs.length, ondata);
      else ondata(buffer, offset);
    }
  };

  var ondata = function(buffer, offset) {
    self._consume(dataSize);

    for(var i = 0; i < self._decodeCbs.length; i++) {
      var decodeCb = self._decodeCbs[i];
      var decodeOptions = OPTIONS;

      if(typeof decodeCb !== 'function') {
        decodeOptions = decodeCb[0];
        decodeCb = decodeCb[1];
      }

      var value = null;
      var encoding = decodeOptions.type ?
        ebmlTypes(decodeOptions.type) : definition.encoding;

      try {
        value = encoding.decode(buffer, offset, offset + dataSize);
      } catch(err) {
        return self._error(err);
      }

      decodeCb(value);
    }

    self._decodeCbs = [];
    endElement(headerSize + dataSize);
    readvint(maxIDLength, onid);
  };

  readvint(maxIDLength, onid);
};

util.inherits(Decoder, stream.Writable);

Decoder.prototype.decode = function(options, cb) {
  if(!cb) {
    cb = options;
    options = null;
  }

  this._decodeCbs.push(options ? [options, cb] : cb);
};

Decoder.prototype.destroy = function(err) {
  if(this._destroyed) return;
  this._destroyed = true;

  if(err) this.emit('error', err);
  this.emit('close');
};

Decoder.prototype._write = function(data, enc, cb) {
  var offset = this._offset;
  var missing = this._missing;
  var ignore = this._ignore;
  var buffer = this._buffer;
  var previous = this._length;
  var destroyed = this._destroyed;
  var length = this._length + data.length;
  var remaining = length;

  if(length < missing) {
    this._length = length;
    if(!ignore) this._buffer.push(data);
    this._totalOffset += data.length;
    return cb();
  }

  if(ignore) length = data.length;
  else if(buffer.length) {
    buffer.push(data);
    data = Buffer.concat(buffer, length);
  }

  while(missing <= remaining && !destroyed) {
    if(ignore) this._offset = offset += (missing - previous);
    this._onread(data, offset);

    previous = 0;
    offset = this._offset;
    missing = this._missing;
    ignore = this._ignore;
    destroyed = this._destroyed;
    remaining = length - offset;
  }

  this._buffer = remaining && !ignore ? [data.slice(offset)] : [];
  this._length = remaining;
  this._offset = 0;
  this._totalOffset += offset;
  if(!destroyed) cb();
};

Decoder.prototype._consume = function(length) {
  if(!this._ignore) this._offset += length;
};

Decoder.prototype._readlength = function(length, ignore, cb) {
  if(this._destroyed) return;
  if(!cb) {
    cb = ignore;
    ignore = false;
  }

  this._missing = length;
  this._ignore = !!ignore;
  this._onread = cb;
};

Decoder.prototype._error = function(message) {
  var err = util.isError(message) ? message : new Error(message);
  this.destroy(err);
};

Decoder.prototype._warning = function(message, strict) {
  var err = new Error(message);
  if(strict) this._error(message);
  else this.emit('warning', err);
};

module.exports = Decoder;
