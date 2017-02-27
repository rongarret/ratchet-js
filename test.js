
'use strict';

// For testing on SpiderMonkey.  Obviously do not rely on this for
// actual security.
//
if (!window) {
  var window = this;
  window.crypto = {}
  print("Installing stub randomBytes");
  window.crypto.getRandomValues = function(a) {
    for (var i=0; i<a.length; i++) {
      a[i] = Math.floor(Math.random() * 0x100000000);
    }
  }
}

load('debug.js');
load('utils.js');
load('classes.js');
load("serialize.js");
load('tweetnacl-js.js');
load('ratchet.js');

// Test serialization
checkSerializationHash('GK1hEqbjz6ezFPBDU5njwX');
var k1 = randomSC4Key();
var v = k1.pubkeys.serialize();
var k2 = deserialize(v)[0];
assert(k1.id() == k2.id());

// Test encryption
v = nacl.randomBytes(Math.round(100*Math.random()+1));
var nonce = nacl.randomBytes(24);
var v1 = encrypt(v, k1, nonce);
var v2 = decrypt(v1, k1, nonce);
assert(u8a_cmp(v, v2)==0);

// Test signatures
var msg = nacl.randomBytes(32);
var sig = k1.sign(msg);
assert(sig.verify());

// Test X3DH
var alice = makeSC4User('Alice');
var bob = makeSC4User('Bob');
var charlie = makeSC4User('Charlie');

var [sk1, hdr] = alice.x3dh_tx(bob.getKeyBundle());
var sk2 = bob.x3dh_rx(hdr);
assert(u8a_cmp(sk1, sk2)==0);

// Test Signal ratchet
var rsa = new ratchet_session();
var rsb = new ratchet_session();
var rsc = new ratchet_session();

var hdr = rsa.init_for_tx(alice, bob, stringToOctets("Hello Bob"));
var msg = rsb.init_for_rx(bob, hdr);

// This should fail because forward secrecy
expectError(function() { rsc.init_for_rx(bob, hdr); });

// This should fail because wrong recipient
expectError(function() { rsc.init_for_rx(charlie, hdr); });

// Normal ratchet operations
for (var j=0; j<10; j++) {
  for (var i=0; i<5; i++) {
    v = rsa.encrypt("Hello Bob " + i);
    v1 = rsb.decrypt(v);
  } 
  for (var i=0; i<5; i++) {
    v = rsb.encrypt("Hello Alice " + i);
    v1 = rsa.decrypt(v);
  }
}

function outOfOrderMsgTest(n) {
  var l = [];
  for (var i=0; i<n; i++) l.push(rsa.encrypt('test ' + i));
  l = l.reverse();
  l.forEach(function(v) { rsb.decrypt(v); });
}

outOfOrderMsgTest(5);
outOfOrderMsgTest(10);
expectError(function() { outOfOrderMsgTest(15); });

print("Done");
