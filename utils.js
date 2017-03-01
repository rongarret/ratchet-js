'use strict';

/*

utils.js - General Javascript utilities

Copyright (c) 2017 by Ron Garret

MIT License (https://opensource.org/licenses/MIT)

I use this file across a lot of different projects so it may appear
to contain unused code.

*/

var $LAST_ERROR = null;

function error(s) {
  $LAST_ERROR = new Error(s);
  throw $LAST_ERROR;
}

function bt() { print($LAST_ERROR.stack); }  // bt = BackTrace

function typeOf(thing) {
  if (thing===null) return 'null';
  if (thing===undefined) return 'undefined';
  var c = thing.constructor;
  return c.name || c._name || "unknown";
}

function typesOf(thing) { return [typeOf(thing)]; }

// Don't use instanceof because it doesn't work for literals
// http://stackoverflow.com/questions/203739/why-does-instanceof-return-false-for-some-literals

function isa(thing, type) {
  if (!(type.constructor == String)) type = type.name || type._name;
  return typesOf(thing).indexOf(type)>=0;
}

function checkType(thing, type) {
  if (!isa(thing, type)) error(
    'Expected ' + (type.name || type._name) + ', got ' + typeOf(thing));
}

function copy(obj) {
  var o = new obj.constructor;
  for (var k in obj) if (obj.hasOwnProperty(k)) o[k] = obj[k];
  return o;
}

function list() { return copy(arguments); }

function maybeCall(thing) {
  if (isa(thing, Function)) return thing();
  if (isa(thing, Array)) return copy(thing);
  if (isa(thing, Object)) return copy(thing);
  return thing;
}

function fill(array, value) {
  for (var i=0; i<array.length; i++) array[i]=maybeCall(value);
  return array;
}

function octets() {
  var v = new Uint8Array(arguments.length);
  for (var i=0; i<arguments.length; i++) v[i]=arguments[i];
  return v;
}

function stringToOctets(s) {
  var d = unescape(encodeURIComponent(s));
  var b = new Uint8Array(d.length);
  for (var i = 0; i < d.length; i++) b[i] = d.charCodeAt(i);
  return b;
};

function octetsToString(arr) {
  var s = [];
  for (var i = 0; i < arr.length; i++) s.push(String.fromCharCode(arr[i]));
  return decodeURIComponent(escape(s.join('')));
};

var MAX_SAFE_INTEGER = Math.pow(2, 53)-1;
var POW_2_32 = 0x100000000;

function integerLength(n) { // In bits
  if (n<0) error("Can't take integerLength of a negative number");
  if (n>MAX_SAFE_INTEGER) error("Can't take integer length of n>=2^53");
  if (n==0) return 0;
  var hi = Math.floor(n / POW_2_32);
  var lo = n % POW_2_32;
  if (hi>0) return Math.floor(Math.log(hi)/Math.LN2) + 33;
  else return Math.floor(Math.log(lo)/Math.LN2) + 1;
}

function integerToOctets(n) {
  var len = Math.ceil(integerLength(n)/8);
  return integerToNOctets(n, len);
}

function integerToNOctets(n, nBytes) {
  var buf = new Uint8Array(nBytes);
  for (var i=0; i<nBytes; i++) {
    buf[nBytes - 1 - i] = n & 0xFF;
    n = n>>8;
  }
  return buf;
}

function octetsToInteger(bytes) {
  var n = 0;
  for (var i=0; i<bytes.length; i++) n = (n*256) + bytes[i];
  return n;
}

var $EPOCH = (new Date(1900,0,0,0,0,0)).valueOf();

function dateToOctets(date, epoch) {
  epoch = epoch || $EPOCH;
  return integerToOctets(Math.round((date.valueOf() - epoch) / 1000));
}

function octetsToDate(v, epoch) {
  epoch = epoch || $EPOCH;
  return new Date((octetsToInteger(v) * 1000) + epoch);
}

function u8a_cmp(a1, a2) {
  checkType(a1, Uint8Array);
  checkType(a2, Uint8Array);
  if (a1.length != a2.length) error(
    "Can't compare arrays of different lengths");
  var result = 0;
  for(var i=0; i<a1.length; i++) {
    if (a1[i]>a2[i]) result = result || 1;
    if (a1[i]<a2[i]) result = result || -1;
  }
  return result;
}

