var PATTERN = /^([0-9]*\*[0-9]*)\(((?:\\[a-zA-Z0-9-\.]+)*)(?:\(([0-9]*\*[0-9]*)\\\))?(?:(\\[a-zA-Z0-9-\.]+)|(?:\(1\*\((\\[a-zA-Z0-9-\.]+)\)\)))\)$/;

var parseOccurence = function(str) {
  var pair = str.split('*');

  return {
    min: pair[0] ? parseInt(pair[0]) : 0,
    max: pair[1] ? parseInt(pair[1]) : Infinity
  };
};

module.exports = function(str) {
  var fullPath = str.match(PATTERN);
  if(!fullPath) return;

  var elementOccurence = fullPath[1];
  var parentPath = fullPath[2];
  var variableParent = fullPath[3];
  var lastPath = fullPath[4];
  var recursivePath = fullPath[5];

  var path = parentPath.split('\\');
  if(variableParent) path.push(parseOccurence(variableParent));
  if(lastPath) path.push(lastPath.slice(1));
  if(recursivePath) path.push(recursivePath.slice(1));

  path.shift();

  var level = path.reduce(function(acc, item) {
    return acc + ((typeof item === 'object') ? item.min : 1);
  }, 0);

  return {
    occurence: parseOccurence(elementOccurence),
    variable: !!variableParent,
    recursive: !!recursivePath,
    path: path,
    level: level - 1
  };
};
