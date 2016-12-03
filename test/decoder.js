var test = require('tape');

var Decoder = require('../source/decoder');

var buffer = function() {
  var args = Array.prototype.slice.call(arguments);
  return new Buffer(args);
};

var mapElement = function(element, path) {
  var obj = Object.keys(element).reduce(function(acc, key) {
    acc[key] = element[key];
    return acc;
  }, {});

  if(Array.isArray(path)) obj.path = path;
  else delete obj.path;
  return obj;
};

var elementEquals = function(t, element, opts) {
  var path = element.path.map(mapElement);
  opts.path.push(mapElement(element));
  t.deepEquals(mapElement(element, path), opts);
};

test('empty string element', function(t) {
  t.plan(2);

  var schema = [{
    name: 'StringElement',
    path: '*(\\StringElement)',
    id: '0xa1',
    type: 'string'
  }];

  var decoder = new Decoder({ schema: schema });

  decoder.on('element', function(element) {
    elementEquals(t, element, {
      id: '0xa1',
      size: 0,
      type: 'string',
      name: 'StringElement',
      position: {
        offset: 0,
        length: 2
      },
      path: []
    });
  });

  decoder.on('finish', function() {
    t.pass('finished');
  });

  decoder.write(buffer(0xa1, 0x80));
  decoder.end();
});

test('decode empty string element', function(t) {
  t.plan(3);

  var schema = [{
    name: 'StringElement',
    path: '*(\\StringElement)',
    id: '0xa1',
    type: 'string'
  }];

  var decoder = new Decoder({ schema: schema });

  decoder.on('element', function(element) {
    elementEquals(t, element, {
      id: '0xa1',
      size: 0,
      type: 'string',
      name: 'StringElement',
      position: {
        offset: 0,
        length: 2
      },
      path: []
    });

    decoder.decode(function(value) {
      t.equals(value, '');
    });
  });

  decoder.on('finish', function() {
    t.pass('finished');
  });

  decoder.write(buffer(0xa1, 0x80));
  decoder.end();
});

test('decode string element', function(t) {
  t.plan(3);

  var schema = [{
    name: 'StringElement',
    path: '*(\\StringElement)',
    id: '0xa1',
    type: 'string'
  }];

  var decoder = new Decoder({ schema: schema });

  decoder.on('element', function(element) {
    elementEquals(t, element, {
      id: '0xa1',
      size: 5,
      type: 'string',
      name: 'StringElement',
      position: {
        offset: 0,
        length: 7
      },
      path: []
    });

    decoder.decode(function(value) {
      t.equals(value, 'hello');
    });
  });

  decoder.on('finish', function() {
    t.pass('finished');
  });

  decoder.write(buffer(0xa1, 0x85, 0x68, 0x65, 0x6c, 0x6c, 0x6f));
  decoder.end();
});

test('decode chunked string element', function(t) {
  t.plan(3);

  var data = [0xa1, 0x85, 0x68, 0x65, 0x6c, 0x6c, 0x6f];
  var schema = [{
    name: 'StringElement',
    path: '*(\\StringElement)',
    id: '0xa1',
    type: 'string'
  }];

  var decoder = new Decoder({ schema: schema });

  decoder.on('element', function(element) {
    elementEquals(t, element, {
      id: '0xa1',
      size: 5,
      type: 'string',
      name: 'StringElement',
      position: {
        offset: 0,
        length: 7
      },
      path: []
    });

    decoder.decode(function(value) {
      t.equals(value, 'hello');
    });
  });

  decoder.on('finish', function() {
    t.pass('finished');
  });

  (function loop() {
    if(!data.length) return decoder.end();
    decoder.write(buffer(data.shift()));
    setTimeout(loop, 10);
  }());
});

test('chunked multiple string elements', function(t) {
  t.plan(3);

  var data = [0xa1, 0x83, 0x68, 0x65, 0x6c, 0xa1, 0x82, 0x6c, 0x6f];
  var schema = [{
    name: 'StringElement',
    path: '*(\\StringElement)',
    id: '0xa1',
    type: 'string'
  }];

  var decoder = new Decoder({ schema: schema });

  decoder.once('element', function(element) {
    elementEquals(t, element, {
      id: '0xa1',
      size: 3,
      type: 'string',
      name: 'StringElement',
      position: {
        offset: 0,
        length: 5
      },
      path: []
    });

    decoder.once('element', function(element) {
      elementEquals(t, element, {
        id: '0xa1',
        size: 2,
        type: 'string',
        name: 'StringElement',
        position: {
          offset: 5,
          length: 4
        },
        path: []
      });
    });
  });

  decoder.on('finish', function() {
    t.pass('finished');
  });

  (function loop() {
    if(!data.length) return decoder.end();
    var buf = new Buffer(data.splice(0, 2));
    decoder.write(buf);
    setTimeout(loop, 10);
  }());
});

