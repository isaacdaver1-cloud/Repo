// Runs before the page paints: decide whether to show the 3D launch intro.
(function () {
  var html = document.documentElement;
  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var gl = false;
  try {
    var c = document.createElement("canvas");
    gl = !!(window.WebGLRenderingContext && (c.getContext("webgl2") || c.getContext("webgl")));
  } catch (e) { gl = false; }
  html.classList.add(reduce || !gl ? "no-launch" : "launching");
})();
