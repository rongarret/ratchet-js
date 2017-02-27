'use strict';

/*

Classes.js - Traditional OO-style classes and instances with
single-inheritance for Javascript

Copyright (c) 2017 by Ron Garret

MIT License (https://opensource.org/licenses/MIT)

API:

### defclass(CLASS_NAME:string, SLOTS:dictionary)

Defines a class named CLASS_NAME with slots and default values defined
by SLOTS, and also binds CLASS_NAME to the resulting class object (i.e. the
Javascript constructor) in $DEFAULT_CLASS_ENV, which is initially set
to be the value of 'window'.  CLASS_NAME can be a list (i.e. an Array)
in which case the first element is the class name, and the second element
is the superclass.  Currently only single inheritance is supported but
this could be extended in the future.  If no superclass is specified,
the default is stdObject.

Note that default values of [], {} and functions are handled specially.
If the default value is [] or {} then the slot is initialized to a new
Array or Object.  If the value is a function, the the slot is initialized
to the result of calling the function.  So, for example, the following:

defclass('EXAMPLE_CLASS', {x:Math.Random(), y:Math.Random});

every instace of EXAMPLE_CLASS with have the same (random) initial value
of x, but a different (also random) initial value of y.

SLOTS is optional.  If it is specified, then instances of the class are
intialized with those slots, and then Object.preventExtensions is called
on them, so instances are guaranteed to have all and only the specified
slots.  If SLOTS is not specified then instances of the class are regular
extensible Javascript objects.

### defmethod(METHOD_NAME:string, CLASS:class, FUNCTION)

Defines a method named METHOD_NAME on the specified class.  This is just
syntactic sugar for CLASS.prototype.METHOD_NAME = FUNCTION.

### typeOf(THING)

Returns the primary type of THING.  Attempts to do the Right Thing for
all Javascript objects, not just instances of classes.

### typesOf(THING)

Returns a list of all the types of THING.  When THING
is an instance of a class this will include all of the superclasses of
THING.

### isa(THING, TYPE)

Returns true iff THING is an instance of TYPE.  Attempts to do the
Right Thing for all Javascript objects and sane type specifiers.  So,
for example, isa('foo', String) returns true notwithstanding that
('foo' instanceof String) is false.

### checkType(THING, TYPE)

Checks that THING is an instance of TYPE and throws and exception if
it is not.

The class stdObject has the following methods defined on it:

### INSTANCE.reset()

Resets all the slots of INSTANCE to their default values.

### INSTANCE.id()

Returns a unique identifier for that instance relative to that class.
By default this is a numerical value that gets incremented every time
a new instance is created.  This helps keep track of which instance is
which to make debugging easier.

### INSTANCE.toString()

Returns a string of the form #<CLASS ID> where CLASS is the name of the
root class of the instance and ID is the result of calling INSTANCE.id().
This method is defined so you never have to deal with [object Object] again.

### Examples:

defclass('C1', {x: 1, y: [], z: {}, r: Math.random});
var c1a = new C1({x:2}); // Override default value of x
var c1b = new C1;

// Every instance of C1 has its own copy of y and z
c1a.z.foo = 123;
c1b.z.foo = 321;
c1a.z.foo != c1b.z.foo;
c1a.y.push('a');
c1b.y.push('b');
c1a.y; // ['a']
c1b.y; // ['b']

c1a.a = 123;  // This fails because C1 has no slot named 'a'
c1a.a === undefined

// If we don't specify slots we get a regular extensible Javascript object
defclass('C2');
var c2 = new C2;
c2.a = 123;
c2.a === 123;

// Inheritance
defclass(['C3', C1], {a: 5, b: 6, r: 'foo'});

c3 = new C3;
c3.r == 'foo';   // C3's r overrides C1's r
typesOf(c3);     // ["C3", "C1", "stdObject"]

// Methods
defmethod('m1', C1, function() { return "C1-M1"; });
defmethod('m1', C2, function() { return "C2-M1"; });
defmethod('m2', C2, function() { return "C2-M2"; });
defmethod('m2', C3, function() { return "C3-M2"; });

print([
  c1a.m1(),
  c2.m1(),
  c2.m2(),
  c3.m1(),
  c3.m2()
]);

*/


var $CLASSES = {};
var $DEFAULT_CLASS_ENV = window;

function stdObject(keys) { this._init(keys); }

$CLASSES['stdObject'] = stdObject;

function computeClassSlots(constructor) {
  if (!constructor) return new Object;
  var slots = computeClassSlots(constructor._superclass);
  var direct_slots = constructor._direct_slots;
  for (var k in direct_slots) slots[k] = direct_slots[k];
  return slots;
}

function defclass(name, direct_slots, env) {
  if (!direct_slots) print(
    "Warning: class " + name + " has no direct slot specification")
  env = env || $DEFAULT_CLASS_ENV;
  var superclass = stdObject;
  if (isa(name, Array)) {
    superclass = name[1];
    name = name[0];
  }
  var f = (function() {
    var constructor = function(keys) { this._init(keys); };
    constructor._name = name;
    constructor._direct_slots = direct_slots;
    constructor._superclass = superclass;
    constructor._idCnt = 0;
    constructor.prototype.__proto__ = superclass.prototype;
    constructor._slots = computeClassSlots(constructor);
    return constructor;
  })();
  $CLASSES[name] = f;
  env[name] = f;
}

function defmethod(name, cls, fn) { cls.prototype[name] = fn; }

function typesOf(thing) {
  if (!(thing instanceof Object)) return [typeOf(thing)];
  var t = thing.constructor;
  var l = [t.name || t._name];
  while (t = t._superclass) l.push(t.name || t._name);
  return l;
}

defmethod('id', stdObject, function() { return this._id; });

defmethod('toString', stdObject, function() {
  return "#<" + typeOf(this) + ' ' + this.id() + ">";
});

defmethod('slots', stdObject, function() { return this.constructor._slots; });

defmethod('slotNames', stdObject, function () {
  var l = [];
  for (var k in this.slots()) l.push(k);
  return l;
});

defmethod('reset', stdObject, function(keys) {
  var slots = this.slots();
  for (var k in slots) this[k] = maybeCall(slots[k]);
  if (this.constructor._direct_slots === undefined) {
    for (var k in keys) this[k] = keys[k];
  } else {
    Object.preventExtensions(this);
    for (var k in keys) {
      if (k in slots) this[k] = keys[k];
      else error("Object " + this + " has no slot named " + k);
    }
  }
});

defmethod('_init', stdObject, function(keys) {
  this._id = this.constructor._idCnt++;
  this.reset(keys);
});
