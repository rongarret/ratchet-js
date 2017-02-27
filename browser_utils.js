"use strict";

function load() {}

function htmlEscape(s) {
  var div = document.createElement("div");
  div.appendChild(document.createTextNode(s));
  return div.innerHTML;
}

function dprint(s) {
  document.body.appendChild(document.createTextNode(s));
  document.body.appendChild(document.createElement('br'));
};

function cprint(s) { console.log(s); };

print = dprint;
