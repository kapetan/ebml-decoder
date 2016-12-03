var uint64be = require('uint64be');

var EPOCH = (new Date('2001-01-01T00:00:00.000000000')).getTime();

var element = function(encoding) {
  return {
    encode: function(obj, buffer, offset) {
      var length = this.encodingLength(obj);

      if(!buffer) buffer = new Buffer(length);
      if(!offset) offset = 0;

      encoding.encode(obj, buffer, offset, length);
      this.encode.bytes = length;
      return buffer;
    },
    decode: function(buffer, start, end) {
      if(!start) start = 0;
      if(!end) end = buffer.length;

      var result = encoding.decode(buffer, start, end);
      this.decode.bytes = end - start;
      return result;
    },
    encodingLength: function(obj) {
      return encoding.encodingLength(obj);
    }
  };
};

var string = function(encoding) {
  return element({
    encode: function(obj, buffer, offset) {
      buffer.write(obj, offset, encoding);
    },
    decode: function(buffer, start, end) {
      return buffer.toString(encoding, start, end);
    },
    encodingLength: function(obj) {
      return Buffer.byteLength(obj, encoding);
    }
  });
};

var integer = element({
  encode: function(obj, buffer, offset, length) {
    buffer.writeIntBE(obj, offset, length);
  },
  decode: function(buffer, start, end) {
    if(end - start === 0) return 0;
    return buffer.readIntBE(start, end - start);
  },
  encodingLength: function(obj) {
    for(var i = 1; i <= 6; i++) {
      var max = Math.pow(2, 8 * i - 1);
      if(-max <= obj <= max - 1) return i;
    }

    throw new RangeError('integer length must be at most 6 bytes');
  }
});

var uinteger = element({
  encode: function(obj, buffer, offset, length) {
    buffer.writeUIntBE(obj, offset, length);
  },
  decode: function(buffer, start, end) {
    if(end - start === 0) return 0;
    return buffer.readUIntBE(start, end - start);
  },
  encodingLength: function(obj) {
    for(var i = 1; i <= 6; i++) {
      if(obj < Math.pow(2, 8 * i)) return i;
    }

    throw new RangeError('unsigned integer length must be at most 6 bytes');
  }
});

var float = element({
  encode: function(obj, buffer, offset, length) {
    if(length === 4) buffer.writeFloatBE(obj, offset);
    else buffer.writeDoubleBE(obj, offset);
  },
  decode: function(buffer, start, end) {
    var length = end - start;
    if(length === 0) return 0;
    else if(length === 4) return buffer.readFloatBE(start);
    else if(length === 8) return buffer.readDoubleBE(start);
    else throw new RangeError('float length must be either 0, 4 or 8 bytes');
  },
  encodingLength: function(obj) {
    if(Math.fround(obj) === obj) return 4;
    else return 8;
  }
});

var date = element({
  encode: function(obj, buffer, offset) {
    obj = (obj - EPOCH) * 1000000;
    uint64be.encode(obj, buffer, offset);
  },
  decode: function(buffer, start, end) {
    var t = uint64be.decode(buffer, start, end);
    return new Date(t / 1000000 + EPOCH);
  },
  encodingLength: function(obj) {
    return obj ? 8 : 0;
  }
});

var binary = element({
  encode: function(obj, buffer, offset) {
    obj.copy(buffer, offset, 0, obj.length);
  },
  decode: function(buffer, start, end) {
    return buffer.slice(start, end);
  },
  encodingLength: function(obj) {
    return obj.length;
  }
});

module.exports = exports = function(type) {
  switch(type) {
    case 'string': return exports.string;
    case 'utf-8': return exports.utf8;
    case 'uinteger': return exports.uinteger;
    case 'integer': return exports.integer;
    case 'float': return exports.float;
    case 'date': return exports.date;
    case 'binary': return exports.binary;
  }
};

exports.string = string('ascii');
exports.utf8 = string('utf-8');
exports.uinteger = uinteger;
exports.integer = integer;
exports.float = float;
exports.date = date;
exports.binary = binary;
