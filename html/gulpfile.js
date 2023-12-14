const { src, dest, symlink, series, parallel } = require('gulp');
const del = require('del');
const gulpif = require('gulp-if');
const uglify = require('gulp-uglify');
const rename = require('gulp-rename');
const cssnano = require('gulp-cssnano');
const useref = require('gulp-useref');
const targz = require('gulp-archiver2')
const mode = require('gulp-mode')();
const removeCode = require('gulp-remove-code');

let devMode = mode.development();

function clean() {
  return del([
    'staging/**/*',
    'dist/**/*'
  ])
}

function convertHTML() {
  // returning a stream
  return src('src/**/*.html')
    .pipe(removeCode({ production: !devMode }) )
    .pipe(useref())
    .pipe(dest('staging'));
}

function copyHTML() {
  // returning a stream
  return src('staging/**/*.html')
    .pipe(dest('dist'));
}

function copyJS() {
  return src('src/**/*.js')
    .pipe(dest('staging'));
}

function copyImages() {
  return src('src/**/*.+(png|jpg|jpeg|gif|svg|ico)')
    .pipe(dest('dist'));
}

function copyResources() {
  return src('src/**/*.+(json)')
    .pipe(dest('dist'));
}

function cssMinify(cb) {
  return src('staging/**/*.css', { sourcemaps: devMode})
    .pipe(cssnano())
    .pipe(dest('dist', { sourcemaps: '.' }));
}

function jsMinify(cb) {
  //  .pipe(rename({ extname: '.min.js' }))
  return src('staging/**/*.js', { sourcemaps: devMode})
    .pipe(removeCode({ production: !devMode }))
    .pipe(uglify())
    .pipe(dest('dist', { sourcemaps: '.' }));
}

function crtCopies() {
  return src('dist/strategy/**/*')
    .pipe(dest('dist/live'));
}

function bundle() {
  return src('dist/**')
    .pipe(targz.create('codedoc-dist.zip'))
    .pipe(dest('.'));
}

function publish(cb) {
  cb();
}

exports.build = series( 
  clean,
  parallel(
    convertHTML,
    copyJS,
    copyImages,
    copyResources
  ),
  parallel(
    copyHTML,
    cssMinify,
    jsMinify
  ),
  crtCopies,
  bundle,
  publish
);
