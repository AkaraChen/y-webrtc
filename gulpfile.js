/* eslint-env node */

/** Gulp Commands

  gulp command*
    [--export ModuleType]
    [--name ModuleName]
    [--testport TestPort]
    [--testfiles TestFiles]

  Module name (ModuleName):
    Compile this to "y.js" (default)

  Supported module types (ModuleType):
    - amd
    - amdStrict
    - common
    - commonStrict
    - ignore (default)
    - system
    - umd
    - umdStrict

  Test port (TestPort):
    Serve the specs on port 8888 (default)

  Test files (TestFiles):
    Specify which specs to use!

  Commands:
    - build:deploy
        Build this library for deployment (es6->es5, minified)
    - dev:browser
        Watch the ./src directory.
        Builds the library on changes.
        Starts an http-server and serves the test suite on http://127.0.0.1:8888.
    - dev:node
        Watch the ./src directory.
        Builds and specs the library on changes.
        Usefull to run with node-inspector.
        `node-debug $(which gulp) dev:node
    - test:
        Test this library
*/

var gulp = require('gulp')
var minimist = require('minimist')
var concat = require('gulp-concat')
var $ = require('gulp-load-plugins')()

var options = minimist(process.argv.slice(2), {
  string: ['export', 'name', 'testport', 'testfiles', 'regenerator'],
  default: {
    export: 'ignore',
    name: 'y-webrtc.js',
    testport: '8888',
    testfiles: 'src/**/*.js',
    regenerator: process.version < 'v0.12'
  }
})

var polyfills = [
]

var concatOrder = [
  'WebRTC.js'
]

var files = {
  src: polyfills.concat(concatOrder.map(function (f) {
    return 'src/' + f
  })),
  test: [].concat(concatOrder.map(function (f) {
    return 'build/' + f
  }).concat(['build/**/*.spec.js']))
}

if (options.regenerator) {
  files.test = polyfills.concat(files.test)
}

gulp.task('deploy:build', function () {
  return gulp.src(files.src)
    .pipe($.sourcemaps.init())
    .pipe(concat('y-webrtc.js'))
    .pipe($.babel({
      loose: 'all',
      modules: 'ignore',
      experimental: true
    }))
    .pipe($.uglify())
    .pipe($.sourcemaps.write('.'))
    .pipe(gulp.dest('./dist/'))
})

gulp.task('deploy:updateSubmodule', function () {
  return $.git.updateSubmodule({ args: '--init' })
})

gulp.task('deploy:copy', function () {
  return gulp.src(['README.md'], {base: '.'})
    .pipe(gulp.dest('dist/'))
})

gulp.task('deploy:bump', function () {
  return gulp.src(['./package.json', './dist/package.json'], {base: '.'})
    .pipe($.bump({type: 'patch'}))
    .pipe(gulp.dest('./'))
})

gulp.task('deploy', ['deploy:updateSubmodule', 'deploy:bump', 'deploy:build', 'deploy:copy'], function () {
  return gulp.src('./package.json', {read: false})
    .pipe($.shell([
      'standard',
      'echo "Deploying version <%= getVersion(file.path) %>"',
      'git pull',
      'cd ./dist/ && git add -A',
      'cd ./dist/ && git commit -am "Deploy <%= getVersion(file.path) %>" -n',
      'cd ./dist/ && git push',
      'cd ./dist/ && git tag -a v<%= getVersion(file.path) %> -m "Release <%= getVersion(file.path) %>"',
      'cd ./dist/ && git push origin --tags',
      'git commit -am "Release <%= getVersion(file.path) %>" -n',
      'git push'
    ], {
      templateData: {
        getVersion: function (s) {
          return require(s).version
        }
      }
    }))
})

gulp.task('build:test', function () {
  var babelOptions = {
    loose: 'all',
    modules: 'ignore',
    experimental: true
  }
  if (!options.regenerator) {
    babelOptions.blacklist = 'regenerator'
  }
  gulp.src(files.src)
    .pipe($.sourcemaps.init())
    .pipe(concat('y-webrtc.js'))
    .pipe($.babel(babelOptions))
    .pipe($.sourcemaps.write())
    .pipe(gulp.dest('.'))

  return gulp.src('src/**/*.js')
    .pipe($.sourcemaps.init())
    .pipe($.babel(babelOptions))
    .pipe($.sourcemaps.write())
    .pipe(gulp.dest('build'))
})

gulp.task('dev:node', ['test'], function () {
  gulp.watch('src/**/*.js', ['test'])
})

gulp.task('dev:browser', ['build:test'], function () {
  gulp.watch('src/**/*.js', ['build:test'])

  gulp.src(files.test)
    .pipe($.watch(['build/**/*.js']))
    .pipe($.jasmineBrowser.specRunner())
    .pipe($.jasmineBrowser.server({port: options.testport}))
})

gulp.task('dev', ['build:test'], function () {
  gulp.start('dev:browser')
  gulp.start('dev:node')
})

gulp.task('copy:dist', ['deploy:build'], function () {
  return gulp.src(['./dist/y-webrtc.js', './dist/y-webrtc.js.map'])
    .pipe(gulp.dest('./dist/Examples/bower_components/yjs/'))
})

gulp.task('dev:examples', ['copy:dist'], function () {
  gulp.watch('src/**/*.js', ['copy:dist'])
  return $.serve('dist/Examples')()
})

gulp.task('test', ['build:test'], function () {
  var testfiles = files.test
  if (typeof Promise === 'undefined') {
    testfiles.concat(['src/polyfills.js'])
  }
  return gulp.src(testfiles)
    .pipe($.jasmine({
      verbose: true,
      includeStuckTrace: true
    }))
})

gulp.task('default', ['test'])
