var _ = require('underscore'),
    bower = require('bower'),
    childProcess = require('child_process'),
    fs = require('fs'),
    request = require('request'),
    util = require('util'),
    semver = require('semver'),
    yeoman = require('yeoman-generator');

var CollectVersions = module.exports = function CollectVersions(args, options, config) {

  yeoman.generators.Base.apply(this, arguments);

  this.argument('type', {desc: 'Version type. May be one of {scotsman, bower, hapi, npm}', required: true});

  if (this.type === 'scotsman' || this.type === 'hapi') {
    this.argument('url', {desc: 'Remote version list url', required: true});
  } else if (this.type !== 'bower' && this.type !== 'npm') {
    throw new Error('First argument must be one of {scotsman, bower, hapi, npm}');
  }
};

util.inherits(CollectVersions, yeoman.generators.Base);

CollectVersions.prototype.exec = function() {
  if (this.type === 'scotsman') {
    this._scotsman();
  } else if (this.type === 'hapi') {
    this._hapi();
  } else if (this.type === 'bower') {
    this._bowerLS();
  } else if (this.type === 'npm') {
    this._npmLS();
  }
};

CollectVersions.prototype._scotsman = function() {
  var done = this.async(),
      self = this;
  request(this.url, function(err, response, body) {
    if (err) {
      throw new Error('Failed to load scotsman url "' + self.url + '" ' + err);
    }

    var ls = (/<pre>((?:\n|.)*?)<\/pre>/.exec(body) || [])[1];
    self.versions = parseVersions(ls);
    self.versions[0].bowerRoot = true;

    done();
  });
};

CollectVersions.prototype._bowerLS = function() {
  var done = this.async(),
      self = this;
  childProcess.exec('bower ls --offline', function(err, stdout, stderr) {
    self.versions = parseVersions(stdout);
    self.versions[0].bowerRoot = true;

    done();
  });
};

CollectVersions.prototype._hapi = function() {
  var done = this.async(),
      self = this;
  request(this.url, function(err, response, body) {
    if (err) {
      throw err;
    }

    var versions = JSON.parse(body);
    self.versions = versions;

    done();
  });
};

CollectVersions.prototype._npmLS = function() {
  var done = this.async(),
      self = this;
  childProcess.exec('npm ls --json', function(err, stdout, stderr) {
    function deepPluck(name, obj) {
      var dependencies;

      if (obj.dependencies) {
        dependencies = _.map(obj.dependencies, function(info, name) {
          return deepPluck(name, info);
        });

        return {
          name: name,
          version: obj.version,
          dependencies: dependencies
        };
      } else {
        return {
          name: name,
          version: obj.version
        };
      }
    }

    var list = JSON.parse(stdout);
    self.versions = [
      deepPluck(list.name, list)
    ];

    done();
  });

};

CollectVersions.prototype.output = function() {
  if (!this.quiet) {
    console.log(JSON.stringify(this.versions, undefined, 2));
  }
};

function parseVersions(ls) {
  var versions = [],
      matcher = /(\S+)#(\S+)/g,
      match;
  while (match = matcher.exec(ls)) {
    versions.push({
      name: match[1],
      version: match[2]
    });
  }
  return versions;
}