var recorder = require('media-recorder-stream');
var getUserMedia = require('getusermedia');
var varint = require('ebml-varint');

var decoder = require('../../');
var matroska = require('../matroska');

var startButton = document.getElementById('start-button');
var stopButton = document.getElementById('stop-button');
var mediaSelect = document.getElementById('media-select');
var durationInput = document.getElementById('duration-input');
var listContainer = document.getElementById('list-container');

var dl = function(list) {
  var dl = document.createElement('dl');

  list.forEach(function(element) {
    if(element.type === 'master') return;

    var dt = document.createElement('dt');
    dt.textContent = element
      .path
      .map(function(e) {
        return e.name;
      })
      .join('.');

    var dd = document.createElement('dd');
    dd.textContent = element.type === 'binary' ?
      element.value.toString('hex') : element.value;

    dl.appendChild(dt);
    dl.appendChild(dd);
  });

  listContainer.appendChild(dl);
};

var descendants = function(parent, cb) {
  var children = [];

  return function onelement(child) {
    var common = parent.path.every(function(e, i) {
      return e === child.path[i];
    });

    if(common) {
      children.push(child);
      this.decode(function(value) {
        child.value = value;
      });
    } else {
      this.removeListener('element', onelement);
      cb(children);
    }
  };
};

startButton.onclick = function() {
  startButton.onclick = null;
  startButton.disabled = true;
  stopButton.disabled = false;

  var value = mediaSelect.value;
  var options = {};

  if(/a/.test(value)) options.audio = true;
  if(/v/.test(value)) options.video = true;

  getUserMedia(options, function(err, media) {
    if(err) throw err;

    stopButton.onclick = function() {
      stopButton.onclick = null;
      media.getTracks().forEach(function(track) {
        track.stop();
      });
    };

    var scale = Math.pow(10, -3);
    var timecode = 0;

    recorder(media)
      .pipe(decoder({ schema: matroska }))
      .on('element', function(element) {
        if(element.name === 'Info') {
          this.on('element', descendants(element, dl));
        } else if(element.name === 'TimecodeScale') {
          this.decode(function(value) {
            scale = value / Math.pow(10, 9);
          });
        } else if(element.name === 'TrackEntry') {
          this.on('element', descendants(element, dl));
        } else if(element.name === 'Timecode') {
          this.decode(function(value) {
            timecode = value;
            durationInput.value = (value * scale).toFixed(3);
          });
        } else if(element.name === 'SimpleBlock') {
          this.decode(function(buffer) {
            var trackNumber = varint.decode(buffer);
            var tc = buffer.readIntBE(varint.decode.bytes, 2);
            if(trackNumber === 1) durationInput.value = ((timecode + tc) * scale).toFixed(3);
          });
        }
      });
  });
};

