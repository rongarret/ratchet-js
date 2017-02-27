'use strict';

function serializeLength(len) {
  var len_is_power_of_2 = ((len & (len-1))==0);
  var loglen = integerLength(len);
  var loglenlen = integerLength(loglen);
  if (len_is_power_of_2 && (loglenlen <= 4)) return octets(loglen);
  var lenbytes = Math.ceil(loglen/8);
  return concat(octets(lenbytes | 16), integerToOctets(len));
}

function setTypeTag(v, tag) {
  v[0] = v[0] | (tag<<5);
  return v;
}

defmethod('serialize', Uint8Array, function () {
  return concat(serializeLength(this.length), this);
});

defmethod('serialize', Number, function () {
  return setTypeTag(integerToOctets(this).serialize(), 1);
});

defmethod('serialize', String, function () {
  return setTypeTag(stringToOctets(this).serialize(), 2);
});

defmethod('serialize', Array, function () {
  var l = [setTypeTag(serializeLength(this.length), 3)];
  for (var i=0; i<this.length; i++) l.push(this[i].serialize());
  return concat.apply(null, l);
});

function serialize(thing) {
  print("WARNING: Serialize is deprecated.  Use thing.serialize instead.");
  return thing.serialize();
}

// Set these after all serializable classes have been defined
var $SERIALIZABLE_CLASSES, $SERIALIZATON_HASH;

function serializationHash() {
  function classSerializationSpec(cls) {
    return '(' + cls._name + ' ' + Object.keys(cls._slots).join(' ') + ')';
  }
  var s = $SERIALIZABLE_CLASSES.map(classSerializationSpec).join(' ');
  return b58(hash(fmt('(%)', s)).subarray(0,16));
}

function checkSerializationHash(expected) {
  var h = serializationHash();
  if (h != expected) error(fmt(
    "Serialization hash mismatch: expected %, got %", expected, h));
}

function serializableClassIndexOf(thing) {
  return $SERIALIZABLE_CLASSES.indexOf($CLASSES[typeOf(thing)]);
}

defmethod('serialize', stdObject, function() {
  var idx = serializableClassIndexOf(this);
  if (idx<0) throw new Error("Cannot serialize " + this);
  var that = this;
  var vals = this.slotNames().map(function(k) { return that[k]; });
  return concat(setTypeTag(octets(idx), 7), vals.serialize());
});

function deserialize(v) {
  var tag = v[0];
  var type = tag>>>5;
  if (type==7) return deserializeObject(v);
  var extensionBit = (tag&0x10)>0;
  var lenBits = tag&15;
  var start = extensionBit ? (lenBits+1) : 1;
  var len = extensionBit ? (octetsToInteger(v.subarray(1, lenBits+1))) :
    ash(1, lenBits-1);
  if (type==3) return deserializeList(v.subarray(start), len);
  var end = start+len;
  var data = v.subarray(start, end);
  var result;
  if (type==0) result = data;
  else if (type==1) result = octetsToInteger(data);
  else if (type==2) result = octetsToString(data);
  else throw("Unknown type tag: " + type);
  return [result, v.subarray(end)];
}

function deserializeObject(v) {
  var idx = v[0]&0x1f;
  var cls = $SERIALIZABLE_CLASSES[idx];
  if (!cls) throw("Unknown deserialization class index: " + idx);
  var slotNames = Object.keys(cls._slots);
  var [slotValues, v] = deserialize(v.subarray(1));
  if (slotNames.length != slotValues.length) error(
    fmt("Deserialization error: expected % slot values, got %",
	slotNames.length, slotValues.length));
  var o = new cls;
  for (var i=0; i<slotNames.length; i++) o[slotNames[i]] = slotValues[i];
  return [o, v];
}

function deserializeList(v, cnt) {
  var l = new Array(cnt);
  for (var i=0; i<cnt; i++) {
    var [v1, v] = deserialize(v);
    l[i] = v1;
  }
  return [l, v];
}
