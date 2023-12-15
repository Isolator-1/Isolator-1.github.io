/* global Fluid */

Fluid.boot = {};

Fluid.boot.registerEvents = function() {
  Fluid.events.billboard();
  Fluid.events.registerNavbarEvent();
  Fluid.events.registerParallaxEvent();
  Fluid.events.registerScrollDownArrowEvent();
  Fluid.events.registerScrollTopArrowEvent();
  Fluid.events.registerImageLoadedEvent();
};

Fluid.boot.refresh = function() {
  Fluid.plugins.fancyBox();
  Fluid.plugins.codeWidget();
  Fluid.events.refresh();
};

document.addEventListener('DOMContentLoaded', function() {
  Fluid.boot.registerEvents();
});


var targetElement = document.getElementById('board'); 
var pseudoElement = document.createElement('div');
pseudoElement.style.backgroundImage = "url('/img/chtholly4.jpg')";
pseudoElement.style.opacity = 0.3;
pseudoElement.style.position = 'absolute';
pseudoElement.style.top = '50%';
pseudoElement.style.left = '50%';
pseudoElement.style.width = '100%';
pseudoElement.style.height = '100%';
pseudoElement.style.backgroundSize = 'cover'; // 图片永远不进行复制填充，并且通过放大填满整个board
pseudoElement.style.backgroundPosition = 'center'; // 图片的中心保持在board的中心
pseudoElement.style.transform = 'translate(-50%, -50%)'; // 图片的中心保持在board的中心
pseudoElement.style.zIndex = -1;
targetElement.appendChild(pseudoElement);

