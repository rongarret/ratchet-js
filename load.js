
var dswi = dswi || {};

(function() {

  var modules = ({});
  var prefix = '';
  var load_queue = [];

  function chdir(path) { prefix = path; }

  function load_in_order(files, callback) {
    load_queue = load_queue.concat(files);
    if (load_queue.length>0) {
      var file = load_queue.shift();
      load(file, function() { load_in_order([]); });
    }
  }

  function load(path, callback) {
    type = path.split('.').pop();
    if (path[0] != '/') path = prefix + path;
    if (type === 'js') loadjs(path, callback);
    else if (type === 'css') loadcss(path);
    else throw new Error('Unknown file type for LOAD: ' + path);
  }

  function loadcss (path) {
    console.log('Loading CSS: ' + path);
    var l = document.createElement('link');
    l.setAttribute('rel', 'stylesheet');
    l.setAttribute('type', 'text/css');
    l.setAttribute('href', path);
    document.getElementsByTagName("head")[0].appendChild(l);
  }

  function loadjs(path, callback) {
    if (modules[path]) return;
    console.log('Loading script: ' + path);
    modules[path] = 'loading';
    var script = document.createElement('script');
    script.setAttribute('src', path);
    script.setAttribute('type','text/javascript');
    var loaded = false;
    var loadFunction = function() { load_complete(path, callback); }
    script.onload = loadFunction;
    script.onreadystatechange = loadFunction;
    script.onerror = function() { load_complete(path, callback, 1); }
    document.getElementsByTagName("head")[0].appendChild(script)
  }

  function load_complete(path, callback, err) {
    console.log((err ? 'Failed to load ' : 'Loaded ') + path);
    if (modules[path] === 'loading') {
      modules[path] = 'loaded';
      if (callback) callback();
    }
    for (p in modules) if (!(modules[p] === 'loaded')) return;
    if (typeof init === 'undefined') {
      console.log('All modules loaded, but no init function defined.');
    } else {
      console.log('All loads complete.  Calling init()');
      init();
      console.log('Init done');
    }
  }

  dswi.load = load;
  dswi.load_in_order = load_in_order;
  dswi.chdir = chdir;
  dswi.modules = modules;

})();
