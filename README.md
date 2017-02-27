# Ratchet-JS

Ratchet-JS is a Javascript implementation of the [Signal double-ratchet](https://whispersystems.org/docs/specifications/doubleratchet/) in Javascript using [TweetNaCl-JS](https://github.com/dchest/tweetnacl-js/) (a Javascript port of [TweetNaCl](https://tweetnacl.cr.yp.to)) as its cryptographic primitives.

While TweetNaCl-JS has been audited (and [passed with flying colors](https://tweetnacl.js.org/audits/cure53.pdf)) the rest of the Ratchet-JS code has NOT been audited.  I am actively soliciting code reviews.  Until the code has been reviewed you SHOULD NOT USE IT for anything mission-critical.

Ratchet-JS is based on an [earlier Common-Lisp implementation](https://github.com/rongarret/tweetnacl/blob/master/ratchet.lisp) which also has not yet been reviewed.