test('empty master element', function(t) {
  t.plan(2);

  var schema = [{
    name: 'MasterElement',
    path: '*(\\MasterElement)',
    id: '0xa2',
    type: 'master'
  }];

  var decoder = new Decoder({ schema: schema });

  decoder.on('element', function(element) {
    elementEquals(t, element, {
      id: '0xa2',
      size: 0,
      type: 'master',
      name: 'MasterElement',
      position: {
        offset: 0,
        length: 2
      },
      path: []
    });
  });

  decoder.on('finish', function() {
    t.pass('finished');
  });

  decoder.write(buffer(0xa2, 0x80));
  decoder.end();
});

test('decode empty master element', function(t) {
  t.plan(3);

  var schema = [{
    name: 'MasterElement',
    path: '*(\\MasterElement)',
    id: '0xa2',
    type: 'master'
  }];

  var decoder = new Decoder({ schema: schema });

  decoder.on('element', function(element) {
    elementEquals(t, element, {
      id: '0xa2',
      size: 0,
      type: 'master',
      name: 'MasterElement',
      position: {
        offset: 0,
        length: 2
      },
      path: []
    });

    decoder.decode(function(value) {
      t.equals(value, undefined);
    });
  });

  decoder.on('finish', function() {
    t.pass('finished');
  });

  decoder.write(buffer(0xa2, 0x80));
  decoder.end();
});

test('nested elements', function(t) {
  t.plan(3);

  var schema = [{
    name: 'StringElement',
    path: '*(\\StringElement)',
    id: '0xa1',
    type: 'string'
  }, {
    name: 'MasterElement',
    path: '*(\\MasterElement)',
    id: '0xa2',
    type: 'master'
  }];

  var decoder = new Decoder({ schema: schema });

  decoder.once('element', function(element) {
    elementEquals(t, element, {
      id: '0xa2',
      size: 7,
      type: 'master',
      name: 'MasterElement',
      position: {
        offset: 0,
        length: 9
      },
      path: []
    });

    decoder.once('element', function(element) {
      elementEquals(t, element, {
        id: '0xa1',
        size: 5,
        type: 'string',
        name: 'StringElement',
        position: {
          offset: 2,
          length: 7
        },
        path: [{
          id: '0xa2',
          size: 7,
          type: 'master',
          name: 'MasterElement',
          position: {
            offset: 0,
            length: 9
          }
        }]
      });
    });
  });

  decoder.on('finish', function() {
    t.pass('finished');
  });

  decoder.write(buffer(0xa2, 0x87, 0xa1, 0x85, 0x68, 0x65, 0x6c, 0x6c, 0x6f));
  decoder.end();
});

test('decode nested elements with type option', function(t) {
  t.plan(6);

  var schema = [{
    name: 'StringElement',
    path: '*(\\StringElement)',
    id: '0xa1',
    type: 'string'
  }, {
    name: 'MasterElement',
    path: '*(\\MasterElement)',
    id: '0xa2',
    type: 'master'
  }];

  var decoder = new Decoder({ schema: schema });

  decoder.once('element', function(element) {
    elementEquals(t, element, {
      id: '0xa2',
      size: 9,
      type: 'master',
      name: 'MasterElement',
      position: {
        offset: 0,
        length: 11
      },
      path: []
    });

    decoder.once('element', function(element) {
      elementEquals(t, element, {
        id: '0xa1',
        size: 3,
        type: 'string',
        name: 'StringElement',
        position: {
          offset: 2,
          length: 5
        },
        path: [{
          id: '0xa2',
          size: 9,
          type: 'master',
          name: 'MasterElement',
          position: {
            offset: 0,
            length: 11
          }
        }]
      });

      decoder.decode({ type: 'binary' }, function(value) {
        t.deepEquals(value, buffer(0x68, 0x65, 0x6c));

        decoder.once('element', function(element) {
          elementEquals(t, element, {
            id: '0xa1',
            size: 2,
            type: 'string',
            name: 'StringElement',
            position: {
              offset: 7,
              length: 4
            },
            path: [{
              id: '0xa2',
              size: 9,
              type: 'master',
              name: 'MasterElement',
              position: {
                offset: 0,
                length: 11
              }
            }]
          });

          decoder.decode({ type: 'uinteger' }, function(value) {
            t.deepEquals(value, 27759);
          });
        });
      });
    });
  });

  decoder.on('finish', function() {
    t.pass('finished');
  });

  decoder.write(buffer(0xa2, 0x89, 0xa1, 0x83, 0x68, 0x65, 0x6c, 0xa1, 0x82, 0x6c, 0x6f));
  decoder.end();
});

