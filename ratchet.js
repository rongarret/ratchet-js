'use strict';

//////////////////
//
//  HKDF
//
function xor_elements(v, n) {
  var vv = new Uint8Array(v.length);
  for (var i=0; i<v.length; i++) vv[i] = v[i] ^ n;
  return vv;
}

function hmac(key, msg) {
  var k1 = hash(key);
  var ikp = xor_elements(k1, 0x5C);
  var okp = xor_elements(k1, 0x36);
  return hash(concat(okp, hash(concat(ikp, msg.toOctets()))));
}

var $APPID = "SC4-V0.1";

function hkdf(ikm, cnt, salt, info) {
  cnt = cnt || 32;
  if (cnt>64) error('HKDF of more than 64 bytes not implemented');
  salt = salt || octets();
  info = info || $APPID;
  var prk = hmac(salt, ikm);
  var bytes = hmac(prk, concat(info.toOctets(), octets(0)));
  return bytes.slice(0, cnt);
}

///////////////////////
//
// X3DH
//
defclass('sc4_user', { name: null,
		       idk: randomSC4Key,
		       prekey: randomSC4Key,
		       signed_prekey: null,
		       otpk_dict: {},
		       used_otpkids: []
		     });

defmethod('id', sc4_user, function() { return this.name; });

defmethod('signPrekey', sc4_user, function() {
  this.signed_prekey = this.idk.sign(this.prekey.pubkeys.epk);
});

var $OTPK_SERVER = {};

defmethod('provisionOTPK', sc4_user, function() {
  var k = randomSC4Key();
  this.otpk_dict[k.id()] = k;
  $OTPK_SERVER[this.name].push(k.pubkeys);
});

function makeSC4User(name) {
  var u = new sc4_user({name: name});
  u.signPrekey();
  $OTPK_SERVER[name] = [];
  for (var i=0; i<3; i++) u.provisionOTPK();
  return u;
}

function getOtpk(userName) {return $OTPK_SERVER[userName].pop() || [] }

defclass('key_bundle', { identity_pk: null, signed_prekey: null, otpk: null });

defmethod('getKeyBundle', sc4_user, function() {
  return new key_bundle({identity_pk: this.idk.pubkeys,
			 signed_prekey: this.signed_prekey,
			 otpk: getOtpk(this.name)});
});

defclass('x3dh_header', {idk:null, ek: null, otpkid:null})

function dh(sk, pk) {
  checkType(sk, sc4_secret_key);
  if (isa(pk, sc4_public_key)) pk = pk.epk;
  checkType(pk, Uint8Array);
  return nacl.box.before(pk, sk.esk);
}

defmethod('x3dh_tx', sc4_user, function(kb) {
  var idk = this.idk;
  var identity_pk = kb.identity_pk;
  var signed_prekey = kb.signed_prekey;
  var otpk = kb.otpk;
  if (!signed_prekey.verify()) error("Invalid prekey signature");
  if (!otpk) print("Warning: no OTPK available.")
  var prekey = signed_prekey.thing;
  var ek = randomSC4Key();
  var dh1 = dh(idk, prekey);
  var dh2 = dh(ek, identity_pk);
  var dh3 = dh(ek, prekey);
  var hdr = new x3dh_header({idk: idk.pubkeys, ek: ek.pubkeys});
  if (!otpk) return [hkdf(concat(dh1, dh2, dh3)), hdr];
  hdr.otpkid = otpk.id();
  var dh4 = dh(ek, otpk);
  return [hkdf(concat(dh1, dh2, dh3, dh4)), hdr]
});

defmethod('x3dh_rx', sc4_user, function(hdr) {
  var user_idk = this.idk;
  var prekey = this.prekey;
  var otpk_dict = this.otpk_dict;
  var used_otpkids = this.used_otpkids;
  var ek = hdr.ek;
  var otpkid = hdr.otpkid;
  var dh1 = dh(prekey, hdr.idk);
  var dh2 = dh(user_idk, ek);
  var dh3 = dh(prekey, ek);
  if (!otpkid) {
    print("Warning: no OTPK in X3DH header");
    return hkdf(concat(dh1, dh2, dh3));
  }
  if (used_otpkids.indexOf(otpkid)>=0) error(
    fmt("OTPK % prevously used", otpkid));
  var otpk = otpk_dict[otpkid];
  if (!otpk) throw new Error(fmt("OTPK % unknown", otpkid));
  delete otpk_dict[otpkid];
  used_otpkids.push(otpkid);
  var dh4 = dh(otpk, ek);
  return hkdf(concat(dh1, dh2, dh3, dh4));
});

///////////////////////////
//
// Signal ratchet
//

function kdf_rk(k1, k2) {
  var v = hkdf(k1, 64, k2);
  return [v.slice(0,32), v.slice(32,64)]
}