// Interpolates a string, inserting elements of l everywhere a % sign
// appears in s
//
function fmt(s) {
  var l1 = s.split('%');
  var result = [l1[0]];
  for(var i=0; i<l1.length-1; i++) {
    result.push('' + arguments[i+1]);
    result.push(l1[i+1]);
  }
  return result.join('');
}

function split_into_lines(s, line_length) {
  var len = line_length || 72;
  var lines = [];
  for (var i=0; i<s.length; i+=len) lines.push(s.slice(i, i+len));
  lines.push('');
  return lines.join('\n');
}

// Base-N encoding/decoding
// Adapted from http://cryptocoinjs.com/modules/misc/bs58/

function baseN(buffer, alphabet, base) {
  var i, j, digits = [0];
  for (i = 0; i < buffer.length; ++i) {
    for (j = 0; j < digits.length; ++j) digits[j] <<= 8;
    digits[0] += buffer[i];
    var carry = 0;
    for (j = 0; j < digits.length; ++j) {
      digits[j] += carry;
      carry = (digits[j] / base) | 0;
      digits[j] %= base;
    }
    while (carry) {
      digits.push(carry % base);
      carry = (carry / base) | 0;
    }
  }
  // deal with leading zeros
  for (i = 0; buffer[i] === 0 && i < buffer.length - 1; ++i) digits.push(0);
  return digits.map(function(c){return alphabet[c];}).reverse().join('');
}

function unbaseN(string, alphabet, base) {
  if (alphabet == undefined) alphabet = B58_ALPHABET;
  if (base==undefined) base = alphabet.length;
  var i, j, bytes = [0];
  for (i = 0; i < string.length; ++i) {
    var c = string[i];
    for (j = 0; j < bytes.length; ++j) bytes[j] *= base;
    var k = alphabet.indexOf(c);
    if (k<0) error('Illegal character decoding base-N string');
    bytes[0] += k;
    var carry = 0;
    for (j = 0; j < bytes.length; ++j) {
      bytes[j] += carry;
      carry = bytes[j] >> 8;
      bytes[j] &= 0xff;
    }
    while (carry) {
      bytes.push(carry & 0xff);
      carry >>= 8;
    }
  }
  // deal with leading zeros
  var lz = alphabet[0];
  for (i = 0; string[i] === lz && i < string.length - 1; ++i) bytes.push(0);
  return new Uint8Array(bytes.reverse());
}

var B58_CHARS = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
function b58(b) { return baseN(b, B58_CHARS, 58); }
function unb58(s) { return unbaseN(s, B58_CHARS, 58); }
function b32(b) { return baseN(b, B58_CHARS, 32); }
function unb32(s) { return unbaseN(s, B58_CHARS, 32); }

var HEX_CHARS = '0123456789ABCDEF';
function hex(b) { return baseN(b, HEX_CHARS, 16); }
function unhex(s) { return unbaseN(s.toUpperCase(), HEX_CHARS, 16); }

function u8aConcat(u8aList) {
  var len = 0;
  for (var i=0; i<u8aList.length; i++) len += u8aList[i].length;
  var a = new u8aList[0].constructor(len);
  len = 0;
  for (var i=0; i<u8aList.length; i++) {
    var v = u8aList[i].toOctets();
    a.set(v, len);
    len += v.length;
  }
  return a;
}

function argsToArray(argsObj) {
  var len = argsObj.length;
  var a = new Array(len);
  for (var i=0; i<len; i++) a[i]=argsObj[i];
  return a;
}

function concat() {
  var a = argsToArray(arguments);
  var t = typeOf(a[0]);
  if (t == 'String') return a.join('');
  if (t == 'Array') return Array.concat.apply([], a);
  if (t == 'Uint8Array') return u8aConcat(a);
  error("Don't know how to concatenate " + t);
}

var json = JSON.stringify;
var unjson = JSON.parse;

// ASH = Arithmetic SHift
function ash(n, shift) { return (shift < 0) ? n>>>(-shift) : n<<shift; }

function identity(x) { return x; }

Uint8Array.prototype.slice = function(start, end) {
  if (end===undefined) end = this.length;
  else if (end<0) end = this.length + end;
  return this.subarray(start, end);
};

function now() { return new Date(); }
