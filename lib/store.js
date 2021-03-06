'use strict';

const settings = require('electron-settings')
const {Store, permuteDomain, pathMatch, ...tough} = require('tough-cookie')
const util = require('util')

function ElectronCookieStore(keyPath = 'cookies') {
    Store.call(this)
    this.idx = get(keyPath) || {}
    this.keyPath = keyPath
}
util.inherits(ElectronCookieStore, Store)
module.exports = ElectronCookieStore
ElectronCookieStore.prototype.idx = null
ElectronCookieStore.prototype.synchronous = true

ElectronCookieStore.prototype.findCookie = function(domain, path, key, cb) {
  if (!this.idx[domain]) {
    return cb(null,null)
  }
  if (!this.idx[domain][path]) {
    return cb(null,null)
  }
  return cb(null, this.idx[domain][path][key]||null)
}

ElectronCookieStore.prototype.findCookies = function(domain, path, cb) {
  var results = []
  if (!domain) {
    return cb(null,[])
  }

  let pathMatcher
  if (!path) {
    // null means "all paths"
    pathMatcher = function matchAll(domainIndex) {
      for (var curPath in domainIndex) {
        var pathIndex = domainIndex[curPath]
        for (var key in pathIndex) {
          results.push(pathIndex[key])
        }
      }
    }
  } else {
    pathMatcher = function matchRFC(domainIndex) {
       //NOTE: we should use path-match algorithm from S5.1.4 here
       //(see : https://github.com/ChromiumWebApps/chromium/blob/b3d3b4da8bb94c1b2e061600df106d590fda3620/net/cookies/canonical_cookie.cc#L299)
       Object.keys(domainIndex).forEach(function (cookiePath) {
         if (pathMatch(path, cookiePath)) {
           var pathIndex = domainIndex[cookiePath]

           for (var key in pathIndex) {
             results.push(pathIndex[key])
           }
         }
       })
     }
  }

  var domains = permuteDomain(domain) || [domain]
  var idx = this.idx
  domains.forEach(function(curDomain) {
    var domainIndex = idx[curDomain]
    if (!domainIndex) {
      return
    }
    pathMatcher(domainIndex)
  })

  cb(null,results)
}

ElectronCookieStore.prototype.putCookie = function(cookie, cb) {
  if (!this.idx[cookie.domain]) {
    this.idx[cookie.domain] = {}
  }
  if (!this.idx[cookie.domain][cookie.path]) {
    this.idx[cookie.domain][cookie.path] = {}
  }
  this.idx[cookie.domain][cookie.path][cookie.key] = cookie
  set(this.keyPath, this.idx)
  cb(null)
}

ElectronCookieStore.prototype.updateCookie = function(oldCookie, newCookie, cb) {
    // updateCookie() may avoid updating cookies that are identical.  For example,
    // lastAccessed may not be important to some stores and an equality
    // comparison could exclude that field.
    this.putCookie(newCookie,cb)
  }

ElectronCookieStore.prototype.removeCookie = function(domain, path, key, cb) {
  if (this.idx[domain] && this.idx[domain][path] && this.idx[domain][path][key]) {
    delete this.idx[domain][path][key]
  }
  set(this.keyPath, this.idx)
  cb(null)
}

ElectronCookieStore.prototype.removeCookies = function(domain, path, cb) {
  if (this.idx[domain]) {
    if (path) {
      delete this.idx[domain][path]
    } else {
      delete this.idx[domain]
    }
  }
  set(this.keyPath, this.idx)
  return cb(null)
}

ElectronCookieStore.prototype.getAllCookies = function(cb) {
  var cookies = []
  var idx = this.idx

  var domains = Object.keys(idx)
  domains.forEach(function(domain) {
    var paths = Object.keys(idx[domain])
    paths.forEach(function(path) {
      var keys = Object.keys(idx[domain][path])
      keys.forEach(function(key) {
        if (key !== null) {
          cookies.push(idx[domain][path][key])
        }
      })
    })
  })

  // Sort by creationIndex so deserializing retains the creation order.
  // When implementing your own store, this SHOULD retain the order too
  cookies.sort(function(a,b) {
    return (a.creationIndex||0) - (b.creationIndex||0)
  })

  cb(null, cookies)
}

function get(keyPath) {
  var data = settings.get(keyPath)
  var dataJSON = data ? JSON.parse(data) : null
  for(var domain in dataJSON) {
    for(var path in dataJSON[domain]) {
      for(var cookie in dataJSON[domain][path]) {
        dataJSON[domain][path][cookie] = tough.fromJSON(JSON.stringify(dataJSON[domain][path][cookie]))
      }
    }
  }
  return dataJSON
}

function set(keyPath, data) {
  settings.set(keyPath, JSON.stringify(data))
}