function kdf_ck(ck) { return kdf_rk("", ck); }

defclass('ratchet_header', {pk: null, pn: null, n: null});

defclass('ratchet_session', {
  user: null, dhs: null, dhr: null, rk: null, cks: null, ckr: null,
  ns: 0, nr: 0, pn: 0, mskipped: {}
});

defmethod('init_for_tx', ratchet_session, function(sender, keybundle, msg) {
  this.reset({user: sender});
  if (isa(keybundle, sc4_user)) keybundle = keybundle.getKeyBundle();
  var [sk, hdr] = sender.x3dh_tx(keybundle);
  this.dhs = randomSC4Key();
  this.dhr = keybundle.identity_pk;

  // FIXME
  //  [this.rk, this.cks] = kdf_rk(sk, dh(this.dhs, this.dhr));
  mv_assign(this, ['rk','cks'], kdf_rk(sk, dh(this.dhs, this.dhr)));

  return concat(hdr.serialize(), msg ? encrypt(msg, sk) : []);  
});

defmethod('init_for_rx', ratchet_session, function(recipient, hdr) {
  this.reset({user: recipient});
  this.dhs = recipient.idk;
  var msg;
  if (isa(hdr, Uint8Array)) [hdr, msg] = hdr.deserialize();
  var sk = recipient.x3dh_rx(hdr);
  this.rk = sk;
  return msg ? decrypt(msg, sk) : true;
});

/////////////////////////
//
//  Ratchet encryption
//
defmethod('encrypt', ratchet_session, function(msg) {
  var [cks, mk] = kdf_ck(this.cks);
  this.cks = cks;
  var hdr = new ratchet_header(
    {pk: this.dhs.pubkeys, pn: this.pn, n: this.ns});
  this.ns++;
  return concat(hdr.serialize(), encrypt(msg, mk));
});

///////////////////////////
//
//  Ratchet decryption
//
function pk_equal(pk1, pk2) {
  if (!isa(pk1, sc4_public_key)) return false;
  if (!isa(pk2, sc4_public_key)) return false;
  return (u8a_cmp(pk1.epk, pk2.epk) == 0);
}

defmethod('decrypt', ratchet_session, function(hdr, ciphertext) {
  if (isa(hdr, Uint8Array)) [hdr, ciphertext] = hdr.deserialize();
  checkType(hdr, ratchet_header);
  var msg = this.trySkippedMsgKeys(hdr, ciphertext);
  if (msg) return msg;
  if (!pk_equal(this.dhr, hdr.pk)) {
    this.skipMessageKeys(hdr.pn);
    this.dhRatchet(hdr.pk);
  }
  this.skipMessageKeys(hdr.n);
  var [new_ckr, mk] = kdf_ck(this.ckr);
  this.ckr = new_ckr;
  this.nr++;
  return decrypt(ciphertext, mk);
});

function makeMSkippedKey(k, n) { return fmt("%/%", k.id(), n); }

defmethod('trySkippedMsgKeys', ratchet_session, function(hdr, ciphertext) {
  var k = makeMSkippedKey(hdr.pk, hdr.n);
  var mk = this.mskipped[k];
  if (mk) {
    delete this.mskipped[k];
    return decrypt(ciphertext, mk);
  }
});

defmethod('skipMessageKeys', ratchet_session, function(until) {
  var nr = this.nr;
  if (nr+10 < until) error("Too many skipped messages");
  if (nr+2 < until) print(fmt("Warning: % skipped messages", until-nr));
  if (this.ckr) {
    while (this.nr < until) {
      var [new_ckr, mk] = kdf_ck(this.ckr);
      this.ckr = new_ckr;
      var k = makeMSkippedKey(this.dhr, this.nr);
      this.mskipped[k] = mk;
      this.nr++;
    }
  }
});

// Multiple-Value assign -- this is a hack for older versions of JS which
// don't support arbitrary locations in multi-assignments
//
function mv_assign(o, slots, vals) {
  for (var i=0; i<slots.length; i++) o[slots[i]] = vals[i];
}

defmethod('dhRatchet', ratchet_session, function(pk) {
  this.pn = this.ns;
  this.ns = 0;
  this.nr = 0;
  this.dhr = pk;
  mv_assign(this, ['rk', 'ckr'], kdf_rk(this.rk, dh(this.dhs, this.dhr)));
  this.dhs = randomSC4Key();
  mv_assign(this, ['rk', 'cks'], kdf_rk(this.rk, dh(this.dhs, this.dhr)));
});

// Serialization interface
//
$SERIALIZABLE_CLASSES = [
  sc4_public_key, sc4_bundle, sc4_signature, sc4_hashref,
  x3dh_header, ratchet_header, key_bundle];

$SERIALIZATION_HASH = serializationHash();
