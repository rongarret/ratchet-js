load('clos.js');

var console = {};
console.log = print;

// our domain

var floor  = CLOS.defClass([], undefined, "floor");
var carpet = CLOS.defClass([], undefined, "carpet");
var ball   = CLOS.defClass([], undefined, "ball");
var glass  = CLOS.defClass([], undefined, "glass");
var stick  = CLOS.defClass([], undefined, "stick");

var bumpOutput = function(x, y, result){
    console.log(/*x + ' + ' + y + ' bump = ' +*/ result);
};
var errorOutput = function(error){
    console.log('[error] ' + error);
};

// definitions

var bump = CLOS.defGeneric();

CLOS.defMethod(bump, [ball, floor], function(x, y){
    bumpOutput(x, y, 'bounce');
});
CLOS.defMethod(bump, [glass, floor], function(x, y){
    bumpOutput(x, y, 'crash');
});
CLOS.defMethod(bump, [stick, floor], function(x, y){
    bumpOutput(x, y, 'knock');
});
CLOS.defMethod(bump, [undefined, carpet], function(x, y){
    bumpOutput(x, y, 'silence');
});

/* //equiv to <top>
CLOS.defMethod(bump, [undefined, undefined], function (x, y) {
    bumpOutput(x, y, '<top>');
});
*/

var Book = CLOS.defClass([], function (x) {
  return CLOS.slot_exists(x, 'title', 'string')
      && CLOS.slot_exists(x, 'author', 'string');
});
var Flammable = CLOS.defClass([], function (x) {
  return CLOS.slot_exists(x, 'burnTime', 'number');
});
var Magazine = CLOS.defClass([Book, Flammable]);

var show = CLOS.defGeneric();

CLOS.defMethod(show, [Book], function (b) {
    console.log(b.title + " by " + b.author);
});

var burn = CLOS.defGeneric();

CLOS.defMethod(burn, [Magazine], function (m) {
    console.log(m.title + " burnt in " + m.burnTime + " seconds.");
});
CLOS.defMethod(burn, [Flammable], function (f) {
    console.log(f + " burnt in " + f.burnTime + " seconds.");
});


//method precedence test
var Foo = CLOS.defClass([]);
var Bar = CLOS.defClass([Foo]);
var Baz = CLOS.defClass([Bar]);
var alice = CLOS.defGeneric();
CLOS.defMethod(alice, [Bar, Foo], function () { console.log("bar foo"); });
CLOS.defMethod(alice, [Bar, Bar], function () { console.log("bar bar"); });
CLOS.defMethod(alice, [Baz, Baz], function () { console.log("baz baz"); });
CLOS.defMethod(alice, [Bar, Baz], function () { console.log("bar baz"); });

//immidiate values
//also tests for memoization
var fib = CLOS.define_generic(true);
CLOS.define_method(fib, [0], function (_) { return 1; });
CLOS.define_method(fib, [1], function (_) { return 1; });
CLOS.define_method(fib, ["number"], function (n) {
    return fib(n - 1) + fib(n - 2); });

//partial application
var add = CLOS.define_generic();
CLOS.define_method(add, ["number", "number"], function (a, b) { return a + b; });

// test

var tests = [
    function () {
        bump(ball, floor); //bounce
    },
    function(){
        bump(new glass, new floor); // crash
    },
    function(){
        bump(new stick, new carpet); // silence
    },
    function(){
        bump(new floor, new stick); // undefined method
    },
    function () {
        bump(new ball, new floor); //bounce
    },

    function () {
        show(CLOS.make(Book, {title:'Permutation City', author:'Greg Egan'}));
        //Permutation City by Greg Egan
    },
    function () {
        CLOS.make(Book, {}); //Initialization error
    },
    function () {
        show(CLOS.make(Magazine, {title:'Foo', author:'Bar', burnTime:5000}));
        //Foo by Bar
    },
    function () {
        burn(CLOS.make(Flammable, {burnTime: 5, name: "gas tank"}));
        burn(CLOS.make(Magazine, {burnTime: 20, title:"Foo", author:"Bar"}));
    },
    function () {
        alice(CLOS.make(Baz), CLOS.make(Baz)); //baz baz
        alice(CLOS.make(Baz), CLOS.make(Bar)); //bar bar
        alice(CLOS.make(Baz), CLOS.make(Foo)); //bar foo
        alice(CLOS.make(Bar), CLOS.make(Baz)); //bar baz
    },
    function () {
        console.log(fib(10));
    },
    function () {
        console.log("full application (expects 5): " + add(2, 3));
        console.log("partial application (expects 5): " + add(2)(3));
    }
];
for(var i in tests){
    var test = tests[i];
    try{
        test();
    }
    catch(error){
        errorOutput(error);
    }
}