test('unknown element length', function(t) {
  t.plan(4);

  var schema = [{
    name: 'StringElement',
    path: '*(\\MasterElement\\StringElement)',
    id: '0xa1',
    type: 'string'
  }, {
    name: 'MasterElement',
    path: '*(\\MasterElement)',
    id: '0xa2',
    type: 'master'
  }];

  var decoder = new Decoder({ schema: schema });

  decoder.once('element', function(element) {
    elementEquals(t, element, {
      id: '0xa2',
      size: -1,
      type: 'master',
      name: 'MasterElement',
      position: {
        offset: 0,
        length: -1
      },
      path: []
    });

    decoder.once('element', function(element) {
      elementEquals(t, element, {
        id: '0xa1',
        size: 5,
        type: 'string',
        name: 'StringElement',
        position: {
          offset: 2,
          length: 7
        },
        path: [{
          id: '0xa2',
          size: -1,
          type: 'master',
          name: 'MasterElement',
          position: {
            offset: 0,
            length: -1
          }
        }]
      });

      decoder.once('element', function(element) {
        elementEquals(t, element, {
          id: '0xa2',
          size: 0,
          type: 'master',
          name: 'MasterElement',
          position: {
            offset: 9,
            length: 2
          },
          path: []
        });
      });
    });
  });

  decoder.on('finish', function() {
    t.pass('finished');
  });

  decoder.write(buffer(0xa2, 0xff, 0xa1, 0x85, 0x68, 0x65, 0x6c, 0x6c, 0x6f, 0xa2, 0x80));
  decoder.end();
});

test('invalid varint element id', function(t) {
  t.plan(1);

  var decoder = new Decoder({ maxIDLength: 2 });

  decoder.on('error', function(err) {
    t.ok(err, err.message);
  });

  decoder.write(buffer(0x00, 0x00, 0xa1, 0x80));
  decoder.end();
});

test('unknown element id', function(t) {
  t.plan(1);

  var decoder = new Decoder();

  decoder.on('error', function(err) {
    t.ok(err, err.message);
  });

  decoder.write(buffer(0xa1, 0x80));
  decoder.end();
});

test('child element exceedes parent size', function(t) {
  t.plan(2);

  var schema = [{
    name: 'StringElement',
    path: '*(\\StringElement)',
    id: '0xa1',
    type: 'string'
  }, {
    name: 'MasterElement',
    path: '*(\\MasterElement)',
    id: '0xa2',
    type: 'master'
  }];

  var decoder = new Decoder({ schema: schema });

  decoder.once('element', function(element) {
    elementEquals(t, element, {
      id: '0xa2',
      size: 6,
      type: 'master',
      name: 'MasterElement',
      position: {
        offset: 0,
        length: 8
      },
      path: []
    });

    decoder.on('error', function(err) {
      t.ok(err, err.message);
    });
  });

  decoder.write(buffer(0xa2, 0x86, 0xa1, 0x85, 0x68, 0x65, 0x6c, 0x6c, 0x6f));
  decoder.end();
});

test('invalid element value', function(t) {
  t.plan(2);

  var schema = [{
    name: 'FloatElement',
    path: '*(\\FloatElement)',
    id: '0xa1',
    type: 'float'
  }];

  var decoder = new Decoder({ schema: schema });

  decoder.on('element', function(element) {
    elementEquals(t, element, {
      id: '0xa1',
      size: 3,
      type: 'float',
      name: 'FloatElement',
      position: {
        offset: 0,
        length: 5
      },
      path: []
    });

    decoder.on('error', function(err) {
      t.ok(err, err.message);
    });

    decoder.decode(function(value) {
      t.fail();
    });
  });

  decoder.write(buffer(0xa1, 0x83, 0x00, 0x00, 0x01));
  decoder.end();
});

test('unknown element id with strict disabled', function(t) {
  t.plan(2);

  var decoder = new Decoder({ strict: false });

  decoder.on('element', function(element) {
    elementEquals(t, element, {
      id: '0xa1',
      size: 0,
      type: 'binary',
      name: 'Unknown',
      position: {
        offset: 0,
        length: 2
      },
      path: []
    });
  });

  decoder.on('finish', function() {
    t.pass('finished');
  });

  decoder.write(buffer(0xa1, 0x80));
  decoder.end();
});
