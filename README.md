# ebml-decoder

Streaming EBML decoder.

    npm install ebml-decoder

See the [live demo](https://kapetan.github.io/ebml-decoder/demo/duration/index.html).

# Usage

The module exposes a decoder constructor which inherits from writable stream. An decoder instance emits `element` events whenever a EBML element is encountered in the input data. The actual element value can be retrieved using the `decoder.decode([options], callback)` method.

```javascript
var fs = require('fs');
var decoder = require('ebml-decoder');

fs.createReadStream('movie.mkv')
  .pipe(decoder({ schema: matroska }))
  .on('element', function(element) {
    if(element.name === 'Duration') {
      this.decode(function(value) {
        console.log('Duration', value);
      });
    }
  });
```

The constructor accepts an EBML schema object as an option. The schema should be an array of element definitions.

```javascript
[
  {
    id: '0x4489',
    name: 'Duration',
    type: 'float',
    path: '0*1(\Segment\Info\Duration)'
  }
]
```

The constructor accepts following options.

- `schema`: EBML schema as specified above.
- `header`: A boolean indicating if the default EBML header schema should be applied (default `true`).
- `strict`: A boolean indicating if warnings (such as unknown element IDs) should be treated as errors (default `true`).
- `maxIDLength`: The maximum number of bytes of an EBML element ID (default `4`).
- `maxSizeLength`: The maximum number of bytes of an EBML element size (default `8`).

If `maxIDLength` or `maxSizeLength` is not passed the decoder tries to read the values from the EBML header else the above default values are used.

The `decode` method should only be called after the `element` event has been emitted. The provided callback is called immediately with no value for master elements. It accepts following options.

- `type`: Overwrite the type specified in the element schema.
