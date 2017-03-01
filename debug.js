
//////////////////////////////////////////////////////
//
//  Debugging utilities
//

function debug(f) {
  try { f(); }
  catch (e) { print(e);  print(e.stack); }
}

function assert(c) {
  if (c!=true) error("Assertion failed");
}

function expectError(f) {
  var flag = 1;
  try { f(); }
  catch (e) {
    print("Received expected error: " + e)
    flag = 0;
  }
  finally {
    if (flag) throw new Error("Failed to received expected error in " + f);
  }
}

Uint8Array.prototype.toString = function () {
  var l = [];
  for (var i=0; i<this.length; i++) l.push('' + this[i]);
  return '[' + l.join(' ') + ']';
};

Array.prototype.toString = function () {
  return '(' + this.map(function(item) { return ''+item; }).join(' ') + ')';
};

function show(thing) {
  if (isa (thing, stdObject)) thing.show();
  else print(typeOf(thing) + ': ' + thing);
}

defmethod('show', stdObject, function() {
  print(typeOf(this) + ' ' + this._id + ':');
  for (var k in this.slots()) {
    putstr(k + ": ");
    show(this[k]);
    print();
  }
});
