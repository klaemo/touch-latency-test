'use strict'

var fastclick = require('fastclick')
var Hammer = require('hammerjs')
var applyTransform = require('transform-style')

fastclick(document.body)

var box = document.querySelector('.box')
var selector = document.querySelector('.selector select')

var latency = 0

// performance.now() polyfill (aka perf.now())
if ('performance' in window === false) {
  window.performance = {}
}

Date.now = (Date.now || function() {  // thanks IE8
  return new Date().getTime()
})

if ('now' in window.performance === false) {
  var nowOffset = Date.now()

  if (performance.timing && performance.timing.navigationStart) {
    nowOffset = performance.timing.navigationStart
  }

  window.performance.now = function now() {
    return Date.now() - nowOffset
  }
}

var ticking = false
var translate = {}

var hammertime = new Hammer.Manager(box)

hammertime.add(new Hammer.Pan({ threshold: 0, pointers: 0 }))
hammertime.add(new Hammer.Tap())

// react to tap events
hammertime.on('tap', function() {
  var start = performance.now()

  if (latency) {
    setTimeout(function() {
      box.textContent = Math.round(performance.now() - start) + 'ms'
      box.classList.toggle('tapped')
    }, latency)
  } else {
    box.textContent = Math.round(performance.now() - start) + 'ms'
    box.classList.toggle('tapped')
  }
})

// react to drag events
hammertime.on('panstart panmove', onPan)

function updateElementTransform() {
  applyTransform(box, 'translateX(' + translate.x + 'px) translateY(' + translate.y + 'px)')
  ticking = false
}

function requestElementUpdate() {
  if (!ticking) {
    if (latency) {
      setTimeout(updateElementTransform, latency)
    } else {
      requestAnimationFrame(updateElementTransform)
    }
    ticking = true
  }
}

function onPan(ev) {
  translate = {
    x: ev.deltaX,
    y: ev.deltaY
  }

  requestElementUpdate()
}

// reset box
hammertime.on('hammer.input', function(ev) {
  if (ev.isFinal) {
    setTimeout(function() {
      applyTransform(box, 'translateX(0) translateY(0)')
    }, latency)
  }
})

selector.addEventListener('change', function(event) {
  latency = parseInt(event.target.value)
}, false)
