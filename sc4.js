
//////////
//
//  Utils (should maybe go somewhere else?)
//
function toOctets(thing) { return thing.toOctets(); }

defmethod('toOctets', String, function() { return stringToOctets(this); });

defmethod('toOctets', Uint8Array, function() { return this; });

function hash(thing) { return nacl.hash(thing.toOctets()); }

//////////
//
//  Keys
//
function keysFromSeed(seed) {
  var seed = hash(seed).slice(0,32);
  var skpr = nacl.sign.keyPair.fromSeed(seed);
  var h = nacl.hash(seed).slice(0,32);
  h[0] &= 248;
  h[31] &= 127;
  h[31] |= 64;
  var ekpr = nacl.box.keyPair.fromSecretKey(h);
  return { epk : ekpr.publicKey,
	   esk : ekpr.secretKey,
	   spk : skpr.publicKey,
	   ssk : skpr.secretKey }
}

defclass("sc4_public_key", {spk: null, epk: null});

defmethod('id', sc4_public_key, function() {
  return this.epk && b58(this.epk).slice(0,16);
});

defclass("sc4_secret_key", {ssk: null, esk: null, pubkeys: null});

defmethod('id', sc4_secret_key, function() {
  return this.pubkeys && this.pubkeys.id();
});

function SC4Key(seed) {
  var keys = keysFromSeed(seed);
  var pk = new sc4_public_key({epk: keys.epk, spk: keys.spk});
  return new sc4_secret_key({esk: keys.esk, ssk: keys.ssk, pubkeys: pk});
}

function randomSC4Key() {
  return SC4Key(nacl.randomBytes(32));
}

////////////////////////
//
// Symmetric encryption
//
var Z24 = fill(new Uint8Array(24), 0);

function encrypt(msg, key, nonce) {
  if (isa(key, sc4_secret_key)) key = key.esk;
  return nacl.secretbox(msg.toOctets(), nonce || Z24, key);
}

function decrypt(v, key, nonce) {
  if (isa(key, sc4_secret_key)) key = key.esk;
  var msg = nacl.secretbox.open(v, nonce || Z24, key);
  if (!msg) error("Decryption failed");
  return msg;
}

////////////////
//
//  Bare signatures
//
defclass('signature', {spk: null, thing: null, sig:null});

defmethod('sign', sc4_secret_key, function(thing) {
  thing = thing.toOctets();
  var sig = nacl.sign.detached(thing, this.ssk);
  return new signature( { spk: this.pubkeys.spk, thing: thing, sig: sig } );
});

defmethod('verify', signature, function() {
  return nacl.sign.detached.verify(this.thing, this.sig, this.spk);
});


/////////////////////
//
//  Hashrefs
//
defclass('sc4_hashref', {version: 0, length: [], hash: []});

var $CAS = {};

function hashref(content) {
  var h = hash(content);
  $CAS[h] = content;
  return new sc4_hashref({length: content.length, hash: h});
}

function unhashref(thing) {
  if (!isa(thing, sc4_hashref)) return thing;
  var c = $CAS[thing.hash];
  if (c === undefined) error("Could not find original content for " + thing);
  return c;
}


/////////////////
//
//  Bundles
//
defclass('sc4_bundle', {filename: '', mimetype: '', content: []});

function randomGen(n) { return function() { return nacl.randomBytes(n); }; }

defclass('sc4_signature',  {
  version: 0,
  spk: [], nonce: randomGen(16), timestamp: now, bundle: [], sig: []
});

defmethod('sighash', sc4_signature, function() {
  var b = this.bundle;
  var content = unhashref(b.content);
  var h1 = hash(content);
  var h2 = hash(concat(this.nonce, content));
  var l = [this.version, this.nonce, this.timestamp, this.spk,
    b.filename, b.mimetype, h1, h2];
  return l.serialize();
});

defmethod('sign', sc4_bundle, function(key) {
  var sig = new sc4_signature({spk: key.pubkeys.spk, bundle: this});
  var h = sig.sighash();
  sig.sig = key.sign(h).sig;
  return sig;
});

defmethod('verify', sc4_signature, function() {
  return nacl.sign.detached.verify(this.sighash(), this.sig, this.spk);
});
