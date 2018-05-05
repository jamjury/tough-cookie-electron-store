'use strict'

const settings = require('electron-settings')
const {Store, permuteDomain, pathMatch} = require('tough-cookie')

class ElectronCookieStore extends Store {
  constructor(keyPath = 'cookies') {
    super()
    this.idx = settings.get(keyPath) || {}
    this.keyPath = keyPath
    this.synchronous = true
  }

  findCookie(domain, path, key, cb) {
    if (!this.idx[domain]) {
      return cb(null,null)
    }
    if (!this.idx[domain][path]) {
      return cb(null,null)
    }
    return cb(null, cookies[domain][path][key]||null)
  }

  findCookies(domain, path, cb) {
    const results = []
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

  putCookie(cookie, cb) {
    if (!this.idx[cookie.domain]) {
      this.idx[cookie.domain] = {}
    }
    if (!this.idx[cookie.domain][cookie.path]) {
      this.idx[cookie.domain][cookie.path] = {}
    }
    this.idx[cookie.domain][cookie.path][cookie.key] = cookie
    settings.set(this.keyPath, this.idx)
    cb(null)
  }

  updateCookie(oldCookie, newCookie, cb) {
    // updateCookie() may avoid updating cookies that are identical.  For example,
    // lastAccessed may not be important to some stores and an equality
    // comparison could exclude that field.
    this.putCookie(newCookie,cb)
  }

  removeCookie(domain, path, key, cb) {
    if (this.idx[domain] && this.idx[domain][path] && this.idx[domain][path][key]) {
      delete this.idx[domain][path][key]
    }
    settings.set(this.keyPath, this.idx)
    cb(null)
  }

  removeCookies(domain, path, cb) {
    if (this.idx[domain]) {
      if (path) {
        delete this.idx[domain][path]
      } else {
        delete this.idx[domain]
      }
    }
    settings.set(this.keyPath, this.idx)
    return cb(null)
  }

  getAllCookies(cb) {
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
}

module.exports = ElectronCookieStore