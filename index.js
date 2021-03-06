'use strict'

var request = require('superagent')

var fastclick = require('fastclick')
var Hammer = require('hammerjs')
var applyTransform = require('transform-style')
var shuffle = require('lodash.shuffle')
var State = require('ampersand-state')

var DBNAME = process.env.DBNAME || 'test'

var StudyState = State.extend({
  props: {
    latencies: {
      required: true,
      type: 'array',
      default: function() {
        // randomly ordered latencies
        return shuffle([0, 10, (1000 / 60), (1000 / 30), 50, 100, 200, 500])
      }
    },
    results: {
      required: true,
      type: 'array',
      default: function() {
        return []
      }
    },
    step: {
      required: true,
      type: 'number',
      default: 0
    },
    action: {
      required: true,
      type: 'string',
      values: ['tap', 'drag'],
      default: 'tap'
    },
    running: {
      required: true,
      type: 'boolean',
      default: false
    },
    ua: {
      required: true,
      type: 'string',
      setOnce: true,
      default: function() {
        return navigator.userAgent
      }
    }
  },
  derived: {
    latency: {
      deps: ['running', 'step', 'latencies'],
      fn: function() {
        if (!this.running) return 0
        return this.latencies[this.step]
      }
    }
  }
})

var state = new StudyState()

fastclick(document.body)

var box = document.querySelector('.box')
var modal = document.querySelector('.overlay')
var startBtn = document.querySelector('[data-hook=start]')
var rateBtn = document.querySelector('[data-hook=rate]')

// performance.now() polyfill (aka perf.now())
if ('performance' in window === false) {
  window.performance = {}
}

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
var panrecognizer = new Hammer.Pan({ threshold: 0, pointers: 0 })
var taprecognizer = new Hammer.Tap()
hammertime.add(panrecognizer)
hammertime.add(taprecognizer)

// react to tap events
hammertime.on('tap', function(evt) {
  state.action = evt.type

  if (state.latency) {
    setTimeout(function() {
      box.classList.toggle('tapped')
    }, state.latency)
  } else {
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
    if (state.latency) {
      setTimeout(function() {
        requestAnimationFrame(updateElementTransform)
      }, state.latency)
    } else {
      requestAnimationFrame(updateElementTransform)
    }
    ticking = true
  }
}

function onPan(evt) {
  translate = {
    x: evt.deltaX,
    y: evt.deltaY
  }

  requestElementUpdate()
}

// reset box
hammertime.on('hammer.input', function(ev) {
  if (ev.isFinal) {
    setTimeout(function() {
      applyTransform(box, 'translateX(0) translateY(0)')
    }, state.latency)
  }
})

function renderDescription(action) {
  var descr = document.querySelector('[data-hook=action]')
  var type = action === 'tap' ? 'Box antippen' : 'Box ziehen'
  descr.textContent = type
  document.querySelector('[data-hook=step]').textContent = state.step + 1
  document.querySelector('[data-hook=introduction]').classList.toggle('hide', state.running)
  document.querySelector('[data-hook=help]').classList.toggle('hide', !state.running)
}

state.on('change:running', function(model, running) {
  if (running) {
    hammertime.remove(panrecognizer)
    startBtn.style.display = 'none'
    rateBtn.style.display = 'block'
  } else {
    hammertime.add(taprecognizer)
    startBtn.style.display = 'block'
    rateBtn.style.display = 'none'
  }
  renderDescription(model.action)
})

state.on('change:action', function(model, action) {
  if (action === 'drag') {
    hammertime.remove(taprecognizer)
    hammertime.add(panrecognizer)
  }
  renderDescription(action)
})

state.on('change:step', function(model) {
  renderDescription(model.action)
})

startBtn.addEventListener('click', function() {
  state.running = true
})

rateBtn.addEventListener('click', function() {
  modal.classList.add('show')
})

modal.querySelector('[data-hook=next]').addEventListener('click', function() {
  var result = modal.querySelector('input:checked').value

  request.post('https://couch.klaemo.me:6984/' + DBNAME)
    .auth('latency', 'test-me')
    .set('Content-Type', 'application/json')
    .set('Accept', 'application/json')
    .send({
      type: 'rating',
      date: new Date().toISOString(),
      action: state.action, rating: result, latency: state.latency, ua: state.ua
    })
    .end()

  state.step++
  if (state.step === state.latencies.length) {
    if (state.action === 'tap') {
      state.action = 'drag'
      state.step = 0
    } else {
      state.clear()
    }
  }

  modal.classList.remove('show')
})
